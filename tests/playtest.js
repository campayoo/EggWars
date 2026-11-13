// Prueba de juego simulada con las físicas reales: ¿se pueden subir todas las
// escaleras de mano, escalinatas y rampas? ¿se puede salir andando de cada spawn?
const MD = require('../shared/mapdefs.js');
const Ph = require('../shared/physics.js');
const AC = require('../server/anticheat.js');
// Cada movimiento simulado se pasa también por el anti-trampas del servidor
// (a 30 paquetes/s con reloj virtual): un jugador honrado NUNCA debe ser rechazado.
let acWorld = null, acP = null, acT = 0, acFlags = [];
function acStart(st) { acP = { x: st.x, y: st.y, z: st.z }; acT = 1e6; AC.resetPlayer(acP, acT); }
function acFeed(st, dt) {
  acT += dt * 1000;
  if (acT - acP.mvAt < 33) return;
  const bad = AC.checkMove(acP, st.x, st.y, st.z, acT, acWorld);
  if (bad) { acFlags.push(bad + ' en (' + st.x.toFixed(1) + ', ' + st.y.toFixed(1) + ', ' + st.z.toFixed(1) + ')'); acP.x = st.x; acP.y = st.y; acP.z = st.z; AC.resetPlayer(acP, acT); }
  else { acP.x = st.x; acP.y = st.y; acP.z = st.z; }
}
const only = process.argv[2];
let fails = 0;
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
function run(w, st, input, secs, stopY) { let maxY = st.y; if (!acP || acP._st !== st) { acStart(st); acP._st = st; } for (let t = 0; t < secs; t += 1 / 60) { Ph.simulate(w, st, input, 1 / 60); acFeed(st, 1 / 60); maxY = Math.max(maxY, st.y); if (stopY !== undefined && st.onGround && st.y >= stopY) break; } return maxY; }
for (const def of MD.LIST) {
  if (only && def.id !== only) continue;
  const data = MD.build(def.id), w = Ph.createWorld(data);
  acWorld = w; acFlags = [];
  const bad = [];
  // 1) Escaleras de mano
  data.ladders.forEach((l, i) => {
    const sx = l.x - l.fx * 0.9, sz = l.z - l.fz * 0.9;
    const y0 = MD.supportAt(data, sx, sz, l.y0 + 0.6);
    const st = Ph.newState(sx, y0, sz);
    const inp = { fwd: 1, side: 0, yaw: yawTo(l.fx, l.fz), jump: false };
    const top = l.y0 + l.h - 0.35;
    run(w, st, inp, l.h / 4.6 + 2.5, top);
    run(w, st, { fwd: 0, side: 0, yaw: inp.yaw, jump: false }, 0.6);
    if (!(st.y >= top && st.onGround)) bad.push(`escalera de mano #${i} en (${l.x.toFixed(1)}, ${l.y0}, ${l.z.toFixed(1)}) h=${l.h.toFixed(1)}: llegó a y=${st.y.toFixed(2)}`);
  });
  // 1b) Escaleras de mano llegando ladeado (hasta 50°) y descentrado, mirando de lado
  data.ladders.forEach((l, i) => {
    for (const [ang, lat] of [[0.87, 0.45], [-0.87, -0.45], [0.5, 0]]) {
      const px = -l.fz, pz = l.fx;   // eje lateral de la escalera
      const sx = l.x - l.fx * 1.1 + px * lat, sz = l.z - l.fz * 1.1 + pz * lat;
      const y0 = MD.supportAt(data, sx, sz, l.y0 + 0.6);
      if (Math.abs(y0 - l.y0) > 0.3 || Ph.blockedAt(w, sx, y0 + 0.02, sz)) continue;
      const st = Ph.newState(sx, y0, sz);
      const base = Math.atan2(-l.fx, -l.fz);
      const top = l.y0 + l.h - 0.35;
      run(w, st, { fwd: 1, side: 0, yaw: base + ang, jump: false }, l.h / 5.4 + 3, top);
      run(w, st, { fwd: 0, side: 0, yaw: base, jump: false }, 0.6);
      if (!(st.y >= top && st.onGround)) { bad.push(`escalera de mano #${i} no se sube llegando a ${Math.round(ang * 57)}° (y=${st.y.toFixed(2)})`); break; }
    }
  });
  // 1c) Pasar andando junto a una escalera (en paralelo a la pared) no debe frenar ni enganchar
  data.ladders.forEach((l, i) => {
    if (l.y0 > 0.3) return;
    const px = -l.fz, pz = l.fx;
    const sx = l.x - l.fx * 0.7 - px * 3, sz = l.z - l.fz * 0.7 - pz * 3;
    const y0 = MD.supportAt(data, sx, sz, 0.6);
    if (y0 > 0.3 || Ph.blockedAt(w, sx, y0 + 0.02, sz)) return;
    const st = Ph.newState(sx, y0, sz);
    run(w, st, { fwd: 1, side: 0, yaw: Math.atan2(-px, -pz), jump: false }, 1.0);
    if (st.onLadder || st.y > y0 + 0.6) bad.push(`escalera de mano #${i} engancha al pasar por al lado`);
  });
  // 2) Escalinatas y rampas
  data.ramps.forEach((r, i) => {
    const D = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[r.dir];
    const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    // punto de partida delante de la entrada (el más lejano que esté libre)
    let sx, sz, y0 = NaN;
    for (const off of [0.7, 0.5, 0.42]) {
      const tx = cx - D[0] * (r.len / 2 + off), tz = cz - D[1] * (r.len / 2 + off);
      const ty = MD.supportAt(data, tx, tz, r.y0 + 0.6);
      if (Math.abs(ty - r.y0) <= 0.3 && !Ph.blockedAt(w, tx, ty + 0.02, tz)) { sx = tx; sz = tz; y0 = ty; break; }
    }
    if (isNaN(y0)) return; // entrada desde otra altura o pegada a una pared (lo revisa el validador)
    const st = Ph.newState(sx, y0, sz);
    const maxY = run(w, st, { fwd: 1, side: 0, yaw: yawTo(D[0], D[1]), jump: false }, r.len / 6 + 1.0, r.y0 + r.h - 0.25);
    if (maxY < r.y0 + r.h - 0.25) bad.push(`${r.stairs ? 'escalinata' : 'rampa'} #${i} en (${cx.toFixed(1)}, ${cz.toFixed(1)}) ${r.dir} h=${r.h}: llegó a y=${st.y.toFixed(2)} de ${(r.y0 + r.h).toFixed(2)}`);
  });
  // 3) Spawns: ¿se puede salir andando?
  const spawns = data.spawns.concat(data.teamSpawns.red, data.teamSpawns.blue);
  spawns.forEach((s, i) => {
    let best = 0;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, st = Ph.newState(s.x, s.y, s.z);
      run(w, st, { fwd: 1, side: 0, yaw: a, jump: false }, 0.8);
      best = Math.max(best, Math.hypot(st.x - s.x, st.z - s.z));
    }
    if (best < 1.5) bad.push(`spawn en (${s.x}, ${s.y}, ${s.z}) atrapado (máx ${best.toFixed(2)} m)`);
  });
  // 4) Rincones-trampa: desde una rejilla de puntos del suelo, ¿se puede salir andando?
  const H = data.halfSize - 1.5;
  let traps = 0;
  for (let x = -H; x <= H && traps < 6; x += 1.5) for (let z = -H; z <= H && traps < 6; z += 1.5) {
    const y = MD.supportAt(data, x, z, 40);
    if (Ph.blockedAt(w, x, y + 0.02, z)) continue;
    let best = 0;
    for (let k = 0; k < 8 && best < 1.2; k++) {
      const st = Ph.newState(x, y, z);
      run(w, st, { fwd: 1, side: 0, yaw: k * Math.PI / 4, jump: k % 2 === 1 }, 0.6);
      best = Math.max(best, Math.hypot(st.x - x, st.z - z));
    }
    if (best < 1.2) { bad.push(`posible trampa en (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}): sólo se mueve ${best.toFixed(2)} m`); traps++; }
  }
  // 5) Saltos y caídas desde lo alto: el anti-trampas no debe molestar
  data.spawns.forEach(s => {
    for (let k = 0; k < 4; k++) {
      const st = Ph.newState(s.x, s.y, s.z);
      run(w, st, { fwd: 1, side: 0, yaw: k * Math.PI / 2, jump: true }, 2.5);
    }
  });
  const uniq = [...new Set(acFlags)];
  uniq.slice(0, 5).forEach(f => bad.push('anti-trampas rechazaría a un jugador honrado: ' + f));
  console.log(`■ ${def.name}: ${bad.length ? bad.length + ' problemas' : 'OK'}`);
  bad.forEach(b => console.log('   ✗ ' + b));
  fails += bad.length;
}
console.log(`\n${fails} problemas de jugabilidad`);
process.exitCode = fails ? 1 : 0;
