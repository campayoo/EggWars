// ============================================================================
// server/server.js — Express + Socket.io + navegador de salas (multi-sala)
// ============================================================================

const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { Server } = require('socket.io');
const { GameRoom, clampNum } = require('./gameRoom');
const MapDefs = require('../shared/mapdefs.js');
const { MODES, TIME_LIMITS, WEAPONS } = require('../shared/gamedata.js');
const Accounts = require('./accounts');
const Cosmetics = require('../shared/cosmetics.js');

const PORT = process.env.PORT || 3000;
const EMPTY_ROOM_TTL_MS = 60000;
const MAX_ROOMS = 40;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Sin CORS abierto: sólo la propia página del juego puede conectarse al servidor
  allowRequest: (req, cb) => {
    const origin = req.headers.origin;
    if (!origin) return cb(null, true);
    try { cb(null, new URL(origin).host === req.headers.host); } catch (e) { cb(null, false); }
  },
  pingInterval: 5000,
  pingTimeout: 8000,
  maxHttpBufferSize: 2e5, // texturas de huevo pintadas (~60 KB)
});

// ---------------------------------------------------------------------------
// Seguridad HTTP
// ---------------------------------------------------------------------------
const fs = require('fs');
const DIST = path.join(__dirname, '..', 'dist');
// Modo producción: se sirve SÓLO el paquete minificado/ofuscado de dist/ (npm run build)
const PROD = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
if (PROD && !fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('✗ No existe dist/. Ejecuta primero:  npm run build');
  process.exit(1);
}
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');                 // nadie puede meter el juego en un iframe ajeno
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws: wss:",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '));
  next();
});
// no-cache: el navegador revalida (ETag) y nunca ejecuta código viejo tras actualizar el juego
const staticOpts = { dotfiles: 'deny', index: 'index.html', redirect: false, setHeaders: res => res.setHeader('Cache-Control', 'no-cache') };
if (PROD) {
  app.use(express.static(DIST, staticOpts));
} else {
  // Desarrollo: sólo los archivos que necesita la página (nunca server/, data/, tests/…)
  app.use(express.static(path.join(__dirname, '..', 'public'), staticOpts));
  app.use('/shared', express.static(path.join(__dirname, '..', 'shared'), staticOpts));
}
// Cualquier otra ruta: 404 sin pistas
app.use((req, res) => res.status(404).type('text').send('No encontrado'));

// Registro de salas activas { roomId: GameRoom }
const rooms = {};

// ---------------------------------------------------------------------------
// Cuentas conectadas y amigos
// ---------------------------------------------------------------------------
const online = new Map();      // clave de cuenta -> socket
const accountRoom = new Map(); // clave de cuenta -> roomId

// Estadísticas por cuenta: las suma el servidor (no se pueden falsear desde el cliente)
const statHooks = {
  onKill(killer, target, weapon, headshot) {
    if (killer && killer.account) {
      const d = { kills: 1, bestStreak: killer.streak || 0, kw: {} };
      if (WEAPONS[weapon]) d.kw[weapon] = 1;
      if (headshot) d.headshots = 1;
      if (weapon === 'grenade') d.grenadeKills = 1;
      Accounts.addStats(killer.account, d);
    }
    if (target && target.account) Accounts.addStats(target.account, { deaths: 1 });
  },
  onRoundEnd(players, winnerTeam, winnerId, teams) {
    for (const p of players) {
      if (!p.account) continue;
      const won = teams ? (winnerTeam && p.team === winnerTeam) : p.id === winnerId;
      Accounts.addStats(p.account, { games: 1, wins: won ? 1 : 0 });
    }
  },
};

function roomSummary(r) {
  if (!r) return null;
  return { roomId: r.id, roomName: r.name, mapName: r.mapData.name, modeName: r.mode.name, players: r.getPlayersCount(), max: r.maxPlayers };
}
function friendsPayload(k) {
  const u = Accounts.get(k);
  if (!u) return { friends: [], requests: [], sent: [] };
  const friends = u.friends.map(f => {
    const fu = Accounts.get(f);
    const isOn = online.has(f);
    return { username: fu ? fu.username : f, online: isOn, room: isOn ? roomSummary(rooms[accountRoom.get(f)]) : null, color: fu ? fu.custom.color : '#fff' };
  }).sort((a, b) => (b.online - a.online) || a.username.localeCompare(b.username));
  return { friends, requests: u.requests.map(Accounts.displayName), sent: u.sent.map(Accounts.displayName) };
}
function pushFriends(k) {
  const s = online.get(k);
  if (s) s.emit('friends:list', friendsPayload(k));
}
function notifyFriendsOf(k) {
  const u = Accounts.get(k);
  if (u) u.friends.forEach(pushFriends);
}

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)];
    if (!Object.values(rooms).some(r => r.code === c)) return c;
  }
}

function createRoom(opts) {
  const id = opts.id || ('room-' + Date.now().toString(36) + Math.floor(Math.random() * 1000));
  if (rooms[id]) return rooms[id];
  const room = new GameRoom(io, Object.assign({}, opts, { id, code: newCode(), hooks: statHooks }));
  rooms[id] = room;
  return room;
}

function createDefaultRooms() {
  createRoom({ id: 'room-castle-ffa', name: 'Castle • Todos contra Todos', map: 'castle', mode: 'ffa', maxPlayers: 12, isDefault: true });
  createRoom({ id: 'room-dirt-tdm', name: 'Dirt • Equipos', map: 'dirt', mode: 'tdm', maxPlayers: 16, isDefault: true });
  createRoom({ id: 'room-moonbase-kotc', name: 'Moonbase • King of the Coop', map: 'moonbase', mode: 'kotc', maxPlayers: 12, isDefault: true });
  createRoom({ id: 'room-shipyard-cts', name: 'Shipyard • Capture the Spatula', map: 'shipyard', mode: 'cts', maxPlayers: 12, isDefault: true });
  createRoom({ id: 'room-feedlot-ffa', name: 'Feedlot • Todos contra Todos', map: 'feedlot', mode: 'ffa', maxPlayers: 12, isDefault: true });
}

function getRoomsList() {
  return Object.values(rooms)
    .filter(r => !r.isPrivate)
    .map(r => r.listInfo())
    .sort((a, b) => (b.playersCount - a.playersCount) || (a.isDefault === b.isDefault ? 0 : a.isDefault ? 1 : -1));
}

let listDirty = false;
function broadcastRoomsList() { listDirty = true; }
setInterval(() => {
  if (!listDirty) return;
  listDirty = false;
  io.emit('rooms:list', getRoomsList());
}, 500);

// Limpieza de salas creadas por jugadores que se han quedado vacías
setInterval(() => {
  const now = Date.now();
  for (const id in rooms) {
    const r = rooms[id];
    if (!r.isDefault && r.getPlayersCount() === 0 && r.emptySince && now - r.emptySince > EMPTY_ROOM_TTL_MS) {
      r.destroy();
      delete rooms[id];
      broadcastRoomsList();
    }
  }
}, 10000);

createDefaultRooms();

// socket.id -> función que cambia la sala de ese socket (para expulsar desde el admin)
const roomSetters = new Map();

io.on('connection', (socket) => {
  // Ningún mensaje malformado puede tumbar el servidor: cada evento va protegido
  const rawOn = socket.on.bind(socket);
  socket.on = (ev, fn) => rawOn(ev, (...args) => {
    try { return fn(...args); } catch (e) { console.error(`[socket ${ev}]`, e && e.stack || e); }
  });
  // Límite global de mensajes por segundo (anti-flood)
  let evCount = 0, evWindow = Date.now();
  socket.use((packet, next) => {
    const now = Date.now();
    if (now - evWindow > 1000) { evWindow = now; evCount = 0; }
    if (++evCount > 160) return; // se descartan en silencio
    next();
  });
  socket.emit('rooms:list', getRoomsList());
  let currentRoomId = null;
  let account = null;     // clave de la cuenta con la que ha iniciado sesión
  let fails = [];
  const room = () => (currentRoomId && rooms[currentRoomId]) || null;
  const setRoom = id => {
    currentRoomId = id;
    if (account) { if (id) accountRoom.set(account, id); else accountRoom.delete(account); notifyFriendsOf(account); }
  };
  roomSetters.set(socket.id, setRoom);

  // ---- Inicio de sesión ----
  function finishAuth(res) {
    if (res.error) { socket.emit('auth:error', { message: res.error }); return; }
    if (res.needName) { socket.emit('auth:needName', {}); return; }
    const k = Accounts.key(res.user.username);
    const prev = online.get(k);
    if (prev && prev !== socket) { prev.emit('auth:kicked', { message: 'Has iniciado sesión en otro equipo' }); prev.disconnect(true); }
    if (account && account !== k) { online.delete(account); notifyFriendsOf(account); }
    account = k;
    online.set(k, socket);
    res.user.lastSeen = Date.now();
    socket.emit('auth:ok', { token: res.token, profile: Accounts.publicProfile(res.user) });
    pushFriends(k);
    notifyFriendsOf(k);
  }
  function throttled() {
    const now = Date.now();
    fails = fails.filter(t => now - t < 60000);
    if (fails.length >= 8) { socket.emit('auth:error', { message: 'Demasiados intentos. Espera un minuto.' }); return true; }
    return false;
  }
  const authWrap = fn => data => {
    if (throttled()) return;
    const res = fn(data || {});
    if (res.error) fails.push(Date.now());
    finishAuth(res);
  };
  socket.on('auth:register', authWrap(d => Accounts.register(d.username, d.password)));
  socket.on('auth:login', authWrap(d => Accounts.login(d.username, d.password)));
  socket.on('auth:token', d => finishAuth(Accounts.loginToken(d && d.token)));
  socket.on('auth:ip', authWrap(d => Accounts.loginIp(socket.handshake.address, d.name)));
  socket.on('auth:logout', d => {
    if (d && d.token) Accounts.logout(d.token);
    if (room()) { socket.leave(currentRoomId); room().handlePlayerDisconnect(socket.id); setRoom(null); broadcastRoomsList(); }
    if (account) { online.delete(account); notifyFriendsOf(account); }
    account = null;
  });

  socket.on('auth:setPassword', d => {
    if (!account || !d) return;
    if (throttled()) return;
    const res = Accounts.setPassword(account, d.current, d.next);
    if (res.error) { fails.push(Date.now()); socket.emit('auth:pwResult', { error: res.error }); return; }
    socket.emit('auth:pwResult', { ok: true, profile: Accounts.publicProfile(res.user) });
  });

  // ---- Perfil ----
  socket.on('profile:get', () => { const u = account && Accounts.get(account); if (u) socket.emit('profile:data', Accounts.publicProfile(u)); });
  socket.on('profile:save', d => { if (account) Accounts.saveProfile(account, d); });

  // ---- Amigos ----
  const friendReply = (res, okMsg) => {
    if (res.error) socket.emit('friends:error', { message: res.error });
    else if (okMsg) socket.emit('friends:ok', { message: okMsg });
  };
  socket.on('friends:request', d => {
    if (!account) return;
    const res = Accounts.sendRequest(account, d && d.username);
    friendReply(res, res.accepted ? `¡Ahora eres amigo de ${res.other}!` : res.to ? `Solicitud enviada a ${res.to}` : null);
    pushFriends(account);
    const other = res.to || res.other;
    if (other) { pushFriends(Accounts.key(other)); const s = online.get(Accounts.key(other)); if (s && res.to) s.emit('friends:incoming', { from: Accounts.get(account).username }); }
  });
  socket.on('friends:respond', d => {
    if (!account || !d) return;
    const res = Accounts.respond(account, d.username, !!d.accept);
    friendReply(res, res.accepted ? `¡Ahora eres amigo de ${res.other}!` : null);
    pushFriends(account);
    if (res.other) pushFriends(Accounts.key(res.other));
  });
  socket.on('friends:remove', d => {
    if (!account || !d) return;
    const res = Accounts.removeFriend(account, d.username);
    friendReply(res, res.other ? `${res.other} ya no es tu amigo` : null);
    pushFriends(account);
    if (res.other) pushFriends(Accounts.key(res.other));
  });
  socket.on('friends:invite', d => {
    if (!account || !d) return;
    const me = Accounts.get(account), fk = Accounts.key(d.username);
    if (!me.friends.includes(fk)) { socket.emit('friends:error', { message: 'Sólo puedes invitar a tus amigos' }); return; }
    const fs = online.get(fk), r = room();
    if (!fs) { socket.emit('friends:error', { message: `${Accounts.displayName(fk)} no está conectado` }); return; }
    if (!r) { socket.emit('friends:error', { message: 'Entra en una sala para invitar' }); return; }
    fs.emit('friends:invited', Object.assign({ from: me.username }, roomSummary(r)));
    socket.emit('friends:ok', { message: `Invitación enviada a ${Accounts.displayName(fk)}` });
  });

  socket.on('rooms:get', () => socket.emit('rooms:list', getRoomsList()));
  socket.on('rooms:list', () => socket.emit('rooms:list', getRoomsList())); // compatibilidad
  socket.on('net:ping', (t, ack) => { if (typeof ack === 'function') ack(t); });

  // Crear sala (validando todas las opciones)
  socket.on('rooms:create', (data) => {
    data = data || {};
    if (Object.keys(rooms).length >= MAX_ROOMS) {
      socket.emit('rooms:error', { message: 'Hay demasiadas salas abiertas. Únete a una existente.' });
      return;
    }
    const host = account ? Accounts.displayName(account) : (data.host || 'Huevo').toString();
    const v = GameRoom.validateSettings(data, { mode: 'ffa', map: 'castle', maxPlayers: 8, name: `Sala de ${host.substring(0, 12)}` });
    const r = createRoom({ name: v.name, map: v.map, mode: v.mode, maxPlayers: v.maxPlayers, scoreLimit: v.scoreLimit, timeLimit: v.timeLimit, isPrivate: !!data.isPrivate, ownerAccount: account });
    broadcastRoomsList();
    socket.emit('rooms:created', { roomId: r.id, code: r.code, name: r.name, isPrivate: r.isPrivate });
  });

  // Unirse a una sala por id o por código
  function handleJoinRoom(data) {
    data = data || {};
    let target = null;
    if (typeof data.code === 'string' && data.code.trim()) {
      const code = data.code.trim().toUpperCase();
      target = Object.values(rooms).find(r => r.code === code) || null;
      if (!target) { socket.emit('rooms:error', { message: `No existe ninguna sala con el código ${code}.` }); return; }
    } else if (data.roomId && rooms[data.roomId]) {
      target = rooms[data.roomId];
    } else if (data.roomId === 'quick' || !data.roomId) {
      // Partida rápida: la sala pública con más gente que tenga hueco (del modo elegido)
      const wantMode = MODES[data.mode] ? data.mode : null;
      target = Object.values(rooms).filter(r => !r.isPrivate && r.getPlayersCount() < r.maxPlayers && (!wantMode || r.config.mode === wantMode))
        .sort((a, b) => b.getPlayersCount() - a.getPlayersCount())[0] || null;
      if (!target && wantMode && Object.keys(rooms).length < MAX_ROOMS) {
        const pool = MapDefs.LIST.filter(m => m.size !== 'S');
        const def = pool[Math.floor(Math.random() * pool.length)];
        target = createRoom({ name: `${def.name} • ${MODES[wantMode].name}`, map: def.id, mode: wantMode, maxPlayers: 12 });
      }
    }
    if (!target) { socket.emit('rooms:error', { message: 'La sala ya no existe. Elige otra.' }); return; }
    if (!account) { socket.emit('rooms:error', { message: 'Inicia sesión para jugar' }); return; }
    if (target.isKicked(account)) { socket.emit('rooms:error', { message: 'Te han expulsado de esa sala. Espera un par de minutos.' }); return; }
    const user = Accounts.get(account);
    if (data.custom) Accounts.saveProfile(account, { custom: data.custom });
    data = Object.assign({}, data, { nickname: user.username, account, custom: user.custom });
    if (target.id !== currentRoomId && target.getPlayersCount() >= target.maxPlayers) {
      socket.emit('rooms:error', { message: 'La sala está completa.' });
      return;
    }
    if (room()) {
      socket.leave(currentRoomId);
      room().handlePlayerDisconnect(socket.id);
    }
    setRoom(target.id);
    socket.join(target.id);
    target.handlePlayerJoin(socket, data);
    broadcastRoomsList();
  }
  socket.on('player:join-room', handleJoinRoom);
  socket.on('player:join', handleJoinRoom);

  socket.on('player:move', (d) => { const r = room(); if (r) r.handlePlayerMove(socket.id, d); });
  socket.on('player:weapon-switch', (d) => { const r = room(); if (r && d) r.handleWeaponSwitch(socket, d.weapon); });
  socket.on('player:shoot', (d) => { const r = room(); if (r) r.handlePlayerShoot(socket, d); });
  socket.on('player:grenade-throw', (d) => { const r = room(); if (r) r.handleGrenadeThrow(socket, d); });
  socket.on('player:rocket', (d) => { const r = room(); if (r) r.handleRocket(socket, d); });
  socket.on('player:melee', (d) => { const r = room(); if (r) r.handleMelee(socket, d); });
  socket.on('player:switch-team', (d) => { const r = room(); if (r) r.handleTeamSwitch(socket, d); });
  socket.on('player:chat', (d) => { const r = room(); if (r && d) r.handlePlayerChat(socket, d.message); });
  socket.on('player:respawn-request', () => { const r = room(); if (r) r.handleRespawnRequest(socket.id); });
  socket.on('player:emote', (d) => { const r = room(); if (r) r.handlePlayerEmote(socket, d && d.emoteType); });

  // Admin de la sala: pausar / reanudar / terminar / empezar / reiniciar / ajustes / expulsar
  let adminTimes = [];
  socket.on('room:admin', d => {
    const r = room();
    if (!r || !d) return;
    const now = Date.now();
    adminTimes = adminTimes.filter(t => now - t < 3000);
    if (adminTimes.length >= 6) return;
    adminTimes.push(now);
    const res = r.handleAdmin(socket.id, d);
    if (res.kick) {
      const ts = io.sockets.sockets.get(res.kick);
      r.handlePlayerDisconnect(res.kick);
      if (ts) {
        ts.leave(r.id);
        const set = roomSetters.get(res.kick);
        if (set) set(null);
        ts.emit('room:kicked', { message: `Te han expulsado de «${r.name}»` });
      }
    }
    socket.emit('room:admin-result', res.error ? { error: res.error } : { ok: res.ok || 'Hecho' });
    broadcastRoomsList();
  });

  socket.on('player:leave-room', () => {
    const r = room();
    if (!r) return;
    socket.leave(currentRoomId);
    r.handlePlayerDisconnect(socket.id);
    setRoom(null);
    broadcastRoomsList();
  });

  socket.on('disconnect', () => {
    roomSetters.delete(socket.id);
    const r = room();
    if (r) r.handlePlayerDisconnect(socket.id);
    currentRoomId = null;
    if (account && online.get(account) === socket) { online.delete(account); accountRoom.delete(account); notifyFriendsOf(account); }
    broadcastRoomsList();
  });
});

process.on('uncaughtException', e => { console.error('[error no capturado]', e && e.stack || e); });
process.on('unhandledRejection', e => { console.error('[promesa rechazada]', e && e.stack || e); });
process.on('SIGINT', () => { Accounts.flush(); process.exit(0); });
process.on('SIGTERM', () => { Accounts.flush(); process.exit(0); });

server.listen(PORT, '0.0.0.0', () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) if (ni.family === 'IPv4' && !ni.internal) ips.push(ni.address);
  }
  console.log('========================================================');
  console.log('  🥚 EGG WARS 3D — SERVIDOR LAN');
  console.log(`  🌐 Local:  http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  📡 LAN:    http://${ip}:${PORT}`));
  console.log(`  🗺️  ${MapDefs.LIST.length} mapas · modos: ${Object.keys(MODES).join(', ')}`);
  console.log('========================================================');
});

module.exports = { rooms, io, server };
