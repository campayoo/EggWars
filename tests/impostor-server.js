// Prueba de integración del modo «Huevo Impostor» con 4 clientes simulados
process.env.PORT = 3998;
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/ss-imp-');
const srv = require('../server/server.js');
const I = require('../shared/impostor.js');
const ioc = require('../node_modules/socket.io/client-dist/socket.io.js');
let fails = 0;
const assert = (c, m) => { if (!c) { console.log('  ✗ ' + m); fails++; process.exitCode = 1; } else console.log('  ✓ ' + m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://localhost:3998';
const client = () => ioc(URL, { transports: ['websocket'], forceNew: true });
function once(s, ev, ms = 3000, pred) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { s.off(ev, h); rej(new Error('timeout ' + ev)); }, ms);
    const h = d => { if (pred && !pred(d)) return; clearTimeout(t); s.off(ev, h); res(d); };
    s.on(ev, h);
  });
}
const ROOM = 'room-nave-impostor';
const room = () => srv.rooms[ROOM];
const place = (id, x, z) => { const p = room().players[id]; Object.assign(p, { x, y: 0, z }); };

(async () => {
  await wait(300);
  const names = ['Ana', 'Beto', 'Cira', 'Dani'];
  const S = [];
  for (const n of names) {
    const s = client();
    s.emit('auth:register', { username: n, password: 'huevo123' });
    await once(s, 'auth:ok');
    S.push(s);
  }
  // Separación de salas
  const normal = await new Promise(r => { S[0].emit('rooms:get'); S[0].once('rooms:list', r); });
  assert(!normal.some(r => r.kind === 'impostor'), 'la sala impostor NO sale en la lista normal');
  S[0].emit('imp:rooms');
  const il = await once(S[0], 'imp:rooms');
  assert(il.length === 1 && il[0].id === ROOM, 'la sala por defecto sale en la lista de Huevo Impostor');
  S[0].emit('player:join-room', { roomId: ROOM });
  assert(/HUEVO IMPOSTOR/.test((await once(S[0], 'rooms:error')).message), 'desde el lobby normal no se entra a una sala impostor');
  S[0].emit('player:join-room', { roomId: 'room-castle-ffa', impostor: true });
  assert(/no es de Huevo/.test((await once(S[0], 'rooms:error')).message), 'y la página impostor no entra a salas normales');

  for (const s of S) { s.emit('player:join-room', { roomId: ROOM, impostor: true }); await once(s, 'imp:joined'); }
  assert(room().getPlayersCount() === 4 && room().state === 'lobby', '4 jugadores en el vestíbulo');
  const ids = S.map(s => s.id);
  const colors = new Set(Object.values(room().players).map(p => p.color));
  assert(colors.size === 4, 'cada huevo con un color distinto');

  // Sólo el anfitrión (el primero) empieza
  S[1].emit('room:admin', { action: 'start' });
  assert(/anfitrión/.test((await once(S[1], 'room:admin-result')).error), 'sólo el anfitrión puede empezar');
  S[0].emit('room:admin', { action: 'settings', settings: { impostors: 3, tasks: 3, killCd: 15 } });
  await once(S[0], 'room:admin-result');
  const starts = S.map(s => once(s, 'imp:start'));
  S[0].emit('room:admin', { action: 'start' });
  const st = await Promise.all(starts);
  const imps = st.map((d, i) => d.role === 'impostor' ? i : -1).filter(i => i >= 0);
  assert(imps.length === 1, 'con 4 jugadores hay como máximo 1 impostor aunque se pidan 3');
  const ii = imps[0];
  const crew = [0, 1, 2, 3].filter(i => i !== ii);
  assert(st[ii].impostors.length === 1 && st[crew[0]].impostors.length === 0, 'sólo el impostor sabe quién es impostor');
  assert(st[crew[0]].tasks.length === 3, 'cada tripulante tiene 3 tareas');

  // Visión: el estado de un tripulante no incluye a quien está tras una pared
  const imp = room().players[ids[ii]], c0 = room().players[ids[crew[0]]], c1 = room().players[ids[crew[1]]], c2 = room().players[ids[crew[2]]];
  place(ids[crew[0]], -29, -2.5); place(ids[ii], 0, -10); place(ids[crew[1]], 2, 2); place(ids[crew[2]], -3, 2);
  const stView = await once(S[crew[0]], 'imp:state', 2000, d => d.st === 'playing');
  assert(!stView.pl.some(p => p[0] === ids[ii]), 'antiwallhack: no se envía a quien está detrás de una pared');
  const stView2 = await once(S[crew[1]], 'imp:state', 2000);
  assert(stView2.pl.some(p => p[0] === ids[crew[2]]), 'pero sí a quien tienes delante');

  // Tareas: demasiado rápido → rechazada; con el tiempo mínimo → hecha
  const tId = st[crew[1]].tasks[0], tSt = I.STATION[tId];
  place(ids[crew[1]], tSt.x, tSt.z);
  S[crew[1]].emit('imp:act', { a: 'task-start', id: tId });
  await wait(100);
  S[crew[1]].emit('imp:act', { a: 'task-done', id: tId });
  assert(/rápido/.test((await once(S[crew[1]], 'imp:error')).message), 'tarea hecha en 0,1 s → rechazada');
  room().players[ids[crew[1]]].taskStart[tId] = Date.now() - I.MIN_MS[tSt.type] - 50;
  S[crew[1]].emit('imp:act', { a: 'task-done', id: tId });
  assert((await once(S[crew[1]], 'imp:task')).id === tId, 'tarea completada respetando el tiempo mínimo');
  S[ii].emit('imp:act', { a: 'task-start', id: st[ii].tasks[0] });
  await wait(80);
  assert(!Object.keys(room().players[ids[ii]].taskStart).length, 'las tareas del impostor son falsas (no cuentan)');

  // Matar: cooldown inicial → rechazado; lejos → rechazado; cerca → muerto + cuerpo
  place(ids[ii], -1, -5.5); place(ids[crew[0]], 0.2, -5.5);
  S[ii].emit('imp:act', { a: 'kill', t: ids[crew[0]] });
  assert(/Aún no/.test((await once(S[ii], 'imp:error')).message), 'no se puede matar nada más empezar');
  imp.killReadyAt = 0;
  S[crew[0]].emit('imp:act', { a: 'kill', t: ids[crew[1]] });
  await wait(80);
  assert(c1.alive, 'un tripulante no puede matar');
  place(ids[crew[0]], 5.5, -5.5);
  S[ii].emit('imp:act', { a: 'kill', t: ids[crew[0]] });
  assert(/lejos/.test((await once(S[ii], 'imp:error')).message), 'a 5,5 m no se puede matar');
  place(ids[crew[0]], 0.2, -5.5);
  const killed = once(S[crew[0]], 'imp:killed');
  S[ii].emit('imp:act', { a: 'kill', t: ids[crew[0]] });
  assert((await killed).by === ids[ii] && !c0.alive && room().bodies.length === 1, 'asesinato válido: fantasma y cuerpo en el suelo');
  assert(imp.killReadyAt > Date.now() + 10000, 'el impostor vuelve a esperar el cooldown');
  // Los fantasmas no se ven entre los vivos, y sus mensajes sólo los leen otros fantasmas
  const sv = await once(S[crew[1]], 'imp:state', 2000);
  assert(!sv.pl.some(p => p[0] === ids[crew[0]]), 'los vivos no ven al fantasma');
  S[crew[1]].emit('player:chat', { message: 'hola' });
  assert(/reuniones/.test((await once(S[crew[1]], 'imp:notice')).text), 'los vivos no pueden hablar fuera de las reuniones');

  // Sabotaje de puertas: cierra el comedor y bloquea el paso en el servidor
  imp.inVent = null; room().doorsReadyAt = 0;
  S[ii].emit('imp:act', { a: 'sabotage', kind: 'puertas', room: 'comedor' });
  await wait(100);
  assert(Object.keys(room().doors).length === 4 && room().world.boxes.some(b => b.door), 'puertas del comedor cerradas (cajas sólidas en el servidor)');
  // Luces
  room().sabReadyAt = 0;
  S[ii].emit('imp:act', { a: 'sabotage', kind: 'luces' });
  await once(S[crew[1]], 'imp:sabotage');
  assert(room().sab && room().sab.kind === 'luces', 'luces saboteadas');
  place(ids[crew[2]], I.LIGHTS_PANEL.x, I.LIGHTS_PANEL.z);
  S[crew[2]].emit('imp:act', { a: 'task-start', id: 'fix_luces' });
  await wait(1000);
  S[crew[2]].emit('imp:act', { a: 'task-done', id: 'fix_luces' });
  await wait(100);
  assert(!room().sab, 'luces arregladas en el panel');

  // Cámaras: desde el panel se ve a quien pasa por delante de una cámara (y sólo entonces)
  const cam = I.CAMS[0], cw = room().players[ids[crew[2]]];
  place(ids[crew[2]], I.CAM_PANEL.x, I.CAM_PANEL.z);
  place(ids[crew[1]], cam.look[0] - 2, cam.look[1]);
  let sc = await once(S[crew[2]], 'imp:state', 2000);
  assert(!sc.pl.some(p => p[0] === ids[crew[1]]), 'sin mirar las cámaras no se ve el anillo');
  S[crew[2]].emit('imp:act', { a: 'cams', on: true });
  await wait(120);
  sc = await once(S[crew[2]], 'imp:state', 2000);
  assert(cw.cams && sc.pl.some(p => p[0] === ids[crew[1]]), 'mirando las cámaras se ve a quien pasa por el anillo');
  S[crew[2]].emit('imp:act', { a: 'cams', on: false });
  await wait(80);
  // Conductos: entrar, moverse por la red, salir
  const v = I.VENTS[0];
  place(ids[ii], v.x, v.z);
  S[ii].emit('imp:act', { a: 'vent', op: 'enter', id: v.id });
  await once(S[ii], 'imp:vent');
  S[ii].emit('imp:act', { a: 'vent', op: 'move', id: v.links[0] });
  await once(S[ii], 'imp:vent');
  assert(imp.inVent === v.links[0] && Math.hypot(imp.x - I.VENT[v.links[0]].x, imp.z - I.VENT[v.links[0]].z) < 0.01, 'viaje por los conductos');
  S[ii].emit('imp:act', { a: 'vent', op: 'move', id: 'v_pue' });
  await wait(80);
  assert(imp.inVent === v.links[0], 'no se salta a un conducto de otra red');
  S[ii].emit('imp:act', { a: 'vent', op: 'exit', id: imp.inVent });
  await once(S[ii], 'imp:vent');
  assert(!imp.inVent, 'salir del conducto');

  // Informar del cuerpo → reunión → votación → expulsión
  const body = room().bodies[0];
  place(ids[crew[1]], body.x + 1, body.z);
  const mts = S.map(s => once(s, 'imp:meeting'));
  S[crew[1]].emit('imp:act', { a: 'report', body: body.id });
  const mt = await mts[0];
  assert(room().state === 'meeting' && mt.dead.includes(ids[crew[0]]), 'reunión: se sabe quién ha muerto');
  assert(!Object.keys(room().doors).length, 'la reunión abre las puertas');
  S[crew[1]].emit('imp:act', { a: 'vote', t: ids[ii] });
  assert(/debatiendo/.test((await once(S[crew[1]], 'imp:error')).message), 'no se vota durante el debate');
  room().meeting.voteAt = 0;
  S[crew[0]].emit('imp:act', { a: 'vote', t: ids[crew[1]] });
  await wait(60);
  assert(room().meeting.votes[ids[crew[0]]] === undefined, 'los fantasmas no votan');
  const ends = once(S[0], 'imp:meeting-end');
  S[crew[1]].emit('imp:act', { a: 'vote', t: ids[ii] });
  S[crew[2]].emit('imp:act', { a: 'vote', t: ids[ii] });
  S[ii].emit('imp:act', { a: 'vote', t: 'skip' });
  const res = await ends;
  assert(res.ejected === ids[ii] && res.wasImpostor === true && res.impostorsLeft === 0, 'el impostor es expulsado y se confirma');
  room().ejectEndAt = 0;
  const over = await once(S[0], 'imp:over', 3000);
  assert(over.winner === 'crew', 'gana la tripulación al expulsar al último impostor');

  // Vuelta al vestíbulo y práctica en solitario
  room().endAt = 0;
  await wait(200);
  assert(room().state === 'lobby', 'vuelta al vestíbulo');
  for (let i = 1; i < 4; i++) S[i].emit('player:leave-room');
  await wait(150);
  S[0].emit('room:admin', { action: 'start' });
  assert(/práctica/.test((await once(S[0], 'room:admin-result')).error), 'con 1 jugador sólo se puede hacer práctica');
  const ps = once(S[0], 'imp:start');
  S[0].emit('room:admin', { action: 'start', practice: true, role: 'impostor' });
  const pr = await ps;
  assert(pr.practice && pr.role === 'impostor', 'práctica en solitario como impostor');
  room().sabReadyAt = 0;
  S[0].emit('imp:act', { a: 'sabotage', kind: 'reactor' });
  await once(S[0], 'imp:sabotage');
  room().sab.endsAt = Date.now();
  await wait(150);
  assert(room().state === 'playing' && !room().sab, 'en práctica el reactor no termina la partida');

  // Mensajes basura: el servidor no se cae
  const junk = [null, 1, 'x', { a: 'kill', t: { x: 1 } }, { a: 'vent', op: 'move', id: '__proto__' }, { a: 'vote', t: 'constructor' }, { a: 'sabotage', kind: 'puertas', room: '__proto__' }, { a: 'task-done', id: 'toString' }, { a: 'pad', pad: 'Z', on: 1 }];
  for (const j of junk) S[0].emit('imp:act', j);
  S[0].emit('player:move', { x: 'a', y: NaN, z: 1e9 });
  await wait(200);
  assert(room() && room().state === 'playing', 'el servidor aguanta mensajes basura');

  console.log(fails ? `\n❌ Huevo Impostor: ${fails} fallos` : '\n✅ Huevo Impostor: servidor OK');
  S.forEach(s => s.close());
  setTimeout(() => process.exit(fails ? 1 : 0), 100);
})().catch(e => { console.error(e); process.exit(1); });
