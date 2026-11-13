// ============================================================================
// shared/impostor.js — Modo «Huevo Impostor» (deducción social en 1ª persona)
// Mapa propio «ÑEMANAVE», puestos de tareas, conductos, puertas y reglas.
// Compartido por servidor y cliente. NO toca los demás modos: el mapa se
// registra aparte (no está en MapDefs.LIST, así que no sale en las salas
// normales ni en la partida rápida).
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mapbuilder.js'), require('./mapdefs.js'));
  else root.Impostor = factory(root.MapBuilder, root.MapDefs);
})(typeof self !== 'undefined' ? self : this, function (MB, MapDefs) {
  'use strict';

  const H = 3.4;          // altura de las paredes (= techo)
  const T = 0.3;          // grosor de las paredes interiores
  const DOOR_H = 2.6;

  // ===========================================================================
  // NAVE YEMA — nave con forma de huevo (diseño original)
  // Salas y pasillos son rectángulos transitables; TODO lo demás dentro de la
  // caja de la nave se rellena con bloques macizos (paredes gruesas), así los
  // pasillos son túneles cerrados y nada queda abierto por error.
  // ===========================================================================
  const BOUNDS = { x0: -36, z0: -20, x1: 31, z1: 20 };
  // r = rectángulo principal (puertas y suelo); ext = trozos extra que le dan otra forma
  const ROOMS = [
    { id: 'comedor', name: 'La Yema', r: [-6, -6, 6, 6], floor: 'kitchen' },
    { id: 'laboratorio', name: 'Laboratorio', r: [-6, -19.5, 6, -14], floor: 'white' },
    { id: 'comunicaciones', name: 'Comunicaciones', r: [-21, -15, -12, -8], floor: 'blue' },
    { id: 'granero', name: 'Granero', r: [14, -16, 23, -8], ext: [[15.5, -17.5, 21.5, -16]], floor: 'hay' },
    { id: 'almacen', name: 'Almacén', r: [-6, 14, 6, 19.5], ext: [[6, 16, 10, 19.5]], floor: 'concrete' },
    { id: 'enfermeria', name: 'Enfermería', r: [-21, 14, -13, 19], floor: 'white' },
    { id: 'deposito', name: 'Depósito de agua', r: [14, 8, 23, 16], ext: [[23, 9.5, 24.5, 13.5]], floor: 'blue' },
    { id: 'puente', name: 'Navegación', r: [22, -5, 28, 5], ext: [[28, -3, 30, 3]], floor: 'wood' },
    { id: 'electricidad', name: 'Electricidad', r: [-21, -6.5, -13, -3], floor: 'scifiDark' },
    { id: 'reactor', name: 'Reactor', r: [-35, -4, -29, 4], floor: 'scifiDark' },
    { id: 'motor_n', name: 'Motor norte', r: [-35, -18, -24, -11], floor: 'metal' },
    { id: 'motor_s', name: 'Motor sur', r: [-35, 9.5, -24, 16.5], floor: 'metal' },
  ];
  // Pasillos [x0,z0,x1,z1]: 4 pasillos principales desde La Yema y desvíos a las salas
  const CORRIDORS = [
    [-1.5, -14, 1.5, -6],                                    // norte → Laboratorio
    [-12, -12.5, -1.5, -9.5], [1.5, -12.5, 14, -9.5],        //   desvíos → Comunicaciones / Granero
    [-1.5, 6, 1.5, 14],                                      // sur → Almacén
    [-24, 9.5, -1.5, 12.5], [1.5, 9.5, 14, 12.5],            //   desvíos → Motor sur / Depósito de agua
    [-17.5, 12.5, -15.5, 14],                                //     desvío → Enfermería
    [17, -8, 20, 8],                                         // pasillo de estribor: Granero ↔ Depósito (cruza el de Navegación)
    [6, -1.5, 22, 1.5],                                      // este → Navegación
    [-24, -1.5, -6, 1.5],                                    // oeste: de La Yema al pasillo de popa
    [-18.5, -3, -15.5, -1.5],                                //   desvío → Electricidad
    [-27, -11, -24, 9.5],                                    // pasillo de popa: Motor norte ↔ Motor sur
    [-29, -1.5, -27, 1.5],                                   // → Reactor
  ];
  // Ventanales (tramo de pared con cristal hacia el espacio)
  const WINDOWS = [
    { x0: 30, z0: -2.5, x1: 31, z1: 2.5, ax: 'z', y0: 0.8, y1: 2.8 },    // Navegación
    { x0: -4, z0: -20, x1: 4, z1: -19.5, ax: 'x', y0: 1.0, y1: 2.5 },    // Laboratorio
    { x0: -4, z0: 19.5, x1: 4, z1: 20, ax: 'x', y0: 1.0, y1: 2.5 },      // Almacén
  ];

  // Puertas: donde un pasillo toca el borde de una sala (se detectan solas)
  const DOORS = [];
  ROOMS.forEach(rm => {
    const [x0, z0, x1, z1] = rm.r;
    const cnt = {};
    CORRIDORS.forEach(c => {
      const [cx0, cz0, cx1, cz1] = c;
      let side = null, a, b;
      if (cx1 === x0 && cz0 < z1 && cz1 > z0) { side = 'w'; a = Math.max(cz0, z0); b = Math.min(cz1, z1); }
      else if (cx0 === x1 && cz0 < z1 && cz1 > z0) { side = 'e'; a = Math.max(cz0, z0); b = Math.min(cz1, z1); }
      else if (cz1 === z0 && cx0 < x1 && cx1 > x0) { side = 'n'; a = Math.max(cx0, x0); b = Math.min(cx1, x1); }
      else if (cz0 === z1 && cx0 < x1 && cx1 > x0) { side = 's'; a = Math.max(cx0, x0); b = Math.min(cx1, x1); }
      if (!side) return;
      cnt[side] = (cnt[side] || 0) + 1;
      const id = rm.id + '_' + side + (cnt[side] > 1 ? cnt[side] : '');
      let box;
      if (side === 'w') box = [x0 - T, a, x0, b];
      else if (side === 'e') box = [x1, a, x1 + T, b];
      else if (side === 'n') box = [a, z0 - T, b, z0];
      else box = [a, z1, b, z1 + T];
      DOORS.push({ id, room: rm.id, side, minX: box[0], minZ: box[1], maxX: box[2], maxZ: box[3], minY: 0, maxY: DOOR_H });
    });
  });

  // ---------------------------------------------------------------------------
  // Puestos de tareas: consola contra la pared y punto donde se coloca el jugador
  // type → minijuego del cliente; el servidor exige MIN_MS[type] y estar cerca
  // ---------------------------------------------------------------------------
  const STATIONS = [
    { id: 'com_basura', name: 'Tirar las cáscaras al triturador', note: 'Mantén la palanca hasta triturar todas las cáscaras.', room: 'comedor', type: 'palanca', x: 4.8, z: -5, con: [5.7, -5, 0.6, 1.2], face: 'e' },
    { id: 'com_descarga', name: 'Descargar recetas de tortilla', note: 'Descargando «Tortilla de patatas (con cebolla)»…', room: 'comedor', type: 'descarga', x: -4.8, z: 5, con: [-5.7, 5, 0.6, 1.2], face: 'w' },
    { id: 'pue_rumbo', name: 'Poner rumbo al gallinero', note: 'Lleva la nave hasta la marca del gallinero.', room: 'puente', type: 'deslizador', x: 28.6, z: -2.2, con: [29.6, -2.2, 0.8, 1.2], face: 'e' },
    { id: 'pue_subir', name: 'Subir fotos de huevos a la red', note: 'Subiendo 3.000 selfies de huevos…', room: 'puente', type: 'descarga', x: 28.6, z: 2.2, con: [29.6, 2.2, 0.8, 1.2], face: 'e' },
    { id: 'rea_arranque', name: 'Imitar a la gallina del reactor', note: 'La gallina cacarea una secuencia: repítela.', room: 'reactor', type: 'secuencia', x: -33.8, z: -3, con: [-34.7, -3, 0.6, 1.2], face: 'w' },
    { id: 'rea_valvulas', name: 'Encender las incubadoras', note: 'Enciende todas las incubadoras (que no se enfríe nadie).', room: 'reactor', type: 'interruptores', x: -33.8, z: 3, con: [-34.7, 3, 0.6, 1.2], face: 'w' },
    { id: 'mot_combustible', name: 'Repostar yema en el motor', note: 'Mantén pulsado para llenar el depósito de yema.', room: 'motor_n', type: 'mantener', x: -25.2, z: -16, con: [-24.3, -16, 0.6, 1.2], face: 'e' },
    { id: 'mot_alinear', name: 'Centrar la yema del motor', note: 'Una yema descentrada hace que la nave vaya de lado.', room: 'motor_s', type: 'deslizador', x: -25.2, z: 15.2, con: [-24.3, 15.2, 0.6, 1.2], face: 'e' },
    { id: 'lab_muestras', name: 'Comprobar si un huevo es fresco', note: 'Metiendo el huevo en agua… ¿flota o se hunde?', room: 'laboratorio', type: 'descarga', x: -5.1, z: -18.1, con: [-5.1, -19.2, 1.2, 0.6], face: 'n' },
    { id: 'lab_codigo', name: 'Abrir la nevera de huevos', note: 'Teclea la combinación de la nevera.', room: 'laboratorio', type: 'codigo', x: 5.1, z: -18.1, con: [5.1, -19.2, 1.2, 0.6], face: 'n' },
    { id: 'comu_antena', name: 'Sintonizar Radio Gallina', note: 'Fija cada aguja en la zona verde para oír el cacareo.', room: 'comunicaciones', type: 'calibrar', x: -18, z: -13.6, con: [-18, -14.7, 1.2, 0.6], face: 'n' },
    { id: 'comu_registros', name: 'Descargar cacareos de la Tierra', note: 'Recibiendo mensajes de las gallinas terrestres…', room: 'comunicaciones', type: 'descarga', x: -14.5, z: -13.6, con: [-14.5, -14.7, 1.2, 0.6], face: 'n' },
    { id: 'gra_huevos', name: 'Recoger huevos de los nidos', note: 'Coge los huevos antes de que las gallinas se sienten encima.', room: 'granero', type: 'nidos', x: 18.5, z: -16.1, con: [18.5, -17.2, 3, 0.6], face: 'n' },
    { id: 'gra_pienso', name: 'Dar de comer a las gallinas', note: 'Mantén pulsado para echar el pienso en el comedero.', room: 'granero', type: 'mantener', x: 21.6, z: -12.5, con: [22.7, -12.5, 0.6, 1.6], face: 'e' },
    { id: 'gra_gallina', name: 'Calmar a la gallina escapada', note: 'Acaricia a la gallina sólo cuando esté tranquila (zona verde).', room: 'granero', type: 'calibrar', x: 15.2, z: -14.6, con: [14.3, -14.6, 0.6, 1.2], face: 'w' },
    { id: 'ele_cables', name: 'Emparejar huevos con su huevera', note: 'Cada huevo va a la huevera de su mismo color.', room: 'electricidad', type: 'cables', x: -18.5, z: -5.1, con: [-18.5, -6.2, 1.2, 0.6], face: 'n' },
    { id: 'ele_calibrar', name: 'Ajustar la temperatura de la incubadora', note: 'Fija cada termómetro en la zona verde.', room: 'electricidad', type: 'calibrar', x: -15, z: -5.1, con: [-15, -6.2, 1.2, 0.6], face: 'n' },
    { id: 'alm_combustible', name: 'Llenar la freidora de aceite', note: 'Mantén pulsado hasta llenar la freidora.', room: 'almacen', type: 'mantener', x: -4.8, z: 18.6, con: [-5.7, 18.6, 0.6, 1.2], face: 'w' },
    { id: 'alm_basura', name: 'Vaciar el cubo de cáscaras', note: 'Mantén la palanca para vaciar el cubo.', room: 'almacen', type: 'palanca', x: 8.8, z: 18.4, con: [9.7, 18.4, 0.6, 1.2], face: 'e' },
    { id: 'enf_escaner', name: 'Escáner: ¿crudo o cocido?', note: 'Quédate quieto mientras te escanean la yema.', room: 'enfermeria', type: 'escaner', x: -14.6, z: 17.4, con: null, face: 'n' },
    { id: 'enf_datos', name: 'Código de la incubadora', note: 'Teclea el código para abrir la incubadora.', room: 'enfermeria', type: 'codigo', x: -19.8, z: 15.2, con: [-20.7, 15.2, 0.6, 1.2], face: 'w' },
    { id: 'dep_bebederos', name: 'Rellenar los bebederos', note: 'Mantén pulsado para llenar de agua los bebederos de las gallinas.', room: 'deposito', type: 'mantener', x: 16.6, z: 14.6, con: [16.6, 15.7, 1.2, 0.6], face: 's' },
    { id: 'com_fregar', name: 'Limpiar la clara derramada', note: 'Frota con el ratón hasta que no quede ni una mancha de huevo.', room: 'comedor', type: 'fregar', x: 0, z: -4.4, con: null, face: 'n' },
    { id: 'alm_docena', name: 'Empaquetar una docena', note: 'Arrastra los 12 huevos a la huevera. ¡Si los sueltas fuera, se rompen!', room: 'almacen', type: 'docena', x: -4.6, z: 15.6, con: [-5.6, 15.6, 0.8, 1.4], face: 'w' },
  ];
  const STATION = Object.create(null); STATIONS.forEach(s => { STATION[s.id] = s; });

  // Tareas de ordenador (consola con pantalla); el resto son objetos físicos
  const COMPUTER = { descarga: 1, codigo: 1 };
  const PROP_H = { docena: 0.9, palanca: 1.35, mantener: 2.2, deslizador: 1.1, secuencia: 1.6, interruptores: 1.7, calibrar: 1.2, cables: 1.0, nidos: 1.05 };
  // Contenido de cada tanque
  const TANK = { mot_combustible: 'gYolk', gra_pienso: 'straw', alm_combustible: 'gOrange', dep_bebederos: 'gBlue' };
  const MIN_MS = { fregar: 2500, docena: 3000, nidos: 2400, palanca: 2200, descarga: 6000, deslizador: 1000, secuencia: 3500, interruptores: 1200, mantener: 3200, codigo: 2200, calibrar: 2200, cables: 1800, escaner: 8000 };
  const TASK_RANGE = 2.0;      // distancia máxima al puesto (m)

  // Puestos especiales (sabotajes y reunión)
  const BUTTON = { x: 0, z: 0, r: 2.2 };                                   // botón de emergencia
  const LIGHTS_PANEL = { id: 'fix_luces', name: 'Fusibles del gallinero', x: -19.7, z: -4.75, con: [-20.7, -4.75, 0.6, 1.4], r: 2.0 };
  const REACTOR_PADS = [{ id: 'A', x: -30.3, z: -2.8, r: 1.15 }, { id: 'B', x: -30.3, z: 2.8, r: 1.15 }];
  // Sala de cámaras: el panel y las 4 cámaras (en el anillo y en los pasillos largos)
  const CAM_PANEL = { id: 'camaras', x: -3.8, z: -4.8, con: [-3.8, -5.7, 2.4, 0.6], r: 1.8 };   // en La Yema
  const CAMS = [
    { name: 'Desvío norte', x: -11.4, y: 3.0, z: -11, look: [2, -11] },
    { name: 'Desvío sur', x: 13.4, y: 3.0, z: 11, look: [-2, 11] },
    { name: 'Pasillo de popa', x: -25.5, y: 3.0, z: -10.5, look: [-25.5, 10] },
    { name: 'Hacia Navegación', x: 21.4, y: 3.0, z: 0, look: [7, 0] },
  ];
  CAMS.forEach(c => { c.yaw = Math.atan2(-(c.look[0] - c.x), -(c.look[1] - c.z)); });

  // Conductos: sólo impostores. Cada uno enlaza con los de su red
  const VENTS = [
    { id: 'v_mot_n', name: 'Motor norte', x: -26.6, z: -12.4, net: 'a' },
    { id: 'v_rea', name: 'Pasillo de popa', x: -25.5, z: 5, net: 'a' },
    { id: 'v_mot_s', name: 'Motor sur', x: -26.6, z: 12.4, net: 'a' },
    { id: 'v_comu', name: 'Comunicaciones', x: -16, z: -9, net: 'b' },
    { id: 'v_lab', name: 'Laboratorio', x: -4.6, z: -14.8, net: 'b' },
    { id: 'v_gra', name: 'Granero', x: 16.6, z: -9.2, net: 'b' },
    { id: 'v_enf', name: 'Enfermería', x: -14.2, z: 14.8, net: 'c' },
    { id: 'v_alm', name: 'Almacén', x: 4.9, z: 14.4, net: 'c' },
    { id: 'v_dep', name: 'Depósito de agua', x: 15.2, z: 8.8, net: 'c' },
    { id: 'v_com', name: 'La Yema', x: 4.6, z: 5.2, net: 'd' },
    { id: 'v_pue', name: 'Navegación', x: 23.2, z: -3.8, net: 'd' },
    { id: 'v_ele', name: 'Electricidad', x: -13.9, z: -4.2, net: 'd' },
  ];
  const VENT = Object.create(null); VENTS.forEach(v => { VENT[v.id] = v; });
  VENTS.forEach(v => { v.links = VENTS.filter(o => o.net === v.net && o.id !== v.id).map(o => o.id); });

  // Asientos alrededor de la mesa del botón (reunión y vestíbulo)
  function seat(i, n) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.PI / 2;
    return { x: +(Math.cos(a) * 2.7).toFixed(2), y: 0, z: +(Math.sin(a) * 2.7).toFixed(2), rotY: Math.atan2(Math.cos(a), Math.sin(a)) };
  }

  // Colores de los huevos (cada jugador uno distinto: así se identifican en las reuniones)
  const COLORS = [
    { name: 'Rojo', hex: '#e53935' }, { name: 'Azul', hex: '#1e5ae6' }, { name: 'Verde', hex: '#2e9d3f' },
    { name: 'Rosa', hex: '#f06ec4' }, { name: 'Naranja', hex: '#f39221' }, { name: 'Amarillo', hex: '#f5e43a' },
    { name: 'Negro', hex: '#3b434b' }, { name: 'Blanco', hex: '#e8eef4' }, { name: 'Morado', hex: '#7d3fc4' },
    { name: 'Marrón', hex: '#8a5a32' }, { name: 'Cian', hex: '#38e0e0' }, { name: 'Lima', hex: '#9be33a' },
  ];

  const RULES = {
    MAX_PLAYERS: 10, MIN_PLAYERS: 4,
    KILL_RANGE: 2.4, REPORT_RANGE: 3.2, VENT_RANGE: 1.5,
    KILL_CD: [15, 25, 35], DEF_KILL_CD: 25,
    MEETING_TIME: [60, 90, 120], DEF_MEETING_TIME: 90, DISCUSS_S: 15,
    TASKS: [3, 4, 5, 6, 7], DEF_TASKS: 5,
    EMERGENCIES: 1, BUTTON_CD_S: 15,
    SABOTAGE_CD_S: 30, DOORS_CD_S: 22, DOOR_CLOSE_S: 10, REACTOR_S: 45,
    VISION: 13, VISION_DARK: 4.2, VISION_IMPOSTOR: 17,
    START_KILL_CD_S: 12,
    SPEED_MUL: 0.72,          // en la nave se anda algo más despacio que en el FPS
  };
  function defaultImpostors(n) { return n >= 7 ? 2 : 1; }

  // ---------------------------------------------------------------------------
  // Construcción del mapa
  // ---------------------------------------------------------------------------
  function console_(b, c, scr) {
    const [x, z, w, d] = c;
    b.box(x, 0, z, w, 1.05, d, 'scifiDark');
    b.box(x, 1.05, z, w * 0.92, 0.06, d * 0.92, scr || 'cyan', { solid: false });
  }
  // Rejilla de 0,5 m: transitable = salas + pasillos; el resto, bloques macizos
  // fusionados en rectángulos grandes (pocas cajas → físicas y render rápidos)
  const CELL = 0.5;
  function wallBlocks() {
    const nx = Math.round((BOUNDS.x1 - BOUNDS.x0) / CELL), nz = Math.round((BOUNDS.z1 - BOUNDS.z0) / CELL);
    const walk = new Uint8Array(nx * nz), skip = new Uint8Array(nx * nz);
    const mark = (arr, x0, z0, x1, z1) => {
      for (let i = Math.round((x0 - BOUNDS.x0) / CELL); i < Math.round((x1 - BOUNDS.x0) / CELL); i++)
        for (let k = Math.round((z0 - BOUNDS.z0) / CELL); k < Math.round((z1 - BOUNDS.z0) / CELL); k++)
          if (i >= 0 && k >= 0 && i < nx && k < nz) arr[k * nx + i] = 1;
    };
    ROOMS.forEach(rm => { mark(walk, ...rm.r); (rm.ext || []).forEach(e => mark(walk, ...e)); });
    CORRIDORS.forEach(c => mark(walk, ...c));
    WINDOWS.forEach(w => mark(skip, w.x0, w.z0, w.x1, w.z1));
    const used = new Uint8Array(nx * nz), out = [];
    const solid = (i, k) => !walk[k * nx + i] && !skip[k * nx + i] && !used[k * nx + i];
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      if (!solid(i, k)) continue;
      let w = 1; while (i + w < nx && solid(i + w, k)) w++;
      let h = 1;
      outer: while (k + h < nz) { for (let q = 0; q < w; q++) if (!solid(i + q, k + h)) break outer; h++; }
      for (let kk = k; kk < k + h; kk++) for (let q = 0; q < w; q++) used[kk * nx + i + q] = 1;
      out.push([BOUNDS.x0 + i * CELL, BOUNDS.z0 + k * CELL, BOUNDS.x0 + (i + w) * CELL, BOUNDS.z0 + (k + h) * CELL]);
    }
    return out;
  }

  const nave = {
    id: 'nave', name: 'ÑEMANAVE', size: 'M', players: 10, hidden: true,
    desc: 'Nave con forma de huevo: La Yema en el centro, 4 pasillos con desvíos a 12 salas, cámaras y conductos.',
    halfSize: 40, gravity: -22, ground: null, cover: false,
    theme: { sky: 0x03040c, fog: [10, 40], sunColor: 0xeaf2ff, sun: 0.55, amb: 0.85, hemiSky: 0xcfe0ff, hemiGround: 0x55606a, stars: true },
    build(b) {
      b.frames = false;
      const W = BOUNDS.x1 - BOUNDS.x0, D = BOUNDS.z1 - BOUNDS.z0, CX = (BOUNDS.x0 + BOUNDS.x1) / 2, CZ = (BOUNDS.z0 + BOUNDS.z1) / 2;
      b.box(CX, -0.4, CZ, W, 0.4, D, 'metalDark');           // suelo
      b.box(CX, H, CZ, W, 0.3, D, 'scifiDark');               // techo
      for (const [x0, z0, x1, z1] of wallBlocks()) b.aabb(x0, 0, z0, x1, H, z1, 'scifi');
      // Ventanales: pared con hueco + cristal
      for (const w of WINDOWS) {
        b.aabb(w.x0, 0, w.z0, w.x1, w.y0, w.z1, 'scifi');
        b.aabb(w.x0, w.y1, w.z0, w.x1, H, w.z1, 'scifi');
        if (w.ax === 'z') b.aabb((w.x0 + w.x1) / 2 - 0.06, w.y0, w.z0, (w.x0 + w.x1) / 2 + 0.06, w.y1, w.z1, 'glass');
        else b.aabb(w.x0, w.y0, (w.z0 + w.z1) / 2 - 0.06, w.x1, w.y1, (w.z0 + w.z1) / 2 + 0.06, 'glass');
        // el hueco que queda entre el cristal y la sala, macizo a los lados
      }
      // Dinteles sobre las puertas (la hoja cerrada ocupa el hueco de debajo)
      for (const dr of DOORS) b.aabb(dr.minX, DOOR_H, dr.minZ, dr.maxX, H, dr.maxZ, 'scifi');
      // Suelo de color en cada sala
      for (const rm of ROOMS) {
        for (const [x0, z0, x1, z1] of [rm.r].concat(rm.ext || [])) b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0 - 0.1, 0.02, z1 - z0 - 0.1, rm.floor, { solid: false });
      }
      // Franjas de luz en el techo de los pasillos
      for (const [x0, z0, x1, z1] of CORRIDORS) {
        if (x1 - x0 >= z1 - z0) { const z = (z0 + z1) / 2; b.aabb(x0 + 0.3, H - 0.04, z - 0.2, x1 - 0.3, H, z + 0.2, 'cyan', { solid: false }); }
        else { const x = (x0 + x1) / 2; b.aabb(x - 0.2, H - 0.04, z0 + 0.3, x + 0.2, H, z1 - 0.3, 'cyan', { solid: false }); }
      }

      // ---- Mobiliario por sala ----
      // La Yema: mesa del botón + 4 mesas
      b.box(0, 0, 0, 2, 0.85, 2, 'steel');
      b.box(0, 0.85, 0, 0.6, 0.18, 0.6, 'red', { solid: false });
      [[-3.6, 3.6], [3.6, 3.6], [3.6, -3.6], [-3.6, -3.6]].forEach(([x, z]) => b.box(x, 0, z, 1.8, 0.78, 1.1, 'white'));
      // Navegación: sillas de piloto y consola central
      [[26, -1.4], [26, 1.4]].forEach(([x, z]) => { b.box(x, 0, z, 0.8, 0.5, 0.8, 'cBlue'); b.box(x + 0.35, 0.5, z, 0.12, 0.8, 0.8, 'cBlue', { solid: false }); });
      b.box(29.7, 0, 0, 0.6, 1.0, 1.6, 'scifiDark');
      // Reactor: núcleo
      b.box(-32, 0, 0, 2.6, 0.65, 2.6, 'metalDark');
      b.box(-32, 0.65, 0, 1.6, H - 0.65, 1.6, 'cyan');
      REACTOR_PADS.forEach(p => b.box(p.x, 0, p.z, 1.3, 0.04, 1.3, 'pad', { solid: false }));
      // Motores: bloque del motor
      b.box(-31, 0, -14.5, 5, 2.3, 3.4, 'metal');
      b.box(-31, 0, 13, 5, 2.3, 3.4, 'metal');
      // Laboratorio: banco
      b.box(0, 0, -16.6, 4, 0.9, 1, 'white');
      // Comunicaciones: armario de radios
      b.box(-19.6, 0, -9.4, 1.4, 1.8, 1.4, 'scifiDark');
      // Granero: balas de paja y comedero
      b.box(22, 0, -8.7, 1.4, 0.9, 1, 'hay'); b.box(15.2, 0, -8.7, 1.2, 0.9, 1, 'hay'); b.box(15.2, 0.9, -8.7, 1.0, 0.7, 0.9, 'hay');
      // Electricidad: armario eléctrico
      b.box(-16.8, 0, -6.1, 1.4, 2.2, 0.7, 'cYellow');
      // Almacén: cajas
      b.crate(-2.5, 0, 18, 1.8, 'crate'); b.crate(-2.5, 1.8, 18, 1.1, 'crate');
      b.crate(2, 0, 18.2, 1.4, 'crate'); b.crate(3.6, 0, 15.2, 1.2, 'crate');
      // Enfermería: camillas y escáner
      [[-19.2, 17.6], [-17.2, 17.6]].forEach(([x, z]) => b.box(x, 0, z, 1.2, 0.7, 2.2, 'white'));
      b.box(-14.6, 0, 17.4, 1.6, 0.04, 1.6, 'cyan', { solid: false });
      // La Yema: mesa de monitores de las cámaras
      console_(b, CAM_PANEL.con, 'cyan');
      // Depósito de agua: tubos (macizos, contra la pared)
      [19, 20.5, 22].forEach(x => b.box(x, 0, 15.25, 0.7, H, 0.7, 'steel'));
      // Consolas de las tareas y del panel de luces
      STATIONS.forEach(s => {
        if (!s.con) return;
        if (COMPUTER[s.type]) console_(b, s.con);
        else { const [x, z, w, d] = s.con; b.box(x, 0, z, w, PROP_H[s.type] || 1.2, d, 'invisible'); }
      });
      console_(b, LIGHTS_PANEL.con, 'pad');
      // Rejillas de los conductos (planas, sin colisión)
      VENTS.forEach(v => b.box(v.x, 0, v.z, 1.0, 0.035, 0.8, 'steel', { solid: false }));
    },
    spawns: [], teamSpawns: { red: [], blue: [] }, coops: [], healthPacks: [], grenadePacks: [],
    spatula: { x: 0, y: 0, z: 0 }, bases: { red: { x: 0, y: 0, z: 0, r: 1 }, blue: { x: 0, y: 0, z: 0, r: 1 } },
  };
  for (let i = 0; i < 10; i++) { const s = seat(i, 10); nave.spawns.push({ x: s.x, z: s.z }); }

  // Registro aparte: MapDefs.build('nave') funciona, pero no está en MapDefs.LIST
  if (MapDefs && MapDefs.MAPS) MapDefs.MAPS.nave = nave;

  // Sala en la que está un punto (para el mapa y los avisos)
  function roomAt(x, z) {
    for (const rm of ROOMS) { const [x0, z0, x1, z1] = rm.r; if (x > x0 && x < x1 && z > z0 && z < z1) return rm; }
    for (const rm of ROOMS) for (const [x0, z0, x1, z1] of rm.ext || []) if (x > x0 && x < x1 && z > z0 && z < z1) return rm;
    if (x > -27.5 && x < -23.5) return { id: 'popa', name: 'Pasillo de popa' };
    return null;
  }

  // ===========================================================================
  // DECORACIÓN DE LA NAVE (sólo visual, sin colisión): biseles techo-pared,
  // zócalos, puertas octogonales, costillas y tuberías en el techo, maquinaria
  // redonda, pantallas, paneles de luz y focos. Se genera como datos para que
  // el cliente lo fusione en muy pocas mallas (rendimiento) y los tests puedan
  // comprobarlo. Primitivas:
  //   prism {ax:'x'|'y'|'z', a0, a1, pts:[[u,v]…], m}  (polígono extruido)
  //        ax 'y' → u=x, v=z ;  ax 'x' → u=z, v=y ;  ax 'z' → u=x, v=y
  //   cyl   {ax, x, y, z, r0, r1, h, seg, m}           (cilindro/cono, base en x,y,z)
  //   glow  {x, y, z, s, c}                              (foco luminoso)
  // ===========================================================================
  const DECOR_MATS = {
    hull: { c: 0xc9d3dc }, hullDk: { c: 0x4f5a66 }, rib: { c: 0x6c7884 }, trim: { c: 0xf2c230 },
    pipe: { c: 0x9aa6b2 }, pipeRed: { c: 0xb3412f }, pipeBlue: { c: 0x3d6fa8 }, pipeYel: { c: 0xd8a72a },
    steel: { c: 0xd5dbe0 }, white: { c: 0xeef2f5 }, plank: { c: 0x9b6b3d }, red: { c: 0xd62f2f }, plant: { c: 0x3f9a3a }, plantDk: { c: 0x2d6e2a },
    engine: { c: 0x7d8894 },
    gCyan: { c: 0x5ff6ff, glow: true }, gWarm: { c: 0xfff0c8, glow: true }, gRed: { c: 0xff4a3a, glow: true },
    gScreen: { c: 0x5fb6ff, glow: true }, gGreen: { c: 0x6bff9a, glow: true }, gOrange: { c: 0xffa040, glow: true }, gTrim: { c: 0xffc640, glow: true },
    // Temática huevo: colores de cada sala
    purple: { c: 0x6a3fb0 }, purpleDk: { c: 0x3a2260 }, redDk: { c: 0x6a1f24 }, brick: { c: 0x6a3a2a }, teal: { c: 0x2f7a6e },
    pink: { c: 0xf2c6d6 }, wood: { c: 0x8a5a32 }, woodLt: { c: 0xb07a45 }, straw: { c: 0xd8b04a }, card: { c: 0xb68d5c }, cardDk: { c: 0x8d6a40 },
    egg: { c: 0xf6eedd }, eggBrown: { c: 0xd9a46a }, tan: { c: 0xd9a35a }, black: { c: 0x23252b }, blueDk: { c: 0x1f4a74 }, tarp: { c: 0x3f7a54 },
    rooster: { c: 0x6b3a1e }, hen: { c: 0xf4f0e6 }, henBrown: { c: 0xc97a3a }, beak: { c: 0xf2a428 }, wattle: { c: 0xd8262a }, eye: { c: 0x111111 }, gPurple: { c: 0xb070ff, glow: true }, gFire: { c: 0xff7a1a, glow: true }, gYolk: { c: 0xffc21a, glow: true },
    gPink: { c: 0xff7fbf, glow: true }, gBlue: { c: 0x4fb6ff, glow: true }, gLaser: { c: 0x3dff6a, glow: true },
    steelBlue: { c: 0x3c5a7a }, hullPanel: { c: 0xb4c0cc }, eggWall: { c: 0xf0e2c4 }, lilac: { c: 0xb79ad8 }, rose: { c: 0xe0a0a0 },
    sand: { c: 0xd6b48a }, skyWall: { c: 0xa8cbe6 }, mint: { c: 0xa8e0d0 }, grate: { c: 0x353a44 },
  };
  // Textura (procedural) que lleva cada material de decoración
  const TEX_OF = {
    hull: 'metal', hullDk: 'metal', rib: 'metal', steel: 'metal', engine: 'metal', pipe: 'metal', pipeRed: 'metal', pipeBlue: 'metal', pipeYel: 'metal',
    steelBlue: 'metal', hullPanel: 'panel', purpleDk: 'metal', blueDk: 'metal', black: 'metal', grate: 'grate',
    wood: 'wood', woodLt: 'wood', plank: 'wood', straw: 'straw', plant: 'straw', plantDk: 'straw', brick: 'brick',
    card: 'card', cardDk: 'card', tan: 'card', tarp: 'card', egg: 'egg', eggBrown: 'egg', white: 'egg',
    hen: 'feather', henBrown: 'feather', rooster: 'feather',
    pink: 'tile', teal: 'tile', redDk: 'panel', purple: 'panel', eggWall: 'panel', lilac: 'panel', rose: 'panel', sand: 'panel', skyWall: 'panel', mint: 'panel',
    red: 'paint', trim: 'paint', gScreen: 'screen', gBlue: 'screen',
  };
  // Tamaño de cada textura en metros (una repetición)
  const TEX_SCALE = { metal: 1.2, panel: 1.2, grate: 0.5, wood: 1.0, straw: 0.8, brick: 1.0, card: 0.6, egg: 0.25, feather: 0.3, tile: 0.8, paint: 1.5, screen: 0.6 };
  // Píxeles RGBA en gris (se multiplican por el color del material); sin canvas: vale en el cliente y en los tests
  function texturePixels(kind, N) {
    N = N || 128;
    const px = new Uint8Array(N * N * 4);
    let seed = 0; for (const ch of kind) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const noise = new Float32Array(N * N).map(() => rnd());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const n = noise[y * N + x], u = x / N, v = y / N;
      let g = 235;
      switch (kind) {
        case 'metal': {           // chapas con juntas y remaches
          const e = Math.min(u, 1 - u, v, 1 - v);
          g = 222 + n * 18 - (e < 0.02 ? 70 : 0) + (e > 0.02 && e < 0.035 ? 18 : 0);
          for (const [a, b] of [[0.07, 0.07], [0.93, 0.07], [0.07, 0.93], [0.93, 0.93], [0.5, 0.07], [0.5, 0.93]]) {
            const d = Math.hypot(u - a, v - b); if (d < 0.022) g = 255 - d * 2500; else if (d < 0.03) g -= 40;
          }
          if (Math.abs(v - 0.5) < 0.004) g -= 25;
          break;
        }
        case 'panel': { const e = Math.min(u % 0.5, 0.5 - (u % 0.5), v, 1 - v); g = 236 + n * 12 - (e < 0.012 ? 55 : 0) - (v > 0.85 ? 10 : 0); break; }
        case 'grate': { const gx = (u * 6) % 1, gy = (v * 6) % 1; g = (gx < 0.18 || gy < 0.18) ? 250 : 120 + n * 30; break; }
        case 'wood': {            // tablones con veta
          const plank = Math.floor(v * 4), off = plank * 0.37;
          g = 205 + Math.sin((u + off) * 40 + Math.sin(v * 25 + plank) * 3) * 18 + n * 20;
          if ((v * 4) % 1 < 0.05) g = 120;
          if (Math.abs(((u + off) % 1) - 0.5) < 0.006) g = 140;
          break;
        }
        case 'straw': g = 170 + n * 70 + Math.sin(u * 90 + v * 30 + n * 6) * 25; break;
        case 'brick': { const row = Math.floor(v * 6), bu = (u * 3 + (row % 2) * 0.5) % 1, bv = (v * 6) % 1; g = (bu < 0.05 || bv < 0.1) ? 250 : 175 + n * 45; break; }
        case 'card': g = 215 + Math.sin(u * 2 * Math.PI * 14) * 10 + n * 18 - (Math.abs(v - 0.5) < 0.01 ? 40 : 0); break;
        case 'egg': g = 245 - (n > 0.965 ? 70 : 0) - (n > 0.99 ? 40 : 0); break;
        case 'feather': {         // plumas en escamas
          const row = Math.floor(v * 6), fu = (u * 6 + (row % 2) * 0.5) % 1, fv = (v * 6) % 1, d = Math.hypot(fu - 0.5, fv * 1.2);
          g = d < 0.55 ? 240 - d * 60 + n * 10 : 170;
          if (Math.abs(fu - 0.5) < 0.03 && fv < 0.5) g -= 30;
          break;
        }
        case 'tile': { const tu = (u * 4) % 1, tv = (v * 4) % 1; g = (tu < 0.05 || tv < 0.05) ? 175 : 240 + n * 12; break; }
        case 'paint': g = 228 + n * 22; break;
        case 'screen': {          // pantalla con líneas y un huevo dibujado
          g = 200 + ((y % 4) < 2 ? 40 : 0);
          const d = Math.hypot((u - 0.5) * 1.2, (v - 0.55) * 0.9);
          if (Math.abs(d - 0.22) < 0.02) g = 255;
          if (u > 0.15 && u < 0.85 && Math.abs(v - 0.15) < 0.015) g = 255;
          break;
        }
      }
      const i = (y * N + x) * 4, val = Math.max(0, Math.min(255, g));
      px[i] = px[i + 1] = px[i + 2] = val; px[i + 3] = 255;
    }
    return px;
  }
  // Coordenadas de textura «de caja» (según hacia dónde mira la cara)
  function boxUV(x, y, z, nx, ny, nz, sc) {
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    if (ay >= ax && ay >= az) return [x / sc, z / sc];
    if (ax >= az) return [z / sc, y / sc];
    return [x / sc, y / sc];
  }
  // Color de las luces de pared y del techo en cada sala (los pasillos, cian)
  const ROOM_GLOW = { comedor: 'gYolk', reactor: 'gPurple', electricidad: 'gRed', motor_n: 'gFire', motor_s: 'gFire', granero: 'gYolk',
    almacen: 'gWarm', enfermeria: 'gPink', comunicaciones: 'gBlue', deposito: 'gBlue', puente: 'gWarm', laboratorio: 'gGreen' };
  const ROOM_WALL = { comedor: 'straw', reactor: 'purple', electricidad: 'redDk', motor_n: 'brick', motor_s: 'brick', granero: 'woodLt',
    almacen: 'card', enfermeria: 'pink', comunicaciones: 'blueDk', deposito: 'blueDk', puente: 'wood', laboratorio: 'teal' };
  const ROOM_UP = { comedor: 'eggWall', reactor: 'lilac', electricidad: 'rose', motor_n: 'sand', motor_s: 'sand', granero: 'eggWall',
    almacen: 'eggWall', enfermeria: 'white', comunicaciones: 'skyWall', deposito: 'skyWall', puente: 'eggWall', laboratorio: 'mint' };
  const glowAt = (x, z) => { const rm = roomAt(x, z); return (rm && ROOM_GLOW[rm.id]) || 'gCyan'; };
  let decorCache = null;
  function decor(data) {
    if (decorCache) return decorCache;
    const out = [], glows = [];
    const P = (ax, a0, a1, pts, m) => out.push({ t: 'prism', ax, a0, a1, pts, m });
    const C = (ax, x, y, z, r0, r1, h, m, seg) => out.push({ t: 'cyl', ax, x, y, z, r0, r1, h, m, seg: seg || 18 });
    const BOX = (x0, y0, z0, x1, y1, z1, m) => P('y', y0, y1, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], m);
    const G = (x, y, z, s, c) => glows.push({ x, y, z, s, c });
    const solids = data.boxes.filter(b => b.solid);
    const inSolid = (x, y, z) => solids.some(b => x > b.minX && x < b.maxX && y > b.minY && y < b.maxY && z > b.minZ && z < b.maxZ);
    // Distancia hasta la primera caja sólida en una dirección horizontal
    function ray(x, y, z, dx, dz, max) {
      let best = max;
      for (const b of solids) {
        if (y <= b.minY || y >= b.maxY) continue;
        if (dx) {
          if (z <= b.minZ || z >= b.maxZ) continue;
          const t = dx > 0 ? b.minX - x : x - b.maxX;
          if (t >= -1e-6 && t < best) best = t;
        } else {
          if (x <= b.minX || x >= b.maxX) continue;
          const t = dz > 0 ? b.minZ - z : z - b.maxZ;
          if (t >= -1e-6 && t < best) best = t;
        }
      }
      return best;
    }
    const COVE = 0.38, BASE_H = 0.22, BASE_D = 0.12;
    // 1) Biseles techo-pared y zócalos en todas las paredes altas
    for (const b of solids) {
      const lintel = b.minY >= 1.9 && b.minY < H - 0.3;          // dintel sobre una puerta: sólo bisel
      if ((b.minY > 0.05 && !lintel) || b.maxY < H - 0.05) continue;
      const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
      if (w > 50 || (w < 0.9 && d < 0.9)) continue;
      // Para cada cara: sólo el tramo que da a un espacio libre (se comprueba en el centro de la cara)
      const faces = [
        { ax: 'x', a0: b.minX, a1: b.maxX, f: b.minZ, s: -1 }, { ax: 'x', a0: b.minX, a1: b.maxX, f: b.maxZ, s: 1 },
        { ax: 'z', a0: b.minZ, a1: b.maxZ, f: b.minX, s: -1 }, { ax: 'z', a0: b.minZ, a1: b.maxZ, f: b.maxX, s: 1 },
      ];
      for (const fc of faces) {
        if (fc.a1 - fc.a0 < 0.25) continue;
        const o = fc.f + fc.s * 0.2;
        // Libre por arriba en alguno de 3 puntos de la cara (los muebles bajos no cuentan)
        const free = [0.2, 0.5, 0.8].some(k => {
          const m = fc.a0 + (fc.a1 - fc.a0) * k, px = fc.ax === 'x' ? m : o, pz = fc.ax === 'x' ? o : m;
          return Math.abs(px) < 30.7 && Math.abs(pz) < 18.7 && !inSolid(px, H - 0.5, pz);
        });
        if (!free) continue;
        const f = fc.f, s = fc.s;
        // ax 'x' → prisma extruido en X con puntos (z, y); ax 'z' → extruido en Z con puntos (x, y)
        const e = fc.ax === 'x' ? 'x' : 'z';
        const cove = [[f, H], [f + s * COVE, H], [f, H - COVE]];
        const base = [[f, 0], [f + s * BASE_D, 0], [f + s * BASE_D, BASE_H * 0.6], [f, BASE_H]];
        const glow = [[f + s * COVE * 0.98, H - 0.005], [f + s * (COVE + 0.03), H - 0.005], [f + s * 0.03, H - COVE - 0.03], [f, H - COVE - 0.03], [f, H - COVE]];
        P(e, fc.a0, fc.a1, cove, 'hull');
        if (lintel) continue;
        P(e, fc.a0, fc.a1, base, 'hullDk');
        // Zócalo de color de la sala (de 0,22 a 1,15 m) + listón luminoso encima
        for (let u0 = fc.a0; u0 < fc.a1 - 0.01; u0 += 2) {
          const u1 = Math.min(fc.a1, u0 + 2), um = (u0 + u1) / 2;
          const rm = roomAt(e === 'x' ? um : f + s * 0.6, e === 'x' ? f + s * 0.6 : um);
          const wm = rm ? ROOM_WALL[rm.id] : 'steelBlue';          // pasillos: zócalo azul acero
          const up = rm ? ROOM_UP[rm.id] : 'hullPanel';
          if (!wm) continue;
          P(e, u0, u1, [[f, BASE_H], [f + s * 0.025, BASE_H], [f + s * 0.025, 1.15], [f, 1.15]], wm);
          P(e, u0, u1, [[f, 1.15], [f + s * 0.035, 1.15], [f + s * 0.035, 1.2], [f, 1.2]], rm ? (ROOM_GLOW[rm.id] || 'gTrim') : 'gCyan');
          // banda superior de paneles con juntas verticales (aspecto de nave)
          P(e, u0, u1, [[f, 1.2], [f + s * 0.015, 1.2], [f + s * 0.015, 2.85], [f, 2.85]], up);
          for (let q = u0 + 0.6; q < u1 - 0.05; q += 1.2) P(e, q - 0.02, q + 0.02, [[f, 1.2], [f + s * 0.022, 1.2], [f + s * 0.022, 2.85], [f, 2.85]], 'hullDk');
          P(e, u0, u1, [[f, 2.0], [f + s * 0.022, 2.0], [f + s * 0.022, 2.04], [f, 2.04]], 'hullDk');
          // pilotos de estado (puntitos de colores)
          if (((u0 * 7) | 0) % 3 === 0) { const q = um; P(e, q - 0.05, q + 0.05, [[f, 2.3], [f + s * 0.03, 2.3], [f + s * 0.03, 2.38], [f, 2.38]], rm ? (ROOM_GLOW[rm.id] || 'gGreen') : 'gGreen'); }
        }
        if (fc.a1 - fc.a0 > 3) {
          for (let u = fc.a0 + 1.2; u < fc.a1 - 0.8; u += 2.4) {
            const px = e === 'x' ? u : f + s * 0.3, pz = e === 'x' ? f + s * 0.3 : u;
            if (inSolid(px, 1.2, pz) || inSolid(px, 0.3, pz)) continue;
            P(e, u - 0.16, u + 0.16, [[f, BASE_H], [f + s * 0.1, BASE_H], [f + s * 0.1, H - COVE + 0.02], [f, H - COVE + 0.1]], 'rib');
            P(e, u - 0.04, u + 0.04, [[f + s * 0.1, 1.0], [f + s * 0.11, 1.0], [f + s * 0.11, 1.8], [f + s * 0.1, 1.8]], glowAt(px + (e === 'x' ? 0 : s * 0.4), pz + (e === 'x' ? s * 0.4 : 0)));
          }
        }
        if (fc.a1 - fc.a0 > 1.5) {
          // la tira de luz se parte en tramos para tomar el color de la sala que ilumina
          for (let u0 = fc.a0 + 0.2; u0 < fc.a1 - 0.2; u0 += 2) {
            const u1 = Math.min(fc.a1 - 0.2, u0 + 2), um = (u0 + u1) / 2;
            const gx = e === 'x' ? um : f + s * 0.6, gz = e === 'x' ? f + s * 0.6 : um;
            P(e, u0, u1, [[f + s * 0.015, H - COVE - 0.06], [f + s * 0.05, H - COVE - 0.06], [f + s * 0.05, H - COVE - 0.02], [f + s * 0.015, H - COVE - 0.02]], glowAt(gx, gz));
          }
        }
        void glow;
      }
    }
    // 2) Puertas octogonales: biseles en las esquinas superiores + marco luminoso
    for (const dr of DOORS) {
      const alongX = dr.side === 'n' || dr.side === 's';
      const a = alongX ? dr.minX : dr.minZ, bb = alongX ? dr.maxX : dr.maxZ;
      const t0 = (alongX ? dr.minZ : dr.minX) - 0.07, t1 = (alongX ? dr.maxZ : dr.maxX) + 0.07;
      const ax = alongX ? 'z' : 'x', k = 0.55, top = DOOR_H;
      P(ax, t0, t1, [[a, top], [a + k, top], [a, top - k]], 'hullDk');
      P(ax, t0, t1, [[bb, top], [bb, top - k], [bb - k, top]], 'hullDk');
      // marco luminoso (dintel) a ambos lados
      [t0 - 0.02, t1].forEach(tt => P(ax, tt, tt + 0.02, [[a + k, top - 0.06], [bb - k, top - 0.06], [bb - k, top], [a + k, top]], 'gTrim'));
      // jambas oscuras
      [[a - 0.12, a], [bb, bb + 0.12]].forEach(([u0, u1]) => P(ax, t0, t1, [[u0, 0], [u1, 0], [u1, top + 0.12], [u0, top + 0.12]], 'hullDk'));
    }
    // 3) Costillas del techo cada 3 m en los pasillos (se ajustan solas a las paredes)
    const rib = (x, z, alongX) => {
      if (inSolid(x, H - 0.2, z)) return;
      if (alongX) {
        const l = Math.min(3.2, ray(x, H - 0.15, z, -1, 0, 8)), r = Math.min(3.2, ray(x, H - 0.15, z, 1, 0, 8));
        BOX(x - l, 0, z - 0.09, x + r, 0.012, z + 0.09, 'hullDk');
        P('z', z - 0.18, z + 0.18, [[x - l, H], [x + r, H], [x + r, H - 0.32], [x + r - 0.4, H - 0.42], [x - l + 0.4, H - 0.42], [x - l, H - 0.32]], 'rib');
      } else {
        const n = Math.min(3.2, ray(x, H - 0.15, z, 0, -1, 8)), s = Math.min(3.2, ray(x, H - 0.15, z, 0, 1, 8));
        BOX(x - 0.09, 0, z - n, x + 0.09, 0.012, z + s, 'hullDk');
        P('x', x - 0.18, x + 0.18, [[z - n, H], [z + s, H], [z + s, H - 0.32], [z + s - 0.4, H - 0.42], [z - n + 0.4, H - 0.42], [z - n, H - 0.32]], 'rib');
      }
    };
    for (const [x0, z0, x1, z1] of CORRIDORS) {
      if (x1 - x0 >= z1 - z0) { for (let x = x0 + 1.5; x < x1 - 1; x += 3) rib(x, (z0 + z1) / 2, false); }
      else { for (let z = z0 + 1.5; z < z1 - 1; z += 3) rib((x0 + x1) / 2, z, true); }
    }
    // 4) Tuberías por el techo de los pasillos
    const pipe = (x, z, dx, dz, y, r, m) => {
      const L = ray(x, y, z, dx, dz, 70);
      if (L < 1) return;
      C(dx ? 'x' : 'z', dx < 0 ? x - L : x, y, dz < 0 ? z - L : z, r, r, L, m, 10);
    };
    const PIPE_M = ['pipe', 'pipeRed', 'pipeBlue', 'pipeYel'];
    CORRIDORS.forEach(([x0, z0, x1, z1], k) => {
      const long = Math.max(x1 - x0, z1 - z0); if (long < 4.5) return;
      const m = PIPE_M[k % PIPE_M.length];
      if (x1 - x0 >= z1 - z0) { pipe(x0 + 0.05, z0 + 0.3, 1, 0, 2.98, 0.11, 'pipe'); pipe(x0 + 0.05, z0 + 0.62, 1, 0, 3.04, 0.07, m); }
      else { pipe(x0 + 0.3, z0 + 0.05, 0, 1, 2.98, 0.11, 'pipe'); pipe(x0 + 0.62, z0 + 0.05, 0, 1, 3.04, 0.07, m); }
    });
    // 5) Paneles de luz en el techo de cada sala
    for (const rm of ROOMS) {
      const [x0, z0, x1, z1] = rm.r;
      const nx = Math.max(1, Math.round((x1 - x0) / 4)), nz = Math.max(1, Math.round((z1 - z0) / 4));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = x0 + (i + 0.5) * (x1 - x0) / nx, z = z0 + (j + 0.5) * (z1 - z0) / nz;
        if (inSolid(x, H - 0.1, z)) continue;
        BOX(x - 0.75, H - 0.05, z - 0.35, x + 0.75, H - 0.01, z + 0.35, ROOM_GLOW[rm.id] === 'gCyan' ? 'gWarm' : (ROOM_GLOW[rm.id] || 'gWarm'));
        BOX(x - 0.85, H - 0.03, z - 0.45, x + 0.85, H - 0.005, z + 0.45, 'hullDk');
        G(x, H - 0.25, z, 2.4, 0xfff0c8);
      }
    }
    // 6) Maquinaria redonda (cubre las cajas de colisión: siempre por fuera de ellas)
    // Reactor = CALDERA: olla negra con caldo verde que brilla, cúpula de cristal y fuego debajo
    const RX = -32;
    C('y', RX, 0, 0, 1.9, 1.7, 0.67, 'black', 24);
    C('y', RX, 0.65, 0, 1.3, 1.42, 1.55, 'black', 28);
    C('y', RX, 2.15, 0, 1.45, 1.45, 0.1, 'purpleDk', 28);
    C('y', RX, 2.22, 0, 1.25, 1.25, 0.04, 'gGreen', 28);
    C('y', RX, 2.26, 0, 1.0, 0.35, 0.8, 'gGreen', 24);
    C('y', RX, 3.0, 0, 0.18, 0.18, H - 3.0, 'purple', 10);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; C('y', RX + Math.cos(a) * 1.55, 0.0, Math.sin(a) * 1.55, 0.18, 0.0, 0.45 + (i % 3) * 0.15, i % 2 ? 'gFire' : 'gYolk', 6); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; C('y', RX + Math.cos(a) * 0.55, 2.4 + (i % 3) * 0.12, Math.sin(a) * 0.55, 0.07, 0.07, 0.1, 'white', 6); }
    G(RX, 1.8, 0, 8, 0xb070ff); G(RX, 2.4, 0, 4, 0x6bff9a); G(RX, 0.3, 0, 3.5, 0xff7a1a);
    // cruces rojas en las paredes (paneles de emergencia)
    [[-33.6, -3.97], [-30.4, -3.97], [-33.6, 3.92], [-30.4, 3.92]].forEach(([x, z]) => { BOX(x - 0.35, 1.5, z, x + 0.35, 2.2, z + 0.05, 'white'); BOX(x - 0.25, 1.78, z - 0.01, x + 0.25, 1.92, z + 0.06, 'red'); BOX(x - 0.07, 1.6, z - 0.01, x + 0.07, 2.1, z + 0.06, 'red'); });
    // Motores: gran motor cilíndrico con la tobera hacia la popa
    [-14.5, 13].forEach(z => {
      BOX(-33.52, 0, z - 1.72, -28.48, 1.2, z + 1.72, 'hullDk');
      C('x', -33.6, 1.7, z, 1.8, 1.8, 5.2, 'engine', 28);
      C('x', -33.9, 1.7, z, 1.35, 1.6, 0.3, 'hullDk', 24);
      C('x', -34.0, 1.7, z, 1.1, 1.1, 0.12, 'gOrange', 24);
      [-32.4, -31, -29.6].forEach(x => C('x', x, 1.7, z, 1.9, 1.9, 0.18, 'hullDk', 28));
      G(-34.2, 1.7, z, 5, 0xffa040);
      C('x', -28.42, 1.7, z, 1.15, 1.15, 0.06, 'gFire', 24);          // boca del horno encendida
      C('x', -28.36, 1.7, z, 0.75, 0.75, 0.04, 'gYolk', 20);
      G(-27.9, 1.7, z, 4.5, 0xff7a1a);
      [-0.6, 0, 0.6].forEach(dz => BOX(-28.38, 1.0, z + dz - 0.05, -28.3, 2.4, z + dz + 0.05, 'black'));  // rejilla
    });
    // La Yema: mesa redonda con el botón, mesas redondas y la «yema» del techo
    C('y', 0, 0, 0, 1.45, 1.45, 0.9, 'steel', 28);
    C('y', 0, 0.86, 0, 1.5, 1.5, 0.07, 'black', 32);
    C('y', 0, 0.93, 0, 1.5, 1.5, 0.08, 'black', 32); C('y', 0, 0.93, 0, 1.38, 1.38, 0.085, 'steel', 32);
    BOX(1.4, 0.88, -0.09, 3.2, 0.95, 0.09, 'black');
    C('y', 0.1, 0.99, 0.05, 0.95, 0.85, 0.04, 'egg', 24);
    C('y', 0, 1.02, 0, 0.46, 0.3, 0.2, 'gYolk', 20);
    G(0, 1.2, 0, 2.6, 0xffc21a);
    [[-3.6, 3.6], [3.6, 3.6], [3.6, -3.6], [-3.6, -3.6]].forEach(([x, z], k) => {
      C('y', x, 0.74, z, 1.1, 1.1, 0.06, 'blueDk', 24); C('y', x, 0, z, 0.25, 0.25, 0.74, 'hullDk', 10);
      BOX(x - 0.45, 0.8, z - 0.2, x - 0.05, 0.84, z + 0.15, 'tan'); BOX(x + 0.05, 0.8, z - 0.15, x + 0.45, 0.84, z + 0.2, 'tan');   // tostadas
      C('y', x + 0.1, 0.8, z + 0.45, 0.13, 0.11, 0.18, k % 2 ? 'eggBrown' : 'egg', 10);                                         // huevo en su huevera
    });
    C('y', 0, H - 0.06, 0, 3.0, 3.0, 0.04, 'hullDk', 40); C('y', 0, H - 0.1, 0, 2.6, 2.6, 0.035, 'gYolk', 40);
    G(0, H - 0.5, 0, 6, 0xffd23e);
    // Laboratorio: tubos de ensayo luminosos
    [-1.6, -0.8, 0, 0.8, 1.6].forEach((x, i) => C('y', x, 0.9, -16.6, 0.12, 0.12, 0.42 + (i % 2) * 0.14, i % 2 ? 'gGreen' : 'gCyan', 10));
    // Comunicaciones: antena parabólica sobre el armario
    C('y', -19.6, 1.8, -9.4, 0.06, 0.06, 0.6, 'steel', 6); C('y', -19.6, 2.35, -9.4, 0.1, 0.7, 0.28, 'steel', 20);
    G(-19.6, 2.5, -9.4, 1.2, 0x5fb6ff);
    // Granero: nidos con huevos sobre la repisa y gallinas sueltas
    for (let i = 0; i < 4; i++) {
      const nx = 17.4 + i * 0.75;
      C('y', nx, 1.05, -17.2, 0.32, 0.26, 0.14, 'plank', 12);
      C('y', nx - 0.06, 1.12, -17.2, 0.07, 0.05, 0.13, 'white', 8); C('y', nx + 0.08, 1.12, -17.15, 0.07, 0.05, 0.12, 'white', 8);
    }
    // Gallina: patas, cuerpo de plumas, alas, cola, cabeza, cresta, pico, barbilla y ojos
    const hen = (x, z, a, y0, brown) => {
      y0 = y0 || 0; const m = brown ? 'henBrown' : 'hen';
      const fx = Math.sin(a), fz = Math.cos(a), sx = Math.cos(a), sz = -Math.sin(a);
      [-0.07, 0.07].forEach(o => C('y', x + sx * o, y0, z + sz * o, 0.025, 0.025, 0.14, 'beak', 5));
      C('y', x, y0 + 0.14, z, 0.2, 0.25, 0.16, m, 12); C('y', x, y0 + 0.3, z, 0.25, 0.18, 0.18, m, 12);
      [-1, 1].forEach(sd => C('y', x + sx * sd * 0.2 - fx * 0.03, y0 + 0.22, z + sz * sd * 0.2 - fz * 0.03, 0.09, 0.06, 0.2, m, 8));
      C('y', x - fx * 0.22, y0 + 0.3, z - fz * 0.22, 0.1, 0.03, 0.28, m, 8);
      C('y', x + fx * 0.14, y0 + 0.44, z + fz * 0.14, 0.1, 0.09, 0.18, m, 10);
      C('y', x + fx * 0.12, y0 + 0.6, z + fz * 0.12, 0.05, 0.015, 0.09, 'wattle', 6); C('y', x + fx * 0.17, y0 + 0.59, z + fz * 0.17, 0.045, 0.015, 0.07, 'wattle', 6);
      C('y', x + fx * 0.25, y0 + 0.48, z + fz * 0.25, 0.035, 0.0, 0.06, 'beak', 6);
      C('y', x + fx * 0.23, y0 + 0.41, z + fz * 0.23, 0.03, 0.01, 0.06, 'wattle', 6);
      [-1, 1].forEach(sd => C('y', x + fx * 0.2 + sx * sd * 0.07, y0 + 0.5, z + fz * 0.2 + sz * sd * 0.07, 0.022, 0.022, 0.03, 'eye', 6));
    };
    hen(17.5, -13.2, 1.2); hen(19.8, -10.6, -2.2, 0, true); hen(20.4, -14.6, 0.4); hen(16.2, -10.4, 2.6, 0, true);
    for (let i = 0; i < 4; i++) hen(17.4 + i * 0.75, -17.35, 0.0, 1.1, i % 2);    // gallinas empollando en los nidos
    // Granero: comedero
    G(18.5, 2.4, -12, 3, 0xfff0c8);
    // Electricidad: mazos de cables hasta el techo
    [[-17.3, -6.2, 'pipeRed'], [-16.8, -6.2, 'pipeYel'], [-16.3, -6.2, 'pipeBlue']].forEach(([x, z, m]) => C('y', x, 2.2, z, 0.06, 0.06, H - 2.2, m, 6));
    // Enfermería: anillos del escáner
    C('y', -14.6, 0.05, 17.4, 0.85, 0.85, 0.05, 'gCyan', 24); C('y', -14.6, 2.45, 17.4, 0.85, 0.85, 0.08, 'gCyan', 24);
    G(-14.6, 1.3, 17.4, 2.5, 0x5ff6ff);
    // La Yema: pantallas de las cámaras sobre la mesa de monitores
    for (let k = 0; k < 3; k++) { const xx = -4.8 + k * 1.0; BOX(xx - 0.45, 1.2, -5.98, xx + 0.45, 1.85, -5.88, 'hullDk'); BOX(xx - 0.4, 1.26, -5.88, xx + 0.4, 1.8, -5.84, 'gScreen'); }
    // Depósito de agua: tubos de cristal luminosos con agua
    [19, 20.5, 22].forEach(x => { C('y', x, 0, 15.25, 0.52, 0.52, H, 'hullDk', 14); C('y', x, 0.3, 15.25, 0.55, 0.55, 2.6, 'gCyan', 14); G(x, 1.6, 14.9, 2.2, 0x4fb6ff); });
    CAMS.forEach(c => { C('y', c.x, c.y + 0.1, c.z, 0.12, 0.12, 0.3, 'hullDk', 8); C('y', c.x, c.y, c.z, 0.16, 0.16, 0.12, 'gRed', 10); });
    // Navegación: montantes del ventanal y salpicadero inclinado
    [-2.45, -0.8, 0.8, 2.45].forEach(z => BOX(30.0, 0.75, z - 0.08, 30.4, 2.85, z + 0.08, 'hullDk'));
    P('z', -0.8, 0.8, [[29.4, 1.0], [30.0, 1.0], [30.0, 1.25], [29.25, 1.08]], 'hullDk');
    P('z', -0.7, 0.7, [[29.42, 1.09], [29.9, 1.24], [29.92, 1.255], [29.4, 1.1]], 'gScreen');
    // Marcos de los ventanales del laboratorio y el almacén
    [-19.5, 19.5].forEach(z => [-4, -1.35, 1.35, 4].forEach(x => BOX(x - 0.08, 0.95, Math.min(z, z + (z > 0 ? 0.4 : -0.4)), x + 0.08, 2.55, Math.max(z, z + (z > 0 ? 0.4 : -0.4)), 'hullDk')));
    // Suelo de los pasillos: rejilla oscura central con bordes amarillos
    for (const [x0, z0, x1, z1] of CORRIDORS) {
      if (x1 - x0 >= z1 - z0) {
        const zm = (z0 + z1) / 2;
        BOX(x0 + 0.1, 0.021, zm - 0.65, x1 - 0.1, 0.026, zm + 0.65, 'grate');
        for (let x = x0 + 0.4; x < x1 - 0.2; x += 0.5) BOX(x, 0.026, zm - 0.6, x + 0.06, 0.03, zm + 0.6, 'black');
        BOX(x0 + 0.1, 0.026, zm - 0.72, x1 - 0.1, 0.03, zm - 0.65, 'trim'); BOX(x0 + 0.1, 0.026, zm + 0.65, x1 - 0.1, 0.03, zm + 0.72, 'trim');
      } else {
        const xm = (x0 + x1) / 2;
        BOX(xm - 0.65, 0.021, z0 + 0.1, xm + 0.65, 0.026, z1 - 0.1, 'grate');
        for (let z = z0 + 0.4; z < z1 - 0.2; z += 0.5) BOX(xm - 0.6, 0.026, z, xm + 0.6, 0.03, z + 0.06, 'black');
        BOX(xm - 0.72, 0.026, z0 + 0.1, xm - 0.65, 0.03, z1 - 0.1, 'trim'); BOX(xm + 0.65, 0.026, z0 + 0.1, xm + 0.72, 0.03, z1 - 0.1, 'trim');
      }
    }
    // Manchas de clara y yema en el suelo de La Yema (tarea «Limpiar la clara»)
    [[0, -4.4, 0.7], [0.8, -4.0, 0.4], [-0.6, -4.9, 0.35]].forEach(([x, z, r], k) => { C('y', x, 0.03, z, r, r * 0.9, 0.012, 'egg', 14); if (k === 0) C('y', x + 0.1, 0.04, z, 0.18, 0.16, 0.03, 'gYolk', 12); });
    // 8) AMBIENTACIÓN HUEVUNA DE CADA SALA
    const tint = (id, m) => { const rm = ROOMS.find(r => r.id === id); [rm.r].concat(rm.ext || []).forEach(([x0, z0, x1, z1]) => BOX(x0 + 0.12, 0.021, z0 + 0.12, x1 - 0.12, 0.026, z1 - 0.12, m)); };
    tint('reactor', 'purpleDk'); tint('electricidad', 'redDk'); tint('motor_n', 'brick'); tint('motor_s', 'brick');
    tint('enfermeria', 'pink'); tint('laboratorio', 'teal'); tint('deposito', 'blueDk'); tint('puente', 'wood');
    const egg = (x, y, z, m, sc) => { sc = sc || 1; C('y', x, y, z, 0.11 * sc, 0.13 * sc, 0.12 * sc, m, 10); C('y', x, y + 0.12 * sc, z, 0.13 * sc, 0.03 * sc, 0.1 * sc, m, 10); };
    // Electricidad = INCUBADORA TÉRMICA: lámparas infrarrojas, franja de peligro y huevos al calor
    [-19.5, -17, -14.5].forEach(x => { BOX(x - 0.5, H - 0.12, -5.1, x + 0.5, H - 0.04, -4.5, 'black'); BOX(x - 0.4, H - 0.16, -5.0, x + 0.4, H - 0.12, -4.6, 'gRed'); G(x, H - 0.6, -4.8, 4, 0xff2a2a); });
    for (let k = 0; k < 10; k++) BOX(-18.5 + k * 0.3, 0.026, -3.25, -18.35 + k * 0.3, 0.03, -3.05, k % 2 ? 'black' : 'trim');
    for (let k = 0; k < 5; k++) egg(-17.3 + k * 0.25, 2.2, -6.1, k % 2 ? 'eggBrown' : 'egg');
    // Granero: huevos de energía que brillan en los nidos, valla baja y paja
    for (let i = 0; i < 4; i++) egg(17.4 + i * 0.75, 1.13, -17.2, 'gYolk', 1.1);
    G(18.5, 1.4, -17.2, 4, 0xffc21a);
    BOX(22.6, 0, -15.7, 22.75, 0.85, -14.3, 'woodLt'); BOX(14.25, 0, -12.9, 14.4, 0.85, -12.6, 'woodLt');
    [[16.2, -12.5], [20.6, -10.2], [17.6, -9.2]].forEach(([x, z]) => C('y', x, 0.026, z, 0.7, 0.55, 0.05, 'straw', 9));
    // Almacén = EL CARTÓN: hueveras con huevos encima de las cajas y una lona verde
    [[-2.5, 2.9, 18], [2, 1.4, 18.2], [3.6, 1.2, 15.2]].forEach(([x, y, z]) => { for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) egg(x - 0.3 + a * 0.3, y, z - 0.15 + b * 0.3, (a + b) % 2 ? 'eggBrown' : 'egg', 0.9); });
    BOX(-1.4, 0, 15.6, 0.6, 0.55, 16.9, 'tarp'); BOX(-1.2, 0.55, 15.8, 0.3, 0.8, 16.7, 'tarp');
    // Enfermería: camillas rosas, cruces y el láser del escáner de frescura
    [[-19.2, 17.6], [-17.2, 17.6]].forEach(([x, z]) => { BOX(x - 0.58, 0.7, z - 1.08, x + 0.58, 0.76, z + 1.08, 'pink'); BOX(x - 0.5, 0.76, z + 0.55, x + 0.5, 0.86, z + 1.0, 'white'); });
    [[-20.97, 17.2], [-20.97, 18.4]].forEach(([x, z]) => { BOX(x, 1.5, z - 0.3, x + 0.05, 2.1, z + 0.3, 'white'); BOX(x - 0.01, 1.73, z - 0.22, x + 0.06, 1.87, z + 0.22, 'red'); BOX(x - 0.01, 1.58, z - 0.07, x + 0.06, 2.02, z + 0.07, 'red'); });
    BOX(-14.62, 0.05, 17.38, -14.58, 2.45, 17.42, 'gLaser'); G(-14.6, 1.3, 17.4, 3, 0x3dff6a);
    // Comunicaciones = central de cacareo: gallina-radio sobre el armario y ondas en la pared
    hen(-19.6, -9.4, 0.8, 1.8);
    [0.35, 0.6, 0.85].forEach((r, k) => C('y', -12.6, 1.6 + k * 0.4, -10.5, r * 0.25, r * 0.25, 0.02, 'gBlue', 16));
    // Depósito de agua = duchas: burbujas dentro de los tubos
    [19, 20.5, 22].forEach(x => { for (let k = 0; k < 4; k++) C('y', x + ((k % 2) - 0.5) * 0.2, 0.5 + k * 0.55, 15.25, 0.08, 0.08, 0.12, 'white', 8); });
    // Navegación: el gallo piloto sentado en su silla
    const rooster = (x, y, z) => {
      C('y', x, y, z, 0.32, 0.26, 0.55, 'rooster', 12);
      C('y', x, y + 0.55, z, 0.2, 0.16, 0.25, 'rooster', 10);
      C('y', x - 0.12, y + 0.82, z, 0.05, 0.02, 0.18, 'red', 6); C('y', x - 0.04, y + 0.8, z, 0.05, 0.02, 0.14, 'red', 6);
      C('x', x - 0.22, y + 0.65, z, 0.05, 0.0, 0.14, 'pipeYel', 6);
      C('y', x - 0.18, y + 0.5, z, 0.05, 0.03, 0.12, 'red', 6);
      P('z', z - 0.04, z + 0.04, [[x + 0.2, y + 0.3], [x + 0.6, y + 0.9], [x + 0.45, y + 0.25]], 'black');
      P('z', z - 0.04, z + 0.04, [[x + 0.15, y + 0.2], [x + 0.55, y + 0.6], [x + 0.5, y + 0.15]], 'plantDk');
    };
    rooster(26, 0.5, -1.4);
    // Laboratorio: huevos dentro de las probetas
    [-1.6, -0.8, 0, 0.8, 1.6].forEach((x, i) => egg(x, 1.02, -16.6, i % 2 ? 'eggBrown' : 'egg', 0.7));

    // 7) Pantallas en todas las consolas de tareas
    const screenOn = (cx, cz, w, d, face, m) => {
      // face: lado de la pared (n → la consola mira al sur)
      const half = (face === 'n' || face === 's') ? w / 2 : d / 2;
      if (face === 'n' || face === 's') {
        const zb = face === 'n' ? cz - d / 2 : cz + d / 2, sz = face === 'n' ? 1 : -1;
        BOX(cx - half, 1.05, Math.min(zb, zb + sz * 0.1), cx + half, 1.75, Math.max(zb, zb + sz * 0.1), 'hullDk');
        BOX(cx - half + 0.08, 1.15, Math.min(zb + sz * 0.1, zb + sz * 0.115), cx + half - 0.08, 1.66, Math.max(zb + sz * 0.1, zb + sz * 0.115), m);
      } else {
        const xb = face === 'w' ? cx - w / 2 : cx + w / 2, sx = face === 'w' ? 1 : -1;
        BOX(Math.min(xb, xb + sx * 0.1), 1.05, cz - half, Math.max(xb, xb + sx * 0.1), 1.75, cz + half, 'hullDk');
        BOX(Math.min(xb + sx * 0.1, xb + sx * 0.115), 1.15, cz - half + 0.08, Math.max(xb + sx * 0.1, xb + sx * 0.115), 1.66, cz + half - 0.08, m);
      }
    };
    STATIONS.forEach(s => { if (s.con && COMPUTER[s.type]) screenOn(s.con[0], s.con[1], s.con[2], s.con[3], s.face, 'gScreen'); });
    // Objetos físicos de cada tarea (orientados hacia el jugador)
    STATIONS.forEach(st => {
      if (!st.con || COMPUTER[st.type] || st.type === 'nidos') return;
      const [cx, cz, cw, cd] = st.con, f = st.face;
      const alongX = f === 'n' || f === 's';
      const half = (alongX ? cw : cd) / 2, depth = alongX ? cd : cw;
      const sgn = (f === 'n' || f === 'w') ? 1 : -1;                        // hacia el jugador
      const back = alongX ? cz - sgn * cd / 2 : cx - sgn * cw / 2;          // borde contra la pared
      // caja en coordenadas locales: a = a lo largo de la pared, o = desde la pared hacia el jugador
      const L = (a0, a1, o0, o1, y0, y1, m) => {
        const p0 = back + sgn * o0, p1 = back + sgn * o1;
        if (alongX) BOX(cx + a0, y0, Math.min(p0, p1), cx + a1, y1, Math.max(p0, p1), m);
        else BOX(Math.min(p0, p1), y0, cz + a0, Math.max(p0, p1), y1, cz + a1, m);
      };
      const W = (a, o) => alongX ? [cx + a, back + sgn * o] : [back + sgn * o, cz + a];
      const CY = (a, o, y, r0, r1, h, m, seg) => { const [x, z] = W(a, o); C('y', x, y, z, r0, r1, h, m, seg || 16); };
      // disco que mira al jugador (dial, timón)
      const DISC = (a, y, o, r, th, m, seg) => {
        const [x, z] = W(a, o);
        if (alongX) C('z', x, y, sgn > 0 ? z : z - th, r, r, th, m, seg || 24);
        else C('x', sgn > 0 ? x : x - th, y, z, r, r, th, m, seg || 24);
      };
      const H0 = PROP_H[st.type] || 1.2;
      switch (st.type) {
        case 'palanca': {                       // trituradora de cáscaras
          L(-half, half, 0, depth, 0, 1.15, 'steel');
          L(-half, half, 0, depth, 1.15, 1.35, 'purpleDk');
          L(-half + 0.08, half - 0.08, depth - 0.02, depth, 0.15, 0.3, 'trim');
          for (let k = 0; k < 4; k++) L(-half + 0.1 + k * (2 * half - 0.2) / 4, -half + 0.1 + k * (2 * half - 0.2) / 4 + (2 * half - 0.2) / 8, depth, depth + 0.012, 0.15, 0.3, 'black');
          L(-0.12, 0.12, depth, depth + 0.18, 0.9, 1.0, 'black');
          CY(0, depth + 0.16, 1.0, 0.04, 0.04, 0.45, 'steel', 6); CY(0, depth + 0.16, 1.45, 0.09, 0.09, 0.1, 'red', 10);
          for (let k = 0; k < 3; k++) CY(-half * 0.5 + k * half * 0.5, depth * 0.5, 1.35, 0.08, 0.06, 0.1, k % 2 ? 'eggBrown' : 'egg', 8);
          L(-half + 0.1, -half + 0.3, depth - 0.01, depth + 0.005, 0.95, 1.05, 'gGreen');
          break;
        }
        case 'mantener': {                      // tanque de cristal con yema, aceite, agua o pienso
          const r = Math.min(half, depth / 2) * 0.96, m = TANK[st.id] || 'gYolk';
          CY(0, depth / 2, 0, r, r, 0.2, 'hullDk', 18); CY(0, depth / 2, 2.0, r, r, 0.2, 'hullDk', 18);
          CY(0, depth / 2, 0.2, r * 0.9, r * 0.9, 1.4, m, 18);
          CY(0, depth / 2, 1.6, r * 0.9, r * 0.9, 0.4, 'blueDk', 18);
          for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; CY(Math.cos(a) * r * 0.97, depth / 2 + Math.sin(a) * r * 0.97, 0.2, 0.035, 0.035, 1.8, 'steel', 6); }
          CY(0, depth / 2, 2.2, 0.08, 0.08, H - 2.2, 'pipe', 8);
          L(-0.1, 0.1, depth - 0.02, depth + 0.12, 0.7, 0.8, 'red');
          break;
        }
        case 'deslizador': {                    // timón / palanca de rumbo
          L(-half, half, 0, depth, 0, 0.85, 'hullDk');
          L(-half, half, 0, depth * 0.5, 0.85, 1.1, 'blueDk');
          DISC(0, 1.35, depth * 0.55, 0.42, 0.06, 'woodLt', 20);
          DISC(0, 1.35, depth * 0.55 - 0.01, 0.32, 0.08, 'hullDk', 20);
          DISC(0, 1.35, depth * 0.55 + 0.02, 0.1, 0.08, 'gYolk', 12);
          for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, [x, z] = W(Math.cos(a) * 0.47, depth * 0.58); C('y', x, 1.35 + Math.sin(a) * 0.47 - 0.06, z, 0.04, 0.04, 0.12, 'wood', 6); }
          L(-half + 0.08, -half + 0.28, depth - 0.01, depth + 0.005, 0.5, 0.7, 'gBlue');
          break;
        }
        case 'secuencia': {                     // gallina mecánica que cacarea
          L(-half, half, 0, depth, 0, 0.9, 'purpleDk');
          CY(0, depth / 2, 0.9, Math.min(half, depth / 2) * 0.9, Math.min(half, depth / 2) * 0.75, 0.55, 'steel', 14);
          CY(0, depth / 2, 1.45, 0.2, 0.15, 0.3, 'steel', 12);
          CY(0, depth / 2, 1.75, 0.07, 0.02, 0.14, 'red', 6); CY(0.08, depth / 2, 1.72, 0.06, 0.02, 0.12, 'red', 6);
          { const [x, z] = W(0, depth / 2 + 0.2 * 1); C(alongX ? 'z' : 'x', alongX ? x : (sgn > 0 ? x : x - 0.18), 1.58, alongX ? (sgn > 0 ? z : z - 0.18) : z, 0.06, 0.0, 0.18, 'pipeYel', 6); }
          for (let k = 0; k < 4; k++) L(-0.36 + k * 0.2, -0.24 + k * 0.2, depth - 0.01, depth + 0.006, 0.55, 0.75, ['gRed', 'gGreen', 'gBlue', 'gYolk'][k]);
          break;
        }
        case 'interruptores': {                 // incubadora con huevos y fila de interruptores
          L(-half, half, 0, depth, 0, 0.6, 'hullDk');
          L(-half, half, 0, depth, 0.6, 0.66, 'steel');
          L(-half, half, 0, depth * 0.85, 0.66, 1.55, 'gRed');
          L(-half - 0.01, half + 0.01, depth * 0.85, depth * 0.86, 0.66, 1.55, 'hullDk');
          L(-half, half, 0, depth, 1.55, 1.7, 'steel');
          for (let k = 0; k < 4; k++) CY(-half * 0.7 + k * half * 0.47, depth * 0.45, 0.7, 0.12, 0.14, 0.16, 'egg', 10);
          for (let k = 0; k < 6; k++) L(-half + 0.1 + k * (2 * half - 0.2) / 6, -half + 0.16 + k * (2 * half - 0.2) / 6, depth - 0.01, depth + 0.04, 0.3, 0.42, k % 2 ? 'gGreen' : 'red');
          break;
        }
        case 'calibrar': {                      // dial gigante (radio, termómetro, cámaras, gallina)
          L(-half, half, 0, depth, 0, 0.9, 'blueDk');
          L(-half, half, 0, depth * 0.4, 0.9, 1.9, 'hullDk');
          DISC(0, 1.45, depth * 0.4, 0.42, 0.04, 'white', 24);
          DISC(0, 1.45, depth * 0.4 + 0.035, 0.38, 0.02, 'steel', 24);
          L(-0.03, 0.03, depth * 0.4 + 0.05, depth * 0.4 + 0.07, 1.45, 1.78, 'red');
          [[-0.25, 'gGreen'], [0, 'gYolk'], [0.25, 'gRed']].forEach(([a, m]) => L(a - 0.08, a + 0.08, depth * 0.4 + 0.04, depth * 0.4 + 0.06, 1.68, 1.76, m));
          L(-half + 0.1, half - 0.1, depth - 0.01, depth + 0.005, 0.55, 0.62, 'gBlue');
          break;
        }
        case 'docena': {                        // mesa de empaquetar con una huevera abierta
          L(-half, half, 0, depth, 0, 0.82, 'wood');
          L(-half + 0.05, half - 0.05, 0.08, depth - 0.08, 0.82, 0.9, 'card');
          for (let a = 0; a < 6; a++) for (let b = 0; b < 2; b++) { const [x, z] = W(-half + 0.15 + a * (2 * half - 0.3) / 5, depth * 0.3 + b * depth * 0.4); if ((a + b) % 3) C('y', x, 0.9, z, 0.07, 0.08, 0.08, (a + b) % 2 ? 'eggBrown' : 'egg', 8); }
          break;
        }
        case 'cables': {                        // clasificadora de huevos por colores
          L(-half, half, 0, depth, 0, 0.85, 'steel');
          L(-half, half, 0, depth, 0.85, 0.92, 'card');
          const cols = ['red', 'pipeBlue', 'pipeYel', 'purple'];
          for (let k = 0; k < 4; k++) { CY(-half * 0.72 + k * half * 0.48, depth * 0.3, 0.92, 0.1, 0.12, 0.15, cols[k], 10); CY(-half * 0.72 + k * half * 0.48, depth * 0.72, 0.92, 0.1, 0.12, 0.15, cols[3 - k], 10); }
          L(-half + 0.05, half - 0.05, depth - 0.01, depth + 0.005, 0.3, 0.38, 'gYolk');
          break;
        }
      }
    });

    screenOn(LIGHTS_PANEL.con[0], LIGHTS_PANEL.con[1], LIGHTS_PANEL.con[2], LIGHTS_PANEL.con[3], 'e', 'gOrange');
    // 8) Rejillas de conductos con borde
    VENTS.forEach(v => { BOX(v.x - 0.55, 0, v.z - 0.45, v.x + 0.55, 0.045, v.z - 0.38, 'hullDk'); BOX(v.x - 0.55, 0, v.z + 0.38, v.x + 0.55, 0.045, v.z + 0.45, 'hullDk'); });
    decorCache = { prims: out, glows, mats: DECOR_MATS };
    return decorCache;
  }


  // Triángulos de una primitiva de decoración → push(x,y,z, nx,ny,nz) por vértice
  // (lo usan el cliente para construir las mallas fusionadas y el renderizador de pruebas)
  function primTriangles(p, push) {
    const map = (ax, a, u, v) => ax === 'y' ? [u, a, v] : ax === 'x' ? [a, v, u] : [u, v, a];
    const tri = (A, B, Cc, n) => {
      let nx, ny, nz;
      if (n) { [nx, ny, nz] = n; }
      else {
        const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
        nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      }
      push(A[0], A[1], A[2], nx, ny, nz); push(B[0], B[1], B[2], nx, ny, nz); push(Cc[0], Cc[1], Cc[2], nx, ny, nz);
    };
    if (p.t === 'prism') {
      const P0 = p.pts.map(([u, v]) => map(p.ax, p.a0, u, v)), P1 = p.pts.map(([u, v]) => map(p.ax, p.a1, u, v));
      for (let i = 1; i < P0.length - 1; i++) { tri(P0[0], P0[i], P0[i + 1]); tri(P1[0], P1[i + 1], P1[i]); }
      for (let i = 0; i < P0.length; i++) { const j = (i + 1) % P0.length; tri(P0[i], P1[i], P1[j]); tri(P0[i], P1[j], P0[j]); }
      return;
    }
    if (p.t === 'cyl') {
      const n = p.seg || 18, ax = p.ax;
      // base en (x,y,z) y se extiende +h por el eje; u,v = coordenadas en el plano perpendicular
      const base = ax === 'y' ? p.y : ax === 'x' ? p.x : p.z;
      const cu = ax === 'y' ? p.x : p.z, cv = ax === 'y' ? p.z : p.y;
      const pt = (a, r, k) => { const ang = k / n * Math.PI * 2; return map(ax, a, cu + Math.cos(ang) * r, cv + Math.sin(ang) * r); };
      const nrm = k => { const ang = k / n * Math.PI * 2; return map(ax, 0, Math.cos(ang), Math.sin(ang)); };
      const a0 = base, a1 = base + p.h;
      const axisN = map(ax, 1, 0, 0);
      for (let k = 0; k < n; k++) {
        const A = pt(a0, p.r0, k), B = pt(a0, p.r0, k + 1), Ct = pt(a1, p.r1, k + 1), D = pt(a1, p.r1, k);
        const nA = nrm(k), nB = nrm(k + 1);
        push(A[0], A[1], A[2], nA[0], nA[1], nA[2]); push(B[0], B[1], B[2], nB[0], nB[1], nB[2]); push(Ct[0], Ct[1], Ct[2], nB[0], nB[1], nB[2]);
        push(A[0], A[1], A[2], nA[0], nA[1], nA[2]); push(Ct[0], Ct[1], Ct[2], nB[0], nB[1], nB[2]); if (p.r1 > 0.001) push(D[0], D[1], D[2], nA[0], nA[1], nA[2]); else push(Ct[0], Ct[1], Ct[2], nB[0], nB[1], nB[2]);
        const c0 = map(ax, a0, cu, cv), c1 = map(ax, a1, cu, cv);
        tri(c0, B, A, [-axisN[0], -axisN[1], -axisN[2]]);
        if (p.r1 > 0.001) tri(c1, D, Ct, axisN);
      }
    }
  }

  // Letreros de las puertas: posición y orientación en la cara del pasillo
  function signs() {
    return DOORS.map(dr => {
      const rm = ROOMS.find(r => r.id === dr.room);
      const cx = (dr.minX + dr.maxX) / 2, cz = (dr.minZ + dr.maxZ) / 2;
      const n = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dr.side];
      const off = 0.16 + 0.02;
      return { text: rm.name, x: cx + n[0] * off, y: 2.84, z: cz + n[1] * off, rotY: Math.atan2(n[0], n[1]) };
    });
  }

  // Huella del mapa: cliente y servidor la comparan para detectar versiones distintas
  function mapHash(boxes) {
    let h = 2166136261;
    const str = boxes.filter(b => b.solid && !b.door).map(b => [b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ].map(v => Math.round(v * 20)).join(',')).join(';');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36) + '-' + boxes.length;
  }
  return { mapHash, TEX_OF, TEX_SCALE, texturePixels, boxUV, BOUNDS, CORRIDORS, WINDOWS, CAMS, CAM_PANEL, decor, signs, primTriangles, DECOR_MATS, MAP_ID: 'nave', nave, ROOMS, DOORS, STATIONS, STATION, MIN_MS, TASK_RANGE, BUTTON, LIGHTS_PANEL, REACTOR_PADS, VENTS, VENT, COLORS, RULES, seat, roomAt, defaultImpostors, H };
});
