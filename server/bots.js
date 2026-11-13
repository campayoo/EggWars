// ============================================================================
// server/bots.js — Bots de EGG WARS (v6.2)
//
// Un bot es un "jugador" más de la sala (GameRoom): entra con handlePlayerJoin,
// se mueve con las físicas reales (shared/physics.js) y manda sus movimientos y
// disparos por las MISMAS funciones que un jugador de verdad, así que el
// anti-trampas del servidor también los valida (no pueden hacer nada que un
// jugador no pueda).
//
// Se usa igual en el servidor LAN (salas con bots) y en el navegador (modo sin
// conexión de GitHub Pages, ver public/js/offline.js).
// ============================================================================
'use strict';

const Phys = require('../shared/physics.js');
const { WEAPONS, PRIMARY_KEYS, MODES, falloff, minInterval } = require('../shared/gamedata.js');

const TICK_MS = 1000 / 30;
const EYE = Phys.P.EYE;
const NAMES = ['Yemas', 'Clara', 'Cascarón', 'Tortilla', 'Pollito', 'Huevón', 'Frito', 'Pochado', 'Revuelto', 'Duro',
  'Kinder', 'Codorniz', 'Avestruz', 'Gallina', 'Omelette', 'Benedict', 'Rancheros', 'Mollet', 'Cocotte', 'Batido'];

// Dificultad: tiempo de reacción, error de puntería (rad), probabilidad base de acertar y giro (rad/s)
const DIFF = {
  easy:   { react: 750, aimErr: 0.17, hit: 0.32, head: 0.06, turn: 4.5, see: 38, grenade: 0.25 },
  normal: { react: 450, aimErr: 0.10, hit: 0.5,  head: 0.12, turn: 7,   see: 55, grenade: 0.5 },
  hard:   { react: 260, aimErr: 0.05, hit: 0.7,  head: 0.2,  turn: 10,  see: 70, grenade: 0.8 },
};

// ---------------------------------------------------------------------------
// Rejilla de navegación (planta baja + superficies a las que se llega andando).
// Se calcula una vez por mapa: celdas de 1 m donde cabe el huevo de pie.
// ---------------------------------------------------------------------------
const NAV_CACHE = {};
function navFor(room) {
  const md = room.mapData, key = md.id;
  if (NAV_CACHE[key] && NAV_CACHE[key].world === room.world) return NAV_CACHE[key];
  const w = room.world, H = Math.floor(md.halfSize - 1), N = H * 2 + 1, STEP = Phys.P.STEP;
  const walk = new Uint8Array(N * N), y = new Float32Array(N * N);
  const free = (x, z, s) => isFinite(s) && s > -5 && !Phys.blockedAt(w, x, s + 0.02, z);
  // 1) Planta baja: celdas a las que se llega andando desde el suelo
  const queue = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i - H, z = j - H, k = j * N + i;
    const s = Phys.supportBelow(w, x, z, STEP + 0.05);
    if (free(x, z, s)) { walk[k] = 1; y[k] = s; queue.push(k); }
  }
  // 2) Desde ahí, subir por rampas y escaleras (un escalón cada vez) hasta azoteas, gradas, etc.
  //    Cada celda guarda UNA altura: la planta baja manda; lo que sólo es alcanzable arriba va arriba.
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], cx = c % N, cz = (c / N) | 0, cy = y[c];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const nx = cx + dx, nz = cz + dz;
      if ((!dx && !dz) || nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const nk = nz * N + nx;
      if (walk[nk]) continue;
      const s = Phys.supportBelow(w, nx - H, nz - H, cy + STEP + 0.05);
      if (s < cy - 0.3 || !free(nx - H, nz - H, s)) continue;   // sólo hacia arriba o al mismo nivel
      walk[nk] = 1; y[nk] = s; queue.push(nk);
    }
  }
  const nav = { world: w, H, N, walk, y };
  NAV_CACHE[key] = nav;
  return nav;
}
function cellOf(nav, x, z) {
  const i = Math.round(x) + nav.H, j = Math.round(z) + nav.H;
  if (i < 0 || j < 0 || i >= nav.N || j >= nav.N) return -1;
  return j * nav.N + i;
}
// Celda transitable más cercana (búsqueda en espiral pequeña)
function nearestWalk(nav, x, z) {
  for (let r = 0; r <= 6; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const c = cellOf(nav, x + dx, z + dz);
      if (c >= 0 && nav.walk[c]) return c;
    }
  }
  return -1;
}
// A* en 8 direcciones (sin cortar esquinas). Devuelve una lista de puntos [x, z].
function findPath(nav, x0, z0, x1, z1, maxNodes) {
  const s = nearestWalk(nav, x0, z0), g = nearestWalk(nav, x1, z1);
  if (s < 0 || g < 0) return null;
  if (s === g) return [[x1, z1]];
  const N = nav.N, walk = nav.walk;
  const gScore = new Map([[s, 0]]), came = new Map(), open = [[0, s]], closed = new Set();
  const gx = g % N, gz = (g / N) | 0;
  const hfn = c => { const dx = Math.abs(c % N - gx), dz = Math.abs(((c / N) | 0) - gz); return Math.max(dx, dz) + 0.41 * Math.min(dx, dz); };
  let n = 0;
  while (open.length && n++ < (maxNodes || 4000)) {
    // cola de prioridad sencilla (montículo binario)
    const cur = heapPop(open)[1];
    if (cur === g) {
      const out = []; let c = g;
      while (c !== undefined) { out.push([c % N - nav.H, ((c / N) | 0) - nav.H]); c = came.get(c); }
      out.reverse(); out.shift();
      if (out.length) out[out.length - 1] = [x1, z1];
      return simplify(nav, out);
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % N, cz = (cur / N) | 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const nc = nz * N + nx;
      if (!walk[nc] || closed.has(nc)) continue;
      if (dx && dz && (!walk[cz * N + nx] || !walk[nz * N + cx])) continue;   // no cortar esquinas
      // subir: como mucho un escalón; bajar: se puede saltar desde poca altura
      const dy = nav.y[nc] - nav.y[cur];
      if (dy > Phys.P.STEP + 0.1 || dy < -2.6) continue;
      const t = gScore.get(cur) + (dx && dz ? 1.414 : 1);
      if (t < (gScore.has(nc) ? gScore.get(nc) : Infinity)) {
        gScore.set(nc, t); came.set(nc, cur);
        heapPush(open, [t + hfn(nc), nc]);
      }
    }
  }
  return null;
}
function heapPush(h, v) { h.push(v); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
function heapPop(h) {
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last; let i = 0;
    for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; }
  }
  return top;
}
// Quita puntos intermedios si se ve en línea recta (el bot no va en zigzag)
function simplify(nav, pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i + 1];
    if (!straight(nav, a[0], a[1], b[0], b[1])) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function straight(nav, x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 0.5);
  let prevY = null;
  for (let k = 0; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n;
    for (const [ox, oz] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) {
      const c = cellOf(nav, x + ox, z + oz);
      if (c < 0 || !nav.walk[c]) return false;
    }
    const c = cellOf(nav, x, z), y = nav.y[c];
    if (prevY !== null && (y - prevY > Phys.P.STEP + 0.1 || y - prevY < -2.6)) return false;
    prevY = y;
  }
  return true;
}

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------
// Gestor de bots de una sala
// ---------------------------------------------------------------------------
class BotManager {
  constructor(room, opts) {
    opts = opts || {};
    this.room = room;
    this.bots = {};
    this.seq = 0;
    this.setDifficulty(opts.difficulty);
    this.timer = setInterval(() => { try { this.tick(); } catch (e) { console.error('[bots]', e && e.stack || e); } }, TICK_MS);
  }
  setDifficulty(d) { this.diffName = DIFF[d] ? d : 'normal'; this.diff = DIFF[this.diffName]; }
  destroy() { if (this.timer) clearInterval(this.timer); this.timer = null; for (const id in this.bots) this.remove(id); }
  count() { return Object.keys(this.bots).length; }

  /** Socket "falso": lo que la sala manda sólo al bot se ignora; lo que manda "a los demás" va a todos */
  fakeSocket(id) {
    const room = this.room;
    return { id, bot: true, emit() {}, to: () => ({ emit: (ev, d) => room.io.to(room.id).emit(ev, d) }), join() {}, leave() {} };
  }

  add() {
    const used = new Set(Object.values(this.room.players).map(p => p.nickname));
    let name = NAMES.find(n => !used.has('🤖 ' + n)) || ('Bot' + (this.seq + 1));
    const id = 'bot-' + (++this.seq) + '-' + Math.random().toString(36).slice(2, 6);
    const sock = this.fakeSocket(id);
    const weapon = PRIMARY_KEYS[Math.floor(Math.random() * PRIMARY_KEYS.length)];
    const colors = ['#f6d7a7', '#ffe08a', '#f4a259', '#9bd1e5', '#c3e88d', '#f28b82', '#d7aefb', '#fff4e0'];
    const custom = { color: colors[Math.floor(Math.random() * colors.length)] };
    this.room.handlePlayerJoin(sock, { nickname: ('🤖 ' + name).substring(0, 14), weapon, custom });
    const p = this.room.players[id];
    if (!p) return null;
    p.bot = true;
    this.bots[id] = { id, sock, st: null, yaw: p.rotY || 0, pitch: 0, spawnSeen: 0, target: null, seenAt: 0, fireAt: 0, lastShot: 0,
      path: null, pathAt: 0, goal: null, strafe: 1, strafeAt: 0, jumpAt: 0, stuckAt: Date.now(), stuckPos: null, nadeAt: Date.now() + rand(6000, 12000),
      respawnDelay: rand(400, 1600) };
    return id;
  }
  remove(id) {
    if (!this.bots[id]) return;
    delete this.bots[id];
    if (this.room.players[id]) this.room.handlePlayerDisconnect(id);
  }
  removeOne() { const ids = Object.keys(this.bots); if (ids.length) this.remove(ids[ids.length - 1]); }
  /** Deja el número de bots en n (sin pasarse de las plazas libres de la sala) */
  setCount(n) {
    n = Math.max(0, Math.min(17, n | 0));
    this.target = n;
    this.balance();
  }
  balance() {
    const humans = Object.values(this.room.players).filter(p => !p.bot).length;
    const want = Math.max(0, Math.min(this.target || 0, this.room.maxPlayers - humans));
    while (this.count() < want) if (!this.add()) break;
    while (this.count() > want) this.removeOne();
  }

  tick() {
    const room = this.room;
    // Sin jugadores de verdad en la sala, los bots no gastan CPU
    const humans = Object.values(room.players).some(p => !p.bot);
    if (!humans) return;
    const now = Date.now();
    for (const id in this.bots) {
      const b = this.bots[id], p = room.players[id];
      if (!p) { delete this.bots[id]; continue; }
      this.think(b, p, now);
    }
  }

  think(b, p, now) {
    const room = this.room, d = this.diff, dt = TICK_MS / 1000;
    if (!p.alive) {
      b.st = null; b.target = null; b.path = null;
      if (p.respawnAt && now >= p.respawnAt + b.respawnDelay && room.state === 'playing') { room.handleRespawnRequest(b.id); b.respawnDelay = rand(400, 1600); }
      return;
    }
    // Recién aparecido (o corregido): el estado de físicas sale de la posición del servidor
    if (!b.st || b.spawnSeen !== p.spawnedAt) {
      b.st = Phys.newState(p.x, p.y, p.z); b.yaw = p.rotY || 0; b.spawnSeen = p.spawnedAt;
      // Papel en esta vida: la mayoría va al objetivo del modo; el resto sale a cazar
      b.role = Math.random() < 0.6 ? 'obj' : 'hunt';
      b.path = null; b.stuckPos = { x: p.x, z: p.z }; b.stuckAt = now;
    }
    if (room.state !== 'playing') { room.handlePlayerMove(b.id, { x: b.st.x, y: b.st.y, z: b.st.z, rotX: 0, rotY: b.yaw }); return; }
    const st = b.st, world = room.world;
    const wep = WEAPONS[p.weapon] || WEAPONS.rifle;

    // ---- ¿A quién veo? (cada ~0,2 s) ----
    if (!b.lookAt || now - b.lookAt > 200) {
      b.lookAt = now;
      let best = null, bestD = Infinity;
      for (const qid in room.players) {
        const q = room.players[qid];
        if (q.id === p.id || !q.alive) continue;
        if (room.mode.teams && q.team === p.team) continue;
        const dist = Math.hypot(q.x - st.x, q.y - st.y, q.z - st.z);
        if (dist > d.see || dist >= bestD) continue;
        if (!Phys.lineOfSight(world, st.x, st.y + EYE, st.z, q.x, q.y + 1, q.z)) continue;
        best = q; bestD = dist;
      }
      if (best && (!b.target || b.target !== best.id)) { b.target = best.id; b.fireAt = now + d.react * rand(0.7, 1.3); }
      if (!best) b.target = null;
    }
    const tgt = b.target && room.players[b.target];
    if (tgt && !tgt.alive) b.target = null;

    // ---- Objetivo de movimiento ----
    let goal = null, prefer = 0;
    const objMode = (room.config.mode === 'kotc' || room.config.mode === 'cts') && b.role === 'obj';
    if (tgt && tgt.alive) {
      const dist = Math.hypot(tgt.x - st.x, tgt.z - st.z);
      prefer = Math.max(2.5, Math.min(wep.range * 0.45, 18));
      // En los modos con objetivo, si el enemigo no está encima se sigue yendo al objetivo (disparando)
      if (objMode && dist > 9) goal = this.objective(b, p, now);
      else if (dist > prefer + 3) goal = { x: tgt.x, z: tgt.z };
    } else {
      goal = this.objective(b, p, now);
    }

    // ---- Camino (A*) hacia el objetivo, recalculado cada ~1,5 s ----
    let moveYaw = null, fwd = 0, side = 0, jump = false;
    if (goal) {
      if (!b.path || now - b.pathAt > 1500 || !b.goal || Math.hypot(b.goal.x - goal.x, b.goal.z - goal.z) > 3) {
        b.path = findPath(navFor(room), st.x, st.z, goal.x, goal.z) || [[goal.x, goal.z]];
        b.pathAt = now; b.goal = goal;
      }
      while (b.path.length > 1 && Math.hypot(b.path[0][0] - st.x, b.path[0][1] - st.z) < 0.9) b.path.shift();
      const wp = b.path[0];
      if (wp && Math.hypot(wp[0] - st.x, wp[1] - st.z) > 0.5) { moveYaw = Math.atan2(-(wp[0] - st.x), -(wp[1] - st.z)); fwd = 1; }
      else if (!tgt) b.goal = null;
    }

    // ---- Mirar: al objetivo si lo hay; si no, hacia donde anda ----
    let wantYaw = b.yaw, wantPitch = 0;
    if (tgt && tgt.alive) {
      const dx = tgt.x - st.x, dz = tgt.z - st.z, h = Math.hypot(dx, dz);
      wantYaw = Math.atan2(-dx, -dz);
      wantPitch = Math.atan2(tgt.y + 0.9 - (st.y + EYE), h);
    } else if (moveYaw !== null) wantYaw = moveYaw;
    const turn = d.turn * dt;
    b.yaw += Math.max(-turn, Math.min(turn, angDiff(wantYaw, b.yaw)));
    b.pitch += (wantPitch - b.pitch) * 0.3;

    // ---- Moverse en el sistema de referencia de la mirada ----
    if (tgt && tgt.alive) {
      // Combate: esquivar de lado y acercarse / alejarse
      if (now > b.strafeAt) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeAt = now + rand(500, 1500); }
      side = b.strafe;
      const dist = Math.hypot(tgt.x - st.x, tgt.z - st.z);
      if (moveYaw !== null && (dist > prefer + 3 || (objMode && dist > 9))) {
        const a = angDiff(moveYaw, b.yaw);
        fwd = Math.cos(a); side = Math.max(-1, Math.min(1, side * 0.6 - Math.sin(a)));
      } else fwd = dist < prefer * 0.5 ? -0.6 : 0;
      if (now > b.jumpAt && Math.random() < 0.02) { jump = true; b.jumpAt = now + 1200; }
    } else if (moveYaw !== null) {
      const a = angDiff(moveYaw, b.yaw);
      fwd = Math.cos(a) > 0.3 ? 1 : 0.2;
      side = -Math.sin(a) * 0.8;
    }
    // Atascado: saltar y elegir otro sitio
    if (now - b.stuckAt > 1400) {
      const moved = b.stuckPos ? Math.hypot(st.x - b.stuckPos.x, st.z - b.stuckPos.z) : 9;
      if (moved < 0.6 && (fwd || side)) { jump = true; b.path = null; b.goal = null; b.wander = null; b.strafe = -b.strafe; }
      b.stuckPos = { x: st.x, z: st.z }; b.stuckAt = now;
    }
    // Delante hay un murete bajo: saltarlo
    if (fwd > 0.5 && st.onGround) {
      const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
      if (Phys.blockedAt(world, st.x + fx * 0.7, st.y + 0.6, st.z + fz * 0.7) && !Phys.blockedAt(world, st.x + fx * 0.7, st.y + 1.3, st.z + fz * 0.7)) jump = true;
    }
    // No tirarse al vacío
    {
      const ang = b.yaw + Math.atan2(-side, fwd || 0.0001), mx = -Math.sin(ang), mz = -Math.cos(ang);
      const ahead = Phys.supportBelow(world, st.x + mx * 1.2, st.z + mz * 1.2, st.y + 0.6);
      if (!(ahead > room.mapData.killY + 2) || st.y - ahead > 7) { fwd = -0.3; side = 0; b.path = null; }
    }

    Phys.simulate(world, st, { fwd, side, yaw: b.yaw, jump }, dt);
    const before = { x: p.x, y: p.y, z: p.z };
    room.handlePlayerMove(b.id, { x: st.x, y: st.y, z: st.z, rotX: b.pitch, rotY: b.yaw });
    // Si el servidor no aceptó el movimiento, volver a su posición
    if (p.x === before.x && p.y === before.y && p.z === before.z && Math.hypot(st.x - p.x, st.z - p.z) > 0.05) { b.st = Phys.newState(p.x, p.y, p.z); b.path = null; }

    // ---- Disparar ----
    if (tgt && tgt.alive && now >= b.fireAt) this.shoot(b, p, tgt, wep, now);
  }

  /** Adónde ir cuando no se ve a nadie: el objetivo del modo, o un sitio del mapa */
  objective(b, p, now) {
    const room = this.room, md = room.mapData, m = room.config.mode;
    const carrying = room.spatula && room.spatula.carrier === p.id;
    if (b.role === 'hunt' && !carrying) return this.wanderGoal(b, p, now);
    if (m === 'kotc' && room.coop) { const z = md.coops[room.coop.idx]; return { x: z.x + rand(-1, 1), z: z.z + rand(-1, 1) }; }
    if (m === 'cts' && room.spatula && p.team) {
      const s = room.spatula;
      if (s.carrier === p.id) { const base = md.bases[p.team]; return { x: base.x, z: base.z }; }
      if (s.carrier) { const c = room.players[s.carrier]; if (c && c.team !== p.team) return { x: c.x, z: c.z }; const base = md.bases[p.team === 'red' ? 'blue' : 'red']; return { x: base.x, z: base.z }; }
      return { x: s.x, z: s.z };
    }
    return this.wanderGoal(b, p, now);
  }

  wanderGoal(b, p, now) {
    const room = this.room, md = room.mapData;
    // Hacia el enemigo más cercano (aunque no lo vea) la mitad de las veces; si no, a un spawn al azar
    if (!b.wander || now > b.wander.until || Math.hypot(b.wander.x - p.x, b.wander.z - p.z) < 2) {
      let pt = null;
      if (Math.random() < 0.55) {
        let bestD = Infinity;
        for (const qid in room.players) {
          const q = room.players[qid];
          if (q.id === p.id || !q.alive || (room.mode.teams && q.team === p.team)) continue;
          const dd = Math.hypot(q.x - p.x, q.z - p.z);
          if (dd < bestD) { bestD = dd; pt = { x: q.x, z: q.z }; }
        }
      }
      if (!pt) { const list = md.spawns.concat(md.coops); const s = list[Math.floor(Math.random() * list.length)]; pt = { x: s.x, z: s.z }; }
      b.wander = { x: pt.x, z: pt.z, until: now + rand(6000, 12000) };
    }
    return b.wander;
  }

  shoot(b, p, tgt, wep, now) {
    const room = this.room, d = this.diff, st = b.st;
    const ex = st.x, ey = st.y + EYE, ez = st.z;
    const dist = Math.hypot(tgt.x - ex, tgt.y + 0.9 - ey, tgt.z - ez);
    if (dist > wep.range) return;
    // Mirando más o menos hacia él
    const yawTo = Math.atan2(-(tgt.x - st.x), -(tgt.z - st.z));
    if (Math.abs(angDiff(yawTo, b.yaw)) > 0.35) return;
    if (!Phys.lineOfSight(room.world, ex, ey, ez, tgt.x, tgt.y + 0.9, tgt.z)) return;
    if (dist < 1.7 && now - (p.lastMelee || 0) > 700) { room.handleMelee(b.sock, { targetId: tgt.id }); return; }
    // Granada de vez en cuando a media distancia
    if (now > b.nadeAt && p.grenades > 0 && dist > 7 && dist < 22 && Math.random() < d.grenade) {
      b.nadeAt = now + rand(9000, 16000);
      const dx = tgt.x - ex, dz = tgt.z - ez, h = Math.hypot(dx, dz) || 1;
      room.handleGrenadeThrow(b.sock, { dirX: dx / h, dirY: 0.35 + h / 60, dirZ: dz / h, power: Math.min(1, 0.45 + h / 30) });
      return;
    }
    // Cadencia (un poco más lenta que la máxima del arma, como un jugador)
    const gap = minInterval(wep) * (wep.burst ? 1.15 : 1.25) + (p.weapon === 'sniper' ? 500 : 0);
    if (now - b.lastShot < gap) return;
    // Sin balas: recargar
    if (p.ammo && p.ammo[p.weapon] !== undefined) {
      if (p.reloadUntil && now < p.reloadUntil) return;
      if (p.ammo[p.weapon] <= 0) { room.handleReload(b.sock); return; }
    }
    b.lastShot = now;
    const err = d.aimErr * (0.6 + Math.random() * 0.8);
    if (wep.projectile) {
      const a = b.yaw + rand(-err, err), pt = Math.atan2(tgt.y + 0.7 - ey, Math.hypot(tgt.x - ex, tgt.z - ez)) + rand(-err, err) * 0.5;
      room.handleRocket(b.sock, { dx: -Math.sin(a) * Math.cos(pt), dy: Math.sin(pt), dz: -Math.cos(a) * Math.cos(pt) });
      return;
    }
    // Probabilidad de acierto: dificultad, distancia (caída del arma) y si se mueve él / el objetivo
    const moving = Math.hypot(st.vx || 0, st.vz || 0) > 2 ? 0.85 : 1;
    const chance = Math.max(0.05, Math.min(0.95, d.hit * moving * (0.55 + 0.45 * falloff(wep, dist)) * (1.15 - dist / (wep.range * 2.2))));
    const targets = [];
    const pellets = wep.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      if (Math.random() < chance) {
        const head = Math.random() < d.head;
        targets.push({ id: tgt.id, p: [tgt.x + rand(-0.15, 0.15), tgt.y + (head ? 1.32 : rand(0.45, 0.95)), tgt.z + rand(-0.15, 0.15)] });
      }
    }
    // Punto final del trazo (para el efecto en los clientes)
    const miss = targets.length ? 0 : 0.6 + Math.random();
    const fx = tgt.x + rand(-miss, miss), fy = tgt.y + 0.9 + rand(-miss, miss) * 0.5, fz = tgt.z + rand(-miss, miss);
    room.handlePlayerShoot(b.sock, { targets, ex: +fx.toFixed(2), ey: +fy.toFixed(2), ez: +fz.toFixed(2) });
  }
}

module.exports = { BotManager, DIFF, findPath, navFor };
