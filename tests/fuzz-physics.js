// Fuzz de físicas: muchos jugadores con entradas aleatorias en cada mapa.
// Detecta salidas del mapa, caídas a través del suelo, quedarse dentro de paredes y NaN.
// Uso: node tests/fuzz-physics.js [segundos]
const MapDefs = require('../shared/mapdefs.js');
const Phys = require('../shared/physics.js');
const SECS = +(process.argv[2] || 40);
let fails = 0;
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }


for (const def of MapDefs.LIST) {
  const data = MapDefs.build(def.id);
  const w = Phys.createWorld(data);
  const R = rng(def.id.length * 7919 + 13);
  const issues = {};
  const note = (k, m) => { issues[k] = issues[k] || { n: 0, ex: m }; issues[k].n++; };
  const spawns = data.spawns.concat(data.teamSpawns.red, data.teamSpawns.blue);
  const AGENTS = 30, dt = 1 / 60;
  for (let a = 0; a < AGENTS; a++) {
    const s = spawns[a % spawns.length];
    const st = Phys.newState(s.x, s.y, s.z);
    let input = { fwd: 1, side: 0, yaw: R() * 6.28, jump: false };
    let blockedFrames = 0;
    for (let t = 0; t < SECS; t += dt) {
      if (R() < 0.03) input = { fwd: R() < 0.8 ? 1 : (R() < 0.5 ? -1 : 0), side: R() < 0.3 ? (R() < 0.5 ? -1 : 1) : 0, yaw: R() * 6.28, jump: R() < 0.35 };
      if (R() < 0.02) input.jump = !input.jump;
      Phys.simulate(w, st, input, dt);
      if (!isFinite(st.x) || !isFinite(st.y) || !isFinite(st.z)) { note('nan', `agente ${a}`); break; }
      const lim = data.halfSize - Phys.P.RADIUS + 1e-6;
      if (Math.abs(st.x) > lim || Math.abs(st.z) > lim) note('bounds', `(${st.x.toFixed(2)},${st.z.toFixed(2)})`);
      if (data.ground && st.y < -0.05) note('floor', `y=${st.y.toFixed(2)} en (${st.x.toFixed(1)},${st.z.toFixed(1)})`);
      if (st.y > 40) note('sky', `y=${st.y.toFixed(1)}`);
      if (Phys.blockedAt(w, st.x, st.y + 0.0005, st.z)) { if (++blockedFrames > 20) note('stuck', `(${st.x.toFixed(2)},${st.y.toFixed(2)},${st.z.toFixed(2)})`); } else blockedFrames = 0;
      // ¿Fuera del recinto visible? (al otro lado de un muro perimetral)
      for (const b of data.boxes) {
        if (!b.vis || b.maxY - b.minY < 1.5) continue;
        const longX = b.maxX - b.minX > data.halfSize * 1.2, longZ = b.maxZ - b.minZ > data.halfSize * 1.2;
        if (longX && b.minZ < -data.halfSize + 3 && st.z < b.minZ - 0.05 && st.y < b.maxY) note('outside', `tras el muro norte en (${st.x.toFixed(1)},${st.y.toFixed(1)},${st.z.toFixed(2)})`);
        if (longX && b.maxZ > data.halfSize - 3 && st.z > b.maxZ + 0.05 && st.y < b.maxY) note('outside', `tras el muro sur en (${st.x.toFixed(1)},${st.y.toFixed(1)},${st.z.toFixed(2)})`);
        if (longZ && b.minX < -data.halfSize + 3 && st.x < b.minX - 0.05 && st.y < b.maxY) note('outside', `tras el muro oeste en (${st.x.toFixed(2)},${st.y.toFixed(1)},${st.z.toFixed(1)})`);
        if (longZ && b.maxX > data.halfSize - 3 && st.x > b.maxX + 0.05 && st.y < b.maxY) note('outside', `tras el muro este en (${st.x.toFixed(2)},${st.y.toFixed(1)},${st.z.toFixed(1)})`);
      }
    }
  }
  // Prueba dirigida: subirse a cada superficie alta cerca del borde y saltar hacia fuera
  const h = data.halfSize;
  for (const b of data.boxes) {
    if (!b.vis || b.maxY < 1 || b.maxX - b.minX < 0.8 || b.maxZ - b.minZ < 0.8) continue;
    const cands = [];
    for (let fx = 0.1; fx <= 0.9; fx += 0.2) for (let fz = 0.1; fz <= 0.9; fz += 0.2) {
      const x = b.minX + (b.maxX - b.minX) * fx, z = b.minZ + (b.maxZ - b.minZ) * fz;
      if (Math.max(Math.abs(x), Math.abs(z)) > h - 7) cands.push([x, z]);
    }
    for (const [x, z] of cands) {
      if (Phys.blockedAt(w, x, b.maxY + 0.01, z)) continue;
      const out = Math.abs(x) > Math.abs(z) ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : (z > 0 ? Math.PI : 0);
      for (const side of [0, 0.5, -0.5]) {
        const st = Phys.newState(x, b.maxY + 0.01, z);
        for (let t = 0; t < 3; t += 1 / 60) Phys.simulate(w, st, { fwd: 1, side, yaw: out, jump: true }, 1 / 60);
        for (let t = 0; t < 1; t += 1 / 60) Phys.simulate(w, st, { fwd: 0, side: 0, yaw: out, jump: false }, 1 / 60);
        for (const p of data.boxes) {
          if (!p.vis || p.maxY - p.minY < 1.5) continue;
          const longX = p.maxX - p.minX > h * 1.2, longZ = p.maxZ - p.minZ > h * 1.2;
          const bad = (longX && p.minZ < -h + 3 && st.z < p.minZ - 0.05) || (longX && p.maxZ > h - 3 && st.z > p.maxZ + 0.05)
            || (longZ && p.minX < -h + 3 && st.x < p.minX - 0.05) || (longZ && p.maxX > h - 3 && st.x > p.maxX + 0.05);
          if (bad) note('escape', `desde (${x.toFixed(1)},${b.maxY.toFixed(1)},${z.toFixed(1)}) acabó en (${st.x.toFixed(2)},${st.y.toFixed(2)},${st.z.toFixed(2)})`);
        }
      }
    }
  }

  const keys = Object.keys(issues);
  console.log(`${keys.length ? '✗' : '✓'} ${def.name}${keys.map(k => `\n    ${k}: ${issues[k].n} frames, p.ej. ${issues[k].ex}`).join('')}`);
  if (keys.length) fails++;
}
console.log(fails ? `\n${fails} mapas con problemas` : '\nSin problemas');
process.exit(fails ? 1 : 0);
