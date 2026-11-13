// ============================================================================
// public/js/navedecor.js — Decoración 3D de la ÑEMANAVE (texturas, gallinas,
// nidos, letreros, planeta…). La usan Huevo Impostor y el mapa ÑEMANAVE del FPS.
// ============================================================================
(function () {
  'use strict';
  function build(mapRoot, data) {
    const I = window.Impostor;
    if (!I || !window.THREE) return;
    const dec = I.decor(data);
    // Se agrupa por textura: pocas mallas (≈12) aunque haya miles de piezas
    const tgroups = {};
    for (const pr of dec.prims) {
      const m = dec.mats[pr.m]; if (!m) continue;
      const tex = I.TEX_OF[pr.m] || 'none', key = (m.glow ? 'g:' : 'l:') + tex;
      const A = tgroups[key] || (tgroups[key] = { glow: !!m.glow, tex, p: [], n: [], c: [], uv: [] });
      const r = (m.c >> 16 & 255) / 255, g = (m.c >> 8 & 255) / 255, b = (m.c & 255) / 255, sc = I.TEX_SCALE[tex] || 1;
      I.primTriangles(pr, (x, y, z, nx, ny, nz) => {
        A.p.push(x, y, z); A.n.push(nx, ny, nz); A.c.push(r, g, b);
        const uv = I.boxUV(x, y, z, nx, ny, nz, sc); A.uv.push(uv[0], uv[1]);
      });
    }
    const texCache = {};
    const texOf = kind => {
      if (kind === 'none') return null;
      if (texCache[kind]) return texCache[kind];
      const N = 128, t = new THREE.DataTexture(I.texturePixels(kind, N), N, N, THREE.RGBAFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      return (texCache[kind] = t);
    };
    for (const key in tgroups) {
      const A = tgroups[key];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(A.c, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
      geo.computeBoundingSphere();
      const map = texOf(A.tex);
      const mat = A.glow ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, map })
                         : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map });
      mapRoot.add(new THREE.Mesh(geo, mat));
    }
    // Focos: halo aditivo (una sola nube de puntos)
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    const halo = new THREE.CanvasTexture(cv);
    const groups = {};
    for (const gl of dec.glows) { const k = gl.s; (groups[k] = groups[k] || []).push(gl); }
    for (const k in groups) {
      const pts = [], cols = [];
      for (const gl of groups[k]) { pts.push(gl.x, gl.y, gl.z); cols.push((gl.c >> 16 & 255) / 255 * 0.5, (gl.c >> 8 & 255) / 255 * 0.5, (gl.c & 255) / 255 * 0.5); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      mapRoot.add(new THREE.Points(geo, new THREE.PointsMaterial({ map: halo, size: +k, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })));
    }
    // Letreros sobre las puertas (lado del pasillo)
    for (const sg of I.signs()) {
      const cv2 = document.createElement('canvas'); cv2.width = 512; cv2.height = 96;
      const x = cv2.getContext('2d');
      x.fillStyle = '#1b2433'; x.fillRect(0, 0, 512, 96);
      x.strokeStyle = '#ffc640'; x.lineWidth = 6; x.strokeRect(3, 3, 506, 90);
      x.font = 'bold 54px Nunito, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#e8f6ff'; x.fillText(sg.text.toUpperCase(), 256, 50);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv2) }));
      m.position.set(sg.x, sg.y, sg.z); m.rotation.y = sg.rotY;
      mapRoot.add(m);
    }
    // Espacio: planeta y luna que se ven por los ventanales
    const planet = new THREE.Mesh(new THREE.SphereGeometry(55, 40, 24), new THREE.MeshLambertMaterial({ color: 0x7a5fd0, emissive: 0x1a1040, fog: false }));
    planet.position.set(190, -25, -60); mapRoot.add(planet);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshLambertMaterial({ color: 0xd8d2c4, emissive: 0x222018, fog: false }));
    moon.position.set(120, 30, 40); mapRoot.add(moon);
    const moon2 = moon.clone(); moon2.scale.setScalar(1.6); moon2.position.set(60, 25, -150); mapRoot.add(moon2);
  }
  window.NaveDecor = { build };
})();
