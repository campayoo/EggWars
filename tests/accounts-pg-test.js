// tests/accounts-pg-test.js — Guardado de cuentas en PostgreSQL (con un "pg" simulado)
const Module = require('module');
const assert = require('assert');
const store = new Map();
let queries = 0;
const fakePg = {
  Pool: class {
    constructor(o) { assert.ok(o.connectionString, 'falta la URL'); }
    async query(sql, params) {
      queries++;
      if (/^CREATE TABLE/.test(sql)) return { rows: [] };
      if (/^SELECT/.test(sql)) return { rows: store.has(params[0]) ? [{ data: JSON.parse(store.get(params[0])) }] : [] };
      if (/^INSERT/.test(sql)) { JSON.parse(params[1]); store.set(params[0], params[1]); return { rows: [] }; }
      throw new Error('SQL inesperado: ' + sql);
    }
  },
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === 'pg' ? fakePg : origLoad.call(this, req, ...rest); };
process.env.DATABASE_URL = 'postgres://u:p@dpg-test-a/eggwars';
process.env.DATA_DIR = require('path').join(require('os').tmpdir(), 'egg-pg-test-' + process.pid);

let ok = 0;
const check = (c, m) => { assert.ok(c, m); ok++; };
(async () => {
  const A = require('../server/accounts.js');
  const info = await A.init();
  check(info.storage === 'postgres', 'usa postgres');
  const r = A.register('Pablo_1', 'secreta1');
  check(!r.error, 'registro');
  await A.flush();
  check(store.has('accounts'), 'se guarda la fila');
  check(JSON.parse(store.get('accounts')).users.pablo_1, 'el usuario está en la base de datos');
  // "Reinicio": se borra la memoria y se vuelve a cargar desde la base de datos
  delete require.cache[require.resolve('../server/accounts.js')];
  const B = require('../server/accounts.js');
  await B.init();
  check(!B.login('Pablo_1', 'secreta1').error, 'tras reiniciar se puede entrar');
  check(B.login('Pablo_1', 'mala').error, 'contraseña mala rechazada');
  // Escrituras seguidas no se pisan
  B.addStats('pablo_1', { kills: 3 }); B.flush(); B.addStats('pablo_1', { kills: 2 }); await B.flush();
  check(JSON.parse(store.get('accounts')).users.pablo_1.stats.kills === 5, 'estadísticas acumuladas');
  check(queries > 4, 'consultas hechas');
  console.log(`✓ accounts-pg-test: ${ok} comprobaciones OK`);
})().catch(e => { console.error('✗ accounts-pg-test:', e.message); process.exit(1); });
