// ============================================================================
// tools/build-pages.js — Web informativa para GitHub Pages
//
//   npm run build:pages   → gh-pages/: guía del juego (site/index.html) y
//                           documentación técnica (site/codigo.html)
//
//  · El juego NO se publica: sólo se juega descargándolo y arrancándolo en
//    local (npm start). La web es sólo de información.
//  · CSS y JS de la web van minificados ("terser" o "esbuild" si están).
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'gh-pages');
const SITE = path.join(ROOT, 'site');

async function minify(code) {
  try {
    const terser = require('terser');
    const r = await terser.minify(code, { ecma: 2020, compress: { passes: 2, drop_debugger: true }, mangle: { toplevel: true }, format: { comments: false } });
    if (r.error) throw r.error;
    return { code: r.code, tool: 'terser' };
  } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  try {
    const esbuild = require('esbuild');
    const r = await esbuild.transform(code, { minify: true, target: 'es2020', legalComments: 'none' });
    return { code: r.code, tool: 'esbuild' };
  } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  console.warn('⚠️  No hay terser ni esbuild (npm install): el paquete queda SIN minificar.');
  return { code, tool: 'ninguno' };
}

async function main() {
  const pkg = require(path.join(ROOT, 'package.json'));
  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });
  fs.writeFileSync(path.join(DEST, '.nojekyll'), '');
  await buildSite(pkg.version);
  fs.writeFileSync(path.join(DEST, 'README.md'),
    '# 🥚 EGG WARS — guía y documentación\n\nWeb informativa del juego. EGG WARS se juega descargándolo y arrancándolo en local ' +
    '(`git clone`, `npm install`, `npm start`): ver https://github.com/campayoo/EggWars\n\n' +
    '© 2026 Pablo Campayo Viñes. Todos los derechos reservados. Ver LICENSE.\n');
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(DEST, 'LICENSE.txt'));
  console.log('✓ gh-pages/ listo: guía (index.html) y documentación técnica (codigo.html). El juego no se publica.');
}

// Web de documentación (site/): guía del juego (index.html) y documentación
// técnica del código (codigo.html), con las imágenes de docs/img y los datos
// REALES de las armas sacados de shared/gamedata.js.
async function buildSite(version) {
  const hashOf = t => crypto.createHash('sha1').update(t).digest('hex').slice(0, 10);
  const banner = `/*! EGG WARS v${version} · © 2026 Pablo Campayo Viñes · Todos los derechos reservados. */\n`;
  const names = {};
  const css = banner + fs.readFileSync(path.join(SITE, 'site.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim();
  names['site.css'] = `site.${hashOf(css)}.css`;
  fs.writeFileSync(path.join(DEST, names['site.css']), css);
  for (const f of ['site.js', 'docs.js']) {
    const js = banner + (await minify(fs.readFileSync(path.join(SITE, f), 'utf8'))).code;
    names[f] = `${f.replace('.js', '')}.${hashOf(js)}.js`;
    fs.writeFileSync(path.join(DEST, names[f]), js);
  }
  // Datos de armas: los mismos números que usa el juego
  const GD = require(path.join(ROOT, 'shared', 'gamedata.js'));
  const weapons = [...GD.PRIMARY_KEYS, 'pistol'].map(k => {
    const w = GD.WEAPONS[k], i = GD.weaponInfo(k);
    return { k, n: w.name, t: w.type, d: w.desc, dmg: w.damage, pel: w.pellets, cd: w.cooldown, mag: w.maxAmmo, rl: w.reloadTime, rng: w.range,
      hm: w.headMult, sp: w.spread, ads: w.adsSpread, auto: w.auto, burst: w.burst || null, proj: w.projectile || null,
      col: '#' + w.tracerColor.toString(16).padStart(6, '0'), scope: !!w.scope, spd: w.speedMult || 1, fs: w.falloffStart, fm: w.falloffMin,
      body: i.body, head: i.head, sps: i.sps, kb: i.killBody, kh: i.killHead, bars: i.bars };
  });
  const short = version.split('.').slice(0, 2).join('.');
  for (const page of ['index.html', 'codigo.html']) {
    let html = fs.readFileSync(path.join(SITE, page), 'utf8');
    for (const [src, out] of Object.entries(names)) html = html.split(`"${src}"`).join(`"${out}"`);
    html = html.replace(/Versión \d+\.\d+/, 'Versión ' + short).replace(/· v\d+\.\d+</, `· v${short}<`);
    if (page === 'index.html') html = html.replace(`<script src="${names['site.js']}"`, `<script>window.EGG_WEAPONS=${JSON.stringify(weapons).replace(/</g, '\\u003c')};</script>\n<script src="${names['site.js']}"`);
    if (!html.includes(names['site.css'])) throw new Error('No se pudo enlazar site.css en ' + page);
    fs.writeFileSync(path.join(DEST, page), html);
  }
  fs.mkdirSync(path.join(DEST, 'img'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'docs', 'img'))) fs.copyFileSync(path.join(ROOT, 'docs', 'img', f), path.join(DEST, 'img', f));
  console.log(`✓ Web: index.html (guía) + codigo.html (código) · ${Object.values(names).join(' · ')} · ${weapons.length} armas · ${fs.readdirSync(path.join(DEST, 'img')).length} imágenes`);
}

main().catch(e => { console.error('✗', e && e.stack || e); process.exit(1); });
