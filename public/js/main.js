// ============================================================================
// main.js — Cliente FPS multijugador v2 (Armas, Granadas, Mapas, Personalización)
// ============================================================================

(function () {
  'use strict';

  // =========================================================================
  // 1. CONSTANTES Y CONFIGURACIÓN DE ARMAS
  // =========================================================================

  const MOVE_SPEED        = 7.5;
  const MOUSE_SENSITIVITY = 0.0022;
  const JUMP_VELOCITY     = 9.5;
  const GRAVITY           = -24.0;
  const PLAYER_HEIGHT     = 1.6;
  const PLAYER_RADIUS     = 0.5;
  const LERP_FACTOR       = 0.18;
  const GRENADE_CD_MS     = 8000;

  // Estadísticas de las armas
  const WEAPON_CONFIGS = {
    rifle: {
      name: 'Fusil',
      icon: '🔫',
      cooldown: 120, // Disparo automático rápido (120ms)
      damage: 20,
      pellets: 1,
      spread: 0.015,
      maxAmmo: 30,
      reloadTime: 1400,
      tracerColor: 0xffea00,
      tracerWidth: 1,
    },
    shotgun: {
      name: 'Escopeta',
      icon: '💥',
      cooldown: 800,
      damage: 16,
      pellets: 6,
      spread: 0.075,
      maxAmmo: 6,
      reloadTime: 1800,
      tracerColor: 0xff8833,
      tracerWidth: 1.5,
    },
    sniper: {
      name: 'Sniper',
      icon: '🎯',
      cooldown: 1500,
      damage: 80,
      pellets: 1,
      spread: 0.001,
      maxAmmo: 5,
      reloadTime: 2200,
      tracerColor: 0x48dbfb,
      tracerWidth: 3,
    },
  };

  const WEAPON_KEYS = ['rifle', 'shotgun', 'sniper'];

  // =========================================================================
  // 2. EFECTOS DE SONIDO SINTETIZADOS (Web Audio API)
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
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'shotgun') {
        // Ruido blanco + golpe bajo
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (type === 'sniper') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'explosion') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.setValueAtTime(700, now + 0.05);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'headshot') {
        // Ding metálico agudo y brillante
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.setValueAtTime(1850, now + 0.08);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'emote') {
        // Sonido cómico tipo boing/fanfarria corta
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.25);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'empty') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(550, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'reload') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.setValueAtTime(480, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (err) {
      // Audio no bloqueante
    }
  }

  // =========================================================================
  // 3. VARIABLES GLOBALES DE THREE.JS Y JUEGO
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
  const HIP_FIRE_POS = new THREE.Vector3(0.3, -0.25, -0.5);
  const ADS_POS      = new THREE.Vector3(0.0, -0.185, -0.38);

  // Inercia, aceleración y escaleras
  const mapLadders = [];
  const velocityXZ = new THREE.Vector2(0, 0);
  const MAX_MOVE_SPEED = 7.6;
  const ACCELERATION   = 48.0;
  const FRICTION       = 14.0;
  const CLIMB_SPEED    = 5.2;
  let isClimbingLadder = false;

  const keys = {};
  let yaw = 0;
  let pitch = 0;
  let velocityY = 0;
  let isOnGround = true;

  // Posición del jugador local (pies)
  const localPos = new THREE.Vector3(0, 0, 0);

  // Modelos y armas en primera persona
  let fpsWeapons = {}; // { rifle: Group, shotgun: Group, sniper: Group }
  let activeFPSWeaponGroup = null;

  // Jugadores remotos y entidades
  const remotePlayers = {}; // { id: { mesh, targetPos, targetRotY, nickname, team, alive } }
  const activeGrenades = {}; // { id: { mesh, targetPos } }
  const mapColliders = [];
  let mapRootGroup = null;
  let currentLoadedMap = null;

  // Configuración de la partida actual
  let currentConfig = { mode: 'ffa', map: 'cybergrid', killLimit: 30 };

  // =========================================================================
  // 4. ELEMENTOS DEL DOM
  // =========================================================================

  const menuOverlay      = document.getElementById('menu-overlay');
  const nicknameInput    = document.getElementById('nickname-input');
  const joinBtn          = document.getElementById('join-btn');
  const colorPicker      = document.getElementById('color-picker');
  const hatSelect        = document.getElementById('hat-select');
  const glassesSelect    = document.getElementById('glasses-select');
  const configStatus     = document.getElementById('config-status');

  const deathOverlay     = document.getElementById('death-overlay');
  const killedByText     = document.getElementById('killed-by-text');
  const gameoverOverlay  = document.getElementById('gameover-overlay');
  const gameoverText     = document.getElementById('gameover-text');
  const pauseOverlay     = document.getElementById('pause-overlay');
  const resumeBtn        = document.getElementById('resume-btn');
  const exitLobbyBtn     = document.getElementById('exit-lobby-btn');
  const pauseWepRifle    = document.getElementById('pause-wep-rifle');
  const pauseWepShotgun  = document.getElementById('pause-wep-shotgun');
  const pauseWepSniper   = document.getElementById('pause-wep-sniper');

  const hudEl            = document.getElementById('hud');
  const crosshairEl      = document.getElementById('crosshair');
  const healthBar        = document.getElementById('health-bar');
  const healthText       = document.getElementById('health-text');
  const killCountEl      = document.getElementById('kill-count');
  const deathCountEl     = document.getElementById('death-count');
  const teamScoreEl      = document.getElementById('team-score');
  const teamRedScoreEl   = document.getElementById('team-red-score');
  const teamBlueScoreEl  = document.getElementById('team-blue-score');
  const playerListEl     = document.getElementById('player-list-entries');
  const killFeedEl       = document.getElementById('kill-feed');
  const damageFlash      = document.getElementById('damage-flash');
  const pointerHint      = document.getElementById('pointer-lock-hint');
  const weaponSlots      = document.querySelectorAll('.wb-slot');
  const weaponCooldownBar= document.getElementById('weapon-cooldown-bar');
  const grenadeCdCircle  = document.getElementById('grenade-cd-circle');

  // Nuevos elementos del HUD y Overlays
  const scoreboardOverlay = document.getElementById('scoreboard-overlay');
  const scoreboardEntries = document.getElementById('scoreboard-entries');
  const sbGameInfo        = document.getElementById('sb-game-info');
  const activeWeaponIcon  = document.getElementById('active-weapon-icon');
  const activeWeaponName  = document.getElementById('active-weapon-name');
  const ammoCurrentEl     = document.getElementById('ammo-current');
  const ammoMaxEl         = document.getElementById('ammo-max');
  const reloadHint        = document.getElementById('reload-hint');
  const chatBarContainer  = document.getElementById('chat-bar-container');
  const chatInput         = document.getElementById('chat-input');
  const centerToast       = document.getElementById('center-toast');
  const mouseSensSlider   = document.getElementById('mouse-sens-slider');
  const sensValueText     = document.getElementById('sens-value-text');

  // Texture painter DOM
  const textureCanvas    = document.getElementById('texture-canvas');
  const textureCtx       = textureCanvas.getContext('2d');
  const brushColorInput  = document.getElementById('brush-color');
  const brushSizeInput   = document.getElementById('brush-size');
  const painterClearBtn  = document.getElementById('painter-clear');

  // =========================================================================
  // 5. TEXTURE PAINTER
  // =========================================================================

  let isPainting = false;
  let hasDrawnCustomTexture = false;

  function initTexturePainter() {
    // Fondo neutro transparente o blanco suave
    textureCtx.fillStyle = '#222222';
    textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

    // Contorno guía para ojos/boca
    drawTemplateGuides();

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
    });

    window.addEventListener('mouseup', () => { isPainting = false; });

    textureCanvas.addEventListener('mousemove', (e) => {
      if (!isPainting) return;
      const { x, y } = getCoords(e);
      paintAt(x, y);
    });

    painterClearBtn.addEventListener('click', () => {
      hasDrawnCustomTexture = false;
      textureCtx.fillStyle = '#222222';
      textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
      drawTemplateGuides();
    });
  }

  function drawTemplateGuides() {
    textureCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    textureCtx.lineWidth = 1;
    // Ojos sugeridos
    textureCtx.strokeRect(28, 44, 24, 24);
    textureCtx.strokeRect(76, 44, 24, 24);
    // Boca sugerida
    textureCtx.strokeRect(40, 85, 48, 14);
  }

  function paintAt(x, y) {
    textureCtx.fillStyle = brushColorInput.value;
    textureCtx.beginPath();
    textureCtx.arc(x, y, parseInt(brushSizeInput.value, 10), 0, Math.PI * 2);
    textureCtx.fill();
  }

  function getCustomTextureDataURL() {
    if (!hasDrawnCustomTexture) return null;
    return textureCanvas.toDataURL('image/png');
  }

  // =========================================================================
  // 6. INICIALIZACIÓN DE THREE.JS
  // =========================================================================

  function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 45, 110);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250);
    camera.position.set(0, PLAYER_HEIGHT, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Iluminación
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(35, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.35);
    scene.add(hemi);

    // Contenedor para el mapa activo
    mapRootGroup = new THREE.Group();
    scene.add(mapRootGroup);

    // Construir modelos de armas en primera persona
    initFPSWeapons();

    scene.add(camera);
    window.addEventListener('resize', onWindowResize);
  }

  // =========================================================================
  // 7. CONSTRUCCIÓN DE MAPAS DINÁMICOS
  // =========================================================================

  function addCollider(cx, cy, cz, w, h, d) {
    mapColliders.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minY: cy - h / 2, maxY: cy + h / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    });
  }

  function addLadder(cx, cy, cz, w, h, d) {
    mapLadders.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minY: cy - h / 2, maxY: cy + h / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    });
  }

  function checkLadderCollision(pos) {
    for (let i = 0; i < mapLadders.length; i++) {
      const l = mapLadders[i];
      if (
        pos.x + PLAYER_RADIUS > l.minX && pos.x - PLAYER_RADIUS < l.maxX &&
        pos.z + PLAYER_RADIUS > l.minZ && pos.z - PLAYER_RADIUS < l.maxZ &&
        pos.y + 0.3 >= l.minY && pos.y <= l.maxY + 0.5
      ) {
        return true;
      }
    }
    return false;
  }

  function clearMap() {
    mapColliders.length = 0;
    mapLadders.length = 0;
    while (mapRootGroup.children.length > 0) {
      const obj = mapRootGroup.children[0];
      mapRootGroup.remove(obj);
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
  }

  function loadMap(mapName) {
    if (currentLoadedMap === mapName && mapRootGroup.children.length > 0) return;
    clearMap();
    currentLoadedMap = mapName;

    if (window.GameMaps && window.GameMaps.buildMap) {
      window.GameMaps.buildMap(mapName, scene, mapRootGroup, addCollider, addLadder);
    }
  }

  // =========================================================================
  // 8. MODELOS DE ARMAS EN PRIMERA PERSONA (FPS)
  // =========================================================================

  function initFPSWeapons() {
    fpsWeapons.rifle = buildFPSRifle();
    fpsWeapons.shotgun = buildFPSShotgun();
    fpsWeapons.sniper = buildFPSSniper();

    WEAPON_KEYS.forEach(wKey => {
      fpsWeapons[wKey].visible = false;
      camera.add(fpsWeapons[wKey]);
    });

    selectWeapon('rifle');
  }

  function buildFPSRifle() {
    const group = new THREE.Group();
    // Cañón
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x2f3640 })
    );
    barrel.position.set(0, 0, -0.28);
    group.add(barrel);

    // Cuerpo
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.13, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x718093 })
    );
    group.add(body);

    // Empuñadura
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.16, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x353b48 })
    );
    grip.position.set(0, -0.1, 0.06);
    group.add(grip);

    // Muzzle flash
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0 })
    );
    flash.position.set(0, 0, -0.6);
    flash.name = 'flash';
    group.add(flash);

    group.position.set(0.3, -0.25, -0.5);
    return group;
  }

  function buildFPSShotgun() {
    const group = new THREE.Group();
    // Cañón doble grueso
    const b1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x1e272e })
    );
    b1.rotation.x = Math.PI / 2;
    b1.position.set(-0.04, 0, -0.25);
    group.add(b1);

    const b2 = b1.clone();
    b2.position.set(0.04, 0, -0.25);
    group.add(b2);

    // Culata de madera
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.14, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x8b572a })
    );
    stock.position.set(0, -0.06, 0.08);
    group.add(stock);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0 })
    );
    flash.position.set(0, 0, -0.55);
    flash.name = 'flash';
    group.add(flash);

    group.position.set(0.3, -0.26, -0.48);
    return group;
  }

  function buildFPSSniper() {
    const group = new THREE.Group();
    // Cañón largo
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x2d3436 })
    );
    barrel.position.set(0, 0, -0.42);
    group.add(barrel);

    // Mira telescópica cilíndrica
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8),
      new THREE.MeshLambertMaterial({ color: 0x0984e3 })
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.09, -0.15);
    group.add(scope);

    // Soporte mira
    const scopeMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.05, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x2d3436 })
    );
    scopeMount.position.set(0, 0.05, -0.15);
    group.add(scopeMount);

    // Cuerpo
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x636e72 })
    );
    body.position.set(0, 0, 0.05);
    group.add(body);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x00d2d3, transparent: true, opacity: 0 })
    );
    flash.position.set(0, 0, -0.85);
    flash.name = 'flash';
    group.add(flash);

    group.position.set(0.28, -0.24, -0.52);
    return group;
  }

  function updateAmmoHUD() {
    const config = WEAPON_CONFIGS[currentWeapon];
    if (!config) return;
    if (activeWeaponIcon) activeWeaponIcon.textContent = config.icon || '🔫';
    if (activeWeaponName) activeWeaponName.textContent = config.name.toUpperCase();
    if (ammoCurrentEl) ammoCurrentEl.textContent = ammoState[currentWeapon];
    if (ammoMaxEl) ammoMaxEl.textContent = config.maxAmmo;
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

    // Actualizar visual de armas en cámara
    WEAPON_KEYS.forEach(k => {
      if (fpsWeapons[k]) fpsWeapons[k].visible = (k === weaponKey);
    });
    activeFPSWeaponGroup = fpsWeapons[weaponKey];

    // Actualizar UI del HUD
    weaponSlots.forEach(slot => {
      slot.classList.toggle('active', slot.dataset.weapon === weaponKey);
    });

    // Actualizar botones de pausa
    if (pauseWepRifle) pauseWepRifle.classList.toggle('active', weaponKey === 'rifle');
    if (pauseWepShotgun) pauseWepShotgun.classList.toggle('active', weaponKey === 'shotgun');
    if (pauseWepSniper) pauseWepSniper.classList.toggle('active', weaponKey === 'sniper');

    // Actualizar tarjeta de munición
    updateAmmoHUD();

    if (socket && isInGame) {
      socket.emit('player:weapon-switch', { weapon: weaponKey });
    }
  }

  // =========================================================================
  // 9. MODELADO DE JUGADORES (HUEVO, ARTICULACIÓN PITCH & YAW Y ACCESORIOS)
  // =========================================================================

  function createPlayerModel(playerData) {
    const group = new THREE.Group();

    // Color del cuerpo (en TDM, sobrescrito según equipo)
    let bodyColor = playerData.color || '#ff6b6b';
    if (currentConfig.mode === 'tdm' && playerData.team) {
      bodyColor = playerData.team === 'red' ? '#e74c3c' : '#3498db';
    }

    // Material del cuerpo
    let bodyMat;
    if (playerData.textureData) {
      const img = new Image();
      img.src = playerData.textureData;
      const texture = new THREE.Texture(img);
      img.onload = () => { texture.needsUpdate = true; };
      bodyMat = new THREE.MeshLambertMaterial({ map: texture, color: bodyColor });
    } else {
      bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    }

    // Huevo / Torso (gira en Yaw con el cuerpo entero)
    const bodyGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1, 1.3, 1);
    body.position.y = 0.9;
    body.castShadow = true;
    body.name = 'player-body';
    group.add(body);

    // ========================================================
    // GRUPO PIVOT DE CABEZA (Se inclina en Pitch X al mirar arriba/abajo)
    // ========================================================
    const headPitchGroup = new THREE.Group();
    headPitchGroup.name = 'head-pitch-group';
    headPitchGroup.position.set(0, 1.45, 0); // Pivote del cuello
    group.add(headPitchGroup);

    // Cabeza (esfera)
    const headGeo = new THREE.SphereGeometry(0.32, 10, 10);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 0.1, 0);
    head.castShadow = true;
    head.name = 'player-head';
    headPitchGroup.add(head);

    // Ojos articulados con la cabeza
    const eyeGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.12, 0.15, -0.28);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(-0.12, 0.15, -0.35);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.12, 0.15, -0.28);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(0.12, 0.15, -0.35);

    headPitchGroup.add(eyeL, pupilL, eyeR, pupilR);

    // Accesorios acoplados a la cabeza móvil
    attachHat(headPitchGroup, playerData.hat);
    attachGlasses(headPitchGroup, playerData.glasses);

    // Hitbox precisa para tiros a la cabeza (se mueve con la inclinación)
    const headHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.85, 0.85),
      new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
    );
    headHitbox.position.set(0, 0.15, 0);
    headHitbox.name = 'hitbox-head';
    headPitchGroup.add(headHitbox);

    // ========================================================
    // ARMA EXTERIOR FLOTANTE (Se inclina en Pitch X hacia la mira)
    // ========================================================
    const gunGroup = new THREE.Group();
    gunGroup.name = 'gun-external';
    gunGroup.position.set(0.52, 1.05, -0.18);
    const gunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    gunGroup.add(gunMesh);
    group.add(gunGroup);

    // Hitbox general para impactos en el cuerpo
    const hitboxGeo = new THREE.BoxGeometry(1.1, 1.5, 1.1);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.position.y = 0.8;
    hitbox.name = 'hitbox';
    group.add(hitbox);

    // Nombre y barra sobre la cabeza
    const nameSprite = createNameSprite(playerData.nickname, playerData.team);
    nameSprite.name = 'name-sprite';
    group.add(nameSprite);

    return group;
  }

  function attachHat(headGroup, hatType) {
    const oldHat = headGroup.getObjectByName('accessory-hat');
    if (oldHat) headGroup.remove(oldHat);
    if (!hatType || hatType === 'none') return;

    const hatGroup = new THREE.Group();
    hatGroup.name = 'accessory-hat';

    if (hatType === 'tophat') {
      // Copa
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.4, 10),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      crown.position.y = 0.55;
      // Ala
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.04, 10),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      brim.position.y = 0.37;
      hatGroup.add(crown, brim);
    } else if (hatType === 'helmet') {
      // Casco militar oliva
      const helm = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x4b5320 })
      );
      helm.position.y = 0.17;
      hatGroup.add(helm);
    } else if (hatType === 'cap') {
      // Gorra urbana
      const capCrown = new THREE.Mesh(
        new THREE.SphereGeometry(0.33, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x0984e3 })
      );
      capCrown.position.y = 0.17;
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.03, 0.22),
        new THREE.MeshLambertMaterial({ color: 0x0984e3 })
      );
      visor.position.set(0, 0.25, -0.32);
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
      // Gafas de sol negras
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.1, 0.04),
        new THREE.MeshLambertMaterial({ color: 0x050505 })
      );
      frame.position.set(0, 0.15, -0.33);
      gGroup.add(frame);
    } else if (glassesType === 'mask') {
      // Antifaz
      const mask = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.15, 0.05),
        new THREE.MeshLambertMaterial({ color: 0xd63031 })
      );
      mask.position.set(0, 0.15, -0.32);
      gGroup.add(mask);
    }

    headGroup.add(gGroup);
  }

  function createNameSprite(text, team) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    let bgColor = 'rgba(0, 0, 0, 0.6)';
    let textColor = '#ffffff';
    if (currentConfig.mode === 'tdm' && team) {
      textColor = team === 'red' ? '#ff7675' : '#74b9ff';
    }

    ctx.fillStyle = bgColor;
    ctx.roundRect(10, 10, 236, 44, 10);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.2, 0.55, 1);
    sprite.position.y = 2.35;
    return sprite;
  }

  // ---- Burbuja de Cómic 3D sobre la cabeza (Tecla T) ----
  function createSpeechBubbleSprite(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 340;
    canvas.height = 120;

    // Fondo blanco cómic con borde cian neón
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;

    // Cuerpo redondeado de la burbuja
    ctx.beginPath();
    ctx.roundRect(10, 10, 320, 75, 16);
    ctx.fill();
    ctx.stroke();

    // Piquito del bocadillo apuntando hacia el personaje
    ctx.beginPath();
    ctx.moveTo(150, 85);
    ctx.lineTo(170, 112);
    ctx.lineTo(185, 85);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    // Texto
    ctx.fillStyle = '#060b14';
    ctx.font = 'bold 22px Rajdhani, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 170, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.4, 1.2, 1);
    sprite.position.y = 2.95;
    return sprite;
  }

  function displaySpeechBubble(playerId, text) {
    let parentMesh = null;
    if (playerId === myId) {
      // Si es el propio jugador, colocamos temporalmente el sprite en la escena sobre su posición
      const sprite = createSpeechBubbleSprite(text);
      sprite.position.set(localPos.x, localPos.y + 2.8, localPos.z);
      scene.add(sprite);
      setTimeout(() => {
        scene.remove(sprite);
        if (sprite.material && sprite.material.map) sprite.material.map.dispose();
        sprite.material.dispose();
      }, 4000);
      return;
    } else if (remotePlayers[playerId]) {
      parentMesh = remotePlayers[playerId].mesh;
    }

    if (!parentMesh) return;

    // Remover burbuja anterior si existiera
    const oldBubble = parentMesh.getObjectByName('speech-bubble');
    if (oldBubble) {
      parentMesh.remove(oldBubble);
      if (oldBubble.material && oldBubble.material.map) oldBubble.material.map.dispose();
      oldBubble.material.dispose();
    }

    const sprite = createSpeechBubbleSprite(text);
    sprite.name = 'speech-bubble';
    parentMesh.add(sprite);

    setTimeout(() => {
      parentMesh.remove(sprite);
      if (sprite.material && sprite.material.map) sprite.material.map.dispose();
      sprite.material.dispose();
    }, 4000);
  }

  // ---- Animación de Emote Express (Tecla B) ----
  let isEmoting = false;
  let emoteTime = 0;
  let lastEmoteTime = 0;

  function triggerEmote(playerId) {
    if (playerId === myId) {
      isEmoting = true;
      emoteTime = 0;
      playSound('emote');
      showCenterToast('🕺 ¡EMOTE!');
      setTimeout(() => { isEmoting = false; }, 800);
    } else if (remotePlayers[playerId] && remotePlayers[playerId].mesh) {
      const mesh = remotePlayers[playerId].mesh;
      const startRot = mesh.rotation.y;
      const startY = mesh.position.y;
      const startTime = performance.now();

      function animRemoteEmote() {
        const elapsed = (performance.now() - startTime) / 800;
        if (elapsed >= 1) {
          mesh.rotation.y = startRot;
          mesh.position.y = startY;
          return;
        }
        mesh.rotation.y = startRot + elapsed * Math.PI * 2;
        mesh.position.y = startY + Math.sin(elapsed * Math.PI) * 0.9;
        requestAnimationFrame(animRemoteEmote);
      }
      animRemoteEmote();
    }
  }

  function showCenterToast(msg) {
    if (!centerToast) return;
    centerToast.textContent = msg;
    centerToast.classList.remove('hidden');
    setTimeout(() => { centerToast.classList.add('hidden'); }, 1400);
  }

  function updateScoreboard(allPlayers) {
    if (!scoreboardEntries) return;
    const sorted = Object.values(allPlayers || {}).sort((a, b) => b.kills - a.kills);
    scoreboardEntries.innerHTML = '';

    sorted.forEach((p, idx) => {
      const tr = document.createElement('tr');
      if (p.id === myId) tr.classList.add('me');

      const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills;
      const teamLabel = p.team ? (p.team === 'red' ? '🔴 ROJO' : '🔵 AZUL') : 'FFA';

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(p.nickname)}</strong>${p.id === myId ? ' (TÚ)' : ''}</td>
        <td>${teamLabel}</td>
        <td style="color:var(--neon-cyan)">${p.kills}</td>
        <td style="color:#ff6b81">${p.deaths}</td>
        <td>${kd}</td>
      `;
      scoreboardEntries.appendChild(tr);
    });

    if (sbGameInfo) {
      sbGameInfo.textContent = currentConfig.mode === 'tdm' ? 'DUELO POR EQUIPOS' : 'TODOS VS TODOS';
    }
  }

  // =========================================================================
  // 10. GESTIÓN DE GRANADAS EN 3D
  // =========================================================================

  function createGrenadeMesh() {
    const g = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
    );
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.1, 6),
      new THREE.MeshLambertMaterial({ color: 0x999999 })
    );
    pin.position.y = 0.2;
    g.add(sphere, pin);
    return g;
  }

  function createExplosionEffect(x, y, z) {
    playSound('explosion');

    // Esfera luminosa de onda expansiva
    const sphereGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
    });
    const explosionSphere = new THREE.Mesh(sphereGeo, sphereMat);
    explosionSphere.position.set(x, y, z);
    scene.add(explosionSphere);

    // Partículas de chispas
    const particleCount = 20;
    const pGroup = new THREE.Group();
    pGroup.position.set(x, y, z);
    const pGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffeaa7 });
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Mesh(pGeo, pMat);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 8 + 2,
        (Math.random() - 0.5) * 12
      );
      particles.push({ mesh: p, vel });
      pGroup.add(p);
    }
    scene.add(pGroup);

    // Animación de expansión y disipación
    let start = performance.now();
    function animateExplosion() {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > 0.45) {
        scene.remove(explosionSphere);
        scene.remove(pGroup);
        sphereGeo.dispose();
        sphereMat.dispose();
        pGeo.dispose();
        pMat.dispose();
        return;
      }
      const scale = 1 + elapsed * 12;
      explosionSphere.scale.set(scale, scale, scale);
      sphereMat.opacity = Math.max(0, 0.85 - elapsed * 2);

      particles.forEach(p => {
        p.mesh.position.addScaledVector(p.vel, 0.016);
        p.vel.y -= 20 * 0.016; // Gravedad en chispas
      });

      requestAnimationFrame(animateExplosion);
    }
    animateExplosion();
  }

  // =========================================================================
  // 11. MECÁNICA DE DISPARO Y LANZAMIENTO DE GRANADA
  // =========================================================================

  function shoot() {
    if (isReloading) return;

    // Si no quedan balas en el cargador
    if (ammoState[currentWeapon] <= 0) {
      playSound('empty');
      reloadWeapon();
      return;
    }

    const now = Date.now();
    const config = WEAPON_CONFIGS[currentWeapon];
    if (now - lastShootTime < config.cooldown) return;
    lastShootTime = now;

    // Consumir munición y actualizar interfaz
    ammoState[currentWeapon]--;
    updateAmmoHUD();
    if (ammoState[currentWeapon] <= 0) {
      setTimeout(reloadWeapon, 200);
    }

    playSound(currentWeapon);

    // Animación de dispersión en el crosshair
    if (crosshairEl) {
      crosshairEl.classList.add('shooting');
      setTimeout(() => crosshairEl.classList.remove('shooting'), 80);
    }

    // Efecto visual de muzzle flash
    if (activeFPSWeaponGroup) {
      const flash = activeFPSWeaponGroup.getObjectByName('flash');
      if (flash) {
        flash.material.opacity = 1;
        setTimeout(() => { flash.material.opacity = 0; }, 60);
      }
    }

    // Retroceso visual
    animateRecoil();

    // Raycasting según el arma (escopeta = múltiples perdigones con dispersión)
    const targetsHit = [];
    const hitboxes = getActiveHitboxes();

    // Precisión mejorada con ADS (apuntado con clic derecho)
    const activeSpread = isAiming ? (config.spread * 0.25) : config.spread;

    for (let i = 0; i < config.pellets; i++) {
      // Dispersión
      const spreadX = (Math.random() - 0.5) * activeSpread * 2;
      const spreadY = (Math.random() - 0.5) * activeSpread * 2;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);

      // Trazo de bala
      createTracerFromCamera(raycaster.ray.direction, config.tracerColor, config.tracerWidth);

      // Detectar impactos y headshot
      if (hitboxes.length > 0) {
        const intersects = raycaster.intersectObjects(hitboxes.map(h => h.mesh), false);
        if (intersects.length > 0) {
          const hitObj = intersects[0].object;
          const found = hitboxes.find(h => h.mesh === hitObj);
          if (found) {
            const hitPoint = intersects[0].point;
            const rp = remotePlayers[found.id];
            // Si el impacto fue en la zona de la cabeza (y >= 1.35 relativo al personaje)
            const isHead = rp ? (hitPoint.y - rp.mesh.position.y >= 1.35) : false;

            targetsHit.push({ id: found.id, headshot: isHead });
            createHitSparks(hitPoint);

            if (isHead) {
              playSound('headshot');
              showCenterToast('🎯 ¡HEADSHOT!');
            }
          }
        }
      }
    }

    // Enviar impactos al servidor
    socket.emit('player:shoot', { targets: targetsHit });
  }

  function throwGrenade() {
    const now = Date.now();
    if (now - lastGrenadeTime < GRENADE_CD_MS) return;
    lastGrenadeTime = now;

    // Vector dirección de la cámara
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(camera.quaternion);

    socket.emit('player:grenade-throw', {
      dirX: dir.x,
      dirY: dir.y + 0.2, // Ligero arco hacia arriba
      dirZ: dir.z,
    });
  }

  function getActiveHitboxes() {
    const list = [];
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      // En TDM ignorar aliados en hitboxes
      if (currentConfig.mode === 'tdm' && myTeam && rp.team === myTeam) continue;

      if (rp.alive && rp.mesh.visible) {
        const hb = rp.mesh.getObjectByName('hitbox');
        if (hb) {
          hb.updateMatrixWorld(true);
          list.push({ id, mesh: hb });
        }
      }
    }
    return list;
  }

  function animateRecoil() {
    if (!activeFPSWeaponGroup) return;
    const kick = currentWeapon === 'sniper' ? 0.15 : (currentWeapon === 'shotgun' ? 0.12 : 0.06);
    activeFPSWeaponGroup.position.z += kick;
    activeFPSWeaponGroup.rotation.x -= kick * 0.8;
    setTimeout(() => {
      activeFPSWeaponGroup.position.z -= kick * 0.5;
      activeFPSWeaponGroup.rotation.x += kick * 0.4;
    }, 45);
    setTimeout(() => {
      activeFPSWeaponGroup.rotation.set(0, 0, 0);
    }, 120);
  }

  function createTracerFromCamera(direction, colorHex, lineWidth) {
    const start = camera.position.clone().add(direction.clone().multiplyScalar(0.8));
    const end = camera.position.clone().add(direction.clone().multiplyScalar(75));

    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: lineWidth, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);

    setTimeout(() => {
      scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 60);
  }

  function createHitSparks(pos) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    spark.position.copy(pos);
    scene.add(spark);
    setTimeout(() => {
      scene.remove(spark);
      spark.geometry.dispose();
      spark.material.dispose();
    }, 90);
  }

  // =========================================================================
  // 12. FÍSICAS Y COLISIONES AABB
  // =========================================================================

  function resolveCollisions(pos, radius) {
    for (const box of mapColliders) {
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
          const pushDist = radius - dist;
          pos.x += (dx / dist) * pushDist;
          pos.z += (dz / dist) * pushDist;
        } else {
          pos.x += radius;
        }
      }
    }
    return pos;
  }

  function getGroundHeight(pos) {
    let ground = 0;
    for (const box of mapColliders) {
      if (
        pos.x + PLAYER_RADIUS > box.minX &&
        pos.x - PLAYER_RADIUS < box.maxX &&
        pos.z + PLAYER_RADIUS > box.minZ &&
        pos.z - PLAYER_RADIUS < box.maxZ
      ) {
        if (box.maxY <= pos.y + 0.25 && box.maxY > ground) {
          ground = box.maxY;
        }
      }
    }
    return ground;
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
    pointerHint.classList.add('hidden');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  function closePauseMenu() {
    isPaused = false;
    pauseOverlay.classList.add('hidden');
  }

  function exitToLobby() {
    isPaused = false;
    isInGame = false;
    isMouseDown = false;
    isAiming = false;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    pauseOverlay.classList.add('hidden');
    hudEl.classList.add('hidden');
    deathOverlay.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  }

  function initControls() {
    const canvas = renderer.domElement;

    // Pointer Lock
    canvas.addEventListener('click', () => {
      if (isInGame && !isPointerLocked && !isPaused) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = (document.pointerLockElement === canvas);

      if (!isPointerLocked) {
        isMouseDown = false;
        isAiming = false;
        // Si el usuario sale del Pointer Lock (ej. con ESC) durante la partida, abrimos menú de pausa
        if (isInGame && isAlive && !isPaused) {
          openPauseMenu();
        }
      } else {
        closePauseMenu();
      }

      if (isInGame && !isPaused) {
        pointerHint.classList.toggle('hidden', isPointerLocked);
      }
    });

    // Ratón: Rotación de cámara
    document.addEventListener('mousemove', (e) => {
      if (!isPointerLocked || !isInGame || !isAlive || isPaused || isChatting) return;
      // Sensibilidad reducida al apuntar (ADS) para mayor precisión + multiplicador del usuario
      const currentSens = (isAiming ? MOUSE_SENSITIVITY * 0.55 : MOUSE_SENSITIVITY) * mouseSensitivityFactor;
      yaw   -= e.movementX * currentSens;
      pitch -= e.movementY * currentSens;
      pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
    });

    // Clic Izquierdo (Disparo) / Clic Derecho (Apuntar ADS)
    document.addEventListener('mousedown', (e) => {
      if (isPaused || !isInGame || !isAlive || isChatting) return;
      if (!isPointerLocked) return;

      if (e.button === 0) {
        isMouseDown = true;
        shoot(); // Disparo inmediato al pulsar
      } else if (e.button === 2) {
        isAiming = true; // Activar ADS
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        isMouseDown = false;
      } else if (e.button === 2) {
        isAiming = false; // Desactivar ADS
      }
    });

    window.addEventListener('blur', () => {
      isMouseDown = false;
      isAiming = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Teclas
    document.addEventListener('keydown', (e) => {
      // Tabulador para abrir marcador
      if (e.code === 'Tab') {
        e.preventDefault();
        if (scoreboardOverlay && isInGame) {
          scoreboardOverlay.classList.remove('hidden');
          updateScoreboard(lastKnownPlayers);
        }
        return;
      }

      // Si está escribiendo en el chat, ignorar resto de teclas de juego
      if (isChatting) return;

      keys[e.code] = true;

      // Tecla Escape para pausar o reanudar
      if (e.code === 'Escape') {
        if (isInGame) {
          if (!isPaused) {
            openPauseMenu();
          } else {
            closePauseMenu();
            canvas.requestPointerLock();
          }
        }
        return;
      }

      if (!isInGame || !isAlive || isPaused) return;

      // Abrir Chat Flotante con tecla T
      if (e.code === 'KeyT') {
        e.preventDefault();
        openChatBar();
        return;
      }

      // Emote Express con tecla B
      if (e.code === 'KeyB') {
        e.preventDefault();
        const now = Date.now();
        if (now - lastEmoteTime > 1500) {
          lastEmoteTime = now;
          if (socket) socket.emit('player:emote', { emoteType: 'spin' });
          triggerEmote(myId);
        }
        return;
      }

      // Recarga manual con tecla R
      if (e.code === 'KeyR') {
        reloadWeapon();
        return;
      }

      // Cambio de armas por teclas 1, 2, 3
      if (e.code === 'Digit1' || e.code === 'Numpad1') selectWeapon('rifle');
      if (e.code === 'Digit2' || e.code === 'Numpad2') selectWeapon('shotgun');
      if (e.code === 'Digit3' || e.code === 'Numpad3') selectWeapon('sniper');

      // Lanzar granada con 'Q' o 'G'
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

    // Rueda del ratón para ciclar armas
    window.addEventListener('wheel', (e) => {
      if (!isPointerLocked || !isInGame || !isAlive || isPaused || isChatting) return;
      const idx = WEAPON_KEYS.indexOf(currentWeapon);
      let nextIdx = e.deltaY > 0 ? (idx + 1) % WEAPON_KEYS.length : (idx - 1 + WEAPON_KEYS.length) % WEAPON_KEYS.length;
      selectWeapon(WEAPON_KEYS[nextIdx]);
    });

    // Eventos del Menú de Pausa
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        closePauseMenu();
        canvas.requestPointerLock();
      });
    }

    if (exitLobbyBtn) {
      exitLobbyBtn.addEventListener('click', () => {
        exitToLobby();
      });
    }

    if (pauseWepRifle) {
      pauseWepRifle.addEventListener('click', () => selectWeapon('rifle'));
    }
    if (pauseWepShotgun) {
      pauseWepShotgun.addEventListener('click', () => selectWeapon('shotgun'));
    }
    if (pauseWepSniper) {
      pauseWepSniper.addEventListener('click', () => selectWeapon('sniper'));
    }

    // Slider de Sensibilidad del Ratón
    if (mouseSensSlider) {
      mouseSensSlider.addEventListener('input', (e) => {
        mouseSensitivityFactor = parseFloat(e.target.value);
        if (sensValueText) sensValueText.textContent = mouseSensitivityFactor.toFixed(1) + 'x';
      });
    }

    // Funciones del Chat Flotante
    function openChatBar() {
      if (!chatBarContainer || !chatInput) return;
      isChatting = true;
      isMouseDown = false;
      isAiming = false;
      chatBarContainer.classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
      chatInput.value = '';
      setTimeout(() => chatInput.focus(), 20);
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
        e.stopPropagation(); // Evitar disparar controles de movimiento
        if (e.key === 'Enter') {
          const msg = chatInput.value.trim();
          if (msg && socket) {
            socket.emit('player:chat', { message: msg });
          }
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

    // Actualización de configuración del servidor
    socket.on('game:config', (cfg) => {
      currentConfig = cfg;
      loadMap(cfg.map);
      updateLobbyUI();
      if (cfg.teamScores) updateTeamScores(cfg.teamScores);
    });

    // Confirmación al unirse
    socket.on('you:joined', (data) => {
      myId = data.id;
      myTeam = data.team;
      currentConfig = data.config;

      loadMap(data.config.map);

      // Instanciar jugadores remotos existentes
      for (const id in data.players) {
        if (id !== myId) {
          addRemotePlayer(id, data.players[id], data.customizations[id]);
        } else {
          localPos.set(data.players[id].x, data.players[id].y, data.players[id].z);
        }
      }
    });

    socket.on('player:joined', (data) => {
      if (data.id !== myId) {
        addRemotePlayer(data.id, data, data);
      }
    });

    socket.on('player:left', (data) => {
      removeRemotePlayer(data.id);
    });

    socket.on('player:customized', (data) => {
      if (remotePlayers[data.id]) {
        updateRemotePlayerVisuals(data.id, data);
      }
    });

    // Chat flotante 3D (Tecla T)
    socket.on('player:chat', (data) => {
      displaySpeechBubble(data.id, data.message);
    });

    // Emotes Express 3D (Tecla B)
    socket.on('player:emote', (data) => {
      triggerEmote(data.id);
    });

    // Estado global de la partida
    socket.on('game:state', (state) => {
      const { players, grenades, teamScores } = state;
      lastKnownPlayers = players;

      // Actualizar estado propio
      if (players[myId]) {
        const me = players[myId];
        myHP = me.hp;
        myKills = me.kills;
        myDeaths = me.deaths;
        isAlive = me.alive;
      }

      // Actualizar jugadores remotos
      for (const id in players) {
        if (id === myId) continue;
        const p = players[id];
        if (remotePlayers[id]) {
          remotePlayers[id].targetPos.set(p.x, p.y, p.z);
          remotePlayers[id].targetRotY = p.rotY || 0;
          remotePlayers[id].targetRotX = p.rotX || 0;
          remotePlayers[id].alive = p.alive;
          remotePlayers[id].mesh.visible = p.alive;
        } else {
          addRemotePlayer(id, p, p);
        }
      }

      // Eliminar jugadores ausentes
      for (const id in remotePlayers) {
        if (!players[id]) removeRemotePlayer(id);
      }

      // Sincronizar granadas
      syncGrenades(grenades);

      // Marcadores y HUD
      if (teamScores) updateTeamScores(teamScores);
      updateHUD(players);

      // Si el scoreboard TAB está desplegado, actualizarlo en vivo
      if (scoreboardOverlay && !scoreboardOverlay.classList.contains('hidden')) {
        updateScoreboard(players);
      }
    });

    // Granadas
    socket.on('grenade:spawn', (g) => {
      if (!activeGrenades[g.id]) {
        const mesh = createGrenadeMesh();
        mesh.position.set(g.x, g.y, g.z);
        scene.add(mesh);
        activeGrenades[g.id] = { mesh, targetPos: new THREE.Vector3(g.x, g.y, g.z) };
      }
    });

    socket.on('grenade:explode', (data) => {
      if (activeGrenades[data.id]) {
        scene.remove(activeGrenades[data.id].mesh);
        delete activeGrenades[data.id];
      }
      createExplosionEffect(data.x, data.y, data.z);
    });

    // Impactos recibidos o dados
    socket.on('player:hit', (data) => {
      if (data.targetId === myId) {
        playSound('hit');
        damageFlash.classList.add('active');
        setTimeout(() => damageFlash.classList.remove('active'), 180);
      } else if (data.shooterId === myId && data.headshot) {
        playSound('headshot');
        showCenterToast('🎯 ¡HEADSHOT!');
      }
    });

    // Bajas
    socket.on('player:killed', (data) => {
      addKillFeedEntry(data.killerNickname, data.targetNickname, data.weapon, data.headshot);
      if (data.targetId === myId) {
        isAlive = false;
        killedByText.textContent = `Eliminado por ${data.killerNickname} (${data.weapon || 'arma'})${data.headshot ? ' [HEADSHOT]' : ''}`;
        deathOverlay.classList.remove('hidden');
      }
    });

    // Reaparición
    socket.on('player:respawn', (data) => {
      if (data.id === myId) {
        localPos.set(data.x, data.y, data.z);
        velocityY = 0;
        isOnGround = true;
        isAlive = true;
        myHP = 100;
        deathOverlay.classList.add('hidden');
        yaw = 0;
        pitch = 0;
      }
    });

    // Fin de partida
    socket.on('game:over', (data) => {
      gameoverText.textContent = data.reason;
      gameoverOverlay.classList.remove('hidden');
      setTimeout(() => { gameoverOverlay.classList.add('hidden'); }, 4000);
    });
  }

  function addRemotePlayer(id, pData, customData) {
    if (remotePlayers[id]) return;
    const mesh = createPlayerModel({ ...pData, ...customData });
    mesh.position.set(pData.x || 0, pData.y || 0, pData.z || 0);
    scene.add(mesh);

    const headPitchGroup = mesh.getObjectByName('head-pitch-group');
    const gunGroup = mesh.getObjectByName('gun-external');

    remotePlayers[id] = {
      mesh,
      headPitchGroup,
      gunGroup,
      targetPos: new THREE.Vector3(pData.x || 0, pData.y || 0, pData.z || 0),
      targetRotY: pData.rotY || 0,
      targetRotX: pData.rotX || 0,
      nickname: pData.nickname,
      team: pData.team,
      alive: pData.alive !== false,
    };
  }

  function updateRemotePlayerVisuals(id, customData) {
    const rp = remotePlayers[id];
    if (!rp) return;
    const targetGroup = rp.headPitchGroup || rp.mesh;
    attachHat(targetGroup, customData.hat);
    attachGlasses(targetGroup, customData.glasses);
  }

  function removeRemotePlayer(id) {
    const rp = remotePlayers[id];
    if (!rp) return;
    scene.remove(rp.mesh);
    rp.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    delete remotePlayers[id];
  }

  function syncGrenades(serverGrenades) {
    for (const gid in serverGrenades) {
      const sg = serverGrenades[gid];
      if (activeGrenades[gid]) {
        activeGrenades[gid].mesh.position.set(sg.x, sg.y, sg.z);
      } else {
        const mesh = createGrenadeMesh();
        mesh.position.set(sg.x, sg.y, sg.z);
        scene.add(mesh);
        activeGrenades[gid] = { mesh };
      }
    }
    for (const gid in activeGrenades) {
      if (!serverGrenades[gid]) {
        scene.remove(activeGrenades[gid].mesh);
        delete activeGrenades[gid];
      }
    }
  }

  // =========================================================================
  // 15. INTERFAZ Y HUD
  // =========================================================================

  function updateHUD(allPlayers) {
    // Barra de vida
    const hpVal = Math.max(0, myHP);
    healthBar.style.width = hpVal + '%';
    healthText.textContent = hpVal + ' HP';

    if (hpVal > 60) healthBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
    else if (hpVal > 30) healthBar.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
    else healthBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';

    killCountEl.textContent = myKills;
    deathCountEl.textContent = myDeaths;

    // Indicador circular de granada
    const now = Date.now();
    const gElapsed = now - lastGrenadeTime;
    if (gElapsed < GRENADE_CD_MS) {
      const progress = gElapsed / GRENADE_CD_MS;
      grenadeCdCircle.style.strokeDashoffset = (100 - progress * 100);
      grenadeCdCircle.style.stroke = '#e74c3c';
    } else {
      grenadeCdCircle.style.strokeDashoffset = '0';
      grenadeCdCircle.style.stroke = '#4ade80';
    }

    // Cooldown del arma
    const wConfig = WEAPON_CONFIGS[currentWeapon];
    const wElapsed = now - lastShootTime;
    if (wElapsed < wConfig.cooldown) {
      const pct = (wElapsed / wConfig.cooldown) * 100;
      weaponCooldownBar.style.width = pct + '%';
    } else {
      weaponCooldownBar.style.width = '100%';
    }

    // Lista de jugadores
    if (allPlayers) {
      const sorted = Object.values(allPlayers).sort((a, b) => b.kills - a.kills);
      playerListEl.innerHTML = '';
      sorted.forEach(p => {
        const row = document.createElement('div');
        row.className = 'pl-entry' + (p.alive ? '' : ' dead');
        if (p.team) row.classList.add('team-' + p.team);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'pl-name';
        nameSpan.textContent = (p.id === myId ? '► ' : '') + p.nickname;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'pl-score';
        scoreSpan.textContent = p.kills + '/' + p.deaths;

        row.appendChild(nameSpan);
        row.appendChild(scoreSpan);
        playerListEl.appendChild(row);
      });
    }
  }

  function updateTeamScores(scores) {
    if (currentConfig.mode === 'tdm') {
      teamScoreEl.classList.remove('hidden');
      teamRedScoreEl.textContent = scores.red || 0;
      teamBlueScoreEl.textContent = scores.blue || 0;
    } else {
      teamScoreEl.classList.add('hidden');
    }
  }

  function addKillFeedEntry(killer, target, weapon, headshot) {
    const entry = document.createElement('div');
    entry.className = 'kf-entry';
    const wepLabel = weapon === 'grenade' ? '💣 Granada' : (weapon === 'lava' ? '🌋 Lava' : (WEAPON_CONFIGS[weapon] ? WEAPON_CONFIGS[weapon].name : 'Arma'));
    const hsBadge = headshot ? `<span class="kf-headshot">🎯 [HEADSHOT]</span>` : '';
    entry.innerHTML = `<span class="kf-killer">${escapeHtml(killer)}</span> <span class="kf-weapon">[${wepLabel}]</span>${hsBadge} ➔ <span class="kf-target">${escapeHtml(target)}</span>`;
    killFeedEl.appendChild(entry);

    while (killFeedEl.children.length > 5) killFeedEl.removeChild(killFeedEl.firstChild);
    setTimeout(() => { if (entry.parentNode) entry.parentNode.removeChild(entry); }, 5000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function updateLobbyUI() {
    const mapNames = {
      cybergrid: 'Neon Cyber-Grid',
      volcano: 'Isla Volcánica',
      toyroom: 'Giant Toyroom',
    };
    const mapTitle = mapNames[currentConfig.map] || currentConfig.map;
    configStatus.textContent = `Modo activo: ${currentConfig.mode.toUpperCase()} | Mapa: ${mapTitle}`;

    // Sincronizar botones activos en el lobby
    document.querySelectorAll('[data-map]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.map === currentConfig.map);
    });
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === currentConfig.mode);
    });
  }

  // =========================================================================
  // 16. BUCLE PRINCIPAL (GAME LOOP)
  // =========================================================================

  let lastSendPosTime = 0;

  function gameLoop() {
    requestAnimationFrame(gameLoop);
    const delta = clock.getDelta();

    if (isInGame && isAlive && !isPaused) {
      // Disparo automático continuo si es fusil (rifle)
      if (isMouseDown && currentWeapon === 'rifle' && isPointerLocked) {
        shoot();
      }

      updateMovement(delta);
      updateCamera();

      // Interpolación suave del FOV (Efecto Zoom ADS al apuntar)
      const targetFov = isAiming ? (currentWeapon === 'sniper' ? 28 : 45) : BASE_FOV;
      currentFov = THREE.MathUtils.lerp(currentFov, targetFov, delta * 12);
      if (Math.abs(camera.fov - currentFov) > 0.05) {
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }

      // Estilo de crosshair al apuntar
      if (crosshairEl) {
        crosshairEl.classList.toggle('ads-aim', isAiming);
      }

      // Enviar posición a ~30 FPS
      const now = Date.now();
      if (now - lastSendPosTime > 33) {
        lastSendPosTime = now;
        socket.emit('player:move', {
          x: localPos.x, y: localPos.y, z: localPos.z,
          rotX: pitch, rotY: yaw,
        });
      }

      // Animación de balanceo y transición ADS del arma
      animateWeaponSway(delta);
    } else {
      // Si está pausado o muerto, restablecer suavemente FOV
      if (Math.abs(camera.fov - BASE_FOV) > 0.05) {
        currentFov = THREE.MathUtils.lerp(currentFov, BASE_FOV, delta * 10);
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }
      if (crosshairEl) crosshairEl.classList.remove('ads-aim');
    }

    // Interpolar jugadores remotos
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      if (!rp.mesh.visible) continue;
      rp.mesh.position.lerp(rp.targetPos, LERP_FACTOR);

      // Rotación suave
      const curY = rp.mesh.rotation.y;
      let diff = rp.targetRotY - curY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rp.mesh.rotation.y = curY + diff * LERP_FACTOR;
    }

    renderer.render(scene, camera);
  }

  function updateMovement(delta) {
    if (isChatting) return; // Congelar movimiento mientras escribe en el chat

    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);

    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    forward.applyQuaternion(yawQuat);
    right.applyQuaternion(yawQuat);

    const move = new THREE.Vector3(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp'])    move.add(forward);
    if (keys['KeyS'] || keys['ArrowDown'])  move.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft'])  move.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) move.add(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(MOVE_SPEED * delta);
    }

    localPos.x += move.x;
    localPos.z += move.z;

    // Salto y gravedad
    if (keys['Space'] && isOnGround) {
      velocityY = JUMP_VELOCITY;
      isOnGround = false;
    }

    velocityY += GRAVITY * delta;
    localPos.y += velocityY * delta;

    const groundH = getGroundHeight(localPos);
    if (localPos.y <= groundH) {
      localPos.y = groundH;
      velocityY = 0;
      isOnGround = true;
    }

    resolveCollisions(localPos, PLAYER_RADIUS);
  }

  function updateCamera() {
    camera.position.set(localPos.x, localPos.y + PLAYER_HEIGHT, localPos.z);
    const roll = isEmoting ? Math.sin(emoteTime * Math.PI * 2) * 0.12 : 0;
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  }

  let swayTime = 0;
  function animateWeaponSway(delta) {
    if (!activeFPSWeaponGroup) return;

    // Posición objetivo según si está en ADS (mira centrada) o cadera (lateral derecho)
    const baseTarget = isAiming ? ADS_POS : HIP_FIRE_POS;
    const lerpSpeed = isAiming ? 15 : 10;

    const isMoving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];
    let swayX = 0;
    let swayY = 0;

    if (isMoving) {
      swayTime += delta * 9;
      // Balanceo atenuado al apuntar para estabilizar la mira
      const swayAmp = isAiming ? 0.002 : 0.015;
      swayX = Math.sin(swayTime) * swayAmp;
      swayY = Math.abs(Math.cos(swayTime)) * (swayAmp * 0.7);
    }

    const destX = baseTarget.x + swayX;
    const destY = baseTarget.y + swayY;
    const destZ = baseTarget.z;

    activeFPSWeaponGroup.position.x = THREE.MathUtils.lerp(activeFPSWeaponGroup.position.x, destX, delta * lerpSpeed);
    activeFPSWeaponGroup.position.y = THREE.MathUtils.lerp(activeFPSWeaponGroup.position.y, destY, delta * lerpSpeed);
    activeFPSWeaponGroup.position.z = THREE.MathUtils.lerp(activeFPSWeaponGroup.position.z, destZ, delta * lerpSpeed);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // =========================================================================
  // 17. ARRANQUE DEL JUEGO DESDE EL LOBBY
  // =========================================================================

  function initLobbyEvents() {
    // Botones de Modo de Juego
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (socket) socket.emit('game:set-config', { mode: btn.dataset.mode });
      });
    });

    // Botones de Mapa
    document.querySelectorAll('[data-map]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-map]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (socket) socket.emit('game:set-config', { map: btn.dataset.map });
      });
    });

    // Botón de Unirse
    joinBtn.addEventListener('click', () => {
      joinGame();
    });

    nicknameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinGame();
    });
  }

  function joinGame() {
    const nickname = nicknameInput.value.trim() || 'HuevoPro';
    const color = colorPicker.value;
    const hat = hatSelect.value;
    const glasses = glassesSelect.value;
    const textureData = getCustomTextureDataURL();

    // Activar audio
    getAudioCtx();

    menuOverlay.classList.add('hidden');
    hudEl.classList.remove('hidden');
    isInGame = true;
    updateAmmoHUD();

    socket.emit('player:join', {
      nickname,
      color,
      hat,
      glasses,
      textureData,
    });

    renderer.domElement.requestPointerLock();
  }

  // =========================================================================
  // 18. ENTRADA PRINCIPAL
  // =========================================================================

  function main() {
    initTexturePainter();
    initThreeJS();
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
