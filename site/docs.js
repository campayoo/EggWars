/*! EGG WARS · Documentación técnica · © 2026 Pablo Campayo Viñes. Todos los derechos reservados. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Barra de progreso, botón arriba y menú móvil
  const prog = $('#progress'), toTop = $('#toTop'), burger = $('#burger'), nav = $('#nav');
  const toc = $$('#toc a'), secs = toc.map(a => $(a.getAttribute('href')));
  let ticking = false;
  function onScroll() {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = (h > 0 ? y / h * 100 : 0) + '%';
    toTop.classList.toggle('show', y > 900);
    let act = 0;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < 130) act = i; });
    toc.forEach((a, i) => a.classList.toggle('active', i === act));
    const cur = toc[act];
    if (cur && innerWidth > 1060) {   // el índice sigue a la sección actual
      const side = $('#side'), r = cur.getBoundingClientRect(), sr = side.getBoundingClientRect();
      if (r.top < sr.top + 60 || r.bottom > sr.bottom - 40) side.scrollTop += r.top - sr.top - sr.height / 2;
    }
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  burger.addEventListener('click', () => { const o = !nav.classList.contains('open'); nav.classList.toggle('open', o); burger.setAttribute('aria-expanded', o); });

  // Buscador del índice
  const q = $('#q'), empty = $('#tocEmpty');
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  q.addEventListener('input', () => {
    const v = norm(q.value.trim());
    let any = false;
    toc.forEach((a, i) => {
      const txt = norm(a.textContent + ' ' + (secs[i] ? secs[i].textContent.slice(0, 1500) : ''));
      const ok = !v || txt.includes(v);
      a.hidden = !ok; any = any || ok;
    });
    $$('.toc-g').forEach(g => {
      let n = g.nextElementSibling, vis = false;
      while (n && n.tagName === 'A') { if (!n.hidden) vis = true; n = n.nextElementSibling; }
      g.hidden = !vis;
    });
    empty.hidden = any;
  });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = toc.find(a => !a.hidden); if (f) f.click(); } });
  addEventListener('keydown', e => { if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); } });

  // Pestañas del protocolo
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
    $$('.tabp').forEach(p => { p.hidden = p.id !== t.dataset.t; });
  }));

  // Copiar código
  $$('.copy').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = '¡Copiado!'; b.classList.add('ok'); }
    catch (e) { b.textContent = 'Selecciona y copia'; }
    setTimeout(() => { b.textContent = 'Copiar'; b.classList.remove('ok'); }, 1600);
  }));

  // Aparición y contadores
  const counted = new WeakSet();
  function countUp(el) {
    if (counted.has(el)) return; counted.add(el);
    const to = +el.dataset.to; if (reduce) { el.textContent = to.toLocaleString('es-ES'); return; }
    const t0 = performance.now(), dur = 1400;
    const tick = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('es-ES'); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.querySelectorAll('.count').forEach(countUp);
    io.unobserve(e.target);
  }), { threshold: .1 });
  $$('.ds').forEach(s => s.classList.add('reveal'));
  $$('.reveal').forEach(el => io.observe(el));
})();
