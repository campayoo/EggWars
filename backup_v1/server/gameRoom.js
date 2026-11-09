// ============================================================================
// server/gameRoom.js — Gestión individual de una Sala de Juego (GameRoom)
// ============================================================================

const { MAPS_DATA } = require('./mapsData');

const TICK_RATE       = 30;
const TICK_MS         = 1000 / TICK_RATE;
const MAX_HP          = 100;
const RESPAWN_MS      = 2500;
const GRENADE_FUSE_MS = 2500;
const GRENADE_CD_MS   = 7000;
const GRENADE_RADIUS  = 8.5;
const GRENADE_MAX_DMG = 85;
const KILL_LIMIT_FFA  = 25;
const KILL_LIMIT_TDM  = 40;

const WEAPONS = {
  rifle:   { damage: 22, cooldown: 110,  pellets: 1, range: 120, name: 'EggK-47' },
  shotgun: { damage: 17, cooldown: 750,  pellets: 6, range: 35,  name: 'Scrambler' },
  sniper:  { damage: 85, cooldown: 1300, pellets: 1, range: 250, name: 'Free RANGER' },
};

class GameRoom {
  constructor(io, id, name, map = 'dirt', mode = 'ffa', maxPlayers = 8) {
    this.io = io;
    this.id = id;
    this.name = name || 'Sala Shell Shockers';
    this.config = { mode: mode || 'ffa', map: map || 'dirt' };
    this.maxPlayers = maxPlayers || 8;
    this.players = {};
    this.grenades = {};
    this.grenadeIdSeq = 0;
    this.teamScores = { red: 0, blue: 0 };

    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  destroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  getPlayersCount() {
    return Object.keys(this.players).length;
  }

  getMapData() {
    return MAPS_DATA[this.config.map] || MAPS_DATA.dirt;
  }

  getHalfSize() {
    return this.getMapData().halfSize;
  }

  getKillLimit() {
    return this.config.mode === 'tdm' ? KILL_LIMIT_TDM : KILL_LIMIT_FFA;
  }

  pickSpawn(team) {
    const md = this.getMapData();
    if (this.config.mode === 'tdm' && team && md.teamSpawns && md.teamSpawns[team]) {
      const arr = md.teamSpawns[team];
      return { ...arr[Math.floor(Math.random() * arr.length)] };
    }
    const arr = md.spawns;
    return { ...arr[Math.floor(Math.random() * arr.length)] };
  }

  assignTeam() {
    let redCount = 0, blueCount = 0;
    for (const id in this.players) {
      if (this.players[id].team === 'red')  redCount++;
      if (this.players[id].team === 'blue') blueCount++;
    }
    return redCount <= blueCount ? 'red' : 'blue';
  }

  sanitizePlayers() {
    const out = {};
    for (const id in this.players) {
      const p = this.players[id];
      out[id] = {
        id: p.id,
        nickname: p.nickname,
        x: p.x, y: p.y, z: p.z,
        rotX: p.rotX, rotY: p.rotY,
        hp: p.hp, kills: p.kills, deaths: p.deaths,
        alive: p.alive, weapon: p.weapon, team: p.team,
      };
    }
    return out;
  }

  sanitizeGrenades() {
    const out = {};
    for (const id in this.grenades) {
      const g = this.grenades[id];
      out[id] = { id: g.id, ownerId: g.ownerId, x: g.x, y: g.y, z: g.z };
    }
    return out;
  }

  getCustomizations() {
    const out = {};
    for (const id in this.players) {
      const p = this.players[id];
      out[id] = { color: p.color, hat: p.hat, glasses: p.glasses, textureData: p.textureData };
    }
    return out;
  }

  broadcastConfig() {
    this.io.to(this.id).emit('game:config', {
      ...this.config,
      roomId: this.id,
      roomName: this.name,
      mapName: this.getMapData().name,
      killLimit: this.getKillLimit(),
      teamScores: this.teamScores,
      gravity: this.getMapData().gravity,
    });
  }

  handlePlayerJoin(socket, data) {
    const nickname = (data && typeof data.nickname === 'string' ? data.nickname.trim() : 'EggSoldier').substring(0, 14) || 'EggSoldier';
    const team = this.config.mode === 'tdm' ? this.assignTeam() : null;
    const spawn = this.pickSpawn(team);
    const chosenWeapon = (data && data.weapon && WEAPONS[data.weapon]) ? data.weapon : 'rifle';

    this.players[socket.id] = {
      id: socket.id,
      nickname,
      x: spawn.x, y: spawn.y, z: spawn.z,
      rotX: 0, rotY: 0,
      hp: MAX_HP,
      kills: 0, deaths: 0,
      alive: true,
      respawnAt: null,
      weapon: chosenWeapon,
      team,
      lastShot: 0,
      lastGrenade: 0,
      color:       (data && data.color) || '#ffffff',
      hat:         (data && data.hat) || 'none',
      glasses:     (data && data.glasses) || 'none',
      textureData: (data && data.textureData) || null,
    };

    socket.emit('you:joined', {
      id: socket.id,
      team,
      players: this.sanitizePlayers(),
      customizations: this.getCustomizations(),
      config: {
        ...this.config,
        roomId: this.id,
        roomName: this.name,
        mapName: this.getMapData().name,
        killLimit: this.getKillLimit(),
        teamScores: this.teamScores,
        gravity: this.getMapData().gravity,
      },
    });

    socket.to(this.id).emit('player:joined', {
      id: socket.id,
      nickname,
      team,
      color: this.players[socket.id].color,
      hat: this.players[socket.id].hat,
      glasses: this.players[socket.id].glasses,
      textureData: this.players[socket.id].textureData,
    });
  }

  handlePlayerMove(socketId, data) {
    const p = this.players[socketId];
    if (!p || !p.alive || !data) return;
    const hs = this.getHalfSize();
    if (typeof data.x === 'number' && !isNaN(data.x)) p.x = Math.max(-hs, Math.min(hs, data.x));
    if (typeof data.z === 'number' && !isNaN(data.z)) p.z = Math.max(-hs, Math.min(hs, data.z));
    if (typeof data.y === 'number' && !isNaN(data.y)) p.y = Math.max(-15, data.y);
    if (typeof data.rotX === 'number' && !isNaN(data.rotX)) p.rotX = data.rotX;
    if (typeof data.rotY === 'number' && !isNaN(data.rotY)) p.rotY = data.rotY;
  }

  handleWeaponSwitch(socket, weapon) {
    const p = this.players[socket.id];
    if (!p || !WEAPONS[weapon]) return;
    p.weapon = weapon;
    socket.to(this.id).emit('player:weapon-switched', { playerId: socket.id, weapon });
  }

  handlePlayerShoot(socket, data) {
    const shooter = this.players[socket.id];
    if (!shooter || !shooter.alive) return;

    const wep = WEAPONS[shooter.weapon];
    if (!wep) return;

    const now = Date.now();
    if (now - shooter.lastShot < wep.cooldown * 0.75) return;
    shooter.lastShot = now;

    socket.to(this.id).emit('player:shot-fired', { shooterId: socket.id, weapon: shooter.weapon });

    const targets = Array.isArray(data.targets) ? data.targets : (data.targetId ? [{ id: data.targetId, headshot: !!data.headshot }] : []);

    for (const targetInfo of targets) {
      if (!targetInfo) continue;
      const tid = typeof targetInfo === 'object' ? targetInfo.id : targetInfo;
      const isHeadshot = typeof targetInfo === 'object' ? !!targetInfo.headshot : false;
      if (!tid) continue;

      const target = this.players[tid];
      if (!target || !target.alive) continue;
      if (this.config.mode === 'tdm' && shooter.team === target.team) continue;

      const dx = shooter.x - target.x;
      const dy = shooter.y - target.y;
      const dz = shooter.z - target.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist > wep.range * 1.25) continue;

      const appliedDamage = isHeadshot ? Math.round(wep.damage * 1.85) : wep.damage;
      target.hp -= appliedDamage;

      this.io.to(this.id).emit('player:hit', {
        targetId: tid,
        shooterId: socket.id,
        damage: appliedDamage,
        hp: target.hp,
        weapon: shooter.weapon,
        headshot: isHeadshot,
      });

      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        target.deaths++;
        shooter.kills++;
        target.respawnAt = Date.now() + RESPAWN_MS;

        if (this.config.mode === 'tdm' && shooter.team) {
          this.teamScores[shooter.team]++;
        }

        this.io.to(this.id).emit('player:killed', {
          targetId: tid,
          targetNickname: target.nickname,
          killerId: socket.id,
          killerNickname: shooter.nickname,
          weapon: shooter.weapon,
          headshot: isHeadshot,
        });

        this.checkWinCondition(shooter);
      }
    }
  }

  handleGrenadeThrow(socket, data) {
    const p = this.players[socket.id];
    if (!p || !p.alive) return;

    const now = Date.now();
    if (now - p.lastGrenade < GRENADE_CD_MS) return;
    p.lastGrenade = now;

    const gid = 'g' + (this.grenadeIdSeq++);
    const speed = 19;
    this.grenades[gid] = {
      id: gid,
      ownerId: socket.id,
      team: p.team,
      x: p.x, y: p.y + 1.4, z: p.z,
      vx: (data.dirX || 0) * speed,
      vy: (data.dirY || 0.45) * speed,
      vz: (data.dirZ || 0) * speed,
      detonateAt: now + GRENADE_FUSE_MS,
    };

    this.io.to(this.id).emit('grenade:spawn', {
      id: gid, ownerId: socket.id,
      x: this.grenades[gid].x, y: this.grenades[gid].y, z: this.grenades[gid].z,
      vx: this.grenades[gid].vx, vy: this.grenades[gid].vy, vz: this.grenades[gid].vz,
    });
  }

  handlePlayerChat(socket, message) {
    const p = this.players[socket.id];
    if (!p) return;
    const msg = (message || '').trim().substring(0, 50);
    if (!msg) return;

    this.io.to(this.id).emit('player:chat', {
      id: socket.id,
      nickname: p.nickname,
      message: msg,
    });
  }

  handlePlayerEmote(socket, emoteType) {
    const p = this.players[socket.id];
    if (!p || !p.alive) return;
    this.io.to(this.id).emit('player:emote', {
      id: socket.id,
      emoteType: emoteType || 'spin',
    });
  }

  handlePlayerDisconnect(socketId) {
    const p = this.players[socketId];
    if (p) {
      delete this.players[socketId];
      this.io.to(this.id).emit('player:left', { id: socketId });
    }
  }

  setConfig(newConfig) {
    if (newConfig.mode && (newConfig.mode === 'ffa' || newConfig.mode === 'tdm')) {
      this.config.mode = newConfig.mode;
    }
    if (newConfig.map && MAPS_DATA[newConfig.map]) {
      this.config.map = newConfig.map;
    }
    this.teamScores = { red: 0, blue: 0 };
    for (const id in this.players) {
      this.players[id].kills = 0;
      this.players[id].deaths = 0;
    }
    this.broadcastConfig();
  }

  checkWinCondition(killer) {
    const limit = this.getKillLimit();
    if (this.config.mode === 'ffa') {
      if (killer.kills >= limit) {
        this.io.to(this.id).emit('game:over', { winner: killer.nickname, reason: `${killer.nickname} llegó a ${limit} eliminaciones` });
        this.resetRound();
      }
    } else {
      for (const t of ['red', 'blue']) {
        if (this.teamScores[t] >= limit) {
          const teamName = t === 'red' ? 'Rojo' : 'Azul';
          this.io.to(this.id).emit('game:over', { winner: t, reason: `Equipo ${teamName} ganó la partida` });
          this.resetRound();
          break;
        }
      }
    }
  }

  resetRound() {
    this.teamScores = { red: 0, blue: 0 };
    for (const id in this.players) {
      const p = this.players[id];
      p.kills = 0;
      p.deaths = 0;
      p.hp = MAX_HP;
      p.alive = true;
      p.respawnAt = null;
      const spawn = this.pickSpawn(p.team);
      p.x = spawn.x; p.y = spawn.y; p.z = spawn.z;
    }
    for (const gid in this.grenades) delete this.grenades[gid];
  }

  tick() {
    const now = Date.now();
    const delta = TICK_MS / 1000;
    const mapData = this.getMapData();
    const curGrav = mapData.gravity || -24.0;

    for (const gid in this.grenades) {
      const g = this.grenades[gid];
      g.vy += curGrav * 0.75 * delta;
      g.x  += g.vx * delta;
      g.y  += g.vy * delta;
      g.z  += g.vz * delta;

      if (g.y <= 0.15) {
        g.y = 0.15;
        g.vy = -g.vy * 0.35;
        g.vx *= 0.65;
        g.vz *= 0.65;
        if (Math.abs(g.vy) < 0.4) g.vy = 0;
      }

      const hs = this.getHalfSize();
      if (g.x < -hs || g.x > hs) g.vx = -g.vx * 0.5;
      if (g.z < -hs || g.z > hs) g.vz = -g.vz * 0.5;
      g.x = Math.max(-hs, Math.min(hs, g.x));
      g.z = Math.max(-hs, Math.min(hs, g.z));

      if (now >= g.detonateAt) {
        this.detonateGrenade(gid, g);
      }
    }

    for (const id in this.players) {
      const p = this.players[id];
      if (p.alive && p.y < -12) {
        p.hp = 0;
        p.alive = false;
        p.deaths++;
        p.respawnAt = Date.now() + RESPAWN_MS;
        this.io.to(this.id).emit('player:killed', {
          targetId: id,
          targetNickname: p.nickname,
          killerId: 'void',
          killerNickname: '🌌 El Vacío Cósmico',
          weapon: 'void',
        });
      }
    }

    for (const id in this.players) {
      const p = this.players[id];
      if (!p.alive && p.respawnAt && now >= p.respawnAt) {
        const spawn = this.pickSpawn(p.team);
        p.x = spawn.x; p.y = spawn.y; p.z = spawn.z;
        p.hp = MAX_HP; p.alive = true; p.respawnAt = null;
        this.io.to(this.id).emit('player:respawn', { id: p.id, x: p.x, y: p.y, z: p.z });
      }
    }

    this.io.to(this.id).emit('game:state', {
      players: this.sanitizePlayers(),
      grenades: this.sanitizeGrenades(),
      teamScores: this.teamScores,
    });
  }

  detonateGrenade(gid, g) {
    const damages = [];
    for (const pid in this.players) {
      const p = this.players[pid];
      if (!p.alive) continue;
      if (this.config.mode === 'tdm' && g.team && g.team === p.team) continue;

      const dx = p.x - g.x, dy = (p.y + 0.9) - g.y, dz = p.z - g.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist >= GRENADE_RADIUS) continue;

      const factor = 1 - dist / GRENADE_RADIUS;
      const dmg = Math.round(GRENADE_MAX_DMG * factor);
      if (dmg <= 0) continue;

      p.hp -= dmg;
      damages.push({ playerId: pid, damage: dmg });

      if (p.hp <= 0) {
        p.hp = 0; p.alive = false; p.deaths++;
        p.respawnAt = Date.now() + RESPAWN_MS;
        const owner = this.players[g.ownerId];
        if (owner && owner.id !== pid) owner.kills++;
        if (this.config.mode === 'tdm' && owner && owner.team) this.teamScores[owner.team]++;

        this.io.to(this.id).emit('player:killed', {
          targetId: pid, targetNickname: p.nickname,
          killerId: g.ownerId, killerNickname: owner ? owner.nickname : '???',
          weapon: 'grenade',
        });
      }
    }

    this.io.to(this.id).emit('grenade:explode', { id: gid, x: g.x, y: g.y, z: g.z, damages });
    delete this.grenades[gid];
  }
}

module.exports = { GameRoom };
