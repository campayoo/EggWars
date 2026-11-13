// ============================================================================
// server/gameRoom.js — Una sala de juego: jugadores, rondas, modos y validación
// ============================================================================

const MapDefs = require('../shared/mapdefs.js');
const Phys = require('../shared/physics.js');
const { WEAPONS, PRIMARY_KEYS, MELEE, MODES, RULES, TIME_LIMITS, falloff, minInterval } = require('../shared/gamedata.js');
const Cosmetics = require('../shared/cosmetics.js');
const AC = require('./anticheat.js');
const { BotManager } = require('./bots.js');

const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;
const EYE = Phys.P.EYE;
const HOLD_MAX_MS = 180000;   // tras terminar el admin una ronda, espera como mucho 3 min
const KICK_BAN_MS = 120000;   // un expulsado no puede volver a entrar en 2 min

function clampNum(v, lo, hi, def) {
  const n = Number(v);
  if (!isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

class GameRoom {
  /**
   * opts: { id, code, name, map, mode, maxPlayers, scoreLimit, timeLimit, isPrivate, isDefault }
   */
  constructor(io, opts) {
    this.io = io;
    this.id = opts.id;
    this.code = opts.code;
    this.name = opts.name || 'Sala Egg Wars';
    this.isPrivate = !!opts.isPrivate;
    this.isDefault = !!opts.isDefault;
    this.hooks = opts.hooks || {};
    this.maxPlayers = opts.maxPlayers || 8;
    this.ownerAccount = opts.ownerAccount || null; // cuenta que creó la sala (admin preferente)
    this.joinSeq = 0;
    this.hold = false;       // ronda terminada por el admin: no empieza otra hasta que él quiera
    this.pausedAt = 0;
    this.kicked = new Map(); // cuenta -> hasta cuándo no puede volver
    const mode = MODES[opts.mode] ? opts.mode : 'ffa';
    this.config = {
      mode,
      map: MapDefs.resolveId(opts.map),
      scoreLimit: opts.scoreLimit || MODES[mode].defLimit,
      timeLimit: opts.timeLimit === undefined ? 10 : opts.timeLimit, // minutos
    };
    this.mapData = MapDefs.build(this.config.map);
    this.world = Phys.createWorld(this.mapData);
    this.players = {};
    this.grenades = {};
    this.grenadeIdSeq = 0;
    this.emptySince = Date.now();
    this.startRound(false);
    // Bots (v6.2): opts.bots = cuántos quiere la sala; ocupan las plazas que dejan libres los jugadores
    this.botMgr = null;
    if (opts.bots) this.setBots(opts.bots, opts.botDifficulty);
    this.tickInterval = setInterval(() => {
      try { this.tick(); } catch (e) { console.error(`[sala ${this.id}] error en tick`, e && e.stack || e); }
    }, TICK_MS);
  }

  destroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    if (this.botMgr) { this.botMgr.destroy(); this.botMgr = null; }
  }

  /** Número de bots y dificultad ('easy' | 'normal' | 'hard') */
  setBots(n, difficulty) {
    n = Math.max(0, Math.min(17, Math.round(Number(n) || 0)));
    if (!this.botMgr && !n) return;
    if (!this.botMgr) this.botMgr = new BotManager(this, { difficulty });
    else if (difficulty) this.botMgr.setDifficulty(difficulty);
    this.botMgr.setCount(n);
  }
  botCount() { return this.botMgr ? this.botMgr.count() : 0; }
  /** Jugadores de verdad (sin contar bots) */
  humanCount() { let n = 0; for (const id in this.players) if (!this.players[id].bot) n++; return n; }

  get mode() { return MODES[this.config.mode]; }
  getPlayersCount() { return Object.keys(this.players).length; }
  getMapData() { return this.mapData; }
  getHalfSize() { return this.mapData.halfSize; }

  /** Valida unos ajustes de partida (crear sala o cambiarlos desde el admin). */
  static validateSettings(data, cur) {
    data = data || {}; cur = cur || {};
    const mode = MODES[data.mode] ? data.mode : (MODES[cur.mode] ? cur.mode : 'ffa');
    const map = data.map !== undefined && data.map !== null
      ? (MapDefs.MAPS[data.map] ? data.map : MapDefs.resolveId(data.map))
      : (cur.map || 'castle');
    const modeChanged = mode !== cur.mode;
    const defLimit = MODES[mode].defLimit;
    const scoreLimit = Math.round(clampNum(data.scoreLimit, 1, 100, modeChanged || !cur.scoreLimit ? defLimit : cur.scoreLimit));
    const tl = Number(data.timeLimit);
    const timeLimit = TIME_LIMITS.includes(tl) ? tl : (TIME_LIMITS.includes(cur.timeLimit) ? cur.timeLimit : 10);
    const maxPlayers = Math.round(clampNum(data.maxPlayers, 2, 18, cur.maxPlayers || 8));
    const name = (typeof data.name === 'string' ? data.name.trim() : '').substring(0, 24) || cur.name || '';
    const bots = Math.round(clampNum(data.bots, 0, maxPlayers - 1, cur.bots || 0));
    const botDifficulty = ['easy', 'normal', 'hard'].includes(data.botDifficulty) ? data.botDifficulty : (cur.botDifficulty || 'normal');
    return { mode, map, scoreLimit, timeLimit, maxPlayers, name, bots, botDifficulty };
  }

  /** El admin es el creador de la sala si está dentro; si no, quien lleve más tiempo. */
  adminId() {
    let best = null;
    for (const id in this.players) {
      const p = this.players[id];
      if (p.bot) continue;   // un bot nunca es el admin
      if (this.ownerAccount && p.account === this.ownerAccount) return id;
      if (!best || p.joinedAt < best.joinedAt) best = p;
    }
    return best ? best.id : null;
  }

  isKicked(accountKey) {
    const until = accountKey && this.kicked.get(accountKey);
    if (!until) return false;
    if (Date.now() > until) { this.kicked.delete(accountKey); return false; }
    return true;
  }

  publicConfig() {
    return {
      ...this.config,
      roomId: this.id,
      roomName: this.name,
      code: this.code,
      mapName: this.mapData.name,
      modeName: this.mode.name,
      killLimit: this.config.scoreLimit,
      maxPlayers: this.maxPlayers,
      isPrivate: this.isPrivate,
      gravity: this.mapData.gravity,
      bots: this.botMgr ? this.botMgr.target || 0 : 0,
      botDifficulty: this.botMgr ? this.botMgr.diffName : 'normal',
      teams: this.mode.teams,
    };
  }

  listInfo() {
    return {
      id: this.id,
      code: this.isPrivate ? null : this.code,
      name: this.name,
      map: this.config.map,
      mapName: this.mapData.name,
      mode: this.config.mode,
      modeName: this.mode.name,
      playersCount: this.humanCount(),
      bots: this.botCount(),
      maxPlayers: this.maxPlayers,
      scoreLimit: this.config.scoreLimit,
      timeLimit: this.config.timeLimit,
      state: this.state,
      isDefault: this.isDefault,
      isPrivate: this.isPrivate,
    };
  }

  // ---------------------------------------------------------------------------
  // Rondas
  // ---------------------------------------------------------------------------
  startRound(announce) {
    const now = Date.now();
    this.state = 'playing';
    this.hold = false;
    this.pausedAt = 0;
    this.roundStartedAt = now;
    this.roundEndsAt = this.config.timeLimit > 0 ? now + this.config.timeLimit * 60000 : 0;
    this.teamScores = { red: 0, blue: 0 };
    this.coop = { idx: Math.floor(Math.random() * this.mapData.coops.length), progress: 0, team: null, contested: false, activeAt: now };
    const sp = this.mapData.spatula;
    this.spatula = { state: 'home', x: sp.x, y: sp.y, z: sp.z, carrier: null, droppedAt: 0 };
    for (const gid in this.grenades) delete this.grenades[gid];
    this.packs = (this.mapData.healthPacks || []).map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, active: true, respawnAt: 0 }));
    this.gpacks = (this.mapData.grenadePacks || []).map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, active: true, respawnAt: 0 }));
    if (!announce) return;
    const positions = {};
    for (const id in this.players) {
      const p = this.players[id];
      p.kills = 0; p.deaths = 0; p.score = 0; p.streak = 0;
      this.respawn(p, false);
      positions[id] = { x: p.x, y: p.y, z: p.z, rotY: p.rotY, team: p.team };
    }
    this.io.to(this.id).emit('round:start', { players: positions, config: this.publicConfig(), endsAt: this.roundEndsAt, adminId: this.adminId() });
  }

  endRound(reason, winnerName, winnerTeam) {
    if (this.state !== 'playing') return;
    this.state = 'ended';
    this.endedAt = Date.now();
    const standings = Object.values(this.players)
      .map(p => ({ id: p.id, nickname: p.nickname, kills: p.kills, deaths: p.deaths, score: p.score, team: p.team }))
      .sort((a, b) => (b.score - a.score) || (b.kills - a.kills) || (a.deaths - b.deaths));
    if (this.hooks.onRoundEnd) {
      try { this.hooks.onRoundEnd(Object.values(this.players), winnerTeam || null, standings[0] ? standings[0].id : null, this.mode.teams); } catch (e) { console.error(e); }
    }
    this.io.to(this.id).emit('game:over', {
      reason, winner: winnerName, winnerTeam: winnerTeam || null,
      standings, teamScores: this.teamScores, nextIn: RULES.INTERMISSION_MS,
      hold: this.hold, adminId: this.adminId(),
    });
  }

  checkWin() {
    if (this.state !== 'playing') return;
    const limit = this.config.scoreLimit;
    if (this.mode.teams) {
      for (const t of ['red', 'blue']) {
        if (this.teamScores[t] >= limit) {
          const tn = t === 'red' ? 'Rojo' : 'Azul';
          this.endRound(`¡El equipo ${tn} gana la partida! (${this.teamScores.red} - ${this.teamScores.blue})`, `Equipo ${tn}`, t);
          return;
        }
      }
    } else {
      for (const id in this.players) {
        const p = this.players[id];
        if (p.score >= limit) {
          this.endRound(`¡${p.nickname} llegó a ${limit} bajas!`, p.nickname, null);
          return;
        }
      }
    }
  }

  timeUp(prefix) {
    const pre = prefix || '¡Tiempo!';
    if (this.mode.teams) {
      const r = this.teamScores.red, b = this.teamScores.blue;
      if (r === b) this.endRound(`${pre} Empate ${r} - ${b}`, 'Empate', null);
      else {
        const t = r > b ? 'red' : 'blue';
        const tn = t === 'red' ? 'Rojo' : 'Azul';
        this.endRound(`${pre} Gana el equipo ${tn} (${r} - ${b})`, `Equipo ${tn}`, t);
      }
    } else {
      const arr = Object.values(this.players).sort((a, b) => (b.score - a.score) || (a.deaths - b.deaths));
      if (!arr.length) { this.endRound(pre, '-', null); return; }
      if (arr.length > 1 && arr[0].score === arr[1].score && arr[0].deaths === arr[1].deaths) this.endRound(`${pre} Empate`, 'Empate', null);
      else this.endRound(`${pre} Gana ${arr[0].nickname} con ${arr[0].score} ${this.config.mode === 'ffa' ? 'bajas' : 'puntos'}`, arr[0].nickname, null);
    }
  }

  // ---------------------------------------------------------------------------
  // Admin de la sala: pausar, reanudar, terminar, reiniciar y cambiar ajustes
  // ---------------------------------------------------------------------------
  pause(byName) {
    if (this.state !== 'playing') return false;
    this.state = 'paused';
    this.pausedAt = Date.now();
    this.io.to(this.id).emit('room:paused', { paused: true, by: byName || null });
    return true;
  }

  resume(byName, silent) {
    if (this.state !== 'paused') return false;
    const now = Date.now(), d = now - this.pausedAt;
    if (this.roundEndsAt) this.roundEndsAt += d;
    for (const id in this.players) {
      const p = this.players[id];
      p.lastMoveAt = now;
      if (p.respawnAt) p.respawnAt += d;
      if (p.spawnProtectUntil > this.pausedAt) p.spawnProtectUntil += d;
      if (p.grenadeRegenAt) p.grenadeRegenAt += d;
    }
    for (const gid in this.grenades) this.grenades[gid].detonateAt += d;
    if (this.rockets) for (const r of this.rockets) r.at += d;
    for (const pk of this.packs) if (!pk.active) pk.respawnAt += d;
    for (const gp of this.gpacks) if (!gp.active) gp.respawnAt += d;
    if (this.spatula.droppedAt) this.spatula.droppedAt += d;
    if (this.coop) this.coop.activeAt += d;
    this.state = 'playing';
    this.pausedAt = 0;
    if (!silent) this.io.to(this.id).emit('room:paused', { paused: false, by: byName || null });
    return true;
  }

  applySettings(s, byName) {
    const mapChanged = s.map !== this.config.map;
    const hadTeams = this.mode.teams;
    this.config = { mode: s.mode, map: s.map, scoreLimit: s.scoreLimit, timeLimit: s.timeLimit };
    if (s.name) this.name = s.name;
    this.maxPlayers = Math.max(s.maxPlayers, this.humanCount());
    if (mapChanged) {
      this.mapData = MapDefs.build(this.config.map);
      this.world = Phys.createWorld(this.mapData);
    }
    if (this.mode.teams && !hadTeams) {
      for (const id in this.players) this.players[id].team = null;
      const ids = Object.keys(this.players).sort(() => Math.random() - 0.5);
      for (const id of ids) this.players[id].team = this.assignTeam();
    } else if (!this.mode.teams) {
      for (const id in this.players) this.players[id].team = null;
    }
    if (s.bots !== undefined) this.setBots(s.bots, s.botDifficulty);
    this.io.to(this.id).emit('room:notice', { text: `⚙️ ${byName || 'El admin'} cambió la partida: ${this.mapData.name} · ${this.mode.name}` });
    this.startRound(true);
  }

  /** Acción del admin. Devuelve { ok } / { error } / { kick: id } (la expulsión la remata server.js). */
  handleAdmin(socketId, d) {
    d = d || {};
    const admin = this.players[socketId];
    if (!admin) return { error: 'No estás en la sala' };
    if (socketId !== this.adminId()) return { error: 'Sólo el admin de la sala puede hacer eso' };
    const who = admin.nickname;
    switch (d.action) {
      case 'pause':
        return this.pause(who) ? { ok: 'Partida en pausa' } : { error: 'Sólo se puede pausar durante la ronda' };
      case 'resume':
        return this.resume(who) ? { ok: 'Partida reanudada' } : { error: 'La partida no está en pausa' };
      case 'restart':
        this.io.to(this.id).emit('room:notice', { text: `🔄 ${who} reinició la ronda` });
        this.startRound(true);
        return { ok: 'Ronda reiniciada' };
      case 'end': {
        if (this.state === 'paused') this.resume(who, true);
        if (this.state !== 'playing') return { error: 'La ronda ya ha terminado' };
        this.hold = true;
        this.timeUp('🏁 El admin terminó la ronda.');
        return { ok: 'Ronda terminada. Cambia los ajustes o empieza otra.' };
      }
      case 'start':
        if (this.state !== 'ended') return { error: 'La ronda ya está en marcha' };
        this.startRound(true);
        return { ok: '¡Nueva ronda!' };
      case 'settings': {
        const cur = Object.assign({ name: this.name, maxPlayers: this.maxPlayers, bots: this.botMgr ? this.botMgr.target || 0 : 0, botDifficulty: this.botMgr ? this.botMgr.diffName : 'normal' }, this.config);
        const s = GameRoom.validateSettings(d.settings, cur);
        this.applySettings(s, who);
        return { ok: 'Ajustes aplicados', changed: true };
      }
      case 'team': {
        const t = this.players[d.id];
        if (!t) return { error: 'Ese jugador ya no está' };
        const res = this.switchTeam(t, d.team, true);
        if (res.ok) res.ok = `${t.nickname} → equipo ${t.team === 'red' ? 'Rojo' : 'Azul'}`;
        return res;
      }
      case 'kick': {
        const t = this.players[d.id];
        if (!t) return { error: 'Ese jugador ya no está' };
        if (t.id === socketId) return { error: 'No puedes expulsarte a ti mismo' };
        if (t.account) this.kicked.set(t.account, Date.now() + KICK_BAN_MS);
        this.io.to(this.id).emit('room:notice', { text: `🚪 ${who} expulsó a ${t.nickname}` });
        return { kick: t.id, ok: `${t.nickname} expulsado` };
      }
    }
    return { error: 'Acción desconocida' };
  }

  // ---------------------------------------------------------------------------
  // Spawns: elegir el punto más alejado de los enemigos vivos
  // ---------------------------------------------------------------------------
  pickSpawn(team, selfId) {
    const md = this.mapData;
    const list = (this.mode.teams && team && md.teamSpawns[team] && md.teamSpawns[team].length) ? md.teamSpawns[team] : md.spawns;
    const enemies = Object.values(this.players).filter(p => p.alive && p.id !== selfId && (!this.mode.teams || p.team !== team));
    const scored = list.map(s => {
      let minD = 999;
      for (const e of enemies) minD = Math.min(minD, Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z));
      return { s, d: minD + Math.random() * 4 };
    }).sort((a, b) => b.d - a.d);
    const pick = scored[Math.floor(Math.random() * Math.min(2, scored.length))].s;
    return { x: pick.x, y: pick.y, z: pick.z };
  }

  respawn(p, emit) {
    const s = this.pickSpawn(p.team, p.id);
    p.x = s.x; p.y = s.y; p.z = s.z;
    p.rotY = Math.atan2(s.x, s.z); // mirando hacia el centro
    p.hp = RULES.MAX_HP; p.alive = true; p.respawnAt = null;
    p.spawnedAt = Date.now();
    if (p.weapon !== p.primary) { p.weapon = p.primary; this.io.to(this.id).emit('player:weapon-switched', { playerId: p.id, weapon: p.weapon }); }
    p.spawnProtectUntil = Date.now() + RULES.SPAWN_PROTECT_MS;
    p.grenades = RULES.GRENADE_START;   // las granadas NO se regalan: se recogen del suelo
    p.lastMoveAt = Date.now(); p.moveStrikes = 0;
    AC.resetPlayer(p, Date.now());
    if (emit) this.io.to(this.id).emit('player:respawn', { id: p.id, x: p.x, y: p.y, z: p.z, rotY: p.rotY });
  }

  assignTeam() {
    let red = 0, blue = 0, redScore = 0, blueScore = 0;
    for (const id in this.players) {
      const p = this.players[id];
      if (p.team === 'red') { red++; redScore += p.score; }
      if (p.team === 'blue') { blue++; blueScore += p.score; }
    }
    if (red !== blue) return red < blue ? 'red' : 'blue';
    return this.teamScores.red <= this.teamScores.blue ? 'red' : 'blue';
  }

  // ---------------------------------------------------------------------------
  // Serialización
  // ---------------------------------------------------------------------------
  sanitizePlayers() {
    const out = {};
    const now = Date.now();
    for (const id in this.players) {
      const p = this.players[id];
      out[id] = {
        id: p.id, nickname: p.nickname,
        x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3),
        rotX: +p.rotX.toFixed(3), rotY: +p.rotY.toFixed(3),
        hp: p.hp, kills: p.kills, deaths: p.deaths, score: p.score,
        alive: p.alive, weapon: p.weapon, team: p.team,
        g: p.grenades, prot: p.spawnProtectUntil > now,
      };
    }
    return out;
  }

  sanitizeGrenades() {
    const out = {};
    for (const id in this.grenades) {
      const g = this.grenades[id];
      out[id] = { id: g.id, x: +g.x.toFixed(2), y: +g.y.toFixed(2), z: +g.z.toFixed(2) };
    }
    return out;
  }

  modeState() {
    const m = this.config.mode;
    if (m === 'kotc') {
      const z = this.mapData.coops[this.coop.idx];
      return { coop: { x: z.x, y: z.y, z: z.z, r: z.r, progress: Math.round(this.coop.progress), team: this.coop.team, contested: this.coop.contested, active: Date.now() >= this.coop.activeAt } };
    }
    if (m === 'cts') {
      const s = this.spatula;
      return { spatula: { state: s.state, x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2), carrier: s.carrier } };
    }
    return {};
  }

  getCustomizations() {
    const out = {};
    for (const id in this.players) {
      const p = this.players[id];
      out[id] = p.custom;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Eventos de jugadores
  // ---------------------------------------------------------------------------
  handlePlayerJoin(socket, data) {
    data = data || {};
    const nickname = (typeof data.nickname === 'string' ? data.nickname.trim() : '').substring(0, 14) || 'EggSoldier';
    const team = this.mode.teams ? this.assignTeam() : null;
    const weapon = PRIMARY_KEYS.includes(data.weapon) ? data.weapon : 'rifle';
    const custom = Cosmetics.sanitize(data.custom || data);

    const p = {
      id: socket.id, nickname, team, weapon, primary: weapon, shotLog: [], lastMelee: 0, lastTeamSwitch: 0, spawnedAt: Date.now(),
      x: 0, y: 0, z: 0, rotX: 0, rotY: 0,
      hp: RULES.MAX_HP, kills: 0, deaths: 0, score: 0, streak: 0,
      alive: true, respawnAt: null,
      lastShot: 0, lastGrenade: 0, grenades: RULES.GRENADE_START,
      spawnProtectUntil: 0, chatTimes: [],
      account: data.account || null,
      custom,
      joinedAt: ++this.joinSeq,
    };
    this.players[socket.id] = p;
    this.respawn(p, false);
    this.emptySince = null;

    socket.emit('you:joined', {
      id: socket.id, team,
      x: p.x, y: p.y, z: p.z, rotY: p.rotY,
      players: this.sanitizePlayers(),
      customizations: this.getCustomizations(),
      config: this.publicConfig(),
      teamScores: this.teamScores,
      endsAt: this.roundEndsAt,
      serverNow: Date.now(),
      state: this.state,
      adminId: this.adminId(),
    });

    socket.to(this.id).emit('player:joined', {
      id: socket.id, nickname, team, x: p.x, y: p.y, z: p.z,
      custom: p.custom, weapon,
    });
    this.io.to(this.id).emit('room:notice', { text: `🥚 ${nickname} entró${team ? ` (equipo ${team === 'red' ? 'Rojo' : 'Azul'})` : ''}` });
    // Un jugador de verdad ocupa la plaza de un bot si la sala está llena
    if (!socket.bot && this.botMgr) this.botMgr.balance();
  }

  handlePlayerMove(socketId, data) {
    const p = this.players[socketId];
    if (!p || !p.alive || !data) return;
    const num = v => typeof v === 'number' && isFinite(v);
    if (num(data.rotX)) p.rotX = Math.max(-1.6, Math.min(1.6, data.rotX));
    if (num(data.rotY)) p.rotY = data.rotY;
    if (this.state === 'paused') { p.lastMoveAt = p.mvAt = p.airAt = Date.now(); return; }
    if (!num(data.x) || !num(data.y) || !num(data.z)) return;
    const lim = this.getHalfSize() - Phys.P.RADIUS;
    const nx = Math.max(-lim, Math.min(lim, data.x));
    const nz = Math.max(-lim, Math.min(lim, data.z));
    const ny = Math.max(-60, Math.min(80, data.y));
    const now = Date.now();
    // Anti-trampas: velocidad, paredes, vuelo, flotar (ver server/anticheat.js)
    const bad = AC.checkMove(p, nx, ny, nz, now, this.world);
    if (bad) {
      p.cheatScore = (p.cheatScore || 0) + 1;
      // Devolver al jugador a su última posición válida (como mucho 5 veces por segundo)
      if (now - (p.lastCorrectAt || 0) > 200) {
        p.lastCorrectAt = now;
        this.io.to(socketId).emit('you:correct', { x: p.x, y: p.y, z: p.z, why: bad });
      }
      if (p.cheatScore > 150 && this.hooks.onCheat) { try { this.hooks.onCheat(p, bad); } catch (e) { /* */ } }
      return;
    }
    p.cheatScore = Math.max(0, (p.cheatScore || 0) - 0.25);
    p.lastMoveAt = now;
    p.x = nx; p.y = ny; p.z = nz;
    AC.record(p, now);
  }

  /** El cliente avisa de que recarga: el servidor lleva la cuenta de las balas. */
  handleReload(socket) {
    const p = this.players[socket.id];
    if (!p || !p.alive) return;
    AC.startReload(p, Date.now());
  }

  handleWeaponSwitch(socket, weapon) {
    const p = this.players[socket.id];
    if (!p || !WEAPONS[weapon]) return;
    if (weapon !== 'pistol' && weapon !== p.primary) {
      // Cambiar de arma principal sólo muerto o recién reaparecido (como en Shell Shockers)
      if (!PRIMARY_KEYS.includes(weapon)) return;
      const fresh = p.alive && Date.now() - p.spawnedAt < 6000 && p.lastShot < p.spawnedAt;
      if (p.alive && !fresh) return;
      p.primary = weapon;
    }
    if (p.weapon === weapon) return;
    p.weapon = weapon;
    socket.to(this.id).emit('player:weapon-switched', { playerId: socket.id, weapon });
  }

  /** Control de cadencia: intervalo mínimo + ventana de 1 s (cubre las ráfagas). */
  fireAllowed(p, wep, now) {
    if (now - p.lastShot < minInterval(wep) * 0.7) return false;
    const cycle = wep.burst ? (wep.cooldown + wep.burst.interval * (wep.burst.count - 1)) / wep.burst.count : wep.cooldown;
    const maxPerSec = Math.ceil(1000 / cycle * 1.3) + 1;
    p.shotLog = p.shotLog.filter(t => now - t < 1000);
    if (p.shotLog.length >= maxPerSec) return false;
    p.shotLog.push(now);
    p.lastShot = now;
    return true;
  }

  handlePlayerShoot(socket, data) {
    const shooter = this.players[socket.id];
    if (!shooter || !shooter.alive || !data) return;
    const wep = WEAPONS[shooter.weapon];
    if (!wep || wep.projectile) return;

    if (this.state === 'paused') return;
    const now = Date.now();
    if (!this.fireAllowed(shooter, wep, now)) return;
    if (!AC.useAmmo(shooter, now)) return;   // sin balas o recargando: el disparo no existe
    shooter.spawnProtectUntil = 0; // disparar quita la protección

    socket.to(this.id).emit('player:shot-fired', { shooterId: socket.id, weapon: shooter.weapon, ex: data.ex, ey: data.ey, ez: data.ez });
    if (this.state !== 'playing') return;

    const targets = Array.isArray(data.targets) ? data.targets.slice(0, wep.pellets) : [];
    const eyeX = shooter.x, eyeY = shooter.y + EYE, eyeZ = shooter.z;
    const losCache = {};

    for (const t of targets) {
      if (!t || typeof t.id !== 'string') continue;
      const target = this.players[t.id];
      if (!target || !target.alive || target.id === shooter.id) continue;
      if (this.mode.teams && shooter.team === target.team) continue;
      if (target.spawnProtectUntil > now) continue;

      const dist = Math.hypot(shooter.x - target.x, shooter.y - target.y, shooter.z - target.z);
      if (dist > wep.range * 1.2) continue;

      // Línea de visión: al menos uno de varios puntos del objetivo debe verse
      if (losCache[t.id] === undefined) {
        const pts = [0.55, 1.05, 1.4];
        losCache[t.id] = pts.some(h => Phys.lineOfSight(this.world, eyeX, eyeY, eyeZ, target.x, target.y + h, target.z));
      }
      if (!losCache[t.id]) continue;

      // El impacto (y si es en la cabeza) lo decide el servidor con la posición real del objetivo
      const hit = AC.checkHit(this.world, shooter, target, t.p ? { x: +t.p[0], y: +t.p[1], z: +t.p[2] } : null, now);
      if (!hit) continue;
      const head = hit.head;
      const dmg = Math.max(1, Math.round(wep.damage * (head ? wep.headMult : 1) * falloff(wep, dist)));
      this.applyDamage(target, dmg, shooter, shooter.weapon, head);
    }
  }

  applyDamage(target, dmg, attacker, weapon, headshot) {
    if (!target.alive || this.state !== 'playing') return;
    target.hp -= dmg;
    this.io.to(this.id).emit('player:hit', {
      targetId: target.id, shooterId: attacker ? attacker.id : null, damage: dmg,
      hp: Math.max(0, target.hp), weapon, headshot: !!headshot,
      fx: attacker ? attacker.x : null, fz: attacker ? attacker.z : null,
    });
    if (target.hp <= 0) this.killPlayer(target, attacker, weapon, headshot);
  }

  killPlayer(target, killer, weapon, headshot, killerName) {
    target.hp = 0;
    target.alive = false;
    target.deaths++;
    target.streak = 0;
    target.respawnAt = Date.now() + RULES.RESPAWN_MS;
    const self = !killer || killer.id === target.id;
    if (!self) {
      killer.kills++;
      killer.streak++;
      if (!this.mode.teams) killer.score++;
      if (this.config.mode === 'tdm' && killer.team) this.teamScores[killer.team]++;
    } else if (!this.mode.teams && weapon !== 'void') {
      target.score = Math.max(0, target.score - 1);
    }
    if (this.hooks.onKill) {
      try { this.hooks.onKill(self ? null : killer, target, weapon, headshot); } catch (e) { console.error(e); }
    }
    // Soltar la espátula
    if (this.config.mode === 'cts' && this.spatula.carrier === target.id) this.dropSpatula(target);

    this.io.to(this.id).emit('player:killed', {
      targetId: target.id, targetNickname: target.nickname,
      killerId: self ? (weapon === 'void' ? 'void' : target.id) : killer.id,
      killerNickname: killerName || (self ? target.nickname : killer.nickname),
      weapon, headshot: !!headshot, streak: self ? 0 : killer.streak,
      respawnIn: RULES.RESPAWN_MS,
    });
    this.checkWin();
  }

  handleGrenadeThrow(socket, data) {
    const p = this.players[socket.id];
    if (!p || !p.alive || !data || this.state === 'paused') return;
    const now = Date.now();
    if (p.grenades <= 0 || now - p.lastGrenade < RULES.GRENADE_MIN_INTERVAL) return;
    p.lastGrenade = now;
    p.grenades--;
    p.spawnProtectUntil = 0;

    let dx = Number(data.dirX) || 0, dy = Number(data.dirY) || 0, dz = Number(data.dirZ) || 0;
    const L = Math.hypot(dx, dy, dz) || 1;
    dx /= L; dy /= L; dz /= L;
    const gid = 'g' + (this.grenadeIdSeq++);
    const sx = p.x + dx * 0.5, sy = p.y + EYE - 0.15, sz = p.z + dz * 0.5;
    const pw = clampNum(data.power, RULES.GRENADE_MIN_POWER, 1, 1);
    const sp = RULES.GRENADE_SPEED * pw;
    const g = {
      id: gid, ownerId: socket.id, team: p.team,
      x: sx, y: sy, z: sz,
      vx: dx * sp + clampNum(data.vx, -12, 12, 0) * 0.5,
      vy: dy * sp + 3.2 * pw,
      vz: dz * sp + clampNum(data.vz, -12, 12, 0) * 0.5,
      detonateAt: now + RULES.GRENADE_FUSE_MS,
    };
    // No lanzar dentro de una pared
    if (!Phys.lineOfSight(this.world, p.x, p.y + EYE, p.z, sx, sy, sz)) { g.x = p.x; g.z = p.z; }
    this.grenades[gid] = g;
    this.io.to(this.id).emit('grenade:spawn', { id: gid, ownerId: socket.id, x: g.x, y: g.y, z: g.z, vx: g.vx, vy: g.vy, vz: g.vz });
  }

  handleRespawnRequest(socketId) {
    const p = this.players[socketId];
    if (!p || p.alive || !p.respawnAt || Date.now() < p.respawnAt || this.state === 'paused') return;
    this.respawn(p, true);
  }

  handlePlayerChat(socket, message) {
    const p = this.players[socket.id];
    if (!p) return;
    const msg = (typeof message === 'string' ? message : '').trim().substring(0, 60);
    if (!msg) return;
    const now = Date.now();
    p.chatTimes = p.chatTimes.filter(t => now - t < 5000);
    if (p.chatTimes.length >= 5) return; // anti-spam
    p.chatTimes.push(now);
    this.io.to(this.id).emit('player:chat', { id: socket.id, nickname: p.nickname, team: p.team, message: msg });
  }

  handlePlayerEmote(socket, emoteType) {
    const p = this.players[socket.id];
    if (!p || !p.alive) return;
    this.io.to(this.id).emit('player:emote', { id: socket.id, emoteType: ['spin', 'jump', 'wave'].includes(emoteType) ? emoteType : 'spin' });
  }

  handlePlayerDisconnect(socketId) {
    const p = this.players[socketId];
    if (!p) return;
    if (this.config.mode === 'cts' && this.spatula.carrier === socketId) this.dropSpatula(p);
    delete this.players[socketId];
    this.io.to(this.id).emit('player:left', { id: socketId });
    this.io.to(this.id).emit('room:notice', { text: `👋 ${p.nickname} salió` });
    if (this.botMgr) {
      // Bot expulsado por el admin: uno menos que mantener
      if (p.bot && this.botMgr.bots[socketId]) { delete this.botMgr.bots[socketId]; this.botMgr.target = Math.max(0, (this.botMgr.target || 0) - 1); }
      else if (!p.bot) this.botMgr.balance();   // vuelve a rellenar con bots la plaza que deja un jugador
    }
    if (this.humanCount() === 0) this.emptySince = Date.now();
  }

  // ---------------------------------------------------------------------------
  // Modos con objetivo
  // ---------------------------------------------------------------------------
  tickKotc(dt, now) {
    const c = this.coop;
    if (now < c.activeAt) return;
    const z = this.mapData.coops[c.idx];
    const count = { red: 0, blue: 0 };
    const inside = [];
    for (const id in this.players) {
      const p = this.players[id];
      if (!p.alive || !p.team) continue;
      if (Math.hypot(p.x - z.x, p.z - z.z) <= z.r && p.y >= z.y - 0.8 && p.y <= z.y + 2.5) { count[p.team]++; inside.push(p); }
    }
    c.contested = count.red > 0 && count.blue > 0;
    if (c.contested) return;
    const t = count.red > 0 ? 'red' : (count.blue > 0 ? 'blue' : null);
    if (!t) {
      c.progress = Math.max(0, c.progress - 4 * dt);
      if (c.progress === 0) c.team = null;
      return;
    }
    const rate = (100 / RULES.KOTC_CAPTURE_S) * Math.min(2, 1 + 0.3 * (count[t] - 1));
    if (c.team && c.team !== t) {
      c.progress -= rate * 1.5 * dt;
      if (c.progress <= 0) { c.progress = 0; c.team = t; }
      return;
    }
    c.team = t;
    c.progress += rate * dt;
    if (c.progress >= 100) {
      this.teamScores[t]++;
      inside.forEach(p => { p.score += 1; });
      this.io.to(this.id).emit('kotc:captured', { team: t, scores: this.teamScores });
      let next = c.idx;
      if (this.mapData.coops.length > 1) while (next === c.idx) next = Math.floor(Math.random() * this.mapData.coops.length);
      c.idx = next; c.progress = 0; c.team = null; c.activeAt = now + RULES.KOTC_MOVE_DELAY_MS;
      this.checkWin();
    }
  }

  dropSpatula(p) {
    const s = this.spatula;
    s.carrier = null;
    const y = Phys.supportBelow(this.world, p.x, p.z, p.y + 0.5);
    if (!isFinite(y) || y < this.mapData.killY + 2) { this.returnSpatula(); return; }
    s.state = 'dropped';
    s.x = p.x; s.y = y; s.z = p.z;
    s.droppedAt = Date.now();
    this.io.to(this.id).emit('cts:event', { type: 'dropped', nickname: p.nickname, team: p.team });
  }

  returnSpatula() {
    const sp = this.mapData.spatula;
    Object.assign(this.spatula, { state: 'home', x: sp.x, y: sp.y, z: sp.z, carrier: null, droppedAt: 0 });
    this.io.to(this.id).emit('cts:event', { type: 'returned' });
  }

  tickCts(now) {
    const s = this.spatula;
    if (s.state === 'carried') {
      const c = this.players[s.carrier];
      if (!c || !c.alive) { if (c) this.dropSpatula(c); else this.returnSpatula(); return; }
      s.x = c.x; s.y = c.y; s.z = c.z;
      const base = this.mapData.bases[c.team];
      if (base && Math.hypot(c.x - base.x, c.z - base.z) <= base.r && Math.abs(c.y - base.y) < 2.5) {
        this.teamScores[c.team]++;
        c.score += 1;
        this.io.to(this.id).emit('cts:event', { type: 'captured', id: c.id, nickname: c.nickname, team: c.team, scores: this.teamScores });
        const sp = this.mapData.spatula;
        Object.assign(s, { state: 'home', x: sp.x, y: sp.y, z: sp.z, carrier: null });
        this.checkWin();
      }
      return;
    }
    if (s.state === 'dropped' && now - s.droppedAt > RULES.CTS_RETURN_MS) { this.returnSpatula(); return; }
    for (const id in this.players) {
      const p = this.players[id];
      if (!p.alive || !p.team) continue;
      if (Math.hypot(p.x - s.x, p.z - s.z) <= RULES.CTS_PICK_RADIUS && p.y > s.y - 1.2 && p.y < s.y + 1.8) {
        s.state = 'carried'; s.carrier = p.id;
        this.io.to(this.id).emit('cts:event', { type: 'taken', nickname: p.nickname, team: p.team, carrier: p.id });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Bucle del servidor
  // ---------------------------------------------------------------------------
  tick() {
    const now = Date.now();
    const dt = TICK_MS / 1000;

    if (this.state === 'paused') { this.emitState(now); return; }
    if (this.state === 'playing') this.stepRockets(now);
    else if (this.rockets) this.rockets.length = 0;
    if (this.state === 'ended' && now - this.endedAt >= (this.hold ? HOLD_MAX_MS : RULES.INTERMISSION_MS)) this.startRound(true);
    if (this.state === 'playing' && this.roundEndsAt && now >= this.roundEndsAt) this.timeUp();

    // Granadas (2 sub-pasos por tick)
    for (const gid in this.grenades) {
      const g = this.grenades[gid];
      Phys.stepGrenade(this.world, g, dt / 2);
      Phys.stepGrenade(this.world, g, dt / 2);
      if (now >= g.detonateAt || g.y < this.mapData.killY) this.detonateGrenade(gid, g);
    }

    for (const id in this.players) {
      const p = this.players[id];
      // Caída al vacío
      if (p.alive && p.y < this.mapData.killY) this.killPlayer(p, null, 'void', false, '🌌 El Vacío');
      // Reaparición: el jugador pulsa JUGAR; si no lo hace, se le reaparece a los 45 s
      if (!p.alive && p.respawnAt && now >= p.respawnAt + 45000) this.respawn(p, true);
    }

    // Botiquines
    for (const pk of this.packs) {
      if (!pk.active) { if (now >= pk.respawnAt) pk.active = true; continue; }
      for (const id in this.players) {
        const p = this.players[id];
        if (!p.alive || p.hp >= RULES.MAX_HP) continue;
        if (Math.hypot(p.x - pk.x, p.z - pk.z) <= 1.2 && p.y >= pk.y - 0.6 && p.y <= pk.y + 1.4) {
          const before = p.hp;
          p.hp = Math.min(RULES.MAX_HP, p.hp + RULES.HEAL_AMOUNT);
          pk.active = false; pk.respawnAt = now + RULES.HEAL_RESPAWN_MS;
          this.io.to(this.id).emit('pickup:taken', { id: pk.id, playerId: p.id, hp: p.hp, amount: p.hp - before });
          break;
        }
      }
    }

    // Granadas en el suelo: se recogen de una en una (máximo RULES.GRENADE_MAX)
    for (const gp of this.gpacks) {
      if (!gp.active) { if (now >= gp.respawnAt) gp.active = true; continue; }
      for (const id in this.players) {
        const p = this.players[id];
        if (!p.alive || p.grenades >= RULES.GRENADE_MAX) continue;
        if (Math.hypot(p.x - gp.x, p.z - gp.z) <= 1.25 && p.y >= gp.y - 0.6 && p.y <= gp.y + 1.4) {
          p.grenades++;
          gp.active = false; gp.respawnAt = now + RULES.GRENADE_PACK_RESPAWN_MS;
          this.io.to(this.id).emit('pickup:grenade', { id: gp.id, playerId: p.id, g: p.grenades });
          break;
        }
      }
    }

    if (this.state === 'playing') {
      if (this.config.mode === 'kotc') this.tickKotc(dt, now);
      else if (this.config.mode === 'cts') this.tickCts(now);
    }

    this.emitState(now);
  }

  emitState(now) {
    const ref = this.state === 'paused' ? this.pausedAt : now;
    this.io.to(this.id).emit('game:state', {
      players: this.sanitizePlayers(),
      grenades: this.sanitizeGrenades(),
      teamScores: this.teamScores,
      mode: this.modeState(),
      packs: this.packs.map(p => (p.active ? 1 : 0)).join(''),
      gpacks: this.gpacks.map(p => (p.active ? 1 : 0)).join(''),
      timeLeft: this.roundEndsAt ? Math.max(0, Math.ceil((this.roundEndsAt - ref) / 1000)) : null,
      state: this.state,
      hold: this.hold,
      adminId: this.adminId(),
      t: now,
    });
  }

  detonateGrenade(gid, g) {
    delete this.grenades[gid];
    this.explodeAt(gid, g.x, g.y, g.z, g.ownerId, g.team, RULES.GRENADE_RADIUS, RULES.GRENADE_MAX_DMG, 'grenade');
  }

  /** Explosión genérica (granadas y cohetes): daño por distancia con línea de visión. */
  explodeAt(id, x, y, z, ownerId, team, radius, maxDmg, weapon, skipId, dir) {
    const owner = this.players[ownerId];
    const damages = [];
    if (this.state === 'playing') {
      for (const pid in this.players) {
        const p = this.players[pid];
        if (!p.alive) continue;
        const isSelf = pid === ownerId;
        if (!isSelf && this.mode.teams && team && team === p.team) continue;
        if (!isSelf && p.spawnProtectUntil > Date.now()) continue;
        if (pid === skipId) continue;   // ya recibió el impacto directo
        const cy = p.y + 0.8;
        // Distancia al punto más cercano del cuerpo del huevo (no a su centro)
        const ny = Math.max(p.y + 0.3, Math.min(p.y + 1.5, y));
        const dist = Math.max(0, Math.hypot(p.x - x, ny - y, p.z - z) - 0.45);
        if (dist >= radius) continue;
        // La explosión se mira desde un poco antes del punto de impacto (no desde dentro de la pared)
        const bx = dir ? x - dir.dx * 0.3 : x, by = (dir ? y - dir.dy * 0.3 : y) + 0.25, bz = dir ? z - dir.dz * 0.3 : z;
        if (!Phys.lineOfSight(this.world, bx, by, bz, p.x, cy, p.z)
          && !Phys.lineOfSight(this.world, bx, by, bz, p.x, p.y + 1.4, p.z)
          && !Phys.lineOfSight(this.world, bx, by, bz, p.x, p.y + 0.3, p.z)) continue;
        // Caída suave: cerca hace casi todo el daño
        const k = dist / radius;
        let dmg = Math.round(maxDmg * (1 - k * k));
        if (isSelf) dmg = Math.round(dmg * 0.5);
        if (dmg <= 0) continue;
        damages.push({ playerId: pid, damage: dmg });
        this.applyDamage(p, dmg, owner || null, weapon, false);
      }
    }
    this.io.to(this.id).emit('grenade:explode', { id, x, y, z, damages, kind: weapon, radius });
  }

  // ---------------------------------------------------------------------------
  // Cohetes (RPEGG): el servidor calcula el impacto y lo hace explotar al llegar
  // ---------------------------------------------------------------------------
  handleRocket(socket, data) {
    const p = this.players[socket.id];
    if (!p || !p.alive || !data || this.state === 'paused') return;
    const wep = WEAPONS[p.weapon];
    if (!wep || !wep.projectile) return;
    const now = Date.now();
    if (!this.fireAllowed(p, wep, now)) return;
    if (!AC.useAmmo(p, now)) return;
    p.spawnProtectUntil = 0;
    let dx = Number(data.dx) || 0, dy = Number(data.dy) || 0, dz = Number(data.dz) || 0;
    const L = Math.hypot(dx, dy, dz);
    if (!(L > 0.01)) return;
    dx /= L; dy /= L; dz /= L;
    const ox = p.x, oy = p.y + EYE - 0.1, oz = p.z;
    let t = Phys.raycast(this.world, ox, oy, oz, dx, dy, dz, wep.range);
    // ¿Choca antes con algún huevo? (esfera aproximada). Si es así: impacto directo garantizado
    let directId = null;
    for (const id in this.players) {
      const q = this.players[id];
      if (!q.alive || id === p.id) continue;
      const cx = q.x - ox, cy = q.y + 0.8 - oy, cz = q.z - oz;
      const proj = cx * dx + cy * dy + cz * dz;
      if (proj < 0 || proj > t) continue;
      const d2 = cx * cx + cy * cy + cz * cz - proj * proj;
      if (d2 < 0.62 * 0.62) { const tt = Math.max(0, proj - Math.sqrt(0.62 * 0.62 - d2)); if (tt < t) { t = tt; directId = id; } }
    }
    t = Math.max(0.3, t - 0.08);
    const ix = ox + dx * t, iy = oy + dy * t, iz = oz + dz * t;
    const id = 'r' + (this.grenadeIdSeq++);
    const ms = Math.round(t / wep.projectile.speed * 1000);
    if (!this.rockets) this.rockets = [];
    this.rockets.push({ id, ownerId: p.id, team: p.team, x: ix, y: iy, z: iz, at: now + ms, wep, directId, dx, dy, dz });
    this.io.to(this.id).emit('rocket:fired', { id, shooterId: p.id, ox, oy, oz, ix: +ix.toFixed(2), iy: +iy.toFixed(2), iz: +iz.toFixed(2), ms });
  }

  stepRockets(now) {
    if (!this.rockets || !this.rockets.length) return;
    const due = this.rockets.filter(r => now >= r.at);
    if (!due.length) return;
    this.rockets = this.rockets.filter(r => now < r.at);
    for (const r of due) {
      // Impacto directo: daño fijo al huevo alcanzado aunque se haya movido durante el vuelo
      const t = r.directId && this.players[r.directId];
      const direct = t && t.alive && !(this.mode.teams && r.team && t.team === r.team) && !(t.spawnProtectUntil > now) ? t : null;
      if (direct) this.applyDamage(direct, r.wep.projectile.direct, this.players[r.ownerId] || null, 'rpegg', false);
      this.explodeAt(r.id, r.x, r.y, r.z, r.ownerId, r.team, r.wep.projectile.radius, r.wep.projectile.maxDmg, 'rpegg', direct ? direct.id : null, r);
    }
  }

  // ---------------------------------------------------------------------------
  // Golpe cuerpo a cuerpo (F)
  // ---------------------------------------------------------------------------
  handleMelee(socket, data) {
    const p = this.players[socket.id];
    if (!p || !p.alive || this.state === 'paused') return;
    const now = Date.now();
    if (now - p.lastMelee < MELEE.cooldown * 0.8) return;
    p.lastMelee = now;
    p.spawnProtectUntil = 0;
    this.io.to(this.id).emit('player:melee', { id: p.id });
    if (this.state !== 'playing' || !data || typeof data.targetId !== 'string') return;
    const t = this.players[data.targetId];
    if (!t || !t.alive || t.id === p.id) return;
    if (this.mode.teams && t.team === p.team) return;
    if (t.spawnProtectUntil > now) return;
    const d = Math.hypot(t.x - p.x, (t.y - p.y) * 0.7, t.z - p.z);
    if (d > MELEE.range + 0.5) return;
    if (!Phys.lineOfSight(this.world, p.x, p.y + EYE, p.z, t.x, t.y + 0.9, t.z)) return;
    this.applyDamage(t, MELEE.damage, p, 'melee', false);
  }

  // ---------------------------------------------------------------------------
  // Cambio de equipo (modos por equipos)
  // ---------------------------------------------------------------------------
  /** Cambia a p de equipo. force = lo hace el admin (sin límites de equilibrio). */
  switchTeam(p, team, force) {
    if (!this.mode.teams) return { error: 'Este modo no tiene equipos' };
    if (team !== 'red' && team !== 'blue') team = p.team === 'red' ? 'blue' : 'red';
    if (team === p.team) return { error: 'Ya estás en ese equipo' };
    const now = Date.now();
    if (!force) {
      if (now - p.lastTeamSwitch < RULES.TEAM_SWITCH_MS) return { error: 'Espera un momento antes de volver a cambiar' };
      let mine = 0, other = 0;
      for (const id in this.players) { const q = this.players[id]; if (q.team === p.team) mine++; else if (q.team === team) other++; }
      // Se permite si no deja al equipo de destino con 2 jugadores más que el de origen
      if (other + 1 - (mine - 1) > 1) return { error: 'Ese equipo ya tiene más jugadores' };
    }
    if (!force) p.lastTeamSwitch = now;
    if (this.config.mode === 'cts' && this.spatula.carrier === p.id) this.dropSpatula(p);
    p.team = team;
    p.streak = 0;
    this.io.to(this.id).emit('player:team-changed', { id: p.id, team, nickname: p.nickname, byAdmin: !!force });
    // Reaparece en la base de su nuevo equipo (sin contar como muerte)
    if (p.alive) this.respawn(p, true);
    return { ok: `Ahora estás en el equipo ${team === 'red' ? 'Rojo' : 'Azul'}` };
  }

  handleTeamSwitch(socket, data) {
    const p = this.players[socket.id];
    if (!p) return;
    const res = this.switchTeam(p, data && data.team, false);
    socket.emit('room:admin-result', res);
  }

}

module.exports = { GameRoom, clampNum };
