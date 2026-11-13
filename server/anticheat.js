// =============================================================================
// ANTI-TRAMPAS — el servidor no se fía de nada de lo que dice el cliente.
//
// Movimiento:  presupuesto de distancia (velocidad máxima), barrido del trayecto
//              (no atravesar paredes), envolvente de salto (no volar ni flotar),
//              escaleras de mano reconocidas, límites del mapa.
// Disparos:    munición y recargas llevadas por el servidor, cadencia, alcance,
//              línea de visión e IMPACTO verificado contra la posición real del
//              objetivo (con compensación de latencia). La cabeza la decide el
//              servidor, no el cliente.
// =============================================================================
'use strict';

const Phys = require('../shared/physics.js');
const { WEAPONS } = require('../shared/gamedata.js');

const HIST_MS = 1000;          // historial de posiciones para compensar latencia
const REWIND_MIN = 40, REWIND_MAX = 420;   // ventana de rebobinado (ms)
const HEAD_Y = 1.1;            // igual que el cliente: por encima → cabeza
const EGG_R = 0.62;            // radio del huevo para validar impactos (con margen)
const EGG_TOP = 1.95;

// ---------------------------------------------------------------------------
// Historial de posiciones (para saber dónde estaba un jugador hace X ms)
// ---------------------------------------------------------------------------
function record(p, now) {
  if (!p.hist) p.hist = [];
  p.hist.push({ t: now, x: p.x, y: p.y, z: p.z });
  while (p.hist.length > 2 && now - p.hist[0].t > HIST_MS) p.hist.shift();
}

function posAt(p, t) {
  const h = p.hist;
  if (!h || !h.length) return { x: p.x, y: p.y, z: p.z };
  if (t <= h[0].t) return h[0];
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].t <= t) {
      const a = h[i], b = h[i + 1];
      if (!b) return a;
      const k = (t - a.t) / Math.max(1, b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
    }
  }
  return h[h.length - 1];
}

// ---------------------------------------------------------------------------
// Estado anti-trampas de cada jugador (al entrar y al reaparecer)
// ---------------------------------------------------------------------------
function resetPlayer(p, now) {
  p.mvBudget = 1.5;
  p.mvAt = now;
  p.airY = p.y; p.airAt = now; p.airGroundY = p.y;
  p.hist = [];
  record(p, now);
  p.lastCorrectAt = 0;
  p.cheatScore = 0;
  // Munición llena del arma principal y de la pistola
  p.ammo = {};
  for (const k in WEAPONS) p.ammo[k] = WEAPONS[k].maxAmmo;
  p.reloadUntil = 0; p.reloadWeapon = null;
}

// ---------------------------------------------------------------------------
// Movimiento
// ---------------------------------------------------------------------------
/**
 * Valida un paquete de movimiento. Devuelve null si es válido, o el motivo.
 * world: mundo de físicas; gravity: gravedad del mapa (negativa); half: medio lado
 */
function checkMove(p, nx, ny, nz, now, world) {
  const P = Phys.P;
  const g = Math.abs(world.gravity || -22);
  const dt = Math.max(0, Math.min(1, (now - (p.mvAt || now)) / 1000));
  p.mvAt = now;

  // 1) Velocidad: presupuesto de distancia que se recarga con el tiempo
  //    (35 % de margen + 1,5 m acumulables para absorber paquetes retrasados)
  const maxH = P.SPEED * 1.35;
  // Se acumula hasta 0,6 s de movimiento: un corte de red corto no provoca "efecto goma"
  p.mvBudget = Math.min(1.5 + maxH * 0.6, (p.mvBudget || 0) + maxH * dt);
  const dist = Math.hypot(nx - p.x, nz - p.z);
  if (dist > p.mvBudget + 0.05) return 'velocidad';
  const dy = ny - p.y;
  if (dy < -Math.max(3, 60 * dt + 1)) return 'caida-imposible';

  // 2) Atravesar paredes: barrido del trayecto. Las físicas mueven por ejes (X y
  //    luego Z, deslizando por las paredes), así que vale cualquiera de los dos
  //    caminos en L; la recta podría rozar una esquina sin que haya trampa.
  if (coreBlocked(world, nx, ny, nz)) return 'dentro-de-pared';
  const sy = Math.max(p.y, ny);
  if (dist > 0.05 && !pathClear(world, p.x, p.z, nx, nz, sy, true) && !pathClear(world, p.x, p.z, nx, nz, sy, false)) return 'pared';

  // 3) Vuelo: envolvente de salto
  const ground = Phys.supportBelow(world, nx, nz, ny + 0.6);
  const onGround = ny - ground < 0.3;
  const onLadder = !!Phys.findLadder(world, { x: nx, y: ny, z: nz }) || !!Phys.findLadder(world, { x: p.x, y: p.y, z: p.z });
  if (onGround || onLadder) {
    p.airY = ny; p.airAt = now; p.airGroundY = ny;
  } else {
    const jumpH = (P.JUMP * P.JUMP) / (2 * g);       // altura máxima de un salto
    const ladderBoost = (2.6 * 2.6) / (2 * g);         // impulso al salir de una escalera
    if (ny > p.airY + jumpH + ladderBoost + 0.45) return 'vuelo';
    // Tiempo máximo en el aire: subir + caer desde lo más alto posible + margen
    const top = p.airY + jumpH + 0.45;
    const tUp = P.JUMP / g;
    const tDown = Math.sqrt(Math.max(0, 2 * (top - ground)) / g);
    if ((now - p.airAt) / 1000 > tUp + tDown + 0.75) return 'flotando';
  }

  p.mvBudget -= dist;
  return null;
}

// Cuerpo del jugador un poco "encogido" (pies, cabeza y lados): tocar una pared o
// un techo al saltar NO es trampa; meterse dentro, sí.
function coreBlocked(world, x, y, z) {
  const R = Phys.P.RADIUS - 0.06, y0 = y + 0.08, y1 = y + Phys.P.HEIGHT - 0.12;
  for (const b of world.boxes) {
    if (y0 < b.maxY && y1 > b.minY && x + R > b.minX && x - R < b.maxX && z + R > b.minZ && z - R < b.maxZ) return true;
  }
  return false;
}

function pathClear(world, x0, z0, x1, z1, y, xFirst) {
  const segs = xFirst ? [[x0, z0, x1, z0], [x1, z0, x1, z1]] : [[x0, z0, x0, z1], [x0, z1, x1, z1]];
  for (const [ax, az, bx, bz] of segs) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.25);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (coreBlocked(world, ax + (bx - ax) * k, y, az + (bz - az) * k)) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Munición y recargas
// ---------------------------------------------------------------------------
function tickReload(p, now) {
  if (p.reloadUntil && now >= p.reloadUntil) {
    if (p.reloadWeapon && WEAPONS[p.reloadWeapon]) p.ammo[p.reloadWeapon] = WEAPONS[p.reloadWeapon].maxAmmo;
    p.reloadUntil = 0; p.reloadWeapon = null;
  }
}

function startReload(p, now) {
  const w = WEAPONS[p.weapon];
  if (!w || !p.ammo) return false;
  tickReload(p, now);
  if (p.reloadUntil || p.ammo[p.weapon] >= w.maxAmmo) return false;
  p.reloadWeapon = p.weapon;
  // 12 % de margen para que el reloj del cliente y el del servidor no choquen
  p.reloadUntil = now + w.reloadTime * 0.88;
  return true;
}

/** ¿Puede disparar ya (hay bala y no está recargando)? Consume una bala si sí. */
function useAmmo(p, now) {
  if (!p.ammo) return true;
  tickReload(p, now);
  if (p.reloadUntil) {
    if (p.reloadWeapon === p.weapon) return false;
    p.reloadUntil = 0; p.reloadWeapon = null; // cambió de arma: recarga cancelada
  }
  const left = p.ammo[p.weapon];
  if (left === undefined) return true;
  if (left <= 0) {
    // Sin balas: recarga automática (igual que hace el cliente)
    startReload(p, now);
    return false;
  }
  p.ammo[p.weapon] = left - 1;
  return true;
}

// ---------------------------------------------------------------------------
// Impactos
// ---------------------------------------------------------------------------
/**
 * Comprueba que el punto de impacto que dice el cliente cae sobre el huevo del
 * objetivo en algún instante reciente (latencia) y que el tirador lo ve.
 * Devuelve { head } si el impacto es válido, o null.
 */
function checkHit(world, shooter, target, pt, now) {
  if (!pt || !isFinite(pt.x) || !isFinite(pt.y) || !isFinite(pt.z)) return null;
  const ex = shooter.x, ey = shooter.y + 1.45, ez = shooter.z;
  // El punto debe estar en la línea de visión del tirador
  if (!Phys.lineOfSight(world, ex, ey, ez, pt.x, pt.y, pt.z)) return null;
  for (let r = REWIND_MIN; r <= REWIND_MAX; r += 40) {
    const q = posAt(target, now - r);
    const dx = pt.x - q.x, dz = pt.z - q.z, ly = pt.y - q.y;
    if (ly < -0.25 || ly > EGG_TOP + 0.25) continue;
    if (dx * dx + dz * dz > EGG_R * EGG_R * 1.6) continue;
    return { head: ly > HEAD_Y };
  }
  return null;
}

module.exports = { record, posAt, resetPlayer, checkMove, tickReload, startReload, useAmmo, checkHit, HEAD_Y };
