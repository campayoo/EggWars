// ============================================================================
// maps.js — Definición de mapas 3D con edificios multipiso y escaleras interactivas
// ============================================================================

window.GameMaps = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // GENERADOR DE ESCALERAS DE MANO INTERACTIVAS
  // ---------------------------------------------------------------------------
  /**
   * Crea la representación 3D de una escalera de mano y registra su volumen trepable.
   */
  function createLadder(root, addLadder, addCollider, opt) {
    const { x, z, startY, height, rotY = 0, color = 0x00ffcc, isCyber = false } = opt;
    const ladderGroup = new THREE.Group();
    const ladderWidth = 1.0;
    const railRadius = 0.04;
    const rungRadius = 0.025;
    const rungStep = 0.42;

    const railMat = new THREE.MeshLambertMaterial({
      color,
      emissive: isCyber ? color : 0x000000,
      emissiveIntensity: isCyber ? 0.35 : 0.0,
    });

    // 2 Largueros verticales
    const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, height, 8);
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-ladderWidth / 2, height / 2, 0);
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(ladderWidth / 2, height / 2, 0);
    ladderGroup.add(leftRail, rightRail);

    // Peldaños horizontales
    const rungGeo = new THREE.CylinderGeometry(rungRadius, rungRadius, ladderWidth, 8);
    const numRungs = Math.floor(height / rungStep);
    for (let i = 1; i <= numRungs; i++) {
      const rung = new THREE.Mesh(rungGeo, railMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, i * rungStep, 0);
      ladderGroup.add(rung);
    }

    ladderGroup.position.set(x, startY, z);
    ladderGroup.rotation.y = rotY;
    root.add(ladderGroup);

    // Registrar volumen interactivo de trepado en el sistema de físicas
    const depth = 0.8;
    const width = 1.2;
    addLadder(x, startY + height / 2, z, width, height, depth);
  }

  // ---------------------------------------------------------------------------
  // MAPA 1: NEON CYBER-GRID CON TORRE DE 2 PLANTAS
  // ---------------------------------------------------------------------------
  function buildCyberGrid(scene, root, addCollider, addLadder) {
    const half = 32;
    scene.background.set(0x050714);
    scene.fog.color.set(0x050714);
    scene.fog.near = 35;
    scene.fog.far = 110;

    // Suelo oscuro metálico
    const floorGeo = new THREE.PlaneGeometry(half * 2, half * 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x080e21 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);

    // Rejilla neón
    const grid = new THREE.GridHelper(half * 2, 32, 0x00d2d3, 0x5f27cd);
    grid.position.y = 0.02;
    root.add(grid);

    // Muros perimetrales
    const wallH = 6, wallT = 0.8;
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x0abde3, wireframe: true, transparent: true, opacity: 0.35 });
    const wallDefs = [
      { w: half * 2 + 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: -half },
      { w: half * 2 + 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: half },
      { w: wallT, h: wallH, d: half * 2 + 2, x: half, y: wallH / 2, z: 0 },
      { w: wallT, h: wallH, d: half * 2 + 2, x: -half, y: wallH / 2, z: 0 },
    ];
    wallDefs.forEach(cfg => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), wallMat);
      m.position.set(cfg.x, cfg.y, cfg.z);
      root.add(m);
      addCollider(cfg.x, cfg.y, cfg.z, cfg.w, cfg.h, cfg.d);
    });

    // ==========================================
    // EDIFICIO 1: TORRE CYBER DE 2 PLANTAS CON AZOTEA (Centro-Norte)
    // ==========================================
    const bX = 0, bZ = -14;
    const wallColor = 0x111c38;
    const floorColor = 0x19274e;
    const frameColor = 0x00ffcc;

    // Planta Baja (Suelo a y=0, Techo/Piso 1 a y=3.8)
    // Pared trasera
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(10, 3.8, 0.4), new THREE.MeshLambertMaterial({ color: wallColor }));
    backWall.position.set(bX, 1.9, bZ - 5);
    root.add(backWall);
    addCollider(bX, 1.9, bZ - 5, 10, 3.8, 0.4);

    // Paredes laterales con ventanas
    [-5, 5].forEach(sideX => {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.8, 10), new THREE.MeshLambertMaterial({ color: wallColor }));
      sideWall.position.set(bX + sideX, 1.9, bZ);
      root.add(sideWall);
      addCollider(bX + sideX, 1.9, bZ, 0.4, 3.8, 10);
    });

    // Pared delantera con puerta central abierta de 2.5m de ancho
    const frontWallL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.8, 0.4), new THREE.MeshLambertMaterial({ color: wallColor }));
    frontWallL.position.set(bX - 3.25, 1.9, bZ + 5);
    const frontWallR = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.8, 0.4), new THREE.MeshLambertMaterial({ color: wallColor }));
    frontWallR.position.set(bX + 3.25, 1.9, bZ + 5);
    root.add(frontWallL, frontWallR);
    addCollider(bX - 3.25, 1.9, bZ + 5, 3.5, 3.8, 0.4);
    addCollider(bX + 3.25, 1.9, bZ + 5, 3.5, 3.8, 0.4);

    // Techo de Planta Baja / Suelo de Planta 1 (con hueco para escalera en x=3.5, z=-3)
    const floor1A = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 10), new THREE.MeshLambertMaterial({ color: floorColor }));
    floor1A.position.set(bX - 1.5, 3.8, bZ);
    const floor1B = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 6), new THREE.MeshLambertMaterial({ color: floorColor }));
    floor1B.position.set(bX + 3.5, 3.8, bZ + 2);
    root.add(floor1A, floor1B);
    addCollider(bX - 1.5, 3.8, bZ, 7, 0.4, 10);
    addCollider(bX + 3.5, 3.8, bZ + 2, 3, 0.4, 6);

    // Escalera 1: Interior de Planta Baja al Piso 1
    createLadder(root, addLadder, addCollider, {
      x: bX + 3.5, z: bZ - 4.6, startY: 0, height: 4.0, rotY: 0, color: frameColor, isCyber: true
    });

    // Planta 1 (De y=3.8 a y=7.4 con ventanas para disparar)
    // Muro frontal bajo de parapeto con ventanas panorámicas
    const p1Front = new THREE.Mesh(new THREE.BoxGeometry(10, 1.3, 0.4), new THREE.MeshLambertMaterial({ color: wallColor }));
    p1Front.position.set(bX, 4.45, bZ + 5);
    const p1Back = new THREE.Mesh(new THREE.BoxGeometry(10, 3.6, 0.4), new THREE.MeshLambertMaterial({ color: wallColor }));
    p1Back.position.set(bX, 5.6, bZ - 5);
    root.add(p1Front, p1Back);
    addCollider(bX, 4.45, bZ + 5, 10, 1.3, 0.4);
    addCollider(bX, 5.6, bZ - 5, 10, 3.6, 0.4);

    // Azotea (y=7.4)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.4, 10.4), new THREE.MeshLambertMaterial({ color: floorColor }));
    roof.position.set(bX, 7.4, bZ);
    root.add(roof);
    addCollider(bX, 7.4, bZ, 10.4, 0.4, 10.4);

    // Barandillas de azotea
    const parapetGeo = new THREE.BoxGeometry(10.4, 1.0, 0.3);
    const parapetMat = new THREE.MeshLambertMaterial({ color: wallColor });
    const prFront = new THREE.Mesh(parapetGeo, parapetMat);
    prFront.position.set(bX, 7.9, bZ + 5.1);
    const prBack = new THREE.Mesh(parapetGeo, parapetMat);
    prBack.position.set(bX, 7.9, bZ - 5.1);
    root.add(prFront, prBack);
    addCollider(bX, 7.9, bZ + 5.1, 10.4, 1.0, 0.3);
    addCollider(bX, 7.9, bZ - 5.1, 10.4, 1.0, 0.3);

    // Escalera 2: Exterior adosada a la fachada lateral derecha hasta la Azotea
    createLadder(root, addLadder, addCollider, {
      x: bX + 5.3, z: bZ, startY: 0, height: 7.6, rotY: Math.PI / 2, color: 0xff007f, isCyber: true
    });

    // Pilares y plataformas auxiliares
    const pillarPositions = [
      { x: -16, z: -16, h: 4.5, r: 2.2 },
      { x: 16, z: 16, h: 4.5, r: 2.2 },
      { x: -16, z: 16, h: 4.5, r: 2.2 },
      { x: 16, z: -16, h: 4.5, r: 2.2 },
    ];
    pillarPositions.forEach(p => {
      const geo = new THREE.CylinderGeometry(p.r, p.r, p.h, 6);
      const mat = new THREE.MeshLambertMaterial({ color: 0x101730, emissive: 0x54a0ff, emissiveIntensity: 0.25 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, p.h / 2, p.z);
      root.add(mesh);
      addCollider(p.x, p.h / 2, p.z, p.r * 2, p.h, p.r * 2);

      // Escalera para subir a la cima del pilar sniper
      createLadder(root, addLadder, addCollider, {
        x: p.x, z: p.z + p.r + 0.1, startY: 0, height: p.h, rotY: 0, color: 0x54a0ff, isCyber: true
      });
    });

    // Plataforma central
    const platGeo = new THREE.BoxGeometry(8, 0.6, 8);
    const platMat = new THREE.MeshLambertMaterial({ color: 0x142045, emissive: 0x00d2d3, emissiveIntensity: 0.15 });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.set(0, 3.2, 8);
    root.add(platform);
    addCollider(0, 3.2, 8, 8, 0.6, 8);

    createLadder(root, addLadder, addCollider, {
      x: 0, z: 12.2, startY: 0, height: 3.4, rotY: 0, color: 0x00d2d3, isCyber: true
    });
  }

  // ---------------------------------------------------------------------------
  // MAPA 2: ISLA VOLCÁNICA CON FORTÍN Y ESCALERAS
  // ---------------------------------------------------------------------------
  function buildVolcano(scene, root, addCollider, addLadder) {
    const half = 30;
    scene.background.set(0x2d1305);
    scene.fog.color.set(0x2d1305);
    scene.fog.near = 25;
    scene.fog.far = 85;

    // Mar de lava
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(half * 2.5, half * 2.5), new THREE.MeshBasicMaterial({ color: 0xff4500 }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = 0.05;
    root.add(lava);

    // Muros perimetrales
    const borderMat = new THREE.MeshLambertMaterial({ color: 0x1f140e });
    [
      { w: half * 2 + 4, h: 10, d: 1.2, x: 0, y: 5, z: -half },
      { w: half * 2 + 4, h: 10, d: 1.2, x: 0, y: 5, z: half },
      { w: 1.2, h: 10, d: half * 2 + 4, x: half, y: 5, z: 0 },
      { w: 1.2, h: 10, d: half * 2 + 4, x: -half, y: 5, z: 0 },
    ].forEach(cfg => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), borderMat);
      m.position.set(cfg.x, cfg.y, cfg.z);
      root.add(m);
      addCollider(cfg.x, cfg.y, cfg.z, cfg.w, cfg.h, cfg.d);
    });

    // Isla Principal (y = 0.6)
    const islandMat = new THREE.MeshLambertMaterial({ color: 0x1b1919 });
    const island = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 1.2, 16), islandMat);
    island.position.set(0, 0.6, 0);
    root.add(island);
    addCollider(0, 0.6, 0, 30, 1.2, 30);

    // 4 Islotes
    [
      { x: -18, z: -18, r: 6 },
      { x: 18, z: 18, r: 6 },
      { x: -18, z: 18, r: 6 },
      { x: 18, z: -18, r: 6 },
    ].forEach(sub => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(sub.r, sub.r + 1.5, 1.2, 10), islandMat);
      m.position.set(sub.x, 0.6, sub.z);
      root.add(m);
      addCollider(sub.x, 0.6, sub.z, sub.r * 2, 1.2, sub.r * 2);

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 2.2), new THREE.MeshLambertMaterial({ color: 0x33261d }));
      const midX = sub.x * 0.58, midZ = sub.z * 0.58;
      bridge.position.set(midX, 0.65, midZ);
      bridge.rotation.y = -Math.atan2(sub.z, sub.x);
      root.add(bridge);
      addCollider(midX, 0.65, midZ, 4.5, 0.6, 4.5);
    });

    // ==========================================
    // BASTIÓN VOLCÁNICO DE PIEDRA DE 2 PLANTAS (Centro)
    // ==========================================
    const fortMat = new THREE.MeshLambertMaterial({ color: 0x272727 });
    const woodLadderColor = 0xd35400;

    // Paredes del fortín (8x8 metros)
    const fortWalls = [
      { w: 8, h: 4.5, d: 0.6, x: 0, y: 3.45, z: -4 },
      { w: 0.6, h: 4.5, d: 8, x: -4, y: 3.45, z: 0 },
      { w: 0.6, h: 4.5, d: 8, x: 4, y: 3.45, z: 0 },
      // Frontal con puerta abierta
      { w: 2.8, h: 4.5, d: 0.6, x: -2.6, y: 3.45, z: 4 },
      { w: 2.8, h: 4.5, d: 0.6, x: 2.6, y: 3.45, z: 4 },
    ];
    fortWalls.forEach(w => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), fortMat);
      m.position.set(w.x, w.y, w.z);
      root.add(m);
      addCollider(w.x, w.y, w.z, w.w, w.h, w.d);
    });

    // Azotea transitable del fortín a y=5.8
    const fortRoof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.5, 8.4), fortMat);
    fortRoof.position.set(0, 5.8, 0);
    root.add(fortRoof);
    addCollider(0, 5.8, 0, 8.4, 0.5, 8.4);

    // Almenas de protección en la azotea
    const battlements = [
      { w: 8.4, h: 1.0, d: 0.4, x: 0, y: 6.5, z: -4.1 },
      { w: 8.4, h: 1.0, d: 0.4, x: 0, y: 6.5, z: 4.1 },
      { w: 0.4, h: 1.0, d: 8.4, x: -4.1, y: 6.5, z: 0 },
    ];
    battlements.forEach(b => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), fortMat);
      m.position.set(b.x, b.y, b.z);
      root.add(m);
      addCollider(b.x, b.y, b.z, b.w, b.h, b.d);
    });

    // Escalera 1: Escalera exterior de madera/hierro adosada al fortín
    createLadder(root, addLadder, addCollider, {
      x: 4.25, z: 1.0, startY: 1.2, height: 5.0, rotY: Math.PI / 2, color: woodLadderColor
    });

    // Columnas de basalto con escaleras en dos de ellas para snipers
    const basaltMat = new THREE.MeshLambertMaterial({ color: 0x242426 });
    const colList = [
      { x: -10, z: 0, h: 4.5 },
      { x: 10, z: 0, h: 4.5 },
      { x: 0, z: -10, h: 3.5 },
    ];
    colList.forEach(c => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, c.h, 6), basaltMat);
      col.position.set(c.x, 1.2 + c.h / 2, c.z);
      root.add(col);
      addCollider(c.x, 1.2 + c.h / 2, c.z, 3, c.h, 3);

      createLadder(root, addLadder, addCollider, {
        x: c.x, z: c.z + 1.6, startY: 1.2, height: c.h, rotY: 0, color: 0xe67e22
      });
    });
  }

  // ---------------------------------------------------------------------------
  // MAPA 3: GIANT TOYROOM CON CASA DE JUGUETE DE 3 PLANTAS
  // ---------------------------------------------------------------------------
  function buildToyroom(scene, root, addCollider, addLadder) {
    const half = 35;
    scene.background.set(0x87ceeb);
    scene.fog.color.set(0xfff3e0);
    scene.fog.near = 35;
    scene.fog.far = 110;

    // Suelo de madera
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), new THREE.MeshLambertMaterial({ color: 0xe0a96d }));
    floor.rotation.x = -Math.PI / 2;
    root.add(floor);

    // Zócalos perimetrales
    const baseboardMat = new THREE.MeshLambertMaterial({ color: 0x6d4c41 });
    [
      { w: half * 2 + 2, h: 8, d: 1.0, x: 0, y: 4, z: -half },
      { w: half * 2 + 2, h: 8, d: 1.0, x: 0, y: 4, z: half },
      { w: 1.0, h: 8, d: half * 2 + 2, x: half, y: 4, z: 0 },
      { w: 1.0, h: 8, d: half * 2 + 2, x: -half, y: 4, z: 0 },
    ].forEach(cfg => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), baseboardMat);
      m.position.set(cfg.x, cfg.y, cfg.z);
      root.add(m);
      addCollider(cfg.x, cfg.y, cfg.z, cfg.w, cfg.h, cfg.d);
    });

    // ==========================================
    // CASA DE JUGUETE / LEGO DE 3 PLANTAS ACCESIBLES (Centro)
    // ==========================================
    const houseX = 0, houseZ = 0;
    const legoRed = 0xe74c3c, legoBlue = 0x2980b9, legoYellow = 0xf1c40f, legoGreen = 0x27ae60;

    // Planta Baja (Paredes de bloques gigantes de 3.2m de altura)
    // Pared trasera
    const bgBack = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 0.6), new THREE.MeshLambertMaterial({ color: legoRed }));
    bgBack.position.set(houseX, 1.6, houseZ - 5);
    root.add(bgBack);
    addCollider(houseX, 1.6, houseZ - 5, 12, 3.2, 0.6);

    // Paredes laterales con aberturas
    [-6, 6].forEach(sideX => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 10), new THREE.MeshLambertMaterial({ color: legoBlue }));
      sw.position.set(houseX + sideX, 1.6, houseZ);
      root.add(sw);
      addCollider(houseX + sideX, 1.6, houseZ, 0.6, 3.2, 10);
    });

    // Piso 1 (y = 3.2) con trampilla
    const fl1A = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 10), new THREE.MeshLambertMaterial({ color: legoYellow }));
    fl1A.position.set(houseX - 2, 3.2, houseZ);
    const fl1B = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 6), new THREE.MeshLambertMaterial({ color: legoYellow }));
    fl1B.position.set(houseX + 4, 3.2, houseZ + 2);
    root.add(fl1A, fl1B);
    addCollider(houseX - 2, 3.2, houseZ, 8, 0.4, 10);
    addCollider(houseX + 4, 3.2, houseZ + 2, 4, 0.4, 6);

    // Escalera 1: Planta Baja -> Piso 1
    createLadder(root, addLadder, addCollider, {
      x: houseX + 4.2, z: houseZ - 4.2, startY: 0, height: 3.4, rotY: 0, color: legoYellow
    });

    // Planta 1 a Planta 2 (De y=3.2 a y=6.4)
    const p2Back = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 0.6), new THREE.MeshLambertMaterial({ color: legoGreen }));
    p2Back.position.set(houseX, 4.8, houseZ - 5);
    root.add(p2Back);
    addCollider(houseX, 4.8, houseZ - 5, 12, 3.2, 0.6);

    // Balcón / ventana panorámica frontal en Piso 1
    const balc = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 0.6), new THREE.MeshLambertMaterial({ color: legoGreen }));
    balc.position.set(houseX, 3.8, houseZ + 5);
    root.add(balc);
    addCollider(houseX, 3.8, houseZ + 5, 12, 1.2, 0.6);

    // Piso 2 / Terraza Superior (y = 6.4)
    const roofLego = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.5, 10.4), new THREE.MeshLambertMaterial({ color: legoRed }));
    roofLego.position.set(houseX, 6.4, houseZ);
    root.add(roofLego);
    addCollider(houseX, 6.4, houseZ, 12.4, 0.5, 10.4);

    // Escalera 2: Exterior en la pared izquierda hasta la Terraza del Tejado
    createLadder(root, addLadder, addCollider, {
      x: houseX - 6.3, z: houseZ, startY: 0, height: 6.6, rotY: Math.PI / 2, color: legoRed
    });

    // Castillos de cartas y dominós
    function buildCardHouse(cx, cz) {
      const cardW = 3.6, cardH = 4.2, cardT = 0.08;
      const cardMat = new THREE.MeshLambertMaterial({ color: 0xfafafa });
      const cardL = new THREE.Mesh(new THREE.BoxGeometry(cardW, cardH, cardT), cardMat);
      cardL.position.set(cx - 1.0, cardH * 0.44, cz);
      cardL.rotation.z = 0.35;
      const cardR = new THREE.Mesh(new THREE.BoxGeometry(cardW, cardH, cardT), cardMat);
      cardR.position.set(cx + 1.0, cardH * 0.44, cz);
      cardR.rotation.z = -0.35;
      const cardTop = new THREE.Mesh(new THREE.BoxGeometry(cardW, cardT, 2.5), cardMat);
      cardTop.position.set(cx, cardH * 0.88, cz);
      root.add(cardL, cardR, cardTop);
      addCollider(cx, cardH * 0.44, cz, 3.2, cardH * 0.88, 2.5);
    }
    buildCardHouse(-18, -18);
    buildCardHouse(18, 18);
  }

  // ---------------------------------------------------------------------------
  // INTERFAZ PÚBLICA
  // ---------------------------------------------------------------------------
  return {
    buildMap: function (mapName, scene, root, addCollider, addLadder) {
      if (mapName === 'volcano') {
        buildVolcano(scene, root, addCollider, addLadder);
      } else if (mapName === 'toyroom') {
        buildToyroom(scene, root, addCollider, addLadder);
      } else {
        buildCyberGrid(scene, root, addCollider, addLadder);
      }
    },
  };
})();
