// ============================================================================
// tools/build.js — Genera la versión "de producción" del cliente en dist/
//
//  · Une todos los scripts propios (shared/ + js/) en UN solo archivo.
//  · Lo minifica y ofusca los nombres con terser (si está instalado).
//  · Minifica el CSS y deja un index.html que sólo carga ese archivo.
//
// Uso:  npm run build      (y luego  npm run start:prod)
// El servidor en modo producción sirve SÓLO dist/: nadie puede pedir los
// archivos fuente originales (js/main.js, shared/*.js…) por la red.
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

async function main() {
  let terser = null;
  try { terser = require('terser'); } catch (e) {
    console.error('\n✗ Falta "terser". Ejecuta primero:  npm install\n');
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  // Cada página con su CSS: el juego principal y el modo Huevo Impostor
  await buildPage(terser, 'index.html', 'style.css', 'app');
  await buildPage(terser, 'impostor.html', 'impostor.css', 'imp');
  console.log('Arranca en modo producción con:  npm run start:prod');
}

async function buildPage(terser, page, cssFile, prefix) {
  const html = fs.readFileSync(path.join(PUB, page), 'utf8');
  // Scripts locales en el orden en que los carga la página
  const srcs = [...html.matchAll(/<script src="(\/(?:shared|js)\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
  if (!srcs.length) throw new Error('No se encontraron scripts locales en ' + page);
  const parts = srcs.map(src => {
    const file = src.startsWith('/shared/') ? path.join(ROOT, 'shared', src.slice(8)) : path.join(PUB, src.slice(1));
    return `/* ${path.basename(file)} */\n` + fs.readFileSync(file, 'utf8');
  });
  // Un solo ámbito: los "const" globales de cada archivo siguen viéndose entre sí
  const bundle = `(function(){\n${parts.join('\n;\n')}\n}).call(window);`;
  const min = await terser.minify(bundle, {
    ecma: 2020,
    compress: { passes: 2, drop_debugger: true, pure_funcs: ['console.debug'] },
    mangle: { toplevel: true },
    format: { comments: false },
    sourceMap: false,
  });
  if (min.error) throw min.error;
  const hash = crypto.createHash('sha1').update(min.code).digest('hex').slice(0, 10);
  const appName = `${prefix}.${hash}.js`;

  // CSS: quitar comentarios y espacios sobrantes
  const css = fs.readFileSync(path.join(PUB, cssFile), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
  const base = cssFile.replace(/\.css$/, '');
  const cssName = `${base}.${crypto.createHash('sha1').update(css).digest('hex').slice(0, 10)}.css`;

  let outHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(`<link rel="stylesheet" href="/${cssFile}"/>`, `<link rel="stylesheet" href="/${cssName}"/>`);
  // Quitar los <script> sueltos y dejar uno solo con el paquete
  srcs.forEach((src, i) => {
    outHtml = outHtml.replace(`<script src="${src}"></script>`, i === srcs.length - 1 ? `<script src="/${appName}"></script>` : '');
  });
  outHtml = outHtml.replace(/\n\s*\n+/g, '\n');

  fs.writeFileSync(path.join(OUT, page), outHtml);
  fs.writeFileSync(path.join(OUT, appName), min.code);
  fs.writeFileSync(path.join(OUT, cssName), css);
  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`✓ ${page}: ${appName}  ${kb(Buffer.byteLength(bundle))} → ${kb(min.code.length)} (${srcs.length} archivos) · ${cssName}`);
}

main().catch(e => { console.error('✗ Error al compilar:', e.message || e); process.exit(1); });
