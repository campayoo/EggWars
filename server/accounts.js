// ============================================================================
// server/accounts.js — Cuentas de jugador, sesiones y amigos
// - Usuario + contraseña (hash scrypt con sal) o cuenta ligada a la IP del equipo
// - Persistencia en data/users.json (escritura atómica con retardo)
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Cosmetics = require('../shared/cosmetics.js');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'users.json');
const NAME_RE = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,14}$/;
const MAX_FRIENDS = 50;

let db = { users: {}, sessions: {}, ipIndex: {} };
let saveTimer = null;

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      db = Object.assign({ users: {}, sessions: {}, ipIndex: {} }, raw);
    }
  } catch (e) {
    console.error('[cuentas] No se pudo leer users.json, se empieza vacío:', e.message);
    try { fs.copyFileSync(FILE, FILE + '.corrupto-' + Date.now()); } catch (e2) { /* nada que copiar */ }
  }
}
function saveNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  } catch (e) { console.error('[cuentas] Error guardando:', e.message); }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
function flush() { clearTimeout(saveTimer); saveNow(); }

const key = name => String(name || '').trim().toLowerCase();
function normIp(ip) {
  ip = String(ip || '');
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

function hashPassword(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 32).toString('hex');
}

function newStats() {
  return { kills: 0, deaths: 0, headshots: 0, grenadeKills: 0, wins: 0, games: 0, bestStreak: 0, kw: { rifle: 0, shotgun: 0, sniper: 0 } };
}

function createUser(username, type, extra) {
  const u = Object.assign({
    username, type, created: Date.now(), lastSeen: Date.now(),
    custom: Object.assign({}, Cosmetics.DEFAULT),
    stats: newStats(), eggs: 0, challenges: null,
    friends: [], requests: [], sent: [],
  }, extra || {});
  db.users[key(username)] = u;
  save();
  return u;
}

function newToken(username) {
  const t = crypto.randomBytes(24).toString('hex');
  db.sessions[t] = { u: key(username), at: Date.now() };
  save();
  return t;
}

// --- API pública ------------------------------------------------------------
function validateName(name) {
  name = String(name || '').trim();
  if (!NAME_RE.test(name)) return 'El nombre debe tener de 3 a 14 letras, números o _';
  return null;
}

function register(username, password) {
  const err = validateName(username);
  if (err) return { error: err };
  if (String(password || '').length < 4) return { error: 'La contraseña debe tener al menos 4 caracteres' };
  if (db.users[key(username)]) return { error: 'Ese nombre ya está cogido' };
  const salt = crypto.randomBytes(16).toString('hex');
  const u = createUser(username.trim(), 'password', { salt, hash: hashPassword(password, salt) });
  return { user: u, token: newToken(u.username) };
}

function login(username, password) {
  const u = db.users[key(username)];
  if (!u || u.type !== 'password') return { error: 'Usuario o contraseña incorrectos' };
  const h = hashPassword(password, u.salt);
  if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex'))) return { error: 'Usuario o contraseña incorrectos' };
  return { user: u, token: newToken(u.username) };
}

function loginToken(token) {
  const s = db.sessions[token];
  if (!s) return { error: 'Sesión caducada' };
  const u = db.users[s.u];
  if (!u) { delete db.sessions[token]; save(); return { error: 'La cuenta ya no existe' }; }
  return { user: u, token };
}

// Cuenta ligada a la IP: si ya existe se entra; si no, hace falta elegir nombre
function loginIp(ip, name) {
  ip = normIp(ip);
  const existing = db.ipIndex[ip] && db.users[db.ipIndex[ip]];
  if (existing) return { user: existing, token: newToken(existing.username) };
  if (!name) return { needName: true, ip };
  const err = validateName(name);
  if (err) return { error: err };
  if (db.users[key(name)]) return { error: 'Ese nombre ya está cogido' };
  const u = createUser(name.trim(), 'ip', { ip });
  db.ipIndex[ip] = key(u.username);
  save();
  return { user: u, token: newToken(u.username) };
}

// Cambiar contraseña (cuentas con contraseña) o añadir una a una cuenta de IP,
// que pasa a poder usarse desde cualquier equipo.
function setPassword(username, current, next) {
  const u = get(username);
  if (!u) return { error: 'Inicia sesión' };
  if (String(next || '').length < 4) return { error: 'La nueva contraseña debe tener al menos 4 caracteres' };
  if (u.type === 'password') {
    const h = hashPassword(current || '', u.salt);
    if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex'))) return { error: 'La contraseña actual no es correcta' };
  } else {
    if (u.ip && db.ipIndex[u.ip] === key(u.username)) delete db.ipIndex[u.ip];
    delete u.ip;
    u.type = 'password';
  }
  u.salt = crypto.randomBytes(16).toString('hex');
  u.hash = hashPassword(next, u.salt);
  save();
  return { ok: true, user: u };
}

function logout(token) { if (db.sessions[token]) { delete db.sessions[token]; save(); } }

function get(username) { return db.users[key(username)] || null; }

function publicProfile(u) {
  return {
    username: u.username, type: u.type, custom: u.custom, stats: u.stats, eggs: u.eggs,
    challenges: u.challenges, created: u.created,
  };
}

function saveProfile(username, data) {
  const u = get(username);
  if (!u || !data) return;
  if (data.custom) u.custom = Cosmetics.sanitize(data.custom);
  if (typeof data.eggs === 'number' && isFinite(data.eggs) && data.eggs >= 0) u.eggs = Math.min(1e7, Math.floor(data.eggs));
  if (data.challenges && typeof data.challenges === 'object' && JSON.stringify(data.challenges).length < 4000) u.challenges = data.challenges;
  save();
}

// Estadísticas autoritativas (las suma el servidor durante la partida)
function addStats(username, delta) {
  const u = get(username);
  if (!u) return;
  const s = u.stats;
  for (const k in delta) {
    if (k === 'kw') { for (const w in delta.kw) s.kw[w] = (s.kw[w] || 0) + delta.kw[w]; }
    else if (k === 'bestStreak') s.bestStreak = Math.max(s.bestStreak, delta.bestStreak);
    else s[k] = (s[k] || 0) + delta[k];
  }
  save();
}

// --- Amigos -----------------------------------------------------------------
function sendRequest(from, toName) {
  const a = get(from), b = get(toName);
  if (!a) return { error: 'Inicia sesión' };
  if (!b) return { error: `No existe ningún jugador llamado "${toName}"` };
  if (a === b) return { error: 'No puedes añadirte a ti mismo 🥚' };
  if (a.friends.includes(key(b.username))) return { error: `${b.username} ya es tu amigo` };
  if (a.friends.length >= MAX_FRIENDS) return { error: 'Has llegado al máximo de amigos' };
  // Si el otro ya me había enviado solicitud, se aceptan los dos directamente
  if (a.requests.includes(key(b.username))) return respond(from, b.username, true);
  if (!b.requests.includes(key(a.username))) b.requests.push(key(a.username));
  if (!a.sent.includes(key(b.username))) a.sent.push(key(b.username));
  save();
  return { ok: true, to: b.username };
}
function respond(me, otherName, accept) {
  const a = get(me), b = get(otherName);
  if (!a || !b) return { error: 'Ese jugador ya no existe' };
  const ka = key(a.username), kb = key(b.username);
  a.requests = a.requests.filter(x => x !== kb);
  b.sent = b.sent.filter(x => x !== ka);
  b.requests = b.requests.filter(x => x !== ka);
  a.sent = a.sent.filter(x => x !== kb);
  if (accept) {
    if (!a.friends.includes(kb)) a.friends.push(kb);
    if (!b.friends.includes(ka)) b.friends.push(ka);
  }
  save();
  return { ok: true, accepted: !!accept, other: b.username };
}
function removeFriend(me, otherName) {
  const a = get(me), b = get(otherName);
  if (!a || !b) return { error: 'Ese jugador ya no existe' };
  a.friends = a.friends.filter(x => x !== key(b.username));
  b.friends = b.friends.filter(x => x !== key(a.username));
  save();
  return { ok: true, other: b.username };
}

function displayName(k) { const u = db.users[k]; return u ? u.username : k; }

load();

module.exports = {
  register, login, loginToken, loginIp, logout, setPassword, get, key, normIp,
  publicProfile, saveProfile, addStats,
  sendRequest, respond, removeFriend, displayName, flush, validateName,
  _db: () => db,
};
