// ============================================================================
// public/js/client.js — Lógica principal de Shell Shockers, red y ciclo de juego
// Integración modular de Renderer, Controls, UI y Audio
// ============================================================================

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. CONFIGURACIÓN Y ESTADO
  // ---------------------------------------------------------------------------
  const MOVE_SPEED_MAX    = 7.6;
  const ACCELERATION      = 52.0;
  const FRICTION          = 15.0;
  const CLIMB_SPEED       = 4.8;
  const JUMP_VELOCITY     = 9.6;
  let   GRAVITY           = -24.0;
  const PLAYER_RADIUS     = 0.52;
  const PLAYER_HEIGHT     = 1.6;
  const LERP_FACTOR       = 0.22;
  const GRENADE_CD_MS     = 7000;

  const WEAPONS = {
    rifle:   { name: 'EggK-47',     cooldown: 110,  pellets: 1, spread: 0.014,  maxAmmo: 30, reloadTime: 1350, tracerColor: 0xffdd00, tracerWidth: 1.5 },
    shotgun: { name: 'Scrambler',   cooldown: 750,  pellets: 6, spread: 0.075,  maxAmmo: 6,  reloadTime: 1700, tracerColor: 0xff6b35, tracerWidth: 2 },
    sniper:  { name: 'Free RANGER', cooldown: 1300, pellets: 1, spread: 0.0008, maxAmmo: 5,  reloadTime: 2100, tracerColor: 0x00d2d3, tracerWidth: 3.5 },
  };
  const WEAPON_KEYS = ['rifle', 'shotgun', 'sniper'];

  let socket = null;
  let myId = null;
  let myTeam = null;
  let isInGame = false;
  let isAlive = true;
  let myHP = 100;
  let myKills = 0;
  let myDeaths = 0;

  let currentWeapon = 'rifle';
  let lastShootTime = 0;
  let lastGrenadeTime = 0;
  const ammoState = { rifle: 30, shotgun: 6, sniper: 5 };
  let isReloading = false;
  let reloadTimeout = null;

  // Físicas y movimiento
  const localPos = new THREE.Vector3(0, 0, 0);
  const velocityXZ = new THREE.Vector2(0, 0);
  let velocityY = 0;
  let isOnGround = true;
  let isOnLadder = false;

  const mapColliders = [];
  const mapLadders   = [];
  const remotePlayers = {};
  const activeGrenades = {};
  let currentConfig = { mode: 'ffa', map: 'dirt', killLimit: 25 };

  // ---------------------------------------------------------------------------
  // 2. EFECTOS DE AUDIO WEB AUDIO API
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
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
      } else if (type === 'hit') {
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
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // 3. MAPAS Y FÍSICAS AABB
  // ---------------------------------------------------------------------------
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
    });
  }

  function checkLadderTrigger(pos) {
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

  function getRaycastGroundHeight(pos) {
    let groundY = 0;
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
  }

  function clearMapMemory() {
    const scene = window.GameRenderer.getScene();
    const root = window.GameRenderer.getMapRoot();

    // Eliminar del root
    if (root) {
      while (root.children.length > 0) {
        const obj = root.children[0];
        root.remove(obj);
        if (scene && obj.parent === scene) scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      }
    }

    mapColliders.length = 0;
    mapLadders.length = 0;
  }

  function loadMap(mapName) {
    clearMapMemory();
    const scene = window.GameRenderer.getScene();
    const root = window.GameRenderer.getMapRoot();

    if (window.GameMaps && window.GameMaps.buildMap && scene && root) {
      window.GameMaps.buildMap(mapName, scene, root, addCollider, addLadder);
      console.log(`[MAP] Mapa cargado: "${mapName}" | Objetos creados en escena: ${scene.children.length} | Colisionadores: ${mapColliders.length}`);
    } else {
      console.warn('[MAP] Error: GameMaps o Scene no están listos');
    }

    if (mapName === 'space') {
      GRAVITY = -11.0;
    } else {
      GRAVITY = -24.0;
    }
    currentConfig.map = mapName;
    updateLobbyUI();
  }

  // ---------------------------------------------------------------------------
  // 4. SISTEMA DE DISPARO, RECOIL Y ARMAS
  // ---------------------------------------------------------------------------
  function shoot() {
    const now = Date.now();
    const config = WEAPONS[currentWeapon];
    if (now - lastShootTime < config.cooldown) return;
    if (ammoState[currentWeapon] <= 0) {
      reloadWeapon();
      return;
    }

    lastShootTime = now;
    ammoState[currentWeapon]--;
    window.GameUI.updateAmmo(ammoState[currentWeapon], config.maxAmmo, config.name, isReloading);

    playSound(currentWeapon);
    window.GameRenderer.triggerRecoil(currentWeapon);

    const camera = window.GameRenderer.getCamera();
    const activeHitboxes = getActiveHitboxes();
    const targetsHit = [];
    const isAiming = window.GameControls.isAiming();
    const spreadMultiplier = isAiming ? 0.35 : 1.0;

    for (let p = 0; p < config.pellets; p++) {
      const raycaster = new THREE.Raycaster();
      const spreadX = (Math.random() - 0.5) * config.spread * spreadMultiplier;
      const spreadY = (Math.random() - 0.5) * config.spread * spreadMultiplier;

      const dir = new THREE.Vector3(spreadX, spreadY, -1).normalize();
      dir.applyQuaternion(camera.quaternion);
      raycaster.set(camera.position, dir);

      window.GameRenderer.createTracer(camera.position, dir, config.tracerColor, config.tracerWidth);

      const intersects = raycaster.intersectObjects(activeHitboxes.map(h => h.mesh), false);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitObj = hit.object;
        const matched = activeHitboxes.find(h => h.mesh === hitObj);
        if (matched) {
          const isHeadshot = (hitObj.name === 'hitbox-head');
          targetsHit.push({ id: matched.id, headshot: isHeadshot });
          window.GameUI.triggerHitmarker(isHeadshot);
          playSound(isHeadshot ? 'headshot' : 'hit');
          window.GameRenderer.createHitSpark(hit.point);
        }
      }
    }

    if (targetsHit.length > 0 && socket) {
      socket.emit('player:shoot', { targets: targetsHit });
    }
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

  function reloadWeapon() {
    const config = WEAPONS[currentWeapon];
    if (isReloading || ammoState[currentWeapon] >= config.maxAmmo) return;

    isReloading = true;
    playSound('reload');
    window.GameUI.updateAmmo(ammoState[currentWeapon], config.maxAmmo, config.name, true);

    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
      ammoState[currentWeapon] = config.maxAmmo;
      isReloading = false;
      window.GameUI.updateAmmo(ammoState[currentWeapon], config.maxAmmo, config.name, false);
    }, config.reloadTime);
  }

  function selectWeapon(wepKey) {
    if (!WEAPONS[wepKey]) return;
    currentWeapon = wepKey;
    window.GameRenderer.setWeapon(wepKey);

    document.querySelectorAll('.weapon-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.weapon === wepKey);
    });

    window.GameUI.updateAmmo(ammoState[currentWeapon], WEAPONS[currentWeapon].maxAmmo, WEAPONS[currentWeapon].name, isReloading);

    if (socket && isInGame) {
      socket.emit('player:weapon-switch', { weapon: wepKey });
    }
  }

  function throwGrenade() {
    const now = Date.now();
    if (now - lastGrenadeTime < GRENADE_CD_MS) return;
    lastGrenadeTime = now;

    const camera = window.GameRenderer.getCamera();
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(camera.quaternion);

    if (socket) {
      socket.emit('player:grenade-throw', {
        dirX: dir.x,
        dirY: dir.y + 0.22,
        dirZ: dir.z,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. RED Y COMUNICACIÓN SOCKET.IO
  // ---------------------------------------------------------------------------
  function initNetworking() {
    socket = io();

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
      window.GameUI.addFeedItem(`🥚 <strong>${window.GameUI.escapeHtml(playerData.nickname)}</strong> entró a la arena`);
    });

    socket.on('player:left', (data) => {
      const rp = remotePlayers[data.id];
      if (rp) window.GameUI.addFeedItem(`👋 <strong>${window.GameUI.escapeHtml(rp.nickname)}</strong> salió`);
      removeRemotePlayer(data.id);
    });

    socket.on('game:state', (state) => {
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
          window.GameRenderer.getScene().add(gMesh);
          activeGrenades[gid] = { mesh: gMesh };
        }
        activeGrenades[gid].mesh.position.set(sg.x, sg.y, sg.z);
      }

      for (const gid in activeGrenades) {
        if (!state.grenades[gid]) {
          window.GameRenderer.getScene().remove(activeGrenades[gid].mesh);
          delete activeGrenades[gid];
        }
      }

      window.GameUI.updateScoreboard(state.players, myId);

      if (currentConfig.mode === 'tdm' && state.teamScores) {
        window.GameUI.dom.teamScoreEl.classList.remove('hidden');
        window.GameUI.dom.teamRedScoreEl.textContent = state.teamScores.red;
        window.GameUI.dom.teamBlueScoreEl.textContent = state.teamScores.blue;
      } else {
        window.GameUI.dom.teamScoreEl.classList.add('hidden');
      }
    });

    socket.on('player:hit', (data) => {
      if (data.targetId === myId) {
        myHP = Math.max(0, data.hp);
        window.GameUI.updateHealth(myHP);
        window.GameUI.triggerDamageFlash();
      }
    });

    socket.on('player:killed', (data) => {
      const wepName = (WEAPONS[data.weapon] && WEAPONS[data.weapon].name) || (data.weapon ? data.weapon.toUpperCase() : 'ARMA');
      const hsBadge = data.headshot ? ' 🎯 [HEADSHOT]' : '';
      window.GameUI.addFeedItem(`<span>${window.GameUI.escapeHtml(data.killerNickname)}</span> [${wepName}]${hsBadge} ➔ <span>${window.GameUI.escapeHtml(data.targetNickname)}</span>`);

      if (data.targetId === myId) {
        isAlive = false;
        myDeaths++;
        window.GameUI.dom.deathCountEl.textContent = myDeaths;
        window.GameUI.dom.killedByText.textContent = `Eliminado por: ${data.killerNickname} (${wepName})${data.headshot ? ' [HEADSHOT!]' : ''}`;
        window.GameUI.dom.deathOverlay.classList.remove('hidden');
      }

      if (data.killerId === myId) {
        myKills++;
        window.GameUI.dom.killCountEl.textContent = myKills;
        window.GameUI.showToast(data.headshot ? '🎯 HEADSHOT!' : '💥 ¡ELIMINACIÓN!');
        playSound('kill');
      }
    });

    socket.on('player:respawn', (data) => {
      if (data.id === myId) {
        localPos.set(data.x, data.y, data.z);
        velocityY = 0;
        myHP = 100;
        isAlive = true;
        window.GameUI.dom.deathOverlay.classList.add('hidden');
        window.GameUI.updateHealth(myHP);
      }
    });

    socket.on('grenade:explode', (data) => {
      playSound('explosion');
      window.GameRenderer.createExplosion(data.x, data.y, data.z);
    });

    socket.on('player:chat', (data) => {
      if (data.id === myId) {
        window.GameUI.showToast(`"${data.message}"`);
      } else if (remotePlayers[data.id]) {
        showRemoteSpeechBubble(data.id, data.message);
      }
      window.GameUI.addFeedItem(`💬 <strong>${window.GameUI.escapeHtml(data.nickname)}</strong>: ${window.GameUI.escapeHtml(data.message)}`);
    });

    socket.on('player:emote', (data) => {
      triggerEmote(data.id);
    });

    socket.on('game:over', (data) => {
      window.GameUI.dom.gameoverText.textContent = data.reason;
      window.GameUI.dom.gameoverOverlay.classList.remove('hidden');
      setTimeout(() => { window.GameUI.dom.gameoverOverlay.classList.add('hidden'); }, 3500);
    });
  }

  function addRemotePlayer(playerData) {
    if (playerData.id === myId) return;
    const mesh = window.GameRenderer.createPlayerAvatar(playerData, currentConfig.mode);
    mesh.position.set(playerData.x || 0, playerData.y || 0, playerData.z || 0);
    window.GameRenderer.getScene().add(mesh);

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
      window.GameRenderer.getScene().remove(rp.mesh);
      delete remotePlayers[id];
    }
  }

  function showRemoteSpeechBubble(id, text) {
    const rp = remotePlayers[id];
    if (!rp || !rp.mesh) return;

    const oldBubble = rp.mesh.getObjectByName('speech-bubble');
    if (oldBubble) rp.mesh.remove(oldBubble);

    const bubble = window.GameRenderer.createSpeechBubble(text);
    bubble.name = 'speech-bubble';
    rp.mesh.add(bubble);

    setTimeout(() => {
      if (bubble.parent) bubble.parent.remove(bubble);
    }, 4000);
  }

  function triggerEmote(id) {
    if (id === myId) {
      window.GameUI.showToast('🎉 ¡EMOTE!');
      playSound('cluck');
    } else if (remotePlayers[id]) {
      const rp = remotePlayers[id];
      rp.isEmoting = true;
      rp.emoteTimer = 0;
    }
  }

  function updateLobbyUI() {
    const mapNames = { dirt: 'Dirt', space: 'Space', fort: 'Fort' };
    const title = mapNames[currentConfig.map] || currentConfig.map;
    if (window.GameUI.dom.configStatus) {
      window.GameUI.dom.configStatus.textContent = `Modo: ${currentConfig.mode.toUpperCase()} • Mapa: ${title}`;
    }

    document.querySelectorAll('.shell-map-card').forEach(card => {
      card.classList.toggle('active', card.dataset.map === currentConfig.map);
    });
    document.querySelectorAll('.mode-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.mode === currentConfig.mode);
    });
  }

  // ---------------------------------------------------------------------------
  // 6. ACTUALIZACIÓN DE FÍSICAS Y MOVIMIENTO LOCAL
  // ---------------------------------------------------------------------------
  function updateMovement(delta) {
    const activeLadder = checkLadderTrigger(localPos);
    isOnLadder = !!activeLadder;

    const forward = new THREE.Vector3(0, 0, -1);
    const right   = new THREE.Vector3(1, 0, 0);
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), window.GameControls.getYaw());
    forward.applyQuaternion(yawQuat);
    right.applyQuaternion(yawQuat);

    const wishDir = new THREE.Vector3(0, 0, 0);
    const keys = window.GameControls.keys;
    if (keys['KeyW'] || keys['ArrowUp'])    wishDir.add(forward);
    if (keys['KeyS'] || keys['ArrowDown'])  wishDir.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft'])  wishDir.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) wishDir.add(right);

    // MODO ESCALERA
    if (isOnLadder) {
      let ladderVelocityY = 0;
      if (keys['KeyW'] || keys['ArrowUp'] || keys['Space']) ladderVelocityY = CLIMB_SPEED;
      else if (keys['KeyS'] || keys['ArrowDown']) ladderVelocityY = -CLIMB_SPEED;

      if (keys['Space'] && (keys['KeyS'] || keys['KeyA'] || keys['KeyD'])) {
        velocityY = JUMP_VELOCITY * 0.8;
        isOnLadder = false;
        playSound('jump');
      } else {
        velocityY = ladderVelocityY;
      }

      let lateralMove = 0;
      if (keys['KeyA'] || keys['ArrowLeft'])  lateralMove -= 2.0;
      if (keys['KeyD'] || keys['ArrowRight']) lateralMove += 2.0;

      localPos.x += right.x * lateralMove * delta;
      localPos.z += right.z * lateralMove * delta;
      localPos.y += velocityY * delta;

      const gH = getRaycastGroundHeight(localPos);
      if (localPos.y < gH) {
        localPos.y = gH;
        velocityY = 0;
        isOnGround = true;
      }
      resolveCollisions(localPos, PLAYER_RADIUS);
      return;
    }

    // MODO CAMINAR / INERCIA
    if (wishDir.lengthSq() > 0) {
      wishDir.normalize();
      const targetVx = wishDir.x * MOVE_SPEED_MAX;
      const targetVz = wishDir.z * MOVE_SPEED_MAX;
      velocityXZ.x = THREE.MathUtils.lerp(velocityXZ.x, targetVx, ACCELERATION * delta * 0.1);
      velocityXZ.y = THREE.MathUtils.lerp(velocityXZ.y, targetVz, ACCELERATION * delta * 0.1);
    } else {
      velocityXZ.x = THREE.MathUtils.lerp(velocityXZ.x, 0, FRICTION * delta);
      velocityXZ.y = THREE.MathUtils.lerp(velocityXZ.y, 0, FRICTION * delta);
    }

    localPos.x += velocityXZ.x * delta;
    localPos.z += velocityXZ.y * delta;

    if (keys['Space'] && isOnGround) {
      velocityY = JUMP_VELOCITY;
      isOnGround = false;
      playSound('jump');
    }

    velocityY += GRAVITY * delta;
    localPos.y += velocityY * delta;

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

  // ---------------------------------------------------------------------------
  // 7. BUCLE PRINCIPAL (GAME LOOP A 60 FPS)
  // ---------------------------------------------------------------------------
  let lastSendPosTime = 0;

  function gameLoop() {
    requestAnimationFrame(gameLoop);
    const delta = window.GameRenderer.getDelta();

    if (isInGame && isAlive && !window.GameUI.dom.pauseOverlay.classList.contains('hidden') === false) {
      // Disparo automático continuado si es rifle
      if (window.GameControls.isMouseDown() && currentWeapon === 'rifle' && window.GameControls.isPointerLocked()) {
        shoot();
      }

      updateMovement(delta);

      const isMoving = velocityXZ.lengthSq() > 0.5 && isOnGround;
      window.GameRenderer.updateCameraAndHands(
        delta,
        localPos,
        window.GameControls.getPitch(),
        window.GameControls.getYaw(),
        window.GameControls.isAiming(),
        currentWeapon,
        isMoving
      );

      // Red a 30 FPS
      const now = Date.now();
      if (now - lastSendPosTime > 33 && socket) {
        lastSendPosTime = now;
        socket.emit('player:move', {
          x: localPos.x, y: localPos.y, z: localPos.z,
          rotX: window.GameControls.getPitch(),
          rotY: window.GameControls.getYaw(),
        });
      }
    }

    // Cooldown de granada visual
    const now = Date.now();
    const elapsed = now - lastGrenadeTime;
    window.GameUI.updateGrenadeCooldown(Math.min(1.0, elapsed / GRENADE_CD_MS));

    // LERP y animación de jugadores remotos
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      if (!rp.mesh.visible) continue;

      rp.mesh.position.lerp(rp.targetPos, LERP_FACTOR);

      const curY = rp.mesh.rotation.y;
      let diffY = rp.targetRotY - curY;
      while (diffY > Math.PI) diffY -= Math.PI * 2;
      while (diffY < -Math.PI) diffY += Math.PI * 2;
      rp.mesh.rotation.y = curY + diffY * LERP_FACTOR;

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
        rp.bodyGroup.position.y = Math.sin(rp.animTime * 0.6) * 0.03;
      }
    }

    // Renderizado de la vista previa 3D rotatoria en el menú
    if (!isInGame) {
      window.GameRenderer.renderPreview(delta);
    }

    window.GameRenderer.render();
  }

  // ---------------------------------------------------------------------------
  // 8. INICIALIZACIÓN COMPLETA
  // ---------------------------------------------------------------------------
  function main() {
    window.GameRenderer.init();

    // Actualización de la Vista Previa 3D al cambiar cualquier parámetro
    function refreshCustomizationPreview() {
      const color = window.GameUI.dom.colorPicker.value;
      const hat = window.GameUI.dom.hatSelect.value;
      const glasses = window.GameUI.dom.glassesSelect.value;
      const textureData = window.GameUI.getCustomTextureDataURL();
      window.GameRenderer.updatePreviewAvatar({ color, hat, glasses, textureData });
    }

    window.GameUI.initPainter(() => {
      refreshCustomizationPreview();
    });

    if (window.GameUI.dom.colorPicker) window.GameUI.dom.colorPicker.addEventListener('input', refreshCustomizationPreview);
    if (window.GameUI.dom.hatSelect) window.GameUI.dom.hatSelect.addEventListener('change', refreshCustomizationPreview);
    if (window.GameUI.dom.glassesSelect) window.GameUI.dom.glassesSelect.addEventListener('change', refreshCustomizationPreview);

    // Controles desacoplados
    window.GameControls.init(window.GameRenderer.getRenderer().domElement, {
      onShoot: () => shoot(),
      onReload: () => reloadWeapon(),
      onSelectWeapon: (k) => selectWeapon(k),
      onThrowGrenade: () => throwGrenade(),
      onWheelWeapon: (dir) => {
        const idx = WEAPON_KEYS.indexOf(currentWeapon);
        const nextIdx = (idx + dir + WEAPON_KEYS.length) % WEAPON_KEYS.length;
        selectWeapon(WEAPON_KEYS[nextIdx]);
      },
      onOpenChat: () => {
        window.GameControls.setChatting(true);
        window.GameUI.dom.chatBarContainer.classList.remove('hidden');
        if (document.pointerLockElement) document.exitPointerLock();
        window.GameUI.dom.chatInput.value = '';
        setTimeout(() => window.GameUI.dom.chatInput.focus(), 25);
      },
      onTriggerEmote: () => {
        if (socket) socket.emit('player:emote', { emoteType: 'spin' });
        triggerEmote(myId);
      },
      onTogglePause: () => {
        if (!isInGame) return;
        const isPaused = !window.GameUI.dom.pauseOverlay.classList.contains('hidden');
        if (!isPaused) {
          window.GameControls.setPaused(true);
          window.GameUI.dom.pauseOverlay.classList.remove('hidden');
          if (document.pointerLockElement) document.exitPointerLock();
        } else {
          window.GameControls.setPaused(false);
          window.GameUI.dom.pauseOverlay.classList.add('hidden');
          window.GameRenderer.getRenderer().domElement.requestPointerLock();
        }
      },
      onToggleScoreboard: (visible) => {
        if (isInGame && window.GameUI.dom.scoreboardOverlay) {
          window.GameUI.dom.scoreboardOverlay.classList.toggle('hidden', !visible);
        }
      },
    });

    // Menú de pausa botones
    if (window.GameUI.dom.resumeBtn) {
      window.GameUI.dom.resumeBtn.addEventListener('click', () => {
        window.GameControls.setPaused(false);
        window.GameUI.dom.pauseOverlay.classList.add('hidden');
        window.GameRenderer.getRenderer().domElement.requestPointerLock();
      });
    }

    if (window.GameUI.dom.exitLobbyBtn) {
      window.GameUI.dom.exitLobbyBtn.addEventListener('click', () => {
        window.GameControls.setPaused(false);
        window.GameControls.setInGame(false);
        window.GameUI.dom.pauseOverlay.classList.add('hidden');
        window.GameUI.dom.menuOverlay.classList.remove('hidden');
        window.GameUI.dom.hudEl.classList.add('hidden');
        window.GameUI.dom.deathOverlay.classList.add('hidden');
        window.GameUI.dom.gameoverOverlay.classList.add('hidden');
        isInGame = false;
        if (document.pointerLockElement) document.exitPointerLock();
      });
    }

    if (window.GameUI.dom.mouseSensSlider) {
      window.GameUI.dom.mouseSensSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        window.GameControls.setSensitivity(val);
        if (window.GameUI.dom.sensValueText) window.GameUI.dom.sensValueText.textContent = val.toFixed(1) + 'x';
      });
    }

    // Input de Chat
    if (window.GameUI.dom.chatInput) {
      window.GameUI.dom.chatInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          const msg = window.GameUI.dom.chatInput.value.trim();
          if (msg && socket) socket.emit('player:chat', { message: msg });
          window.GameControls.setChatting(false);
          window.GameUI.dom.chatBarContainer.classList.add('hidden');
          window.GameUI.dom.chatInput.blur();
          window.GameRenderer.getRenderer().domElement.requestPointerLock();
        } else if (e.key === 'Escape') {
          window.GameControls.setChatting(false);
          window.GameUI.dom.chatBarContainer.classList.add('hidden');
          window.GameUI.dom.chatInput.blur();
          window.GameRenderer.getRenderer().domElement.requestPointerLock();
        }
      });
    }

    // Lobby UI Eventos
    document.querySelectorAll('.weapon-btn').forEach(btn => {
      btn.addEventListener('click', () => selectWeapon(btn.dataset.weapon));
    });

    document.querySelectorAll('.mode-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        if (socket) socket.emit('game:set-config', { mode: pill.dataset.mode });
      });
    });

    // Selector de Mapas
    document.querySelectorAll('.shell-map-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.shell-map-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const selectedMap = card.dataset.map;
        loadMap(selectedMap);
        if (socket) socket.emit('game:set-config', { map: selectedMap });
      });
    });

    // PLAY NOW!
    window.GameUI.dom.joinBtn.addEventListener('click', joinGame);
    window.GameUI.dom.nicknameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinGame();
    });

    // Cargar mapa inicial antes de arrancar bucle
    loadMap(currentConfig.map || 'dirt');
    initNetworking();
    gameLoop();
  }

  function joinGame() {
    // Sincronizar y recargar el mapa seleccionado al entrar
    const activeMapEl = document.querySelector('.shell-map-card.active');
    const selectedMapName = (activeMapEl && activeMapEl.dataset.map) || currentConfig.map || 'dirt';
    loadMap(selectedMapName);

    const nickname = window.GameUI.dom.nicknameInput.value.trim() || 'EggSoldier';
    const color = window.GameUI.dom.colorPicker.value;
    const hat = window.GameUI.dom.hatSelect.value;
    const glasses = window.GameUI.dom.glassesSelect.value;
    const textureData = window.GameUI.getCustomTextureDataURL();

    getAudioCtx();

    window.GameUI.dom.menuOverlay.classList.add('hidden');
    window.GameUI.dom.hudEl.classList.remove('hidden');
    isInGame = true;
    window.GameControls.setInGame(true);

    window.GameUI.updateAmmo(ammoState[currentWeapon], WEAPONS[currentWeapon].maxAmmo, WEAPONS[currentWeapon].name, isReloading);
    window.GameUI.updateHealth(myHP);

    if (socket) {
      socket.emit('player:join', {
        nickname,
        color,
        hat,
        glasses,
        textureData,
      });
    }

    window.GameRenderer.getRenderer().domElement.requestPointerLock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
