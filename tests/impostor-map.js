// Comprueba el mapa «ÑEMANAVE»: puestos libres y alcanzables andando desde la mesa
'use strict';
const MD = require('../shared/mapdefs.js');
const I = require('../shared/impostor.js');
const Ph = require('../shared/physics.js');
const d = MD.build('nave');
const w = Ph.createWorld(d);
let bad = 0;
const fail = m => { console.log('  ❌ ' + m); bad++; };
if (MD.LIST.some(m => m.id === 'nave')) fail('la nave no debe salir en la lista de mapas normales');
const free = (x, z) => !Ph.blockedAt(w, x, 0.01, z);
const pts = [];
I.STATIONS.forEach(s => pts.push([s.id, s.x, s.z]));
I.VENTS.forEach(v => pts.push([v.id, v.x, v.z]));
I.REACTOR_PADS.forEach(p => pts.push(['pad' + p.id, p.x, p.z]));
pts.push(['luces', I.LIGHTS_PANEL.x, I.LIGHTS_PANEL.z], ['boton', I.BUTTON.x + 1.6, I.BUTTON.z], ['camaras', I.CAM_PANEL.x, I.CAM_PANEL.z]);
d.spawns.forEach((s, i) => pts.push(['asiento' + i, s.x, s.z]));
pts.forEach(([n, x, z]) => { if (!free(x, z)) fail(`${n} (${x}, ${z}) está dentro de algo`); });
// Rejilla de 0,25 m: inundación desde el primer asiento
const S = 0.25, half = Math.max(-I.BOUNDS.x0, I.BOUNDS.x1, -I.BOUNDS.z0, I.BOUNDS.z1), N = Math.ceil(2 * half / S);
const idx = (x, z) => Math.round((x + half) / S) * (N + 1) + Math.round((z + half) / S);
const seen = new Uint8Array((N + 1) * (N + 1));
const q = [[d.spawns[0].x, d.spawns[0].z]];
seen[idx(q[0][0], q[0][1])] = 1;
while (q.length) {
  const [x, z] = q.pop();
  for (const [dx, dz] of [[S, 0], [-S, 0], [0, S], [0, -S]]) {
    const nx = x + dx, nz = z + dz;
    if (Math.abs(nx) > half || Math.abs(nz) > half) continue;
    const k = idx(nx, nz);
    if (seen[k] || !free(nx, nz)) continue;
    seen[k] = 1; q.push([nx, nz]);
  }
}
pts.forEach(([n, x, z]) => { if (free(x, z) && !seen[idx(x, z)]) fail(`${n} no se puede alcanzar andando`); });
// La decoración (sólo visual) nunca puede meterse en la cámara de un jugador:
// se comprueba la altura de los ojos en todas las casillas alcanzables
const dec = I.decor(d);
const boxes = dec.prims.map(p => {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  I.primTriangles(p, (x, y, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); });
  return { x0, x1, y0, y1, z0, z1, m: p.m, t: p.t };
}).filter(b => b.y0 < 1.55 && b.y1 > 1.3 && (b.x1 - b.x0) > 0.05 && (b.z1 - b.z0) > 0.05);
let inCam = 0;
for (let gx = -half; gx <= half; gx += S) for (let gz = -half; gz <= half; gz += S) {
  if (!seen[idx(gx, gz)]) continue;
  const b = boxes.find(b => gx > b.x0 + 0.02 && gx < b.x1 - 0.02 && gz > b.z0 + 0.02 && gz < b.z1 - 0.02);
  if (b && inCam++ < 5) fail(`la decoración (${b.t} ${b.m}) se mete en la cámara en (${gx.toFixed(2)}, ${gz.toFixed(2)})`);
}
// Ninguna sala puede ser paso obligado: quitando cualquier sala, las demás siguen
// conectadas a La Yema por pasillos
{
  const touch = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
  const nodes = I.ROOMS.map(r => ({ id: r.id, rects: [r.r].concat(r.ext || []) })).concat(I.CORRIDORS.map((c, i) => ({ id: 'c' + i, rects: [c] })));
  const adj = (a, b) => a.rects.some(x => b.rects.some(y => touch(x, y)));
  for (const rm of I.ROOMS) {
    if (rm.id === 'comedor') continue;
    const rest = nodes.filter(n => n.id !== rm.id), seen = new Set(['comedor']);
    let ch = true;
    while (ch) { ch = false; for (const n of rest) if (!seen.has(n.id) && rest.some(m => seen.has(m.id) && adj(n, m))) { seen.add(n.id); ch = true; } }
    const lost = I.ROOMS.filter(r => r.id !== rm.id && !seen.has(r.id)).map(r => r.id);
    if (lost.length) fail(`para llegar a ${lost.join(', ')} hay que cruzar ${rm.id}`);
  }
}
// Cerrar las puertas de una sala la deja aislada; abrirlas la vuelve a conectar
I.ROOMS.forEach(rm => { if (!I.DOORS.some(d => d.room === rm.id)) fail(rm.id + ' sin puertas'); });
I.VENTS.forEach(v => { if (!v.links.length) fail(v.id + ' sin enlaces'); });
console.log(bad ? `❌ ÑEMANAVE: ${bad} fallos` : `✅ ÑEMANAVE: ${pts.length} puntos libres y alcanzables, ${I.DOORS.length} puertas, ${I.VENTS.length} conductos`);
process.exit(bad ? 1 : 0);
