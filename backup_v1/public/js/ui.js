// ============================================================================
// public/js/ui.js — Gestión de la interfaz de usuario, HUD y eventos de customización
// ============================================================================

window.GameUI = (function () {
  'use strict';

  // Elementos DOM
  const menuOverlay        = document.getElementById('menu-overlay');
  const joinBtn            = document.getElementById('join-btn');
  const colorPicker        = document.getElementById('color-picker');
  const hatSelect          = document.getElementById('hat-select');
  const glassesSelect      = document.getElementById('glasses-select');
  const configStatus       = document.getElementById('config-status');
  const currentUserDisplay = document.getElementById('current-user-display');

  const deathOverlay       = document.getElementById('death-overlay');
  const killedByText       = document.getElementById('killed-by-text');
  const gameoverOverlay    = document.getElementById('gameover-overlay');
  const gameoverText       = document.getElementById('gameover-text');
  const pauseOverlay       = document.getElementById('pause-overlay');
  const resumeBtn          = document.getElementById('resume-btn');
  const exitLobbyBtn       = document.getElementById('exit-lobby-btn');
  const scoreboardOverlay  = document.getElementById('scoreboard-overlay');
  const scoreboardEntries  = document.getElementById('scoreboard-entries');

  const hudEl              = document.getElementById('hud');
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
  let textureCtx           = null;
  const brushColorInput    = document.getElementById('brush-color');
  const brushSizeInput     = document.getElementById('brush-size');
  const painterClearBtn    = document.getElementById('painter-clear');

  let isPainting = false;
  let hasDrawnCustomTexture = false;

  function initPainter(onTextureChange) {
    if (!textureCanvas) return;
    textureCtx = textureCanvas.getContext('2d');
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
      if (onTextureChange) onTextureChange();
    });

    window.addEventListener('mouseup', () => { isPainting = false; });

    textureCanvas.addEventListener('mousemove', (e) => {
      if (!isPainting) return;
      const { x, y } = getCoords(e);
      paintAt(x, y);
      if (onTextureChange) onTextureChange();
    });

    if (painterClearBtn) {
      painterClearBtn.addEventListener('click', () => {
        hasDrawnCustomTexture = false;
        textureCtx.fillStyle = '#ffffff';
        textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
        drawEggTemplateGuides();
        if (onTextureChange) onTextureChange();
      });
    }
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

  function updateHealth(hp) {
    if (!healthText || !healthBar) return;
    healthText.textContent = hp;
    healthBar.style.width = Math.max(0, Math.min(100, hp)) + '%';
    if (hp > 60) healthBar.style.background = 'linear-gradient(90deg, #4caf50, #f1c40f)';
    else if (hp > 30) healthBar.style.background = 'linear-gradient(90deg, #f1c40f, #e67e22)';
    else healthBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
  }

  function triggerDamageFlash() {
    if (!damageFlash) return;
    damageFlash.classList.add('active');
    setTimeout(() => { damageFlash.classList.remove('active'); }, 120);
  }

  function triggerHitmarker(isHeadshot) {
    if (!hitmarkerEl) return;
    hitmarkerEl.classList.remove('hidden');
    hitmarkerEl.style.animation = 'none';
    void hitmarkerEl.offsetHeight;
    hitmarkerEl.style.animation = 'hitFade 0.25s forwards';
  }

  function updateAmmo(current, max, weaponName, isReloading) {
    if (activeWeaponName) activeWeaponName.textContent = weaponName;
    if (ammoCurrentEl) ammoCurrentEl.textContent = current;
    if (ammoMaxEl) ammoMaxEl.textContent = max;

    if (ammoBulletIcons) {
      ammoBulletIcons.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const bullet = document.createElement('div');
        bullet.className = 'ammo-bullet' + (i >= current ? ' spent' : '');
        ammoBulletIcons.appendChild(bullet);
      }
    }

    if (reloadHint) {
      if (isReloading) {
        reloadHint.textContent = 'RECARGANDO...';
        reloadHint.classList.remove('hidden');
      } else {
        reloadHint.textContent = 'PULSA [R] PARA RECARGAR';
        reloadHint.classList.toggle('hidden', current > 0);
      }
    }
  }

  function updateGrenadeCooldown(progress) {
    if (!grenadeCdCircle) return;
    const offset = 94 * (1 - Math.max(0, Math.min(1, progress)));
    grenadeCdCircle.style.strokeDashoffset = offset;
  }

  function showToast(msg) {
    if (!centerToast) return;
    centerToast.textContent = msg;
    centerToast.classList.remove('hidden');
    setTimeout(() => { centerToast.classList.add('hidden'); }, 1400);
  }

  function addFeedItem(htmlContent) {
    if (!killFeedEl) return;
    const el = document.createElement('div');
    el.className = 'kf-item';
    el.innerHTML = htmlContent;
    killFeedEl.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }

  function updateScoreboard(players, myId) {
    if (!scoreboardEntries || !players) return;
    scoreboardEntries.innerHTML = '';
    const arr = Object.values(players).sort((a, b) => (b.kills || 0) - (a.kills || 0));

    arr.forEach((p, idx) => {
      const tr = document.createElement('tr');
      const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : (p.kills || 0);
      const teamLabel = p.team ? (p.team === 'red' ? '🔴 Rojo' : '🔵 Azul') : 'Libre';
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(p.nickname || 'Egg')}</strong> ${p.id === myId ? '(Tú)' : ''}</td>
        <td>${teamLabel}</td>
        <td>${p.kills || 0}</td>
        <td>${p.deaths || 0}</td>
        <td>${kd}</td>
      `;
      scoreboardEntries.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return {
    initPainter,
    getCustomTextureDataURL,
    updateHealth,
    triggerDamageFlash,
    triggerHitmarker,
    updateAmmo,
    updateGrenadeCooldown,
    showToast,
    addFeedItem,
    updateScoreboard,
    escapeHtml,
    dom: {
      menuOverlay,
      joinBtn,
      colorPicker,
      hatSelect,
      glassesSelect,
      configStatus,
      currentUserDisplay,
      deathOverlay,
      killedByText,
      gameoverOverlay,
      gameoverText,
      pauseOverlay,
      resumeBtn,
      exitLobbyBtn,
      scoreboardOverlay,
      hudEl,
      killCountEl,
      deathCountEl,
      teamScoreEl,
      teamRedScoreEl,
      teamBlueScoreEl,
      chatBarContainer,
      chatInput,
      mouseSensSlider,
      sensValueText,
    },
  };
})();
