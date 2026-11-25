// Pruebas del Instituto Abastos: se suben todas las escaleras, se salta de las galerías a los
// patios, nadie sale del edificio ni se teletransporta y los bots van de una planta a otra.
const MD = require('../shared/mapdefs.js'), Phys = require('../shared/physics.js'), B = require('../server/bots.js');
const d = MD.build('abastos'), w = Phys.createWorld(d), PL = d.def.plan;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const inside = (x, z) => (x > PL.X[0] && x < 37 && Math.abs(z) < PL.Z) || (x >= 37 && x < PL.X[1] && Math.abs(z) < 30.5);
const run = (x, y, z, inputAt, n) => { const st = { x, y, z, vx: 0, vy: 0, vz: 0, onGround: false }; let maxY = -9; for (let i = 0; i < (n || 300); i++) { Phys.simulate(w, st, inputAt(i), 1 / 60); maxY = Math.max(maxY, st.y); } st.maxY = maxY; return st; };
// 1) Escaleras: andando recto desde el pie se llega arriba
const climb = (x, y, z, yaw, expY) => Math.abs(run(x, y, z, () => ({ fwd: 1, yaw })).maxY - expY) < 0.1;
for (const side of ['w', 'e']) {
  const sx = (PL.STX[side][0] + PL.STX[side][1]) / 2, nm = side === 'w' ? 'oeste' : 'este';
  const [[na], [, sb]] = PL.FL;
  ok(climb(sx, 0, na - 0.45, Math.PI, PL.P1), `escalera norte ${nm}: planta baja → 1ª`);
  ok(climb(sx, PL.P1, na - 0.8, Math.PI, PL.P2), `escalera norte ${nm}: 1ª → 2ª`);
  ok(climb(sx, 0, sb + 0.45, 0, PL.P1), `escalera sur ${nm}: planta baja → 1ª`);
  ok(climb(sx, PL.P1, sb + 0.8, 0, PL.P2), `escalera sur ${nm}: 1ª → 2ª`);
}
ok(climb(PL.MS.x1 + 0.8, 0, PL.MS.z, Math.PI / 2, PL.P1), 'escalera principal del vestíbulo: planta baja → 1ª');
PL.CST.forEach(([x, z, yaw], i) => ok(climb(x, PL.P1, z, yaw, PL.P2), `escalera del bloque central ${i ? 'este' : 'oeste'}: 1ª → 2ª`));
// 2) Desde las galerías de la 2ª planta se salta al patio
for (const [x, z, yaw, nm] of [[5, -26, Math.PI, 'patio Cavanilles desde la galería norte'], [-6, 9, Math.PI, 'patio Sánchez Ayuso desde la galería central'], [6, -9, 0, 'patio Cavanilles desde la galería central'], [6, 26, 0, 'patio Sánchez Ayuso desde la galería sur'], [-35, -13, -Math.PI / 2, 'patio Cavanilles desde el pasillo oeste']]) {
  const st = run(x, PL.P2, z, i => ({ fwd: i < 90 ? 1 : 0, yaw, jump: i < 60 && i % 20 === 0 }));
  ok(Math.abs(st.y - PL.P1) < 0.2, `salto al ${nm} (acaba a ${st.y.toFixed(2)} m)`);
}
// 3) Nadie atraviesa paredes, se teletransporta ni sale andando y saltando al azar
{
  let seed = 3, esc = 0; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const starts = d.spawns.concat(d.teamSpawns.red, d.teamSpawns.blue);
  for (let r = 0; r < 160; r++) {
    const s = starts[r % starts.length], st = { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, onGround: false }; let inp = {};
    for (let t = 0; t < 1500; t++) {
      if (t % 40 === 0) inp = { yaw: rnd() * 6.28, fwd: rnd() < 0.85 ? 1 : 0, side: rnd() < 0.3 ? (rnd() < 0.5 ? 1 : -1) : 0 };
      inp.jump = rnd() < 0.08;
      const px = st.x, pz = st.z; Phys.simulate(w, st, inp, 1 / 60);
      if (Math.hypot(st.x - px, st.z - pz) > 1 || !inside(st.x, st.z) || st.y > PL.P2 + 4) { esc++; break; }
    }
  }
  ok(esc === 0, 'jugadores al azar: ninguno se teletransporta ni sale del edificio (' + esc + ')');
}
// 4) Los puntos de aparición están en el suelo y libres
ok(d.spawns.concat(d.teamSpawns.red, d.teamSpawns.blue).every(s => !Phys.blockedAt(w, s.x, s.y + 0.05, s.z) && inside(s.x, s.z)), 'puntos de aparición libres y dentro del instituto');
const room = { mapData: d, world: w }, nav = B.navFor(room);
const { N, NN, H, walk, y } = nav, STEP = Phys.P.STEP, seen = new Uint8Array(NN * 4), q = [];
for (const sp of d.spawns) { const c = Math.round(sp.x) + H + (Math.round(sp.z) + H) * N; for (let l = 0; l < 4; l++) { const n = l * NN + c; if (walk[n] && Math.abs(y[n] - sp.y) < 0.5 && !seen[n]) { seen[n] = 1; q.push(n); } } }
for (let i = 0; i < q.length; i++) {
  const n = q[i], c = n % NN, cx = c % N, cz = (c / N) | 0, cy = y[n];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
    for (let l = 0; l < 4; l++) { const m = l * NN + nz * N + nx; if (!walk[m]) break; if (seen[m]) continue; const dy = y[m] - cy; if (dy > STEP + 0.1 || dy < -5) continue; seen[m] = 1; q.push(m); }
  }
}
const out = q.filter(n => { const c = n % NN, x = c % N - H, z = ((c / N) | 0) - H; return !inside(x, z); });
ok(out.length === 0, `nadie sale del edificio (${q.length} casillas alcanzables, ${out.length} fuera)`);
const floors = [0, 0, 0]; q.forEach(n => floors[y[n] < 2 ? 0 : y[n] < 6.5 ? 1 : 2]++);
ok(floors.every(f => f > 500), `se llega a las tres plantas (${floors.join(' / ')} casillas)`);
// 3) Los bots encuentran camino entre todos los puntos importantes
const pts = d.spawns.map(s => [s.x, s.y, s.z]).concat(d.coops.map(c => [c.x, c.y, c.z]), d.def.bombSites.map(c => [c.x, c.y, c.z]), d.grenadePacks.map(c => [c.x, c.y, c.z]));
let bad = 0; for (const a of pts) for (const b of pts) if (a !== b && !B.findPath(nav, a[0], a[1], a[2], b[0], b[1], b[2], 80000)) bad++;
ok(bad === 0, `caminos entre ${pts.length} puntos de las tres plantas (${bad} sin camino)`);
console.log(fails ? `\n✗ ${fails} fallos` : '\n✅ Instituto Abastos sin problemas');
process.exit(fails ? 1 : 0);
