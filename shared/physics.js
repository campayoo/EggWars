// ============================================================================
// shared/physics.js — Físicas del jugador, granadas y raycast contra el mapa
// Compartido por cliente y servidor (y por los tests en Node).
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mapbuilder.js'));
  else root.GamePhysics = factory(root.MapBuilder);
})(typeof self !== 'undefined' ? self : this, function (MB) {
  'use strict';

  const P = {
    RADIUS: 0.4,          // medio ancho del AABB del jugador
    HEIGHT: 1.6,          // altura de colisión
    EYE: 1.42,            // altura de los ojos
    STEP: 0.55,           // escalón máximo que se sube andando
    SPEED: 7.2,           // velocidad máxima andando
    ACCEL_GROUND: 70,     // aceleración en el suelo
    ACCEL_AIR: 16,        // control en el aire
    JUMP: 8.4,            // velocidad vertical del salto
    CLIMB: 4.6,           // velocidad en escaleras de mano
    MAX_FALL: 45,
    SUBSTEP: 1 / 120,
    COYOTE: 0.1,          // margen para saltar justo después de dejar un borde
  };
  const EPS = 1e-4;
  const surf = MB.rampSurfaceAt;

  // Mundo físico a partir de los datos construidos del mapa
  function createWorld(data) {
    return {
      boxes: data.boxes.filter(b => b.solid),
      ramps: data.ramps,
      ladders: data.ladders,
      pads: data.pads,
      half: data.halfSize,
      ground: data.ground,
      gravity: data.gravity,
      killY: data.killY,
    };
  }

  // Superficie más alta de una rampa bajo el AABB del jugador
  function rampTopUnder(r, x, z, R) {
    const x0 = Math.max(r.minX, x - R), x1 = Math.min(r.maxX, x + R);
    const z0 = Math.max(r.minZ, z - R), z1 = Math.min(r.maxZ, z + R);
    if (x0 > x1 || z0 > z1) return null;
    let px = x, pz = z;
    if (r.dir === '+x') px = x1; else if (r.dir === '-x') px = x0;
    else if (r.dir === '+z') pz = z1; else pz = z0;
    return surf(r, px, pz);
  }
  function rampBottom(r, s) {
    return r.thick ? s - r.thick : r.y0;
  }
  function overlapXZ(b, x, z, R) {
    return x + R > b.minX + EPS && x - R < b.maxX - EPS && z + R > b.minZ + EPS && z - R < b.maxZ - EPS;
  }

  // ¿El volumen del jugador en (x,y,z) se solapa con algo sólido?
  function blockedAt(w, x, y, z) {
    const R = P.RADIUS, top = y + P.HEIGHT;
    for (const b of w.boxes) {
      if (y < b.maxY - EPS && top > b.minY + EPS && overlapXZ(b, x, z, R)) return true;
    }
    for (const r of w.ramps) {
      const s = rampTopUnder(r, x, z, R);
      if (s === null) continue;
      if (y < s - 0.02 && top > rampBottom(r, s)) return true;
    }
    return false;
  }

  // Altura del soporte más alto bajo los pies (top <= maxY)
  // Dirección de salida en lo alto de una escalera de mano: la primera (delante,
  // lados, atrás) con suelo a la altura de la cima y sitio libre para el jugador
  function ladderExit(w, st, lad) {
    const top = lad.maxY - 0.15;
    const cands = [[lad.fx, lad.fz], [lad.fz, -lad.fx], [-lad.fz, lad.fx], [-lad.fx, -lad.fz]];
    for (const dist of [0.8, 1.2]) {
      for (const d of cands) {
        const px = st.x + d[0] * dist, pz = st.z + d[1] * dist;
        const sY = supportBelow(w, px, pz, top + 0.6);
        if (sY >= top - 0.6 && !blockedAt(w, px, sY + 0.05, pz)) return d;
      }
    }
    return [lad.fx, lad.fz];
  }

  function supportBelow(w, x, z, maxY) {
    const R = P.RADIUS;
    let best = w.ground ? 0 : -Infinity;
    for (const b of w.boxes) {
      if (b.maxY <= maxY + EPS && b.maxY > best && overlapXZ(b, x, z, R)) best = b.maxY;
    }
    for (const r of w.ramps) {
      const s = rampTopUnder(r, x, z, R);
      if (s !== null && s <= maxY + EPS && s > best) best = s;
    }
    return best;
  }

  function findLadder(w, st) {
    for (const l of w.ladders) {
      if (st.x > l.minX && st.x < l.maxX && st.z > l.minZ && st.z < l.maxZ && st.y >= l.minY - 0.3 && st.y < l.maxY) return l;
    }
    return null;
  }

  function newState(x, y, z) {
    return { x, y, z, vx: 0, vy: 0, vz: 0, onGround: true, onLadder: false, airTime: 0, jumpHeld: false, ladderCD: 0 };
  }

  // Movimiento horizontal en un eje con escalones y rampas
  function moveAxis(w, st, axis, d) {
    if (d === 0) return;
    const R = P.RADIUS;
    const ox = st.x, oz = st.z;
    if (axis === 'x') st.x += d; else st.z += d;
    const canStep = st.onGround || st.onLadder || st.airTime < P.COYOTE;

    for (let iter = 0; iter < 4; iter++) {
      let hit = false;
      const top = st.y + P.HEIGHT;
      for (const b of w.boxes) {
        if (!(st.y < b.maxY - EPS && top > b.minY + EPS && overlapXZ(b, st.x, st.z, R))) continue;
        const rise = b.maxY - st.y;
        if (canStep && rise <= P.STEP && !blockedAt(w, st.x, b.maxY + 0.001, st.z)) {
          st.y = b.maxY;
          continue;
        }
        if (axis === 'x') { st.x = d > 0 ? b.minX - R - 0.001 : b.maxX + R + 0.001; st.vx = 0; }
        else { st.z = d > 0 ? b.minZ - R - 0.001 : b.maxZ + R + 0.001; st.vz = 0; }
        hit = true;
      }
      for (const r of w.ramps) {
        const s = rampTopUnder(r, st.x, st.z, R);
        if (s === null) continue;
        if (!(st.y < s - 0.002 && top > rampBottom(r, s))) continue;
        if (s - st.y <= P.STEP && (canStep || s - st.y < 0.25) && !blockedAt(w, st.x, s + 0.001, st.z)) {
          st.y = s;
          continue;
        }
        if (axis === 'x') { st.x = ox; st.vx = 0; } else { st.z = oz; st.vz = 0; }
        hit = true;
      }
      if (!hit) break;
    }
  }

  // Un paso de simulación del jugador. input: {fwd, side, yaw, jump}
  // Devuelve eventos: { jumped, landed, pad, ladder }
  function stepPlayer(w, st, input, dt) {
    const ev = { jumped: false, landed: false, pad: null, impact: 0 };
    const g = w.gravity;
    const sy = Math.sin(input.yaw || 0), cy = Math.cos(input.yaw || 0);
    // forward = (-sin(yaw), -cos(yaw)), right = (cos(yaw), -sin(yaw))
    let wx = -sy * (input.fwd || 0) + cy * (input.side || 0);
    let wz = -cy * (input.fwd || 0) - sy * (input.side || 0);
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    if (st.ladderCD > 0) st.ladderCD -= dt;
    const lad = st.ladderCD > 0 ? null : findLadder(w, st);
    const wantsLadder = lad && (input.fwd !== 0 || !st.onGround || st.onLadder);
    const wasLadder = st.onLadder;
    st.onLadder = !!(lad && wantsLadder && !(st.onGround && input.fwd < 0));

    if (st.onLadder) {
      // ¿El jugador empuja hacia la pared de la escalera?
      const towards = wx * lad.fx + wz * lad.fz;
      if (input.jump && !st.jumpHeld && towards < 0.3) {
        // Saltar hacia atrás para soltarse
        st.vy = P.JUMP * 0.75;
        st.vx = -lad.fx * 4.5; st.vz = -lad.fz * 4.5;
        st.onLadder = false; st.ladderCD = 0.35;
        ev.jumped = true;
      } else {
        let climb = 0;
        if (towards > 0.2 || input.jump) climb = P.CLIMB;
        else if (towards < -0.2) climb = -P.CLIMB;
        st.vy = climb;
        // Sólo movimiento lateral (perpendicular a la escalera): pulsar W no te
        // saca del volumen aunque no haya pared detrás (escaleras en bordes de losa)
        const lat = 2.2;
        const along = wx * lad.fx + wz * lad.fz;
        st.vx = (wx - along * lad.fx) * lat;
        st.vz = (wz - along * lad.fz) * lat;
        // Pegar al jugador a la cara de la escalera (evita quedar medio metido bajo la losa de arriba)
        const k = P.RADIUS + 0.03;
        if (lad.fx !== 0) { const target = lad.x - lad.fx * k; st.vx += Math.max(-4, Math.min(4, (target - st.x) * 12)); }
        else { const target = lad.z - lad.fz * k; st.vz += Math.max(-4, Math.min(4, (target - st.z) * 12)); }
        // Tampoco salirse por los lados del volumen de la escalera
        if (lad.fx !== 0) { const cz = (lad.minZ + lad.maxZ) / 2; if (Math.abs(st.z - cz) > 0.3) st.vz += (cz - st.z) * 6; }
        else { const cx = (lad.minX + lad.maxX) / 2; if (Math.abs(st.x - cx) > 0.3) st.vx += (cx - st.x) * 6; }
        // Al llegar arriba: salir hacia donde HAYA suelo (delante si es una pared;
        // atrás o a un lado si la escalera sale por una trampilla de azotea)
        if (climb > 0 && st.y + climb * dt >= lad.maxY - 0.05) {
          const d = ladderExit(w, st, lad);
          const fwdExit = d[0] === lad.fx && d[1] === lad.fz;
          st.vx = d[0] * (fwdExit ? 3.2 : 4.2); st.vz = d[1] * (fwdExit ? 3.2 : 4.2); st.vy = 2.6;
          if (!fwdExit) { st.exitT = 0.45; st.exitX = d[0]; st.exitZ = d[1]; st.onLadder = false; st.ladderCD = 0.5; }
        }
      }
    } else {
      // Ayuda al salir de una trampilla: durante un instante se avanza hacia el suelo
      if (st.exitT > 0) { st.exitT -= dt; wx = st.exitX; wz = st.exitZ; }
      // Aceleración hacia la velocidad deseada
      const tx = wx * P.SPEED, tz = wz * P.SPEED;
      const a = (st.onGround ? P.ACCEL_GROUND : P.ACCEL_AIR) * dt;
      let dx = tx - st.vx, dz = tz - st.vz;
      const dl = Math.hypot(dx, dz);
      if (dl > a) { dx *= a / dl; dz *= a / dl; }
      // En el aire sin input no frenamos (inercia)
      if (st.onGround || wl > 0.01) { st.vx += dx; st.vz += dz; }

      if (input.jump && !st.jumpHeld && (st.onGround || st.airTime < P.COYOTE)) {
        st.vy = P.JUMP;
        st.onGround = false;
        st.airTime = P.COYOTE;
        ev.jumped = true;
      }
      st.vy = Math.max(-P.MAX_FALL, st.vy + g * dt);
    }
    st.jumpHeld = !!input.jump;
    if (wasLadder && !st.onLadder && !ev.jumped) st.airTime = 0;

    // Horizontal
    moveAxis(w, st, 'x', st.vx * dt);
    moveAxis(w, st, 'z', st.vz * dt);

    // Límites del mapa
    const lim = w.half - P.RADIUS;
    if (st.x > lim) { st.x = lim; st.vx = 0; } else if (st.x < -lim) { st.x = -lim; st.vx = 0; }
    if (st.z > lim) { st.z = lim; st.vz = 0; } else if (st.z < -lim) { st.z = -lim; st.vz = 0; }

    // Vertical
    const wasGround = st.onGround;
    const oy = st.y;
    let ny = st.y + st.vy * dt;
    if (st.vy <= 0) {
      const sup = supportBelow(w, st.x, st.z, oy + 0.01);
      if (ny <= sup) {
        if (!wasGround && st.vy < -12) ev.impact = -st.vy;
        ny = sup; st.vy = 0;
        if (!wasGround) ev.landed = true;
        st.onGround = true;
      } else if (wasGround && !ev.jumped && !st.onLadder && oy - sup < 0.6) {
        // Pegarse al suelo al bajar rampas/escalones
        ny = sup; st.vy = 0; st.onGround = true;
      } else {
        st.onGround = false;
      }
    } else {
      // Techo
      const R = P.RADIUS, headOld = oy + P.HEIGHT, headNew = ny + P.HEIGHT;
      for (const b of w.boxes) {
        if (b.minY >= headOld - 0.05 && b.minY < headNew && overlapXZ(b, st.x, st.z, R)) {
          ny = Math.min(ny, b.minY - P.HEIGHT - 0.001);
          st.vy = 0;
        }
      }
      st.onGround = false;
    }
    st.y = ny;
    if (st.onLadder) st.onGround = false;
    st.airTime = st.onGround ? 0 : st.airTime + dt;

    // Rescate: si hemos quedado dentro de algo (spawn malo, desync), subir encima
    if (blockedAt(w, st.x, st.y, st.z)) {
      const up = supportBelow(w, st.x, st.z, st.y + P.HEIGHT + 0.5);
      if (up > st.y && up - st.y < 3 && !blockedAt(w, st.x, up + 0.01, st.z)) { st.y = up + 0.001; st.vy = 0; }
    }

    // Jump pads
    if (st.onGround) {
      for (const p of w.pads) {
        if (Math.abs(st.y - p.y) < 0.25 && Math.hypot(st.x - p.x, st.z - p.z) < p.r) {
          st.vy = p.power; st.onGround = false; st.airTime = P.COYOTE;
          ev.pad = p;
          break;
        }
      }
    }
    return ev;
  }

  // Avanza dt con sub-pasos fijos
  function simulate(w, st, input, dt) {
    dt = Math.min(dt, 0.1);
    const evs = { jumped: false, landed: false, pad: null, impact: 0 };
    let n = Math.max(1, Math.ceil(dt / P.SUBSTEP));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const e = stepPlayer(w, st, input, h);
      if (e.jumped) evs.jumped = true;
      if (e.landed) evs.landed = true;
      if (e.pad) evs.pad = e.pad;
      if (e.impact) evs.impact = Math.max(evs.impact, e.impact);
    }
    return evs;
  }

  // -------------------------------------------------------------------------
  // Raycast contra el mapa (las cajas "see" — cristal, barandillas — no paran balas)
  // Devuelve la distancia al primer impacto o Infinity.
  // -------------------------------------------------------------------------
  function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
    let t0 = 0, t1 = maxT;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    const mn = [b.minX, b.minY, b.minZ], mx = [b.maxX, b.maxY, b.maxZ];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < mn[i] || o[i] > mx[i]) return Infinity;
      } else {
        let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i];
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a;
        if (c < t1) t1 = c;
        if (t0 > t1) return Infinity;
      }
    }
    return t0;
  }

  function raycast(w, ox, oy, oz, dx, dy, dz, maxT, opts) {
    const bullets = !opts || opts.bullets !== false;
    let best = maxT;
    for (const b of w.boxes) {
      if (bullets && b.see) continue;
      const t = rayBox(ox, oy, oz, dx, dy, dz, b, best);
      if (t < best) best = t;
    }
    for (const r of w.ramps) {
      const bb = { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, minY: r.thick ? r.y0 - r.thick : r.y0, maxY: r.y0 + r.h };
      const t0 = rayBox(ox, oy, oz, dx, dy, dz, bb, best);
      if (t0 === Infinity || t0 >= best) continue;
      // Avanzar dentro de la caja envolvente buscando el cruce con la superficie
      const step = 0.15;
      for (let t = t0; t < best; t += step) {
        const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
        if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) { if (t > t0 + 0.3) break; else continue; }
        const s = surf(r, x, z);
        if (y <= s && y >= rampBottom(r, s) - 0.05) { best = Math.min(best, t); break; }
      }
    }
    if (w.ground && dy < 0) {
      const t = -oy / dy;
      if (t >= 0 && t < best) best = t;
    }
    return best;
  }

  // ¿Hay línea de visión libre entre dos puntos?
  function lineOfSight(w, ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const L = Math.hypot(dx, dy, dz);
    if (L < 0.01) return true;
    return raycast(w, ax, ay, az, dx / L, dy / L, dz / L, L) >= L - 0.05;
  }

  // -------------------------------------------------------------------------
  // Granadas (esfera pequeña que rebota)
  // -------------------------------------------------------------------------
  const GR = 0.18;
  function insideAny(w, x, y, z) {
    for (const b of w.boxes) {
      if (x > b.minX - GR && x < b.maxX + GR && y > b.minY - GR && y < b.maxY + GR && z > b.minZ - GR && z < b.maxZ + GR) return b;
    }
    return null;
  }
  function stepGrenade(w, g, dt) {
    g.vy += w.gravity * 0.8 * dt;
    // X
    g.x += g.vx * dt;
    if (insideAny(w, g.x, g.y, g.z)) { g.x -= g.vx * dt; g.vx = -g.vx * 0.45; g.bounced = true; }
    g.z += g.vz * dt;
    if (insideAny(w, g.x, g.y, g.z)) { g.z -= g.vz * dt; g.vz = -g.vz * 0.45; g.bounced = true; }
    g.y += g.vy * dt;
    let hitY = insideAny(w, g.x, g.y, g.z);
    let floorY = null;
    if (hitY) {
      if (g.vy < 0) floorY = hitY.maxY + GR; else { g.y = hitY.minY - GR; g.vy = -g.vy * 0.3; }
    }
    for (const r of w.ramps) {
      if (g.x < r.minX || g.x > r.maxX || g.z < r.minZ || g.z > r.maxZ) continue;
      const s = surf(r, g.x, g.z) + GR;
      if (g.y < s && g.y > rampBottom(r, s) - 0.5) floorY = Math.max(floorY === null ? -Infinity : floorY, s);
    }
    if (w.ground && g.y < GR) floorY = Math.max(floorY === null ? -Infinity : floorY, GR);
    if (floorY !== null && g.vy <= 0) {
      g.y = floorY;
      if (g.vy < -1.5) g.bounced = true;
      g.vy = -g.vy * 0.38;
      g.vx *= 0.7; g.vz *= 0.7;
      if (Math.abs(g.vy) < 0.8) g.vy = 0;
    }
    const lim = w.half - 0.2;
    if (g.x > lim || g.x < -lim) { g.x = Math.max(-lim, Math.min(lim, g.x)); g.vx = -g.vx * 0.5; }
    if (g.z > lim || g.z < -lim) { g.z = Math.max(-lim, Math.min(lim, g.z)); g.vz = -g.vz * 0.5; }
  }

  return { P, createWorld, newState, stepPlayer, simulate, blockedAt, supportBelow, raycast, lineOfSight, stepGrenade, findLadder };
});
