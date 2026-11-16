// ============================================================================
// tools/build-pages.js — Versión web SIN SERVIDOR para GitHub Pages (v6.2)
//
//   npm run build:pages               → gh-pages/: web de documentación (site/)
//                                        + el juego contra bots en gh-pages/jugar/
//   npm run build:pages -- --solo-juego → gh-pages/: sólo el juego (para Vercel)
//
//  · Une en UN archivo minificado todo lo que necesita el navegador: shared/,
//    js/ del cliente, el modo sin conexión (js/offline.js) y la lógica de las
//    salas, el anti-trampas y los bots de server/ (corren en el navegador).
//  · Todas las rutas son relativas: funciona en https://usuario.github.io/repo/
//  · El código fuente NO se publica: sólo el paquete minificado.
//
// Minificador: usa "terser" si está instalado (npm install); si no, "esbuild";
// si no hay ninguno, deja el código sin minificar (y lo avisa).
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const DEST = path.join(ROOT, 'gh-pages');
const SOLO_JUEGO = process.argv.includes('--solo-juego');
const OUT = SOLO_JUEGO ? DEST : path.join(DEST, 'jugar');   // dónde va el juego
const SITE = path.join(ROOT, 'site');
const SERVER_MODS = ['anticheat.js', 'bots.js', 'gameRoom.js'];   // se ejecutan en el navegador

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
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="(\/(?:shared|js)\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
  if (!srcs.length) throw new Error('No se encontraron scripts locales en index.html');
  const read = src => fs.readFileSync(src.startsWith('/shared/') ? path.join(ROOT, 'shared', src.slice(8)) : path.join(PUB, src.slice(1)), 'utf8');

  const parts = [];
  for (const src of srcs) {
    if (src === '/js/main.js') {
      // Antes del juego: el modo sin conexión y la lógica de server/ (como módulos)
      parts.push('/* modo sin conexión */\nwindow.EGG_OFFLINE = true;');
      parts.push('/* offline.js */\n' + fs.readFileSync(path.join(PUB, 'js', 'offline.js'), 'utf8'));
      for (const m of SERVER_MODS) {
        const code = fs.readFileSync(path.join(ROOT, 'server', m), 'utf8');
        parts.push(`/* server/${m} */\nwindow.EggOffline.def(${JSON.stringify(m)}, function (module, exports, require) {\n${code}\n});`);
      }
    }
    parts.push(`/* ${path.basename(src)} */\n` + read(src));
  }
  // Un solo ámbito: los "const" globales de cada archivo siguen viéndose entre sí
  const bundle = `(function(){\n${parts.join('\n;\n')}\n}).call(window);`;
  const min = await minify(bundle);
  // Aviso de autoría al principio del paquete (el minificador quita los comentarios)
  const pkg = require(path.join(ROOT, 'package.json'));
  min.code = `/*! EGG WARS v${pkg.version} · © 2026 Pablo Campayo Viñes · Todos los derechos reservados. Prohibida su copia, modificación o redistribución sin permiso del autor. */\n` + min.code;
  const hash = crypto.createHash('sha1').update(min.code).digest('hex').slice(0, 10);

  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const appName = `app.${hash}.js`;
  fs.writeFileSync(path.join(OUT, appName), min.code);

  const css = fs.readFileSync(path.join(PUB, 'style.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').trim();
  const cssName = `style.${crypto.createHash('sha1').update(css).digest('hex').slice(0, 10)}.css`;
  fs.writeFileSync(path.join(OUT, cssName), css);

  let page = html
    .replace(/<script src="\/socket\.io\/socket\.io\.js"><\/script>\s*/, '')
    .replace(/<script src="\/(?:shared|js)\/[^"]+\.js"><\/script>\s*/g, '')
    .replace(/(<script src="https:\/\/unpkg\.com\/three@[^"]+"[^>]*><\/script>)/, `$1\n<script src="${appName}"></script>`)
    .replace(/<link rel="stylesheet" href="\/style\.css"\/>/, `<link rel="stylesheet" href="${cssName}"/>`)
    .replace(/href="\/impostor\.html"/g, 'href="#"')
    .replace(/<title>[^<]*<\/title>/, '<title>🥚 EGG WARS — FPS 3D de huevos (contra bots)</title>')
    .replace(/<!--[\s\S]*?-->/g, '');
  if (!page.includes(appName)) throw new Error('No se pudo insertar el paquete en index.html');
  fs.writeFileSync(path.join(OUT, 'index.html'), page);
  fs.writeFileSync(path.join(DEST, '.nojekyll'), '');
  if (!SOLO_JUEGO) await buildSite(pkg.version);
  fs.writeFileSync(path.join(DEST, 'README.md'),
    '# 🥚 EGG WARS — versión web\n\nShooter 3D de huevos que se juega en el navegador **contra bots** (sin servidor).\n\n' +
    'Generado con `npm run build:pages`. Para jugar con amigos en la red local se usa el servidor del proyecto (`npm start`).\n\n' +
    '© 2026 Pablo Campayo Viñes. Todos los derechos reservados. Ver LICENSE.\n');
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(DEST, 'LICENSE.txt'));

  const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
  console.log(SOLO_JUEGO ? '✓ Sólo el juego (sin la web de documentación)' : '✓ Web de documentación en gh-pages/ y juego en gh-pages/jugar/');
  console.log(`✓ gh-pages/ listo · ${appName} (${kb(appName)}, minificado con ${min.tool}) · ${cssName} (${kb(cssName)})`);
  console.log('  Publícalo en Vercel (vercel.json) o en la rama gh-pages de GitHub Pages.');
}

// Web de documentación (site/) + imágenes de docs/img, con caché segura por hash
async function buildSite(version) {
  const hashOf = t => crypto.createHash('sha1').update(t).digest('hex').slice(0, 10);
  const banner = `/*! EGG WARS v${version} · © 2026 Pablo Campayo Viñes · Todos los derechos reservados. */\n`;
  const css = banner + fs.readFileSync(path.join(SITE, 'site.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').replace(/;}/g, '}').trim();
  const js = banner + (await minify(fs.readFileSync(path.join(SITE, 'site.js'), 'utf8'))).code;
  const cssName = `site.${hashOf(css)}.css`, jsName = `site.${hashOf(js)}.js`;
  fs.writeFileSync(path.join(DEST, cssName), css);
  fs.writeFileSync(path.join(DEST, jsName), js);
  let html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8')
    .replace('href="site.css"', `href="${cssName}"`)
    .replace('src="site.js"', `src="${jsName}"`)
    .replace(/Versión \d+\.\d+/, 'Versión ' + version.split('.').slice(0, 2).join('.'));
  if (!html.includes(cssName) || !html.includes(jsName)) throw new Error('No se pudo enlazar site.css / site.js');
  fs.writeFileSync(path.join(DEST, 'index.html'), html);
  fs.mkdirSync(path.join(DEST, 'img'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'docs', 'img'))) fs.copyFileSync(path.join(ROOT, 'docs', 'img', f), path.join(DEST, 'img', f));
  console.log(`✓ Web: index.html · ${cssName} · ${jsName} · ${fs.readdirSync(path.join(DEST, 'img')).length} imágenes`);
}

main().catch(e => { console.error('✗', e && e.stack || e); process.exit(1); });
