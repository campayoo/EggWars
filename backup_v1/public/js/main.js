// ============================================================================
// main.js — Cliente FPS Shell Shockers Oficial 3D
// Físicas de escaleras AABB robustas, animaciones multicapa articuladas,
// mapas oficiales (Dirt, Space, Fort) y HUD fiel de Shell Shockers.
// ============================================================================

(function () {
  'use strict';

  // =========================================================================
  // 1. CONSTANTES Y CONFIGURACIÓN DE ARMAS (OFICIALES SHELL SHOCKERS)
  // =========================================================================

  const MOVE_SPEED_MAX    = 7.6;
  const ACCELERATION      = 52.0;
  const FRICTION          = 15.0;
  const CLIMB_SPEED       = 4.8;
  const MOUSE_SENSITIVITY = 0.0022;
  const JUMP_VELOCITY     = 9.6;
  let   GRAVITY           = -24.0;
  const PLAYER_HEIGHT     = 1.6;
  const PLAYER_RADIUS     = 0.52;
  const LERP_FACTOR       = 0.22;
  const GRENADE_CD_MS     = 7000;

  // Estadísticas exactas de Shell Shockers
  const WEAPON_CONFIGS = {
    rifle: {
      name: 'EggK-47',
      icon: '🔫',
      cooldown: 110, // Rápido automático (110ms)
      damage: 22,
      pellets: 1,
      spread: 0.014,
      maxAmmo: 30,
      reloadTime: 1350,
      tracerColor: 0xffdd00,
      tracerWidth: 1.5,
    },
    shotgun: {
      name: 'Scrambler',
      icon: '💥',
      cooldown: 750,
      damage: 17,
      pellets: 6,
      spread: 0.075,
      maxAmmo: 6,
      reloadTime: 1700,
      tracerColor: 0xff6b35,
      tracerWidth: 2,
    },
    sniper: {
      name: 'Free RANGER',
      icon: '🎯',
      cooldown: 1300,
      damage: 85,
      pellets: 1,
      spread: 0.0008,
      maxAmmo: 5,
      reloadTime: 2100,
      tracerColor: 0x00d2d3,
      tracerWidth: 3.5,
    },
  };

  const WEAPON_KEYS = ['rifle', 'shotgun', 'sniper'];

  // =========================================================================
  // 2. EFECTOS DE SONIDO SINTETIZADOS WEB AUDIO API (Shell Shockers Sounds)
  // =========================================================================

  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'rifle') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'shotgun') {
        const bufferSize = ctx.sampleRate * 0.22;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (type === 'sniper') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.38);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.38);
      } else if (type === 'explosion') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.55);
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (type === 'hit') {
        // "Crack" de cáscara impactada
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(220, now + 0.04);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'headshot' || type === 'kill') {
        // Sonido cómico "Cluck / Crack" de victoria
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1600, now + 0.06);
        osc.frequency.setValueAtTime(2000, now + 0.12);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'jump') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'reload') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      }
    } catch (e) {
      // Audio seguro
    }
  }

  // =========================================================================
  // 3. VARIABLES GLOBALES DE THREE.JS Y DEL JUEGO
  // =========================================================================

  let scene, camera, renderer, clock;
  let socket;
  let myId = null;
  let myTeam = null;
  let isInGame = false;
  let isPaused = false;
  let isAlive = true;
  let myHP = 100;
  let myKills = 0;
  let myDeaths = 0;

  // Armas y munición
  let currentWeapon = 'rifle';
  let lastShootTime = 0;
  let lastGrenadeTime = 0;
  const ammoState = {
    rifle: 30,
    shotgun: 6,
    sniper: 5,
  };
  let isReloading = false;
  let reloadTimeout = null;

  // Controles y ADS
  let isPointerLocked = false;
  let isMouseDown = false;
  let isAiming = false;
  let isChatting = false;
  let mouseSensitivityFactor = 1.0;
  const BASE_FOV = 75;
  let currentFov = 75;
  const HIP_FIRE_POS = new THREE.Vector3(0.28, -0.26, -0.46);
  const ADS_POS      = new THREE.Vector3(0.0, -0.19, -0.34);

  // Físicas, Inercia y Escaleras (AABB Trigger Volumes)
  const mapLadders   = []; // Array de { minX, maxX, minY, maxY, minZ, maxZ, cx, cz }
  const velocityXZ   = new THREE.Vector2(0, 0);
  let velocityY      = 0;
  let isOnGround     = true;
  let isOnLadder     = false;

  // Animaciones de retroceso y balanceo
  let recoilOffsetZ  = 0;
  let recoilRotX     = 0;
  let swayTime       = 0;

  // Rotaciones y posición del jugador local
  const keys = {};
  let yaw = 0;
  let pitch = 0;
  const localPos = new THREE.Vector3(0, 0, 0);

  // Modelos FPS y entidades remotas
  let fpsWeapons = {};
  let activeFPSWeaponGroup = null;
  const remotePlayers = {}; // { id: { mesh, bodyGroup, headPitchGroup, gunGroup, targetPos, targetRotY, targetPitchX, animTime, ... } }
  const activeGrenades = {};
  const mapColliders = [];
  let mapRootGroup = null;
  let currentConfig = { mode: 'ffa', map: 'dirt', killLimit: 25 };

  // =========================================================================
  // 4. ELEMENTOS DEL DOM
  // =========================================================================

  const menuOverlay        = document.getElementById('menu-overlay');
  const nicknameInput      = document.getElementById('nickname-input');
  const joinBtn            = document.getElementById('join-btn');
  const colorPicker        = document.getElementById('color-picker');
  const hatSelect          = document.getElementById('hat-select');
  const glassesSelect      = document.getElementById('glasses-select');
  const configStatus       = document.getElementById('config-status');

  const deathOverlay       = document.getElementById('death-overlay');
  const killedByText       = document.getElementById('killed-by-text');
  const gameoverOverlay    = document.getElementById('gameover-overlay');
  const gameoverText       = document.getElementById('gameover-text');
  const pauseOverlay       = document.getElementById('pause-overlay');
  const resumeBtn          = document.getElementById('resume-btn');
  const exitLobbyBtn       = document.getElementById('exit-lobby-btn');
  const scoreboardOverlay  = document.getElementById('scoreboard-overlay');
  const scoreboardEntries  = document.getElementById('scoreboard-entries');
  const sbGameInfo          = document.getElementById('sb-game-info');

  const hudEl              = document.getElementById('hud');
  const crosshairEl        = document.getElementById('crosshair');
  const hitmarkerEl        = document.getElementById('hitmarker');
  const healthBar          = document.getElementById('health-bar');
  const healthText         = document.getElementById('health-text');
  const killCountEl        = document.getElementById('kill-count');
  const deathCountEl       = document.getElementById('death-count');
  const teamScoreEl        = document.getElementById('team-score');
  const teamRedScoreEl     = document.getElementById('team-red-score');
  const teamBlueScoreEl    = document.getElementById('team-blue-score');
  const killFeedEl         = document.getElementById('kill-feed');
  const damageFlash        = document.getElementById('damage-flash');
  const grenadeCdCircle    = document.getElementById('grenade-cd-circle');
  const activeWeaponName   = document.getElementById('active-weapon-name');
  const ammoBulletIcons    = document.getElementById('ammo-bullet-icons');
  const ammoCurrentEl       = document.getElementById('ammo-current');
  const ammoMaxEl           = document.getElementById('ammo-max');
  const reloadHint         = document.getElementById('reload-hint');
  const chatBarContainer    = document.getElementById('chat-bar-container');
  const chatInput           = document.getElementById('chat-input');
  const centerToast         = document.getElementById('center-toast');
  const mouseSensSlider     = document.getElementById('mouse-sens-slider');
  const sensValueText       = document.getElementById('sens-value-text');

  // Texture painter
  const textureCanvas      = document.getElementById('texture-canvas');
  let   textureCtx         = textureCanvas ? textureCanvas.getContext('2d') : null;
  const brushColorInput    = document.getElementById('brush-color');
  const brushSizeInput     = document.getElementById('brush-size');
  const painterClearBtn    = document.getElementById('painter-clear');

  // =========================================================================
  // 5. TEXTURE PAINTER
  // =========================================================================

  let isPainting = false;
  let hasDrawnCustomTexture = false;

  function initTexturePainter() {
    if (!textureCanvas || !textureCtx) return; // canvas no presente en el DOM todavía
    textureCtx.fillStyle = '#ffffff';
    textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
    drawEggTemplateGuides();

    function getCoords(e) {
      const rect = textureCanvas.getBoundingClientRect();
      const scaleX = textureCanvas.width / rect.width;
      const scaleY = textureCanvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    textureCanvas.addEventListener('mousedown', (e) => {
      isPainting = true;
      hasDrawnCustomTexture = true;
      const { x, y } = getCoords(e);
      paintAt(x, y);
      if (typeof updatePreviewAvatar === 'function') updatePreviewAvatar();
    });

    window.addEventListener('mouseup', () => { isPainting = false; });

    textureCanvas.addEventListener('mousemove', (e) => {
      if (!isPainting) return;
      const { x, y } = getCoords(e);
      paintAt(x, y);
      if (typeof updatePreviewAvatar === 'function') updatePreviewAvatar();
    });

    if (painterClearBtn) painterClearBtn.addEventListener('click', () => {
      hasDrawnCustomTexture = false;
      textureCtx.fillStyle = '#ffffff';
      textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
      drawEggTemplateGuides();
      if (typeof updatePreviewAvatar === 'function') updatePreviewAvatar();
    });
  }

  function drawEggTemplateGuides() {
    if (!textureCtx) return;
    textureCtx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    textureCtx.lineWidth = 1;
    textureCtx.strokeRect(26, 42, 24, 24);
    textureCtx.strokeRect(78, 42, 24, 24);
    textureCtx.strokeRect(40, 84, 48, 16);
  }

  function paintAt(x, y) {
    if (!textureCtx || !brushColorInput || !brushSizeInput) return;
    textureCtx.fillStyle = brushColorInput.value;
    textureCtx.beginPath();
    textureCtx.arc(x, y, parseInt(brushSizeInput.value, 10), 0, Math.PI * 2);
    textureCtx.fill();
  }

  function getCustomTextureDataURL() {
    if (!hasDrawnCustomTexture || !textureCanvas) return null;
    return textureCanvas.toDataURL('image/png');
  }

  // =========================================================================
  // 6. INICIALIZACIÓN DE THREE.JS
  // =========================================================================

  function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 45, 120);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 260);
    camera.position.set(0, PLAYER_HEIGHT, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Iluminación vívida
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffaed, 0.9);
    sun.position.set(32, 60, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 160;
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.35);
    scene.add(hemi);

    // Contenedor para el mapa
    mapRootGroup = new THREE.Group();
    scene.add(mapRootGroup);

    // Modelado de armas FPS en cámara
    buildFPSWeapons();

    // Cargar mapa inicial (Dirt por defecto)
    loadMap('dirt');

    window.addEventListener('resize', onWindowResize);
  }

  // =========================================================================
  // 7. GESTIÓN DE MAPAS Y VOLÚMENES AABB DE ESCALERAS
  // =========================================================================

  function addCollider(x, y, z, w, h, d) {
    mapColliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minY: y - h / 2, maxY: y + h / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
    });
  }

  function addLadder(x, y, z, w, h, d) {
    mapLadders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minY: y - h / 2, maxY: y + h / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      cx: x, cz: z,
    });
  }

  function checkLadderCollision(pos) {
    const pMinX = pos.x - PLAYER_RADIUS * 0.7;
    const pMaxX = pos.x + PLAYER_RADIUS * 0.7;
    const pMinY = pos.y;
    const pMaxY = pos.y + PLAYER_HEIGHT;
    const pMinZ = pos.z - PLAYER_RADIUS * 0.7;
    const pMaxZ = pos.z + PLAYER_RADIUS * 0.7;

    for (let i = 0; i < mapLadders.length; i++) {
      const lad = mapLadders[i];
      if (
        pMaxX >= lad.minX && pMinX <= lad.maxX &&
        pMaxY >= lad.minY && pMinY <= lad.maxY &&
        pMaxZ >= lad.minZ && pMinZ <= lad.maxZ
      ) {
        return lad;
      }
    }
    return null;
  }

  function clearCurrentMap() {
    while (mapRootGroup.children.length > 0) {
      const obj = mapRootGroup.children[0];
      mapRootGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    mapColliders.length = 0;
    mapLadders.length = 0;
  }

  function loadMap(mapName) {
    clearCurrentMap();
    console.log('[MAP] Cargando mapa:', mapName, '| GameMaps disponible:', !!window.GameMaps);
    if (window.GameMaps && window.GameMaps.buildMap) {
      window.GameMaps.buildMap(mapName, scene, mapRootGroup, addCollider, addLadder);
      console.log('[MAP] Mapa cargado. Objetos en escena:', scene.children.length, '| Colisores:', mapColliders.length);
    } else {
      console.error('[MAP] ERROR: window.GameMaps no está disponible. Comprueba que maps.js se carga antes de main.js');
    }
    // Ajustar gravedad si es Space
    if (mapName === 'space') {
      GRAVITY = -11.0;
    } else {
      GRAVITY = -24.0;
    }
    currentConfig.map = mapName;
    updateLobbyUI();
  }

  // =========================================================================
  // 8. MODELADO DE ARMAS EN PRIMERA PERSONA (FPS HANDS & WEAPONS)
  // =========================================================================

  function buildFPSWeapons() {
    fpsWeapons = {
      rifle:   buildFPSRifle(),
      shotgun: buildFPSShotgun(),
      sniper:  buildFPSSniper(),
    };

    WEAPON_KEYS.forEach(k => {
      camera.add(fpsWeapons[k]);
      fpsWeapons[k].visible = (k === currentWeapon);
    });
    activeFPSWeaponGroup = fpsWeapons[currentWeapon];
    scene.add(camera);
  }

  function buildFPSRifle() {
    const group = new THREE.Group();
    // Cañón
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.55), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    barrel.position.set(0, 0, -0.28);
    // Cuerpo / Receptor EggK-47 con culata de madera estilo clásico
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.32), new THREE.MeshLambertMaterial({ color: 0x8b4513 }));
    body.position.set(0, 0, 0.05);
    // Cargador curvado
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    mag.position.set(0, -0.12, -0.05);
    mag.rotation.x = -0.25;
    // Mano de huevo blanca que sujeta el arma
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    hand.scale.set(1, 1.2, 1);
    hand.position.set(-0.06, -0.06, 0.05);

    group.add(barrel, body, mag, hand);

    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfff200, transparent: true, opacity: 0 }));
    flash.position.set(0, 0, -0.6);
    flash.name = 'flash';
    group.add(flash);

    group.position.copy(HIP_FIRE_POS);
    return group;
  }

  function buildFPSShotgun() {
    const group = new THREE.Group();
    // Doble cañón superpuesto Scrambler
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.48, 8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    b1.rotation.x = Math.PI / 2;
    b1.position.set(-0.03, 0.02, -0.24);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.48, 8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    b2.rotation.x = Math.PI / 2;
    b2.position.set(0.03, 0.02, -0.24);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.28), new THREE.MeshLambertMaterial({ color: 0xcd853f }));
    stock.position.set(0, -0.02, 0.05);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    hand.scale.set(1, 1.2, 1);
    hand.position.set(0.06, -0.05, -0.05);

    group.add(b1, b2, stock, hand);

    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0 }));
    flash.position.set(0, 0.02, -0.52);
    flash.name = 'flash';
    group.add(flash);

    group.position.copy(HIP_FIRE_POS);
    return group;
  }

  function buildFPSSniper() {
    const group = new THREE.Group();
    // Cañón extra largo Free RANGER
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.85), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    barrel.position.set(0, 0, -0.44);

    // Mira telescópica cilíndrica grande
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), new THREE.MeshLambertMaterial({ color: 0x00d2d3 }));
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.095, -0.16);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.38), new THREE.MeshLambertMaterial({ color: 0x2f3542 }));
    body.position.set(0, 0, 0.05);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    hand.scale.set(1, 1.2, 1);
    hand.position.set(-0.06, -0.06, 0.05);

    group.add(barrel, scope, body, hand);

    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0x48dbfb, transparent: true, opacity: 0 }));
    flash.position.set(0, 0, -0.9);
    flash.name = 'flash';
    group.add(flash);

    group.position.copy(HIP_FIRE_POS);
    return group;
  }

  function updateAmmoHUD() {
    const config = WEAPON_CONFIGS[currentWeapon];
    if (!config) return;

    if (activeWeaponName) activeWeaponName.textContent = config.name;
    if (ammoCurrentEl) ammoCurrentEl.textContent = ammoState[currentWeapon];
    // Shell Shockers estilo: reserva de munición (ej: 240)
    const reserveAmmo = config.maxAmmo * 8;
    if (ammoMaxEl) ammoMaxEl.textContent = reserveAmmo;

    // Generar iconos de balas
    if (ammoBulletIcons) {
      ammoBulletIcons.innerHTML = '';
      const total = config.maxAmmo;
      const current = ammoState[currentWeapon];
      for (let i = 0; i < total; i++) {
        const bullet = document.createElement('div');
        bullet.className = 'ammo-bullet' + (i >= current ? ' spent' : '');
        ammoBulletIcons.appendChild(bullet);
      }
    }

    if (reloadHint && !isReloading) {
      reloadHint.classList.toggle('hidden', ammoState[currentWeapon] > 0);
    }
  }

  function reloadWeapon() {
    const config = WEAPON_CONFIGS[currentWeapon];
    if (isReloading || ammoState[currentWeapon] >= config.maxAmmo) return;

    isReloading = true;
    playSound('reload');
    if (reloadHint) {
      reloadHint.textContent = 'RECARGANDO...';
      reloadHint.classList.remove('hidden');
    }

    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
      ammoState[currentWeapon] = config.maxAmmo;
      isReloading = false;
      if (reloadHint) {
        reloadHint.textContent = 'PULSA [R] PARA RECARGAR';
        reloadHint.classList.add('hidden');
      }
      updateAmmoHUD();
    }, config.reloadTime);
  }

  function selectWeapon(weaponKey) {
    if (!WEAPON_CONFIGS[weaponKey]) return;
    currentWeapon = weaponKey;

    WEAPON_KEYS.forEach(k => {
      if (fpsWeapons[k]) fpsWeapons[k].visible = (k === weaponKey);
    });
    activeFPSWeaponGroup = fpsWeapons[weaponKey];

    // Actualizar botones y tarjetas de selector
    document.querySelectorAll('.weapon-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.weapon === weaponKey);
    });
    document.querySelectorAll('.class-card').forEach(card => {
      card.classList.toggle('active', card.dataset.weapon === weaponKey);
    });

    // Actualizar preview en el lobby
    const iconEl = document.getElementById('lobby-weapon-icon');
    const nameEl = document.getElementById('lobby-weapon-name');
    if (iconEl && WEAPON_CONFIGS[weaponKey]) iconEl.textContent = WEAPON_CONFIGS[weaponKey].icon || '🔫';
    if (nameEl && WEAPON_CONFIGS[weaponKey]) nameEl.textContent = `${WEAPON_CONFIGS[weaponKey].name}`;

    updateAmmoHUD();

    if (socket && isInGame) {
      socket.emit('player:weapon-switch', { weapon: weaponKey });
    }
  }

  // =========================================================================
  // 9. MODELADO DE AVATARES DE HUEVO (JERARQUÍA MULTICAPA ARTICULADA)
  // =========================================================================

  function createPlayerModel(playerData) {
    const root = new THREE.Group();

    let eggColor = playerData.color || '#ffffff';
    if (currentConfig.mode === 'tdm' && playerData.team) {
      eggColor = playerData.team === 'red' ? '#e74c3c' : '#3498db';
    }

    let eggMat;
    if (playerData.textureData) {
      const img = new Image();
      img.src = playerData.textureData;
      const texture = new THREE.Texture(img);
      img.onload = () => { texture.needsUpdate = true; };
      eggMat = new THREE.MeshLambertMaterial({ map: texture, color: eggColor, roughness: 0.5 });
    } else {
      eggMat = new THREE.MeshLambertMaterial({ color: eggColor, roughness: 0.5 });
    }

    // 1. Nodo CUERPO (Huevo elipsoide con pivot en el centro)
    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'player-body-group';
    root.add(bodyGroup);

    const eggGeo = new THREE.SphereGeometry(0.52, 14, 14);
    const eggMesh = new THREE.Mesh(eggGeo, eggMat);
    eggMesh.scale.set(1.0, 1.35, 1.0);
    eggMesh.position.y = 0.95;
    eggMesh.castShadow = true;
    bodyGroup.add(eggMesh);

    // 2. Nodo PIVOTE DE CABEZA / ROSTRO (Inclinación Pitch X al mirar arriba/abajo)
    const headPitchGroup = new THREE.Group();
    headPitchGroup.name = 'head-pitch-group';
    headPitchGroup.position.set(0, 1.25, 0); // Altura de ojos / rostro
    bodyGroup.add(headPitchGroup);

    // Ojos estilo Shell Shockers
    const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.16, 0.08, -0.42);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(-0.16, 0.08, -0.5);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.16, 0.08, -0.42);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(0.16, 0.08, -0.5);

    headPitchGroup.add(eyeL, pupilL, eyeR, pupilR);

    // Accesorios
    attachHat(headPitchGroup, playerData.hat);
    attachGlasses(headPitchGroup, playerData.glasses);

    // Hitbox precisa para Headshot (articulada en la cabeza móvil)
    const headHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.85, 0.85),
      new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
    );
    headHitbox.position.set(0, 0.12, -0.05);
    headHitbox.name = 'hitbox-head';
    headPitchGroup.add(headHitbox);

    // 3. Nodo MANOS Y ARMA EXTERIOR (Flotando lateralmente e inclinándose con el pitch)
    const gunGroup = new THREE.Group();
    gunGroup.name = 'gun-external';
    gunGroup.position.set(0.55, 1.0, -0.2);
    const extGunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
    );
    gunGroup.add(extGunMesh);
    bodyGroup.add(gunGroup);

    // Hitbox para impactos en el cuerpo
    const hitboxGeo = new THREE.BoxGeometry(1.15, 1.5, 1.15);
    const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 }));
    hitbox.position.y = 0.85;
    hitbox.name = 'hitbox';
    root.add(hitbox);

    // Nombre y barra flotante
    const nameSprite = createNameSprite(playerData.nickname, playerData.team);
    nameSprite.name = 'name-sprite';
    root.add(nameSprite);

    return root;
  }

  function attachHat(headGroup, hatType) {
    const oldHat = headGroup.getObjectByName('accessory-hat');
    if (oldHat) headGroup.remove(oldHat);
    if (!hatType || hatType === 'none') return;

    const hatGroup = new THREE.Group();
    hatGroup.name = 'accessory-hat';

    if (hatType === 'tophat') {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.42, 10), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      crown.position.y = 0.55;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 10), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      brim.position.y = 0.36;
      hatGroup.add(crown, brim);
    } else if (hatType === 'helmet') {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4b5320 }));
      helm.position.y = 0.18;
      hatGroup.add(helm);
    } else if (hatType === 'cap') {
      const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe67e22 }));
      capCrown.position.y = 0.18;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.24), new THREE.MeshLambertMaterial({ color: 0xe67e22 }));
      visor.position.set(0, 0.25, -0.34);
      visor.rotation.x = 0.2;
      hatGroup.add(capCrown, visor);
    }

    headGroup.add(hatGroup);
  }

  function attachGlasses(headGroup, glassesType) {
    const oldGlasses = headGroup.getObjectByName('accessory-glasses');
    if (oldGlasses) headGroup.remove(oldGlasses);
    if (!glassesType || glassesType === 'none') return;

    const gGroup = new THREE.Group();
    gGroup.name = 'accessory-glasses';

    if (glassesType === 'sunglasses') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.05), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      frame.position.set(0, 0.08, -0.45);
      gGroup.add(frame);
    } else if (glassesType === 'mask') {
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.05), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
      mask.position.set(0, 0.08, -0.44);
      gGroup.add(mask);
    }

    headGroup.add(gGroup);
  }

  function createNameSprite(text, team) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 44, 12);
    ctx.fill();

    let textColor = '#ffffff';
    if (currentConfig.mode === 'tdm' && team) {
      textColor = team === 'red' ? '#ff6b6b' : '#54a0ff';
    }

    ctx.fillStyle = textColor;
    ctx.font = 'bold 26px "Fredoka One", Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.y = 2.4;
    return sprite;
  }

  function createSpeechBubbleSprite(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 110;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 300, 70, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 22px "Nunito", Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 160, 45);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.0, 1.0, 1);
    sprite.position.y = 3.1;
    return sprite;
  }

  // =========================================================================
  // 10. JUGADORES REMOTOS & SINCRONIZACIÓN
  // =========================================================================

  function addRemotePlayer(playerData) {
    if (playerData.id === myId) return;
    const mesh = createPlayerModel(playerData);
    mesh.position.set(playerData.x || 0, playerData.y || 0, playerData.z || 0);
    scene.add(mesh);

    remotePlayers[playerData.id] = {
      mesh,
      bodyGroup: mesh.getObjectByName('player-body-group'),
      headPitchGroup: mesh.getObjectByName('head-pitch-group'),
      gunGroup: mesh.getObjectByName('gun-external'),
      targetPos: new THREE.Vector3(playerData.x || 0, playerData.y || 0, playerData.z || 0),
      targetRotY: playerData.rotY || 0,
      targetPitchX: playerData.rotX || 0,
      nickname: playerData.nickname || 'Egg',
      team: playerData.team || null,
      alive: playerData.alive !== false,
      isEmoting: false,
      emoteTimer: 0,
      animTime: Math.random() * 10,
    };
  }

  function removeRemotePlayer(id) {
    const rp = remotePlayers[id];
    if (rp && rp.mesh) {
      scene.remove(rp.mesh);
      delete remotePlayers[id];
    }
  }

  // =========================================================================
  // 11. SISTEMA DE DISPARO, HITMARKER Y RETROCESO (RECOIL)
  // =========================================================================

  function shoot() {
    const now = Date.now();
    const config = WEAPON_CONFIGS[currentWeapon];
    if (now - lastShootTime < config.cooldown) return;
    if (ammoState[currentWeapon] <= 0) {
      reloadWeapon();
      return;
    }

    lastShootTime = now;
    ammoState[currentWeapon]--;
    updateAmmoHUD();

    playSound(currentWeapon);
    animateRecoil();

    // Muzzle flash visual
    if (activeFPSWeaponGroup) {
      const flash = activeFPSWeaponGroup.getObjectByName('flash');
      if (flash) {
        flash.material.opacity = 0.9;
        setTimeout(() => { flash.material.opacity = 0; }, 40);
      }
    }

    // Raycasting con dispersión (reducida al apuntar ADS)
    const activeHitboxes = getActiveHitboxes();
    const targetsHit = [];
    const spreadMultiplier = isAiming ? 0.35 : 1.0;

    for (let p = 0; p < config.pellets; p++) {
      const raycaster = new THREE.Raycaster();
      const spreadX = (Math.random() - 0.5) * config.spread * spreadMultiplier;
      const spreadY = (Math.random() - 0.5) * config.spread * spreadMultiplier;

      const dir = new THREE.Vector3(spreadX, spreadY, -1).normalize();
      dir.applyQuaternion(camera.quaternion);
      raycaster.set(camera.position, dir);

      createTracerFromCamera(dir, config.tracerColor, config.tracerWidth);

      const intersects = raycaster.intersectObjects(activeHitboxes.map(h => h.mesh), false);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitObj = hit.object;
        const matched = activeHitboxes.find(h => h.mesh === hitObj);
        if (matched) {
          const isHeadshot = (hitObj.name === 'hitbox-head');
          targetsHit.push({ id: matched.id, headshot: isHeadshot });
          triggerHitmarker(isHeadshot);
          createHitSparks(hit.point);
        }
      }
    }

    if (targetsHit.length > 0) {
      socket.emit('player:shoot', { targets: targetsHit });
    }
  }

  function triggerHitmarker(isHeadshot) {
    if (!hitmarkerEl) return;
    hitmarkerEl.classList.remove('hidden');
    hitmarkerEl.style.animation = 'none';
    void hitmarkerEl.offsetHeight; // Forzar reflow
    hitmarkerEl.style.animation = 'hitFade 0.25s forwards';

    playSound(isHeadshot ? 'headshot' : 'hit');
  }

  function throwGrenade() {
    const now = Date.now();
    if (now - lastGrenadeTime < GRENADE_CD_MS) return;
    lastGrenadeTime = now;

    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(camera.quaternion);

    socket.emit('player:grenade-throw', {
      dirX: dir.x,
      dirY: dir.y + 0.22,
      dirZ: dir.z,
    });
  }

  function getActiveHitboxes() {
    const list = [];
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      if (currentConfig.mode === 'tdm' && myTeam && rp.team === myTeam) continue;

      if (rp.alive && rp.mesh.visible) {
        const headHb = rp.mesh.getObjectByName('hitbox-head');
        if (headHb) {
          headHb.updateMatrixWorld(true);
          list.push({ id, mesh: headHb });
        }
        const bodyHb = rp.mesh.getObjectByName('hitbox');
        if (bodyHb) {
          bodyHb.updateMatrixWorld(true);
          list.push({ id, mesh: bodyHb });
        }
      }
    }
    return list;
  }

  function animateRecoil() {
    const kick = currentWeapon === 'sniper' ? 0.16 : (currentWeapon === 'shotgun' ? 0.12 : 0.05);
    recoilOffsetZ = kick;
    recoilRotX = -kick * 0.9;
  }

  function createTracerFromCamera(direction, colorHex, lineWidth) {
    const start = camera.position.clone().add(direction.clone().multiplyScalar(0.7));
    const end = camera.position.clone().add(direction.clone().multiplyScalar(80));

    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: lineWidth, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);

    setTimeout(() => {
      scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 55);
  }

  function createHitSparks(pos) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff3838 }));
    spark.position.copy(pos);
    scene.add(spark);
    setTimeout(() => {
      scene.remove(spark);
      spark.geometry.dispose();
      spark.material.dispose();
    }, 85);
  }

  // =========================================================================
  // 12. FÍSICAS, DETECCIÓN ROBUSTA DE ESCALERAS Y RAYCAST DE SUELO
  // =========================================================================

  function getRaycastGroundHeight(pos) {
    let groundY = 0;
    // Chequear contra cajas colisionadoras
    for (let i = 0; i < mapColliders.length; i++) {
      const box = mapColliders[i];
      if (
        pos.x + PLAYER_RADIUS * 0.8 > box.minX &&
        pos.x - PLAYER_RADIUS * 0.8 < box.maxX &&
        pos.z + PLAYER_RADIUS * 0.8 > box.minZ &&
        pos.z - PLAYER_RADIUS * 0.8 < box.maxZ
      ) {
        if (box.maxY <= pos.y + 0.35 && box.maxY > groundY) {
          groundY = box.maxY;
        }
      }
    }
    return groundY;
  }

  function resolveCollisions(pos, radius) {
    for (let i = 0; i < mapColliders.length; i++) {
      const box = mapColliders[i];
      const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));

      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      const playerBottom = pos.y;
      const playerTop = pos.y + PLAYER_HEIGHT;
      const verticalOverlap = playerBottom < box.maxY && playerTop > box.minY;

      if (verticalOverlap && distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.001) {
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          pos.x += radius;
        }
      }
    }
    return pos;
  }

  function updateMovement(delta) {
    if (isChatting) return;

    // Verificar si el avatar está dentro del volumen de una escalera
    const activeLadder = checkLadderCollision(localPos);
    isOnLadder = !!activeLadder;

    const forward = new THREE.Vector3(0, 0, -1);
    const right   = new THREE.Vector3(1, 0, 0);
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    forward.applyQuaternion(yawQuat);
    right.applyQuaternion(yawQuat);

    // Entrada de movimiento deseada
    const wishDir = new THREE.Vector3(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp'])    wishDir.add(forward);
    if (keys['KeyS'] || keys['ArrowDown'])  wishDir.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft'])  wishDir.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) wishDir.add(right);

    // ========================================================
    // MODO ESCALERA (Trepado vertical fluido por eje Y)
    // ========================================================
    if (isOnLadder) {
      // Subir con W o Espacio, bajar con S
      let ladderVelocityY = 0;
      if (keys['KeyW'] || keys['ArrowUp'] || keys['Space']) {
        ladderVelocityY = CLIMB_SPEED;
      } else if (keys['KeyS'] || keys['ArrowDown']) {
        ladderVelocityY = -CLIMB_SPEED;
      }

      // Si presiona espacio para saltar de la escalera
      if (keys['Space'] && (keys['KeyS'] || keys['KeyA'] || keys['KeyD'])) {
        velocityY = JUMP_VELOCITY * 0.8;
        isOnLadder = false;
        playSound('jump');
      } else {
        velocityY = ladderVelocityY;
      }

      // Movimiento lateral suave en escalera
      let lateralMove = 0;
      if (keys['KeyA'] || keys['ArrowLeft'])  lateralMove -= 2.0;
      if (keys['KeyD'] || keys['ArrowRight']) lateralMove += 2.0;

      localPos.x += right.x * lateralMove * delta;
      localPos.z += right.z * lateralMove * delta;
      localPos.y += velocityY * delta;

      // Asegurar que no caiga por debajo de la base de la escalera o suelo
      const gH = getRaycastGroundHeight(localPos);
      if (localPos.y < gH) {
        localPos.y = gH;
        velocityY = 0;
        isOnGround = true;
      }

      // Resolver colisiones para no atravesar paredes contiguas
      resolveCollisions(localPos, PLAYER_RADIUS);
      return;
    }

    // ========================================================
    // MODO ESTÁNDAR (Inercia, aceleración y fricción)
    // ========================================================
    if (wishDir.lengthSq() > 0) {
      wishDir.normalize();
      const targetVx = wishDir.x * MOVE_SPEED_MAX;
      const targetVz = wishDir.z * MOVE_SPEED_MAX;

      velocityXZ.x = THREE.MathUtils.lerp(velocityXZ.x, targetVx, ACCELERATION * delta * 0.1);
      velocityXZ.y = THREE.MathUtils.lerp(velocityXZ.y, targetVz, ACCELERATION * delta * 0.1);
    } else {
      // Fricción
      velocityXZ.x = THREE.MathUtils.lerp(velocityXZ.x, 0, FRICTION * delta);
      velocityXZ.y = THREE.MathUtils.lerp(velocityXZ.y, 0, FRICTION * delta);
    }

    localPos.x += velocityXZ.x * delta;
    localPos.z += velocityXZ.y * delta;

    // Salto
    if (keys['Space'] && isOnGround) {
      velocityY = JUMP_VELOCITY;
      isOnGround = false;
      playSound('jump');
    }

    // Gravedad
    velocityY += GRAVITY * delta;
    localPos.y += velocityY * delta;

    // Comprobación de suelo con raycast
    const groundHeight = getRaycastGroundHeight(localPos);
    if (localPos.y <= groundHeight) {
      localPos.y = groundHeight;
      velocityY = 0;
      isOnGround = true;
    } else {
      isOnGround = false;
    }

    resolveCollisions(localPos, PLAYER_RADIUS);
  }

  function updateCamera() {
    camera.position.set(localPos.x, localPos.y + PLAYER_HEIGHT, localPos.z);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }

  function animateWeaponFPS(delta) {
    if (!activeFPSWeaponGroup) return;

    // Recuperación de retroceso (recoil lerp)
    recoilOffsetZ = THREE.MathUtils.lerp(recoilOffsetZ, 0, delta * 14);
    recoilRotX    = THREE.MathUtils.lerp(recoilRotX, 0, delta * 16);

    const baseTarget = isAiming ? ADS_POS : HIP_FIRE_POS;
    const lerpSpeed = isAiming ? 18 : 12;

    // Balanceo sinusoidal al caminar
    const isMoving = velocityXZ.lengthSq() > 0.5;
    let swayX = 0, swayY = 0;
    if (isMoving && isOnGround) {
      swayTime += delta * 10;
      const amp = isAiming ? 0.003 : 0.016;
      swayX = Math.sin(swayTime) * amp;
      swayY = Math.abs(Math.cos(swayTime)) * (amp * 0.8);
    }

    const targetX = baseTarget.x + swayX;
    const targetY = baseTarget.y + swayY;
    const targetZ = baseTarget.z + recoilOffsetZ;

    activeFPSWeaponGroup.position.x = THREE.MathUtils.lerp(activeFPSWeaponGroup.position.x, targetX, delta * lerpSpeed);
    activeFPSWeaponGroup.position.y = THREE.MathUtils.lerp(activeFPSWeaponGroup.position.y, targetY, delta * lerpSpeed);
    activeFPSWeaponGroup.position.z = THREE.MathUtils.lerp(activeFPSWeaponGroup.position.z, targetZ, delta * lerpSpeed);

    activeFPSWeaponGroup.rotation.x = recoilRotX;
  }

  // =========================================================================
  // 13. CONTROLES Y EVENTOS DEL USUARIO
  // =========================================================================

  function openPauseMenu() {
    if (!isInGame) return;
    isPaused = true;
    isMouseDown = false;
    isAiming = false;
    pauseOverlay.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function closePauseMenu() {
    isPaused = false;
    pauseOverlay.classList.add('hidden');
  }

  function exitToLobby() {
    closePauseMenu();
    isInGame = false;
    menuOverlay.classList.remove('hidden');
    hudEl.classList.add('hidden');
    deathOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    // Devolver el canvas a modo no-interactivo (el menú captura los clics)
    if (renderer && renderer.domElement) renderer.domElement.classList.remove('game-active');
    if (document.pointerLockElement) document.exitPointerLock();
    // Pedir lista de salas actualizada
    if (socket) setTimeout(() => socket.emit('rooms:list'), 300);
  }

  function initControls() {
    const canvas = renderer.domElement;

    canvas.addEventListener('click', () => {
      if (!isInGame || isPaused) return;
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = (document.pointerLockElement === canvas);
    });

    // Ratón y puntería
    document.addEventListener('mousemove', (e) => {
      if (!isPointerLocked || !isInGame || !isAlive || isPaused || isChatting) return;

      const sens = MOUSE_SENSITIVITY * mouseSensitivityFactor;
      yaw   -= e.movementX * sens;
      pitch -= e.movementY * sens;

      // Límites de inclinación vertical (pitch)
      const maxPitch = Math.PI / 2 - 0.05;
      pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
    });

    // Disparo (Clic izquierdo) y Zoom ADS (Clic derecho)
    document.addEventListener('mousedown', (e) => {
      if (!isInGame || !isAlive || isPaused || isChatting) return;

      if (e.button === 0) {
        isMouseDown = true;
        if (isPointerLocked) {
          shoot();
        } else {
          canvas.requestPointerLock();
        }
      } else if (e.button === 2) {
        e.preventDefault();
        isAiming = true;
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) isMouseDown = false;
      else if (e.button === 2) isAiming = false;
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Teclado
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (isInGame && scoreboardOverlay) scoreboardOverlay.classList.remove('hidden');
        return;
      }

      if (isChatting) return;

      keys[e.code] = true;

      if (e.code === 'Escape') {
        if (isInGame) {
          if (!isPaused) openPauseMenu();
          else {
            closePauseMenu();
            canvas.requestPointerLock();
          }
        }
        return;
      }

      if (!isInGame || !isAlive || isPaused) return;

      if (e.code === 'KeyT') {
        e.preventDefault();
        openChatBar();
        return;
      }

      if (e.code === 'KeyB') {
        e.preventDefault();
        if (socket) socket.emit('player:emote', { emoteType: 'spin' });
        triggerEmote(myId);
        return;
      }

      if (e.code === 'KeyR') {
        reloadWeapon();
        return;
      }

      if (e.code === 'Digit1' || e.code === 'Numpad1') selectWeapon('rifle');
      if (e.code === 'Digit2' || e.code === 'Numpad2') selectWeapon('shotgun');
      if (e.code === 'Digit3' || e.code === 'Numpad3') selectWeapon('sniper');

      if (e.code === 'KeyQ' || e.code === 'KeyG') throwGrenade();
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (scoreboardOverlay) scoreboardOverlay.classList.add('hidden');
        return;
      }
      keys[e.code] = false;
    });

    // Rueda del ratón para cambio de armas
    window.addEventListener('wheel', (e) => {
      if (!isPointerLocked || !isInGame || !isAlive || isPaused || isChatting) return;
      const idx = WEAPON_KEYS.indexOf(currentWeapon);
      const nextIdx = e.deltaY > 0 ? (idx + 1) % WEAPON_KEYS.length : (idx - 1 + WEAPON_KEYS.length) % WEAPON_KEYS.length;
      selectWeapon(WEAPON_KEYS[nextIdx]);
    });

    // Menú de Pausa eventos
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        closePauseMenu();
        canvas.requestPointerLock();
      });
    }
    if (exitLobbyBtn) {
      exitLobbyBtn.addEventListener('click', exitToLobby);
    }
    if (mouseSensSlider) {
      mouseSensSlider.addEventListener('input', (e) => {
        mouseSensitivityFactor = parseFloat(e.target.value);
        if (sensValueText) sensValueText.textContent = mouseSensitivityFactor.toFixed(1) + 'x';
      });
    }

    // Chat flotante
    function openChatBar() {
      if (!chatBarContainer || !chatInput) return;
      isChatting = true;
      isMouseDown = false;
      isAiming = false;
      chatBarContainer.classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
      chatInput.value = '';
      setTimeout(() => chatInput.focus(), 25);
    }

    function closeChatBar() {
      if (!chatBarContainer || !chatInput) return;
      isChatting = false;
      chatBarContainer.classList.add('hidden');
      chatInput.blur();
      canvas.requestPointerLock();
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          const msg = chatInput.value.trim();
          if (msg && socket) socket.emit('player:chat', { message: msg });
          closeChatBar();
        } else if (e.key === 'Escape') {
          closeChatBar();
        }
      });
    }
  }

  // =========================================================================
  // 14. RED Y COMUNICACIÓN SOCKET.IO
  // =========================================================================

  let lastKnownPlayers = {};

  function initNetworking() {
    socket = io();

    // ---- Server Browser: lista de salas ----
    socket.on('rooms:list', (rooms) => {
      renderRoomsList(rooms);
    });
    socket.on('rooms:created', (data) => {
      // La sala fue creada, unirse automáticamente a ella y lanzar la partida
      if (data && data.roomId) {
        selectedRoomId = data.roomId;
        const label = document.getElementById('selected-room-name-label');
        if (label) label.textContent = 'Tu Sala Creada';
        // Unirse de inmediato a la partida
        joinGame();
      }
      socket.emit('rooms:list');
    });

    socket.on('game:config', (cfg) => {
      currentConfig = cfg;
      if (cfg.gravity) GRAVITY = cfg.gravity;
      updateLobbyUI();
      if (cfg.map !== currentConfig.map) loadMap(cfg.map);
    });

    socket.on('you:joined', (data) => {
      myId = data.id;
      myTeam = data.team;
      if (data.config) {
        currentConfig = data.config;
        if (data.config.gravity) GRAVITY = data.config.gravity;
        loadMap(data.config.map);
      }

      for (const id in data.players) {
        if (id === myId) {
          const me = data.players[id];
          localPos.set(me.x, me.y, me.z);
        } else {
          const cust = (data.customizations && data.customizations[id]) || {};
          addRemotePlayer({ ...data.players[id], ...cust });
        }
      }
    });

    socket.on('player:joined', (playerData) => {
      addRemotePlayer(playerData);
      addFeedNotice(`🥚 ${playerData.nickname} entró a la arena`);
    });

    socket.on('player:left', (data) => {
      const rp = remotePlayers[data.id];
      if (rp) addFeedNotice(`👋 ${rp.nickname} salió`);
      removeRemotePlayer(data.id);
    });

    socket.on('game:state', (state) => {
      lastKnownPlayers = state.players;

      // Actualizar jugadores remotos
      for (const id in state.players) {
        if (id === myId) continue;
        const sp = state.players[id];
        if (!remotePlayers[id]) {
          addRemotePlayer(sp);
        } else {
          const rp = remotePlayers[id];
          rp.targetPos.set(sp.x, sp.y, sp.z);
          rp.targetRotY = sp.rotY;
          rp.targetPitchX = sp.rotX || 0;
          rp.alive = sp.alive;
          rp.mesh.visible = sp.alive;
        }
      }

      // Granadas
      for (const gid in state.grenades) {
        const sg = state.grenades[gid];
        if (!activeGrenades[gid]) {
          const gMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
          scene.add(gMesh);
          activeGrenades[gid] = { mesh: gMesh };
        }
        activeGrenades[gid].mesh.position.set(sg.x, sg.y, sg.z);
      }

      for (const gid in activeGrenades) {
        if (!state.grenades[gid]) {
          scene.remove(activeGrenades[gid].mesh);
          delete activeGrenades[gid];
        }
      }

      updateScoreboard(state.players);

      // Actualizar ranking lateral izquierdo Shell Shockers style
      const leftLb = document.getElementById('ss-left-leaderboard');
      if (leftLb && state.players) {
        const sorted = Object.values(state.players).sort((a, b) => (b.kills || 0) - (a.kills || 0));
        leftLb.innerHTML = '';
        sorted.slice(0, 7).forEach(p => {
          const row = document.createElement('div');
          const isMe = p.id === myId;
          const teamClass = p.team === 'blue' ? 'team-blue' : 'team-red';
          row.className = `ss-lb-row ${teamClass}${isMe ? ' you' : ''}`;
          row.innerHTML = `<span class="ss-lb-name">${p.nickname || 'Egg'}</span><span class="ss-lb-score">${p.kills || 0}</span>`;
          leftLb.appendChild(row);
        });
      }

      if (currentConfig.mode === 'tdm' && state.teamScores) {
        teamScoreEl.classList.remove('hidden');
        teamRedScoreEl.textContent = state.teamScores.red;
        teamBlueScoreEl.textContent = state.teamScores.blue;
        const rCount = document.getElementById('ss-red-count');
        const bCount = document.getElementById('ss-blue-count');
        if (rCount) rCount.textContent = state.teamScores.red;
        if (bCount) bCount.textContent = state.teamScores.blue;
      } else {
        teamScoreEl.classList.add('hidden');
      }
    });

    socket.on('player:hit', (data) => {
      if (data.targetId === myId) {
        myHP = Math.max(0, data.hp);
        updateHealthUI();
        triggerDamageFlash();
      }
    });

    socket.on('player:killed', (data) => {
      addFeedKill(data.killerNickname, data.targetNickname, data.weapon, data.headshot);

      if (data.targetId === myId) {
        isAlive = false;
        myDeaths++;
        deathCountEl.textContent = myDeaths;
        killedByText.textContent = `Eliminado por: ${data.killerNickname} (${data.weapon.toUpperCase()})${data.headshot ? ' [HEADSHOT!]' : ''}`;
        deathOverlay.classList.remove('hidden');
      }

      if (data.killerId === myId) {
        myKills++;
        if (killCountEl) killCountEl.textContent = myKills;
        const skullVal = document.getElementById('ss-kills-val');
        if (skullVal) skullVal.textContent = 'x' + myKills;
        showCenterToast(data.headshot ? '🎯 HEADSHOT!' : '💥 ¡ELIMINACIÓN!');
        playSound('kill');
      }
    });

    socket.on('player:respawn', (data) => {
      if (data.id === myId) {
        localPos.set(data.x, data.y, data.z);
        velocityY = 0;
        myHP = 100;
        isAlive = true;
        deathOverlay.classList.add('hidden');
        updateHealthUI();
      }
    });

    socket.on('grenade:explode', (data) => {
      playSound('explosion');
      createExplosionEffect(data.x, data.y, data.z);
    });

    socket.on('player:chat', (data) => {
      if (data.id === myId) {
        showLocalSpeechBubble(data.message);
      } else if (remotePlayers[data.id]) {
        showRemoteSpeechBubble(data.id, data.message);
      }
      addFeedNotice(`💬 ${data.nickname}: ${data.message}`);
    });

    socket.on('player:emote', (data) => {
      triggerEmote(data.id);
    });

    socket.on('game:over', (data) => {
      gameoverText.textContent = data.reason;
      gameoverOverlay.classList.remove('hidden');
      setTimeout(() => { gameoverOverlay.classList.add('hidden'); }, 3500);
    });
  }

  // =========================================================================
  // 15. EFECTOS VISUALES Y FEEDBACK UI
  // =========================================================================

  function updateHealthUI() {
    if (healthText) healthText.textContent = myHP;
    if (healthBar) {
      healthBar.style.width = myHP + '%';
      if (myHP > 60) healthBar.style.background = 'linear-gradient(90deg, #2ecc71, #f1c40f)';
      else if (myHP > 30) healthBar.style.background = 'linear-gradient(90deg, #f1c40f, #e67e22)';
      else healthBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    }

    // Actualizar anillo SVG circular de salud (Shell Shockers style)
    const ssHpBar = document.getElementById('ss-hp-bar');
    if (ssHpBar) {
      const circumference = 264; // 2 * PI * r (r=42)
      const offset = circumference * (1 - Math.max(0, Math.min(100, myHP)) / 100);
      ssHpBar.style.strokeDashoffset = offset;
      if (myHP > 60) ssHpBar.style.stroke = '#2ecc71';
      else if (myHP > 30) ssHpBar.style.stroke = '#f39c12';
      else ssHpBar.style.stroke = '#e74c3c';
    }
  }

  function triggerDamageFlash() {
    damageFlash.classList.add('active');
    setTimeout(() => { damageFlash.classList.remove('active'); }, 120);
  }

  function showCenterToast(msg) {
    if (!centerToast) return;
    centerToast.textContent = msg;
    centerToast.classList.remove('hidden');
    setTimeout(() => { centerToast.classList.add('hidden'); }, 1400);
  }

  function createExplosionEffect(x, y, z) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.85 })
    );
    sphere.position.set(x, y, z);
    scene.add(sphere);

    let scale = 1;
    const interval = setInterval(() => {
      scale += 0.3;
      sphere.scale.set(scale, scale, scale);
      sphere.material.opacity -= 0.12;
      if (sphere.material.opacity <= 0) {
        clearInterval(interval);
        scene.remove(sphere);
        sphere.geometry.dispose();
        sphere.material.dispose();
      }
    }, 30);
  }

  function triggerEmote(id) {
    if (id === myId) {
      showCenterToast('🎉 ¡EMOTE!');
      playSound('cluck');
    } else if (remotePlayers[id]) {
      const rp = remotePlayers[id];
      rp.isEmoting = true;
      rp.emoteTimer = 0;
    }
  }

  function showLocalSpeechBubble(text) {
    showCenterToast(`"${text}"`);
  }

  function showRemoteSpeechBubble(id, text) {
    const rp = remotePlayers[id];
    if (!rp || !rp.mesh) return;

    const oldBubble = rp.mesh.getObjectByName('speech-bubble');
    if (oldBubble) rp.mesh.remove(oldBubble);

    const bubble = createSpeechBubbleSprite(text);
    bubble.name = 'speech-bubble';
    rp.mesh.add(bubble);

    setTimeout(() => {
      if (bubble.parent) bubble.parent.remove(bubble);
    }, 4000);
  }

  function addFeedNotice(text) {
    const el = document.createElement('div');
    el.className = 'kf-item';
    el.textContent = text;
    killFeedEl.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }

  function addFeedKill(killer, target, weapon, headshot) {
    const el = document.createElement('div');
    el.className = 'kf-item';
    const wepName = (WEAPON_CONFIGS[weapon] && WEAPON_CONFIGS[weapon].name) || weapon.toUpperCase();
    const hsBadge = headshot ? ' 🎯 [HEADSHOT]' : '';
    el.innerHTML = `<span>${escapeHtml(killer)}</span> [${wepName}]${hsBadge} ➔ <span>${escapeHtml(target)}</span>`;
    killFeedEl.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function updateScoreboard(players) {
    if (!scoreboardEntries) return;
    scoreboardEntries.innerHTML = '';
    const arr = Object.values(players).sort((a, b) => b.kills - a.kills);

    arr.forEach((p, idx) => {
      const tr = document.createElement('tr');
      const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills;
      const teamLabel = p.team ? (p.team === 'red' ? '🔴 Rojo' : '🔵 Azul') : 'Libre';
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(p.nickname)}</strong> ${p.id === myId ? '(Tú)' : ''}</td>
        <td>${teamLabel}</td>
        <td>${p.kills}</td>
        <td>${p.deaths}</td>
        <td>${kd}</td>
      `;
      scoreboardEntries.appendChild(tr);
    });
  }

  function updateLobbyUI() {
    const mapNames = { dirt: 'Dirt', space: 'Space', fort: 'Fort' };
    const title = mapNames[currentConfig.map] || currentConfig.map;
    if (configStatus) configStatus.textContent = `Modo: ${currentConfig.mode.toUpperCase()} • Mapa: ${title}`;

    document.querySelectorAll('.shell-map-card').forEach(card => {
      card.classList.toggle('active', card.dataset.map === currentConfig.map);
    });
    document.querySelectorAll('.mode-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.mode === currentConfig.mode);
    });
  }

  // =========================================================================
  // 16. BUCLE PRINCIPAL (GAME LOOP & ANIMACIONES 3D A 60 FPS)
  // =========================================================================

  let lastSendPosTime = 0;

  function gameLoop() {
    requestAnimationFrame(gameLoop);
    const delta = clock.getDelta();

    if (isInGame && isAlive && !isPaused) {
      // Disparo automático rápido continuado con rifle
      if (isMouseDown && currentWeapon === 'rifle' && isPointerLocked) {
        shoot();
      }

      updateMovement(delta);
      updateCamera();

      // Zoom suave ADS
      const targetFov = isAiming ? (currentWeapon === 'sniper' ? 26 : 46) : BASE_FOV;
      currentFov = THREE.MathUtils.lerp(currentFov, targetFov, delta * 14);
      if (Math.abs(camera.fov - currentFov) > 0.05) {
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }

      animateWeaponFPS(delta);

      // Enviar posición y rotaciones Pitch & Yaw
      const now = Date.now();
      if (now - lastSendPosTime > 33) {
        lastSendPosTime = now;
        socket.emit('player:move', {
          x: localPos.x, y: localPos.y, z: localPos.z,
          rotX: pitch, rotY: yaw,
        });
      }
    }

    // Cooldown visual de la granada en HUD
    if (grenadeCdCircle) {
      const now = Date.now();
      const elapsed = now - lastGrenadeTime;
      const progress = Math.min(1.0, elapsed / GRENADE_CD_MS);
      const offset = 94 * (1 - progress);
      grenadeCdCircle.style.strokeDashoffset = offset;
    }

    // ========================================================
    // ANIMACIÓN Y LERP DE JUGADORES REMOTOS
    // ========================================================
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      if (!rp.mesh.visible) continue;

      // 1. Interpolación de posición (LERP suave)
      rp.mesh.position.lerp(rp.targetPos, LERP_FACTOR);

      // 2. Rotación Yaw del cuerpo entero (Eje Y)
      const curY = rp.mesh.rotation.y;
      let diffY = rp.targetRotY - curY;
      while (diffY > Math.PI) diffY -= Math.PI * 2;
      while (diffY < -Math.PI) diffY += Math.PI * 2;
      rp.mesh.rotation.y = curY + diffY * LERP_FACTOR;

      // 3. Inclinación Pitch X de la Cabeza, Rostro y Arma
      if (rp.headPitchGroup) {
        rp.headPitchGroup.rotation.x = THREE.MathUtils.lerp(
          rp.headPitchGroup.rotation.x,
          rp.targetPitchX,
          LERP_FACTOR
        );
      }
      if (rp.gunGroup && rp.headPitchGroup) {
        rp.gunGroup.rotation.x = rp.headPitchGroup.rotation.x;
      }

      // 4. Estados de Animación (Idle, Walk, Emote)
      rp.animTime += delta * 6;
      if (rp.isEmoting) {
        rp.emoteTimer += delta * 6;
        rp.bodyGroup.rotation.y = rp.emoteTimer * Math.PI * 2;
        rp.bodyGroup.position.y = Math.abs(Math.sin(rp.emoteTimer * Math.PI)) * 0.4;
        if (rp.emoteTimer >= 1.0) {
          rp.isEmoting = false;
          rp.bodyGroup.rotation.y = 0;
          rp.bodyGroup.position.y = 0;
        }
      } else {
        // Idle breathing / flotación sinusoidal suave
        rp.bodyGroup.position.y = Math.sin(rp.animTime * 0.6) * 0.03;
      }
    }

    renderer.render(scene, camera);
    if (!isInGame) renderPreview(delta);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // =========================================================================
  // 17. ARRANQUE DEL JUEGO DESDE EL LOBBY
  // =========================================================================

  // ---- Cambio de pestañas ----
  function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + tabName);
    });
  }

  let selectedRoomId = 'room-dirt-1';

  // ---- Renderizar lista de salas ----
  function renderRoomsList(rooms) {
    const tbody = document.getElementById('rooms-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!rooms || rooms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1rem;color:#7f8c8d;">No hay salas disponibles</td></tr>';
      return;
    }
    rooms.forEach(r => {
      const tr = document.createElement('tr');
      const full = r.playersCount >= r.maxPlayers;
      const isSelected = r.id === selectedRoomId;
      tr.innerHTML = `
        <td><strong>${r.name || r.id}</strong></td>
        <td>${(r.map || 'dirt').toUpperCase()}</td>
        <td>${(r.mode || 'ffa').toUpperCase()}</td>
        <td style="color:${full ? '#e74c3c' : '#4caf50'}">${r.playersCount}/${r.maxPlayers}</td>
        <td><button class="shell-btn-secondary room-join-btn" data-room="${r.id}" ${full ? 'disabled' : ''}>${isSelected ? 'SELECCIONADA' : 'ELEGIR'}</button></td>
      `;
      tbody.appendChild(tr);
    });
    // Listener de botones UNIRSE / ELEGIR
    tbody.querySelectorAll('.room-join-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRoomId = btn.dataset.room;
        const roomName = btn.closest('tr').querySelector('td strong').textContent;
        const label = document.getElementById('selected-room-name-label');
        if (label) label.textContent = roomName;
        renderRoomsList(rooms);
      });
    });
  }

  
  // =========================================================================
  // VISTA PREVIA 3D EN TIEMPO REAL DEL HUEVO (PERSONALIZAR HUEVO)
  // =========================================================================
  let previewCanvas = null;
  let previewScene = null;
  let previewCamera = null;
  let previewRenderer = null;
  let previewGroup = null;

  function initPreview3D() {
    previewCanvas = document.getElementById('egg-preview-canvas');
    if (!previewCanvas) return;

    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x1a242f);

    const rect = previewCanvas.getBoundingClientRect();
    const w = rect.width || 260;
    const h = rect.height || 260;

    previewCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 50);
    previewCamera.position.set(0, 0.2, 3.2);

    previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
    previewRenderer.setSize(w, h);
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
    const dirLight = new THREE.DirectionalLight(0xfffaed, 0.95);
    dirLight.position.set(5, 10, 7);
    previewScene.add(ambLight, dirLight);

    previewGroup = new THREE.Group();
    previewScene.add(previewGroup);

    updatePreviewAvatar();
  }

  function updatePreviewAvatar() {
    if (!previewGroup) return;

    while (previewGroup.children.length > 0) {
      const child = previewGroup.children[0];
      previewGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    const eggColor = (colorPicker ? colorPicker.value : '#ffdd00') || '#ffdd00';
    const hatType = hatSelect ? hatSelect.value : 'none';
    const glassesType = glassesSelect ? glassesSelect.value : 'none';
    const textureData = getCustomTextureDataURL();

    let eggMat;
    if (textureData) {
      const img = new Image();
      img.src = textureData;
      const texture = new THREE.Texture(img);
      img.onload = () => { texture.needsUpdate = true; };
      eggMat = new THREE.MeshLambertMaterial({ map: texture, color: eggColor, roughness: 0.5 });
    } else {
      eggMat = new THREE.MeshLambertMaterial({ color: eggColor, roughness: 0.5 });
    }

    const eggGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const eggMesh = new THREE.Mesh(eggGeo, eggMat);
    eggMesh.scale.set(1.0, 1.38, 1.0);
    previewGroup.add(eggMesh);

    // Ojos
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.18, 0.1, 0.44);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(-0.18, 0.1, 0.52);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.18, 0.1, 0.44);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(0.18, 0.1, 0.52);

    previewGroup.add(eyeL, pupilL, eyeR, pupilR);

    // Sombreros y gafas
    attachHat(previewGroup, hatType);
    attachGlasses(previewGroup, glassesType);
  }

  function renderPreview(delta) {
    if (previewGroup && previewRenderer && previewScene && previewCamera) {
      previewGroup.rotation.y += delta * 1.1; // Rotación 360° fluida
      previewRenderer.render(previewScene, previewCamera);
    }
  }

function initLobbyEvents() {
    // ---- Pestañas de navegación ----
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // ---- Vista previa y personalización en tiempo real ----
    if (colorPicker) colorPicker.addEventListener('input', updatePreviewAvatar);
    if (hatSelect) hatSelect.addEventListener('change', updatePreviewAvatar);
    if (glassesSelect) glassesSelect.addEventListener('change', updatePreviewAvatar);

    // ---- Selector de Armas y Clases ----
    document.querySelectorAll('.weapon-btn').forEach(btn => {
      btn.addEventListener('click', () => selectWeapon(btn.dataset.weapon));
    });
    document.querySelectorAll('.class-card').forEach(card => {
      card.addEventListener('click', () => selectWeapon(card.dataset.weapon));
    });

    // ---- Selector de Modos ----
    document.querySelectorAll('.mode-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        if (socket) socket.emit('game:set-config', { mode: pill.dataset.mode });
      });
    });

    // ---- Selector de Mapas ----
    document.querySelectorAll('.shell-map-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.shell-map-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (socket) socket.emit('game:set-config', { map: card.dataset.map });
      });
    });

    // ---- Botón PLAY NOW ----
    const playBtn = document.getElementById('join-btn');
    if (playBtn) playBtn.addEventListener('click', joinGame);
    if (nicknameInput) nicknameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') joinGame();
    });

    // ---- Pre-rellenar nickname desde localStorage ----
    const savedNick = localStorage.getItem('shell_nickname');
    if (savedNick && nicknameInput) nicknameInput.value = savedNick;

    // ---- Botón Actualizar salas ----
    const refreshBtn = document.getElementById('btn-refresh-rooms');
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
      if (socket) socket.emit('rooms:list');
    });

    // ---- Botón Crear Sala ----
    const createRoomBtn = document.getElementById('btn-open-create-room');
    const createRoomModal = document.getElementById('create-room-modal');
    if (createRoomBtn && createRoomModal) {
      createRoomBtn.addEventListener('click', () => {
        createRoomModal.classList.remove('hidden');
      });
    }
    const closeCreateRoom = document.getElementById('btn-close-create-room');
    if (closeCreateRoom && createRoomModal) {
      closeCreateRoom.addEventListener('click', () => createRoomModal.classList.add('hidden'));
    }
    const confirmCreate = document.getElementById('btn-confirm-create-room');
    if (confirmCreate) {
      confirmCreate.addEventListener('click', () => {
        const name    = (document.getElementById('create-room-name')?.value || '').trim() || 'Mi Sala';
        const map     = document.getElementById('create-room-map')?.value || 'dirt';
        const mode    = document.getElementById('create-room-mode')?.value || 'ffa';
        const maxP    = parseInt(document.getElementById('create-room-max-players')?.value || '8', 10);
        if (socket) socket.emit('rooms:create', { name, map, mode, maxPlayers: maxP });
        if (createRoomModal) createRoomModal.classList.add('hidden');
      });
    }

    // ---- Botón Editar Nickname ----
    const editNickBtn = document.getElementById('btn-edit-nickname');
    if (editNickBtn) {
      editNickBtn.addEventListener('click', () => {
        const newNick = window.prompt('Introduce tu nuevo nickname:', localStorage.getItem('shell_nickname') || '');
        if (newNick && newNick.trim().length >= 2) {
          const nick = newNick.trim().substring(0, 14);
          localStorage.setItem('shell_nickname', nick);
          if (nicknameInput) nicknameInput.value = nick;
          const display = document.getElementById('current-user-display');
          if (display) display.textContent = nick;
        }
      });
    }

    // ---- Sensibilidad del ratón ----
    const sensSlider = document.getElementById('mouse-sens-slider');
    const sensText   = document.getElementById('sens-value-text');
    if (sensSlider) {
      sensSlider.addEventListener('input', () => {
        mouseSensitivityFactor = parseFloat(sensSlider.value);
        if (sensText) sensText.textContent = mouseSensitivityFactor.toFixed(1) + 'x';
      });
    }

    // ---- Socket: escuchar lista de salas ----
    // (se llama desde initNetworking, pero aquí pedimos la inicial)
    setTimeout(() => {
      if (socket) socket.emit('rooms:list');
    }, 800);
  }

  function joinGame() {
    // Leer nickname del campo del lobby; si está vacío, pedirlo con prompt
    let nickname = '';
    if (nicknameInput) nickname = nicknameInput.value.trim();
    if (!nickname || nickname.length < 2) {
      nickname = window.prompt('🥚 Introduce tu nombre de jugador:', localStorage.getItem('shell_nickname') || '');
      if (!nickname || nickname.trim().length < 2) return; // canceló o nombre inválido
      nickname = nickname.trim();
    }
    localStorage.setItem('shell_nickname', nickname);
    const color      = colorPicker  ? colorPicker.value  : '#ffdd00';
    const hat        = hatSelect    ? hatSelect.value    : 'none';
    const glasses    = glassesSelect ? glassesSelect.value : 'none';
    const textureData = getCustomTextureDataURL();

    getAudioCtx();

    // Activar pointer-events en el canvas del juego
    if (renderer && renderer.domElement) renderer.domElement.classList.add('game-active');

    menuOverlay.classList.add('hidden');
    hudEl.classList.remove('hidden');
    isInGame = true;
    updateAmmoHUD();
    updateHealthUI();

    socket.emit('player:join', {
      roomId: selectedRoomId,
      nickname,
      color,
      hat,
      glasses,
      textureData,
      weapon: currentWeapon,
    });

    renderer.domElement.requestPointerLock();
  }

  // =========================================================================
  // 18. ENTRADA PRINCIPAL
  // =========================================================================

  function main() {
    initTexturePainter();
    initThreeJS();
    initPreview3D();
    initControls();
    initNetworking();
    initLobbyEvents();
    gameLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
