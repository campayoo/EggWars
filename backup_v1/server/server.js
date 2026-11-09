// ============================================================================
// server/server.js — Servidor Express, Socket.io y Server Browser (Gestión Multi-Salas)
// ============================================================================

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const { GameRoom } = require('./gameRoom');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 2000,
  pingTimeout: 5000,
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Registro de salas activas { roomId: GameRoom }
const rooms = {};

// Crear salas por defecto
function createDefaultRooms() {
  createRoom('room-dirt-1', 'Arena Dirt Oficial #1', 'dirt', 'ffa', 12);
  createRoom('room-feedlot-1', 'Feedlot Militar (Oficial)', 'feedlot', 'ffa', 10);
  createRoom('room-castle-1', 'Ruinas del Castillo (TDM)', 'castle', 'tdm', 10);
  createRoom('room-space-1', 'Estación Orbital Gravedad Baja', 'space', 'ffa', 8);
  createRoom('room-fort-1', 'Duelo en el Fuerte (TDM)', 'fort', 'tdm', 10);
}

function createRoom(id, name, map = 'dirt', mode = 'ffa', maxPlayers = 8) {
  if (rooms[id]) return rooms[id];
  const room = new GameRoom(io, id, name, map, mode, maxPlayers);
  rooms[id] = room;
  return room;
}

function getRoomsList() {
  const list = [];
  for (const id in rooms) {
    const r = rooms[id];
    list.push({
      id: r.id,
      name: r.name,
      map: r.config.map,
      mapName: r.getMapData().name,
      mode: r.config.mode,
      playersCount: r.getPlayersCount(),
      maxPlayers: r.maxPlayers,
    });
  }
  return list;
}

function broadcastRoomsList() {
  io.emit('rooms:list', getRoomsList());
}

createDefaultRooms();

// Enrutador de eventos WebSocket
io.on('connection', (socket) => {
  // Al conectarse enviar la lista de salas
  socket.emit('rooms:list', getRoomsList());

  let currentRoomId = null;

  // Solicitar lista de salas
  socket.on('rooms:get', () => {
    socket.emit('rooms:list', getRoomsList());
  });

  // Crear una nueva sala
  socket.on('rooms:create', (data) => {
    const name = (data && data.name ? data.name.trim() : 'Partida de Huevo').substring(0, 24) || 'Partida de Huevo';
    const map = (data && data.map) || 'dirt';
    const mode = (data && data.mode) || 'ffa';
    const maxPlayers = Math.max(2, Math.min(16, parseInt(data && data.maxPlayers, 10) || 8));
    const id = 'room-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const room = createRoom(id, name, map, mode, maxPlayers);
    broadcastRoomsList();

    socket.emit('rooms:created', { roomId: id });
  });

  // Unirse a una sala específica
  socket.on('player:join-room', (data) => {
    handleJoinRoom(data);
  });

  // Compatibilidad: evento 'player:join' directo
  socket.on('player:join', (data) => {
    handleJoinRoom(data);
  });

  function handleJoinRoom(data) {
    const roomId = data && data.roomId;
    const targetRoom = rooms[roomId] || rooms[currentRoomId] || rooms['room-dirt-1'] || Object.values(rooms)[0];

    if (!targetRoom) {
      socket.emit('rooms:error', { message: 'La sala seleccionada no existe.' });
      return;
    }

    if (targetRoom.getPlayersCount() >= targetRoom.maxPlayers) {
      socket.emit('rooms:error', { message: 'La sala está completa.' });
      return;
    }

    // Salir de la sala previa si la hubiera
    if (currentRoomId && rooms[currentRoomId] && currentRoomId !== targetRoom.id) {
      socket.leave(currentRoomId);
      rooms[currentRoomId].handlePlayerDisconnect(socket.id);
    }

    currentRoomId = targetRoom.id;
    socket.join(targetRoom.id);
    targetRoom.handlePlayerJoin(socket, data);

    broadcastRoomsList();
  }

  // Movimiento
  socket.on('player:move', (data) => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].handlePlayerMove(socket.id, data);
    }
  });

  // Cambio de arma
  socket.on('player:weapon-switch', (data) => {
    if (currentRoomId && rooms[currentRoomId] && data && data.weapon) {
      rooms[currentRoomId].handleWeaponSwitch(socket, data.weapon);
    }
  });

  // Disparo
  socket.on('player:shoot', (data) => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].handlePlayerShoot(socket, data);
    }
  });

  // Granada
  socket.on('player:grenade-throw', (data) => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].handleGrenadeThrow(socket, data);
    }
  });

  // Chat
  socket.on('player:chat', (data) => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].handlePlayerChat(socket, data.message);
    }
  });

  // Emote
  socket.on('player:emote', (data) => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].handlePlayerEmote(socket, data.emoteType);
    }
  });

  // Salir de la sala hacia el Lobby
  socket.on('player:leave-room', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      socket.leave(currentRoomId);
      rooms[currentRoomId].handlePlayerDisconnect(socket.id);
      currentRoomId = null;
      broadcastRoomsList();
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].handlePlayerDisconnect(socket.id);
      currentRoomId = null;
      broadcastRoomsList();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log('  🥚 SHELL SHOCKERS 3D — SERVER BROWSER & LOBBY SYSTEM');
  console.log(`  🌐 Local:  http://localhost:${PORT}`);
  console.log(`  📡 Puerto: ${PORT} (Multi-Salas y Partidas en LAN)`);
  console.log('========================================================');
});
