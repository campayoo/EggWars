// ============================================================================
// shared/mapbuilder.js — Constructor de mapas basado en datos (cliente + servidor)
// Las mismas primitivas generan la geometría visual (cliente) y los colisionadores
// (cliente y servidor), así nunca se desincronizan.
//
// Convenciones:
//   box(x, y, z, w, h, d)  -> x,z = centro, y = BASE (suelo de la caja)
//   ramp(x, z, y0, w, len, h, dir) -> dir = sentido en el que SUBE ('+x','-x','+z','-z')
//   ladder(x, z, y0, h, facing) -> x,z = punto de la cara de la pared; facing = hacia
//                                  dónde mira el jugador al trepar (hacia la pared)
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MapBuilder = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Materiales: color + patrón de textura procedural (cliente) + flags
  const MATERIALS = {
    stone:      { color: 0x9aa0a6, pattern: 'blocks' },
    stoneDark:  { color: 0x6f767e, pattern: 'blocks' },
    stoneOld:   { color: 0xa39a86, pattern: 'blocks' },
    brick:      { color: 0xa8553f, pattern: 'brick' },
    wood:       { color: 0x9b6b3d, pattern: 'planks' },
    woodDark:   { color: 0x6b4627, pattern: 'planks' },
    plank:      { color: 0xc89a5e, pattern: 'planks' },
    barnRed:    { color: 0xa83228, pattern: 'planksV' },
    hay:        { color: 0xe3bb4c, pattern: 'straw' },
    dirt:       { color: 0x8b5a2b, pattern: 'noise' },
    mud:        { color: 0x6d4c33, pattern: 'noise' },
    grass:      { color: 0x5f9e3a, pattern: 'noise' },
    hedge:      { color: 0x3f7d2c, pattern: 'noise' },
    sand:       { color: 0xd8c48a, pattern: 'noise' },
    sandbag:    { color: 0xb59a6a, pattern: 'brick' },
    concrete:   { color: 0xb5b5ad, pattern: 'tiles' },
    asphalt:    { color: 0x4a4d52, pattern: 'noise' },
    metal:      { color: 0x8e99a3, pattern: 'ribs' },
    metalDark:  { color: 0x4f5a63, pattern: 'ribs' },
    red:        { color: 0xc0392b, pattern: 'flat' },
    blue:       { color: 0x2f6fb5, pattern: 'tiles' },
    blueLight:  { color: 0x5dade2, pattern: 'tiles' },
    white:      { color: 0xeef2f5, pattern: 'tiles' },
    yellow:     { color: 0xf1c40f, pattern: 'flat' },
    orange:     { color: 0xe67e22, pattern: 'flat' },
    green:      { color: 0x27ae60, pattern: 'flat' },
    scifi:      { color: 0xdfe6ee, pattern: 'panels' },
    scifiDark:  { color: 0x3d4f61, pattern: 'panels' },
    cyan:       { color: 0x1abc9c, pattern: 'flat', emissive: 0x0b5e4e },
    moon:       { color: 0x8d8f94, pattern: 'noise' },
    rock:       { color: 0x6b6e72, pattern: 'noise' },
    roofRed:    { color: 0xb03a2e, pattern: 'shingles' },
    roofBlue:   { color: 0x2c5f8a, pattern: 'shingles' },
    roofGrey:   { color: 0x5d6d7e, pattern: 'shingles' },
    cRed:       { color: 0xb22222, pattern: 'ribs' },
    cBlue:      { color: 0x2e6da4, pattern: 'ribs' },
    cGreen:     { color: 0x2e8b57, pattern: 'ribs' },
    cOrange:    { color: 0xd35400, pattern: 'ribs' },
    cYellow:    { color: 0xd4ac0d, pattern: 'ribs' },
    crate:      { color: 0xb8864b, pattern: 'crate' },
    glass:      { color: 0x9fd8ff, pattern: 'flat', transparent: 0.35, see: true },
    rail:       { color: 0x95a5a6, pattern: 'flat', see: true },
    pad:        { color: 0xf39c12, pattern: 'flat', emissive: 0x7a4a00 },
    sandstone:  { color: 0xd9b778, pattern: 'blocks' },
    sandstoneDk:{ color: 0xb48e55, pattern: 'blocks' },
    gold:       { color: 0xe8b830, pattern: 'flat', emissive: 0x3a2a00 },
    snow:       { color: 0xeef3f7, pattern: 'noise' },
    ice:        { color: 0xbfe4f2, pattern: 'tiles' },
    logs:       { color: 0x7a5432, pattern: 'planksV' },
    marble:     { color: 0xe6e0d4, pattern: 'tiles' },
    kitchen:    { color: 0xe9e1cf, pattern: 'tiles' },
    counter:    { color: 0x8a5a3a, pattern: 'planks' },
    worktop:    { color: 0xd8d4cc, pattern: 'noise' },
    appliance:  { color: 0xf3f4f5, pattern: 'flat' },
    steel:      { color: 0xb9c0c7, pattern: 'ribs' },
    bookRed:    { color: 0xa63a32, pattern: 'flat' },
    bookBlue:   { color: 0x335c8c, pattern: 'flat' },
    bookGreen:  { color: 0x3e7a4b, pattern: 'flat' },
    jersey:     { color: 0xc9c7bf, pattern: 'tiles' },
    invisible:  { color: 0x000000, invisible: true },
  };

  const DIRV = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
  function vecToDir(x, z) {
    if (Math.abs(x) > Math.abs(z)) return x > 0 ? '+x' : '-x';
    return z > 0 ? '+z' : '-z';
  }

  function Builder() {
    this.boxes = [];
    this.ramps = [];
    this.ladders = [];
    this.pads = [];
    this.decos = [];
    this.stack = [];
  }

  // -------------------------------------------------------------------------
  // Transformaciones (espejo X, rotaciones de 90°, traslación) para mapas
  // simétricos: se aplican desde la más interna a la más externa.
  // -------------------------------------------------------------------------
  Builder.prototype.with = function (t, fn) {
    this.stack.push({ mx: !!t.mx, rot: ((t.rot || 0) % 4 + 4) % 4, ox: t.ox || 0, oz: t.oz || 0 });
    try { fn(this); } finally { this.stack.pop(); }
  };
  Builder.prototype._tp = function (x, z) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const t = this.stack[i];
      if (t.mx) x = -x;
      for (let r = 0; r < t.rot; r++) { const nx = -z; z = x; x = nx; }
      x += t.ox; z += t.oz;
    }
    return [x, z];
  };
  Builder.prototype._tv = function (x, z) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const t = this.stack[i];
      if (t.mx) x = -x;
      for (let r = 0; r < t.rot; r++) { const nx = -z; z = x; x = nx; }
    }
    return [x, z];
  };
  Builder.prototype._odd = function () {
    let s = 0;
    for (const t of this.stack) s += t.rot;
    return (s % 2) === 1;
  };
  Builder.prototype._tdir = function (dir) {
    const v = DIRV[dir];
    const r = this._tv(v[0], v[1]);
    return vecToDir(r[0], r[1]);
  };
  Builder.prototype._trot = function (rotY) {
    // Ángulo de un objeto rotado en Y (convención three.js)
    const v = this._tv(Math.cos(rotY || 0), -Math.sin(rotY || 0));
    return Math.atan2(-v[1], v[0]);
  };

  // -------------------------------------------------------------------------
  // Primitivas
  // -------------------------------------------------------------------------
  Builder.prototype.box = function (x, y, z, w, h, d, mat, o) {
    o = o || {};
    mat = mat || 'stone';
    const p = this._tp(x, z);
    if (this._odd()) { const tmp = w; w = d; d = tmp; }
    const m = MATERIALS[mat] || MATERIALS.stone;
    const b = {
      minX: p[0] - w / 2, maxX: p[0] + w / 2,
      minY: y, maxY: y + h,
      minZ: p[1] - d / 2, maxZ: p[1] + d / 2,
      mat,
      see: !!(o.see || m.see || this._see),   // las balas lo atraviesan (cristal, barandillas)
      solid: o.solid !== false,
      vis: !(o.vis === false || m.invisible),
    };
    if (w <= 0.001 || h <= 0.001 || d <= 0.001) return b;
    this.boxes.push(b);
    return b;
  };

  Builder.prototype.aabb = function (x0, y0, z0, x1, y1, z1, mat, o) {
    return this.box((x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2,
      Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), mat, o);
  };

  // Losa con la cara superior en "top" y huecos opcionales (array de {x,z,w,d})
  Builder.prototype.slab = function (cx, cz, top, w, d, t, mat, holes) {
    t = t || 0.3;
    if (!holes || (Array.isArray(holes) && holes.length === 0)) {
      this.box(cx, top - t, cz, w, t, d, mat);
      return;
    }
    if (!Array.isArray(holes)) holes = [holes];
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const xs = [x0, x1], zs = [z0, z1];
    const H = holes.map(h => ({
      x0: Math.max(x0, h.x - h.w / 2), x1: Math.min(x1, h.x + h.w / 2),
      z0: Math.max(z0, h.z - h.d / 2), z1: Math.min(z1, h.z + h.d / 2),
    }));
    H.forEach(h => { xs.push(h.x0, h.x1); zs.push(h.z0, h.z1); });
    const ux = [...new Set(xs.map(v => +v.toFixed(4)))].sort((a, b) => a - b);
    const uz = [...new Set(zs.map(v => +v.toFixed(4)))].sort((a, b) => a - b);
    for (let j = 0; j < uz.length - 1; j++) {
      let runStart = null;
      for (let i = 0; i <= ux.length - 1; i++) {
        let filled = false;
        if (i < ux.length - 1) {
          const mx = (ux[i] + ux[i + 1]) / 2, mz = (uz[j] + uz[j + 1]) / 2;
          filled = !H.some(h => mx > h.x0 && mx < h.x1 && mz > h.z0 && mz < h.z1);
        }
        if (filled && runStart === null) runStart = ux[i];
        if (!filled && runStart !== null) {
          this.aabb(runStart, top - t, uz[j], ux[i], top, uz[j + 1], mat);
          runStart = null;
        }
      }
    }
  };

  Builder.prototype.ramp = function (x, z, y0, w, len, h, dir, mat, o) {
    o = o || {};
    const p = this._tp(x, z);
    const D = this._tdir(dir);
    const alongX = D[1] === 'x';
    const sx = alongX ? len : w, sz = alongX ? w : len;
    this.ramps.push({
      minX: p[0] - sx / 2, maxX: p[0] + sx / 2,
      minZ: p[1] - sz / 2, maxZ: p[1] + sz / 2,
      y0, h, dir: D, len, w,
      mat: mat || 'stone',
      stairs: !!o.stairs,
      thick: o.thick || 0,     // 0 = macizo hasta y0
    });
  };

  Builder.prototype.stairs = function (x, z, y0, w, len, h, dir, mat, o) {
    this.ramp(x, z, y0, w, len, h, dir, mat, Object.assign({}, o, { stairs: true }));
  };

  Builder.prototype.ladder = function (x, z, y0, h, facing, o) {
    o = o || {};
    const p = this._tp(x, z);
    const F = this._tdir(facing);
    const f = DIRV[F];
    // Zona para agarrarse algo más amplia que la escalera visible (1,5 m): se engancha aunque llegues ladeado
    const depth = 1.05, width = 1.5;
    const cx = p[0] - f[0] * depth / 2, cz = p[1] - f[1] * depth / 2;
    const sx = f[0] !== 0 ? depth : width, sz = f[0] !== 0 ? width : depth;
    this.ladders.push({
      minX: cx - sx / 2, maxX: cx + sx / 2,
      minZ: cz - sz / 2, maxZ: cz + sz / 2,
      minY: y0, maxY: y0 + h + 0.15,
      fx: f[0], fz: f[1], facing: F,
      x: p[0], z: p[1], y0, h,
      metal: !!o.metal,
    });
  };

  Builder.prototype.pad = function (x, y, z, power, r) {
    const p = this._tp(x, z);
    this.pads.push({ x: p[0], y, z: p[1], power: power || 14, r: r || 1.1 });
    this.box(x, y - 0.12, z, (r || 1.1) * 1.6, 0.12, (r || 1.1) * 1.6, 'pad');
    this.decoAt('padring', x, y, z, { r: r || 1.1 });
  };

  Builder.prototype.decoAt = function (type, x, y, z, o) {
    o = Object.assign({}, o || {});
    const p = this._tp(x, z);
    if (o.rotY !== undefined) o.rotY = this._trot(o.rotY);
    if (o.w !== undefined && o.d !== undefined && this._odd()) { const t = o.w; o.w = o.d; o.d = t; }
    if (o.dir) o.dir = this._tdir(o.dir);
    this.decos.push(Object.assign({ type, x: p[0], y: y || 0, z: p[1] }, o));
  };

  // -------------------------------------------------------------------------
  // Construcciones compuestas
  // -------------------------------------------------------------------------

  // Pared recta con aperturas (puertas/ventanas). axis: 'x' (recorre X) o 'z'
  Builder.prototype.wallSeg = function (axis, fixed, from, to, y0, H, t, openings, mat) {
    const mid = (from + to) / 2;
    const ops = (openings || []).map(o => ({
      a: mid + (o.at || 0) - (o.w || 2) / 2,
      b: mid + (o.at || 0) + (o.w || 2) / 2,
      y: o.y || 0,
      h: o.h === undefined ? 2.6 : o.h,
    })).sort((p, q) => p.a - q.a);
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      if (axis === 'x') this.aabb(a, ya, fixed - t / 2, b, yb, fixed + t / 2, mat);
      else this.aabb(fixed - t / 2, ya, a, fixed + t / 2, yb, b, mat);
    };
    let cur = from;
    for (const op of ops) {
      const a = Math.max(from, op.a), b = Math.min(to, op.b);
      if (a > cur) seg(cur, a, y0, y0 + H);
      if (op.y > 0) seg(a, b, y0, y0 + Math.min(H, op.y));
      if (op.y + op.h < H) seg(a, b, y0 + op.y + op.h, y0 + H);
      // Marco (sólo decoración, sin colisión) en puertas y ventanas de verdad
      if (op.y + op.h < H - 0.05 && b - a > 0.6 && t >= 0.2 && this.frames !== false) this._frame(axis, fixed, a, b, y0 + op.y, y0 + op.y + op.h, t, op.y > 0.05);
      cur = Math.max(cur, b);
    }
    if (cur < to) seg(cur, to, y0, y0 + H);
  };

  // Marco de puerta (jambas + dintel) o de ventana (alféizar + dintel)
  Builder.prototype._frame = function (axis, fixed, a, b, ya, yb, t, isWindow) {
    const fm = this.frameMat || 'woodDark', deco = { solid: false };
    const out = t + 0.12, fw = 0.14;
    const put = (u0, u1, y0, y1, depth) => {
      if (axis === 'x') this.aabb(u0, y0, fixed - depth / 2, u1, y1, fixed + depth / 2, fm, deco);
      else this.aabb(fixed - depth / 2, y0, u0, fixed + depth / 2, y1, u1, fm, deco);
    };
    // Cada pieza entra 2 cm en el hueco: así no comparte cara con la pared (sin parpadeo)
    const e = 0.02;
    put(a - fw, b + fw, yb - e, yb + fw, out);                       // dintel
    if (isWindow) put(a - fw, b + fw, ya - 0.1, ya + e, out + 0.1);  // alféizar
    else { put(a - fw, a + e, ya, yb, out); put(b - e, b + fw, ya, yb, out); }  // jambas
  };

  // Habitación/edificio: paredes con aperturas, pisos opcionales, techo y pretil
  // o.open: [{side:'n'|'s'|'e'|'w', at, w, h, y}]  (n = -Z, s = +Z, e = +X, w = -X)
  Builder.prototype.room = function (cx, cz, y0, w, d, h, mat, o) {
    o = o || {};
    const t = o.t || 0.4;
    const open = o.open || [];
    const by = side => open.filter(p => p.side === side);
    this.wallSeg('x', cz - d / 2 + t / 2, cx - w / 2, cx + w / 2, y0, h, t, by('n'), mat);
    this.wallSeg('x', cz + d / 2 - t / 2, cx - w / 2, cx + w / 2, y0, h, t, by('s'), mat);
    this.wallSeg('z', cx - w / 2 + t / 2, cz - d / 2 + t, cz + d / 2 - t, y0, h, t, by('w'), mat);
    this.wallSeg('z', cx + w / 2 - t / 2, cz - d / 2 + t, cz + d / 2 - t, y0, h, t, by('e'), mat);
    (o.floors || []).forEach(f => {
      this.slab(cx, cz, y0 + f.y, w - 2 * t, d - 2 * t, 0.3, f.mat || o.floorMat || 'plank', f.holes || f.hole);
    });
    // Decoración sin colisión: zócalo + cornisa (+ imposta en cada piso)
    if (o.cornice) {
      const deco = { solid: false }, cm = o.cornice;
      const band = (yb, hb, out) => {
        this.box(cx, yb, cz - d / 2 - out / 2, w + out * 2, hb, out, cm, deco);
        this.box(cx, yb, cz + d / 2 + out / 2, w + out * 2, hb, out, cm, deco);
        this.box(cx - w / 2 - out / 2, yb, cz, out, hb, d, cm, deco);
        this.box(cx + w / 2 + out / 2, yb, cz, out, hb, d, cm, deco);
      };
      if (y0 < 0.01) band(0, 0.45, 0.1);
      band(y0 + h - 0.35, 0.35, 0.16);
      (o.floors || []).forEach(f => band(y0 + f.y - 0.1, 0.2, 0.07));
    }
    if (o.roof) {
      const rt = o.roofT || 0.3;
      const top = y0 + h + rt;
      this.slab(cx, cz, top, w, d, rt, o.roofMat || mat, o.roofHoles || o.roofHole);
      if (o.parapet) this.ring(cx, cz, top, w, d, o.parapet, 0.3, o.parapetMat || mat, o.parapetGaps);
    }
    return { top: y0 + h + (o.roof ? (o.roofT || 0.3) : 0) };
  };

  // Anillo de pretil / murete alrededor de un rectángulo, con huecos
  Builder.prototype.ring = function (cx, cz, y, w, d, h, t, mat, gaps) {
    t = t || 0.3;
    const g = (gaps || []).map(p => ({ side: p.side, at: p.at || 0, w: p.w || 1.6, y: 0, h: h + 1 }));
    const by = side => g.filter(p => p.side === side);
    this.wallSeg('x', cz - d / 2 + t / 2, cx - w / 2, cx + w / 2, y, h, t, by('n'), mat);
    this.wallSeg('x', cz + d / 2 - t / 2, cx - w / 2, cx + w / 2, y, h, t, by('s'), mat);
    this.wallSeg('z', cx - w / 2 + t / 2, cz - d / 2 + t, cz + d / 2 - t, y, h, t, by('w'), mat);
    this.wallSeg('z', cx + w / 2 - t / 2, cz - d / 2 + t, cz + d / 2 - t, y, h, t, by('e'), mat);
  };

  // Contenedor de carga (2.6 x 2.6 x 6)
  Builder.prototype.container = function (x, y, z, alongX, mat) {
    if (alongX) this.box(x, y, z, 6, 2.6, 2.6, mat || 'cRed');
    else this.box(x, y, z, 2.6, 2.6, 6, mat || 'cBlue');
  };

  Builder.prototype.crate = function (x, y, z, s, mat) {
    s = s || 1.4;
    this.box(x, y, z, s, s, s, mat || 'crate');
  };

  Builder.prototype.hay = function (x, y, z, alongX) {
    if (alongX) this.box(x, y, z, 2.2, 1.2, 1.3, 'hay');
    else this.box(x, y, z, 1.3, 1.2, 2.2, 'hay');
  };

  // Colina escalonada (tronco de pirámide con 4 rampas)
  Builder.prototype.hill = function (x, z, top, size, rampLen, mat) {
    this.box(x, 0, z, size, top, size, mat || 'dirt');
    const off = size / 2 + rampLen / 2;
    this.ramp(x, z - off, 0, size, rampLen, top, '+z', mat || 'dirt');
    this.ramp(x, z + off, 0, size, rampLen, top, '-z', mat || 'dirt');
    this.ramp(x - off, z, 0, size, rampLen, top, '+x', mat || 'dirt');
    this.ramp(x + off, z, 0, size, rampLen, top, '-x', mat || 'dirt');
  };

  Builder.prototype.pillar = function (x, y, z, s, h, mat) {
    this.box(x, y, z, s, h, s, mat || 'stone');
  };

  Builder.prototype.tree = function (x, z, s, kind) {
    s = s || 1;
    this.box(x, 0, z, 0.6 * s, 2.2 * s, 0.6 * s, 'woodDark', { vis: false });
    this.decoAt(kind || 'tree', x, 0, z, { s });
  };

  // Muros perimetrales del mapa
  Builder.prototype.perimeter = function (half, h, mat, t, o) {
    t = t || 1;
    o = o || {};
    const a = half - t;
    this.aabb(-half, 0, -half, half, h, -a, mat, o);
    this.aabb(-half, 0, a, half, h, half, mat, o);
    this.aabb(-half, 0, -a, -a, h, a, mat, o);
    this.aabb(a, 0, -a, half, h, a, mat, o);
  };

  // Tejado a dos aguas transitable (dos rampas) sobre un rectángulo
  Builder.prototype.gable = function (cx, cz, y, w, d, rise, alongX, mat) {
    if (alongX) {
      // cumbrera paralela a X: las rampas suben en Z hacia el centro
      this.ramp(cx, cz - d / 4, y, w, d / 2, rise, '+z', mat, { thick: 0.35 });
      this.ramp(cx, cz + d / 4, y, w, d / 2, rise, '-z', mat, { thick: 0.35 });
    } else {
      this.ramp(cx - w / 4, cz, y, d, w / 2, rise, '+x', mat, { thick: 0.35 });
      this.ramp(cx + w / 4, cz, y, d, w / 2, rise, '-x', mat, { thick: 0.35 });
    }
  };

  // -------------------------------------------------------------------------
  // Construcciones de alto nivel (v5): edificios de 2 pisos, puentes, torres,
  // plataformas con rampas. Todas usan las primitivas, así que respetan with().
  // -------------------------------------------------------------------------

  // Comprueba que una zona (coords locales) está libre de cajas bajas ya colocadas
  Builder.prototype.checkFree = function (x0, z0, x1, z1, label) {
    const a = this._tp(x0, z0), c = this._tp(x1, z1);
    const X0 = Math.min(a[0], c[0]), X1 = Math.max(a[0], c[0]), Z0 = Math.min(a[1], c[1]), Z1 = Math.max(a[1], c[1]);
    this.warnings = this.warnings || [];
    for (const bx of this.boxes) {
      if (bx.minY > 2.5 || bx.maxY > 60) continue;
      if (X1 > bx.minX + 0.01 && X0 < bx.maxX - 0.01 && Z1 > bx.minZ + 0.01 && Z0 < bx.maxZ - 0.01) {
        this.warnings.push((label || 'zona') + ' solapa con ' + bx.mat + ' en (' + ((bx.minX + bx.maxX) / 2).toFixed(1) + ', ' + ((bx.minZ + bx.maxZ) / 2).toFixed(1) + ')');
        return false;
      }
    }
    for (const r of this.ramps) {
      if (X1 > r.minX && X0 < r.maxX && Z1 > r.minZ && Z0 < r.maxZ) { this.warnings.push((label || 'zona') + ' solapa con una rampa'); return false; }
    }
    return true;
  };

  // Edificio de 2 pisos (w >= 11, d >= 8): escalera interior al primer piso,
  // escalera de mano a la azotea con pretil. o.doors: lados con puerta ('s','e','w','n').
  Builder.prototype.house2 = function (cx, cz, w, d, mat, o) {
    o = o || {};
    const t = 0.4, H1 = o.h1 || 3.4, H = H1 * 2;
    this.checkFree(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, 'casa');
    const len = Math.round(H1 * 2 * 10) / 10;
    const sz = cz - d / 2 + t + 1.15;                 // escalera pegada a la pared norte
    const sx0 = cx - w / 2 + t + 1.7;                 // hueco libre para entrar
    const scx = sx0 + len / 2;
    const doors = o.doors || ['s', 'e'];
    const open = [];
    doors.forEach(side => open.push({ side, at: side === 'e' || side === 'w' ? d / 6 : (side === 's' ? 0 : w / 4), w: 2, h: 2.6 }));
    // ventanas: planta baja y primer piso en los cuatro lados
    ['n', 's', 'e', 'w'].forEach(side => {
      const L = side === 'e' || side === 'w' ? d : w;
      [-L / 4, L / 4].forEach(at => {
        // sin ventana sobre la escalera interior (n) ni junto a la escalera de mano (e, +z)
        if (!(side === 'n' && at < 0) && !(side === 'e' && at > 0)) open.push({ side, at, y: H1 + 1, w: 1.5, h: 1.2 });
      });
      if (doors.indexOf(side) < 0 && side !== 'n') open.push({ side, at: 0, y: 1.1, w: 1.4, h: 1.1 });
    });
    const lz = cz + d / 2 - t - 1.2;                  // escalera de mano a la azotea (pared este)
    this.room(cx, cz, 0, w, d, H, mat, {
      t, open,
      floors: [{ y: H1, hole: { x: scx, z: sz, w: len + 0.3, d: 2.3 }, mat: o.floorMat || 'plank' }],
      roof: true, roofMat: o.roofMat || mat,
      roofHole: { x: cx + w / 2 - t - 0.7, z: lz, w: 1.4, d: 1.8 },
      parapet: 0.9, parapetMat: o.trim || mat, parapetGaps: o.gaps,
    });
    this.stairs(scx, sz, 0, 2, len, H1, '+x', o.stairMat || 'woodDark');
    this.ladder(cx + w / 2 - t, lz, H1, H1 + 0.3, '+x', { metal: !!o.metal });
    // Azotea con algo encima (v6): chimenea en casas de piedra/madera/ladrillo o máquina del aire
    // acondicionado en edificios modernos. Esquina NO, lejos de la trampilla y de los puentes. Da cobertura.
    if (o.chimney !== false) {
      const roofY = H + 0.3, rx = cx - w / 2 + t + 0.95, rz = cz - d / 2 + t + 0.85;
      const modern = ['concrete', 'white', 'blue', 'blueLight', 'scifi', 'scifiDark', 'metal'].indexOf(mat) >= 0;
      if (modern) {
        this.box(rx + 0.25, roofY, rz + 0.1, 1.5, 0.95, 1.1, 'metal');
        this.box(rx + 0.25, roofY + 0.95, rz + 0.1, 0.9, 0.06, 0.9, 'metalDark', { solid: false });   // rejilla del ventilador
        this.box(rx + 1.35, roofY, rz + 0.1, 0.5, 0.35, 0.5, 'metalDark');
      } else {
        this.box(rx, roofY, rz, 0.9, 1.6, 0.9, o.trim || mat);
        this.box(rx, roofY + 1.6, rz, 1.1, 0.16, 1.1, 'stoneDark', { solid: false });
      }
    }
    // --- Decoración sin colisión: cornisa, zócalo, imposta entre pisos, toldos y alféizares
    const trim = o.trim || mat, deco = { solid: false };
    const band = (y0, h, out) => {
      this.box(cx, y0, cz - d / 2 - out / 2, w + out * 2, h, out, trim, deco);
      this.box(cx, y0, cz + d / 2 + out / 2, w + out * 2, h, out, trim, deco);
      this.box(cx - w / 2 - out / 2, y0, cz, out, h, d, trim, deco);
      this.box(cx + w / 2 + out / 2, y0, cz, out, h, d, trim, deco);
    };
    band(0, 0.45, 0.1);                 // zócalo
    band(H1 - 0.05, 0.2, 0.08);         // imposta entre pisos
    band(H - 0.35, 0.35, 0.18);         // cornisa
    const N = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
    const awn = o.awning || ['roofRed', 'roofBlue', 'cGreen', 'cOrange'][Math.abs(Math.round(cx * 3 + cz * 7)) % 4];
    doors.forEach(side => {
      const at = side === 'e' || side === 'w' ? d / 6 : (side === 's' ? 0 : w / 4);
      const nv = N[side], along = side === 'e' || side === 'w';
      const px = along ? cx + nv[0] * (w / 2 + 0.45) : cx + at, pz = along ? cz + at : cz + nv[1] * (d / 2 + 0.45);
      this.box(px, 2.75, pz, along ? 0.9 : 2.7, 0.14, along ? 2.7 : 0.9, awn, deco);
    });
    ['n', 's', 'e', 'w'].forEach(side => {
      const L = side === 'e' || side === 'w' ? d : w, nv = N[side], along = side === 'e' || side === 'w';
      [-L / 4, L / 4].forEach(at => {
        if ((side === 'n' && at < 0) || (side === 'e' && at > 0)) return;
        const px = along ? cx + nv[0] * (w / 2 + 0.12) : cx + at, pz = along ? cz + at : cz + nv[1] * (d / 2 + 0.12);
        this.box(px, H1 + 0.88, pz, along ? 0.24 : 1.8, 0.12, along ? 1.8 : 0.24, trim, deco);
      });
    });
    return H + 0.3;
  };

  // Puente/pasarela recta con barandillas (eje X o Z) entre dos puntos a altura y
  Builder.prototype.bridge = function (x0, z0, x1, z1, y, w, mat, o) {
    o = o || {};
    w = w || 2.2;
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    this.slab(cx, cz, y, alongX ? L : w, alongX ? w : L, 0.3, mat || 'plank');
    if (o.rails !== false) {
      // seeRails: barandilla calada (las balas pasan y se dibuja con postes y barras)
      if (o.seeRails) this._see = true;
      const a = alongX ? Math.min(x0, x1) : Math.min(z0, z1), b = a + L;
      const gaps = o.gaps || [];
      if (alongX) {
        this.wallSeg('x', cz - w / 2 + 0.06, a, b, y, 0.9, 0.12, gaps.filter(g => g.side !== 's'), o.railMat || 'rail');
        this.wallSeg('x', cz + w / 2 - 0.06, a, b, y, 0.9, 0.12, gaps.filter(g => g.side === 's'), o.railMat || 'rail');
      } else {
        this.wallSeg('z', cx - w / 2 + 0.06, a, b, y, 0.9, 0.12, gaps.filter(g => g.side !== 'e'), o.railMat || 'rail');
        this.wallSeg('z', cx + w / 2 - 0.06, a, b, y, 0.9, 0.12, gaps.filter(g => g.side === 'e'), o.railMat || 'rail');
      }
      this._see = false;
    }
    if (o.supports) {
      const n = Math.max(1, Math.floor(L / 7));
      for (let i = 1; i <= n; i++) {
        const k = i / (n + 1);
        const px = alongX ? Math.min(x0, x1) + L * k : cx, pz = alongX ? cz : Math.min(z0, z1) + L * k;
        this.pillar(px, 0, pz, 0.45, y - 0.3, o.supportMat || 'woodDark');
      }
    }
  };

  // Torre de francotirador maciza con pretil y escalera de mano en la cara "side"
  Builder.prototype.tower = function (x, z, h, s, mat, side, o) {
    o = o || {};
    side = side || 's';
    s = s || 3.4;
    this.checkFree(x - s / 2, z - s / 2, x + s / 2, z + s / 2, 'torre');
    this.box(x, 0, z, s, h, s, mat);
    this.ring(x, z, h, s + 0.4, s + 0.4, 1, 0.3, o.trim || mat, [{ side, at: 0, w: 1.4 }]);
    this.box(x, h - 0.4, z, s + 0.5, 0.4, s + 0.5, o.trim || mat, { solid: false });
    this.box(x, 0, z, s + 0.2, 0.5, s + 0.2, o.trim || mat, { solid: false });
    const f = { n: [0, -1, '+z'], s: [0, 1, '-z'], e: [1, 0, '-x'], w: [-1, 0, '+x'] }[side];
    this.ladder(x + f[0] * s / 2, z + f[1] * s / 2, 0, h, f[2], { metal: !!o.metal });
    if (o.roof) {
      // tejadillo sobre 4 postes (deja hueco para disparar)
      const k = s / 2 - 0.1;
      [[-k, -k], [k, -k], [-k, k], [k, k]].forEach(([px, pz]) => this.pillar(x + px, h, z + pz, 0.25, 2.4, o.postMat || 'woodDark'));
      this.slab(x, z, h + 2.7, s + 0.8, s + 0.8, 0.3, o.roof);
    }
    return h;
  };

  // Plataforma elevada (desnivel del terreno) con rampas/escaleras en los lados pedidos
  // sides: subconjunto de ['n','s','e','w']; o.stairs: usar escalones en vez de rampa
  Builder.prototype.platform = function (x, z, w, d, h, mat, sides, o) {
    o = o || {};
    this.checkFree(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'plataforma');
    this.box(x, 0, z, w, h, d, mat);
    const len = o.len || Math.max(2.4, h * (o.stairs ? 2 : 2.6));
    const rw = o.rw || Math.min(o.stairs ? 2.2 : 3, (sides && sides.length ? 1 : 1) * Math.min(w, d) * 0.7);
    (sides || []).forEach(sd => {
      const fn = o.stairs ? 'stairs' : 'ramp';
      const m = o.rampMat || mat;
      if (sd === 'e') this[fn](x + w / 2 + len / 2, z, 0, rw, len, h, '-x', m);
      if (sd === 'w') this[fn](x - w / 2 - len / 2, z, 0, rw, len, h, '+x', m);
      if (sd === 's') this[fn](x, z + d / 2 + len / 2, 0, rw, len, h, '-z', m);
      if (sd === 'n') this[fn](x, z - d / 2 - len / 2, 0, rw, len, h, '+z', m);
    });
    if (o.rim) this.ring(x, z, h, w, d, 0.8, 0.3, o.rim, sides.map(sd => ({ side: sd, at: 0, w: rw + 0.2 })));
    return h;
  };

  // -------------------------------------------------------------------------
  // Piezas de detalle (v6): todas respetan with() y tienen colisión sencilla
  // -------------------------------------------------------------------------

  // Roca (cobertura): caja de colisión + roca low-poly. s = tamaño aproximado
  Builder.prototype.rock = function (x, z, s, o) {
    o = o || {};
    s = s || 1.6;
    const h = s * (o.flat ? 0.55 : 0.8);
    this.box(x, 0, z, s * 0.9, h, s * 0.8, 'invisible');
    this.decoAt('rock', x, 0, z, { s, h, color: o.color, snow: !!o.snow, rotY: o.rotY || 0 });
  };

  // Valla baja de madera (postes + 2 travesaños). Se puede saltar (1 m) y las balas pasan entre las tablas.
  Builder.prototype.fence = function (x0, z0, x1, z1, o) {
    o = o || {};
    const h = o.h || 1, mat = o.mat || 'wood', alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const deco = { solid: false };
    // colisión: un único panel delgado que no para balas
    this.box(cx, 0, cz, alongX ? L : 0.12, h, alongX ? 0.12 : L, 'invisible', { see: true });
    const n = Math.max(1, Math.round(L / 2));
    for (let i = 0; i <= n; i++) {
      const t = -L / 2 + L * i / n;
      this.box(alongX ? cx + t : cx, 0, alongX ? cz : cz + t, 0.16, h + 0.1, 0.16, mat, deco);
    }
    for (const y of [h * 0.35, h * 0.8]) this.box(cx, y, cz, alongX ? L : 0.08, 0.12, alongX ? 0.08 : L, mat, deco);
  };

  // Cobertizo abierto: 4 postes y tejado plano (no se sube; da sombra y cobertura de arriba)
  Builder.prototype.shed = function (x, z, w, d, h, roofMat, o) {
    o = o || {};
    const pm = o.postMat || 'woodDark', k = 0.2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => this.pillar(x + sx * (w / 2 - k), 0, z + sz * (d / 2 - k), 0.3, h, pm));
    this.slab(x, z, h + 0.25, w + 0.6, d + 0.6, 0.25, roofMat || 'roofRed');
    this.box(x, h - 0.2, z - d / 2 + k, w, 0.2, 0.2, pm, { solid: false });
    this.box(x, h - 0.2, z + d / 2 - k, w, 0.2, 0.2, pm, { solid: false });
  };

  // Pasarela peatonal con rampas en los dos extremos (cruza muretes, arroyos…)
  Builder.prototype.footbridge = function (x, z0, z1, y, w, mat, o) {
    o = o || {};
    w = w || 2;
    const zA = Math.min(z0, z1), zB = Math.max(z0, z1), rl = o.rampLen || Math.max(2.4, y * 2.6);
    this.bridge(x, zA, x, zB, y, w, mat || 'plank', { railMat: o.railMat || 'woodDark', seeRails: true });
    this.ramp(x, zA - rl / 2, 0, w, rl, y, '+z', mat || 'plank');
    this.ramp(x, zB + rl / 2, 0, w, rl, y, '-z', mat || 'plank');
  };

  // Vía de tren (sólo decoración en el suelo): traviesas + dos raíles
  Builder.prototype.track = function (x0, x1, z) {
    const L = x1 - x0, cx = (x0 + x1) / 2, deco = { solid: false };
    for (let x = x0 + 0.4; x < x1; x += 0.9) this.box(x, 0, z, 0.35, 0.08, 2.4, 'woodDark', deco);
    this.box(cx, 0.08, z - 0.72, L, 0.1, 0.1, 'steel', deco);
    this.box(cx, 0.08, z + 0.72, L, 0.1, 0.1, 'steel', deco);
  };

  // Murete de sacos terreros / cobertura baja (L opcional)
  Builder.prototype.sandbags = function (x, z, len, alongX, mat, h) {
    h = h || 1.1;
    if (alongX) this.box(x, 0, z, len, h, 0.9, mat || 'sandbag');
    else this.box(x, 0, z, 0.9, h, len, mat || 'sandbag');
  };

  // -------------------------------------------------------------------------
  // Utilidades de consulta (spawns, validación)
  // -------------------------------------------------------------------------
  function rampSurfaceAt(r, x, z) {
    let t;
    if (r.dir === '+x') t = (x - r.minX) / (r.maxX - r.minX);
    else if (r.dir === '-x') t = (r.maxX - x) / (r.maxX - r.minX);
    else if (r.dir === '+z') t = (z - r.minZ) / (r.maxZ - r.minZ);
    else t = (r.maxZ - z) / (r.maxZ - r.minZ);
    return r.y0 + r.h * Math.max(0, Math.min(1, t));
  }

  // -------------------------------------------------------------------------
  // CARAS VISIBLES (sólo para el dibujo, el cliente): de cada caja quita las
  // partes de sus caras que quedan tapadas por otra caja opaca (paredes unidas,
  // cajas apoyadas, el lado de abajo pegado al suelo) y, cuando dos caras están
  // en el mismo plano mirando al mismo lado, deja sólo una. Así:
  //   · no hay parpadeo (z-fighting) entre piezas que se solapan,
  //   · no salen líneas en medio de una pared hecha con varios tramos,
  //   · se dibujan muchos menos triángulos (y menos píxeles repetidos).
  // Devuelve, por caja visible, sus 6 caras como listas de rectángulos
  // [u0, u1, v0, v1] en los ejes u = (eje+1)%3, v = (eje+2)%3.
  // -------------------------------------------------------------------------
  const LO = (b, a) => a === 0 ? b.minX : a === 1 ? b.minY : b.minZ;
  const HI = (b, a) => a === 0 ? b.maxX : a === 1 ? b.maxY : b.maxZ;
  const FACE_KEYS = ['nx', 'px', 'ny', 'py', 'nz', 'pz'];
  function subtractRect(rects, o, E) {
    const out = [];
    for (const r of rects) {
      if (o[1] <= r[0] + E || o[0] >= r[1] - E || o[3] <= r[2] + E || o[2] >= r[3] - E) { out.push(r); continue; }
      if (o[0] > r[0] + E) out.push([r[0], o[0], r[2], r[3]]);
      if (o[1] < r[1] - E) out.push([o[1], r[1], r[2], r[3]]);
      const m0 = Math.max(r[0], o[0]), m1 = Math.min(r[1], o[1]);
      if (o[2] > r[2] + E) out.push([m0, m1, r[2], o[2]]);
      if (o[3] < r[3] - E) out.push([m0, m1, o[3], r[3]]);
    }
    return out;
  }
  function cullFaces(boxes, opts) {
    opts = opts || {};
    const E = 1e-4, CELL = 4;
    // No tapan nada: cristal, cajas invisibles y barandillas (se dibujan caladas)
    const clear = b => { const m = MATERIALS[b.mat] || {}; return !!(m.transparent || m.invisible || m.see); };
    const occ = boxes.map(b => b.vis && !clear(b));
    // Rejilla en XZ para no comparar cada caja con todas
    const grid = new Map();
    const cells = (b, fn) => {
      const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL), z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) fn(x + ',' + z);
    };
    boxes.forEach((b, i) => { if (occ[i] && b.maxY < 70) cells(b, k => { let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); }); });
    return boxes.map((A, i) => {
      if (!A.vis) return null;
      const near = new Set();
      // margen de una celda: las cajas que tocan justo el borde también cuentan
      cells({ minX: A.minX - 0.01, maxX: A.maxX + 0.01, minZ: A.minZ - 0.01, maxZ: A.maxZ + 0.01 }, k => { const l = grid.get(k); if (l) for (const j of l) if (j !== i) near.add(j); });
      const res = {};
      for (let a = 0; a < 3; a++) {
        const u = (a + 1) % 3, v = (a + 2) % 3;
        for (const s of [-1, 1]) {
          const key = FACE_KEYS[a * 2 + (s > 0 ? 1 : 0)];
          const c = s > 0 ? HI(A, a) : LO(A, a);
          let rects = [[LO(A, u), HI(A, u), LO(A, v), HI(A, v)]];
          if (opts.ground && a === 1 && s < 0 && c <= 0.002) { res[key] = []; continue; }   // pegada al suelo
          const q = c + s * E * 10;
          for (const j of near) {
            const B = boxes[j];
            const o = [LO(B, u), HI(B, u), LO(B, v), HI(B, v)];
            if (o[1] <= LO(A, u) + E || o[0] >= HI(A, u) - E || o[3] <= LO(A, v) + E || o[2] >= HI(A, v) - E) continue;
            let hidden = LO(B, a) < q && q < HI(B, a);
            if (!hidden) {
              // Mismo plano y mismo sentido: se queda una sola (la de la caja que va después)
              const bc = s > 0 ? HI(B, a) : LO(B, a);
              if (Math.abs(bc - c) < E * 10 && (occ[i] ? j > i : true)) hidden = true;
            }
            if (hidden) { rects = subtractRect(rects, o, E); if (!rects.length) break; }
          }
          res[key] = rects;
        }
      }
      return res;
    });
  }
  // Aristas "de verdad" de una caja (esquinas donde se ven las dos caras):
  // devuelve segmentos [x0,y0,z0,x1,y1,z1]. Las juntas entre tramos no salen.
  function boxEdges(b, faces, step) {
    step = step || 0.5;
    const out = [], E = 2e-3;
    const inside = (rects, pu, pv) => rects.some(r => pu >= r[0] - E && pu <= r[1] + E && pv >= r[2] - E && pv <= r[3] + E);
    // Una arista: eje "a" a lo largo; fija las otras dos coordenadas
    for (let a = 0; a < 3; a++) {
      const b1 = (a + 1) % 3, b2 = (a + 2) % 3;
      for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
        const c1 = s1 > 0 ? HI(b, b1) : LO(b, b1), c2 = s2 > 0 ? HI(b, b2) : LO(b, b2);
        const f1 = faces[FACE_KEYS[b1 * 2 + (s1 > 0 ? 1 : 0)]], f2 = faces[FACE_KEYS[b2 * 2 + (s2 > 0 ? 1 : 0)]];
        if (!f1 || !f2 || !f1.length || !f2.length) continue;
        const t0 = LO(b, a), t1 = HI(b, a), L = t1 - t0;
        const n = Math.max(2, Math.ceil(L / step));
        let run = null;
        const P = t => { const p = [0, 0, 0]; p[a] = t; p[b1] = c1; p[b2] = c2; return p; };
        // en la cara f1 (eje b1) los ejes u,v son (b1+1)%3,(b1+2)%3
        const uv = (axis, p) => [p[(axis + 1) % 3], p[(axis + 2) % 3]];
        for (let k = 0; k <= n; k++) {
          const t = t0 + L * k / n, p = P(t);
          const a1 = uv(b1, p), a2 = uv(b2, p);
          const vis = inside(f1, a1[0], a1[1]) && inside(f2, a2[0], a2[1]);
          if (vis && run === null) run = t;
          if ((!vis || k === n) && run !== null) {
            const end = vis ? t : t0 + L * (k - 1) / n;
            if (end - run > 0.05) out.push(P(run).concat(P(end)));
            run = null;
          }
        }
      }
    }
    return out;
  }

  return { MATERIALS, DIRV, Builder, rampSurfaceAt, cullFaces, boxEdges, FACE_KEYS };
});
