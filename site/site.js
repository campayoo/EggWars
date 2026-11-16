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
    ['nemanave', '🥚', 'Ñemanave', 'L', 12, 'La nave de Huevo Impostor, ahora para los tiros: combate en interiores por La Yema, 4 pasillos y 12 salas. Funciona en los 4 modos.', 1],
  ];
  const SIZE = { L: 'Grande', M: 'Mediano' };

  // Siluetas propias de cada arma (SVG simple)
  const gun = (body, extra = '') => `<svg viewBox="0 0 420 120" aria-hidden="true"><defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a33"/><stop offset="1" stop-color="#2a1a0e"/></linearGradient><linearGradient id="wo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb062"/><stop offset="1" stop-color="#e8701e"/></linearGradient></defs><g fill="url(#wg)">${body}</g>${extra}</svg>`;
  const WEAPONS = [
    { n: 'EggK-47', t: 'Fusil automático', dmg: 23, d: 'Automático clásico de medio alcance: cadencia alta y nunca se encasquilla.',
      svg: gun('<rect x="60" y="46" width="250" height="22" rx="6"/><rect x="300" y="52" width="90" height="9" rx="3"/><path d="M60 50 L10 40 L10 78 L60 70Z"/><path d="M150 66 h26 l-8 44 h-24z"/><path d="M200 66 h30 l14 36 h-26z" fill="url(#wo)"/>') },
    { n: 'Scrambler', t: 'Escopeta', dmg: 16, unit: '×perdigón', d: 'Dos disparos devastadores a quemarropa. Recarga rápida.',
      svg: gun('<rect x="70" y="44" width="300" height="16" rx="5"/><rect x="150" y="62" width="160" height="14" rx="5" fill="url(#wo)"/><path d="M70 46 L14 40 L14 80 L70 66Z"/><path d="M120 62 h24 l-8 40 h-22z"/>') },
    { n: 'Free Ranger', t: 'Semiautomático con mira', dmg: 52, d: 'Dos disparos al cuerpo o uno a la cabeza.',
      svg: gun('<rect x="60" y="50" width="270" height="18" rx="6"/><rect x="320" y="54" width="70" height="8" rx="3"/><rect x="150" y="28" width="90" height="14" rx="7" fill="url(#wo)"/><rect x="170" y="40" width="10" height="12"/><rect x="210" y="40" width="10" height="12"/><path d="M60 52 L12 44 L12 80 L60 68Z"/><path d="M140 66 h24 l-8 40 h-22z"/>') },
    { n: 'RPEGG', t: 'Lanzacohetes', dmg: 110, d: 'El impacto directo elimina siempre. La explosión (3,6 m) sólo mata muy cerca del centro. ¡Cuidado con tu propio cohete!',
      svg: gun('<rect x="40" y="40" width="320" height="34" rx="16"/><ellipse cx="370" cy="57" rx="22" ry="22" fill="url(#wo)"/><rect x="150" y="74" width="22" height="36" rx="4"/><rect x="220" y="74" width="18" height="26" rx="4"/>', '<circle cx="372" cy="57" r="8" fill="#fff3d6"/>') },
    { n: 'Whipper', t: 'Ametralladora', dmg: 15, d: 'Cargador enorme y cadencia altísima para la corta distancia.',
      svg: gun('<rect x="70" y="44" width="230" height="26" rx="8"/><rect x="290" y="50" width="100" height="12" rx="4"/><rect x="160" y="70" width="60" height="40" rx="10" fill="url(#wo)"/><path d="M70 48 L20 44 L20 74 L70 66Z"/><path d="M120 70 h22 l-6 36 h-20z"/>') },
    { n: 'Crackshot', t: 'Francotirador de cerrojo', dmg: 90, d: 'Un disparo a la cabeza revienta cualquier huevo.',
      svg: gun('<rect x="50" y="52" width="320" height="14" rx="5"/><rect x="360" y="55" width="50" height="7" rx="3"/><rect x="140" y="26" width="120" height="16" rx="8" fill="url(#wo)"/><rect x="170" y="40" width="10" height="14"/><rect x="226" y="40" width="10" height="14"/><path d="M50 54 L6 46 L6 84 L50 66Z"/><path d="M120 64 h22 l-8 40 h-20z"/><rect x="270" y="46" width="16" height="6" rx="3"/>') },
    { n: 'Tri-Hard', t: 'Fusil de ráfaga', dmg: 26, d: 'Ráfagas de tres balas muy precisas para media distancia.',
      svg: gun('<rect x="60" y="46" width="260" height="22" rx="6"/><rect x="310" y="52" width="80" height="9" rx="3"/><path d="M60 50 L12 42 L12 80 L60 70Z"/><rect x="150" y="34" width="60" height="12" rx="6"/><path d="M150 66 h24 l-8 42 h-22z"/><rect x="200" y="68" width="34" height="32" rx="6" fill="url(#wo)"/>') },
    { n: 'Cluck 9mm', t: 'Pistola de apoyo', dmg: 24, d: 'Rápida de sacar y precisa. La llevas siempre.',
      svg: gun('<rect x="130" y="40" width="170" height="26" rx="7"/><path d="M150 64 h44 l-10 50 h-40z" fill="url(#wo)"/><rect x="196" y="64" width="22" height="16" rx="6" fill="none" stroke="#2a1a0e" stroke-width="5"/>') },
  ];
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
  WEAPONS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'w-btn'; b.setAttribute('role', 'tab');
    b.innerHTML = `<span class="num">${i < 7 ? i + 1 : 'E'}</span>${w.n}<span class="wd">${w.dmg}</span>`;
    b.addEventListener('click', () => showWeapon(i));
    wList.appendChild(b);
  });
  function showWeapon(i) {
    const w = WEAPONS[i];
    [...wList.children].forEach((b, k) => { b.classList.toggle('active', k === i); b.setAttribute('aria-selected', k === i); });
    wDetail.innerHTML = `<span class="w-type">${w.t}</span><h3>${w.n}</h3><div class="w-art">${w.svg}</div>
      <p class="w-desc">${w.d}</p>
      <div class="bar"><span>Daño por bala</span><div class="track2"><div class="fill"></div></div><b>${w.dmg}${w.unit ? '<small style="font-size:.6em"> ' + w.unit + '</small>' : ''}</b></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => { wDetail.querySelector('.fill').style.width = Math.min(100, w.dmg / 110 * 100) + '%'; }));
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
  const links = $$('.nav a'), secs = links.map(a => $(a.getAttribute('href')));
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
