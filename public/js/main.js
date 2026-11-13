// ============================================================================
// main.js — Cliente FPS de huevos (Three.js + Socket.io)
// Usa los módulos compartidos: MapDefs (mapas), GamePhysics (físicas),
// GameData (armas y modos) y MapRenderer (render de mapas).
// ============================================================================

(function () {
  'use strict';

  const { WEAPONS, MODES, RULES, TIME_LIMITS, MELEE, PRIMARY_KEYS } = window.GameData;
  const Phys = window.GamePhysics;
  const P = Phys.P;
  const MapDefs = window.MapDefs;
  const WEAPON_KEYS = PRIMARY_KEYS; // armas principales; la pistola ('pistol') la llevan todos
  const HEAD_Y = 1.1;            // por encima de esta altura (local) el impacto es en la cabeza
  const INTERP_DELAY = 110;      // ms de retraso de interpolación de jugadores remotos
  const TEAM_COLORS = { red: 0xe74c3c, blue: 0x3498db };
  const $ = id => document.getElementById(id);
  // Errores inesperados: se avisa una vez sin romper la partida
  let errorShown = false;
  function reportClientError(e) {
    if (errorShown) return;
    errorShown = true;
    try {
      const el = document.createElement('div');
      el.className = 'client-error';
      el.textContent = '⚠️ Algo ha fallado, pero puedes seguir jugando. Si notas algo raro, recarga la página (F5).';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 7000);
    } catch (err) { /* nada */ }
  }
  window.addEventListener('error', ev => { console.error('[error]', ev.error || ev.message); if (ev.error) reportClientError(ev.error); });
  window.addEventListener('unhandledrejection', ev => { console.error('[promesa]', ev.reason); });

  // ===========================================================================
  // AJUSTES PERSISTENTES Y CONTROLES CONFIGURABLES
  // ===========================================================================
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ss_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ss_' + k, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } },
  };
  const DEFAULT_SETTINGS = { sens: 1, fov: 75, vol: 0.7, invertY: false, quality: 'high', showFps: true };
  const settings = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
  // Calidad automática: en gráficas integradas modestas se empieza en "media"
  if (!store.get('settings', {}).quality) {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/SwiftShader|llvmpipe|Software/i.test(gpu)) settings.quality = 'low';
      else if (/Intel|Mali|Adreno|PowerVR|Apple GPU/i.test(gpu)) settings.quality = 'mid';
    } catch (e) { /* sin info de GPU */ }
  }

  const DEFAULT_BINDS = {
    forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space',
    emote: 'KeyB', chat: 'KeyT', scoreboard: 'Tab', hud: 'KeyH',
    fire: 'Mouse0', aim: 'Mouse2', aim2: 'ShiftLeft', reload: 'KeyR', swap: 'KeyE', grenade: 'KeyQ',
    melee: 'KeyF', inspect: 'KeyG', w1: 'Digit1', w2: 'Digit2',
  };
  const BIND_ORDER = [
    ['forward', 'Adelante'], ['fire', 'Disparar'], ['backward', 'Atrás'], ['aim', 'Apuntar'],
    ['left', 'Izquierda'], ['aim2', 'Apuntar (alt.)'], ['right', 'Derecha'], ['reload', 'Recargar'],
    ['jump', 'Saltar'], ['swap', 'Pistola ⇄ principal'], ['grenade', 'Granada (mantén = más lejos)'], ['melee', 'Golpe'],
    ['emote', 'Emote'], ['inspect', 'Inspeccionar arma'], ['chat', 'Chat'], ['w1', 'Arma principal'],
    ['scoreboard', 'Marcador'], ['w2', 'Pistola'], ['hud', 'Ocultar HUD'],
  ];
  // Controles como en Shell Shockers. La v3 cambió los de armas: se reinician una vez.
  if (store.get('bindsVer', 0) < 3) { const b = store.get('binds', {}); ['swap', 'w1', 'w2', 'w3', 'aim2', 'melee', 'inspect'].forEach(k => delete b[k]); store.set('binds', b); store.set('bindsVer', 3); }
  let binds = Object.assign({}, DEFAULT_BINDS, store.get('binds', {}));
  delete binds.w3;
  const pressed = {};
  const isDown = a => !!pressed[binds[a]];
  const actionsFor = code => Object.keys(binds).filter(a => binds[a] === code);
  function codeLabel(c) {
    if (!c) return '—';
    if (c.startsWith('Mouse')) return { Mouse0: 'CLIC IZQ', Mouse1: 'CLIC CENTRAL', Mouse2: 'CLIC DER' }[c] || 'RATÓN ' + c.slice(5);
    if (c.startsWith('Key')) return c.slice(3);
    if (c.startsWith('Digit')) return c.slice(5);
    if (c.startsWith('Numpad')) return 'NUM ' + c.slice(6);
    const map = { Space: 'ESPACIO', Tab: 'TAB', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT DER', ControlLeft: 'CTRL', ControlRight: 'CTRL DER',
      AltLeft: 'ALT', Enter: 'ENTER', Backspace: 'BORRAR', CapsLock: 'BLOQ MAYÚS', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    return map[c] || c.toUpperCase();
  }

  // ===========================================================================
  // AUDIO SINTETIZADO (Web Audio API)
  // ===========================================================================
  let audioCtx = null, master = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.value = settings.vol;
      master.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function osc(type, f0, f1, dur, vol, delay) {
    const ctx = getAudioCtx(); if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, delay) {
    const ctx = getAudioCtx(); if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 3000;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }
  function playSound(type, v) {
    v = v === undefined ? 1 : v;
    if (v < 0.02) return;
    try {
      switch (type) {
        case 'rifle': osc('sawtooth', 380, 70, 0.08, 0.22 * v); noise(0.06, 0.18 * v, 2500); break;
        case 'shotgun': noise(0.25, 0.5 * v, 1800); osc('square', 140, 40, 0.18, 0.2 * v); break;
        case 'sniper': osc('triangle', 980, 90, 0.4, 0.4 * v); noise(0.3, 0.3 * v, 4000); break;
        case 'ranger': osc('triangle', 760, 110, 0.25, 0.32 * v); noise(0.18, 0.26 * v, 3500); break;
        case 'rpegg': noise(0.45, 0.35 * v, 900); osc('sawtooth', 160, 60, 0.4, 0.2 * v); break;
        case 'whipper': osc('sawtooth', 520, 120, 0.05, 0.16 * v); noise(0.04, 0.14 * v, 3200); break;
        case 'trihard': osc('square', 430, 90, 0.07, 0.18 * v); noise(0.05, 0.16 * v, 2800); break;
        case 'pistol': osc('square', 640, 140, 0.06, 0.18 * v); noise(0.05, 0.14 * v, 3000); break;
        case 'melee': noise(0.12, 0.25 * v, 1200); osc('sine', 260, 120, 0.1, 0.15 * v); break;
        case 'whoosh': noise(0.6, 0.12 * v, 500); break;
        case 'explosion': noise(0.7, 0.8 * v, 700); osc('square', 120, 25, 0.6, 0.4 * v); break;
        case 'hit': osc('square', 620, 260, 0.06, 0.18 * v); break;
        case 'headshot': osc('square', 900, 400, 0.05, 0.2 * v); osc('sine', 1500, 1800, 0.12, 0.2 * v, 0.04); break;
        case 'kill': osc('sine', 1100, 0, 0.08, 0.3 * v); osc('sine', 1500, 0, 0.08, 0.3 * v, 0.08); osc('sine', 2000, 0, 0.16, 0.3 * v, 0.16); break;
        case 'hurt': osc('sawtooth', 220, 90, 0.14, 0.25 * v); break;
        case 'jump': osc('sine', 180, 320, 0.12, 0.12 * v); break;
        case 'land': noise(0.08, 0.15 * v, 600); break;
        case 'step': noise(0.04, 0.05 * v, 900); break;
        case 'reload': osc('triangle', 400, 0, 0.06, 0.15 * v); osc('triangle', 650, 0, 0.08, 0.15 * v, 0.12); break;
        case 'empty': osc('square', 1200, 0, 0.03, 0.12 * v); break;
        case 'switch': osc('triangle', 500, 700, 0.06, 0.1 * v); break;
        case 'cluck': osc('square', 700, 400, 0.09, 0.2 * v); osc('square', 800, 450, 0.1, 0.2 * v, 0.12); break;
        case 'pad': osc('sine', 200, 900, 0.3, 0.25 * v); break;
        case 'pickup': osc('sine', 600, 0, 0.1, 0.25 * v); osc('sine', 900, 0, 0.15, 0.25 * v, 0.1); break;
        case 'capture': [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, 0, 0.18, 0.25 * v, i * 0.1)); break;
        case 'alarm': osc('square', 440, 0, 0.15, 0.15 * v); osc('square', 330, 0, 0.15, 0.15 * v, 0.18); break;
        case 'grenade': osc('sine', 300, 150, 0.12, 0.12 * v); break;
        case 'click': osc('sine', 900, 0, 0.04, 0.1 * v); break;
      }
    } catch (e) { /* audio no disponible */ }
  }
  // Sonido atenuado por distancia a la cámara
  function playSoundAt(type, x, y, z, base) {
    if (!camera) return;
    const d = camera.position.distanceTo(new THREE.Vector3(x, y, z));
    playSound(type, (base || 1) * Math.max(0, 1 - d / 70));
  }

  // ===========================================================================
  // ESTADO GLOBAL
  // ===========================================================================
  let scene, camera, renderer, clock, lights, mapRoot, objRoot, fxRoot;
  let world = null, mapData = null, currentMapId = null;
  let socket = null;

  let inGame = false, joining = false, isPaused = false, isChatting = false, isPointerLocked = false;
  let roundState = 'playing';
  let adminId = null, roundHold = false, suppressPauseScreen = false, adminPlayersSig = '';
  let cfg = { mode: 'ffa', map: 'castle', scoreLimit: 25, timeLimit: 10, teams: false };
  const me = { id: null, team: null, alive: false, hp: 100, kills: 0, deaths: 0, score: 0, grenades: RULES.GRENADE_START || 0, prot: false };
  let st = Phys.newState(0, 0, 0);
  let yaw = 0, pitch = 0;
  let lastState = null;
  let serverOffset = null;
  let ping = 0;

  // Armas
  let primaryWeapon = store.get('weapon', 'rifle');
  if (!PRIMARY_KEYS.includes(primaryWeapon)) primaryWeapon = 'rifle';
  let currentWeapon = primaryWeapon;      // primaryWeapon o 'pistol'
  let pendingPrimary = null;              // arma elegida que se equipa al reaparecer
  let spawnedAt = 0, firedSinceSpawn = false;
  const ammo = {};
  Object.keys(WEAPONS).forEach(k => { ammo[k] = WEAPONS[k].maxAmmo; });
  let burstLeft = 0, nextBurstAt = 0, lastMeleeAt = 0, meleeAnim = 0, inspectAnim = 0, grenadeCharge = null;
  let lastShootTime = 0, isReloading = false, reloadEndsAt = 0, reloadTimer = null;
  let isMouseDown = false, isAiming = false;
  let currentFov = settings.fov;
  let fpsWeapons = {}, activeFPS = null;
  let recoilZ = 0, recoilRot = 0, swayTime = 0, switchAnim = 0, landDip = 0, camShake = 0, stepTimer = 0;
  const HIP_POS = new THREE.Vector3(0.27, -0.25, -0.45);
  const ADS_POS = new THREE.Vector3(0.0, -0.17, -0.36);

  // Entidades
  const remotePlayers = {};
  const grenades = {};
  const effects = [];
  let deathCam = null;

  // ===========================================================================
  // ELEMENTOS DEL DOM
  // ===========================================================================
  const menuOverlay = $('menu-overlay'), hudEl = $('hud');
  const colorPicker = $('color-picker'), color2Picker = $('color2-picker');
  const gameoverOverlay = $('gameover-overlay');
  const scoreboardOverlay = $('scoreboard-overlay'), scoreboardEntries = $('scoreboard-entries');
  const hitmarkerEl = $('hitmarker'), crosshairEl = $('crosshair');
  const healthText = $('health-text');
  const killFeedEl = $('kill-feed'), chatLogEl = $('chat-log');
  const damageFlash = $('damage-flash');
  const ammoBulletIcons = $('ammo-bullet-icons'), ammoCurrentEl = $('ammo-current'), ammoMaxEl = $('ammo-max');
  const reloadHint = $('reload-hint'), activeWeaponName = $('active-weapon-name');
  const chatBar = $('chat-bar-container'), chatInput = $('chat-input');
  const centerToast = $('center-toast'), bigBanner = $('big-banner');
  const scopeOverlay = $('scope-overlay');
  const textureCanvas = $('texture-canvas');
  const textureCtx = textureCanvas ? textureCanvas.getContext('2d') : null;

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function setText(el, txt) { if (el && el.textContent !== String(txt)) el.textContent = txt; }
  function fmtTime(s) { if (s === null || s === undefined) return '∞'; s = Math.max(0, s | 0); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; }

  // ===========================================================================
  // PINTURA DE LA CÁSCARA (capa transparente encima del color y el diseño)
  // ===========================================================================
  let isPainting = false;

  function paintIsEmpty() {
    const d = textureCtx.getImageData(0, 0, 128, 128).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return false;
    return true;
  }
  function loadPaintFromCustom() {
    if (!textureCtx) return;
    textureCtx.clearRect(0, 0, 128, 128);
    if (custom.paint) { const img = new Image(); img.onload = () => textureCtx.drawImage(img, 0, 0, 128, 128); img.src = custom.paint; }
  }
  function updatePainterBackground() {
    if (!textureCanvas) return;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    window.EggModel.drawPattern(cv.getContext('2d'), 128, 128, custom);
    textureCanvas.style.backgroundImage = `url(${cv.toDataURL()})`;
  }
  // Estado del pincel (compartido entre la vista plana y el huevo 3D)
  const brush = { tool: 'brush', color: '#ff8a3d', size: 5, mirror: true };
  const BRUSH_COLORS = ['#ff8a3d', '#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ffffff', '#1d1d1d'];
  const paintUndo = [];
  function pushUndo() {
    if (!textureCtx) return;
    paintUndo.push(textureCtx.getImageData(0, 0, 128, 128));
    if (paintUndo.length > 25) paintUndo.shift();
  }
  function stampAt(x, y, prev) {
    // x,y en coordenadas de la capa (128x128). La cáscara da la vuelta: se repite en x±128.
    const g = textureCtx;
    const r = brush.size;
    g.globalCompositeOperation = brush.tool === 'eraser' ? 'destination-out' : 'source-over';
    g.strokeStyle = g.fillStyle = brush.color;
    for (const off of [-128, 0, 128]) {
      if (brush.tool === 'spray') {
        for (let i = 0; i < 6 + r * 2; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 1.6;
          g.globalAlpha = 0.55; g.fillRect(x + off + Math.cos(a) * d, y + Math.sin(a) * d, 1, 1);
        }
        g.globalAlpha = 1;
        continue;
      }
      if (prev && Math.abs(prev.x - x) < 64) {
        g.lineWidth = r * 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(prev.x + off, prev.y); g.lineTo(x + off, y); g.stroke();
      }
      g.beginPath(); g.arc(x + off, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  function paintStroke(x, y, prev) {
    stampAt(x, y, prev);
    // Simetría izquierda/derecha: en la cáscara equivale a reflejar u -> 1 - u
    if (brush.mirror) stampAt(128 - x, y, prev ? { x: 128 - prev.x, y: prev.y } : null);
  }
  // Actualiza la textura del huevo de la vista previa sin reconstruir el modelo
  let paintBase = null;
  function livePaintTexture() {
    if (!previewModel || !previewModel.egg) return;
    const tex = previewModel.egg.material.map;
    if (!tex || !tex.image || !tex.image.getContext) return;
    const g = tex.image.getContext('2d');
    if (!paintBase) {
      paintBase = document.createElement('canvas'); paintBase.width = 256; paintBase.height = 128;
      window.EggModel.drawPattern(paintBase.getContext('2d'), 256, 128, custom);
    }
    g.clearRect(0, 0, 256, 128);
    g.drawImage(paintBase, 0, 0);
    g.drawImage(textureCanvas, 0, 0, 256, 128);
    tex.needsUpdate = true;
  }
  let paintCommitTimer = null;
  function commitPaint(rebuild) {
    custom.paint = paintIsEmpty() ? null : textureCanvas.toDataURL('image/png');
    if (rebuild) { paintBase = null; updatePreviewAvatar(); }
    saveProfileSoon(); drawAccountEgg();
  }
  function refreshBrushUI() {
    document.querySelectorAll('#brush-tool [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === brush.tool));
    document.querySelectorAll('#brush-swatches [data-c]').forEach(b => b.classList.toggle('active', b.dataset.c === brush.color));
    $('brush-color').value = brush.color;
    $('brush-eraser').checked = brush.tool === 'eraser';
    const dot = $('brush-dot');
    dot.style.setProperty('--d', Math.min(24, 4 + brush.size * 0.9) + 'px');
    dot.style.setProperty('--bc', brush.tool === 'eraser' ? '#ffffff' : brush.color);
  }
  function undoPaint() {
    const im = paintUndo.pop();
    if (!im) return;
    textureCtx.putImageData(im, 0, 0);
    livePaintTexture();
    commitPaint(false);
    playSound('click', 0.4);
  }
  function initTexturePainter() {
    if (!textureCanvas || !textureCtx) return;
    $('brush-swatches').innerHTML = BRUSH_COLORS.map(c => `<button data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');
    $('brush-swatches').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; brush.color = b.dataset.c; if (brush.tool === 'eraser') brush.tool = 'brush'; refreshBrushUI(); });
    $('brush-color').addEventListener('input', e => { brush.color = e.target.value; if (brush.tool === 'eraser') brush.tool = 'brush'; refreshBrushUI(); });
    $('brush-tool').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (!b) return; brush.tool = b.dataset.tool; refreshBrushUI(); });
    $('brush-size').addEventListener('input', e => { brush.size = parseInt(e.target.value, 10) || 5; refreshBrushUI(); });
    $('brush-mirror').addEventListener('change', e => { brush.mirror = e.target.checked; });
    $('painter-undo').addEventListener('click', undoPaint);
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !inGame && menuOverlay.dataset.panel === 'inventory' && invTab === 'paint') { e.preventDefault(); undoPaint(); }
    });
    refreshBrushUI();
    // Vista plana (cáscara desenrollada)
    const coords = e => {
      const r = textureCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * 128 / r.width, y: (e.clientY - r.top) * 128 / r.height };
    };
    let last = null;
    textureCanvas.addEventListener('pointerdown', e => { isPainting = true; pushUndo(); last = null; textureCanvas.setPointerCapture(e.pointerId); const c = coords(e); paintStroke(c.x, c.y, null); last = c; livePaintTexture(); });
    textureCanvas.addEventListener('pointermove', e => {
      if (!isPainting) return;
      const c = coords(e); paintStroke(c.x, c.y, last); last = c; livePaintTexture();
    });
    textureCanvas.addEventListener('pointerup', () => { if (isPainting) commitPaint(false); isPainting = false; last = null; });
    $('painter-clear').addEventListener('click', () => { pushUndo(); textureCtx.clearRect(0, 0, 128, 128); livePaintTexture(); commitPaint(false); });
  }

  // Pintar directamente sobre el huevo 3D de la vista previa
  const paintRay = new THREE.Raycaster();
  function paintMode() { return !inGame && menuOverlay.dataset.panel === 'inventory' && invTab === 'paint'; }
  function eggUVAt(e) {
    if (!previewModel || !previewModel.egg) return null;
    const r = previewCanvas.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    previewModel.root.updateMatrixWorld(true);
    paintRay.setFromCamera(p, previewCamera);
    const hit = paintRay.intersectObject(previewModel.egg, false)[0];
    if (!hit || !hit.uv) return null;
    return { x: hit.uv.x * 128, y: (1 - hit.uv.y) * 128 };
  }
  let egg3DPaint = null;
  function eggPaintDown(e) {
    if (!paintMode() || e.button !== 0) return false;
    const c = eggUVAt(e);
    if (!c) return false;
    pushUndo();
    paintStroke(c.x, c.y, null);
    egg3DPaint = { last: c };
    livePaintTexture();
    return true;
  }
  function eggPaintMove(e) {
    if (!egg3DPaint) return false;
    const c = eggUVAt(e);
    if (c) { paintStroke(c.x, c.y, egg3DPaint.last); egg3DPaint.last = c; livePaintTexture(); }
    else egg3DPaint.last = null;
    return true;
  }
  function eggPaintUp() {
    if (!egg3DPaint) return false;
    egg3DPaint = null;
    clearTimeout(paintCommitTimer);
    paintCommitTimer = setTimeout(() => commitPaint(false), 150);
    return true;
  }

  // ===========================================================================
  // THREE.JS
  // ===========================================================================
  function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 700);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;   // se actualiza a mano (ver frame())
    document.body.appendChild(renderer.domElement);
    clock = new THREE.Clock();

    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5a6b3a, 0.45);
    const sun = new THREE.DirectionalLight(0xfff4dd, 1.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    // Luz de relleno opuesta al sol (sin sombras): las caras en sombra dejan de verse planas
    const fill = new THREE.DirectionalLight(0xcfe6ff, 0.28);
    fill.position.set(-30, 25, -40);
    scene.add(amb, hemi, sun, sun.target, fill);
    lights = { amb, hemi, sun, fill };

    mapRoot = new THREE.Group(); scene.add(mapRoot);
    objRoot = new THREE.Group(); scene.add(objRoot);
    fxRoot = new THREE.Group(); scene.add(fxRoot);
    initFxLights();
    scene.add(camera);
    buildFPSWeapons();
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function disposeTree(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
  }

  // En mapas grandes la sombra del sol sigue al jugador: así el mapa de sombras es mucho más nítido
  let sunFollow = null;
  function setupSunFollow() {
    const h = mapData.halfSize + 6;
    const S = 34;   // el sol está más bajo: la sombra se estira, así que el recuadro es algo mayor
    if (h <= S + 2 || settings.quality === 'low') { sunFollow = null; return; }
    // Dirección del sol respecto a su objetivo (aunque ya estuviera desplazado siguiendo al jugador)
    const dir = lights.sun.position.clone().sub(lights.sun.target.position).normalize();
    const cam = lights.sun.shadow.camera;
    cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S; cam.updateProjectionMatrix();
    sunFollow = { dir, S };
  }
  let shadowTick = 0, sunMoved = true;
  function updateSunFollow() {
    if (!sunFollow || !inGame) return;
    const step = (sunFollow.S * 2) / lights.sun.shadow.mapSize.x * 4; // pegado a la rejilla: sin parpadeo
    const cx = Math.round(st.x / step) * step, cz = Math.round(st.z / step) * step;
    if (lights.sun.target.position.x !== cx || lights.sun.target.position.z !== cz) sunMoved = true;
    lights.sun.target.position.set(cx, 0, cz);
    lights.sun.position.set(cx + sunFollow.dir.x * 80, sunFollow.dir.y * 80, cz + sunFollow.dir.z * 80);
  }

  function loadMap(id) {
    id = MapDefs.resolveId(id);
    if (id === currentMapId && mapData) { if (inGame) setupSunFollow(); return; }
    while (mapRoot.children.length) { const c = mapRoot.children[0]; mapRoot.remove(c); disposeTree(c); }
    mapData = window.MapRenderer.build(id, scene, mapRoot, lights);
    // Relleno teñido con el color del cielo del mapa (más frío de día, más tenue de noche/espacio)
    { const th = mapData.def.theme; lights.fill.color.setHex(th.hemiSky || 0xcfe6ff); lights.fill.intensity = th.stars ? 0.18 : 0.3;
      const sp = lights.sun.position; lights.fill.position.set(-sp.x, Math.abs(sp.y) * 0.6 + 10, -sp.z); }
    // ÑEMANAVE: la decoración de la nave de Huevo Impostor (texturas, gallinas, nidos…)
    if (mapData.def && mapData.def.indoor && window.NaveDecor) {
      try { mapRoot.traverse(o => { if (o.isLineSegments) o.visible = false; }); window.NaveDecor.build(mapRoot, mapData); } catch (e) { console.warn('Decoración de la ÑEMANAVE:', e); }
    }
    if (settings.quality === 'low') mapRoot.traverse(o => { if (o.userData && o.userData.detail) o.visible = false; });
    world = Phys.createWorld(mapData);
    currentMapId = id;
    clearDecals();
    lights.sun.target.position.set(0, 0, 0);
    if (inGame) setupSunFollow(); else sunFollow = null;
    buildObjectiveVisuals();
    applyDrawDistance();
    // Compilar ya todos los shaders del mapa: sin tirones la primera vez que se ve algo
    try { renderer.compile(scene, camera); } catch (e) { /* no crítico */ }
    sunMoved = true;
  }

  // ===========================================================================
  // ARMAS EN PRIMERA PERSONA
  // ===========================================================================
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  function hand(x, y, z) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), lam(0xfff6e0));
    h.scale.set(1, 1.2, 1); h.position.set(x, y, z); h.name = 'hand';
    return h;
  }
  function flash(z, color, r) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(r || 0.08, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 }));
    f.position.set(0, 0.01, z); f.name = 'flash';
    return f;
  }
  function buildFPSRifle() {
    const g = new THREE.Group();
    const b = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); g.add(m); return m; };
    b(0.05, 0.05, 0.5, 0x222222, 0, 0.01, -0.33);
    b(0.08, 0.11, 0.34, 0x3b3b3b, 0, 0, 0.0);
    b(0.075, 0.08, 0.2, 0x8b4513, 0, -0.01, -0.22);
    b(0.07, 0.12, 0.2, 0x8b4513, 0, -0.03, 0.24);
    const mag = b(0.05, 0.17, 0.07, 0x111111, 0, -0.12, -0.06); mag.rotation.x = -0.3;
    b(0.02, 0.04, 0.03, 0x111111, 0, 0.07, -0.5);
    g.add(hand(-0.06, -0.06, -0.2), hand(0.05, -0.08, 0.08), flash(-0.62, 0xfff200));
    return g;
  }
  function buildFPSShotgun() {
    const g = new THREE.Group();
    [-0.032, 0.032].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10), lam(0x333333)); c.rotation.x = Math.PI / 2; c.position.set(x, 0.02, -0.27); g.add(c); });
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), lam(0xcd853f)); s.position.set(0, -0.02, 0.06); g.add(s);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.14), lam(0x8b5a2b)); p.position.set(0, -0.03, -0.25); g.add(p);
    g.add(hand(0.0, -0.08, -0.25), hand(0.05, -0.08, 0.1), flash(-0.55, 0xff6b35, 0.12));
    return g;
  }
  function buildFPSSniper() {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.85, 10), lam(0x222222)); bar.rotation.x = Math.PI / 2; bar.position.set(0, 0, -0.45); g.add(bar);
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 12), lam(0x0c7c86)); sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.085, -0.12); g.add(sc);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.11, 0.42), lam(0x2f3542)); body.position.set(0, -0.01, 0.06); g.add(body);
    const st2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.18), lam(0x5d4037)); st2.position.set(0, -0.03, 0.3); g.add(st2);
    g.add(hand(-0.06, -0.06, -0.12), hand(0.05, -0.08, 0.12), flash(-0.92, 0x48dbfb, 0.1));
    return g;
  }
  function buildFPSRanger() {
    const g = new THREE.Group();
    const b = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); g.add(m); return m; };
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.7, 10), lam(0x2d3436)); bar.rotation.x = Math.PI / 2; bar.position.set(0, 0.005, -0.42); g.add(bar);
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 12), lam(0x27ae60)); sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.08, -0.1); g.add(sc);
    b(0.08, 0.1, 0.36, 0x6c5ce7 & 0x444444 | 0x333333, 0, -0.01, 0.02);
    b(0.05, 0.14, 0.07, 0x111111, 0, -0.12, -0.04);
    b(0.07, 0.12, 0.2, 0x7f8c8d, 0, -0.03, 0.27);
    g.add(hand(-0.06, -0.06, -0.16), hand(0.05, -0.08, 0.1), flash(-0.8, 0x7bed9f, 0.09));
    return g;
  }
  function buildFPSRpegg() {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 14), lam(0x4b6043)); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.03, -0.2); g.add(tube);
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.1, 14), lam(0x2d3a26)); mouth.rotation.x = Math.PI / 2; mouth.position.set(0, 0.03, -0.66); g.add(mouth);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 12), lam(0xe67e22)); tip.rotation.x = -Math.PI / 2; tip.position.set(0, 0.03, -0.72); tip.name = 'rocketTip'; g.add(tip);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), lam(0x222222)); grip.position.set(0, -0.08, 0.02); g.add(grip);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.08), lam(0x222222)); sight.position.set(0.07, 0.1, -0.15); g.add(sight);
    g.add(hand(0, -0.1, -0.2), hand(0.04, -0.1, 0.06), flash(-0.8, 0xffa502, 0.14));
    return g;
  }
  function buildFPSWhipper() {
    const g = new THREE.Group();
    const b = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); g.add(m); return m; };
    b(0.04, 0.04, 0.28, 0x222222, 0, 0.01, -0.3);
    b(0.08, 0.1, 0.32, 0x34495e, 0, 0, -0.04);
    b(0.05, 0.26, 0.06, 0x111111, 0, -0.17, -0.1);
    b(0.06, 0.1, 0.16, 0x2c3e50, 0, -0.02, 0.2);
    b(0.06, 0.02, 0.2, 0xf1c40f, 0, 0.06, -0.06);
    g.add(hand(-0.05, -0.07, -0.18), hand(0.05, -0.08, 0.06), flash(-0.47, 0xeccc68, 0.08));
    return g;
  }
  function buildFPSTrihard() {
    const g = new THREE.Group();
    const b = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); g.add(m); return m; };
    b(0.05, 0.05, 0.42, 0x1e272e, 0, 0.01, -0.36);
    b(0.09, 0.12, 0.38, 0xb33939, 0, 0, -0.02);
    b(0.05, 0.03, 0.2, 0x111111, 0, 0.08, -0.04);
    b(0.05, 0.15, 0.07, 0x111111, 0, -0.12, -0.05);
    b(0.07, 0.11, 0.2, 0x2f3640, 0, -0.03, 0.26);
    g.add(hand(-0.06, -0.06, -0.22), hand(0.05, -0.08, 0.08), flash(-0.62, 0xff7f50));
    return g;
  }
  function buildFPSPistol() {
    const g = new THREE.Group();
    const b = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); g.add(m); return m; };
    b(0.06, 0.07, 0.26, 0x3d3d3d, 0.02, 0.03, -0.12);
    b(0.055, 0.14, 0.07, 0x1e1e1e, 0.02, -0.06, -0.01).rotation.x = 0.25;
    b(0.04, 0.02, 0.05, 0xf39c12, 0.02, 0.075, -0.05);
    g.add(hand(0.02, -0.1, 0.0), flash(-0.28, 0xfff3c4, 0.07));
    return g;
  }
  const FPS_BUILDERS = { rifle: buildFPSRifle, shotgun: buildFPSShotgun, sniper: buildFPSSniper, ranger: buildFPSRanger, rpegg: buildFPSRpegg, whipper: buildFPSWhipper, trihard: buildFPSTrihard, pistol: buildFPSPistol };
  function buildFPSWeapons() {
    fpsWeapons = {};
    Object.keys(FPS_BUILDERS).forEach(k => { fpsWeapons[k] = FPS_BUILDERS[k](); });
    Object.keys(fpsWeapons).forEach(k => {
      const g = fpsWeapons[k];
      g.position.copy(HIP_POS);
      g.traverse(o => { if (o.material) { o.material.depthTest = true; } o.renderOrder = 10; });
      g.visible = k === currentWeapon;
      camera.add(g);
    });
    activeFPS = fpsWeapons[currentWeapon];
  }

  function updateAmmoHUD() {
    const w = WEAPONS[currentWeapon];
    setText(activeWeaponName, w.name);
    setText(ammoCurrentEl, ammo[currentWeapon]);
    setText(ammoMaxEl, w.maxAmmo);
    const key = currentWeapon + ':' + ammo[currentWeapon];
    if (ammoBulletIcons.dataset.key !== key) {
      ammoBulletIcons.dataset.key = key;
      let html = '';
      for (let i = 0; i < w.maxAmmo; i++) html += `<div class="ammo-bullet${i >= ammo[currentWeapon] ? ' spent' : ''}"></div>`;
      ammoBulletIcons.innerHTML = html;
    }
    if (!isReloading) reloadHint.classList.toggle('hidden', ammo[currentWeapon] > 0);
    const slots = $('weapon-slots');
    const sk = primaryWeapon + currentWeapon + (weaponIcons.rifle ? 1 : 0);
    if (slots && slots.dataset.k !== sk) {
      slots.dataset.k = sk;
      const one = (k, key) => `<div class="ws${currentWeapon === k ? ' on' : ''}"><kbd>${escapeHtml(codeLabel(binds[key]))}</kbd>${weaponIcons[k] ? `<img src="${weaponIcons[k].light}" alt="">` : ''}${escapeHtml(WEAPONS[k].name)}</div>`;
      slots.innerHTML = one(primaryWeapon, 'w1') + one('pistol', 'swap');
    }
  }

  function reloadWeapon() {
    const w = WEAPONS[currentWeapon];
    if (isReloading || ammo[currentWeapon] >= w.maxAmmo || !me.alive) return;
    isReloading = true;
    socket.emit('player:reload');          // el servidor lleva la cuenta de las balas
    reloadEndsAt = performance.now() + w.reloadTime;
    playSound('reload');
    reloadHint.textContent = 'RECARGANDO…';
    reloadHint.classList.remove('hidden');
    const wk = currentWeapon;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (!isReloading || currentWeapon !== wk) return;
      ammo[wk] = WEAPONS[wk].maxAmmo;
      isReloading = false;
      reloadHint.textContent = 'PULSA [R] PARA RECARGAR';
      reloadHint.classList.add('hidden');
      updateAmmoHUD();
    }, w.reloadTime);
  }
  function cancelReload() {
    if (!isReloading) return;
    isReloading = false;
    clearTimeout(reloadTimer);
    reloadHint.textContent = 'PULSA [R] PARA RECARGAR';
  }

  function canChangePrimary() {
    return !inGame || !me.alive || (performance.now() - spawnedAt < 6000 && !firedSinceSpawn);
  }
  /** Elegir arma principal (pantalla de inicio / reaparición). */
  function choosePrimary(key) {
    if (!PRIMARY_KEYS.includes(key)) return;
    if (inGame && !canChangePrimary()) {
      pendingPrimary = key === primaryWeapon ? null : key;
      store.set('weapon', key);
      renderWeaponPickers();
      if (pendingPrimary) showToast(`🔁 ${WEAPONS[key].name} al reaparecer`);
      return;
    }
    pendingPrimary = null;
    primaryWeapon = key;
    store.set('weapon', key);
    equipWeapon(key, false);
  }
  /** Sacar un arma que llevas encima (la principal o la pistola). */
  function equipWeapon(key, silent) {
    if (!WEAPONS[key] || !fpsWeapons[key]) return;
    if (key !== 'pistol' && key !== primaryWeapon) return;
    if (key === currentWeapon && !silent) { renderWeaponPickers(); return; }
    cancelReload();
    burstLeft = 0;
    currentWeapon = key;
    Object.keys(fpsWeapons).forEach(k => { fpsWeapons[k].visible = k === key; });
    activeFPS = fpsWeapons[key];
    switchAnim = 1;
    renderWeaponPickers();
    if (!inGame) updatePreviewAvatar();
    updateAmmoHUD();
    if (!silent) playSound('switch');
    if (socket && inGame) socket.emit('player:weapon-switch', { weapon: key });
  }
  function selectWeapon(key, silent) {
    if (key === 'pistol') return equipWeapon('pistol', silent);
    if (PRIMARY_KEYS.includes(key) && key !== primaryWeapon) return choosePrimary(key);
    return equipWeapon(key, silent);
  }
  function togglePistol() { equipWeapon(currentWeapon === 'pistol' ? primaryWeapon : 'pistol'); }


  // ===========================================================================
  // MODELO DE HUEVO (ver eggmodel.js)
  // ===========================================================================
  function createEggModel(o) {
    return window.EggModel.create(o.custom, { team: o.team, weapon: o.weapon });
  }
  const buildGunModel = w => window.EggModel.buildGun(w);

  function makeLabelSprite(text, color, scale) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.55)';
    if (g.roundRect) { g.beginPath(); g.roundRect(8, 10, 240, 44, 14); g.fill(); } else g.fillRect(8, 10, 240, 44);
    g.fillStyle = color || '#fff';
    g.font = 'bold 28px "Fredoka One", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 33);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(2.2 * (scale || 1), 0.55 * (scale || 1), 1);
    sp.renderOrder = 20;
    return sp;
  }

  // ===========================================================================
  // JUGADORES REMOTOS
  // ===========================================================================
  // Sombra "blob" bajo cada jugador: se queda en el suelo al saltar (ayuda a calcular
  // dónde caerá) y asienta al huevo aunque las sombras reales estén apagadas
  let BLOB_GEO = null, BLOB_MAT = null;
  function makeBlob() {
    if (!BLOB_GEO) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      BLOB_GEO = new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2);
      BLOB_MAT = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    }
    const m = new THREE.Mesh(BLOB_GEO, BLOB_MAT);
    m.renderOrder = 2; m.userData.shared = true;
    return m;
  }

  function addRemotePlayer(d) {
    if (!d || d.id === me.id || remotePlayers[d.id]) return;
    const team = cfg.teams ? d.team : null;
    const m = createEggModel({ custom: d.custom || d, team, weapon: d.weapon });
    m.root.position.set(d.x || 0, d.y || 0, d.z || 0);
    const nameCol = team ? (team === 'red' ? '#ff8a80' : '#82b1ff') : '#ffffff';
    const label = makeLabelSprite(d.nickname || 'Huevo', nameCol);
    label.position.y = 2.15;
    // Los nombres de los enemigos no se ven a través de las paredes (los de tu equipo sí)
    label.material.depthTest = !(team && team === me.team);
    m.root.add(label);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0x7fdbff, transparent: true, opacity: 0.18, depthWrite: false }));
    shield.position.y = 0.8; shield.visible = false;
    m.root.add(shield);
    scene.add(m.root);
    const blob = makeBlob(); scene.add(blob);
    remotePlayers[d.id] = {
      ...m, label, shield, blob, id: d.id,
      nickname: d.nickname || 'Huevo', team: d.team || null, weapon: d.weapon || 'rifle', custom: d.custom || null,
      alive: d.alive !== false, snaps: [], walk: 0, emote: null, bubble: null,
      lastPos: new THREE.Vector3(d.x || 0, d.y || 0, d.z || 0),
    };
  }
  function removeRemotePlayer(id) {
    const rp = remotePlayers[id];
    if (!rp) return;
    scene.remove(rp.root);
    if (rp.blob) scene.remove(rp.blob);
    disposeTree(rp.root);
    delete remotePlayers[id];
  }
  function clearRemotePlayers() { Object.keys(remotePlayers).forEach(removeRemotePlayer); }
  // Rehace el modelo de un jugador (p. ej. al cambiar de equipo) conservando su estado
  function rebuildRemote(id) {
    const rp = remotePlayers[id];
    if (!rp) return;
    const keep = { id, nickname: rp.nickname, team: rp.team, weapon: rp.weapon, custom: rp.custom, alive: rp.alive,
      x: rp.root.position.x, y: rp.root.position.y, z: rp.root.position.z };
    const snaps = rp.snaps.slice();
    removeRemotePlayer(id);
    addRemotePlayer(keep);
    if (remotePlayers[id]) remotePlayers[id].snaps = snaps;
  }
  function updateTeamUI() {
    const box = $('rs-team');
    if (!box) return;
    const on = inGame && cfg.teams && !!me.team;
    box.classList.toggle('hidden', !on);
    if (!on) return;
    const now = $('rs-team-now');
    now.className = 'rs-team-now ' + me.team;
    setText(now, me.team === 'red' ? '🔴 Equipo Rojo' : '🔵 Equipo Azul');
    setText($('rs-team-switch'), `⇄ Pasarme al ${me.team === 'red' ? 'Azul' : 'Rojo'}`);
  }

  function setRemoteWeapon(rp, weapon) {
    if (!rp || rp.weapon === weapon) return;
    rp.weapon = weapon;
    const old = rp.gunPivot.getObjectByName('gun');
    if (old) { rp.gunPivot.remove(old); disposeTree(old); }
    rp.gunPivot.add(buildGunModel(weapon));
  }

  // Interpolación con buffer de instantáneas
  function sampleSnaps(rp, t) {
    const s = rp.snaps;
    if (!s.length) return null;
    if (t <= s[0].t) return s[0];
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].t <= t) {
        const a = s[i], b = s[i + 1];
        if (!b) break;   // más allá del último dato → extrapolar (abajo)
        const k = (t - a.t) / Math.max(1, b.t - a.t);
        let dr = b.rotY - a.rotY;
        while (dr > Math.PI) dr -= Math.PI * 2;
        while (dr < -Math.PI) dr += Math.PI * 2;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, rotY: a.rotY + dr * k, rotX: a.rotX + (b.rotX - a.rotX) * k };
      }
    }
    // Sin datos nuevos (paquete retrasado): extrapolar un poco con la última velocidad
    const b = s[s.length - 1], a = s[s.length - 2];
    if (a && b.t > a.t) {
      const ex = Math.min(t - b.t, 120) / (b.t - a.t);
      return { x: b.x + (b.x - a.x) * ex, y: b.y + Math.max(0, (b.y - a.y) * ex), z: b.z + (b.z - a.z) * ex, rotY: b.rotY, rotX: b.rotX };
    }
    return b;
  }

  function updateRemotes(dt, t) {
    const now = Date.now() + (serverOffset || 0) - INTERP_DELAY;
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      rp.root.visible = rp.alive;
      if (rp.blob) rp.blob.visible = rp.alive;
      if (!rp.alive) continue;
      rp.update(t);
      const s = sampleSnaps(rp, now);
      if (s) {
        rp.root.position.set(s.x, s.y, s.z);
        rp.root.rotation.y = s.rotY;
        rp.head.rotation.x = -s.rotX * 0.6;
        rp.gunPivot.rotation.x = s.rotX;
      }
      // Nivel de detalle: de lejos (>38 m) se ocultan gafas y extras (no se distinguen y cuestan)
      if (!rp.lod) { rp.lod = []; rp.root.traverse(o => { if (o.name === 'glasses' || o.name === 'extra') rp.lod.push(o); }); rp.lodFar = false; }
      const far = rp.root.position.distanceToSquared(camera.position) > 38 * 38;
      if (far !== rp.lodFar) { rp.lodFar = far; rp.lod.forEach(o => { o.visible = !far; }); }
      if (rp.blob && mapData) {
        const p = rp.root.position, gy = MapDefs.supportAt(mapData, p.x, p.z, p.y + 0.3);
        const hgt = Math.max(0, p.y - gy), k = Math.max(0.35, 1 - hgt / 6);
        rp.blob.position.set(p.x, gy + 0.03, p.z);
        rp.blob.scale.setScalar(k);
        rp.blob.visible = gy > -50;
      }
      // Animación de andar (balanceo) según la velocidad
      const sp = rp.root.position.distanceTo(rp.lastPos) / Math.max(dt, 0.001);
      rp.lastPos.copy(rp.root.position);
      const moving = sp > 1;
      rp.walk += dt * (moving ? 11 : 2);
      if (rp.emote) {
        rp.emote.t += dt;
        const k = rp.emote.t / 1.2;
        rp.body.rotation.y = k * Math.PI * 2;
        rp.body.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * 0.5;
        if (k >= 1) { rp.emote = null; rp.body.rotation.y = 0; }
      } else {
        rp.body.position.y = moving ? Math.abs(Math.sin(rp.walk)) * 0.12 : Math.sin(rp.walk) * 0.025;
        rp.body.rotation.z = moving ? Math.sin(rp.walk) * 0.08 : 0;
      }
      // Animación de lanzar granada: inclinarse hacia delante y volver
      if (rp.throwT > 0) {
        rp.throwT = Math.max(0, rp.throwT - dt);
        rp.body.rotation.x = -Math.sin((1 - rp.throwT / 0.4) * Math.PI) * 0.35;
      } else if (rp.body.rotation.x) rp.body.rotation.x = 0;
      rp.shield.visible = !!rp.prot;
      if (rp.prot) rp.shield.material.opacity = 0.12 + Math.sin(t * 8) * 0.06;
      if (rp.bubble && t > rp.bubble.until) { rp.root.remove(rp.bubble.sprite); disposeTree(rp.bubble.sprite); rp.bubble = null; }
    }
  }

  // ===========================================================================
  // EFECTOS (sin setTimeout: se actualizan en el bucle)
  // ===========================================================================
  function addEffect(obj, life, update) {
    fxRoot.add(obj);
    effects.push({ obj, life, max: life, update });
  }
  function updateEffects(dt) {
    if (muzzleLight && muzzleLight.intensity > 0) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 40);
    if (boomLight && boomLight.intensity > 0) boomLight.intensity = Math.max(0, boomLight.intensity - dt * 28);
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life -= dt;
      if (e.update) e.update(e, dt, 1 - e.life / e.max);
      if (e.life <= 0) { fxRoot.remove(e.obj); if (e.obj.userData.shared) e.obj.material.dispose(); else disposeTree(e.obj); effects.splice(i, 1); }
    }
  }
  // Trazadora: un haz fino y brillante que se estira de la boca del arma al impacto
  const TRACER_GEO = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5);
  function tracer(from, to, color) {
    const len = from.distanceTo(to);
    if (len < 0.05) return;
    const m = new THREE.Mesh(TRACER_GEO, new THREE.MeshBasicMaterial({ color: color || 0xffe9a8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(from);
    m.lookAt(to);
    m.scale.set(0.022, 0.022, len);
    m.userData.shared = true;
    addEffect(m, 0.09, (e, dt, k) => { m.material.opacity = 0.95 * (1 - k); m.scale.x = m.scale.y = 0.022 * (1 - k * 0.6); });
  }
  // Cohetes del RPEGG: proyectil visible con estela de humo
  let lastRocketMuzzle = null;
  const rockets = {};
  function spawnRocket(id, from, to, ms) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 10), new THREE.MeshLambertMaterial({ color: 0x556b2f }));
    body.rotation.x = Math.PI / 2; g.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 10), new THREE.MeshLambertMaterial({ color: 0xe67e22 }));
    tip.rotation.x = -Math.PI / 2; tip.position.z = -0.28; g.add(tip);
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.position.z = 0.26; g.add(fire);
    g.position.copy(from); g.lookAt(to);
    fxRoot.add(g);
    const dur = Math.max(0.05, (ms || 100) / 1000);
    const r = { g, from: from.clone(), to: to.clone(), t: 0, dur, smoke: 0 };
    rockets[id] = r;
    addEffect(g, dur + 0.5, (e, dt) => {
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      g.position.lerpVectors(r.from, r.to, k);
      fire.scale.setScalar(0.8 + Math.random() * 0.5);
      r.smoke -= dt;
      if (r.smoke <= 0 && k < 1) { r.smoke = 0.025; puff(g.position.clone(), 0xd8d2c8, 1, 0.12, 0.4); }
      if (k >= 1) g.visible = false;
    });
  }
  function removeRocket(id) { const r = rockets[id]; if (r) { r.g.visible = false; delete rockets[id]; } }

  // Agujeros de bala en paredes (se reciclan, máximo 70)
  const DECAL_GEO = new THREE.CircleGeometry(0.06, 10);
  const DECAL_MAT = new THREE.MeshBasicMaterial({ color: 0x1b1714, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const DECAL_RING = new THREE.MeshBasicMaterial({ color: 0x5a5148, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const DECAL_RING_GEO = new THREE.RingGeometry(0.06, 0.11, 10);
  function surfaceNormal(p, dir) {
    // Cara de la caja más cercana al punto de impacto (los mapas son cajas alineadas)
    let best = null, bd = 0.08;
    if (mapData) for (const b of mapData.boxes) {
      if (!b.vis || p.x < b.minX - 0.05 || p.x > b.maxX + 0.05 || p.y < b.minY - 0.05 || p.y > b.maxY + 0.05 || p.z < b.minZ - 0.05 || p.z > b.maxZ + 0.05) continue;
      const faces = [[Math.abs(p.x - b.minX), -1, 0, 0], [Math.abs(p.x - b.maxX), 1, 0, 0], [Math.abs(p.y - b.minY), 0, -1, 0], [Math.abs(p.y - b.maxY), 0, 1, 0], [Math.abs(p.z - b.minZ), 0, 0, -1], [Math.abs(p.z - b.maxZ), 0, 0, 1]];
      for (const f of faces) if (f[0] < bd && (f[1] * dir.x + f[2] * dir.y + f[3] * dir.z) < 0) { bd = f[0]; best = new THREE.Vector3(f[1], f[2], f[3]); }
    }
    if (!best && p.y < 0.08) best = new THREE.Vector3(0, 1, 0);
    return best;
  }
  function bulletHole(p, dir) {
    if (settings.quality === 'low') return;
    const n = surfaceNormal(p, dir);
    if (!n) return;
    ensureDecals();
    const g = decalDummy;
    g.position.copy(p).addScaledVector(n, 0.012);
    g.lookAt(g.position.clone().add(n));
    g.rotateZ(Math.random() * 6);
    g.updateMatrix();
    const i = decalIdx % DECAL_MAX; decalIdx++;
    decalHoles.setMatrixAt(i, g.matrix); decalRings.setMatrixAt(i, g.matrix);
    decalHoles.count = decalRings.count = Math.min(decalIdx, DECAL_MAX);
    decalHoles.instanceMatrix.needsUpdate = decalRings.instanceMatrix.needsUpdate = true;
    // chispas + polvo del material
    sparks(p, n);
  }
  // Agujeros de bala instanciados: 2 llamadas de dibujo para todos (antes 2 por agujero)
  const DECAL_MAX = 90;
  let decalHoles = null, decalRings = null, decalIdx = 0;
  const decalDummy = new THREE.Object3D();
  function ensureDecals() {
    if (decalHoles && decalHoles.parent === fxRoot) return;
    if (!decalHoles) {
      decalRings = new THREE.InstancedMesh(DECAL_RING_GEO, DECAL_RING, DECAL_MAX);
      decalHoles = new THREE.InstancedMesh(DECAL_GEO, DECAL_MAT, DECAL_MAX);
      [decalRings, decalHoles].forEach(m => { m.count = 0; m.frustumCulled = false; });
    }
    fxRoot.add(decalRings, decalHoles);
  }
  function clearDecals() { decalIdx = 0; if (decalHoles) decalHoles.count = decalRings.count = 0; }
  const SPARK_GEO = new THREE.BoxGeometry(0.025, 0.025, 0.12);
  function sparks(p, n) {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(SPARK_GEO, new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.userData.shared = true;
      m.position.copy(p);
      const v = n.clone().multiplyScalar(2.5 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3));
      addEffect(m, 0.18 + Math.random() * 0.12, (e, dt, k) => {
        v.y -= 14 * dt; m.position.addScaledVector(v, dt);
        m.lookAt(m.position.clone().add(v)); m.material.opacity = 1 - k;
      });
    }
  }
  // Fogonazo: luz puntual reutilizada en la boca del arma
  // Las luces se crean una sola vez (añadir/quitar luces obliga a recompilar los shaders → tirones)
  let muzzleLight = null, boomLight = null;
  function initFxLights() {
    muzzleLight = new THREE.PointLight(0xffc070, 0, 7, 2);
    boomLight = new THREE.PointLight(0xffa040, 0, 16, 2);
    scene.add(muzzleLight, boomLight);
  }
  function muzzleFlashLight(pos) {
    if ((settings.quality !== 'high' && settings.quality !== 'ultra') || !muzzleLight) return;
    muzzleLight.position.copy(pos);
    muzzleLight.intensity = 3.2;
  }
  function puff(pos, color, n, size, speed) {
    for (let i = 0; i < (n || 5); i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(size || 0.08, size || 0.08, size || 0.08), new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).multiplyScalar(speed || 2.5);
      addEffect(m, 0.35 + Math.random() * 0.2, (e, dt, k) => {
        v.y -= 9 * dt;
        m.position.addScaledVector(v, dt);
        m.material.opacity = 1 - k;
      });
    }
  }
  // Al morir: trozos curvos de cáscara que rebotan, gotas de yema y un charco de huevo frito
  function shellBurst(pos, color) {
    const base = pos.clone().add(new THREE.Vector3(0, 0.8, 0));
    // 1) "¡Crac!": el huevo se aplasta y se hincha un instante antes de romperse
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshLambertMaterial({ color: color || 0xfff6e0, transparent: true }));
    ghost.position.copy(base);
    addEffect(ghost, 0.13, (e, dt, k) => { ghost.scale.set(0.82 + k * 0.45, 1.05 - k * 0.35, 0.82 + k * 0.45); ghost.material.opacity = 1 - k * 0.3; });
    // Onda blanca del estallido
    const pop = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    pop.position.copy(base); pop.lookAt(camera.position);
    addEffect(pop, 0.35, (e, dt, k) => { pop.scale.setScalar(1 + k * 5); pop.material.opacity = 0.9 * (1 - k); });
    // 2) Cáscaras: de su color por fuera y blancas por dentro
    const shellMat = new THREE.MeshLambertMaterial({ color: color || 0xfff6e0, side: THREE.FrontSide, transparent: true });
    const innerMat = new THREE.MeshLambertMaterial({ color: 0xfffaf0, side: THREE.BackSide, transparent: true });
    const n = settings.quality === 'low' ? 7 : 14;
    for (let i = 0; i < n; i++) {
      const a0 = Math.random() * Math.PI * 2, t0 = Math.random() * Math.PI * 0.7;
      const geo = new THREE.SphereGeometry(0.44, 6, 5, a0, 0.6 + Math.random() * 0.6, t0, 0.5 + Math.random() * 0.45);
      const shard = new THREE.Mesh(geo, shellMat);
      shard.add(new THREE.Mesh(geo, innerMat));
      shard.position.copy(base);
      shard.castShadow = settings.quality === 'high' || settings.quality === 'ultra';
      const v = new THREE.Vector3((Math.random() - 0.5) * 6, 2.5 + Math.random() * 4, (Math.random() - 0.5) * 6);
      const spin = new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      const floorY = pos.y + 0.03;
      addEffect(shard, 3.2 + Math.random(), (e, dt, k) => {
        if (shard.position.y > floorY || v.y > 0) {
          v.y -= 18 * dt; shard.position.addScaledVector(v, dt);
          shard.rotation.x += spin.x * dt; shard.rotation.y += spin.y * dt; shard.rotation.z += spin.z * dt;
          if (shard.position.y < floorY) { shard.position.y = floorY; v.y = -v.y * 0.3; v.x *= 0.5; v.z *= 0.5; spin.multiplyScalar(0.4); if (Math.abs(v.y) < 0.6) v.set(0, 0, 0); }
        }
        if (k > 0.75) shellMat.opacity = innerMat.opacity = (1 - k) / 0.25;
      });
    }
    puff(base, 0xf9c80e, 12, 0.12, 4);
    puff(base, 0xffffff, 8, 0.1, 3);
    // 3) La yema cae, rebota un poco y se aplasta contra el suelo
    const yolkBall = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshPhongMaterial({ color: 0xf5b21b, shininess: 80, transparent: true }));
    yolkBall.position.copy(base);
    const yv = new THREE.Vector3((Math.random() - 0.5) * 0.8, 2.2, (Math.random() - 0.5) * 0.8);
    let landed = false;
    addEffect(yolkBall, 0.9, (e, dt, k) => {
      if (!landed) {
        yv.y -= 18 * dt; yolkBall.position.addScaledVector(yv, dt);
        if (yolkBall.position.y <= pos.y + 0.12) { landed = true; yolkBall.position.y = pos.y + 0.08; }
      } else {
        yolkBall.scale.set(yolkBall.scale.x + dt * 6, Math.max(0.15, yolkBall.scale.y - dt * 8), yolkBall.scale.z + dt * 6);
        yolkBall.material.opacity = Math.max(0, yolkBall.material.opacity - dt * 3);
      }
    });
    const white = new THREE.Mesh(new THREE.CircleGeometry(0.85, 18), new THREE.MeshBasicMaterial({ color: 0xfdfaf0, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const yolk = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), new THREE.MeshBasicMaterial({ color: 0xf5b21b, transparent: true, opacity: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    const splat = new THREE.Group(); splat.add(white, yolk);
    yolk.position.set(0.12, 0.004, -0.08);
    splat.rotation.x = -Math.PI / 2; splat.position.copy(pos).add(new THREE.Vector3(0, 0.035, 0));
    splat.scale.setScalar(0.2);
    addEffect(splat, 6, (e, dt, k) => {
      splat.scale.setScalar(Math.min(1, 0.2 + k * 12));
      const o = k > 0.8 ? (1 - k) / 0.2 : 1;
      white.material.opacity = 0.95 * o; yolk.material.opacity = o;
    });
  }
  function explosionFx(x, y, z) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(x, y, z);
    addEffect(s, 0.45, (e, dt, k) => { s.scale.setScalar(1 + k * 5); s.material.opacity = 0.9 * (1 - k); s.material.color.setHSL(0.1 - k * 0.1, 1, 0.55 - k * 0.3); });
    // Onda expansiva en el suelo y destello de luz
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.05, z);
    addEffect(ring, 0.5, (e, dt, k) => { ring.scale.setScalar(1 + k * 7); ring.material.opacity = 0.8 * (1 - k); });
    if (boomLight && (settings.quality === 'high' || settings.quality === 'ultra')) { boomLight.position.set(x, y + 0.6, z); boomLight.intensity = 9; }
    puff(new THREE.Vector3(x, y, z), 0xffc060, 8, 0.18, 7);
    puff(new THREE.Vector3(x, y, z), 0x555555, 12, 0.3, 6);
    // Trozos que salen volando
    const deb = new THREE.MeshLambertMaterial({ color: 0x3a3a3a, transparent: true });
    for (let i = 0; i < (settings.quality === 'low' ? 4 : 9); i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), deb);
      c.position.set(x, y + 0.2, z);
      const v = new THREE.Vector3((Math.random() - 0.5) * 12, 4 + Math.random() * 6, (Math.random() - 0.5) * 12);
      addEffect(c, 1.2, (e, dt, k) => {
        v.y -= 20 * dt; c.position.addScaledVector(v, dt);
        if (c.position.y < y) { c.position.y = y; v.multiplyScalar(0.3); v.y = Math.abs(v.y); }
        c.rotation.x += dt * 9; c.rotation.y += dt * 7; deb.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
      });
    }
    // Columna de humo que sube y se deshace
    if (settings.quality !== 'low') for (let i = 0; i < 4; i++) {
      const sm = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshLambertMaterial({ color: 0x6b6b6b, transparent: true, opacity: 0.55, depthWrite: false }));
      sm.position.set(x + (Math.random() - 0.5) * 0.8, y + 0.4 + i * 0.4, z + (Math.random() - 0.5) * 0.8);
      const life = 1.6 + i * 0.25;
      addEffect(sm, life, (e, dt, k) => { sm.position.y += dt * (1.2 + i * 0.3); sm.scale.setScalar(1 + k * 2.2); sm.material.opacity = 0.55 * (1 - k); });
    }
    // Marca quemada en el suelo
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    scorch.rotation.x = -Math.PI / 2; scorch.position.set(x, (world ? Phys.supportBelow(world, x, z, y + 0.5) : y) + 0.03, z);
    addEffect(scorch, 9, (e, dt, k) => { scorch.material.opacity = 0.45 * (k > 0.7 ? (1 - k) / 0.3 : 1); });
    const d = camera.position.distanceTo(s.position);
    if (d < 14) camShake = Math.max(camShake, (1 - d / 14) * 0.5);
  }

  // ===========================================================================
  // DISPARO
  // ===========================================================================
  const raycaster = new THREE.Raycaster();
  function currentSpread() {
    const w = WEAPONS[currentWeapon];
    const speed = Math.hypot(st.vx, st.vz) / P.SPEED;
    let s = w.spread * (isAiming ? w.adsSpread : 1);
    s *= 1 + speed * 0.7 + (st.onGround ? 0 : 1.2);
    if (w.scope && isAiming) s = speed > 0.2 || !st.onGround ? 0.02 : (currentWeapon === 'sniper' ? 0 : w.spread * w.adsSpread);
    return s;
  }

  function enemyHitTargets() {
    const list = [];
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      if (!rp.alive || !rp.root.visible) continue;
      if (cfg.teams && me.team && rp.team === me.team) continue;
      rp.root.updateMatrixWorld(true);
      list.push(rp.hit);
    }
    return list;
  }

  function shoot() {
    if (!canAct() || burstLeft > 0) return;
    const w = WEAPONS[currentWeapon];
    const now = performance.now();
    if (now - lastShootTime < w.cooldown || isReloading || switchAnim > 0.4 || meleeAnim > 0.3) return;
    if (ammo[currentWeapon] <= 0) { playSound('empty'); lastShootTime = now; reloadWeapon(); return; }
    if (w.burst) { burstLeft = Math.min(w.burst.count, ammo[currentWeapon]); nextBurstAt = now; updateBurst(now); return; }
    fireOne(w, now);
  }
  // Ráfagas (Tri-Hard): las balas restantes salen en los siguientes fotogramas
  function updateBurst(now) {
    const w = WEAPONS[currentWeapon];
    while (burstLeft > 0 && now >= nextBurstAt) {
      if (!w.burst || !canAct() || ammo[currentWeapon] <= 0 || isReloading) { burstLeft = 0; break; }
      fireOne(w, now);
      burstLeft--;
      nextBurstAt += w.burst.interval;
    }
  }
  function fireOne(w, now) {
    lastShootTime = now;
    firedSinceSpawn = true;
    inspectAnim = 0;
    ammo[currentWeapon]--;
    updateAmmoHUD();
    playSound(currentWeapon);

    // Retroceso
    recoilZ = w.recoil; recoilRot = w.recoil * 1.2;
    pitch = Math.min(Math.PI / 2 - 0.05, pitch + w.recoil * (isAiming ? 0.15 : 0.25));
    yaw += (Math.random() - 0.5) * w.recoil * 0.08;
    const fl = activeFPS && activeFPS.getObjectByName('flash');
    if (fl) fl.material.opacity = 0.95;

    camera.updateMatrixWorld(true);
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const muzzle = fl ? fl.getWorldPosition(new THREE.Vector3()) : origin.clone();
    muzzleFlashLight(muzzle);
    const spread = currentSpread();
    if (w.projectile) {
      // RPEGG: el servidor calcula el impacto; aquí sólo mandamos la dirección
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      socket.emit('player:rocket', { dx: +dir.x.toFixed(4), dy: +dir.y.toFixed(4), dz: +dir.z.toFixed(4) });
      lastRocketMuzzle = muzzle.clone();
      camShake = Math.max(camShake, 0.25);
      if (ammo[currentWeapon] === 0) setTimeout(reloadWeapon, 300);
      return;
    }
    const hitList = enemyHitTargets();
    const targets = [];
    let firstEnd = null, anyHit = false, anyHead = false;

    for (let i = 0; i < w.pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const wallT = world ? Phys.raycast(world, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, w.range) : w.range;
      raycaster.set(origin, dir);
      raycaster.far = wallT;
      const hits = hitList.length ? raycaster.intersectObjects(hitList, false) : [];
      let end;
      if (hits.length) {
        const h = hits[0];
        const rp = Object.values(remotePlayers).find(p => p.hit === h.object);
        if (rp) {
          const head = (h.point.y - rp.root.position.y) > HEAD_Y;
          // El servidor comprueba el punto de impacto contra la posición real del objetivo
          targets.push({ id: rp.id, headshot: head, p: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)] });
          anyHit = true; anyHead = anyHead || head;
          puff(h.point, 0xf9c80e, 4, 0.07, 2);
        }
        end = h.point.clone();
      } else {
        end = origin.clone().addScaledVector(dir, Math.min(wallT, w.range));
        if (wallT < w.range) { puff(end, 0xcfc6b8, 3, 0.06, 1.5); bulletHole(end, dir); }
      }
      if (!firstEnd) firstEnd = end;
      tracer(muzzle, end, w.tracerColor);
    }
    if (anyHit) triggerHitmarker(anyHead);
    socket.emit('player:shoot', { targets, ex: +firstEnd.x.toFixed(2), ey: +firstEnd.y.toFixed(2), ez: +firstEnd.z.toFixed(2) });
    if (ammo[currentWeapon] === 0) setTimeout(reloadWeapon, 250);
  }

  function triggerHitmarker(head) {
    hitmarkerEl.classList.remove('hidden');
    hitmarkerEl.classList.toggle('head', !!head);
    hitmarkerEl.style.animation = 'none';
    void hitmarkerEl.offsetHeight;
    hitmarkerEl.style.animation = 'hitFade 0.28s forwards';
    playSound(head ? 'headshot' : 'hit');
  }

  // Granada: mantener Q carga el lanzamiento (más lejos), soltar la lanza
  function startGrenadeCharge() {
    if (!canAct() || me.grenades <= 0 || grenadeCharge) return;
    grenadeCharge = { t0: performance.now() };
    $('grenade-charge').classList.remove('hidden');
  }
  function grenadePower() { return grenadeCharge ? Math.min(1, RULES.GRENADE_MIN_POWER + (performance.now() - grenadeCharge.t0) / 900 * (1 - RULES.GRENADE_MIN_POWER)) : 1; }
  function updateGrenadeCharge() {
    if (!grenadeCharge) return;
    if (!canAct()) { grenadeCharge = null; $('grenade-charge').classList.add('hidden'); return; }
    const p = grenadePower();
    $('grenade-charge-fill').style.width = Math.round(p * 100) + '%';
    if (performance.now() - grenadeCharge.t0 > 1600) releaseGrenade(); // no se queda atascada
  }
  function releaseGrenade() {
    if (!grenadeCharge) return;
    const power = grenadePower();
    grenadeCharge = null;
    $('grenade-charge').classList.add('hidden');
    throwGrenade(power);
  }
  // Granada en la mano (primera persona): se ve al cargar y sale lanzada al soltar
  let fpGrenade = null, throwAnimT = 0;
  function buildFpGrenade() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshLambertMaterial({ color: 0x4f7a3a }));
    body.scale.y = 1.25; g.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.03, 8), new THREE.MeshLambertMaterial({ color: 0x9aa3ab }));
    cap.position.y = 0.075; g.add(cap);
    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 5, 10), new THREE.MeshLambertMaterial({ color: 0xffc94d }));
    pin.position.set(-0.02, 0.09, 0); pin.rotation.y = Math.PI / 2; g.add(pin);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshLambertMaterial({ color: 0xfff3dc }));
    glove.scale.set(1.1, 0.8, 1.2); glove.position.set(0.02, -0.04, 0.03); g.add(glove);
    g.visible = false;
    g.traverse(o => { o.renderOrder = 10; });
    camera.add(g);
    return g;
  }
  function animateFpGrenade(dt) {
    if (!fpGrenade) fpGrenade = buildFpGrenade();
    if (throwAnimT > 0) throwAnimT = Math.max(0, throwAnimT - dt);
    if (grenadeCharge && me.alive) {
      const p = grenadePower();
      fpGrenade.visible = true;
      fpGrenade.position.set(-0.24 + p * 0.03, -0.27 + p * 0.07, -0.42 + p * 0.1);
      fpGrenade.rotation.set(-p * 0.5, 0, p * 0.5);
      return -0.1 * p;   // el arma baja un poco mientras cargas
    }
    if (throwAnimT > 0) {
      const k = 1 - throwAnimT / 0.3;
      fpGrenade.visible = k < 0.55;
      fpGrenade.position.set(-0.2 + k * 0.12, -0.2 + Math.sin(k * Math.PI) * 0.1, -0.34 - k * 0.8);
      fpGrenade.rotation.set(-0.5 - k * 3, 0, 0.5);
      return -0.1 * (1 - k);
    }
    fpGrenade.visible = false;
    return 0;
  }

  function throwGrenade(power) {
    if (!canAct() || me.grenades <= 0) return;
    throwAnimT = 0.3;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    socket.emit('player:grenade-throw', { dirX: dir.x, dirY: dir.y, dirZ: dir.z, vx: st.vx, vz: st.vz, power: power || 1 });
    firedSinceSpawn = true;
    meleeAnim = Math.max(meleeAnim, 0.5);
    playSound('grenade');
    me.grenades--;
    updateGrenadeHUD();
  }

  function updateGrenadeHUD() {
    const icons = document.querySelectorAll('#grenade-icons .ss-grenade-icon');
    icons.forEach((el, i) => el.classList.toggle('active', i < me.grenades));
  }

  // Golpe cuerpo a cuerpo (F): al huevo enemigo más cercano delante de ti
  function doMelee() {
    if (!canAct()) return;
    const now = performance.now();
    if (now - lastMeleeAt < MELEE.cooldown) return;
    lastMeleeAt = now;
    meleeAnim = 1;
    cancelReload(); burstLeft = 0;
    firedSinceSpawn = true;
    playSound('melee');
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const eye = new THREE.Vector3(st.x, st.y + P.EYE, st.z);
    let best = null, bestD = MELEE.range + 0.3;
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      if (!rp.alive || (cfg.teams && rp.team === me.team)) continue;
      const to = rp.root.position.clone().add(new THREE.Vector3(0, 0.9, 0)).sub(eye);
      const d = to.length();
      if (d > bestD) continue;
      if (to.normalize().dot(fwd) < 0.55) continue;
      if (world && Phys.raycast(world, eye.x, eye.y, eye.z, to.x, to.y, to.z, d) < d - 0.3) continue;
      best = rp; bestD = d;
    }
    socket.emit('player:melee', { targetId: best ? best.id : null });
    if (best) triggerHitmarker(false);
  }

  // ===========================================================================
  // MOVIMIENTO Y CÁMARA
  // ===========================================================================
  function canAct() { return inGame && me.alive && !isPaused && !isChatting && isPointerLocked && roundState !== 'paused'; }

  function updateMovement(dt) {
    if (roundState === 'paused') { st.vx = st.vz = 0; return; } // el admin ha pausado: nadie se mueve
    const active = me.alive && !isPaused && !isChatting;
    const input = {
      fwd: active ? (isDown('forward') || pressed.ArrowUp ? 1 : 0) - (isDown('backward') || pressed.ArrowDown ? 1 : 0) : 0,
      side: active ? (isDown('right') || pressed.ArrowRight ? 1 : 0) - (isDown('left') || pressed.ArrowLeft ? 1 : 0) : 0,
      jump: active && isDown('jump'),
      yaw,
    };
    const wasGround = st.onGround;
    const ev = Phys.simulate(world, st, input, dt);
    if (ev.jumped) playSound('jump');
    if (ev.pad) { playSound('pad'); showToast('🚀'); }
    if (ev.landed && !wasGround) { playSound('land', 0.6); landDip = Math.min(0.25, 0.06 + (ev.impact || 0) * 0.008); }
    const moving = st.onGround && Math.hypot(st.vx, st.vz) > 2;
    if (moving) { stepTimer -= dt; if (stepTimer <= 0) { stepTimer = 0.36; playSound('step'); } }
  }

  function updateCamera(dt, t) {
    landDip = THREE.MathUtils.lerp(landDip, 0, dt * 8);
    camShake = Math.max(0, camShake - dt * 1.5);
    const bob = st.onGround && Math.hypot(st.vx, st.vz) > 1 && !isAiming ? Math.sin(swayTime * 2) * 0.04 : 0;
    camera.position.set(st.x, st.y + P.EYE - landDip + bob, st.z);
    const sh = camShake * camShake;
    camera.quaternion.setFromEuler(new THREE.Euler(pitch + (Math.random() - 0.5) * sh * 0.2, yaw + (Math.random() - 0.5) * sh * 0.2, 0, 'YXZ'));
    // FOV / mira
    const w = WEAPONS[currentWeapon];
    const target = isAiming && me.alive ? w.adsFov : settings.fov;
    currentFov = THREE.MathUtils.lerp(currentFov, target, Math.min(1, dt * 14));
    if (Math.abs(camera.fov - currentFov) > 0.02) { camera.fov = currentFov; camera.updateProjectionMatrix(); }
    const scoped = !!(w.scope && isAiming && me.alive && currentFov < w.adsFov + 6);
    scopeOverlay.classList.toggle('hidden', !scoped);
    crosshairEl.classList.toggle('hidden', scoped);
    if (activeFPS) activeFPS.visible = !scoped && me.alive;
  }

  function animateWeapon(dt) {
    if (!activeFPS) return;
    recoilZ = THREE.MathUtils.lerp(recoilZ, 0, dt * 14);
    recoilRot = THREE.MathUtils.lerp(recoilRot, 0, dt * 14);
    switchAnim = Math.max(0, switchAnim - dt * 3.5);
    const base = isAiming ? ADS_POS : HIP_POS;
    const moving = st.onGround && Math.hypot(st.vx, st.vz) > 1;
    if (moving) swayTime += dt * 6.5;
    const amp = isAiming ? 0.003 : 0.014;
    let tx = base.x + (moving ? Math.sin(swayTime) * amp : 0);
    let ty = base.y + (moving ? Math.abs(Math.cos(swayTime)) * amp * 0.8 : 0) - switchAnim * 0.3 - landDip * 0.3;
    const tz = base.z + recoilZ;
    let rx = recoilRot, rz = 0;
    if (isReloading) {
      const k = 1 - Math.max(0, reloadEndsAt - performance.now()) / WEAPONS[currentWeapon].reloadTime;
      const s = Math.sin(Math.min(1, k) * Math.PI);
      ty -= s * 0.12; rx -= s * 0.6; rz = s * 0.4;
    }
    ty += animateFpGrenade(dt);
    let ry = 0;
    if (meleeAnim > 0) {
      meleeAnim = Math.max(0, meleeAnim - dt * 3.2);
      const s = Math.sin((1 - meleeAnim) * Math.PI);
      tx -= s * 0.12; ty += s * 0.05; rz -= s * 0.9; ry = s * 0.6;
    }
    if (inspectAnim > 0) {
      inspectAnim = Math.max(0, inspectAnim - dt * 0.55);
      const s = Math.sin((1 - inspectAnim) * Math.PI);
      tx -= s * 0.1; ry += s * 1.1; rz += s * 0.35; rx += Math.sin((1 - inspectAnim) * Math.PI * 2) * 0.15;
    }
    const sp = Math.min(1, dt * (isAiming ? 20 : 13));
    activeFPS.position.x += (tx - activeFPS.position.x) * sp;
    activeFPS.position.y += (ty - activeFPS.position.y) * sp;
    activeFPS.position.z += (tz - activeFPS.position.z) * sp;
    activeFPS.rotation.x = rx; activeFPS.rotation.y = ry; activeFPS.rotation.z = rz;
    const fl = activeFPS.getObjectByName('flash');
    if (fl && fl.material.opacity > 0) fl.material.opacity = Math.max(0, fl.material.opacity - dt * 20);
    // Mira dinámica
    const spread = currentSpread();
    crosshairEl.style.setProperty('--gap', `${6 + spread * 260 + recoilZ * 60}px`);
  }

  function updateDeathCam(dt) {
    if (!deathCam) return;
    deathCam.t += dt;
    const k = Math.min(1, deathCam.t / 0.8);
    camera.position.set(st.x, st.y + P.EYE + k * 1.6, st.z);
    const killer = remotePlayers[deathCam.killerId];
    const target = killer && killer.alive ? killer.root.position.clone().add(new THREE.Vector3(0, 1, 0)) : new THREE.Vector3(st.x, st.y, st.z);
    if (killer) camera.lookAt(target);
    else camera.quaternion.setFromEuler(new THREE.Euler(-0.7 * k, yaw, 0.3 * k, 'YXZ'));
  }

  // ===========================================================================
  // OBJETIVOS (King of the Coop / Capture the Spatula)
  // ===========================================================================
  let coopVis = null, spatulaVis = null, baseVis = [], packVis = [], gpackVis = [];
  function buildSpatulaModel() {
    const g = new THREE.Group();
    const gold = new THREE.MeshLambertMaterial({ color: 0xf5c518, emissive: 0x4d3a00 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.55), gold); blade.position.set(0, 0, -0.35); g.add(blade);
    [-0.12, 0, 0.12].forEach(x => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.32), new THREE.MeshBasicMaterial({ color: 0x8a6d00 })); s.position.set(x, 0.005, -0.38); g.add(s); });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), new THREE.MeshLambertMaterial({ color: 0x5d4037 }));
    handle.rotation.x = Math.PI / 2; handle.position.z = 0.25; g.add(handle);
    g.scale.setScalar(1.6);
    return g;
  }
  function buildObjectiveVisuals() {
    while (objRoot.children.length) { const c = objRoot.children[0]; objRoot.remove(c); disposeTree(c); }
    coopVis = null; spatulaVis = null; baseVis = []; packVis = []; gpackVis = [];
    if (!mapData) return;
    // Botiquines (+vida)
    (mapData.healthPacks || []).forEach(p => {
      const g = new THREE.Group();
      g.position.set(p.x, p.y + 0.55, p.z);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0xfff3e4 }));
      box.castShadow = true; g.add(box);
      const crossMat = new THREE.MeshBasicMaterial({ color: 0xff8a3d });
      [[0.34, 0.1, 0.44], [0.1, 0.34, 0.44]].forEach(([w, h, d]) => g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crossMat)));
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI), crossMat); handle.position.y = 0.21; g.add(handle);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = -0.5; g.add(glow);
      objRoot.add(g);
      packVis.push(g);
    });
    // Granadas en el suelo (se recogen pasando por encima; máximo 3)
    (mapData.grenadePacks || []).forEach(p => {
      const g = new THREE.Group();
      g.position.set(p.x, p.y + 0.45, p.z);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshLambertMaterial({ color: 0x4f7a3a }));
      body.scale.set(1, 1.25, 1); body.castShadow = true; g.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 14), new THREE.MeshLambertMaterial({ color: 0x2f4a22 }));
      g.add(band);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x9aa3ab }));
      cap.position.y = 0.28; g.add(cap);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.03), new THREE.MeshLambertMaterial({ color: 0x9aa3ab }));
      lever.position.set(0.1, 0.2, 0); lever.rotation.z = -0.35; g.add(lever);
      const pin = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), new THREE.MeshLambertMaterial({ color: 0xffc94d }));
      pin.position.set(-0.07, 0.32, 0); pin.rotation.y = Math.PI / 2; g.add(pin);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0x9be36b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = -0.4; g.add(glow);
      objRoot.add(g);
      gpackVis.push(g);
    });
    if (cfg.mode === 'kotc') {
      const g = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      wall.position.y = 1.5; g.add(wall);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 40, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
      beam.position.y = 20; g.add(beam);
      g.visible = false;
      objRoot.add(g);
      coopVis = { g, wall, ring, beam };
    }
    if (cfg.mode === 'cts') {
      const s = buildSpatulaModel();
      objRoot.add(s);
      spatulaVis = s;
      ['red', 'blue'].forEach(t => {
        const b = mapData.bases[t];
        const g = new THREE.Group(); g.position.set(b.x, b.y, b.z);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(b.r, 32), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[t], transparent: true, opacity: 0.3, depthWrite: false }));
        disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; g.add(disc);
        const ring = new THREE.Mesh(new THREE.RingGeometry(b.r - 0.12, b.r, 40), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[t], side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), lam(0xdddddd)); pole.position.set(b.r - 0.3, 1.5, 0); g.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshLambertMaterial({ color: TEAM_COLORS[t], side: THREE.DoubleSide })); flag.position.set(b.r + 0.2, 2.7, 0); g.add(flag);
        objRoot.add(g);
        baseVis.push(g);
      });
    }
  }

  function updateObjectives(t) {
    const gp = lastState && lastState.gpacks;
    gpackVis.forEach((g, i) => {
      g.visible = !gp || gp[i] !== '0';
      g.rotation.y = t * 1.8 + i;
      g.position.y = mapData.grenadePacks[i].y + 0.45 + Math.sin(t * 2.6 + i) * 0.08;
    });
    const packs = lastState && lastState.packs;
    packVis.forEach((g, i) => {
      g.visible = !packs || packs[i] !== '0';
      g.rotation.y = t * 1.4 + i;
      g.position.y = mapData.healthPacks[i].y + 0.55 + Math.sin(t * 2.2 + i) * 0.1;
    });
    const ms = lastState && lastState.mode;
    if (coopVis && ms && ms.coop) {
      const c = ms.coop;
      coopVis.g.visible = c.active;
      coopVis.g.position.set(c.x, c.y, c.z);
      coopVis.wall.scale.set(c.r, 1, c.r);
      coopVis.ring.scale.set(c.r, c.r, 1);
      let col = 0xffffff;
      if (c.contested) col = Math.sin(t * 12) > 0 ? 0xff9800 : 0xffffff;
      else if (c.team) col = TEAM_COLORS[c.team];
      [coopVis.wall, coopVis.ring, coopVis.beam].forEach(m => m.material.color.setHex(col));
      coopVis.wall.material.opacity = 0.12 + (c.progress / 100) * 0.25;
      coopVis.wall.rotation.y = t * 0.5;
    }
    if (spatulaVis && ms && ms.spatula) {
      const s = ms.spatula;
      if (s.state === 'carried') {
        const rp = remotePlayers[s.carrier];
        if (s.carrier === me.id || !rp) spatulaVis.visible = false;
        else { spatulaVis.visible = true; spatulaVis.position.copy(rp.root.position).add(new THREE.Vector3(0, 2.6 + Math.sin(t * 4) * 0.08, 0)); spatulaVis.rotation.set(-0.6, t * 3, 0); }
      } else {
        spatulaVis.visible = true;
        spatulaVis.position.set(s.x, s.y + 0.9 + Math.sin(t * 2.5) * 0.15, s.z);
        spatulaVis.rotation.set(0.2, t * 1.6, 0);
      }
    }
  }

  // Marcadores en pantalla de los objetivos
  const wpEls = {};
  function setWaypoint(key, pos, label, color) {
    let el = wpEls[key];
    if (!el) { el = document.createElement('div'); el.className = 'waypoint'; $('waypoints').appendChild(el); wpEls[key] = el; }
    if (!pos) { el.style.display = 'none'; return; }
    const v = pos.clone().project(camera);
    const behind = v.z > 1;
    let x = v.x, y = v.y;
    if (behind) { x = -x; y = -y; }
    const m = 0.88;
    const off = behind || Math.abs(x) > m || Math.abs(y) > m;
    if (off) { const s = m / Math.max(Math.abs(x), Math.abs(y), 0.001); x *= s; y *= s; }
    el.style.display = 'block';
    el.style.left = `${(x + 1) / 2 * 100}%`;
    el.style.top = `${(1 - y) / 2 * 100}%`;
    el.style.borderColor = color;
    const dist = Math.round(camera.position.distanceTo(pos));
    el.innerHTML = `${label}<small>${dist} m</small>`;
    el.classList.toggle('edge', off);
  }
  function updateWaypoints() {
    const ms = lastState && lastState.mode;
    if (!inGame || !ms) { Object.values(wpEls).forEach(e => { e.style.display = 'none'; }); return; }
    if (ms.coop) {
      const c = ms.coop;
      const col = c.team ? (c.team === 'red' ? '#e74c3c' : '#3498db') : '#ffffff';
      setWaypoint('coop', c.active ? new THREE.Vector3(c.x, c.y + 2.2, c.z) : null, '🐔', col);
    } else setWaypoint('coop', null);
    if (ms.spatula) {
      const s = ms.spatula;
      const mine = s.state === 'carried' && s.carrier === me.id;
      if (mine && me.team) {
        const b = mapData.bases[me.team];
        setWaypoint('spatula', null);
        setWaypoint('base', new THREE.Vector3(b.x, b.y + 2, b.z), '🏠', me.team === 'red' ? '#e74c3c' : '#3498db');
      } else {
        setWaypoint('base', null);
        let pos = new THREE.Vector3(s.x, s.y + 2.2, s.z);
        if (s.state === 'carried' && remotePlayers[s.carrier]) pos = remotePlayers[s.carrier].root.position.clone().add(new THREE.Vector3(0, 3, 0));
        setWaypoint('spatula', pos, '🍳', '#f5c518');
      }
    } else { setWaypoint('spatula', null); setWaypoint('base', null); }
  }

  // ===========================================================================
  // GRANADAS
  // ===========================================================================
  function spawnGrenade(d) {
    if (grenades[d.id]) return;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), lam(0x2d3436));
    m.scale.y = 1.25; m.castShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 14), lam(0xe74c3c)); band.rotation.x = Math.PI / 2; m.add(band);
    // Luz de aviso que parpadea cada vez más rápido
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b2f }));
    blink.position.y = 0.2; m.add(blink);
    m.position.set(d.x, d.y, d.z);
    scene.add(m);
    grenades[d.id] = { mesh: m, blink, born: performance.now(), trailAt: 0, sim: { x: d.x, y: d.y, z: d.z, vx: d.vx || 0, vy: d.vy || 0, vz: d.vz || 0 }, server: null };
    // Quien la lanza se inclina hacia delante (animación de lanzamiento)
    const rp = remotePlayers[d.ownerId];
    if (rp) rp.throwT = 0.4;
  }
  const TRAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.5, depthWrite: false });
  const TRAIL_GEO = new THREE.SphereGeometry(0.07, 6, 5);
  function removeGrenade(id) {
    const g = grenades[id]; if (!g) return;
    scene.remove(g.mesh); disposeTree(g.mesh); delete grenades[id];
  }
  function updateGrenades(dt) {
    for (const id in grenades) {
      const g = grenades[id];
      if (world) { g.sim.bounced = false; Phys.stepGrenade(world, g.sim, dt); if (g.sim.bounced) playSoundAt('land', g.sim.x, g.sim.y, g.sim.z, 0.4); }
      if (g.server) { // corrección suave hacia el servidor
        g.sim.x += (g.server.x - g.sim.x) * 0.15; g.sim.y += (g.server.y - g.sim.y) * 0.15; g.sim.z += (g.server.z - g.sim.z) * 0.15;
      }
      g.mesh.position.set(g.sim.x, g.sim.y, g.sim.z);
      g.mesh.rotation.x += dt * 8; g.mesh.rotation.z += dt * 5;
      const age = (performance.now() - g.born) / RULES.GRENADE_FUSE_MS;
      g.blink.visible = Math.sin(age * age * 70) > 0;
      // Estela de humo mientras vuela
      const spd = Math.hypot(g.sim.vx, g.sim.vy, g.sim.vz);
      if (spd > 2 && settings.quality !== 'low' && performance.now() - g.trailAt > 45) {
        g.trailAt = performance.now();
        const tm = new THREE.Mesh(TRAIL_GEO, TRAIL_MAT.clone());
        tm.position.copy(g.mesh.position);
        tm.userData.shared = true;   // geometría compartida: sólo se libera el material
        addEffect(tm, 0.5, (e, dt2, k) => { tm.scale.setScalar(1 + k * 2.5); tm.material.opacity = 0.5 * (1 - k); });
      }
    }
  }

  // ===========================================================================
  // HUD
  // ===========================================================================
  // Números de daño flotantes sobre el enemigo (los perdigones se suman en un único número)
  const dmgNums = {};
  function showDamageNumber(targetId, dmg, head, kill) {
    const rp = remotePlayers[targetId];
    if (!rp) return;
    const now = performance.now();
    let e = dmgNums[targetId];
    if (!e || now - e.t > 220) {
      if (e) e.el.remove();
      const el = document.createElement('div');
      el.className = 'dmg-num';
      $('damage-numbers').appendChild(el);
      e = dmgNums[targetId] = { el, total: 0, head: false, kill: false, life: 1, t: now, ox: (Math.random() - 0.5) * 0.6, base: rp.root.position.clone() };
    }
    e.total += dmg; e.head = e.head || head; e.kill = e.kill || kill; e.t = now; e.life = 1;
    e.el.textContent = (e.kill ? '✖ ' : '') + e.total;
    e.el.classList.toggle('head', e.head);
    e.el.classList.toggle('kill', e.kill);
    e.el.style.animation = 'none'; void e.el.offsetHeight; e.el.style.animation = '';
  }
  function updateDamageNumbers(dt) {
    for (const id in dmgNums) {
      const e = dmgNums[id];
      e.life -= dt * 1.1;
      const rp = remotePlayers[id];
      if (rp && rp.alive) e.base.copy(rp.root.position);
      const p = e.base.clone().add(new THREE.Vector3(e.ox, 2.0 + (1 - e.life) * 0.9, 0)).project(camera);
      if (e.life <= 0 || p.z > 1) { e.el.remove(); delete dmgNums[id]; continue; }
      e.el.style.left = `${(p.x + 1) / 2 * 100}%`;
      e.el.style.top = `${(1 - p.y) / 2 * 100}%`;
      e.el.style.opacity = Math.min(1, e.life * 2.5);
    }
  }
  function showHealPopup(amount) {
    const el = document.createElement('div');
    el.className = 'heal-pop';
    el.textContent = '+' + amount;
    $('ss-health-circle').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function updateHealthUI() {
    setText(healthText, Math.max(0, Math.round(me.hp)));
    const bar = $('ss-hp-bar');
    const C = 2 * Math.PI * 42;
    bar.style.strokeDasharray = C;
    bar.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(100, me.hp)) / 100);
    bar.style.stroke = me.hp > 60 ? '#2ecc71' : me.hp > 30 ? '#f39c12' : '#e74c3c';
    document.body.classList.toggle('low-hp', inGame && me.alive && me.hp <= 30);
  }
  function triggerDamageFlash(fromX, fromZ) {
    damageFlash.classList.remove('active'); void damageFlash.offsetHeight; damageFlash.classList.add('active');
    if (fromX === null || fromX === undefined) return;
    const ang = Math.atan2(fromX - st.x, fromZ - st.z);           // dirección hacia el atacante
    const rel = ang - Math.atan2(-Math.sin(yaw), -Math.cos(yaw));  // relativo a donde miro
    const el = document.createElement('div');
    el.className = 'dmg-ind';
    el.style.transform = `translate(-50%,-50%) rotate(${-rel}rad)`;
    $('damage-indicators').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  function showToast(msg, ms) {
    centerToast.textContent = msg;
    centerToast.classList.remove('hidden');
    centerToast.style.animation = 'none'; void centerToast.offsetHeight; centerToast.style.animation = '';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => centerToast.classList.add('hidden'), ms || 1400);
  }
  function showBanner(html, cls, ms) {
    bigBanner.innerHTML = html;
    bigBanner.className = 'big-banner ' + (cls || '');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => bigBanner.classList.add('hidden'), ms || 2500);
  }
  function lobbyToast(msg) {
    const el = $('lobby-toast');
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(lobbyToast._t);
    lobbyToast._t = setTimeout(() => el.classList.add('hidden'), 3500);
  }
  function addFeed(html, cls) {
    const el = document.createElement('div');
    el.className = 'kf-item ' + (cls || '');
    el.innerHTML = html;
    killFeedEl.appendChild(el);
    while (killFeedEl.children.length > 6) killFeedEl.firstChild.remove();
    setTimeout(() => el.remove(), 5000);
  }
  function addChat(nick, msg, team) {
    const el = document.createElement('div');
    el.className = 'chat-line';
    const col = team ? (team === 'red' ? '#ff8a80' : '#82b1ff') : '#f1c40f';
    el.innerHTML = `<b style="color:${col}">${escapeHtml(nick)}:</b> ${escapeHtml(msg)}`;
    chatLogEl.appendChild(el);
    while (chatLogEl.children.length > 7) chatLogEl.firstChild.remove();
    setTimeout(() => el.classList.add('old'), 9000);
  }
  const weaponLabel = w => (weaponIcons[w] ? `<img class="kf-wep" src="${weaponIcons[w].light}" alt="${escapeHtml(WEAPONS[w].name)}">` : WEAPONS[w] ? WEAPONS[w].icon : w === 'grenade' ? '💣' : w === 'melee' ? '🥄' : w === 'void' ? '🌌' : '💀');

  let lbKey = '';
  function updateHUDFromState(s) {
    const players = Object.values(s.players);
    const mode = MODES[cfg.mode] || MODES.ffa;
    setText($('ss-timer'), fmtTime(s.timeLeft));
    $('ss-timer').classList.toggle('urgent', s.timeLeft !== null && s.timeLeft <= 30);
    const redPill = $('ss-team-red-pill'), bluePill = $('ss-team-blue-pill');
    if (mode.teams) {
      redPill.style.display = bluePill.style.display = '';
      setText($('ss-red-count'), s.teamScores.red);
      setText($('ss-blue-count'), s.teamScores.blue);
      redPill.classList.toggle('mine', me.team === 'red');
      bluePill.classList.toggle('mine', me.team === 'blue');
      setText($('ss-goal'), `${mode.short} · meta ${cfg.scoreLimit}`);
    } else {
      redPill.style.display = bluePill.style.display = 'none';
      const top = players.slice().sort((a, b) => b.score - a.score)[0];
      setText($('ss-goal'), `Tú ${me.score} · Líder ${top ? top.score : 0} / ${cfg.scoreLimit}`);
    }
    // Ranking lateral (top 5)
    const sorted = players.slice().sort((a, b) => (b.score - a.score) || (b.kills - a.kills));
    const key = sorted.slice(0, 5).map(p => p.id + p.score + p.kills + p.nickname).join('|');
    if (key !== lbKey) {
      lbKey = key;
      $('ss-left-leaderboard').innerHTML = sorted.slice(0, 5).map(p =>
        `<div class="ss-lb-row ${p.team ? 'team-' + p.team : ''}${p.id === me.id ? ' you' : ''}"><span class="ss-lb-name">${escapeHtml(p.nickname)}</span><span class="ss-lb-score">${p.score}</span></div>`).join('');
    }
    // Panel de objetivo
    const panel = $('objective-panel');
    const ms = s.mode || {};
    if (ms.coop) {
      panel.classList.remove('hidden');
      const c = ms.coop;
      const fill = $('obj-fill');
      fill.style.width = c.progress + '%';
      fill.style.background = c.team ? (c.team === 'red' ? '#e74c3c' : '#3498db') : '#bbb';
      setText($('obj-title'), c.active ? '🐔 GALLINERO' : '🐔 El gallinero se está moviendo…');
      const inZone = mapData && me.alive && Math.hypot(st.x - c.x, st.z - c.z) <= c.r && st.y >= c.y - 0.8 && st.y <= c.y + 2.5;
      let sub = c.contested ? '⚔️ ¡DISPUTADO!' : c.team ? `Capturando: equipo ${c.team === 'red' ? 'Rojo' : 'Azul'} (${c.progress}%)` : 'Libre — ¡entra para capturarlo!';
      if (inZone) sub = '📍 Estás dentro · ' + sub;
      setText($('obj-sub'), sub);
    } else if (ms.spatula) {
      panel.classList.remove('hidden');
      const sp = ms.spatula;
      $('obj-fill').style.width = '0%';
      setText($('obj-title'), '🍳 ESPÁTULA');
      let sub = sp.state === 'home' ? 'En el centro — ¡ve a por ella!' : sp.state === 'dropped' ? 'En el suelo — ¡recógela!' : '';
      if (sp.state === 'carried') {
        const c = s.players[sp.carrier];
        if (sp.carrier === me.id) sub = '¡LA LLEVAS TÚ! Corre a tu base 🏠';
        else if (c) sub = `La lleva ${c.nickname} (${c.team === me.team ? 'tu equipo' : 'enemigo'})`;
      }
      setText($('obj-sub'), sub);
      panel.classList.toggle('carrying', sp.carrier === me.id);
    } else panel.classList.add('hidden');

    if (!scoreboardOverlay.classList.contains('hidden')) renderScoreboard(s.players);
  }

  function renderScoreboard(players) {
    const mode = MODES[cfg.mode] || MODES.ffa;
    setText($('sb-game-info'), `${(mapData && mapData.name) || ''} • ${mode.name}${cfg.code ? ' • Código ' + cfg.code : ''}`);
    setText($('sb-score-col'), mode.teams ? 'PUNTOS' : 'BAJAS');
    const arr = Object.values(players).sort((a, b) => {
      if (mode.teams && a.team !== b.team) return a.team === 'red' ? -1 : 1;
      return (b.score - a.score) || (b.kills - a.kills);
    });
    scoreboardEntries.innerHTML = arr.map((p, i) => {
      const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills;
      const team = p.team ? (p.team === 'red' ? '<span class="tag red">Rojo</span>' : '<span class="tag blue">Azul</span>') : '—';
      return `<tr class="${p.id === me.id ? 'me' : ''}"><td>${i + 1}</td><td><strong>${escapeHtml(p.nickname)}</strong>${p.id === me.id ? ' (tú)' : ''}${p.alive ? '' : ' 💀'}</td><td>${team}</td><td>${p.score}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${kd}</td></tr>`;
    }).join('');
  }

  // ===========================================================================
  // PANTALLA DE REAPARICIÓN / PAUSA, CHAT Y CONTROLES
  // ===========================================================================
  let rsMode = null;            // null | 'dead' | 'pause'
  let respawnReadyAt = 0;
  let respawnRequested = false;
  const rsEl = () => $('respawn-screen');

  function showRespawnScreen(mode) {
    if (!inGame) return;
    rsMode = mode;
    if (mode === 'pause') { isPaused = true; isMouseDown = false; isAiming = false; }
    $('rs-killed').classList.toggle('hidden', mode !== 'dead');
    setText($('rs-streak'), 'x' + matchBestStreak);
    $('pause-room-info').innerHTML = `${escapeHtml(cfg.roomName || '')} · ${escapeHtml((mapData && mapData.name) || '')} · ${escapeHtml((MODES[cfg.mode] || {}).name || '')}${cfg.code ? ` · código <b>${escapeHtml(cfg.code)}</b>` : ''}`;
    renderChallenges();
    renderWeaponPickers();
    renderInviteList();
    updateTeamUI();
    refreshAdminUI();
    if (lastState) renderAdminPlayers(lastState.players, true);
    rsEl().classList.remove('hidden');
    document.body.classList.add('rs-open');
    updateRespawnScreen();
  }
  function hideRespawnScreen() {
    rsMode = null;
    isPaused = false;
    rsEl().classList.add('hidden');
    document.body.classList.remove('rs-open');
  }
  function updateRespawnScreen() {
    if (!rsMode) return;
    const btn = $('rs-play'), label = $('rs-play-label');
    if (rsMode === 'dead') {
      const left = Math.ceil((respawnReadyAt - performance.now()) / 1000);
      if (left > 0) { btn.classList.add('waiting'); setText(label, `¡PREPÁRATE! ${left}`); }
      else { btn.classList.remove('waiting'); setText(label, respawnRequested ? 'ENTRANDO…' : 'JUGAR'); }
    } else { btn.classList.remove('waiting'); setText(label, 'CONTINUAR'); }
  }
  function onRespawnPlay() {
    if (rsMode === 'dead') {
      if (performance.now() < respawnReadyAt || respawnRequested) return;
      respawnRequested = true;
      socket.emit('player:respawn-request');
      lockPointer();
      updateRespawnScreen();
    } else if (rsMode === 'pause') {
      // La pantalla se cierra cuando el navegador concede el ratón (pointerlockchange);
      // si lo deniega, se queda abierta y avisamos.
      lockPointer();
    }
  }
  // ---- Admin de la sala --------------------------------------------------------
  function isAdmin() { return !!(inGame && me.id && adminId === me.id); }
  function setAdmin(id) {
    if (id === adminId) return;
    const was = adminId;
    adminId = id;
    if (inGame && was && id === me.id) { addFeed('👑 Ahora eres el admin de la sala (Esc para gestionarla)', 'notice'); playSound('pickup', 0.5); }
    adminPlayersSig = '';
    refreshAdminUI();
  }
  function adminAction(action, extra) {
    if (!socket || !isAdmin()) return;
    socket.emit('room:admin', Object.assign({ action }, extra || {}));
    playSound('click');
  }
  function updatePausedBanner() {
    const el = $('paused-banner');
    if (el) el.classList.toggle('hidden', !(inGame && roundState === 'paused'));
  }
  function refreshAdminUI() {
    const admin = isAdmin();
    $('rs-admin').classList.toggle('hidden', !admin);
    $('go-admin').classList.toggle('hidden', !admin || gameoverOverlay.classList.contains('hidden'));
    if (!admin) return;
    const paused = roundState === 'paused', ended = roundState === 'ended';
    const stEl = $('admin-state');
    stEl.className = 'admin-state' + (paused ? ' paused' : ended ? ' ended' : '');
    setText(stEl, paused ? 'EN PAUSA' : ended ? (roundHold ? 'DETENIDA' : 'FIN DE RONDA') : 'EN JUEGO');
    const pb = $('adm-pause');
    pb.querySelector('i').textContent = paused ? '▶' : ended ? '▶' : '⏸';
    pb.querySelector('span').textContent = paused ? 'Reanudar' : ended ? 'Empezar ronda' : 'Pausar';
    $('adm-end').disabled = ended;
  }
  function renderAdminPlayers(players, force) {
    if (!players || !isAdmin()) return;
    const ids = Object.keys(players);
    const sig = ids.map(id => id + (players[id].team || '')).join('|');
    if (!force && sig === adminPlayersSig) return;
    adminPlayersSig = sig;
    const rows = ids.map(id => {
      const p = players[id];
      const you = id === me.id;
      const mv = cfg.teams && p.team ? `<button data-move="${escapeHtml(id)}" title="Cambiar de equipo">⇄</button>` : '';
      return `<div class="ap-row"><span class="ap-dot ${p.team || ''}"></span><span class="ap-name">${escapeHtml(p.nickname)}</span>${mv}${you ? '<span class="ap-you">TÚ · ADMIN</span>' : `<button data-kick="${escapeHtml(id)}" title="Expulsar 2 minutos">Expulsar</button>`}</div>`;
    }).join('');
    $('admin-players').innerHTML = `<div class="ap-title">JUGADORES (${ids.length})</div>${rows}`;
  }
  function openAdminSettings() {
    if (!isAdmin()) return;
    createMode = 'admin';
    createState.map = MapDefs.resolveId(cfg.map);
    createState.mode = cfg.mode;
    setText($('create-title'), '⚙️ AJUSTES DE LA PARTIDA');
    $('btn-confirm-create-room').textContent = 'APLICAR Y EMPEZAR 🔄';
    $('create-private-row').classList.add('hidden');
    $('create-room-name').value = cfg.roomName || '';
    refreshCreate(true);
    const sel = (id, v) => { const el = $(id); if (![...el.options].some(o => o.value === String(v))) el.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`); el.value = String(v); };
    sel('create-room-limit', cfg.scoreLimit);
    sel('create-room-time', cfg.timeLimit);
    sel('create-room-max-players', cfg.maxPlayers || 8);
    $('create-room-bots').value = String(cfg.bots || 0); createState.botsTouched = true;
    createState.botDifficulty = cfg.botDifficulty || 'normal';
    refreshCreate();
    $('create-room-max-players').dataset.touched = '1';
    $('create-room-modal').classList.add('admin-mode');
    $('create-room-modal').classList.remove('hidden');
    refreshCreate();
  }
  function initAdmin() {
    $('adm-pause').addEventListener('click', () => adminAction(roundState === 'paused' ? 'resume' : roundState === 'ended' ? 'start' : 'pause'));
    $('adm-restart').addEventListener('click', () => { if (confirmOnce('restart', '¿Reiniciar la ronda? Se borran las puntuaciones. Pulsa otra vez para confirmar.')) adminAction('restart'); });
    $('adm-end').addEventListener('click', () => { if (confirmOnce('end', '¿Terminar la ronda ahora? Pulsa otra vez para confirmar.')) adminAction('end'); });
    $('adm-settings').addEventListener('click', openAdminSettings);
    $('go-start').addEventListener('click', () => adminAction('start'));
    $('go-settings').addEventListener('click', openAdminSettings);
    $('admin-players').addEventListener('click', e => {
      const mvb = e.target.closest('[data-move]');
      if (mvb) { adminAction('team', { id: mvb.dataset.move }); return; }
      const b = e.target.closest('[data-kick]');
      if (!b) return;
      const name = b.parentElement.querySelector('.ap-name').textContent;
      if (confirmOnce('kick' + b.dataset.kick, `¿Expulsar a ${name}? Pulsa otra vez para confirmar.`)) adminAction('kick', { id: b.dataset.kick });
    });
  }
  // Confirmación de dos pulsaciones (sin diálogos del navegador, que rompen el ratón capturado)
  const pendingConfirm = {};
  function confirmOnce(key, msg) {
    const now = performance.now();
    if (pendingConfirm[key] && now - pendingConfirm[key] < 3000) { delete pendingConfirm[key]; return true; }
    pendingConfirm[key] = now;
    addFeed('❓ ' + escapeHtml(msg), 'notice');
    lobbyToast(msg);
    return false;
  }

  function openPause() { if (inGame && !rsMode) showRespawnScreen(me.alive ? 'pause' : 'dead'); }

  function lockPointer() {
    try {
      const p = renderer.domElement.requestPointerLock();
      if (p && p.catch) p.catch(onLockError);
    } catch (e) { onLockError(); }
  }
  function onLockError() {
    if (!inGame) return;
    lobbyToast('El navegador no ha dejado capturar el ratón. Haz clic otra vez en el botón.');
    if (!rsMode) showRespawnScreen(me.alive ? 'pause' : 'dead');
  }

  function openChat() {
    isChatting = true; isMouseDown = false; isAiming = false;
    chatBar.classList.remove('hidden');
    chatLogEl.classList.add('open');
    Object.keys(pressed).forEach(k => { pressed[k] = false; });
    if (document.pointerLockElement) document.exitPointerLock();
    chatInput.value = '';
    setTimeout(() => chatInput.focus(), 20);
  }
  function closeChat() {
    isChatting = false;
    chatBar.classList.add('hidden');
    chatLogEl.classList.remove('open');
    chatInput.blur();
    lockPointer();
  }

  function inputDown(code, e) {
    if (!inGame || code === 'Escape' || rebinding) return;
    const acts = actionsFor(code);
    if (e && (acts.length || code === 'Space' || code === 'Tab')) e.preventDefault();
    if (isChatting || !$('settings-modal').classList.contains('hidden')) return;
    if (acts.includes('scoreboard')) {
      scoreboardOverlay.classList.remove('hidden');
      if (lastState) renderScoreboard(lastState.players);
    }
    if (isPaused || rsMode === 'pause') return;
    pressed[code] = true;
    if (!isPointerLocked) return;
    for (const a of acts) {
      if (a === 'chat') { openChat(); return; }
      if (a === 'hud') { hudEl.classList.toggle('hud-off'); continue; }
      if (!me.alive) continue;
      switch (a) {
        case 'fire': isMouseDown = true; shoot(); break;
        case 'aim': case 'aim2': isAiming = true; break;
        case 'reload': reloadWeapon(); break;
        case 'swap': togglePistol(); break;
        case 'grenade': if (!e || !e.repeat) startGrenadeCharge(); break;
        case 'melee': doMelee(); break;
        case 'inspect': if (!isReloading && !isAiming) inspectAnim = 1; break;
        case 'emote': socket.emit('player:emote', { emoteType: 'spin' }); break;
        case 'w1': equipWeapon(primaryWeapon); break;
        case 'w2': equipWeapon('pistol'); break;
      }
    }
  }
  function inputUp(code) {
    pressed[code] = false;
    for (const a of actionsFor(code)) {
      if (a === 'fire') isMouseDown = false;
      else if (a === 'aim' || a === 'aim2') isAiming = !!(isDown('aim') || isDown('aim2'));
      else if (a === 'grenade') releaseGrenade();
      else if (a === 'scoreboard') scoreboardOverlay.classList.add('hidden');
    }
  }

  function initControls() {
    const canvas = renderer.domElement;
    canvas.addEventListener('click', () => { if (inGame && !rsMode && !isChatting && !isPointerLocked) lockPointer(); });

    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = document.pointerLockElement === canvas;
      if (!isPointerLocked) {
        isMouseDown = false; isAiming = false;
        Object.keys(pressed).forEach(k => { pressed[k] = false; });
        if (suppressPauseScreen) suppressPauseScreen = false;
        else if (inGame && !isChatting) showRespawnScreen(me.alive ? 'pause' : 'dead');
      } else if (rsMode === 'pause') hideRespawnScreen();
    });
    document.addEventListener('pointerlockerror', onLockError);
    window.addEventListener('blur', () => { Object.keys(pressed).forEach(k => { pressed[k] = false; }); isMouseDown = false; });

    document.addEventListener('mousemove', e => {
      if (!isPointerLocked || !inGame || !me.alive || isPaused || isChatting) return;
      const adsScale = isAiming ? Math.min(1, currentFov / settings.fov) : 1;
      const s = 0.0022 * settings.sens * adsScale;
      yaw -= e.movementX * s;
      pitch -= e.movementY * s * (settings.invertY ? -1 : 1);
      pitch = Math.max(-Math.PI / 2 + 0.03, Math.min(Math.PI / 2 - 0.03, pitch));
    });
    document.addEventListener('mousedown', e => { if (inGame && isPointerLocked) inputDown('Mouse' + e.button, e); });
    document.addEventListener('mouseup', e => inputUp('Mouse' + e.button));
    document.addEventListener('contextmenu', e => { if (inGame) e.preventDefault(); });
    document.addEventListener('keydown', e => { if (e.target === chatInput) return; inputDown(e.code, e); });
    document.addEventListener('keyup', e => { if (actionsFor(e.code).includes('scoreboard') || e.code === 'Tab') e.preventDefault(); inputUp(e.code); });
    window.addEventListener('wheel', e => {
      if (!canAct() || Math.abs(e.deltaY) < 4) return;
      togglePistol();
    }, { passive: true });

    chatInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const msg = chatInput.value.trim();
        if (msg) socket.emit('player:chat', { message: msg });
        closeChat();
      } else if (e.key === 'Escape') closeChat();
    });

    $('rs-play').addEventListener('click', onRespawnPlay);
    $('rs-team-switch').addEventListener('click', () => {
      if (!socket || !cfg.teams) return;
      socket.emit('player:switch-team', { team: me.team === 'red' ? 'blue' : 'red' });
      playSound('click');
    });
    $('rs-exit').addEventListener('click', exitToLobby);
    $('rs-settings').addEventListener('click', openSettings);
    initSettingsModal();
  }

  // ---- Modal de ajustes ----
  let draft = null, rebinding = null;
  function applySettings() {
    if (master) master.gain.value = settings.vol;
    document.body.classList.toggle('hide-fps', !settings.showFps);
    if (!isAiming) { currentFov = settings.fov; camera.fov = settings.fov; camera.updateProjectionMatrix(); }
    const q = settings.quality;
    // Resolución interna: ultra hasta 2× (pantallas retina), alta 1,5×, media nativa y baja un 15 % por debajo
    // de la nativa (las gráficas integradas van justas de píxeles: es lo que más FPS da)
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(q === 'ultra' ? Math.min(dpr, 2) : q === 'high' ? Math.min(dpr, 1.5) : q === 'mid' ? Math.min(dpr, 1) : Math.min(dpr, 1) * 0.85);
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.type = q === 'high' || q === 'ultra' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // Luces de efectos (fogonazo/explosión) sólo en calidad alta: cuestan en cada píxel
    if (muzzleLight) { muzzleLight.visible = q === 'high' || q === 'ultra'; boomLight.visible = q === 'high' || q === 'ultra'; }
    // Hierba y partículas ambientales fuera en calidad baja
    if (mapRoot) mapRoot.traverse(o => { if (o.userData && o.userData.detail) o.visible = q !== 'low'; });
    // Anisotropía según calidad (la textura del suelo se clona al construir el mapa → recargar)
    const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
    window.MapRenderer.setAnisotropy(Math.min(maxAniso, q === 'ultra' ? 16 : q === 'high' ? 8 : q === 'mid' ? 4 : 1));
    renderer.toneMapping = q === 'low' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const size = q === 'ultra' ? 4096 : q === 'high' ? 2048 : 1024;
    if (lights.sun.shadow.mapSize.x !== size) {
      lights.sun.shadow.mapSize.set(size, size);
      if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; }
    }
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
    applyDrawDistance();
  }
  // Distancia de visión según la calidad (la niebla del mapa se aleja o se acerca):
  // en baja se ve algo menos lejos (menos píxeles con detalle), en ultra bastante más
  function applyDrawDistance() {
    if (!scene || !scene.fog || !mapData || !mapData.def) return;
    const f = mapData.def.theme.fog, k = { ultra: 1.4, high: 1, mid: 0.92, low: 0.78 }[settings.quality] || 1;
    scene.fog.near = f[0] * k; scene.fog.far = f[1] * k;
  }
  function openSettings() {
    draft = { s: Object.assign({}, settings), b: Object.assign({}, binds) };
    rebinding = null;
    renderSettings();
    $('settings-modal').classList.remove('hidden');
  }
  function closeSettings() { rebinding = null; $('settings-modal').classList.add('hidden'); }
  function renderSettings() {
    $('bind-list').innerHTML = BIND_ORDER.map(([a, label]) =>
      `<div class="bind-row"><button class="bind-key${rebinding === a ? ' listening' : ''}" data-bind="${a}">${rebinding === a ? 'PULSA…' : escapeHtml(codeLabel(draft.b[a]))}</button><span>${label}</span></div>`).join('');
    $('mouse-sens-slider').value = Math.round(draft.s.sens * 50);
    setText($('sens-value-text'), Math.round(draft.s.sens * 50));
    $('fov-slider').value = draft.s.fov; setText($('fov-value-text'), draft.s.fov + '°');
    $('vol-slider').value = draft.s.vol; setText($('vol-value-text'), Math.round(draft.s.vol * 100) + '%');
    $('invert-y').checked = draft.s.invertY;
    $('quality-select').value = draft.s.quality;
    $('show-fps').checked = draft.s.showFps;
  }
  function assignBind(code) {
    const a = rebinding;
    rebinding = null;
    if (!a) return;
    const old = draft.b[a];
    for (const k in draft.b) if (k !== a && draft.b[k] === code) draft.b[k] = old; // intercambiar si ya estaba usada
    draft.b[a] = code;
    renderSettings();
  }
  function initSettingsModal() {
    document.querySelectorAll('.set-tab').forEach(t => t.addEventListener('click', () => {
      document.querySelectorAll('.set-tab').forEach(x => x.classList.toggle('active', x === t));
      document.querySelectorAll('.set-pane').forEach(p => p.classList.toggle('hidden', p.id !== 'stab-' + t.dataset.stab));
    }));
    $('bind-list').addEventListener('click', e => {
      const b = e.target.closest('[data-bind]');
      if (!b) return;
      setTimeout(() => { rebinding = b.dataset.bind; renderSettings(); }, 0);
    });
    window.addEventListener('keydown', e => {
      if (!rebinding) return;
      e.preventDefault(); e.stopPropagation();
      if (e.code === 'Escape') { rebinding = null; renderSettings(); return; }
      assignBind(e.code);
    }, true);
    window.addEventListener('mousedown', e => {
      if (!rebinding) return;
      e.preventDefault(); e.stopPropagation();
      assignBind('Mouse' + e.button);
    }, true);
    $('settings-modal').addEventListener('contextmenu', e => e.preventDefault());
    $('mouse-sens-slider').addEventListener('input', e => { draft.s.sens = parseInt(e.target.value, 10) / 50; setText($('sens-value-text'), e.target.value); });
    $('fov-slider').addEventListener('input', e => { draft.s.fov = parseInt(e.target.value, 10); setText($('fov-value-text'), draft.s.fov + '°'); });
    $('vol-slider').addEventListener('input', e => { draft.s.vol = parseFloat(e.target.value); setText($('vol-value-text'), Math.round(draft.s.vol * 100) + '%'); if (master) master.gain.value = draft.s.vol; playSound('click'); });
    $('invert-y').addEventListener('change', e => { draft.s.invertY = e.target.checked; });
    $('quality-select').addEventListener('change', e => { draft.s.quality = e.target.value; store.set('qualityManual', true); });
    $('show-fps').addEventListener('change', e => { draft.s.showFps = e.target.checked; });
    $('set-cancel').addEventListener('click', () => { if (master) master.gain.value = settings.vol; closeSettings(); });
    $('set-reset').addEventListener('click', () => { draft = { s: Object.assign({}, DEFAULT_SETTINGS), b: Object.assign({}, DEFAULT_BINDS) }; renderSettings(); });
    $('set-confirm').addEventListener('click', () => {
      Object.assign(settings, draft.s);
      binds = Object.assign({}, draft.b);
      store.set('settings', settings);
      store.set('binds', binds);
      applySettings();
      closeSettings();
      lobbyToast('Ajustes guardados');
    });
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.close === 'settings-modal') { if (master) master.gain.value = settings.vol; closeSettings(); }
      else $(b.dataset.close).classList.add('hidden');
    }));
  }

  // ===========================================================================
  // ENTRAR / SALIR DE PARTIDA
  // ===========================================================================
  function enterGameUI() {
    inGame = true; joining = false;
    if (mapData) setupSunFollow();
    menuOverlay.classList.add('hidden');
    ['create-room-modal', 'friends-modal', 'settings-modal', 'loading-overlay'].forEach(id => $(id).classList.add('hidden'));
    hudEl.classList.remove('hidden');
    hudEl.classList.remove('hud-off');
    renderer.domElement.classList.add('game-active');
    gameoverOverlay.classList.add('hidden');
    hideRespawnScreen();
    matchBestStreak = 0;
    updateAmmoHUD(); updateHealthUI(); updateGrenadeHUD();
    lockPointer();
    // Si el navegador no concede el ratón, mostramos la pantalla de pausa con el botón CONTINUAR
    setTimeout(() => { if (inGame && !isPointerLocked && !rsMode) showRespawnScreen('pause'); }, 700);
  }

  function resetSunFull() {
    if (!mapData || !lights) return;
    window.MapRenderer.fitSun(lights, mapData);
  }
  function exitToLobby() {
    resetSunFull();
    if (socket) socket.emit('player:leave-room');
    inGame = false; joining = false; me.alive = false; me.id = null;
    hideRespawnScreen();
    closeSettings();
    menuOverlay.classList.remove('hidden');
    hudEl.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    scoreboardOverlay.classList.add('hidden');
    scopeOverlay.classList.add('hidden');
    document.body.classList.remove('low-hp');
    renderer.domElement.classList.remove('game-active');
    if (document.pointerLockElement) document.exitPointerLock();
    clearRemotePlayers();
    Object.keys(grenades).forEach(removeGrenade);
    lastState = null; deathCam = null;
    Object.keys(dmgNums).forEach(id => { dmgNums[id].el.remove(); delete dmgNums[id]; });
    camera.fov = settings.fov; camera.updateProjectionMatrix();
    if (activeFPS) activeFPS.visible = false;
    renderChallenges(); renderProfile(); updateEggCounter();
    if (socket) socket.emit('rooms:get');
  }

  function getNickname() {
    if (!account) { showAuth('login'); return null; }
    return account.username;
  }

  function joinGame(target) {
    if (joining) return;
    if (!account) { showAuth('login'); return; }
    if (!socket || !socket.connected) { lobbyToast('Sin conexión con el servidor'); return; }
    const nickname = getNickname();
    if (!nickname) return;
    getAudioCtx();
    joining = true;
    $('loading-overlay').classList.remove('hidden');
    const payload = Object.assign({
      nickname, custom, weapon: currentWeapon,
    }, target || { roomId: 'quick', mode: quickMode || undefined });
    socket.emit('player:join-room', payload);
    setTimeout(() => { if (joining) { joining = false; $('loading-overlay').classList.add('hidden'); lobbyToast('El servidor no responde. Inténtalo de nuevo.'); } }, 6000);
  }

  // ===========================================================================
  // RETOS DIARIOS Y ESTADÍSTICAS (guardados en este navegador)
  // ===========================================================================
  const CH_POOL = [
    { id: 'kills', icon: '💀', title: 'EXTERMINADOR', desc: n => `Consigue ${n} bajas`, n: [15, 25], reward: 300 },
    { id: 'kills_rifle', icon: '🔫', title: 'RÁFAGA', desc: n => `${n} bajas con el EggK-47`, n: [8, 12], reward: 200 },
    { id: 'kills_shotgun', icon: '💥', title: 'A QUEMARROPA', desc: n => `${n} bajas con el Scrambler`, n: [6, 10], reward: 200 },
    { id: 'kills_sniper', icon: '🎯', title: 'FRANCOTIRADOR', desc: n => `${n} bajas con el Free RANGER`, n: [5, 8], reward: 250 },
    { id: 'headshots', icon: '🧠', title: 'PUNTERÍA FINA', desc: n => `Consigue ${n} disparos a la cabeza`, n: [5, 10], reward: 250 },
    { id: 'grenade_kills', icon: '💣', title: 'HUEVOS-PLOSIVO', desc: n => `Elimina ${n} huevos con granadas`, n: [2, 4], reward: 300 },
    { id: 'coop_time', icon: '🐔', title: 'DEFIENDE EL GALLINERO', desc: n => `Permanece ${n} s en el gallinero`, n: [30, 60], reward: 150 },
    { id: 'coop_kills', icon: '🛡️', title: 'GUARDIÁN', desc: n => `Elimina ${n} huevos dentro del gallinero`, n: [1, 3], reward: 200 },
    { id: 'streak', icon: '🔥', title: 'EN RACHA', desc: n => `Consigue una racha de ${n} bajas`, n: [3, 5], reward: 250 },
    { id: 'wins', icon: '🏆', title: 'CAMPEÓN', desc: n => `Gana ${n} partida${n > 1 ? 's' : ''}`, n: [1, 2], reward: 400 },
    { id: 'spatula', icon: '🍳', title: 'CHEF', desc: n => `Entrega ${n} espátula${n > 1 ? 's' : ''} en tu base`, n: [1, 2], reward: 300 },
    { id: 'double', icon: '⚡', title: 'DAÑO COLATERAL', desc: () => 'Elimina a 2 huevos en menos de 3 s', n: [1, 1], reward: 200 },
    { id: 'play', icon: '🥚', title: 'HUEVO CONSTANTE', desc: n => `Termina ${n} rondas`, n: [2, 3], reward: 150 },
  ];
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  let challenges = null;
  let eggs = 0; // huevos ganados con los retos (se guardan en la cuenta)
  let matchBestStreak = 0, lastKillAt = 0, coopAccum = 0;

  function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  function makeChallenge(def, R) { return { id: def.id, n: def.n[0] + Math.floor(R() * (def.n[1] - def.n[0] + 1)), progress: 0, claimed: false, rerolled: false }; }
  function loadChallenges(fromAccount) {
    const saved = fromAccount !== undefined ? fromAccount : store.get('challenges', null);
    if (saved && saved.day === todayKey()) { challenges = saved; return; }
    const R = seeded(todayKey());
    const pool = CH_POOL.slice();
    const list = [];
    while (list.length < 3) list.push(makeChallenge(pool.splice(Math.floor(R() * pool.length), 1)[0], R));
    challenges = { day: todayKey(), list };
    store.set('challenges', challenges);
  }
  function saveProgress() { store.set('challenges', challenges); saveProfileSoon(); }
  function progress(id, amount, isMax) {
    if (!challenges) return;
    if (challenges.day !== todayKey()) loadChallenges();
    let changed = false;
    for (const c of challenges.list) {
      if (c.id !== id || c.claimed || c.progress >= c.n) continue;
      const before = c.progress;
      c.progress = Math.min(c.n, isMax ? Math.max(c.progress, amount) : c.progress + amount);
      if (c.progress !== before) changed = true;
      if (before < c.n && c.progress >= c.n) {
        const def = CH_POOL.find(d => d.id === id);
        addFeed(`⭐ ¡Reto completado: <b>${def.title}</b>! Reclámalo en el menú`, 'notice');
        playSound('capture', 0.6);
      }
    }
    if (changed) { saveProgress(); if (rsMode || !inGame) renderChallenges(); }
  }
  function renderChallenges() {
    if (!challenges) return;
    const html = challenges.list.map((c, i) => {
      const def = CH_POOL.find(d => d.id === c.id);
      const done = c.progress >= c.n;
      const btn = c.claimed ? '<span class="ch-btn">¡Reclamado!</span>'
        : done ? `<button class="ch-btn claim" data-claim="${i}">Reclamar</button>`
          : c.rerolled ? '' : `<button class="ch-btn" data-reroll="${i}" title="Cambiar este reto (1 vez al día)">⟳</button>`;
      return `<div class="challenge${done ? ' done' : ''}${c.claimed ? ' claimed' : ''}">
        <div class="ch-icon">${def.icon}</div>
        <div><div class="ch-title">${def.title}</div><div class="ch-desc">${escapeHtml(def.desc(c.n))}</div>
        <div class="ch-bar"><i style="width:${Math.round(c.progress / c.n * 100)}%"></i></div>
        <div class="ch-foot"><span class="reward">${def.reward}</span><span>${Math.floor(c.progress)}/${c.n}</span>${btn}</div></div></div>`;
    }).join('');
    ['challenge-list', 'rs-challenge-list'].forEach(id => { const el = $(id); if (el) el.innerHTML = html; });
  }
  function onChallengeClick(e) {
    const claim = e.target.closest('[data-claim]'), reroll = e.target.closest('[data-reroll]');
    if (claim) {
      const c = challenges.list[+claim.dataset.claim];
      if (!c || c.claimed || c.progress < c.n) return;
      c.claimed = true;
      eggs += CH_POOL.find(d => d.id === c.id).reward;
      playSound('pickup'); saveProgress(); renderChallenges(); updateEggCounter(); renderProfile();
    } else if (reroll) {
      const i = +reroll.dataset.reroll, c = challenges.list[i];
      if (!c || c.rerolled || c.claimed) return;
      const used = challenges.list.map(x => x.id);
      const options = CH_POOL.filter(d => !used.includes(d.id));
      const nc = makeChallenge(options[Math.floor(Math.random() * options.length)], Math.random);
      nc.rerolled = true;
      challenges.list[i] = nc;
      playSound('switch'); saveProgress(); renderChallenges();
    }
  }
  function updateChallengeTimer() {
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const txt = `${String((s / 3600) | 0).padStart(2, '0')}:${String(((s % 3600) / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    setText($('challenge-timer'), txt); setText($('rs-challenge-timer'), txt);
    if (challenges && challenges.day !== todayKey()) { loadChallenges(); renderChallenges(); }
  }
  function updateEggCounter() { setText($('egg-count'), eggs.toLocaleString('es-ES')); }
  function renderProfile() {
    if (!account) return;
    const stats = account.stats;
    setText($('profile-name'), account.username);
    const kd = stats.deaths ? (stats.kills / stats.deaths).toFixed(2) : stats.kills;
    const fav = Object.entries(stats.kw).sort((a, b) => b[1] - a[1])[0];
    const items = [
      ['Bajas', stats.kills], ['Muertes', stats.deaths], ['K/D', kd], ['Headshots', stats.headshots],
      ['Victorias', stats.wins], ['Rondas', stats.games], ['Mejor racha', stats.bestStreak], ['Granadas', stats.grenadeKills],
      ['Arma favorita', fav && fav[1] ? WEAPONS[fav[0]].name : '—'], ['Huevos', eggs],
      ['Cuenta', account.type === 'ip' ? 'Por IP' : 'Contraseña'], ['Desde', new Date(account.created).toLocaleDateString('es-ES')],
    ];
    $('stats-grid').innerHTML = items.map(([l, v]) => `<div class="stat"><b>${escapeHtml(v)}</b><span>${l}</span></div>`).join('');
    setText($('profile-sub'), account.type === 'ip' ? 'Cuenta ligada a este equipo' : 'Cuenta con contraseña');
    drawEggIcon($('profile-egg'));
    const isIp = account.type === 'ip';
    setText($('pw-title'), isIp ? 'Añadir contraseña' : 'Cambiar contraseña');
    $('pw-current').classList.toggle('hidden', isIp);
    setText($('pw-hint'), isIp ? 'Con contraseña podrás entrar desde cualquier ordenador (dejará de depender de la IP).' : '');
  }
  // Ganchos de eventos de la partida
  function trackKill(d) {
    if (d.headshot) progress('headshots', 1);
    if (d.weapon === 'grenade') progress('grenade_kills', 1);
    matchBestStreak = Math.max(matchBestStreak, d.streak || 0);
    progress('kills', 1);
    progress('kills_' + d.weapon, 1);
    progress('streak', d.streak || 0, true);
    const now = performance.now();
    if (now - lastKillAt < 3000) progress('double', 1);
    lastKillAt = now;
    const c = lastState && lastState.mode && lastState.mode.coop;
    const rp = remotePlayers[d.targetId];
    if (c && c.active && rp && Math.hypot(rp.root.position.x - c.x, rp.root.position.z - c.z) <= c.r) progress('coop_kills', 1);
    saveProgress();
  }
  function trackCoopTime(dt) {
    const c = lastState && lastState.mode && lastState.mode.coop;
    if (!c || !c.active || !me.alive) return;
    if (Math.hypot(st.x - c.x, st.z - c.z) <= c.r && st.y >= c.y - 0.8 && st.y <= c.y + 2.5) {
      coopAccum += dt;
      if (coopAccum >= 1) { coopAccum -= 1; progress('coop_time', 1); }
    }
  }

  // ===========================================================================
  // RED
  // ===========================================================================
  function applyConfig(c) {
    cfg = Object.assign({}, cfg, c);
    cfg.teams = !!(MODES[cfg.mode] && MODES[cfg.mode].teams);
    loadMap(cfg.map);
    buildObjectiveVisuals();
  }

  // Modo sin conexión (GitHub Pages): las salas y los bots corren en el navegador (public/js/offline.js)
  const OFFLINE = !!(window.EGG_OFFLINE && window.EggOffline);
  function setupOfflineUI() {
    document.body.classList.add('egg-offline');
    document.querySelectorAll('.logo-tag, .brand-text small').forEach(e => { e.textContent = 'VS BOTS'; });
    const help = document.querySelector('.auth-form[data-form="ip"] .auth-help');
    if (help) help.innerHTML = '<b>Modo sin conexión:</b> juegas contra bots en este navegador. Elige tu nombre; tu huevo y tus estadísticas se guardan en este equipo.';
    ipNeedsName = true;
    $('ip-name').classList.remove('hidden');
    $('btn-ip').textContent = 'JUGAR CONTRA BOTS';
    const head = document.querySelector('#panel-rooms .panel-head > span');
    if (head) head.textContent = 'SALAS CON BOTS';
  }

  function initNetworking() {
    if (OFFLINE) setupOfflineUI();
    socket = OFFLINE ? window.EggOffline.connect() : io({ transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      $('conn-dot').classList.add('online'); $('auth-conn').classList.add('online');
      const ct = OFFLINE ? 'Sin conexión · partidas contra bots' : 'Conectado al servidor';
      setText($('conn-text'), ct); setText($('auth-conn-text'), ct);
      socket.emit('rooms:get');
      const token = store.get('token', null);
      if (token) socket.emit('auth:token', { token }); else showAuth('login');
    });
    socket.on('auth:ok', onAuthOk);
    socket.on('auth:error', d => {
      if ($('auth-screen').classList.contains('hidden')) { store.set('token', null); showAuth('login'); }
      authError(d.message);
    });
    socket.on('auth:needName', () => {
      ipNeedsName = true;
      $('ip-name').classList.remove('hidden');
      $('btn-ip').textContent = 'CREAR CUENTA Y ENTRAR';
      authError('Este equipo aún no tiene cuenta: elige un nombre.');
      $('ip-name').focus();
    });
    socket.on('auth:kicked', d => {
      account = null;
      if (inGame) exitToLobby();
      store.set('token', null);
      showAuth('login');
      authError(d.message || 'Sesión cerrada');
    });
    socket.on('auth:pwResult', d => {
      if (d.error) { setText($('pw-hint'), '⚠️ ' + d.error); return; }
      $('pw-current').value = ''; $('pw-new').value = '';
      if (d.profile) { account.type = d.profile.type; }
      renderProfile(); updateAccountCard();
      lobbyToast('🔒 Contraseña guardada');
    });
    socket.on('profile:data', p => { if (account) { account.stats = p.stats; renderProfile(); } });
    socket.on('friends:list', d => { friendsData = d; renderFriends(); });
    socket.on('friends:error', d => lobbyToast('⚠️ ' + d.message));
    socket.on('friends:ok', d => lobbyToast(d.message));
    socket.on('friends:incoming', d => { lobbyToast(`🤝 ${d.from} quiere ser tu amigo (pestaña AMIGOS)`); playSound('pickup', 0.5); });
    socket.on('friends:invited', d => window.__showInvite(d));
    socket.on('disconnect', () => {
      $('conn-dot').classList.remove('online'); $('auth-conn').classList.remove('online');
      setText($('conn-text'), 'Sin conexión'); setText($('auth-conn-text'), 'Sin conexión — reintentando…');
      if (inGame) { exitToLobby(); lobbyToast('Se perdió la conexión con el servidor'); }
    });
    setInterval(() => {
      if (!socket.connected) return;
      const t = performance.now();
      socket.emit('net:ping', t, () => { ping = Math.round(performance.now() - t); setText($('ss-ping-val'), ping + 'ms'); });
    }, 2000);

    socket.on('rooms:list', renderRoomsList);
    socket.on('rooms:error', d => {
      joining = false;
      $('loading-overlay').classList.add('hidden');
      lobbyToast('⚠️ ' + ((d && d.message) || 'Error'));
    });
    socket.on('rooms:created', d => {
      if (!d || !d.roomId) return;
      selectedRoomId = d.roomId;
      pendingCode = d.isPrivate ? d.code : null;
      joinGame({ roomId: d.roomId });
    });

    socket.on('you:joined', d => {
      me.id = d.id; me.team = d.team; me.alive = true; me.hp = 100;
      me.kills = 0; me.deaths = 0; me.score = 0; me.grenades = RULES.GRENADE_START || 0;
      roundState = d.state || 'playing';
      adminId = d.adminId || null;
      clearRemotePlayers();
      Object.keys(grenades).forEach(removeGrenade);
      lastState = null; serverOffset = d.serverNow ? d.serverNow - Date.now() : null;
      applyConfig(d.config);
      st = Phys.newState(d.x, d.y, d.z);
      yaw = d.rotY || 0; pitch = 0;
      for (const id in d.players) {
        if (id === me.id) continue;
        addRemotePlayer(Object.assign({}, d.players[id], { custom: (d.customizations || {})[id] }));
      }
      Object.keys(ammo).forEach(k => { ammo[k] = WEAPONS[k].maxAmmo; });
      spawnedAt = performance.now(); firedSinceSpawn = false;
      spawnedAt = performance.now(); firedSinceSpawn = false;
      if (pendingPrimary) { primaryWeapon = pendingPrimary; pendingPrimary = null; }
      currentWeapon = primaryWeapon;
      equipWeapon(primaryWeapon, true);
      socket.emit('player:weapon-switch', { weapon: primaryWeapon });
      updateTeamUI();
      enterGameUI();
      const mode = MODES[cfg.mode];
      const teamTxt = me.team ? ` · Equipo <b class="${me.team}">${me.team === 'red' ? 'ROJO' : 'AZUL'}</b>` : '';
      showBanner(`<div class="bb-title">${escapeHtml(mapData.name)}</div><div class="bb-sub">${escapeHtml(mode.name)}${teamTxt}</div><div class="bb-desc">${escapeHtml(mode.desc)}</div>`, 'intro', 4500);
      if (isAdmin()) addFeed('👑 Eres el admin de esta sala: pulsa <b>Esc</b> para pausarla, terminarla o cambiar el mapa', 'notice');
      updatePausedBanner();
      if (pendingCode) { addFeed(`🔒 Sala privada — código: <b>${escapeHtml(pendingCode)}</b>`, 'notice'); pendingCode = null; }
      else if (cfg.code) addFeed(`🔑 Código de la sala: <b>${escapeHtml(cfg.code)}</b>`, 'notice');
    });

    socket.on('player:joined', d => addRemotePlayer(d));
    socket.on('player:left', d => removeRemotePlayer(d.id));
    socket.on('room:notice', d => addFeed(escapeHtml(d.text), 'notice'));
    socket.on('player:weapon-switched', d => setRemoteWeapon(remotePlayers[d.playerId], d.weapon));

    socket.on('game:state', s => {
      if (!inGame) return;
      lastState = s;
      if (s.t) {
        const est = s.t - Date.now();
        serverOffset = serverOffset === null ? est : serverOffset * 0.95 + est * 0.05;
      }
      const prevState = roundState;
      roundState = s.state;
      roundHold = !!s.hold;
      setAdmin(s.adminId || null);
      if (prevState !== roundState) { updatePausedBanner(); refreshAdminUI(); }
      for (const id in s.players) {
        const sp = s.players[id];
        if (id === me.id) {
          me.kills = sp.kills; me.deaths = sp.deaths; me.score = sp.score; me.team = sp.team;
          if (me.alive && sp.alive && sp.hp !== me.hp) { me.hp = sp.hp; updateHealthUI(); }
          if (sp.g !== me.grenades) { me.grenades = sp.g; updateGrenadeHUD(); }
          me.prot = sp.prot;
          $('spawn-protect').classList.toggle('hidden', !sp.prot || !me.alive);
          continue;
        }
        let rp = remotePlayers[id];
        if (!rp) { addRemotePlayer(sp); rp = remotePlayers[id]; if (!rp) continue; }
        if (sp.alive && !rp.alive) rp.snaps.length = 0;
        rp.alive = sp.alive; rp.prot = sp.prot; rp.team = sp.team;
        if (sp.weapon) setRemoteWeapon(rp, sp.weapon);
        rp.snaps.push({ t: s.t || Date.now(), x: sp.x, y: sp.y, z: sp.z, rotY: sp.rotY, rotX: sp.rotX });
        if (rp.snaps.length > 30) rp.snaps.splice(0, rp.snaps.length - 30);
      }
      for (const gid in s.grenades) {
        if (!grenades[gid]) spawnGrenade(Object.assign({ vx: 0, vy: 0, vz: 0 }, s.grenades[gid]));
        grenades[gid].server = s.grenades[gid];
      }
      updateHUDFromState(s);
      if (rsMode && isAdmin()) renderAdminPlayers(s.players);
    });

    socket.on('player:shot-fired', d => {
      const rp = remotePlayers[d.shooterId];
      if (!rp || !rp.alive) return;
      const w = WEAPONS[d.weapon] || WEAPONS.rifle;
      const from = rp.gunPivot.getWorldPosition(new THREE.Vector3());
      if (typeof d.ex === 'number') tracer(from, new THREE.Vector3(d.ex, d.ey, d.ez), w.tracerColor);
      playSoundAt(d.weapon, from.x, from.y, from.z, 0.8);
    });

    socket.on('player:hit', d => {
      if (d.shooterId === me.id && d.targetId !== me.id) showDamageNumber(d.targetId, d.damage, d.headshot, d.hp <= 0);
      if (d.targetId === me.id) {
        me.hp = Math.max(0, d.hp);
        updateHealthUI();
        triggerDamageFlash(d.fx, d.fz);
        playSound('hurt', 0.7);
      }
    });

    socket.on('player:killed', d => {
      const kn = escapeHtml(d.killerNickname), tn = escapeHtml(d.targetNickname);
      const mine = d.killerId === me.id || d.targetId === me.id;
      if (d.killerId === d.targetId || d.killerId === 'void') addFeed(`${weaponLabel(d.weapon)} <span>${tn}</span> ${d.weapon === 'void' ? 'cayó al vacío' : 'se autodestruyó'}`, mine ? 'mine' : '');
      else addFeed(`<span>${kn}</span> ${weaponLabel(d.weapon)}${d.headshot ? ' 🎯' : ''} <span>${tn}</span>`, mine ? 'mine' : '');

      const rp = remotePlayers[d.targetId];
      if (rp) { rp.alive = false; shellBurst(rp.root.position.clone(), rp.egg.material.color.getHex()); playSoundAt('cluck', rp.root.position.x, rp.root.position.y, rp.root.position.z, 0.6); }
      if (d.targetId === me.id) {
        me.alive = false; me.hp = 0; updateHealthUI();
        isMouseDown = false; isAiming = false; cancelReload();
        shellBurst(new THREE.Vector3(st.x, st.y, st.z), 0xfff6e0);
        deathCam = { t: 0, killerId: d.killerId };
        respawnReadyAt = performance.now() + (d.respawnIn || 3000);
        respawnRequested = false;
        $('rs-killed').innerHTML = d.killerId === me.id || d.killerId === 'void'
          ? (d.weapon === 'void' ? '🌌 Te caíste al vacío' : '💣 Te has eliminado a ti mismo')
          : `Te ha roto el cascarón <b>${kn}</b> ${weaponLabel(d.weapon)}${d.headshot ? ' · ¡HEADSHOT!' : ''}`;
        // Tras ver al asesino un momento, se libera el ratón para elegir arma y pulsar JUGAR
        setTimeout(() => {
          if (!inGame || me.alive || roundState !== 'playing') return;
          if (document.pointerLockElement) document.exitPointerLock(); else showRespawnScreen('dead');
        }, 1300);
      }
      if (d.killerId === me.id && d.targetId !== me.id) {
        trackKill(d);
        playSound('kill');
        showToast(d.headshot ? '🎯 ¡HEADSHOT!' : '💥 ¡BAJA!');
        const streaks = { 3: '🔥 ¡RACHA x3!', 5: '⚡ ¡IMPARABLE x5!', 8: '👑 ¡LEYENDA x8!', 12: '🐔 ¡GALLO SUPREMO x12!' };
        if (streaks[d.streak]) showBanner(`<div class="bb-title">${streaks[d.streak]}</div>`, 'streak', 2000);
      }
    });

    socket.on('player:respawn', d => {
      if (d.id === me.id) {
        st = Phys.newState(d.x, d.y, d.z);
        yaw = d.rotY || 0; pitch = 0;
        me.alive = true; me.hp = 100; deathCam = null;
        respawnRequested = false;
        hideRespawnScreen();
        if (!isPointerLocked) lockPointer();
        setTimeout(() => { if (inGame && me.alive && !isPointerLocked && !rsMode) showRespawnScreen('pause'); }, 600);
        Object.keys(ammo).forEach(k => { ammo[k] = WEAPONS[k].maxAmmo; });
        cancelReload(); reloadHint.classList.add('hidden');   // morir recargando no bloquea el arma al reaparecer
        $('grenade-charge').classList.add('hidden'); throwAnimT = 0;
        spawnedAt = performance.now(); firedSinceSpawn = false; burstLeft = 0; grenadeCharge = null;
        if (pendingPrimary) { primaryWeapon = pendingPrimary; pendingPrimary = null; }
        currentWeapon = primaryWeapon;
        equipWeapon(primaryWeapon, true);
        updateAmmoHUD(); updateHealthUI();
      } else if (remotePlayers[d.id]) {
        const rp = remotePlayers[d.id];
        rp.snaps.length = 0; rp.alive = true;
        rp.root.position.set(d.x, d.y, d.z); rp.lastPos.set(d.x, d.y, d.z);
      }
    });

    socket.on('grenade:spawn', d => spawnGrenade(d));
    socket.on('pickup:taken', d => {
      const pk = mapData && mapData.healthPacks[d.id];
      if (lastState && lastState.packs) lastState.packs = lastState.packs.substring(0, d.id) + '0' + lastState.packs.substring(d.id + 1);
      if (d.playerId === me.id) {
        me.hp = d.hp; updateHealthUI();
        playSound('pickup');
        showHealPopup(d.amount);
      } else if (pk) playSoundAt('pickup', pk.x, pk.y, pk.z, 0.5);
    });
    socket.on('pickup:grenade', d => {
      const gp = mapData && mapData.grenadePacks[d.id];
      if (lastState && lastState.gpacks) lastState.gpacks = lastState.gpacks.substring(0, d.id) + '0' + lastState.gpacks.substring(d.id + 1);
      if (d.playerId === me.id) {
        me.grenades = d.g; updateGrenadeHUD();
        playSound('pickup');
        showToast('💣 +1 granada (' + d.g + '/' + RULES.GRENADE_MAX + ')');
      } else if (gp) playSoundAt('pickup', gp.x, gp.y, gp.z, 0.5);
    });
    socket.on('you:correct', d => {
      // El servidor rechazó nuestra posición (atravesar pared / teletransporte): volver a la última válida
      st.x = d.x; st.y = d.y; st.z = d.z; st.vx = st.vy = st.vz = 0;
    });
    socket.on('rocket:fired', d => {
      let from;
      if (d.shooterId === me.id) from = lastRocketMuzzle || new THREE.Vector3(d.ox, d.oy, d.oz);
      else {
        const rp = remotePlayers[d.shooterId];
        from = rp ? rp.gunPivot.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(d.ox, d.oy, d.oz);
        playSoundAt('rpegg', from.x, from.y, from.z, 0.9);
      }
      spawnRocket(d.id, from, new THREE.Vector3(d.ix, d.iy, d.iz), d.ms);
    });
    socket.on('player:team-changed', d => {
      const tn = d.team === 'red' ? 'Rojo' : 'Azul';
      addFeed(`⇄ <span>${escapeHtml(d.nickname)}</span> ${d.byAdmin ? 'ha sido movido' : 'se pasa'} al equipo <b class="${d.team}">${tn}</b>`, d.id === me.id ? 'mine' : 'notice');
      if (d.id === me.id) {
        me.team = d.team;
        // Los colores de nombres (aliados/enemigos) dependen de mi equipo: rehacer a todos
        Object.keys(remotePlayers).forEach(id => rebuildRemote(id));
        updateTeamUI();
        if (typeof updateHealthUI === 'function') updateHealthUI();
        showBanner(`<div class="bb-title">EQUIPO ${tn.toUpperCase()}</div>`, 'intro', 1600);
      } else if (remotePlayers[d.id]) {
        remotePlayers[d.id].team = d.team;
        rebuildRemote(d.id);
      }
      adminPlayersSig = '';
    });
    socket.on('player:melee', d => {
      if (d.id === me.id) return;
      const rp = remotePlayers[d.id];
      if (rp) playSoundAt('melee', rp.root.position.x, rp.root.position.y, rp.root.position.z, 0.7);
    });
    socket.on('grenade:explode', d => {
      removeGrenade(d.id);
      removeRocket(d.id);
      explosionFx(d.x, d.y, d.z);
      playSoundAt('explosion', d.x, d.y, d.z, 1.2);
    });

    socket.on('player:chat', d => {
      addChat(d.nickname, d.message, d.team);
      const rp = remotePlayers[d.id];
      if (rp) {
        if (rp.bubble) { rp.root.remove(rp.bubble.sprite); disposeTree(rp.bubble.sprite); }
        const sprite = makeLabelSprite('💬 ' + d.message.substring(0, 18), '#2c3e50', 1.2);
        sprite.position.y = 2.75;
        rp.root.add(sprite);
        rp.bubble = { sprite, until: clock.elapsedTime + 4 };
      }
    });
    socket.on('player:emote', d => {
      if (d.id === me.id) { showToast('🐔 ¡Cluck!'); playSound('cluck'); return; }
      const rp = remotePlayers[d.id];
      if (rp) { rp.emote = { t: 0 }; playSoundAt('cluck', rp.root.position.x, rp.root.position.y, rp.root.position.z); }
    });

    socket.on('kotc:captured', d => {
      const ours = d.team === me.team;
      playSound(ours ? 'capture' : 'alarm');
      showBanner(`<div class="bb-title ${d.team}">🐔 ¡${d.team === 'red' ? 'ROJO' : 'AZUL'} CAPTURA EL GALLINERO!</div><div class="bb-sub">El gallinero se mueve a otro sitio…</div>`, 'cap', 2500);
    });
    socket.on('cts:event', d => {
      const tn = d.team === 'red' ? 'Rojo' : 'Azul';
      if (d.type === 'taken') { addFeed(`🍳 <span>${escapeHtml(d.nickname)}</span> cogió la espátula`, 'notice'); playSound(d.carrier === me.id ? 'pickup' : 'alarm', 0.8); if (d.carrier === me.id) showBanner('<div class="bb-title">🍳 ¡TIENES LA ESPÁTULA!</div><div class="bb-sub">Llévala a tu base</div>', 'cap', 2200); }
      else if (d.type === 'dropped') addFeed(`🍳 <span>${escapeHtml(d.nickname)}</span> soltó la espátula`, 'notice');
      else if (d.type === 'returned') addFeed('🍳 La espátula volvió al centro', 'notice');
      else if (d.type === 'captured') {
        if (d.id === me.id) progress('spatula', 1);
        playSound(d.team === me.team ? 'capture' : 'alarm');
        showBanner(`<div class="bb-title ${d.team}">🍳 ¡PUNTO PARA EL EQUIPO ${tn.toUpperCase()}!</div><div class="bb-sub">${escapeHtml(d.nickname)} entregó la espátula</div>`, 'cap', 2500);
      }
    });

    socket.on('game:over', d => {
      roundState = 'ended';
      isMouseDown = false;
      const won = d.winnerTeam ? d.winnerTeam === me.team : d.standings[0] && d.standings[0].id === me.id;
      setText($('gameover-title'), won ? '🏆 ¡VICTORIA!' : '¡RONDA FINALIZADA!');
      $('gameover-text').textContent = d.reason;
      $('gameover-standings').innerHTML = d.standings.slice(0, 8).map((p, i) =>
        `<tr class="${p.id === me.id ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${escapeHtml(p.nickname)}</td><td>${p.team ? `<span class="tag ${p.team}">${p.team === 'red' ? 'Rojo' : 'Azul'}</span>` : ''}</td><td>${p.score} pts</td><td>${p.kills}/${p.deaths}</td></tr>`).join('');
      roundHold = !!d.hold;
      if (d.adminId !== undefined) setAdmin(d.adminId);
      $('next-round-line').innerHTML = d.hold
        ? (isAdmin() ? 'Has terminado la ronda: cambia el mapa o empieza otra cuando quieras.' : 'Esperando a que el admin empiece otra ronda…')
        : 'Siguiente ronda en <strong id="next-round-count">9</strong>…';
      $('go-admin').classList.toggle('hidden', !isAdmin());
      gameoverOverlay.classList.remove('hidden');
      hideRespawnScreen();
      updatePausedBanner();
      if (isAdmin() && document.pointerLockElement) { suppressPauseScreen = true; document.exitPointerLock(); }
      progress('play', 1);
      if (won) progress('wins', 1);
      playSound(won ? 'capture' : 'alarm');
      let left = Math.round((d.nextIn || 9000) / 1000);
      clearInterval(gameoverOverlay._iv);
      if (!d.hold) {
        setText($('next-round-count'), left);
        gameoverOverlay._iv = setInterval(() => { left--; const c = $('next-round-count'); if (c) setText(c, Math.max(0, left)); if (left <= 0) clearInterval(gameoverOverlay._iv); }, 1000);
      }
    });

    socket.on('round:start', d => {
      roundState = 'playing';
      gameoverOverlay.classList.add('hidden');
      hideRespawnScreen();
      if (!isPointerLocked) lockPointer();
      setTimeout(() => { if (inGame && !isPointerLocked && !rsMode) showRespawnScreen('pause'); }, 600);
      roundHold = false;
      if (d.adminId !== undefined) setAdmin(d.adminId);
      let changed = false;
      if (d.config) {
        changed = d.config.map !== cfg.map || d.config.mode !== cfg.mode;
        if (changed) applyConfig(d.config); else cfg = Object.assign(cfg, d.config);
        if (changed) showBanner(`<div class="bb-title">${escapeHtml(mapData.name)}</div><div class="bb-sub">${escapeHtml(MODES[cfg.mode].name)}</div><div class="bb-desc">${escapeHtml(MODES[cfg.mode].desc)}</div>`, 'intro', 3500);
      }
      $('create-room-modal').classList.add('hidden');
      clearInterval(gameoverOverlay._iv);
      updatePausedBanner();
      const mine = d.players[me.id];
      if (mine && 'team' in mine) me.team = mine.team;
      for (const id in d.players) if (remotePlayers[id] && 'team' in d.players[id]) remotePlayers[id].team = d.players[id].team;
      if (mine) { st = Phys.newState(mine.x, mine.y, mine.z); yaw = mine.rotY || 0; pitch = 0; }
      me.alive = true; me.hp = 100; me.kills = me.deaths = me.score = 0; deathCam = null;
      Object.keys(ammo).forEach(k => { ammo[k] = WEAPONS[k].maxAmmo; });
      cancelReload(); reloadHint.classList.add('hidden'); grenadeCharge = null; $('grenade-charge').classList.add('hidden');
      spawnedAt = performance.now(); firedSinceSpawn = false;
      updateAmmoHUD(); updateHealthUI();
      for (const id in remotePlayers) { remotePlayers[id].snaps.length = 0; remotePlayers[id].alive = true; }
      Object.keys(grenades).forEach(removeGrenade);
      if (!changed) showBanner('<div class="bb-title">¡NUEVA RONDA!</div>', 'intro', 1800);
      refreshAdminUI();
    });

    // ---- Admin de la sala ----
    socket.on('room:paused', d => {
      roundState = d.paused ? 'paused' : 'playing';
      if (d.paused) { isMouseDown = false; isAiming = false; }
      addFeed(d.paused ? `⏸ <span>${escapeHtml(d.by || 'El admin')}</span> pausó la partida` : `▶ <span>${escapeHtml(d.by || 'El admin')}</span> reanudó la partida`, 'notice');
      playSound(d.paused ? 'alarm' : 'capture', 0.5);
      updatePausedBanner();
      refreshAdminUI();
    });
    socket.on('room:admin-result', d => {
      if (d.error) { addFeed('⚠️ ' + escapeHtml(d.error), 'notice'); lobbyToast('⚠️ ' + d.error); }
      else if (d.ok) addFeed('👑 ' + escapeHtml(d.ok), 'notice');
    });
    socket.on('room:kicked', d => {
      if (inGame) exitToLobby();
      lobbyToast('🚪 ' + ((d && d.message) || 'Te han expulsado de la sala'));
    });
  }

  // ===========================================================================
  // CUENTA, AMIGOS E INVENTARIO
  // ===========================================================================
  const Cos = window.Cosmetics;
  let account = null;                       // perfil devuelto por el servidor
  let custom = Cos.sanitize(store.get('custom', null) || {});
  let profileSaveTimer = null;
  let friendsData = { friends: [], requests: [], sent: [] };
  let ipNeedsName = false;

  function saveProfileSoon() {
    store.set('custom', custom);
    if (!account || !socket) return;
    clearTimeout(profileSaveTimer);
    profileSaveTimer = setTimeout(() => {
      socket.emit('profile:save', { custom, eggs, challenges });
      const si = $('saved-ind');
      if (si) { si.classList.remove('flash'); void si.offsetWidth; si.classList.add('flash'); }
    }, 500);
    renderOutfitChips();
  }

  // ---- Pantalla de acceso ----
  function showAuth(tab) {
    $('auth-screen').classList.remove('hidden');
    if (OFFLINE) tab = 'ip';   // sin conexión: sólo el nombre
    switchAuthTab(tab || 'login');
  }
  function hideAuth() { $('auth-screen').classList.add('hidden'); $('auth-error').classList.add('hidden'); }
  function authError(msg) { const e = $('auth-error'); e.textContent = msg; e.classList.remove('hidden'); }
  function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.toggle('active', b.dataset.auth === tab));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('hidden', f.dataset.form !== tab));
    $('auth-error').classList.add('hidden');
    const first = document.querySelector(`.auth-form[data-form="${tab}"] input:not(.hidden)`);
    if (first) setTimeout(() => first.focus(), 30);
  }
  function initAuth() {
    document.querySelectorAll('.auth-tabs button').forEach(b => b.addEventListener('click', () => switchAuthTab(b.dataset.auth)));
    document.querySelectorAll('.auth-form').forEach(f => f.addEventListener('submit', e => {
      e.preventDefault();
      if (!socket || !socket.connected) { authError('No hay conexión con el servidor'); return; }
      const t = f.dataset.form;
      if (t === 'login') {
        const u = $('login-user').value.trim(), p = $('login-pass').value;
        if (!u || !p) { authError('Escribe usuario y contraseña'); return; }
        socket.emit('auth:login', { username: u, password: p });
      } else if (t === 'register') {
        const u = $('reg-user').value.trim(), p = $('reg-pass').value, p2 = $('reg-pass2').value;
        if (p !== p2) { authError('Las contraseñas no coinciden'); return; }
        socket.emit('auth:register', { username: u, password: p });
      } else {
        socket.emit('auth:ip', ipNeedsName ? { name: $('ip-name').value.trim() } : {});
      }
    }));
    $('btn-pw').addEventListener('click', () => {
      const next = $('pw-new').value;
      if (next.length < 4) { setText($('pw-hint'), 'La nueva contraseña debe tener al menos 4 caracteres'); return; }
      socket.emit('auth:setPassword', { current: $('pw-current').value, next });
    });
    $('btn-logout').addEventListener('click', () => {
      if (!window.confirm('¿Cerrar sesión?')) return;
      socket.emit('auth:logout', { token: store.get('token', null) });
      store.set('token', null);
      account = null;
      if (inGame) exitToLobby();
      updateAccountCard();
      showAuth('login');
    });
  }
  function onAuthOk(d) {
    store.set('token', d.token);
    account = d.profile;
    custom = Cos.sanitize(account.custom);
    store.set('custom', custom);
    eggs = account.eggs || 0;
    if (account.challenges) loadChallenges(account.challenges); else loadChallenges();
    if (OFFLINE) setupOfflineUI();   // sin conexión el formulario siempre pide el nombre
    else {
      ipNeedsName = false;
      $('ip-name').classList.add('hidden');
      $('btn-ip').textContent = 'ENTRAR CON MI IP';
    }
    hideAuth();
    updateAccountCard();
    loadPaintFromCustom();
    renderInventory();
    updatePreviewAvatar();
    renderChallenges(); updateEggCounter(); renderProfile();
    lobbyToast(`¡Hola, ${account.username}! 🥚`);
  }
  function updateAccountCard() {
    setText($('acc-name'), account ? account.username : '—');
    setText($('acc-type'), account ? (account.type === 'ip' ? 'Cuenta de este equipo' : 'Cuenta con contraseña') : 'Sin sesión');
    drawAccountEgg();
  }
  function drawAccountEgg() { drawEggIcon($('acc-egg')); }
  function drawEggIcon(cv) {
    if (!cv) return;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const pat = document.createElement('canvas'); pat.width = 64; pat.height = 64;
    window.EggModel.drawPattern(pat.getContext('2d'), 64, 64, custom);
    if (custom.paint) { /* la capa pintada se ve en 3D; aquí basta con el diseño */ }
    g.save();
    const k = cv.width / 44;
    g.scale(k, k);
    g.beginPath(); g.ellipse(22, 30, 17, 23, 0, 0, Math.PI * 2); g.clip();
    g.drawImage(pat, 2, 4, 42, 50);
    const sh = g.createRadialGradient(15, 20, 2, 22, 30, 26); sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = sh; g.fillRect(0, 0, 44, 56);
    g.restore();
    g.save(); g.scale(k, k);
    g.fillStyle = '#fff'; [[16, 26], [28, 26]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); });
    g.fillStyle = custom.eyeColor || '#151515'; [[16, 26], [28, 26]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y + 0.5, 2, 0, 7); g.fill(); });
    g.restore();
  }

  // ---- Amigos ----
  function renderFriends() {
    const d = friendsData;
    const badge = $('friends-badge');
    badge.textContent = d.requests.length;
    badge.classList.toggle('hidden', !d.requests.length);
    setText($('friends-online'), `${d.friends.filter(f => f.online).length} en línea`);
    $('friend-requests').innerHTML = (d.requests.length ? `<div class="fr-title">Solicitudes recibidas</div>` : '') +
      d.requests.map(n => `<div class="friend-row request"><span class="f-name">${escapeHtml(n)}</span><span class="f-actions"><button class="btn-orange small" data-accept="${escapeHtml(n)}">Aceptar</button><button class="btn-ghost small" data-decline="${escapeHtml(n)}">✖</button></span></div>`).join('') +
      (d.sent.length ? `<div class="fr-title">Enviadas</div>` + d.sent.map(n => `<div class="friend-row sent"><span class="f-name">${escapeHtml(n)}</span><span class="f-status">pendiente…</span></div>`).join('') : '');
    $('friend-list').innerHTML = d.friends.length ? d.friends.map(f => {
      const status = !f.online ? 'Desconectado' : f.room ? `Jugando en <b>${escapeHtml(f.room.roomName)}</b> · ${escapeHtml(f.room.mapName)} (${f.room.players}/${f.room.max})` : 'En el menú';
      const join = f.online && f.room && f.room.players < f.room.max ? `<button class="btn-orange small" data-joinroom="${escapeHtml(f.room.roomId)}">Unirse</button>` : '';
      return `<div class="friend-row${f.online ? ' online' : ''}"><span class="f-dot"></span><span class="f-main"><span class="f-name">${escapeHtml(f.username)}</span><small class="f-status">${status}</small></span><span class="f-actions">${join}<button class="btn-ghost small" data-unfriend="${escapeHtml(f.username)}" title="Quitar amigo">✖</button></span></div>`;
    }).join('') : '<p class="hint">Aún no tienes amigos. Escribe su nombre de usuario arriba y pulsa AÑADIR.</p>';
    renderInviteList();
  }
  function renderInviteList() {
    const el = $('rs-invite'); if (!el) return;
    const cands = friendsData.friends.filter(f => f.online && (!f.room || f.room.roomId !== cfg.roomId));
    el.innerHTML = cands.length ? `<div class="fr-title">Invitar a amigos</div>` + cands.map(f => `<div class="friend-row online"><span class="f-dot"></span><span class="f-name">${escapeHtml(f.username)}</span><button class="btn-orange small" data-invite="${escapeHtml(f.username)}">Invitar</button></div>`).join('') : '';
  }
  function initFriends() {
    const add = () => {
      const n = $('friend-input').value.trim();
      if (!n) return;
      socket.emit('friends:request', { username: n });
      $('friend-input').value = '';
    };
    $('btn-friend-add').addEventListener('click', add);
    $('friend-input').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    $('panel-friends').addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.accept) socket.emit('friends:respond', { username: t.dataset.accept, accept: true });
      else if (t.dataset.decline) socket.emit('friends:respond', { username: t.dataset.decline, accept: false });
      else if (t.dataset.unfriend && window.confirm(`¿Quitar a ${t.dataset.unfriend} de tus amigos?`)) socket.emit('friends:remove', { username: t.dataset.unfriend });
      else if (t.dataset.joinroom) joinGame({ roomId: t.dataset.joinroom });
    });
    $('rs-invite').addEventListener('click', e => {
      const t = e.target.closest('[data-invite]');
      if (t) { socket.emit('friends:invite', { username: t.dataset.invite }); t.disabled = true; t.textContent = 'Enviada'; }
    });
    let pendingInvite = null;
    window.__showInvite = d => {
      pendingInvite = d;
      $('invite-msg').innerHTML = `🤝 <b>${escapeHtml(d.from)}</b> te invita a <b>${escapeHtml(d.roomName)}</b><br><small>${escapeHtml(d.mapName)} · ${escapeHtml(d.modeName)} · ${d.players}/${d.max}${inGame && isPointerLocked ? ' — pulsa Esc para poder hacer clic' : ''}</small>`;
      $('invite-toast').classList.remove('hidden');
      playSound('pickup', 0.6);
      clearTimeout(window.__inviteT);
      window.__inviteT = setTimeout(() => $('invite-toast').classList.add('hidden'), 20000);
    };
    $('invite-accept').addEventListener('click', () => {
      $('invite-toast').classList.add('hidden');
      if (pendingInvite) { joining = false; joinGame({ roomId: pendingInvite.roomId }); }
    });
    $('invite-ignore').addEventListener('click', () => $('invite-toast').classList.add('hidden'));
  }

  // ---- Inventario ----
  let invTab = 'color';
  // Historial para deshacer cambios del huevo
  const customHistory = [];
  function pushCustomHistory() {
    customHistory.push(JSON.stringify(custom));
    if (customHistory.length > 30) customHistory.shift();
    const u = $('btn-undo-egg'); if (u) u.disabled = false;
  }
  // Estilos completos de un clic (combinaciones originales)
  const EGG_PRESETS = [
    { name: 'Clásico', icon: '🥚', c: { color: '#fff1dc', color2: '#ff9a4d', finish: 'satin', pattern: 'none', eyes: 'normal', mouth: 'smile', hat: 'none', glasses: 'none', extra: 'none', eyeColor: '#151515' } },
    { name: 'Vaquero', icon: '🤠', c: { color: '#e9b97a', color2: '#9c6b43', finish: 'matte', pattern: 'spots', eyes: 'happy', mouth: 'mustache', hat: 'cowboy', glasses: 'none', extra: 'scarf' } },
    { name: 'Mago', icon: '🧙', c: { color: '#c77dff', color2: '#ffd84d', finish: 'gloss', pattern: 'stars', eyes: 'sleepy', mouth: 'smile', hat: 'wizard', glasses: 'round', extra: 'cape' } },
    { name: 'Astronauta', icon: '🚀', c: { color: '#ffffff', color2: '#4fc3f7', finish: 'metal', pattern: 'none', eyes: 'big', mouth: 'open', hat: 'helmet', glasses: 'visor', extra: 'jetpack' } },
    { name: 'Rey', icon: '👑', c: { color: '#ffd84d', color2: '#ff6b5f', finish: 'gloss', pattern: 'checker', eyes: 'normal', mouth: 'grin', hat: 'crown', glasses: 'monocle', extra: 'cape' } },
    { name: 'Ninja', icon: '🥷', c: { color: '#2b2b33', color2: '#ff6b5f', finish: 'matte', pattern: 'none', eyes: 'angry', mouth: 'none', hat: 'headband', glasses: 'mask', extra: 'scarf' } },
    { name: 'Tigre', icon: '🐯', c: { color: '#ff9a4d', color2: '#2b2b33', finish: 'satin', pattern: 'tiger', eyes: 'angry', mouth: 'grin', hat: 'cat', glasses: 'none', extra: 'none' } },
    { name: 'Galaxia', icon: '🌌', c: { color: '#6c8cff', color2: '#c77dff', finish: 'neon', pattern: 'galaxy', eyes: 'cyclops', mouth: 'open', hat: 'antenna', glasses: 'none', extra: 'wings' } },
    { name: 'Fiesta', icon: '🎉', c: { color: '#ff7fb5', color2: '#ffd84d', finish: 'toon', pattern: 'dots', eyes: 'wink', mouth: 'tongue', hat: 'party', glasses: 'hearts', extra: 'balloon' } },
    { name: 'Soldado', icon: '🪖', c: { color: '#7bd35a', color2: '#5b5b66', finish: 'matte', pattern: 'camo', eyes: 'angry', mouth: 'none', hat: 'helmet', glasses: 'goggles', extra: 'backpack' } },
  ];
  function applyPreset(i) {
    const p = EGG_PRESETS[i];
    if (!p) return;
    pushCustomHistory();
    Object.assign(custom, Cos.DEFAULT, p.c, { paint: custom.paint });
    Object.assign(custom, Cos.sanitize(custom));
    afterCustomChange();
    playSound('switch');
    showToast(`${p.icon} ${p.name}`);
  }
  function afterCustomChange() {
    renderInventory();
    updatePreviewAvatar();
    drawAccountEgg();
    saveProfileSoon();
  }
  function setCustom(k, v) {
    if (custom[k] !== v) pushCustomHistory();
    custom[k] = v;
    renderInventory();
    updatePreviewAvatar();
    drawAccountEgg();
    saveProfileSoon();
  }
  function renderInventory() {
    document.querySelectorAll('#inv-tabs button').forEach(b => b.classList.toggle('active', b.dataset.inv === invTab));
    const grid = !['color', 'paint'].includes(invTab);
    document.querySelectorAll('.inv-pane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== (grid ? 'grid' : invTab)));
    const sw = (id, key) => {
      $(id).innerHTML = Cos.PALETTE.map(c => `<button class="swatch${custom[key] === c ? ' active' : ''}" data-color="${c}" data-key="${key}" style="background:${c}" title="${c}"></button>`).join('');
    };
    sw('swatches-1', 'color'); sw('swatches-2', 'color2');
    colorPicker.value = custom.color; color2Picker.value = custom.color2;
    $('finish-grid').innerHTML = Cos.CATALOG.finish.map(o => `<button class="item${custom.finish === o.id ? ' active' : ''}" data-finish="${o.id}"><img class="it-thumb" data-thumb="finish:${o.id}" alt=""><span class="it-name">${escapeHtml(o.name)}</span></button>`).join('');
    $('grid-extra').innerHTML = invTab === 'eyes'
      ? `<label class="inv-label">Color de ojos</label><div class="swatches eye-swatches">${Cos.EYE_COLORS.map(c => `<button class="swatch${custom.eyeColor === c ? ' active' : ''}" data-color="${c}" data-key="eyeColor" style="background:${c}"></button>`).join('')}</div><label class="inv-label">Forma</label>`
      : '';
    if (grid) {
      $('item-grid').innerHTML = Cos.CATALOG[invTab].map(o => {
        const preview = invTab === 'pattern' ? `<canvas width="72" height="40" data-pat="${o.id}"></canvas>` : `<img class="it-thumb" data-thumb="${invTab}:${o.id}" alt="">`;
        return `<button class="item${custom[invTab] === o.id ? ' active' : ''}" data-item="${o.id}" title="${escapeHtml(o.name)}">${preview}<span class="it-name">${escapeHtml(o.name)}</span></button>`;
      }).join('');
      if (invTab === 'pattern') document.querySelectorAll('#item-grid canvas[data-pat]').forEach(cv => {
        window.EggModel.drawPattern(cv.getContext('2d'), 72, 40, Object.assign({}, custom, { pattern: cv.dataset.pat }));
      });
    }
    queueThumbs();
    if (invTab === 'paint') updatePainterBackground();
    const labels = { color: 'Color y acabado', pattern: 'Diseño', eyes: 'Ojos', mouth: 'Boca', hat: 'Gorro', glasses: 'Gafas', extra: 'Extra', paint: 'Pintura libre' };
    const cur = grid ? (Cos.CATALOG[invTab].find(o => o.id === custom[invTab]) || {}).name : invTab === 'color' ? (Cos.CATALOG.finish.find(o => o.id === custom.finish) || {}).name : (custom.paint ? 'con dibujo' : 'sin dibujo');
    $('inv-current').innerHTML = `<b>${labels[invTab]}</b><span>${escapeHtml(cur || '')}</span>`;
    previewFocus = ['eyes', 'mouth', 'glasses', 'hat'].includes(invTab) && menuOverlay.dataset.panel === 'inventory' ? 'head' : 'body';
  }

  // Etiquetas con lo que lleva puesto el huevo (clic = ir a esa categoría del taller)
  function renderOutfitChips() {
    const el = $('outfit-chips'); if (!el) return;
    const parts = [];
    ['hat', 'glasses', 'extra', 'pattern'].forEach(k => {
      if (custom[k] && custom[k] !== 'none') { const o = Cos.CATALOG[k].find(x => x.id === custom[k]); if (o) parts.push([k, o.icon, o.name]); }
    });
    const fin = Cos.CATALOG.finish.find(x => x.id === custom.finish);
    if (fin) parts.unshift(['color', '✨', fin.name]);
    el.innerHTML = parts.map(([k, ic, n]) => `<button class="chip" data-chip="${k}">${ic} ${escapeHtml(n)}</button>`).join('');
  }
  // Miniaturas 3D de cada objeto, renderizadas con el huevo del jugador
  const thumbCache = {};
  let thumbR = null, thumbScene = null, thumbCam = null, thumbQueue = [], thumbBusy = false;
  function thumbKey(cat, id) { return `${cat}:${id}:${custom.color}:${custom.color2}:${custom.eyeColor}:${cat === 'finish' ? custom.pattern : ''}`; }
  function renderThumb(cat, id) {
    if (!thumbR) {
      try { thumbR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
      thumbR.setSize(96, 96);
      thumbScene = new THREE.Scene();
      thumbScene.add(new THREE.HemisphereLight(0xfff0e0, 0x403830, 0.9));
      const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(2, 4, 5); thumbScene.add(dl);
      thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    }
    // Sólo el objeto a mostrar sobre un huevo "limpio" (el resto en su valor por defecto)
    const base = { color: custom.color, color2: custom.color2, eyeColor: custom.eyeColor, finish: custom.finish, pattern: custom.pattern, eyes: 'normal', mouth: 'smile', hat: 'none', glasses: 'none', extra: 'none' };
    if (cat !== 'finish') { base.pattern = 'none'; }
    base[cat] = id;
    const m = window.EggModel.create(base, { weapon: null });
    m.update(1.3);
    thumbScene.add(m.root);
    const head = cat === 'eyes' || cat === 'mouth' || cat === 'glasses';
    const hat = cat === 'hat';
    if (head) { thumbCam.position.set(0.55, 1.2, -1.45); thumbCam.lookAt(0, 1.12, 0); }
    else if (hat) { thumbCam.position.set(0.9, 1.75, -2.0); thumbCam.lookAt(0, 1.35, 0); }
    else if (cat === 'extra') { thumbCam.position.set(1.9, 1.5, -2.6); thumbCam.lookAt(0, 0.95, 0.1); }
    else { thumbCam.position.set(0.9, 1.2, -2.6); thumbCam.lookAt(0, 0.8, 0); }
    thumbR.render(thumbScene, thumbCam);
    const url = thumbR.domElement.toDataURL('image/png');
    thumbScene.remove(m.root);
    disposeTree(m.root);
    return url;
  }
  function queueThumbs() {
    document.querySelectorAll('#panel-inventory img[data-thumb]').forEach(img => {
      const [cat, id] = img.dataset.thumb.split(':');
      const k = thumbKey(cat, id);
      if (thumbCache[k]) { img.src = thumbCache[k]; return; }
      thumbQueue.push({ img, cat, id, k });
    });
    if (!thumbBusy) pumpThumbs();
  }
  function pumpThumbs() {
    thumbBusy = thumbQueue.length > 0;
    if (!thumbBusy) return;
    const t0 = performance.now();
    while (thumbQueue.length && performance.now() - t0 < 12) {
      const j = thumbQueue.shift();
      if (!j.img.isConnected) continue;
      if (!thumbCache[j.k]) thumbCache[j.k] = renderThumb(j.cat, j.id);
      if (thumbCache[j.k]) j.img.src = thumbCache[j.k];
    }
    requestAnimationFrame(pumpThumbs);
  }

  function initInventory() {
    $('egg-rot-l').addEventListener('click', () => { previewRot -= 0.9; });
    $('egg-rot-r').addEventListener('click', () => { previewRot += 0.9; });
    $('outfit-chips').addEventListener('click', e => { const c = e.target.closest('[data-chip]'); if (c) { invTab = c.dataset.chip; showPanel('inventory'); renderInventory(); } });
    renderOutfitChips();
    $('finish-grid').addEventListener('click', e => { const b = e.target.closest('[data-finish]'); if (b) { setCustom('finish', b.dataset.finish); playSound('click', 0.5); } });
    $('inv-tabs').addEventListener('click', e => { const b = e.target.closest('[data-inv]'); if (b) { invTab = b.dataset.inv; renderInventory(); playSound('click', 0.5); } });
    $('item-grid').addEventListener('click', e => { const b = e.target.closest('[data-item]'); if (b) { setCustom(invTab, b.dataset.item); playSound('click', 0.5); } });
    $('inv-body').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) setCustom(b.dataset.key, b.dataset.color); });
    let ct = null;
    [colorPicker, color2Picker].forEach(cp => cp.addEventListener('focus', () => pushCustomHistory()));
    colorPicker.addEventListener('input', () => { custom.color = colorPicker.value; clearTimeout(ct); ct = setTimeout(() => setCustom('color', colorPicker.value), 80); });
    color2Picker.addEventListener('input', () => { custom.color2 = color2Picker.value; clearTimeout(ct); ct = setTimeout(() => setCustom('color2', color2Picker.value), 80); });
    $('inv-presets').innerHTML = EGG_PRESETS.map((p, i) => `<button data-preset="${i}" title="${escapeHtml(p.name)}"><i>${p.icon}</i><span>${escapeHtml(p.name)}</span></button>`).join('');
    $('inv-presets').addEventListener('click', e => { const b = e.target.closest('[data-preset]'); if (b) applyPreset(+b.dataset.preset); });
    $('btn-undo-egg').addEventListener('click', () => {
      const prev = customHistory.pop();
      if (!prev) return;
      try { Object.assign(custom, Cos.sanitize(JSON.parse(prev))); } catch (e) { return; }
      $('btn-undo-egg').disabled = !customHistory.length;
      if (typeof loadPaintFromCustom === 'function') loadPaintFromCustom();
      afterCustomChange();
      playSound('click');
    });
    $('btn-reset-egg').addEventListener('click', () => {
      pushCustomHistory();
      Object.assign(custom, Cos.DEFAULT, { paint: null });
      if (textureCtx) textureCtx.clearRect(0, 0, 128, 128);
      afterCustomChange();
      showToast('⟲ Huevo básico (puedes deshacer con ↶)');
    });
    $('btn-random-egg').addEventListener('click', () => {
      pushCustomHistory();
      const pick = a => a[Math.floor(Math.random() * a.length)];
      ['finish', 'pattern', 'eyes', 'mouth', 'hat', 'glasses', 'extra'].forEach(k => { custom[k] = pick(Cos.CATALOG[k]).id; });
      custom.eyeColor = pick(Cos.EYE_COLORS);
      custom.color = pick(Cos.PALETTE); custom.color2 = pick(Cos.PALETTE);
      afterCustomChange();
      playSound('switch');
    });
    renderInventory();
  }

  // ===========================================================================
  // LOBBY: INICIO, PANELES, SALAS, CREAR PARTIDA
  // ===========================================================================
  let selectedRoomId = 'quick';
  let roomsCache = [];
  let pendingCode = null;
  let quickMode = store.get('quickMode', '');

  function showPanel(name) {
    document.querySelectorAll('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
    $('panel-challenges').classList.toggle('hidden', name !== 'home');
    menuOverlay.dataset.panel = name;
    setTimeout(resizePreview, 360);
    ['profile', 'inventory', 'rooms', 'friends'].forEach(p => $('panel-' + p).classList.toggle('hidden', p !== name));
    if (name === 'profile') { renderProfile(); if (socket && account) socket.emit('profile:get'); }
    if (name === 'inventory') renderInventory();
    if (name === 'friends') renderFriends();
    if (name === 'home') renderChallenges();
    if (name === 'rooms' && socket) socket.emit('rooms:get');
    playSound('click', 0.5);
  }

  function selectRoom(id) {
    selectedRoomId = id;
    const r = roomsCache.find(x => x.id === id);
    const thumb = $('selected-map-thumb');
    const top = r || roomsCache[0];
    if (r) {
      setText($('selected-room-name-label'), r.name);
      setText($('selected-room-meta'), `${r.mapName} · ${r.modeName} · ${r.playersCount}/${r.maxPlayers}`);
    } else {
      setText($('selected-room-name-label'), 'Partida rápida');
      setText($('selected-room-meta'), 'Te mete en la sala con más gente del modo elegido');
    }
    if (top) { window.MapRenderer.preview(top.map, thumb, { mode: top.mode }); if (!inGame) loadMap(top.map); }
    document.querySelectorAll('#rooms-list-body tr[data-room]').forEach(tr => tr.classList.toggle('selected', tr.dataset.room === id));
  }

  function renderRoomsList(rooms) {
    roomsCache = rooms || [];
    setText($('online-count'), roomsCache.reduce((a, r) => a + r.playersCount, 0));
    const tbody = $('rooms-list-body');
    let html = `<tr data-room="quick" class="quick-row"><td><strong>⚡ Partida rápida</strong><small>${quickMode ? escapeHtml(MODES[quickMode].name) : 'Cualquier modo'}</small></td><td>—</td><td>—</td><td>${roomsCache.reduce((a, r) => a + r.playersCount, 0)}</td><td><button class="room-join-btn" data-join="quick">ENTRAR</button></td></tr>`;
    if (!roomsCache.length) html += '<tr><td colspan="5" class="rooms-empty">No hay salas. ¡Crea la primera!</td></tr>';
    roomsCache.forEach(r => {
      const full = r.playersCount >= r.maxPlayers;
      const time = r.timeLimit ? `${r.timeLimit} min` : 'sin tiempo';
      html += `<tr data-room="${escapeHtml(r.id)}">
        <td><strong>${escapeHtml(r.name)}</strong><small>${r.code ? 'Código ' + escapeHtml(r.code) + ' · ' : ''}meta ${r.scoreLimit} · ${time}${r.state === 'ended' ? ' · entre rondas' : ''}</small></td>
        <td>${escapeHtml(r.mapName)}</td>
        <td><span class="room-badge-mode mode-${escapeHtml(r.mode)}">${escapeHtml((MODES[r.mode] || {}).short || r.mode)}</span></td>
        <td class="${full ? 'full' : 'ok'}">${r.playersCount}/${r.maxPlayers}</td>
        <td><button class="room-join-btn" data-join="${escapeHtml(r.id)}" ${full ? 'disabled' : ''}>${full ? 'LLENA' : 'ENTRAR'}</button></td>
      </tr>`;
    });
    tbody.innerHTML = html;
    if (selectedRoomId !== 'quick' && !roomsCache.some(r => r.id === selectedRoomId)) selectedRoomId = 'quick';
    selectRoom(selectedRoomId);
  }

  // ---- Selector de modo de la partida rápida ----
  function renderModeSelect() {
    const opts = [['', 'Cualquiera']].concat(Object.values(MODES).map(m => [m.id, m.name]));
    setText($('mode-select-label'), quickMode ? MODES[quickMode].name : 'Cualquiera');
    $('mode-dropdown').innerHTML = opts.map(([id, n]) => `<button data-mode="${id}" class="${id === quickMode ? 'active' : ''}">${escapeHtml(n)}</button>`).join('');
  }

  // ---- Modal de crear partida ----
  const createState = { map: 'castle', mode: 'ffa', sizeFilter: 'all', botDifficulty: 'normal', botsTouched: false };
  let createMode = 'create'; // 'create' (nueva sala) o 'admin' (cambiar la partida en curso)
  function buildCreateModal() {
    const grid = $('map-grid');
    grid.innerHTML = '';
    MapDefs.LIST.forEach(def => {
      const card = document.createElement('button');
      card.className = 'map-card';
      card.dataset.map = def.id; card.dataset.size = def.size;
      card.innerHTML = `<div class="map-card-img"><canvas width="336" height="208"></canvas>`
        + `<span class="map-badge size-${def.size}">${{ S: 'Arena', M: 'Mediano', L: 'Grande' }[def.size]}</span>`
        + `<span class="map-badge players">👥 ${def.players}</span><span class="map-check">✓</span></div>`
        + `<div class="map-card-name">${escapeHtml(def.name)}</div>`;
      card.title = def.desc;
      card.addEventListener('click', () => { createState.map = def.id; refreshCreate('map'); playSound('click'); });
      grid.appendChild(card);
    });
    const mg = $('mode-grid');
    mg.innerHTML = '';
    Object.values(MODES).forEach(m => {
      const b = document.createElement('button');
      b.className = 'mode-card'; b.dataset.mode = m.id;
      const ico = { ffa: '🥚', tdm: '⚔️', kotc: '👑', cts: '🍳' }[m.id] || '🎮';
      b.innerHTML = `<span class="mode-ico">${ico}</span><span class="mode-txt"><span class="mode-short">${m.short}</span><span class="mode-name">${escapeHtml(m.name)}</span></span>`;
      b.title = m.desc;
      b.addEventListener('click', () => { createState.mode = m.id; refreshCreate(true); playSound('click'); });
      mg.appendChild(b);
    });
    $('map-filter').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      createState.sizeFilter = b.dataset.size;
      $('map-filter').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      refreshCreate();
    }));
    $('create-room-time').innerHTML = TIME_LIMITS.map(t => `<option value="${t}" ${t === 10 ? 'selected' : ''}>${t ? t + ' min' : 'Sin límite'}</option>`).join('');
    ['create-room-max-players', 'create-room-limit', 'create-room-time', 'create-room-private'].forEach(id => $(id).addEventListener('change', () => refreshCreate()));
    // Bots: cuántos y dificultad
    $('create-room-bots').addEventListener('input', () => { createState.botsTouched = true; refreshCreate(); });
    $('create-room-botdiff').addEventListener('click', e => {
      const b = e.target.closest('[data-diff]'); if (!b) return;
      createState.botDifficulty = b.dataset.diff; refreshCreate(); playSound('click');
    });
    refreshCreate(true);
  }
  function refreshCreate(modeChanged) {
    const def = MapDefs.MAPS[createState.map];
    const mode = MODES[createState.mode];
    document.querySelectorAll('.map-card').forEach(c => {
      c.classList.toggle('active', c.dataset.map === createState.map);
      c.style.display = createState.sizeFilter === 'all' || c.dataset.size === createState.sizeFilter ? '' : 'none';
      window.MapRenderer.preview(c.dataset.map, c.querySelector('canvas'), { mode: createState.mode, inset: false });
    });
    document.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('active', c.dataset.mode === createState.mode));
    if (modeChanged === true) {
      $('create-room-limit').innerHTML = mode.limits.map(l => `<option value="${l}" ${l === mode.defLimit ? 'selected' : ''}>${l}</option>`).join('');
      setText($('create-room-limit-label'), mode.id === 'ffa' || mode.id === 'tdm' ? 'Bajas para ganar' : 'Capturas para ganar');
    }
    const mp = $('create-room-max-players');
    if (modeChanged === 'map' && !mp.dataset.touched) {
      const best = [2, 4, 6, 8, 12, 16, 18].filter(n => n <= def.players).pop() || 8;
      mp.value = String(Math.min(best, 12));
    }
    const lim = $('create-room-limit').value, tl = $('create-room-time').value;
    const big = $('create-preview');
    if (big && big.dataset.map !== createState.map + createState.mode) { big.dataset.map = createState.map + createState.mode; window.MapRenderer.preview(createState.map, big, { mode: createState.mode }); }
    setText($('create-hero-name'), def.name);
    setText($('create-hero-desc'), def.desc);
    // Bots: como mucho las plazas menos una (la tuya); sin conexión se proponen unos cuantos de entrada
    const maxP = parseInt(mp.value, 10) || 8, br = $('create-room-bots');
    br.max = String(Math.max(0, maxP - 1));
    if (!createState.botsTouched && window.EGG_OFFLINE) br.value = String(Math.min(maxP - 1, 7));
    if (+br.value > maxP - 1) br.value = String(maxP - 1);
    const nb = +br.value;
    setText($('create-room-bots-val'), nb ? `${nb} bot${nb > 1 ? 's' : ''}` : 'Sin bots');
    $('create-room-botdiff').querySelectorAll('button').forEach(b => { b.classList.toggle('active', b.dataset.diff === createState.botDifficulty); b.disabled = !nb; });
    const chip = t => `<span class="sum-chip">${t}</span>`;
    $('create-summary').innerHTML = chip(`🗺️ ${escapeHtml(def.name)}`) + chip(`🎮 ${escapeHtml(mode.short)}`) + chip(`👥 ${mp.value}`)
      + chip(`🎯 ${lim}`) + chip(`⏱️ ${tl === '0' ? '∞' : tl + ' min'}`)
      + (nb ? chip(`🤖 ${nb} · ${{ easy: 'fácil', normal: 'normal', hard: 'difícil' }[createState.botDifficulty]}`) : '')
      + ($('create-room-private').checked ? chip('🔒 privada') : '');
  }
  function openCreate(isPrivate) {
    createMode = 'create';
    setText($('create-title'), '🛠️ CREAR PARTIDA');
    $('btn-confirm-create-room').textContent = 'CREAR Y ENTRAR 💥';
    $('create-private-row').classList.remove('hidden');
    $('create-room-modal').classList.remove('admin-mode');
    $('friends-modal').classList.add('hidden');
    $('create-room-private').checked = !!isPrivate;
    $('create-room-modal').classList.remove('hidden');
    refreshCreate();
  }

  function initLobby() {
    document.querySelectorAll('.side-btn').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));

    initAuth();
    initFriends();
    initInventory();
    updateAccountCard();

    // Botones principales
    $('join-btn').addEventListener('click', () => joinGame());
    $('btn-friends').addEventListener('click', () => { $('friends-modal').classList.remove('hidden'); setTimeout(() => $('join-code-input').focus(), 50); });
    $('btn-friends-create').addEventListener('click', () => openCreate(true));
    $('btn-settings').addEventListener('click', openSettings);
    $('link-controls').addEventListener('click', e => { e.preventDefault(); openSettings(); });
    $('btn-fullscreen').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
    });
    $('mode-select').addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (b) {
        quickMode = b.dataset.mode; store.set('quickMode', quickMode);
        renderModeSelect();
        $('mode-dropdown').classList.add('hidden');
        playSound('click');
        return;
      }
      $('mode-dropdown').classList.toggle('hidden');
    });
    document.addEventListener('click', e => { if (!e.target.closest('#mode-select')) $('mode-dropdown').classList.add('hidden'); });
    renderModeSelect();

    // Retos
    ['challenge-list', 'rs-challenge-list'].forEach(id => $(id).addEventListener('click', onChallengeClick));

    // Selectores de arma (inicio y pantalla de reaparición)
    ['home-weapon-picker', 'rs-weapon-picker'].forEach(id => $(id).addEventListener('click', e => {
      const b = e.target.closest('[data-weapon]');
      if (b) choosePrimary(b.dataset.weapon);
    }));

    // Salas
    $('rooms-list-body').addEventListener('click', e => {
      const btn = e.target.closest('[data-join]');
      if (btn) { selectRoom(btn.dataset.join); joinGame(btn.dataset.join === 'quick' ? null : { roomId: btn.dataset.join }); return; }
      const tr = e.target.closest('tr[data-room]');
      if (tr) { selectRoom(tr.dataset.room); playSound('click'); }
    });
    $('rooms-list-body').addEventListener('dblclick', e => {
      const tr = e.target.closest('tr[data-room]');
      if (tr) joinGame(tr.dataset.room === 'quick' ? null : { roomId: tr.dataset.room });
    });
    $('btn-refresh-rooms').addEventListener('click', () => socket && socket.emit('rooms:get'));
    const joinCode = () => {
      const c = $('join-code-input').value.trim().toUpperCase();
      if (c.length !== 4) { lobbyToast('El código tiene 4 letras'); return; }
      $('friends-modal').classList.add('hidden');
      joinGame({ code: c });
    };
    $('btn-join-code').addEventListener('click', joinCode);
    $('join-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinCode(); });
    $('join-code-input').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });

    // Crear partida
    buildCreateModal();
    initAdmin();
    $('create-room-max-players').addEventListener('change', e => { e.target.dataset.touched = '1'; });
    $('btn-open-create-room').addEventListener('click', () => openCreate(false));
    $('btn-close-create-room').addEventListener('click', () => $('create-room-modal').classList.add('hidden'));
    document.querySelectorAll('.modal-backdrop').forEach(m => m.addEventListener('mousedown', e => {
      if (e.target === m && m.id !== 'settings-modal') m.classList.add('hidden');
    }));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !inGame && !rebinding) ['create-room-modal', 'friends-modal'].forEach(id => $(id).classList.add('hidden'));
    });
    $('btn-confirm-create-room').addEventListener('click', () => {
      if (createMode === 'admin') {
        adminAction('settings', { settings: {
          name: $('create-room-name').value.trim(),
          map: createState.map, mode: createState.mode,
          maxPlayers: parseInt($('create-room-max-players').value, 10),
          scoreLimit: parseInt($('create-room-limit').value, 10),
          timeLimit: parseInt($('create-room-time').value, 10),
          bots: parseInt($('create-room-bots').value, 10) || 0, botDifficulty: createState.botDifficulty,
        } });
        $('create-room-modal').classList.add('hidden');
        return;
      }
      if (!getNickname()) return;
      socket.emit('rooms:create', {
        name: $('create-room-name').value.trim(),
        host: account ? account.username : '',
        map: createState.map, mode: createState.mode,
        maxPlayers: parseInt($('create-room-max-players').value, 10),
        scoreLimit: parseInt($('create-room-limit').value, 10),
        timeLimit: parseInt($('create-room-time').value, 10),
        isPrivate: $('create-room-private').checked,
        bots: parseInt($('create-room-bots').value, 10) || 0, botDifficulty: createState.botDifficulty,
      });
    });


    loadChallenges();
    renderChallenges();
    updateEggCounter();
    selectWeapon(currentWeapon, true);
  }

  // ===========================================================================
  // HUEVO 3D DE LA PANTALLA DE INICIO E ICONOS DE ARMAS
  // ===========================================================================
  let previewRenderer = null, previewScene = null, previewCamera = null, previewModel = null, previewCanvas = null;
  let previewRot = 0, previewDrag = null, previewFocus = 'body';
  const camPos = new THREE.Vector3(0, 1.35, 5.2), camLook = new THREE.Vector3(0, 0.8, 0);
  const weaponIcons = {};

  // Iconos de las armas generados a partir de los propios modelos 3D
  function makeWeaponIcons() {
    let r;
    try { r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return; }
    r.setSize(160, 80);
    const sc = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.01, 10);
    cam.position.set(3, 0, 0); cam.lookAt(0, 0, 0);
    const builders = FPS_BUILDERS;
    Object.keys(FPS_BUILDERS).forEach(k => {
      weaponIcons[k] = {};
      [['light', 0xffd2a6], ['dark', 0x2a1709]].forEach(([variant, color]) => {
        const g = builders[k]();
        const rm = [];
        g.traverse(o => { if (o.name === 'hand' || o.name === 'flash') rm.push(o); });
        rm.forEach(o => o.parent.remove(o));
        g.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color }); });
        const box = new THREE.Box3().setFromObject(g);
        const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        g.position.sub(center);
        const half = Math.max(size.z / 2, size.y) * 1.12;
        cam.left = -half; cam.right = half; cam.top = half / 2; cam.bottom = -half / 2; cam.updateProjectionMatrix();
        sc.add(g);
        r.render(sc, cam);
        weaponIcons[k][variant] = r.domElement.toDataURL('image/png');
        sc.remove(g);
        disposeTree(g);
      });
    });
    r.dispose();
    if (r.forceContextLoss) r.forceContextLoss();
  }

  function renderWeaponPickers() {
    const html = WEAPON_KEYS.map((k, i) => {
      const act = k === (pendingPrimary || primaryWeapon);
      const icon = weaponIcons[k] ? `<img src="${weaponIcons[k].dark}" alt="${escapeHtml(WEAPONS[k].name)}">` : WEAPONS[k].icon;
      return `<button class="wp-btn${act ? ' active' : ''}" data-weapon="${k}" title="${escapeHtml(WEAPONS[k].name + ' — ' + WEAPONS[k].type)}"><span class="wp-key">${i + 1}</span>${icon}<em>${escapeHtml(WEAPONS[k].name)}</em></button>`;
    }).join('');
    ['home-weapon-picker', 'rs-weapon-picker'].forEach(id => { const el = $(id); if (el) el.innerHTML = html; });
    const sel = pendingPrimary || primaryWeapon;
    const w = WEAPONS[sel];
    setText($('home-weapon-name'), w.name);
    setText($('rs-weapon-name'), w.name + (pendingPrimary ? ' · al reaparecer' : ''));
    setText($('home-weapon-desc'), `${w.type} · ${w.desc}`);
    // Barras y cifras calculadas con los datos REALES del arma (los mismos que usa el servidor)
    const info = window.GameData.weaponInfo(sel);
    const bars = [['Daño', 'dmg'], ['Cadencia', 'rate'], ['Alcance', 'range'], ['Movilidad', 'mob']].map(([l, k]) =>
      `<div class="wstat"><span>${l}</span><i>${'<b></b>'.repeat(info.bars[k])}${'<u></u>'.repeat(5 - info.bars[k])}</i></div>`).join('');
    const dmgTxt = w.projectile
      ? `💥 ${w.projectile.direct} impacto directo · hasta ${w.projectile.maxDmg} de explosión`
      : `🎯 ${info.body}${w.pellets > 1 ? ' (' + w.pellets + ' perdigones)' : ''} cuerpo · ${info.head} cabeza`;
    const killTxt = w.projectile ? 'Elimina de 1 impacto directo' : `Elimina en ${info.killBody} al cuerpo · ${info.killHead} a la cabeza`;
    const statHtml = bars + `<div class="wnums"><span>${dmgTxt}</span><span>${killTxt}</span><span>🔄 ${info.mag} balas · ${(info.reload / 1000).toFixed(1)} s recarga · ${info.sps} disparos/s</span></div>`;
    ['home-weapon-stats', 'rs-weapon-stats'].forEach(id => { const el = $(id); if (el) el.innerHTML = statHtml; });
  }

  function initPreview() {
    previewCanvas = $('home-egg-canvas');
    if (!previewCanvas) return;
    previewScene = new THREE.Scene();
    previewCamera = new THREE.PerspectiveCamera(32, 1.25, 0.1, 50);
    previewCamera.position.set(0, 1.35, 5.2);
    previewCamera.lookAt(0, 0.8, 0);
    previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    previewRenderer.toneMappingExposure = 1.2;
    previewScene.add(new THREE.HemisphereLight(0xffe2c4, 0x1b1d24, 0.75));
    const key = new THREE.DirectionalLight(0xffd7ae, 1.0); key.position.set(3, 5, 4); previewScene.add(key);
    const rim = new THREE.DirectionalLight(0xff8a3d, 0.7); rim.position.set(-4, 2, -3); previewScene.add(rim);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.scale.set(1.3, 1, 1);
    previewScene.add(shadow);
    previewCanvas.addEventListener('contextmenu', e => { if (paintMode()) e.preventDefault(); });
    previewCanvas.addEventListener('pointerdown', e => {
      previewCanvas.setPointerCapture(e.pointerId);
      if (eggPaintDown(e)) return;
      previewDrag = { x: e.clientX, r: previewRot };
    });
    previewCanvas.addEventListener('pointermove', e => {
      if (eggPaintMove(e)) return;
      if (previewDrag) { previewRot = previewDrag.r + (e.clientX - previewDrag.x) * 0.012; return; }
      if (paintMode()) previewCanvas.classList.toggle('painting', !!eggUVAt(e));
    });
    previewCanvas.addEventListener('pointerup', () => { eggPaintUp(); previewDrag = null; });
    previewCanvas.addEventListener('pointercancel', () => { eggPaintUp(); previewDrag = null; });
    window.addEventListener('resize', resizePreview);
    resizePreview();
    updatePreviewAvatar();
  }
  function resizePreview() {
    if (!previewRenderer) return;
    const r = previewCanvas.getBoundingClientRect();
    const w = Math.max(100, r.width || 500), h = Math.max(80, r.height || 400);
    previewRenderer.setSize(w, h, false);
    previewCamera.aspect = w / h; previewCamera.updateProjectionMatrix();
  }
  function updatePreviewAvatar() {
    if (!previewScene) return;
    paintBase = null;
    if (previewModel) { previewScene.remove(previewModel.root); disposeTree(previewModel.root); }
    previewModel = createEggModel({ custom, weapon: currentWeapon });
    previewScene.add(previewModel.root);
  }
  function renderPreview(t) {
    if (!previewRenderer || !previewModel) return;
    const inTaller = menuOverlay.dataset.panel === 'inventory';
    if (!previewDrag && !inTaller) previewRot *= 0.96;
    const head = previewFocus === 'head';
    camPos.lerp(head ? new THREE.Vector3(0, 1.5, 2.6) : new THREE.Vector3(0, 1.35, inTaller ? 4.6 : 5.2), 0.08);
    camLook.lerp(head ? new THREE.Vector3(0, 1.28, 0) : new THREE.Vector3(0, 0.85, 0), 0.08);
    previewCamera.position.copy(camPos); previewCamera.lookAt(camLook);
    const still = paintMode(); // al pintar, el huevo se queda quieto
    previewModel.root.rotation.y = Math.PI + (inTaller ? 0.25 : 0.55) + previewRot + (still ? 0 : Math.sin(t * 0.7) * (inTaller ? 0.05 : 0.12));
    previewModel.body.position.y = still ? 0 : Math.abs(Math.sin(t * 1.6)) * 0.05;
    previewModel.gunPivot.rotation.x = Math.sin(t * 0.9) * 0.05;
    previewModel.update(t);
    previewRenderer.render(previewScene, previewCamera);
  }

  // ===========================================================================
  // BUCLE PRINCIPAL
  // ===========================================================================
  let fpsFrames = 0, fpsTime = 0, lastMoveSent = 0, uiTimer = 0;
  // Si el juego va a tirones, baja la calidad sola (salvo que el jugador la fijara a mano)
  let slowSamples = 0;
  function adaptQuality(fps) {
    if (!inGame || document.hidden || store.get('qualityManual', false)) { slowSamples = 0; return; }
    if (fps < 42) slowSamples++; else slowSamples = Math.max(0, slowSamples - 1);
    if (slowSamples < 6) return; // ~3 s seguidos por debajo de 42 FPS
    slowSamples = 0;
    const next = settings.quality === 'ultra' ? 'high' : settings.quality === 'high' ? 'mid' : settings.quality === 'mid' ? 'low' : null;
    if (!next) {
      // Ya en baja: bajar la resolución interna un poco (hasta 70 %) para recuperar fluidez
      const pr = renderer.getPixelRatio();
      if (pr > 0.72) { renderer.setPixelRatio(Math.max(0.7, pr - 0.15)); showToast('⚙️ Resolución reducida para ir más fluido'); }
      return;
    }
    settings.quality = next;
    store.set('settings', settings);
    applySettings();
    showToast(`⚙️ Calidad ${next === 'high' ? 'alta' : next === 'mid' ? 'media' : 'baja'} para que vaya más fluido`);
  }
  // El bucle nunca se detiene: si un fotograma falla, se registra y el juego sigue
  let loopErrors = 0;
  function loop() {
    requestAnimationFrame(loop);
    try { frame(); } catch (e) {
      if (loopErrors++ < 5) console.error('[frame]', e);
      if (loopErrors === 1) reportClientError(e);
    }
  }
  function frame() {
    const dt = Math.min(0.1, clock.getDelta());
    const t = clock.elapsedTime;

    if (inGame && world) {
      if (me.alive) {
        if (isMouseDown && WEAPONS[currentWeapon].auto && canAct()) shoot();
        updateBurst(performance.now());
        updateGrenadeCharge();
        updateMovement(dt);
        updateCamera(dt, t);
        animateWeapon(dt);
        trackCoopTime(dt);
        const now = performance.now();
        if (now - lastMoveSent > 33 && socket) {
          lastMoveSent = now;
          socket.emit('player:move', { x: +st.x.toFixed(3), y: +st.y.toFixed(3), z: +st.z.toFixed(3), rotX: +pitch.toFixed(3), rotY: +yaw.toFixed(3) });
        }
      } else {
        updateDeathCam(dt);
        if (activeFPS) activeFPS.visible = false;
        scopeOverlay.classList.add('hidden');
      }
      updateRemotes(dt, t);
      updateGrenades(dt);
      updateObjectives(t);
      updateWaypoints();
      updateDamageNumbers(dt);
    } else if (mapData) {
      // Cámara orbital del lobby sobre el mapa seleccionado (detrás del velo oscuro)
      const R = mapData.halfSize * 1.15, a = t * 0.05;
      camera.position.set(Math.cos(a) * R, mapData.halfSize * 0.55 + 6, Math.sin(a) * R);
      camera.lookAt(0, 2, 0);
      if (activeFPS) activeFPS.visible = false;
    }
    updateEffects(dt);
    updateSunFollow();
    window.MapRenderer.animate(t);
    // Sombras: el mapa no se mueve, así que el mapa de sombras se recalcula sólo
    // cada pocos fotogramas (calidad media/baja) o cuando el sol se recoloca
    shadowTick++;
    const every = settings.quality === 'high' || settings.quality === 'ultra' ? 1 : 2;
    if (sunMoved || shadowTick % every === 0) { renderer.shadowMap.needsUpdate = true; sunMoved = false; }
    renderer.render(scene, camera);
    if (!inGame) renderPreview(t);

    uiTimer += dt;
    if (uiTimer > 0.2) {
      uiTimer = 0;
      updateRespawnScreen();
      if (!inGame || rsMode) updateChallengeTimer();
    }
    fpsFrames++; fpsTime += dt;
    if (fpsTime >= 0.5) { const f = fpsFrames / fpsTime; setText($('ss-fps-val'), Math.round(f)); fpsFrames = 0; fpsTime = 0; adaptQuality(f); }
  }

  // ===========================================================================
  // ARRANQUE
  // ===========================================================================
  function main() {
    if (!window.THREE) {
      document.body.innerHTML = '<div style="color:#ffe9d2;background:#0d0f14;font:20px sans-serif;padding:40px;height:100vh">No se pudo cargar Three.js (se descarga de unpkg.com). Comprueba la conexión a Internet del equipo.</div>';
      return;
    }
    initThree();
    applySettings();
    loadMap('castle');
    makeWeaponIcons();
    initTexturePainter();
    initPreview();
    initControls();
    initNetworking();
    initLobby();
    renderWeaponPickers();
    loop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
