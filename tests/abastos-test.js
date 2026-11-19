// Pruebas del Instituto Abastos (v6.7): se suben todas las escaleras, nadie sale del
// edificio y los bots encuentran camino entre las tres plantas.
const MD = require('../shared/mapdefs.js'), Phys = require('../shared/physics.js'), B = require('../server/bots.js');
const d = MD.build('abastos'), w = Phys.createWorld(d), K = d.def.scale || 1;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
// 1) Escaleras: andando recto desde el pie se llega arriba sin quedarse parado
const climb = (x, y, z, yaw, expY) => {
  const st = { x: x * K, y, z: z * K, vx: 0, vy: 0, vz: 0, onGround: false }; let maxY = -9;
  for (let i = 0; i < 300; i++) { Phys.simulate(w, st, { fwd: 1, side: 0, jump: false, yaw }, 1 / 60); maxY = Math.max(maxY, st.y); }
  return Math.abs(maxY - expY) < 0.1;
};
for (const [sx, nm] of [[-25.1, 'oeste'], [25.1, 'este']]) {
  ok(climb(sx, 0, -17.5, Math.PI, 3.8), `escalera norte ${nm}: planta baja → 1ª`);
  ok(climb(sx, 3.8, -17.5, Math.PI, 7.6), `escalera norte ${nm}: 1ª → 2ª`);
  ok(climb(sx, 0, 14.5, 0, 3.8), `escalera sur ${nm}: planta baja → 1ª`);
  ok(climb(sx, 3.8, 14.5, 0, 7.6), `escalera sur ${nm}: 1ª → 2ª`);
}
ok(climb(33.7, 0, -2.6, Math.PI / 2, 3.8), 'escalera principal del acceso: planta baja → 1ª');
// 2) Nadie sale del instituto: recorrido por la rejilla de navegación desde los puntos de aparición
const room = { mapData: d, world: w }, nav = B.navFor(room);
const { N, NN, H, walk, y } = nav, STEP = Phys.P.STEP, seen = new Uint8Array(NN * 4), q = [];
for (const sp of d.spawns) { const c = Math.round(sp.x) + H + (Math.round(sp.z) + H) * N; for (let l = 0; l < 4; l++) { const n = l * NN + c; if (walk[n] && Math.abs(y[n] - sp.y) < 0.5 && !seen[n]) { seen[n] = 1; q.push(n); } } }
for (let i = 0; i < q.length; i++) {
  const n = q[i], c = n % NN, cx = c % N, cz = (c / N) | 0, cy = y[n];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
    for (let l = 0; l < 4; l++) { const m = l * NN + nz * N + nx; if (!walk[m]) break; if (seen[m]) continue; const dy = y[m] - cy; if (dy > STEP + 0.1 || dy < -4.5) continue; seen[m] = 1; q.push(m); }
  }
}
const out = q.filter(n => { const c = n % NN, x = c % N - H, z = ((c / N) | 0) - H; return x < -36 * K || x > 34.5 * K || z < -27 * K || z > 27 * K || (y[n] < 0.5 && x < -34 * K && Math.abs(z) < 19.5 * K); });
ok(out.length === 0, `nadie sale del edificio (${q.length} casillas alcanzables, ${out.length} fuera)`);
const floors = [0, 0, 0]; q.forEach(n => floors[y[n] < 1.5 ? 0 : y[n] < 5.5 ? 1 : 2]++);
ok(floors.every(f => f > 500), `se llega a las tres plantas (${floors.join(' / ')} casillas)`);
// 3) Los bots encuentran camino entre todos los puntos importantes
const pts = d.spawns.map(s => [s.x, s.y, s.z]).concat(d.coops.map(c => [c.x, c.y, c.z]), d.def.bombSites.map(c => [c.x, c.y, c.z]));
let bad = 0; for (const a of pts) for (const b of pts) if (a !== b && !B.findPath(nav, a[0], a[1], a[2], b[0], b[1], b[2], 80000)) bad++;
ok(bad === 0, `caminos entre ${pts.length} puntos de las tres plantas (${bad} sin camino)`);
console.log(fails ? `\n✗ ${fails} fallos` : '\n✅ Instituto Abastos sin problemas');
process.exit(fails ? 1 : 0);
