// Lanza miles de mensajes basura a todas las funciones del servidor en los 15 mapas y 4 modos: no debe fallar nada
const { GameRoom } = require('../server/gameRoom.js');
const emitted = [];
const fakeIo = { to: () => ({ emit: (e, d) => emitted.push(e) }), emit: () => {} };
const sock = id => ({ id, emit: () => {}, to: () => ({ emit: () => {} }), join: () => {}, leave: () => {} });
const junk = [null, undefined, 0, -1, 1e308, NaN, Infinity, 'x', '', [], [1, 2, 3], {}, { x: 'a' }, { targets: 'a' }, { targets: [{ id: 5, p: 'zz' }] },
  { targets: [{ id: 'p2', p: [1e9, NaN, 'a'] }] }, { targets: new Array(500).fill({ id: 'p2', p: [0, 1, 0] }) }, { x: 1e9, y: -1e9, z: NaN },
  { dirX: 'a', dirY: null, dirZ: 1e300, power: -5 }, { dx: 0, dy: 0, dz: 0 }, { weapon: 'constructor' }, { weapon: '__proto__' }, { targetId: '__proto__' },
  { action: 'kick', id: 'p1' }, { message: 'x'.repeat(10000) }, { emoteType: {} }, { team: 'green' }, true, false];
let errors = 0;
for (const map of require('../shared/mapdefs.js').LIST.map(m => m.id)) for (const mode of ['ffa', 'tdm', 'kotc', 'cts']) {
  const r = new GameRoom(fakeIo, { id: 'f', code: 'FFFF', name: 'f', map, mode, timeLimit: 0 });
  r.handlePlayerJoin(sock('p1'), { nickname: 'A' }); r.handlePlayerJoin(sock('p2'), { nickname: 'B' });
  r.state = 'playing';
  const calls = [
    d => r.handlePlayerMove('p1', d), d => r.handlePlayerShoot(sock('p1'), d), d => r.handleGrenadeThrow(sock('p1'), d),
    d => r.handleRocket(sock('p1'), d), d => r.handleMelee(sock('p1'), d), d => r.handleWeaponSwitch(sock('p1'), d && d.weapon !== undefined ? d.weapon : d),
    d => r.handleReload(sock('p1'), d), d => r.handleTeamSwitch && r.handleTeamSwitch(sock('p1'), d), d => r.handlePlayerChat && r.handlePlayerChat(sock('p1'), d && d.message),
    d => r.handlePlayerEmote && r.handlePlayerEmote(sock('p1'), d && d.emoteType), d => r.handleRespawnRequest('p1'),
    d => r.handleAdmin && r.handleAdmin(sock('p1'), d),
  ];
  for (const f of calls) for (const d of junk) {
    try { f(d); } catch (e) { errors++; if (errors < 8) console.log('ERROR', map, mode, f.toString().slice(6, 60), JSON.stringify(d) && JSON.stringify(d).slice(0, 60), e.message); }
  }
  for (let i = 0; i < 20; i++) { try { r.tick(); } catch (e) { errors++; if (errors < 8) console.log('TICK ERROR', map, mode, e.message); } }
  const p1 = r.players.p1;
  if (p1 && (!isFinite(p1.x) || !isFinite(p1.y) || !isFinite(p1.z))) { errors++; console.log('POS NaN', map, mode); }
  r.destroy();
}
console.log(errors ? '✗ ' + errors + ' errores con datos basura' : 'Servidor robusto: 0 errores con datos basura');
process.exit(errors ? 1 : 0);
