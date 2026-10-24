/* AS BUILT · designed and built by MAFSAN · shared behaviour
   Smooth scroll, reveals, count-ups, nav, forms and the NYLA chat simulation.
   No network calls: nothing typed here leaves the browser. */
(() => {
  window.__lh = true;
  try { console.log('%cAS BUILT · designed and built by MAFSAN · © 2026 · proprietary, shown for presentation only. Not licensed for copying, cloning or AI training.', 'color:#C99A3B;font-weight:600'); } catch (e) { /* no console */ }
  const BRS = (window.MF_BRAND && window.MF_BRAND.short) || 'MAFSAN';

  /* ---------- light / dark toggle (theme state lives in brand.js) ---------- */
  const syncToggle = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-pressed', light ? 'true' : 'false');
      b.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    });
  };
  document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => window.MFTheme && window.MFTheme.toggle()));
  document.addEventListener('mf:theme', syncToggle);
  syncToggle();
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const aed = n => 'AED ' + fmt(n);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  /* WhatsApp number: international format, + or 00, then 9 to 15 digits */
  const waOk = v => { const t = String(v).trim(); if (!/^(\+|00)/.test(t) || /[^\d\s+()-]/.test(t)) return false; const d = t.replace(/^00/, '').replace(/\D/g, ''); return d.length >= 9 && d.length <= 15; };

  if (hasGsap && window.ScrollTrigger) { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ ignoreMobileResize: true }); }
  if (hasGsap && window.SplitText) gsap.registerPlugin(SplitText);

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.2 });
    if (hasGsap) {
      if (window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollTo = (target, offset = -84) => {
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.8, easing: t => 1 - Math.pow(1 - t, 4) });
    else {
      const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  /* ---------- nav, progress ---------- */
  const nav = $('.nav');
  const bar = $('.progress span');
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle('is-scrolled', y > 30);
    const menuOpen = document.documentElement.classList.contains('menu-open');
    if (!menuOpen) nav.classList.toggle('is-hidden', y > lastY + 2 && y > 500);
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('.nav__burger');
  const toggleMenu = open => {
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => toggleMenu(!document.documentElement.classList.contains('menu-open')));
  $$('.menu a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) toggleMenu(false); });

  /* in-page anchors (also "index.html#x" while on the home page) */
  const here = location.pathname.split('/').pop() || 'index.html';
  $$('a[href*="#"]').forEach(a => {
    const href = a.getAttribute('href');
    const [path, hash] = href.split('#');
    if (!hash) return;
    const samePage = path === '' || path === here || (path === 'index.html' && (here === '' || here === 'index' || here === 'index.html'));
    if (!samePage) return;
    a.addEventListener('click', e => {
      const el = hash === 'main' ? document.body : document.getElementById(hash);
      if (!el) return;
      e.preventDefault();
      if (document.documentElement.classList.contains('menu-open')) toggleMenu(false);
      scrollTo(hash === 'main' ? 0 : el);
      history.replaceState(null, '', '#' + hash);
    });
  });
  if (location.hash && location.hash.length > 1) {
    const t = document.getElementById(location.hash.slice(1));
    if (t) setTimeout(() => scrollTo(t), 400);
  }

  /* ---------- reveal on scroll ---------- */
  const countUp = el => {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const to = Number(el.dataset.count);
    if (reduce || !to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 900, from = to * 0.85;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(entries => {
    const entering = entries.filter(e => e.isIntersecting);
    entering.forEach((en, i) => {
      const el = en.target;
      el.style.transitionDelay = reduce ? '0s' : Math.min(i * 0.08, 0.4) + 's';
      el.classList.add('is-in');
      $$('[data-count]', el).forEach(countUp);
      if (el.matches('[data-count]')) countUp(el);
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('[data-reveal], .steps, [data-count]').forEach(el => io.observe(el));

  /* split-line headline reveals */
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))]);
  fontsReady.then(() => {
    if (!hasGsap || !window.SplitText || !window.ScrollTrigger || reduce) return;
    /* every editorial heading gets a line-masked reveal, not only the ones tagged by hand */
    const heads = new Set($$('.reveal-lines, .display, .phero h1, .h3, .lead__copy h2'));
    $$('.hero__title, .panel__name, .foot__big, .show__track .display').forEach(el => heads.delete(el));
    heads.forEach(el => {
      if (el.closest('.show__track, .hero, .foot')) return;
      let s; try { s = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'ln' }); } catch (e) { return; }
      gsap.from(s.lines, { yPercent: 110, duration: 1.25, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    buildShowcase();
    buildFooter();
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  });
  window.addEventListener('resize', (() => { let t; return () => { clearTimeout(t); t = setTimeout(buildFooter, 300); }; })());

  /* ---------- custom cursor, magnetic buttons, lens (desktop, fine pointer) ---------- */
  if (finePointer && hasGsap && !reduce) {
    const cur = document.createElement('div');
    cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div>';
    document.body.appendChild(cur);
    document.documentElement.classList.add('has-cursor');
    const label = $('.cursor__label', cur);
    const dx = gsap.quickTo('.cursor__dot', 'x', { duration: 0.08 }), dy = gsap.quickTo('.cursor__dot', 'y', { duration: 0.08 });
    const rx = gsap.quickTo('.cursor__ring', 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo('.cursor__ring', 'y', { duration: 0.5, ease: 'power3' });
    window.addEventListener('mousemove', e => { cur.classList.add('is-on'); dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.addEventListener('mouseleave', () => cur.classList.remove('is-on'));
    document.addEventListener('mouseover', e => {
      const t = e.target; if (!(t instanceof Element)) return;
      const lab = t.closest('[data-cursor]');
      const link = t.closest('a,button,summary,label,.chip,[role=button]');
      cur.classList.toggle('is-hidden', !!t.closest('[data-lens],input,select,textarea'));
      cur.classList.toggle('is-label', !!lab);
      cur.classList.toggle('is-link', !lab && !!link);
      if (lab) label.textContent = lab.dataset.cursor;
    });
    $$('.magnetic').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1,0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1,0.4)' });
      el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.3); yTo((e.clientY - r.top - r.height / 2) * 0.34); });
      el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
    });
    /* lens: a magnifier that follows the pointer over a photo, matching object-fit: cover framing */
    $$('[data-lens]').forEach(fig => {
      const img = fig.querySelector('img'); if (!img) return;
      const lens = document.createElement('div'); lens.className = 'lens'; lens.setAttribute('aria-hidden', 'true'); fig.appendChild(lens);
      const Z = 2.1, R = 95;
      const lx = gsap.quickSetter(lens, 'x', 'px'), ly = gsap.quickSetter(lens, 'y', 'px');
      gsap.set(lens, { xPercent: -50, yPercent: -50, scale: 0.5, opacity: 0 });
      let geo = null, fr = null;
      const measure = () => {
        const nw = img.naturalWidth, nh = img.naturalHeight; if (!nw) return null;
        const ir = img.getBoundingClientRect();
        const sc = Math.max(ir.width / nw, ir.height / nh), dw = nw * sc, dh = nh * sc;
        const pos = (getComputedStyle(img).objectPosition || '50% 50%').split(' ').map(v => parseFloat(v) / 100);
        return { ir, dw, dh, ox: (ir.width - dw) * (pos[0] || 0.5), oy: (ir.height - dh) * (pos[1] || 0.5) };
      };
      fig.addEventListener('pointerenter', () => {
        geo = measure(); if (!geo) return;
        fr = fig.getBoundingClientRect();
        lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
        lens.style.backgroundSize = `${geo.dw * Z}px ${geo.dh * Z}px`;
        fig.classList.add('is-lens');
        gsap.to(lens, { opacity: 1, scale: 1, duration: 0.55, ease: 'expo.out', overwrite: 'auto' });
      });
      fig.addEventListener('pointerleave', () => {
        fig.classList.remove('is-lens');
        gsap.to(lens, { opacity: 0, scale: 0.5, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
      });
      fig.addEventListener('pointermove', e => {
        if (!geo || !fr) return;
        lx(e.clientX - fr.left); ly(e.clientY - fr.top);
        const u = e.clientX - geo.ir.left - geo.ox, v = e.clientY - geo.ir.top - geo.oy;
        lens.style.backgroundPosition = `${R - u * Z}px ${R - v * Z}px`;
      });
    });
  }

  /* ---------- section to section colour, clip reveals, parallax ---------- */
  if (hasGsap && window.ScrollTrigger && !reduce) {
    const main = $('main');
    const tintEl = document.createElement('div'); tintEl.className = 'tint'; tintEl.setAttribute('aria-hidden', 'true');
    main.append(tintEl); document.documentElement.classList.add('has-tint');
    /* light theme: the same walk through the day, from morning mist to a warm afternoon */
    const LIGHT = { '#070B1C': '#F4EFE6', '#0A1433': '#EEF1F7', '#0D1840': '#ECEFF7', '#141645': '#EFEDF6', '#1B1546': '#F2ECF3', '#22163F': '#F5EBEE', '#2A1838': '#F7EBE5', '#2E1A33': '#F6EADF' };
    let curBg = '#070B1C';
    const tint = (c, d = 1.4) => { curBg = c; const light = document.documentElement.getAttribute('data-theme') === 'light'; gsap.to(tintEl, { backgroundColor: light ? (LIGHT[c] || '#F4EFE6') : c, duration: d, ease: 'power2.out', overwrite: 'auto' }); };
    tint(curBg, 0);
    document.addEventListener('mf:theme', () => tint(curBg, 0.6));
    const tinted = $$('[data-bg]');
    tinted.forEach((sec, i) => ScrollTrigger.create({
      trigger: sec, start: 'top 60%', end: 'bottom 60%',
      onEnter: () => tint(sec.dataset.bg), onEnterBack: () => tint(sec.dataset.bg),
      onLeaveBack: () => { if (i === 0) tint('#070B1C'); }
    }));
    /* office photos: a slow parallax inside their window-frame mounts (the reveal itself is a CSS transform cover) */
    $$('.office__photo img').forEach(im => gsap.fromTo(im, { yPercent: -3.5 }, { yPercent: 3.5, ease: 'none', scrollTrigger: { trigger: im.closest('figure'), start: 'top bottom', end: 'bottom top', scrub: true } }));
    $$('.shead .display, .lead__copy .display').forEach(h => gsap.fromTo(h, { y: 30 }, { y: -30, ease: 'none', scrollTrigger: { trigger: h, start: 'top bottom', end: 'bottom top', scrub: true } }));
  }

  /* =====================================================
     SIGNATURE PROJECTS · pinned horizontal showcase
     ===================================================== */
  const pad2 = n => String(n).padStart(2, '0');
  function buildShowcase() {
    const show = $('.show'); if (!show || !hasGsap || !window.ScrollTrigger || !window.SplitText || reduce) return;
    const pin = $('.show__pin', show), track = $('.show__track', show), panels = $$('.panel', show), bar = $('.show__bar i', show);
    const cur = $$('.js-show-cur');
    const setCur = n => cur.forEach(c => (c.textContent = pad2(n)));
    /* the journey canvas stays live behind the panels: hand it the showcase progress (no-op until the scene exists) */
    const toScene = q => { const s = window.LHScene; if (s && s.showcase) s.showcase(q); };
    /* each tower replays the journey in 1.2 s: the outline rises (mask rect scaled by transform),
       then the porcelain fill, then the floors light in Window Amber from the ground up */
    const replay = p => {
      const mr = $('.mr', p), sil = $('.sil', p), fls = $$('.fl', p), o603 = $('.o603', p);
      gsap.set(mr, { scaleY: 0, transformOrigin: '50% 100%' });
      gsap.set([sil, ...fls], { opacity: 0 });
      if (o603) gsap.set(o603, { opacity: 0 });
      const tl = gsap.timeline({ paused: true })
        .to(mr, { scaleY: 1, duration: 0.55, ease: 'power2.inOut' }, 0)
        .to(sil, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 0.45)
        .to(fls, { opacity: 1, duration: 0.08, ease: 'none', stagger: { amount: 0.42 } }, 0.7);
      if (o603) tl.to(o603, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 1.0);
      return tl;
    };
    const names = panels.map(p => new SplitText($('.panel__name', p), { type: 'lines', mask: 'lines', linesClass: 'ln' }));
    const mm = gsap.matchMedia();
    mm.add('(min-width: 761px)', () => {
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const h = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: {
        trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true,
        onToggle: s => pin.classList.toggle('is-active', s.isActive),
        onUpdate: s => { setCur(1 + Math.round(Math.min(1, s.progress * 1.08) * (panels.length - 1))); if (bar) bar.style.transform = `scaleX(${s.progress})`; toScene(s.progress); }
      } });
      const vw = window.innerWidth;
      panels.forEach((p, i) => {
        const tl = replay(p);
        const early = p.offsetLeft < vw * 0.85; // already on screen when the pin starts: replay as the section arrives
        const at = early ? { trigger: pin, start: 'top 70%' } : { trigger: p, containerAnimation: h, start: 'left 84%' };
        ScrollTrigger.create(Object.assign({ onEnter: () => tl.play(), onLeaveBack: () => tl.reverse() }, at));
        const enter = Object.assign({ toggleActions: 'play none none reverse' }, at);
        gsap.from($('.panel__idx', p), { scale: 0.55, opacity: 0, transformOrigin: 'left bottom', duration: 1, ease: 'expo.out', scrollTrigger: enter });
        gsap.from(names[i].lines, { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.09, scrollTrigger: enter });
        gsap.from($$('.panel__dev, .panel__loc, .panel__facts, .panel__cta', p), { opacity: 0, y: 22, duration: 0.9, ease: 'power3.out', stagger: 0.07, clearProps: 'transform', scrollTrigger: enter });
        gsap.fromTo($('.panel__bg', p), { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: h, start: 'left right', end: 'right left', scrub: true } });
        gsap.fromTo($('.panel__tower', p), { xPercent: 6 }, { xPercent: -4, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: h, start: 'left right', end: 'right left', scrub: true } });
      });
      return () => { gsap.set(track, { clearProps: 'transform' }); };
    });
    mm.add('(max-width: 760px)', () => {
      ScrollTrigger.create({ trigger: show, start: 'top bottom', end: 'bottom top', onUpdate: s => toScene(s.progress) });
      panels.forEach((p, i) => {
        const tl = replay(p);
        ScrollTrigger.create({ trigger: p, start: 'top 78%', onEnter: () => tl.play(), onLeaveBack: () => tl.reverse() });
        gsap.from(names[i].lines, { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: p, start: 'top 80%', once: true } });
        gsap.from($$('.panel__dev, .panel__loc, .panel__facts, .panel__cta', p), { opacity: 0, y: 22, duration: 0.9, ease: 'power3.out', stagger: 0.08, clearProps: 'transform', scrollTrigger: { trigger: p, start: 'top 75%', once: true } });
        gsap.fromTo($('.panel__bg', p), { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true } });
        ScrollTrigger.create({ trigger: p, start: 'top 55%', end: 'bottom 55%', onToggle: s => { if (s.isActive) setCur(i + 1); } });
      });
    });
  }

  /* =====================================================
     OFFICE · walk-up card scrubs the client's own frames (o01..o18) on scroll
     ===================================================== */
  const walk = $('.js-walk');
  if (walk) {
    const num = $('.js-walk-n'), wbar = $('.walkup__frame i');
    const srcs = Array.from({ length: 18 }, (_, i) => `assets/img/seq/o${pad2(i + 1)}-duo.webp`);
    const cache = [];
    let frame = 0;
    const setFrame = f => { if (f === frame) return; frame = f; walk.src = srcs[f]; if (num) num.textContent = pad2(f + 1); };
    if (!reduce && hasGsap && window.ScrollTrigger) {
      new IntersectionObserver((en, ob) => {
        if (!en[0].isIntersecting) return;
        ob.disconnect();
        srcs.forEach((s, i) => { const im = new Image(); im.decoding = 'async'; im.src = s; cache[i] = im; });
      }, { rootMargin: '900px 0px' }).observe(walk);
      ScrollTrigger.create({ trigger: '#office', start: 'top 75%', end: 'bottom 35%', onUpdate: s => {
        setFrame(Math.min(17, Math.floor(s.progress * 18)));
        if (wbar) wbar.style.transform = `scaleX(${s.progress.toFixed(3)})`;
      } });
    }
  }

  /* =====================================================
     FOOTER · sunset reveal under the page (fixed on desktop when it fits the viewport)
     ===================================================== */
  let footTl = null, footMode = '';
  function buildFooter() {
    const foot = $('.foot'); if (!foot || !hasGsap || !window.ScrollTrigger || reduce) return;
    const inner = $('.foot__inner', foot), html = document.documentElement;
    html.classList.remove('foot-fixed');
    const fits = window.innerWidth > 1024 && window.innerHeight >= 640 && inner.offsetHeight <= window.innerHeight + 1;
    const mode = fits ? 'fixed' : 'flow';
    if (mode === footMode && footTl) { if (mode === 'fixed') html.classList.add('foot-fixed'); return; }
    footMode = mode;
    if (footTl) { footTl.scrollTrigger && footTl.scrollTrigger.kill(); footTl.kill(); footTl = null; }
    let spacer = $('.foot-spacer');
    if (fits) {
      html.classList.add('foot-fixed');
      if (!spacer) { spacer = document.createElement('div'); spacer.className = 'foot-spacer'; spacer.setAttribute('aria-hidden', 'true'); foot.before(spacer); }
      spacer.style.height = foot.offsetHeight + 'px';
    } else if (spacer) spacer.remove();
    const path = $('.foot__sky path', foot);
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, fillOpacity: 0 });
    foot.classList.add('foot-gated');
    footTl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      trigger: fits ? spacer : foot, start: fits ? 'top bottom' : 'top 85%', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true,
      onUpdate: s => { foot.classList.toggle('is-on', s.progress > 0); foot.classList.toggle('is-lit', s.progress > 0.7); },
      onToggle: s => foot.classList.toggle('is-on', s.isActive || s.progress > 0)
    } })
      .fromTo(inner, { yPercent: fits ? -22 : 0 }, { yPercent: 0, duration: 1 }, 0)
      .fromTo('.foot__sun', { yPercent: 55, scale: 0.6 }, { yPercent: 0, scale: 1, duration: 1 }, 0)
      .to(path, { strokeDashoffset: 0, duration: 0.75 }, 0.1)
      .to(path, { fillOpacity: 0.94, duration: 0.3 }, 0.62)
      .from('.foot__big .line > span', { yPercent: 110, stagger: 0.08, duration: 0.35 }, 0.25)
      .from('.foot__cols > div', { opacity: 0, y: 40, stagger: 0.06, duration: 0.3 }, 0.4)
      .from('.foot__badge', { scale: 0, rotate: -120, duration: 0.35, ease: 'back.out(1.6)' }, 0.45)
      .from('.foot__word span', { yPercent: 105, stagger: 0.035, duration: 0.4 }, 0.5);
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }
  /* giant word letters lift toward the cursor */
  if (finePointer && hasGsap && !reduce && $('.foot__word')) {
    const letters = $$('.foot__word span:not(.sp)');
    const lift = letters.map(l => gsap.quickTo(l, 'y', { duration: 0.7, ease: 'power3' }));
    $('.foot').addEventListener('mousemove', e => letters.forEach((l, i) => {
      const r = l.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      lift[i](-Math.max(0, 1 - d / 340) * 60);
    }));
    $('.foot').addEventListener('mouseleave', () => lift.forEach(t => t(0)));
  }
  $$('.pillar').forEach(p => p.addEventListener('pointermove', e => {
    const r = p.getBoundingClientRect();
    p.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
    p.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
  }));

  /* chips and segmented controls */
  $$('[data-chips]').forEach(g => $$('.chip', g).forEach(c => c.addEventListener('click', () => {
    $$('.chip', g).forEach(x => x.setAttribute('aria-pressed', 'false'));
    c.setAttribute('aria-pressed', 'true');
  })));
  $$('[data-seg]').forEach(g => $$('button', g).forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    $$('button', g).forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    g.dispatchEvent(new CustomEvent('segchange', { detail: b.dataset.v }));
  })));
  const fillRange = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
  $$('input[type=range]').forEach(r => { fillRange(r); r.addEventListener('input', () => fillRange(r)); });

  /* Dubai clock */
  const clk = $('.js-clock');
  if (clk) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const tick = () => (clk.textContent = f.format(new Date()));
    tick(); setInterval(tick, 1000);
  }

  /* =====================================================
     DUBAI SKYLINE GEOMETRY (shared with the hero particles)
     ===================================================== */
  const TOWERS = [
    [0.05, 0.04, 0.2, 'r'], [0.105, 0.05, 0.36, 'sail'], [0.165, 0.03, 0.27, 'r'], [0.205, 0.04, 0.4, 'slant'],
    [0.255, 0.028, 0.3, 'r'], [0.305, 0.052, 0.56, 'omniyat'], [0.36, 0.03, 0.34, 'r'], [0.405, 0.04, 0.44, 'taper'],
    [0.5, 0.075, 0.95, 'burj'], [0.59, 0.034, 0.46, 'r'], [0.635, 0.03, 0.37, 'slant'], [0.69, 0.06, 0.55, 'frame'],
    [0.75, 0.03, 0.31, 'r'], [0.795, 0.04, 0.45, 'taper'], [0.845, 0.034, 0.35, 'slant'], [0.9, 0.05, 0.28, 'r'], [0.955, 0.034, 0.23, 'r']
  ];
  // W: width of the skyline, ground: baseline y, S: height of a 1.0 tower
  function skylineD(W, ground, S) {
    let d = '';
    const P = pts => { d += 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z'; };
    TOWERS.forEach(([cx, fw, fh, k]) => {
      const w = fw * W, c = cx * W, x0 = c - w / 2, x1 = x0 + w, h = fh * S, top = ground - h, g = ground;
      if (k === 'r') P([[x0, g], [x0, top], [x1, top], [x1, g]]);
      else if (k === 'slant') P([[x0, g], [x0, top], [x1, top + h * 0.12], [x1, g]]);
      else if (k === 'taper') P([[x0, g], [x0, top + h * 0.2], [c, top], [x1, top + h * 0.2], [x1, g]]);
      else if (k === 'sail') { d += `M${x0.toFixed(1)} ${g}L${x0.toFixed(1)} ${top.toFixed(1)}Q${(x1 + w * 0.5).toFixed(1)} ${(top + h * 0.3).toFixed(1)} ${x1.toFixed(1)} ${g}Z`; P([[x0 - 2, top], [x0 + 2, top], [x0, top - h * 0.12]]); }
      else if (k === 'omniyat') {
        // One by Omniyat: black slab, lighter glass box cantilevered off the face at 78-90% of the height
        const yb = g - h * 0.78, yt = g - h * 0.9, o = w * 0.3;
        P([[x0, g], [x0, yb], [x0 - o, yb], [x0 - o, yt], [x0, yt], [x0, top], [x1, top], [x1, g]]);
        d += `M${x0.toFixed(1)} ${yt.toFixed(1)}H${(x0 + w * 0.7).toFixed(1)}V${yb.toFixed(1)}H${x0.toFixed(1)}`;
      }
      else if (k === 'frame') P([[x0, g], [x0, top], [x1, top], [x1, g], [x1 - w * 0.24, g], [x1 - w * 0.24, top + h * 0.14], [x0 + w * 0.24, top + h * 0.14], [x0 + w * 0.24, g]]);
      else if (k === 'burj') {
        const tiers = [1, 0.74, 0.54, 0.38, 0.25, 0.15], th = (h * 0.78) / tiers.length, L = [], R = [];
        tiers.forEach((t, i) => { const yb = g - th * i, yt = yb - th, hw = (w * t) / 2; L.push([c - hw, yb], [c - hw, yt]); R.unshift([c + hw, yt], [c + hw, yb]); });
        P([...L, [c - w * 0.03, g - h * 0.78], [c, top], [c + w * 0.03, g - h * 0.78], ...R]);
      }
    });
    return d;
  }
  // sample n points (sorted left to right) from whatever drawFn paints
  function samplePoints(drawFn, w, h, n) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; drawFn(x);
    const data = x.getImageData(0, 0, c.width, c.height).data, pts = [];
    const step = Math.max(1, Math.floor(Math.sqrt((c.width * c.height) / (n * 12))));
    for (let y = 0; y < c.height; y += step) for (let i = 0; i < c.width; i += step) if (data[(y * c.width + i) * 4 + 3] > 128) pts.push([i + Math.random() * step, y + Math.random() * step]);
    for (let i = pts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
    const out = []; for (let i = 0; i < n; i++) out.push(pts[i % (pts.length || 1)] || [w / 2, h / 2]);
    return out.sort((a, b) => a[0] - b[0]);
  }

  /* footer skyline: drawn in Drafting Line as it comes into view; One by Omniyat carries the single lit 603 window */
  const drawLine = (path, dur) => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len; path.style.strokeDashoffset = reduce ? 0 : len;
    path.style.fillOpacity = reduce ? '.9' : '0';
    const go = () => {
      path.style.transition = `stroke-dashoffset ${dur}s cubic-bezier(.16,1,.3,1), fill-opacity 1.2s ease ${dur * 0.6}s`;
      path.style.strokeDashoffset = 0; path.style.fillOpacity = '.9';
    };
    if (reduce) return;
    new IntersectionObserver((en, ob) => { if (en[0].isIntersecting) { go(); ob.disconnect(); } }, { threshold: 0.1 }).observe(path.closest('svg'));
  };
  const fsky = $('.foot__sky path');
  if (fsky) {
    fsky.setAttribute('d', skylineD(1600, 358, 300));
    const om = TOWERS.find(t => t[3] === 'omniyat'), win = $('.foot__sky .w603'), glow = $('.foot__sky .w603g');
    if (om && win && glow) {
      const w = om[1] * 1600, x1 = om[0] * 1600 + w / 2, wy = 358 - om[2] * 300 * 0.42; // the face toward the Burj, clear of the legal strip
      const wx = x1 - w * 0.34;
      win.setAttribute('x', wx.toFixed(1)); win.setAttribute('y', (wy - 4).toFixed(1));
      glow.setAttribute('cx', (wx + 3.5).toFixed(1)); glow.setAttribute('cy', (wy - 2).toFixed(1));
    }
    if (reduce || !hasGsap || !window.ScrollTrigger) { fsky.style.fillOpacity = '.94'; const f = $('.foot'); if (f) f.classList.add('is-lit'); }
  }
  const csky = $('#cover-sky');
  if (csky) csky.setAttribute('d', skylineD(400, 140, 130));

  /* =====================================================
     NYLA · scripted WhatsApp-style assistant (simulation)
     ===================================================== */
  const NYLA = (() => {
    const root = $('#nyla'); if (!root) return null;
    const msgs = $('.nyla__msgs', root), quick = $('.nyla__quick', root), bar = $('.nyla__bar', root), input = $('#nyla-input');
    const launch = $('.nyla-launch'), teaser = $('.nyla-teaser');
    const html = document.documentElement;
    const DELAY = reduce ? 200 : 850;
    let state = {}, plan = [], expecting = null, started = false, done = false, queue = Promise.resolve(), langNoted = false, run = 0;

    const now = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const toBottom = () => { msgs.scrollTop = msgs.scrollHeight; };
    const add = (inner, who, opts = {}) => {
      const d = document.createElement('div');
      d.className = 'msg msg--' + who + (opts.card ? ' msg--card' : '');
      if (opts.lang) { d.lang = opts.lang; if (opts.dir) d.dir = opts.dir; }
      d.innerHTML = inner + (who === 'sys' ? '' : `<time>${now()}</time>`);
      msgs.appendChild(d); toBottom();
      return d;
    };
    const typing = ms => new Promise(res => {
      const t = document.createElement('div'); t.className = 'typing'; t.setAttribute('aria-label', 'NYLA is typing');
      t.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(t); toBottom();
      setTimeout(() => { t.remove(); res(); }, ms);
    });
    const bot = (inner, opts = {}) => {
      const my = run;
      queue = queue.then(() => my === run ? typing(opts.wait || DELAY + Math.min(900, inner.length * 6)) : null)
                   .then(() => { if (my === run) add(inner, opts.sys ? 'sys' : 'bot', opts); });
      return queue;
    };
    const setQuick = (items) => {
      quick.innerHTML = '';
      items.forEach(it => {
        const el = document.createElement(it.href ? 'a' : 'button');
        if (it.href) el.href = it.href; else el.type = 'button';
        el.textContent = it.label;
        if (it.onClick) el.addEventListener('click', it.onClick);
        quick.appendChild(el);
      });
    };
    const first = () => (state.name || '').trim().split(/\s+/)[0] || '';

    const STEPS = {
      goal: { q: 'What brings you to Dubai property?', opts: ['Buy to live', 'Invest for yield', 'Off-plan', 'Golden Visa'],
        ack: v => ({ 'Buy to live': 'Lovely. I will focus on communities, schools and the true cost of moving in.',
                     'Invest for yield': 'Smart. I will show you net yield, after service charges, not just the headline number.',
                     'Off-plan': 'Good. Every project we suggest comes with a due diligence scorecard.',
                     'Golden Visa': 'Noted. Property worth AED 2M or more can support a 10-year Golden Visa application, and we guide you through it.' }[v]) },
      budget: { q: 'What budget are you working with?', opts: ['Under AED 2M', 'AED 2–5M', 'AED 5–10M', 'AED 10M+'],
        ack: v => (state.goal === 'Golden Visa' && v === 'Under AED 2M') ? 'Worth knowing: the Golden Visa property route starts at AED 2M in value. Your advisor can show options close to that line.' : null },
      timeline: { q: 'And your timeline?', opts: ['This month', '1–3 months', '3–6 months', 'Just researching'],
        ack: v => v === 'Just researching' ? 'No rush at all. I can send you the weekly Market Pulse in the meantime.' : null },
      finance: { q: 'Will you pay cash or use a mortgage?', opts: ['Cash', 'Mortgage', 'Not sure yet'],
        ack: v => v === 'Mortgage' ? 'I will include mortgage registration and bank fees in your numbers.' : (v === 'Not sure yet' ? 'We can model both, side by side.' : null) },
      name: { q: 'What name should your advisor use?', free: 'Type your name' },
      whatsapp: { q: () => `Thanks${first() ? ', ' + esc(first()) : ''}. And the best WhatsApp number to reach you?`, free: '+971 50 000 0000',
        valid: waOk, retry: 'Could you add it with the country code? For example +971 50 123 4567.' }
    };
    const LABELS = { goal: 'Looking to', budget: 'Budget', timeline: 'Timeline', finance: 'Payment', name: 'Name', whatsapp: 'WhatsApp', notes: 'Notes' };
    const norm = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const matchOpt = (opts, v) => { const n = norm(v); return opts.find(o => norm(o) === n) || (n.length >= 3 ? opts.find(o => norm(o).startsWith(n)) : null) || null; };

    function askNext() {
      const key = plan.find(k => !state[k]);
      if (!key) return finish();
      const s = STEPS[key];
      expecting = key;
      bot(typeof s.q === 'function' ? s.q() : s.q).then(() => {
        if (expecting !== key) return;
        input.placeholder = s.free || 'Or type your answer';
        setQuick((s.opts || []).map(o => ({ label: o, onClick: () => answer(o) })));
        if (s.free && finePointer) input.focus();
      });
    }
    function answer(v) {
      v = String(v).trim(); if (!v) return;
      if (done) { setQuick([]); add(esc(v), 'me'); bot('Thank you. Your advisor will pick this up on the call.'); return; }
      if (!expecting) return;
      const key = expecting, s = STEPS[key];
      setQuick([]); add(esc(v), 'me');
      if (s.valid && !s.valid(v)) { bot(s.retry).then(() => { input.placeholder = s.free; }); return; }
      if (s.opts) {
        const hit = matchOpt(s.opts, v);
        if (!hit) {
          /* free text at a multiple-choice step: keep it for the advisor, then ask again */
          state.notes = state.notes ? state.notes + ' · ' + v : v;
          expecting = null;
          bot("Noted, I'll pass that to your advisor.");
          askNext();
          return;
        }
        v = hit;
      }
      state[key] = v; expecting = null;
      const a = s.ack && s.ack(v);
      if (a) bot(a);
      askNext();
    }
    function finish() {
      done = true; expecting = null; input.placeholder = 'Type a message';
      const rows = Object.keys(LABELS).filter(k => state[k]).map(k => `<li><span>${LABELS[k]}</span><b>${esc(state[k])}</b></li>`).join('');
      bot(`<strong>Your brief</strong><ul>${rows}</ul>`, { card: true });
      bot('An advisor has been notified and will call you shortly, usually within minutes during business hours.');
      bot('Preview: nothing was sent. Live, this runs on WhatsApp and the brief lands in the team\'s CRM.', { sys: true, wait: 400 }).then(() => {
        const onCalc = !!document.getElementById('calculator');
        setQuick([
          onCalc ? { label: 'See my true cost', onClick: () => { close(); const t = document.querySelector('.results') || document.getElementById('calculator'); if (t) scrollTo(t); } }
                 : { label: 'See my true cost', href: 'true-cost-calculator.html' },
          { label: 'Off-plan scorecard', href: 'off-plan-scorecard.html' },
          { label: 'Start over', onClick: () => restart() }
        ]);
      });
    }
    function reset() {
      run++; queue = Promise.resolve();
      msgs.innerHTML = '<p class="nyla__day">Today</p>'; setQuick([]);
      state = {}; expecting = null; done = false; started = true; langNoted = false;
      $$('.nyla__langs button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === 'en')));
    }
    function restart() {
      reset();
      plan = ['goal', 'budget', 'timeline', 'finance', 'name', 'whatsapp'];
      bot(`Hi, I'm NYLA, ${BRS}'s assistant. I reply instantly, day or night, in your language.`, { wait: reduce ? 150 : 600 });
      askNext();
    }

    function brochure(ctx) {
      reset();
      state.notes = 'Brochure: ' + ctx;
      plan = ['goal', 'budget', 'timeline', 'name', 'whatsapp'];
      add(esc('Please send me the brochure for ' + ctx), 'me');
      bot(`Of course. I've noted <strong>${esc(ctx)}</strong>. Renders, floor plans and the current payment plan go out on WhatsApp once an advisor confirms the latest release.`);
      bot('Preview: nothing was sent. Live, the brochure goes out on WhatsApp within minutes.', { sys: true, wait: 300 });
      bot('A few quick questions so the right advisor sends it.', { wait: 500 });
      askNext();
    }
    function open(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (html.classList.contains('menu-open')) toggleMenu(false);
      html.classList.add('nyla-open');
      root.setAttribute('aria-hidden', 'false');
      if (teaser) teaser.classList.remove('is-on');
      store.set('lh-nyla-seen', '1');
      const ctx = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.nylaCtx : '';
      if (ctx) brochure(ctx);
      else if (!started) restart();
      setTimeout(() => (finePointer ? input : $('.nyla__close', root)).focus({ preventScroll: true }), 120);
    }
    function close() {
      html.classList.remove('nyla-open');
      root.setAttribute('aria-hidden', 'true');
      launch && launch.focus({ preventScroll: true });
    }
    root.setAttribute('aria-hidden', 'true');
    $$('[data-nyla-open]').forEach(b => b.addEventListener('click', open));
    $('.nyla__close', root).addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && html.classList.contains('nyla-open')) close(); });
    bar.addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; answer(v); });

    /* language chips: one greeting line in the chosen language */
    const GREET = {
      en: { t: `Hi, I'm NYLA, ${BRS}'s assistant. I reply instantly, day or night, in your language.` },
      ar: { t: `مرحباً، أنا نايلا، مساعدة ${BRS}. أرد فوراً، ليلاً ونهاراً، وبلغتك.`, dir: 'rtl' },
      ru: { t: `Здравствуйте, я NYLA, ассистент ${BRS}. Отвечаю мгновенно, днём и ночью, на вашем языке.` },
      hi: { t: `नमस्ते, मैं NYLA हूँ, ${BRS} की सहायक। दिन हो या रात, मैं तुरंत आपकी भाषा में जवाब देती हूँ।` },
      zh: { t: `您好，我是 NYLA，${BRS} 的助理。无论白天黑夜，我都会用您的语言即时回复。` }
    };
    $$('.nyla__langs button', root).forEach(b => b.addEventListener('click', () => {
      $$('.nyla__langs button', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const g = GREET[b.dataset.lang];
      bot(esc(g.t), { lang: b.dataset.lang, dir: g.dir, wait: reduce ? 150 : 500 });
      if (b.dataset.lang !== 'en' && !langNoted) {
        langNoted = true;
        bot('Preview shows the greeting only. Live, NYLA carries the whole conversation in the language you choose.', { sys: true, wait: 300 });
      }
    }));

    /* teaser bubble: at most once per session, never over a form, gone after 8 seconds */
    if (teaser) {
      let due = false, hideT = null;
      const formsOnScreen = new Set();
      const hideTeaser = () => { teaser.classList.remove('is-on'); clearTimeout(hideT); };
      const tryShow = () => {
        if (!due || formsOnScreen.size || html.classList.contains('nyla-open') || html.classList.contains('menu-open')) return;
        const a = document.activeElement;
        if (a && a.closest && a.closest('form') && a.matches('input,select,textarea')) return;
        due = false;
        store.set('lh-nyla-seen', '1');
        teaser.classList.add('is-on');
        hideT = setTimeout(hideTeaser, 8000);
      };
      $('button', teaser).addEventListener('click', e => { e.stopPropagation(); hideTeaser(); store.set('lh-nyla-seen', '1'); });
      teaser.addEventListener('click', open);
      const fo = new IntersectionObserver(en => {
        en.forEach(x => (x.isIntersecting ? formsOnScreen.add(x.target) : formsOnScreen.delete(x.target)));
        if (formsOnScreen.size) hideTeaser(); else tryShow();
      }, { threshold: 0 });
      $$('.form, .leadgrid, .sendbox, .ctaband').forEach(f => fo.observe(f));
      /* on phones the journey copy fills the screen, so the teaser waits until the pin is over */
      const journey = $('.journey');
      if (journey && matchMedia('(max-width: 760px)').matches) fo.observe(journey);
      document.addEventListener('focusin', e => { if (e.target.closest && e.target.closest('form') && e.target.matches('input,select,textarea')) hideTeaser(); });
      document.addEventListener('focusout', () => setTimeout(tryShow, 50));
      if (!store.get('lh-nyla-seen')) setTimeout(() => { if (!store.get('lh-nyla-seen')) { due = true; tryShow(); } }, 7000);
    }

    /* opened from a lead form, pre-filled with the answers */
    function fromForm(type, d, ctx = {}) {
      reset();
      state.name = d.name; state.whatsapp = d.whatsapp;
      const f = esc(first()), wa = esc(d.whatsapp), em = esc(d.email);
      if (type === 'contact') {
        state.goal = d.intent; state.budget = d.budget; state.timeline = d.timeline;
        add(esc(`Buying plan request: ${d.intent} · ${d.budget} · ${d.timeline}`), 'me');
        bot(`Thanks ${f}, I have your brief: <strong>${esc(d.intent)}</strong>, ${esc(d.budget)}, ${esc(d.timeline.toLowerCase())}. I have shared it with an advisor.`);
        plan = ['finance'];
      } else if (type === 'calculator') {
        state.budget = ctx.price ? aed(ctx.price) : null; state.finance = ctx.pay;
        add('Please send me my true-cost breakdown', 'me');
        bot(`Thanks ${f}, I've sent your true-cost breakdown to your WhatsApp (${wa}) and a PDF copy to ${em}.`);
        if (ctx.price) bot(`<strong>Your estimate</strong><ul><li><span>Price</span><b>${aed(ctx.price)}</b></li><li><span>Purchase costs</span><b>${aed(ctx.fees)}</b></li><li><span>Cash needed upfront</span><b>${aed(ctx.upfront)}</b></li><li><span>Net yield</span><b>${ctx.net}</b></li></ul>`, { card: true });
        plan = ['goal', 'timeline'];
      } else if (type === 'community') {
        add('Please send me the full Business Bay report', 'me');
        bot(`Thanks ${f}, the full Business Bay report is on its way to your WhatsApp and ${em}.`);
        plan = ['goal', 'budget', 'timeline'];
      } else if (type === 'scorecard') {
        state.goal = 'Off-plan';
        add(esc(`Scorecard request: ${d.project}`), 'me');
        bot(`Thanks ${f}, I've logged a scorecard request for <strong>${esc(d.project)}</strong>. We check the RERA and escrow registers, the developer's delivery record and the payment plan, then send it to your WhatsApp.`);
        plan = ['budget', 'timeline'];
      } else if (type === 'report') {
        add('Please send me the Prime Market Report, Q3 2026 Review', 'me');
        bot(`Thanks ${f}, your Dubai Prime Market Report, Q3 2026 Review is on its way to your WhatsApp and ${em}.`);
        plan = ['goal', 'timeline'];
      }
      bot('Preview: nothing was sent. Live, this message goes out on WhatsApp and email.', { sys: true, wait: 300 });
      const left = plan.filter(k => !state[k]).length;
      if (left) bot(`${left === 1 ? 'One quick question' : left === 2 ? 'Two quick questions' : 'A few quick questions'} so your advisor calls you fully prepared.`, { wait: 500 });
      html.classList.add('nyla-open'); root.setAttribute('aria-hidden', 'false');
      if (teaser) teaser.classList.remove('is-on');
      store.set('lh-nyla-seen', '1');
      askNext();
    }
    return { open, close, fromForm, answer, get state() { return state; } };
  })();

  /* =====================================================
     LEAD FORMS · validate, then hand over to NYLA
     ===================================================== */
  $$('form[data-lead]').forEach(form => {
    const consentLabel = $('.consent', form);
    let consentErr = null;
    if (consentLabel) { consentErr = document.createElement('em'); consentErr.className = 'field__err full'; consentLabel.after(consentErr); }
    const setErr = (el, msg) => {
      const field = el.closest('.field');
      if (field) { field.classList.toggle('is-bad', !!msg); const e = $('.field__err', field); if (e) e.textContent = msg || ''; }
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    $$('input', form).forEach(el => el.addEventListener('input', () => setErr(el, '')));
    $$('select', form).forEach(el => el.addEventListener('change', () => setErr(el, '')));
    const chipErr = (g, msg) => { const f = g.closest('.field'); if (!f) return; f.classList.toggle('is-bad', !!msg); const e = $('.field__err', f); if (e) e.textContent = msg || ''; };
    $$('[data-chips]', form).forEach(g => $$('.chip', g).forEach(c => c.addEventListener('click', () => chipErr(g, ''))));
    if (consentLabel) $('input', consentLabel).addEventListener('change', () => { consentLabel.classList.remove('is-bad'); consentErr.textContent = ''; });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = {}; let firstBad = null;
      $$('input[name], select[name]', form).forEach(el => { d[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
      $$('[data-chips]', form).forEach(g => { const on = $('[aria-pressed=true]', g); d[g.dataset.chips] = on ? on.textContent : ''; });
      const bad = (name, msg) => { const el = $(`[name="${name}"]`, form); setErr(el, msg); if (msg && !firstBad) firstBad = el; };
      if ('project' in d) bad('project', d.project.length < 2 ? 'Which project should we score?' : '');
      bad('name', d.name.length < 2 ? 'Please add your name.' : '');
      bad('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email) ? '' : 'Please add a valid email.');
      bad('whatsapp', waOk(d.whatsapp) ? '' : 'Please add a WhatsApp number with country code, e.g. +971 50 123 4567.');
      $$('[data-chips][data-required]', form).forEach(g => { const miss = !d[g.dataset.chips]; chipErr(g, miss ? g.dataset.required : ''); if (miss && !firstBad) firstBad = $('.chip', g); });
      $$('select[required]', form).forEach(el => bad(el.name, el.value ? '' : 'Please choose one.'));
      if (consentLabel && !$('input', consentLabel).checked) {
        consentLabel.classList.add('is-bad');
        consentErr.textContent = 'Please tick the box so we can send this to you.';
        if (!firstBad) firstBad = $('input', consentLabel);
      }
      if (firstBad) { firstBad.focus(); return; }
      form.classList.add('is-done');
      const ctx = (window.LH && window.LH.leadContext && window.LH.leadContext[form.dataset.lead]) ? window.LH.leadContext[form.dataset.lead]() : {};
      if (NYLA) NYLA.fromForm(form.dataset.lead, d, ctx);
    });
  });

  window.LH = Object.assign(window.LH || {}, { $, $$, reduce, finePointer, fmt, aed, esc, lenis, skylineD, samplePoints, scrollTo, NYLA, leadContext: (window.LH && window.LH.leadContext) || {} });
  if (hasGsap && window.ScrollTrigger) window.addEventListener('load', () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
})();
