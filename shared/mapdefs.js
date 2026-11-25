// ============================================================================
// shared/mapdefs.js — 15 mapas al estilo Shell Shockers (recreaciones propias) + ÑEMANAVE
// Inspirados en los mapas oficiales a partir de su descripción pública; la
// geometría es propia. Cada mapa define su tema, spawns, zonas de King of the
// Coop, la espátula y las bases de Capture the Spatula.
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mapbuilder.js'));
  else root.MapDefs = factory(root.MapBuilder);
})(typeof self !== 'undefined' ? self : this, function (MB) {
  'use strict';

  const SKY_DAY = { sky: 0x87ceeb, fog: [55, 150], sunColor: 0xfff4dd, sun: 1.0, amb: 0.62, hemiSky: 0xbfe3ff, hemiGround: 0x5a6b3a };

  // =========================================================================
  // 1. CASTLE — el mapa competitivo por excelencia
  // =========================================================================
  const castle = {
    id: 'castle', name: 'Castle', size: 'M', players: 12,
    desc: 'Fortaleza de piedra con murallas transitables, torres y torreón central de dos pisos.',
    halfSize: 30, gravity: -22, ground: 'grass',
    theme: SKY_DAY,
    build(b) {
      const H = 6;
      // Murallas perimetrales (camino de ronda arriba)
      b.aabb(-29, 0, -29, 29, H, -27, 'stone');
      b.aabb(-29, 0, 27, 29, H, 29, 'stone');
      b.aabb(-29, 0, -27, -27, H, 27, 'stone');
      b.aabb(27, 0, -27, 29, H, 27, 'stone');
      // Pretil exterior
      b.aabb(-29, H, -29, 29, H + 1, -28.4, 'stoneDark');
      b.aabb(-29, H, 28.4, 29, H + 1, 29, 'stoneDark');
      b.aabb(-29, H, -28.4, -28.4, H + 1, 28.4, 'stoneDark');
      b.aabb(28.4, H, -28.4, 29, H + 1, 28.4, 'stoneDark');
      // Almenas sobre el pretil (cada 2 m) — silueta de castillo de verdad
      for (let t = -20; t <= 20; t += 2.5) {
        b.aabb(t - 0.55, H + 1, -29, t + 0.55, H + 1.8, -28.4, 'stoneDark');
        b.aabb(t - 0.55, H + 1, 28.4, t + 0.55, H + 1.8, 29, 'stoneDark');
        b.aabb(-29, H + 1, t - 0.55, -28.4, H + 1.8, t + 0.55, 'stoneDark');
        b.aabb(28.4, H + 1, t - 0.55, 29, H + 1.8, t + 0.55, 'stoneDark');
      }
      // Torres de las esquinas con escalera desde el camino de ronda
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.aabb(sx * 22, 0, sz * 22, sx * 29.6, 9, sz * 29.6, 'stoneDark');
        b.aabb(sx * 22, 9, sz * 29, sx * 29.6, 10, sz * 29.6, 'stone');
        b.aabb(sx * 29, 9, sz * 22, sx * 29.6, 10, sz * 29, 'stone');
        // Almenas de la torre y estandarte en lo alto
        for (const k of [23.2, 25.8, 28.4]) {
          b.aabb(Math.min(sx * (k - 0.5), sx * (k + 0.5)), 10, Math.min(sz * 29, sz * 29.6), Math.max(sx * (k - 0.5), sx * (k + 0.5)), 10.8, Math.max(sz * 29, sz * 29.6), 'stone');
          b.aabb(Math.min(sx * 29, sx * 29.6), 10, Math.min(sz * (k - 0.5), sz * (k + 0.5)), Math.max(sx * 29, sx * 29.6), 10.8, Math.max(sz * (k - 0.5), sz * (k + 0.5)), 'stone');
        }
        b.ladder(sx * 22, sz * 27.7, H, 3, sx > 0 ? '+x' : '-x');
        b.decoAt('banner', sx * 22, 7.2, sz * 25.5, { rotY: sx > 0 ? -Math.PI / 2 : Math.PI / 2, color: sx < 0 ? 0xc0392b : 0x2f6fb5 });
      }
      // Escalinatas a las murallas
      b.stairs(-6, -25.8, 0, 2.4, 8, H, '+x', 'stone');
      b.stairs(6, 25.8, 0, 2.4, 8, H, '-x', 'stone');
      b.stairs(-25.8, 6, 0, 2.4, 8, H, '-z', 'stone');
      b.stairs(25.8, -6, 0, 2.4, 8, H, '+z', 'stone');

      // Torreón central (2 pisos + azotea)
      b.room(0, 0, 0, 14, 12, 7, 'stone', { cornice: 'stoneDark',
        open: [
          { side: 'n', at: 5, w: 2.2, h: 2.6 }, { side: 's', at: 0, w: 2.2, h: 2.6 },
          { side: 'e', at: 0, w: 2.2, h: 2.6 }, { side: 'w', at: 0, w: 2.2, h: 2.6 },
          { side: 'n', at: -3, y: 4.4, w: 1.6, h: 1.2 }, { side: 's', at: 3, y: 4.4, w: 1.6, h: 1.2 },
          { side: 's', at: -3, y: 4.4, w: 1.6, h: 1.2 },
          { side: 'e', at: -3, y: 4.4, w: 1.6, h: 1.2 }, { side: 'w', at: 3, y: 4.4, w: 1.6, h: 1.2 },
        ],
        floors: [{ y: 3.5, hole: { x: -1, z: -4.4, w: 9, d: 2.4 }, mat: 'plank' }],
        roof: true, roofHole: { x: 5.9, z: 4, w: 1.4, d: 1.8 }, parapet: 0.8, parapetMat: 'stoneDark',
      });
      b.stairs(-1, -4.4, 0, 2.4, 8, 3.5, '+x', 'woodDark');
      b.ladder(6.6, 4, 3.5, 3.8, '+x');
      b.decoAt('banner', 0, 5.2, 6.05, { rotY: 0, color: 0xf1c40f });
      b.decoAt('banner', 0, 5.2, -6.05, { rotY: Math.PI, color: 0xf1c40f });
      // Antorchas
      [[-3.4, 6.2], [3.4, 6.2], [-3.4, -6.2], [3.4, -6.2]].forEach(([x, z]) => b.decoAt('torch', x, 2.4, z));

      // Patio: pozo, muretes, carros y cobertizos
      b.box(-20, 0, 8, 2.4, 1.1, 2.4, 'stone');
      b.decoAt('well', -20, 0, 8);
      // Barracones de 2 pisos con puente desde la azotea al paseo de ronda
      [0, 2].forEach(rot => b.with({ rot }, () => {
        b.house2(14, -15, 11, 8, 'stone', { h1: 2.85, doors: ['s', 'w'], trim: 'stoneDark', floorMat: 'plank', gaps: [{ side: 'n', at: 2, w: 2.2 }] });
        b.bridge(16, -19, 16, -27, 6, 2.2, 'woodDark', { railMat: 'woodDark' });
        b.decoAt('banner', 14, 4.6, -10.75, { rotY: 0, color: rot ? 0x2f6fb5 : 0xc0392b });
      }));
      [[-12, -12, false], [12, 12, false], [-16, 0, false], [16, 0, false], [0, -17, true], [0, 17, true]].forEach(([x, z, ax]) => {
        if (ax) b.box(x, 0, z, 4, 1.2, 0.8, 'stoneOld'); else b.box(x, 0, z, 0.8, 1.2, 4, 'stoneOld');
      });
      for (const s of [-1, 1]) {
        b.with({ rot: s < 0 ? 2 : 0 }, () => {
          // Cobertizo pegado a la muralla este (x 21..27, z 8..16) - techo a 3.2
          b.slab(24, 12, 3.2, 6, 8, 0.3, 'woodDark');
          b.pillar(21.3, 0, 8.3, 0.4, 2.9, 'woodDark');
          b.pillar(21.3, 0, 15.7, 0.4, 2.9, 'woodDark');
          b.crate(19.8, 0, 6.8, 1.2);
          b.crate(19.8, 0, 5.6, 1.2);
          b.crate(19.8, 1.2, 6.8, 1.2);
          b.hay(24, 0, 12, true);
          b.hay(24, 0, 14.5, true);
          b.decoAt('cart', 14, 0, 20, { rotY: 0.4 });
          b.box(14, 0, 20, 2.4, 1.4, 1.4, 'invisible');
        });
      }
      // Mercadillo del patio: puestos con tejadillo transitable (salto desde cajas)
      for (const s of [-1, 1]) {
        b.with({ rot: s < 0 ? 0 : 2 }, () => {
          [[-9.8, -22.3], [-6.2, -22.3], [-9.8, -19.7], [-6.2, -19.7]].forEach(([x, z]) => b.pillar(x, 0, z, 0.3, 2.55, 'woodDark'));
          b.slab(-8, -21, 2.8, 4.4, 3.2, 0.25, s < 0 ? 'roofRed' : 'roofBlue');
          b.crate(-8, 0, -18.6, 1.2); b.crate(-11.4, 0, -21, 1.3); b.crate(-11.4, 1.3, -21, 1.0);
          b.box(-8, 0, -21.6, 3, 0.9, 1, 'wood');
          b.decoAt('apple', -8.6, 0.9, -21.6); b.decoAt('apple', -7.4, 0.9, -21.6);
        });
      }
      // Jardín: setos y árboles junto a la muralla interior
      [[-18, -24], [18, 24], [-24, -16], [24, 16], [-24, 16], [24, -16]].forEach(([x, z]) => b.decoAt('bush', x, 0, z));
      b.tree(-20, -6, 0.9); b.tree(20, 6, 0.9);
      // Antorchas y estandartes en el paseo de ronda
      [[-14, -26.9, 0], [14, 26.9, Math.PI], [-26.9, 14, Math.PI / 2], [26.9, -14, -Math.PI / 2]].forEach(([x, z, r]) => b.decoAt('banner', x, 4.6, z, { rotY: r, color: 0xf39c12 }));
      // v5b: terrazas elevadas por parejas con escalones
      b.platform(-12, -4, 6, 5, 2, 'stone', ['s'], { stairs: true, len: 4, rw: 2.4, rim: 'stoneDark' });
      b.platform(12, 4, 6, 5, 2, 'stone', ['n'], { stairs: true, len: 4, rw: 2.4, rim: 'stoneDark' });
    },
    spawns: [
      { x: -18, z: -18 }, { x: 18, z: 18 }, { x: -20, z: 21 }, { x: 20, z: -21 }, { x: 0, z: -11 }, { x: 0, z: 11 },
      { x: 14, y: 6, z: -15 }, { x: -14, y: 6, z: 15 },
      { x: -12, y: 2, z: -4 }, { x: 12, y: 2, z: 4 }, { x: 0, y: 3.5, z: 0 }, { x: 0, y: 6, z: -27.7 }, { x: 0, y: 6, z: 27.7 },
      { x: 22, z: -10 }, { x: 8, z: -22 }, { x: -8, z: 22 },
    ],
    teamSpawns: {
      red: [{ x: -20, z: -4 }, { x: -20, z: 4 }, { x: -22, z: 0 }, { x: -18, z: -6 }, { x: -18, z: 6 }],
      blue: [{ x: 20, z: 4 }, { x: 20, z: -4 }, { x: 22, z: 0 }, { x: 18, z: 6 }, { x: 18, z: -6 }],
    },
    coops: [{ x: 0, y: 7.3, z: 0, r: 3 }, { x: -18, y: 0, z: -18, r: 3.5 }, { x: 18, y: 0, z: 18, r: 3.5 }, { x: 0, y: 0, z: -14, r: 3 }, { x: 0, y: 0, z: 14, r: 3 }],
    spatula: { x: 0, y: 0, z: 0 },
    bases: { red: { x: -22, y: 0, z: 0, r: 3 }, blue: { x: 22, y: 0, z: 0, r: 3 } },
  };

  // =========================================================================
  // 2. DIRT — el mapa más grande: granja, granero, contenedores y silos
  // =========================================================================
  const dirt = {
    id: 'dirt', name: 'Dirt', size: 'L', players: 18,
    desc: 'La granja enorme: granero con pajar, contenedores apilados, silos y colinas de tierra.',
    halfSize: 40, gravity: -22, ground: 'dirt',
    theme: Object.assign({}, SKY_DAY, { fog: [60, 170], particles: 'dust' }),
    build(b) {
      b.perimeter(40, 4, 'woodDark', 1);
      b.decoAt('plane', 0, 0.02, 0, { w: 8, d: 80, color: 0x9b6a3c });
      b.decoAt('plane', 0, 0.02, 0, { w: 80, d: 8, color: 0x9b6a3c });

      // Granero central con pajar y tejado a dos aguas transitable
      b.room(0, 0, 0, 16, 10, 6, 'barnRed', { cornice: 'woodDark',
        open: [
          { side: 'e', at: 0, w: 4, h: 4 }, { side: 'w', at: 0, w: 4, h: 4 },
          { side: 'n', at: -4, w: 2, h: 2.6 }, { side: 's', at: 4, w: 2, h: 2.6 },
          { side: 'n', at: 3, y: 3.6, w: 1.6, h: 1.2 }, { side: 's', at: -3, y: 3.6, w: 1.6, h: 1.2 },
        ],
        roof: true, roofMat: 'woodDark',
      });
      b.slab(-4.3, 0, 3, 6.6, 9.2, 0.3, 'plank');      // pajar
      b.ladder(-1, 3, 0, 3, '-x');
      b.gable(0, 0, 6.3, 16, 10, 2.2, true, 'roofRed');
      b.ladder(6, -5, 0, 6.3, '+z');
      b.hay(4, 0, -3, true); b.hay(4, 1.2, -3, true); b.hay(6, 0, 3, false); b.hay(-5, 3, 3, true);

      // Patio de contenedores NE
      b.container(24, 0, -22, true, 'cRed');
      b.container(24, 2.6, -22, true, 'cBlue');
      b.container(24, 0, -19.2, true, 'cGreen');
      b.ramp(18, -19.2, 0, 2.6, 6, 2.6, '+x', 'plank');
      b.ladder(24, -20.7, 2.6, 2.6, '-z');
      b.container(30, 0, -30, false, 'cOrange');
      b.container(30, 2.6, -30, false, 'cYellow');
      b.container(30, 5.2, -30, false, 'cRed');
      b.ladder(28.7, -30, 0, 7.8, '+x');
      b.container(16, 0, -32, true, 'cBlue');
      b.container(33, 0, -14, false, 'cGreen');

      // Patio de contenedores SO (otra disposición)
      b.container(-24, 0, 22, true, 'cBlue');
      b.container(-24, 2.6, 22, true, 'cOrange');
      b.container(-24, 0, 19.2, true, 'cRed');
      b.ramp(-18, 19.2, 0, 2.6, 6, 2.6, '-x', 'plank');
      b.ladder(-24, 20.7, 2.6, 2.6, '+z');
      b.container(-30, 0, 30, false, 'cGreen');
      b.container(-30, 2.6, 30, false, 'cYellow');
      b.ladder(-28.7, 30, 0, 5.2, '-x');

      // Colinas de tierra
      b.hill(-22, -22, 3, 5, 4, 'mud');
      b.hill(22, 22, 3, 5, 4, 'mud');

      // Silos con escalera
      for (const z of [8, 14]) {
        b.box(-27, 0, z, 3.6, 10, 3.6, 'invisible');
        b.decoAt('silo', -27, 0, z, { r: 1.9, h: 10 });
        b.ladder(-25.2, z, 0, 10, '-x', { metal: true });
      }
      b.aabb(-27.4, 10, 10.4, -26.6, 10.15, 11.6, 'metalDark'); // pasarela entre silos

      // Pacas y vallas
      [[-14, 28, true], [-12, 28, true], [-13, 28, true, 1.2], [12, 26, false], [26, 6, true], [26, 8.5, true], [-8, -16, true], [8, 16, false],
        [-30, -8, false], [32, 20, true], [-34, -30, true], [6, -28, true]].forEach(([x, z, ax, y]) => b.hay(x, y || 0, z, ax));
      [[-16, -6, 6, true], [16, 6, 6, true], [-6, -16, 6, false], [6, 16, 6, false], [0, -34, 10, true], [0, 34, 10, true]].forEach(([x, z, L, ax]) => {
        if (ax) b.box(x, 0, z, L, 1.1, 0.25, 'wood'); else b.box(x, 0, z, 0.25, 1.1, L, 'wood');
      });
      b.box(14, 0, 30, 3.2, 2, 2, 'invisible');
      b.decoAt('tractor', 14, 0, 30, { rotY: 0.3 });
      b.tree(-34, -18, 1.3); b.tree(34, -2, 1.2); b.tree(-6, 34, 1.1); b.tree(30, 34, 1.3); b.tree(-34, 4, 1.0);
      b.decoAt('windmill', 34, 0, -36);
      // Torre de vigilancia de madera (NO) con barandilla
      b.box(-4, 0, -30, 4, 6, 4, 'woodDark');
      b.ring(-4, -30, 6, 4, 4, 1, 0.25, 'wood', [{ side: 's', at: 0, w: 1.8 }]);
      b.ladder(-4, -28, 0, 6, '-z');
      // Establos de 2 pisos con puente a la torre de contenedores y silos-torre de vigía
      [0, 2].forEach(rot => b.with({ rot }, () => {
        b.house2(6, -21, 12, 9, 'barnRed', { h1: 2.45, doors: ['s', 'w'], trim: 'woodDark', roofMat: 'woodDark', gaps: [{ side: 'e', at: -2, w: 2.2 }] });
        b.bridge(12, -23, 21, -23, 5.2, 2.2, 'plank', { supports: true });
        b.tower(32, 12, 9, 3.4, 'woodDark', 'w', { roof: 'roofRed' });
      }));
      // Casa de labranza con tejado a dos aguas transitable
      b.room(-9.5, -23, 0, 8, 6, 3.2, 'wood', { cornice: 'woodDark',
        open: [{ side: 's', at: 1.5, w: 2, h: 2.5 }, { side: 'w', at: 0, w: 1.8, h: 2.5 }, { side: 'n', at: -2, y: 1.1, w: 1.6, h: 1.1 }, { side: 'e', at: 1, y: 1.1, w: 1.4, h: 1.1 }],
        roof: true, roofMat: 'woodDark',
      });
      b.gable(-9.5, -23, 3.5, 8, 6, 1.6, true, 'roofRed');
      b.ladder(-5.5, -25, 0, 3.5, '-x');
      b.crate(-11.5, 0, -24.5, 1.1); b.box(-11.6, 0, -21.2, 1.6, 0.8, 1, 'woodDark');
      // Huerto con surcos y espantapájaros
      for (let i = 0; i < 5; i++) b.decoAt('plane', 12 + i * 1.6, 0.03, -2, { w: 0.9, d: 9, color: i % 2 ? 0x6b8f2e : 0x7a5530 });
      [[-34, -24], [34, 24], [-20, 34], [20, -36]].forEach(([x, z]) => b.decoAt('bush', x, 0, z));
    },
    spawns: [
      { x: -30, z: -30 }, { x: 30, z: 30 }, { x: -30, z: 10 }, { x: 30, z: -10 }, { x: -4, z: -15 }, { x: 4, z: 15 },
      { x: -16, z: 0 }, { x: 16, z: 0 }, { x: 3, z: 1 }, { x: -4, y: 3, z: 0 }, { x: -10, z: -30 }, { x: 10, z: 30 },
      { x: 6, y: 5.2, z: -21 }, { x: -6, y: 5.2, z: 21 },
      { x: 20, z: -8 }, { x: -20, z: 8 }, { x: 24, y: 5.2, z: -22 },
    ],
    teamSpawns: {
      red: [{ x: -32, z: 0 }, { x: -32, z: -6 }, { x: -32, z: 6 }, { x: -28, z: -12 }, { x: -30, z: 2 }],
      blue: [{ x: 32, z: 0 }, { x: 32, z: 6 }, { x: 32, z: -6 }, { x: 28, z: 12 }, { x: 30, z: -2 }],
    },
    coops: [{ x: 3, y: 0, z: 0, r: 3.5 }, { x: -22, y: 3, z: -22, r: 2.5 }, { x: 22, y: 3, z: 22, r: 2.5 }, { x: 10, y: 0, z: -31, r: 3 }, { x: -10, y: 0, z: 31, r: 3 }, { x: 24, y: 5.2, z: -22, r: 2 }, { x: 32, y: 9, z: 12, r: 1.2 }],
    spatula: { x: 0, y: 0, z: 14 },
    bases: { red: { x: -32, y: 0, z: 0, r: 3.5 }, blue: { x: 32, y: 0, z: 0, r: 3.5 } },
  };

  // =========================================================================
  // 3. FEEDLOT — túneles en 3 lados, zona abierta y el "voladizo"
  // =========================================================================
  const feedlot = {
    id: 'feedlot', name: 'Feedlot', size: 'M', players: 18,
    desc: 'Túneles que rodean dos tercios del mapa, una torre alta, el voladizo y una zona abierta.',
    halfSize: 30, gravity: -22, ground: 'dirt',
    theme: Object.assign({}, SKY_DAY, { sky: 0x9cc6dc }),
    build(b) {
      const T = 3.5;
      // Bloques exteriores macizos (la parte superior es el nivel alto)
      b.aabb(-30, 0, -30, 30, T, -27, 'concrete');
      b.aabb(-30, 0, -27, -27, T, 20, 'concrete');
      b.aabb(27, 0, -27, 30, T, 20, 'concrete');
      // Muros interiores de los túneles con entradas
      b.wallSeg('x', -22.75, -22, 22, 0, 3.2, 1.5, [{ at: -10, w: 2.4 }, { at: 10, w: 2.4 }], 'concrete');
      b.wallSeg('z', -22.75, -23.5, 20, 0, 3.2, 1.5, [{ at: -16.25, w: 2.4 }, { at: 7.75, w: 2.4 }], 'concrete');
      b.wallSeg('z', 22.75, -23.5, 20, 0, 3.2, 1.5, [{ at: -10.25, w: 2.4 }, { at: 1.75, w: 2.4 }], 'concrete');
      // Techos de túnel con trampillas para las escaleras
      b.slab(0, -24.5, T, 54, 5, 0.3, 'concrete', [{ x: 0, z: -26.1, w: 1.6, d: 1.8 }]);
      b.slab(-24.5, -1, T, 5, 42, 0.3, 'concrete', [{ x: -26.1, z: 4, w: 1.8, d: 1.6 }]);
      b.slab(24.5, -1, T, 5, 42, 0.3, 'concrete', [{ x: 26.1, z: -8, w: 1.8, d: 1.6 }]);
      b.ladder(0, -27, 0, T, '-z', { metal: true });
      b.ladder(-27, 4, 0, T, '-x', { metal: true });
      b.ladder(27, -8, 0, T, '+x', { metal: true });
      // Recodos de los túneles laterales (más anchos y con giros)
      [[-14, 1], [-5, -1], [4, 1], [13, -1]].forEach(([z, side]) => {
        b.aabb(side > 0 ? -25.5 : -27, 0, z, side > 0 ? -23.5 : -25, 3.2, z + 1, 'stoneDark');
        b.aabb(side > 0 ? 25 : 23.5, 0, z - 1, side > 0 ? 27 : 25.5, 3.2, z, 'stoneDark');
      });
      // Pretil exterior
      b.aabb(-30, T, -30, 30, T + 1, -29.4, 'stoneDark');
      b.aabb(-30, T, -29.4, -29.4, T + 1, 20, 'stoneDark');
      b.aabb(29.4, T, -29.4, 30, T + 1, 20, 'stoneDark');
      // Escalinata desde la zona abierta al nivel alto
      b.stairs(15.5, -20.8, 0, 2.4, 7, T, '+x', 'concrete');
      b.stairs(-20.8, 14, 0, 2.4, 6, T, '-z', 'concrete');
      // El voladizo
      b.slab(-8, -19, T, 6, 6, 0.3, 'concrete');
      // Torre central (versión 2023)
      b.box(4, 0, 2, 5, 10, 5, 'concrete');
      b.ring(4, 2, 10, 5, 5, 0.9, 0.3, 'stoneDark', [{ side: 's', at: 0, w: 1.8 }]);
      b.ladder(4, 4.5, 0, 10, '-z', { metal: true });
      // Zona sur abierta: muro bajo y la "protuberancia" con escalera
      b.aabb(-30, 0, 28.8, 30, 2.4, 30, 'concrete');
      b.aabb(-30, 0, 20, -29, 2.4, 28.8, 'concrete');
      b.aabb(29, 0, 20, 30, 2.4, 28.8, 'concrete');
      b.aabb(-8, 0, 24, 0, 3, 28.8, 'concrete');
      b.ladder(-4, 24, 0, 3, '+z', { metal: true });
      // Comederos, vallas y cajas
      [[-4, -10, 0], [14, -10, 1]].forEach(([x, z, i]) => {
        if (i % 2) b.box(x, 0, z, 4, 0.9, 1.1, 'woodDark'); else b.box(x, 0, z, 1.1, 0.9, 4, 'woodDark');
        b.decoAt('trough', x, 0.9, z, { w: i % 2 ? 4 : 1.1, d: i % 2 ? 1.1 : 4 });
      });
      b.crate(-12, 0, 14); b.crate(-10.6, 0, 14); b.crate(-11.3, 1.4, 14);
      b.crate(12, 0, 20); b.crate(17, 0, -4); b.crate(17, 1.4, -4); b.crate(-2, 0, 18);
      b.hay(8, 0, 22, true); b.hay(18, 0, 24, false); b.hay(-18, 0, 24, true);
      b.decoAt('silo', 24, 0, 25, { r: 1.8, h: 7 }); b.box(24, 0, 25, 3.4, 7, 3.4, 'invisible');
      // Pasarela de tablones desde el techo del túnel este hacia el centro
      b.slab(17.5, -10, T, 9.4, 2.2, 0.3, 'plank');
      b.wallSeg('x', -11.05, 13, 22, T, 0.9, 0.12, [], 'rail');
      b.wallSeg('x', -8.95, 13, 22, T, 0.9, 0.12, [], 'rail');
      [[13.3, -10.9], [13.3, -9.1]].forEach(([x, z]) => b.pillar(x, 0, z, 0.3, T - 0.3, 'woodDark'));
      // Corrales: vallas de madera y abrevadero
      b.box(-14, 0, 20, 0.2, 1.1, 6, 'wood'); b.box(-11, 0, 17, 6, 1.1, 0.2, 'wood');
      b.decoAt('trough', -11, 0, 21, { w: 3, d: 0.8 });
      b.decoAt('silo', -24, 0, 25, { r: 1.6, h: 6 }); b.box(-24, 0, 25, 3, 6, 3, 'invisible');
      // Oficina del corral (2 pisos) y plataforma con pasarela desde el túnel oeste
      b.house2(13, 10, 11, 8, 'concrete', { h1: 2.6, doors: ['w', 's'], trim: 'stoneDark', roofMat: 'concrete' });
      b.platform(-12, -6, 5, 5, T, 'concrete', ['s'], { stairs: true, rim: 'rail' });
      b.bridge(-22, -6, -14.5, -6, T, 2.2, 'plank');
      [[6, -14], [-16, 10], [20, 14]].forEach(([x, z]) => b.decoAt('bush', x, 0, z));
    },
    spawns: [
      { x: -7, z: 0 }, { x: 6, z: 17 }, { x: 0, z: 14 }, { x: -16, z: 4 }, { x: 13, y: 5.5, z: 10 }, { x: -12, y: 3.5, z: -6 }, { x: 14, z: -14 }, { x: 0, z: -25.25 },
      { x: -25.25, z: -8 }, { x: 25.25, z: 8 }, { x: -16, y: 3.5, z: -25 }, { x: 16, y: 3.5, z: -25 }, { x: 10, z: 26 },
      { x: -20, z: 26 }, { x: 4, y: 10, z: 2 },
    ],
    teamSpawns: {
      red: [{ x: -18, z: 0 }, { x: -18, z: 10 }, { x: -25.25, z: -18 }, { x: -25, y: 3.5, z: -10 }, { x: -18, z: -12 }],
      blue: [{ x: 18, z: 0 }, { x: 18, z: -12 }, { x: 25.25, z: 16 }, { x: 25, y: 3.5, z: 10 }, { x: 20.5, z: 3 }],
    },
    coops: [{ x: 4, y: 10, z: 2, r: 2 }, { x: -6, y: 0, z: 6, r: 3.5 }, { x: 0, y: 0, z: -25.25, r: 2.2 }, { x: -8, y: 3.5, z: -19, r: 2.4 }, { x: -4, y: 3, z: 26.4, r: 2.2 }],
    spatula: { x: -4, y: 0, z: 10 },
    bases: { red: { x: -18, y: 0, z: 4, r: 3 }, blue: { x: 19, y: 0, z: -8, r: 3 } },
  };

  // =========================================================================
  // 4. MOONBASE — base lunar de tres niveles con pasillos retorcidos
  // =========================================================================
  const moonbase = {
    id: 'moonbase', name: 'Moonbase', size: 'M', players: 18,
    desc: 'Base lunar: núcleo central con pasillos en anillo, módulos conectados por tubos y sala de control.',
    halfSize: 28, gravity: -17, ground: 'moon',
    theme: { sky: 0x05060f, fog: [40, 120], sunColor: 0xdfe8ff, sun: 0.9, amb: 0.5, hemiSky: 0x6677aa, hemiGround: 0x222233, stars: true, planet: true },
    build(b) {
      b.aabb(-28, 0, -28, 28, 3, -27, 'rock'); b.aabb(-28, 0, 27, 28, 3, 28, 'rock');
      b.aabb(-28, 0, -27, -27, 3, 27, 'rock'); b.aabb(27, 0, -27, 28, 3, 27, 'rock');
      b.perimeter(28, 9, 'invisible', 1);
      // Núcleo (hub) 16x16 con anillo de pasillos
      b.room(0, 0, 0, 16, 16, 3.4, 'scifi', { cornice: 'scifiDark',
        t: 0.5,
        open: ['n', 's', 'e', 'w'].map(side => ({ side, at: 0, w: 2.4, h: 2.6 })),
        roof: true, roofMat: 'scifiDark',
      });
      b.room(0, 0, 0, 6, 6, 3.4, 'scifiDark', { open: [{ side: 'e', at: 0, w: 2, h: 2.6 }, { side: 'w', at: 0, w: 2, h: 2.6 }] });
      for (let r = 0; r < 4; r++) b.with({ rot: r }, () => { b.aabb(3, 0, -5.2, 5.8, 3.4, -4.8, 'scifiDark'); });
      // Sala de control sobre la mitad norte del núcleo
      b.room(0, -4, 3.7, 16, 8, 3, 'scifi', { cornice: 'scifiDark',
        open: [{ side: 's', at: -4, w: 2, h: 2.4 }, { side: 's', at: 4, w: 2, h: 2.4 }, { side: 'e', at: 0, y: 1, w: 3, h: 1.2 }, { side: 'w', at: 0, y: 1, w: 3, h: 1.2 }, { side: 'n', at: 0, y: 1, w: 5, h: 1.2 }],
        roof: true, roofMat: 'scifiDark',
      });
      b.ladder(6, 0, 3.7, 3.3, '-z', { metal: true });
      b.decoAt('dome', 0, 7, -4, { r: 2.6 });
      b.ring(0, 4, 3.7, 16, 8, 0.9, 0.2, 'rail', [{ side: 'n', at: 0, w: 16 }, { side: 'e', at: -1.4, w: 2.4 }, { side: 'w', at: -1.4, w: 2.4 }]);
      b.ramp(9.2, 5.5, 0, 2.4, 7, 3.7, '-z', 'scifiDark');
      b.ramp(-9.2, 5.5, 0, 2.4, 7, 3.7, '-z', 'scifiDark');
      // Módulos conectados por tubos
      for (let r = 0; r < 4; r++) {
        b.with({ rot: r }, () => {
          b.aabb(8, 0, -1.6, 16, 2.8, -1.2, 'scifi');
          b.aabb(8, 0, 1.2, 16, 2.8, 1.6, 'scifi');
          b.slab(12, 0, 3.1, 8, 3.2, 0.3, 'glass');
          b.room(19, 0, 0, 6, 8, 3, 'scifi', { cornice: 'scifiDark',
            open: [{ side: 'w', at: 0, w: 2.4, h: 2.6 }, { side: 's', at: 0, w: 2, h: 2.4 }],
            roof: true, roofMat: 'scifiDark',
          });
          b.ramp(23.2, -1, 0, 2.4, 6, 3.3, '+z', 'metalDark');
          b.decoAt('antenna', 20.5, 3.3, -2.5);
          b.crate(13, 0, -4, 1.2, 'scifiDark'); b.crate(13, 0, 4.5, 1.2, 'scifiDark');
        });
      }
      // Plataforma de aterrizaje SE
      b.box(22, 0, 22, 8, 1, 8, 'metalDark');
      b.ramp(22, 17, 0, 3, 2, 1, '+z', 'metalDark');
      b.decoAt('padring', 22, 1, 22, { r: 3 });
      [[-20, -20, 3], [-21, 14, 2.4], [14, -21, 2.2], [-12, 20, 2], [20, -12, 1.8]].forEach(([x, z, r]) => b.decoAt('crater', x, 0.02, z, { r }));
      [[-14, -14], [14, -14], [-12, 11.6], [-22, -6], [6, 22], [-8.5, -22], [12, 12]].forEach(([x, z], i) => b.box(x, 0, z, 1.6 + (i % 3) * 0.5, 1.2 + (i % 2) * 0.6, 1.4 + (i % 2) * 0.6, 'rock'));
      // Torre de comunicaciones con antena (punto alto) en la esquina NE
      b.box(21, 0, -21, 3, 7, 3, 'scifiDark');
      b.ring(21, -21, 7, 3, 3, 0.9, 0.2, 'rail', [{ side: 's', at: 0, w: 1.4 }]);
      b.ladder(21, -19.5, 0, 7, '-z', { metal: true });
      b.decoAt('antenna', 21.8, 7, -21.8);
      // Paneles solares (cobertura baja) y rocas lunares
      [[-17, -14], [-17, -17], [10, 20], [13, 20]].forEach(([x, z], i) => b.box(x, 0, z, i < 2 ? 4 : 1.4, 1, i < 2 ? 1.4 : 4, 'glass'));
      [[-24, 8], [8, -24], [24, -6]].forEach(([x, z]) => b.decoAt('crater', x, 0.02, z, { r: 1.6 }));
      // v5: laboratorio de 2 pisos
      b.house2(-18, 19.5, 11, 8, 'scifi', { h1: 2.6, doors: ['n', 'e'], trim: 'scifiDark', roofMat: 'scifiDark', floorMat: 'metalDark', stairMat: 'metalDark', metal: true });
    },
    spawns: [
      { x: 5.5, z: -2 }, { x: -5.5, z: 2 }, { x: 6.6, z: -6.6 }, { x: 0, z: 0 }, { x: 19, z: 0 }, { x: -19, z: 0 },
      { x: 0, z: 19 }, { x: 0, z: -19 }, { x: 14, z: 10 }, { x: -14, z: -10 }, { x: 0, y: 3.7, z: 3.4 }, { x: 0, y: 3.7, z: -4 },
      { x: 22, y: 1, z: 22 }, { x: -20, z: 22 },
    ],
    teamSpawns: {
      red: [{ x: -19, z: 0 }, { x: -14, z: -6 }, { x: -14, z: 6 }, { x: -22, z: -10 }, { x: -20, z: 9 }],
      blue: [{ x: 19, z: 0 }, { x: 14, z: 6 }, { x: 14, z: -6 }, { x: 22, z: 10 }, { x: 20, z: -9 }],
    },
    coops: [{ x: 0, y: 0, z: 0, r: 2.2 }, { x: 0, y: 0, z: 19, r: 2.4 }, { x: 0, y: 0, z: -19, r: 2.4 }, { x: 0, y: 3.7, z: 3.4, r: 2.6 }, { x: 0, y: 7, z: -4, r: 2.5 }, { x: 22, y: 1, z: 22, r: 3 }],
    spatula: { x: 0, y: 0, z: 0 },
    bases: { red: { x: -19, y: 0, z: 0, r: 2.4 }, blue: { x: 19, y: 0, z: 0, r: 2.4 } },
  };

  // =========================================================================
  // 5. SHIPYARD — almacén enorme, contenedores-nido de francotirador y búnker
  // =========================================================================
  const shipyard = {
    id: 'shipyard', name: 'Shipyard', size: 'L', players: 18,
    desc: 'Astillero con un gran almacén, un edificio pequeño, torres de contenedores y un búnker.',
    halfSize: 38, gravity: -22, ground: 'concrete',
    theme: Object.assign({}, SKY_DAY, { sky: 0x9fc9e8, fog: [60, 170] }),
    build(b) {
      b.perimeter(38, 14, 'invisible', 1);
      for (let i = -34; i <= 34; i += 8) { b.decoAt('bollard', i, 0, -37); b.decoAt('bollard', i, 0, 37); }
      // Gran almacén central
      b.room(0, 0, 0, 20, 12, 8, 'metal', { cornice: 'metalDark',
        open: [
          { side: 'n', at: -5, w: 3, h: 3.5 }, { side: 's', at: 5, w: 3, h: 3.5 },
          { side: 'e', at: 0, w: 4, h: 4.5 }, { side: 'w', at: 0, w: 4, h: 4.5 },
          { side: 's', at: -5, y: 5, w: 3, h: 1.2 }, { side: 'n', at: 5, y: 5, w: 3, h: 1.2 },
        ],
        roof: true, roofMat: 'metalDark', parapet: 0.8, parapetMat: 'metalDark',
        parapetGaps: [{ side: 'w', at: -4, w: 1.8 }],
      });
      b.slab(0, -3.6, 4, 19.2, 4, 0.3, 'metalDark');
      b.wallSeg('x', -1.7, -9.6, 9.6, 4, 1, 0.15, [{ at: -6, w: 1.6, h: 2 }, { at: 6, w: 1.6, h: 2 }], 'rail');
      b.ladder(-6, -1.6, 0, 4, '-z', { metal: true });
      b.ladder(6, -1.6, 0, 4, '-z', { metal: true });
      b.ladder(-10, -4, 0, 8.3, '+x', { metal: true });
      b.crate(-6, 0, 3); b.crate(-4.6, 0, 3); b.crate(-5.3, 1.4, 3); b.crate(8.4, 0, 3.6); b.crate(3, 0, -4.8);
      // Edificio pequeño (oeste)
      b.room(-22, 8, 0, 10, 8, 5, 'brick', { cornice: 'stoneDark',
        open: [{ side: 'e', at: 0, w: 2, h: 2.6 }, { side: 'n', at: 2, w: 2, h: 2.6 }, { side: 'w', at: 0, y: 1.2, w: 2, h: 1.3 }, { side: 's', at: 2, y: 1.2, w: 2, h: 1.3 }],
        roof: true, roofMat: 'roofGrey', parapet: 0.8, parapetMat: 'brick', parapetGaps: [{ side: 's', at: 0, w: 1.8 }],
      });
      b.ladder(-22, 12, 0, 5.3, '-z', { metal: true });
      // Torres de contenedores (nidos de francotirador)
      b.container(-20, 0, -32, true, 'cRed'); b.container(-20, 2.6, -32, true, 'cBlue'); b.container(-20, 5.2, -32, true, 'cOrange');
      b.ladder(-20, -30.7, 0, 7.8, '-z', { metal: true });
      b.container(12, 0, -33, true, 'cGreen'); b.container(12, 2.6, -33, true, 'cYellow');
      b.ladder(12, -31.7, 0, 5.2, '-z', { metal: true });
      b.container(33, 0, -12, false, 'cBlue'); b.container(33, 2.6, -12, false, 'cRed');
      b.ladder(31.7, -12, 0, 5.2, '+x', { metal: true });
      // La más alta (4 alturas): sólo desde la de al lado
      for (let i = 0; i < 4; i++) b.container(33, i * 2.6, 10, false, ['cOrange', 'cGreen', 'cBlue', 'cRed'][i]);
      b.container(33, 0, 16.2, false, 'cYellow'); b.container(33, 2.6, 16.2, false, 'cBlue');
      b.ladder(31.7, 16.2, 0, 5.2, '+x', { metal: true });
      b.ladder(33, 13, 5.2, 5.2, '-z', { metal: true });
      b.container(-8, 0, 33, true, 'cRed'); b.container(-8, 2.6, 33, true, 'cGreen');
      b.ladder(-8, 31.7, 0, 5.2, '+z', { metal: true });
      b.container(-33, 0, -14, false, 'cYellow'); b.container(-33, 2.6, -14, false, 'cOrange'); b.container(-33, 5.2, -14, false, 'cBlue');
      b.ladder(-31.7, -14, 0, 7.8, '-x', { metal: true });
      b.container(-30, 0, 26, true, 'cBlue'); b.container(24, 0, -26, true, 'cOrange');
      // Oficinas del puerto (2 pisos), una con puente a la torre de contenedores
      b.house2(-18, -18, 12, 9, 'brick', { h1: 2.6, doors: ['s', 'e'], trim: 'stoneDark', roofMat: 'roofGrey' });
      b.house2(-14, 22, 12, 9, 'brick', { h1: 2.45, doors: ['n', 'e'], trim: 'stoneDark', roofMat: 'roofGrey', gaps: [{ side: 's', at: 4, w: 2.2 }] });
      b.bridge(-10, 26.5, -10, 31.7, 5.2, 2, 'metalDark', { railMat: 'rail' });
      // Torre de vigilancia del muelle
      b.tower(-32, -4, 10, 3.4, 'metalDark', 'e', { metal: true, roof: 'yellow', postMat: 'yellow' });
      b.container(14, 0, 14, true, 'cRed');
      // Búnker (lado rojo)
      b.room(18, 24, 0, 10, 7, 2.8, 'concrete', { cornice: 'stoneDark',
        t: 0.8, open: [{ side: 'n', at: -2.5, w: 2.2, h: 2.4 }, { side: 'w', at: 0, w: 2.2, h: 2.4 }, { side: 'e', at: 0, y: 1.2, w: 3, h: 0.8 }],
        roof: true, roofT: 0.6,
      });
      [[11.5, 19], [24, 19], [20.6, 16.2]].forEach(([x, z]) => b.box(x, 0, z, 2.4, 1, 0.9, 'sandbag'));
      // Grúa pórtico
      for (const lx of [-6, 6]) for (const lz of [-23, -17]) b.pillar(-4 + lx, 0, lz, 0.8, 12, 'yellow');
      b.decoAt('crane', -4, 12, -20, { w: 14, d: 7 });
      b.decoAt('forklift', 8, 0, 22, { rotY: 1.2 }); b.box(8, 0, 22, 1.6, 2.2, 2.6, 'invisible');
      // Tanques de combustible con pasarela superior
      for (const z of [-2, 4]) { b.decoAt('silo', 26, 0, z, { r: 1.7, h: 5 }); b.box(26, 0, z, 3.2, 5, 3.2, 'invisible'); }
      b.slab(26, 1, 5.15, 2, 6, 0.15, 'metalDark');
      b.ladder(24.4, 4, 0, 5.15, '+x', { metal: true });
      // Barcos amarrados fuera del muelle y farolas
      [[-24, -41, 0.2], [8, -42, -0.3], [30, 42, 2.9], [-16, 42, 3.3]].forEach(([x, z, r], i) => b.decoAt('boat', x, -0.3, z, { rotY: r, color: [0xc0392b, 0x2f6fb5, 0x27ae60, 0xf39c12][i] }));
      [[-12, -12], [12, -12], [-12, 14], [20, 10], [-28, -8]].forEach(([x, z]) => b.decoAt('lamp', x, 0, z));
    },
    spawns: [
      { x: 0, z: 2 }, { x: -6, z: -3 }, { x: 0, y: 4, z: -3.6 }, { x: 0, z: -14 }, { x: 0, z: 16 }, { x: -22, z: 8 },
      { x: 22, z: -8 }, { x: -28, z: -26 }, { x: 28, z: 28 }, { x: 22, z: 2 }, { x: -3, z: 24 }, { x: 30, z: -28 },
      { x: -22, y: 5.3, z: 8 }, { x: 0, y: 8.3, z: 0 }, { x: -34, z: 10 },
    ],
    teamSpawns: {
      red: [{ x: 18, z: 24 }, { x: 15, z: 24 }, { x: 18, z: 18 }, { x: 24, z: 17 }, { x: 21, z: 24 }],
      blue: [{ x: -22, z: 8 }, { x: -14, z: 8 }, { x: -22, z: 16 }, { x: -28, z: 2 }, { x: -24, z: 8 }],
    },
    coops: [{ x: 0, y: 0, z: 2, r: 3.5 }, { x: 0, y: 8.3, z: 0, r: 3.5 }, { x: -22, y: 5.3, z: 8, r: 3 }, { x: 18, y: 0, z: 24, r: 2.6 }, { x: 33, y: 10.4, z: 10, r: 1.8 }, { x: 0, y: 0, z: 26, r: 4 }],
    spatula: { x: 0, y: 0, z: 2 },
    bases: { red: { x: 18, y: 0, z: 22, r: 3 }, blue: { x: -22, y: 0, z: 0, r: 3 } },
  };

  // =========================================================================
  // 6. RUINS — templo central, columnas rotas y una torre derrumbada
  // =========================================================================
  const ruins = {
    id: 'ruins', name: 'Ruins', size: 'M', players: 18,
    desc: 'Ruinas antiguas cubiertas de hierba: templo elevado, arcos, columnas caídas y torre en ruinas.',
    halfSize: 28, gravity: -22, ground: 'grass',
    theme: Object.assign({}, SKY_DAY, { sky: 0xa9d3e8, fog: [45, 130], particles: 'pollen' }),
    build(b) {
      b.perimeter(28, 3.5, 'stoneOld', 1);
      b.perimeter(28, 10, 'invisible', 1);
      // Templo central con escalinatas
      b.box(0, 0, 0, 12, 2.4, 12, 'stoneOld');
      for (let r = 0; r < 4; r++) b.with({ rot: r }, () => b.stairs(0, -7.6, 0, 4, 3.2, 2.4, '+z', 'stoneOld'));
      [[-5, -5, 4.2], [5, -5, 4.2], [-5, 5, 1.8], [5, 5, 2.6]].forEach(([x, z, h]) => b.pillar(x, 2.4, z, 1, h, 'stone'));
      b.aabb(-5.5, 6.6, -5.5, 5.5, 7.2, -4.5, 'stone'); // dintel
      b.box(0, 2.4, 0, 2, 1, 2, 'stoneDark');
      // Arcos y muros rotos
      const arch = (x, z, alongX) => {
        if (alongX) { b.pillar(x - 2, 0, z, 1.2, 4, 'stoneOld'); b.pillar(x + 2, 0, z, 1.2, 4, 'stoneOld'); b.box(x, 4, z, 5.2, 0.9, 1.2, 'stoneOld'); }
        else { b.pillar(x, 0, z - 2, 1.2, 4, 'stoneOld'); b.pillar(x, 0, z + 2, 1.2, 4, 'stoneOld'); b.box(x, 4, z, 1.2, 0.9, 5.2, 'stoneOld'); }
      };
      arch(16, -16, true); arch(-16, 16, false); arch(18, 6, false); arch(-6, -18, true);
      [[12, 10, 6, 0.8, 2.2], [-12, -8, 0.8, 5, 3.2], [24, -4, 0.8, 4, 1.4], [-20, 2, 0.8, 6, 2.4], [6, 20, 5, 0.8, 1.8], [-4, 22, 4, 0.8, 3],
        [10, -22, 4, 0.8, 1.2], [22, 18, 0.8, 4, 2.6]].forEach(([x, z, w, d, h]) => b.box(x, 0, z, w, h, d, 'stoneOld'));
      // Columnas caídas
      b.box(-10, 0, 12, 4.5, 1, 1, 'stone'); b.box(12, 0, -10, 1, 1, 4.5, 'stone'); b.box(22, 0, -14, 5, 1, 1, 'stone');
      // Torre derrumbada NO con dos pisos
      b.room(-18, -18, 0, 7, 7, 6, 'stone', { cornice: 'stoneDark',
        open: [{ side: 's', at: 0, w: 2, h: 2.6 }, { side: 'e', at: -1, y: 3.8, w: 1.4, h: 1.2 }, { side: 'n', at: 1.5, y: 1, w: 1.2, h: 1.2 }],
        floors: [{ y: 3, hole: { x: -16.2, z: -16.2, w: 2.4, d: 2.4 }, mat: 'woodDark' }],
      });
      b.ladder(-16.2, -17.4, 0, 3, '-z');
      b.slab(-18, -19.75, 6, 6.2, 3.5, 0.3, 'woodDark');
      b.ladder(-18, -18, 3, 3, '-z');
      b.aabb(-21.5, 6, -21.5, -14.5, 7.2, -21.1, 'stone');
      // Árboles y arbustos
      b.tree(14, 14, 1.2); b.tree(-14, 22, 1); b.tree(22, -22, 1.3); b.tree(-24, 8, 1.1); b.tree(8, -14, 0.9); b.tree(24, 24, 1);
      [[-8, 16], [16, -6], [-22, -6], [4, 14]].forEach(([x, z]) => { b.box(x, 0, z, 1.6, 1.1, 1.6, 'hedge', { vis: false }); b.decoAt('bush', x, 0, z); });
      // v5: casa en ruinas de 2 pisos, terraza elevada y torre de vigía
      b.house2(14.5, 21, 11, 8, 'stoneOld', { h1: 2.6, doors: ['n', 'w'], trim: 'stone', floorMat: 'plank' });
      b.platform(20, 12.5, 8, 5, 1.8, 'stoneOld', ['n', 'w'], { stairs: true, rim: 'stone' });
      [0, 2].forEach(rot => b.with({ rot }, () => b.tower(20, -24, 8, 3, 'stone', 'w', { roof: 'roofRed' })));
      // v5b: terrazas elevadas por parejas con escalones
      b.platform(-20.5, 17, 6, 5, 2, 'stoneOld', ['n'], { stairs: true, len: 4, rw: 2.4, rim: 'stone' });
      b.platform(4, -19, 6, 5, 2, 'stoneOld', ['s'], { stairs: true, len: 4, rw: 2.4, rim: 'stone' });
    },
    spawns: [
      { x: 0, y: 2.4, z: -3 }, { x: 14, z: 0 }, { x: -14, z: 0 }, { x: 0, z: 14 }, { x: 0, z: -14 }, { x: 25, z: 4 }, { x: -20, z: 21.4 },
      { x: 22, z: -18 }, { x: -18, z: -16 }, { x: -19.5, y: 3, z: -19.5 }, { x: 6, z: 24 }, { x: 14.5, y: 5.5, z: 21 }, { x: 20, y: 1.8, z: 12.5 }, { x: -24, z: -2 }, { x: 24, z: 2 },
    ],
    teamSpawns: {
      red: [{ x: -20, z: 6 }, { x: -25, z: 9 }, { x: -16, z: 8 }, { x: -24, z: 18 }, { x: -18, z: 2 }],
      blue: [{ x: 20, z: -6 }, { x: 22, z: -12 }, { x: 16, z: -8 }, { x: 24, z: -18 }, { x: 18, z: -2 }],
    },
    coops: [{ x: 0, y: 2.4, z: -2.5, r: 3.2 }, { x: -19.5, y: 3, z: -19.5, r: 1.8 }, { x: 18, y: 0, z: 18, r: 3.5 }, { x: 18, y: 0, z: -18, r: 3.5 }, { x: -20.5, y: 2, z: 17, r: 2.2 }],
    spatula: { x: 0, y: 2.4, z: -2.5 },
    bases: { red: { x: -20, y: 0, z: 6, r: 3 }, blue: { x: 20, y: 0, z: -6, r: 3 } },
  };

  // =========================================================================
  // 7. BLUE — mapa simétrico moderno con puente central
  // =========================================================================
  const blue = {
    id: 'blue', name: 'Blue', size: 'M', players: 18,
    desc: 'Mapa simétrico de bloques azules: dos bases de dos plantas y un puente de cristal en el centro.',
    halfSize: 28, gravity: -22, ground: 'concrete',
    theme: Object.assign({}, SKY_DAY, { sky: 0x8fd3ff }),
    build(b) {
      b.perimeter(28, 4, 'blue', 1);
      b.perimeter(28, 12, 'invisible', 1);
      for (const s of [-1, 1]) {
        b.with({ mx: s < 0 }, () => {
          b.room(20, 0, 0, 8, 14, 3.4, 'blue', { cornice: 'concrete',
            open: [{ side: 'w', at: -3, w: 2.2, h: 2.6 }, { side: 'w', at: 3, w: 2.2, h: 2.6 }, { side: 's', at: 0, w: 2.2, h: 2.6 }, { side: 'e', at: 0, y: 1.1, w: 3, h: 1.2 }],
            roof: true, roofMat: 'white',
          });
          b.room(20, 3.5, 3.7, 8, 7, 3, 'white', { cornice: 'concrete',
            open: [{ side: 'n', at: -1.5, w: 2, h: 2.4 }, { side: 'w', at: 0, y: 1, w: 3, h: 1.2 }],
            roof: true, roofMat: 'blue',
          });
          b.stairs(19, -8.2, 0, 2.4, 6, 3.7, '+x', 'white');
          b.ladder(22, 0, 3.7, 3.3, '+z', { metal: true });
          b.ring(20, -3.5, 3.7, 8, 7, 1, 0.15, 'glass', [{ side: 's', at: 0, w: 8 }, { side: 'n', at: 1, w: 2.4 }]);
          // Plataforma media y rampa
          b.box(8, 0, 0, 4, 4, 8, 'blueLight');
          b.ramp(8, 7, 0, 3, 6, 4, '-z', 'white');
          b.aabb(6, 4, -4, 10, 5, -3.85, 'glass');
          // Muros de carril y coberturas
          b.box(14, 0, -14, 8, 3, 0.8, 'white'); b.box(14, 0, 14, 8, 3, 0.8, 'white');
          b.box(4, 0, -12, 0.8, 1.4, 5, 'blueLight'); b.box(4, 0, 12, 0.8, 1.4, 5, 'blueLight');
          b.crate(12, 0, 6, 1.4, 'white'); b.crate(12, 0, -6, 1.4, 'white');
          // Torretas en las esquinas
          b.box(22, 0, -22, 4, 5, 4, 'blue'); b.ladder(22, -20, 0, 5, '-z', { metal: true });
          b.box(22, 0, 22, 4, 5, 4, 'blue'); b.ladder(22, 20, 0, 5, '+z', { metal: true });
        });
      }
      // Puente central de cristal
      b.slab(0, 0, 4, 12, 2.4, 0.4, 'white');
      b.aabb(-6, 4, -1.2, 6, 5, -1.05, 'glass');
      b.aabb(-6, 4, 1.05, 6, 5, 1.2, 'glass');
      b.box(0, 0, 0, 1.2, 3.6, 1.2, 'blue');
      b.box(0, 0, -20, 6, 1.2, 1, 'blueLight'); b.box(0, 0, 20, 6, 1.2, 1, 'blueLight');
      // v5: bloques de oficinas de 2 pisos y torres de vigía (simétrico)
      [0, 2].forEach(rot => b.with({ rot }, () => {
        b.house2(10.5, -20, 14, 8, 'blue', { h1: 2.6, doors: ['s', 'w'], trim: 'concrete', roofMat: 'concrete', metal: true });
        b.tower(-22, -14, 8, 3.4, 'concrete', 'n', { metal: true, roof: 'blue', postMat: 'metalDark' });
      }));
      // v5b: terrazas elevadas por parejas con escalones
      b.platform(0, -12, 6, 5, 2, 'concrete', ['s'], { stairs: true, len: 4, rw: 2.4, rim: 'metalDark' });
      b.platform(0, 12, 6, 5, 2, 'concrete', ['n'], { stairs: true, len: 4, rw: 2.4, rim: 'metalDark' });
    },
    spawns: [
      { x: 20, z: -3 }, { x: -20, z: 3 }, { x: 0, y: 2, z: 12 }, { x: 0, y: 2, z: -12 }, { x: 14, z: 20 }, { x: -14, z: -20 }, { x: 14, z: -20 },
      { x: -14, z: 20 }, { x: 8, y: 4, z: -2 }, { x: -8, y: 4, z: 2 }, { x: 20, y: 3.7, z: 4 }, { x: -20, y: 3.7, z: -4 },
    ],
    teamSpawns: {
      red: [{ x: -20, z: -3 }, { x: -20, z: 3 }, { x: -14, z: -9.5 }, { x: -25, z: 10 }, { x: -20, y: 3.7, z: 4 }],
      blue: [{ x: 20, z: 3 }, { x: 20, z: -3 }, { x: 14, z: 9.5 }, { x: 25, z: -10 }, { x: 20, y: 3.7, z: 4 }],
    },
    coops: [{ x: 0, y: 4, z: 0, r: 2 }, { x: 0, y: 2, z: 12, r: 2.4 }, { x: 0, y: 2, z: -12, r: 2.4 }, { x: 20, y: 3.7, z: -3.5, r: 2.6 }, { x: -20, y: 3.7, z: -3.5, r: 2.6 }],
    spatula: { x: 0, y: 0, z: 3 },
    bases: { red: { x: -20, y: 0, z: 0, r: 2.6 }, blue: { x: 20, y: 0, z: 0, r: 2.6 } },
  };

  // =========================================================================
  // 8. FORT FLIP — dos fuertes de madera enfrentados
  // =========================================================================
  const fortflip = {
    id: 'fortflip', name: 'Fort Flip', size: 'M', players: 18,
    desc: 'Dos fuertes de madera de dos plantas con almenas y atalaya, separados por un arroyo seco.',
    halfSize: 30, gravity: -22, ground: 'grass',
    theme: Object.assign({}, SKY_DAY, { sky: 0x7ec0e6 }),
    build(b) {
      b.perimeter(30, 3, 'woodDark', 1);
      b.perimeter(30, 12, 'invisible', 1);
      for (const s of [-1, 1]) {
        b.with({ mx: s < 0 }, () => {
          b.room(20, 0, 0, 12, 12, 3.4, 'wood', { cornice: 'woodDark',
            open: [{ side: 'w', at: 0, w: 2.4, h: 2.6 }, { side: 'n', at: 3, w: 2, h: 2.6 }, { side: 's', at: -3, w: 2, h: 2.6 },
              { side: 'w', at: -3.8, y: 1.2, w: 1.4, h: 1 }, { side: 'w', at: 3.8, y: 1.2, w: 1.4, h: 1 }, { side: 'e', at: 0, y: 1.2, w: 2, h: 1 }],
            floors: [{ y: 3.4, hole: { x: 24.4, z: 2.6, w: 2.4, d: 6.2 }, mat: 'plank' }],
          });
          b.stairs(24.4, 2.1, 0, 2.4, 5, 3.4, '-z', 'woodDark');
          // Almenas
          b.ring(20, 0, 3.4, 12, 12, 1.4, 0.4, 'wood', [{ side: 'w', at: -2.5, w: 1 }, { side: 'w', at: 2.5, w: 1 }, { side: 'n', at: -2, w: 1 }, { side: 's', at: 2, w: 1 }, { side: 'e', at: 0, w: 1 }]);
          // Atalaya
          b.box(24, 3.4, -4, 3.6, 3.8, 3.6, 'woodDark');
          b.ring(24, -4, 7.2, 3.6, 3.6, 1, 0.2, 'wood', [{ side: 's', at: 0, w: 1.4 }]);
          b.ladder(24, -2.2, 3.4, 3.8, '-z');
          b.decoAt('banner', 14.05, 2.2, -2.5, { rotY: Math.PI / 2 * (1), color: 0x2f6fb5, team: true });
          b.hay(12, 0, 8, false); b.hay(11, 0, -9, true); b.crate(12.5, 0, -4, 1.3); b.crate(12.5, 1.3, -4, 1.3);
          b.box(9, 0, 0, 0.8, 1.2, 4, 'woodDark');
        });
      }
      // Arroyo seco con puente de madera
      b.decoAt('plane', 0, 0.03, 0, { w: 5, d: 60, color: 0x8a7458 });
      b.ramp(-1.5, 0, 0, 3, 3, 1.2, '+x', 'plank', { thick: 0.3 });
      b.ramp(1.5, 0, 0, 3, 3, 1.2, '-x', 'plank', { thick: 0.3 });
      b.box(0, 0, 12, 1, 1.4, 4, 'stoneOld'); b.box(0, 0, -12, 1, 1.4, 4, 'stoneOld');
      b.box(-4, 0, 20, 3, 1, 1, 'stoneOld'); b.box(4, 0, -20, 3, 1, 1, 'stoneOld');
      b.tree(-6, -24, 1.2); b.tree(6, 24, 1.2); b.tree(-24, 22, 1); b.tree(24, -22, 1);
      b.decoAt('cart', 3, 0, 16, { rotY: 1.2 }); b.box(3, 0, 16, 1.4, 1.4, 2.4, 'invisible');
      // v5: cuarteles de 2 pisos y torres de vigía
      b.house2(-4, -19, 12, 8, 'wood', { h1: 2.6, doors: ['s', 'e'], trim: 'woodDark', roofMat: 'woodDark' });
      b.house2(10.5, 18, 12, 8, 'wood', { h1: 2.6, doors: ['n', 'w'], trim: 'woodDark', roofMat: 'woodDark' });
      b.tower(14, -22, 8, 3.2, 'logs', 'w', { roof: 'roofRed' });
      b.tower(-14, 22, 8, 3.2, 'logs', 'e', { roof: 'roofBlue' });
    },
    spawns: [
      { x: 18, z: -3 }, { x: -18, z: 3 }, { x: 18, y: 3.4, z: 3 }, { x: -18, y: 3.4, z: -3 }, { x: 4, z: 12.5 }, { x: -4, z: -12.5 },
      { x: 1, z: 25 }, { x: -1, z: -25 }, { x: 8, z: -22 }, { x: -8, z: 22 }, { x: 0, y: 1.2, z: 0 }, { x: -4, y: 5.5, z: -19 }, { x: 10.5, y: 5.5, z: 18 },
    ],
    teamSpawns: {
      red: [{ x: -18, z: -3 }, { x: -18, z: 3 }, { x: -16, z: 0 }, { x: -17, y: 3.4, z: -2 }, { x: -22, y: 3.4, z: 3 }],
      blue: [{ x: 18, z: 3 }, { x: 18, z: -3 }, { x: 16, z: 0 }, { x: 17, y: 3.4, z: 2 }, { x: 21, y: 3.4, z: 3 }],
    },
    coops: [{ x: 4, y: 0, z: 12.5, r: 3.2 }, { x: -4, y: 0, z: -12.5, r: 3.2 }, { x: 0, y: 1.2, z: 0, r: 2 }, { x: 24, y: 7.2, z: -4, r: 1.5 }, { x: -24, y: 7.2, z: -4, r: 1.5 }],
    spatula: { x: 0, y: 0, z: 8 },
    bases: { red: { x: -18, y: 0, z: 0, r: 2.6 }, blue: { x: 18, y: 0, z: 0, r: 2.6 } },
  };


  // =========================================================================
  // 10. TWO TOWERS — dos torres de tres plantas unidas por un puente
  // =========================================================================
  const twotowers = {
    id: 'twotowers', name: 'Two Towers', size: 'M', players: 18,
    desc: 'Dos torres de tres plantas con escaleras interiores unidas por un puente a 8 metros.',
    halfSize: 28, gravity: -22, ground: 'grass',
    theme: Object.assign({}, SKY_DAY, { sky: 0x92c5ea }),
    build(b) {
      b.perimeter(28, 3, 'stoneOld', 1);
      b.perimeter(28, 16, 'invisible', 1);
      for (const s of [-1, 1]) {
        b.with({ mx: s > 0, ox: 0 }, () => {
          // En coordenadas locales la torre está en x = -16 y su lado "interior" mira a +x
          const cx = -16;
          b.room(cx, 0, 0, 7, 7, 12, 'brick', { cornice: 'stoneDark',
            open: [
              { side: 'e', at: 0, w: 2, h: 2.6 }, { side: 'w', at: 0, w: 2, h: 2.6 },
              { side: 'e', at: 0, y: 8, w: 1.8, h: 2.4 },
              { side: 'n', at: 0, y: 5.2, w: 1.4, h: 1.2 }, { side: 's', at: 0, y: 5.2, w: 1.4, h: 1.2 },
              { side: 'w', at: 0, y: 9.2, w: 1.4, h: 1.2 }, { side: 'n', at: 1.5, y: 1.2, w: 1.2, h: 1.1 },
            ],
            floors: [
              { y: 4, hole: { x: cx - 0.35, z: -2, w: 5.5, d: 2.2 }, mat: 'woodDark' },
              { y: 8, hole: { x: cx + 0.35, z: 2, w: 5.5, d: 2.2 }, mat: 'woodDark' },
            ],
            roof: true, roofMat: 'stoneDark', roofHole: { x: cx + 2.4, z: -1.8, w: 1.4, d: 1.8 }, parapet: 1, parapetMat: 'brick',
          });
          b.stairs(cx + 0.15, -2, 0, 2.2, 4.5, 4, '+x', 'woodDark');
          b.stairs(cx - 0.15, 2, 4, 2.2, 4.5, 4, '-x', 'woodDark');
          b.ladder(cx + 3.1, -1.8, 8, 4.3, '+x');
          b.decoAt('banner', cx - 3.55, 6, 0, { rotY: -Math.PI / 2, color: s < 0 ? 0xc0392b : 0x2f6fb5 });
          // Coberturas a pie de torre
          b.box(-8, 0, -6, 0.8, 1.4, 4, 'stoneOld'); b.box(-8, 0, 6, 0.8, 1.4, 4, 'stoneOld');
          b.crate(-22, 0, -8); b.crate(-22, 0, 8); b.crate(-22, 1.4, 8);
          b.box(-14, 0, -16, 6, 2.2, 0.8, 'hedge'); b.box(-14, 0, 16, 6, 2.2, 0.8, 'hedge');
          b.tree(-24, -22, 1.1); b.tree(-24, 22, 1.1);
          // v6: rocas en los flancos y farolas a la puerta de la torre
          b.rock(-25, -12.5, 1.9); b.rock(-9.5, 22.5, 1.6, { flat: true });
          b.decoAt('lamp', -11.6, 0, 2.6); b.decoAt('lamp', -11.6, 0, -2.6);
        });
      }
      // Puente y pilar central
      b.slab(0, 0, 8, 25, 2.4, 0.5, 'stoneDark');
      b.aabb(-12.5, 8, -1.2, 12.5, 9, -1.05, 'rail');
      b.wallSeg('x', 1.125, -12.5, 12.5, 8, 1, 0.15, [{ at: 0, w: 1.6, h: 2 }], 'rail');
      b.box(0, 0, 0, 3, 7.5, 3, 'stone');
      b.ladder(0, 1.5, 0, 8, '-z', { metal: true });
      // Centro
      b.box(0, 0, -12, 5, 1.2, 1, 'stoneOld'); b.box(0, 0, 12, 5, 1.2, 1, 'stoneOld');
      b.box(-6, 0, -20, 1, 2.5, 4, 'stoneOld'); b.box(6, 0, 20, 1, 2.5, 4, 'stoneOld');
      b.box(6, 0, -6, 1.4, 1.2, 1.4, 'crate'); b.box(-6, 0, 6, 1.4, 1.2, 1.4, 'crate');
      // v5: puesto de guardia de 2 pisos (simétrico)
      [0, 2].forEach(rot => b.with({ rot }, () => {
        b.house2(1, -20, 12, 8, 'stoneOld', { h1: 2.6, doors: ['s', 'e'], trim: 'stone', floorMat: 'plank' });
      }));
      // v5b: terrazas elevadas por parejas con escalones
      b.platform(-21, -17, 6, 5, 2, 'stoneOld', ['s'], { stairs: true, len: 4, rw: 2.4, rim: 'stone' });
      b.platform(21, 17, 6, 5, 2, 'stoneOld', ['n'], { stairs: true, len: 4, rw: 2.4, rim: 'stone' });
    },
    spawns: [
      { x: -16, z: 1.8 }, { x: 16, z: 1.8 }, { x: -16, y: 4, z: 0 }, { x: 16, y: 4, z: 0 }, { x: -15, y: 8, z: -1.5 }, { x: 15, y: 8, z: -1.5 },
      { x: 0, z: 18 }, { x: 0, z: -18 }, { x: 10, z: 10 }, { x: -10, z: -10 }, { x: 20, z: 22 }, { x: -20, z: -22 },
    ],
    teamSpawns: {
      red: [{ x: -16, z: 1.8 }, { x: -16, y: 4, z: 0 }, { x: -22, z: -2 }, { x: -22, z: 3 }, { x: -15, y: 8, z: -1.5 }],
      blue: [{ x: 16, z: 1.8 }, { x: 16, y: 4, z: 0 }, { x: 22, z: 2 }, { x: 22, z: -3 }, { x: 15, y: 8, z: -1.5 }],
    },
    coops: [{ x: 0, y: 8, z: 0, r: 2 }, { x: -16, y: 12.3, z: 0, r: 2.4 }, { x: 16, y: 12.3, z: 0, r: 2.4 }, { x: 0, y: 0, z: 10, r: 4 }, { x: 0, y: 0, z: -10, r: 4 }],
    spatula: { x: 0, y: 0, z: 14 },
    bases: { red: { x: -16, y: 0, z: 1.5, r: 2.2 }, blue: { x: 16, y: 0, z: 1.5, r: 2.2 } },
  };



  // =========================================================================
  // 35. MEDINA — ciudad de arenisca a varios niveles (diseño propio)
  // =========================================================================
  const medina = {
    id: 'medina', name: 'Medina', size: 'M', players: 18,
    desc: 'Ciudad de arenisca: murallas con paseo y casetas, casas de dos pisos unidas por puentes, minaretes y una plaza con fuente.',
    halfSize: 30, gravity: -22, ground: 'sand',
    theme: { sky: 0xa9cbe6, fog: [50, 150], sunColor: 0xffe8c4, sun: 1.05, amb: 0.62, hemiSky: 0xd9ecff, hemiGround: 0x9a7a4a, particles: 'dust' },
    build(b) {
      const W = 5.5;
      // Murallas-edificio con paseo de ronda (3.5 m de ancho) a 5.5 m
      b.aabb(-30, 0, -30, 30, W, -26.5, 'sandstone'); b.aabb(-30, 0, 26.5, 30, W, 30, 'sandstone');
      b.aabb(-30, 0, -26.5, -26.5, W, 26.5, 'sandstone'); b.aabb(26.5, 0, -26.5, 30, W, 26.5, 'sandstone');
      for (let t = -24; t <= 24; t += 3) {
        b.aabb(t - 0.6, W, -30, t + 0.6, W + 1.1, -29.4, 'sandstoneDk'); b.aabb(t - 0.6, W, 29.4, t + 0.6, W + 1.1, 30, 'sandstoneDk');
        b.aabb(-30, W, t - 0.6, -29.4, W + 1.1, t + 0.6, 'sandstoneDk'); b.aabb(29.4, W, t - 0.6, 30, W + 1.1, t + 0.6, 'sandstoneDk');
      }
      // Casetas en las esquinas de la muralla (se atraviesan desde los dos paseos)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.room(sx * 28.25, sz * 28.25, W, 3.5, 3.5, 2.6, 'sandstoneDk', { cornice: 'sandstone',
          open: [{ side: sx < 0 ? 'e' : 'w', at: 0, w: 1.6, h: 2.2 }, { side: sz < 0 ? 's' : 'n', at: 0, w: 1.6, h: 2.2 }],
          roof: true, roofMat: 'sandstone',
        });
      }
      // Plaza central: fuente con murete y arcadas
      b.ring(0, 0, 0, 6, 6, 0.9, 0.45, 'sandstoneDk', ['n', 's', 'e', 'w'].map(side => ({ side, at: 0, w: 1.6 })));
      b.decoAt('fountain', 0, 0, 0);
      [0, 2].forEach(rot => b.with({ rot }, () => {
        // Arcada con tres arcos
        b.wallSeg('x', -7, -8, 8, 0, 4, 1, [{ at: -4.5, w: 2.2, h: 2.8 }, { at: 0, w: 2.2, h: 2.8 }, { at: 4.5, w: 2.2, h: 2.8 }], 'sandstone');
        // Escalinata a la muralla
        b.stairs(-22, -22.5, 0, 2.4, 8, W, '-z', 'sandstoneDk');
        // Dos casas de 2 pisos (azotea a 5.5 m, igual que la muralla) unidas por un puente
        b.house2(-12, -15, 12, 9, 'sandstone', { h1: 2.6, doors: ['s', 'w'], trim: 'sandstoneDk', gaps: [{ side: 'n', at: 3, w: 2.2 }, { side: 'e', at: 0, w: 2.2 }] });
        b.house2(13, -15, 11, 9, 'sandstone', { h1: 2.6, doors: ['s', 'e'], trim: 'sandstoneDk', gaps: [{ side: 'w', at: 0, w: 2.2 }] });
        b.bridge(-6, -15, 7.5, -15, 5.5, 2.2, 'plank', { supports: true });
        b.bridge(-9, -19.5, -9, -26.5, 5.5, 2.2, 'plank');
        // Minarete (francotirador) con tejadillo
        b.tower(0, -22, 9, 3, 'sandstoneDk', 's', { roof: 'sandstone' });
        // Terraza elevada lateral (base) con escalones y pretil
        b.platform(-20, 0, 8, 10, 1.6, 'sandstoneDk', ['e'], { stairs: true, rim: 'sandstone' });
        // Mercado: puestos, cajas y coche aparcado
        b.decoAt('stall', -6, 0, -10.5, { color: 0xc0392b }); b.box(-6, 0, -10.5, 3, 0.9, 1, 'wood');
        b.decoAt('stall', 6, 0, -10.5, { color: 0x2f6fb5 }); b.box(6, 0, -10.5, 3, 0.9, 1, 'wood');
        b.decoAt('car', 10, 0, -3, { rotY: 0.3, color: 0xd8d8d8 }); b.box(10, 0, -3, 2.4, 1.6, 4.4, 'invisible');
        [[-24, -8], [-8, 22.5], [5, -4]].forEach(([x, z]) => { b.box(x, 0, z, 0.5, 4, 0.5, 'woodDark', { vis: false }); b.decoAt('palm', x, 0, z); });
        b.decoAt('torch', -11.5, 1.8, -10.25); b.decoAt('torch', 12.5, 1.8, -10.25);
      }));
    },
    coverDensity: 0.6,
    spawns: [
      { x: 0, z: -11 }, { x: 0, z: 11 }, { x: -22, z: -14 }, { x: 22, z: 14 }, { x: -12, z: -13 }, { x: 13, z: 13 },
      { x: 0, y: 5.5, z: -28.2 }, { x: 0, y: 5.5, z: 28.2 }, { x: -28.2, y: 5.5, z: 0 }, { x: 28.2, y: 5.5, z: 0 },
      { x: -20, y: 1.6, z: 0 }, { x: 20, y: 1.6, z: 0 }, { x: 12, z: -22 }, { x: -12, z: 22 },
    ],
    teamSpawns: {
      red: [{ x: -20, y: 1.6, z: -2 }, { x: -20, y: 1.6, z: 2 }, { x: -22, z: -14 }, { x: -22, z: 14 }, { x: -18, y: 1.6, z: 0 }],
      blue: [{ x: 20, y: 1.6, z: 2 }, { x: 20, y: 1.6, z: -2 }, { x: 22, z: 14 }, { x: 22, z: -14 }, { x: 18, y: 1.6, z: 0 }],
    },
    coops: [{ x: 0, y: 0, z: 0, r: 2.6 }, { x: 0, y: 5.5, z: -28.2, r: 1.6 }, { x: 0, y: 5.5, z: 28.2, r: 1.6 }, { x: 0, y: 9, z: -22, r: 1.2 }, { x: 0, y: 5.5, z: -15, r: 1.6 }],
    spatula: { x: 0, y: 0, z: 0 },
    bases: { red: { x: -20, y: 1.6, z: 0, r: 2.4 }, blue: { x: 20, y: 1.6, z: 0, r: 2.4 } },
  };


  // =========================================================================
  // 36. NEVADA — aldea alpina nevada (diseño propio)
  // =========================================================================
  const alpine = {
    id: 'alpine', name: 'Nevada', size: 'M', players: 18,
    desc: 'Aldea alpina: chalés de dos pisos, estanque helado en el centro, torres del telesilla y bosque de pinos.',
    halfSize: 30, gravity: -22, ground: 'snow',
    theme: Object.assign({}, SKY_DAY, { sky: 0xb9d4ec, fog: [45, 140], sunColor: 0xfff6ea, hemiSky: 0xe6f2ff, hemiGround: 0x9fb2c2, particles: 'snow' }),
    build(b) {
      b.perimeter(30, 1.4, 'logs', 1);
      b.perimeter(30, 16, 'invisible', 1);
      // Estanque helado con caseta de pesca y murete de nieve
      b.box(0, 0, 0, 12, 0.12, 8, 'ice');
      b.room(0, 0, 0.12, 4, 3, 2.6, 'wood', { cornice: 'woodDark', open: [{ side: 'e', at: 0, w: 1.6, h: 2.2 }, { side: 'w', at: 0, w: 1.6, h: 2.2 }], roof: true, roofMat: 'roofRed' });
      [0, 2].forEach(rot => b.with({ rot }, () => {
        // Chalé de dos pisos (azotea con pretil) y su leñera
        b.house2(-15, -15, 12, 9, 'wood', { h1: 2.6, doors: ['s', 'e'], trim: 'woodDark', roofMat: 'roofRed' });
        b.box(-19.2, 0, -8.6, 3.4, 1.3, 1.2, 'logs');
        // Torre del telesilla (francotirador) con tejadillo
        b.tower(18, -20, 9, 3.4, 'logs', 'w', { roof: 'roofRed' });
        // Montículo de nieve con rampas y muretes de nieve
        b.hill(-1, -18, 1.6, 5, 3.2, 'snow');
        b.box(8, 0, -9, 4, 1.2, 0.9, 'snow'); b.box(-8, 0, -6, 0.9, 1.2, 3.6, 'snow');
        // Trineo de troncos y pinos
        b.box(20, 0, -8, 1.4, 1, 4, 'logs');
        [[-25, -4], [-6, -25], [25, -24], [10, -25], [-25, -24]].forEach(([x, z]) => b.tree(x, z, 1.25, 'pine'));
        b.decoAt('lamp', -9, 0, -9.5); b.decoAt('lamp', 9, 0, -3);
        // v6: cabaña del alquiler de esquís (tejado a dos aguas transitable) con esquís apoyados
        b.room(10, -17, 0, 6, 5, 2.8, 'wood', { cornice: 'woodDark',
          open: [{ side: 's', at: 0, w: 1.8, h: 2.3 }, { side: 'w', at: 0, y: 1, w: 1.4, h: 1 }, { side: 'e', at: 0, y: 1, w: 1.4, h: 1 }],
          roof: true, roofMat: 'woodDark' });
        b.gable(10, -17, 3.1, 6, 5, 1.2, true, 'roofRed');
        [8.2, 8.6, 11.4, 11.8].forEach((x, i) => b.box(x, 0, -14.35, 0.12, 1.7, 0.06, i % 2 ? 'red' : 'blue', { solid: false }));
        // Rocas nevadas, muñeco de nieve y pinos jóvenes
        b.rock(-26, -12, 2.2, { snow: true, color: 0x7d858c });
        b.rock(-4, -27, 1.6, { snow: true, color: 0x7d858c, flat: true });
        b.box(5, 0, -6, 1.1, 2.3, 1.1, 'invisible'); b.decoAt('snowman', 5, 0, -6, { rotY: 0.6 });
        [[-12, -27], [27, -14]].forEach(([x, z]) => { b.box(x, 0, z, 0.45, 1.8, 0.45, 'invisible'); b.decoAt('pine', x, 0, z, { s: 0.7, snow: true }); });
      }));
    },
    coverDensity: 0.8,
    spawns: [
      { x: -15, z: -6 }, { x: 15, z: 6 }, { x: -24, z: 4 }, { x: 24, z: -4 }, { x: 4, z: -12 }, { x: -4, z: 12 },
      { x: -15, y: 5.5, z: -15 }, { x: 15, y: 5.5, z: 15 }, { x: 22, z: -14 }, { x: -22, z: 14 }, { x: 4, z: -26 }, { x: -4, z: 26 },
    ],
    teamSpawns: {
      red: [{ x: -15, z: -6 }, { x: -24, z: 4 }, { x: -22, z: -8 }, { x: -18, z: -23 }, { x: -9, z: -23 }],
      blue: [{ x: 15, z: 6 }, { x: 24, z: -4 }, { x: 22, z: 8 }, { x: 18, z: 23 }, { x: 9, z: 23 }],
    },
    coops: [{ x: 0, y: 0.12, z: 3, r: 2.4 }, { x: -1, y: 1.6, z: -18, r: 2 }, { x: 1, y: 1.6, z: 18, r: 2 }, { x: -15, y: 5.5, z: -15, r: 2 }, { x: 15, y: 5.5, z: 15, r: 2 }],
    spatula: { x: 0, y: 0.12, z: 3 },
    bases: { red: { x: -22, y: 0, z: -2, r: 2.6 }, blue: { x: 22, y: 0, z: 2, r: 2.6 } },
  };

  // =========================================================================
  // 37. TEMPLO — pirámide escalonada en la selva (diseño propio)
  // =========================================================================
  const temple = {
    id: 'temple', name: 'Templo', size: 'M', players: 18,
    desc: 'Pirámide escalonada con santuario en la cima, escalinatas, ruinas con arcos y torres de troncos unidas por puentes.',
    halfSize: 30, gravity: -22, ground: 'grass',
    theme: Object.assign({}, SKY_DAY, { sky: 0x9fd1d8, fog: [40, 135], sunColor: 0xfff1cf, hemiSky: 0xd8f5e6, hemiGround: 0x4d6b2f, particles: 'pollen' }),
    build(b) {
      b.perimeter(30, 2.2, 'stoneOld', 1);
      b.perimeter(30, 16, 'invisible', 1);
      // Pirámide: dos gradas y santuario con tejado sobre cuatro columnas
      b.box(0, 0, 0, 18, 2.4, 18, 'stoneOld');
      b.box(0, 0, 0, 9, 4.8, 9, 'stoneOld');
      [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => b.pillar(x, 4.8, z, 0.6, 2.6, 'stone'));
      b.slab(0, 0, 7.7, 5.6, 5.6, 0.3, 'stone');
      [0, 2].forEach(rot => b.with({ rot }, () => {
        // Gran escalinata hasta la cima (norte/sur) y escalones a la primera grada (este/oeste)
        b.stairs(0, -9.3, 0, 3, 9.6, 4.8, '+z', 'stone');
        b.stairs(-11.4, 0, 0, 3, 4.8, 2.4, '+x', 'stone');
        // Ruinas: muro con dos arcos y columnas
        b.wallSeg('x', -21, -14, -2, 0, 3.4, 1, [{ at: -3, w: 2, h: 2.6 }, { at: 3, w: 2, h: 2.6 }], 'stoneOld');
        b.pillar(-18, 0, -14, 1, 3, 'stone'); b.pillar(-10, 0, -14, 1, 1.4, 'stone');
        b.box(-14, 0, -11, 4, 0.9, 1, 'stone');
        // Dos torres de troncos unidas por un puente de tablones
        b.box(22, 0, -22, 3.4, 6, 3.4, 'logs');
        b.box(22, 0, -10, 3.4, 6, 3.4, 'logs');
        b.ring(22, -22, 6, 3.8, 3.8, 1, 0.3, 'woodDark', [{ side: 's', at: 0, w: 1.8 }, { side: 'w', at: 0, w: 1.4 }]);
        b.ring(22, -10, 6, 3.8, 3.8, 1, 0.3, 'woodDark', [{ side: 'n', at: 0, w: 1.8 }]);
        b.ladder(20.3, -22, 0, 6, '+x');
        b.bridge(22, -20.3, 22, -11.7, 6, 1.8, 'plank', { railMat: 'woodDark' });
        // Selva
        [[-25, -25], [-6, -25], [12, -25], [-25, -8], [8, -18], [-20, -2]].forEach(([x, z]) => b.tree(x, z, 1.15, 'tree'));
        [[-12, -22], [4, -22], [16, -16]].forEach(([x, z]) => b.decoAt('bush', x, 0, z));
        b.decoAt('torch', -1.6, 4.8, -4.6); b.decoAt('torch', 1.6, 4.8, -4.6);
        // v6: puerta de piedra ante la gran escalinata, con el ídolo del huevo dorado encima
        b.pillar(-2.6, 0, -17.5, 1, 4.2, 'stone'); b.pillar(2.6, 0, -17.5, 1, 4.2, 'stone');
        b.aabb(-3.3, 4.2, -18.1, 3.3, 5, -16.9, 'stoneOld');
        b.box(0, 5, -17.5, 1.2, 0.3, 1.2, 'gold', { solid: false });
        b.decoAt('bigegg', 0, 5.3, -17.5, { s: 0.75, color: 0xe8b830 });
        b.decoAt('torch', -2.6, 3.4, -16.95); b.decoAt('torch', 2.6, 3.4, -16.95);
        // Columnata en ruinas (columnas enteras, rotas y una caída): cobertura en el flanco
        [[-24, 3.4], [-21, 1.6], [-18, 3.4], [-15, 2.2]].forEach(([x, h]) => {
          b.pillar(x, 0, -6, 0.9, h, 'stone');
          if (h > 3) b.box(x, h, -6, 1.2, 0.3, 1.2, 'stoneOld', { solid: false });
        });
        b.aabb(-24.6, 3.4, -6.5, -17.4, 3.9, -5.5, 'stoneOld');
        b.box(-19.5, 0, -8.4, 3.4, 0.8, 0.8, 'stone');
        [[-27, -16], [-10, -27.5], [27.5, -20], [-27.5, 12]].forEach(([x, z]) => b.decoAt('bush', x, 0, z));
      }));
    },
    coverDensity: 0.7,
    spawns: [
      { x: -14, z: -18 }, { x: 14, z: 18 }, { x: -26, z: 4 }, { x: 26, z: -4 }, { x: 16, z: -4 }, { x: -16, z: 4 },
      { x: 0, y: 4.8, z: 0 }, { x: 22, y: 6, z: -16 }, { x: -22, y: 6, z: 16 }, { x: 6, z: -24 }, { x: -6, z: 24 }, { x: -8, y: 2.4, z: 6 },
    ],
    teamSpawns: {
      red: [{ x: -26, z: 4 }, { x: -16, z: 4 }, { x: -24, z: -16 }, { x: -14, z: -18 }, { x: -26, z: 26 }],
      blue: [{ x: 26, z: -4 }, { x: 16, z: -4 }, { x: 24, z: 16 }, { x: 14, z: 18 }, { x: 26, z: -26 }],
    },
    coops: [{ x: 0, y: 4.8, z: 0, r: 2 }, { x: 6.6, y: 2.4, z: -6.6, r: 1.6 }, { x: -6.6, y: 2.4, z: 6.6, r: 1.6 }, { x: 22, y: 6, z: -16, r: 1.2 }, { x: -22, y: 6, z: 16, r: 1.2 }],
    spatula: { x: 0, y: 4.8, z: 0 },
    bases: { red: { x: -24, y: 0, z: 0, r: 2.6 }, blue: { x: 24, y: 0, z: 0, r: 2.6 } },
  };

  // =========================================================================
  // 38. FÁBRICA — nave industrial con pasarelas (diseño propio)
  // =========================================================================
  const factory = {
    id: 'factory', name: 'Fábrica', size: 'M', players: 18,
    desc: 'Gran nave con pasarelas interiores a 4 m, máquinas, chimeneas, contenedores y depósito de agua en el patio.',
    halfSize: 30, gravity: -22, ground: 'concrete',
    theme: Object.assign({}, SKY_DAY, { sky: 0xb4c4cf, fog: [40, 130], sunColor: 0xfff0d8, hemiSky: 0xdfe8ef, hemiGround: 0x6b6b6b, particles: 'dust' }),
    build(b) {
      b.perimeter(30, 3, 'concrete', 1);
      b.perimeter(30, 16, 'invisible', 1);
      // Nave: portones a norte y sur, puertas a este y oeste, pasarela interior a 4 m
      b.room(0, 0, 0, 22, 14, 8, 'brick', {
        cornice: 'stoneDark',
        open: [
          { side: 'n', at: 0, w: 4, h: 3.4 }, { side: 's', at: 0, w: 4, h: 3.4 },
          { side: 'e', at: 0, w: 2, h: 2.6 }, { side: 'w', at: 0, w: 2, h: 2.6 },
          { side: 'n', at: -7, y: 5.2, w: 2.4, h: 1.6 }, { side: 'n', at: 7, y: 5.2, w: 2.4, h: 1.6 },
          { side: 's', at: -7, y: 5.2, w: 2.4, h: 1.6 }, { side: 's', at: 7, y: 5.2, w: 2.4, h: 1.6 },
        ],
        floors: [{ y: 4, mat: 'metal', holes: [{ x: 0, z: 0, w: 13, d: 5 }, { x: -4.85, z: -5.4, w: 8.3, d: 2.3 }, { x: 4.85, z: 5.4, w: 8.3, d: 2.3 }] }],
        roof: true, roofMat: 'roofGrey',
      });
      [0, 2].forEach(rot => b.with({ rot }, () => {
        b.stairs(-4.85, -5.4, 0, 2, 8, 4, '+x', 'metalDark');
        // Máquinas en la planta baja y cinta transportadora
        b.box(-6, 0, 1.2, 2.4, 1.6, 2, 'metalDark'); b.box(3, 0, -1.6, 5, 0.9, 1.2, 'metal');
        b.crate(1.5, 0.9, -1.6, 0.9); b.crate(4, 0.9, -1.6, 0.9);
        // Chimenea, depósito de agua (francotirador) y contenedores en el patio
        b.box(-13.5, 0, -10, 2.2, 13, 2.2, 'brick');
        b.tower(20, -20, 9, 3.4, 'metalDark', 'w', { metal: true, roof: 'roofGrey', postMat: 'metalDark' });
        b.container(-20, 0, -22, true, 'cOrange'); b.container(-20, 2.6, -22, true, 'cBlue');
        b.ladder(-20, -20.7, 0, 5.2, '-z', { metal: true });
        b.container(6, 0, -22, true, 'cGreen');
        b.decoAt('forklift', 13, 0, -12, { rotY: 0.6 }); b.box(13, 0, -12, 1.6, 2.2, 2.6, 'invisible');
        [[-24, -10], [-23, -11.2]].forEach(([x, z]) => { b.box(x, 0, z, 0.9, 1.3, 0.9, 'invisible'); b.decoAt('barrel', x, 0, z); });
        b.decoAt('lamp', -9, 0, -10); b.decoAt('lamp', 9, 0, -10);
        // v6: oficinas de dos plantas (azotea con máquina del aire) entre la nave y la vía
        b.house2(-7, -21, 11, 8, 'concrete', { h1: 2.6, doors: ['s', 'e'], trim: 'stoneDark', roofMat: 'concrete', metal: true, awning: 'cOrange' });
        // Vía de tren con un vagón de mercancías (cobertura alta en el fondo del patio)
        b.track(-28.4, 28.4, -27);
        b.box(14, 0, -27, 5.6, 0.6, 2, 'metalDark');
        b.container(14, 0.6, -27, true, 'cGreen');
        // Depósito de agua tratada con tubería hasta la nave
        b.box(20, 0, -9, 3, 6.4, 3, 'invisible');
        b.decoAt('tank', 20, 0, -9, { r: 1.6, h: 6, color: 0xc9d1d6 });
        b.box(14.6, 3.6, -9, 7.4, 0.4, 0.4, 'steel', { solid: false });
        b.pillar(15, 0, -9, 0.25, 3.6, 'metalDark');
        b.decoAt('sign', 9.5, 0, -16.5, { color: 0xe67e22 });
      }));
    },
    coverDensity: 0.7,
    spawns: [
      { x: -8, z: -12 }, { x: 8, z: 12 }, { x: -24, z: 4 }, { x: 24, z: -4 }, { x: 14, z: -24 }, { x: -14, z: 24 },
      { x: -8, y: 4, z: -4.4 }, { x: 8, y: 4, z: 4.4 }, { x: 0, z: -3.5 }, { x: 0, z: 3.5 }, { x: 24, z: 14 }, { x: -24, z: -14 },
    ],
    teamSpawns: {
      red: [{ x: -24, z: 4 }, { x: -24, z: -14 }, { x: -24, z: 14 }, { x: -16, z: 14 }, { x: -16, z: -16 }],
      blue: [{ x: 24, z: -4 }, { x: 24, z: 14 }, { x: 24, z: -14 }, { x: 16, z: -14 }, { x: 16, z: 16 }],
    },
    coops: [{ x: 0, y: 0, z: 0, r: 2.4 }, { x: 0, y: 4, z: -4.5, r: 1.6 }, { x: 0, y: 4, z: 4.5, r: 1.6 }, { x: 20, y: 9, z: -20, r: 1.2 }, { x: -20, y: 9, z: 20, r: 1.2 }],
    spatula: { x: 0, y: 0, z: 0 },
    bases: { red: { x: -24, y: 0, z: 0, r: 2.6 }, blue: { x: 24, y: 0, z: 0, r: 2.6 } },
  };

  // =========================================================================
  // 39. CENTRO — azoteas de ciudad unidas por puentes (diseño propio)
  // =========================================================================
  const downtown = {
    id: 'downtown', name: 'Centro', size: 'M', players: 18,
    desc: 'Cuatro edificios de dos plantas con azoteas unidas por puentes, calles con coches y una torre del reloj en el cruce.',
    halfSize: 30, gravity: -22, ground: 'asphalt',
    theme: Object.assign({}, SKY_DAY, { sky: 0x9cc8ea }),
    build(b) {
      b.perimeter(30, 3, 'concrete', 1);
      b.perimeter(30, 16, 'invisible', 1);
      // Torre del reloj en el cruce y bancos de plaza
      b.tower(0, 0, 10, 3, 'stone', 's', { roof: 'roofRed' });
      [0, 2].forEach(rot => b.with({ rot }, () => {
        // Aceras
        b.decoAt('plane', -13, 0.02, -13, { w: 15, d: 13, color: 0xb8b8b4 });
        b.decoAt('plane', 13, 0.02, -13, { w: 15, d: 13, color: 0xb8b8b4 });
        // Edificios (azotea a 5,5 m) con huecos en el pretil para los puentes
        b.house2(-13, -13, 12, 10, 'brick', { h1: 2.6, doors: ['s', 'e'], trim: 'stoneDark', roofMat: 'concrete', gaps: [{ side: 'e', at: 0, w: 2.2 }, { side: 's', at: 0, w: 2.2 }] });
        b.house2(13, -13, 12, 10, rot ? 'white' : 'concrete', { h1: 2.6, doors: ['s', 'w'], trim: 'stoneDark', roofMat: 'concrete', gaps: [{ side: 'w', at: 0, w: 2.2 }, { side: 's', at: 0, w: 2.2 }] });
        b.bridge(-7, -13, 7, -13, 5.5, 2.2, 'metal', { supports: true, supportMat: 'metalDark' });
        b.bridge(13, -8, 13, 8, 5.5, 2.2, 'metal', { supports: true, supportMat: 'metalDark' });
        // Calle: coches aparcados, barreras y marquesina
        b.decoAt('car', -4, 0, -22, { rotY: 0, color: 0xc0392b }); b.box(-4, 0, -22, 2.4, 1.6, 4.4, 'invisible');
        b.decoAt('car', 22, 0, 3, { rotY: Math.PI / 2, color: 0x2f6fb5 }); b.box(22, 0, 3, 4.4, 1.6, 2.4, 'invisible');
        b.box(4, 0, -4.5, 3, 1.05, 0.8, 'jersey');
        b.box(-25, 0, -4, 0.3, 2.6, 0.3, 'metalDark'); b.box(-25, 0, -1, 0.3, 2.6, 0.3, 'metalDark');
        b.slab(-25.3, -2.5, 2.8, 1.6, 4, 0.15, 'glass');
        [[-7.5, -24], [7.5, -24], [-24, 7.5]].forEach(([x, z]) => b.decoAt('lamp', x, 0, z));
        // v6: marcas viales (línea discontinua y pasos de cebra junto al cruce)
        b.decoAt('stripes', -18.5, 0, 0, { w: 17, n: 6, d: 0.22, color: 0xf1c40f });
        b.decoAt('stripes', 0, 0, -18.5, { w: 17, n: 6, d: 0.22, color: 0xf1c40f, rotY: Math.PI / 2 });
        b.decoAt('stripes', -9.5, 0, 0, { w: 12, n: 8, d: 3, rotY: Math.PI / 2 });
        // Jardineras con árbol en las aceras
        [[-20.5, -5.5], [-6.5, -20.8]].forEach(([x, z]) => { b.box(x, 0, z, 1.4, 0.6, 1.4, 'invisible'); b.box(x, 0, z, 0.3, 2.2, 0.3, 'invisible'); b.decoAt('planter', x, 0, z, { color: 0xa9aaa4 }); });
        // Quiosco de prensa
        b.box(20, 0, -22, 3, 2.4, 2, 'white');
        b.box(20, 2.4, -21.2, 3.6, 0.15, 3, 'roofRed', { solid: false });
        b.decoAt('sign', 22, 0, -20.4, { color: 0xc0392b });
      }));
    },
    coverDensity: 0.6,
    spawns: [
      { x: -4, z: -26 }, { x: 4, z: 26 }, { x: -26, z: 10 }, { x: 26, z: -10 }, { x: 4, z: -10 }, { x: -4, z: 10 },
      { x: -13, y: 5.5, z: -13 }, { x: 13, y: 5.5, z: 13 }, { x: 13, z: -6.5 }, { x: -13, z: 6.5 }, { x: 26, z: 26 }, { x: -26, z: -26 },
    ],
    teamSpawns: {
      red: [{ x: -26, z: 10 }, { x: -26, z: -26 }, { x: -26, z: -10 }, { x: -20, z: -26 }, { x: -26, z: 24 }],
      blue: [{ x: 26, z: -10 }, { x: 26, z: 26 }, { x: 26, z: 10 }, { x: 20, z: 26 }, { x: 26, z: -24 }],
    },
    coops: [{ x: 0, y: 0, z: 4.5, r: 2 }, { x: 0, y: 5.5, z: -13, r: 1.4 }, { x: 0, y: 5.5, z: 13, r: 1.4 }, { x: 0, y: 10, z: 0, r: 1.1 }, { x: 13, y: 5.5, z: 0, r: 1.4 }],
    spatula: { x: 0, y: 0, z: 4.5 },
    bases: { red: { x: -26, y: 0, z: 0, r: 2.6 }, blue: { x: 26, y: 0, z: 0, r: 2.6 } },
  };

  // =========================================================================
  // 40. ASERRADERO — serrería junto a un arroyo (diseño propio)
  // =========================================================================
  const sawmill = {
    id: 'sawmill', name: 'Aserradero', size: 'M', players: 18,
    desc: 'Serrería con altillo y tejado a dos aguas, arroyo con vados, pilas de troncos, torres de vigía y el bosque alrededor.',
    halfSize: 30, gravity: -22, ground: 'grass',
    theme: Object.assign({}, SKY_DAY, { sky: 0x98c7e8, sunColor: 0xfff0d2, particles: 'pollen' }),
    build(b) {
      b.perimeter(30, 1.6, 'logs', 1);
      b.perimeter(30, 16, 'invisible', 1);
      // Arroyo (agua poco profunda) que cruza el mapa con orillas de piedra y vados
      b.decoAt('plane', 0, 0.04, 0, { w: 58, d: 4, color: 0x4fa3d9 });
      b.wallSeg('x', -2.4, -29, 29, 0, 0.8, 0.8, [{ at: -14, w: 3 }, { at: 0, w: 3 }, { at: 14, w: 3 }], 'stoneOld');
      b.wallSeg('x', 2.4, -29, 29, 0, 0.8, 0.8, [{ at: -14, w: 3 }, { at: 0, w: 3 }, { at: 14, w: 3 }], 'stoneOld');
      [0, 2].forEach(rot => b.with({ rot }, () => {
        // Serrería: nave con altillo a 3,5 m y tejado a dos aguas transitable
        b.room(-12, -13, 0, 14, 9, 7, 'wood', {
          cornice: 'woodDark',
          open: [{ side: 's', at: -3, w: 3.4, h: 3 }, { side: 'e', at: 0, w: 2, h: 2.6 }, { side: 'n', at: 3, y: 4.4, w: 2, h: 1.4 }, { side: 'w', at: 0, y: 4.4, w: 1.6, h: 1.4 }],
          floors: [{ y: 3.5, mat: 'plank', holes: [{ x: -9.6, z: -14.4, w: 6.3, d: 2.3 }] }],
          roof: true, roofMat: 'woodDark',
        });
        b.stairs(-9.6, -14.4, 0, 2, 6, 3.5, '-x', 'woodDark');
        b.gable(-12, -13, 7.3, 14, 9, 1.8, true, 'roofRed');
        b.ladder(-5, -9.1, 0, 7.5, '-x');
        // Pilas de troncos escalonadas y tablones
        b.box(6, 0, -12, 6, 1, 2.4, 'logs'); b.box(6, 1, -12, 4, 1, 2.4, 'logs');
        b.box(-22, 0, -24, 2.4, 0.8, 5, 'plank'); b.box(-22, 0.8, -24, 2.4, 0.6, 3, 'plank');
        // Torre de vigía con tejadillo
        b.tower(22, -21, 8, 3.2, 'logs', 'w', { roof: 'roofRed' });
        // Bosque
        [[-26, -6], [-6, -25], [12, -25], [26, -8], [16, -16], [-26, -24]].forEach(([x, z]) => b.tree(x, z, 1.2, (x + z) % 2 ? 'pine' : 'tree'));
        b.decoAt('cart', 0, 0, -18, { rotY: 0.4 }); b.box(0, 0, -18, 2.6, 1.6, 1.6, 'invisible');
        // v6: cobertizo de aserrar con la mesa de la sierra y un tronco a medio cortar
        b.shed(14, -12, 6, 4, 3, 'roofRed');
        b.box(14, 0, -12, 3.2, 0.9, 1.1, 'steel');
        b.box(13.6, 0.9, -12, 3, 0.5, 0.5, 'logs');
        b.box(15.6, 0.9, -12, 0.06, 0.55, 0.55, 'metalDark', { solid: false });   // disco de la sierra
        // Pasarela de tablones sobre el arroyo (sube por rampas: cruza sin saltar los muretes)
        b.footbridge(-7, -2.8, 2.8, 1.1, 2, 'plank');
        b.rock(-27, -15, 1.8, { color: 0x8a8d92 });
      }));
    },
    coverDensity: 0.7,
    spawns: [
      { x: -12, z: -6 }, { x: 12, z: 6 }, { x: -24, z: -14 }, { x: 24, z: 14 }, { x: 8, z: -20 }, { x: -8, z: 20 },
      { x: -12, y: 3.5, z: -11 }, { x: 12, y: 3.5, z: 11 }, { x: 22, z: -6 }, { x: -22, z: 6 }, { x: 16, z: -26 }, { x: -16, z: 26 },
    ],
    teamSpawns: {
      red: [{ x: -12, z: -6 }, { x: -24, z: -14 }, { x: -2, z: -24 }, { x: -18, z: -6 }, { x: 8, z: -20 }],
      blue: [{ x: 12, z: 6 }, { x: 24, z: 14 }, { x: 2, z: 24 }, { x: 18, z: 6 }, { x: -8, z: 20 }],
    },
    coops: [{ x: 0, y: 0, z: 0, r: 2.4 }, { x: -12, y: 3.5, z: -11, r: 1.8 }, { x: 12, y: 3.5, z: 11, r: 1.8 }, { x: 22, y: 8, z: -21, r: 1.2 }, { x: -22, y: 8, z: 21, r: 1.2 }],
    spatula: { x: 0, y: 0, z: 0 },
    bases: { red: { x: -14, y: 0, z: -22, r: 2.4 }, blue: { x: 14, y: 0, z: 22, r: 2.4 } },
  };

  // =========================================================================
  // 17. INSTITUTO ABASTOS — el IES Abastos (Valencia) entero según sus planos: planta
  // baja, primera y segunda, unidas por cuatro escaleras
  // =========================================================================
  const abastos = {
    id: 'abastos', name: 'Instituto Abastos', size: 'L', players: 24,
    desc: 'El IES Abastos según sus planos y a escala real: planta baja con las aulas A001–A010, gimnasio, cafetería-comedor, salón de actos, cocina, departamentos y el vestíbulo del acceso con su escalera; primera planta con los patios Cavanilles y Sánchez Ayuso, biblioteca y terrazas; y segunda planta con galerías abiertas a los patios, el bloque central de aulas y departamentos y el Aula 207 de Ciclo DAM. Patios bajo el lucernario de cerchas del antiguo mercado.',
    halfSize: 58, gravity: -22, ground: 'concrete', cover: false,
    theme: Object.assign({}, SKY_DAY, { sky: 0x8fc4ee, sunColor: 0xfff2d6 }),
    build(b) {
      // Medidas en metros sacadas de los planos (retícula de pilares de 5 m). Norte = fachada «E»
      // del plano, sur = «O»; oeste a la izquierda del plano y el ACCÉS al este.
      //   P0 (y 0)    aulas A001…A010 (muy hondas), gimnasio, cafetería-comedor, salón de actos,
      //               cocina, aseos, departamentos y el vestíbulo del acceso con la escalera principal
      //   P1 (y 4,5)  aulas A101…A112, columna oeste A108-O…A111-E, patios Cavanilles (N) y
      //               Sánchez Ayuso (S), franja central (magatzems, recurs, biblioteca, A112-E) y terrazas
      //   P2 (y 8,5)  aulas 201…212, galerías sobre los patios y el bloque central (301…308 y departamentos)
      const P0 = 0, P1 = 4.5, P2 = 8.5, T = 0.3, WALL = 'white';
      const HF = { [P0]: P1 - T, [P1]: P2 - P1 - T, [P2]: 3.5 };       // alto de las paredes de cada planta
      const ROOF = P2 + HF[P2] + T;
      const XW = -47.5, XWC = -37, XC1 = -32, XC2 = 32, XE = 37, XA = 44.5;   // columna oeste, patios, pasillo este, anexo
      const Z0 = -37, Z1 = 37;
      // P0: filas de aulas muy hondas, pasillos, bloques interiores y la banda de la cafetería
      const R0 = 25.5, C0 = 22.5, CAF = 4.4;
      // P1 y P2: filas de aulas de 6,5 m, pasillos de 4 m y patios; franja central de 11 m
      const R1 = 30.5, G1 = 26.5, ST1 = 5.5;
      // P2: galerías de 6 m sobre el borde de los patios, huecos y bloque central
      const G2 = 24.5, V2 = 11.5, CB = 6.5;
      const ANX = 30.5, VEST = 7;                                        // anexo este y vestíbulo
      // Escaleras de los pasillos oeste y este, junto al patio: tramo norte (sube hacia el sur)
      // y tramo sur (sube hacia el norte), las dos plantas en el mismo hueco
      // Escaleras de los pasillos oeste y este según el plano de la 1ª planta: tramos rectos de 2,6 m de
      // ancho en el lado del patio. De la planta baja a la 1ª, dos por lado (bajo los huecos marcados con
      // una X en el plano); de la 1ª a la 2ª, cuatro por lado: en las esquinas y junto a la franja
      // central (las del plano de evacuación de la 2ª). [z0, z1, sube hacia, planta]
      const STX = { w: [-34.8, -32.2], e: [32.2, 34.8] };
      const SF = [[-17.5, -10.5, '-z', 0], [10.5, 17.5, '+z', 0],
        [-26.2, -19.7, '-z', 1], [-9.2, -2.7, '+z', 1], [2.7, 9.2, '-z', 1], [19.7, 26.2, '+z', 1]];
      const FL = SF.map(f => [f[0], f[1]]);
      // Escalera principal del vestíbulo: de la entrada (este) sube hacia el oeste hasta el pasillo este de P1
      const MS = { x0: 35, x1: 43, z0: -VEST, z1: -VEST + 2.6 };
      b.frameMat = 'metalDark';
      const sign = (text, x, y, z, rotY, w, bg) => b.decoAt('textsign', x, y, z, { text, rotY, w: w || Math.min(1.6, 0.3 + text.length * 0.11), h: 0.3, bg: bg || '#1f3d7a' });
      const floor = (x0, z0, x1, z1, color, y) => { if (x1 - x0 > 0.05 && z1 - z0 > 0.05) b.decoAt('plane', (x0 + x1) / 2, y + 0.03, (z0 + z1) / 2, { w: x1 - x0, d: z1 - z0, color }); };
      // Suelo de un pasillo vertical sin tapar los huecos de las escaleras que llegan a esa planta
      const corrFloor = (x0, x1, za, zb, Y, side, color) => {
        const lvl = Y === P1 ? 0 : Y === P2 ? 1 : -1;
        const segs = SF.filter(f => f[3] === lvl).map(f => [f[0], f[1], STX[side]]).sort((p, q) => p[0] - q[0]);
        let z = za;
        for (const [a, c, sx] of segs) {
          if (c <= za || a >= zb) continue;
          floor(x0, z, x1, a, color, Y);
          floor(x0, a, sx[0], c, color, Y); floor(sx[1], a, x1, c, color, Y);
          z = c;
        }
        floor(x0, z, x1, zb, color, Y);
      };
      const glass = (axis, fixed, a0, a1, y, h) => axis === 'x' ? b.aabb(a0, y, fixed - 0.04, a1, y + h, fixed + 0.04, 'glass') : b.aabb(fixed - 0.04, y, a0, fixed + 0.04, y + h, a1, 'glass');
      // Pared con ventanas cada «step» (y puertas en «doors»)
      const glazed = (axis, fixed, a0, a1, Y, step, ww, doors, dw) => {
        doors = doors || [];
        const mid = (a0 + a1) / 2, ops = doors.map(a => ({ at: a - mid, w: dw || 2.0, h: 2.5 })), wins = [];
        for (let a = a0 + step / 2; a < a1 - 0.5; a += step) {
          if (doors.some(d => Math.abs(d - a) < ww / 2 + (dw || 2) / 2 + 0.3)) continue;
          if (a - ww / 2 < a0 + 0.3 || a + ww / 2 > a1 - 0.3) continue;
          ops.push({ at: a - mid, y: 1.0, w: ww, h: 1.6 }); wins.push(a);
        }
        b.wallSeg(axis, fixed, a0, a1, Y, HF[Y], T, ops, WALL);
        wins.forEach(a => glass(axis, fixed, a - ww / 2, a + ww / 2, Y + 1.0, 1.6));
      };
      const room = (x0, z0, x1, z1, Y, doors, wins, opt) => {
        opt = opt || {};
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
        const open = doors.map(o => ({ side: o.side, at: o.at, w: o.w || 1.6, h: 2.4 }))
          .concat(wins.map(o => ({ side: o.side, at: o.at, y: o.y || 1.0, w: o.w || 2, h: o.h || 1.5 })));
        b.room(cx, cz, Y, w, d, HF[Y], opt.mat || WALL, { t: T, open });
        wins.forEach(o => {
          const ww = o.w || 2, wy = Y + (o.y || 1), wh = o.h || 1.5;
          if (o.side === 'n') glass('x', z0 + T / 2, cx + o.at - ww / 2, cx + o.at + ww / 2, wy, wh);
          if (o.side === 's') glass('x', z1 - T / 2, cx + o.at - ww / 2, cx + o.at + ww / 2, wy, wh);
          if (o.side === 'w') glass('z', x0 + T / 2, cz + o.at - ww / 2, cz + o.at + ww / 2, wy, wh);
          if (o.side === 'e') glass('z', x1 - T / 2, cz + o.at - ww / 2, cz + o.at + ww / 2, wy, wh);
          if (o.big && (o.side === 'n' || o.side === 's')) {   // ventanal con carpintería negra (como los del patio)
            const fz = o.side === 'n' ? z0 - 0.02 : z1 + 0.02, x = cx + o.at;
            b.aabb(x - 0.03, wy, fz - 0.05, x + 0.03, wy + wh, fz + 0.05, 'metalDark', { solid: false });
            b.aabb(x - ww / 2, wy + wh * 0.62, fz - 0.05, x + ww / 2, wy + wh * 0.62 + 0.05, fz + 0.05, 'metalDark', { solid: false });
            b.aabb(x - ww / 2 - 0.15, wy + wh, fz - 0.12, x + ww / 2 + 0.15, wy + wh + 0.16, fz + 0.12, 'cream', { solid: false });
          }
        });
        floor(x0 + T, z0 + T, x1 - T, z1 - T, opt.floor || 0xd9cfba, Y);
        if (opt.name && doors[0]) {
          // placa pequeña junto a la puerta, por fuera, a 2,2 m
          const o = doors[0], s = o.side, off = (o.w || 1.6) / 2 + 0.75;
          const px = s === 'n' || s === 's' ? cx + o.at + off : (s === 'w' ? x0 - 0.17 : x1 + 0.17);
          const pz = s === 'w' || s === 'e' ? cz + o.at + off : (s === 'n' ? z0 - 0.17 : z1 + 0.17);
          const rot = { n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 }[s];
          sign(opt.name, px, Y + 2.2, pz, rot, null, opt.bg);
        }
      };
      // Aula con pupitres (o puestos de ordenador) mirando a la pizarra del lado «boardSide»
      const classroom = (x0, z0, x1, z1, Y, doorSide, doorAt, boardSide, name, opt) => {
        opt = opt || {};
        const cx = (x0 + x1) / 2, w = x1 - x0, face = boardSide === 'n' ? -1 : 1;
        const wins = opt.noWin ? [] : (w > 6 ? [{ side: boardSide, at: -(w / 2 - 1.2), w: 1.6 }, { side: boardSide, at: w / 2 - 1.2, w: 1.6 }] : [{ side: boardSide, at: w / 2 - 1.0, w: 1.2 }]);
        if (opt.backWin && w > 6) wins.push({ side: boardSide === 'n' ? 's' : 'n', at: 0, w: 2.4 });
        if (opt.frontWin && w > 7 && doorSide !== boardSide) wins.push({ side: doorSide, at: doorAt > 0 ? -1.9 : 1.9, w: 3.2, y: 0.9, h: 2.1, big: true });
        room(x0, z0, x1, z1, Y, [{ side: doorSide, at: doorAt }], wins, { floor: opt.floor || 0xd6cfbf, name, bg: opt.bg });
        const bz = boardSide === 'n' ? z0 + T + 0.08 : z1 - T - 0.08;
        b.decoAt('board', cx, Y + 1.55, bz, { rotY: face < 0 ? 0 : Math.PI, w: Math.min(3.2, w - (w > 6 ? 4.6 : 3)), text: opt.board || name });
        const deskX = doorSide === boardSide ? cx : cx + (doorAt > 0 ? -2 : 2);
        b.box(Math.max(x0 + 1, Math.min(x1 - 1, deskX)), Y, bz - face * 1.3, 1.4, 0.76, 0.7, 'wood');
        const depth = z1 - z0, dX = cx + doorAt, dZ = doorSide === 'n' ? z0 : z1;
        if (opt.pcs) {
          [bz - face * 2.6, bz - face * 4.6].forEach(z => {
            const xe = doorSide !== boardSide && Math.abs(z - dZ) < 2.8 ? Math.min(x1 - 2.4, dX - 1.4) : x1 - 2.4;
            b.aabb(x0 + 1.0, Y, z - 0.4, xe, Y + 0.76, z + 0.4, 'white');
            for (let x = x0 + 1.8; x < xe - 0.2; x += 1.6) b.decoAt('pc', x, Y + 0.76, z + face * 0.05, { seat: true, rotY: face < 0 ? 0 : Math.PI });
          });
          return;
        }
        const rows = [bz - face * 2.5];
        if (depth > 6.2 && !opt.oneRow) rows.push(bz - face * 4.3);
        if (depth > 8.6) rows.push(bz - face * 6.1);
        if (depth > 10.4) rows.push(bz - face * 7.9);
        for (const z of rows) for (let x = x0 + 1.4; x < x1 - 2.3; x += 2.4) {   // pasillos de 1,4 m entre pupitres
          if (doorSide !== boardSide && Math.abs(x - dX) < 1.5 && Math.abs(z - dZ) < 2.8) continue;   // paso libre en la puerta
          b.decoAt('desk', x, Y, z, { color: opt.desk || 0x2f6fb5, rotY: face < 0 ? -Math.PI / 2 : Math.PI / 2 });
          b.box(x, Y, z - face * 0.2, 1.0, 0.76, 0.62, 'invisible');
        }
      };
      // Barandilla: las de dentro se saltan (para bajar de un salto); las que dan a la calle llevan
      // barrera invisible para que nadie salga del centro
      const rail = (x0, z0, x1, z1, Y, outer) => { b.aabb(x0, Y, z0, x1, Y + 1.0, z1, 'rail'); if (outer) b.aabb(x0, Y + 1.0, z0, x1, Y + 2.6, z1, 'invisible', { see: true }); };
      const aseos = (x0, z0, x1, z1, Y, door, name) => {
        room(x0, z0, x1, z1, Y, [door], [], { floor: 0xb9c4c9, name: name || 'ASEOS' });
        const along = door.side === 'n' || door.side === 's';   // las mamparas, siempre lejos de la puerta
        for (let k = 1; k < 3; k++) {
          if (along) { const x = x0 + (x1 - x0) * k / 3; b.aabb(x - 0.04, Y, (door.side === 'n' ? z0 + (z1 - z0) * 0.45 : z0 + 0.3), x + 0.04, Y + 2, (door.side === 'n' ? z1 - 0.3 : z1 - (z1 - z0) * 0.45), 'blueLight'); }
          else { const z = z0 + (z1 - z0) * k / 3; b.aabb((door.side === 'w' ? x0 + (x1 - x0) * 0.45 : x0 + 0.3), Y, z - 0.04, (door.side === 'w' ? x1 - 0.3 : x1 - (x1 - x0) * 0.45), Y + 2, z + 0.04, 'blueLight'); }
        }
      };
      // Galería abierta a un patio: antepecho crema, albardilla, pasamanos metálico (se puede saltar)
      const gallery = (axis, fixed, a0, a1, Y, mesh) => {
        const A = (u0, y0, u1, y1, f0, f1, mat, o) => axis === 'x' ? b.aabb(u0, y0, f0, u1, y1, f1, mat, o) : b.aabb(f0, y0, u0, f1, y1, u1, mat, o);
        if (mesh) {   // barandilla de paneles de rejilla metálica (como la del pasillo de la foto)
          A(a0, Y, a1, Y + 1.05, fixed - 0.04, fixed + 0.04, 'rail');
          A(a0, Y + 1.0, a1, Y + 1.08, fixed - 0.05, fixed + 0.05, 'metal', { solid: false });
          for (let u = a0; u <= a1 + 0.01; u += 1.6) A(u - 0.035, Y, u + 0.035, Y + 1.08, fixed - 0.05, fixed + 0.05, 'metal', { solid: false });
          return;
        }
        A(a0, Y, a1, Y + 0.85, fixed - 0.12, fixed + 0.12, 'cream');
        A(a0, Y + 0.85, a1, Y + 0.93, fixed - 0.16, fixed + 0.16, 'concrete');
        A(a0, Y + 1.08, a1, Y + 1.14, fixed - 0.03, fixed + 0.03, 'metalDark', { solid: false });
        for (let u = a0 + 0.75; u < a1 - 0.3; u += 1.5) A(u - 0.02, Y + 0.93, u + 0.02, Y + 1.1, fixed - 0.02, fixed + 0.02, 'metalDark', { solid: false });
      };
      const rowRooms = (list, x0, x1) => { const w = (x1 - x0) / list.length; return list.map((n, i) => [n, x0 + i * w, x0 + (i + 1) * w]); };

      // ========================= ESTRUCTURA =========================
      b.perimeter(57, 2.2, 'metalDark', 0.4);
      floor(-56.6, -56.6, 56.6, 56.6, 0x6f6c66, 0);
      // Nadie sale del instituto: muro invisible alto alrededor del edificio (y del anexo este)
      b.aabb(XW - 0.6, 0, Z0 - 0.6, XA + 0.6, 40, Z0 - 0.15, 'invisible'); b.aabb(XW - 0.6, 0, Z1 + 0.15, XA + 0.6, 40, Z1 + 0.6, 'invisible');
      b.aabb(XW - 0.6, 0, Z0 - 0.6, XW - 0.15, 40, Z1 + 0.6, 'invisible');
      b.aabb(XA + 0.15, 0, Z0 - 0.6, XA + 0.6, 40, -VEST, 'invisible'); b.aabb(XA + 0.15, 0, VEST, XA + 0.6, 40, Z1 + 0.6, 'invisible');
      // El porche de la entrada (bajo el vuelo) es parte del mapa: se entra al instituto desde aquí
      const PX = XA + 4.2;
      b.aabb(PX, 0, -VEST - 0.4, PX + 0.4, 40, VEST + 0.4, 'invisible');
      b.aabb(XA, 0, -VEST - 0.4, PX + 0.4, 40, -VEST, 'invisible'); b.aabb(XA, 0, VEST, PX + 0.4, 40, VEST + 0.4, 'invisible');
      b.aabb(XE + 0.15, 0, Z0, XA + 0.15, 40, -ANX - 0.15, 'invisible'); b.aabb(XE + 0.15, 0, ANX + 0.15, XA + 0.15, 40, Z1, 'invisible');
      const holes = (side, lvl) => SF.filter(f => f[3] === lvl).map(([a, c]) => ({ x: (STX[side][0] + STX[side][1]) / 2, z: (a + c) / 2, w: STX[side][1] - STX[side][0], d: c - a }));
      const holes1 = holes('w', 0).concat(holes('e', 0)), holes2 = holes('w', 1).concat(holes('e', 1));
      const vestHole = [{ x: (XE + XA) / 2, z: 0, w: XA - XE, d: 2 * VEST }].concat([-1, 1].map(sg => ({ x: (MS.x0 + XE) / 2, z: sg * (VEST - (MS.z1 - MS.z0) / 2), w: XE - MS.x0, d: MS.z1 - MS.z0 })));
      const voids = [-1, 1].map(s => ({ x: 0, z: s * (G2 + V2) / 2, w: XC2 - XC1, d: G2 - V2 }));
      // Forjado de P1 (edificio + anexo este), forjado de P2 y cubierta
      b.slab((XW + XE) / 2, 0, P1, XE - XW, Z1 - Z0, T, 'concrete', holes1.concat(vestHole.slice(1)));
      b.slab((XE + XA) / 2, 0, P1, XA - XE, 2 * ANX, T, 'concrete', vestHole.slice(0, 1));
      b.slab((XE + XA) / 2, 0, P2, XA - XE, 2 * VEST, T, 'concrete');                    // techo del vestíbulo (doble altura)
      b.slab(0, 0, P2, XE - XWC, Z1 - Z0, T, 'marble', voids.concat(holes2));
      b.slab((XW + XWC) / 2, 0, P2, XWC - XW, Z1 - Z0, T, 'concrete');                  // azotea de la columna oeste
      [-1, 1].forEach(s => { b.slab((XE + XA) / 2, s * (ANX + 22.5) / 2, P2, XA - XE, ANX - 22.5, T, 'concrete'); b.slab((XE + 42) / 2, s * (R1 + G2) / 2, ROOF, 42 - XE, R1 - G2, T, 'concrete'); });   // cubiertas de los aseos del anexo
      // Cubierta: sobre las galerías no hay forjado; el patio entero queda bajo el lucernario, encima
      // de un cuerpo alto con ventanas pequeñas (como en la foto del patio)
      const open = [-1, 1].map(s => ({ x: 0, z: s * (R1 + V2) / 2, w: XC2 - XC1, d: R1 - V2 }));
      b.slab(0, 0, ROOF, XE - XWC, Z1 - Z0, T, 'concrete', open);
      b.ring(0, 0, ROOF, XE - XWC, Z1 - Z0, 0.6, 0.3, 'concrete');
      [[-14, -33], [14, -33], [-14, 33], [14, 33]].forEach(([x, z]) => {
        b.box(x, ROOF, z, 1.6, 0.9, 1.1, 'metal', { solid: false }); b.box(x, ROOF + 0.9, z, 1.0, 0.05, 0.9, 'metalDark', { solid: false });
      });
      // Barandilla de vidrio a los lados de un tramo, escalonada cada metro siguiendo la pendiente
      // (1 m por encima del peldaño). Va DENTRO del hueco del forjado: así nadie se sale por el lateral
      // ni se da con la cabeza en el canto del forjado, y la escalera se ve a través del cristal.
      // axis 'z': tramo a lo largo de Z entre u0..u1 (foot = extremo del pie); lados en x0 y x1.
      const balustrade = (axis, s0, s1, u0, u1, foot, yMin, yFoot, rise) => {
        const L = u1 - u0, n = Math.ceil(L - 0.4), dirS = foot === u0 ? 1 : -1;
        for (let k = 0; k < n; k++) {
          const da = 0.4 + k * (L - 0.4) / n, db = 0.4 + (k + 1) * (L - 0.4) / n;    // distancia al pie (el primer palmo, libre)
          const ua = foot + dirS * da, ub = foot + dirS * db, top = yFoot + rise * db / L + 1.0;
          const lo = Math.min(ua, ub), hi = Math.max(ua, ub);
          [[s0, s0 + 0.12], [s1 - 0.12, s1]].forEach(([p, q]) => {
            if (axis === 'z') { b.aabb(p, yMin, lo, q, top, hi, 'glass'); b.aabb(p - 0.02, top - 0.06, lo, q + 0.02, top, hi, 'metalDark', { solid: false }); }
            else { b.aabb(lo, yMin, p, hi, top, q, 'glass'); b.aabb(lo, top - 0.06, p - 0.02, hi, top, q + 0.02, 'metalDark', { solid: false }); }
          });
        }
      };
      // Tramos rectos con barandilla de vidrio escalonada a los dos lados (dentro del hueco) y, en la
      // planta de llegada, barandilla alrededor del hueco menos por donde se sale
      const covered = (lvl, z) => lvl === 1 && ((Math.abs(z) > V2 && Math.abs(z) < G2) || Math.abs(z) < CB);   // ya hay antepecho o muro
      ['w', 'e'].forEach(side => SF.forEach(([a, c, dir, lvl]) => {
        const [x0, x1] = STX[side], x = (x0 + x1) / 2, z = (a + c) / 2;
        const y0 = lvl ? P1 : P0, rise = lvl ? P2 - P1 : P1 - P0, yTop = y0 + rise;
        const foot = dir === '+z' ? a : c, top = dir === '+z' ? c : a;
        b.stairs(x, z, y0, x1 - x0 - 0.24, c - a, rise, dir, 'marble');
        balustrade('z', x0, x1, a, c, foot, y0, y0, rise);
        const aisle = side === 'w' ? [x0 - 0.1, x0] : [x1, x1 + 0.1], patio = side === 'w' ? [x1, x1 + 0.1] : [x0 - 0.1, x0];
        rail(aisle[0], a, aisle[1], c, yTop);
        // por el lado del patio, sólo donde no hay antepecho ni muro
        for (let zz = a; zz < c - 0.01; zz += 0.5) { const zb = Math.min(c, zz + 0.5); if (!covered(lvl, (zz + zb) / 2)) rail(patio[0], zz, patio[1], zb, yTop); }
        rail(x0, foot - 0.05, x1, foot + 0.05, yTop);
        sign(lvl ? '↑ PLANTA 2' : '↑ PLANTA 1', x, y0 + 2.4, foot + (dir === '+z' ? -0.15 : 0.15), dir === '+z' ? Math.PI : 0, 1.2, '#1d8f4e');
      }));
      // Escalera principal: dos tramos, uno a cada lado del hueco del vestíbulo (como en el plano),
      // de la entrada (este) hacia el pasillo este de la 1ª
      [-1, 1].forEach(sg => {
        const za = sg < 0 ? MS.z0 : VEST - (MS.z1 - MS.z0), zb = za + (MS.z1 - MS.z0);
        b.stairs((MS.x0 + MS.x1) / 2, (za + zb) / 2, P0, zb - za - 0.24, MS.x1 - MS.x0, P1, '-x', 'marble');
        balustrade('x', za, zb, MS.x0, MS.x1, MS.x1, P0, P0, P1);
      });

      // ========================= PLANTA BAJA (P0) =========================
      const Y0 = P0;
      // Fila norte: A007-E (esquina), A006-E…A001-E, maquinària, C.T. y magatzem
      classroom(XW, Z0, XWC, -R0, Y0, 's', 2.5, 'n', 'A007-E', { backWin: false });
      rowRooms(['A006-E', 'A005-E', 'A004-E', 'A003-E', 'A002-E', 'A001-E'], XWC, 19.5).forEach(([n, a, c], i) => classroom(a, Z0, c, -R0, Y0, 's', 2.6, 'n', n, { desk: i % 2 ? 0x2f6fb5 : 0xc0392b }));
      room(19.5, Z0, 27, -R0, Y0, [{ side: 's', at: 0 }], [], { floor: 0x9aa0a6, name: 'MAQUINÀRIA' });
      b.box(23.2, Y0, -32, 3, 2, 2.4, 'metal');
      room(27, Z0, 33, -R0, Y0, [{ side: 's', at: 0.4, w: 1.4 }], [], { floor: 0x9aa0a6, name: 'C.T.' });
      b.box(30, Y0, -33, 2.4, 2.2, 1.4, 'metalDark');
      room(33, Z0, XE, -R0, Y0, [{ side: 's', at: 0, w: 1.2 }], [{ side: 'e', at: 0, w: 1.4 }], { name: 'M002-E' });
      // Fila sur: A007-O (esquina), A006-O…A001-O, consergeria, secretaria y D007-O
      classroom(XW, R0, XWC, Z1, Y0, 'n', 2.5, 's', 'A007-O');
      rowRooms(['A006-O', 'A005-O', 'A004-O', 'A003-O', 'A002-O', 'A001-O'], XWC, 19.5).forEach(([n, a, c], i) => classroom(a, R0, c, Z1, Y0, 'n', 2.6, 's', n, { desk: i % 2 ? 0xc0392b : 0x2f6fb5 }));
      room(19.5, R0, 25.5, Z1, Y0, [{ side: 'n', at: -1.5 }], [{ side: 's', at: 0, w: 2.4 }], { name: 'CONSERGERIA' });
      room(25.5, R0, 32, Z1, Y0, [{ side: 'n', at: -1.5 }], [{ side: 's', at: 0, w: 2.4 }], { name: 'SECRETARIA' });
      b.aabb(26.5, Y0, 28.8, 31, Y0 + 1.05, 29.5, 'wood');
      room(32, R0, XE, Z1, Y0, [{ side: 'n', at: 0, w: 1.2 }], [{ side: 'e', at: 0, w: 1.4 }], { name: 'D007-O' });
      // Pasillos norte y sur de P0 (de fachada a fachada) con ventana al oeste
      [-1, 1].forEach(s => { const [a, c] = s < 0 ? [-R0, -C0] : [C0, R0]; b.wallSeg('z', XW + T / 2, a, c, Y0, HF[Y0], T, [{ at: 0, y: 1.0, w: 1.6, h: 1.6 }], WALL); glass('z', XW + T / 2, (a + c) / 2 - 0.8, (a + c) / 2 + 0.8, Y0 + 1, 1.6); });
      // Columna oeste: departamentos, aseos, magatzems y la cocina
      room(XW, -C0, XWC, -17.5, Y0, [{ side: 'e', at: 0, w: 1.2 }], [{ side: 'w', at: 0, w: 1.6 }], { name: 'D006-E' });
      aseos(XW, -17.5, XWC, -12, Y0, { side: 'e', at: 0, w: 1.2 }, 'B004-E');
      aseos(XW, -12, XWC, -7.5, Y0, { side: 'e', at: 0, w: 1.2 }, 'B005-E');
      room(XW, -7.5, XWC, 7.5, Y0, [{ side: 'e', at: 0, w: 2.6 }], [{ side: 'w', at: -3.5, w: 2 }, { side: 'w', at: 3.5, w: 2 }], { floor: 0xc9d3dc, name: 'CUINA' });
      b.aabb(XW + 0.5, Y0, -5.5, XW + 1.3, Y0 + 0.95, 5.5, 'metal'); b.aabb(-41.5, Y0, -3, -40, Y0 + 0.95, 3, 'metal');
      aseos(XW, 7.5, XWC, 12, Y0, { side: 'e', at: 0, w: 1.2 }, 'B006-O');
      aseos(XW, 12, XWC, 17.5, Y0, { side: 'e', at: 0, w: 1.2 }, 'B005-O');
      room(XW, 17.5, XWC, C0, Y0, [{ side: 'e', at: 0, w: 1.2 }], [{ side: 'w', at: 0, w: 1.6 }], { name: 'D006-O' });
      // Bloque interior norte: A008-E, A009-E, aseos B003-E/B002-E, GIMNÀS y D007-E
      classroom(XC1, -C0, -14, -13.5, Y0, 'n', 6, 's', 'A008-E', { noWin: true });
      classroom(XC1, -13.5, -14, -CAF, Y0, 's', 6, 'n', 'A009-E', { noWin: true });
      aseos(-14, -C0, -9, -CAF, Y0, { side: 's', at: 0, w: 1.2 }, 'B003-E');
      aseos(-9, -C0, -4, -CAF, Y0, { side: 's', at: 0, w: 1.2 }, 'B002-E');
      room(-4, -C0, 23, -CAF, Y0, [{ side: 's', at: -7, w: 2.4 }, { side: 's', at: 7, w: 2.4 }, { side: 'n', at: 0, w: 2.4 }], [], { floor: 0xc9a46a, name: 'GIMNÀS' });
      const gz = -(C0 + CAF) / 2;
      b.decoAt('court', 9.5, Y0 + 0.04, gz, { w: 24, d: 14, color: 0xc9a46a });
      b.decoAt('hoop', -3.6, Y0, gz, { rotY: Math.PI / 2 }); b.box(-3.75, Y0, gz, 0.3, 3.2, 0.3, 'invisible');
      b.decoAt('hoop', 22.6, Y0, gz, { rotY: -Math.PI / 2 }); b.box(22.75, Y0, gz, 0.3, 3.2, 0.3, 'invisible');
      b.decoAt('wallbars', 4, Y0, -C0 + 0.45, { n: 8 }); b.box(4, Y0, -C0 + 0.5, 6.4, 2.6, 0.3, 'invisible');
      b.box(9.5, Y0, -5.6, 2.2, 0.45, 0.6, 'blue');
      room(23, -C0, XC2, -CAF, Y0, [{ side: 'e', at: 3, w: 1.4 }], [], { name: 'D007-E' });
      // Bloque interior sur: A010-O, A009-O, A008-O, aseos, SALA D'ACTES y D006-O
      classroom(XC1, CAF, -14, 13.5, Y0, 'n', 6, 's', 'A010-O', { noWin: true });
      classroom(XC1, 13.5, -23, C0, Y0, 's', 0, 'n', 'A008-O', { noWin: true, oneRow: true });
      classroom(-23, 13.5, -14, C0, Y0, 's', 0, 'n', 'A009-O', { noWin: true, oneRow: true });
      aseos(-14, CAF, -9, C0, Y0, { side: 'n', at: 0, w: 1.2 }, 'B004-O');
      aseos(-9, CAF, -4, C0, Y0, { side: 'n', at: 0, w: 1.2 }, 'B003-O');
      room(-4, CAF, 23, C0, Y0, [{ side: 'n', at: -7, w: 2.4 }, { side: 'n', at: 7, w: 2.4 }], [], { floor: 0x7a2f2f, name: "SALA D'ACTES" });
      b.aabb(-3.7, Y0, 18.6, 22.7, Y0 + 0.9, 22.2, 'woodDark');
      b.decoAt('screen', 9.5, Y0 + 2.6, 22.1, { rotY: Math.PI, w: 6, h: 2.6 });
      for (let z = 7.2; z < 16.6; z += 1.5) for (const [x0, x1] of [[-2, 8.5], [10.5, 21]]) b.aabb(x0, Y0, z - 0.3, x1, Y0 + 0.5, z + 0.3, 'red');
      room(23, CAF, XC2, C0, Y0, [{ side: 'e', at: -3, w: 1.4 }], [], { name: 'D006-O' });
      // Banda central: CAFETERIA · MENJADOR (de la cocina al vestíbulo) con su fila de pilares
      floor(XWC, -CAF, XE, CAF, 0xe2ddd2, Y0);
      sign('CAFETERIA · MENJADOR', -22, Y0 + 2.8, -CAF + 0.2, 0, 2.6, '#8a4b14');
      [[-3.8, -1.2], [1.2, 3.8]].forEach(([a, c]) => { b.aabb(-31, Y0, a, -29.8, Y0 + 1.05, c, 'wood'); b.aabb(-31.1, Y0 + 1.05, a, -29.7, Y0 + 1.12, c, 'counter'); });
      [[-26, -2], [-21.5, 2], [-1.5, -2], [7.5, 2], [12, -2], [22, 2], [26, -2]].forEach(([x, z]) => {
        b.box(x, Y0, z, 2.4, 0.76, 1.0, 'wood');
        [-0.75, 0.75].forEach(o => b.box(x + o, Y0, z + (z < 0 ? -0.75 : 0.75), 0.45, 0.45, 0.45, 'red', { solid: false }));
      });
      for (let x = -27.5; x <= 27.5; x += 5) b.pillar(x, Y0, 0, 0.4, HF[Y0], 'concrete');
      // Pasillos de P0
      floor(XW + T, -R0, XE, -C0, 0xe6e0d4, Y0); floor(XW + T, C0, XE, R0, 0xe6e0d4, Y0);
      corrFloor(XWC, XC1, -C0, -CAF, Y0, 'w', 0xe6e0d4); corrFloor(XWC, XC1, CAF, C0, Y0, 'w', 0xe6e0d4);
      corrFloor(XC2, XE, -C0, -CAF, Y0, 'e', 0xe6e0d4); corrFloor(XC2, XE, CAF, C0, Y0, 'e', 0xe6e0d4);
      // Anexo este: aseos y departamentos a los lados del vestíbulo
      aseos(XE, -ANX, XA, -C0, Y0, { side: 'w', at: 3.2, w: 1.2 }, 'B001-E');
      rowRooms(['A000-E', 'D006-E', 'D005-E', 'D004-E'], -C0, -VEST).forEach(([n, a, c], i) => room(XE, a, XA, c, Y0, [{ side: 'w', at: i === 1 ? 1.2 : 0, w: 1.2 }], [{ side: 'e', at: 0, w: 1.6 }], { name: n }));
      rowRooms(['D001-O', 'D002-O', 'D003-O', 'D004-O'], VEST, C0).forEach(([n, a, c], i) => room(XE, a, XA, c, Y0, [{ side: 'w', at: i === 2 ? -1.2 : 0, w: 1.2 }], [{ side: 'e', at: 0, w: 1.6 }], { name: n }));
      aseos(XE, C0, XA, ANX, Y0, { side: 'w', at: -3.2, w: 1.2 }, 'B001-O');
      // Vestíbulo del ACCÉS (doble altura) con la escalera principal y la entrada acristalada (cerrada)
      floor(XE, -VEST, XA, VEST, 0xe2ddd2, Y0);
      // Fachada de la entrada como en la foto: dos vanos acristalados con una puerta doble cada uno,
      // pilar en medio, rótulos blancos encima de las puertas, franja de cristal con carteles y vuelo
      const BAYS = [[-5.0, -0.4], [0.4, 5.0]], DOORW = 2.0;
      const ops = [];
      BAYS.forEach(([u, v]) => {
        const c = (u + v) / 2;
        ops.push({ at: c, w: DOORW, h: 2.6 });
        ops.push({ at: (u + c - DOORW / 2) / 2, w: c - DOORW / 2 - u, y: 0.12, h: 2.48, closed: true });
        ops.push({ at: (c + DOORW / 2 + v) / 2, w: v - c - DOORW / 2, y: 0.12, h: 2.48, closed: true });
        ops.push({ at: c, w: v - u, y: 3.0, h: 1.0 });
      });
      b.wallSeg('z', XA - T / 2, -VEST, VEST, Y0, HF[Y0], T, ops, WALL);
      BAYS.forEach(([u, v], i) => {
        const c = (u + v) / 2;
        glass('z', XA - T / 2, u, c - DOORW / 2, Y0 + 0.12, 2.48); glass('z', XA - T / 2, c + DOORW / 2, v, Y0 + 0.12, 2.48);
        glass('z', XA - T / 2, u, v, Y0 + 3.0, 1.0);
        [u, c - DOORW / 2, c + DOORW / 2, v].forEach(zz => b.aabb(XA - 0.05, Y0, zz - 0.04, XA + 0.06, Y0 + 2.6, zz + 0.04, 'metalDark', { solid: false }));
        b.aabb(XA - 0.05, Y0 + 2.56, u, XA + 0.06, Y0 + 2.64, v, 'metalDark', { solid: false });
        for (let k = 0; k < 5; k++) b.aabb(XA - 0.2, Y0 + 3.1, u + 0.3 + k * (v - u - 0.6) / 5, XA - 0.18, Y0 + 3.9, u + 0.3 + (k + 0.8) * (v - u - 0.6) / 5, ['red', 'blue', 'yellow', 'white', 'orange'][(k + i) % 5], { solid: false });
        b.decoAt('textsign', XA + 0.12, Y0 + 2.8, c, { text: i ? 'INSTITUTO ENSEÑANZA SECUNDARIA ABASTOS' : 'INSTITUT ENSENYAMENT SECUNDARI ABASTOS', w: 2.6, h: 0.34, bg: '#f7f5ef', fg: '#1f3d7a', rotY: Math.PI / 2 });
      });
      b.aabb(XA - 0.05, 0, -0.4, XA + 0.65, 4.5, 0.4, 'cream'); b.aabb(XA - 0.08, 0, -0.45, XA + 0.7, 0.7, 0.45, 'metalDark');
      sign('ACCÉS', XA - 0.2, Y0 + 2.7, 0, -Math.PI / 2, 0.9);
      sign('↑ PLANTA 1', MS.x1 - 0.6, Y0 + 2.2, MS.z1 + 0.2, 0, 1.2, '#1d8f4e');

      // ========================= PRIMERA PLANTA (P1) =========================
      const Y1 = P1;
      // Fila norte: A108-E (esquina), A107-E…A102-E, maquinària, quadre elèctric y A101-E
      classroom(XW, Z0, XWC, -R1, Y1, 's', 2.5, 'n', 'A108-E');
      [['A107-E', XWC, -27.8], ['A106-E', -27.8, -17.1], ['A105-E', -17.1, -7], ['A104-E', -7, 3.1], ['A103-E', 3.1, 12.9], ['A102-E', 12.9, 22.6]].forEach(([n, a, c], i) => classroom(a, Z0, c, -R1, Y1, 's', 2.6, 'n', n, { desk: i % 2 ? 0x2f6fb5 : 0xc0392b, frontWin: true }));
      // Bajo los porches: zócalo de mármol gris con banco corrido entre puerta y puerta (como en la foto)
      [[[XWC, -27.8], [-27.8, -17.1], [-17.1, -7], [-7, 3.1], [3.1, 12.9], [12.9, 22.6]], [[XWC, -27], [-27, -17], [-17, -7.3], [-7.3, 2.3], [2.3, 11.8], [11.8, 20.6]]].forEach((row, k) => row.forEach(([a, c]) => {
        const s = k ? 1 : -1, zw = s * R1, cx = (a + c) / 2;
        b.aabb(a + 0.3, Y1, zw - (s < 0 ? 0 : 0.04), cx + 1.75, Y1 + 0.9, zw + (s < 0 ? 0.04 : 0), 'granite', { solid: false });
        b.aabb(a + 0.5, Y1, s < 0 ? zw : zw - 0.45, cx + 1.4, Y1 + 0.45, s < 0 ? zw + 0.45 : zw, 'granite');
      }));
      room(22.6, Z0, 29.8, -R1, Y1, [{ side: 's', at: 0, w: 1.4 }], [], { floor: 0x9aa0a6, name: 'MAQUINÀRIA' });
      b.box(26.2, Y1, -34.5, 3, 1.8, 2, 'metal');
      room(29.8, Z0, 32.2, -R1, Y1, [{ side: 's', at: 0, w: 1.0 }], [], { floor: 0x9aa0a6, name: 'QUADRE ELÈCTRIC', bg: '#7a1f1f' });
      classroom(32.2, Z0, XE, -R1, Y1, 's', 0, 'n', 'A101-E');
      // Fila sur: A107-O (esquina), A106-O…A101-O, sala del professorat y magatzem
      classroom(XW, R1, XWC, Z1, Y1, 'n', 2.5, 's', 'A107-O');
      [['A106-O', XWC, -27], ['A105-O', -27, -17], ['A104-O', -17, -7.3], ['A103-O', -7.3, 2.3], ['A102-O', 2.3, 11.8], ['A101-O', 11.8, 20.6]].forEach(([n, a, c], i) => classroom(a, R1, c, Z1, Y1, 'n', 2.6, 's', n, { desk: i % 2 ? 0xc0392b : 0x2f6fb5, frontWin: true }));
      room(20.6, R1, 30, Z1, Y1, [{ side: 'n', at: -2.5 }], [{ side: 's', at: 1, w: 2.4 }], { name: 'SALA PROFESSORAT' });
      b.aabb(22.5, Y1, 33, 28.5, Y1 + 0.76, 35, 'wood');
      room(30, R1, XE, Z1, Y1, [{ side: 'n', at: 0, w: 1.2 }], [{ side: 's', at: 0, w: 1.4 }], { name: 'MAGATZEM' });
      // Pasillos norte y sur (distribuïdors) de fachada a fachada
      [-1, 1].forEach(s => { const [a, c] = s < 0 ? [-R1, -G1] : [G1, R1]; b.wallSeg('z', XW + T / 2, a, c, Y1, HF[Y1], T, [{ at: 0, y: 1.0, w: 1.6, h: 1.6 }], WALL); glass('z', XW + T / 2, (a + c) / 2 - 0.8, (a + c) / 2 + 0.8, Y1 + 1, 1.6); });
      // Columna oeste: aseos B103/B104 y aulas A109-E…A111-E, A110-O…A108-O
      aseos(XW, -G1, XWC, -23.5, Y1, { side: 'e', at: 0, w: 1.2 }, 'B103-E');
      aseos(XW, -23.5, XWC, -20.7, Y1, { side: 'e', at: 0, w: 1.0 }, 'B104-E');
      [['A109-E', -20.7, -13.7, 1.6], ['A110-E', -13.7, -6.7, 1.6], ['A111-E', -6.7, 0.3, -2.4], ['A110-O', 0.3, 7.3, 2.4], ['A109-O', 7.3, 14.3, 1.6], ['A108-O', 14.3, 21.3, 1.6]].forEach(([n, a, c, da]) => {
        room(XW, a, XWC, c, Y1, [{ side: 'e', at: da, w: 1.4 }], [{ side: 'w', at: -1.6, w: 1.8 }, { side: 'w', at: 1.6, w: 1.8 }], { floor: 0xd6cfbf, name: n });
        b.decoAt('board', XW + 0.38, Y1 + 1.55, (a + c) / 2, { rotY: Math.PI / 2, w: 2.6, text: n });
        for (const x of [-44.3, -41.4]) for (let z = a + 1.4; z < c - 1.0; z += 2.3) { b.decoAt('desk', x, Y1, z, { color: 0x2f6fb5, rotY: Math.PI }); b.box(x - 0.2, Y1, z, 0.62, 0.76, 1.0, 'invisible'); }
      });
      aseos(XW, 21.3, XWC, 23.9, Y1, { side: 'e', at: 0, w: 1.0 }, 'B104-O');
      aseos(XW, 23.9, XWC, G1, Y1, { side: 'e', at: 0, w: 1.2 }, 'B103-O');
      // Patios Cavanilles (norte) y Sánchez Ayuso (sur), al aire libre bajo el lucernario; los pilares
      // de la retícula sostienen las galerías de la segunda planta
      [[-G1, -ST1, 'PATI EST · CAVANILLES', 0x2f6fb5], [ST1, G1, 'PATI OEST · SÁNCHEZ AYUSO', 0x3c7d5c]].forEach(([a, c, n, col]) => {
        const cz = (a + c) / 2;
        // Suelo como el real: terrazo gris con franjas de mármol blanco, líneas amarillas y mármol bajo los porches
        const s = Math.sign(a), pa = Math.min(s * G2, s * V2), pc = Math.max(s * G2, s * V2);
        floor(XC1, a, XC2, c, 0xd9dcdf, Y1);
        b.decoAt('plane', 0, Y1 + 0.045, (pa + pc) / 2, { w: XC2 - XC1 - 1.2, d: pc - pa - 1.2, color: 0x8e8f8b });
        for (let x = -20; x <= 20; x += 10) b.decoAt('plane', x, Y1 + 0.06, (pa + pc) / 2, { w: 0.7, d: pc - pa - 1.2, color: 0xe6e7e4 });
        b.decoAt('plane', 0, Y1 + 0.06, (pa + pc) / 2, { w: XC2 - XC1 - 1.2, d: 0.7, color: 0xe6e7e4 });
        [[-12, 0.1], [12, 0.1]].forEach(([x]) => {
          [[x, (pa + pc) / 2 - 3.5, 9, 0.09], [x, (pa + pc) / 2 + 3.5, 9, 0.09]].forEach(([lx, lz, lw, ld]) => b.decoAt('plane', lx, Y1 + 0.07, lz, { w: lw, d: ld, color: 0xf2c230 }));
          [-4.5, 4.5].forEach(o => b.decoAt('plane', x + o, Y1 + 0.07, (pa + pc) / 2, { w: 0.09, d: 7, color: 0xf2c230 }));
        });
        sign(n, 0, Y1 + 2.6, a < 0 ? -G1 + 0.2 : G1 - 0.2, a < 0 ? 0 : Math.PI, 2.6, '#0f6b4f');
        // Porches: pilares crema con ménsulas que sostienen las galerías de arriba, viga de canto
        for (let x = -30; x <= 30; x += 5) [s * G2, s * V2].forEach(z => {
          b.pillar(x, Y1, z, 0.5, P2 - Y1 - T, 'cream');
          b.box(x, Y1, z, 0.66, 0.12, 0.66, 'marble', { solid: false });
          b.aabb(x - 0.75, P2 - T - 0.28, z - 0.2, x + 0.75, P2 - T, z + 0.2, 'cream', { solid: false });
          b.aabb(x - 0.48, P2 - T - 0.62, z - 0.18, x + 0.48, P2 - T - 0.28, z + 0.18, 'cream', { solid: false });
        });
        [s * G2, s * V2].forEach(z => b.aabb(XC1, P2 - T - 0.3, z - 0.22, XC2, P2 - T, z + 0.22, 'cream', { solid: false }));
      });
      // Franja central: magatzems, distribuidor, recurs, BIBLIOTECA, A112-E y distribuidor
      glazed('x', -ST1 + T / 2, -29.4, -11.4, Y1, 4.5, 2.4, [-20], 2.4); glazed('x', -ST1 + T / 2, 13.6, XC2, Y1, 4.5, 2.4, [22], 2.4);
      glazed('x', ST1 - T / 2, -29.4, -3.7, Y1, 4.5, 2.4, [-20], 2.4); glazed('x', ST1 - T / 2, 13.6, XC2, Y1, 4.5, 2.4, [22], 2.4);
      room(XC1, -ST1, -29.4, -2.4, Y1, [{ side: 'e', at: 0, w: 1.0 }], [], { floor: 0x9aa0a6, name: 'MAGATZEM' });
      room(XC1, 2.4, -29.4, ST1, Y1, [{ side: 'e', at: 0, w: 1.0 }], [], { floor: 0x9aa0a6, name: 'MAGATZEM' });
      floor(-29.4, -ST1, -11.4, ST1, 0xe6e0d4, Y1); floor(XC1, -2.4, -29.4, 2.4, 0xe6e0d4, Y1);
      sign('DISTRIBUIDOR', -20, Y1 + 2.6, 0, Math.PI / 2, 1.5);
      room(-11.4, -ST1, -3.7, 0, Y1, [{ side: 's', at: 0, w: 1.4 }], [], { name: 'RECURS' });
      floor(-11.4, 0, -3.7, ST1, 0xe6e0d4, Y1);
      room(-3.7, -ST1, 5.9, ST1, Y1, [{ side: 'w', at: 2.5, w: 1.6 }], [], { name: 'BIBLIOTECA' });
      [[-2.4, 'bookRed'], [-0.4, 'bookBlue'], [1.6, 'bookGreen'], [3.6, 'bookRed']].forEach(([x, m]) => b.aabb(x - 0.3, Y1, -4.6, x + 0.3, Y1 + 2.0, -1.2, m));
      b.aabb(-0.8, Y1, 1.6, 4.5, Y1 + 0.76, 3.0, 'wood');
      room(5.9, -ST1, 13.6, ST1, Y1, [{ side: 'e', at: -2.5, w: 1.4 }], [], { floor: 0xd6cfbf, name: 'A112-E' });
      b.decoAt('board', 9.75, Y1 + 1.55, ST1 - T - 0.08, { rotY: Math.PI, w: 3, text: 'A112-E' });
      [-1.5, 1].forEach(z => [8, 10.5].forEach(x => { b.decoAt('desk', x, Y1, z, { color: 0x2f6fb5, rotY: Math.PI / 2 }); b.box(x, Y1, z - 0.2, 1.0, 0.76, 0.62, 'invisible'); }));
      floor(13.6, -ST1, XC2, ST1, 0xe6e0d4, Y1);
      sign('DISTRIBUIDOR', 23, Y1 + 2.6, 0, -Math.PI / 2, 1.5);
      // Anexo este: aseos B102-E/B101-E y B101-O/B102-O, terrazas al aire libre y hueco del vestíbulo
      glazed('z', XE + T / 2, -22.5, -VEST, Y1, 4.5, 2.4, [-14.75], 1.6); glazed('z', XE + T / 2, VEST, 22.5, Y1, 4.5, 2.4, [14.75], 1.6);
      aseos(XE, -ANX, XA - 2.5, -G1, Y1, { side: 'w', at: -0.5, w: 1.2 }, 'B102-E');
      aseos(XE, -G1, XA - 2.5, -22.5, Y1, { side: 'w', at: 0.5, w: 1.2 }, 'B101-E');
      aseos(XE, 22.5, XA - 2.5, G1, Y1, { side: 'w', at: -0.5, w: 1.2 }, 'B101-O');
      aseos(XE, G1, XA - 2.5, ANX, Y1, { side: 'w', at: 0.5, w: 1.2 }, 'B102-O');
      [[-ANX, -22.5], [22.5, ANX]].forEach(([a, c]) => b.aabb(XA - 2.5, Y1, a, XA, Y1 + HF[Y1], c, WALL));
      floor(XE, -22.5, XA, -VEST, 0xbfb8aa, Y1); floor(XE, VEST, XA, 22.5, 0xbfb8aa, Y1);
      sign('TERRASSA', XE + 0.17, Y1 + 2.4, -12, Math.PI / 2, 1.3, '#0f6b4f');
      sign('TERRASSA', XE + 0.17, Y1 + 2.4, 12, Math.PI / 2, 1.3, '#0f6b4f');
      rail(XA - 0.15, -22.5, XA + 0.05, -VEST, Y1, true); rail(XA - 0.15, VEST, XA + 0.05, 22.5, Y1, true);
      rail(XE, -VEST - 0.05, XA, -VEST + 0.05, Y1); rail(XE, VEST - 0.05, XA, VEST + 0.05, Y1);
      rail(XE - 0.05, MS.z1, XE + 0.05, VEST - (MS.z1 - MS.z0), Y1);
      [[40, -17], [40, 17], [42.5, -11], [42.5, 11]].forEach(([x, z]) => { b.box(x, Y1, z, 1.2, 0.6, 1.2, 'invisible'); b.decoAt('planter', x, Y1, z, { color: 0xa9aaa4 }); });
      [[41, -19.5], [41, 19.5]].forEach(([x, z]) => { b.decoAt('bench', x, Y1, z, { rotY: Math.PI / 2 }); b.box(x, Y1, z, 0.55, 0.55, 1.8, 'invisible'); });
      // Fachada del vestíbulo en P1 (doble altura): ventanales
      b.wallSeg('z', XA - T / 2, -VEST, VEST, Y1, HF[Y1], T, [{ at: -2.6, y: 0.4, w: 4.2, h: 3.0 }, { at: 2.6, y: 0.4, w: 4.2, h: 3.0 }], WALL);
      glass('z', XA - T / 2, -4.7, -0.5, Y1 + 0.4, 3.0); glass('z', XA - T / 2, 0.5, 4.7, Y1 + 0.4, 3.0);
      // Pasillos de P1
      floor(XW + T, -R1, XE, -G1, 0xe6e0d4, Y1); floor(XW + T, G1, XE, R1, 0xe6e0d4, Y1);
      corrFloor(XWC, XC1, -G1, G1, Y1, 'w', 0xe6e0d4);
      corrFloor(XC2, XE, -G1, MS.z0, Y1, 'e', 0xe6e0d4); floor(XC2, MS.z0, MS.x0, MS.z1, 0xe6e0d4, Y1); corrFloor(XC2, XE, MS.z1, VEST - (MS.z1 - MS.z0), Y1, 'e', 0xe6e0d4); floor(XC2, VEST - (MS.z1 - MS.z0), MS.x0, VEST, 0xe6e0d4, Y1); corrFloor(XC2, XE, VEST, G1, Y1, 'e', 0xe6e0d4);

      // ========================= SEGUNDA PLANTA (P2) =========================
      const Y2 = P2;
      // Fachadas de los pasillos oeste y este (acristaladas) y sus testeros
      glazed('z', XWC + T / 2, Z0, Z1, Y2, 4.5, 2.4);
      glazed('z', XE - T / 2, Z0, Z1, Y2, 4.5, 2.4, [-27.5, 27.5], 1.4);
      [[XWC, XC1], [XC2, XE]].forEach(([a0, a1]) => {
        b.wallSeg('x', Z0 + T / 2, a0, a1, Y2, HF[Y2], T, [{ at: 0, y: 1.0, w: 1.6, h: 1.6 }], WALL); glass('x', Z0 + T / 2, (a0 + a1) / 2 - 0.8, (a0 + a1) / 2 + 0.8, Y2 + 1, 1.6);
        b.wallSeg('x', Z1 - T / 2, a0, a1, Y2, HF[Y2], T, [{ at: 0, y: 1.0, w: 1.6, h: 1.6 }], WALL); glass('x', Z1 - T / 2, (a0 + a1) / 2 - 0.8, (a0 + a1) / 2 + 0.8, Y2 + 1, 1.6);
      });
      // Aseos del anexo (B202/B201) al final de las galerías
      aseos(XE, -R1, 42, -G2, Y2, { side: 'w', at: 0, w: 1.2 }, 'B202-E');
      aseos(XE, G2, 42, R1, Y2, { side: 'w', at: 0, w: 1.2 }, 'B202-O');
      // Galerías abiertas a los patios: antepecho y barandilla (se puede saltar al patio), pilares
      [-1, 1].forEach(s => {
        gallery('x', s * G2 + s * 0.12, XC1, XC2, Y2);
        // Galería central de la 2ª: sala de estudio con cristaleras de suelo a techo hacia el patio, techo
        // blanco, mesas de madera con patas verdes y sillas (como en la foto de arriba del todo)
        const gz = s * V2 - s * 0.06;
        b.aabb(XC1, Y2, gz - 0.04, XC2, Y2 + HF[Y2], gz + 0.04, 'glass');
        for (let x = XC1; x <= XC2 + 0.01; x += 2.0) b.aabb(x - 0.05, Y2, gz - 0.07, x + 0.05, Y2 + HF[Y2], gz + 0.07, 'metalDark', { solid: false });
        [0.05, 1.0, 2.4].forEach(y => b.aabb(XC1, Y2 + y, gz - 0.07, XC2, Y2 + y + 0.07, gz + 0.07, 'metalDark', { solid: false }));
        for (let x = -27; x <= 27; x += 6) {
          const tz = s * (V2 - 1.3);
          b.aabb(x - 0.8, Y2 + 0.7, tz - 0.42, x + 0.8, Y2 + 0.76, tz + 0.42, 'wood');
          [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]].forEach(([dx, dz]) => b.aabb(x + dx - 0.03, Y2, tz + dz - 0.03, x + dx + 0.03, Y2 + 0.7, tz + dz + 0.03, 'green', { solid: false }));
          b.aabb(x - 0.75, Y2, tz - 0.4, x + 0.75, Y2 + 0.7, tz + 0.4, 'invisible');
          [-0.45, 0.45].forEach(dx => { b.aabb(x + dx - 0.22, Y2 + 0.42, tz - s * 0.75 - 0.2, x + dx + 0.22, Y2 + 0.47, tz - s * 0.75 + 0.2, 'metalDark', { solid: false }); b.aabb(x + dx - 0.22, Y2 + 0.47, tz - s * 0.95 - 0.03, x + dx + 0.22, Y2 + 0.9, tz - s * 0.95 + 0.03, 'metalDark', { solid: false }); });
        }
        const [a, c] = s < 0 ? [-G2, -V2] : [V2, G2];
        // en los lados, el antepecho se corta donde está la caja de la escalera (su muro hace de antepecho)
        const [ha, hc] = s < 0 ? FL[0] : FL[1];
        [[a, Math.max(a, ha)], [Math.min(c, hc), c]].forEach(([u, v]) => { if (v - u > 0.05) { gallery('z', XC1 - 0.12, u, v, Y2, true); gallery('z', XC2 + 0.12, u, v, Y2, true); } });
        // Antepecho escalonado (bloques más altos encima de cada pilar del porche) y canto crema del voladizo
        for (let x = -30; x <= 30; x += 5) b.aabb(x - 0.4, Y2, s * G2 + s * 0.12 - 0.2, x + 0.4, Y2 + 1.2, s * G2 + s * 0.12 + 0.2, 'cream');
        [s * G2 + s * 0.12, s * V2 - s * 0.12].forEach(z => b.aabb(XC1, Y2 - 0.45, z - 0.24, XC2, Y2 - T, z + 0.24, 'cream', { solid: false }));
      });
      // Splits del aire acondicionado junto a las aulas (como en la foto de la galería)
      [-24.5, -14.5, -4.5, 5.5, 15.5, 25].forEach(x => [[-R1 + 0.45, 1], [R1 - 0.45, -1]].forEach(([z, f]) => {
        b.box(x, Y2, z, 0.95, 0.7, 0.42, 'white');
        b.box(x - 0.12, Y2 + 0.08, z + f * 0.22, 0.55, 0.52, 0.02, 'metalDark', { solid: false });
      }));
      // Lucernario del antiguo mercado: cuerpo alto crema con ventanas pequeñas y, encima, cerchas
      // metálicas y cristal a dos aguas sobre todo el patio (galerías incluidas)
      const CL = 2.6, TOP = ROOF + CL;
      [-1, 1].forEach(s => {
        const za = s * R1, zb = s * V2, cz = (za + zb) / 2, span = Math.abs(za - zb) + 0.6;
        [[za + s * 0.15, -s], [zb - s * 0.15, s]].forEach(([z, f]) => {
          b.aabb(XC1, ROOF - T, z - 0.15, XC2, TOP, z + 0.15, 'cream', { solid: false });
          for (let x = -28.75; x <= 29; x += 5) b.aabb(x - 0.8, ROOF + 0.7, z + f * 0.17 - 0.02, x + 0.8, ROOF + 1.7, z + f * 0.17 + 0.02, 'metalDark', { solid: false });
        });
        [XC1 - 0.15, XC2 + 0.15].forEach(x => b.aabb(x - 0.15, ROOF - T, Math.min(za, zb), x + 0.15, TOP, Math.max(za, zb), 'cream', { solid: false }));
        b.decoAt('skylight', 0, TOP, cz, { w: span, d: XC2 - XC1 + 0.6, r: 3.2, rotY: Math.PI / 2 });
        for (let x = XC1 + 0.3; x <= XC2 - 0.2; x += 5) b.decoAt('truss', x, TOP, cz, { w: span, r: 3.2, rotY: Math.PI / 2 });
      });
      // Fila norte: aseos B204-E/B203-E y aulas 206 … 201 (plano de evacuación)
      const AW = (XC2 - (XC1 + 5.3)) / 6;
      aseos(XC1, Z0, XC1 + 5.3, -R1, Y2, { side: 's', at: 0.8, w: 1.2 }, 'B204-E');
      [['206', 'Desdobles'], ['205', 'Desdobles'], ['204', 'PMAR'], ['203', 'ESO 2ºI'], ['202', 'ESO 2ºE'], ['201', 'ESO 2ºA']].forEach(([n, g], i) =>
        classroom(XC1 + 5.3 + i * AW, Z0, XC1 + 5.3 + (i + 1) * AW, -R1, Y2, 's', 2.6, 'n', `AULA ${n}`, { desk: i % 2 ? 0x2f6fb5 : 0xc0392b, board: g, frontWin: true }));
      // Fila sur: aseos B204-O/B203-O, AULA 207 (Ciclo DAM, al fondo a la izquierda) y aulas 208 … 212
      aseos(XC1, R1, XC1 + 5.3, Z1, Y2, { side: 'n', at: 0.8, w: 1.2 }, 'B204-O');
      [['207', 'CICLO DAM 7J-7N'], ['208', 'CICLO DAW 6K-7K'], ['209', 'ESO 3ºA'], ['210', 'ESO 3ºE'], ['211', 'ESO 3ºI'], ['212', 'ESO 3ºV']].forEach(([n, g], i) => {
        const x0 = XC1 + 5.3 + i * AW;
        classroom(x0, R1, x0 + AW, Z1, Y2, 'n', 2.6, 's', `AULA ${n}`, i < 2 ? { pcs: true, floor: 0xc9d3dc, bg: '#0f6b4f', frontWin: true, board: i ? '<html> DAW </html>' : 'fun main() { println("7J") }' } : { desk: i % 2 ? 0x2f6fb5 : 0xc0392b, board: g, frontWin: true });
        if (i === 0) {
          sign(g, x0 + AW / 2 + 2.6 + 1.55, Y2 + 1.85, R1 - 0.17, Math.PI, 1.6, '#0f6b4f');
          b.decoAt('screen', x0 + AW / 2, Y2 + 2.25, Z1 - 0.42, { rotY: Math.PI, w: 2.4, h: 1.4 });
          b.box(x0 + 0.8, Y2, R1 + 1.0, 0.9, 2.0, 0.9, 'metalDark'); b.decoAt('rack', x0 + 0.8, Y2, R1 + 1.0, { rotY: Math.PI / 2 });
        }
      });
      // Bloque central (dos filas entre las galerías), como en el plano de evacuación
      const bgOf = n => n.startsWith('D.') ? '#5b3a7a' : '#1f3d7a';
      const top = [['PLÀSTICA', -32, -26.7], ['AULA 305', -21.3, -16], ['D. LLATÍ', -16, -11.2], ['D. FILOSOFIA', -11.2, -6.4], ['D. GEOGRAFIA', -6.4, -1.1], ['AULA 303', -1.1, 4.3], ['D. FRANCÉS', 9.6, 14.4], ['AULA 302', 14.4, 19.2], ['D. BIOLOGIA', 19.2, 25.1], ['AULA 301', 25.1, 32]];
      const bot = [['D. FOL', -32, -26.7], ['D. CASTELLÀ', -21.3, -16], ['D. INFORMÀTICA', -16, -11.2], ['D. ADMINISTR.', -11.2, -6.4], ['D. COMERÇ', -6.4, -1.1], ['D. MATEMÀT.', -1.1, 4.3], ['D. FÍS. I QUÍM.', 9.6, 14.4], ['D. VALENCIÀ', 14.4, 19.2], ['D. ANGLÉS', 19.2, 25.1], ['AULA 308', 25.1, 32]];
      top.forEach(([n, x0, x1], i) => {
        room(x0, -CB, x1, 0, Y2, [{ side: 'n', at: 0, w: 1.2 }], x1 - x0 > 4.7 ? [{ side: 'n', at: -(x1 - x0) / 2 + 1.15, w: 1.3, y: 0.9, h: 2.1, big: true }] : [], { floor: 0xddd5c6, name: n, bg: bgOf(n) });
        if (n.startsWith('AULA')) [-1.6].forEach(z => [x0 + 1.3, x0 + 3.7].forEach(x => { if (x < x1 - 1) { b.decoAt('desk', x, Y2, z, { color: 0x2f6fb5, rotY: Math.PI / 2 }); b.box(x, Y2, z - 0.2, 1.0, 0.76, 0.62, 'invisible'); } }));
        else b.aabb(x0 + 0.5, Y2, -2.2, x1 - 0.5, Y2 + 0.76, -1.2, 'wood');
        if (i % 3 === 1) b.aabb(x1 - 0.9, Y2, -4.5, x1 - 0.4, Y2 + 1.9, -3.3, 'metal');
      });
      bot.forEach(([n, x0, x1]) => {
        room(x0, 0, x1, CB, Y2, [{ side: 's', at: 0, w: 1.2 }], x1 - x0 > 4.7 ? [{ side: 's', at: -(x1 - x0) / 2 + 1.15, w: 1.3, y: 0.9, h: 2.1, big: true }] : [], { floor: 0xddd5c6, name: n, bg: bgOf(n) });
        if (n.startsWith('AULA')) [1.6].forEach(z => [x0 + 1.3, x0 + 3.7].forEach(x => { if (x < x1 - 1) { b.decoAt('desk', x, Y2, z, { color: 0x2f6fb5, rotY: Math.PI / 2 }); b.box(x, Y2, z + 0.2, 1.0, 0.76, 0.62, 'invisible'); } }));
        else b.aabb(x0 + 0.5, Y2, 1.2, x1 - 0.5, Y2 + 0.76, 2.2, 'wood');
      });
      [['AULA 306', -26.7, -21.3, 'PEDAGOGIA TERAPÈUTICA'], ['AULA 307', 4.3, 9.6, 'AULA 307']].forEach(([n, x0, x1, txt]) => {
        room(x0, -CB, x1, CB, Y2, [{ side: 'n', at: 0, w: 1.4 }, { side: 's', at: 0, w: 1.4 }], [], { floor: 0xd6cfbf, name: n });
        b.decoAt('board', x1 - T - 0.08, Y2 + 1.55, 0, { rotY: -Math.PI / 2, w: 3, text: txt });
        [-1.6, 1.6].forEach(z => [x0 + 1.3, x0 + 3.1].forEach(x => { b.decoAt('desk', x, Y2, z, { color: 0xc0392b, rotY: Math.PI }); b.box(x - 0.2, Y2, z, 0.62, 0.76, 1.0, 'invisible'); }));
      });
      // Pasillos de P2
      floor(XC1, -R1, XC2, -G2, 0xe6e0d4, Y2); floor(XC1, G2, XC2, R1, 0xe6e0d4, Y2);
      floor(XC1, -V2, XC2, -CB, 0xe6e0d4, Y2); floor(XC1, CB, XC2, V2, 0xe6e0d4, Y2);
      corrFloor(XWC + T, XC1, Z0 + T, Z1 - T, Y2, 'w', 0xe6e0d4); corrFloor(XC2, XE - T, Z0 + T, Z1 - T, Y2, 'e', 0xe6e0d4);
      [[-20, -R1 + 0.17, 0], [10, -R1 + 0.17, 0], [-6, R1 - 0.17, Math.PI], [16, R1 - 0.17, Math.PI]].forEach(([x, z, r], k) => b.decoAt('board', x + 4.5, Y2 + 1.5, z, { rotY: r, w: 1.8, text: ['Excursió 2n ESO', 'Erasmus+ 2027', 'Hackathon DAM', 'Biblioteca'][k] }));
      [[-35, -33], [35, 33], [-35, 33], [35, -33]].forEach(([x, z]) => b.box(x, Y2 + 0.9, z + (z < 0 ? -3.6 : 3.6), 0.22, 0.5, 0.22, 'red', { solid: false }));

      // ========================= ALREDEDORES (se ven, no se llega) =========================
      floor(-56.6, -56.6, 56.6, -44, 0x4d4e52, 0); floor(-56.6, 44, 56.6, 56.6, 0x4d4e52, 0);
      floor(XW - 2, Z0 - 7, XA + 2, Z0 - 0.4, 0xb9b4aa, 0); floor(XW - 2, Z1 + 0.4, XA + 2, Z1 + 7, 0xb9b4aa, 0);
      for (let x = -52; x <= 52; x += 6) { b.decoAt('plane', x, 0.04, -50, { w: 3, d: 0.25, color: 0xf2f2ee }); b.decoAt('plane', x, 0.04, 50, { w: 3, d: 0.25, color: 0xf2f2ee }); }
      [[-34, 47.5, 0xeef2f5], [-12, 52, 0xc0392b], [14, 47.5, 0x2f6fb5], [36, 52, 0xf1c40f], [-26, -47.5, 0x27ae60], [6, -52, 0x8e44ad], [30, -47.5, 0xeef2f5]].forEach(([x, z, color]) => b.decoAt('car', x, 0, z, { rotY: Math.PI / 2, color }));
      for (let x = -50; x <= 50; x += 10) { b.tree(x, -45.5, 1.1); b.tree(x + 5, 45.5, 1.1); }
      [[-36, -45], [0, -45], [36, -45], [-36, 45], [0, 45], [36, 45]].forEach(([x, z]) => b.decoAt('lamp', x, 0, z));
      b.decoAt('court', -52, 0.04, -14, { w: 7, d: 20, color: 0x2f6fb5 }); b.decoAt('court', -52, 0.04, 14, { w: 7, d: 20, color: 0x3c7d5c });
      // Este: plaza del acceso y bloques del barrio
      floor(XA + 0.4, -14, 56.6, 14, 0xc9c2b4, 0);
      [[52, -24, 8, 12, 12], [52, 24, 8, 12, 14]].forEach(([x, z, w, d, h]) => {
        b.box(x, 0, z, w, h, d, 'yellow', { solid: false });
        for (let y = 1.4; y < h - 1; y += 3) for (let zz = z - d / 2 + 1.4; zz < z + d / 2 - 1; zz += 2.4) b.box(x - w / 2 - 0.05, y, zz, 0.08, 1.4, 1.2, 'glass', { solid: false });
      });
      [[-36, -54, 14, 3, 12], [-12, -54, 16, 3, 15], [14, -54, 14, 3, 10], [38, -54, 12, 3, 13], [-38, 54, 12, 3, 14], [-14, 54, 14, 3, 11], [12, 54, 16, 3, 16], [36, 54, 12, 3, 12]].forEach(([x, z, w, d, h], i) => {
        b.box(x, 0, z, w, h, d, ['white', 'yellow', 'orange', 'white'][i % 4], { solid: false });
        for (let y = 1.4; y < h - 1; y += 3) for (let xx = x - w / 2 + 1.5; xx < x + w / 2 - 1; xx += 2.6) b.box(xx, y, z + (z < 0 ? d / 2 + 0.05 : -d / 2 - 0.05), 1.3, 1.4, 0.08, 'glass', { solid: false });
      });
      // Fachada del acceso como la real: zócalo de piedra gris, porche con pilares, vuelo, cuerpo alto
      // color crema con dos grandes ventanales (en la doble altura del vestíbulo)
      // Zócalo de piedra gris a los lados de los vanos, con ventanitas; suelo del porche de mármol
      [[-VEST, -5.4], [5.4, VEST]].forEach(([u, v]) => { b.aabb(XA, 0, u, XA + 0.14, 4.5, v, 'granite'); b.aabb(XA + 0.14, 1.2, (u + v) / 2 - 0.45, XA + 0.18, 2.2, (u + v) / 2 + 0.45, 'metalDark', { solid: false }); });
      floor(XA, -VEST, PX, VEST, 0xd9dcdf, 0);
      [-5.6, 5.6].forEach(z => { b.pillar(XA + 3.2, 0, z, 0.75, 4.5, 'cream'); b.box(XA + 3.2, 0, z, 0.9, 0.7, 0.9, 'metalDark'); });
      b.aabb(XA, 4.5, -6.6, XA + 3.7, 4.95, 6.6, 'cream');
      b.aabb(XA + 3.55, 4.95, -6.5, XA + 3.62, 5.85, 6.5, 'rail', { solid: false });
      b.aabb(XA + 0.15, P2, -6.2, XA + 1.6, P2 + 3.2, 6.2, 'cream', { solid: false });
      [[-5.4, -0.6], [0.6, 5.4]].forEach(([u, v]) => b.aabb(XA + 1.6, P2 + 1.6, (u + v) / 2 - 0.9, XA + 1.68, P2 + 2.2, (u + v) / 2 + 0.9, 'metalDark', { solid: false }));
    },
    spawns: [
      { x: -12, y: 8.5, z: -27.5 }, { x: 12, y: 8.5, z: 27.5 }, { x: -15, y: 8.5, z: -9 }, { x: 15, y: 8.5, z: 9 }, { x: -35.5, y: 8.5, z: -33 }, { x: 35.5, y: 8.5, z: 33 },
      { x: 0, y: 4.5, z: -19 }, { x: -6, y: 4.5, z: 19 }, { x: -15, y: 4.5, z: -28.5 }, { x: 15, y: 4.5, z: 28.5 }, { x: -20, y: 4.5, z: 0 }, { x: 23, y: 4.5, z: 0 }, { x: 41, y: 4.5, z: -14 },
      { x: -19, y: 0, z: 2.6 }, { x: 18, y: 0, z: -2.6 }, { x: 10, y: 0, z: -13.5 }, { x: -10, y: 0, z: -24 }, { x: 10, y: 0, z: 24 }, { x: 40.5, y: 0, z: 2.5 }, { x: 46.5, y: 0, z: 2.7 }, { x: 46.5, y: 0, z: -2.7 },
    ],
    teamSpawns: {
      red: [{ x: -35.5, y: 0, z: -8 }, { x: -35.5, y: 4.5, z: 6 }, { x: -35.5, y: 8.5, z: 30 }, { x: -19, y: 0, z: -2.6 }, { x: -20, y: 4.5, z: 1 }, { x: -24, y: 4.5, z: -28.5 }],
      blue: [{ x: 35.5, y: 0, z: 8 }, { x: 35.5, y: 4.5, z: -10 }, { x: 35.5, y: 8.5, z: -30 }, { x: 19, y: 0, z: 2.6 }, { x: 23, y: 4.5, z: -1 }, { x: 24, y: 4.5, z: 28.5 }],
    },
    coops: [{ x: 10, y: 0, z: -13.5, r: 3 }, { x: 0, y: 4.5, z: -16, r: 2.6 }, { x: 0, y: 4.5, z: 16, r: 2.6 }, { x: 0, y: 8.5, z: -9, r: 1.3 }, { x: -14, y: 0, z: 2.2, r: 1.8 }],
    spatula: { x: 0, y: 4.5, z: -16 },
    bases: { red: { x: -33.5, y: 4.5, z: 0, r: 1.6 }, blue: { x: 41, y: 4.5, z: 14, r: 1.6 } },
    bombSites: [{ id: 'A', x: -21.8, y: 8.5, z: 31.4, r: 1.6 }, { id: 'B', x: 10, y: 0, z: -13.5, r: 3 }],
    grenadePacks: [{ x: -10, y: 0, z: -24 }, { x: 10, y: 0, z: 24 }, { x: 10, y: 4.5, z: -28.5 }, { x: -10, y: 4.5, z: 28.5 },
      { x: -20, y: 4.5, z: -16 }, { x: 20, y: 4.5, z: 16 }, { x: 10, y: 8.5, z: -27.5 }, { x: -10, y: 8.5, z: 27.5 }],
    plan: { porch: [44.5, 48.7, 7], P1: 4.5, P2: 8.5, STX: { w: [-34.8, -32.2], e: [32.2, 34.8] }, SF: [[-17.5, -10.5, '-z', 0], [10.5, 17.5, '+z', 0], [-26.2, -19.7, '-z', 1], [-9.2, -2.7, '+z', 1], [2.7, 9.2, '-z', 1], [19.7, 26.2, '+z', 1]], MS: { x0: 35, x1: 43, z: -5.7 }, X: [-47.5, 44.5], Z: 37 },
  };


  // =========================================================================
  // 18. PUEBLO DE PRUEBAS — barrio pequeño de dos casas enfrentadas con un
  // autobús en medio de la calle (mapa pequeño y rápido, simétrico)
  // =========================================================================
  const pruebas = {
    id: 'pruebas', name: 'ÑEM4TOWN', size: 'S', players: 12,
    desc: 'ÑEM4TOWN, el barrio de pruebas de los años 50: dos casas de dos plantas una frente a otra, garajes, jardines traseros con piscina y un autobús escolar atravesado en mitad de la calle. Pequeño, simétrico y muy rápido.',
    halfSize: 26, gravity: -22, ground: 'grass', cover: false,
    theme: Object.assign({}, SKY_DAY, { sky: 0x9fd3f5, sunColor: 0xfff0c8, sun: 1.05 }),
    bombSites: [{ id: 'A', x: -7, y: 0, z: -11.5, r: 2.4 }, { id: 'B', x: 7, y: 0, z: 11.5, r: 2.4 }],
    build(b) {
      // Calle, aceras y línea central (una sola vez: son simétricas)
      b.decoAt('plane', 0, 0.02, 0, { w: 52, d: 9, color: 0x4a4d52 });
      b.decoAt('plane', 0, 0.025, -5.4, { w: 52, d: 1.8, color: 0xc9c6bd });
      b.decoAt('plane', 0, 0.025, 5.4, { w: 52, d: 1.8, color: 0xc9c6bd });
      for (let x = -24; x <= 24; x += 4) b.decoAt('plane', x, 0.03, 0, { w: 2, d: 0.18, color: 0xf2d24b });
      b.perimeter(26, 2.2, 'hedge', 0.8);

      // Autobús escolar atravesado en el centro: se puede entrar por las puertas y disparar por las ventanas
      const BUS = 'yellow';
      b.aabb(-5.2, 0, -1.35, 5.2, 0.35, 1.35, 'metalDark');                     // chasis (se pisa)
      b.wallSeg('x', -1.25, -5.2, 5.2, 0.35, 2.3, 0.2, [{ at: -3.4, w: 1.4, h: 2.0 }, { at: -0.6, y: 0.95, w: 2.2, h: 0.8 }, { at: 2.4, y: 0.95, w: 2.2, h: 0.8 }], BUS);
      b.wallSeg('x', 1.25, -5.2, 5.2, 0.35, 2.3, 0.2, [{ at: 3.4, w: 1.4, h: 2.0 }, { at: 0.6, y: 0.95, w: 2.2, h: 0.8 }, { at: -2.4, y: 0.95, w: 2.2, h: 0.8 }], BUS);
      b.wallSeg('z', -5.1, -1.15, 1.15, 0.35, 2.3, 0.2, [{ at: 0, y: 1.0, w: 1.6, h: 0.7 }], BUS);
      b.wallSeg('z', 5.1, -1.15, 1.15, 0.35, 2.3, 0.2, [{ at: 0, y: 1.0, w: 1.6, h: 0.7 }], BUS);
      b.aabb(-5.3, 2.65, -1.4, 5.3, 2.85, 1.4, BUS);                             // techo
      b.box(-5.6, 0, 0, 0.6, 1.3, 2.5, BUS);                                     // morro
      b.box(-1.5, 0.35, 0, 0.5, 0.5, 1.6, 'cBlue'); b.box(1.5, 0.35, 0, 0.5, 0.5, 1.6, 'cBlue');   // asientos
      b.box(0, 1.35, -1.36, 10.2, 0.12, 0.04, 'metalDark', { solid: false });
      b.box(0, 1.35, 1.36, 10.2, 0.12, 0.04, 'metalDark', { solid: false });

      const half = (houseMat, roofMat, carColor) => {
        // ---- Casa de dos plantas con escalera interior y azotea (amarilla en un lado, verde en el otro) ----
        b.house2(-7, -11.5, 12, 9, houseMat, { doors: ['s', 'e'], roofMat, trim: 'white', chimney: true });
        // Muebles: cocina, mesa, sofá y tele abajo; cama y armario arriba (dan cobertura dentro de la casa)
        b.aabb(-12.6, 0, -13, -11.9, 0.95, -8.6, 'counter'); b.aabb(-12.6, 0.95, -13, -11.9, 1.0, -8.6, 'worktop');
        b.box(-12.3, 0, -8.0, 0.7, 1.8, 0.7, 'appliance');                       // nevera
        b.box(-9.6, 0, -9.2, 1.4, 0.76, 0.9, 'wood'); b.decoAt('bigegg', -9.6, 0.76, -9.2, { s: 0.35, color: 0xfff1dc });
        b.box(-3.2, 0, -7.9, 2.2, 0.5, 0.8, 'red'); b.box(-3.2, 0.5, -7.6, 2.2, 0.45, 0.2, 'red');   // sofá
        b.box(-3.2, 0, -9.6, 1.4, 0.5, 0.5, 'woodDark'); b.box(-3.2, 0.5, -9.6, 1.1, 0.65, 0.1, 'metalDark', { solid: false });   // tele
        b.box(-3.4, 3.4, -9.2, 2.1, 0.55, 1.5, 'white'); b.box(-3.4, 3.95, -9.85, 2.1, 0.5, 0.2, 'woodDark', { solid: false });   // cama
        b.box(-12.2, 3.4, -9.0, 0.7, 2.0, 1.6, 'woodDark');                     // armario
        // Porche y valla baja del jardín delantero (con hueco en la puerta)
        b.fence(-14, -6.6, -8.6, -6.6, { h: 0.9, mat: 'white' });
        b.fence(-5.4, -6.6, -0.6, -6.6, { h: 0.9, mat: 'white' });
        b.box(-12, 0, -6.2, 0.35, 1.1, 0.35, 'blue');                              // buzón
        b.decoAt('bigegg', -11.5, 0, -7.4, { s: 1.1, color: 0xf7e7cf });           // maniquí de pruebas
        // ---- Garaje abierto con coche ----
        b.shed(4.5, -11, 5.4, 7, 2.9, 'roofGrey', { postMat: 'white' });
        b.decoAt('car', 4.5, 0, -11.5, { color: carColor }); b.box(4.5, 0, -11.5, 2.1, 1.5, 4.3, 'invisible');
        b.crate(2.6, 0, -14.2, 1.2); b.box(6.6, 0, -14.4, 0.9, 1.2, 0.9, 'barnRed');
        // ---- Jardín trasero: piscina, cobertizo y vallas ----
        b.fence(-20, -16.6, -14, -16.6, { h: 1.1, mat: 'wood' });
        b.fence(-20, -16.6, -20, -25, { h: 1.1, mat: 'wood' });
        b.fence(9, -16.6, 9, -25, { h: 1.1, mat: 'wood' });
        // Piscina: borde bajo (se salta) y agua poco profunda
        b.aabb(-6, 0, -22.4, 2, 0.4, -22.0, 'white'); b.aabb(-6, 0, -19.0, 2, 0.4, -18.6, 'white');
        b.aabb(-6, 0, -22.0, -5.6, 0.4, -19.0, 'white'); b.aabb(1.6, 0, -22.0, 2, 0.4, -19.0, 'white');
        b.decoAt('plane', -2, 0.05, -20.5, { w: 7.2, d: 3.0, color: 0x2e86c1 });
        b.box(-6.6, 0, -20.5, 0.6, 1.1, 0.6, 'metal');
        b.shed(-15.5, -21.5, 4, 3.6, 2.4, 'roofRed');
        b.box(-15.5, 0, -22.3, 3.6, 1.0, 1.4, 'woodDark');                         // banco de trabajo
        b.decoAt('bigegg', 5.5, 0, -21, { s: 0.9, color: 0xf3d2a8 });
        b.box(5.5, 0, -21, 1.0, 1.9, 1.0, 'invisible');
        b.tree(-22.5, -11, 1.0); b.tree(13, -22, 1.1);
        // ---- Esquina este: camión de mudanzas y contenedor ----
        b.container(17.5, 0, -3.4, true, 'cOrange');
        b.box(21.3, 0, -3.4, 1.6, 2.2, 2.4, 'white');                             // cabina
        b.box(15, 0, -10, 1.3, 1.3, 2.4, 'cGreen');                                // contenedor de basura
        b.crate(18.5, 0, -12, 1.3); b.crate(18.5, 1.3, -12, 1.0); b.crate(20, 0, -13.3, 1.2);
        b.decoAt('billboard', 19, 0, -19, { rotY: Math.PI / 4, color: 0xd35400 }); b.box(19, 0, -19, 5, 3, 0.6, 'invisible');
        // ---- Esquina oeste: jardín con setos ----
        b.box(-17, 0, -3.8, 4, 1.2, 1, 'hedge');
        b.box(-23, 0, -8, 1, 1.2, 4, 'hedge');
        b.decoAt('planter', -15, 0, -9.5, { color: 0xb8b2a4 }); b.box(-15, 0, -9.5, 1.4, 0.6, 1.4, 'invisible'); b.box(-15, 0, -9.5, 0.3, 2.2, 0.3, 'invisible');
        b.decoAt('lamp', -10, 0, -5.8); b.decoAt('lamp', 10, 0, -5.8);
      };
      half('cYellow', 'roofRed', 0x2f80c8);
      b.with({ rot: 2 }, () => half('cGreen', 'roofGrey', 0xc0392b));
    },
    spawns: [
      { x: -18, z: -12 }, { x: 18, z: 12 }, { x: -2, z: -24 }, { x: 2, z: 24 }, { x: 12, z: -19 }, { x: -12, z: 19 },
      { x: -22, z: -2 }, { x: 22, z: 2 }, { x: 8, z: -8 }, { x: -8, z: 8 }, { x: -11, z: -13 }, { x: 11, z: 13 },
    ],
    teamSpawns: {
      red: [{ x: -2, z: -24 }, { x: 4, z: -23.5 }, { x: -9, z: -23.5 }, { x: 12, z: -20 }, { x: -12, z: -19 }],
      blue: [{ x: 2, z: 24 }, { x: -4, z: 23.5 }, { x: 9, z: 23.5 }, { x: -12, z: 20 }, { x: 12, z: 19 }],
    },
    coops: [{ x: 0, y: 0.35, z: 0, r: 2 }, { x: -7, y: 0, z: -11.5, r: 2.2 }, { x: 7, y: 0, z: 11.5, r: 2.2 }, { x: 12, y: 0, z: -7.5, r: 2.2 }, { x: -12, y: 0, z: 7.5, r: 2.2 }],
    spatula: { x: 0, y: 0.35, z: 0 },
    bases: { red: { x: -2, y: 0, z: -24.2, r: 1.8 }, blue: { x: 2, y: 0, z: 24.2, r: 1.8 } },
  };

  // =========================================================================
  // 16. ÑEMANAVE — la nave de Huevo Impostor, ahora también para el FPS.
  // La geometría la construye shared/impostor.js (se carga al construir el mapa).
  // =========================================================================
  const loadImpostor = () => (typeof module === 'object' && module.exports && typeof require === 'function')
    ? require('./impostor.js') : (typeof self !== 'undefined' ? self : this).Impostor;
  const nemanave = {
    id: 'nemanave', name: 'ÑEMANAVE', size: 'L', players: 12, indoor: true,
    desc: 'La nave de Huevo Impostor: La Yema en el centro, 4 pasillos y 12 salas llenas de gallinas, nidos y hornos.',
    halfSize: 40, gravity: -22, ground: null, cover: false,
    theme: { sky: 0x03040c, fog: [14, 55], sunColor: 0xeaf2ff, sun: 0.55, amb: 0.85, hemiSky: 0xcfe0ff, hemiGround: 0x55606a, stars: true },
    build(b) { const I = loadImpostor(); if (!I) throw new Error('Falta shared/impostor.js para el mapa ÑEMANAVE'); I.nave.build(b); },
    spawns: [
      { x: 0, z: -4.5 }, { x: 0, z: 4.5 }, { x: -16.5, z: -11.5 }, { x: 18.5, z: -12 }, { x: 0, z: 16.5 }, { x: -17, z: 15.5 },
      { x: 18.5, z: 12 }, { x: 24, z: 0 }, { x: -17, z: -4.75 }, { x: -33.5, z: -2.5 }, { x: -26, z: -14.5 }, { x: -26, z: 13 },
    ],
    teamSpawns: {
      red: [{ x: -33.5, z: -2.5 }, { x: -33.5, z: 2.5 }, { x: -26, z: -14.5 }, { x: -26, z: 13 }, { x: -16.5, z: -11.5 }],
      blue: [{ x: 24, z: 0 }, { x: 24.5, z: -3 }, { x: 18.5, z: -12 }, { x: 18.5, z: 12 }, { x: 12, z: 0 }],
    },
    coops: [{ x: 0, y: 0, z: -4.5, r: 1.8 }, { x: 0, y: 0, z: -11, r: 1.4 }, { x: 0, y: 0, z: 11, r: 1.4 }, { x: 18.5, y: 0, z: 0, r: 1.4 }, { x: -25.5, y: 0, z: 0, r: 1.4 }],
    grenadePacks: [{ x: -8, z: -11 }, { x: 10, z: 11 }, { x: -14, z: 0 }, { x: 12, z: -11 }, { x: -8, z: 11 }, { x: -4.5, z: 0 }],
    spatula: { x: 4.5, y: 0, z: 0 },
    bases: { red: { x: -16.5, y: 0, z: -11.5, r: 1.8 }, blue: { x: 18.5, y: 0, z: 12, r: 1.8 } },
  };

  const LIST = [castle, dirt, feedlot, moonbase, shipyard, ruins, blue, fortflip, twotowers, medina, alpine, temple, factory, downtown, sawmill, abastos, pruebas, nemanave];
  const MAPS = {};
  LIST.forEach(m => { MAPS[m.id] = m; });
  // Alias de los ids antiguos
  const ALIASES = { fort: 'fortflip', instituto: 'abastos', ies: 'abastos', nuketown: 'pruebas', pueblo: 'pruebas', nem4town: 'pruebas', 'ñem4town': 'pruebas' };

  function resolveId(id) {
    if (MAPS[id]) return id;
    if (ALIASES[id]) return ALIASES[id];
    return 'castle';
  }

  // Construye (y cachea) los datos geométricos de un mapa
  const cache = {};
  function build(id) {
    id = resolveId(id);
    if (cache[id]) return cache[id];
    const def = MAPS[id];
    const b = new MB.Builder();
    def.build(b);
    if (def.ground && def.cover !== false) autoCover(b, def);
    b.clearDoorways();
    // Límite duro en todos los mapas: pared invisible muy alta pegada al borde (1 m de grosor).
    // Así nadie puede saltar por encima de los muros visibles ni quedarse en el hueco del borde.
    b.perimeter(def.halfSize, 80, 'invisible', 1);
    const data = {
      id, def,
      name: def.name, halfSize: def.halfSize, gravity: def.gravity,
      ground: def.ground !== null, groundMat: def.ground,
      killY: def.killY !== undefined ? def.killY : -25,
      warnings: b.warnings || [],
      boxes: b.boxes, ramps: b.ramps, ladders: b.ladders, pads: b.pads, decos: b.decos,
    };
    // Resolver la altura de cada spawn al suelo/superficie real
    const fix = s => Object.assign({}, s, { y: supportAt(data, s.x, s.z, s.y !== undefined ? s.y + 0.6 : 0.6) });
    data.spawns = def.spawns.map(fix);
    data.teamSpawns = { red: def.teamSpawns.red.map(fix), blue: def.teamSpawns.blue.map(fix) };
    data.coops = def.coops;
    data.healthPacks = def.healthPacks ? def.healthPacks.map(fix) : autoHealthPacks(data, def);
    data.grenadePacks = def.grenadePacks ? def.grenadePacks.map(fix) : autoGrenadePacks(data, def);
    data.spatula = def.spatula;
    data.bases = def.bases;
    cache[id] = data;
    return data;
  }

  // -------------------------------------------------------------------------
  // COBERTURA AUTOMÁTICA (v5): rellena las zonas abiertas con grupos de
  // coberturas del estilo del mapa. Determinista (misma semilla en servidor y
  // cliente). Nunca tapa spawns, objetivos, rampas, escaleras ni puertas.
  // -------------------------------------------------------------------------
  const COVER_KITS = {
    // Sólo piezas reconocibles (cajas, sacos, muretes, barriles, pacas): nada de bloques al azar
    // v6: en los mapas naturales también rocas (más naturales que tantas cajas sueltas)
    grass: ['crates', 'hay', 'wallLow:stoneOld', 'bags', 'rocks'],
    hedge: ['wallLow:hedge', 'crates', 'bags'],
    stone: ['wallLow:stoneOld', 'crates', 'bags', 'rocks'],
    dirt: ['hay', 'crates', 'bags', 'barrels', 'rocks'],
    hay: ['hay', 'crates'],
    sand: ['wallLow:sandstone', 'crates', 'bags', 'barrels', 'rocks'],
    snow: ['wallLow:snow', 'crates', 'bags', 'rocks'],
    rock: ['wallLow:stoneDark', 'crates', 'barrels', 'rocks'],
    stoneDark: ['wallLow:stoneDark', 'crates'],
    moon: ['crates:scifiDark', 'wallLow:scifiDark', 'barrels', 'rocks', 'rocks'],
    concrete: ['jersey', 'crates', 'barrels', 'bags'],
    asphalt: ['jersey', 'crates', 'barrels'],
    marble: ['wallLow:marble', 'crates'],
    kitchen: ['crates'],
  };
  function coverRng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function autoCover(b, def) {
    const kit = COVER_KITS[def.ground] || COVER_KITS.grass;
    const half = def.halfSize;
    const density = def.coverDensity !== undefined ? def.coverDensity : 1;
    const target = Math.round((half * half * 4) / 125 * density);
    let seed = 7; for (const ch of def.id) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    const R = coverRng(seed || 1);
    const keep = [];
    const pt = p => p && keep.push({ x: p.x, z: p.z, r: (p.r || 0) + 2.6 });
    (def.spawns || []).forEach(pt);
    ['red', 'blue'].forEach(t => (def.teamSpawns && def.teamSpawns[t] || []).forEach(pt));
    (def.coops || []).forEach(pt); pt(def.spatula);
    if (def.bases) { pt(def.bases.red); pt(def.bases.blue); }
    const decos = b.decos.filter(d => ['plane', 'water', 'crater', 'padring', 'noise', 'tiles', 'planks', 'planksV', 'brick', 'blocks', 'shingles', 'straw', 'panels', 'ribs'].indexOf(d.type) < 0);
    function free(x0, z0, x1, z1) {
      const m = 1.5;
      if (x0 < -half + 2.4 || x1 > half - 2.4 || z0 < -half + 2.4 || z1 > half - 2.4) return false;
      for (const bx of b.boxes) {
        if (bx.minY > 3.1) continue;
        if (x1 + m > bx.minX && x0 - m < bx.maxX && z1 + m > bx.minZ && z0 - m < bx.maxZ) return false;
      }
      for (const r of b.ramps) {
        const mr = 3;
        if (x1 + mr > r.minX && x0 - mr < r.maxX && z1 + mr > r.minZ && z0 - mr < r.maxZ) return false;
      }
      for (const l of b.ladders) {
        if (x1 + 2.2 > l.minX && x0 - 2.2 < l.maxX && z1 + 2.2 > l.minZ && z0 - 2.2 < l.maxZ) return false;
      }
      // Nunca delante de una puerta (2,2 m de margen)
      for (const dw of b.doorways || []) {
        if (dw.minY > 3.1) continue;
        if (x1 + 2.2 > dw.minX && x0 - 2.2 < dw.maxX && z1 + 2.2 > dw.minZ && z0 - 2.2 < dw.maxZ) return false;
      }
      for (const d of decos) {
        if (d.x > x0 - 2 && d.x < x1 + 2 && d.z > z0 - 2 && d.z < z1 + 2) return false;
      }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rr = Math.hypot(x1 - x0, z1 - z0) / 2;
      for (const k of keep) if (Math.hypot(k.x - cx, k.z - cz) < k.r + rr) return false;
      return true;
    }
    let placed = 0;
    for (let tries = 0; tries < target * 40 && placed < target; tries++) {
      const x = (R() * 2 - 1) * (half - 4), z = (R() * 2 - 1) * (half - 4);
      const piece = kit[Math.floor(R() * kit.length)];
      const [kind, matArg] = piece.split(':');
      const ax = R() < 0.5;
      // tamaño de la huella (x,z) de cada tipo
      let fw, fd;
      if (kind === 'wallLow' || kind === 'bags' || kind === 'jersey') { const L = 3 + Math.floor(R() * 2) * 1.2; fw = ax ? L : 0.9; fd = ax ? 0.9 : L; }
      else if (kind === 'logs') { fw = ax ? 4 : 1.1; fd = ax ? 1.1 : 4; }
      else if (kind === 'hay') { fw = ax ? 2.2 : 1.3; fd = ax ? 1.3 : 2.2; }
      else if (kind === 'barrels') { fw = 2; fd = 1; }
      else if (kind === 'rocks') { fw = ax ? 2.6 : 2; fd = ax ? 2 : 2.6; }
      else if (kind === 'block') { fw = 1.6 + R() * 1.2; fd = 1.4 + R() * 1.2; }
      else { fw = ax ? 2.8 : 1.4; fd = ax ? 1.4 : 2.8; } // crates
      if (!free(x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2)) continue;
      const v = R();
      switch (kind) {
        case 'wallLow': {
          const wm = matArg || 'stoneOld';
          b.box(x, 0, z, fw, 1.25, fd, wm);
          // albardilla (remate) algo más ancha: el murete se lee como un muro de verdad
          if (wm !== 'snow' && wm !== 'hedge') b.box(x, 1.25, z, fw + 0.12, 0.12, fd + 0.12, wm === 'stoneOld' ? 'stone' : wm === 'sandstone' ? 'sandstoneDk' : 'stoneDark', { solid: false });
          break;
        }
        case 'bags':
          // dos hileras de sacos: la de arriba algo más estrecha
          b.box(x, 0, z, fw, 0.6, fd, 'sandbag');
          b.box(x, 0.6, z, ax ? fw - 0.3 : 0.75, 0.5, ax ? 0.75 : fd - 0.3, 'sandbag');
          break;
        case 'jersey': b.box(x, 0, z, fw, 1.05, fd, 'jersey'); break;
        case 'logs': b.box(x, 0, z, fw, 1, fd, 'logs'); if (v < 0.5) b.box(x, 1, z, ax ? fw * 0.6 : fw, 0.8, ax ? fd : fd * 0.6, 'logs'); break;
        case 'hay': b.hay(x, 0, z, ax); if (v < 0.45) b.hay(x, 1.2, z, ax); break;
        case 'barrels':
          b.box(x - 0.5, 0, z, 0.9, 1.3, 0.9, 'invisible'); b.box(x + 0.5, 0, z, 0.9, 1.3, 0.9, 'invisible');
          b.decoAt('barrel', x - 0.5, 0, z); b.decoAt('barrel', x + 0.5, 0, z);
          break;
        case 'block': b.box(x, 0, z, fw, 1.2 + v * 0.9, fd, matArg || 'rock'); break;
        case 'rocks': {
          // una roca grande (cubre agachado) y otra pequeña al lado
          const col = { grass: 0x8a8d92, stone: 0x8a8d92, dirt: 0x8b7d6b, sand: 0xc9a46a, snow: 0x7d858c, rock: 0x5a4a42, moon: 0x7a7c86 }[def.ground] || 0x8a8d92;
          const big = 1.7 + v * 0.5, o = ax ? [0.45, 0] : [0, 0.45];
          b.rock(x - o[0], z - o[1], big, { color: col, snow: def.ground === 'snow', rotY: v * 6 });
          b.rock(x + o[0] * 2.1, z + o[1] * 2.1, 0.8 + v * 0.3, { color: col, flat: true, snow: def.ground === 'snow' });
          break;
        }
        default: {
          const m = matArg || 'crate';
          const c = ax ? [-0.7, 0] : [0, -0.7], c2 = ax ? [0.7, 0] : [0, 0.7];
          b.crate(x + c[0], 0, z + c[1], 1.4, m); b.crate(x + c2[0], 0, z + c2[1], 1.4, m);
          if (v < 0.55) b.crate(x + c[0] * 0.5, 1.4, z + c[1] * 0.5, 1.1, m);
        }
      }
      keep.push({ x, z, r: 4.2 });   // separación entre grupos: deja pasillos amplios
      placed++;
    }
  }

  // Botiquines: se eligen entre zonas abiertas (gallineros) y spawns, lo más separados posible
  function autoHealthPacks(data, def) {
    const max = { S: 3, M: 5, L: 7 }[def.size] || 5;
    const minSep = def.size === 'S' ? 7 : 10;
    const cands = def.coops.map(c => ({ x: c.x, y: c.y, z: c.z }))
      .concat(data.spawns.map(s => ({ x: s.x * 0.85, y: s.y + 0.6, z: s.z * 0.85 })));
    const out = [];
    for (const c of cands) {
      if (out.length >= max) break;
      const y = supportAt(data, c.x, c.z, c.y + 0.6);
      if (!isFinite(y) || y < -50) continue;
      if (Math.abs(c.x) > data.halfSize - 2 || Math.abs(c.z) > data.halfSize - 2) continue;
      if (blockedPack(data, c.x, y, c.z)) continue;
      if (out.some(o => Math.hypot(o.x - c.x, o.z - c.z) < minSep)) continue;
      out.push({ x: +c.x.toFixed(2), y, z: +c.z.toFixed(2) });
    }
    return out;
  }
  // Granadas en el suelo: puntos de la planta baja bien repartidos (muestreo del
  // punto más lejano), lejos de spawns y botiquines. Deterministas.
  function autoGrenadePacks(data, def) {
    const want = { S: 3, M: 6, L: 8 }[def.size] || 6;
    const H = data.halfSize - 3;
    const avoid = data.spawns.concat(data.teamSpawns.red, data.teamSpawns.blue, data.healthPacks);
    const cands = [];
    for (let x = -H; x <= H; x += 2.5) for (let z = -H; z <= H; z += 2.5) {
      const y = supportAt(data, x, z, 0.5);
      if (!isFinite(y) || y < -50 || y > 0.45) continue;
      if (blockedPack(data, x, y, z)) continue;
      // Sólo en zonas abiertas: con hueco alrededor y a cielo abierto (nada de rincones ni interiores)
      let tight = false;
      for (const bx of data.boxes) {
        if (!bx.solid || bx.maxY > 60) continue;
        const covers = x > bx.minX && x < bx.maxX && z > bx.minZ && z < bx.maxZ && bx.minY > y;
        const close = bx.minY < y + 2 && bx.maxY > y + 0.05 && x + 1.1 > bx.minX && x - 1.1 < bx.maxX && z + 1.1 > bx.minZ && z - 1.1 < bx.maxZ;
        if (covers || close) { tight = true; break; }
      }
      if (tight) continue;
      let near = false;
      for (const r of data.ramps) if (x > r.minX - 1 && x < r.maxX + 1 && z > r.minZ - 1 && z < r.maxZ + 1) { near = true; break; }
      if (near) continue;
      for (const l of data.ladders) if (x > l.minX - 1.2 && x < l.maxX + 1.2 && z > l.minZ - 1.2 && z < l.maxZ + 1.2) { near = true; break; }
      if (near) continue;
      let dmin = Infinity;
      for (const a of avoid) dmin = Math.min(dmin, Math.hypot(a.x - x, a.z - z));
      if (dmin < 4) continue;
      cands.push({ x, y, z, d: dmin });
    }
    const out = [];
    while (out.length < want && cands.length) {
      let best = 0, bestD = -1;
      for (let i = 0; i < cands.length; i++) {
        let d = cands[i].d;
        for (const o of out) d = Math.min(d, Math.hypot(o.x - cands[i].x, o.z - cands[i].z));
        if (d > bestD) { bestD = d; best = i; }
      }
      const c = cands.splice(best, 1)[0];
      out.push({ x: +c.x.toFixed(2), y: c.y, z: +c.z.toFixed(2) });
    }
    return out;
  }
  function blockedPack(data, x, y, z) {
    for (const b of data.boxes) {
      if (b.solid && y + 0.05 < b.maxY && y + 1.6 > b.minY && x + 0.45 > b.minX && x - 0.45 < b.maxX && z + 0.45 > b.minZ && z - 0.45 < b.maxZ) return true;
    }
    return false;
  }

  // Superficie más alta bajo (x,z) que esté por debajo de maxY (radio del jugador 0.4)
  function supportAt(data, x, z, maxY) {
    const R = 0.4;
    let best = data.ground ? 0 : -1000;
    for (const bx of data.boxes) {
      if (!bx.solid) continue;
      if (x + R > bx.minX && x - R < bx.maxX && z + R > bx.minZ && z - R < bx.maxZ && bx.maxY <= maxY && bx.maxY > best) best = bx.maxY;
    }
    for (const r of data.ramps) {
      if (x + R > r.minX && x - R < r.maxX && z + R > r.minZ && z - R < r.maxZ) {
        const s = MB.rampSurfaceAt(r, x, z);
        if (s <= maxY && s > best) best = s;
      }
    }
    return best;
  }

  return { LIST, MAPS, ALIASES, resolveId, build, supportAt };
});
