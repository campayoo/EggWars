// Prueba de puertas (v6.5): en todos los mapas, cada hueco de puerta a ras de suelo
// se tiene que poder cruzar andando en los dos sentidos (nadie se queda encerrado).
// Uso: node tests/doors-test.js [mapa]
const MB = require('../shared/mapbuilder.js');
const doors = [];
const orig = MB.Builder.prototype.wallSeg;
MB.Builder.prototype.wallSeg = function (axis, fixed, from, to, y0, H, t, openings, mat) {
  const mid = (from + to) / 2;
  for (const o of openings || []) {
    if ((o.y || 0) > 0.6) continue;
    const a = mid + (o.at || 0) - (o.w || 2) / 2, b = mid + (o.at || 0) + (o.w || 2) / 2;
    const h = o.h === undefined ? 2.6 : o.h;
    // posición real tras las transformaciones (espejos/rotaciones)
    const c = (a + b) / 2;
    const p = axis === 'x' ? this._tp(c, fixed) : this._tp(fixed, c);
    const n = axis === 'x' ? this._tv(0, 1) : this._tv(1, 0);
    doors.push({ map: this._mapId, x: p[0], z: p[1], nx: n[0], nz: n[1], y0: y0 + (o.y || 0), w: b - a, h, t });
  }
  return orig.apply(this, arguments);
};
const MD = require('../shared/mapdefs.js');
const Phys = require('../shared/physics.js');
const only = process.argv[2];
let bad = 0;
for (const def of MD.LIST) {
  if (only && def.id !== only) continue;
  doors.length = 0;
  const B = MB.Builder; const ob = B.prototype.decoAt;
  B.prototype._mapId = def.id;
  const data = MD.build(def.id);
  const w = Phys.createWorld(data);
  const mine = doors.slice();
  const issues = [];
  for (const d of mine) {
    if (d.w < 0.9 || d.h < 1.6) continue;          // huecos pequeños (gateras, ventanas bajas)
    for (const s of [1, -1]) {
      const sx = d.x - d.nx * s * 1.4, sz = d.z - d.nz * s * 1.4;
      const sy = MD.supportAt(data, sx, sz, d.y0 + 0.6);
      if (!isFinite(sy) || Math.abs(sy - d.y0) > 0.6) continue;   // a ese lado no hay suelo a la altura de la puerta
      const ex = d.x + d.nx * s * 1.4, ez = d.z + d.nz * s * 1.4, ey = MD.supportAt(data, ex, ez, d.y0 + 0.6);
      if (!isFinite(ey) || Math.abs(ey - d.y0) > 0.6) continue;   // al otro lado no hay suelo (escalera de mano, vacío…)
      const onRamp = (x, z) => data.ramps.some(r => x > r.minX - 0.5 && x < r.maxX + 0.5 && z > r.minZ - 0.5 && z < r.maxZ + 0.5);
      if (onRamp(sx, sz) || onRamp(ex, ez)) continue;   // la puerta da a una escalera: se comprueba en playtest
      if (Phys.blockedAt(w, sx, sy + 0.01, sz)) { issues.push(`puerta (${d.x.toFixed(1)}, ${d.y0.toFixed(1)}, ${d.z.toFixed(1)}) lado ${s}: el sitio de delante está ocupado (${sx.toFixed(1)}, ${sz.toFixed(1)})`); continue; }
      const st = Phys.newState(sx, sy + 0.02, sz);
      const yaw = Math.atan2(-d.nx * s, -d.nz * s); // forward = (-sin(yaw), -cos(yaw))
      let ok = false;
      for (let i = 0; i < 120 && !ok; i++) {
        Phys.simulate(w, st, { fwd: 1, side: 0, yaw, jump: false }, 1 / 60);
        const prog = (st.x - d.x) * d.nx * s + (st.z - d.z) * d.nz * s;
        if (prog > 0.9) ok = true;
      }
      if (!ok) issues.push(`puerta (${d.x.toFixed(1)}, ${d.y0.toFixed(1)}, ${d.z.toFixed(1)}) ancho ${d.w.toFixed(1)}: no se cruza hacia ${s > 0 ? '+' : '-'} (acabó en ${st.x.toFixed(1)}, ${st.z.toFixed(1)})`);
    }
  }
  bad += issues.length;
  console.log(`■ ${def.name}: ${mine.length} puertas${issues.length ? '' : ' · OK'}`);
  issues.forEach(m => console.log('   ✗ ' + m));
}
console.log(bad ? `\n✗ ${bad} puertas con problemas` : '\n✅ Todas las puertas se cruzan en los dos sentidos');
process.exit(bad ? 1 : 0);
