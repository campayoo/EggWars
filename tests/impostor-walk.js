// Huevo Impostor: un "robot" recorre la ÑEMANAVE con las físicas reales del juego
// y el antitrampas del servidor. Falla si hay zonas grandes inalcanzables,
// sitios de los que no se puede salir o correcciones falsas del servidor.
const MapDefs = require('../shared/mapdefs.js');
const Phys = require('../shared/physics.js');
const I = require('../shared/impostor.js');
const AC = require('../server/anticheat.js');
const world = Phys.createWorld(MapDefs.build(I.MAP_ID));
const R = I.RULES, B = I.BOUNDS, CS = 0.5, DIRS = 12;
const key = (x, z) => Math.floor((x - B.x0) / CS) + ',' + Math.floor((z - B.z0) / CS);
const should = new Map();
for (let x = B.x0 + CS / 2; x < B.x1; x += CS) for (let z = B.z0 + CS / 2; z < B.z1; z += CS) {
  if (!Phys.blockedAt(world, x, 0.001, z) && Phys.supportBelow(world, x, z, 0.6) <= 0.6) should.set(key(x, z), [x, z]);
}
const seen = new Map(), q = [], corr = [];
const push = st => { const k = key(st.x, st.z); if (!seen.has(k)) { seen.set(k, [st.x, st.y, st.z]); q.push(k); } };
const s0 = I.seat(0, 10); push(Phys.newState(s0.x, 0, s0.z));
let traps = 0;
while (q.length) {
  const [x, y, z] = seen.get(q.shift());
  let far = 0;
  for (let d = 0; d < DIRS; d++) {
    const yaw = d * Math.PI * 2 / DIRS, st = Phys.newState(x, y, z);
    const p = { x, y, z, mvAt: 0, mvBudget: 5, airY: y, airAt: 0 };
    let now = 1000;
    for (let i = 0; i < 24; i++) {
      Phys.simulate(world, st, { yaw, fwd: R.SPEED_MUL, side: 0, jump: false }, 1 / 60);
      if (i % 3 === 2) { now += 50; const bad = AC.checkMove(p, st.x, st.y, st.z, now, world); if (bad) { corr.push(bad + ' en ' + x.toFixed(1) + ',' + z.toFixed(1)); break; } p.x = st.x; p.y = st.y; p.z = st.z; }
    }
    far = Math.max(far, Math.hypot(st.x - x, st.z - z));
    push(st);
  }
  if (far < 0.8) traps++;
}
const missing = [...should.keys()].filter(k => !seen.has(k));
let fail = false;
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fail = true; };
check(missing.length <= 25, `suelo alcanzable andando: faltan ${missing.length} de ${should.size} celdas (sólo rincones entre muebles)`);
check(traps === 0, `sitios de los que no se puede salir: ${traps}`);
check(corr.length === 0, `correcciones falsas del antitrampas: ${corr.length} ${corr.slice(0, 3).join(' | ')}`);
for (let i = 0; i < 10; i++) { const s = I.seat(i, 10); check(!Phys.blockedAt(world, s.x, 0.001, s.z), `asiento ${i} libre`); }
I.VENTS.forEach(v => check(!Phys.blockedAt(world, v.x, 0.001, v.z), `salida del conducto ${v.id} libre`));
if (fail) { console.log('❌ Huevo Impostor: hay zonas donde uno se queda pillado'); process.exit(1); }
console.log('✅ Huevo Impostor: se puede andar por toda la nave sin atascos');
