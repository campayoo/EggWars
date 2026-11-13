// ============================================================================
// public/js/impostor.js — Cliente del modo «Huevo Impostor»
// Página propia (impostor.html): no carga ni modifica main.js ni los otros
// modos. Reutiliza el renderizado de mapas (maps.js), el modelo del huevo
// (eggmodel.js) y las físicas compartidas.
// ============================================================================
(function () {
  'use strict';
  const I = window.Impostor, Phys = window.GamePhysics, MapDefs = window.MapDefs;
  const R = I.RULES, P = Phys.P;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ss_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ss_' + k, JSON.stringify(v)); } catch (e) { /* */ } },
  };
  // Escribir en el DOM sólo si cambia (el HUD se actualiza cada fotograma)
  const setText = (el, t) => { if (el._t !== t) { el._t = t; el.textContent = t; } };
  const show = (el, on) => { (typeof el === 'string' ? $(el) : el).classList.toggle('hidden', !on); };
  const colorOf = idx => I.COLORS[idx] || I.COLORS[0];
  const dot = idx => `<i class="dot" style="background:${colorOf(idx).hex}"></i>`;

  // ---------------------------------------------------------------------------
  // Estado del cliente
  // ---------------------------------------------------------------------------
  // Si no cargó el motor 3D (sin internet, CDN caído…) avisamos en vez de romper.
  if (typeof THREE === 'undefined' || typeof io === 'undefined') {
    const m = document.getElementById('auth-msg');
    if (m) m.textContent = typeof io === 'undefined' ? 'No se puede conectar con el servidor del juego. ¿Está encendido?' : 'No se pudo cargar el motor 3D (three.js). Revisa tu conexión a internet y recarga con Ctrl+F5.';
    const b = document.getElementById('auth-back'); if (b) b.hidden = false;
    return;
  }
  // Errores: se registran y se avisa una vez, pero el juego sigue.
  let lastErrToast = 0;
  function reportErr(where, e) {
    console.error('[Huevo Impostor]', where, e);
    const now = Date.now();
    if (now - lastErrToast > 15000) { lastErrToast = now; try { toast('⚠️ Algo ha fallado, pero la partida sigue', true); } catch (_) { /* */ } }
  }
  window.addEventListener('error', e => reportErr('error', e.error || e.message));
  window.addEventListener('unhandledrejection', e => { e.preventDefault(); console.warn('[Huevo Impostor] promesa', e.reason); });
  const socket = io({ reconnectionDelay: 800, reconnectionDelayMax: 4000 });
  { // cada mensaje del servidor se procesa protegido
    const on0 = socket.on.bind(socket);
    socket.on = (ev, fn) => on0(ev, (...a) => { try { fn(...a); } catch (e) { reportErr(ev, e); } });
  }
  let myName = '', authed = false;
  let me = null, roster = {}, rosterList = [], adminId = null, settings = {}, roomInfo = null;
  let state = 'lobby', role = null, practice = false, impIds = [], myTasks = [];
  let alive = true, inVent = null, sab = null, taskFrac = 0, you = {}, serverOff = 0;
  let inGame = false, lastStateAt = 0, lastSnapT = 0;
  let tabHeld = false, fakeKr = 0, killCd = 25;
  let watching = false;   // mirando la sala de cámaras   // rol oculto: sólo se ve manteniendo TAB
  const others = new Map();      // id -> { m, tx, ty, tz, ry, ghost, seen }
  const bodies = new Map();      // id -> { g, x, y, z }
  const doorMeshes = new Map();  // id -> mesh
  const serverNow = () => Date.now() + serverOff;

  // ---------------------------------------------------------------------------
  // Sonidos sencillos (WebAudio, sin archivos)
  // ---------------------------------------------------------------------------
  let actx = null;
  function beep(f, dur, type, vol, slide) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(Math.max(0.0001, (vol || 0.12) * VOL.v), t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* sin audio */ }
  }
  const sfx = {
    ok: () => { beep(660, 0.12, 'triangle', 0.1); setTimeout(() => beep(990, 0.18, 'triangle', 0.1), 90); },
    click: () => beep(420, 0.05, 'square', 0.04),
    bad: () => { beep(160, 0.25, 'sawtooth', 0.08); try { if (mg) shake(); } catch (e) { /* */ } },
    kill: () => { beep(240, 0.35, 'sawtooth', 0.18, 60); beep(90, 0.5, 'square', 0.1, 40); },
    meeting: () => { beep(520, 0.35, 'square', 0.12); setTimeout(() => beep(390, 0.6, 'square', 0.12), 300); },
    alarm: () => beep(880, 0.25, 'square', 0.07, 660),
    role: () => { beep(110, 1.2, 'sawtooth', 0.12, 55); },
  };

  // ---------------------------------------------------------------------------
  // Avisos
  // ---------------------------------------------------------------------------
  function toast(text, err) {
    const d = document.createElement('div');
    d.className = 'toast' + (err ? ' err' : '');
    d.textContent = text;
    $('toasts').appendChild(d);
    setTimeout(() => d.remove(), 3600);
    if ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }

  // ---------------------------------------------------------------------------
  // Sesión y navegador de salas
  // ---------------------------------------------------------------------------
  function authFail(msg) {
    show('scr-auth', true); show('scr-browser', false); show('scr-game', false);
    $('auth-msg').textContent = msg;
    $('auth-back').hidden = false;
  }
  socket.on('connect', () => {
    const t = store.get('token', null);
    if (!t) { authFail('Primero inicia sesión en el menú de EGG WARS y vuelve aquí.'); return; }
    socket.emit('auth:token', { token: t });
  });
  // Reconexión: si se corta, intentamos volver solos a la misma nave
  let rejoinRoom = null;
  socket.on('disconnect', reason => {
    if (inGame) { rejoinRoom = roomInfo && roomInfo.id; leaveGame(true); }
    show('net-down', true);
    if (reason === 'io server disconnect') socket.connect();
  });
  socket.io.on('reconnect_attempt', n => { const t = $('net-try'); if (t) t.textContent = `Intento ${n}…`; });
  socket.on('connect', () => show('net-down', false));
  socket.on('auth:ok', d => {
    authed = true;
    if (d.token) store.set('token', d.token);
    myName = d.profile.username;
    $('me-name').textContent = myName;
    if (inGame) return;
    showBrowser();
    if (rejoinRoom) { const r = rejoinRoom; rejoinRoom = null; toast('🔌 Reconectado: volviendo a la nave…'); joinRoom({ roomId: r }); }
    const q = new URLSearchParams(location.search);
    if (q.get('code')) joinRoom({ code: q.get('code') });
    else if (q.get('room')) joinRoom({ roomId: q.get('room') });
  });
  socket.on('auth:error', d => authFail((d && d.message) || 'No se pudo iniciar sesión.'));
  socket.on('auth:needName', () => authFail('Primero inicia sesión en el menú de EGG WARS.'));
  socket.on('auth:kicked', d => authFail((d && d.message) || 'Sesión cerrada.'));

  function roomTitle(r) { return r && r.id === 'room-nave-impostor' ? 'ÑEMANAVE' : (r && r.name) || 'Nave'; }
  $('rooms-refresh').addEventListener('click', () => socket.emit('imp:rooms'));
  function showBrowser() {
    show('scr-auth', false); show('scr-game', false); show('scr-browser', true);
    socket.emit('imp:rooms');
  }
  socket.on('imp:rooms', list => {
    const tb = $('room-list');
    list = Array.isArray(list) ? list : [];
    if (!list.length) { tb.innerHTML = '<div class="room-empty">🌌 No hay naves en órbita.<br><small>¡Crea la tuya y pasa el código!</small></div>'; return; }
    tb.innerHTML = list.map(r => {
      const n = r.playersCount | 0, max = r.maxPlayers | 0 || 10, full = n >= max, lobby = r.state === 'lobby';
      const eggs = Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      return `<div class="room-card${r.isDefault ? ' official' : ''}">
        <div class="rc-main"><div class="rc-name">${esc(roomTitle(r))}</div>
          <div class="rc-meta"><span class="chip ${lobby ? 'ok' : 'busy'}">${lobby ? '● En el vestíbulo' : '● En partida'}</span>${r.isDefault ? '<span class="chip gold">★ Oficial</span>' : r.code ? `<span class="chip">Código ${esc(r.code)}</span>` : ''}</div>
          <div class="rc-eggs" title="${n}/${max} huevos">${eggs}<span>${n}/${max}</span></div></div>
        <button class="btn" data-join="${esc(r.id)}" ${full ? 'disabled' : ''}>${full ? 'LLENA' : lobby ? 'ENTRAR' : 'MIRAR'}</button></div>`;
    }).join('');
  });
  $('room-list').addEventListener('click', e => { const b = e.target.closest('[data-join]'); if (b) joinRoom({ roomId: b.dataset.join }); });
  $('code-btn').addEventListener('click', () => { const c = $('code-in').value.trim().toUpperCase(); if (c.length === 4) joinRoom({ code: c }); else toast('El código tiene 4 letras', true); });
  $('code-in').addEventListener('keydown', e => { if (e.key === 'Enter') $('code-btn').click(); });
  $('c-btn').addEventListener('click', () => {
    socket.emit('imp:create', { name: $('c-name').value, maxPlayers: +$('c-max').value, impostors: +$('c-imp').value, isPrivate: $('c-priv').checked });
  });
  socket.on('imp:created', d => { if (d.isPrivate) toast(`Nave privada creada · código ${d.code}`); joinRoom({ roomId: d.roomId }); });
  socket.on('rooms:error', d => toast((d && d.message) || 'Error', true));
  function joinRoom(o) { socket.emit('player:join-room', Object.assign({ impostor: true }, o)); }

  // ---------------------------------------------------------------------------
  // Escena 3D
  // ---------------------------------------------------------------------------
  let renderer, scene, camera, mapRoot, objRoot, world, clock, markers = {};
  const cam = { yaw: 0, pitch: 0 };
  let st = null;   // estado físico local

  function init3D() {
    if (renderer) return;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch (e) { toast('Tu navegador no puede usar WebGL: activa la aceleración por hardware.', true); throw e; }
    renderer.domElement.addEventListener('webglcontextlost', ev => { ev.preventDefault(); toast('La tarjeta gráfica se reinició: recuperando…', true); });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.className = 'view';
    $('scr-game').prepend(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
    camera.rotation.order = 'YXZ';
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x55606a, 0.5);
    const sun = new THREE.DirectionalLight(0xeaf2ff, 0.6);
    const fill = new THREE.DirectionalLight(0xbfd0ff, 0.3); fill.position.set(-20, 30, 25);
    scene.add(amb, hemi, sun, sun.target, fill);
    mapRoot = new THREE.Group(); scene.add(mapRoot);
    objRoot = new THREE.Group(); scene.add(objRoot);
    window.MapRenderer.build(I.MAP_ID, scene, mapRoot, { amb, hemi, sun });
    if (window.MapRenderer.setAnisotropy) window.MapRenderer.setAnisotropy(renderer.capabilities.getMaxAnisotropy());
    scene.fog = new THREE.Fog(0x04060d, 8, 20);
    // Sin las aristas negras de los bloques (eran lo que daba aspecto de «cubos»)
    mapRoot.traverse(o => { if (o.isLineSegments) o.visible = false; });
    buildShipDecor(MapDefs.build(I.MAP_ID));
    // Todo lo estático: matrices congeladas (no se recalculan cada fotograma)
    mapRoot.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
    world = Phys.createWorld(MapDefs.build(I.MAP_ID));
    world.boxes = world.boxes.slice();
    buildMarkers();
    clock = { last: performance.now(), t0: performance.now() };
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    renderer.domElement.addEventListener('click', lockPointer);
    $('pz-go').addEventListener('click', lockPointer);
    $('pz-leave').addEventListener('click', () => leaveGame(false));
    $('pz-menu').addEventListener('click', () => { leaveGame(false); location.href = '/'; });
    $('pz-sens').value = String(SENS.v * 10000); $('pz-vol').value = String(VOL.v * 100);
    $('pz-sens').addEventListener('input', e => { SENS.v = +e.target.value / 10000; store.set('imp_sens', SENS.v); });
    $('pz-vol').addEventListener('input', e => { VOL.v = +e.target.value / 100; store.set('imp_vol', VOL.v); });
    $('pz-q').value = QUAL.v; $('pz-fps').checked = !!QUAL.fps; show('fps', !!QUAL.fps);
    $('pz-q').addEventListener('change', e => { QUAL.v = e.target.value; store.set('imp_q', QUAL.v); applyQuality(); });
    $('pz-fps').addEventListener('change', e => { QUAL.fps = e.target.checked; store.set('imp_fps', QUAL.fps); show('fps', QUAL.fps); });
    applyQuality();
    requestAnimationFrame(frame);
  }

  // Decoración de la nave (public/js/navedecor.js, compartida con el FPS)
  function buildShipDecor(data) { window.NaveDecor.build(mapRoot, data); }

  // Indicadores 3D: flechas sobre las tareas, sabotajes y botón
  function arrowMesh(color) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false, fog: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 12), m); cone.rotation.x = Math.PI; g.add(cone);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -1.95; g.add(ring);
    g.renderOrder = 5; cone.renderOrder = 5;
    g.visible = false;
    objRoot.add(g);
    return g;
  }
  function buildMarkers() {
    I.STATIONS.forEach(s => { const a = arrowMesh(0xffd36b); a.position.set(s.x, 2.0, s.z); markers[s.id] = a; });
    const l = arrowMesh(0xff5a4e); l.position.set(I.LIGHTS_PANEL.x, 2.0, I.LIGHTS_PANEL.z); markers.luces = l;
    I.REACTOR_PADS.forEach(p => { const a = arrowMesh(0xff5a4e); a.position.set(p.x, 2.0, p.z); markers['pad' + p.id] = a; });
  }

  // ---------------------------------------------------------------------------
  // Huevos remotos, cuerpos y puertas
  // ---------------------------------------------------------------------------
  function nameSprite(text, hex) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.font = 'bold 30px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(text, 128, 32);
    c.fillStyle = hex; c.fillText(text, 128, 32);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(1.7, 0.42, 1); sp.position.y = 2.3;
    return sp;
  }
  function makeEgg(id, ghost) {
    const r = roster[id] || { name: '?', color: 0, custom: {} };
    const custom = Object.assign({}, r.custom || {}, { color: colorOf(r.color).hex });
    delete custom.paint;
    const m = window.EggModel.create(custom, { weapon: null });
    const nameHex = tabHeld && role === 'impostor' && impIds.includes(id) ? '#ff5a4e' : '#ffffff';
    m.root.add(nameSprite(r.name, ghost ? '#cfe0ff' : nameHex));
    if (ghost) {
      m.root.traverse(o => {
        if (!o.material) return;
        o.material = o.material.clone();
        o.material.transparent = true; o.material.opacity = 0.38; o.material.depthWrite = false;
      });
    }
    m.color = r.color; m.ghost = ghost; m.impName = nameHex;
    objRoot.add(m.root);
    return m;
  }
  function disposeObj(o) { objRoot.remove(o); o.traverse(x => { if (x.geometry && !x.geometry.userData.keep) x.geometry.dispose(); }); }
  function updateOther(id, x, y, z, ry, ghost) {
    let o = others.get(id);
    const r = roster[id];
    if (!r) return;
    const nameHex = tabHeld && role === 'impostor' && impIds.includes(id) ? '#ff5a4e' : '#ffffff';
    if (o && (o.ghost !== !!ghost || o.m.color !== r.color || o.m.impName !== nameHex)) { disposeObj(o.m.root); others.delete(id); o = null; }
    if (!o) {
      o = { m: makeEgg(id, !!ghost), ghost: !!ghost, x, y, z, ry, tx: x, ty: y, tz: z, try: ry, seen: 0, walk: 0 };
      o.m.root.position.set(x, y, z);
      others.set(id, o);
    }
    // Saltos grandes (teletransporte, conductos, reuniones): sin interpolar
    const ts = lastSnapT || serverNow();
    if (Math.hypot(x - o.tx, z - o.tz) > 4) { o.x = x; o.y = y; o.z = z; o.buf = []; }
    o.buf = o.buf || [];
    o.buf.push([ts, x, y, z, ry]);
    if (o.buf.length > 12) o.buf.shift();
    o.tx = x; o.ty = y; o.tz = z; o.try = ry; o.seen = performance.now();
  }

  let bodyGeo = null;
  function makeBody(colorIdx) {
    if (!bodyGeo) {
      bodyGeo = {
        shell: new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
        yolk: new THREE.SphereGeometry(0.26, 16, 10),
        puddle: new THREE.CircleGeometry(0.95, 24),
        shard: new THREE.TetrahedronGeometry(0.16),
      };
      Object.values(bodyGeo).forEach(g => { g.userData.keep = true; });
    }
    const g = new THREE.Group();
    const col = new THREE.Color(colorOf(colorIdx).hex);
    const sm = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
    const shell = new THREE.Mesh(bodyGeo.shell, sm); shell.position.y = 0.42; shell.scale.set(1, 0.85, 1); g.add(shell);
    const yolk = new THREE.Mesh(bodyGeo.yolk, new THREE.MeshLambertMaterial({ color: 0xffb21e, emissive: 0x3a2000 })); yolk.position.set(0.12, 0.2, 0.05); yolk.scale.y = 0.55; g.add(yolk);
    const pd = new THREE.Mesh(bodyGeo.puddle, new THREE.MeshLambertMaterial({ color: 0xf6f1e0, transparent: true, opacity: 0.85 })); pd.rotation.x = -Math.PI / 2; pd.position.y = 0.03; g.add(pd);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(bodyGeo.shard, sm); const a = i * 1.1;
      s.position.set(Math.cos(a) * (0.7 + (i % 2) * 0.3), 0.07, Math.sin(a) * (0.7 + (i % 3) * 0.2));
      s.rotation.set(a, a * 2, a * 3); g.add(s);
    }
    objRoot.add(g);
    return g;
  }

  let doorTex = null;
  function doorMat() {
    if (!doorTex) {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      const c = cv.getContext('2d'); c.fillStyle = '#5a6675'; c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#f2c230'; for (let i = -64; i < 128; i += 22) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 11, 0); c.lineTo(i - 53, 64); c.lineTo(i - 64, 64); c.fill(); }
      doorTex = new THREE.CanvasTexture(cv); doorTex.wrapS = doorTex.wrapT = THREE.RepeatWrapping; doorTex.repeat.set(2, 2);
    }
    return new THREE.MeshLambertMaterial({ map: doorTex, emissive: 0x220000 });
  }
  function syncDoors(list) {
    const want = new Set(list || []);
    for (const [id, m] of doorMeshes) {
      if (!want.has(id)) { objRoot.remove(m); m.geometry.dispose(); doorMeshes.delete(id); world.boxes = world.boxes.filter(b => b.door !== id); }
    }
    for (const id of want) {
      if (doorMeshes.has(id)) continue;
      const d = I.DOORS.find(x => x.id === id);
      if (!d) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(d.maxX - d.minX, d.maxY - d.minY, d.maxZ - d.minZ), doorMat());
      m.position.set((d.minX + d.maxX) / 2, (d.minY + d.maxY) / 2, (d.minZ + d.maxZ) / 2);
      objRoot.add(m); doorMeshes.set(id, m);
      world.boxes.push({ minX: d.minX, maxX: d.maxX, minY: d.minY, maxY: d.maxY, minZ: d.minZ, maxZ: d.maxZ, solid: true, see: false, door: id });
      beep(140, 0.2, 'square', 0.06);
    }
  }

  // ---------------------------------------------------------------------------
  // Entrar / salir de una nave
  // ---------------------------------------------------------------------------
  socket.on('imp:joined', d => {
    init3D();
    inGame = true;
    me = d.id; roomInfo = d.room; settings = d.settings; adminId = d.adminId;
    try {
      const mine = I.mapHash(Phys.createWorld(MapDefs.build(I.MAP_ID)).boxes);
      show('ver-warn', !!(d.mapHash && d.mapHash !== mine));
    } catch (e) { /* */ }
    setRoster(d.players);
    serverOff = d.serverNow - Date.now();
    state = d.state; role = d.spectator ? 'spectator' : null; practice = false; impIds = []; myTasks = [];
    alive = !d.spectator; inVent = null; sab = null;
    st = Phys.newState(d.x, d.y, d.z);
    cam.yaw = d.rotY; cam.pitch = 0;
    show('scr-auth', false); show('scr-browser', false); show('scr-game', true);
    ['ov-role', 'ov-killed', 'ov-mg', 'ov-sab', 'ov-map', 'ov-meet', 'ov-eject', 'ov-over'].forEach(o => show(o, false));
    $('chat-log').innerHTML = '';
    if (d.spectator) toast('Partida en curso: miras como fantasma hasta la siguiente');
    renderLobby(); renderTasks();
    history.replaceState(null, '', '/impostor.html?room=' + encodeURIComponent(d.room.id));
  });
  function leaveGame(silent) {
    if (!silent) socket.emit('player:leave-room');
    inGame = false;
    for (const [, o] of others) disposeObj(o.m.root);
    others.clear();
    for (const [, b] of bodies) objRoot.remove(b.g);
    bodies.clear();
    syncDoors([]);
    closeAll();
    releasePointer();
    history.replaceState(null, '', '/impostor.html');
    if (authed) showBrowser();
  }
  $('lb-leave').addEventListener('click', () => leaveGame(false));
  socket.on('room:kicked', d => { leaveGame(true); toast((d && d.message) || 'Te han expulsado', true); });

  function setRoster(list) {
    roster = {}; rosterList = list;
    list.forEach(p => { roster[p.id] = p; });
    for (const [id, o] of others) if (!roster[id]) { disposeObj(o.m.root); others.delete(id); }
  }
  socket.on('imp:roster', d => {
    setRoster(d.players); adminId = d.adminId; settings = d.settings;
    renderLobby();
  });

  // ---------------------------------------------------------------------------
  // Vestíbulo
  // ---------------------------------------------------------------------------
  function renderLobby() {
    const inLobby = state === 'lobby';
    show('lobby', inLobby && inGame);
    if (!inLobby) return;
    $('lb-name').textContent = roomInfo ? roomTitle(roomInfo) : settings.name || 'Nave';
    $('lb-code').textContent = roomInfo && roomInfo.code ? 'CÓDIGO ' + roomInfo.code : '';
    const isAdmin = adminId === me;
    $('lb-players').innerHTML = rosterList.map(p => `<li>${dot(p.color)} <span>${esc(p.name)}${p.id === me ? ' (tú)' : ''}</span>
      ${p.id === adminId ? '<span class="host">👑 anfitrión</span>' : ''}
      ${isAdmin && p.id !== me ? `<button class="kick" data-kick="${esc(p.id)}">expulsar</button>` : ''}</li>`).join('');
    const n = rosterList.length;
    const auto = n >= 7 ? 2 : 1;
    $('lb-settings').innerHTML = `🔪 Impostores: <b>${settings.impostors || 'auto (' + auto + ')'}</b> · ⏱️ Matar cada <b>${settings.killCd} s</b><br>🗳️ Reunión <b>${settings.meetingTime} s</b> · 📋 <b>${settings.tasks}</b> tareas · ${settings.confirmEjects ? 'Se confirman las expulsiones' : 'Expulsiones sin confirmar'}<br><span class="muted">${n}/${settings.maxPlayers} huevos · mínimo ${R.MIN_PLAYERS} para una partida</span>`;
    show('lb-admin', isAdmin); show('lb-wait', !isAdmin);
    if (isAdmin) {
      $('s-imp').value = String(settings.impostors || 0);
      $('s-kill').value = String(settings.killCd);
      $('s-meet').value = String(settings.meetingTime);
      $('s-tasks').value = String(settings.tasks);
      $('s-confirm').checked = !!settings.confirmEjects;
      $('lb-start').disabled = n < R.MIN_PLAYERS;
      $('lb-start').textContent = n < R.MIN_PLAYERS ? `▶ EMPEZAR (faltan ${R.MIN_PLAYERS - n})` : '▶ EMPEZAR';
      $('lb-prole').style.display = n === 1 ? '' : 'none';
    }
  }
  ['s-imp', 's-kill', 's-meet', 's-tasks', 's-confirm'].forEach(id => $(id).addEventListener('change', () => {
    socket.emit('room:admin', { action: 'settings', settings: { impostors: +$('s-imp').value, killCd: +$('s-kill').value, meetingTime: +$('s-meet').value, tasks: +$('s-tasks').value, confirmEjects: $('s-confirm').checked } });
  }));
  $('lb-start').addEventListener('click', () => socket.emit('room:admin', { action: 'start' }));
  $('lb-practice').addEventListener('click', () => socket.emit('room:admin', { action: 'start', practice: true, role: $('lb-prole').value }));
  $('lb-players').addEventListener('click', e => { const b = e.target.closest('[data-kick]'); if (b) socket.emit('room:admin', { action: 'kick', id: b.dataset.kick }); });
  socket.on('room:admin-result', d => { if (d.error) toast(d.error, true); else if (d.ok && d.ok !== 'Ajustes guardados') toast(d.ok); });

  // ---------------------------------------------------------------------------
  // Lista de tareas
  // ---------------------------------------------------------------------------
  function renderTasks() {
    const playing = state !== 'lobby' && role && role !== 'spectator';
    show('hud-tasks', inGame);
    $('taskbar').firstChild.style.width = Math.round(taskFrac * 100) + '%';
    const rt = $('role-tag');
    if (!playing) { rt.innerHTML = state === 'lobby' ? '🥚 Vestíbulo' : ''; $('task-list').innerHTML = state === 'lobby' ? '<li class="muted">Explora la nave mientras esperáis</li>' : ''; return; }
    rt.innerHTML = `🥚 <small class="muted">Mantén <kbd>TAB</kbd> para ver tu rol${practice ? ' · práctica' : ''}</small>`;
    let html = '';
    if (sab && sab.k === 'luces') html += `<li class="sab">💡 Arregla las luces <small>(Electricidad)</small></li>`;
    if (sab && sab.k === 'reactor') html += `<li class="sab">⚛️ ¡Reactor! ${Math.max(0, Math.ceil((sab.e - serverNow()) / 1000))} s <small>(dos placas a la vez)</small></li>`;
    html += myTasks.map(t => { const s = I.STATION[t.id]; const rm = I.ROOMS.find(r => r.id === s.room); return `<li class="${t.done ? 'done' : ''}">${esc(s.name)} <small>${esc(rm ? rm.name : 'Pasillo de servicio')}</small></li>`; }).join('');
    $('task-list').innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // Estado que llega del servidor (20 por segundo)
  // ---------------------------------------------------------------------------
  socket.on('imp:state', d => {
    if (!inGame) return;
    lastSnapT = d.t;
    const off = d.t - Date.now();
    serverOff = Math.abs(off - serverOff) > 1500 ? off : serverOff * 0.9 + off * 0.1;
    const prev = state;
    state = d.st; you = d.you || {};
    alive = !!you.al || state === 'lobby' || state === 'ended';
    if (inVent !== (you.v || null)) { inVent = you.v || null; renderVent(); }
    const prevSab = sab ? sab.k : null;
    sab = d.sab;
    if ((sab ? sab.k : null) !== prevSab) { renderTasks(); if (!sab && prevSab) closeMinigameIf('fix_luces'); }
    taskFrac = d.tp;
    syncDoors(d.d);
    // Jugadores visibles
    const seen = new Set();
    for (const p of d.pl) { seen.add(p[0]); updateOther(p[0], p[1], p[2], p[3], p[4], p[5]); }
    // Cuerpos
    const bseen = new Set();
    for (const b of d.b) {
      bseen.add(b[0]);
      if (!bodies.has(b[0])) { const g = makeBody(b[4]); g.position.set(b[1], b[2], b[3]); g.rotation.y = (b[1] * 7.3) % 6.28; bodies.set(b[0], { g, x: b[1], y: b[2], z: b[3] }); }
    }
    for (const [id, b] of bodies) if (!bseen.has(id)) { objRoot.remove(b.g); bodies.delete(id); }
    if (prev !== state) onStateChange(prev);
    if (performance.now() - lastStateAt > 250) { lastStateAt = performance.now(); renderTasks(); }
    $('vignette').classList.toggle('dark', !!(sab && sab.k === 'luces' && alive && state === 'playing'));
    $('vignette').classList.toggle('red', !!(sab && sab.k === 'reactor' && state === 'playing'));
    updateAlert();
  });

  function onStateChange(prev) {
    renderLobby(); renderTasks();
    if (state === 'lobby') {
      role = null; practice = false; impIds = []; myTasks = []; sab = null;
      ['ov-over', 'ov-meet', 'ov-eject', 'ov-killed'].forEach(o => show(o, false));
      for (const [, o] of others) { disposeObj(o.m.root); } others.clear();
    }
    if (state === 'playing' && prev === 'ejecting') { show('ov-eject', false); show('ov-meet', false); }
  }

  let alarmT = 0;
  function updateAlert() {
    const a = $('alert');
    if (state !== 'playing' || !sab) { show(a, false); return; }
    show(a, true);
    if (sab.k === 'reactor') {
      const s = Math.max(0, Math.ceil((sab.e - serverNow()) / 1000));
      const h = sab.h || {};
      const temp = Math.min(100, Math.round(20 + 80 * (1 - s / R.REACTOR_S)));
      a.innerHTML = `🌡️ CALDERA A <b>${temp} °C</b> · a 100 °C ¡huevos duros! (${s} s) · Paneles: ${h.A ? '🟢' : '🔴'} ${h.B ? '🟢' : '🔴'}<div class="thermo"><i style="width:${temp}%"></i></div>`;
      if (performance.now() - alarmT > 900) { alarmT = performance.now(); sfx.alarm(); }
    } else a.innerHTML = '💡 ¡Sabotaje! Las luces están fuera de servicio · Panel en Electricidad';
  }

  socket.on('imp:start', d => {
    role = d.role; practice = d.practice; impIds = d.impostors || [];
    myTasks = d.tasks.map(id => ({ id, done: false }));
    killCd = d.killCd || 25;
    fakeKr = serverNow() + R.START_KILL_CD_S * 1000;
    for (const [, o] of others) disposeObj(o.m.root); others.clear();
    closeAll();
    // Pantalla de inicio IGUAL para todos: el rol sólo se ve manteniendo TAB
    startScreenUntil = performance.now() + 3800;
    renderRoleScreen();
    sfx.role();
    setTimeout(() => { startScreenUntil = 0; renderRoleScreen(); }, 3800);
    renderTasks();
  });
  let startScreenUntil = 0;
  function renderRoleScreen() {
    const ov = $('ov-role');
    if (tabHeld && role && state !== 'lobby') {
      ov.classList.add('peek');
      if (role === 'impostor') {
        $('role-title').innerHTML = '<span class="imp">IMPOSTOR</span>';
        $('role-sub').textContent = impIds.length > 1 ? 'Tu compañero:' : 'Elimina a la tripulación sin que te descubran';
        $('role-mates').innerHTML = impIds.filter(id => id !== me).map(id => roster[id] ? `<span>${dot(roster[id].color)} ${esc(roster[id].name)}</span>` : '').join('');
      } else {
        $('role-title').innerHTML = role === 'spectator' ? '<span class="crew">ESPECTADOR</span>' : '<span class="crew">TRIPULANTE</span>';
        $('role-sub').textContent = role === 'spectator' ? 'Entraste con la partida empezada' : 'Haz tus tareas y descubre al impostor';
        $('role-mates').innerHTML = '';
      }
      show(ov, true); return;
    }
    ov.classList.remove('peek');
    if (performance.now() < startScreenUntil) {
      const n = impIds.length || 0;
      $('role-title').innerHTML = '🚀 ¡A LA NAVE!';
      $('role-sub').innerHTML = `Hay impostores entre nosotros…<br><b>Mantén <kbd>TAB</kbd> para ver tu rol</b> (¡que no te vean la pantalla!)`;
      $('role-mates').innerHTML = '';
      void n;
      show(ov, true); return;
    }
    show(ov, false);
  }
  function setTab(on) {
    if (tabHeld === on) return;
    tabHeld = on;
    renderRoleScreen();
    // nombres de los compañeros impostores en rojo sólo mientras se mantiene TAB
    if (role === 'impostor') { for (const [, o] of others) disposeObj(o.m.root); others.clear(); if (meet) renderMeeting(); }
  }
  window.addEventListener('blur', () => setTab(false));
  socket.on('imp:task', d => { const t = myTasks.find(x => x.id === d.id); if (t) t.done = true; sfx.ok(); toast('✔ Tarea completada'); renderTasks(); });
  socket.on('imp:killed', d => {
    const k = roster[d.by];
    closeAll();
    $('killed-txt').innerHTML = k ? `${dot(k.color)} ${esc(k.name)} te ha cascado` : 'Te han cascado';
    show('ov-killed', true); sfx.kill();
    setTimeout(() => { show('ov-killed', false); toast('👻 Ahora eres un fantasma: termina tus tareas'); }, 2800);
  });
  socket.on('imp:you-killed', () => { /* sin sonido: el impostor no se delata */ });
  socket.on('imp:sabotage', d => { toast(d.kind === 'reactor' ? '⚛️ ¡Sabotaje del reactor!' : '💡 ¡Se han ido las luces!', true); sfx.alarm(); });
  socket.on('imp:scan', d => {
    if (!objRoot) return;
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.3, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x3dff6a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 1.15; g.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: 0x9dffb4 }));
    ring.rotation.x = Math.PI / 2; g.add(ring);
    g.position.set(d.x, d.y, d.z); objRoot.add(g);
    const t0 = performance.now();
    const anim = () => { const k = (performance.now() - t0) / 1000; ring.position.y = 0.1 + (Math.sin(k * 5) * 0.5 + 0.5) * 2.1; if (k < 3) requestAnimationFrame(anim); else { objRoot.remove(g); beam.geometry.dispose(); ring.geometry.dispose(); } };
    anim();
    const r = roster[d.id];
    if (!d.me && r) toast(`🔬 ${r.name} ha pasado el escáner: ¡huevo fresco!`);
  });
  socket.on('imp:notice', d => toast(d.text));
  socket.on('imp:error', d => { toast(d.message, true); sfx.bad(); });
  socket.on('imp:tp', d => { if (!st) return; st.x = d.x; st.y = d.y; st.z = d.z; st.vx = st.vy = st.vz = 0; if (typeof d.rotY === 'number') cam.yaw = d.rotY; });
  socket.on('you:correct', d => { if (!st) return; st.x = d.x; st.y = d.y; st.z = d.z; st.vx = st.vy = st.vz = 0; });

  // ---------------------------------------------------------------------------
  // Controles
  // ---------------------------------------------------------------------------
  const keys = {};
  const SENS = { v: store.get('imp_sens', 0.0022) }, VOL = { v: store.get('imp_vol', 1) };
  const anyOverlay = () => ['ov-mg', 'ov-sab', 'ov-meet', 'ov-eject', 'ov-over', 'ov-killed'].some(id => !$(id).classList.contains('hidden'));
  const typing = () => document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');
  function lockPointer() {
    if (!inGame || anyOverlay() || typing()) return;
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => { /* */ });
  }
  // Pausa sólo cuando el jugador suelta el ratón (Esc, cambiar de ventana…).
  // Si lo soltamos nosotros para una tarea/reunión, al cerrarla se recupera solo.
  let ourUnlockAt = 0, userPaused = false;
  function releasePointer() { if (document.pointerLockElement) { ourUnlockAt = performance.now(); document.exitPointerLock(); } }
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) { userPaused = false; return; }
    for (const k in keys) keys[k] = false;
    if (performance.now() - ourUnlockAt > 250 && !anyOverlay() && !watching) userPaused = true;
  });
  $('ov-resume').addEventListener('click', () => lockPointer());
  document.addEventListener('mousemove', e => {
    if (!renderer || document.pointerLockElement !== renderer.domElement) return;
    cam.yaw -= e.movementX * SENS.v;
    cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch - e.movementY * SENS.v));
  });
  document.addEventListener('keydown', e => {
    if (!inGame) return;
    if (e.code === 'Tab') { e.preventDefault(); setTab(true); return; }
    if (typing()) {
      if (e.key === 'Escape') { document.activeElement.blur(); show('chat-in', false); }
      return;
    }
    const k = e.code;
    keys[k] = true;
    if (e.repeat) return;
    if (watching && (k === 'Escape' || k === 'KeyE')) { setCams(false); return; }
    if (k === 'Escape') { closeAll(); return; }
    if (k === 'Enter') { openChat(); e.preventDefault(); return; }
    if (k === 'KeyM') { toggleMap(); return; }
    if (anyOverlay()) return;
    if (k === 'KeyE') useAction(true);
    else if (k === 'KeyR') reportAction();
    else if (k === 'KeyQ') killAction();
    else if (k === 'KeyF') sabotageMenu();
    else if (k === 'KeyV') ventAction();
  });
  document.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Tab') { e.preventDefault(); setTab(false); }
    if (e.code === 'KeyE' && heldPad) { socket.emit('imp:act', { a: 'pad', on: false }); heldPad = null; }
  });
  $('b-use').addEventListener('click', () => useAction(true));
  $('b-report').addEventListener('click', reportAction);
  $('b-kill').addEventListener('click', killAction);
  $('b-sab').addEventListener('click', sabotageMenu);
  $('b-vent').addEventListener('click', ventAction);
  $('b-map').addEventListener('click', toggleMap);

  function closeAll() {
    if (watching) setCams(false);
    closeMinigame();
    ['ov-sab', 'ov-map'].forEach(o => show(o, false));
    show('chat-in', false);
  }

  // ---------------------------------------------------------------------------
  // Objetivos cercanos (qué se puede hacer ahora mismo)
  // ---------------------------------------------------------------------------
  let target = { use: null, report: null, kill: null, vent: null };
  let heldPad = null;
  const d2 = (x, z) => Math.hypot(st.x - x, st.z - z);
  function computeTargets() {
    const t = { use: null, report: null, kill: null, vent: null };
    if (!st || state !== 'playing' || inVent) { target = t; return; }
    const ghost = !alive;
    // Tareas (vivos y fantasmas; los impostores, falsas)
    let best = I.TASK_RANGE;
    for (const task of myTasks) {
      if (task.done) continue;
      const s = I.STATION[task.id], dd = d2(s.x, s.z);
      if (dd < best) { best = dd; t.use = { kind: 'task', id: s.id, label: s.name }; }
    }
    if (!ghost) {
      if (sab && sab.k === 'luces' && d2(I.LIGHTS_PANEL.x, I.LIGHTS_PANEL.z) < I.LIGHTS_PANEL.r) t.use = { kind: 'lights', label: 'Arreglar las luces' };
      if (sab && sab.k === 'reactor') for (const p of I.REACTOR_PADS) if (d2(p.x, p.z) < p.r) t.use = { kind: 'pad', id: p.id, label: 'Mantén E sobre la placa ' + p.id };
      if (!t.use && d2(I.BUTTON.x, I.BUTTON.z) < I.BUTTON.r) t.use = { kind: 'button', label: `Reunión de emergencia (${you.em || 0})` };
      if (!t.use && d2(I.CAM_PANEL.x, I.CAM_PANEL.z) < I.CAM_PANEL.r) t.use = { kind: 'cams', label: 'Mirar las cámaras' };
      let bd = R.REPORT_RANGE;
      for (const [id, b] of bodies) { const dd = d2(b.x, b.z); if (dd < bd) { bd = dd; t.report = id; } }
      // MATAR y CONDUCTO se iluminan igual para todos (al tripulante no le hacen nada):
      // así mirando la pantalla no se sabe quién es el impostor
      let kd = R.KILL_RANGE;
      for (const [id, o] of others) {
        if (o.ghost || (role === 'impostor' && impIds.includes(id)) || performance.now() - o.seen > 300) continue;
        const dd = d2(o.tx, o.tz); if (dd < kd) { kd = dd; t.kill = id; }
      }
      let vd = R.VENT_RANGE;
      for (const v of I.VENTS) { const dd = d2(v.x, v.z); if (dd < vd) { vd = dd; t.vent = v.id; } }
    }
    target = t;
  }
  function updateButtons() {
    const playing = state === 'playing';
    $('b-use').classList.toggle('on', !!target.use);
    setText($('b-use').querySelector('.tx'), target.use && target.use.kind === 'button' ? 'REUNIÓN' : 'USAR');
    $('b-report').classList.toggle('on', !!target.report);
    const kcd = Math.max(0, Math.ceil(((role === 'impostor' ? (you.kr || 0) : fakeKr) - serverNow()) / 1000));
    setText($('b-kill').querySelector('.cd'), playing && alive && kcd > 0 ? String(kcd) : '');
    $('b-kill').classList.toggle('on', !!target.kill && kcd <= 0);
    $('b-sab').classList.toggle('on', playing && alive && role && role !== 'spectator');
    $('b-vent').classList.toggle('on', !!target.vent || !!inVent);
    show('ghost-tag', playing && !alive);
    const pr = $('prompt');
    let txt = '';
    if (target.use) txt = `[E] ${target.use.label}`;
    if (target.report) txt = `[R] ¡Informar del cuerpo!` + (txt ? ' · ' + txt : '');
    if (pr._t !== txt) { pr._t = txt; pr.textContent = txt; }
    show(pr, !!txt && !anyOverlay());
  }

  function useAction() {
    const u = target.use;
    if (!u) return;
    if (u.kind === 'button') { socket.emit('imp:act', { a: 'emergency' }); return; }
    if (u.kind === 'cams') { setCams(true); return; }
    if (u.kind === 'pad') { heldPad = u.id; socket.emit('imp:act', { a: 'pad', pad: u.id, on: true }); toast('Mantén pulsada E… ¡alguien tiene que estar en la otra placa!'); return; }
    if (u.kind === 'lights') { openMinigame('fix_luces', 'interruptores', '💡 Panel de luces', true); return; }
    if (u.kind === 'task') { const s = I.STATION[u.id]; openMinigame(s.id, s.type, s.name, role === 'crew'); }   // las del impostor son de mentira
  }
  function setCams(on) {
    if (watching === on) return;
    watching = on;
    socket.emit('imp:act', { a: 'cams', on });
    show('cam-ui', on); show('crosshair', !on);
    if (on && document.pointerLockElement) document.exitPointerLock();
  }
  function reportAction() { if (target.report) socket.emit('imp:act', { a: 'report', body: target.report }); }
  function killAction() {
    if (role !== 'impostor' || !target.kill || (you.kr || 0) > serverNow()) return;   // el tripulante: no pasa nada
    socket.emit('imp:act', { a: 'kill', t: target.kill });
  }
  function ventAction() {
    if (role !== 'impostor') return;
    if (inVent) { socket.emit('imp:act', { a: 'vent', op: 'exit', id: inVent }); return; }
    if (target.vent) socket.emit('imp:act', { a: 'vent', op: 'enter', id: target.vent });
  }
  socket.on('imp:vent', d => { inVent = d.id; renderVent(); });
  function renderVent() {
    show('vent-ui', !!inVent);
    if (!inVent) return;
    releasePointer();
    const v = I.VENT[inVent];
    $('vent-btns').innerHTML = v.links.map(id => `<button class="btn" data-vent="${id}">➜ ${esc(I.VENT[id].name)}</button>`).join('') + '<button class="btn ghost" data-vent="__exit">⬆ Salir (V)</button>';
  }
  $('vent-btns').addEventListener('click', e => {
    const b = e.target.closest('[data-vent]'); if (!b || !inVent) return;
    if (b.dataset.vent === '__exit') socket.emit('imp:act', { a: 'vent', op: 'exit', id: inVent });
    else socket.emit('imp:act', { a: 'vent', op: 'move', id: b.dataset.vent });
  });

  // ---------------------------------------------------------------------------
  // Sabotajes (impostor)
  // ---------------------------------------------------------------------------
  let sabTimer = null;
  function sabotageMenu() {
    if (state !== 'playing' || role !== 'impostor') return;
    releasePointer();
    show('ov-sab', true);
    const draw = () => {
      const now = serverNow();
      const s = Math.max(0, Math.ceil(((you.sr || 0) - now) / 1000)), dd = Math.max(0, Math.ceil(((you.dr || 0) - now) / 1000));
      const busy = !!sab;
      $('sab-body').innerHTML = `<div class="grid">
        <button class="btn" data-sab="luces" ${busy || s ? 'disabled' : ''}>💡 Apagar las luces${s ? ` (${s})` : ''}</button>
        <button class="btn" data-sab="reactor" ${busy || s ? 'disabled' : ''}>⚛️ Sobrecargar el reactor${s ? ` (${s})` : ''}</button></div>
        <h4>🚪 Cerrar las puertas de una sala ${dd ? `(${dd} s)` : ''}</h4>
        <div class="grid">${I.ROOMS.map(r => `<button class="btn ghost" data-door="${r.id}" ${dd ? 'disabled' : ''}>${esc(r.name)}</button>`).join('')}</div>
        <p class="mg-note">${busy ? 'Ya hay un sabotaje en marcha. ' : ''}Las puertas se cierran ${R.DOOR_CLOSE_S} s. Los sabotajes se recargan en ${R.SABOTAGE_CD_S} s.</p>`;
    };
    draw();
    clearInterval(sabTimer);
    sabTimer = setInterval(() => { if ($('ov-sab').classList.contains('hidden')) { clearInterval(sabTimer); return; } draw(); }, 500);
  }
  $('sab-body').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.sab) socket.emit('imp:act', { a: 'sabotage', kind: b.dataset.sab });
    if (b.dataset.door) socket.emit('imp:act', { a: 'sabotage', kind: 'puertas', room: b.dataset.door });
    show('ov-sab', false);
  });
  $('sab-x').addEventListener('click', () => show('ov-sab', false));

  // ---------------------------------------------------------------------------
  // Mapa
  // ---------------------------------------------------------------------------
  let mapBg = null;
  const MS = 12.6, MOX = 450 - ((I.BOUNDS.x0 + I.BOUNDS.x1) / 2) * 12.6, MOZ = 280;
  const mx = x => MOX + x * MS, mz = z => MOZ + z * MS;
  function buildMapBg() {
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 560;
    const c = cv.getContext('2d');
    c.fillStyle = '#0b1120'; c.fillRect(0, 0, 900, 560);
    // Silueta de huevo de la nave
    c.fillStyle = '#1a2236'; c.beginPath();
    for (let k = 0; k <= 120; k++) { const a = k / 120 * Math.PI * 2, rx = Math.cos(a) > 0 ? 36 : 40, rz = 23 * (1 + 0.1 * Math.cos(a)); const px = mx(-3 + Math.cos(a) * rx), pz = mz(Math.sin(a) * rz); k ? c.lineTo(px, pz) : c.moveTo(px, pz); }
    c.fill();
    I.CORRIDORS.forEach(([x0, z0, x1, z1]) => { c.fillStyle = '#4a5a78'; c.fillRect(mx(x0), mz(z0), (x1 - x0) * MS, (z1 - z0) * MS); });
    I.ROOMS.forEach(r => { const [x0, z0, x1, z1] = r.r; c.fillStyle = '#33456b'; c.fillRect(mx(x0), mz(z0), (x1 - x0) * MS, (z1 - z0) * MS); });
    c.fillStyle = '#8fa3c7';
    for (const b of world.boxes) {
      if (b.maxX - b.minX > 3 && b.maxZ - b.minZ > 3) continue;   // bloques de relleno: ya los pinta la silueta
      if (b.door || b.maxY < 1.2 || b.minY > 1.5 || b.minY < -0.1 && b.maxY < 0.1) continue;
      if (b.maxX - b.minX > 50 && b.maxZ - b.minZ > 30) continue;   // suelo y techo
      c.fillRect(mx(b.minX), mz(b.minZ), Math.max(1, (b.maxX - b.minX) * MS), Math.max(1, (b.maxZ - b.minZ) * MS));
    }
    c.font = 'bold 13px Nunito, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffffff';
    I.ROOMS.forEach(r => { const [x0, z0, x1, z1] = r.r; c.fillText(r.name.toUpperCase(), mx((x0 + x1) / 2), mz((z0 + z1) / 2) + 5); });
    return cv;
  }
  let mapTimer = null;
  function toggleMap() {
    if (!inGame || !world) return;
    const ov = $('ov-map');
    if (!ov.classList.contains('hidden')) { show(ov, false); return; }
    if (!$('ov-meet').classList.contains('hidden') || !$('ov-mg').classList.contains('hidden')) return;
    show(ov, true);          // el mapa no suelta el ratón: puedes seguir andando con él abierto
    drawMap();
    clearInterval(mapTimer);
    mapTimer = setInterval(() => { if (ov.classList.contains('hidden')) { clearInterval(mapTimer); return; } drawMap(); }, 200);
  }
  $('map-x').addEventListener('click', () => show('ov-map', false));
  function drawMap() {
    if (!mapBg) mapBg = buildMapBg();
    const c = $('map-cv').getContext('2d');
    c.drawImage(mapBg, 0, 0);
    const mark = (x, z, col, txt) => { c.fillStyle = col; c.beginPath(); c.arc(mx(x), mz(z), 8, 0, 7); c.fill(); if (txt) { c.fillStyle = '#000'; c.font = 'bold 12px Nunito'; c.textAlign = 'center'; c.fillText(txt, mx(x), mz(z) + 4); } };
    if (state === 'playing') {
      myTasks.filter(t => !t.done).forEach(t => { const s = I.STATION[t.id]; mark(s.x, s.z, '#ffd36b', '!'); });
      if (sab && sab.k === 'luces') mark(I.LIGHTS_PANEL.x, I.LIGHTS_PANEL.z, '#ff5a4e', '!');
      if (sab && sab.k === 'reactor') I.REACTOR_PADS.forEach(p => mark(p.x, p.z, '#ff5a4e', p.id));
      I.VENTS.forEach(v => { c.strokeStyle = '#b04cff'; c.lineWidth = 3; c.strokeRect(mx(v.x) - 6, mz(v.z) - 5, 12, 10); });
      for (const id of doorMeshes.keys()) { const d = I.DOORS.find(x => x.id === id); c.fillStyle = '#ff5a4e'; c.fillRect(mx(d.minX) - 2, mz(d.minZ) - 2, (d.maxX - d.minX) * MS + 4, (d.maxZ - d.minZ) * MS + 4); }
    }
    mark(I.BUTTON.x, I.BUTTON.z, '#e53935', '⏺');
    if (st) {
      const col = roster[me] ? colorOf(roster[me].color).hex : '#fff';
      c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.arc(mx(st.x), mz(st.z), 9, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(mx(st.x), mz(st.z)); c.lineTo(mx(st.x - Math.sin(cam.yaw) * 1.6), mz(st.z - Math.cos(cam.yaw) * 1.6)); c.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // Chat (vestíbulo, fin de partida y fantasmas) + chat de las reuniones
  // ---------------------------------------------------------------------------
  function canChat() { return state === 'lobby' || state === 'ended' || !alive; }
  function openChat() {
    if (!$('ov-meet').classList.contains('hidden')) { $('meet-in').focus(); return; }
    if (!canChat()) { toast('🤫 Sólo se habla en las reuniones'); return; }
    releasePointer();
    show('chat-in', true); $('chat-in').focus();
  }
  $('chat-in').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const v = $('chat-in').value.trim();
    if (v) socket.emit('player:chat', { message: v });
    $('chat-in').value = ''; $('chat-in').blur(); show('chat-in', false);
    e.stopPropagation();
  });
  $('meet-in').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const v = $('meet-in').value.trim();
    if (v) socket.emit('player:chat', { message: v });
    $('meet-in').value = '';
    e.stopPropagation();
  });
  socket.on('imp:chat', d => {
    const line = `${dot(d.color)} <b>${esc(d.name)}</b>: ${esc(d.msg)}`;
    for (const id of ['chat-log', 'meet-chat']) {
      const el = document.createElement('div');
      if (d.ghost) el.className = 'ghost';
      el.innerHTML = (d.ghost ? '👻 ' : '') + line;
      $(id).appendChild(el);
      while ($(id).children.length > 60) $(id).firstChild.remove();
      $(id).scrollTop = 1e6;
    }
    beep(700, 0.05, 'sine', 0.04);
  });

  // ---------------------------------------------------------------------------
  // Reuniones y votaciones
  // ---------------------------------------------------------------------------
  let meet = null, meetTimer = null;
  socket.on('imp:meeting', d => {
    closeAll();
    if (heldPad) { heldPad = null; }
    releasePointer();
    for (const [, b] of bodies) objRoot.remove(b.g);
    bodies.clear();
    meet = { by: d.by, body: d.body, voteAt: d.voteAt, endsAt: d.endsAt, alive: new Set(d.alive), dead: new Set(d.dead), voted: new Set(), my: null, sel: null, result: null };
    const caller = roster[d.by], bodyP = d.body && roster[d.body];
    $('meet-title').innerHTML = d.body ? `📢 ${caller ? dot(caller.color) + ' ' + esc(caller.name) : '?'} encontró el cuerpo de ${bodyP ? dot(bodyP.color) + ' ' + esc(bodyP.name) : 'alguien'}` : `🚨 ${caller ? dot(caller.color) + ' ' + esc(caller.name) : '?'} convocó una reunión de emergencia`;
    $('meet-chat').innerHTML = '';
    show('ov-meet', true); show('ov-eject', false);
    sfx.meeting();
    renderMeeting();
    clearInterval(meetTimer);
    meetTimer = setInterval(() => { if (!meet || $('ov-meet').classList.contains('hidden')) { clearInterval(meetTimer); return; } renderMeetTimer(); }, 250);
    setTimeout(() => $('meet-in').focus(), 200);
  });
  function renderMeetTimer() {
    if (!meet) return;
    const now = serverNow();
    if (meet.result) { $('meet-timer').textContent = 'Resultado de la votación'; return; }
    if (now < meet.voteAt) $('meet-timer').textContent = `🗣️ Debate: ${Math.ceil((meet.voteAt - now) / 1000)} s`;
    else $('meet-timer').textContent = `🗳️ Votación: ${Math.max(0, Math.ceil((meet.endsAt - now) / 1000))} s`;
    const canVote = meet.alive.has(me) && !meet.my && now >= meet.voteAt;
    $('meet-skip').disabled = !canVote;
    $('meet-note').textContent = !meet.alive.has(me) ? '👻 Los fantasmas no votan (y sólo los fantasmas leen tus mensajes)' : meet.my ? '✔ Has votado' : now < meet.voteAt ? 'Debatid antes de votar…' : 'Pulsa sobre un huevo para votarlo';
  }
  function renderMeeting() {
    if (!meet) return;
    const res = meet.result;
    const votersFor = t => res ? Object.keys(res.votes).filter(v => res.votes[v] === t) : [];
    $('meet-grid').innerHTML = rosterList.filter(p => meet.alive.has(p.id) || meet.dead.has(p.id)).map(p => {
      const dead = !meet.alive.has(p.id);
      const vs = votersFor(p.id);
      const imp = tabHeld && role === 'impostor' && impIds.includes(p.id);
      return `<div class="pcard ${dead ? 'dead' : ''} ${meet.sel === p.id ? 'sel' : ''} ${p.id === me ? 'me' : ''}" data-p="${esc(p.id)}">
        ${dot(p.color)}<span class="nm" ${imp ? 'style="color:#ff5a4e"' : ''}>${esc(p.name)}</span>
        ${meet.voted.has(p.id) && !res ? '<span class="badge">✔ votó</span>' : ''}
        ${meet.sel === p.id && !res ? '<button class="btn small confirm" data-confirm="1">Votar</button>' : ''}
        ${p.id === meet.by ? '<span class="badge" style="color:#ffd36b">📢</span>' : ''}
        <span class="votes">${vs.map(v => roster[v] ? dot(roster[v].color) : '').join('')}</span></div>`;
    }).join('');
    const sk = votersFor('skip');
    $('meet-skip').innerHTML = `⏭ Saltar voto${res ? ` <span class="votes">${sk.map(v => roster[v] ? dot(roster[v].color) : '').join('')}</span>` : ''}`;
    renderMeetTimer();
  }
  $('meet-grid').addEventListener('click', e => {
    if (!meet || meet.result || meet.my || !meet.alive.has(me) || serverNow() < meet.voteAt) return;
    if (e.target.closest('[data-confirm]')) { vote(meet.sel); return; }
    const c = e.target.closest('[data-p]');
    if (!c || !meet.alive.has(c.dataset.p)) return;
    meet.sel = meet.sel === c.dataset.p ? null : c.dataset.p;
    renderMeeting();
  });
  $('meet-skip').addEventListener('click', () => { if (meet && !meet.my) vote('skip'); });
  function vote(t) { if (!t) return; meet.my = t; meet.sel = null; socket.emit('imp:act', { a: 'vote', t }); sfx.click(); renderMeeting(); }
  socket.on('imp:voted', d => { if (meet) { meet.voted.add(d.id); renderMeeting(); beep(500, 0.05, 'square', 0.04); } });
  socket.on('imp:meeting-end', d => {
    if (!meet) return;
    meet.result = d;
    renderMeeting();
    setTimeout(() => {
      show('ov-meet', false);
      const ej = d.ejected && roster[d.ejected];
      $('eject-egg').innerHTML = ej ? `<span style="display:inline-block;width:70px;height:90px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:${colorOf(ej.color).hex};border:4px solid rgba(0,0,0,.4)"></span>` : '🌌';
      $('eject-txt').textContent = ej ? (d.wasImpostor === true ? `${ej.name} era un impostor.` : d.wasImpostor === false ? `${ej.name} no era un impostor.` : `${ej.name} fue expulsado.`) : (d.tie ? 'Empate: nadie fue expulsado.' : 'Nadie fue expulsado (se saltó el voto).');
      $('eject-sub').textContent = d.impostorsLeft === null ? '' : `Queda${d.impostorsLeft === 1 ? '' : 'n'} ${d.impostorsLeft} impostor${d.impostorsLeft === 1 ? '' : 'es'}.`;
      const egg = $('eject-egg'); egg.style.animation = 'none'; void egg.offsetWidth; egg.style.animation = '';
      show('ov-eject', true);
      meet = null;
    }, 3200);
  });
  socket.on('imp:resume', () => { show('ov-eject', false); show('ov-meet', false); meet = null; fakeKr = serverNow() + killCd * 1000; });

  socket.on('imp:over', d => {
    closeAll(); show('ov-meet', false); show('ov-eject', false); meet = null;
    releasePointer();
    const myRole = d.roles[me];
    const won = (d.winner === 'impostor') === (myRole === 'impostor');
    $('over-title').innerHTML = d.winner === 'impostor' ? '<span class="imp">VICTORIA DE LOS IMPOSTORES</span>' : '<span class="crew">VICTORIA DE LA TRIPULACIÓN</span>';
    $('over-reason').textContent = d.reason + (myRole && myRole !== 'spectator' ? (won ? ' · ¡Has ganado!' : ' · Has perdido') : '');
    $('over-list').innerHTML = Object.keys(d.roles).filter(id => d.roles[id] === 'impostor').map(id => roster[id] ? `<span>${dot(roster[id].color)} ${esc(roster[id].name)} <small class="imp">impostor</small></span>` : '').join('');
    $('over-title').innerHTML = d.winner === 'impostor' ? '<span class="imp">¡HUEVOS REVUELTOS!</span>' : '<span class="crew">¡HUEVOS A SALVO!</span>';
    show('ov-over', true);
    try { startEnding(d); } catch (e) { console.warn(e); }
    if (d.winner === 'impostor') { [0, 160, 320, 520].forEach((ms, i) => setTimeout(() => beep(320 - i * 40, 0.16, 'sawtooth', 0.07, -60), ms)); }
    else { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'triangle', 0.09), i * 130)); }
  });

  // ---------------------------------------------------------------------------
  // ESCENAS FINALES 3D
  // ---------------------------------------------------------------------------
  let ending = null;
  function stopEnding() {
    if (!ending) return;
    ending.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    ending = null;
  }
  function eggFor(id) {
    const r = roster[id] || { color: 0, custom: {} };
    const custom = Object.assign({}, r.custom || {}, { color: colorOf(r.color).hex }); delete custom.paint;
    return window.EggModel.create(custom, { weapon: null });
  }
  function startEnding(d) {
    stopEnding();
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
    const anim = [];
    const crewWin = d.winner !== 'impostor';
    sc.background = new THREE.Color(crewWin ? 0x0c1638 : 0x12051c);
    sc.add(new THREE.HemisphereLight(crewWin ? 0xfff4d6 : 0xc9a0ff, 0x221830, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(3, 8, 6); sc.add(sun);
    // estrellas
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 500; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.4 - 0.2, R = 60; sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25 })));
    // suelo: plataforma de la nave
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.4, 40), new THREE.MeshLambertMaterial({ color: crewWin ? 0x2b3b66 : 0x2a1638 }));
    floor.position.y = -0.2; sc.add(floor);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.12, 6, 60), new THREE.MeshBasicMaterial({ color: crewWin ? 0xffd23e : 0x8dff5a }));
    rim.rotation.x = Math.PI / 2; sc.add(rim);
    const ids = Object.keys(d.roles).filter(id => d.roles[id] !== 'spectator' && roster[id]);
    if (crewWin) {
      const live = ids.filter(id => d.roles[id] !== 'impostor' && d.alive && d.alive[id]);
      const dead = ids.filter(id => d.roles[id] !== 'impostor' && !(d.alive && d.alive[id]));
      // supervivientes en V, saltando
      live.forEach((id, i) => {
        const m = eggFor(id), side = i % 2 ? 1 : -1, row = Math.ceil(i / 2);
        m.root.position.set(side * row * 1.4, 0, -row * 1.1); m.root.rotation.y = Math.PI; sc.add(m.root);
        const ph = i * 0.6;
        anim.push(t => { const k = Math.abs(Math.sin(t * 3.2 + ph)); m.root.position.y = k * 0.9; m.body.scale.set(1 + (1 - k) * 0.08, 1 - (1 - k) * 0.08, 1 + (1 - k) * 0.08); m.update(t); });
      });
      // caídos: huevos fritos fantasma con aureola
      dead.forEach((id, i) => {
        const g = new THREE.Group();
        const white = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
        const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(colorOf(roster[id].color).hex).lerp(new THREE.Color(0xffc21a), 0.5), transparent: true, opacity: 0.7 }));
        yolk.position.z = 0.08; yolk.scale.z = 0.6;
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffe36a }));
        halo.position.y = 0.95; halo.rotation.x = Math.PI / 2;
        g.add(white, yolk, halo);
        const x = (i - (dead.length - 1) / 2) * 1.7;
        g.position.set(x, 3.3, -3.5); sc.add(g);
        anim.push(t => { g.position.y = 3.3 + Math.sin(t * 1.6 + i) * 0.25; g.rotation.z = Math.sin(t + i) * 0.15; halo.rotation.z = t; });
      });
      // confeti
      const cg = new THREE.BoxGeometry(0.12, 0.02, 0.08), conf = [];
      for (let i = 0; i < 90; i++) {
        const c = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: [0xffd23e, 0xff5ab0, 0x5ad2ff, 0x8dff5a][i % 4] }));
        c.position.set(Math.random() * 14 - 7, Math.random() * 8, Math.random() * 8 - 5); sc.add(c); conf.push(c);
      }
      anim.push(t => conf.forEach((c, i) => { c.position.y -= 0.03 + (i % 5) * 0.004; if (c.position.y < 0) c.position.y = 8; c.rotation.x += 0.08; c.rotation.z += 0.05; }));
      cam.position.set(0, 2.2, 7); cam.lookAt(0, 1.4, -1);
      anim.push(t => { cam.position.x = Math.sin(t * 0.3) * 1.5; cam.lookAt(0, 1.4, -1); });
    } else {
      const imps = ids.filter(id => d.roles[id] === 'impostor');
      imps.forEach((id, i) => {
        const m = eggFor(id), x = (i - (imps.length - 1) / 2) * 3;
        m.root.scale.setScalar(2); m.root.position.set(x, 0, 0); sc.add(m.root);
        // grietas
        const crack = new THREE.LineBasicMaterial({ color: 0x1a0a14 });
        for (let k = 0; k < 3; k++) {
          const pts = []; let px = -0.25 + k * 0.25, py = 1.25 + k * 0.1;
          for (let j = 0; j < 5; j++) { pts.push(new THREE.Vector3(px, py, -0.53)); px += (j % 2 ? 0.09 : -0.09); py -= 0.12; }
          m.body.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), crack));
        }
        // cejas enfadadas
        [-1, 1].forEach(sd => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x140810 })); b.position.set(sd * 0.15, 1.36, -0.5); b.rotation.z = sd * 0.45; m.body.add(b); });
        // espátula
        const sp = new THREE.Group();
        sp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), new THREE.MeshLambertMaterial({ color: 0x3a2618 })));
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.02), new THREE.MeshLambertMaterial({ color: 0xc8cdd8 })); blade.position.y = 0.6; sp.add(blade);
        sp.position.set(-0.7, 0.9, -0.2); m.root.add(sp);
        // aura verde/morada
        const aura = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14), new THREE.MeshBasicMaterial({ color: 0x9a4dff, transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false }));
        aura.position.y = 0.8; aura.scale.y = 1.35; m.root.add(aura);
        anim.push(t => { aura.material.color.setHSL(0.3 + 0.2 * (Math.sin(t * 2) * 0.5 + 0.5), 1, 0.55); aura.scale.setScalar(1 + Math.sin(t * 4) * 0.05); aura.scale.y *= 1.35; sp.rotation.z = Math.sin(t * 5) * 0.5; m.root.rotation.y = Math.PI + Math.sin(t * 0.8) * 0.3; m.root.position.y = Math.abs(Math.sin(t * 2.2)) * 0.15; m.update(t); });
      });
      // huevos revueltos en el suelo (los caídos)
      ids.filter(id => d.roles[id] !== 'impostor').forEach((id, i) => {
        const a = i * 1.3 + 0.5, R = 3.5 + (i % 2);
        const pd = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), new THREE.MeshLambertMaterial({ color: 0xfff3c4 })); pd.rotation.x = -Math.PI / 2;
        pd.position.set(Math.cos(a) * R, 0.02, Math.sin(a) * R * 0.6 + 1); sc.add(pd);
        const y = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffb21e })); y.scale.y = 0.4; y.position.copy(pd.position); y.position.y = 0.06; sc.add(y);
      });
      const gl = new THREE.PointLight(0x8dff5a, 2, 12); gl.position.set(0, 2, 2); sc.add(gl);
      anim.push(t => { gl.color.setHSL(0.3 + 0.2 * (Math.sin(t * 2) * 0.5 + 0.5), 1, 0.5); });
      cam.position.set(0, 1.6, 8); cam.lookAt(0, 2, 0);
      anim.push(t => { const k = Math.min(1, t / 3); cam.position.z = 8 - k * 2.5; cam.position.y = 1.6 - k * 0.6; cam.lookAt(0, 2, 0); });
    }
    ending = { scene: sc, cam, anim, t0: performance.now() };
  }

  // ---------------------------------------------------------------------------
  // MINIJUEGOS de las tareas (originales)
  // ---------------------------------------------------------------------------
  let mg = null;
  function openMinigame(id, type, title, real) {
    if (mg) closeMinigame();
    releasePointer();
    const t0 = performance.now();
    const min = id === 'fix_luces' ? 1000 : (I.MIN_MS[type] || 1000);
    mg = { id, type, real, cleanup: null, done: false };
    if (real) socket.emit('imp:act', { a: 'task-start', id });
    $('mg-title').textContent = title;
    const body = $('mg-body'); body.innerHTML = '';
    const finish = () => {
      if (!mg || mg.done) return;
      mg.done = true;
      celebrate();
      const wait = Math.max(750, min + 150 - (performance.now() - t0));
      setTimeout(() => {
        if (real) socket.emit('imp:act', { a: 'task-done', id });
        else if (role === 'impostor') {
          // Tarea falsificada: se tacha en tu lista (la barra común NO sube)
          const tk = myTasks.find(x => x.id === id); if (tk) tk.done = true;
          toast('✔ Tarea completada'); renderTasks();
        }
        if (!real || id === 'fix_luces') sfx.ok();
        closeMinigame();
      }, wait);
    };
    const st0 = I.STATION[id];
    if (role === 'impostor' && !real && id !== 'fix_luces') {
      // El impostor NO hace tareas: las falsifica (se queda delante haciendo como que trabaja)
      mg.cleanup = MG.falsificar(body, finish, min, title);
    } else {
      mg.cleanup = (MG[type] || MG.descarga)(body, finish, id === 'fix_luces', (st0 && st0.note) || '');
    }
    show('ov-mg', true);
  }
  // ¡Hecho!: el huevo se abre, sale un pollito y llueven huevos
  function celebrate() {
    const box = document.querySelector('.mg-box');
    const c = document.createElement('div'); c.className = 'mg-win';
    c.innerHTML = '<div class="mg-win-egg">🐣</div><div class="mg-win-txt">¡HECHO!</div>' + Array.from({ length: 14 }, (_, i) => `<i style="left:${5 + Math.random() * 90}%;animation-delay:${(Math.random() * 0.3).toFixed(2)}s">${['🥚', '🐣', '✨', '🍳'][i % 4]}</i>`).join('');
    box.appendChild(c);
    beep(523, 0.12, 'triangle', 0.1); setTimeout(() => beep(659, 0.12, 'triangle', 0.1), 90); setTimeout(() => beep(784, 0.25, 'triangle', 0.12), 180);
  }
  function shake() { const b = document.querySelector('.mg-box'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  function closeMinigame() {
    document.querySelectorAll('.mg-win').forEach(x => x.remove());
    if (!mg) { show('ov-mg', false); return; }
    try { if (mg.cleanup) mg.cleanup(); } catch (e) { /* */ }
    mg = null;
    show('ov-mg', false);
  }
  function closeMinigameIf(id) { if (mg && mg.id === id) closeMinigame(); }
  $('mg-x').addEventListener('click', closeMinigame);
  if (/[?&]mgtest/.test(location.search)) window.__imp = { socket, get st() { return st; }, get target() { return target; }, get state() { return state; } };
  if (/[?&]mgtest/.test(location.search)) window.__end = w => { const roles = {}, al = {}; roles[me] = w === 'impostor' ? 'impostor' : 'crew'; al[me] = true; Object.keys(roster).forEach((id, i) => { if (id !== me) { roles[id] = 'crew'; al[id] = i % 2 === 0; } }); startEnding({ winner: w, roles, alive: al }); return !!ending; };
  if (/[?&]mgtest/.test(location.search)) window.__mg = t => { openMinigame('test', t, t, false); const ok = !$('ov-mg').classList.contains('hidden') && $('mg-body').children.length > 0; closeMinigame(); return ok; };

  const rnd = n => Math.floor(Math.random() * n);
  const MG = {
    // Palanca: triturar cáscaras, batir claras, vaciar el cubo…
    palanca(body, done, _l, note) {
      body.innerHTML = `<p class="mg-note">${esc(note || 'Mantén pulsada la palanca.')}</p><div class="egg-row">${'🥚'.repeat(6)}</div><div class="lever"><i></i></div><div class="bar"><i></i></div>`;
      const lv = body.querySelector('.lever'), knob = lv.firstChild, bar = body.querySelector('.bar i'), row = body.querySelector('.egg-row');
      let p = 0, hold = false, last = performance.now(), raf, shown = -1;
      const loop = t => {
        const dt = (t - last) / 1000; last = t;
        p = Math.max(0, Math.min(1, p + (hold ? dt / 2.3 : -dt / 3)));
        bar.style.width = p * 100 + '%'; knob.style.top = (10 + (hold ? 100 : 0)) + 'px';
        const k = Math.round(p * 6); if (k !== shown) { shown = k; row.textContent = '🥚'.repeat(6 - k) + '💥'.repeat(k); }
        if (p >= 1) return done();
        raf = requestAnimationFrame(loop);
      };
      lv.addEventListener('pointerdown', () => { hold = true; sfx.click(); });
      const up = () => { hold = false; };
      window.addEventListener('pointerup', up);
      raf = requestAnimationFrame(loop);
      const fly = setInterval(() => {
        if (!hold) return;
        const f = document.createElement('span'); f.className = 'shell-fly'; f.textContent = ['🥚', '🐚', '💥'][rnd(3)];
        f.style.left = (40 + rnd(20)) + '%'; f.style.setProperty('--dx', (rnd(240) - 120) + 'px');
        body.appendChild(f); setTimeout(() => f.remove(), 900);
      }, 140);
      return () => { cancelAnimationFrame(raf); clearInterval(fly); window.removeEventListener('pointerup', up); };
    },
    // Descarga: recetas, selfies de huevos, cacareos…
    descarga(body, done, _l, note) {
      const jokes = ['Batiendo los bits…', 'Separando la clara de la yema…', 'Friendo paquetes de datos…', 'Pelando la conexión…', '¡Casi listo, no te escalfes!'];
      body.innerHTML = `<p class="mg-note">${esc(note || 'Pulsa y espera sin cerrar.')}</p><div class="belt"><div class="belt-in">${'🥚 🐣 🥚 🍳 '.repeat(8)}</div></div><button class="btn mg-big">🍳 Empezar</button><div class="bar egg" style="margin-top:14px"><i></i></div><p class="mg-note eta"></p>`;
      const bar = body.querySelector('.bar i'), eta = body.querySelector('.eta');
      let raf;
      body.querySelector('button').addEventListener('click', e => {
        e.target.disabled = true; sfx.click(); body.querySelector('.belt').classList.add('on');
        const t0 = performance.now();
        const loop = t => { const p = Math.min(1, (t - t0) / 6200); bar.style.width = p * 100 + '%'; eta.textContent = p < 1 ? `${jokes[Math.min(4, Math.floor(p * 5))]} (${Math.ceil((1 - p) * 6.2)} s)` : '¡Listo!'; if (p >= 1) return done(); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
      });
      return () => cancelAnimationFrame(raf);
    },
    // Deslizador: rumbo al gallinero, centrar la yema
    deslizador(body, done, _l, note) {
      const target = 15 + rnd(70);
      body.innerHTML = `<p class="mg-note">${esc(note || 'Lleva el control hasta la marca.')}</p><div class="target"><b style="left:${target}%"></b><span class="tgt-ic" style="left:${target}%">🐔</span></div><input type="range" class="slider egg" min="0" max="100" value="${target > 50 ? 3 : 97}"/><div class="bar"><i></i></div>`;
      const sl = body.querySelector('input'), bar = body.querySelector('.bar i');
      let ok = 0, last = performance.now(), raf;
      const loop = t => { const dt = (t - last) / 1000; last = t; const good = Math.abs(+sl.value - target) <= 3; ok = good ? ok + dt : 0; bar.style.width = Math.min(1, ok / 0.9) * 100 + '%'; if (ok >= 0.9) return done(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    },
    // Secuencia: la gallina cacarea y hay que imitarla
    secuencia(body, done, _l, note) {
      body.innerHTML = `<p class="mg-note">${esc(note || 'Repite la secuencia.')}</p><div class="simon">` + '<div>🥚</div>'.repeat(9) + '</div><p class="mg-note st"></p>';
      const cells = [...body.querySelectorAll('.simon div')], stl = body.querySelector('.st');
      const seq = Array.from({ length: 4 }, () => rnd(9));
      let pos = 0, showing = true, timers = [];
      const cluck = c => { beep(520 + c * 40, 0.07, 'square', 0.05, 380); setTimeout(() => beep(700 + c * 40, 0.06, 'square', 0.04, 500), 70); };
      const flash = (i, cls, ms) => { cells[i].classList.add(cls); cells[i].textContent = cls === 'lit' ? '🐔' : '🍳'; timers.push(setTimeout(() => { cells[i].classList.remove(cls); cells[i].textContent = '🥚'; }, ms)); };
      const play = () => { showing = true; pos = 0; stl.textContent = '¡Escucha a la gallina!'; seq.forEach((c, k) => timers.push(setTimeout(() => { flash(c, 'lit', 380); cluck(c); }, 600 + k * 560))); timers.push(setTimeout(() => { showing = false; stl.textContent = 'Tu turno: ¡cacarea!'; }, 600 + seq.length * 560)); };
      body.querySelector('.simon').addEventListener('click', e => {
        const i = cells.indexOf(e.target); if (i < 0 || showing) return;
        if (i === seq[pos]) { flash(i, 'lit', 200); cluck(i); if (++pos >= seq.length) { stl.textContent = '¡Cocococó! Perfecto'; showing = true; done(); } }
        else { flash(i, 'bad', 400); stl.textContent = 'Eso ha sonado a pato… otra vez'; sfx.bad(); timers.push(setTimeout(play, 900)); showing = true; }
      });
      play();
      return () => timers.forEach(clearTimeout);
    },
    // Interruptores: incubadoras (o los fusibles del gallinero cuando se van las luces)
    interruptores(body, done, lights, note) {
      const n = lights ? 5 : 6;
      const on = Array.from({ length: n }, () => Math.random() < 0.4);
      if (on.every(Boolean)) on[rnd(n)] = false;
      body.innerHTML = `<p class="mg-note">${lights ? 'Sube todos los fusibles para devolver la luz al gallinero.' : esc(note || 'Enciéndelo todo.')}</p><div class="switches">${on.map((v, i) => `<div class="sw ${v ? 'on' : ''}" data-i="${i}"><i></i><span>${v ? '🐣' : '🥚'}</span></div>`).join('')}</div>`;
      body.querySelector('.switches').addEventListener('click', e => {
        const sw = e.target.closest('.sw'); if (!sw) return;
        const i = +sw.dataset.i; on[i] = !on[i]; sw.classList.toggle('on', on[i]); sw.querySelector('span').textContent = on[i] ? '🐣' : '🥚'; sfx.click();
        if (on.every(Boolean)) done();
      });
      return null;
    },
    // Mantener: depósito de yema, regar el maíz, aceite de la freidora
    mantener(body, done, _l, note) {
      body.innerHTML = `<p class="mg-note">${esc(note || 'Mantén pulsado hasta llenarlo.')}</p><div class="bar yolk" style="height:60px;border-radius:12px"><i></i></div><button class="btn mg-big" style="margin-top:12px;width:100%">🫗 MANTENER</button>`;
      const btn = body.querySelector('button'), bar = body.querySelector('.bar i');
      let p = 0, hold = false, last = performance.now(), raf;
      const loop = t => { const dt = (t - last) / 1000; last = t; if (hold) p = Math.min(1, p + dt / 3.3); bar.style.width = p * 100 + '%'; if (p >= 1) return done(); raf = requestAnimationFrame(loop); };
      btn.addEventListener('pointerdown', () => { hold = true; });
      const up = () => { hold = false; };
      window.addEventListener('pointerup', up);
      raf = requestAnimationFrame(loop);
      return () => { cancelAnimationFrame(raf); window.removeEventListener('pointerup', up); };
    },
    // Código: la nevera de huevos / la incubadora
    codigo(body, done, _l, note) {
      const code = String(10000 + rnd(90000));
      body.innerHTML = `<p class="mg-note">${esc(note || 'Introduce el código.')}</p><div class="postit">📝 Pegado con un imán: <b>${code}</b></div><div class="code-in"></div><div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '✕', 0, '✔'].map(k => `<button class="btn ghost" data-k="${k}">${k}</button>`).join('')}</div>`;
      const inp = body.querySelector('.code-in');
      let v = '';
      body.querySelector('.keypad').addEventListener('click', e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        const k = b.dataset.k; sfx.click();
        if (k === '✕') v = '';
        else if (k === '✔') { if (v === code) return done(); sfx.bad(); v = ''; }
        else if (v.length < 5) v += k;
        inp.textContent = v;
        if (v === code) done();
      });
      return null;
    },
    // Calibrar: Radio Gallina / termómetros de la incubadora
    calibrar(body, done, _l, note) {
      body.innerHTML = `<p class="mg-note">${esc(note || 'Fija cada aguja en la zona verde.')}</p>` + [0, 1, 2].map(i => `<div class="dial" data-i="${i}"><div class="track"><div class="zone"></div><div class="needle"></div></div></div>`).join('') + '<button class="btn mg-big" style="width:100%">🎯 FIJAR</button>';
      const dials = [...body.querySelectorAll('.dial')].map((el, i) => { const z = 15 + rnd(60); el.querySelector('.zone').style.left = z + '%'; el.querySelector('.zone').style.width = '16%'; return { el, z, pos: 0, sp: 0.55 + i * 0.25, dir: 1 }; });
      let cur = 0, last = performance.now(), raf;
      const loop = t => {
        const dt = (t - last) / 1000; last = t;
        const d = dials[cur];
        if (d) { d.pos += d.dir * d.sp * dt * 100; if (d.pos > 98 || d.pos < 0) { d.dir *= -1; d.pos = Math.max(0, Math.min(98, d.pos)); } d.el.querySelector('.needle').style.left = d.pos + '%'; }
        raf = requestAnimationFrame(loop);
      };
      body.querySelector('button').addEventListener('click', () => {
        const d = dials[cur]; if (!d) return;
        if (d.pos >= d.z - 1 && d.pos <= d.z + 15) { d.el.classList.add('ok'); sfx.click(); cur++; if (cur >= dials.length) done(); }
        else sfx.bad();
      });
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    },
    // Cables → cada huevo a la huevera de su color
    cables(body, done, _l, note) {
      const cols = ['#e53935', '#1e5ae6', '#f5e43a', '#d040d0'];
      const right = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      body.innerHTML = `<p class="mg-note">${esc(note || 'Une cada uno con el de su color.')}</p><div class="wires"><svg></svg><div class="wcol l">${cols.map((c, i) => `<div class="wire egg" data-l="${i}" style="background:${c}"></div>`).join('')}</div><div class="wcol r">${right.map(i => `<div class="wire cup" data-r="${i}" style="border-color:${cols[i]}"></div>`).join('')}</div></div>`;
      const wrap = body.querySelector('.wires'), svg = body.querySelector('svg');
      let sel = null; const ok = new Set();
      const line = (a, b, c) => { const wr = wrap.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('x1', ra.right - wr.left); l.setAttribute('y1', ra.top + ra.height / 2 - wr.top); l.setAttribute('x2', rb.left - wr.left); l.setAttribute('y2', rb.top + rb.height / 2 - wr.top); l.setAttribute('stroke', c); l.setAttribute('stroke-width', 6); l.setAttribute('stroke-dasharray', '2 8'); l.setAttribute('stroke-linecap', 'round'); svg.appendChild(l); };
      svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
      wrap.addEventListener('click', e => {
        const w = e.target.closest('.wire'); if (!w || w.classList.contains('ok')) return;
        if (w.dataset.l !== undefined) { body.querySelectorAll('.wire.sel').forEach(x => x.classList.remove('sel')); sel = w; w.classList.add('sel'); sfx.click(); return; }
        if (!sel) return;
        if (w.dataset.r === sel.dataset.l) { line(sel, w, cols[+w.dataset.r]); sel.classList.add('ok'); w.classList.add('ok'); w.style.background = cols[+w.dataset.r]; sel.classList.remove('sel'); ok.add(+w.dataset.r); sel = null; sfx.click(); if (ok.size === 4) done(); }
        else { sfx.bad(); sel.classList.remove('sel'); sel = null; }
      });
      return null;
    },
    // Escáner: ¿crudo o cocido?
    escaner(body, done, _l, note) {
      const r = roster[me] || { name: '?', color: 0 };
      const res = ['Crudo, pero con mucho carácter', 'Pasado por agua', 'Cocido (10 minutos exactos)', 'Frito con puntilla', 'Escalfado y elegante'][rnd(5)];
      body.innerHTML = `<p class="mg-note">${esc(note || 'No te muevas.')}</p><div class="scan-card">${dot(r.color)} <b>${esc(r.name)}</b><br>Tamaño: ${'SMLX'[rnd(4)]}${rnd(2) ? 'L' : ''} · Yema: ${70 + rnd(30)} % · Caduca: el ${['lunes', 'martes', 'jueves', 'domingo'][rnd(4)]}<br><span class="scan-res"></span></div><div class="bar"><i></i></div><p class="mg-note eta"></p>`;
      const bar = body.querySelector('.bar i'), eta = body.querySelector('.eta'), out = body.querySelector('.scan-res');
      const t0 = performance.now(); let raf;
      const loop = t => { const p = Math.min(1, (t - t0) / 8200); bar.style.width = p * 100 + '%'; eta.textContent = p < 1 ? `Escaneando la yema… ${Math.ceil((1 - p) * 8.2)} s` : 'Escaneo completo'; if (p >= 1) { out.textContent = 'Resultado: ' + res; return done(); } raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    },
    // Granero: coger los huevos que van saliendo (¡sin tocar a las gallinas!)
    nidos(body, done, _l, note) {
      body.innerHTML = `<p class="mg-note">${esc(note || 'Coge los huevos.')}</p><div class="nests">${'<div class="nest"><span></span></div>'.repeat(6)}</div><p class="mg-note st">Huevos: 0 / 5</p>`;
      const nests = [...body.querySelectorAll('.nest')], stl = body.querySelector('.st');
      let got = 0, timers = [], dead = false;
      const spawn = () => {
        if (dead) return;
        const free = nests.filter(n => !n.dataset.k);
        if (free.length) {
          const n = free[rnd(free.length)], hen = Math.random() < 0.3;
          n.dataset.k = hen ? 'hen' : 'egg'; n.firstChild.textContent = hen ? '🐔' : '🥚';
          timers.push(setTimeout(() => { if (n.dataset.k) { delete n.dataset.k; n.firstChild.textContent = ''; } }, hen ? 1300 : 1100));
        }
        timers.push(setTimeout(spawn, 420 + rnd(260)));
      };
      body.querySelector('.nests').addEventListener('click', e => {
        const n = e.target.closest('.nest'); if (!n || !n.dataset.k) return;
        if (n.dataset.k === 'hen') { sfx.bad(); got = Math.max(0, got - 1); stl.textContent = '¡Picotazo! 🐔 Huevos: ' + got + ' / 5'; }
        else { got++; sfx.click(); stl.textContent = `Huevos: ${got} / 5`; }
        delete n.dataset.k; n.firstChild.textContent = '';
        if (got >= 5) { dead = true; stl.textContent = '¡Cesta llena! 🧺'; done(); }
      });
      spawn();
      return () => { dead = true; timers.forEach(clearTimeout); };
    },
    // Limpiar la clara: frotar con el ratón hasta borrar las manchas
    fregar(body, done, _l, note) {
      body.innerHTML = `<p class="mg-note">${esc(note || 'Frota las manchas.')}</p><canvas class="scrub" width="420" height="240"></canvas><div class="bar"><i></i></div>`;
      const cv = body.querySelector('canvas'), c = cv.getContext('2d'), bar = body.querySelector('.bar i');
      c.fillStyle = '#d9d2bd'; c.fillRect(0, 0, 420, 240);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { c.strokeStyle = '#c6bea6'; c.strokeRect(i * 70, j * 60, 70, 60); }
      const dirt = document.createElement('canvas'); dirt.width = 420; dirt.height = 240; const dc = dirt.getContext('2d');
      for (let k = 0; k < 7; k++) {
        const x = 50 + rnd(320), y = 40 + rnd(160), r = 25 + rnd(30);
        dc.fillStyle = 'rgba(250,248,235,.95)'; dc.beginPath(); dc.ellipse(x, y, r * 1.3, r, rnd(3), 0, 7); dc.fill();
        if (k % 2) { dc.fillStyle = '#ffc21a'; dc.beginPath(); dc.arc(x + 4, y - 3, r * 0.35, 0, 7); dc.fill(); }
      }
      const total = () => { const d = dc.getImageData(0, 0, 420, 240).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n; };
      const t0 = total();
      const draw = () => { c.fillStyle = '#d9d2bd'; c.fillRect(0, 0, 420, 240); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { c.strokeStyle = '#c6bea6'; c.strokeRect(i * 70, j * 60, 70, 60); } c.drawImage(dirt, 0, 0); };
      draw();
      let down = false, last = 0;
      const rub = e => {
        if (!down) return;
        const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 420 / r.width, y = (e.clientY - r.top) * 240 / r.height;
        dc.globalCompositeOperation = 'destination-out'; dc.beginPath(); dc.arc(x, y, 22, 0, 7); dc.fill(); dc.globalCompositeOperation = 'source-over';
        draw();
        const now = performance.now();
        if (now - last > 150) { last = now; const left = total() / t0; bar.style.width = Math.round((1 - left) * 100) + '%'; if (Math.random() < 0.3) beep(900 + rnd(300), 0.03, 'sine', 0.03); if (left < 0.06) { down = false; done(); } }
      };
      cv.addEventListener('pointerdown', e => { down = true; rub(e); });
      cv.addEventListener('pointermove', rub);
      const up = () => { down = false; };
      window.addEventListener('pointerup', up);
      return () => window.removeEventListener('pointerup', up);
    },
    // Empaquetar docena: arrastrar 12 huevos a la huevera (fuera de un hueco, se rompen)
    docena(body, done, _l, note) {
      body.innerHTML = `<p class="mg-note">${esc(note || 'Mete los huevos en la huevera.')}</p><div class="pack"><div class="pile"></div><div class="carton">${'<div class="hole"></div>'.repeat(12)}</div></div><p class="mg-note st">0 / 12 · rotos: 0</p>`;
      const pile = body.querySelector('.pile'), holes = [...body.querySelectorAll('.hole')], stl = body.querySelector('.st');
      let placed = 0, broken = 0, drag = null, ox = 0, oy = 0;
      const spawn = () => { const e = document.createElement('div'); e.className = 'pegg' + (Math.random() < 0.4 ? ' brown' : ''); pile.appendChild(e); };
      for (let i = 0; i < 4; i++) spawn();
      body.querySelector('.pack').addEventListener('pointerdown', e => {
        const t = e.target.closest('.pegg'); if (!t || t.parentNode !== pile) return;
        drag = t; const r = t.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top;
        t.classList.add('drag'); t.style.left = r.left + 'px'; t.style.top = r.top + 'px'; document.body.appendChild(t); e.preventDefault();
      });
      const move = e => { if (!drag) return; drag.style.left = (e.clientX - ox) + 'px'; drag.style.top = (e.clientY - oy) + 'px'; };
      const up = e => {
        if (!drag) return;
        const hole = holes.find(h => { const r = h.getBoundingClientRect(); return !h.firstChild && e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; });
        const t = drag; drag = null; t.classList.remove('drag'); t.style.left = t.style.top = '';
        if (hole) { hole.appendChild(t); placed++; sfx.click(); }
        else { t.remove(); broken++; sfx.bad(); }
        if (pile.children.length < 4 && placed + pile.children.length < 12) spawn();
        stl.textContent = `${placed} / 12 · rotos: ${broken}`;
        if (placed >= 12) done();
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.querySelectorAll('body > .pegg').forEach(x => x.remove()); };
    },
    // Impostor: no hace la tarea, la FALSIFICA (se queda delante «haciendo como que»)
    falsificar(body, done, ms) {
      const steps = ['Haciendo como que trabajas…', 'Pon cara de huevo inocente…', 'Mueve las manos con convicción…', 'Casi te lo crees tú…'];
      body.innerHTML = `<p class="mg-note">🎭 No puedes hacer tareas: quédate aquí <b>falsificándola</b> para disimular.</p><div class="bar"><i></i></div><p class="mg-note eta"></p>`;
      const bar = body.querySelector('.bar i'), eta = body.querySelector('.eta');
      const dur = Math.max(2500, ms + 800), t0 = performance.now(); let raf;
      const loop = t => { const p = Math.min(1, (t - t0) / dur); bar.style.width = p * 100 + '%'; eta.textContent = steps[Math.min(3, Math.floor(p * 4))]; if (p >= 1) return done(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    },
  };

  // ---------------------------------------------------------------------------
  // Bucle principal
  // ---------------------------------------------------------------------------
  let sendT = 0, lastSent = '';
  const perf = { n: 0, acc: 0, dpr: Math.min(window.devicePixelRatio, 1.25) };
  const QUAL = { v: store.get('imp_q', 'auto'), fps: store.get('imp_fps', false) };
  const Q_DPR = { hi: 1.5, mid: 1, lo: 0.65 };
  function qualityCap() { return QUAL.v === 'auto' ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, Q_DPR[QUAL.v] || 1); }
  function applyQuality() { if (!renderer) return; perf.dpr = qualityCap(); renderer.setPixelRatio(perf.dpr); }
  function frame() {
    requestAnimationFrame(frame);
    const pnow = performance.now();
    perf.n++; perf.acc += pnow - clock.last;
    if (perf.acc > 2000) {
      const fps = perf.n * 1000 / perf.acc; perf.n = 0; perf.acc = 0;
      if (QUAL.fps) setText($('fps'), Math.round(fps) + ' FPS · ' + perf.dpr.toFixed(2) + 'x');
      const base = qualityCap();
      if (QUAL.v !== 'auto') { /* calidad fija */ }
      else if (fps < 48 && perf.dpr > 0.6) { perf.dpr = Math.max(0.6, perf.dpr - 0.15); renderer.setPixelRatio(perf.dpr); }
      else if (fps > 58 && perf.dpr < base) { perf.dpr = Math.min(base, perf.dpr + 0.1); renderer.setPixelRatio(perf.dpr); }
    }
    const dt = Math.min(0.05, (pnow - clock.last) / 1000); clock.last = pnow;
    const t = (pnow - clock.t0) / 1000;
    if (ending) {
      if (state === 'lobby' || !inGame) stopEnding();
      else {
        const et = (pnow - ending.t0) / 1000;
        ending.cam.aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight; ending.cam.updateProjectionMatrix();
        ending.anim.forEach(f => f(et));
        renderer.render(ending.scene, ending.cam); return;
      }
    }
    if (!inGame || !st) { renderer.render(scene, camera); return; }
    if (watching && (state !== 'playing' || !alive || Math.hypot(st.x - I.CAM_PANEL.x, st.z - I.CAM_PANEL.z) > I.CAM_PANEL.r + 0.6)) setCams(false);
    const frozen = state === 'meeting' || state === 'ejecting' || !!inVent || watching || anyOverlay() || typing();
    const locked = document.pointerLockElement === renderer.domElement;
    let fwd = 0, side = 0;
    if (!frozen && locked) {
      if (keys.KeyW || keys.ArrowUp) fwd += 1;
      if (keys.KeyS || keys.ArrowDown) fwd -= 1;
      if (keys.KeyD || keys.ArrowRight) side += 1;
      if (keys.KeyA || keys.ArrowLeft) side -= 1;
    }
    const ghost = !alive && state !== 'lobby' && state !== 'ended';
    if (ghost) {
      // Fantasma: vuela a ras de suelo atravesando paredes
      const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
      let wx = -sy * fwd + cy * side, wz = -cy * fwd - sy * side;
      const l = Math.hypot(wx, wz); if (l > 1) { wx /= l; wz /= l; }
      const sp = P.SPEED * 0.85;
      const B = I.BOUNDS;
      st.x = Math.max(B.x0 + 0.6, Math.min(B.x1 - 0.6, st.x + wx * sp * dt));
      st.z = Math.max(B.z0 + 0.6, Math.min(B.z1 - 0.6, st.z + wz * sp * dt));
      st.y = 0;
    } else if (!frozen || state === 'lobby') {
      Phys.simulate(world, st, { yaw: cam.yaw, fwd: fwd * R.SPEED_MUL, side: side * R.SPEED_MUL, jump: !frozen && locked && !!keys.Space }, dt);
    }
    // Desatascador: si por lo que sea el huevo queda dentro de algo sólido, se le saca
    if (alive && !inVent && Phys.blockedAt(world, st.x, st.y + 0.06, st.z)) {
      frame.stuck = (frame.stuck || 0) + dt;
      if (frame.stuck > 0.35) {
        frame.stuck = 0;
        outer: for (let r = 0.25; r <= 3; r += 0.25) for (let a = 0; a < 16; a++) {
          const x = st.x + Math.cos(a * Math.PI / 8) * r, z = st.z + Math.sin(a * Math.PI / 8) * r;
          if (!Phys.blockedAt(world, x, 0.06, z)) { st.x = x; st.z = z; st.y = 0; st.vx = st.vz = 0; break outer; }
        }
      }
    } else frame.stuck = 0;
    // Enviar posición (20 Hz)
    sendT += dt;
    if (sendT >= 0.05) {
      sendT = 0;
      const pkt = { x: +st.x.toFixed(3), y: +st.y.toFixed(3), z: +st.z.toFixed(3), rotX: +cam.pitch.toFixed(2), rotY: +cam.yaw.toFixed(2) };
      const key = pkt.x + ',' + pkt.y + ',' + pkt.z + ',' + pkt.rotY;
      if (key !== lastSent) { lastSent = key; socket.emit('player:move', pkt); }
    }
    // Cámara
    camera.position.set(st.x, st.y + (inVent ? 0.45 : P.EYE), st.z);
    camera.rotation.set(cam.pitch, cam.yaw, 0);
    // Visión (niebla): menos con las luces apagadas, más para el impostor, total para los fantasmas
    // Misma visión en pantalla para impostores y tripulantes (que no se note mirando la pantalla)
    let vis = R.VISION;
    if (state === 'playing' && sab && sab.k === 'luces') vis = R.VISION_DARK;
    if (ghost || state === 'lobby' || state === 'ended') vis = 60;
    const fog = scene.fog;
    fog.far += (vis - fog.far) * Math.min(1, dt * 2.5);
    fog.near = fog.far * 0.45;
    // Huevos remotos (interpolación + bamboleo al andar)
    const now = performance.now();
    for (const [id, o] of others) {
      const visible = now - o.seen < 300;
      o.m.root.visible = visible;
      if (!visible) continue;
      // Se dibuja 100 ms «en el pasado» interpolando entre dos instantáneas del servidor
      const px = o.x, pz = o.z;
      const rt = serverNow() - 100, B = o.buf || [];
      let done = false;
      for (let i = B.length - 1; i > 0; i--) {
        if (B[i - 1][0] <= rt && rt <= B[i][0]) {
          const a = B[i - 1], b = B[i], f = (rt - a[0]) / Math.max(1, b[0] - a[0]);
          o.x = a[1] + (b[1] - a[1]) * f; o.y = a[2] + (b[2] - a[2]) * f; o.z = a[3] + (b[3] - a[3]) * f;
          let dr = b[4] - a[4]; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
          o.ry = a[4] + dr * f; done = true; break;
        }
      }
      if (!done) {
        const k = Math.min(1, dt * 12);
        o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k;
        let dr = o.try - o.ry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
        o.ry += dr * k;
      }
      const mv = Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 0.001) * 0.05;
      o.walk += mv > 0.02 ? dt * 10 : 0;
      o.m.root.position.set(o.x, o.y + (o.ghost ? 0.25 + Math.sin(t * 2 + o.x) * 0.08 : 0), o.z);
      o.m.root.rotation.y = o.ry;
      o.m.body.position.y = mv > 0.02 ? Math.abs(Math.sin(o.walk)) * 0.08 : 0;
      o.m.body.rotation.z = mv > 0.02 ? Math.sin(o.walk) * 0.08 : 0;
      o.m.update(t);
    }
    // Indicadores
    const playing = state === 'playing';
    const undone = new Set(playing ? myTasks.filter(x => !x.done).map(x => x.id) : []);
    I.STATIONS.forEach(s => { const m = markers[s.id]; m.visible = undone.has(s.id); if (m.visible) { m.children[0].position.y = Math.sin(t * 3) * 0.1; } });
    markers.luces.visible = playing && !!(sab && sab.k === 'luces') && alive;
    I.REACTOR_PADS.forEach(p => { markers['pad' + p.id].visible = playing && !!(sab && sab.k === 'reactor') && alive; });
    window.MapRenderer.animate(t);
    computeTargets();
    updateButtons();
    const free = inGame && !locked && !anyOverlay() && !typing() && !inVent && !watching && !tabHeld && performance.now() > startScreenUntil;
    // Al cerrarse una tarea/reunión/cámaras, recuperar el ratón automáticamente
    if (free && !frame.wasFree && !userPaused) lockPointer();
    frame.wasFree = free;
    const wantClick = free && userPaused;
    show('ov-resume', free && !userPaused);
    if (wantClick !== frame.click) {
      frame.click = wantClick; show('ov-click', wantClick);
      if (wantClick) $('pz-state').textContent = state === 'lobby' ? 'Vestíbulo · ' + roomTitle(roomInfo) : state === 'playing' ? 'La partida sigue mientras estás en pausa' : '';
    }
    if (watching) renderCams(); else renderer.render(scene, camera);
  }
  // 4 cámaras a la vez (pantalla partida); niebla más larga para ver los pasillos
  function renderCams() {
    const W = renderer.domElement.clientWidth, Hh = renderer.domElement.clientHeight;
    const f0 = scene.fog.far, n0 = scene.fog.near, a0 = camera.aspect;
    scene.fog.far = 26; scene.fog.near = 10;
    renderer.setScissorTest(true);
    camera.aspect = W / Hh; camera.updateProjectionMatrix();
    I.CAMS.forEach((c, i) => {
      const x = (i % 2) * W / 2, y = (i < 2 ? Hh / 2 : 0);
      renderer.setViewport(x + 2, y + 2, W / 2 - 4, Hh / 2 - 4); renderer.setScissor(x + 2, y + 2, W / 2 - 4, Hh / 2 - 4);
      camera.position.set(c.x, c.y - 0.3, c.z); camera.rotation.set(-0.32, c.yaw, 0);
      renderer.render(scene, camera);
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, Hh);
    camera.aspect = a0; camera.updateProjectionMatrix();
    scene.fog.far = f0; scene.fog.near = n0;
  }
})();
