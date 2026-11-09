// ============================================================================
// server/mapsData.js — Datos autoritativos y coordenadas de los mapas oficiales
// Coordenadas exactas, spawns seguros sobre el suelo por equipo (FFA / TDM)
// ============================================================================

const MAPS_DATA = {
  dirt: {
    id: 'dirt',
    name: 'Dirt',
    description: 'El clásico mapa de arena con contenedores apilados, rampas y campo abierto.',
    halfSize: 36,
    gravity: -24.0,
    ambientColor: 0x87ceeb,
    skyColor: 0x87ceeb,
    fogNear: 45,
    fogFar: 130,
    spawns: [
      { x: 0, y: 0.1, z: 0 },
      { x: 18, y: 0.1, z: 18 },
      { x: -18, y: 0.1, z: -18 },
      { x: 18, y: 0.1, z: -18 },
      { x: -18, y: 0.1, z: 18 },
      { x: 0, y: 4.2, z: 0 },
      { x: 22, y: 0.1, z: 0 },
      { x: -22, y: 0.1, z: 0 },
    ],
    teamSpawns: {
      red:  [{ x: -26, y: 0.1, z: 0 }, { x: -24, y: 0.1, z: 12 }, { x: -24, y: 0.1, z: -12 }],
      blue: [{ x: 26, y: 0.1, z: 0 }, { x: 24, y: 0.1, z: 12 }, { x: 24, y: 0.1, z: -12 }],
    },
  },

  space: {
    id: 'space',
    name: 'Space',
    description: 'Estación espacial en gravedad reducida, pasarelas de cristal y torres cilíndricas.',
    halfSize: 38,
    gravity: -9.8 * 0.4, // Gravedad espacial Shell Shockers (~ -3.92)
    ambientColor: 0x0a0a1a,
    skyColor: 0x0a0a1a,
    fogNear: 40,
    fogFar: 140,
    spawns: [
      { x: 0, y: 1.5, z: 0 },
      { x: 6, y: 1.5, z: 6 },
      { x: -6, y: 1.5, z: -6 },
      { x: 6, y: 1.5, z: -6 },
      { x: -6, y: 1.5, z: 6 },
      { x: -25, y: 4.0, z: 0 },
      { x: 25, y: 4.0, z: 0 },
      { x: 0, y: 5.0, z: -25 },
      { x: 0, y: 5.0, z: 25 },
    ],
    teamSpawns: {
      red:  [{ x: -25, y: 4.0, z: 0 }, { x: -22, y: 4.0, z: 4 }, { x: -22, y: 4.0, z: -4 }],
      blue: [{ x: 25, y: 4.0, z: 0 }, { x: 22, y: 4.0, z: 4 }, { x: 22, y: 4.0, z: -4 }],
    },
  },

  fort: {
    id: 'fort',
    name: 'Fort / Farm',
    description: 'Dos fuertes de madera de dos pisos enfrentados con escaleras interiores operativas.',
    halfSize: 34,
    gravity: -24.0,
    ambientColor: 0x7ea2b6,
    skyColor: 0x7ea2b6,
    fogNear: 40,
    fogFar: 120,
    spawns: [
      { x: 0, y: 0.1, z: 0 },
      { x: 0, y: 0.1, z: 12 },
      { x: 0, y: 0.1, z: -12 },
      { x: -16, y: 0.1, z: 6 },
      { x: -16, y: 0.1, z: -6 },
      { x: 16, y: 0.1, z: 6 },
      { x: 16, y: 0.1, z: -6 },
      { x: -22, y: 4.5, z: 0 },
      { x: 22, y: 4.5, z: 0 },
    ],
    teamSpawns: {
      red:  [{ x: -22, y: 0.1, z: 0 }, { x: -22, y: 4.5, z: 0 }, { x: -18, y: 0.1, z: -6 }],
      blue: [{ x: 22, y: 0.1, z: 0 }, { x: 22, y: 4.5, z: 0 }, { x: 18, y: 0.1, z: 6 }],
    },
  },

  feedlot: {
    id: 'feedlot',
    name: 'Feedlot',
    description: 'Complejo militar de bloques con rampas, puentes elevados, tuberías y escaleras mecánicas tácticas.',
    halfSize: 38,
    gravity: -24.0,
    ambientColor: 0xa8c0d0,
    skyColor: 0x8cb8d0,
    fogNear: 40,
    fogFar: 140,
    spawns: [
      { x: 0, y: 0.1, z: 0 },
      { x: 14, y: 0.1, z: 14 },
      { x: -14, y: 0.1, z: -14 },
      { x: 14, y: 0.1, z: -14 },
      { x: -14, y: 0.1, z: 14 },
      { x: 0, y: 4.5, z: 12 },
      { x: 0, y: 4.5, z: -12 },
      { x: 20, y: 0.1, z: 0 },
      { x: -20, y: 0.1, z: 0 },
    ],
    teamSpawns: {
      red:  [{ x: -24, y: 0.1, z: 0 }, { x: -22, y: 0.1, z: 10 }, { x: -22, y: 0.1, z: -10 }],
      blue: [{ x: 24, y: 0.1, z: 0 }, { x: 22, y: 0.1, z: 10 }, { x: 22, y: 0.1, z: -10 }],
    },
  },

  castle: {
    id: 'castle',
    name: 'Castle / Ruins',
    description: 'Fortaleza medieval de piedra con escalinatas monumentales, almenas, antorchas y estandartes de huevo.',
    halfSize: 36,
    gravity: -24.0,
    ambientColor: 0x95a5a6,
    skyColor: 0x7f8c8d,
    fogNear: 35,
    fogFar: 130,
    spawns: [
      { x: 0, y: 0.1, z: 0 },
      { x: 12, y: 0.1, z: 12 },
      { x: -12, y: 0.1, z: -12 },
      { x: 12, y: 0.1, z: -12 },
      { x: -12, y: 0.1, z: 12 },
      { x: 0, y: 4.0, z: 0 },
      { x: -18, y: 3.5, z: 0 },
      { x: 18, y: 3.5, z: 0 },
    ],
    teamSpawns: {
      red:  [{ x: -22, y: 0.1, z: 0 }, { x: -20, y: 0.1, z: 8 }, { x: -20, y: 3.5, z: 0 }],
      blue: [{ x: 22, y: 0.1, z: 0 }, { x: 20, y: 0.1, z: -8 }, { x: 20, y: 3.5, z: 0 }],
    },
  },
};

module.exports = { MAPS_DATA };
