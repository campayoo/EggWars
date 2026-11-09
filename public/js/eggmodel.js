// ============================================================================
// eggmodel.js — Modelo 3D del huevo con toda la personalización
// (estampados, ojos, boca, sombreros, gafas, extras). Diseños propios.
// ============================================================================
window.EggModel = (function () {
  'use strict';

  const EGG_R = 0.55, EGG_SY = 1.32, EGG_CY = 0.8;
  const HEAD_Y = 1.18;                 // altura de los ojos
  const TEAM_COLORS = { red: 0xe74c3c, blue: 0x3498db };
  const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));

  // Radio del huevo a una altura dada (para pegar cosas a la superficie)
  function radiusAt(y) {
    const dy = (y - EGG_CY) / (EGG_R * EGG_SY);
    return EGG_R * Math.sqrt(Math.max(0, 1 - dy * dy));
  }

  // ---------------------------------------------------------------------------
  // Textura de la cáscara: color base + estampado + capa pintada
  // ---------------------------------------------------------------------------
  function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function shadeHex(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function drawPattern(g, W, H, c) {
    const col2 = c.color2 || '#ff9a4d';
    g.fillStyle = c.color || '#fff1dc';
    g.fillRect(0, 0, W, H);
    g.fillStyle = col2; g.strokeStyle = col2;
    const R = rng(7);
    switch (c.pattern) {
      case 'stripes':
        for (let y = 14; y < H; y += 26) g.fillRect(0, y, W, 11);
        break;
      case 'dots':
        for (let row = 0, y = 12; y < H; y += 22, row++) for (let x = (row % 2) * 16; x < W + 16; x += 32) { g.beginPath(); g.arc(x, y, 6.5, 0, 7); g.fill(); }
        break;
      case 'zigzag':
        g.lineWidth = 9; g.lineJoin = 'miter';
        [H * 0.38, H * 0.62].forEach(y0 => { g.beginPath(); for (let x = -8, i = 0; x <= W + 16; x += 16, i++) g.lineTo(x, y0 + (i % 2 ? 9 : -9)); g.stroke(); });
        break;
      case 'spots':
        for (let i = 0; i < 16; i++) {
          g.beginPath();
          const x = R() * W, y = 15 + R() * (H - 30), r = 8 + R() * 13;
          g.ellipse(x, y, r * 1.3, r, R() * 3, 0, 7); g.fill();
          if (x < r * 1.4) { g.beginPath(); g.ellipse(x + W, y, r * 1.3, r, 0, 0, 7); g.fill(); }
        }
        break;
      case 'half':
        g.fillRect(W * 0.5, 0, W * 0.5, H);
        break;
      case 'gradient': {
        const gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, c.color || '#fff1dc'); gr.addColorStop(1, col2);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        break;
      }
      case 'crack':
        g.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          let x = R() * W, y = H * (0.3 + R() * 0.4);
          g.moveTo(x, y);
          for (let i = 0; i < 9; i++) { x += 8 + R() * 12; y += (R() - 0.5) * 22; g.lineTo(x, y); }
          g.stroke();
        }
        break;
      case 'stars':
        for (let i = 0; i < 26; i++) {
          const x = R() * W, y = 12 + R() * (H - 24), r = 4 + R() * 5;
          g.beginPath();
          for (let p = 0; p < 10; p++) { const a = p * Math.PI / 5 - Math.PI / 2, rr = p % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          g.closePath(); g.fill();
        }
        break;
      case 'checker': {
        const sz = 16;
        for (let y = 0; y < H; y += sz) for (let x = ((y / sz) % 2) * sz; x < W; x += sz * 2) g.fillRect(x, y, sz, sz);
        break;
      }
      case 'hearts':
        for (let row = 0, y = 14; y < H; y += 26, row++) for (let x = (row % 2) * 18; x < W + 18; x += 36) {
          g.beginPath();
          g.moveTo(x, y + 6);
          g.bezierCurveTo(x - 10, y - 2, x - 6, y - 10, x, y - 4);
          g.bezierCurveTo(x + 6, y - 10, x + 10, y - 2, x, y + 6);
          g.fill();
        }
        break;
      case 'tiger':
        g.lineWidth = 5; g.lineCap = 'round';
        for (let x = 4; x < W; x += 15) {
          g.beginPath();
          const y0 = R() * 20;
          g.moveTo(x, y0); g.quadraticCurveTo(x + 8, y0 + 18 + R() * 10, x + 2, y0 + 36 + R() * 20); g.stroke();
          g.beginPath();
          const y1 = H - R() * 20;
          g.moveTo(x + 6, y1); g.quadraticCurveTo(x - 2, y1 - 18, x + 4, y1 - 34 - R() * 16); g.stroke();
        }
        break;
      case 'galaxy': {
        // Fondo espacial (no depende del color base) con nebulosas del color secundario
        const gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, '#24185a'); gr.addColorStop(0.5, '#4a2c8f'); gr.addColorStop(1, '#1a2c66');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 7; i++) {
          const x = R() * W, y = H * (0.2 + R() * 0.6), r = 22 + R() * 30;
          const ng = g.createRadialGradient(x, y, 0, x, y, r);
          ng.addColorStop(0, col2); ng.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalAlpha = 0.55 + R() * 0.25; g.fillStyle = ng;
          g.fillRect(x - r, y - r, r * 2, r * 2);
          if (x < r) g.fillRect(x - r + W, y - r, r * 2, r * 2); // continuidad en la costura
        }
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 110; i++) { const r = R() * 1.5 + 0.35; g.globalAlpha = 0.45 + R() * 0.55; g.beginPath(); g.arc(R() * W, R() * H, r, 0, 7); g.fill(); }
        g.globalAlpha = 1;
        break;
      }
      case 'camo':
        [0.75, 1, 1.25].forEach(f => {
          g.fillStyle = shadeHex(col2, f);
          for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(R() * W, R() * H, 10 + R() * 14, 6 + R() * 8, R() * 3, 0, 7); g.fill(); }
        });
        break;
      default: break;
    }
  }
  function makeShellTexture(c) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    drawPattern(g, 256, 128, c);
    const tex = new THREE.CanvasTexture(cv);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    if (c.paint) {
      const img = new Image();
      img.onload = () => { g.drawImage(img, 0, 0, 256, 128); tex.needsUpdate = true; };
      img.src = c.paint;
    }
    return tex;
  }

  // ---------------------------------------------------------------------------
  // Cara: ojos y boca (en el grupo de la cabeza, que mira hacia -Z)
  // ---------------------------------------------------------------------------
  function addEyes(head, type, shellColor, eyeColor, hide) {
    if (hide === 'all') return; // gafas opacas: los ojos no se ven
    const white = basic(0xffffff), black = basic(new THREE.Color(eyeColor || '#151515').getHex());
    const eye = (x, s) => {
      if (hide === 'right' && x > 0.05) return;
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 12, 10), white); e.position.set(x, 0, -0.43); e.scale.z = 0.6; head.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 10, 8), black); p.position.set(x, 0, -0.43 - 0.06 * s); head.add(p);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 6, 6), white); sh.position.set(x + 0.02 * s, 0.025 * s, -0.43 - 0.1 * s); head.add(sh);
    };
    const arc = (x) => {
      if (hide === 'right' && x > 0.05) return; const a = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 12, Math.PI), black); a.position.set(x, -0.02, -0.47); a.rotation.y = Math.PI; head.add(a); };
    const brow = (x, rot) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.03), black); b.position.set(x, 0.12, -0.47); b.rotation.z = rot; head.add(b); };
    switch (type) {
      case 'happy': arc(-0.15); arc(0.15); break;
      case 'angry': eye(-0.15, 1); eye(0.15, 1); brow(-0.15, -0.35); brow(0.15, 0.35); break;
      case 'sleepy': {
        eye(-0.15, 1); eye(0.15, 1);
        const lid = lam(new THREE.Color(shellColor || '#fff1dc').multiplyScalar(0.92));
        [-0.15, 0.15].forEach(x => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lid); l.position.set(x, -0.005, -0.43); l.scale.z = 0.66; head.add(l); });
        break;
      }
      case 'wink': eye(-0.15, 1); arc(0.15); break;
      case 'big': eye(-0.16, 1.35); eye(0.16, 1.35); break;
      case 'cyclops': eye(0, 1.8); break;
      default: eye(-0.15, 1); eye(0.15, 1);
    }
  }
  function addMouth(head, type) {
    const y = -0.22, z = -radiusAt(HEAD_Y + y) - 0.005;
    const dark = basic(0x3a1d14);
    if (type === 'smile' || type === 'tongue') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 14, Math.PI), dark);
      m.position.set(0, y + 0.06, z); m.rotation.z = Math.PI; head.add(m);
      if (type === 'tongue') { const t = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), lam(0xff7a8a)); t.scale.set(1, 1.2, 0.5); t.position.set(0.02, y - 0.04, z - 0.01); head.add(t); }
    } else if (type === 'grin') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.03), basic(0xffffff)); m.position.set(0, y, z); head.add(m);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.032), dark); l.position.set(0, y, z - 0.001); head.add(l);
      [-0.05, 0, 0.05].forEach(x => { const d = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.07, 0.032), dark); d.position.set(x, y, z - 0.001); head.add(d); });
    } else if (type === 'open') {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), dark); m.position.set(0, y, z - 0.002); m.rotation.y = Math.PI; m.scale.y = 1.3; head.add(m);
    } else if (type === 'mustache') {
      [-1, 1].forEach(s => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lam(0x4e2e1a)); m.scale.set(1.3, 0.45, 0.5); m.position.set(s * 0.085, y + 0.04, z); m.rotation.z = s * 0.25; head.add(m); });
    }
  }

  // ---------------------------------------------------------------------------
  // Sombreros (posición relativa a la cabeza; la cima del huevo está a +0.35)
  // ---------------------------------------------------------------------------
  function addHat(head, type, anim) {
    if (!type || type === 'none') return;
    const g = new THREE.Group(); g.name = 'hat';
    const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, typeof mat === 'number' ? lam(mat) : mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); g.add(m); return m; };  // accesorios: sin sombra (barato)
    switch (type) {
      case 'tophat':
        add(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 18), 0x1a1a1a, 0, 0.3, 0);
        add(new THREE.CylinderGeometry(0.25, 0.25, 0.44, 18), 0x1a1a1a, 0, 0.52, 0);
        add(new THREE.CylinderGeometry(0.255, 0.255, 0.07, 18), 0xd9732e, 0, 0.36, 0);
        break;
      case 'helmet':
        add(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x4b5320, 0, 0.02, 0, 1, 0.75, 1);
        add(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 18), 0x3d441a, 0, 0.02, 0);
        break;
      case 'cap': {
        add(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe67e22, 0, 0.08, 0, 1, 0.8, 1);
        const v = add(new THREE.BoxGeometry(0.42, 0.03, 0.3), 0xd35400, 0, 0.1, -0.45); v.rotation.x = 0.15;
        break;
      }
      case 'crown':
        add(new THREE.CylinderGeometry(0.3, 0.27, 0.16, 14, 1, true), lam(0xf1c40f, { side: THREE.DoubleSide }), 0, 0.3, 0);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(0.06, 0.16, 6), 0xf1c40f, Math.cos(a) * 0.28, 0.45, Math.sin(a) * 0.28); }
        add(new THREE.SphereGeometry(0.045, 8, 6), 0xe74c3c, 0, 0.32, -0.29);
        break;
      case 'cowboy':
        add(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 22), 0x8b5a2b, 0, 0.28, 0, 1, 1, 0.85);
        add(new THREE.CylinderGeometry(0.24, 0.3, 0.32, 16), 0x8b5a2b, 0, 0.45, 0);
        add(new THREE.CylinderGeometry(0.305, 0.305, 0.06, 16), 0x3e2723, 0, 0.33, 0);
        break;
      case 'beanie':
        add(new THREE.SphereGeometry(0.47, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x2e86de, 0, 0.1, 0, 1, 0.85, 1);
        add(new THREE.TorusGeometry(0.45, 0.06, 8, 24), 0x1b5fa8, 0, 0.12, 0, 1, 1, 1).rotation.x = Math.PI / 2;
        add(new THREE.SphereGeometry(0.11, 10, 8), 0xffffff, 0, 0.52, 0);
        break;
      case 'chef':
        add(new THREE.CylinderGeometry(0.3, 0.3, 0.32, 18), 0xffffff, 0, 0.42, 0);
        [[0, 0.68, 0, 0.26], [-0.16, 0.62, 0.05, 0.18], [0.16, 0.62, -0.05, 0.18], [0.02, 0.62, 0.17, 0.17], [-0.02, 0.62, -0.17, 0.17]].forEach(([x, y, z, r]) => add(new THREE.SphereGeometry(r, 12, 10), 0xffffff, x, y, z));
        break;
      case 'party': {
        const c = add(new THREE.ConeGeometry(0.24, 0.55, 16), 0xff7fb5, 0, 0.58, 0);
        c.rotation.z = 0.12;
        [0.42, 0.58, 0.72].forEach((y, i) => add(new THREE.TorusGeometry(0.2 - i * 0.06, 0.02, 6, 16), [0xffd84d, 0x4fc3f7, 0x7bd35a][i], 0.012 * (i + 1), y, 0).rotation.x = Math.PI / 2);
        add(new THREE.SphereGeometry(0.07, 8, 6), 0xffd84d, 0.1, 0.86, 0);
        break;
      }
      case 'viking':
        add(new THREE.SphereGeometry(0.48, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x8e9aa6, 0, 0.05, 0, 1, 0.8, 1);
        add(new THREE.TorusGeometry(0.48, 0.04, 6, 24), 0xa1887f, 0, 0.06, 0).rotation.x = Math.PI / 2;
        [-1, 1].forEach(s => { const h = add(new THREE.ConeGeometry(0.07, 0.38, 10), 0xfff3d6, s * 0.48, 0.3, 0); h.rotation.z = -s * 0.9; });
        break;
      case 'propeller': {
        add(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xffd84d, 0, 0.08, 0, 1, 0.8, 1);
        add(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), 0x555555, 0, 0.47, 0);
        const p = new THREE.Group(); p.position.y = 0.55;
        p.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.015, 0.07), lam(0xff6b5f)));
        p.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.62), lam(0x4fc3f7)));
        g.add(p);
        anim.push(t => { p.rotation.y = t * 14; });
        break;
      }
      case 'halo': {
        const h = add(new THREE.TorusGeometry(0.28, 0.035, 8, 28), basic(0xffe066), 0, 0.62, 0);
        h.rotation.x = Math.PI / 2;
        anim.push(t => { h.position.y = 0.62 + Math.sin(t * 2) * 0.04; });
        break;
      }
      case 'bunny':
        [-1, 1].forEach(sd => {
          const e = add(new THREE.SphereGeometry(0.1, 12, 10), 0xffffff, sd * 0.16, 0.6, 0.02, 0.8, 3.2, 0.5); e.rotation.z = -sd * 0.18;
          const i = add(new THREE.SphereGeometry(0.06, 10, 8), 0xffb3c7, sd * 0.16, 0.6, -0.03, 0.8, 3.0, 0.3); i.rotation.z = -sd * 0.18;
        });
        break;
      case 'cat':
        [-1, 1].forEach(sd => {
          const e = add(new THREE.ConeGeometry(0.13, 0.24, 4), 0x3a3a44, sd * 0.24, 0.38, 0.02); e.rotation.z = -sd * 0.35; e.rotation.y = Math.PI / 4;
          const i = add(new THREE.ConeGeometry(0.07, 0.14, 4), 0xffb3c7, sd * 0.235, 0.37, -0.05); i.rotation.z = -sd * 0.35; i.rotation.y = Math.PI / 4;
        });
        break;
      case 'wizard': {
        add(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 24), 0x3b2a7a, 0, 0.27, 0);
        const cone = add(new THREE.ConeGeometry(0.3, 0.75, 20), 0x3b2a7a, 0, 0.65, 0.05); cone.rotation.x = 0.18;
        [[0.12, 0.55, -0.2], [-0.1, 0.75, -0.13], [0.04, 0.9, -0.05]].forEach(([x, y, z]) => add(new THREE.OctahedronGeometry(0.045), basic(0xffd84d), x, y, z));
        break;
      }
      case 'flower': {
        const fl = new THREE.Group(); fl.position.set(0.18, 0.36, -0.05); fl.rotation.z = -0.4;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const pt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lam(0xffffff)); pt.scale.set(1, 0.4, 1.6); pt.position.set(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08); pt.rotation.y = -a; fl.add(pt); }
        fl.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), lam(0xffc107)));
        g.add(fl);
        break;
      }
      case 'antenna':
        [-1, 1].forEach(sd => {
          const st = add(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), 0x5b8c3a, sd * 0.12, 0.48, 0); st.rotation.z = -sd * 0.3;
          const ball = add(new THREE.SphereGeometry(0.05, 10, 8), basic(0x7bd35a), sd * 0.17, 0.64, 0);
          anim.push(t => { ball.position.y = 0.64 + Math.sin(t * 4 + sd) * 0.02; });
        });
        break;
      case 'sprout': {
        add(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), 0x4caf50, 0, 0.42, 0);
        [-1, 1].forEach(sd => { const l = add(new THREE.SphereGeometry(0.07, 10, 6), 0x66bb6a, sd * 0.07, 0.5, 0, 1.4, 0.35, 0.8); l.rotation.z = sd * 0.5; });
        break;
      }
      case 'headband': {
        const b = add(new THREE.TorusGeometry(radiusAt(HEAD_Y + 0.17) + 0.01, 0.045, 8, 28), 0xe53935, 0, 0.17, 0);
        b.rotation.x = Math.PI / 2;
        [-1, 1].forEach(s => { const tl = add(new THREE.BoxGeometry(0.06, 0.3, 0.02), 0xe53935, s * 0.07, 0.04, 0.5); tl.rotation.z = s * 0.4; });
        break;
      }
    }
    head.add(g);
  }

  // Gafas: siempre DELANTE de los ojos (los ojos sobresalen hasta z≈-0.54, o -0.59 si son grandes)
  // y las correas rodean la cabeza por fuera (radio de la cáscara a esa altura ≈ 0.47).
  function addGlasses(head, type, eyes) {
    if (!type || type === 'none') return;
    const g = new THREE.Group(); g.name = 'glasses';
    let Z = eyes === 'big' || eyes === 'cyclops' ? -0.62 : -0.575; // plano de las lentes
    if (type === 'sunglasses' || type === 'eyepatch') Z = -0.5;      // tapan los ojos: pegadas a la cara
    const HR = radiusAt(HEAD_Y) + 0.03;                             // radio para correas
    const blk = lam(0x161616);
    const lensMat = (c, o) => new THREE.MeshPhongMaterial({ color: c, transparent: true, opacity: o, shininess: 90, specular: 0xffffff, depthWrite: false });
    const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    // Patillas: del borde exterior de cada lente hacia los lados de la cabeza
    const temples = (mat, w) => [-1, 1].forEach(sd => {
      const from = new THREE.Vector3(sd * (w || 0.27), 0.01, Z + 0.02), to = new THREE.Vector3(sd * (HR - 0.02), 0.02, -0.05);
      const len = from.distanceTo(to);
      const t = mesh(new THREE.BoxGeometry(0.018, 0.018, len), mat, (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      t.lookAt(to.x, to.y, to.z);
    });
    const strap = (mat, tube, tilt) => { const st = mesh(new THREE.TorusGeometry(HR, tube, 6, 36), mat, 0, 0, 0); st.rotation.x = Math.PI / 2 + (tilt || 0); return st; };
    switch (type) {
      case 'sunglasses':
        [-0.155, 0.155].forEach(x => { const l = mesh(new THREE.BoxGeometry(0.25, 0.2, 0.03), new THREE.MeshPhongMaterial({ color: 0x101010, shininess: 120, specular: 0x888888 }), x, 0, Z); l.rotation.y = x > 0 ? -0.12 : 0.12; });
        mesh(new THREE.BoxGeometry(0.56, 0.035, 0.035), blk, 0, 0.09, Z);
        temples(blk, 0.25);
        break;
      case 'mask': { // antifaz de superhéroe que rodea la cabeza
        const band = mesh(new THREE.CylinderGeometry(HR - 0.01, HR - 0.01, 0.25, 36, 1, true), lam(0xc0392b, { side: THREE.DoubleSide }), 0, 0.01, 0);
        band.scale.set(1.04, 1, 1.04);
        const fz = -(HR - 0.01) * 1.04 - 0.004;
        [-0.15, 0.15].forEach(x => {
          const zx = -Math.sqrt(Math.max(0, fz * fz - x * x)) - 0.02;
          const w = mesh(new THREE.CircleGeometry(0.07, 18), basic(0xffffff), x, 0.01, zx); w.rotation.y = Math.PI - x * 0.75; w.scale.set(1.25, 0.8, 1);
          const p = mesh(new THREE.CircleGeometry(0.03, 12), basic(0x151515), x, 0.01, zx - 0.008); p.rotation.y = Math.PI - x * 0.75;
        });
        break;
      }
      case 'goggles':
        [-0.155, 0.155].forEach(x => {
          mesh(new THREE.TorusGeometry(0.125, 0.032, 8, 20), lam(0x2c3e50), x, 0, Z);
          mesh(new THREE.CircleGeometry(0.125, 18), lensMat(0x85c1e9, 0.55), x, 0, Z - 0.005).rotation.y = Math.PI;
        });
        strap(lam(0x2c3e50), 0.03);
        break;
      case 'monocle': {
        mesh(new THREE.TorusGeometry(0.125, 0.016, 8, 20), lam(0xd4af37), 0.155, 0, Z);
        mesh(new THREE.CircleGeometry(0.12, 16), lensMat(0xdff3ff, 0.3), 0.155, 0, Z + 0.002).rotation.y = Math.PI;
        const ch = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.36, 4), lam(0xd4af37), 0.26, -0.2, Z + 0.06); ch.rotation.z = 0.35;
        break;
      }
      case 'nerd':
        [-0.155, 0.155].forEach(x => {
          const fr = mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 4), blk, x, 0, Z); fr.rotation.z = Math.PI / 4; fr.scale.set(1.15, 1, 1);
          mesh(new THREE.PlaneGeometry(0.2, 0.18), lensMat(0xffffff, 0.18), x, 0, Z + 0.003).rotation.y = Math.PI;
        });
        mesh(new THREE.BoxGeometry(0.09, 0.025, 0.025), blk, 0, 0.02, Z);
        temples(blk, 0.29);
        break;
      case 'eyepatch': {
        mesh(new THREE.CircleGeometry(0.13, 18), blk, 0.155, 0, Z + 0.01).rotation.y = Math.PI;
        strap(blk, 0.014, -0.32).rotation.y = 0.25;
        break;
      }
      case 'hearts':
        [-0.155, 0.155].forEach(x => {
          const shape = new THREE.Shape();
          shape.moveTo(0, -0.07); shape.bezierCurveTo(-0.15, 0.02, -0.08, 0.13, 0, 0.06); shape.bezierCurveTo(0.08, 0.13, 0.15, 0.02, 0, -0.07);
          const h = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }), lensMat(0xff4d8d, 0.85), x, 0.01, Z + 0.01);
          h.rotation.y = Math.PI; h.scale.set(1.35, 1.35, 1);
        });
        mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), lam(0xff4d8d), 0, 0.03, Z);
        temples(lam(0xff4d8d), 0.27);
        break;
      case 'round':
        [-0.155, 0.155].forEach(x => {
          mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 22), lam(0xb8860b), x, 0, Z);
          mesh(new THREE.CircleGeometry(0.118, 18), lensMat(0xffffff, 0.15), x, 0, Z + 0.002).rotation.y = Math.PI;
        });
        mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 10, Math.PI), lam(0xb8860b), 0, 0.01, Z);
        temples(lam(0xb8860b), 0.25);
        break;
      case 'visor': {
        const R = -Z + 0.02;
        const v = mesh(new THREE.CylinderGeometry(R, R, 0.15, 28, 1, true, Math.PI * 0.68, Math.PI * 0.64), new THREE.MeshPhongMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, emissive: 0x004450, shininess: 100, depthWrite: false }), 0, 0, 0);
        v.scale.set(HR / R + 0.02, 1, 1);
        break;
      }
    }
    head.add(g);
  }

  function addExtra(body, type, c, anim, team) {
    if (!type || type === 'none') return;
    const g = new THREE.Group(); g.name = 'extra';
    const col2 = new THREE.Color(c.color2 || '#ff9a4d').getHex();
    switch (type) {
      case 'scarf': {
        const y = 0.5;
        const s = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(y) + 0.02, 0.07, 8, 28), lam(col2)); s.rotation.x = Math.PI / 2; s.position.y = y; g.add(s);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.05), lam(col2)); tail.position.set(0.22, y - 0.2, -radiusAt(y) - 0.02); tail.rotation.z = 0.2; g.add(tail);
        break;
      }
      case 'bowtie': {
        const y = 0.42, z = -radiusAt(y) - 0.02;
        [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 4), lam(col2)); w.rotation.z = s * Math.PI / 2; w.position.set(s * 0.08, y, z); g.add(w); });
        { const bt = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), lam(col2)); bt.position.set(0, y, z); g.add(bt); }
        break;
      }
      case 'cape': {
        const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.75, 1.0, 20, 1, true, -Math.PI * 0.35, Math.PI * 0.7),
          lam(team ? TEAM_COLORS[team] : col2, { side: THREE.DoubleSide }));
        cape.position.set(0, 0.62, 0.02); cape.rotation.y = 0; g.add(cape);
        anim.push(t => { cape.scale.z = 1 + Math.sin(t * 5) * 0.04; });
        break;
      }
      case 'backpack': {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.22), lam(col2)); b.position.set(0, 0.85, 0.58); g.add(b);
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), lam(new THREE.Color(col2).multiplyScalar(0.8).getHex())); p.position.set(0, 0.72, 0.71); g.add(p);
        break;
      }
      case 'medal': {
        const y = 0.6, z = -radiusAt(y) - 0.02;
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.02), lam(col2)); rib.position.set(0, y + 0.1, z); g.add(rib);
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 16), lam(0xf1c40f, { emissive: 0x3a2a00 })); d.rotation.x = Math.PI / 2; d.position.set(0, y - 0.03, z - 0.01); g.add(d);
        break;
      }
      case 'balloon': {
        const piv = new THREE.Group(); piv.position.set(-0.45, 1.9, 0.3);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), new THREE.MeshPhongMaterial({ color: col2, shininess: 80 })); b.scale.y = 1.2; piv.add(b);
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.0, 4), lam(0xdddddd)); str.position.set(0.12, -0.7, -0.08); str.rotation.z = 0.25; piv.add(str);
        g.add(piv);
        anim.push(t => { piv.position.y = 1.9 + Math.sin(t * 1.8) * 0.06; piv.rotation.z = Math.sin(t * 1.2) * 0.08; });
        break;
      }
      case 'necklace': {
        const y = 0.52;
        const n = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(y) + 0.01, 0.018, 6, 30), lam(0xffd54f)); n.rotation.x = Math.PI / 2 + 0.25; n.position.y = y - 0.05; g.add(n);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshPhongMaterial({ color: col2, shininess: 100 })); gem.position.set(0, y - 0.18, -radiusAt(y - 0.15) - 0.03); g.add(gem);
        break;
      }
      case 'jetpack': {
        [-1, 1].forEach(sd => {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 12), lam(0xb0bec5)); tank.position.set(sd * 0.14, 0.85, 0.6); g.add(tank);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(col2)); cap.position.set(sd * 0.14, 1.1, 0.6); g.add(cap);
          const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 10), basic(0xffa726, { transparent: true, opacity: 0.85 })); flame.rotation.x = Math.PI; flame.position.set(sd * 0.14, 0.48, 0.6); g.add(flame);
          anim.push(t => { flame.scale.y = 0.7 + Math.abs(Math.sin(t * 25 + sd)) * 0.5; });
        });
        break;
      }
      case 'wings': {
        [-1, 1].forEach(s => {
          const piv = new THREE.Group(); piv.position.set(s * 0.35, 0.95, 0.35);
          const w = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), lam(0xffffff)); w.scale.set(1.4, 0.5, 0.2); w.position.x = s * 0.25; piv.add(w);
          g.add(piv);
          anim.push(t => { piv.rotation.z = s * (0.3 + Math.sin(t * 8) * 0.25); piv.rotation.y = -s * 0.5; });
        });
        break;
      }
    }
    body.add(g);
  }

  // ---------------------------------------------------------------------------
  // Armas en tercera persona
  // ---------------------------------------------------------------------------
  function buildGun(weapon) {
    const g = new THREE.Group(); g.name = 'gun';
    const b = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); g.add(m); };
    if (weapon === 'pistol') { b(0.06, 0.07, 0.24, 0x3d3d3d, 0, 0.02, -0.12); b(0.05, 0.13, 0.06, 0x1e1e1e, 0, -0.06, 0); }
    else if (weapon === 'rpegg') { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.95, 12), lam(0x4b6043)); t.rotation.x = Math.PI / 2; t.position.set(0, 0.04, -0.15); g.add(t); b(0.05, 0.12, 0.06, 0x222222, 0, -0.07, 0.05); }
    else if (weapon === 'whipper') { b(0.07, 0.09, 0.42, 0x34495e, 0, 0, -0.12); b(0.05, 0.22, 0.06, 0x111111, 0, -0.14, -0.12); }
    else if (weapon === 'trihard') { b(0.08, 0.1, 0.62, 0xb33939, 0, 0, -0.2); b(0.05, 0.14, 0.06, 0x111111, 0, -0.1, -0.08); b(0.07, 0.1, 0.2, 0x2f3640, 0, -0.01, 0.16); }
    else if (weapon === 'ranger') { b(0.07, 0.07, 0.8, 0x2d3436, 0, 0, -0.28); b(0.06, 0.06, 0.2, 0x27ae60, 0, 0.08, -0.05); b(0.08, 0.11, 0.28, 0x7f8c8d, 0, -0.02, 0.15); }
    else if (weapon === 'shotgun') { b(0.1, 0.1, 0.55, 0x333333, 0, 0, -0.2); b(0.11, 0.13, 0.25, 0xcd853f, 0, -0.02, 0.15); }
    else if (weapon === 'sniper') { b(0.07, 0.07, 0.85, 0x222222, 0, 0, -0.3); b(0.06, 0.06, 0.22, 0x0c7c86, 0, 0.08, -0.05); b(0.09, 0.11, 0.3, 0x2f3542, 0, -0.02, 0.15); }
    else { b(0.07, 0.08, 0.6, 0x3b3b3b, 0, 0, -0.22); b(0.06, 0.15, 0.07, 0x111111, 0, -0.1, -0.1); b(0.07, 0.1, 0.2, 0x8b4513, 0, -0.01, 0.15); }
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0xfff6e0)); h1.position.set(-0.05, -0.05, -0.3); g.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0xfff6e0)); h2.position.set(0.02, -0.06, 0.1); g.add(h2);
    return g;
  }

  // Material de la cáscara según el acabado elegido
  let toonGradient = null;
  function shellMaterial(c, map) {
    switch (c.finish) {
      case 'matte': return new THREE.MeshLambertMaterial({ map });
      case 'gloss': return new THREE.MeshPhongMaterial({ map, shininess: 110, specular: 0x666666 });
      case 'metal': return new THREE.MeshPhongMaterial({ map, shininess: 70, specular: new THREE.Color(c.color2 || '#ffffff').multiplyScalar(0.9), color: 0xcfcfcf });
      case 'neon': return new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.55 });
      case 'toon': {
        if (!toonGradient) {
          const d = new Uint8Array([90, 170, 255]);
          toonGradient = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
          toonGradient.minFilter = toonGradient.magFilter = THREE.NearestFilter; toonGradient.needsUpdate = true;
        }
        return new THREE.MeshToonMaterial({ map, gradientMap: toonGradient });
      }
      default: return new THREE.MeshPhongMaterial({ map, shininess: 35, specular: 0x2a2a2a });
    }
  }

  // ---------------------------------------------------------------------------
  // Modelo completo
  // ---------------------------------------------------------------------------
  function create(custom, opts) {
    opts = opts || {};
    const c = window.Cosmetics.sanitize(custom);
    const anim = [];
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const mat = shellMaterial(c, makeShellTexture(c));
    if (opts.team) mat.color = new THREE.Color(0xffffff).lerp(new THREE.Color(TEAM_COLORS[opts.team]), 0.35);
    const egg = new THREE.Mesh(new THREE.SphereGeometry(EGG_R, 28, 20), mat);
    egg.scale.set(1, EGG_SY, 1);
    egg.position.y = EGG_CY;
    egg.rotation.y = Math.PI / 2; // la costura de la textura queda en el lateral
    egg.castShadow = true;
    body.add(egg);
    if (c.finish === 'toon') {
      const ol = new THREE.Mesh(egg.geometry, new THREE.MeshBasicMaterial({ color: 0x1a1210, side: THREE.BackSide }));
      ol.scale.set(1.04, EGG_SY * 1.03, 1.04); ol.position.copy(egg.position);
      body.add(ol);
    }
    if (opts.team) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(EGG_R * 0.98, 0.045, 6, 28), lam(TEAM_COLORS[opts.team]));
      band.rotation.x = Math.PI / 2; band.position.y = EGG_CY - 0.15;
      body.add(band);
    }
    const head = new THREE.Group(); head.position.y = HEAD_Y; body.add(head);
    addEyes(head, c.eyes, c.color, c.eyeColor, c.glasses === 'sunglasses' || c.glasses === 'mask' ? 'all' : c.glasses === 'eyepatch' ? 'right' : null);
    addMouth(head, c.mouth);
    addHat(head, c.hat, anim);
    addGlasses(head, c.glasses, c.eyes);
    addExtra(body, c.extra, c, anim, opts.team);
    const gunPivot = new THREE.Group(); gunPivot.position.set(0.55, 0.74, -0.16); body.add(gunPivot);
    if (opts.weapon !== null) gunPivot.add(buildGun(opts.weapon || 'rifle'));
    const hit = new THREE.Mesh(new THREE.SphereGeometry(EGG_R * 1.1, 12, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.scale.set(1, EGG_SY * 1.04, 1); hit.position.y = EGG_CY;
    root.add(hit);
    return { root, body, head, gunPivot, egg, hit, update: t => { for (const f of anim) f(t); } };
  }

  return { create, buildGun, makeShellTexture, drawPattern, TEAM_COLORS, EGG_CY };
})();
