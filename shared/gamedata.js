// ============================================================================
// shared/gamedata.js — Armas y modos de juego (fuente única para cliente y servidor)
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Armas al estilo Shell Shockers: eliges UNA principal al reaparecer y todos
  // llevan además la pistola Cluck 9mm (tecla E) y el golpe cuerpo a cuerpo (F).
  // Las claves 'rifle', 'shotgun' y 'sniper' se mantienen por compatibilidad.
  const WEAPONS = {
    rifle: {
      name: 'EggK-47', icon: '🔫', type: 'Fusil automático', slot: 'primary',
      desc: 'Automático clásico de medio alcance: cadencia alta y nunca se encasquilla.',
      damage: 23, cooldown: 100, pellets: 1, range: 120, auto: true,
      spread: 0.017, adsSpread: 0.4, maxAmmo: 30, reloadTime: 1400,
      falloffStart: 35, falloffMin: 0.6, headMult: 1.6,
      adsFov: 52, tracerColor: 0xffdd00, recoil: 0.045, stat: { dmg: 3, rate: 4, range: 3, mob: 3 },
    },
    shotgun: {
      name: 'Scrambler', icon: '💥', type: 'Escopeta (2 cartuchos)', slot: 'primary',
      desc: 'Dos disparos devastadores a quemarropa. Recarga rápida.',
      damage: 16, cooldown: 420, pellets: 8, range: 40, auto: false,
      spread: 0.09, adsSpread: 0.75, maxAmmo: 2, reloadTime: 1150,
      falloffStart: 7, falloffMin: 0.25, falloffLen: 20, headMult: 1.4,
      adsFov: 62, tracerColor: 0xff6b35, recoil: 0.13, stat: { dmg: 5, rate: 2, range: 1, mob: 4 },
    },
    ranger: {
      name: 'Free Ranger', icon: '🔭', type: 'Francotirador semiautomático', slot: 'primary',
      desc: 'Semiautomático con mira: dos disparos al cuerpo o uno a la cabeza.',
      damage: 52, cooldown: 480, pellets: 1, range: 220, auto: false,
      spread: 0.04, adsSpread: 0.05, maxAmmo: 15, reloadTime: 1900,
      falloffStart: 999, falloffMin: 1, headMult: 2,
      adsFov: 30, scope: true, tracerColor: 0x7bed9f, recoil: 0.1, stat: { dmg: 4, rate: 2, range: 4, mob: 3 },
    },
    rpegg: {
      name: 'RPEGG', icon: '🚀', type: 'Lanzacohetes', slot: 'primary',
      desc: 'Un impacto directo revienta a cualquiera y salpica mucho daño alrededor. ¡Cuidado con tu propio cohete!',
      damage: 0, cooldown: 900, pellets: 1, range: 90, auto: false,
      spread: 0.012, adsSpread: 0.5, maxAmmo: 2, reloadTime: 2600,
      falloffStart: 999, falloffMin: 1, headMult: 1,
      adsFov: 58, tracerColor: 0xffa502, recoil: 0.2,
      projectile: { speed: 42, radius: 3.8, maxDmg: 195 }, stat: { dmg: 5, rate: 1, range: 2, mob: 2 },
    },
    whipper: {
      name: 'Whipper', icon: '🌀', type: 'Subfusil', slot: 'primary',
      desc: 'Cargador enorme y cadencia altísima para correr y disparar a corta distancia.',
      damage: 15, cooldown: 68, pellets: 1, range: 70, auto: true,
      spread: 0.032, adsSpread: 0.55, maxAmmo: 40, reloadTime: 1700,
      falloffStart: 18, falloffMin: 0.5, falloffLen: 40, headMult: 1.5,
      adsFov: 60, tracerColor: 0xeccc68, recoil: 0.03, speedMult: 1.06, stat: { dmg: 2, rate: 5, range: 2, mob: 5 },
    },
    sniper: {
      name: 'Crackshot', icon: '🎯', type: 'Francotirador de cerrojo', slot: 'primary',
      desc: 'Cerrojo: un disparo a la cabeza revienta cualquier huevo.',
      damage: 90, cooldown: 1300, pellets: 1, range: 280, auto: false,
      spread: 0.06, adsSpread: 0.0, maxAmmo: 3, reloadTime: 2100,
      falloffStart: 999, falloffMin: 1, headMult: 2,
      adsFov: 20, scope: true, tracerColor: 0x00d2d3, recoil: 0.16, speedMult: 0.95, stat: { dmg: 5, rate: 1, range: 5, mob: 2 },
    },
    trihard: {
      name: 'Tri-Hard', icon: '🔺', type: 'Fusil de ráfaga de 3', slot: 'primary',
      desc: 'Ráfagas de tres balas muy precisas: especialista en media distancia.',
      damage: 26, cooldown: 380, pellets: 1, range: 150, auto: true,
      burst: { count: 3, interval: 72 },
      spread: 0.009, adsSpread: 0.4, maxAmmo: 24, reloadTime: 1600,
      falloffStart: 45, falloffMin: 0.65, headMult: 1.6,
      adsFov: 46, tracerColor: 0xff7f50, recoil: 0.04, stat: { dmg: 3, rate: 3, range: 4, mob: 3 },
    },
    pistol: {
      name: 'Cluck 9mm', icon: '🔫', type: 'Pistola semiautomática', slot: 'secondary',
      desc: 'Tu arma de apoyo: rápida de sacar y precisa.',
      damage: 24, cooldown: 140, pellets: 1, range: 90, auto: false,
      spread: 0.014, adsSpread: 0.45, maxAmmo: 15, reloadTime: 1100,
      falloffStart: 25, falloffMin: 0.55, headMult: 1.6,
      adsFov: 60, tracerColor: 0xfff3c4, recoil: 0.06, speedMult: 1.05,
    },
  };
  const PRIMARY_KEYS = ['rifle', 'shotgun', 'ranger', 'rpegg', 'whipper', 'sniper', 'trihard'];
  const MELEE = { damage: 50, range: 2.4, cooldown: 650 };
  // Intervalo mínimo real entre balas (las armas de ráfaga disparan más rápido dentro de la ráfaga)
  function minInterval(w) { return w.burst ? w.burst.interval : w.cooldown; }

  // Multiplicador de daño según distancia
  function falloff(wep, dist) {
    if (dist <= wep.falloffStart) return 1;
    const len = wep.falloffLen || 100;
    return Math.max(wep.falloffMin, 1 - (dist - wep.falloffStart) / len);
  }

  const MODES = {
    ffa:  { id: 'ffa',  name: 'Todos contra Todos', short: 'FFA', teams: false, defLimit: 25, limits: [10, 15, 25, 40, 60],
            desc: 'Cada huevo por su cuenta. Gana el primero en llegar al límite de bajas.' },
    tdm:  { id: 'tdm',  name: 'Duelo por Equipos', short: 'TDM', teams: true, defLimit: 40, limits: [20, 30, 40, 60, 80],
            desc: 'Rojo contra Azul. Cada baja suma un punto para tu equipo.' },
    kotc: { id: 'kotc', name: 'King of the Coop', short: 'KOTC', teams: true, defLimit: 5, limits: [3, 5, 7, 10],
            desc: 'Quédate dentro del gallinero sin enemigos hasta capturarlo. El gallinero cambia de sitio tras cada captura.' },
    cts:  { id: 'cts',  name: 'Capture the Spatula', short: 'CTS', teams: true, defLimit: 3, limits: [1, 3, 5, 7],
            desc: 'Coge la espátula del centro y llévala a tu base. Si mueres, la sueltas.' },
  };

  const TIME_LIMITS = [0, 5, 8, 10, 15, 20]; // minutos (0 = sin límite)

  const RULES = {
    MAX_HP: 100,
    RESPAWN_MS: 3000,
    SPAWN_PROTECT_MS: 1600,
    GRENADE_MAX: 3,
    GRENADE_REGEN_MS: 10000,
    GRENADE_MIN_INTERVAL: 700,
    GRENADE_FUSE_MS: 2200,
    GRENADE_RADIUS: 7,
    GRENADE_MAX_DMG: 95,
    GRENADE_SPEED: 17,
    GRENADE_MIN_POWER: 0.45,   // mantener Q lanza más lejos (0.45 → 1)
    TEAM_SWITCH_MS: 4000,      // tiempo mínimo entre cambios de equipo
    INTERMISSION_MS: 9000,
    KOTC_CAPTURE_S: 12,        // segundos para capturar con 1 jugador
    KOTC_MOVE_DELAY_MS: 3500,
    CTS_RETURN_MS: 15000,
    CTS_PICK_RADIUS: 1.5,
    HEAL_AMOUNT: 30,           // vida que da un botiquín (nunca por encima de MAX_HP)
    HEAL_RESPAWN_MS: 20000,
    MAX_SPEED: 26,             // m/s máximos aceptados por el servidor (incluye jump pads y caídas)
  };

  return { WEAPONS, PRIMARY_KEYS, MELEE, MODES, TIME_LIMITS, RULES, falloff, minInterval };
});
