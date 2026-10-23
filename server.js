// ============================================================================
// server.js — Servidor FPS multijugador (v2: armas, granadas, modos, mapas)
// ============================================================================

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

// ---------------------------------------------------------------------------
// 1. CONFIGURACIÓN GENERAL
// ---------------------------------------------------------------------------
const PORT             = process.env.PORT || 3000;
const TICK_RATE        = 30;
const TICK_MS          = 1000 / TICK_RATE;
const MAX_HP           = 100;
const RESPAWN_MS       = 2500;
const GRENADE_FUSE_MS  = 2500;
const GRENADE_CD_MS    = 8000;
const GRENADE_RADIUS   = 8;
const GRENADE_MAX_DMG  = 80;
const GRENADE_GRAVITY  = -18;
const KILL_LIMIT_FFA   = 30;
const KILL_LIMIT_TDM   = 50;

// ---------------------------------------------------------------------------
// 2. DEFINICIÓN DE ARMAS (autoritative)
// ---------------------------------------------------------------------------
const WEAPONS = {
  rifle:   { damage: 20, cooldown: 120,  pellets: 1, range: 100, name: 'Fusil' },
  shotgun: { damage: 16, cooldown: 800,  pellets: 5, range: 30,  name: 'Escopeta' },
  sniper:  { damage: 80, cooldown: 1500, pellets: 1, range: 200, name: 'Sniper' },
};

// ---------------------------------------------------------------------------
// 3. DATOS DE MAPAS (spawns + halfSize)
// ---------------------------------------------------------------------------
const MAP_DATA = {
  cybergrid: {
    name: 'Neon Cyber-Grid',
    halfSize: 32,
    spawns: [
      { x: 0, y: 0, z: 0 },
      { x: 18, y: 0, z: 18 },
      { x: -18, y: 0, z: -18 },
      { x: 18, y: 0, z: -18 },
      { x: -18, y: 0, z: 18 },
      { x: 0, y: 3.5, z: 16 }, // Plataforma elevada
      { x: 0, y: 3.5, z: -16 },
    ],
    teamSpawns: {
      red:  [{ x: -22, y: 0, z: 0 }, { x: -20, y: 0, z: 12 }, { x: -20, y: 0, z: -12 }],
      blue: [{ x: 22, y: 0, z: 0 }, { x: 20, y: 0, z: 12 }, { x: 20, y: 0, z: -12 }],
    },
  },
  volcano: {
    name: 'Isla Volcánica',
    halfSize: 30,
    spawns: [
      { x: 0, y: 1, z: 0 },
      { x: 12, y: 1, z: 12 },
      { x: -12, y: 1, z: -12 },
      { x: 12, y: 1, z: -12 },
      { x: -12, y: 1, z: 12 },
      { x: 0, y: 1, z: 14 },
      { x: 0, y: 1, z: -14 },
    ],
    teamSpawns: {
      red:  [{ x: -18, y: 1, z: 0 }, { x: -16, y: 1, z: 8 }, { x: -16, y: 1, z: -8 }],
      blue: [{ x: 18, y: 1, z: 0 }, { x: 16, y: 1, z: 8 }, { x: 16, y: 1, z: -8 }],
    },
  },
  toyroom: {
    name: 'Giant Toyroom',
    halfSize: 35,
    spawns: [
      { x: 0, y: 0, z: 0 },
      { x: 20, y: 0, z: 20 },
      { x: -20, y: 0, z: -20 },
      { x: 20, y: 0, z: -20 },
      { x: -20, y: 0, z: 20 },
      { x: 10, y: 0, z: 0 },
      { x: -10, y: 0, z: 0 },
    ],
    teamSpawns: {
      red:  [{ x: -25, y: 0, z: 0 }, { x: -22, y: 0, z: 14 }, { x: -22, y: 0, z: -14 }],
      blue: [{ x: 25, y: 0, z: 0 }, { x: 22, y: 0, z: 14 }, { x: 22, y: 0, z: -14 }],
    },
  },
};

// ---------------------------------------------------------------------------
// 4. SERVIDOR EXPRESS + SOCKET.IO
// ---------------------------------------------------------------------------
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors:{origin:'*'}, pingInterval:2000, pingTimeout:5000 });

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// 5. ESTADO GLOBAL
// ---------------------------------------------------------------------------
let gameConfig = { mode: 'ffa', map: 'cybergrid' };
const players  = {};           // { socketId: PlayerObj }
const grenades = {};           // { grenadeId: GrenadeObj }
let grenadeIdSeq = 0;
let teamScores = { red: 0, blue: 0 };

function getMapData()  { return MAP_DATA[gameConfig.map]; }
function getHalfSize() { return getMapData().halfSize; }
function getKillLimit(){ return gameConfig.mode === 'tdm' ? KILL_LIMIT_TDM : KILL_LIMIT_FFA; }

function pickSpawn(team) {
  const md = getMapData();
  if (gameConfig.mode === 'tdm' && team && md.teamSpawns[team]) {
    const arr = md.teamSpawns[team];
    return { ...arr[Math.floor(Math.random() * arr.length)] };
  }
  const arr = md.spawns;
  return { ...arr[Math.floor(Math.random() * arr.length)] };
}

function assignTeam() {
  let redCount = 0, blueCount = 0;
  for (const id in players) {
    if (players[id].team === 'red')  redCount++;
    if (players[id].team === 'blue') blueCount++;
  }
  return redCount <= blueCount ? 'red' : 'blue';
}

function sanitizePlayers() {
  const out = {};
  for (const id in players) {
    const p = players[id];
    out[id] = {
      id:p.id, nickname:p.nickname, x:p.x, y:p.y, z:p.z,
      rotX:p.rotX, rotY:p.rotY, hp:p.hp, kills:p.kills, deaths:p.deaths,
      alive:p.alive, weapon:p.weapon, team:p.team,
    };
  }
  return out;
}

function sanitizeGrenades() {
  const out = {};
  for (const id in grenades) {
    const g = grenades[id];
    out[id] = { id:g.id, ownerId:g.ownerId, x:g.x, y:g.y, z:g.z };
  }
  return out;
}

function broadcastConfig() {
  io.emit('game:config', {
    ...gameConfig,
    mapName: getMapData().name,
    killLimit: getKillLimit(),
    teamScores,
  });
}

// ---------------------------------------------------------------------------
// 6. GESTIÓN DE CONEXIONES
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[+] Conexión: ${socket.id}`);

  // Enviar configuración actual al recién llegado
  socket.emit('game:config', {
    ...gameConfig,
    mapName: getMapData().name,
    killLimit: getKillLimit(),
    teamScores,
  });

  // ---- Cambiar config (desde lobby) ----
  socket.on('game:set-config', (data) => {
    if (data.mode && (data.mode === 'ffa' || data.mode === 'tdm')) {
      gameConfig.mode = data.mode;
    }
    if (data.map && MAP_DATA[data.map]) {
      gameConfig.map = data.map;
    }
    // Resetear puntuaciones al cambiar modo
    teamScores = { red: 0, blue: 0 };
    for (const id in players) {
      players[id].kills = 0;
      players[id].deaths = 0;
    }
    broadcastConfig();
    console.log(`[⚙] Config → modo=${gameConfig.mode}, mapa=${gameConfig.map}`);
  });

  // ---- Unirse a la partida ----
  socket.on('player:join', (data) => {
    const nickname = (data.nickname || 'Anónimo').substring(0, 16);
    const team = gameConfig.mode === 'tdm' ? assignTeam() : null;
    const spawn = pickSpawn(team);

    players[socket.id] = {
      id: socket.id,
      nickname,
      x: spawn.x, y: spawn.y, z: spawn.z,
      rotX: 0, rotY: 0,
      hp: MAX_HP,
      kills: 0, deaths: 0,
      alive: true,
      respawnAt: null,
      weapon: 'rifle',
      team,
      lastShot: 0,
      lastGrenade: 0,
      // Customización
      color:       data.color       || '#ff6b6b',
      hat:         data.hat         || 'none',
      glasses:     data.glasses     || 'none',
      textureData: data.textureData || null,
    };

    console.log(`[*] "${nickname}" se unió (${team ? 'equipo ' + team : 'FFA'})`);

    socket.emit('you:joined', {
      id: socket.id,
      team,
      players: sanitizePlayers(),
      customizations: getCustomizations(),
      config: { ...gameConfig, mapName: getMapData().name, killLimit: getKillLimit(), teamScores },
    });

    socket.broadcast.emit('player:joined', {
      id: socket.id,
      nickname,
      team,
      color: players[socket.id].color,
      hat: players[socket.id].hat,
      glasses: players[socket.id].glasses,
      textureData: players[socket.id].textureData,
    });
  });

  // ---- Movimiento ----
  socket.on('player:move', (data) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    const hs = getHalfSize();
    if (typeof data.x === 'number') p.x = Math.max(-hs, Math.min(hs, data.x));
    if (typeof data.z === 'number') p.z = Math.max(-hs, Math.min(hs, data.z));
    if (typeof data.y === 'number') p.y = Math.max(0, data.y);
    if (typeof data.rotX === 'number') p.rotX = data.rotX;
    if (typeof data.rotY === 'number') p.rotY = data.rotY;
  });

  // ---- Cambio de arma ----
  socket.on('player:weapon-switch', (data) => {
    const p = players[socket.id];
    if (!p) return;
    if (WEAPONS[data.weapon]) {
      p.weapon = data.weapon;
      socket.broadcast.emit('player:weapon-switched', { playerId: socket.id, weapon: data.weapon });
    }
  });

  // ---- Disparo ----
  socket.on('player:shoot', (data) => {
    const shooter = players[socket.id];
    if (!shooter || !shooter.alive) return;

    const wep = WEAPONS[shooter.weapon];
    if (!wep) return;

    // Cooldown del arma en servidor
    const now = Date.now();
    if (now - shooter.lastShot < wep.cooldown * 0.8) return; // Margen de tolerancia de red
    shooter.lastShot = now;

    // Notificar disparo visual a otros
    socket.broadcast.emit('player:shot-fired', { shooterId: socket.id, weapon: shooter.weapon });

    // Procesar impactos (data.targets = array de objetos { id, headshot })
    const targets = Array.isArray(data.targets) ? data.targets : (data.targetId ? [{ id: data.targetId, headshot: !!data.headshot }] : []);

    for (const targetInfo of targets) {
      const tid = typeof targetInfo === 'object' ? targetInfo.id : targetInfo;
      const isHeadshot = typeof targetInfo === 'object' ? !!targetInfo.headshot : false;
      if (!tid) continue;
      const target = players[tid];
      if (!target || !target.alive) continue;

      // TDM: no fuego amigo
      if (gameConfig.mode === 'tdm' && shooter.team === target.team) continue;

      // Validación de distancia
      const dx = shooter.x - target.x;
      const dy = shooter.y - target.y;
      const dz = shooter.z - target.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist > wep.range * 1.2) continue;

      // Daño crítico por Headshot (x1.75)
      const appliedDamage = isHeadshot ? Math.round(wep.damage * 1.75) : wep.damage;
      target.hp -= appliedDamage;

      io.emit('player:hit', {
        targetId: tid, shooterId: socket.id,
        damage: appliedDamage, hp: target.hp, weapon: shooter.weapon,
        headshot: isHeadshot,
      });

      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        target.deaths++;
        shooter.kills++;
        target.respawnAt = Date.now() + RESPAWN_MS;

        if (gameConfig.mode === 'tdm' && shooter.team) {
          teamScores[shooter.team]++;
        }

        io.emit('player:killed', {
          targetId: tid, targetNickname: target.nickname,
          killerId: socket.id, killerNickname: shooter.nickname,
          weapon: shooter.weapon,
          headshot: isHeadshot,
        });
        console.log(`[x] "${shooter.nickname}" eliminó a "${target.nickname}" con ${shooter.weapon}${isHeadshot ? ' [HEADSHOT!]' : ''}`);

        checkWinCondition(shooter);
      }
    }
  });

  // ---- Chat Flotante ----
  socket.on('player:chat', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const msg = (data.message || '').trim().substring(0, 60);
    if (!msg) return;

    io.emit('player:chat', {
      id: socket.id,
      nickname: p.nickname,
      message: msg,
    });
  });

  // ---- Emotes Express (Tecla B) ----
  socket.on('player:emote', (data) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    io.emit('player:emote', {
      id: socket.id,
      emoteType: data.emoteType || 'spin',
    });
  });

  // ---- Lanzar granada ----
  socket.on('player:grenade-throw', (data) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;

    const now = Date.now();
    if (now - p.lastGrenade < GRENADE_CD_MS) return;
    p.lastGrenade = now;

    const gid = 'g' + (grenadeIdSeq++);
    const speed = 18;
    grenades[gid] = {
      id: gid,
      ownerId: socket.id,
      team: p.team,
      x: p.x, y: p.y + 1.5, z: p.z,
      vx: (data.dirX || 0) * speed,
      vy: (data.dirY || 0.5) * speed,
      vz: (data.dirZ || 0) * speed,
      detonateAt: now + GRENADE_FUSE_MS,
    };

    io.emit('grenade:spawn', {
      id: gid, ownerId: socket.id,
      x: grenades[gid].x, y: grenades[gid].y, z: grenades[gid].z,
      vx: grenades[gid].vx, vy: grenades[gid].vy, vz: grenades[gid].vz,
    });
  });

  // ---- Actualizar personalización ----
  socket.on('player:customize', (data) => {
    const p = players[socket.id];
    if (!p) return;
    if (data.color)    p.color    = data.color;
    if (data.hat)      p.hat      = data.hat;
    if (data.glasses)  p.glasses  = data.glasses;
    if (typeof data.textureData === 'string' || data.textureData === null) {
      p.textureData = data.textureData;
    }
    socket.broadcast.emit('player:customized', {
      id: socket.id,
      color: p.color, hat: p.hat, glasses: p.glasses, textureData: p.textureData,
    });
  });

  // ---- Desconexión ----
  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) console.log(`[-] "${p.nickname}" se desconectó`);
    delete players[socket.id];
    io.emit('player:left', { id: socket.id });
  });
});

// ---------------------------------------------------------------------------
// 7. UTILIDADES
// ---------------------------------------------------------------------------
function getCustomizations() {
  const out = {};
  for (const id in players) {
    const p = players[id];
    out[id] = { color: p.color, hat: p.hat, glasses: p.glasses, textureData: p.textureData };
  }
  return out;
}

function checkWinCondition(killer) {
  const limit = getKillLimit();
  if (gameConfig.mode === 'ffa') {
    if (killer.kills >= limit) {
      io.emit('game:over', { winner: killer.nickname, reason: `${killer.nickname} alcanzó ${limit} kills` });
      resetRound();
    }
  } else {
    for (const t of ['red', 'blue']) {
      if (teamScores[t] >= limit) {
        io.emit('game:over', { winner: t, reason: `Equipo ${t} alcanzó ${limit} kills` });
        resetRound();
        break;
      }
    }
  }
}

function resetRound() {
  teamScores = { red: 0, blue: 0 };
  for (const id in players) {
    const p = players[id];
    p.kills = 0;
    p.deaths = 0;
    p.hp = MAX_HP;
    p.alive = true;
    p.respawnAt = null;
    const spawn = pickSpawn(p.team);
    p.x = spawn.x; p.y = spawn.y; p.z = spawn.z;
  }
  for (const gid in grenades) delete grenades[gid];
}

// ---------------------------------------------------------------------------
// 8. TICK LOOP (30 FPS)
// ---------------------------------------------------------------------------
function gameTick() {
  const now   = Date.now();
  const delta = TICK_MS / 1000;

  // --- Actualizar granadas ---
  for (const gid in grenades) {
    const g = grenades[gid];
    g.vy += GRENADE_GRAVITY * delta;
    g.x  += g.vx * delta;
    g.y  += g.vy * delta;
    g.z  += g.vz * delta;

    // Rebote en suelo
    if (g.y <= 0.15) {
      g.y = 0.15;
      g.vy = -g.vy * 0.35;
      g.vx *= 0.6;
      g.vz *= 0.6;
      if (Math.abs(g.vy) < 0.5) g.vy = 0;
    }

    // Límites del mapa
    const hs = getHalfSize();
    if (g.x < -hs || g.x > hs) g.vx = -g.vx * 0.5;
    if (g.z < -hs || g.z > hs) g.vz = -g.vz * 0.5;
    g.x = Math.max(-hs, Math.min(hs, g.x));
    g.z = Math.max(-hs, Math.min(hs, g.z));

    // Detonación
    if (now >= g.detonateAt) {
      detonateGrenade(gid, g);
    }
  }

  // --- Peligro ambiental: Lava en mapa volcánico ---
  if (gameConfig.map === 'volcano') {
    for (const id in players) {
      const p = players[id];
      if (!p.alive) continue;
      // Si el jugador está sobre el nivel de lava (y <= 0.25) fuera de la isla central (radio 16)
      const distCenter = Math.hypot(p.x, p.z);
      if (p.y <= 0.3 && distCenter > 15) {
        p.hp -= 3; // Daño constante por lava (~90 DMG/s)
        io.emit('player:hit', { targetId: id, shooterId: 'lava', damage: 3, hp: p.hp, weapon: 'lava' });
        if (p.hp <= 0) {
          p.hp = 0;
          p.alive = false;
          p.deaths++;
          p.respawnAt = Date.now() + RESPAWN_MS;
          io.emit('player:killed', {
            targetId: id,
            targetNickname: p.nickname,
            killerId: 'lava',
            killerNickname: '🌋 Lava Ardiente',
            weapon: 'lava',
          });
        }
      }
    }
  }

  // --- Respawns ---
  for (const id in players) {
    const p = players[id];
    if (!p.alive && p.respawnAt && now >= p.respawnAt) {
      const spawn = pickSpawn(p.team);
      p.x = spawn.x; p.y = spawn.y; p.z = spawn.z;
      p.hp = MAX_HP; p.alive = true; p.respawnAt = null;
      io.emit('player:respawn', { id: p.id, x: p.x, y: p.y, z: p.z });
    }
  }

  // --- Broadcast estado ---
  io.emit('game:state', { players: sanitizePlayers(), grenades: sanitizeGrenades(), teamScores });
}

function detonateGrenade(gid, g) {
  const damages = [];
  for (const pid in players) {
    const p = players[pid];
    if (!p.alive) continue;
    // TDM: sin daño a aliados
    if (gameConfig.mode === 'tdm' && g.team && g.team === p.team) continue;

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
      const owner = players[g.ownerId];
      if (owner && owner.id !== pid) owner.kills++;
      if (gameConfig.mode === 'tdm' && owner && owner.team) teamScores[owner.team]++;

      io.emit('player:killed', {
        targetId: pid, targetNickname: p.nickname,
        killerId: g.ownerId, killerNickname: owner ? owner.nickname : '???',
        weapon: 'grenade',
      });
    }
  }

  io.emit('grenade:explode', { id: gid, x: g.x, y: g.y, z: g.z, damages });
  delete grenades[gid];
}

setInterval(gameTick, TICK_MS);

// ---------------------------------------------------------------------------
// 9. ARRANQUE
// ---------------------------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  console.log('=============================================');
  console.log('  🥚 Shell Shockers Local v2 — ONLINE');
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log('  📡 Accesible en red local vía IP:' + PORT);
  console.log(`  🎮 Tick: ${TICK_RATE} FPS | Modo: ${gameConfig.mode} | Mapa: ${gameConfig.map}`);
  console.log('=============================================');
});
