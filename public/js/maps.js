// ============================================================================
// maps.js — Renderizador de mapas (Three.js) a partir de shared/mapdefs.js
// Geometría fusionada por material (pocas draw calls), texturas procedurales,
// decoración, cielo y miniaturas cenitales para el lobby.
// ============================================================================

window.MapRenderer = (function () {
  'use strict';

  const MB = window.MapBuilder;
  const MapDefs = window.MapDefs;

  // ---------------------------------------------------------------------------
  // Texturas procedurales (canvas) — se cachean por material
  // ---------------------------------------------------------------------------
  const texCache = {};
  function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
  function shade(c, f) {
    const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f)) | 0;
    const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f)) | 0;
    const b = Math.min(255, Math.max(0, (c & 255) * f)) | 0;
    return `rgb(${r},${g},${b})`;
  }
  function rng(seed) { let s = seed || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  // Filtrado anisótropo: texturas nítidas en ángulos rasantes (suelo, paredes)
  let ANISO = 1;
  function setAnisotropy(n) {
    n = Math.max(1, n | 0);
    if (n === ANISO) return;
    ANISO = n;
    Object.keys(texCache).forEach(k => { texCache[k].anisotropy = n; texCache[k].needsUpdate = true; });
  }
  // <tex> Dibujo de los patrones procedurales (todo «envuelve» por los bordes: sin costuras al repetir)
  function paintPattern(g, m, N, R) {
    const c = m.color;
    const wrap = (x, y, r, fn) => {      // dibuja también en el lado opuesto si toca un borde
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        if (x + ox + r < 0 || x + ox - r > N || y + oy + r < 0 || y + oy - r > N) continue;
        fn(x + ox, y + oy);
      }
    };
    const speck = (n, a, b, smin, smax) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = shade(c, a + R() * (b - a));
        const sz = (smin || 1) + R() * ((smax || 3) - (smin || 1));
        const x = R() * N, y = R() * N;
        wrap(x, y, sz, (X, Y) => g.fillRect(X, Y, sz, sz));
      }
    };
    // Manchas suaves grandes (desgaste, humedad, sol): rompen la repetición
    const blotch = (n, rmin, rmax, dark, light) => {
      for (let i = 0; i < n; i++) {
        const x = R() * N, y = R() * N, r = rmin + R() * (rmax - rmin);
        const d = R() < 0.6;
        const a = d ? dark : light;
        wrap(x, y, r, (X, Y) => {
          const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
          gr.addColorStop(0, d ? `rgba(30,22,14,${a})` : `rgba(255,250,235,${a})`);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2);
        });
      }
    };
    const line = (x0, y0, x1, y1, col, w) => { g.strokeStyle = col; g.lineWidth = w || 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    // Junta con volumen: línea oscura + filo claro debajo (parece hundida)
    const jointH = (x0, x1, y, w, k) => { line(x0, y, x1, y, shade(c, k || 0.62), w); line(x0, y + w * 0.5 + 0.6, x1, y + w * 0.5 + 0.6, shade(c, 1.12), 0.8); };
    const jointV = (x, y0, y1, w, k) => { line(x, y0, x, y1, shade(c, k || 0.62), w); line(x + w * 0.5 + 0.6, y0, x + w * 0.5 + 0.6, y1, shade(c, 1.1), 0.8); };
    // Veta de madera: líneas onduladas finas
    const grain = (x0, y0, w, h, vertical) => {
      const n = 3 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const o = (vertical ? w : h) * (0.15 + 0.7 * R()), amp = 0.6 + R() * 1.2, ph = R() * 6;
        g.strokeStyle = shade(c, 0.78 + R() * 0.1); g.lineWidth = 0.7; g.beginPath();
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const L = vertical ? h : w, q = Math.sin(t * 9 + ph) * amp;
          const X = vertical ? x0 + o + q : x0 + t * L, Y = vertical ? y0 + t * L : y0 + o + q;
          if (t === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
        }
        g.stroke();
      }
      if (R() < 0.45) {   // nudo
        const kx = vertical ? x0 + w * (0.3 + R() * 0.4) : x0 + R() * w, ky = vertical ? y0 + R() * h : y0 + h * (0.3 + R() * 0.4);
        g.fillStyle = shade(c, 0.62); g.beginPath(); g.ellipse(kx, ky, vertical ? 1.4 : 2.6, vertical ? 2.6 : 1.4, 0, 0, 7); g.fill();
        g.strokeStyle = shade(c, 0.75); g.lineWidth = 0.6; g.beginPath(); g.ellipse(kx, ky, vertical ? 2.4 : 4, vertical ? 4 : 2.4, 0, 0, 7); g.stroke();
      }
    };
    g.fillStyle = hex(c); g.fillRect(0, 0, N, N);
    switch (m.pattern) {
      case 'noise': {
        // En colores muy claros (nieve, arena) la variación es más suave: si no, parece sucio
        const lum = (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11) / 255;
        const k = lum > 0.75 ? 0.4 : lum > 0.6 ? 0.7 : 1;
        blotch(9, 14, 34, 0.14 * k, 0.1);
        speck(700, 1 - 0.2 * k, 1 + 0.16 * k, 1, 3);
        speck(160, 1 - 0.3 * k, 1 - 0.1 * k, 2, 5);
        if (c === MB.MATERIALS.asphalt.color) for (let i = 0; i < 4; i++) { let x = R() * N, y = R() * N; g.strokeStyle = shade(c, 0.6); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (R() - 0.5) * 16; y += (R() - 0.5) * 16; g.lineTo(x, y); } g.stroke(); }
        break;
      }
      case 'blocks':
        for (let row = 0; row < 4; row++) {
          const y = row * 32, off = row % 2 ? 32 : 0, tint = [0.88 + R() * 0.2, 0.88 + R() * 0.2];
          for (let k = -1; k < 2; k++) {
            const x = off + k * 64;
            g.fillStyle = shade(c, tint[(k + 2) % 2]); g.fillRect(x + 2, y + 2, 60, 28);
            // canto superior iluminado y sombra abajo: cada bloque con relieve
            g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 2, y + 2, 60, 2);
            g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 2, y + 28, 60, 2);
            if (R() < 0.35) { g.fillStyle = shade(c, 0.7); const cx = x + 4 + R() * 54, cy = y + 4 + R() * 22; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 4, cy + 1); g.lineTo(cx + 1, cy + 4); g.fill(); }
          }
        }
        blotch(6, 14, 30, 0.13, 0.08);
        speck(380, 0.86, 1.1, 1, 2.5);
        for (let row = 0; row < 4; row++) {
          const y = row * 32, off = row % 2 ? 32 : 0;
          jointH(0, N, y, 2.6, 0.6);
          for (let x = off; x <= N; x += 64) jointV(x, y, y + 32, 2.6, 0.6);
        }
        break;
      case 'brick': {
        const mortar = shade(c, 0.55);
        for (let row = 0; row < 8; row++) {
          const y = row * 16, off = row % 2 ? 16 : 0, tint = [0, 1, 2, 3].map(() => 0.82 + R() * 0.28);
          for (let x = off - 32; x < N; x += 32) {
            g.fillStyle = shade(c, tint[(((x - off) / 32) % 4 + 4) % 4]); g.fillRect(x + 1, y + 1, 30, 14);
            g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 1, y + 1, 30, 1.5);
          }
        }
        blotch(6, 12, 28, 0.15, 0.07);
        speck(260, 0.82, 1.12, 1, 2);
        // mortero más claro y grisáceo, como los ladrillos de verdad
        g.strokeStyle = 'rgba(205,195,180,0.55)';
        for (let row = 0; row < 8; row++) {
          const y = row * 16, off = row % 2 ? 16 : 0;
          line(0, y, N, y, mortar, 2); line(0, y, N, y, 'rgba(200,190,175,0.45)', 1.2);
          for (let x = off; x <= N; x += 32) { line(x, y, x, y + 16, mortar, 2); line(x, y, x, y + 16, 'rgba(200,190,175,0.45)', 1.2); }
        }
        break;
      }
      case 'planks':
        for (let row = 0; row < 6; row++) {
          const y = row * (N / 6), h = N / 6;
          g.fillStyle = shade(c, 0.84 + R() * 0.24); g.fillRect(0, y, N, h);
          grain(0, y, N, h, false);
          // testa de la tabla (corte) y clavos
          const cut = R() * N;
          line(cut, y, cut, y + h, shade(c, 0.58), 1.5);
          g.fillStyle = shade(c, 0.45); [cut - 4, cut + 4].forEach(x => { g.fillRect(((x % N) + N) % N, y + 4, 1.5, 1.5); g.fillRect(((x % N) + N) % N, y + h - 5, 1.5, 1.5); });
          jointH(0, N, y, 2, 0.52);
        }
        blotch(5, 16, 32, 0.12, 0.06);
        break;
      case 'planksV':
        for (let col = 0; col < 6; col++) {
          const x = col * (N / 6), w = N / 6;
          g.fillStyle = shade(c, 0.84 + R() * 0.24); g.fillRect(x, 0, w, N);
          grain(x, 0, w, N, true);
          jointV(x, 0, N, 2, 0.52);
        }
        blotch(5, 16, 32, 0.12, 0.06);
        break;
      case 'straw':
        speck(200, 0.9, 1.1);
        for (let i = 0; i < 260; i++) { const x = R() * N, y = R() * N; line(x, y, x + 8 + R() * 14, y + (R() - 0.5) * 5, shade(c, 0.7 + R() * 0.45), 1.4); }
        for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(80,50,10,' + (0.05 * (10 - k) / 10) + ')'; g.fillRect(0, k * 2, N, 2); g.fillRect(0, N - k * 2 - 2, N, 2); }
        [N * 0.3, N * 0.7].forEach(x => { line(x, 0, x, N, shade(c, 0.5), 5); line(x + 2, 0, x + 2, N, shade(c, 1.15), 1.2); });
        break;
      case 'tiles':
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { g.fillStyle = shade(c, 0.93 + R() * 0.12); g.fillRect(tx * 64, ty * 64, 64, 64); }
        blotch(4, 14, 30, 0.08, 0.06);
        speck(150, 0.94, 1.06);
        for (let i = 0; i <= N; i += 64) { line(i, 0, i, N, shade(c, 0.76), 2); line(0, i, N, i, shade(c, 0.76), 2); }
        break;
      case 'ribs':
        for (let x = 0; x < N; x += 16) { g.fillStyle = shade(c, 1.12); g.fillRect(x, 0, 6, N); g.fillStyle = shade(c, 0.76); g.fillRect(x + 6, 0, 2, N); g.fillStyle = shade(c, 0.92); g.fillRect(x + 8, 0, 8, N); }
        // churretes de óxido/suciedad que bajan desde arriba
        for (let i = 0; i < 7; i++) {
          const x = R() * N, w = 2 + R() * 5, h = 30 + R() * 80, y = R() * N;
          const gr = g.createLinearGradient(0, y, 0, y + h);
          gr.addColorStop(0, 'rgba(70,40,20,0.22)'); gr.addColorStop(1, 'rgba(70,40,20,0)');
          g.fillStyle = gr; wrap(x, y, Math.max(w, h), (X, Y) => g.fillRect(X, Y, w, h));
        }
        blotch(4, 14, 30, 0.1, 0.06);
        speck(120, 0.8, 1.05);
        break;
      case 'panels':
        blotch(3, 18, 34, 0.06, 0.06);
        speck(80, 0.95, 1.05);
        line(0, 1, N, 1, shade(c, 0.7), 3); line(1, 0, 1, N, shade(c, 0.7), 3);
        line(0, 64, N, 64, shade(c, 0.82), 1.5);
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(4, 4, N - 8, 3);
        g.fillStyle = shade(c, 0.6);
        [[8, 8], [N - 10, 8], [8, N - 10], [N - 10, N - 10]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); });
        break;
      case 'shingles':
        for (let row = 0; row < 8; row++) {
          const y = row * 16, off = row % 2 ? 8 : 0;
          for (let x = -16 + off; x < N + 16; x += 16) {
            g.fillStyle = shade(c, 0.82 + R() * 0.28);
            g.beginPath(); g.arc(x + 8, y + 10, 9, 0, Math.PI); g.fill();
          }
          line(0, y, N, y, shade(c, 0.58), 1.5);
        }
        blotch(4, 16, 30, 0.12, 0.08);
        break;
      case 'crate':
        g.fillStyle = shade(c, 0.95); g.fillRect(0, 0, N, N);
        for (let k = 0; k < 4; k++) { const y = 12 + k * 26; line(12, y, N - 12, y, shade(c, 0.78), 1); }
        grain(12, 12, N - 24, N - 24, false);
        g.strokeStyle = shade(c, 0.6); g.lineWidth = 12; g.strokeRect(6, 6, N - 12, N - 12);
        line(12, 12, N - 12, N - 12, shade(c, 0.7), 10);
        g.fillStyle = shade(c, 0.4); [[9, 9], [N - 11, 9], [9, N - 11], [N - 11, N - 11]].forEach(([x, y]) => g.fillRect(x, y, 2.5, 2.5));
        speck(200, 0.85, 1.1);
        break;
      default:   // 'flat': color liso con una variación muy suave
        blotch(3, 20, 40, 0.05, 0.05);
        speck(120, 0.96, 1.04);
    }
  }
  // </tex>

  function makeTexture(name) {
    if (texCache[name]) return texCache[name];
    const m = MB.MATERIALS[name] || MB.MATERIALS.stone;
    const N = 128, RES = 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N * RES;
    const g = cv.getContext('2d');
    g.scale(RES, RES);
    const c = m.color;
    const R = rng(name.length * 977 + c % 1000);
    g.fillStyle = hex(c);
    g.fillRect(0, 0, N, N);
    paintPattern(g, m, N, R);
    // Grano fino y bisel suave en los bordes del mosaico (da relieve a todo)
    g.setTransform(1, 0, 0, 1, 0, 0);
    const img = g.getImageData(0, 0, cv.width, cv.height), px = img.data, W = cv.width;
    for (let i = 0; i < px.length; i += 4) {
      const n = (R() - 0.5) * (m.pattern === 'flat' ? 6 : 12);
      px[i] = Math.max(0, Math.min(255, px[i] + n)); px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + n)); px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + n));
    }
    g.putImageData(img, 0, 0);
    if (['tiles', 'panels', 'crate'].includes(m.pattern)) {
      const e = 3;
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, W, e); g.fillRect(0, 0, e, W);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, W - e, W, e); g.fillRect(W - e, 0, e, W);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ANISO;
    texCache[name] = tex;
    return tex;
  }

  const TEX_SCALE = { blocks: 3, brick: 2.5, planks: 2.4, planksV: 2.4, ribs: 2, panels: 3, shingles: 2, crate: 1.4, tiles: 3, noise: 4, straw: 1.6 };

  function makeMaterial(name) {
    const m = MB.MATERIALS[name] || MB.MATERIALS.stone;
    const opts = { map: makeTexture(name), vertexColors: true };
    if (m.transparent) { opts.transparent = true; opts.opacity = m.transparent; opts.depthWrite = false; opts.map = null; opts.color = m.color; }
    if (m.emissive) opts.emissive = new THREE.Color(m.emissive);
    return new THREE.MeshLambertMaterial(opts);
  }

  // ---------------------------------------------------------------------------
  // Buffer de geometría fusionada
  // ---------------------------------------------------------------------------
  function GeoBuf(scale) { this.p = []; this.n = []; this.u = []; this.i = []; this.c = []; this.s = scale || 3; }
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  GeoBuf.prototype.quad = function (a, b, c, d, baseY) {
    // a,b,c,d en sentido antihorario visto desde fuera.
    // Normal por el método de Newell (robusto con aristas degeneradas: caras triangulares de rampas)
    const P4 = [a, b, c, d];
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 4; k++) {
      const p = P4[k], q = P4[(k + 1) % 4];
      nx += (p[1] - q[1]) * (p[2] + q[2]);
      ny += (p[2] - q[2]) * (p[0] + q[0]);
      nz += (p[0] - q[0]) * (p[1] + q[1]);
    }
    const L = Math.hypot(nx, ny, nz);
    if (L < 1e-9) return;
    nx /= L; ny /= L; nz /= L;
    const base = this.p.length / 3, s = this.s;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    // baseY: pie de la caja entera (si la cara se ha partido, el degradado sigue siendo continuo)
    const minY = baseY !== undefined ? baseY : Math.min(a[1], b[1], c[1], d[1]);
    [a, b, c, d].forEach(v => {
      this.p.push(v[0], v[1], v[2]);
      this.n.push(nx, ny, nz);
      // Oclusión ambiental falsa: la base de las paredes y las caras inferiores más oscuras
      let k = 1;
      if (ny < -0.7) k = 0.62;
      else if (ny < 0.7) k = 0.66 + 0.34 * smooth(0, 1.4, v[1] - minY) - (v[1] < 0.05 ? 0.06 : 0);
      // Sombreado por orientación (estilo bloques): cada cara con su tono, los volúmenes se leen al instante
      if (ny < 0.7) k *= ax > az ? (nx > 0 ? 0.9 : 0.8) : (nz > 0 ? 0.95 : 0.85);
      // Variación de tono a gran escala (como el desgaste de una pared larga): la textura no se ve repetida
      if (this.macro) k *= 1 + 0.055 * Math.sin(v[0] * 0.21 + v[2] * 0.17) * Math.cos(v[2] * 0.23 - v[0] * 0.11 + v[1] * 0.05) + 0.03 * Math.sin((v[0] + v[1] * 0.7) * 0.53 + v[2] * 0.41);
      this.c.push(k, k, k);
      if (ay >= ax && ay >= az) this.u.push(v[0] / s, v[2] / s);
      else if (ax >= az) this.u.push(v[2] / s, v[1] / s);
      else this.u.push(v[0] / s, v[1] / s);
    });
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // Prisma con 4 vértices arriba y 4 abajo (sirve para cajas y rampas)
  GeoBuf.prototype.prism = function (x0, x1, z0, z1, top, bot) {
    // top/bot: alturas en las esquinas [x0z0, x1z0, x1z1, x0z1]
    const T = [[x0, top[0], z0], [x1, top[1], z0], [x1, top[2], z1], [x0, top[3], z1]];
    const B = [[x0, bot[0], z0], [x1, bot[1], z0], [x1, bot[2], z1], [x0, bot[3], z1]];
    this.quad(T[3], T[2], T[1], T[0]);           // arriba
    this.quad(B[0], B[1], B[2], B[3]);           // abajo
    this.quad(B[0], T[0], T[1], B[1]);           // -z
    this.quad(B[2], T[2], T[3], B[3]);           // +z
    this.quad(B[3], T[3], T[0], B[0]);           // -x
    this.quad(B[1], T[1], T[2], B[2]);           // +x
  };
  GeoBuf.prototype.box = function (b) {
    this.prism(b.minX, b.maxX, b.minZ, b.maxZ, [b.maxY, b.maxY, b.maxY, b.maxY], [b.minY, b.minY, b.minY, b.minY]);
  };
  // Sólo las partes visibles de las caras de una caja (ver MapBuilder.cullFaces)
  GeoBuf.prototype.faces = function (b, F) {
    const lo = [b.minX, b.minY, b.minZ], hi = [b.maxX, b.maxY, b.maxZ];
    for (let a = 0; a < 3; a++) {
      const u = (a + 1) % 3, v = (a + 2) % 3;
      for (const s of [-1, 1]) {
        const rects = F[MB.FACE_KEYS[a * 2 + (s > 0 ? 1 : 0)]];
        if (!rects) continue;
        const c = s > 0 ? hi[a] : lo[a];
        for (const r of rects) {
          const P = (uu, vv) => { const p = [0, 0, 0]; p[a] = c; p[u] = uu; p[v] = vv; return p; };
          const q = [P(r[0], r[2]), P(r[1], r[2]), P(r[1], r[3]), P(r[0], r[3])];
          if (s > 0) this.quad(q[0], q[1], q[2], q[3], b.minY);
          else this.quad(q[3], q[2], q[1], q[0], b.minY);
        }
      }
    }
  };
  GeoBuf.prototype.toGeometry = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  };

  function rampCorners(r) {
    const pts = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]];
    const top = pts.map(([x, z]) => MB.rampSurfaceAt(r, x, z));
    const bot = top.map(s => r.thick ? s - r.thick : r.y0);
    return { top, bot };
  }

  // ---------------------------------------------------------------------------
  // Decoración
  // ---------------------------------------------------------------------------
  const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  function mesh(geo, mat, x, y, z, cast) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (cast !== false) m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // Halo de luz barato (sprite aditivo): da sensación de luz sin luces reales
  let glowTex = null;
  function glowSprite(color, size) {
    if (!glowTex) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      glowTex = new THREE.CanvasTexture(cv);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(size, size, 1);
    return sp;
  }
  // Textura de ondas para el agua (se genera una vez)
  let waterTex = null;
  function waterTexture() {
    if (waterTex) return waterTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
    const R = rng(77);
    for (let i = 0; i < 60; i++) {
      const x = R() * 128, y = R() * 128, w = 10 + R() * 26;
      g.strokeStyle = `rgba(255,255,255,${0.35 + R() * 0.4})`; g.lineWidth = 1.5 + R() * 1.5;
      g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - 3, x + w / 2, y); g.stroke();
      g.strokeStyle = `rgba(120,150,190,${0.15 + R() * 0.2})`;
      g.beginPath(); g.moveTo(x - w / 2, y + 3); g.quadraticCurveTo(x, y + 6, x + w / 2, y + 3); g.stroke();
    }
    waterTex = new THREE.CanvasTexture(cv);
    waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    if (THREE.SRGBColorSpace) waterTex.colorSpace = THREE.SRGBColorSpace;
    return waterTex;
  }

  function buildDeco(d, root, anim) {
    const g = new THREE.Group();
    g.position.set(d.x, (d.y || 0) + (d._yo || 0), d.z);
    if (d.rotY) g.rotation.y = d.rotY;
    const s = d.s || 1;
    switch (d.type) {
      case 'tree': {
        g.add(mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 2.4 * s, 7), L(0x6b4423), 0, 1.2 * s, 0));
        const leaf = L(0x3f8f3a);
        g.add(mesh(new THREE.IcosahedronGeometry(1.5 * s, 0), leaf, 0, 3.0 * s, 0));
        g.add(mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), L(0x4ea644), 0.6 * s, 3.8 * s, 0.3 * s));
        break;
      }
      case 'palm': {
        const trunkM = L(0x9b7447);
        for (let i = 0; i < 6; i++) {
          const seg = mesh(new THREE.CylinderGeometry(0.2 * s, 0.26 * s, 0.75 * s, 7), trunkM, Math.sin(i * 0.5) * 0.25 * s, (0.38 + i * 0.7) * s, 0);
          seg.rotation.z = 0.06 * i; g.add(seg);
        }
        const leafM = L(0x3f9a3c, { side: THREE.DoubleSide });
        for (let i = 0; i < 7; i++) {
          const leaf = mesh(new THREE.ConeGeometry(0.42 * s, 2.6 * s, 4, 1, true), leafM, 0.6 * s, 4.3 * s, 0);
          leaf.rotation.set(0, (i / 7) * Math.PI * 2, Math.PI / 2 - 0.35);
          const piv = new THREE.Group(); piv.position.set(0.6 * s, 4.3 * s, 0); piv.rotation.y = (i / 7) * Math.PI * 2;
          leaf.position.set(1.15 * s, -0.25 * s, 0); leaf.rotation.set(0, 0, -Math.PI / 2 + 0.35);
          piv.add(leaf); g.add(piv);
        }
        g.add(mesh(new THREE.SphereGeometry(0.28 * s, 8, 6), L(0x6b4a2a), 0.6 * s, 4.15 * s, 0));
        break;
      }
      case 'billboard': {
        g.add(mesh(new THREE.BoxGeometry(7, 3, 0.25), L(d.color || 0x2f6fb5), 0, 1.5, 0));
        g.add(mesh(new THREE.BoxGeometry(6.2, 0.5, 0.27), L(0xffffff), 0, 2.2, 0, false));
        g.add(mesh(new THREE.BoxGeometry(4, 0.35, 0.27), L(0xffd27a), -0.8, 1.2, 0, false));
        const e = mesh(new THREE.SphereGeometry(0.55, 14, 10), L(0xfff1dc), 2.3, 1.1, 0.2); e.scale.set(1, 1.3, 0.5); g.add(e);
        break;
      }
      case 'tire': {
        const t = mesh(new THREE.TorusGeometry(0.45, 0.2, 8, 16), L(0x1d1d1f), 0, 0.2, 0); t.rotation.x = Math.PI / 2; g.add(t);
        const t2 = mesh(new THREE.TorusGeometry(0.45, 0.2, 8, 16), L(0x232326), 0.1, 0.56, 0.05); t2.rotation.x = Math.PI / 2 + 0.2; g.add(t2);
        break;
      }
      case 'boat': {
        g.add(mesh(new THREE.BoxGeometry(1.8, 0.6, 4), L(0xf4f1ea), 0, 0.35, 0));
        g.add(mesh(new THREE.BoxGeometry(1.9, 0.18, 4.1), L(d.color || 0x2f6fb5), 0, 0.68, 0));
        const bow = mesh(new THREE.ConeGeometry(0.95, 1.2, 4), L(0xf4f1ea), 0, 0.35, -2.5); bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0); bow.scale.set(1, 1, 0.35); g.add(bow);
        g.add(mesh(new THREE.BoxGeometry(1.5, 0.12, 0.4), L(0x8a5a3a), 0, 0.62, 0.6));
        break;
      }
      case 'cactus': {
        const cm = L(0x4c9a4a);
        g.add(mesh(new THREE.CylinderGeometry(0.28, 0.32, 2, 8), cm, 0, 1, 0));
        g.add(mesh(new THREE.SphereGeometry(0.28, 8, 6), cm, 0, 2, 0));
        const arm = (x, y, h) => { const a1 = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 6), cm, x * 0.5, y, 0); a1.rotation.z = Math.PI / 2; g.add(a1); g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, h, 6), cm, x * 0.75, y + h / 2, 0)); };
        arm(1, 0.9, 0.7); arm(-1, 1.3, 0.5);
        break;
      }
      case 'pine': {
        g.add(mesh(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 1.4 * s, 6), L(0x5d3b22), 0, 0.7 * s, 0));
        const nm = L(0x2f6b3c), sm = L(0xf4f8fb);
        [[1.9, 1.2, 2.2], [1.5, 2.2, 1.9], [1.05, 3.1, 1.6]].forEach(([r, y, h]) => {
          g.add(mesh(new THREE.ConeGeometry(r * s, h * s, 8), nm, 0, (y + h / 2) * s, 0));
          if (d.snow) g.add(mesh(new THREE.ConeGeometry(r * 0.62 * s, h * 0.42 * s, 8), sm, 0, (y + h * 0.82) * s, 0));
        });
        break;
      }
      case 'pan': {
        const r = d.r || 3;
        g.add(mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.35, 28), L(0x2b2b2e), 0, 0.17, 0));
        { const rim = mesh(new THREE.TorusGeometry(r, 0.14, 6, 28), L(0x3a3a3e), 0, 0.42, 0, false); rim.rotation.x = Math.PI / 2; g.add(rim); }
        const handle = mesh(new THREE.BoxGeometry(r * 1.2, 0.28, 0.6), L(0x1e1e20), r * 1.55, 0.45, 0); g.add(handle);
        // huevo frito dentro
        g.add(mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.6, 0.12, 20), L(0xfdfbf3), -0.3, 0.4, 0.2, false));
        g.add(mesh(new THREE.SphereGeometry(r * 0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), L(0xf5b21b), -0.3, 0.45, 0.2, false));
        break;
      }
      case 'bigegg': {
        const e = mesh(new THREE.SphereGeometry(0.6 * s, 16, 12), L(d.color || 0xf3e3c6), 0, 0.75 * s, 0);
        e.scale.set(1, 1.3, 1); g.add(e);
        break;
      }
      case 'mug': {
        const col = d.color || 0x2f6fb5;
        g.add(mesh(new THREE.CylinderGeometry(1.5, 1.4, 3.6, 20), L(col), 0, 1.8, 0));
        g.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 20), L(0x4a2c17), 0, 3.4, 0, false));
        const h = mesh(new THREE.TorusGeometry(0.9, 0.22, 8, 16, Math.PI), L(col), 1.5, 1.8, 0);
        h.rotation.z = -Math.PI / 2; g.add(h);
        break;
      }
      case 'apple': {
        g.add(mesh(new THREE.SphereGeometry(0.8 * s, 14, 10), L(d.color || 0xc8322b), 0, 0.78 * s, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.4 * s, 5), L(0x5b3a1e), 0, 1.65 * s, 0));
        const lf = mesh(new THREE.SphereGeometry(0.22 * s, 6, 4), L(0x4c9a3c), 0.18 * s, 1.72 * s, 0); lf.scale.set(1.6, 0.3, 0.8); g.add(lf);
        break;
      }
      case 'barrel': {
        const col = d.color || [0xc0392b, 0x2f6fb5, 0x27ae60, 0xe67e22][Math.abs(Math.round(d.x * 7 + d.z * 3)) % 4];
        g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 12), L(col), 0, 0.65, 0));
        [0.2, 0.65, 1.1].forEach(y => g.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 12), L(0x2c3e50), 0, y, 0, false)));
        g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 12), L(0x3d4a55), 0, 1.31, 0, false));
        break;
      }
      case 'bush':
        g.add(mesh(new THREE.IcosahedronGeometry(0.95, 0), L(0x3e8d35), 0, 0.6, 0));
        g.add(mesh(new THREE.IcosahedronGeometry(0.7, 0), L(0x4ba543), 0.5, 0.75, 0.2));
        break;
      case 'torch': {
        g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6), L(0x5b3a1e), 0, 0, 0));
        const f = mesh(new THREE.ConeGeometry(0.16, 0.42, 6), new THREE.MeshBasicMaterial({ color: 0xffa31a }), 0, 0.5, 0, false);
        g.add(f);
        const gl = glowSprite(0xff9a3c, 1.6); gl.position.y = 0.55; g.add(gl);
        anim.push(t => { const k = Math.sin(t * 13 + d.x) * 0.18; f.scale.y = 1 + k; gl.material.opacity = 0.75 + k; });
        break;
      }
      case 'banner': {
        const col = d.color || 0xc0392b;
        g.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), L(0x5b3a1e), 0, 0.9, 0));
        const cloth = mesh(new THREE.PlaneGeometry(1.4, 2), L(col, { side: THREE.DoubleSide }), 0, -0.1, 0.05, false);
        cloth.rotation.y = Math.PI / 2;
        g.add(cloth);
        const egg = mesh(new THREE.CircleGeometry(0.35, 12), L(0xfff3d6, { side: THREE.DoubleSide }), 0.02, 0, 0, false);
        egg.scale.y = 1.3; egg.rotation.y = Math.PI / 2;
        g.add(egg);
        break;
      }
      case 'well':
        g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), L(0x5b3a1e), -0.9, 1.9, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), L(0x5b3a1e), 0.9, 1.9, 0));
        g.add(mesh(new THREE.ConeGeometry(1.5, 0.8, 4), L(0x8e3b2a), 0, 3.0, 0)).rotation.y = Math.PI / 4;
        g.add(mesh(new THREE.CircleGeometry(0.9, 12), L(0x2c6ea8), 0, 1.0, 0, false)).rotation.x = -Math.PI / 2;
        break;
      case 'cart':
        g.add(mesh(new THREE.BoxGeometry(1.3, 0.6, 2.2), L(0x8b5a2b), 0, 0.85, 0));
        [[-0.75, -0.6], [0.75, -0.6], [-0.75, 0.6], [0.75, 0.6]].forEach(([x, z]) => {
          const w = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 10), L(0x3d2b1f), x, 0.42, z);
          w.rotation.z = Math.PI / 2; g.add(w);
        });
        g.add(mesh(new THREE.BoxGeometry(1.1, 0.5, 1.9), L(0xe3bb4c), 0, 1.3, 0));
        break;
      case 'silo': {
        const r = d.r || 1.8, h = d.h || 9;
        g.add(mesh(new THREE.CylinderGeometry(r, r, h, 14), L(0xb9c2c9), 0, h / 2, 0));
        g.add(mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.25, 14), L(0x7f8c8d), 0, h * 0.33, 0));
        g.add(mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.25, 14), L(0x7f8c8d), 0, h * 0.66, 0));
        g.add(mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.15, 14), L(0x7f8c8d), 0, h, 0));
        break;
      }
      case 'tractor':
        g.add(mesh(new THREE.BoxGeometry(1.6, 1.0, 2.6), L(0x2e8b57), 0, 1.0, 0));
        g.add(mesh(new THREE.BoxGeometry(1.3, 1.0, 1.1), L(0x2e8b57), 0, 2.0, 0.5));
        [[-0.9, 0.7, 0.75], [0.9, 0.7, 0.75], [-0.85, -0.85, 0.5], [0.85, -0.85, 0.5]].forEach(([x, z, r]) => {
          const w = mesh(new THREE.CylinderGeometry(r, r, 0.4, 12), L(0x222222), x, r, z);
          w.rotation.z = Math.PI / 2; g.add(w);
        });
        break;
      case 'windmill': {
        g.add(mesh(new THREE.CylinderGeometry(0.6, 1.2, 12, 8), L(0xd5d8dc), 0, 6, 0));
        const hub = new THREE.Group(); hub.position.set(0, 12, -1);
        for (let i = 0; i < 3; i++) { const bl = mesh(new THREE.BoxGeometry(0.5, 5, 0.1), L(0xffffff), 0, 2.5, 0); const p = new THREE.Group(); p.rotation.z = i * 2.094; p.add(bl); hub.add(p); }
        g.add(hub);
        anim.push(t => { hub.rotation.z = t * 0.8; });
        break;
      }
      case 'trough':
        g.add(mesh(new THREE.BoxGeometry((d.w || 4) - 0.2, 0.05, (d.d || 1.1) - 0.2), L(0xc9a227), 0, 0.01, 0, false));
        break;
      case 'plane': {
        const hsl = new THREE.Color(d.color || 0x777777).getHSL({});
        const isWater = hsl.h > 0.5 && hsl.h < 0.62 && hsl.s > 0.45 && hsl.l < 0.62;
        if (isWater) {
          // Agua: textura de ondas que se desplaza y brillo especular
          const tex = waterTexture().clone(); tex.needsUpdate = true;
          tex.repeat.set(Math.max(1, d.w / 4), Math.max(1, d.d / 4));
          const wm = new THREE.MeshPhongMaterial({ color: d.color, map: tex, shininess: 120, specular: 0xbfe8ff, transparent: true, opacity: 0.9 });
          const p = mesh(new THREE.PlaneGeometry(d.w, d.d), wm, 0, 0, 0, false);
          p.rotation.x = -Math.PI / 2; p.receiveShadow = true;
          g.add(p);
          anim.push(t => { tex.offset.set(t * 0.03, Math.sin(t * 0.4) * 0.05); });
        } else {
          const p = mesh(new THREE.PlaneGeometry(d.w, d.d), L(d.color || 0x777777), 0, 0, 0, false);
          p.rotation.x = -Math.PI / 2;
          g.add(p);
        }
        break;
      }
      case 'water': {
        const p = mesh(new THREE.PlaneGeometry(d.size || 200, d.size || 200), L(0x2e86c1, { transparent: true, opacity: 0.92 }), 0, 0, 0, false);
        p.rotation.x = -Math.PI / 2;
        g.add(p);
        anim.push(t => { p.position.y = Math.sin(t * 0.8) * 0.06; });
        break;
      }
      case 'bollard':
        g.add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8), L(0x2c3e50), 0, 0.35, 0));
        break;
      case 'crane': {
        const beam = mesh(new THREE.BoxGeometry(d.w || 14, 0.8, 1), L(0xf1c40f), 0, 0.4, 0);
        g.add(beam);
        g.add(mesh(new THREE.BoxGeometry(d.w || 14, 0.8, 1), L(0xf1c40f), 0, 0.4, (d.d || 6) - 1));
        const trolley = mesh(new THREE.BoxGeometry(1.4, 1, (d.d || 6)), L(0x7f8c8d), 0, -0.2, (d.d || 6) / 2 - 0.5);
        g.add(trolley);
        g.position.z -= ((d.d || 6) - 1) / 2;
        anim.push(t => { trolley.position.x = Math.sin(t * 0.2) * ((d.w || 14) / 2 - 1.5); });
        break;
      }
      case 'forklift':
        g.add(mesh(new THREE.BoxGeometry(1.4, 1.2, 2), L(0xe67e22), 0, 0.9, 0));
        g.add(mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), L(0x333333), -0.5, 1.2, -1.05));
        g.add(mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), L(0x333333), 0.5, 1.2, -1.05));
        g.add(mesh(new THREE.BoxGeometry(1.2, 0.08, 1), L(0x333333), 0, 0.3, -1.6));
        break;
      case 'dome':
        g.add(mesh(new THREE.SphereGeometry(d.r || 2.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), L(0x85c1e9, { transparent: true, opacity: 0.55 }), 0, 0, 0, false));
        break;
      case 'antenna': {
        g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), L(0xbdc3c7), 0, 1.3, 0));
        const dish = mesh(new THREE.SphereGeometry(0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 3), L(0xecf0f1, { side: THREE.DoubleSide }), 0, 2.4, 0);
        dish.rotation.x = 0.7; g.add(dish);
        const led = mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 0, 2.65, 0, false);
        g.add(led);
        anim.push(t => { led.visible = Math.sin(t * 4) > 0; dish.rotation.y = t * 0.3; });
        break;
      }
      case 'crater': {
        const p = mesh(new THREE.RingGeometry((d.r || 2) * 0.6, d.r || 2, 18), L(0x6d6f73, { side: THREE.DoubleSide }), 0, 0, 0, false);
        p.rotation.x = -Math.PI / 2; g.add(p);
        break;
      }
      case 'padring': {
        const ring = mesh(new THREE.TorusGeometry((d.r || 1.1) * 0.9, 0.08, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffd166 }), 0, 0.05, 0, false);
        ring.rotation.x = -Math.PI / 2; g.add(ring);
        anim.push(t => { ring.scale.setScalar(1 + (t * 1.5 % 1) * 0.25); ring.material.opacity = 1; });
        break;
      }
      case 'fountain': {
        g.add(mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.1, 16), L(0x3498db), 0, 0.02, 0, false));
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.4, 8), L(0x95a5a6), 0, 0.7, 0));
        const egg = mesh(new THREE.SphereGeometry(0.5, 12, 10), L(0xfdfefe), 0, 1.9, 0);
        egg.scale.y = 1.3; g.add(egg);
        break;
      }
      case 'stall': {
        const aw = mesh(new THREE.BoxGeometry(3.2, 0.1, 2.2), L(d.color || 0xe74c3c), 0, 2.6, 0.5);
        aw.rotation.x = -0.15; g.add(aw);
        [[-1.4, -0.4], [1.4, -0.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), L(0x5b3a1e), x, 1.3, z)));
        break;
      }
      case 'car': {
        const col = d.color || 0xc0392b;
        g.add(mesh(new THREE.BoxGeometry(1.9, 0.7, 4.1), L(col), 0, 0.6, 0));
        g.add(mesh(new THREE.BoxGeometry(1.7, 0.6, 2.1), L(0xd6eaf8), 0, 1.2, -0.2));
        [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]].forEach(([x, z]) => {
          const w = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 10), L(0x1c1c1c), x, 0.36, z);
          w.rotation.z = Math.PI / 2; g.add(w);
        });
        break;
      }
      case 'lamp': {
        g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 6), L(0x2c3e50), 0, 1.8, 0));
        g.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), 0, 3.7, 0, false));
        { const gl = glowSprite(0xfff0b0, 2.2); gl.position.y = 3.7; gl.material.opacity = 0.55; g.add(gl); }
        break;
      }
      case 'rock': {
        // Roca low-poly (achatada) con un poco de nieve encima si toca
        const h = d.h || s * 0.8, col = d.color || 0x8a8d92;
        const r1 = mesh(new THREE.DodecahedronGeometry(0.5, 0), L(col, { flatShading: true }), 0, h * 0.45, 0);
        r1.scale.set(s * 0.95, h * 1.05, s * 0.85); r1.rotation.y = (d.x * 7 + d.z * 3) % 6; g.add(r1);
        const r2 = mesh(new THREE.DodecahedronGeometry(0.5, 0), L(new THREE.Color(col).multiplyScalar(0.88).getHex(), { flatShading: true }), s * 0.32, h * 0.25, s * 0.18);
        r2.scale.set(s * 0.55, h * 0.6, s * 0.5); g.add(r2);
        if (d.snow) { const c = mesh(new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), L(0xf4f8fb), 0, h * 0.82, 0, false); c.scale.set(s * 0.8, h * 0.35, s * 0.7); g.add(c); }
        break;
      }
      case 'snowman': {
        const sm = L(0xf6f9fc);
        g.add(mesh(new THREE.SphereGeometry(0.6, 12, 9), sm, 0, 0.55, 0));
        g.add(mesh(new THREE.SphereGeometry(0.44, 12, 9), sm, 0, 1.35, 0));
        g.add(mesh(new THREE.SphereGeometry(0.3, 12, 9), sm, 0, 1.95, 0));
        const nose = mesh(new THREE.ConeGeometry(0.06, 0.3, 6), L(0xe67e22), 0, 1.95, 0.38, false); nose.rotation.x = Math.PI / 2; g.add(nose);
        [-0.1, 0.1].forEach(x => g.add(mesh(new THREE.SphereGeometry(0.04, 6, 4), L(0x1a1a1a), x, 2.05, 0.27, false)));
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.32, 10), L(0x1c1c1c), 0, 2.36, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12), L(0x1c1c1c), 0, 2.2, 0, false));
        const sc = mesh(new THREE.TorusGeometry(0.33, 0.07, 6, 14), L(0xc0392b), 0, 1.66, 0, false); sc.rotation.x = Math.PI / 2; g.add(sc);
        break;
      }
      case 'bench': {
        const wd = L(0x9b6b3d), mt = L(0x2c3e50);
        g.add(mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), wd, 0, 0.48, 0));
        g.add(mesh(new THREE.BoxGeometry(1.8, 0.4, 0.07), wd, 0, 0.8, -0.24));
        [-0.75, 0.75].forEach(x => g.add(mesh(new THREE.BoxGeometry(0.08, 0.48, 0.5), mt, x, 0.24, 0)));
        break;
      }
      case 'planter': {
        g.add(mesh(new THREE.BoxGeometry(1.4, 0.6, 1.4), L(d.color || 0x9aa0a6), 0, 0.3, 0));
        g.add(mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), L(0x5b3a1e), 0, 0.6, 0, false));
        g.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 6), L(0x6b4423), 0, 1.4, 0));
        g.add(mesh(new THREE.IcosahedronGeometry(0.95, 0), L(0x4c9a3c, { flatShading: true }), 0, 2.5, 0));
        break;
      }
      case 'tank': {
        // Depósito cilíndrico vertical con aros, escalerilla pintada y tapa
        const r = d.r || 1.6, h = d.h || 6, col = d.color || 0xd5d8dc;
        g.add(mesh(new THREE.CylinderGeometry(r, r, h, 16), L(col), 0, h / 2, 0));
        g.add(mesh(new THREE.CylinderGeometry(r * 0.15, r, r * 0.45, 16), L(new THREE.Color(col).multiplyScalar(0.9).getHex()), 0, h + r * 0.22, 0));
        [0.25, 0.5, 0.75].forEach(k => g.add(mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.12, 16), L(0x7f8c8d), 0, h * k, 0, false)));
        g.add(mesh(new THREE.BoxGeometry(0.5, h, 0.06), L(0x5d6d7e), 0, h / 2, r + 0.03, false));
        break;
      }
      case 'sign': {
        g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), L(0x7f8c8d), 0, 1.1, 0));
        g.add(mesh(new THREE.BoxGeometry(1.1, 0.6, 0.05), L(d.color || 0x2f6fb5), 0, 2.1, 0));
        g.add(mesh(new THREE.BoxGeometry(0.8, 0.12, 0.06), L(0xffffff), 0, 2.1, 0, false));
        break;
      }
      case 'stripes': {
        // Paso de cebra / líneas pintadas (planos finos): d.n franjas a lo largo de d.w
        const n = d.n || 6, w = d.w || 4, len = d.d || 3, m = L(d.color || 0xf2f2ee);
        for (let i = 0; i < n; i++) { const p = mesh(new THREE.PlaneGeometry(w / (n * 2), len), m, -w / 2 + (i + 0.5) * w / n, 0.03, 0, false); p.rotation.x = -Math.PI / 2; p.castShadow = false; g.add(p); }
        break;
      }
      case 'fruitcrate': {
        g.add(mesh(new THREE.BoxGeometry(0.9, 0.45, 0.6), L(0xb8864b), 0, 0.22, 0));
        const fm = L(d.color || 0xe74c3c);
        for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.11, 6, 5), fm, -0.3 + (i % 3) * 0.3, 0.5, i < 3 ? -0.12 : 0.12, false));
        break;
      }
      case 'bell':
        g.add(mesh(new THREE.ConeGeometry(0.6, 0.9, 10, 1, true), L(0xd4ac0d, { side: THREE.DoubleSide }), 0, 2.3, 0));
        g.add(mesh(new THREE.BoxGeometry(0.15, 1.8, 0.15), L(0x5b3a1e), -1.6, 0.9, 0));
        g.add(mesh(new THREE.BoxGeometry(0.15, 1.8, 0.15), L(0x5b3a1e), 1.6, 0.9, 0));
        g.add(mesh(new THREE.BoxGeometry(3.4, 0.15, 0.15), L(0x5b3a1e), 0, 2.8, 0));
        break;
      default:
        return null;
    }
    root.add(g);
    return g;
  }

  // ---------------------------------------------------------------------------
  // Cielo
  // ---------------------------------------------------------------------------
  // Matas de hierba / piedrecitas instanciadas (no colisionan)
  // Sombras de contacto: un cuadrado difuminado bajo cada objeto apoyado en el
  // suelo. Todo en una sola malla → casi gratis y "asienta" mucho la escena.
  let contactTex = null;
  function buildContactShadows(data, root) {
    if (!contactTex) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      const img = g.createImageData(64, 64);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const dx = Math.max(0, Math.abs(x - 31.5) - 14) / 18, dy = Math.max(0, Math.abs(y - 31.5) - 14) / 18;
        const d = Math.min(1, Math.hypot(dx, dy));
        const a = Math.pow(1 - d, 2) * 255;
        const i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; img.data[i + 3] = a;
      }
      g.putImageData(img, 0, 0);
      contactTex = new THREE.CanvasTexture(cv);
    }
    const pos = [], uv = [], idx = [];
    const add = (x0, x1, z0, z1, y) => {
      const n = pos.length / 3;
      pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2);  // (DoubleSide: la orientación no importa)
    };
    for (const b of data.boxes) {
      const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
      if (b.maxY > 40 || w > 30 || d > 30 || w < 0.2 || d < 0.2) continue;
      if (b.solid === false) continue;
      if (!b.vis && b.mat !== 'invisible') continue;
      if (!b.vis && (w > 4 || d > 4)) continue;
      const m = Math.min(1.1, 0.35 + (b.maxY - b.minY) * 0.18);
      if (b.minY < 0.05) add(b.minX - m, b.maxX + m, b.minZ - m, b.maxZ + m, 0.025);
      else {
        // apoyado sobre otra caja: sombra sobre esa superficie
        const under = data.boxes.find(o => o !== b && Math.abs(o.maxY - b.minY) < 0.05 && b.minX >= o.minX - 0.5 && b.maxX <= o.maxX + 0.5 && b.minZ >= o.minZ - 0.5 && b.maxZ <= o.maxZ + 0.5);
        if (under) add(Math.max(under.minX, b.minX - m * 0.6), Math.min(under.maxX, b.maxX + m * 0.6), Math.max(under.minZ, b.minZ - m * 0.6), Math.min(under.maxZ, b.maxZ + m * 0.6), b.minY + 0.02);
      }
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    mesh.userData.detail = true;
    root.add(mesh);
  }

  // Flores y piedrecitas dispersas (sin colisión) para romper la monotonía del suelo
  function buildFlowers(data, root) {
    const gm = data.groundMat;
    if (['grass', 'dirt', 'sand', 'moon', 'snow'].indexOf(gm) < 0) return;
    const R = rng(data.id.length * 977 + 3);
    const h = data.halfSize - 2;
    const free = (x, z) => {
      for (const b of data.boxes) if (b.minY < 0.4 && b.maxY < 40 && x > b.minX - 0.5 && x < b.maxX + 0.5 && z > b.minZ - 0.5 && z < b.maxZ + 0.5) return false;
      for (const r of data.ramps) if (x > r.minX - 0.4 && x < r.maxX + 0.4 && z > r.minZ - 0.4 && z < r.maxZ + 0.4) return false;
      return true;
    };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    const make = (geo, n, place) => {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
      let k = 0;
      for (let i = 0; i < n * 4 && k < n; i++) {
        const x = (R() * 2 - 1) * h, z = (R() * 2 - 1) * h;
        if (!free(x, z)) continue;
        const c = place(x, z);
        e.set(0, R() * 6.3, 0); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(x, c.y || 0, z), q, new THREE.Vector3(c.s, c.sy || c.s, c.s));
        im.setMatrixAt(k, m4); im.setColorAt(k, col.setHex(c.color)); k++;
      }
      im.count = k; im.userData.detail = true; im.receiveShadow = true;
      root.add(im);
    };
    if (gm === 'grass') {
      const fl = new THREE.IcosahedronGeometry(0.09, 0); fl.translate(0, 0.22, 0);
      const pal = [0xffffff, 0xffe066, 0xff8fb1, 0xb59cff, 0xff6b4a];
      make(fl, 260, () => ({ s: 0.8 + R() * 0.6, color: pal[Math.floor(R() * pal.length)] }));
    }
    const rock = new THREE.DodecahedronGeometry(0.35, 0);
    const rc = { grass: 0x8e9196, dirt: 0x8a7a66, sand: 0xc9a46a, moon: 0x76787f, snow: 0xb7c3cc }[gm];
    make(rock, gm === 'grass' ? 40 : 70, () => { const s = 0.4 + R() * 0.9; const v = 0.85 + R() * 0.3; return { s, sy: s * 0.6, y: 0.05, color: new THREE.Color(rc).multiplyScalar(v).getHex() }; });
  }

  function buildGroundDetail(data, root) {
    const gm = data.groundMat;
    const grass = gm === 'grass', pebbles = gm === 'dirt' || gm === 'moon' || gm === 'mud';
    if (!grass && !pebbles) return;
    const R = rng(data.id.length * 131 + 7);
    const h = data.halfSize - 1.5;
    const free = (x, z) => {
      for (const b of data.boxes) if (b.minY < 0.4 && x > b.minX - 0.3 && x < b.maxX + 0.3 && z > b.minZ - 0.3 && z < b.maxZ + 0.3) return false;
      for (const r of data.ramps) if (r.y0 < 0.4 && x > r.minX - 0.3 && x < r.maxX + 0.3 && z > r.minZ - 0.3 && z < r.maxZ + 0.3) return false;
      for (const d of data.decos) if (d.type === 'plane' && Math.abs(x - d.x) < d.w / 2 && Math.abs(z - d.z) < d.d / 2) return false;
      return true;
    };
    const count = Math.min(1600, Math.floor((h * h * 4) / (grass ? 3.2 : 9)));
    let geo, mat;
    if (grass) {
      geo = new THREE.ConeGeometry(0.06, 0.26, 3);
      geo.translate(0, 0.13, 0);
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    } else {
      geo = new THREE.DodecahedronGeometry(0.12, 0);
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    }
    const inst = new THREE.InstancedMesh(geo, mat, count * (grass ? 3 : 1));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < count; i++) {
      const x = (R() * 2 - 1) * h, z = (R() * 2 - 1) * h;
      if (!free(x, z)) continue;
      const blades = grass ? 3 : 1;
      for (let k = 0; k < blades; k++) {
        p.set(x + (R() - 0.5) * 0.25, 0, z + (R() - 0.5) * 0.25);
        e.set((R() - 0.5) * 0.5, R() * 6.3, (R() - 0.5) * 0.5);
        q.setFromEuler(e);
        const s0 = grass ? 0.6 + R() * 0.6 : 0.5 + R() * 1.2;
        sc.set(s0, grass ? s0 * (0.7 + R() * 0.5) : s0 * 0.6, s0);
        m4.compose(p, q, sc);
        inst.setMatrixAt(n, m4);
        if (grass) col.setHSL(0.26 + R() * 0.05, 0.5 + R() * 0.2, 0.2 + R() * 0.08);
        else { const v = 0.4 + R() * 0.25; col.setRGB(v, v * 0.95, v * 0.9); }
        inst.setColorAt(n, col);
        n++;
      }
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.receiveShadow = true;
    inst.userData.detail = true;
    root.add(inst);
  }

  function buildSky(theme, root, half, anim) {
    // Cúpula con degradado (horizonte → cénit) y sol
    const dome = new THREE.SphereGeometry(480, 32, 16);
    const hor = new THREE.Color(theme.sky);
    const zen = theme.stars ? new THREE.Color(0x02020a) : hor.clone().lerp(new THREE.Color(0x2f6fd0), 0.55);
    const low = theme.stars ? new THREE.Color(0x0a0a1c) : hor.clone().lerp(new THREE.Color(0xffd9b0), 0.35);
    const dc = [], dp = dome.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const y = dp.getY(i) / 480;
      const c = y > 0 ? hor.clone().lerp(zen, Math.pow(y, 0.6)) : hor.clone().lerp(low, Math.min(1, -y * 4));
      dc.push(c.r, c.g, c.b);
    }
    dome.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
    const sky = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    root.add(sky);
    // Sol (o estrella lejana en el espacio)
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.18, 'rgba(255,236,200,0.95)'); gr.addColorStop(0.4, 'rgba(255,200,140,0.25)'); gr.addColorStop(1, 'rgba(255,180,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), fog: false, depthWrite: false, transparent: true }));
    { const d = sunDir(theme); sun.position.set(d[0], d[1], d[2]).multiplyScalar(420); }
    sun.scale.setScalar(theme.stars ? 60 : 110);
    root.add(sun);

    if (theme.stars) {
      const N = 900, pos = [];
      for (let i = 0; i < N; i++) {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 220;
        const s = Math.sqrt(1 - u * u);
        pos.push(r * s * Math.cos(th), Math.abs(r * u) * 0.9 + 10, r * s * Math.sin(th));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, fog: false }));
      root.add(pts);
    }
    if (theme.planet) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), new THREE.MeshLambertMaterial({ color: 0x4f7cc9, emissive: 0x0d1b3d, fog: false }));
      p.position.set(-120, 70, -150);
      root.add(p);
      const ring = new THREE.Mesh(new THREE.RingGeometry(36, 50, 40), new THREE.MeshBasicMaterial({ color: 0xc8b88a, side: THREE.DoubleSide, transparent: true, opacity: 0.55, fog: false }));
      ring.position.copy(p.position); ring.rotation.x = 1.2; ring.rotation.y = 0.3;
      root.add(ring);
    }
    if (!theme.stars) {
      // Nubes esponjosas (bolas low-poly achatadas) fusionadas en UNA sola malla
      const Rn = rng(Math.round(half * 13));
      const parts = [];
      const ico = new THREE.IcosahedronGeometry(1, 1);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Rn() * 0.3, R = half + 50 + Rn() * 70;
        const cx = Math.cos(a) * R, cy = 48 + Rn() * 26, cz = Math.sin(a) * R;
        const n = 4 + Math.floor(Rn() * 4), len = 10 + Rn() * 10;
        for (let k = 0; k < n; k++) {
          const r = 3 + Rn() * 3.5 * (1 - Math.abs(k / (n - 1) - 0.5));
          const g = ico.clone();
          g.scale(r * 1.15, r * 0.72, r);
          g.translate(cx + (k / (n - 1) - 0.5) * len, cy + Rn() * 1.6, cz + (Rn() - 0.5) * 4);
          parts.push(g);
        }
      }
      let nv = 0; parts.forEach(g => { nv += g.attributes.position.count; });
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3); let o = 0;
      parts.forEach(g => { const ng = g.toNonIndexed ? g.index ? g.toNonIndexed() : g : g; ng.computeVertexNormals(); P.set(ng.attributes.position.array, o * 3); N.set(ng.attributes.normal.array, o * 3); o += ng.attributes.position.count; });
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.BufferAttribute(P, 3)); cg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      cg.computeBoundingSphere();
      const clouds = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa6b8, flatShading: true, fog: false }));
      root.add(clouds);
      anim.push(t => { clouds.rotation.y = t * 0.004; });
    }
  }

  // ---------------------------------------------------------------------------
  // Construcción completa del mapa
  // ---------------------------------------------------------------------------
  let animFns = [];

  // ---------------------------------------------------------------------------
  // PAISAJE: terreno que se eleva fuera del área de juego + decorado lejano
  // ---------------------------------------------------------------------------
  const BIOMES = {
    hills:  { amp: 16, ramp: 34, rough: 0.55, hill: 0x5d9b3e, hill2: 0x3f7a2e, deco: 'trees' },
    farm:   { amp: 12, ramp: 38, rough: 0.5, hill: 0x8a9a4a, hill2: 0x6b7f3a, deco: 'trees' },
    dunes:  { amp: 9, ramp: 40, rough: 0.35, hill: 0xe2c58e, hill2: 0xc9a46a, deco: 'mesas' },
    snow:   { amp: 30, ramp: 30, rough: 0.8, hill: 0xf2f6fa, hill2: 0xa9b8c6, deco: 'pines' },
    rock:   { amp: 26, ramp: 22, rough: 0.9, hill: 0x5a4a42, hill2: 0x2e2420, deco: 'rocks' },
    moon:   { amp: 7, ramp: 30, rough: 0.6, hill: 0x8d8f98, hill2: 0x5e606a, deco: 'craters' },
    city:   { amp: 0, ramp: 20, rough: 0, hill: 0x6d7076, hill2: 0x55585e, deco: 'city' },
    coast:  { amp: -3, ramp: 10, rough: 0.2, hill: 0xd9c28c, hill2: 0xbfa46f, deco: 'sea' },
    indoor: { amp: 0, ramp: 10, rough: 0, hill: 0x8a6a4a, hill2: 0x6a4a2a, deco: 'walls' },
  };
  const BIOME_OF = {
    grass: 'hills', hedge: 'hills', stone: 'hills', dirt: 'farm', mud: 'farm', sand: 'dunes', snow: 'snow',
    rock: 'rock', stoneDark: 'rock', moon: 'moon', concrete: 'city', asphalt: 'city', marble: 'city',
    kitchen: 'indoor', hay: 'indoor',
  };
  const BIOME_MAP = { shipyard: 'coast', lighthouse: 'coast', blue: 'city', dirt: 'farm', feedlot: 'farm', spacearena: 'moon' };
  function noise2(x, z) {
    return Math.sin(x * 0.071 + 1.3) * Math.cos(z * 0.063 - 0.7) * 0.5
      + Math.sin(x * 0.17 + z * 0.13) * 0.3 + Math.sin(x * 0.41 - z * 0.37 + 2.1) * 0.2;
  }
  function biomeFor(data, th) {
    return BIOMES[th.surround || BIOME_MAP[data.id] || BIOME_OF[data.groundMat] || 'hills'] ? (th.surround || BIOME_MAP[data.id] || BIOME_OF[data.groundMat] || 'hills') : 'hills';
  }
  function buildTerrain(data, th, root, anim, noGroundMat) {
    const half = data.halfSize;
    const bname = biomeFor(data, th);
    const B = BIOMES[bname];
    const R = rng(half * 31 + data.id.length);
    const size = half * 2 + 320, seg = 120;
    const start = half + 2.5;
    const heightAt = (x, z) => {
      const d = Math.max(Math.abs(x), Math.abs(z));
      if (d <= start) return 0;
      const t = smooth(start, start + B.ramp, d);
      const far = smooth(start + B.ramp, start + B.ramp + 90, d);
      const n = noise2(x, z);
      return t * B.amp * (1 - B.rough * 0.5 + n * B.rough) + far * Math.abs(B.amp) * 0.8 * (0.5 + n * 0.5);
    };
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = [];
    const c1 = new THREE.Color(B.hill), c2 = new THREE.Color(B.hill2), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      const d = Math.max(Math.abs(x), Math.abs(z));
      const t = smooth(start - 1, start + 8, d);
      const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) * 0.5 + Math.sin(x * 0.037 + z * 0.051) * 0.5;
      // Dentro: blanco (deja ver la textura del suelo); fuera: color del paisaje
      tmp.setRGB(1, 1, 1).lerp(c1, t * 0.85).lerp(c2, t * Math.max(0, Math.min(1, 0.5 + n * 0.5 - h * 0.01)) * 0.6);
      if (bname === 'snow' && h > 14) tmp.lerp(new THREE.Color(0xffffff), 0.6);
      const k = 0.9 + n * 0.1;
      cols.push(tmp.r * k, tmp.g * k, tmp.b * k);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    let gm;
    if (!noGroundMat) {
      const tex = makeTexture(data.groundMat).clone();
      tex.needsUpdate = true;
      tex.repeat.set(size / 5, size / 5);
      gm = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
    } else gm = new THREE.MeshLambertMaterial({ vertexColors: true });
    const floor = new THREE.Mesh(geo, gm);
    floor.receiveShadow = true;
    if (noGroundMat) floor.position.y = -6; // mapas flotantes (espacio): suelo lunar muy por debajo
    root.add(floor);
    buildScenery(bname, B, half, start, heightAt, root, anim, R, th, noGroundMat ? -6 : 0, data.id);
  }
  // Decorado lejano instanciado (barato): árboles, pinos, rocas, edificios, mar o paredes
  function buildScenery(bname, B, half, start, heightAt, root, anim, R, th, yOff, mapId) {
    const ring = (n, r0, r1, place) => {
      for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
        const a = R() * Math.PI * 2, r = r0 + R() * (r1 - r0);
        // repartir en el "anillo cuadrado" fuera del mapa
        let x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.max(Math.abs(x), Math.abs(z)) < start + 4) continue;
        place(x, z, i++);
      }
    };
    const inst = (geo, mat, list, castShadow) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      list.forEach((it, k) => {
        e.set(0, it.ry || 0, 0); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx, it.sy, it.sz));
        im.setMatrixAt(k, m4);
        if (it.c !== undefined && im.setColorAt) im.setColorAt(k, new THREE.Color(it.c));
      });
      im.castShadow = !!castShadow;
      im.userData.detail = true;
      root.add(im);
      return im;
    };
    const hy = (x, z) => heightAt(x, z) + yOff;
    if (bname === 'hills' || bname === 'farm' || bname === 'snow') {
      const crowns = [], trunks = [], pines = [];
      const n = bname === 'farm' ? 140 : 260;
      ring(n, start + 5, start + 95, (x, z) => {
        const y = hy(x, z), s = 0.8 + R() * 1.1;
        if (bname === 'snow' || R() < 0.45) pines.push({ x, y, z, sx: s, sy: s * (1 + R() * 0.4), sz: s, c: bname === 'snow' ? 0x2f5d3c : (R() < 0.5 ? 0x2f6b3c : 0x3d7a42) });
        else { crowns.push({ x, y: y + 2.6 * s, z, sx: s * 1.5, sy: s * 1.3, sz: s * 1.5, c: R() < 0.5 ? 0x4c9a3c : 0x5aa845 }); trunks.push({ x, y: y + 1.2 * s, z, sx: s, sy: s, sz: s }); }
      });
      const pineGeo = new THREE.ConeGeometry(1.4, 4.6, 7); pineGeo.translate(0, 2.6, 0);
      inst(pineGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), pines, false);
      if (bname === 'snow') {
        const capGeo = new THREE.ConeGeometry(0.9, 1.8, 7); capGeo.translate(0, 4.2, 0);
        inst(capGeo, new THREE.MeshLambertMaterial({ color: 0xf6fbff }), pines.map(p => Object.assign({}, p, { c: undefined })), false);
      }
      inst(new THREE.IcosahedronGeometry(1.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), crowns, false);
      inst(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), trunks, false);
    }
    if (bname === 'rock' || bname === 'dunes' || bname === 'moon' || bname === 'farm') {
      const rocks = [];
      const col = bname === 'dunes' ? 0xc79a62 : bname === 'moon' ? 0x7a7c86 : bname === 'farm' ? 0x8b8378 : 0x4a3c36;
      ring(bname === 'rock' ? 90 : 50, start + 4, start + 70, (x, z) => {
        const s = (bname === 'dunes' ? 3 : 1.5) + R() * (bname === 'rock' ? 5 : 3);
        rocks.push({ x, y: hy(x, z) - s * 0.3, z, sx: s, sy: s * (bname === 'dunes' ? 1.6 : 0.8 + R() * 0.8), sz: s * (0.7 + R() * 0.6), ry: R() * 6, c: col });
      });
      inst(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), rocks, false);
    }
    if (bname === 'city') {
      // Rascacielos lejanos con ventanas
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
      const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
      for (let y = 6; y < 128; y += 12) for (let x = 5; x < 64; x += 11) { g.fillStyle = R() < 0.3 ? '#fff3c4' : '#7d8ea3'; g.fillRect(x, y, 7, 8); }
      const wt = new THREE.CanvasTexture(cv); wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
      const blds = [];
      // Más allá de la órbita de la cámara del lobby (antes se metía dentro de algún edificio)
      ring(120, start + 16, start + 116, (x, z) => {
        const w = 6 + R() * 10, h = 10 + R() * 45;
        blds.push({ x, y: hy(x, z) + h / 2, z, sx: w, sy: h, sz: w * (0.7 + R() * 0.6), c: [0xc9cdd3, 0xb4bcc6, 0xd8cfc2, 0x9aa6b4, 0xe2d6c6][Math.floor(R() * 5)] });
      });
      const bg = new THREE.BoxGeometry(1, 1, 1);
      const tall = inst(bg, new THREE.MeshLambertMaterial({ color: 0xffffff, map: wt }), blds, false);
      if (tall) tall.userData.tall = true;
    }
    if (bname === 'coast') {
      // Mar alrededor y unas islas en el horizonte
      const tex = waterTexture().clone(); tex.needsUpdate = true; tex.repeat.set(60, 60);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(start * 2 + 600, start * 2 + 600), new THREE.MeshPhongMaterial({ color: 0x2f86c4, map: tex, shininess: 110, specular: 0xbfe8ff }));
      sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; root.add(sea);
      anim.push(t => { tex.offset.set(t * 0.01, Math.sin(t * 0.3) * 0.02); });
      const isl = [];
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + R(), r = start + 90 + R() * 60; isl.push({ x: Math.cos(a) * r, y: -2, z: Math.sin(a) * r, sx: 18 + R() * 30, sy: 8 + R() * 14, sz: 14 + R() * 20, c: 0x6a9a4a }); }
      inst(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff }), isl, false);
    }
    if (bname === 'indoor') {
      // Paredes interiores enormes alrededor (cocina / granero)
      const kitchen = mapId === 'kitchen';
      const wallCol = th.wall || (kitchen ? 0xe8dcc6 : 0x8a4a32);
      const W = start + 18, H = 34;
      const wm = new THREE.MeshLambertMaterial({ color: wallCol });
      [[0, -W, W * 2 + 4, 2], [0, W, W * 2 + 4, 2], [-W, 0, 2, W * 2 + 4], [W, 0, 2, W * 2 + 4]].forEach(([x, z, w, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wm); m.position.set(x, H / 2, z); root.add(m);
      });
      // Techo (no proyecta sombra para no tapar el sol)
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 4, W * 2 + 4), new THREE.MeshLambertMaterial({ color: kitchen ? 0xf6efe2 : 0x6a4a32, side: THREE.DoubleSide }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = H; root.add(ceil);
      // Zócalo y franja decorativa
      const trim = new THREE.MeshLambertMaterial({ color: th.trim || 0x6b4a2b });
      [[0, -W + 1.2, W * 2, 0.4], [0, W - 1.2, W * 2, 0.4], [-W + 1.2, 0, 0.4, W * 2], [W - 1.2, 0, 0.4, W * 2]].forEach(([x, z, w, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), trim); m.position.set(x, 0.8, z); root.add(m);
        const m2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), trim); m2.position.set(x, 18, z); root.add(m2);
      });
    }
  }

  // Dirección del sol: unos 50° de altura (antes ~66°). Las sombras salen más largas
  // y los volúmenes (muros, escalones, coberturas) se leen mucho mejor.
  function sunDir(th) {
    const d = (th && th.sunDir) || [0.56, 0.77, 0.32];
    const L = Math.hypot(d[0], d[1], d[2]);
    return [d[0] / L, d[1] / L, d[2] / L];
  }
  // Coloca el sol y ajusta su cámara de sombras para que cubra justo el mapa entero
  // (se calcula con las esquinas del mapa vistas desde el sol: nada se queda sin sombra)
  function fitSun(lights, data) {
    const th = data.def.theme, d = sunDir(th), h = data.halfSize + 2, top = 18;
    const D = 140;
    lights.sun.target.position.set(0, 0, 0);
    lights.sun.position.set(d[0] * D, d[1] * D, d[2] * D);
    // ejes de la vista del sol (como lookAt de three.js con up = +Y)
    const f = [-d[0], -d[1], -d[2]];
    let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0];
    const rl = Math.hypot(r[0], r[1], r[2]) || 1; r = r.map(v => v / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    let mx = 0, my = 0;
    for (const x of [-h, h]) for (const y of [0, top]) for (const z of [-h, h]) {
      mx = Math.max(mx, Math.abs(x * r[0] + y * r[1] + z * r[2]));
      my = Math.max(my, Math.abs(x * u[0] + y * u[1] + z * u[2]));
    }
    const cam = lights.sun.shadow.camera;
    cam.left = -mx; cam.right = mx; cam.top = my; cam.bottom = -my;
    cam.near = 1; cam.far = D + h * 2 + 40;
    cam.updateProjectionMatrix();
  }

  function build(mapId, scene, root, lights, opts) {
    const data = MapDefs.build(mapId);
    const def = data.def;
    const th = def.theme;
    const fns = [];
    if (!(opts && opts.preview)) animFns = fns;

    scene.background = new THREE.Color(th.sky);
    scene.fog = new THREE.Fog(th.sky, th.fog[0], th.fog[1]);
    if (lights) {
      lights.sun.color.setHex(th.sunColor);
      lights.sun.intensity = th.sun;
      lights.amb.intensity = th.amb;
      lights.hemi.color.setHex(th.hemiSky);
      lights.hemi.groundColor.setHex(th.hemiGround);
      fitSun(lights, data);
    }

    // Suelo + paisaje alrededor (colinas, montañas, ciudad, mar…): el mapa no acaba en el vacío
    if (data.ground) {
      buildTerrain(data, th, root, fns);
      buildGroundDetail(data, root);
      buildContactShadows(data, root);
      buildFlowers(data, root);
    }  // sin suelo (espacio): se mantiene el vacío estrellado

    // Cajas + rampas fusionadas por material
    const bufs = {};
    const buf = mat => {
      if (!bufs[mat]) {
        const m = MB.MATERIALS[mat] || MB.MATERIALS.stone;
        bufs[mat] = new GeoBuf(TEX_SCALE[m.pattern] || 3);
        bufs[mat].macro = true;
      }
      return bufs[mat];
    };
    // Sólo lo que se ve: sin caras tapadas ni caras duplicadas en el mismo plano (sin parpadeo)
    const faceSets = MB.cullFaces(data.boxes, { ground: data.ground });
    // Barandillas ('rail'): las balas las atraviesan, así que se dibujan como barandilla de verdad
    // (pasamanos, barra intermedia y postes) en vez de un murete macizo. La colisión no cambia.
    const railBufDefault = new GeoBuf(2);
    const railing = (b, RB) => {
      const railBuf = RB || railBufDefault;
      const w = b.maxX - b.minX, d = b.maxZ - b.minZ, h = b.maxY - b.minY;
      const alongX = w >= d, L = alongX ? w : d, t = Math.min(alongX ? d : w, 0.12);
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const bar = (y0, y1, th) => railBuf.box(alongX
        ? { minX: b.minX, maxX: b.maxX, minY: y0, maxY: y1, minZ: cz - th / 2, maxZ: cz + th / 2 }
        : { minX: cx - th / 2, maxX: cx + th / 2, minY: y0, maxY: y1, minZ: b.minZ, maxZ: b.maxZ });
      bar(b.maxY - 0.08, b.maxY, t);                       // pasamanos
      bar(b.minY + h * 0.45, b.minY + h * 0.45 + 0.05, t * 0.6);   // barra intermedia
      bar(b.minY, b.minY + 0.08, t);                        // zócalo
      const n = Math.max(1, Math.round(L / 1.2));
      for (let k = 0; k <= n; k++) {
        const u = (alongX ? b.minX : b.minZ) + Math.min(L - 0.03, Math.max(0.03, L * k / n));
        railBuf.box(alongX ? { minX: u - 0.035, maxX: u + 0.035, minY: b.minY, maxY: b.maxY - 0.08, minZ: cz - t / 2, maxZ: cz + t / 2 }
          : { minX: cx - t / 2, maxX: cx + t / 2, minY: b.minY, maxY: b.maxY - 0.08, minZ: u - 0.035, maxZ: u + 0.035 });
      }
    };
    // Vista previa de un mapa interior (ÑEMANAVE): sin el techo, para que se vean las salas
    const cutaway = opts && opts.preview && def.indoor;
    data.boxes.forEach((b, i) => {
      if (!b.vis || !faceSets[i]) return;
      if (cutaway && b.minY >= 3.3) return;
      const thin = Math.min(b.maxX - b.minX, b.maxZ - b.minZ) <= 0.2;
      if (b.maxY - b.minY > 0.5 && Math.max(b.maxX - b.minX, b.maxZ - b.minZ) > 0.6) {
        if (b.mat === 'rail') { railing(b); return; }
        // barandillas caladas de otros materiales (madera…): mismo dibujo, con su textura
        if (b.see && thin && !(MB.MATERIALS[b.mat] || {}).transparent && b.mat !== 'invisible') { railing(b, buf(b.mat)); return; }
      }
      buf(b.mat).faces(b, faceSets[i]);
    });
    // Aristas marcadas de los bloques (una sola malla de líneas para todo el mapa)
    const edges = [];
    const noEdge = m => { const md = MB.MATERIALS[m] || {}; return md.transparent || md.see || m === 'invisible'; };
    const boxEdges = (x0, x1, y0, y1, z0, z1) => {
      const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
      [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b2]) => edges.push(...c[a], ...c[b2]));
    };
    // Sólo las esquinas de verdad: las juntas entre tramos de una misma pared no se marcan
    data.boxes.forEach((b, i) => {
      if (!b.vis || noEdge(b.mat) || !faceSets[i] || (b.maxX - b.minX) <= 0.15 || (b.maxZ - b.minZ) <= 0.15) return;
      if (opts && opts.preview && def.indoor && b.minY >= 3.3) return;
      for (const e of MB.boxEdges(b, faceSets[i])) edges.push(...e);
    });
    const noseBuf = new GeoBuf(1);
    const railGroup = new THREE.Group();
    const railMat = new THREE.MeshLambertMaterial({ color: 0x5b4636 });
    // Barandillas de las escaleras en los lados que NO tienen pared al lado
    const stairRails = (r, v) => {
      const along = v[0] !== 0;
      const L = along ? r.maxX - r.minX : r.maxZ - r.minZ;
      const sides = along ? [[r.minZ - 0.06, -1], [r.maxZ + 0.06, 1]] : [[r.minX - 0.06, -1], [r.maxX + 0.06, 1]];
      for (const [pos, sgn] of sides) {
        // ¿Hay pared al lado? (se mira a media escalera, un poco hacia fuera)
        let wall = false;
        for (const t of [0.25, 0.5, 0.75]) {
          const u = along ? r.minX + L * t : r.minZ + L * t, hy = r.y0 + r.h * t + 0.6;
          const px = along ? u : pos + sgn * 0.25, pz = along ? pos + sgn * 0.25 : u;
          if (data.boxes.some(b => b.solid && px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ && hy > b.minY && hy < b.maxY)) { wall = true; break; }
        }
        if (wall) continue;
        const low = { x: 0, z: 0 }, high = { x: 0, z: 0 };
        if (along) { low.x = v[0] > 0 ? r.minX : r.maxX; high.x = v[0] > 0 ? r.maxX : r.minX; low.z = high.z = pos; }
        else { low.z = v[1] > 0 ? r.minZ : r.maxZ; high.z = v[1] > 0 ? r.maxZ : r.minZ; low.x = high.x = pos; }
        const y0 = r.y0 + 0.95, y1 = r.y0 + r.h + 0.95;
        const len = Math.hypot(L, r.h);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, len), railMat);
        rail.position.set((low.x + high.x) / 2, (y0 + y1) / 2, (low.z + high.z) / 2);
        rail.lookAt(high.x, y1, high.z);
        railGroup.add(rail);
        const nPost = Math.max(2, Math.round(L / 1.3) + 1);
        for (let i = 0; i < nPost; i++) {
          const k = i / (nPost - 1);
          const px = low.x + (high.x - low.x) * k, pz = low.z + (high.z - low.z) * k;
          const base = r.y0 + r.h * Math.min(1, (Math.floor(k * 0.999 * Math.max(3, Math.round(r.h / 0.32))) + 1) / Math.max(3, Math.round(r.h / 0.32)));
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), railMat);
          const top = r.y0 + r.h * k + 0.95;
          post.scale.y = Math.max(0.2, top - base);
          post.position.set(px, (base + top) / 2, pz);
          railGroup.add(post);
        }
      }
    };
    for (const r of data.ramps) {
      if (r.stairs) {
        const n = Math.max(3, Math.round(r.h / 0.32));
        const v = MB.DIRV[r.dir];
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const yTop = r.y0 + r.h * t1;
          let x0 = r.minX, x1 = r.maxX, z0 = r.minZ, z1 = r.maxZ;
          const lx = r.maxX - r.minX, lz = r.maxZ - r.minZ;
          if (v[0] > 0) { x0 = r.minX + lx * t0; x1 = r.minX + lx * t1; }
          else if (v[0] < 0) { x1 = r.maxX - lx * t0; x0 = r.maxX - lx * t1; }
          else if (v[1] > 0) { z0 = r.minZ + lz * t0; z1 = r.minZ + lz * t1; }
          else { z1 = r.maxZ - lz * t0; z0 = r.maxZ - lz * t1; }
          buf(r.mat).box({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: r.y0, maxY: yTop });
          // Borde de cada peldaño (más claro) y contorno: se leen bien los escalones
          const N = 0.05, H2 = 0.045;
          if (v[0] > 0) noseBuf.box({ minX: x0 - N, maxX: x0 + 0.08, minZ: z0 + 0.02, maxZ: z1 - 0.02, minY: yTop - H2, maxY: yTop + 0.006 });
          else if (v[0] < 0) noseBuf.box({ minX: x1 - 0.08, maxX: x1 + N, minZ: z0 + 0.02, maxZ: z1 - 0.02, minY: yTop - H2, maxY: yTop + 0.006 });
          else if (v[1] > 0) noseBuf.box({ minX: x0 + 0.02, maxX: x1 - 0.02, minZ: z0 - N, maxZ: z0 + 0.08, minY: yTop - H2, maxY: yTop + 0.006 });
          else noseBuf.box({ minX: x0 + 0.02, maxX: x1 - 0.02, minZ: z1 - 0.08, maxZ: z1 + N, minY: yTop - H2, maxY: yTop + 0.006 });
          boxEdges(x0, x1, yTop - 0.001, yTop, z0, z1);
        }
        if (r.h >= 1.4) stairRails(r, v);
      } else {
        const c = rampCorners(r);
        buf(r.mat).prism(r.minX, r.maxX, r.minZ, r.maxZ, c.top, c.bot);
      }
    }
    // Escaleras de mano
    const ladW = new GeoBuf(2), ladM = new GeoBuf(2);
    for (const l of data.ladders) {
      const B = l.metal ? ladM : ladW;
      const along = l.fx !== 0; // la escalera está en un plano perpendicular a X
      const off = 0.06;
      const px = l.x - l.fx * off, pz = l.z - l.fz * off;
      const top = l.y0 + l.h + 0.6;
      const rail = (dx) => {
        const cx = along ? px : px + dx, cz = along ? pz + dx : pz;
        B.box({ minX: cx - 0.05, maxX: cx + 0.05, minZ: cz - 0.05, maxZ: cz + 0.05, minY: l.y0, maxY: top });
      };
      rail(-0.45); rail(0.45);
      for (let y = l.y0 + 0.35; y < l.y0 + l.h + 0.3; y += 0.4) {
        if (along) B.box({ minX: px - 0.04, maxX: px + 0.04, minZ: pz - 0.45, maxZ: pz + 0.45, minY: y, maxY: y + 0.07 });
        else B.box({ minX: px - 0.45, maxX: px + 0.45, minZ: pz - 0.04, maxZ: pz + 0.04, minY: y, maxY: y + 0.07 });
      }
    }
    const addBuf = (B, mat) => {
      if (!B.p.length) return;
      const m = new THREE.Mesh(B.toGeometry(), mat);
      const md = MB.MATERIALS[m.material.userData.matName] || {};
      m.castShadow = !md.transparent;
      m.receiveShadow = true;
      root.add(m);
    };
    for (const name in bufs) {
      const mat = makeMaterial(name);
      mat.userData.matName = name;
      addBuf(bufs[name], mat);
    }
    addBuf(ladW, L(0xc8a165));
    addBuf(ladM, L(0xaab7b8));
    addBuf(noseBuf, L(0xf1e7cf));
    addBuf(railBufDefault, L(0x7d8a92));
    if (railGroup.children.length) batchStatic(railGroup, root);

    if (edges.length) {
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
      const lines = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.32, depthWrite: false }));
      lines.userData.detail = true;
      root.add(lines);
    }
    // Decoración: las piezas estáticas se fusionan por material (pocas llamadas de dibujo);
    // las animadas (antorchas, molino, agua, grúa…) se quedan como objetos sueltos.
    const staticDecos = new THREE.Group();
    // Suelos pintados (caminos, surcos, agua) a la misma altura: cada uno 2 mm más arriba que el anterior,
    // así no parpadean donde se cruzan
    let planeN = 0;
    for (const d of data.decos) if (d.type === 'plane') d._yo = (planeN++ % 6) * 0.002;
    for (const d of data.decos) {
      const n0 = fns.length, tmp = new THREE.Group();
      buildDeco(d, tmp, fns);
      const dest = fns.length !== n0 ? root : staticDecos;
      while (tmp.children.length) dest.add(tmp.children[0]);
    }
    batchStatic(staticDecos, root);
    buildSky(th, root, data.halfSize, fns);
    if (th.particles && !(opts && opts.preview)) buildParticles(th.particles, root, data.halfSize, fns);
    return data;
  }

  // Fusiona todas las mallas opacas de un grupo estático en una malla por material
  function batchStatic(group, root) {
    group.updateMatrixWorld(true);
    const batches = new Map(), loose = [];
    group.traverse(o => {
      if (o === group) return;
      const m = o.material;
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(m) || (m && (m.transparent || m.vertexColors))) {
        if (o.isSprite || o.isPoints || o.isLine || o.isInstancedMesh || (o.isMesh && (m.transparent || m.vertexColors || Array.isArray(m)))) loose.push(o);
        return;
      }
      const key = [m.type, m.color ? m.color.getHex() : 0, m.map ? m.map.uuid : '', m.emissive ? m.emissive.getHex() : 0, m.side, o.castShadow ? 1 : 0].join('|');
      let b = batches.get(key);
      if (!b) { b = { mat: m, cast: o.castShadow, geos: [] }; batches.set(key, b); }
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      b.geos.push(g);
    });
    batches.forEach(b => {
      let n = 0; b.geos.forEach(g => { n += g.attributes.position.count; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let k = 0;
      b.geos.forEach(g => {
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array, k * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, k * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, k * 2);
        k += c; g.dispose();
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.castShadow = b.cast; mesh.receiveShadow = true;
      root.add(mesh);
    });
    loose.forEach(o => root.attach(o));
  }

  // Partículas ambientales: nieve, polvo, ascuas o polen flotando por el mapa
  function buildParticles(kind, root, half, anim) {
    const cfg = {
      snow:   { n: 1400, color: 0xffffff, size: 0.13, fall: 1.6, drift: 0.6, top: 22, op: 0.9 },
      dust:   { n: 700,  color: 0xf3d9a4, size: 0.09, fall: -0.05, drift: 1.6, top: 9, op: 0.55 },
      embers: { n: 260,  color: 0xffa040, size: 0.09, fall: -0.45, drift: 0.4, top: 7, op: 0.95, add: true },
      pollen: { n: 420,  color: 0xfff6c0, size: 0.07, fall: -0.05, drift: 0.5, top: 8, op: 0.7, add: true },
    }[kind];
    if (!cfg) return;
    const N = cfg.n, R = half + 6;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * R;
      pos[i * 3 + 1] = Math.random() * cfg.top;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * R;
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    const mat = new THREE.PointsMaterial({ color: cfg.color, size: cfg.size, map: new THREE.CanvasTexture(cv), transparent: true, opacity: cfg.op, depthWrite: false, blending: cfg.add ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.detail = true;
    root.add(pts);
    let last = 0;
    anim.push(t => {
      const dt = Math.min(0.1, t - last || 0.016); last = t;
      const a = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const k = i * 3, sd = seed[i];
        a[k] += Math.sin(t * 0.6 + sd) * cfg.drift * dt;
        a[k + 2] += Math.cos(t * 0.5 + sd * 1.3) * cfg.drift * dt;
        a[k + 1] -= cfg.fall * dt * (0.7 + (sd % 1) * 0.6);
        if (a[k + 1] < 0) a[k + 1] += cfg.top;
        else if (a[k + 1] > cfg.top) a[k + 1] -= cfg.top;
        if (a[k] > R) a[k] -= 2 * R; else if (a[k] < -R) a[k] += 2 * R;
        if (a[k + 2] > R) a[k + 2] -= 2 * R; else if (a[k + 2] < -R) a[k + 2] += 2 * R;
      }
      geo.attributes.position.needsUpdate = true;
      if (kind === 'embers') mat.opacity = 0.75 + Math.sin(t * 3) * 0.2;
    });
  }

  function animate(t) { for (const f of animFns) f(t); }

  // ---------------------------------------------------------------------------
  // Miniatura cenital del mapa (para el lobby y el modal de crear sala)
  // ---------------------------------------------------------------------------
  function thumbnail(mapId, canvas, opts) {
    opts = opts || {};
    const data = MapDefs.build(mapId);
    const W = canvas.width, H = canvas.height;
    const g = canvas.getContext('2d');
    const h = data.halfSize;
    const k = Math.min(W, H) / (2 * h + 4);
    const X = x => W / 2 + x * k, Z = z => H / 2 + z * k;
    g.fillStyle = data.ground ? hex(MB.MATERIALS[data.groundMat].color) : '#0b0b1a';
    g.fillRect(0, 0, W, H);
    if (!data.ground) {
      g.fillStyle = '#fff';
      for (let i = 0; i < 60; i++) g.fillRect((i * 97) % W, (i * 53) % H, 1, 1);
    }
    data.decos.filter(d => d.type === 'plane').forEach(d => {
      g.fillStyle = hex(d.color || 0x777777);
      g.fillRect(X(d.x - d.w / 2), Z(d.z - d.d / 2), d.w * k, d.d * k);
    });
    const items = data.boxes.filter(b => b.vis).sort((a, b) => a.maxY - b.maxY);
    for (const b of items) {
      const m = MB.MATERIALS[b.mat] || MB.MATERIALS.stone;
      const f = 0.7 + Math.min(1, b.maxY / 12) * 0.45;
      g.fillStyle = shade(m.color, f);
      g.globalAlpha = m.transparent ? 0.5 : 1;
      g.fillRect(X(b.minX), Z(b.minZ), Math.max(1, (b.maxX - b.minX) * k), Math.max(1, (b.maxZ - b.minZ) * k));
    }
    g.globalAlpha = 1;
    for (const r of data.ramps) {
      const m = MB.MATERIALS[r.mat] || MB.MATERIALS.stone;
      g.fillStyle = shade(m.color, 0.95);
      g.fillRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * k, (r.maxZ - r.minZ) * k);
    }
    g.fillStyle = '#ffd400';
    for (const l of data.ladders) g.fillRect(X(l.minX), Z(l.minZ), Math.max(2, (l.maxX - l.minX) * k), Math.max(2, (l.maxZ - l.minZ) * k));
    if (opts.mode === 'kotc') {
      g.strokeStyle = '#00e5ff'; g.lineWidth = 1.5; g.setLineDash([3, 2]);
      data.coops.forEach(c => { g.beginPath(); g.arc(X(c.x), Z(c.z), c.r * k, 0, 7); g.stroke(); });
      g.setLineDash([]);
    }
    if (opts.mode === 'cts') {
      g.font = `${Math.max(10, k * 3)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🍳', X(data.spatula.x), Z(data.spatula.z));
      [['red', '#e74c3c'], ['blue', '#3498db']].forEach(([t, c]) => { const b = data.bases[t]; g.fillStyle = c; g.beginPath(); g.arc(X(b.x), Z(b.z), b.r * k, 0, 7); g.fill(); });
    }
    if (opts.mode && opts.mode !== 'ffa') {
      [['red', '#ff4d4d'], ['blue', '#3d9bff']].forEach(([t, c]) => { g.fillStyle = c; data.teamSpawns[t].forEach(s => { g.beginPath(); g.arc(X(s.x), Z(s.z), 2.2, 0, 7); g.fill(); }); });
    }
  }

  // ---------------------------------------------------------------------------
  // Vista previa 3D detallada (vista aérea en perspectiva + minimapa cenital)
  // Se renderiza una vez por mapa en un renderer compartido y se cachea.
  // ---------------------------------------------------------------------------
  const pvCache = {};
  const pvQueue = [];
  let pv = null, pvBusy = false;
  function pvInit() {
    if (pv) return pv;
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch (e) { pv = { failed: true }; return pv; }
    r.setPixelRatio(1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in r) r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 220;
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.55);
    scene.add(sun, sun.target, amb, hemi);
    const root = new THREE.Group();
    scene.add(root);
    pv = { r, scene, root, lights: { sun, amb, hemi }, cam: new THREE.PerspectiveCamera(40, 1.6, 0.5, 600) };
    return pv;
  }
  function pvRender(id, W, H) {
    const P = pvInit();
    if (P.failed) return null;
    while (P.root.children.length) { const c = P.root.children[0]; P.root.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const data = build(id, P.scene, P.root, P.lights, { preview: true });
    const h = data.halfSize;
    // La cámara de la vista previa está lejos: los rascacielos del fondo la tapaban
    P.root.traverse(o => { if (o.userData && o.userData.tall) o.visible = false; });
    // La niebla del juego es para la vista en primera persona: aquí la alejamos
    if (P.scene.fog) { P.scene.fog.near = h * 3; P.scene.fog.far = h * 9; }
    P.r.setSize(W, H, false);
    P.cam.aspect = W / H;
    P.cam.fov = 38;
    // Vista aérea de 3/4 desde la esquina sudeste, encuadrando todo el mapa
    const dist = h * 2.25;
    P.cam.position.set(dist * 0.62, h * 1.35, dist * 0.78);
    P.cam.lookAt(0, -h * 0.08, 0);
    P.cam.updateProjectionMatrix();
    P.r.render(P.scene, P.cam);
    const img = new Image();
    img.src = P.r.domElement.toDataURL('image/jpeg', 0.88);
    return img;
  }
  function drawPreview(canvas, img, id, opts) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    g.drawImage(img, 0, 0, W, H);
    // Viñeta suave
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (opts && opts.inset === false) return;
    // Minimapa cenital en la esquina (con marcas del modo)
    const s = Math.round(Math.min(W, H) * 0.42);
    const mini = document.createElement('canvas');
    mini.width = mini.height = s * 2;
    thumbnail(id, mini, opts);
    const x = W - s - 6, y = H - s - 6, rr = Math.max(4, s * 0.1);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8;
    g.beginPath(); g.roundRect ? g.roundRect(x, y, s, s, rr) : g.rect(x, y, s, s);
    g.fillStyle = '#1c1a18'; g.fill();
    g.shadowBlur = 0;
    g.clip();
    g.drawImage(mini, x, y, s, s);
    g.restore();
    g.strokeStyle = 'rgba(255, 210, 160, 0.85)'; g.lineWidth = 2;
    g.beginPath(); g.roundRect ? g.roundRect(x, y, s, s, rr) : g.rect(x, y, s, s); g.stroke();
  }
  function pumpPreviews() {
    pvBusy = pvQueue.length > 0;
    if (!pvBusy) return;
    const t0 = performance.now();
    while (pvQueue.length && performance.now() - t0 < 30) {
      const j = pvQueue.shift();
      if (!j.canvas.isConnected) continue;
      const key = j.id;
      if (!pvCache[key]) pvCache[key] = pvRender(j.id, 720, 450);
      const img = pvCache[key];
      if (!img) continue; // sin WebGL: se queda la vista cenital
      if (img.complete) drawPreview(j.canvas, img, j.id, j.opts);
      else img.onload = () => drawPreview(j.canvas, img, j.id, j.opts);
    }
    requestAnimationFrame(pumpPreviews);
  }
  /** Pinta la vista previa detallada: primero la cenital y, en cuanto está lista, la 3D. */
  function preview(mapId, canvas, opts) {
    const id = MapDefs.resolveId(mapId);
    const img = pvCache[id];
    if (img && img.complete) { drawPreview(canvas, img, id, opts); return; }
    thumbnail(id, canvas, opts);
    for (let i = pvQueue.length - 1; i >= 0; i--) if (pvQueue[i].canvas === canvas) pvQueue.splice(i, 1);
    pvQueue.push({ id, canvas, opts });
    if (!pvBusy) requestAnimationFrame(pumpPreviews);
  }

  return { build, animate, thumbnail, preview, makeTexture, setAnisotropy, fitSun };
})();
