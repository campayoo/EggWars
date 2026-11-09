// ============================================================================
// public/js/renderer.js — Motor Three.js, iluminación, cámara, LERP y Preview 3D
// ============================================================================

window.GameRenderer = (function () {
  'use strict';

  let scene, camera, renderer, clock;
  let mapRootGroup = null;
  const PLAYER_HEIGHT = 1.6;
  const HIP_FIRE_POS = new THREE.Vector3(0.28, -0.26, -0.46);
  const ADS_POS      = new THREE.Vector3(0.0, -0.19, -0.34);

  let fpsWeapons = {};
  let activeFPSWeaponGroup = null;
  let recoilOffsetZ = 0;
  let recoilRotX = 0;
  let swayTime = 0;
  let currentFov = 75;
  const BASE_FOV = 75;

  // Lienzo y escena dedicada para la Vista Previa 3D en tiempo real del Huevo
  let previewScene, previewCamera, previewRenderer, previewEggMesh, previewGroup;
  let previewCanvas = null;

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 45, 130);

    camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 280);
    camera.position.set(0, PLAYER_HEIGHT, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Luces de la partida
    const ambient = new THREE.AmbientLight(0xffffff, 0.72);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffaed, 0.88);
    sun.position.set(34, 60, 24);
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

    mapRootGroup = new THREE.Group();
    scene.add(mapRootGroup);

    buildFPSWeapons();
    initPreview3D();

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (camera && renderer) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    if (previewCamera && previewRenderer && previewCanvas) {
      const rect = previewCanvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        previewCamera.aspect = rect.width / rect.height;
        previewCamera.updateProjectionMatrix();
        previewRenderer.setSize(rect.width, rect.height);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // VISTA PREVIA 3D EN TIEMPO REAL DEL HUEVO EN EL MENÚ / PERSONALIZACIÓN
  // ---------------------------------------------------------------------------
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

    const ambLight = new THREE.AmbientLight(0xffffff, 0.85);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 10, 7);
    previewScene.add(ambLight, dirLight);

    previewGroup = new THREE.Group();
    previewScene.add(previewGroup);

    updatePreviewAvatar({
      color: '#ffffff',
      hat: 'none',
      glasses: 'none',
      textureData: null
    });
  }

  function updatePreviewAvatar(opt) {
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

    const eggColor = opt.color || '#ffffff';
    let eggMat;
    if (opt.textureData) {
      const img = new Image();
      img.src = opt.textureData;
      const texture = new THREE.Texture(img);
      img.onload = () => { texture.needsUpdate = true; };
      eggMat = new THREE.MeshLambertMaterial({ map: texture, color: eggColor, roughness: 0.5 });
    } else {
      eggMat = new THREE.MeshLambertMaterial({ color: eggColor, roughness: 0.5 });
    }

    const eggGeo = new THREE.SphereGeometry(0.55, 16, 16);
    previewEggMesh = new THREE.Mesh(eggGeo, eggMat);
    previewEggMesh.scale.set(1.0, 1.38, 1.0);
    previewEggMesh.position.y = 0;
    previewGroup.add(previewEggMesh);

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

    // Sombreros y accesorios
    attachHat(previewGroup, opt.hat, true);
    attachGlasses(previewGroup, opt.glasses, true);
  }

  function renderPreview(delta) {
    if (previewGroup && previewRenderer && previewScene && previewCamera) {
      previewGroup.rotation.y += delta * 0.9; // Rotación 360° continua y elegante
      previewRenderer.render(previewScene, previewCamera);
    }
  }

  // ---------------------------------------------------------------------------
  // MODELADO DE ARMAS EN PRIMERA PERSONA (FPS)
  // ---------------------------------------------------------------------------
  function buildFPSWeapons() {
    fpsWeapons = {
      rifle:   buildFPSRifle(),
      shotgun: buildFPSShotgun(),
      sniper:  buildFPSSniper(),
    };

    ['rifle', 'shotgun', 'sniper'].forEach(k => {
      camera.add(fpsWeapons[k]);
      fpsWeapons[k].visible = (k === 'rifle');
    });
    activeFPSWeaponGroup = fpsWeapons.rifle;
    scene.add(camera);
  }

  function buildFPSRifle() {
    const group = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.55), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    barrel.position.set(0, 0, -0.28);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.32), new THREE.MeshLambertMaterial({ color: 0x8b4513 }));
    body.position.set(0, 0, 0.05);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    mag.position.set(0, -0.12, -0.05);
    mag.rotation.x = -0.25;
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
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.85), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    barrel.position.set(0, 0, -0.44);
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

  function setWeapon(weaponKey) {
    ['rifle', 'shotgun', 'sniper'].forEach(k => {
      if (fpsWeapons[k]) fpsWeapons[k].visible = (k === weaponKey);
    });
    activeFPSWeaponGroup = fpsWeapons[weaponKey];
  }

  function triggerRecoil(weaponKey) {
    const kick = weaponKey === 'sniper' ? 0.16 : (weaponKey === 'shotgun' ? 0.12 : 0.05);
    recoilOffsetZ = kick;
    recoilRotX = -kick * 0.9;

    if (activeFPSWeaponGroup) {
      const flash = activeFPSWeaponGroup.getObjectByName('flash');
      if (flash) {
        flash.material.opacity = 0.9;
        setTimeout(() => { if (flash.material) flash.material.opacity = 0; }, 40);
      }
    }
  }

  function updateCameraAndHands(delta, localPos, pitch, yaw, isAiming, currentWeapon, isMoving) {
    if (!camera) return;
    camera.position.set(localPos.x, localPos.y + PLAYER_HEIGHT, localPos.z);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

    const targetFov = isAiming ? (currentWeapon === 'sniper' ? 26 : 46) : BASE_FOV;
    currentFov = THREE.MathUtils.lerp(currentFov, targetFov, delta * 14);
    if (Math.abs(camera.fov - currentFov) > 0.05) {
      camera.fov = currentFov;
      camera.updateProjectionMatrix();
    }

    if (!activeFPSWeaponGroup) return;

    recoilOffsetZ = THREE.MathUtils.lerp(recoilOffsetZ, 0, delta * 14);
    recoilRotX    = THREE.MathUtils.lerp(recoilRotX, 0, delta * 16);

    const baseTarget = isAiming ? ADS_POS : HIP_FIRE_POS;
    const lerpSpeed = isAiming ? 18 : 12;

    let swayX = 0, swayY = 0;
    if (isMoving) {
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

  function createTracer(start, dir, colorHex, lineWidth) {
    if (!scene) return;
    const end = start.clone().add(dir.clone().multiplyScalar(80));
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

  function createExplosion(x, y, z) {
    if (!scene) return;
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

  function createHitSpark(pos) {
    if (!scene) return;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff3838 }));
    spark.position.copy(pos);
    scene.add(spark);
    setTimeout(() => {
      scene.remove(spark);
      spark.geometry.dispose();
      spark.material.dispose();
    }, 85);
  }

  // Modelado avatar del jugador (huevo multicapa)
  function createPlayerAvatar(playerData, mode) {
    const root = new THREE.Group();

    let eggColor = playerData.color || '#ffffff';
    if (mode === 'tdm' && playerData.team) {
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

    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'player-body-group';
    root.add(bodyGroup);

    const eggGeo = new THREE.SphereGeometry(0.52, 14, 14);
    const eggMesh = new THREE.Mesh(eggGeo, eggMat);
    eggMesh.scale.set(1.0, 1.35, 1.0);
    eggMesh.position.y = 0.95;
    eggMesh.castShadow = true;
    bodyGroup.add(eggMesh);

    // Cabeza / Rostro articulado en Pitch X
    const headPitchGroup = new THREE.Group();
    headPitchGroup.name = 'head-pitch-group';
    headPitchGroup.position.set(0, 1.25, 0);
    bodyGroup.add(headPitchGroup);

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
    attachHat(headPitchGroup, playerData.hat, false);
    attachGlasses(headPitchGroup, playerData.glasses, false);

    // Hitbox precisa para Headshot
    const headHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.85, 0.85),
      new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 })
    );
    headHitbox.position.set(0, 0.12, -0.05);
    headHitbox.name = 'hitbox-head';
    headPitchGroup.add(headHitbox);

    // Arma exterior
    const gunGroup = new THREE.Group();
    gunGroup.name = 'gun-external';
    gunGroup.position.set(0.55, 1.0, -0.2);
    const extGunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
    );
    gunGroup.add(extGunMesh);
    bodyGroup.add(gunGroup);

    // Hitbox para cuerpo
    const hitboxGeo = new THREE.BoxGeometry(1.15, 1.5, 1.15);
    const hitbox = new THREE.Mesh(hitboxGeo, new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 }));
    hitbox.position.y = 0.85;
    hitbox.name = 'hitbox';
    root.add(hitbox);

    const nameSprite = createNameSprite(playerData.nickname || 'Egg', playerData.team, mode);
    nameSprite.name = 'name-sprite';
    root.add(nameSprite);

    return root;
  }

  function attachHat(headGroup, hatType, isPreview = false) {
    if (!hatType || hatType === 'none') return;
    const hatGroup = new THREE.Group();
    hatGroup.name = 'accessory-hat';

    const yOff = isPreview ? 0.45 : 0;
    const zDir = isPreview ? 1 : -1;

    if (hatType === 'tophat') {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.42, 10), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      crown.position.y = yOff + 0.55;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 10), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      brim.position.y = yOff + 0.36;
      hatGroup.add(crown, brim);
    } else if (hatType === 'helmet') {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4b5320 }));
      helm.position.y = yOff + 0.18;
      hatGroup.add(helm);
    } else if (hatType === 'cap') {
      const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe67e22 }));
      capCrown.position.y = yOff + 0.18;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.24), new THREE.MeshLambertMaterial({ color: 0xe67e22 }));
      visor.position.set(0, yOff + 0.25, zDir * 0.34);
      visor.rotation.x = isPreview ? -0.2 : 0.2;
      hatGroup.add(capCrown, visor);
    } else if (hatType === 'crown') {
      // Corona de Rey Dorada
      const crownMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.25, 6), new THREE.MeshLambertMaterial({ color: 0xf1c40f }));
      crownMesh.position.y = yOff + 0.45;
      hatGroup.add(crownMesh);
    } else if (hatType === 'cowboy') {
      // Sombrero de Vaquero
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.3, 10), new THREE.MeshLambertMaterial({ color: 0x8b4513 }));
      crown.position.y = yOff + 0.5;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.04, 10), new THREE.MeshLambertMaterial({ color: 0x8b4513 }));
      brim.position.y = yOff + 0.35;
      brim.scale.set(1.2, 1, 1);
      hatGroup.add(crown, brim);
    }
    headGroup.add(hatGroup);
  }

  function attachGlasses(headGroup, glassesType, isPreview = false) {
    if (!glassesType || glassesType === 'none') return;
    const gGroup = new THREE.Group();
    gGroup.name = 'accessory-glasses';

    const yOff = isPreview ? 0.1 : 0.08;
    const zPos = isPreview ? 0.48 : -0.45;

    if (glassesType === 'sunglasses') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.05), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      frame.position.set(0, yOff, zPos);
      gGroup.add(frame);
    } else if (glassesType === 'mask') {
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.05), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
      mask.position.set(0, yOff, zPos);
      gGroup.add(mask);
    } else if (glassesType === 'goggles') {
      // Gafas de buzo / aviador
      const gogglesL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), new THREE.MeshLambertMaterial({ color: 0x34495e }));
      gogglesL.rotation.x = Math.PI / 2;
      gogglesL.position.set(-0.16, yOff, zPos);
      const gogglesR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), new THREE.MeshLambertMaterial({ color: 0x34495e }));
      gogglesR.rotation.x = Math.PI / 2;
      gogglesR.position.set(0.16, yOff, zPos);
      gGroup.add(gogglesL, gogglesR);
    }
    headGroup.add(gGroup);
  }

  function createNameSprite(text, team, mode) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 44, 12);
    ctx.fill();

    let textColor = '#ffffff';
    if (mode === 'tdm' && team) {
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

  function createSpeechBubble(text) {
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

  function render() {
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function getDelta() {
    return clock ? clock.getDelta() : 0.016;
  }

  return {
    init,
    render,
    renderPreview,
    updatePreviewAvatar,
    getDelta,
    setWeapon,
    triggerRecoil,
    updateCameraAndHands,
    createTracer,
    createExplosion,
    createHitSpark,
    createPlayerAvatar,
    createSpeechBubble,
    getScene: () => scene,
    getCamera: () => camera,
    getMapRoot: () => mapRootGroup,
    getRenderer: () => renderer,
  };
})();
