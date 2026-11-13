// ============================================================================
// server/impostorRoom.js — Sala del modo «Huevo Impostor»
// Clase independiente de GameRoom: no comparte ni modifica nada de los demás
// modos. El servidor manda en todo: roles secretos, muertes, tareas, votos,
// sabotajes y visión (a cada jugador sólo se le envía lo que puede ver).
// ============================================================================
'use strict';

const MapDefs = require('../shared/mapdefs.js');
const Phys = require('../shared/physics.js');
const I = require('../shared/impostor.js');
const Cosmetics = require('../shared/cosmetics.js');
const AC = require('./anticheat');

const R = I.RULES;
const TICK_MS = 50;
const KICK_BAN_MS = 2 * 60 * 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => typeof v === 'number' && isFinite(v);
const pick = (v, list, def) => list.includes(v) ? v : def;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const maxImpostorsFor = n => n >= 9 ? 3 : n >= 7 ? 2 : 1;

class ImpostorRoom {
  constructor(io, opts) {
    this.io = io;
    this.kind = 'impostor';
    this.id = opts.id;
    this.code = opts.code;
    this.name = (opts.name || 'Huevo Impostor').toString().substring(0, 30);
    this.isPrivate = !!opts.isPrivate;
    this.isDefault = !!opts.isDefault;
    this.ownerAccount = opts.ownerAccount || null;
    this.hooks = opts.hooks || {};
    this.mode = { name: 'Huevo Impostor', short: 'IMP' };
    this.mapData = MapDefs.build(I.MAP_ID);
    this.world = Phys.createWorld(this.mapData);
    this.world.boxes = this.world.boxes.slice();      // copia propia: aquí se añaden las puertas cerradas
    this.mapHash = I.mapHash(this.world.boxes);
    const s = ImpostorRoom.validateSettings(opts, {});
    this.settings = s;
    this.maxPlayers = s.maxPlayers;
    this.config = { mode: 'impostor', map: I.MAP_ID };
    this.players = Object.create(null);   // sin prototipo: ids como «__proto__» no encuentran nada
    this.kicked = new Map();
    this.joinSeq = 0;
    this.emptySince = Date.now();
    this.toLobby();
    this.interval = setInterval(() => { try { this.tick(); } catch (e) { console.error('[impostor tick]', e && e.stack || e); } }, TICK_MS);
  }

  static validateSettings(d, cur) {
    d = d || {}; cur = cur || {};
    const int = (v, def) => (num(Number(v)) ? Math.round(Number(v)) : def);
    const out = {
      impostors: clamp(int(d.impostors, cur.impostors || 0), 0, 3),       // 0 = automático
      killCd: pick(int(d.killCd, cur.killCd || R.DEF_KILL_CD), R.KILL_CD, R.DEF_KILL_CD),
      meetingTime: pick(int(d.meetingTime, cur.meetingTime || R.DEF_MEETING_TIME), R.MEETING_TIME, R.DEF_MEETING_TIME),
      tasks: pick(int(d.tasks, cur.tasks || R.DEF_TASKS), R.TASKS, R.DEF_TASKS),
      maxPlayers: clamp(int(d.maxPlayers, cur.maxPlayers || R.MAX_PLAYERS), R.MIN_PLAYERS, R.MAX_PLAYERS),
      confirmEjects: d.confirmEjects === undefined ? (cur.confirmEjects !== undefined ? cur.confirmEjects : true) : !!d.confirmEjects,
      name: (typeof d.name === 'string' && d.name.trim()) ? d.name.trim().substring(0, 30) : (cur.name || null),
    };
    return out;
  }

  destroy() { clearInterval(this.interval); }
  getPlayersCount() { return Object.keys(this.players).length; }
  getHalfSize() { return this.mapData.halfSize; }
  adminId() {
    let best = null;
    for (const id in this.players) {
      const p = this.players[id];
      if (this.ownerAccount && p.account === this.ownerAccount) return id;
      if (!best || p.joinedAt < best.joinedAt) best = p;
    }
    return best ? best.id : null;
  }
  isKicked(k) {
    const until = k && this.kicked.get(k);
    if (!until) return false;
    if (Date.now() > until) { this.kicked.delete(k); return false; }
    return true;
  }
  listInfo() {
    return {
      id: this.id, kind: 'impostor', code: this.isPrivate ? null : this.code, name: this.name,
      map: I.MAP_ID, mapName: this.mapData.name, mode: 'impostor', modeName: this.mode.name,
      playersCount: this.getPlayersCount(), maxPlayers: this.maxPlayers, state: this.state,
      isDefault: this.isDefault, isPrivate: this.isPrivate,
      impostors: this.settings.impostors,
    };
  }
  publicSettings() {
    const s = this.settings;
    return { impostors: s.impostors, killCd: s.killCd, meetingTime: s.meetingTime, tasks: s.tasks, maxPlayers: this.maxPlayers, confirmEjects: s.confirmEjects, name: this.name };
  }

  // Stubs: eventos de los otros modos que aquí no existen (no hay armas)
  handleWeaponSwitch() {} handleReload() {} handlePlayerShoot() {} handleGrenadeThrow() {}
  handleRocket() {} handleMelee() {} handleTeamSwitch() {} handleRespawnRequest() {} handlePlayerEmote() {}

  // ---------------------------------------------------------------------------
  // Utilidades de envío
  // ---------------------------------------------------------------------------
  to(id, ev, data) { this.io.to(id).emit(ev, data); }
  all(ev, data) { this.io.to(this.id).emit(ev, data); }
  notice(text) { this.all('imp:notice', { text }); }
  roster() {
    return Object.values(this.players).sort((a, b) => a.joinedAt - b.joinedAt).map(p => ({ id: p.id, name: p.nickname, color: p.color, custom: p.custom }));
  }
  sendRoster() { this.all('imp:roster', { players: this.roster(), adminId: this.adminId(), settings: this.publicSettings(), state: this.state }); }
  freeColor() {
    const used = new Set(Object.values(this.players).map(p => p.color));
    for (let i = 0; i < I.COLORS.length; i++) if (!used.has(i)) return i;
    return 0;
  }
  teleport(p, x, y, z, rotY) {
    p.x = x; p.y = y; p.z = z;
    if (num(rotY)) p.rotY = rotY;
    AC.resetPlayer(p, Date.now());
    this.to(p.id, 'imp:tp', { x, y, z, rotY: p.rotY });
  }
  seatAll(onlyAlive) {
    const list = Object.values(this.players).filter(p => !onlyAlive || p.alive).sort((a, b) => a.joinedAt - b.joinedAt);
    list.forEach((p, i) => { const s = I.seat(i, Math.max(list.length, 4)); this.teleport(p, s.x, 0, s.z, s.rotY); });
  }

  // ---------------------------------------------------------------------------
  // Fases: vestíbulo → partida (con reuniones) → fin → vestíbulo
  // ---------------------------------------------------------------------------
  toLobby() {
    this.state = 'lobby';
    this.practice = false;
    this.bodies = [];
    this.meeting = null;
    this.sab = null;
    this.doors = {};
    this.world.boxes = this.world.boxes.filter(b => !b.door);
    this.endAt = 0;
    for (const id in this.players) {
      const p = this.players[id];
      Object.assign(p, { alive: true, role: null, tasks: [], taskStart: {}, inVent: null, pad: null, cams: false, emergencies: R.EMERGENCIES });
    }
    this.seatAll(false);
    this.sendRoster();
  }

  startGame(practice) {
    const list = Object.values(this.players);
    const n = list.length;
    if (!practice && n < R.MIN_PLAYERS) return { error: `Hacen falta ${R.MIN_PLAYERS} jugadores (o empieza una práctica)` };
    const now = Date.now();
    this.practice = !!practice;
    this.state = 'playing';
    this.bodies = []; this.meeting = null; this.sab = null; this.doors = {};
    this.world.boxes = this.world.boxes.filter(b => !b.door);
    let nImp = this.settings.impostors || I.defaultImpostors(n);
    nImp = practice ? (n >= 2 ? 1 : 0) : Math.min(nImp, maxImpostorsFor(n));
    const order = shuffle(list.slice());
    order.forEach((p, i) => { p.role = i < nImp ? 'impostor' : 'crew'; });
    // En práctica en solitario, el admin elige su papel
    if (practice && n === 1 && this.practiceRole === 'impostor') list[0].role = 'impostor';
    const impIds = list.filter(p => p.role === 'impostor').map(p => p.id);
    for (const p of list) {
      p.alive = true; p.inVent = null; p.pad = null; p.voted = null;
      p.emergencies = R.EMERGENCIES;
      p.taskStart = {};
      p.tasks = shuffle(I.STATIONS.map(s => s.id)).slice(0, this.settings.tasks).map(id => ({ id, done: false }));
      p.killReadyAt = now + R.START_KILL_CD_S * 1000;
    }
    this.buttonReadyAt = now + R.BUTTON_CD_S * 1000;
    this.sabReadyAt = now + 10000;
    this.doorsReadyAt = now + 10000;
    this.seatAll(false);
    for (const p of list) {
      this.to(p.id, 'imp:start', {
        role: p.role, practice: this.practice,
        impostors: p.role === 'impostor' ? impIds : [],
        count: impIds.length,
        tasks: p.tasks.map(t => t.id),
        killCd: this.settings.killCd,
      });
    }
    this.sendRoster();
    return { ok: practice ? 'Práctica iniciada' : '¡Partida iniciada!' };
  }

  endGame(winner, reason) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.endAt = Date.now() + 12000;
    this.meeting = null;
    const roles = {}, alive = {};
    for (const id in this.players) { roles[id] = this.players[id].role; alive[id] = !!this.players[id].alive; }
    this.all('imp:over', { winner, reason, roles, alive, practice: this.practice });
    if (!this.practice && this.hooks.onRoundEnd) {
      try { this.hooks.onRoundEnd(Object.values(this.players).map(p => ({ account: p.account, id: p.id, team: p.role })), winner, null, true); } catch (e) { /* */ }
    }
  }

  counts() {
    let crew = 0, imp = 0;
    for (const id in this.players) {
      const p = this.players[id];
      if (!p.alive) continue;
      if (p.role === 'impostor') imp++; else if (p.role === 'crew') crew++;
    }
    return { crew, imp };
  }
  taskProgress() {
    let total = 0, done = 0;
    for (const id in this.players) {
      const p = this.players[id];
      if (p.role !== 'crew') continue;
      total += p.tasks.length;
      done += p.tasks.filter(t => t.done).length;
    }
    return { total, done, frac: total ? done / total : 0 };
  }
  checkWin() {
    if (this.state !== 'playing' && this.state !== 'ejecting') return false;
    const tp = this.taskProgress();
    if (tp.total && tp.done >= tp.total) { this.endGame('crew', '¡Todas las tareas completadas!'); return true; }
    if (this.practice) return false;
    const c = this.counts();
    if (c.imp === 0) { this.endGame('crew', 'Todos los impostores han sido descubiertos'); return true; }
    if (c.imp >= c.crew) { this.endGame('impostor', 'Los impostores ya son tantos como la tripulación'); return true; }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Jugadores
  // ---------------------------------------------------------------------------
  handlePlayerJoin(socket, data) {
    data = data || {};
    const nickname = (typeof data.nickname === 'string' ? data.nickname.trim() : '').substring(0, 14) || 'Huevo';
    const p = {
      id: socket.id, nickname, account: data.account || null,
      custom: Cosmetics.sanitize(data.custom || {}),
      color: this.freeColor(), joinedAt: ++this.joinSeq,
      x: 0, y: 0, z: 0, rotX: 0, rotY: 0,
      alive: true, role: null, tasks: [], taskStart: {}, inVent: null, pad: null,
      emergencies: R.EMERGENCIES, killReadyAt: 0, chatTimes: [], voted: null,
    };
    this.players[socket.id] = p;
    this.emptySince = null;
    // Quien entra a mitad de partida mira como fantasma hasta la siguiente
    if (this.state !== 'lobby') { p.alive = false; p.role = 'spectator'; }
    const n = this.getPlayersCount();
    const s = I.seat(n - 1, Math.max(n, 4));
    p.x = s.x; p.z = s.z; p.rotY = s.rotY;
    AC.resetPlayer(p, Date.now());
    socket.emit('imp:joined', {
      id: p.id, serverNow: Date.now(), state: this.state, x: p.x, y: p.y, z: p.z, rotY: p.rotY,
      players: this.roster(), adminId: this.adminId(), settings: this.publicSettings(),
      room: { id: this.id, code: this.code, name: this.name, isPrivate: this.isPrivate },
      spectator: p.role === 'spectator', mapHash: this.mapHash,
    });
    this.sendRoster();
    this.notice(`🥚 ${nickname} subió a la nave`);
  }

  handlePlayerDisconnect(socketId) {
    const p = this.players[socketId];
    if (!p) return;
    delete this.players[socketId];
    this.bodies = this.bodies.filter(b => b.id !== socketId);
    if (this.meeting) delete this.meeting.votes[socketId];
    this.notice(`👋 ${p.nickname} abandonó la nave`);
    this.sendRoster();
    if (this.getPlayersCount() === 0) { this.emptySince = Date.now(); if (this.state !== 'lobby') this.toLobby(); return; }
    if (this.state === 'playing' || this.state === 'ejecting') this.checkWin();
    if (this.meeting) this.maybeCloseVotes();
  }

  handlePlayerMove(socketId, d) {
    const p = this.players[socketId];
    if (!p || !d) return;
    if (num(d.rotX)) p.rotX = clamp(d.rotX, -1.6, 1.6);
    if (num(d.rotY)) p.rotY = d.rotY;
    const now = Date.now();
    if (!num(d.x) || !num(d.y) || !num(d.z)) return;
    // Durante la reunión, la expulsión y en un conducto no se anda
    if (this.state === 'meeting' || this.state === 'ejecting' || p.inVent) { p.mvAt = p.airAt = now; return; }
    const B = I.BOUNDS, nx = clamp(d.x, B.x0 + 0.4, B.x1 - 0.4), nz = clamp(d.z, B.z0 + 0.4, B.z1 - 0.4);
    if (!p.alive) {
      // Fantasma: atraviesa paredes, pero con límite de velocidad y sin salir de la nave
      const dt = clamp((now - (p.mvAt || now)) / 1000, 0, 1);
      p.mvAt = now;
      p.gBudget = Math.min(2.5, (p.gBudget || 0) + Phys.P.SPEED * 1.5 * dt);
      const step = Math.hypot(nx - p.x, nz - p.z);
      if (step > p.gBudget + 0.05) { this.to(p.id, 'you:correct', { x: p.x, y: p.y, z: p.z }); return; }
      p.gBudget -= step;
      p.x = nx; p.z = nz; p.y = clamp(d.y, 0, 1);
      return;
    }
    const ny = clamp(d.y, -1, 4);
    const bad = AC.checkMove(p, nx, ny, nz, now, this.world);
    if (bad) {
      // Anti-atasco: si el antitrampas corrige una y otra vez a alguien que NO está
      // dentro de una pared ni va demasiado rápido, es un falso positivo (esquinas,
      // cortes de red…): se acepta su posición en vez de dejarle clavado.
      if (now - (p.stuckAt || 0) > 2500) { p.stuckAt = now; p.stuckN = 0; }
      p.stuckN = (p.stuckN || 0) + 1;
      const ok = bad !== 'velocidad' && bad !== 'dentro-de-pared' && p.stuckN >= 5 && Math.hypot(nx - p.x, nz - p.z) < 3
        && !Phys.blockedAt(this.world, nx, Math.max(0, ny) + 0.06, nz);
      if (ok) { p.x = nx; p.y = ny; p.z = nz; p.stuckN = 0; AC.resetPlayer(p, now); return; }
      if (now - (p.lastCorrectAt || 0) > 200) { p.lastCorrectAt = now; this.to(p.id, 'you:correct', { x: p.x, y: p.y, z: p.z, why: bad }); }
      return;
    }
    p.x = nx; p.y = ny; p.z = nz;
    if (p.cams && dist2(p, I.CAM_PANEL) > I.CAM_PANEL.r + 0.8) p.cams = false;
    AC.record(p, now);
  }

  handlePlayerChat(socket, message) {
    const p = this.players[socket.id];
    if (!p) return;
    const msg = (typeof message === 'string' ? message : '').replace(/\s+/g, ' ').trim().substring(0, 120);
    if (!msg) return;
    const now = Date.now();
    p.chatTimes = p.chatTimes.filter(t => now - t < 5000);
    if (p.chatTimes.length >= 5) return;
    const st = this.state;
    const ghost = !p.alive && (st === 'playing' || st === 'meeting' || st === 'ejecting');
    if (st === 'playing' && p.alive) { this.to(p.id, 'imp:notice', { text: '🤫 Sólo se puede hablar en las reuniones' }); return; }
    p.chatTimes.push(now);
    const out = { id: p.id, name: p.nickname, color: p.color, msg, ghost };
    for (const id in this.players) {
      const r = this.players[id];
      // Los mensajes de los fantasmas sólo los leen otros fantasmas
      if (ghost && r.alive) continue;
      this.to(id, 'imp:chat', out);
    }
  }

  // ---------------------------------------------------------------------------
  // Acciones del modo
  // ---------------------------------------------------------------------------
  handleImpostor(socket, d) {
    const p = this.players[socket.id];
    if (!p || !d || typeof d !== 'object' || typeof d.a !== 'string' || d.a.length > 20) return;
    const now = Date.now();
    // Antispam: como mucho 25 acciones por segundo por jugador
    if (!p.actWin || now - p.actWin > 1000) { p.actWin = now; p.actN = 0; }
    if (++p.actN > 25) return;
    const err = m => this.to(p.id, 'imp:error', { message: m });
    switch (d.a) {
      case 'kill': return this.actKill(p, d.t, now, err);
      case 'report': return this.actReport(p, d.body, now, err);
      case 'emergency': return this.actEmergency(p, now, err);
      case 'vote': return this.actVote(p, d.t, now, err);
      case 'task-start': return this.actTaskStart(p, d.id, now, err);
      case 'task-done': return this.actTaskDone(p, d.id, now, err);
      case 'sabotage': return this.actSabotage(p, d.kind, d.room, now, err);
      case 'pad': return this.actPad(p, d.pad, !!d.on);
      case 'vent': return this.actVent(p, d.op, d.id, now, err);
      case 'cams': return this.actCams(p, !!d.on, err);
    }
  }

  canSee(a, bx, by, bz) {
    return Phys.lineOfSight(this.world, a.x, a.y + 1.3, a.z, bx, by, bz);
  }

  actKill(p, tid, now, err) {
    if (this.state !== 'playing' || !p.alive || p.role !== 'impostor' || p.inVent) return;
    const t = this.players[tid];
    if (!t || !t.alive || t.role === 'impostor' || t.inVent) return;
    if (now < p.killReadyAt) return err('Aún no puedes matar');
    if (dist2(p, t) > R.KILL_RANGE + 0.35 || Math.abs(p.y - t.y) > 1.6) return err('Demasiado lejos');
    if (!this.canSee(p, t.x, t.y + 1, t.z)) return err('No lo ves');
    t.alive = false; t.pad = null;
    this.bodies.push({ id: t.id, x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2), color: t.color, at: now });
    p.killReadyAt = now + this.settings.killCd * 1000;
    this.teleport(p, t.x, t.y, t.z);                      // el impostor salta sobre su víctima
    this.to(t.id, 'imp:killed', { by: p.id });
    this.to(p.id, 'imp:you-killed', { id: t.id });
    this.checkWin();
  }

  actReport(p, bodyId, now, err) {
    if (this.state !== 'playing' || !p.alive || p.inVent) return;
    const b = this.bodies.find(x => x.id === bodyId);
    if (!b) return;
    if (dist2(p, b) > R.REPORT_RANGE + 0.4 || !this.canSee(p, b.x, b.y + 0.4, b.z)) return err('Acércate más al cuerpo');
    this.startMeeting(p, b);
  }

  actEmergency(p, now, err) {
    if (this.state !== 'playing' || !p.alive || p.inVent) return;
    if (dist2(p, I.BUTTON) > I.BUTTON.r + 0.4) return err('Acércate al botón');
    if (p.emergencies <= 0) return err('Ya no te quedan reuniones de emergencia');
    if (now < this.buttonReadyAt) return err(`El botón estará listo en ${Math.ceil((this.buttonReadyAt - now) / 1000)} s`);
    if (this.sab && this.sab.kind === 'reactor') return err('¡No hay tiempo! Arregla el reactor');
    p.emergencies--;
    this.startMeeting(p, null);
  }

  startMeeting(caller, body) {
    const now = Date.now();
    this.state = 'meeting';
    // Un aviso de cuerpo durante el reactor lo arregla (si no, nadie podría votar)
    if (this.sab && this.sab.kind === 'reactor') { this.sab = null; this.sabReadyAt = now + R.SABOTAGE_CD_S * 1000; }
    this.openAllDoors();
    for (const id in this.players) {
      const q = this.players[id];
      q.voted = null; q.pad = null; q.cams = false;
      if (q.inVent) { q.inVent = null; }
      q.taskStart = {};
    }
    this.seatAll(true);
    const ms = this.settings.meetingTime * 1000;
    this.meeting = {
      by: caller.id, body: body ? body.id : null, bodyColor: body ? body.color : null,
      voteAt: now + R.DISCUSS_S * 1000, endsAt: now + ms, votes: {},
    };
    const alive = Object.values(this.players).filter(q => q.alive).map(q => q.id);
    const dead = Object.values(this.players).filter(q => !q.alive && q.role !== 'spectator').map(q => q.id);
    this.all('imp:meeting', { by: caller.id, body: this.meeting.body, voteAt: this.meeting.voteAt, endsAt: this.meeting.endsAt, alive, dead, serverNow: now });
  }

  actVote(p, target, now, err) {
    const m = this.meeting;
    if (this.state !== 'meeting' || !m || !p.alive) return;
    if (now < m.voteAt) return err('Todavía se está debatiendo');
    if (m.votes[p.id] !== undefined) return;
    if (target !== 'skip') { const t = this.players[target]; if (!t || !t.alive) return; }
    m.votes[p.id] = target;
    this.all('imp:voted', { id: p.id });
    this.maybeCloseVotes();
  }

  maybeCloseVotes() {
    const m = this.meeting;
    if (!m || this.state !== 'meeting') return;
    const alive = Object.values(this.players).filter(q => q.alive);
    if (alive.every(q => m.votes[q.id] !== undefined) || Date.now() >= m.endsAt) this.closeMeeting();
  }

  closeMeeting() {
    const m = this.meeting;
    const tally = {};
    for (const v in m.votes) tally[m.votes[v]] = (tally[m.votes[v]] || 0) + 1;
    let best = null, bestN = 0, tie = false;
    for (const k in tally) {
      if (tally[k] > bestN) { best = k; bestN = tally[k]; tie = false; }
      else if (tally[k] === bestN) tie = true;
    }
    let ejected = null;
    if (best && best !== 'skip' && !tie && this.players[best]) ejected = this.players[best];
    if (ejected) { ejected.alive = false; ejected.pad = null; }
    const c = this.counts();
    const res = {
      votes: m.votes, tally, tie, skipped: !ejected,
      ejected: ejected ? ejected.id : null,
      wasImpostor: ejected && this.settings.confirmEjects ? ejected.role === 'impostor' : null,
      impostorsLeft: this.settings.confirmEjects ? c.imp : null,
    };
    this.meeting = null;
    this.bodies = [];
    this.state = 'ejecting';
    this.ejectEndAt = Date.now() + 6500;
    this.all('imp:meeting-end', res);
  }

  actTaskStart(p, id, now, err) {
    if (this.state !== 'playing' || p.inVent) return;
    if (id === I.LIGHTS_PANEL.id) {
      if (!p.alive || !this.sab || this.sab.kind !== 'luces') return;
      if (dist2(p, I.LIGHTS_PANEL) > I.LIGHTS_PANEL.r + 0.5) return err('Acércate al panel');
      p.taskStart[id] = now; return;
    }
    if (p.role !== 'crew') return;          // las tareas del impostor son de mentira
    const t = p.tasks.find(x => x.id === id), st = I.STATION[id];
    if (!t || t.done || !st) return;
    if (dist2(p, st) > I.TASK_RANGE + 0.4) return err('Acércate más a la consola');
    p.taskStart[id] = now;
  }

  actTaskDone(p, id, now, err) {
    if (this.state !== 'playing' || p.inVent) return;
    const t0 = p.taskStart[id];
    if (!t0) return;
    delete p.taskStart[id];
    if (id === I.LIGHTS_PANEL.id) {
      if (!this.sab || this.sab.kind !== 'luces' || !p.alive) return;
      if (now - t0 < 900 || dist2(p, I.LIGHTS_PANEL) > I.LIGHTS_PANEL.r + 0.8) return;
      this.sab = null; this.sabReadyAt = now + R.SABOTAGE_CD_S * 1000;
      this.notice(`💡 ${p.nickname} ha arreglado las luces`);
      return;
    }
    const t = p.tasks.find(x => x.id === id), st = I.STATION[id];
    if (!t || t.done || !st || p.role !== 'crew') return;
    if (now - t0 < I.MIN_MS[st.type] * 0.9) return err('Demasiado rápido: repite la tarea');
    if (dist2(p, st) > I.TASK_RANGE + 0.8) return err('Te has alejado de la consola');
    t.done = true;
    this.to(p.id, 'imp:task', { id, done: true });
    // Escáner de frescura: es VISIBLE; quien lo vea sabe que ese huevo no está podrido
    if (st.type === 'escaner' && p.alive) {
      for (const oid in this.players) {
        const o = this.players[oid];
        if (oid === p.id || dist2(o, p) > 14 || !this.canSee(o, p.x, p.y + 1, p.z)) continue;
        this.to(oid, 'imp:scan', { id: p.id, x: p.x, y: p.y, z: p.z });
      }
      this.to(p.id, 'imp:scan', { id: p.id, x: p.x, y: p.y, z: p.z, me: true });
    }
    this.checkWin();
  }

  actSabotage(p, kind, room, now, err) {
    if (this.state !== 'playing' || p.role !== 'impostor' || p.inVent) return;
    if (kind === 'puertas') {
      if (now < this.doorsReadyAt) return err('Las puertas aún no están listas');
      const doors = I.DOORS.filter(dr => dr.room === room);
      if (!doors.length) return;
      for (const dr of doors) this.closeDoor(dr, now + R.DOOR_CLOSE_S * 1000);
      this.doorsReadyAt = now + R.DOORS_CD_S * 1000;
      return;
    }
    if (kind !== 'luces' && kind !== 'reactor') return;
    if (this.sab) return err('Ya hay un sabotaje en marcha');
    if (now < this.sabReadyAt) return err(`Sabotaje listo en ${Math.ceil((this.sabReadyAt - now) / 1000)} s`);
    this.sab = { kind, at: now, endsAt: kind === 'reactor' ? now + R.REACTOR_S * 1000 : 0, both: 0 };
    this.all('imp:sabotage', { kind, endsAt: this.sab.endsAt, serverNow: now });
  }

  actPad(p, pad, on) {
    if (this.state !== 'playing' || !p.alive || p.inVent) return;
    if (!on) { p.pad = null; return; }
    if (!this.sab || this.sab.kind !== 'reactor') return;
    const pd = I.REACTOR_PADS.find(x => x.id === pad);
    if (typeof pad !== 'string' || !pd || dist2(p, pd) > pd.r + 0.4) return;
    p.pad = pad;
  }

  // Sala de cámaras: mientras miras el panel, recibes lo que ven las 4 cámaras
  actCams(p, on, err) {
    if (!on) { p.cams = false; return; }
    if (this.state !== 'playing' || !p.alive || p.inVent) return;
    if (dist2(p, I.CAM_PANEL) > I.CAM_PANEL.r + 0.5) return err('Acércate al panel de las cámaras');
    p.cams = true;
  }
  camSees(o) {
    for (const c of I.CAMS) {
      if (Math.hypot(o.x - c.x, o.z - c.z) > 26) continue;
      if (Phys.lineOfSight(this.world, c.x, c.y - 0.2, c.z, o.x, o.y + 1.0, o.z)) return true;
    }
    return false;
  }

  actVent(p, op, id, now, err) {
    if (this.state !== 'playing' || !p.alive || p.role !== 'impostor') return;
    const v = I.VENT[id];
    if (!v) return;
    if (op === 'enter') {
      if (p.inVent) return;
      if (dist2(p, v) > R.VENT_RANGE + 0.4) return err('Acércate al conducto');
      p.inVent = v.id; p.pad = null;
      this.teleport(p, v.x, 0, v.z);
      this.to(p.id, 'imp:vent', { id: v.id });
    } else if (op === 'move') {
      const cur = p.inVent && I.VENT[p.inVent];
      if (!cur || !cur.links.includes(v.id)) return;
      if (now - (p.ventMoveAt || 0) < 300) return;
      p.ventMoveAt = now;
      p.inVent = v.id;
      this.teleport(p, v.x, 0, v.z);
      this.to(p.id, 'imp:vent', { id: v.id });
    } else if (op === 'exit') {
      if (p.inVent !== v.id) return;
      p.inVent = null;
      this.teleport(p, v.x, 0, v.z);
      this.to(p.id, 'imp:vent', { id: null });
    }
  }

  // Puertas: cajas dinámicas en el mundo físico del servidor (el cliente hace lo mismo)
  closeDoor(dr, until) {
    if (this.doors[dr.id]) { this.doors[dr.id] = Math.max(this.doors[dr.id], until); return; }
    this.doors[dr.id] = until;
    this.world.boxes.push({ minX: dr.minX, maxX: dr.maxX, minY: dr.minY, maxY: dr.maxY, minZ: dr.minZ, maxZ: dr.maxZ, mat: 'metalDark', solid: true, see: false, vis: true, door: dr.id });
    // Nadie se queda atrapado dentro de la hoja: se le empuja al lado más cercano
    const PR = Phys.P.RADIUS + 0.05;
    for (const id in this.players) {
      const p = this.players[id];
      if (!p.alive || p.inVent) continue;
      if (p.x + PR <= dr.minX || p.x - PR >= dr.maxX || p.z + PR <= dr.minZ || p.z - PR >= dr.maxZ) continue;
      let x = p.x, z = p.z;
      if (dr.side === 'n' || dr.side === 's') z = (p.z < (dr.minZ + dr.maxZ) / 2) ? dr.minZ - PR - 0.02 : dr.maxZ + PR + 0.02;
      else x = (p.x < (dr.minX + dr.maxX) / 2) ? dr.minX - PR - 0.02 : dr.maxX + PR + 0.02;
      this.teleport(p, x, p.y, z);
    }
  }
  openDoor(id) {
    delete this.doors[id];
    this.world.boxes = this.world.boxes.filter(b => b.door !== id);
  }
  openAllDoors() { for (const id in this.doors) this.openDoor(id); }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------
  handleAdmin(socketId, d) {
    d = d || {};
    const admin = this.players[socketId];
    if (!admin) return { error: 'No estás en la sala' };
    if (socketId !== this.adminId()) return { error: 'Sólo el anfitrión puede hacer eso' };
    switch (d.action) {
      case 'start':
        if (this.state !== 'lobby') return { error: 'La partida ya está en marcha' };
        this.practiceRole = d.role === 'impostor' ? 'impostor' : 'crew';
        return this.startGame(!!d.practice);
      case 'lobby': case 'end':
        if (this.state === 'lobby') return { error: 'Ya estáis en el vestíbulo' };
        this.notice(`🏁 ${admin.nickname} terminó la partida`);
        this.toLobby();
        return { ok: 'De vuelta al vestíbulo' };
      case 'settings': {
        if (this.state !== 'lobby') return { error: 'Sólo se cambia en el vestíbulo' };
        const s = ImpostorRoom.validateSettings(d.settings, Object.assign({}, this.settings, { maxPlayers: this.maxPlayers, name: this.name }));
        this.settings = s;
        if (s.name) this.name = s.name;
        this.maxPlayers = Math.max(s.maxPlayers, this.getPlayersCount());
        this.sendRoster();
        return { ok: 'Ajustes guardados', changed: true };
      }
      case 'kick': {
        const t = this.players[d.id];
        if (!t) return { error: 'Ese jugador ya no está' };
        if (t.id === socketId) return { error: 'No puedes expulsarte a ti mismo' };
        if (t.account) this.kicked.set(t.account, Date.now() + KICK_BAN_MS);
        this.notice(`🚪 ${admin.nickname} expulsó a ${t.nickname}`);
        return { kick: t.id, ok: `${t.nickname} expulsado` };
      }
    }
    return { error: 'Acción desconocida' };
  }

  // ---------------------------------------------------------------------------
  // Bucle del servidor (20 Hz)
  // ---------------------------------------------------------------------------
  tick() {
    const now = Date.now();
    if (!this.getPlayersCount()) return;
    if (this.state === 'playing') {
      for (const id in this.doors) if (now >= this.doors[id]) this.openDoor(id);
      const s = this.sab;
      if (s && s.kind === 'reactor') {
        // Dos jugadores vivos, uno en cada placa, a la vez durante 1 s
        const held = { A: null, B: null };
        for (const id in this.players) {
          const p = this.players[id];
          if (!p.pad || !p.alive) continue;
          const pd = I.REACTOR_PADS.find(x => x.id === p.pad);
          if (dist2(p, pd) > pd.r + 0.5) { p.pad = null; continue; }
          if (!held[p.pad]) held[p.pad] = p.id;
        }
        s.held = { A: !!held.A, B: !!held.B };
        if (held.A && held.B && held.A !== held.B) {
          if (!s.both) s.both = now;
          if (now - s.both >= 1000) {
            this.sab = null; this.sabReadyAt = now + R.SABOTAGE_CD_S * 1000;
            for (const id in this.players) this.players[id].pad = null;
            this.notice('⚛️ ¡Reactor estabilizado!');
          }
        } else s.both = 0;
        if (this.sab && now >= s.endsAt) {
          if (this.practice) { this.sab = null; this.sabReadyAt = now + R.SABOTAGE_CD_S * 1000; this.notice('⚛️ (Práctica) El reactor se habría fundido'); }
          else this.endGame('impostor', '¡La caldera llegó a 100 °C: huevos duros para todos!');
        }
      }
    } else if (this.state === 'meeting') {
      this.maybeCloseVotes();
    } else if (this.state === 'ejecting') {
      if (now >= this.ejectEndAt && !this.checkWin()) {
        this.state = 'playing';
        for (const id in this.players) {
          const p = this.players[id];
          p.killReadyAt = now + this.settings.killCd * 1000;
          p.taskStart = {};
        }
        this.buttonReadyAt = now + R.BUTTON_CD_S * 1000;
        this.sabReadyAt = Math.max(this.sabReadyAt, now + 10000);
        this.doorsReadyAt = Math.max(this.doorsReadyAt, now + 10000);
        this.all('imp:resume', {});
      }
    } else if (this.state === 'ended') {
      if (now >= this.endAt) this.toLobby();
    }
    this.sendStates(now);
  }

  sendStates(now) {
    const st = this.state;
    const tp = this.taskProgress();
    const lights = this.sab && this.sab.kind === 'luces';
    const sab = this.sab ? { k: this.sab.kind, e: this.sab.endsAt, h: this.sab.held || null } : null;
    const doors = Object.keys(this.doors);
    const all = Object.values(this.players);
    for (const r of all) {
      const ghost = !r.alive && st !== 'lobby' && st !== 'ended';
      const vis = r.role === 'impostor' ? R.VISION_IMPOSTOR : (lights ? R.VISION_DARK : R.VISION);
      const pl = [];
      for (const o of all) {
        if (o.id === r.id || o.inVent) continue;
        const oGhost = !o.alive && st !== 'lobby' && st !== 'ended';
        if (oGhost && !ghost) continue;                       // los vivos no ven fantasmas
        if (st === 'playing' && !ghost) {
          // Antitrampas: nada de «ver a través de las paredes» (no se envía lo que no ves)
          const d = Math.hypot(o.x - r.x, o.z - r.z);
          if (d > vis + 1.5 && !r.cams) continue;
          const near = d <= vis + 1.5 && (this.canSee(r, o.x, o.y + 1.0, o.z) || this.canSee(r, o.x, o.y + 1.7, o.z));
          if (!near && !(r.cams && r.alive && this.camSees(o))) continue;
        }
        pl.push([o.id, +o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2), +o.rotY.toFixed(2), oGhost ? 1 : 0]);
      }
      let bodies = [];
      if (st === 'playing') {
        bodies = this.bodies.filter(b => ghost || (Math.hypot(b.x - r.x, b.z - r.z) <= vis + 1 && this.canSee(r, b.x, b.y + 0.35, b.z)))
          .map(b => [b.id, b.x, b.y, b.z, b.color]);
      }
      const you = { al: r.alive ? 1 : 0, v: r.inVent, em: r.emergencies };
      if (r.role === 'impostor') { you.kr = r.killReadyAt; you.sr = this.sabReadyAt; you.dr = this.doorsReadyAt; }
      if (st === 'playing') you.br = this.buttonReadyAt;
      this.to(r.id, 'imp:state', { t: now, st, pl, b: bodies, sab, d: doors, tp: +tp.frac.toFixed(3), you });
    }
  }
}

// Blindaje: un fallo en un mensaje de un jugador nunca rompe la sala.
for (const k of Object.getOwnPropertyNames(ImpostorRoom.prototype)) {
  const f = ImpostorRoom.prototype[k];
  if (!/^handle/.test(k) || typeof f !== 'function' || f.length === 0) continue;
  ImpostorRoom.prototype[k] = function (...args) {
    try { return f.apply(this, args); } catch (e) { console.error(`[impostor ${this.id} ${k}]`, e && e.stack || e); return undefined; }
  };
}

module.exports = { ImpostorRoom };
