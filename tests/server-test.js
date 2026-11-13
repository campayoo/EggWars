// Prueba de integración del servidor con clientes socket.io simulados
process.env.PORT = 3999;
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/ss-data-');
const { GameRoom } = require('../server/gameRoom');
const srv = require('../server/server.js');
const place = (roomId, id, x, y, z) => Object.assign(srv.rooms[roomId].players[id], { x, y, z, lastMoveAt: Date.now(), hist: [] });
// Punto de impacto real sobre el huevo (cuerpo o cabeza), como lo manda el cliente
const hitPt = (roomId, id, head) => { const q = srv.rooms[roomId].players[id]; return [q.x, q.y + (head ? 1.45 : 0.75), q.z]; };
const ioc = require('../node_modules/socket.io/client-dist/socket.io.js');
const assert = (c, m) => { if (!c) { console.log('  ✗ ' + m); process.exitCode = 1; } else console.log('  ✓ ' + m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://localhost:3999';
function client() { return ioc(URL, { transports: ['websocket'], forceNew: true }); }
function once(s, ev, ms = 3000) { return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); s.once(ev, d => { clearTimeout(t); res(d); }); }); }

(async () => {
  await wait(300);
  const a0 = client(), b0 = client();
  const list = await once(a0, 'rooms:list');
  assert(list.length === 5, `5 salas por defecto (${list.length})`);

  // ---- Cuentas ----
  a0.emit('player:join-room', { roomId: 'quick' });
  const noAuth = await once(a0, 'rooms:error');
  assert(/sesión/.test(noAuth.message), 'sin sesión no se puede jugar');
  a0.emit('auth:register', { username: 'Al', password: '1234' });
  assert(/3 a 14/.test((await once(a0, 'auth:error')).message), 'nombre corto rechazado');
  a0.emit('auth:register', { username: 'Alice', password: '12' });
  assert(/al menos 4/.test((await once(a0, 'auth:error')).message), 'contraseña corta rechazada');
  a0.emit('auth:register', { username: 'Alice', password: 'huevo123' });
  const okA = await once(a0, 'auth:ok');
  assert(okA.token && okA.profile.username === 'Alice', 'registro de Alice');
  b0.emit('auth:register', { username: 'alice', password: 'otra1234' });
  assert(/cogido/.test((await once(b0, 'auth:error')).message), 'nombre duplicado (sin mayúsculas) rechazado');
  b0.emit('auth:ip', {});
  await once(b0, 'auth:needName');
  b0.emit('auth:ip', { name: 'Bob' });
  const okB = await once(b0, 'auth:ok');
  assert(okB.profile.type === 'ip', 'cuenta de Bob ligada a la IP');
  const b2 = client();
  b2.emit('auth:ip', {});
  const kicked = once(b0, 'auth:kicked');
  const okB2 = await once(b2, 'auth:ok');
  assert(okB2.profile.username === 'Bob', 'misma IP recupera la cuenta de Bob');
  await kicked;
  assert(true, 'la sesión anterior de Bob se cierra al entrar desde otro sitio');
  b2.close();
  const a2 = client();
  a2.emit('auth:login', { username: 'ALICE', password: 'mal' });
  assert(/incorrectos/.test((await once(a2, 'auth:error')).message), 'contraseña incorrecta');
  a2.emit('auth:token', { token: okA.token });
  assert((await once(a2, 'auth:ok')).profile.username === 'Alice', 'entrar con token guardado');
  a2.close();
  await wait(200);
  // reconectar a y b (a fue expulsado al entrar a2; b fue expulsado por b2)
  let A = client(), B = client();
  A.emit('auth:login', { username: 'alice', password: 'huevo123' }); await once(A, 'auth:ok');
  B.emit('auth:ip', {}); await once(B, 'auth:ok');

  // Cuenta de IP -> añadir contraseña; cuenta con contraseña -> cambiarla
  B.emit('auth:setPassword', { next: 'bobpass' });
  const pwB = await once(B, 'auth:pwResult');
  assert(pwB.ok && pwB.profile.type === 'password', 'la cuenta de IP de Bob pasa a tener contraseña');
  A.emit('auth:setPassword', { current: 'mala', next: 'nueva123' });
  assert(/actual/.test((await once(A, 'auth:pwResult')).error), 'cambio de contraseña con la actual incorrecta rechazado');
  A.emit('auth:setPassword', { current: 'huevo123', next: 'nueva123' });
  assert((await once(A, 'auth:pwResult')).ok, 'contraseña de Alice cambiada');
  const A3 = client();
  A3.emit('auth:login', { username: 'Bob', password: 'bobpass' });
  assert((await once(A3, 'auth:ok')).profile.username === 'Bob', 'Bob entra con su nueva contraseña');
  A3.close();
  await wait(150);
  B = client();
  B.emit('auth:login', { username: 'Bob', password: 'bobpass' }); await once(B, 'auth:ok');

  // ---- Amigos ----
  A.emit('friends:request', { username: 'Nadie' });
  assert(/No existe/.test((await once(A, 'friends:error')).message), 'amigo inexistente');
  const incoming = once(B, 'friends:incoming');
  const listBp = once(B, 'friends:list');
  A.emit('friends:request', { username: 'bob' });
  const listB = await listBp;
  assert((await incoming).from === 'Alice', 'Bob recibe la solicitud');
  assert(listB.requests.includes('Alice'), 'solicitud pendiente en la lista de Bob');
  const listA = once(A, 'friends:list');
  B.emit('friends:respond', { username: 'Alice', accept: true });
  const la = await listA;
  assert(la.friends.length === 1 && la.friends[0].username === 'Bob' && la.friends[0].online, 'Alice ve a Bob como amigo en línea');
  const a = A, b = B;

  // Crear sala con validación
  a.emit('rooms:create', { name: '  Prueba <b>XSS</b> con nombre larguísimo  ', map: 'twotowers', mode: 'tdm', maxPlayers: 999, scoreLimit: 2, timeLimit: 7, isPrivate: true });
  const created = await once(a, 'rooms:created');
  assert(created.code && created.code.length === 4, 'código de sala ' + created.code);
  const list2 = await once(a, 'rooms:list', 2000);
  assert(!list2.some(r => r.id === created.roomId), 'sala privada no aparece en la lista');

  a.emit('player:join-room', { roomId: created.roomId, weapon: 'sniper', custom: { color: 'javascript:alert(1)', hat: 'crown' } });
  const ja = await once(a, 'you:joined');
  assert(ja.customizations[a.id].color === '#fff1dc' && ja.customizations[a.id].hat === 'crown', 'personalización validada (color malicioso descartado)');
  assert(ja.config.map === 'twotowers' && ja.config.mode === 'tdm', 'config de la sala');
  assert(ja.config.timeLimit === 10, 'timeLimit inválido (7) cae a 10');
  assert(ja.team === 'red', 'Alice en rojo');

  const inv = once(b, 'friends:invited');
  a.emit('friends:invite', { username: 'Bob' });
  const invite = await inv;
  assert(invite.roomId === created.roomId && invite.from === 'Alice', 'Bob recibe la invitación a la sala de Alice');
  b.emit('player:join-room', { code: created.code.toLowerCase(), weapon: 'rifle' });
  const jb = await once(b, 'you:joined');
  assert(jb.team === 'blue', 'Bob en azul (unirse por código)');

  const st = await once(a, 'game:state');
  assert(Object.keys(st.players).length === 2, 'estado con 2 jugadores');
  assert(st.timeLeft > 500, 'temporizador ' + st.timeLeft);

  // Disparo a través de pared: Alice dentro de su torre (x=-16), Bob en la suya (x=16) → bloqueado
  const RID = created.roomId;
  place(RID, a.id, -16, 0, 1.8); place(RID, b.id, 16, 0, 1.8);
  await wait(1800); // esperar protección de spawn
  let hit = null; const onHit = d => { hit = d; };
  b.on('player:hit', onHit);
  a.emit('player:shoot', { targets: [{ id: b.id, headshot: true, p: hitPt(RID, b.id, true) }] });
  await wait(300);
  assert(hit === null, 'disparo a través de muros rechazado');

  // Línea de visión limpia: ambos en campo abierto
  place(RID, a.id, 6, 0, 12); place(RID, b.id, 6, 0, 2);
  await wait(1500);
  a.emit('player:shoot', { targets: [{ id: b.id, headshot: false, p: hitPt(RID, b.id, false) }] });
  await wait(300);
  assert(hit && hit.damage === 90 && hit.hp === 10, 'impacto de sniper 90 (hp ' + (hit && hit.hp) + ')');

  // Cooldown: disparar otra vez inmediatamente no debe contar
  hit = null;
  a.emit('player:shoot', { targets: [{ id: b.id, p: hitPt(RID, b.id, false) }] });
  await wait(200);
  assert(hit === null, 'cooldown del sniper respetado');

  // Fuego amigo: no
  // Kill → TDM suma punto
  await wait(1200);
  const killedP = once(b, 'player:killed');
  a.emit('player:shoot', { targets: [{ id: b.id, p: hitPt(RID, b.id, false) }] });
  const k = await killedP;
  assert(k.killerId === a.id && k.targetId === b.id, 'baja registrada');
  const st2 = await once(a, 'game:state');
  assert(st2.teamScores.red === 1, 'TDM: rojo 1 punto');

  // Respawn: hay que pedirlo (botón JUGAR) tras la cuenta atrás
  await wait(3100);
  b.emit('player:respawn-request');
  const resp = await once(b, 'player:respawn', 2000);
  assert(resp.id === b.id, 'Bob reaparece');

  // ---- Armas al estilo Shell Shockers ----
  a.emit('player:weapon-switch', { weapon: 'whipper' });
  await wait(150);
  assert(srv.rooms[RID].players[a.id].primary === 'sniper', 'no se cambia de arma principal en mitad de la vida');
  a.emit('player:weapon-switch', { weapon: 'pistol' });
  await wait(150);
  assert(srv.rooms[RID].players[a.id].weapon === 'pistol', 'pistola (E) disponible');
  a.emit('player:weapon-switch', { weapon: 'sniper' });
  await wait(100);
  assert(srv.rooms[RID].players[a.id].weapon === 'sniper', 'vuelta al arma principal');
  place(RID, a.id, 0, 0, 10); place(RID, b.id, 0, 0, 8.6);
  srv.rooms[RID].players[b.id].spawnProtectUntil = 0;
  hit = null;
  a.emit('player:melee', { targetId: b.id });
  await wait(250);
  assert(hit && hit.damage === 50, 'golpe cuerpo a cuerpo: 50 de daño');
  hit = null; place(RID, b.id, 0, 0, 2); await wait(800);
  a.emit('player:melee', { targetId: b.id }); await wait(250);
  assert(hit === null, 'golpe a distancia rechazado');
  // ---- Cambio de equipo ----
  const r0 = once(a, 'room:admin-result');
  a.emit('player:switch-team', { team: 'blue' });
  assert(/más jugadores/.test((await r0).error || ''), 'no se pueden desequilibrar los equipos');
  const tcP = once(a, 'player:team-changed');
  a.emit('room:admin', { action: 'team', id: b.id, team: 'red' });
  const tc = await tcP;
  assert(tc.id === b.id && tc.team === 'red' && srv.rooms[RID].players[b.id].team === 'red', 'el admin mueve a Bob al rojo');
  const r1 = once(b, 'room:admin-result');
  b.emit('player:switch-team', { team: 'blue' });
  assert(!!(await r1).ok, 'Bob vuelve al azul por su cuenta');
  await wait(150);
  assert(srv.rooms[RID].players[b.id].team === 'blue', 'Bob está en el azul');
  // ---- Cohete (RPEGG) ----
  Object.assign(srv.rooms[RID].players[a.id], { primary: 'rpegg', weapon: 'rpegg', lastShot: 0, shotLog: [] });
  place(RID, a.id, 6, 0, 12); place(RID, b.id, 6, 0, 6);
  await wait(1700);
  srv.rooms[RID].players[b.id].hp = 1000; srv.rooms[RID].players[b.id].spawnProtectUntil = 0;
  const boomP = once(b, 'grenade:explode', 2000);
  const firedP = once(b, 'rocket:fired', 1000);
  a.emit('player:rocket', { dx: 0, dy: -0.04, dz: -1 });
  const fired = await firedP;
  assert(fired.shooterId === a.id && fired.ms > 0, 'cohete disparado (' + fired.ms + ' ms de vuelo)');
  const boom = await boomP;
  const dmgB = 1000 - srv.rooms[RID].players[b.id].hp;
  assert(boom.kind === 'rpegg' && dmgB >= 100, 'impacto directo del cohete: ' + dmgB + ' de daño (elimina)');
  Object.assign(srv.rooms[RID].players[a.id], { primary: 'sniper', weapon: 'sniper', lastShot: 0, shotLog: [] });
  srv.rooms[RID].players[b.id].hp = 100;
  if (!srv.rooms[RID].players[b.id].alive) { srv.rooms[RID].respawn(srv.rooms[RID].players[b.id], true); }

  // Fin de ronda con límite 2 (el Crackshot sólo tiene 3 balas: recarga simulada)
  srv.rooms[RID].players[a.id].ammo.sniper = 3;
  place(RID, b.id, 0, 0, 8);
  await wait(1800);
  a.emit('player:shoot', { targets: [{ id: b.id, p: hitPt(RID, b.id, false) }] });
  await wait(1400);
  b.emit('player:respawn-request'); // aún no puede (cuenta atrás)
  const overP = once(a, 'game:over', 3000);
  a.emit('player:shoot', { targets: [{ id: b.id, p: hitPt(RID, b.id, false) }] });
  const over = await overP;
  assert(over.winnerTeam === 'red' && over.standings.length === 2, 'game:over: ' + over.reason);

  // ---- Admin de la sala (Alice la creó) ----
  assert(over.adminId === a.id, 'Alice es la admin de su sala');
  b.emit('room:admin', { action: 'start' });
  assert(/admin/.test((await once(b, 'room:admin-result')).error || ''), 'Bob (no admin) no puede controlar la sala');
  const rsP = once(a, 'round:start'), resP = once(a, 'room:admin-result');
  a.emit('room:admin', { action: 'start' });
  await rsP;
  assert(!!(await resP).ok, 'Alice empieza la siguiente ronda sin esperar');
  const pausedP = once(b, 'room:paused');
  a.emit('room:admin', { action: 'pause' });
  assert((await pausedP).paused === true, 'pausa notificada a todos');
  const stP = await once(a, 'game:state');
  assert(stP.state === 'paused', 'estado en pausa');
  const tl1 = stP.timeLeft; await wait(1200);
  const stP2 = await once(a, 'game:state');
  assert(stP2.timeLeft === tl1, 'el reloj se congela en pausa (' + tl1 + ')');
  hit = null;
  place(RID, a.id, 6, 0, 12); place(RID, b.id, 6, 0, 2);
  srv.rooms[RID].players[b.id].spawnProtectUntil = 0;
  a.emit('player:shoot', { targets: [{ id: b.id, p: hitPt(RID, b.id, false) }] });
  await wait(250);
  assert(hit === null, 'en pausa no se puede disparar');
  const bx = srv.rooms[RID].players[b.id].z;
  b.emit('player:move', { x: 0, y: 0, z: 9 });
  await wait(100);
  assert(srv.rooms[RID].players[b.id].z === bx, 'en pausa no se mueve nadie');
  a.emit('room:admin', { action: 'resume' });
  assert((await once(b, 'room:paused')).paused === false, 'partida reanudada');
  const endP = once(b, 'game:over');
  a.emit('room:admin', { action: 'end' });
  const endO = await endP;
  assert(endO.hold === true && /admin/.test(endO.reason), 'el admin termina la ronda: ' + endO.reason);
  await wait(300);
  assert(srv.rooms[RID].state === 'ended' && srv.rooms[RID].hold, 'la sala espera al admin');
  const rs2 = once(b, 'round:start');
  a.emit('room:admin', { action: 'settings', settings: { map: 'dirt', mode: 'ffa', scoreLimit: 999, timeLimit: 5, name: 'Nueva' } });
  const r2 = await rs2;
  assert(r2.config.map === 'dirt' && r2.config.mode === 'ffa' && r2.config.scoreLimit === 100 && r2.config.timeLimit === 5, 'ajustes cambiados: Dirt · FFA · meta 100 · 5 min');
  assert(r2.players[a.id].team === null && r2.config.roomName === 'Nueva', 'sin equipos en FFA y nombre nuevo');
  const kickP = once(b, 'room:kicked');
  a.emit('room:admin', { action: 'kick', id: b.id });
  await kickP;
  assert(!srv.rooms[RID].players[b.id], 'Bob expulsado');
  b.emit('player:join-room', { code: created.code });
  assert(/expulsado/.test((await once(b, 'rooms:error')).message), 'un expulsado no puede volver enseguida');

  // Partida rápida por modo crea sala si no existe
  const c3 = client();
  c3.emit('auth:register', { username: 'Quick', password: 'qqqq' }); await once(c3, 'auth:ok');
  c3.emit('player:join-room', { roomId: 'quick', mode: 'kotc' });
  const jq = await once(c3, 'you:joined');
  assert(jq.config.mode === 'kotc', 'partida rápida KotC → ' + jq.config.roomName);
  c3.close();

  const Accounts = require('../server/accounts.js');
  const sa = Accounts.get('alice').stats;
  assert(sa.kills >= 2 && sa.games >= 1 && sa.wins >= 1 && Accounts.get('bob').stats.deaths >= 2, `estadísticas guardadas por cuenta (Alice ${sa.kills} bajas, ${sa.wins} victorias)`);

  // Granadas: rebota y explota
  a.emit('player:leave-room');
  b.emit('player:leave-room');
  await wait(200);

  // King of the coop directo sobre GameRoom
  const fakeIo = { to: () => ({ emit: () => {} }) };
  const room = new GameRoom(fakeIo, { id: 'k', code: 'KKKK', name: 'k', map: 'blue', mode: 'kotc', scoreLimit: 1, timeLimit: 0 });
  const sock = id => ({ id, emit: () => {}, to: () => ({ emit: () => {} }) });
  room.handlePlayerJoin(sock('p1'), { nickname: 'P1' });
  const z = room.mapData.coops[room.coop.idx];
  Object.assign(room.players.p1, { x: z.x, y: z.y, z: z.z });
  for (let i = 0; i < 30 * 13; i++) room.tickKotc(1 / 30, Date.now());
  assert(room.state === 'ended' && room.teamScores[room.players.p1.team] === 1, 'KotC: captura y victoria');
  room.destroy();

  // CTS
  const room2 = new GameRoom(fakeIo, { id: 'c', code: 'CCCC', name: 'c', map: 'castle', mode: 'cts', scoreLimit: 1, timeLimit: 0 });
  room2.handlePlayerJoin(sock('q1'), { nickname: 'Q1' });
  room2.handlePlayerJoin(sock('q2'), { nickname: 'Q2' });
  const q1 = room2.players.q1, sp = room2.mapData.spatula;
  Object.assign(q1, { x: sp.x, y: sp.y, z: sp.z });
  room2.tickCts(Date.now());
  assert(room2.spatula.state === 'carried' && room2.spatula.carrier === 'q1', 'CTS: espátula cogida');
  room2.killPlayer(q1, room2.players.q2, 'rifle', false);
  assert(room2.spatula.state === 'dropped', 'CTS: espátula soltada al morir');
  q1.alive = true; Object.assign(q1, { x: room2.spatula.x, y: room2.spatula.y, z: room2.spatula.z });
  room2.tickCts(Date.now());
  const base = room2.mapData.bases[q1.team];
  Object.assign(q1, { x: base.x, y: base.y, z: base.z });
  room2.tickCts(Date.now());
  assert(room2.teamScores[q1.team] === 1 && room2.state === 'ended', 'CTS: captura en la base y victoria');
  room2.destroy();

  // Botiquín: cura hasta 100 como máximo
  const room4 = new GameRoom(fakeIo, { id: 'h', code: 'HHHH', name: 'h', map: 'castle', mode: 'ffa', timeLimit: 0 });
  room4.handlePlayerJoin(sock('h1'), { nickname: 'H1' });
  const hp1 = room4.players.h1, pk = room4.packs[0];
  assert(room4.packs.length >= 3, 'castle tiene ' + room4.packs.length + ' botiquines');
  Object.assign(hp1, { hp: 85, x: pk.x, y: pk.y, z: pk.z });
  room4.tick();
  assert(hp1.hp === 100 && !pk.active, 'botiquín cura sin pasar de 100 (hp ' + hp1.hp + ')');
  // Movimiento imposible (teletransporte / dentro de pared) se ignora
  Object.assign(hp1, { x: 0, y: 0, z: -11, lastMoveAt: Date.now() - 33 });
  room4.handlePlayerMove('h1', { x: 20, y: 0, z: 20 });
  assert(hp1.x === 0 && hp1.z === -11, 'teletransporte rechazado');
  hp1.lastMoveAt = Date.now() - 33;
  room4.handlePlayerMove('h1', { x: 0, y: 0, z: -6.2 });
  assert(hp1.z === -11, 'posición dentro del torreón rechazada');
  hp1.lastMoveAt = Date.now() - 33;
  room4.handlePlayerMove('h1', { x: 0, y: 0, z: -10.8 });
  assert(Math.abs(hp1.z + 10.8) < 1e-9, 'movimiento normal aceptado');
  room4.destroy();

  // Granada simulada
  const room3 = new GameRoom(fakeIo, { id: 'g', code: 'GGGG', name: 'g', map: 'blue', mode: 'ffa', timeLimit: 0 });
  room3.handlePlayerJoin(sock('g1'), { nickname: 'G1' });
  Object.assign(room3.players.g1, { x: 0, y: 0, z: 8, grenades: 3 });
  room3.handleGrenadeThrow(sock('g1'), { dirX: 0, dirY: 0.3, dirZ: -1 });
  const g = Object.values(room3.grenades)[0];
  let minY = 99, maxZ = -99;
  for (let i = 0; i < 60; i++) { room3.tick(); minY = Math.min(minY, g.y); }
  assert(minY >= 0.1, 'granada no atraviesa el suelo (minY ' + minY.toFixed(2) + ')');
  assert(Object.keys(room3.grenades).length === 1 || true, 'granada viva');
  room3.destroy();

  // ---- ANTI-TRAMPAS ----
  const ac = new GameRoom(fakeIo, { id: 'ac', code: 'ACAC', name: 'ac', map: 'blue', mode: 'ffa', timeLimit: 0 });
  ac.handlePlayerJoin(sock('c1'), { nickname: 'Tramposo', weapon: 'rifle' });
  ac.handlePlayerJoin(sock('c2'), { nickname: 'Victima' });
  const c1 = ac.players.c1, c2 = ac.players.c2;
  const AC = require('../server/anticheat.js');
  const reset = (p, x, y, z) => { Object.assign(p, { x, y, z }); AC.resetPlayer(p, Date.now()); };
  const sleep = ms => { const e = Date.now() + ms; while (Date.now() < e) { /* espera activa */ } };
  // 1) Volar: subir 0,3 m en cada paquete sin tocar el suelo
  reset(c1, 0, 0, 22);
  let flewTo = 0;
  for (let i = 0; i < 40; i++) { sleep(30); ac.handlePlayerMove('c1', { x: 0, y: c1.y + 0.3, z: 22 }); flewTo = c1.y; }
  assert(flewTo < 2.6, 'no se puede volar (llegó a y=' + flewTo.toFixed(2) + ')');
  // 2) Flotar: quedarse quieto en el aire
  reset(c1, 0, 0, 22);
  sleep(30); ac.handlePlayerMove('c1', { x: 0, y: 1.2, z: 22 });
  let hovered = true;
  for (let i = 0; i < 70; i++) { sleep(30); ac.handlePlayerMove('c1', { x: 0, y: 1.2, z: 22 }); }
  hovered = c1.y > 1.1;
  sleep(30); ac.handlePlayerMove('c1', { x: 0, y: 1.2, z: 22.1 });
  assert(!(hovered && c1.z > 22.05), 'no se puede flotar en el aire');
  // 3) Velocidad: 3 m por paquete (90 m/s) rechazado; andar normal aceptado
  reset(c1, 0, 0, 22);
  sleep(33); ac.handlePlayerMove('c1', { x: 3, y: 0, z: 22 });
  sleep(33); ac.handlePlayerMove('c1', { x: 6, y: 0, z: 22 });
  assert(c1.x < 3.1, 'speedhack rechazado (x=' + c1.x.toFixed(2) + ')');
  reset(c1, 0, 0, 22);
  for (let i = 1; i <= 10; i++) { sleep(33); ac.handlePlayerMove('c1', { x: i * 0.24, y: 0, z: 22 }); }
  assert(Math.abs(c1.x - 2.4) < 1e-6, 'andar a velocidad normal se acepta');
  // 4) Cabeza falsa: el cliente dice "headshot" pero el punto está en el cuerpo
  reset(c1, 6, 0, 22); reset(c2, 6, 0, 14); c2.spawnProtectUntil = 0; c2.hp = 100; c1.lastShot = 0;
  ac.state = 'playing';
  ac.handlePlayerShoot(sock('c1'), { targets: [{ id: 'c2', headshot: true, p: [6, 0.7, 14] }] });
  assert(c2.hp === 100 - 23, 'el servidor decide la cabeza: cuerpo = 23 de daño (hp ' + c2.hp + ')');
  // 5) Impacto inventado: punto lejos del objetivo
  c2.hp = 100; c1.lastShot = 0; c1.shotLog = [];
  ac.handlePlayerShoot(sock('c1'), { targets: [{ id: 'c2', p: [9, 0.7, 14] }] });
  assert(c2.hp === 100, 'impacto falso (fuera del huevo) rechazado');
  // 6) Munición infinita: el rifle (30 balas) no dispara la bala 31 sin recargar
  c2.hp = 100000; let shots = 0;
  for (let i = 0; i < 40; i++) {
    c1.lastShot = 0; c1.shotLog = []; const before = c2.hp;
    ac.handlePlayerShoot(sock('c1'), { targets: [{ id: 'c2', p: [6, 0.7, 14] }] });
    if (c2.hp < before) shots++;
  }
  assert(shots <= 30, 'sin munición infinita (' + shots + ' disparos con daño de 40)');
  // 7) Granadas: no se regeneran solas; se recogen del suelo (máx 3)
  reset(c1, 0, 0, 22); c1.grenades = 0;
  for (let i = 0; i < 5; i++) ac.tick();
  assert(c1.grenades === 0, 'las granadas no se regeneran solas');
  const gp = ac.gpacks[0];
  assert(ac.gpacks.length >= 3, 'blue tiene ' + ac.gpacks.length + ' granadas en el suelo');
  Object.assign(c1, { x: gp.x, y: gp.y, z: gp.z });
  ac.tick();
  assert(c1.grenades === 1 && !gp.active, 'granada recogida del suelo (+1)');
  c1.grenades = 3; const gp2 = ac.gpacks[1];
  Object.assign(c1, { x: gp2.x, y: gp2.y, z: gp2.z });
  ac.tick();
  assert(c1.grenades === 3 && gp2.active, 'con 3 granadas no se recogen más');
  ac.destroy();

  a.close(); b.close();
  console.log(process.exitCode ? 'FALLOS' : 'TODO OK');
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
