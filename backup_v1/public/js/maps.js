// ============================================================================
// maps.js — Recreación EXACTA de los mapas oficiales de Shell Shockers:
// Dirt (Contenedores en cruz y rampas), Space (Plataformas hexagonales, Jump-Pads),
// Fort (2 Castillos/Fuertes de dos pisos con escaleras interiores operativas)
// ============================================================================

window.GameMaps = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // GENERADOR DE ESCALERAS DE MANO INTERACTIVAS (AABB Trigger Volumes)
  // ---------------------------------------------------------------------------
  function createLadder(scene, root, addLadder, opt) {
    const {
      x, z, startY, height, rotY = 0,
      color = 0x3b2f2f, rungColor = 0xdaa520,
      isMetal = false
    } = opt;

    const ladderGroup = new THREE.Group();
    const ladderWidth = 1.1;
    const railRadius = isMetal ? 0.04 : 0.06;
    const rungRadius = isMetal ? 0.025 : 0.035;
    const rungStep = 0.44;

    const railMat = new THREE.MeshLambertMaterial({ color: isMetal ? 0x7f8c8d : color, roughness: 0.8 });
    const rungMat = new THREE.MeshLambertMaterial({ color: isMetal ? 0xbdc3c7 : rungColor, roughness: 0.7 });

    // 2 Largueros verticales
    const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, height, 8);
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-ladderWidth / 2, height / 2, 0);
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(ladderWidth / 2, height / 2, 0);
    ladderGroup.add(leftRail, rightRail);

    // Peldaños horizontales
    const rungGeo = new THREE.CylinderGeometry(rungRadius, rungRadius, ladderWidth - 0.02, 8);
    const numRungs = Math.floor(height / rungStep);
    for (let i = 1; i <= numRungs; i++) {
      const rung = new THREE.Mesh(rungGeo, rungMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, i * rungStep, 0);
      ladderGroup.add(rung);
    }

    ladderGroup.position.set(x, startY, z);
    ladderGroup.rotation.y = rotY;
    root.add(ladderGroup);
    if (scene && scene !== root) scene.add(ladderGroup);

    // Registrar AABB trigger para el escalado vertical
    const depth = 1.0;
    const width = 1.3;
    addLadder(x, startY + height / 2, z, width, height, depth);
  }

  // ---------------------------------------------------------------------------
  // MAPA 1: DIRT (El Clásico Campo de Contenedores en Cruz)
  // Recreación: Contenedores rojos (#B22222) y azules (#4682B4) apilados en cruz,
  // pasillos cruzados, rampas de madera (#CD853F), pacas de paja y montículos
  // ---------------------------------------------------------------------------
  function buildDirt(scene, root, addCollider, addLadder) {
    const half = 38;
    if (scene.background) scene.background.set(0x87ceeb);
    if (scene.fog) {
      scene.fog.color.set(0x87ceeb);
      scene.fog.near = 45;
      scene.fog.far = 135;
    }

    // 1. Suelo general: Rectángulo gigante verde oliva / tierra (#6B8E23)
    const floorGeo = new THREE.PlaneGeometry(half * 2, half * 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x6b8e23, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
    if (scene && scene !== root) scene.add(floor);

    // Sendero central de tierra arcillosa (#8B4513)
    const pathMat = new THREE.MeshLambertMaterial({ color: 0x8b4513, side: THREE.DoubleSide });
    const pathX = new THREE.Mesh(new THREE.PlaneGeometry(12, half * 2), pathMat);
    pathX.rotation.x = -Math.PI / 2;
    pathX.position.y = 0.02;
    root.add(pathX);
    if (scene && scene !== root) scene.add(pathX);

    const pathZ = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 12), pathMat);
    pathZ.rotation.x = -Math.PI / 2;
    pathZ.position.y = 0.02;
    root.add(pathZ);
    if (scene && scene !== root) scene.add(pathZ);

    // 2. Vallas perimetrales de madera delimitando la arena
    const wallH = 5.5, wallT = 0.8;
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const perimDefs = [
      { w: half * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: -half },
      { w: half * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: half },
      { w: wallT, h: wallH, d: half * 2, x: half, y: wallH / 2, z: 0 },
      { w: wallT, h: wallH, d: half * 2, x: -half, y: wallH / 2, z: 0 },
    ];
    perimDefs.forEach(cfg => {
      const fence = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), fenceMat);
      fence.position.set(cfg.x, cfg.y, cfg.z);
      root.add(fence);
      if (scene && scene !== root) scene.add(fence);
      addCollider(cfg.x, cfg.y, cfg.z, cfg.w, cfg.h, cfg.d);
    });

    // 3. Estructura de Contenedores de Carga en Cruz (Rojos #B22222 y Azules #4682B4)
    // Dimensiones típicas de un contenedor estándar: L=7.5m, W=3.2m, H=2.8m
    const redMat = new THREE.MeshLambertMaterial({ color: 0xb22222 });
    const blueMat = new THREE.MeshLambertMaterial({ color: 0x4682b4 });
    const cL = 7.5, cW = 3.2, cH = 2.8;

    function createContainer(x, y, z, rotY, isRed) {
      const mat = isRed ? redMat : blueMat;
      const cMesh = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cL), mat);
      cMesh.position.set(x, y + cH / 2, z);
      cMesh.rotation.y = rotY;
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      root.add(cMesh);
      if (scene && scene !== root) scene.add(cMesh);

      // Colisionador ajustado según rotación
      const colW = (rotY % Math.PI === 0) ? cW : cL;
      const colD = (rotY % Math.PI === 0) ? cL : cW;
      addCollider(x, y + cH / 2, z, colW, cH, colD);
    }

    // Nivel 1 (Suelo): Formando los pasillos en cruz central
    // Brazo Norte (Z negativo)
    createContainer(-3.8, 0, -8, 0, true);
    createContainer(3.8, 0, -8, 0, false);

    // Brazo Sur (Z positivo)
    createContainer(-3.8, 0, 8, 0, false);
    createContainer(3.8, 0, 8, 0, true);

    // Brazo Este (X positivo)
    createContainer(8, 0, -3.8, Math.PI / 2, true);
    createContainer(8, 0, 3.8, Math.PI / 2, false);

    // Brazo Oeste (X negativo)
    createContainer(-8, 0, -3.8, Math.PI / 2, false);
    createContainer(-8, 0, 3.8, Math.PI / 2, true);

    // Nivel 2 (Apilados arriba de los contenedores para crear posiciones de altura)
    createContainer(-3.8, cH, -8, 0, false);
    createContainer(3.8, cH, 8, 0, true);
    createContainer(8, cH, -3.8, Math.PI / 2, false);
    createContainer(-8, cH, 3.8, Math.PI / 2, true);

    // 4. Rampas de madera (#CD853F) alineadas a los laterales de los contenedores
    const rampWoodMat = new THREE.MeshLambertMaterial({ color: 0xcd853f });
    function createRamp(rx, ry, rz, width, length, height, rotAngleY) {
      const rGroup = new THREE.Group();
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.4, length), rampWoodMat);
      rampMesh.position.set(0, height / 2, 0);
      rampMesh.rotation.x = Math.atan2(height, length);
      rGroup.add(rampMesh);

      rGroup.position.set(rx, ry, rz);
      rGroup.rotation.y = rotAngleY;
      root.add(rGroup);
      if (scene && scene !== root) scene.add(rGroup);

      const colW = (rotAngleY % Math.PI === 0) ? width : length;
      const colD = (rotAngleY % Math.PI === 0) ? length : width;
      addCollider(rx, ry + height / 2, rz, colW, height + 0.4, colD);
    }

    // Rampa Norte: sube al techo del contenedor Norte
    createRamp(3.8, 0, -15, cW, 6.5, cH, Math.PI);
    // Rampa Sur: sube al techo del contenedor Sur
    createRamp(-3.8, 0, 15, cW, 6.5, cH, 0);
    // Rampa Este: sube al techo del contenedor Este
    createRamp(15, 0, 3.8, cW, 6.5, cH, -Math.PI / 2);
    // Rampa Oeste: sube al techo del contenedor Oeste
    createRamp(-15, 0, -3.8, cW, 6.5, cH, Math.PI / 2);

    // 5. Coberturas: Montículos de tierra y Pacas de paja en las esquinas (#DAA520)
    const strawMat = new THREE.MeshLambertMaterial({ color: 0xdaa520 });
    const dirtMoundMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });

    function placeStrawBale(bx, by, bz, size = 1.8) {
      const bale = new THREE.Mesh(new THREE.BoxGeometry(size * 1.4, size, size), strawMat);
      bale.position.set(bx, by + size / 2, bz);
      root.add(bale);
      if (scene && scene !== root) scene.add(bale);
      addCollider(bx, by + size / 2, bz, size * 1.4, size, size);
    }

    function placeDirtMound(mx, my, mz, radius = 3.5, height = 2.4) {
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.4, radius, height, 8), dirtMoundMat);
      mound.position.set(mx, my + height / 2, mz);
      root.add(mound);
      if (scene && scene !== root) scene.add(mound);
      addCollider(mx, my + height / 2, mz, radius * 1.8, height, radius * 1.8);
    }

    // Montículos en esquinas exteriores
    placeDirtMound(-22, 0, -22, 4.0, 2.8);
    placeDirtMound(22, 0, 22, 4.0, 2.8);
    placeDirtMound(-22, 0, 22, 4.0, 2.8);
    placeDirtMound(22, 0, -22, 4.0, 2.8);

    // Pacas de paja distribuidas
    placeStrawBale(-18, 0, -10);
    placeStrawBale(-18, 1.8, -10);
    placeStrawBale(18, 0, 10);
    placeStrawBale(18, 1.8, 10);
    placeStrawBale(10, 0, -18);
    placeStrawBale(-10, 0, 18);

    // 6. Hueveras decorativas y tácticas originales de Shell Shockers (como en la captura)
    function createEggCarton(x, y, z, rotY = 0) {
      const g = new THREE.Group();
      // Base de cartón grisáceo con reborde festoneado
      const cartonMat = new THREE.MeshLambertMaterial({ color: 0xecf0f1 });
      const eggMat = new THREE.MeshLambertMaterial({ color: 0xf39c12 });
      const eggCapMat = new THREE.MeshLambertMaterial({ color: 0xe67e22 });

      const tray = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 2.2), cartonMat);
      tray.position.y = 0.22;
      g.add(tray);

      // 4 Huevos gigantes decorativos en 2x2
      const offsets = [
        [-0.55, -0.55],
        [0.55, -0.55],
        [-0.55, 0.55],
        [0.55, 0.55]
      ];
      offsets.forEach(([ox, oz]) => {
        const egg = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), eggMat);
        egg.scale.set(0.9, 1.25, 0.9);
        egg.position.set(ox, 0.75, oz);
        g.add(egg);

        // Sombrerito/Capuchón cónico del huevo como en la imagen
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.55, 10), eggCapMat);
        cap.position.set(ox, 1.15, oz);
        g.add(cap);
      });

      g.position.set(x, y, z);
      g.rotation.y = rotY;
      root.add(g);
      if (scene && scene !== root) scene.add(g);
      addCollider(x, y + 0.9, z, 2.4, 1.8, 2.4);
    }

    createEggCarton(0, 0, -3.2, 0);
    createEggCarton(0, 0, 3.2, Math.PI / 4);
    createEggCarton(-5.5, 0, 0, Math.PI / 2);
    createEggCarton(5.5, 0, 0, -Math.PI / 3);
  }

  // ---------------------------------------------------------------------------
  // MAPA 2: SPACE (Estación Espacial en Gravedad Reducida)
  // Recreación: Fondo oscuro (#0A0A1A), plataformas flotantes hexagonales (#2C3E50),
  // pasarelas finas de cristal neón cian (#00FFFF), 4 torres cilíndricas con Jump-Pads
  // ---------------------------------------------------------------------------
  function buildSpace(scene, root, addCollider, addLadder) {
    const half = 42;
    if (scene.background) scene.background.set(0x0a0a1a);
    if (scene.fog) {
      scene.fog.color.set(0x0a0a1a);
      scene.fog.near = 40;
      scene.fog.far = 150;
    }

    // Estrellas espaciales
    const starGeo = new THREE.BufferGeometry();
    const starCount = 450;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 180;
      starPos[i + 1] = Math.random() * 70 - 10;
      starPos[i + 2] = (Math.random() - 0.5) * 180;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.9 });
    const stars = new THREE.Points(starGeo, starMat);
    root.add(stars);
    if (scene && scene !== root) scene.add(stars);

    // Materiales del mapa Space
    const metalHexMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const glassCyanMat = new THREE.MeshLambertMaterial({ color: 0x00ffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const neonPurpleMat = new THREE.MeshBasicMaterial({ color: 0x8a2be2 });
    const neonCyanCoreMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    // 1. Plataforma Central Hexagonal (Radio 12, Altura 1.2)
    function createHexPlatform(px, py, pz, radius, height = 1.2) {
      const hexGeo = new THREE.CylinderGeometry(radius, radius, height, 6);
      const hexMesh = new THREE.Mesh(hexGeo, metalHexMat);
      hexMesh.position.set(px, py + height / 2, pz);
      hexMesh.receiveShadow = true;
      root.add(hexMesh);
      if (scene && scene !== root) scene.add(hexMesh);

      // Borde neón cian
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.15, radius + 0.15, 0.1, 6), neonCyanCoreMat);
      rim.position.set(px, py + height + 0.05, pz);
      root.add(rim);
      if (scene && scene !== root) scene.add(rim);

      addCollider(px, py + height / 2, pz, radius * 1.8, height, radius * 1.8);
    }

    createHexPlatform(0, 0, 0, 13, 1.2);

    // 2. Plataformas Flotantes Satélite Hexagonales (4 cardinales)
    createHexPlatform(-25, 2.5, 0, 8, 1.2);
    createHexPlatform(25, 2.5, 0, 8, 1.2);
    createHexPlatform(0, 3.5, -25, 8, 1.2);
    createHexPlatform(0, 3.5, 25, 8, 1.2);

    // 3. Pasarelas finas de cristal neón cian conectando las plataformas
    function createGlassBridge(bx, by, bz, length, width, rotAngleY) {
      const bGroup = new THREE.Group();
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, length), glassCyanMat);
      bridge.position.set(0, 0, 0);
      bGroup.add(bridge);

      // Barandillas luminosas finas
      const railMat = neonPurpleMat;
      const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, length), railMat);
      leftRail.position.set(-width / 2, 0.4, 0);
      const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, length), railMat);
      rightRail.position.set(width / 2, 0.4, 0);
      bGroup.add(leftRail, rightRail);

      bGroup.position.set(bx, by, bz);
      bGroup.rotation.y = rotAngleY;
      root.add(bGroup);
      if (scene && scene !== root) scene.add(bGroup);

      const colW = (rotAngleY % Math.PI === 0) ? width : length;
      const colD = (rotAngleY % Math.PI === 0) ? length : width;
      addCollider(bx, by, bz, colW, 0.4, colD);
    }

    createGlassBridge(-15, 1.8, 0, 12, 3.0, Math.PI / 2);
    createGlassBridge(15, 1.8, 0, 12, 3.0, Math.PI / 2);
    createGlassBridge(0, 2.3, -15, 12, 3.0, 0);
    createGlassBridge(0, 2.3, 15, 12, 3.0, 0);

    // 4. Cuatro Torres Cilíndricas Elevadas en los vértices del mapa
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x1e272e });
    const cornerTowerPositions = [
      [-22, -22],
      [22, -22],
      [-22, 22],
      [22, 22]
    ];

    cornerTowerPositions.forEach(([tx, tz]) => {
      const tH = 8.5;
      const tR = 3.6;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(tR, tR + 0.5, tH, 12), towerMat);
      tower.position.set(tx, tH / 2, tz);
      root.add(tower);
      if (scene && scene !== root) scene.add(tower);
      addCollider(tx, tH / 2, tz, tR * 2, tH, tR * 2);

      // Plataforma superior de observación
      const topDeck = new THREE.Mesh(new THREE.CylinderGeometry(tR + 0.6, tR + 0.6, 0.4, 12), metalHexMat);
      topDeck.position.set(tx, tH + 0.2, tz);
      root.add(topDeck);
      if (scene && scene !== root) scene.add(topDeck);
      addCollider(tx, tH + 0.2, tz, (tR + 0.6) * 2, 0.4, (tR + 0.6) * 2);

      // Escaleras exteriores de emergencia en cada torre
      createLadder(scene, root, addLadder, {
        x: tx, z: tz + (tz > 0 ? -tR - 0.2 : tR + 0.2),
        startY: 0, height: tH + 0.2, rotY: tz > 0 ? 0 : Math.PI,
        color: 0x00ffff, isMetal: true
      });

      // Jump-Pad interactivo en la base de cada torre
      createJumpPad(tx * 0.65, 1.2, tz * 0.65);
    });

    // 5. Jump-Pads Sci-Fi (Lanzadores de rebote gravitacional)
    function createJumpPad(jx, jy, jz) {
      const padGroup = new THREE.Group();
      const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.3, 16), neonPurpleMat);
      baseMesh.position.y = 0.15;
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 8, 24), neonCyanCoreMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.32;
      padGroup.add(baseMesh, ringMesh);

      padGroup.position.set(jx, jy, jz);
      root.add(padGroup);
      if (scene && scene !== root) scene.add(padGroup);
      addCollider(jx, jy + 0.2, jz, 3.2, 0.4, 3.2);
    }
  }

  // ---------------------------------------------------------------------------
  // MAPA 3: FORT (Las Dos Fortalezas Enfrentadas)
  // Recreación: 2 fuertes/castillos de madera (#3B2F2F) y piedra (#708090) enfrentados,
  // planta baja con entradas en arco, planta alta con almenas para sniper,
  // escaleras interiores operativas y campo abierto central con coberturas.
  // ---------------------------------------------------------------------------
  function buildFort(scene, root, addCollider, addLadder) {
    const half = 36;
    if (scene.background) scene.background.set(0x7ea2b6);
    if (scene.fog) {
      scene.fog.color.set(0x7ea2b6);
      scene.fog.near = 40;
      scene.fog.far = 130;
    }

    // Suelo de tierra y piedra rústica (#708090)
    const floorGeo = new THREE.PlaneGeometry(half * 2, half * 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x708090, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
    if (scene && scene !== root) scene.add(floor);

    // Muro perimetral de empalizada
    const wallH = 6.5, wallT = 1.0;
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x3b2f2f });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x5a6268 });
    const floorPlankMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });

    [
      { w: half * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: -half },
      { w: half * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: half },
      { w: wallT, h: wallH, d: half * 2, x: half, y: wallH / 2, z: 0 },
      { w: wallT, h: wallH, d: half * 2, x: -half, y: wallH / 2, z: 0 },
    ].forEach(cfg => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), woodMat);
      m.position.set(cfg.x, cfg.y, cfg.z);
      root.add(m);
      if (scene && scene !== root) scene.add(m);
      addCollider(cfg.x, cfg.y, cfg.z, cfg.w, cfg.h, cfg.d);
    });

    // ==========================================
    // RECREACIÓN DE FUERTE / CASTILLO DE 2 PLANTAS
    // ==========================================
    function buildFortress(fX, fZ, isWest) {
      const fW = 14, fD = 18, fH = 4.2;

      // 1. PLANTA BAJA CON ENTRADA EN FORMA DE ARCO (Frontal abierta)
      // Pared trasera sólida
      const backZ = fZ + (isWest ? -fD / 2 : fD / 2);
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(fW, fH, 0.8), stoneMat);
      backWall.position.set(fX, fH / 2, backZ);
      root.add(backWall);
      if (scene && scene !== root) scene.add(backWall);
      addCollider(fX, fH / 2, backZ, fW, fH, 0.8);

      // Paredes laterales sólidas
      const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.8, fH, fD), stoneMat);
      sideWallL.position.set(fX - fW / 2, fH / 2, fZ);
      root.add(sideWallL);
      if (scene && scene !== root) scene.add(sideWallL);
      addCollider(fX - fW / 2, fH / 2, fZ, 0.8, fH, fD);

      const sideWallR = new THREE.Mesh(new THREE.BoxGeometry(0.8, fH, fD), stoneMat);
      sideWallR.position.set(fX + fW / 2, fH / 2, fZ);
      root.add(sideWallR);
      if (scene && scene !== root) scene.add(sideWallR);
      addCollider(fX + fW / 2, fH / 2, fZ, 0.8, fH, fD);

      // Pared frontal con arco central de entrada libre (ancho 4m)
      const frontZ = fZ + (isWest ? fD / 2 : -fD / 2);
      const pilarL = new THREE.Mesh(new THREE.BoxGeometry(4.5, fH, 0.8), stoneMat);
      pilarL.position.set(fX - 4.5, fH / 2, frontZ);
      root.add(pilarL);
      if (scene && scene !== root) scene.add(pilarL);
      addCollider(fX - 4.5, fH / 2, frontZ, 4.5, fH, 0.8);

      const pilarR = new THREE.Mesh(new THREE.BoxGeometry(4.5, fH, 0.8), stoneMat);
      pilarR.position.set(fX + 4.5, fH / 2, frontZ);
      root.add(pilarR);
      if (scene && scene !== root) scene.add(pilarR);
      addCollider(fX + 4.5, fH / 2, frontZ, 4.5, fH, 0.8);

      // Arco superior sobre la puerta
      const archTop = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.2, 0.8), stoneMat);
      archTop.position.set(fX, fH - 0.6, frontZ);
      root.add(archTop);
      if (scene && scene !== root) scene.add(archTop);
      addCollider(fX, fH - 0.6, frontZ, 5.0, 1.2, 0.8);

      // 2. SUELO DEL PISO SUPERIOR (y = 4.2)
      const floorP2 = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.5, fD), floorPlankMat);
      floorP2.position.set(fX, fH, fZ);
      root.add(floorP2);
      if (scene && scene !== root) scene.add(floorP2);
      addCollider(fX, fH, fZ, fW, 0.5, fD);

      // 3. ALMENAS DE MADERA (#3B2F2F) EN EL TEJADO PARA FRANCOTIRADOR
      // Almenas frontales y traseras con aberturas tácticas
      function buildBattlements(bx, bz, width, rotAngleY) {
        const segW = 1.6, segH = 1.2, segD = 0.5;
        const num = Math.floor(width / (segW * 1.5));
        for (let i = 0; i <= num; i++) {
          const offset = (i - num / 2) * (segW * 1.5);
          const crenel = new THREE.Mesh(new THREE.BoxGeometry(segW, segH, segD), woodMat);
          if (rotAngleY === 0) {
            crenel.position.set(bx + offset, fH + segH / 2, bz);
            addCollider(bx + offset, fH + segH / 2, bz, segW, segH, segD);
          } else {
            crenel.position.set(bx, fH + segH / 2, bz + offset);
            addCollider(bx, fH + segH / 2, bz + offset, segD, segH, segW);
          }
          root.add(crenel);
          if (scene && scene !== root) scene.add(crenel);
        }
      }

      buildBattlements(fX, frontZ, fW, 0);
      buildBattlements(fX, backZ, fW, 0);
      buildBattlements(fX - fW / 2, fZ, fD, Math.PI / 2);
      buildBattlements(fX + fW / 2, fZ, fD, Math.PI / 2);

      // 4. ESCALERA INTERIOR OPERATIVA (Adherida a la pared interna para subir al piso 2)
      createLadder(scene, root, addLadder, {
        x: fX - fW / 2 + 0.8,
        z: fZ + (isWest ? -2.5 : 2.5),
        startY: 0,
        height: fH + 0.5,
        rotY: Math.PI / 2,
        color: 0x8b5a2b,
        rungColor: 0xcd853f
      });
    }

    buildFortress(-22, 0, true);
    buildFortress(22, 0, false);

    // ==========================================
    // ZONA CENTRAL: CAMPO ABIERTO CON COBERTURAS
    // ==========================================
    const coverWoodMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    function placeWoodCover(cx, cz, width, height, rotY = 0) {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.6), coverWoodMat);
      cover.position.set(cx, height / 2, cz);
      cover.rotation.y = rotY;
      root.add(cover);
      if (scene && scene !== root) scene.add(cover);

      const colW = (rotY === 0) ? width : 0.6;
      const colD = (rotY === 0) ? 0.6 : width;
      addCollider(cx, height / 2, cz, colW, height, colD);
    }

    placeWoodCover(0, 5, 6.0, 1.8, 0);
    placeWoodCover(0, -5, 6.0, 1.8, 0);
    placeWoodCover(-8, 0, 4.5, 1.8, Math.PI / 2);
    placeWoodCover(8, 0, 4.5, 1.8, Math.PI / 2);

    // Cajas de pertrechos de madera en el centro
    const crateMat = new THREE.MeshLambertMaterial({ color: 0xcd853f });
    function placeCrate(x, y, z, size = 1.8) {
      const cr = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
      cr.position.set(x, y + size / 2, z);
      root.add(cr);
      if (scene && scene !== root) scene.add(cr);
      addCollider(x, y + size / 2, z, size, size, size);
    }

    placeCrate(-3.5, 0, 0, 2.0);
    placeCrate(3.5, 0, 0, 2.0);
    placeCrate(-3.5, 2.0, 0, 1.8);
  }

  // ---------------------------------------------------------------------------
  
  // ---------------------------------------------------------------------------
  // MAPA 4: FEEDLOT (Instalación Militar con bloques beige, puentes, tuberías)
  // Basado fielmente en la captura de pantalla de Shell Shockers Feedlot
  // ---------------------------------------------------------------------------
  function buildFeedlot(scene, root, addCollider, addLadder) {
    const half = 38;
    if (scene.background) scene.background.set(0x8cb8d0);
    if (scene.fog) {
      scene.fog.color.set(0x8cb8d0);
      scene.fog.near = 40;
      scene.fog.far = 140;
    }

    // Suelo de hormigón claro/gris azulado (#95a5a6)
    const floorGeo = new THREE.PlaneGeometry(half * 2, half * 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x95a5a6, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
    if (scene && scene !== root) scene.add(floor);

    // Muros perimetrales
    const wallH = 6.0, wallT = 1.0;
    const perimMat = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
    [
      { w: half * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: -half },
      { w: half * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: half },
      { w: wallT, h: wallH, d: half * 2, x: half, y: wallH / 2, z: 0 },
      { w: wallT, h: wallH, d: half * 2, x: -half, y: wallH / 2, z: 0 },
    ].forEach(cfg => {
      const wMesh = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), perimMat);
      wMesh.position.set(cfg.x, cfg.y, cfg.z);
      root.add(wMesh);
      if (scene && scene !== root) scene.add(wMesh);
      addCollider(cfg.x, cfg.y, cfg.z, cfg.w, cfg.h, cfg.d);
    });

    // Materiales de bloques militares Shell Shockers (Amarillo pálido / arena militar #d8c89d)
    const sandBlockMat = new THREE.MeshLambertMaterial({ color: 0xd8c89d });
    const steelBarMat  = new THREE.MeshLambertMaterial({ color: 0x34495e });
    const pipeMat      = new THREE.MeshLambertMaterial({ color: 0xbdc3c7 });
    const bannerBlueMat= new THREE.MeshLambertMaterial({ color: 0x2980b9 });
    const bannerWhiteMat=new THREE.MeshLambertMaterial({ color: 0xecf0f1 });

    function placeBlock(x, y, z, w, h, d) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sandBlockMat);
      b.position.set(x, y + h / 2, z);
      b.castShadow = true;
      b.receiveShadow = true;
      root.add(b);
      if (scene && scene !== root) scene.add(b);
      addCollider(x, y + h / 2, z, w, h, d);
    }

    // 1. ESTRUCTURA CENTRAL ELEVADA (Bloques cúbicos modulares de la imagen 2)
    // Plataforma central baja (3.2m de alto)
    placeBlock(0, 0, 0, 7.0, 3.2, 7.0);

    // Valla protectora de acero en el borde de la plataforma
    const railMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.7, 0.2), railMat);
    rail1.position.set(0, 3.55, 3.4);
    root.add(rail1); if (scene) scene.add(rail1);
    addCollider(0, 3.55, 3.4, 7.0, 0.7, 0.2);

    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.7, 0.2), railMat);
    rail2.position.set(0, 3.55, -3.4);
    root.add(rail2); if (scene) scene.add(rail2);
    addCollider(0, 3.55, -3.4, 7.0, 0.7, 0.2);

    // Pasarela de tubería superior y dintel (como en la captura)
    placeBlock(0, 4.8, 0, 14.0, 1.2, 3.6);

    // Tuberías metálicas cilíndricas que corren por debajo del dintel
    const pipeGeo = new THREE.CylinderGeometry(0.32, 0.32, 12, 12);
    const pipe1 = new THREE.Mesh(pipeGeo, pipeMat);
    pipe1.rotation.z = Math.PI / 2;
    pipe1.position.set(0, 4.2, 1.2);
    root.add(pipe1); if (scene) scene.add(pipe1);

    const pipe2 = new THREE.Mesh(pipeGeo, pipeMat);
    pipe2.rotation.z = Math.PI / 2;
    pipe2.position.set(0, 4.2, -1.2);
    root.add(pipe2); if (scene) scene.add(pipe2);

    // Estandartes de equipo azul con huevo en la esquina (como en la captura 2)
    function createBanner(bx, by, bz, rotY) {
      const bg = new THREE.Group();
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.05), bannerBlueMat);
      bg.add(flag);
      // Huevo blanco en el estandarte
      const eggBadge = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), bannerWhiteMat);
      eggBadge.scale.set(0.8, 1.1, 0.2);
      eggBadge.position.z = 0.04;
      bg.add(eggBadge);
      bg.position.set(bx, by, bz);
      bg.rotation.y = rotY;
      root.add(bg);
      if (scene) scene.add(bg);
    }
    createBanner(-6.5, 4.5, 3.6, 0);
    createBanner(-6.5, 4.5, -3.6, Math.PI);
    createBanner(6.5, 4.5, 3.6, 0);

    // Escalera vertical que sube al dintel (operativa con el sistema de trepado)
    createLadder(scene, root, addLadder, {
      x: 0,
      z: 3.5,
      startY: 0,
      height: 4.8,
      rotY: 0,
      color: 0x95a5a6,
      rungColor: 0xecf0f1,
      isMetal: true
    });

    // Escalera trasera
    createLadder(scene, root, addLadder, {
      x: 0,
      z: -3.5,
      startY: 0,
      height: 4.8,
      rotY: Math.PI,
      color: 0x95a5a6,
      rungColor: 0xecf0f1,
      isMetal: true
    });

    // 2. EDIFICIOS Y TORRES LATERALES (Casas de bloques modulares)
    // Torre Norte (X=0, Z=-16)
    placeBlock(0, 0, -18, 10, 4.5, 6);
    placeBlock(0, 4.5, -18, 6, 3.2, 5);
    createLadder(scene, root, addLadder, { x: 3.5, z: -15, startY: 0, height: 4.5, rotY: 0, isMetal: true });

    // Torre Sur (X=0, Z=18)
    placeBlock(0, 0, 18, 10, 4.5, 6);
    placeBlock(0, 4.5, 18, 6, 3.2, 5);
    createLadder(scene, root, addLadder, { x: -3.5, z: 15, startY: 0, height: 4.5, rotY: Math.PI, isMetal: true });

    // Pasarelas elevadas y Jump-Pads en la base
    const padMat = new THREE.MeshLambertMaterial({ color: 0x1abc9c });
    function placeJumpPad(px, pz) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.35, 16), padMat);
      pad.position.set(px, 0.18, pz);
      root.add(pad); if (scene) scene.add(pad);
      addCollider(px, 0.18, pz, 2.4, 0.35, 2.4);
    }
    placeJumpPad(-4.5, 5.0);
    placeJumpPad(4.5, 5.0);
    placeJumpPad(-4.5, -5.0);
    placeJumpPad(4.5, -5.0);

    // Hueveras tácticas decorativas en Feedlot
    createEggCarton(10, 0, 8, 0);
    createEggCarton(-10, 0, -8, Math.PI / 3);
  }

  // ---------------------------------------------------------------------------
  // MAPA 5: CASTLE / RUINS (Fortaleza Medieval, Almenas, Antorchas y Escalinatas)
  // Basado fielmente en la captura de pantalla de Shell Shockers Castle
  // ---------------------------------------------------------------------------
  function buildCastle(scene, root, addCollider, addLadder) {
    const half = 36;
    if (scene.background) scene.background.set(0x7f8c8d);
    if (scene.fog) {
      scene.fog.color.set(0x7f8c8d);
      scene.fog.near = 35;
      scene.fog.far = 130;
    }

    // Suelo verde musgo / tierra húmeda medieval
    const floorGeo = new THREE.PlaneGeometry(half * 2, half * 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x5d6d7e, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
    if (scene && scene !== root) scene.add(floor);

    // Patio central de césped (#556b2f)
    const lawnMat = new THREE.MeshLambertMaterial({ color: 0x556b2f, side: THREE.DoubleSide });
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), lawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = 0.02;
    root.add(lawn); if (scene) scene.add(lawn);

    // Muros perimetrales almenados
    const wallH = 6.0, wallT = 1.2;
    const stoneBrickMat = new THREE.MeshLambertMaterial({ color: 0xbdc3c7 });
    const darkStoneMat  = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
    const torchWoodMat  = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const fireMat       = new THREE.MeshBasicMaterial({ color: 0xe67e22 });

    [
      { w: half * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: -half },
      { w: half * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: half },
      { w: wallT, h: wallH, d: half * 2, x: half, y: wallH / 2, z: 0 },
      { w: wallT, h: wallH, d: half * 2, x: -half, y: wallH / 2, z: 0 },
    ].forEach(cfg => {
      const wMesh = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), stoneBrickMat);
      wMesh.position.set(cfg.x, cfg.y, cfg.z);
      root.add(wMesh); if (scene) scene.add(wMesh);
      addCollider(cfg.x, cfg.y, cfg.z, cfg.w, cfg.h, cfg.d);
    });

    // 1. FORTALEZA CENTRAL CON ARCO DE ENTRADA Y ALMENAS (Imagen 3)
    // Torre central
    const keepW = 12, keepD = 10, keepH = 5.0;
    // Pilares laterales del arco
    const pilarL = new THREE.Mesh(new THREE.BoxGeometry(4.0, keepH, keepD), stoneBrickMat);
    pilarL.position.set(-4.0, keepH / 2, 0);
    root.add(pilarL); if (scene) scene.add(pilarL);
    addCollider(-4.0, keepH / 2, 0, 4.0, keepH, keepD);

    const pilarR = new THREE.Mesh(new THREE.BoxGeometry(4.0, keepH, keepD), stoneBrickMat);
    pilarR.position.set(4.0, keepH / 2, 0);
    root.add(pilarR); if (scene) scene.add(pilarR);
    addCollider(4.0, keepH / 2, 0, 4.0, keepH, keepD);

    // Dintel del arco
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.4, keepD), stoneBrickMat);
    lintel.position.set(0, keepH - 0.7, 0);
    root.add(lintel); if (scene) scene.add(lintel);
    addCollider(0, keepH - 0.7, 0, 4.5, 1.4, keepD);

    // Techo / Planta alta accesible
    const keepRoof = new THREE.Mesh(new THREE.BoxGeometry(keepW, 0.6, keepD), darkStoneMat);
    keepRoof.position.set(0, keepH + 0.3, 0);
    root.add(keepRoof); if (scene) scene.add(keepRoof);
    addCollider(0, keepH + 0.3, 0, keepW, 0.6, keepD);

    // Almenas del tejado
    function makeCrenels(cx, cz, width, isX) {
      const segs = Math.floor(width / 1.8);
      for (let i = 0; i <= segs; i++) {
        const off = (i - segs / 2) * 1.8;
        const cren = new THREE.Mesh(new THREE.BoxGeometry(isX ? 1.0 : 0.6, 1.0, isX ? 0.6 : 1.0), stoneBrickMat);
        cren.position.set(isX ? cx + off : cx, keepH + 1.1, isX ? cz : cz + off);
        root.add(cren); if (scene) scene.add(cren);
        addCollider(cren.position.x, cren.position.y, cren.position.z, isX ? 1.0 : 0.6, 1.0, isX ? 0.6 : 1.0);
      }
    }
    makeCrenels(0, keepD / 2, keepW, true);
    makeCrenels(0, -keepD / 2, keepW, true);
    makeCrenels(-keepW / 2, 0, keepD, false);
    makeCrenels(keepW / 2, 0, keepD, false);

    // Estandartes medievales en las torres (Rojos y Azules como en la imagen 3)
    function placeCastleBanner(bx, by, bz, isRed) {
      const g = new THREE.Group();
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.8, 0.06), new THREE.MeshLambertMaterial({ color: isRed ? 0xc0392b : 0x2980b9 }));
      g.add(flag);
      const eggBadge = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), new THREE.MeshLambertMaterial({ color: 0xecf0f1 }));
      eggBadge.scale.set(0.8, 1.1, 0.2);
      eggBadge.position.z = 0.04;
      g.add(eggBadge);
      g.position.set(bx, by, bz);
      root.add(g); if (scene) scene.add(g);
    }
    placeCastleBanner(-2.0, keepH + 2.2, keepD / 2 + 0.1, false);
    placeCastleBanner(2.0, keepH + 2.2, keepD / 2 + 0.1, true);

    // Antorchas con fuego encendido (como en la captura 3)
    function placeTorch(tx, ty, tz) {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), torchWoodMat);
      stick.rotation.z = 0.2;
      g.add(stick);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 6), fireMat);
      flame.position.set(0.1, 0.45, 0);
      g.add(flame);
      g.position.set(tx, ty, tz);
      root.add(g); if (scene) scene.add(g);
    }
    placeTorch(-4.8, 2.2, keepD / 2 + 0.2);
    placeTorch(4.8, 2.2, keepD / 2 + 0.2);
    placeTorch(-4.8, 2.2, -keepD / 2 - 0.2);
    placeTorch(4.8, 2.2, -keepD / 2 - 0.2);

    // 2. ESCALINATAS MONUMENTALES DE PIEDRA (Stairs como en la captura 3)
    function buildStoneStairs(sx, sz, width, steps, stepH, stepD, rotY) {
      const g = new THREE.Group();
      for (let i = 0; i < steps; i++) {
        const h = (i + 1) * stepH;
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(width, stepH, stepD), stoneBrickMat);
        stepMesh.position.set(0, h - stepH / 2, i * stepD);
        g.add(stepMesh);
      }
      g.position.set(sx, 0, sz);
      g.rotation.y = rotY;
      root.add(g); if (scene) scene.add(g);
      // Rampa colisionadora suave
      const totalD = steps * stepD;
      const totalH = steps * stepH;
      addCollider(sx, totalH / 2, sz + (rotY === 0 ? totalD / 2 : -totalD / 2), width, totalH, totalD);
    }
    buildStoneStairs(0, keepD / 2 + 2, 5.0, 6, 0.45, 0.65, 0);
    buildStoneStairs(0, -keepD / 2 - 2, 5.0, 6, 0.45, 0.65, Math.PI);

    // Escaleras de mano para subir a las almenas superiores
    createLadder(scene, root, addLadder, {
      x: -keepW / 2 + 0.6,
      z: 0,
      startY: 0,
      height: keepH + 0.5,
      rotY: Math.PI / 2,
      color: 0x5a6268,
      rungColor: 0xecf0f1,
      isMetal: true
    });
  }

  // ---------------------------------------------------------------------------
// INTERFAZ PÚBLICA
  // ---------------------------------------------------------------------------
  return {
    buildMap: function (mapName, scene, root, addCollider, addLadder) {
      if (mapName === 'space') {
        buildSpace(scene, root, addCollider, addLadder);
      } else if (mapName === 'fort') {
        buildFort(scene, root, addCollider, addLadder);
      } else if (mapName === 'feedlot') {
        buildFeedlot(scene, root, addCollider, addLadder);
      } else if (mapName === 'castle') {
        buildCastle(scene, root, addCollider, addLadder);
      } else {
        buildDirt(scene, root, addCollider, addLadder);
      }
    },
  };
})();
