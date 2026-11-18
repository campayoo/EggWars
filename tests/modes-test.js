// Prueba de lo nuevo de la 6.5: Demolición, Yema Confirmada, hueveras y skins
// Uso: node tests/modes-test.js
'use strict';
let seed = 7;
Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let now = 1e12; const timers = [];
Date.now = () => now;
global.setInterval = (fn, ms) => { const t = { fn, ms, next: now + ms }; timers.push(t); return t; };
global.clearInterval = t => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };
const C = require('../shared/cosmetics.js');
const { GameRoom } = require('../server/gameRoom.js');
let fails = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { fails++; console.log('  ✗ ' + m); } };

console.log('■ Hueveras y skins');
ok(C.LOOT.length >= 30, `hay ${C.LOOT.length} objetos que pueden tocar`);
const s1 = C.sanitize({ hat: 'santa', wskins: { rifle: 'gold', pistol: 'arctic', 'x<y': 'gold' } }, ['w:gold']);
ok(s1.hat === 'none', 'un gorro bloqueado que no tienes vuelve a "ninguno"');
ok(s1.wskins.rifle === 'gold' && !s1.wskins.pistol, 'sólo se quedan las skins de arma desbloqueadas');
ok(!Object.keys(s1.wskins).some(k => !/^[a-z]+$/.test(k)), 'nombres de arma raros se descartan');
ok(C.sanitize({ hat: 'santa' }).hat === 'santa', 'sin lista de desbloqueos (otros jugadores) se respeta lo que llevan');
ok(C.sanitizeUnlocks(['w:gold', 'w:gold', 'hat:santa', 'nada', 5]).length === 2, 'la lista de desbloqueos se limpia y sin repetidos');
const cnt = { comun: 0, rara: 0, epica: 0, legendaria: 0 };
for (let i = 0; i < 20000; i++) cnt[C.rollCrate('basic').rarity]++;
ok(Math.abs(cnt.legendaria / 20000 - 0.02) < 0.006 && Math.abs(cnt.comun / 20000 - 0.55) < 0.02, `probabilidades de la huevera (${JSON.stringify(cnt)})`);
const g = { comun: 0 }; for (let i = 0; i < 2000; i++) if (C.rollCrate('golden').rarity === 'comun') g.comun++;
ok(g.comun === 0, 'la huevera dorada nunca da comunes');

function play(mode, map, secs) {
  const ev = {};
  const io = { to: () => ({ emit: (e, d) => { const k = e + (d && d.type ? ':' + d.type : ''); ev[k] = (ev[k] || 0) + 1; } }) };
  const room = new GameRoom(io, { id: 'r', code: 'T', map, mode, maxPlayers: 10, timeLimit: 0, scoreLimit: 99, bots: 9, botDifficulty: 'normal' });
  room.handlePlayerJoin({ id: 'human', emit() {}, to: () => ({ emit() {} }) }, { nickname: 'Yo', weapon: 'rifle' });
  const t0 = now;
  while (now - t0 < secs * 1000) { now += 1000 / 30; room.players.human.alive = false; room.players.human.respawnAt = null; for (const t of timers.slice()) while (t.next <= now) { t.fn(); t.next += t.ms; } }
  const scores = Object.assign({}, room.teamScores); room.destroy();
  return { ev, scores };
}
for (const map of ['abastos', 'pruebas']) {
  console.log(`■ Demolición en ${map}`);
  const r = play('dem', map, 420);
  ok(r.ev['dem:event:planted'] > 0, `los bots plantan la bomba (${r.ev['dem:event:planted'] || 0})`);
  ok(r.ev['dem:event:boom'] > 0, `la bomba explota (${r.ev['dem:event:boom'] || 0})`);
  ok(r.ev['dem:event:roundWon'] > 0 && r.ev['dem:event:round'] > 0, `se ganan rondas y se cambia de bando (${r.ev['dem:event:roundWon'] || 0} rondas)`);
  ok(r.scores.red + r.scores.blue === r.ev['dem:event:roundWon'], 'el marcador cuenta rondas ganadas');
  console.log(`■ Yema Confirmada en ${map}`);
  const c = play('conf', map, 120);
  ok(c.ev['conf:event:confirmed'] > 0 && c.ev['conf:event:denied'] > 0, `se confirman (${c.ev['conf:event:confirmed'] || 0}) y se niegan (${c.ev['conf:event:denied'] || 0}) yemas`);
  ok(c.scores.red + c.scores.blue === c.ev['conf:event:confirmed'], 'sólo las yemas confirmadas suman al equipo');
}
console.log(fails ? `\n✗ ${fails} fallos` : '\n✅ Modos nuevos, hueveras y skins: todo bien');
process.exit(fails ? 1 : 0);
