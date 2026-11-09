// ============================================================================
// shared/mapdefs.js — 10 mapas al estilo Shell Shockers (recreaciones propias)
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
      b.crate(-11.5, 0, -24.5, 1.1); b.box(-7.9, 0, -21, 1.6, 0.8, 1, 'woodDark');
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
      [[-14, -14], [14, -14], [-14, 14], [-22, -6], [6, 22], [-8.5, -22], [12, 12]].forEach(([x, z], i) => b.box(x, 0, z, 1.6 + (i % 3) * 0.5, 1.2 + (i % 2) * 0.6, 1.4 + (i % 2) * 0.6, 'rock'));
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
      b.crate(-6, 0, 3); b.crate(-4.6, 0, 3); b.crate(-5.3, 1.4, 3); b.crate(6, 0, 4); b.crate(3, 0, -4.8);
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
      [[12, 19], [24, 19], [14.5, 19]].forEach(([x, z]) => b.box(x, 0, z, 2.4, 1, 0.9, 'sandbag'));
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
      { x: 0, y: 2.4, z: -3 }, { x: 14, z: 0 }, { x: -14, z: 0 }, { x: 0, z: 14 }, { x: 0, z: -14 }, { x: 25, z: 4 }, { x: -20, z: 22 },
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
            open: [{ side: 'w', at: -3, w: 2.2, h: 2.6 }, { side: 'w', at: 3, w: 2.2, h: 2.6 }, { side: 'n', at: 0, w: 2.2, h: 2.6 }, { side: 's', at: 0, w: 2.2, h: 2.6 }, { side: 'e', at: 0, y: 1.1, w: 3, h: 1.2 }],
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

  const LIST = [castle, dirt, feedlot, moonbase, shipyard, ruins, blue, fortflip, twotowers, medina];
  const MAPS = {};
  LIST.forEach(m => { MAPS[m.id] = m; });
  // Alias de los ids antiguos
  const ALIASES = { fort: 'fortflip' };

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
    grass: ['crates', 'hay', 'wallLow:stoneOld', 'bags', 'logs'],
    hedge: ['wallLow:hedge', 'crates', 'wallLow:hedge'],
    stone: ['wallLow:stoneOld', 'crates', 'bags'],
    dirt: ['hay', 'crates', 'bags', 'logs', 'barrels'],
    hay: ['hay', 'hay', 'crates'],
    sand: ['wallLow:sandstone', 'crates', 'bags', 'block:sandstoneDk'],
    snow: ['wallLow:snow', 'logs', 'crates', 'block:ice'],
    rock: ['block:rock', 'block:stoneDark', 'crates'],
    stoneDark: ['block:stoneDark', 'crates'],
    moon: ['block:scifiDark', 'crates:scifiDark', 'block:rock'],
    concrete: ['jersey', 'crates', 'barrels', 'bags'],
    asphalt: ['jersey', 'crates', 'barrels'],
    marble: ['block:marble', 'wallLow:white'],
    kitchen: ['block:bookRed', 'block:bookBlue', 'block:appliance'],
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
      else if (kind === 'block') { fw = 1.6 + R() * 1.2; fd = 1.4 + R() * 1.2; }
      else { fw = ax ? 2.8 : 1.4; fd = ax ? 1.4 : 2.8; } // crates
      if (!free(x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2)) continue;
      const v = R();
      switch (kind) {
        case 'wallLow': b.box(x, 0, z, fw, 1.25, fd, matArg || 'stoneOld'); break;
        case 'bags':
          b.box(x, 0, z, fw, 1.1, fd, 'sandbag');
          break;
        case 'jersey': b.box(x, 0, z, fw, 1.05, fd, 'jersey'); break;
        case 'logs': b.box(x, 0, z, fw, 1, fd, 'logs'); if (v < 0.5) b.box(x, 1, z, ax ? fw * 0.6 : fw, 0.8, ax ? fd : fd * 0.6, 'logs'); break;
        case 'hay': b.hay(x, 0, z, ax); if (v < 0.45) b.hay(x, 1.2, z, ax); break;
        case 'barrels':
          b.box(x - 0.5, 0, z, 0.9, 1.3, 0.9, 'invisible'); b.box(x + 0.5, 0, z, 0.9, 1.3, 0.9, 'invisible');
          b.decoAt('barrel', x - 0.5, 0, z); b.decoAt('barrel', x + 0.5, 0, z);
          break;
        case 'block': b.box(x, 0, z, fw, 1.2 + v * 0.9, fd, matArg || 'rock'); break;
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
