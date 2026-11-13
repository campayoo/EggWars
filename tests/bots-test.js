// Prueba de los bots (v6.2): en varias salas con reloj virtual, los bots deben moverse,
// disparar y conseguir bajas, y el anti-trampas del servidor NUNCA debe corregirles
// (juegan con las mismas reglas que una persona).
// Uso: node tests/bots-test.js [segundos]
'use strict';
// Azar con semilla fija: la prueba da siempre el mismo resultado
let seed = 20261113;
Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let now = 1e12;
const timers = [];
Date.now = () => now;
global.setInterval = (fn, ms) => { const t = { fn, ms, next: now + ms }; timers.push(t); return t; };
global.clearInterval = t => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };
const { GameRoom } = require('../server/gameRoom.js');

const SECS = +(process.argv[2] || 60);
const CASES = [['castle', 'ffa'], ['temple', 'cts'], ['alpine', 'kotc'], ['factory', 'tdm'], ['nemanave', 'ffa']];
let fails = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { fails++; console.log('  ✗ ' + m); } };

for (const [map, mode] of CASES) {
  const ev = { kills: 0, corr: 0, shots: 0 };
  const io = { to: id => ({ emit: (e, d) => {
    if (e === 'player:killed') ev.kills++;
    if (e === 'player:shot-fired' || e === 'rocket:fired') ev.shots++;
    if (e === 'you:correct' && String(id).startsWith('bot-')) ev.corr++;
  } }) };
  const room = new GameRoom(io, { id: 'r', code: 'TEST', map, mode, maxPlayers: 8, timeLimit: 0, scoreLimit: 999, bots: 7, botDifficulty: 'normal' });
  // Un jugador de verdad (sin él los bots no gastan CPU); se queda fuera de juego
  room.handlePlayerJoin({ id: 'human', emit() {}, to: () => ({ emit() {} }) }, { nickname: 'Yo', weapon: 'rifle' });
  const h = room.players.human;
  const dist = {}, last = {};
  const t0 = now;
  while (now - t0 < SECS * 1000) {
    now += 1000 / 30;
    h.alive = false; h.respawnAt = null;
    for (const t of timers.slice()) while (t.next <= now) { t.fn(); t.next += t.ms; }
    for (const id in room.players) {
      const p = room.players[id];
      if (!p.bot || !p.alive) continue;
      if (last[id]) dist[id] = (dist[id] || 0) + Math.hypot(p.x - last[id].x, p.z - last[id].z);
      last[id] = { x: p.x, z: p.z };
    }
  }
  console.log(`■ ${map} (${mode})`);
  ok(room.botCount() === 7, `7 bots en la sala (hay ${room.botCount()})`);
  ok(room.humanCount() === 1 && room.listInfo().playersCount === 1, 'los bots no cuentan como jugadores en la lista de salas');
  ok(ev.shots > 10, `disparan (${ev.shots} disparos)`);
  ok(ev.kills > 0, `consiguen bajas (${ev.kills})`);
  const moving = Object.values(dist).filter(d => d > SECS * 0.8).length;
  ok(moving >= 5, `se mueven por el mapa (${moving} de 7 recorren más de ${Math.round(SECS * 0.8)} m)`);
  ok(ev.corr === 0, `el anti-trampas no tiene que corregirles (${ev.corr})`);
  // Un jugador nuevo ocupa la plaza de un bot si la sala está llena
  room.handlePlayerJoin({ id: 'human2', emit() {}, to: () => ({ emit() {} }) }, { nickname: 'Otro', weapon: 'rifle' });
  ok(room.getPlayersCount() <= 8 && room.botCount() === 6, 'un jugador que entra en una sala llena echa a un bot');
  room.handlePlayerDisconnect('human2');
  ok(room.botCount() === 7, 'cuando se va, el bot vuelve');
  room.destroy();
}
console.log(fails ? `\n✗ ${fails} fallos en los bots` : '\n✅ Bots: se mueven, disparan y respetan el anti-trampas');
process.exit(fails ? 1 : 0);
