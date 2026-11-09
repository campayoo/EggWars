// Validación automática de los mapas: spawns, zonas, escaleras de mano y rampas
// Uso: node tests/validate-maps.js
const MapDefs = require('../shared/mapdefs.js');
const Phys = require('../shared/physics.js');
const { P } = Phys;

let errors = 0, warnings = 0;
const err = (m, s) => { errors++; console.log(`  ✗ [${m}] ${s}`); };
const warn = (m, s) => { warnings++; console.log(`  ! [${m}] ${s}`); };

function yawFor(dir) {
  // forward = (-sin(yaw), -cos(yaw))
  return { '+x': -Math.PI / 2, '-x': Math.PI / 2, '+z': Math.PI, '-z': 0 }[dir];
}

function settle(w, st) {
  for (let i = 0; i < 60; i++) Phys.simulate(w, st, { fwd: 0, side: 0, yaw: 0, jump: false }, 1 / 60);
  return st;
}

for (const def of MapDefs.LIST) {
  const data = MapDefs.build(def.id);
  const w = Phys.createWorld(data);
  console.log(`\n■ ${def.name} — ${data.boxes.length} cajas, ${data.ramps.length} rampas, ${data.ladders.length} escaleras, ${data.pads.length} pads, ${data.decos.length} decos`);
  const id = def.id;

  const checkPoint = (label, s, tolUp) => {
    if (Math.abs(s.x) > data.halfSize - P.RADIUS || Math.abs(s.z) > data.halfSize - P.RADIUS) err(id, `${label} fuera de límites (${s.x},${s.z})`);
    if (Phys.blockedAt(w, s.x, s.y + 0.01, s.z)) err(id, `${label} dentro de geometría en (${s.x}, ${s.y.toFixed(2)}, ${s.z})`);
    if (!isFinite(s.y)) err(id, `${label} sin suelo en (${s.x}, ${s.z})`);
    const st = settle(w, Phys.newState(s.x, s.y + 0.02, s.z));
    if (Math.abs(st.y - s.y) > (tolUp || 0.3)) err(id, `${label} no es estable: esperaba y=${s.y.toFixed(2)} acabó en ${st.y.toFixed(2)}`);
  };

  data.spawns.forEach((s, i) => checkPoint(`spawn#${i}`, s));
  data.teamSpawns.red.forEach((s, i) => checkPoint(`red#${i}`, s));
  data.teamSpawns.blue.forEach((s, i) => checkPoint(`blue#${i}`, s));
  // Los spawns con y declarada deben quedarse a esa altura
  def.spawns.forEach((s, i) => {
    if (s.y !== undefined && Math.abs(data.spawns[i].y - s.y) > 0.05) err(id, `spawn#${i} declarado y=${s.y} pero el soporte está en ${data.spawns[i].y}`);
  });
  ['red', 'blue'].forEach(t => def.teamSpawns[t].forEach((s, i) => {
    if (s.y !== undefined && Math.abs(data.teamSpawns[t][i].y - s.y) > 0.05) err(id, `${t}#${i} declarado y=${s.y} pero el soporte está en ${data.teamSpawns[t][i].y}`);
  }));

  (data.warnings || []).forEach(m => warn(id, m));
  const checkZone = (label, z) => {
    const sup = MapDefs.supportAt(data, z.x, z.z, z.y + 0.6);
    if (Math.abs(sup - z.y) > 0.15) err(id, `${label} en (${z.x},${z.y},${z.z}) pero el soporte está en ${sup}`);
    if (Phys.blockedAt(w, z.x, z.y + 0.01, z.z)) warn(id, `${label} con el centro ocupado`);
  };
  data.coops.forEach((c, i) => checkZone(`coop#${i}`, c));
  checkZone('espátula', data.spatula);
  checkZone('base roja', data.bases.red);
  checkZone('base azul', data.bases.blue);

  // Escaleras de mano: simular la subida
  data.ladders.forEach((l, i) => {
    const cx = (l.minX + l.maxX) / 2, cz = (l.minZ + l.maxZ) / 2;
    const startY = MapDefs.supportAt(data, cx, cz, l.y0 + 0.6);
    if (Math.abs(startY - l.y0) > 0.15) warn(id, `escalera#${i} empieza en y0=${l.y0} pero el suelo está en ${startY}`);
    const st = Phys.newState(cx, startY + 0.01, cz);
    if (Phys.blockedAt(w, cx, startY + 0.01, cz)) { err(id, `escalera#${i} con el volumen bloqueado en (${cx.toFixed(2)},${startY},${cz.toFixed(2)})`); return; }
    const yaw = yawFor(l.facing);
    let maxY = st.y;
    for (let t = 0; t < 7; t += 1 / 60) {
      Phys.simulate(w, st, { fwd: 1, side: 0, yaw, jump: false }, 1 / 60);
      maxY = Math.max(maxY, st.y);
      if (st.onGround && st.y >= l.y0 + l.h - 0.2 && !Phys.findLadder(w, st)) break;
    }
    const target = l.y0 + l.h;
    if (st.y < target - 0.25) err(id, `escalera#${i} (${l.facing}) en (${l.x.toFixed(1)},${l.z.toFixed(1)}) no sube: alcanzó ${maxY.toFixed(2)}, acabó en ${st.y.toFixed(2)}, objetivo ${target.toFixed(2)}`);
  });

  // Rampas/escaleras: subir andando desde el extremo bajo
  data.ramps.forEach((r, i) => {
    let sx, sz, y0, ok = false;
    const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    for (const off of [0.9, 0.5, 0.42]) {
      if (r.dir === '+x') { sx = r.minX - off; sz = cz; } else if (r.dir === '-x') { sx = r.maxX + off; sz = cz; }
      else if (r.dir === '+z') { sx = cx; sz = r.minZ - off; } else { sx = cx; sz = r.maxZ + off; }
      y0 = MapDefs.supportAt(data, sx, sz, r.y0 + 0.6);
      if (!Phys.blockedAt(w, sx, y0 + 0.01, sz)) { ok = true; break; }
    }
    if (Math.abs(y0 - r.y0) > 0.6) return; // rampa que no arranca desde un suelo (p.ej. tejados)
    if (!ok) { warn(id, `rampa#${i} con la entrada bloqueada`); return; }
    const st = Phys.newState(sx, y0 + 0.01, sz);
    const yaw = yawFor(r.dir);
    let maxY = st.y;
    for (let t = 0; t < 4; t += 1 / 60) { Phys.simulate(w, st, { fwd: 1, side: 0, yaw, jump: false }, 1 / 60); maxY = Math.max(maxY, st.y); }
    if (maxY < r.y0 + r.h - 0.3) err(id, `rampa#${i} (${r.dir}${r.stairs ? ', escalera' : ''}) en (${cx.toFixed(1)},${cz.toFixed(1)}) no se puede subir: máx ${maxY.toFixed(2)} de ${(r.y0 + r.h).toFixed(2)}`);
  });

  // Pads
  data.pads.forEach((p, i) => {
    const st = Phys.newState(p.x, p.y + 0.01, p.z);
    let maxY = st.y;
    for (let t = 0; t < 2; t += 1 / 60) { Phys.simulate(w, st, { fwd: 0, side: 0, yaw: 0, jump: false }, 1 / 60); maxY = Math.max(maxY, st.y); }
    if (maxY < p.y + 2) err(id, `pad#${i} no impulsa (máx ${maxY.toFixed(2)})`);
  });
}

console.log(`\n${errors} errores, ${warnings} avisos`);
process.exit(errors ? 1 : 0);
