/*! EGG WARS · Documentación · © 2026 Pablo Campayo Viñes. Todos los derechos reservados. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- datos
  const MAPS = [
    ['castle', '🏰', 'Castle', 'M', 12, 'Murallas con paseo de ronda y almenas, cuatro torres, torreón de dos pisos, barracones con puentes a la muralla y mercadillo en el patio.'],
    ['dirt', '🚜', 'Dirt', 'L', 18, 'Granero con pajar y tejado transitable, torres de contenedores, establos de dos pisos con puentes, silos, torres de vigía y lomas.'],
    ['feedlot', '🐄', 'Feedlot', 'M', 18, 'Túneles que rodean dos tercios del mapa con techo transitable, torre central, voladizo, oficina de dos pisos y pasarelas.'],
    ['moonbase', '🌙', 'Moonbase', 'M', 18, 'Base lunar con baja gravedad: núcleo con pasillos en anillo, sala de control, módulos, laboratorio y torre de antenas.'],
    ['shipyard', '⚓', 'Shipyard', 'L', 18, 'Puerto rodeado de mar: gran almacén, oficinas de ladrillo, torres de contenedores de hasta 4 alturas, grúa, tanques y búnker.'],
    ['ruins', '🏛️', 'Ruins', 'M', 18, 'Ruinas cubiertas de hierba: templo elevado, arcos, columnas caídas, casa en ruinas de dos pisos, terrazas y torres.'],
    ['blue', '🔷', 'Blue', 'M', 18, 'Mapa simétrico de bloques azules: bases de dos plantas, puente de cristal, oficinas, torres y terrazas centrales.'],
    ['fortflip', '🪵', 'Fort Flip', 'M', 18, 'Dos fuertes de madera con almenas y atalaya frente a frente, separados por un arroyo seco con puente, cuarteles y torres.'],
    ['twotowers', '🗼', 'Two Towers', 'M', 18, 'Dos torres de tres plantas con escaleras interiores, unidas por un puente a 8 m de altura, puestos de guardia y rocas en los flancos.'],
    ['medina', '🕌', 'Medina', 'M', 18, 'Ciudad de arenisca: murallas con paseo y casetas, casas de dos pisos unidas por puentes, minaretes, arcadas y plaza con fuente.'],
    ['alpine', '🏔️', 'Nevada', 'M', 18, 'Aldea alpina: chalés, estanque helado con caseta de pesca, cabañas de esquí con tejado transitable, telesilla, muñecos de nieve y pinos.', 1],
    ['temple', '🛕', 'Templo', 'M', 18, 'Pirámide escalonada en la selva con santuario en la cima, puertas con el ídolo del huevo dorado, columnatas, arcos y torres de troncos.', 1],
    ['factory', '🏭', 'Fábrica', 'M', 18, 'Gran nave con pasarelas a 4 m, oficinas con azotea, vía de tren con vagones, depósitos, chimeneas y torre de agua para francotiradores.', 1],
    ['downtown', '🏙️', 'Centro', 'M', 18, 'Cuatro edificios con las azoteas unidas por puentes, pasos de cebra, coches, jardineras, quioscos y torre del reloj en el cruce.', 1],
    ['sawmill', '🪓', 'Aserradero', 'M', 18, 'Serrería con altillo y tejado transitable, cobertizos con la sierra, arroyo con vados y pasarelas, pilas de troncos y torres de vigía.', 1],
    ['abastos', '🏫', 'Instituto Abastos', 'M', 18, 'Primera planta de un instituto de Valencia: galería alrededor del patio interior, aulas, laboratorio, biblioteca y el aula de informática al fondo a la izquierda. Se baja al patio por la escalera.', 1],
    ['pruebas', '🚌', 'Pueblo de Pruebas', 'S', 12, 'Barrio pequeño y simétrico: dos casas de dos plantas frente a frente, garajes, jardines con piscina y un autobús escolar en mitad de la calle.', 1],
    ['nemanave', '🥚', 'Ñemanave', 'L', 12, 'La nave de Huevo Impostor, ahora para los tiros: combate en interiores por La Yema, 4 pasillos y 12 salas. Funciona en todos los modos.', 1],
  ];
  const SIZE = { L: 'Grande', M: 'Mediano', S: 'Pequeño' };

  // Siluetas propias de cada arma (SVG simple)
  const gun = (body, extra = '') => `<svg viewBox="0 0 420 120" aria-hidden="true"><defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a33"/><stop offset="1" stop-color="#2a1a0e"/></linearGradient><linearGradient id="wo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb062"/><stop offset="1" stop-color="#e8701e"/></linearGradient></defs><g fill="url(#wg)">${body}</g>${extra}</svg>`;
  // Datos reales de shared/gamedata.js (el build los vuelve a inyectar en window.EGG_WEAPONS)
  const WDATA = window.EGG_WEAPONS || [{"k": "rifle", "n": "EggK-47", "t": "Fusil automático", "d": "Automático clásico de medio alcance: cadencia alta y nunca se encasquilla.", "dmg": 23, "pel": 1, "cd": 100, "mag": 30, "rl": 1400, "rng": 120, "hm": 1.6, "sp": 0.017, "ads": 0.4, "auto": true, "burst": null, "proj": null, "col": "#ffdd00", "scope": false, "spd": 1, "fs": 35, "fm": 0.6, "body": 23, "head": 37, "sps": 10, "kb": 5, "kh": 3, "bars": {"dmg": 1, "rate": 5, "range": 3, "mob": 3}}, {"k": "shotgun", "n": "Scrambler", "t": "Escopeta (2 cartuchos)", "d": "Dos disparos devastadores a quemarropa. Recarga rápida.", "dmg": 16, "pel": 8, "cd": 420, "mag": 2, "rl": 1150, "rng": 40, "hm": 1.4, "sp": 0.09, "ads": 0.75, "auto": false, "burst": null, "proj": null, "col": "#ff6b35", "scope": false, "spd": 1, "fs": 7, "fm": 0.25, "body": 128, "head": 176, "sps": 2.4, "kb": 2, "kh": 1, "bars": {"dmg": 5, "rate": 2, "range": 1, "mob": 4}}, {"k": "ranger", "n": "Free Ranger", "t": "Francotirador semiautomático", "d": "Semiautomático con mira: dos disparos al cuerpo o uno a la cabeza.", "dmg": 52, "pel": 1, "cd": 480, "mag": 15, "rl": 1900, "rng": 220, "hm": 2, "sp": 0.04, "ads": 0.05, "auto": false, "burst": null, "proj": null, "col": "#7bed9f", "scope": true, "spd": 1, "fs": 999, "fm": 1, "body": 52, "head": 104, "sps": 2.1, "kb": 2, "kh": 1, "bars": {"dmg": 3, "rate": 2, "range": 4, "mob": 3}}, {"k": "rpegg", "n": "RPEGG", "t": "Lanzacohetes", "d": "Un impacto directo revienta a cualquiera; cerca de la explosión hace mucho daño, pero hay que afinar. ¡Cuidado con tu propio cohete!", "dmg": 0, "pel": 1, "cd": 1100, "mag": 2, "rl": 3000, "rng": 90, "hm": 1, "sp": 0.012, "ads": 0.5, "auto": false, "burst": null, "proj": {"speed": 36, "radius": 3.6, "maxDmg": 110, "direct": 110}, "col": "#ffa502", "scope": false, "spd": 1, "fs": 999, "fm": 1, "body": 110, "head": 110, "sps": 0.9, "kb": 1, "kh": 1, "bars": {"dmg": 5, "rate": 1, "range": 2, "mob": 2}}, {"k": "whipper", "n": "Whipper", "t": "Subfusil", "d": "Cargador enorme y cadencia altísima para correr y disparar a corta distancia.", "dmg": 15, "pel": 1, "cd": 68, "mag": 40, "rl": 1700, "rng": 70, "hm": 1.5, "sp": 0.032, "ads": 0.55, "auto": true, "burst": null, "proj": null, "col": "#eccc68", "scope": false, "spd": 1.06, "fs": 18, "fm": 0.5, "body": 15, "head": 23, "sps": 14.7, "kb": 7, "kh": 5, "bars": {"dmg": 1, "rate": 5, "range": 2, "mob": 5}}, {"k": "sniper", "n": "Crackshot", "t": "Francotirador de cerrojo", "d": "Cerrojo: un disparo a la cabeza revienta cualquier huevo.", "dmg": 90, "pel": 1, "cd": 1300, "mag": 3, "rl": 2100, "rng": 280, "hm": 2, "sp": 0.06, "ads": 0, "auto": false, "burst": null, "proj": null, "col": "#00d2d3", "scope": true, "spd": 0.95, "fs": 999, "fm": 1, "body": 90, "head": 180, "sps": 0.8, "kb": 2, "kh": 1, "bars": {"dmg": 4, "rate": 1, "range": 5, "mob": 2}}, {"k": "trihard", "n": "Tri-Hard", "t": "Fusil de ráfaga de 3", "d": "Ráfagas de tres balas muy precisas: especialista en media distancia.", "dmg": 26, "pel": 1, "cd": 380, "mag": 24, "rl": 1600, "rng": 150, "hm": 1.6, "sp": 0.009, "ads": 0.4, "auto": true, "burst": {"count": 3, "interval": 72}, "proj": null, "col": "#ff7f50", "scope": false, "spd": 1, "fs": 45, "fm": 0.65, "body": 26, "head": 42, "sps": 5.7, "kb": 4, "kh": 3, "bars": {"dmg": 2, "rate": 3, "range": 3, "mob": 3}}, {"k": "pistol", "n": "Cluck 9mm", "t": "Pistola semiautomática", "d": "Tu arma de apoyo: rápida de sacar y precisa.", "dmg": 24, "pel": 1, "cd": 140, "mag": 15, "rl": 1100, "rng": 90, "hm": 1.6, "sp": 0.014, "ads": 0.45, "auto": false, "burst": null, "proj": null, "col": "#fff3c4", "scope": false, "spd": 1.05, "fs": 25, "fm": 0.55, "body": 24, "head": 38, "sps": 7.1, "kb": 5, "kh": 3, "bars": {"dmg": 1, "rate": 4, "range": 2, "mob": 3}}];
  const WSVG = {
    rifle: gun('<rect x="60" y="46" width="250" height="22" rx="6"/><rect x="300" y="52" width="90" height="9" rx="3"/><path d="M60 50 L10 40 L10 78 L60 70Z"/><path d="M150 66 h26 l-8 44 h-24z"/><path d="M200 66 h30 l14 36 h-26z" fill="url(#wo)"/>'),
    shotgun: gun('<rect x="70" y="44" width="300" height="16" rx="5"/><rect x="150" y="62" width="160" height="14" rx="5" fill="url(#wo)"/><path d="M70 46 L14 40 L14 80 L70 66Z"/><path d="M120 62 h24 l-8 40 h-22z"/>'),
    ranger: gun('<rect x="60" y="50" width="270" height="18" rx="6"/><rect x="320" y="54" width="70" height="8" rx="3"/><rect x="150" y="28" width="90" height="14" rx="7" fill="url(#wo)"/><rect x="170" y="40" width="10" height="12"/><rect x="210" y="40" width="10" height="12"/><path d="M60 52 L12 44 L12 80 L60 68Z"/><path d="M140 66 h24 l-8 40 h-22z"/>'),
    rpegg: gun('<rect x="40" y="40" width="320" height="34" rx="16"/><ellipse cx="370" cy="57" rx="22" ry="22" fill="url(#wo)"/><rect x="150" y="74" width="22" height="36" rx="4"/><rect x="220" y="74" width="18" height="26" rx="4"/>', '<circle cx="372" cy="57" r="8" fill="#fff3d6"/>'),
    whipper: gun('<rect x="70" y="44" width="230" height="26" rx="8"/><rect x="290" y="50" width="100" height="12" rx="4"/><rect x="160" y="70" width="60" height="40" rx="10" fill="url(#wo)"/><path d="M70 48 L20 44 L20 74 L70 66Z"/><path d="M120 70 h22 l-6 36 h-20z"/>'),
    sniper: gun('<rect x="50" y="52" width="320" height="14" rx="5"/><rect x="360" y="55" width="50" height="7" rx="3"/><rect x="140" y="26" width="120" height="16" rx="8" fill="url(#wo)"/><rect x="170" y="40" width="10" height="14"/><rect x="226" y="40" width="10" height="14"/><path d="M50 54 L6 46 L6 84 L50 66Z"/><path d="M120 64 h22 l-8 40 h-20z"/><rect x="270" y="46" width="16" height="6" rx="3"/>'),
    trihard: gun('<rect x="60" y="46" width="260" height="22" rx="6"/><rect x="310" y="52" width="80" height="9" rx="3"/><path d="M60 50 L12 42 L12 80 L60 70Z"/><rect x="150" y="34" width="60" height="12" rx="6"/><path d="M150 66 h24 l-8 42 h-22z"/><rect x="200" y="68" width="34" height="32" rx="6" fill="url(#wo)"/>'),
    pistol: gun('<rect x="130" y="40" width="170" height="26" rx="7"/><path d="M150 64 h44 l-10 50 h-40z" fill="url(#wo)"/><rect x="196" y="64" width="22" height="16" rx="6" fill="none" stroke="#2a1a0e" stroke-width="5"/>'),
  };
  const QUALITY = [
    { n: 'Baja', p: 25, rows: [['Resolución', '85 % de la nativa'], ['Sombras', 'Sin sombras'], ['Distancia de visión', '−22 %'], ['Extras', 'Sin decoración pequeña: máxima fluidez']] },
    { n: 'Media', p: 50, rows: [['Resolución', 'Nativa'], ['Sombras', 'Cada 2 fotogramas · 1024 px'], ['Distancia de visión', '−8 %'], ['Extras', 'Hierba y partículas']] },
    { n: 'Alta', p: 75, rows: [['Resolución', 'Hasta 1,5×'], ['Sombras', 'Suaves · cada fotograma · 2048 px'], ['Distancia de visión', 'Normal'], ['Extras', 'Hierba, partículas y luces de disparo']] },
    { n: 'Ultra', p: 100, rows: [['Resolución', 'Hasta 2×'], ['Sombras', 'Suaves · 4096 px'], ['Distancia de visión', '+40 %'], ['Extras', 'Filtrado de texturas 16× y todo lo de Alta']] },
  ];

  // ---------------------------------------------------------------- mapas
  const mapsEl = $('#maps');
  MAPS.forEach(([id, ico, name, size, pl, desc, isNew], i) => {
    const b = document.createElement('button');
    b.className = 'map reveal' + (id === 'nemanave' ? ' nemanave' : '');
    b.dataset.size = size; b.dataset.new = isNew ? '1' : ''; b.dataset.i = i;
    b.style.setProperty('--d', (i % 4) * 0.07 + 's');
    b.setAttribute('aria-label', `Ver ${name} en grande`);
    const pic = id === 'nemanave'
      ? '<svg viewBox="0 0 40 50" aria-hidden="true"><use href="#egg-cracked"/></svg>'
      : `<img src="img/mapa-${id}.jpg" alt="Vista del mapa ${name}" loading="lazy" width="960" height="570">`;
    b.innerHTML = `<div class="mi">${pic}<span class="tag">${SIZE[size]} · ${pl} jug.</span>${isNew ? '<span class="tag new">Nuevo</span>' : ''}</div>
      <div class="mb"><h3>${ico} ${name}</h3><div class="meta">${SIZE[size]} · hasta ${pl} jugadores</div><p>${desc}</p></div>`;
    mapsEl.appendChild(b);
  });
  $$('#mapFilter .chip').forEach(c => c.addEventListener('click', () => {
    $$('#mapFilter .chip').forEach(x => { x.classList.toggle('active', x === c); x.setAttribute('aria-selected', x === c); });
    const f = c.dataset.f;
    $$('.map').forEach(m => {
      const show = f === 'all' || (f === 'new' ? m.dataset.new === '1' : m.dataset.size === f);
      m.classList.toggle('hide', !show);
      if (show) { m.classList.remove('in'); requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('in'))); }
    });
  }));

  // Visor de imágenes
  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  const shown = () => MAPS.map((m, i) => i).filter(i => MAPS[i][0] !== 'nemanave' && !mapsEl.children[i].classList.contains('hide'));
  let cur = 0, lastFocus = null;
  function openLb(i) {
    if (MAPS[i][0] === 'nemanave') return;
    cur = i; const [id, ico, name, size, pl, desc] = MAPS[i];
    lbImg.src = `img/mapa-${id}.jpg`; lbImg.alt = `Mapa ${name}`;
    lbCap.innerHTML = `<b>${ico} ${name}</b>${SIZE[size]} · hasta ${pl} jugadores — ${desc}`;
    if (lb.hidden) { lastFocus = document.activeElement; lb.hidden = false; requestAnimationFrame(() => lb.classList.add('open')); document.body.style.overflow = 'hidden'; $('#lbClose').focus(); }
  }
  function closeLb() { lb.classList.remove('open'); setTimeout(() => { lb.hidden = true; }, 250); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  function step(d) { const s = shown(); const k = s.indexOf(cur); openLb(s[(k + d + s.length) % s.length]); }
  mapsEl.addEventListener('click', e => { const m = e.target.closest('.map'); if (m) openLb(+m.dataset.i); });
  $('#lbClose').addEventListener('click', closeLb);
  $('#lbPrev').addEventListener('click', () => step(-1));
  $('#lbNext').addEventListener('click', () => step(1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
  });
  let tx = null;
  lb.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); tx = null; });

  // ---------------------------------------------------------------- armas
  const wList = $('#wList'), wDetail = $('#wDetail');
  const fmt = n => String(n).replace('.', ',');
  // Tiempo hasta eliminar (ms) con N disparos, teniendo en cuenta las ráfagas
  const ttk = (w, n) => {
    if (n <= 1) return 0;
    if (!w.burst) return (n - 1) * w.cd;
    const c = w.burst.count, cyc = w.cd + w.burst.interval * (c - 1), i = n - 1;
    return Math.floor(i / c) * cyc + (i % c) * w.burst.interval;
  };
  const pips = v => `<span class="pips">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= v ? 'on' : ''}"></i>`).join('')}</span>`;
  WDATA.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'w-btn'; b.setAttribute('role', 'tab');
    b.innerHTML = `<span class="num">${i < 7 ? i + 1 : 'E'}</span>${w.n}<span class="wd">${fmt(w.sps)} d/s</span>`;
    b.addEventListener('click', () => showWeapon(i));
    wList.appendChild(b);
  });
  let range = null;
  function showWeapon(i) {
    const w = WDATA[i];
    [...wList.children].forEach((b, k) => { b.classList.toggle('active', k === i); b.setAttribute('aria-selected', k === i); });
    const pel = w.pel > 1 ? ` <small>(${w.pel} perdigones de ${w.dmg})</small>` : '';
    const rate = w.burst ? `${fmt(w.sps)} <small>(ráfagas de ${w.burst.count})</small>` : fmt(w.sps);
    const disp = w.ads <= .05 ? 'Exacta al apuntar' : w.sp <= .015 ? 'Muy precisa' : w.sp <= .035 ? 'Precisa' : w.sp <= .06 ? 'Media' : 'Abierta (perdigones)';
    const extra = w.proj ? `<li><b>Cohete</b><span>${w.proj.speed} m/s · explosión de ${fmt(w.proj.radius)} m · impacto directo ${w.proj.direct}</span></li>`
      : w.fs < 999 ? `<li><b>Caída de daño</b><span>desde ${w.fs} m, hasta el ${Math.round(w.fm * 100)} %</span></li>` : `<li><b>Caída de daño</b><span>ninguna: pega igual a cualquier distancia</span></li>`;
    wDetail.innerHTML = `<div class="w-top"><div><span class="w-type">${w.t}${w.scope ? ' · con mira' : ''}${w.auto ? ' · automática' : ''}</span><h3>${w.n}</h3></div><div class="w-art">${WSVG[w.k] || ''}</div></div>
      <p class="w-desc">${w.d}</p>
      <div class="w-stats">
        <div><b>${w.body}</b><span>Daño cuerpo${pel}</span></div>
        <div><b>${w.head}</b><span>Daño cabeza</span></div>
        <div><b>${rate}</b><span>Disparos/segundo</span></div>
        <div><b>${w.mag}</b><span>Cargador</span></div>
        <div><b>${fmt(w.rl / 1000)} s</b><span>Recarga</span></div>
        <div><b>${w.rng} m</b><span>Alcance</span></div>
      </div>
      <div class="w-ratings">
        <div><span>Daño</span>${pips(w.bars.dmg)}</div><div><span>Cadencia</span>${pips(w.bars.rate)}</div>
        <div><span>Alcance</span>${pips(w.bars.range)}</div><div><span>Movilidad</span>${pips(w.bars.mob)}</div>
      </div>
      <ul class="w-facts">
        <li><b>Para eliminar</b><span>${w.kb} al cuerpo · ${w.kh} a la cabeza</span></li>
        <li><b>Tiempo para eliminar</b><span>${fmt((ttk(w, w.kb) / 1000).toFixed(2))} s al cuerpo · ${fmt((ttk(w, w.kh) / 1000).toFixed(2))} s a la cabeza</span></li>
        <li><b>Precisión</b><span>${disp}</span></li>
        ${extra}
        ${w.spd !== 1 ? `<li><b>Velocidad al correr</b><span>${w.spd > 1 ? '+' : '−'}${Math.round(Math.abs(w.spd - 1) * 100)} %</span></li>` : ''}
      </ul>
      <div class="range">
        <div class="range-head"><b>🎯 Galería de tiro</b><span>a velocidad real</span>
          <div class="seg2" role="group" aria-label="Dónde apuntar"><button data-aim="body" class="on">Al cuerpo</button><button data-aim="head">A la cabeza</button></div>
          <button class="rp" aria-label="Pausar">❚❚</button></div>
        <canvas class="range-cv" width="760" height="230" aria-label="Animación del ${w.n} disparando a un huevo de prácticas"></canvas>
      </div>`;
    if (range) range.stop();
    range = Range(wDetail.querySelector('.range-cv'), w);
    wDetail.querySelectorAll('[data-aim]').forEach(b => b.addEventListener('click', () => {
      wDetail.querySelectorAll('[data-aim]').forEach(x => x.classList.toggle('on', x === b)); range.aim(b.dataset.aim);
    }));
    const rp = wDetail.querySelector('.rp');
    rp.addEventListener('click', () => { const p = range.toggle(); rp.textContent = p ? '▶' : '❚❚'; rp.setAttribute('aria-label', p ? 'Reanudar' : 'Pausar'); });
  }

  // Galería de tiro: el arma dispara con su cadencia, cargador y recarga reales
  function Range(cv, w) {
    const ctx = cv.getContext('2d');
    const DPR = Math.min(2, devicePixelRatio || 1), W = Math.round(Math.max(340, Math.min(760, cv.clientWidth || 760))), H = W < 520 ? 250 : 230;
    cv.style.aspectRatio = W + ' / ' + H;
    cv.width = W * DPR; cv.height = H * DPR; ctx.scale(DPR, DPR);
    const MX = W < 520 ? 96 : 128, MY = H - 102, TX = W - (W < 520 ? 70 : 150), TY = H - 102;   // boca del arma y huevo diana
    let aim = 'body', paused = false, raf = 0, last = performance.now(), t = 0, visible = true;
    let ammo = w.mag, hp = 100, next = 400, burstLeft = 0, reloadEnd = 0, deadUntil = 0, shots = 0, kills = 0, flash = 0;
    const tracers = [], nums = [], rockets = [], booms = [], bits = [];
    const dmgFor = () => w.proj ? w.proj.direct : (aim === 'head' ? Math.round(w.dmg * w.hm) : w.dmg) * (w.pel > 1 ? Math.ceil(w.pel * .75) : 1);
    function hit(d, head) {
      hp -= d;
      nums.push({ x: TX + (Math.random() * 30 - 15), y: TY - (head ? 70 : 40), v: d, head, t: 0 });
      if (hp <= 0) { kills++; deadUntil = t + 900; for (let k = 0; k < 18; k++) bits.push({ x: TX, y: TY - 20, vx: (Math.random() - .5) * 320, vy: -Math.random() * 300 - 60, r: Math.random() * 6 + 3, t: 0, yolk: k < 4 }); }
    }
    function fire() {
      if (ammo <= 0 || t < reloadEnd || t < deadUntil) return false;
      ammo--; shots++; flash = 60;
      const head = aim === 'head';
      const ty = TY + (head ? -46 : -6);
      if (w.proj) { rockets.push({ x: MX, y: MY, head }); return true; }
      const pel = w.pel > 1 ? w.pel : 1;
      for (let k = 0; k < pel; k++) {
        const j = (Math.random() - .5) * w.sp * 900 * (w.pel > 1 ? 1 : .6);
        tracers.push({ y2: ty + j, t: 0 });
      }
      hit(dmgFor(), head && !w.proj);
      return true;
    }
    function update(dt) {
      t += dt;
      if (hp <= 0 && t >= deadUntil) { hp = 100; next = Math.max(next, t + 250); }
      if (ammo <= 0 && t >= reloadEnd && !reloadEnd) reloadEnd = t + w.rl;
      if (reloadEnd && t >= reloadEnd) { ammo = w.mag; reloadEnd = 0; next = t + 150; }
      if (t >= next && !reloadEnd && t >= deadUntil) {
        if (fire()) {
          if (w.burst) { if (burstLeft <= 0) burstLeft = w.burst.count; burstLeft--; next = t + (burstLeft > 0 ? w.burst.interval : w.cd); }
          else next = t + w.cd;
          if (ammo <= 0) reloadEnd = t + w.rl;
        }
      }
      flash = Math.max(0, flash - dt);
      tracers.forEach(o => o.t += dt); while (tracers.length && tracers[0].t > 110) tracers.shift();
      nums.forEach(o => o.t += dt); while (nums.length && nums[0].t > 900) nums.shift();
      rockets.forEach(r => { r.x += dt * .9; });
      for (let k = rockets.length - 1; k >= 0; k--) if (rockets[k].x >= TX - 18) { booms.push({ t: 0 }); hit(w.proj.direct, false); rockets.splice(k, 1); }
      booms.forEach(o => o.t += dt); while (booms.length && booms[0].t > 600) booms.shift();
      bits.forEach(b => { b.t += dt; b.x += b.vx * dt / 1000; b.y += b.vy * dt / 1000; b.vy += 900 * dt / 1000; if (b.y > H - 34) { b.y = H - 34; b.vy *= -.3; b.vx *= .7; } });
      while (bits.length && bits[0].t > 1300) bits.shift();
    }
    function egg(x, y, s, alpha) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
      const g = ctx.createRadialGradient(-10 * s, -26 * s, 4, 0, -14 * s, 46 * s);
      g.addColorStop(0, '#fffdf7'); g.addColorStop(.7, '#ffe6c4'); g.addColorStop(1, '#efbd86');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -14 * s, 30 * s, 40 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b2412'; ctx.beginPath(); ctx.arc(-10 * s, -24 * s, 3.4 * s, 0, 7); ctx.arc(10 * s, -24 * s, 3.4 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -10 * s, 7 * s, .2, Math.PI - .2); ctx.stroke();
      // diana
      ctx.strokeStyle = 'rgba(229,72,77,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 2 * s, 10 * s, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 2 * s, 4 * s, 0, 7); ctx.stroke();
      ctx.restore();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#ffe9cf'); sky.addColorStop(.74, '#fff5e8'); sky.addColorStop(.74, '#e9c9a0'); sky.addColorStop(1, '#d9b080');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(140,90,40,.25)'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(MX + 22, H - 30); ctx.lineTo(W - 20, H - 30); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(120,70,30,.5)'; ctx.font = '700 11px Nunito, sans-serif';
      for (let k = 1; k <= 4; k++) { const x = MX + 22 + k * (TX - MX - 22) / 4.6; ctx.fillRect(x, H - 36, 2, 12); ctx.fillText(Math.round(w.rng * k / 5) + ' m', x - 10, H - 10); }
      // arma
      ctx.fillStyle = '#3b2412'; ctx.beginPath(); ctx.roundRect(MX - 100 < 8 ? 8 : 28, MY - 8, MX - (MX - 100 < 8 ? 8 : 28), 16, 5); ctx.fill();
      ctx.fillStyle = '#ff8c2a'; ctx.beginPath(); ctx.roundRect(54, MY + 6, 18, 30, 5); ctx.fill();
      ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.roundRect(8, MY - 12, 30, 22, 6); ctx.fill();
      if (flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = 16 + Math.random() * 8; const g = ctx.createRadialGradient(MX + 8, MY, 0, MX + 8, MY, r); g.addColorStop(0, '#fff'); g.addColorStop(.4, w.col); g.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(MX + 8, MY, r, 0, 7); ctx.fill(); ctx.restore(); }
      // trazadoras
      tracers.forEach(o => { ctx.strokeStyle = w.col; ctx.globalAlpha = 1 - o.t / 110; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(MX + 10, MY); ctx.lineTo(TX - 26, o.y2); ctx.stroke(); ctx.globalAlpha = 1; });
      rockets.forEach(r => { const ty = TY + (r.head ? -46 : -6); const y = MY + (ty - MY) * ((r.x - MX) / (TX - MX)); ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.ellipse(r.x, y, 14, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = w.col; ctx.beginPath(); ctx.arc(r.x - 16, y, 5 + Math.random() * 3, 0, 7); ctx.fill(); });
      // huevo
      if (hp > 0) egg(TX, TY + 40, 1, 1);
      else if (t < deadUntil) { const k = (deadUntil - t) / 900; ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.ellipse(TX, H - 34, 34 * (1.4 - k * .4), 9, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(TX, H - 34, 52 * (1.4 - k * .4), 13, 0, 0, 7); ctx.globalAlpha = .6; ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#ff9f1a'; ctx.beginPath(); ctx.ellipse(TX, H - 36, 16, 7, 0, 0, 7); ctx.fill(); }
      bits.forEach(b => { ctx.fillStyle = b.yolk ? '#ffb020' : '#fff4e2'; ctx.globalAlpha = Math.max(0, 1 - b.t / 1300); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
      booms.forEach(o => { const k = o.t / 600; ctx.globalAlpha = 1 - k; const g = ctx.createRadialGradient(TX, TY - 10, 0, TX, TY - 10, 30 + k * 90); g.addColorStop(0, '#fff'); g.addColorStop(.3, '#ffc94a'); g.addColorStop(.7, '#ff6a1a'); g.addColorStop(1, 'rgba(255,106,26,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(TX, TY - 10, 30 + k * 90, 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
      // vida
      ctx.fillStyle = 'rgba(59,36,18,.15)'; ctx.beginPath(); ctx.roundRect(TX - 50, 22, 100, 10, 5); ctx.fill();
      const hpw = Math.max(0, hp); ctx.fillStyle = hpw > 50 ? '#2ecc71' : hpw > 25 ? '#ffb020' : '#e5484d'; ctx.beginPath(); ctx.roundRect(TX - 50, 22, hpw, 10, 5); ctx.fill();
      ctx.fillStyle = '#6b4a33'; ctx.font = '800 11px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(hp > 0 ? Math.round(hp) + ' / 100' : '¡HUEVO ROTO!', TX, 48); ctx.textAlign = 'left';
      nums.forEach(o => { const k = o.t / 900; ctx.globalAlpha = 1 - k; ctx.fillStyle = o.head ? '#e5484d' : '#ff6a1a'; ctx.font = `${o.head ? 900 : 800} ${o.head ? 22 : 18}px Nunito, sans-serif`; ctx.fillText((o.head ? '💥 ' : '') + o.v, o.x + 36, o.y - k * 40); ctx.globalAlpha = 1; });
      // munición y recarga
      ctx.fillStyle = '#3b2412'; ctx.font = '400 30px "Lilita One", sans-serif'; ctx.fillText(ammo, 22, 44);
      const aw = ctx.measureText(String(ammo)).width; ctx.font = '800 13px Nunito, sans-serif'; ctx.fillStyle = '#9a7a62'; ctx.fillText('/ ' + w.mag, 28 + aw, 44);
      if (reloadEnd) { const k = 1 - (reloadEnd - t) / w.rl; ctx.fillStyle = 'rgba(59,36,18,.12)'; ctx.beginPath(); ctx.roundRect(22, 56, 120, 8, 4); ctx.fill(); ctx.fillStyle = '#ff8c2a'; ctx.beginPath(); ctx.roundRect(22, 56, 120 * Math.min(1, k), 8, 4); ctx.fill(); ctx.fillStyle = '#b34b00'; ctx.font = '900 11px Nunito, sans-serif'; ctx.fillText('RECARGANDO… ' + ((reloadEnd - t) / 1000).toFixed(1).replace('.', ',') + ' s', 22, 80); }
      ctx.fillStyle = '#9a7a62'; ctx.font = '800 11px Nunito, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(W < 520 ? `${shots} disp. · ${kills} rotos` : `disparos: ${shots} · huevos rotos: ${kills}`, W - 12, 18); ctx.textAlign = 'left';
    }
    function loop(now) {
      const dt = Math.min(50, now - last); last = now;
      if (!paused && visible) update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
    const vis = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); vis.observe(cv);
    if (reduce) { paused = true; update(0); }
    raf = requestAnimationFrame(loop);
    return {
      stop() { cancelAnimationFrame(raf); vis.disconnect(); },
      toggle() { paused = !paused; return paused; },
      aim(a) { aim = a; hp = 100; deadUntil = 0; },
    };
  }
  showWeapon(0);
  // Teclas 1-7 cambian de arma cuando la sección está a la vista (como en el juego)
  addEventListener('keydown', e => {
    if (!lb.hidden || /input|textarea/i.test(document.activeElement.tagName)) return;
    const r = $('#armas').getBoundingClientRect();
    if (r.top < innerHeight * .6 && r.bottom > innerHeight * .4) {
      const n = +e.key; if (n >= 1 && n <= 7) showWeapon(n - 1); else if (e.key.toLowerCase() === 'e') showWeapon(7);
    }
  });

  // ---------------------------------------------------------------- calidad
  const qSeg = $('#qSeg'), pill = qSeg.querySelector('.seg-pill');
  function setQ(i) {
    const q = QUALITY[i];
    $$('#qSeg button').forEach((b, k) => { b.classList.toggle('active', k === i); b.setAttribute('aria-selected', k === i); });
    pill.style.transform = `translateX(${i * 100}%)`;
    $('#qBar').style.width = q.p + '%';
    $('#qList').innerHTML = q.rows.map(([k, v], n) => `<div style="animation-delay:${n * 60}ms"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }
  $$('#qSeg button').forEach(b => b.addEventListener('click', () => setQ(+b.dataset.q)));
  setQ(2);

  // ---------------------------------------------------------------- controles
  const keysOn = ks => { $$('#keyboard [data-k]').forEach(k => k.classList.toggle('on', ks.includes(k.dataset.k))); };
  $$('#actions li').forEach(li => {
    const ks = li.dataset.keys.split(' ');
    li.addEventListener('mouseenter', () => { stopDemo(); $$('#actions li').forEach(x => x.classList.toggle('on', x === li)); keysOn(ks); });
    li.addEventListener('mouseleave', () => { li.classList.remove('on'); keysOn([]); startDemo(); });
  });
  // Demostración automática: va iluminando las acciones una a una
  let demoT = null, demoI = 0;
  const lis = $$('#actions li');
  function demo() { lis.forEach((x, k) => x.classList.toggle('on', k === demoI)); keysOn(lis[demoI].dataset.keys.split(' ')); demoI = (demoI + 1) % lis.length; }
  function startDemo() { if (reduce || demoT) return; demoT = setInterval(demo, 1300); }
  function stopDemo() { clearInterval(demoT); demoT = null; }
  // Pulsar teclas de verdad también las ilumina
  const map = { ' ': 'space', escape: 'esc', shift: 'shift' };
  addEventListener('keydown', e => { const k = map[e.key.toLowerCase()] || e.key.toLowerCase(); const el = $(`#keyboard [data-k="${CSS.escape(k)}"]`); if (el) { stopDemo(); el.classList.add('on'); } });
  addEventListener('keyup', e => { const k = map[e.key.toLowerCase()] || e.key.toLowerCase(); const el = $(`#keyboard [data-k="${CSS.escape(k)}"]`); if (el) el.classList.remove('on'); });

  // ---------------------------------------------------------------- copiar código
  $$('.copy').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = '¡Copiado!'; b.classList.add('ok'); }
    catch (e) { b.textContent = 'Selecciona y copia'; }
    setTimeout(() => { b.textContent = 'Copiar'; b.classList.remove('ok'); }, 1600);
  }));

  // ---------------------------------------------------------------- aparición y contadores
  const counted = new WeakSet();
  function countUp(el) {
    if (counted.has(el)) return; counted.add(el);
    const to = +el.dataset.to; if (reduce) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 1200 + to * 2;
    const tick = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
    el.textContent = '0'; requestAnimationFrame(tick);
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.querySelectorAll('.count').forEach(countUp);
    if (e.target.classList.contains('count')) countUp(e.target);
    if (e.target.id === 'controles' || e.target.closest('#controles')) startDemo();
    io.unobserve(e.target);
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  // Retraso escalonado en grupos de tarjetas
  $$('.play-cards,.features,.modes,.imp-grid,.cheats,.deploys,.mini-cards,.faq,.perf-points,.steps,.sabotage').forEach(g =>
    [...g.children].forEach((c, i) => { if (!c.style.getPropertyValue('--d')) c.style.setProperty('--d', i * 0.08 + 's'); }));
  $$('.hero .reveal').forEach((c, i) => c.style.setProperty('--d', i * 0.1 + 's'));
  $$('.reveal').forEach(el => io.observe(el));

  // ---------------------------------------------------------------- cabecera, progreso y menú
  const top = $('#topbar'), prog = $('#progress'), toTop = $('#toTop');
  const links = $$('.nav a[href^="#"]'), secs = links.map(a => $(a.getAttribute('href')));
  let ticking = false;
  function onScroll() {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    top.classList.toggle('scrolled', y > 20);
    prog.style.width = (h > 0 ? y / h * 100 : 0) + '%';
    toTop.classList.toggle('show', y > 900);
    let act = -1;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < 140) act = i; });
    links.forEach((a, i) => a.classList.toggle('active', i === act));
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  const burger = $('#burger'), nav = $('#nav');
  burger.addEventListener('click', () => { const o = !nav.classList.contains('open'); nav.classList.toggle('open', o); burger.setAttribute('aria-expanded', o); });
  links.forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }));

  // ---------------------------------------------------------------- inclinación 3D del hero con el ratón
  const art = $('#heroArt'), shot = art && art.querySelector('.shot');
  if (art && !reduce && matchMedia('(pointer:fine)').matches) {
    art.addEventListener('mousemove', e => {
      const r = art.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      shot.style.transform = `rotateY(${x * 14 - 4}deg) rotateX(${-y * 10 + 2}deg)`;
    });
    art.addEventListener('mouseleave', () => { shot.style.transform = ''; });
  }
})();
