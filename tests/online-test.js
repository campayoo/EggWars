// tests/online-test.js — Servidor en modo online (como en Render): seguridad y cuentas
process.env.PORT = 3997;
process.env.EGG_PUBLIC = '1';
process.env.MAX_CONN_PER_IP = '4';
process.env.ALLOWED_ORIGINS = 'https://eggwars-ten.vercel.app';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/egg-online-');
const http = require('http');
const srv = require('../server/server.js');
const ioc = require('../node_modules/socket.io/client-dist/socket.io.js');
let fails = 0, oks = 0;
const assert = (c, m) => { if (!c) { console.log('  ✗ ' + m); fails++; } else { console.log('  ✓ ' + m); oks++; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://localhost:3997';
const client = (opts = {}) => ioc(URL, Object.assign({ transports: ['websocket'], forceNew: true, reconnection: false }, opts));
const once = (s, ev, ms = 3000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); s.once(ev, d => { clearTimeout(t); res(d); }); });
const get = (path, headers = {}) => new Promise((res, rej) => http.get(URL + path, { headers }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: b })); }).on('error', rej));

(async () => {
  await wait(300);
  const h = await get('/healthz');
  assert(h.status === 200 && h.body === 'ok', '/healthz responde ok');
  const idx = await get('/');
  assert(/strict-transport-security/i.test(Object.keys(idx.headers).join(' ')), 'HSTS activado en modo online');
  assert(idx.headers['x-frame-options'] === 'DENY', 'X-Frame-Options DENY');
  assert((await get('/server/accounts.js')).status === 404, 'el código del servidor no se puede descargar');
  assert((await get('/data/users.json')).status === 404, 'los datos de cuentas no se pueden descargar');

  const a = client();
  const cfg = await once(a, 'server:config');
  assert(cfg.online === true && cfg.ipLogin === false, 'el servidor avisa de modo online sin login por IP');
  a.emit('auth:ip', { name: 'Pirata' });
  assert(/usuario y contraseña/.test((await once(a, 'auth:error')).message), '"Entrar con mi IP" desactivado en Internet');
  a.emit('auth:register', { username: 'Online1', password: 'clave123' });
  const ok = await once(a, 'auth:ok');
  assert(ok.profile.username === 'Online1', 'registro con usuario y contraseña');
  a.emit('player:join-room', { roomId: 'quick' });
  const joined = await once(a, 'you:joined', 4000).then(() => true).catch(() => false);
  assert(joined, 'puede entrar en una partida online');

  // Fuerza bruta: aunque reconecte, la IP se bloquea
  let blocked = false;
  for (let i = 0; i < 6 && !blocked; i++) {
    const s = client();
    await once(s, 'server:config');
    for (let j = 0; j < 8; j++) { s.emit('auth:login', { username: 'Online1', password: 'mala' + j }); const e = await once(s, 'auth:error'); if (/Demasiados/.test(e.message)) { blocked = true; break; } }
    s.close(); await wait(50);
  }
  assert(blocked, 'muchos intentos fallidos bloquean la IP');
  const s2 = client(); await once(s2, 'server:config');
  s2.emit('auth:login', { username: 'Online1', password: 'clave123' });
  assert(/Demasiados/.test((await once(s2, 'auth:error')).message), 'el bloqueo sigue tras reconectar');
  s2.close();

  // Límite de conexiones por IP (4)
  await wait(200);
  const many = [client(), client(), client(), client(), client()];
  const results = await Promise.all(many.map(s => Promise.race([once(s, 'server:config', 1500).then(() => 1), once(s, 'connect_error', 1500).then(() => 0)]).catch(() => 0)));
  const connected = results.reduce((x, y) => x + y, 0);
  assert(connected + (a.connected ? 1 : 0) <= 4, `máximo de 4 conexiones por IP respetado (${connected + (a.connected ? 1 : 0)} abiertas)`);
  many.forEach(s => s.close()); a.close();
  await wait(400);   // se liberan las plazas

  // Origen permitido (la web de Vercel) y origen ajeno: handshake real de socket.io
  const hs = origin => get('/socket.io/?EIO=4&transport=polling', { Origin: origin });
  assert((await hs('https://eggwars-ten.vercel.app')).status === 200, 'la web de Vercel puede conectarse');
  assert((await hs('http://localhost:3997')).status === 200, 'la propia página puede conectarse');
  assert((await hs('https://pagina-mala.example')).status !== 200, 'una web ajena no puede conectarse');


  console.log(fails ? `✗ online-test: ${fails} fallos` : `✓ online-test: ${oks} comprobaciones OK`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('✗ online-test:', e.message); process.exit(1); });
