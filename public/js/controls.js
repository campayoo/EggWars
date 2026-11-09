// ============================================================================
// public/js/controls.js — Pointer Lock API, teclado y ratón desacoplados
// Control estricto del cursor: NUNCA se bloquea en los menús o lobby
// ============================================================================

window.GameControls = (function () {
  'use strict';

  const keys = {};
  let isPointerLocked = false;
  let isMouseDown = false;
  let isAiming = false;
  let isChatting = false;
  let isPaused = false;
  let isInGame = false;
  let mouseSensitivityFactor = 1.0;
  const MOUSE_SENSITIVITY = 0.0022;

  let yaw = 0;
  let pitch = 0;

  let onShoot = null;
  let onReload = null;
  let onSelectWeapon = null;
  let onThrowGrenade = null;
  let onOpenChat = null;
  let onTriggerEmote = null;
  let onTogglePause = null;
  let onToggleScoreboard = null;

  function init(canvasElement, handlers) {
    onShoot = handlers.onShoot;
    onReload = handlers.onReload;
    onSelectWeapon = handlers.onSelectWeapon;
    onThrowGrenade = handlers.onThrowGrenade;
    onOpenChat = handlers.onOpenChat;
    onTriggerEmote = handlers.onTriggerEmote;
    onTogglePause = handlers.onTogglePause;
    onToggleScoreboard = handlers.onToggleScoreboard;

    // Solo solicitar pointer lock si estamos dentro de la partida activa y no en pausa/chat
    canvasElement.addEventListener('click', () => {
      if (!isInGame || isPaused || isChatting) return;
      canvasElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = (document.pointerLockElement === canvasElement);
    });

    // Ratón
    document.addEventListener('mousemove', (e) => {
      if (!isInGame || !isPointerLocked || isPaused || isChatting) return;

      const sens = MOUSE_SENSITIVITY * mouseSensitivityFactor;
      yaw   -= e.movementX * sens;
      pitch -= e.movementY * sens;

      const maxPitch = Math.PI / 2 - 0.05;
      pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
    });

    document.addEventListener('mousedown', (e) => {
      if (!isInGame || isPaused || isChatting) return;

      if (e.button === 0) {
        isMouseDown = true;
        if (isPointerLocked) {
          if (onShoot) onShoot();
        } else {
          canvasElement.requestPointerLock();
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

    document.addEventListener('contextmenu', (e) => {
      if (isInGame) e.preventDefault();
    });

    // Teclado
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        if (isInGame) {
          e.preventDefault();
          if (onToggleScoreboard) onToggleScoreboard(true);
        }
        return;
      }

      if (isChatting) return;

      keys[e.code] = true;

      if (e.code === 'Escape') {
        if (isInGame && onTogglePause) {
          onTogglePause();
        }
        return;
      }

      if (!isInGame || isPaused) return;

      if (e.code === 'KeyT') {
        e.preventDefault();
        if (onOpenChat) onOpenChat();
        return;
      }

      if (e.code === 'KeyB') {
        e.preventDefault();
        if (onTriggerEmote) onTriggerEmote();
        return;
      }

      if (e.code === 'KeyR') {
        if (onReload) onReload();
        return;
      }

      if (e.code === 'Digit1' || e.code === 'Numpad1') if (onSelectWeapon) onSelectWeapon('rifle');
      if (e.code === 'Digit2' || e.code === 'Numpad2') if (onSelectWeapon) onSelectWeapon('shotgun');
      if (e.code === 'Digit3' || e.code === 'Numpad3') if (onSelectWeapon) onSelectWeapon('sniper');

      if (e.code === 'KeyQ' || e.code === 'KeyG') {
        if (onThrowGrenade) onThrowGrenade();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        if (isInGame) {
          e.preventDefault();
          if (onToggleScoreboard) onToggleScoreboard(false);
        }
        return;
      }
      keys[e.code] = false;
    });

    window.addEventListener('wheel', (e) => {
      if (!isInGame || !isPointerLocked || isPaused || isChatting) return;
      if (handlers.onWheelWeapon) handlers.onWheelWeapon(e.deltaY > 0 ? 1 : -1);
    });
  }

  function setInGame(val) {
    isInGame = val;
    if (!val && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  function setSensitivity(val) {
    mouseSensitivityFactor = val;
  }

  function setPaused(val) {
    isPaused = val;
    if (val) {
      isMouseDown = false;
      isAiming = false;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }

  function setChatting(val) {
    isChatting = val;
    if (val) {
      isMouseDown = false;
      isAiming = false;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }

  return {
    init,
    keys,
    setInGame,
    setSensitivity,
    setPaused,
    setChatting,
    isPointerLocked: () => isPointerLocked,
    isMouseDown: () => isMouseDown,
    isAiming: () => isAiming,
    getYaw: () => yaw,
    getPitch: () => pitch,
    setYaw: (y) => { yaw = y; },
    setPitch: (p) => { pitch = p; },
  };
})();
