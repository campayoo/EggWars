// ============================================================================
// public/js/offline.js — MODO SIN CONEXIÓN (v6.2)
//
// Para jugar sin servidor (por ejemplo en GitHub Pages): las salas, el
// anti-trampas y los bots de server/ se ejecutan aquí mismo, en el navegador.
// El juego (main.js) habla con este "servidor local" igual que con socket.io:
// socket.on / socket.emit con los mismos eventos. Nada sale del ordenador.
//
// Lo usa la versión de GitHub Pages (npm run build:pages), que define
// window.EGG_OFFLINE = true y mete en el paquete server/gameRoom.js,
// server/anticheat.js y server/bots.js envueltos con EggOffline.def(...).
// ============================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Mini "require" para los archivos de server/ (CommonJS) en el navegador
  // ---------------------------------------------------------------------------
  const defs = {}, cache = {};
  const GLOBALS = { 'mapdefs.js': 'MapDefs', 'physics.js': 'GamePhysics', 'gamedata.js': 'GameData', 'cosmetics.js': 'Cosmetics', 'mapbuilder.js': 'MapBuilder' };
  function req(spec) {
    const base = String(spec).split('/').pop();
    if (GLOBALS[base]) return window[GLOBALS[base]];
    if (cache[base]) return cache[base].exports;
    if (!defs[base]) throw new Error('Módulo no disponible sin conexión: ' + spec);
    const module = { exports: {} };
    cache[base] = module;
    defs[base](module, module.exports, req);
    return module.exports;
  }
  function def(name, fn) { defs[name] = fn; }

  // ---------------------------------------------------------------------------
  // "Red" en memoria: los mensajes se entregan en orden en la siguiente microtarea
  // ---------------------------------------------------------------------------
  const queue = [];
  let flushing = false;
  function post(fn) {
    queue.push(fn);
    if (flushing) return;
    flushing = true;
    Promise.resolve().then(() => {
      while (queue.length) { const f = queue.shift(); try { f(); } catch (e) { console.error('[sin conexión]', e); } }
      flushing = false;
    });
  }

  // Lado servidor de un socket
  class ServerSocket {
    constructor(io, id, client) { this.io = io; this.id = id; this.client = client; this.handlers = {}; this.rooms = new Set(); }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
    emit(ev, data) { this.client._deliver(ev, data); }
    to(room) { return { emit: (ev, data) => this.io._broadcast(room, ev, data, this) }; }
    join(room) { this.rooms.add(room); }
    leave(room) { this.rooms.delete(room); }
  }
  // io del servidor: io.to(sala).emit(...) — también vale io.to(idDeSocket)
  class LocalIO {
    constructor() { this.sockets = new Map(); }
    to(room) { return { emit: (ev, data) => this._broadcast(room, ev, data, null) }; }
    emit(ev, data) { for (const s of this.sockets.values()) s.emit(ev, data); }
    _broadcast(room, ev, data, except) {
      for (const s of this.sockets.values()) if (s !== except && (s.rooms.has(room) || s.id === room)) s.emit(ev, data);
    }
  }
  // Lado cliente (lo que usa main.js en vez de io())
  class ClientSocket {
    constructor() { this.handlers = {}; this.connected = false; this.id = null; this.server = null; }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
    off(ev, fn) { if (this.handlers[ev]) this.handlers[ev] = fn ? this.handlers[ev].filter(f => f !== fn) : []; return this; }
    emit(ev, ...args) {
      const s = this.server;
      if (!s) return this;
      post(() => (s.handlers[ev] || []).forEach(fn => fn(...args)));
      return this;
    }
    _deliver(ev, data) { post(() => (this.handlers[ev] || []).forEach(fn => fn(data))); }
    disconnect() {}
  }

  // ---------------------------------------------------------------------------
  // Cuenta local (se guarda en este navegador)
  // ---------------------------------------------------------------------------
  const KEY = 'eggwars_offline_profile';
  const newStats = () => ({ kills: 0, deaths: 0, headshots: 0, grenadeKills: 0, wins: 0, games: 0, bestStreak: 0, kw: { rifle: 0, shotgun: 0, sniper: 0 } });
  function loadProfile() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* almacenamiento lleno o bloqueado */ } }
  function makeProfile(name) {
    const C = window.Cosmetics;
    return { username: name, type: 'local', created: Date.now(), custom: Object.assign({}, C && C.DEFAULT), stats: newStats(), eggs: 0, challenges: null };
  }
  const publicProfile = u => ({ username: u.username, type: u.type, custom: u.custom, stats: u.stats, eggs: u.eggs, challenges: u.challenges, created: u.created });
  const NAME_RE = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,14}$/;

  // ---------------------------------------------------------------------------
  // Servidor local: el mismo protocolo que server/server.js (la parte de jugar)
  // ---------------------------------------------------------------------------
  function startServer() {
    const { GameRoom } = req('./gameRoom.js');
    const { MODES } = window.GameData;
    const MapDefs = window.MapDefs;
    const io = new LocalIO();
    const rooms = {};
    let profile = loadProfile();
    const DEF_BOTS = 7;

    const hooks = {
      onKill(killer, target, weapon, headshot) {
        if (!profile) return;
        const s = profile.stats;
        if (killer && killer.account === 'local') {
          s.kills++; s.bestStreak = Math.max(s.bestStreak, killer.streak || 0);
          if (headshot) s.headshots++;
          if (weapon === 'grenade') s.grenadeKills++;
          s.kw[weapon] = (s.kw[weapon] || 0) + 1;
        }
        if (target && target.account === 'local') s.deaths++;
        saveProfile(profile);
      },
      onRoundEnd(players, winnerTeam, winnerId, teams) {
        if (!profile) return;
        const me = players.find(p => p.account === 'local');
        if (!me) return;
        profile.stats.games++;
        if (teams ? (winnerTeam && me.team === winnerTeam) : me.id === winnerId) profile.stats.wins++;
        saveProfile(profile);
      },
    };
    const code = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; return c; };
    function createRoom(opts) {
      const id = opts.id || ('local-' + Date.now().toString(36) + Math.floor(Math.random() * 1000));
      if (rooms[id]) return rooms[id];
      const r = new GameRoom(io, Object.assign({}, opts, { id, code: code(), hooks }));
      rooms[id] = r;
      return r;
    }
    // Salas de bots ya preparadas (se crean al entrar por primera vez: no gastan nada hasta entonces)
    const PRESETS = [
      { id: 'local-castle', name: 'Castle • Todos contra Todos', map: 'castle', mode: 'ffa', maxPlayers: 8 },
      { id: 'local-dirt', name: 'Dirt • Equipos', map: 'dirt', mode: 'tdm', maxPlayers: 10 },
      { id: 'local-alpine', name: 'Nevada • King of the Coop', map: 'alpine', mode: 'kotc', maxPlayers: 8 },
      { id: 'local-shipyard', name: 'Shipyard • Capture the Spatula', map: 'shipyard', mode: 'cts', maxPlayers: 10 },
      { id: 'local-factory', name: 'Fábrica • Todos contra Todos', map: 'factory', mode: 'ffa', maxPlayers: 8 },
    ];
    function presetInfo(p) {
      const m = MODES[p.mode], md = MapDefs.MAPS[p.map];
      return { id: p.id, code: null, name: p.name, map: p.map, mapName: md.name, mode: p.mode, modeName: m.name, playersCount: 0, bots: Math.min(DEF_BOTS, p.maxPlayers - 1),
        maxPlayers: p.maxPlayers, scoreLimit: m.defLimit, timeLimit: 10, state: 'playing', isDefault: true, isPrivate: false };
    }
    function roomsList() {
      const live = Object.values(rooms).filter(r => !r.isPrivate).map(r => r.listInfo());
      const idle = PRESETS.filter(p => !rooms[p.id]).map(presetInfo);
      return live.concat(idle);
    }
    function getRoom(id) {
      if (rooms[id]) return rooms[id];
      const p = PRESETS.find(x => x.id === id);
      return p ? createRoom(Object.assign({ isDefault: true, bots: Math.min(DEF_BOTS, p.maxPlayers - 1), botDifficulty: 'normal' }, p)) : null;
    }
    // Las salas creadas por el jugador desaparecen al salir (paran sus temporizadores)
    function cleanup() {
      for (const id in rooms) {
        const r = rooms[id];
        if (r.humanCount() === 0) { r.destroy(); delete rooms[id]; }
      }
    }

    function connect(client) {
      const sid = 'you-' + Math.random().toString(36).slice(2, 8);
      const socket = new ServerSocket(io, sid, client);
      client.server = socket; client.id = sid; client.connected = true;
      io.sockets.set(sid, socket);
      let currentRoomId = null;
      const room = () => (currentRoomId && rooms[currentRoomId]) || null;
      const on = (ev, fn) => socket.on(ev, (...a) => { try { fn(...a); } catch (e) { console.error('[sin conexión ' + ev + ']', e); } });

      // ---- Cuenta (sin contraseñas: todo se queda en este navegador) ----
      const ok = () => socket.emit('auth:ok', { token: 'offline', profile: publicProfile(profile) });
      const login = d => {
        const name = String((d && (d.username || d.name)) || '').trim();
        if (!profile || (name && name !== profile.username)) {
          if (!NAME_RE.test(name)) { socket.emit('auth:error', { message: 'Elige un nombre de 3 a 14 letras o números' }); return; }
          profile = profile ? Object.assign(profile, { username: name }) : makeProfile(name);
          saveProfile(profile);
        }
        ok();
      };
      on('auth:token', () => { if (profile) ok(); else socket.emit('auth:error', { message: 'Elige un nombre para jugar sin conexión' }); });
      on('auth:login', login); on('auth:register', login); on('auth:ip', login);
      on('auth:logout', () => { if (room()) { room().handlePlayerDisconnect(sid); socket.leave(currentRoomId); currentRoomId = null; cleanup(); } });
      on('auth:setPassword', () => socket.emit('auth:pwResult', { error: 'Sin conexión no hay contraseñas: tu perfil se guarda en este navegador' }));
      on('profile:get', () => { if (profile) socket.emit('profile:data', publicProfile(profile)); });
      on('profile:save', d => {
        if (!profile || !d) return;
        if (d.custom && window.Cosmetics) profile.custom = window.Cosmetics.sanitize(d.custom);
        if (typeof d.eggs === 'number' && isFinite(d.eggs) && d.eggs >= 0) profile.eggs = Math.min(1e7, Math.floor(d.eggs));
        if (d.challenges && typeof d.challenges === 'object') profile.challenges = d.challenges;
        saveProfile(profile);
      });

      // ---- Amigos: no hay sin conexión ----
      const noFriends = () => socket.emit('friends:error', { message: 'Sin conexión no hay amigos: para jugar juntos usad el servidor de la red local (npm start)' });
      ['friends:request', 'friends:respond', 'friends:remove', 'friends:invite'].forEach(ev => on(ev, noFriends));

      // ---- Salas ----
      on('rooms:get', () => socket.emit('rooms:list', roomsList()));
      on('rooms:list', () => socket.emit('rooms:list', roomsList()));
      on('net:ping', (t, ack) => { if (typeof ack === 'function') post(() => ack(t)); });
      on('rooms:create', data => {
        data = data || {};
        const v = GameRoom.validateSettings(data, { mode: 'ffa', map: 'castle', maxPlayers: 8, name: `Sala de ${profile ? profile.username : 'Huevo'}` });
        const r = createRoom({ name: v.name, map: v.map, mode: v.mode, maxPlayers: v.maxPlayers, scoreLimit: v.scoreLimit, timeLimit: v.timeLimit,
          isPrivate: !!data.isPrivate, ownerAccount: 'local', bots: data.bots === undefined ? Math.min(DEF_BOTS, v.maxPlayers - 1) : v.bots, botDifficulty: v.botDifficulty });
        socket.emit('rooms:created', { roomId: r.id, code: r.code, name: r.name, isPrivate: r.isPrivate });
      });
      function join(data) {
        data = data || {};
        if (!profile) { socket.emit('rooms:error', { message: 'Elige un nombre para jugar' }); return; }
        let target = null;
        if (typeof data.code === 'string' && data.code.trim()) {
          const c = data.code.trim().toUpperCase();
          target = Object.values(rooms).find(r => r.code === c) || null;
          if (!target) { socket.emit('rooms:error', { message: `Sin conexión sólo existen tus propias salas (no hay ninguna con el código ${c}).` }); return; }
        } else if (data.roomId && data.roomId !== 'quick') {
          target = getRoom(data.roomId);
        } else {
          // Partida rápida: un mapa al azar del modo elegido, con bots
          const mode = MODES[data.mode] ? data.mode : ['ffa', 'tdm', 'kotc', 'cts'][Math.floor(Math.random() * 4)];
          const pool = MapDefs.LIST.filter(m => m.size !== 'S');
          const md = pool[Math.floor(Math.random() * pool.length)];
          target = createRoom({ name: `${md.name} • ${MODES[mode].name}`, map: md.id, mode, maxPlayers: 8, bots: DEF_BOTS, botDifficulty: 'normal', ownerAccount: 'local' });
        }
        if (!target) { socket.emit('rooms:error', { message: 'La sala ya no existe. Elige otra.' }); return; }
        if (data.impostor) { socket.emit('rooms:error', { message: 'Huevo Impostor necesita el servidor de la red local (npm start).' }); return; }
        if (data.custom && window.Cosmetics) { profile.custom = window.Cosmetics.sanitize(data.custom); saveProfile(profile); }
        if (room() && room() !== target) { room().handlePlayerDisconnect(sid); socket.leave(currentRoomId); }
        currentRoomId = target.id;
        socket.join(target.id);
        target.handlePlayerJoin(socket, Object.assign({}, data, { nickname: profile.username, account: 'local', custom: profile.custom }));
        cleanup();
      }
      on('player:join-room', join); on('player:join', join);

      // ---- En partida: exactamente las mismas llamadas que en server.js ----
      on('player:move', d => { const r = room(); if (r) r.handlePlayerMove(sid, d); });
      on('player:weapon-switch', d => { const r = room(); if (r && d) r.handleWeaponSwitch(socket, d.weapon); });
      on('player:reload', () => { const r = room(); if (r) r.handleReload(socket); });
      on('player:shoot', d => { const r = room(); if (r) r.handlePlayerShoot(socket, d); });
      on('player:grenade-throw', d => { const r = room(); if (r) r.handleGrenadeThrow(socket, d); });
      on('player:rocket', d => { const r = room(); if (r) r.handleRocket(socket, d); });
      on('player:melee', d => { const r = room(); if (r) r.handleMelee(socket, d); });
      on('player:switch-team', d => { const r = room(); if (r) r.handleTeamSwitch(socket, d); });
      on('player:chat', d => { const r = room(); if (r && d) r.handlePlayerChat(socket, d.message); });
      on('player:respawn-request', () => { const r = room(); if (r) r.handleRespawnRequest(sid); });
      on('player:emote', d => { const r = room(); if (r) r.handlePlayerEmote(socket, d && d.emoteType); });
      on('room:admin', d => {
        const r = room(); if (!r || !d) return;
        const res = r.handleAdmin(sid, d);
        if (res.kick) r.handlePlayerDisconnect(res.kick);   // sin conexión sólo se puede expulsar a bots
        socket.emit('room:admin-result', res.error ? { error: res.error } : { ok: res.ok || 'Hecho' });
      });
      on('player:leave-room', () => {
        const r = room(); if (!r) return;
        socket.leave(currentRoomId); r.handlePlayerDisconnect(sid); currentRoomId = null;
        cleanup();
      });
      ['imp:rooms', 'imp:act', 'imp:create'].forEach(ev => on(ev, () => socket.emit('rooms:error', { message: 'Huevo Impostor necesita el servidor de la red local (npm start).' })));

      // Conectado
      client._deliver('connect');
      socket.emit('rooms:list', roomsList());
    }
    return { connect, rooms };
  }

  let server = null;
  window.EggOffline = {
    def,
    require: req,
    /** Devuelve un socket local con la misma API que io() */
    connect() {
      if (!server) server = startServer();
      const c = new ClientSocket();
      setTimeout(() => server.connect(c), 0);
      return c;
    },
  };
})();
