/* Home hero · Dubai skyline drawn in copper light, morphing into the LUXE HAVEN wordmark.
   Ported from the concept demo's particle scene; the skyline forms on load and the
   wordmark forms as you scroll through the pinned hero. */
(() => {
  const LH = window.LH || {};
  const cv = document.querySelector('.hero__cv');
  if (!cv || !LH.skylineD) return;
  const { skylineD, samplePoints, reduce } = LH;
  const hasGsap = typeof window.gsap !== 'undefined';
  const ctx = cv.getContext('2d');
  const COLS = ['rgb(226,170,120)', 'rgb(243,220,192)', 'rgb(196,128,84)'];
  const SKY = 0.54; // progress at which the skyline is fully formed
  let W = 0, H = 0, dpr = 1, P = [], prog = 0, intro = { v: 0 }, scrollP = 0, visible = true, mx = -9999, my = -9999, builtW = 0, small = false, dot = 1;
  const caption = document.querySelector('.hero__caption');
  const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  /* phones: the wordmark stacks as LUXE / HAVEN at about 80% of the width; returns its bottom edge */
  function wordmark(x, w, h) {
    if (w < 600) {
      let fs = w * 0.3;
      x.font = `800 ${fs}px Manrope, system-ui, sans-serif`;
      const m = x.measureText('HAVEN').width || 1;
      fs *= (w * 0.8) / m;
      x.font = `800 ${fs}px Manrope, system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      const lh = fs * 1.02, cy = h * 0.42;
      x.fillText('LUXE', w / 2, cy - lh / 2);
      x.fillText('HAVEN', w / 2, cy + lh / 2);
      return cy + lh / 2 + fs * 0.42;
    }
    let fs = Math.min(w * 0.16, h * 0.3);
    x.font = `800 ${fs}px Manrope, system-ui, sans-serif`;
    const m = x.measureText('LUXE HAVEN').width || 1;
    fs *= Math.min(1, (w * 0.84) / m);
    x.font = `800 ${fs}px Manrope, system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('LUXE HAVEN', w / 2, h * 0.45);
    return h * 0.45 + fs * 0.42;
  }
  function placeCaption(w, h) {
    if (!caption) return;
    if (!small) { caption.style.top = ''; caption.style.bottom = ''; return; }
    const c = document.createElement('canvas').getContext('2d');
    const bottom = wordmark(c, w, h);
    caption.style.top = Math.round(bottom + 40) + 'px';
    caption.style.bottom = 'auto';
  }
  function build() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.offsetWidth, h = cv.offsetHeight; if (!w || !h) return;
    builtW = w;
    W = cv.width = Math.round(w * dpr); H = cv.height = Math.round(h * dpr);
    small = w < 600; dot = small ? 1.5 : 1;
    const n = Math.round(Math.min(6000, Math.max(small ? 3400 : 2000, (w * h) / 200)));
    const desk = w >= 900;
    const sk = samplePoints(x => {
      /* desktop: the skyline sits right of the text column and ends inside the page gutter */
      if (desk) { x.translate(w * 0.52, 0); x.fill(new Path2D(skylineD(w * 0.45, h * 0.94, h * 0.76))); }
      else x.fill(new Path2D(skylineD(w, h * 0.975, h * 0.32)));
    }, w, h, n);
    const tx = samplePoints(x => wordmark(x, w, h), w, h, n);
    P = sk.map((s, i) => ({ sx: Math.random() * w, sy: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, kx: s[0], ky: s[1], tx: tx[i][0], ty: tx[i][1], dl: Math.random(), ox: 0, oy: 0, tw: Math.random() * 6.28, c: i % 3 }));
    P.sort((a, b) => a.c - b.c);
    placeCaption(w, h);
    if (reduce) { prog = SKY; draw(true); }
  }
  // the wordmark font may arrive after the first build: re-aim the particles, keep their positions
  function retarget() {
    const w = cv.offsetWidth, h = cv.offsetHeight; if (!P.length || !w) return;
    const tx = samplePoints(x => wordmark(x, w, h), w, h, P.length);
    const order = P.map((p, i) => i).sort((a, b) => P[a].kx - P[b].kx);
    order.forEach((pi, j) => { P[pi].tx = tx[j][0]; P[pi].ty = tx[j][1]; });
    placeCaption(w, h);
  }

  function draw(still) {
    if (!P.length) return;
    const target = still ? SKY : Math.max(intro.v, scrollP > 0.001 ? SKY + (1 - SKY) * scrollP : 0);
    prog = still ? target : prog + (target - prog) * 0.09;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const w = W / dpr, h = H / dpr, R = 110;
    let col = -1;
    for (const p of P) {
      if (!still) {
        p.sx += p.vx; p.sy += p.vy;
        if (p.sx < 0 || p.sx > w) p.vx *= -1;
        if (p.sy < 0 || p.sy > h) p.vy *= -1;
      }
      const a = ease((prog - 0.03 - p.dl * 0.2) / 0.3), b = ease((prog - 0.56 - p.dl * 0.14) / 0.26);
      let x = p.sx + (p.kx - p.sx) * a, y = p.sy + (p.ky - p.sy) * a;
      x += (p.tx - x) * b; y += (p.ty - y) * b;
      if (!still) {
        const dx = x + p.ox - mx, dy = y + p.oy - my, d2 = dx * dx + dy * dy;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 6; p.ox += (dx / d) * f; p.oy += (dy / d) * f; }
        p.ox *= 0.9; p.oy *= 0.9; p.tw += 0.05;
      }
      const set = Math.max(a, b);
      if (p.c !== col) { col = p.c; ctx.fillStyle = COLS[col]; }
      ctx.globalAlpha = Math.max(0.08, 0.3 + 0.6 * set + Math.sin(p.tw) * 0.16);
      const s = (1.2 + set * 0.6) * dpr * dot;
      ctx.fillRect((x + p.ox) * dpr, (y + p.oy) * dpr, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  LH.hero = { get prog() { return prog; }, get n() { return P.length; } };
  function loop() { requestAnimationFrame(loop); if (visible) draw(false); }

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  let settled = false;
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1200))]).then(() => {
    settled = true;
    build();
    if (reduce) return;
    fontsReady.then(retarget);
    new IntersectionObserver(en => { visible = en[en.length - 1].isIntersecting; }).observe(cv);
    window.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; }, { passive: true });
    cv.parentElement.addEventListener('pointerleave', () => { mx = my = -9999; });
    requestAnimationFrame(loop);

    if (hasGsap) {
      gsap.to(intro, { v: SKY, duration: 3, ease: 'power2.out', delay: 0.15 });
      gsap.from('.hero__title .line > span', { yPercent: 115, rotate: 2, duration: 1.3, ease: 'expo.out', stagger: 0.1, delay: 0.2 });
      gsap.from('.hero__eyebrow, .hero__sub, .hero__ctas, .hero__proof', { opacity: 0, y: 24, duration: 1.1, ease: 'power3.out', stagger: 0.1, delay: 0.45 });
      gsap.from('.nav > *', { opacity: 0, y: -16, duration: 1, ease: 'power3.out', stagger: 0.06, delay: 0.2 });
      if (window.ScrollTrigger) {
        const desk = () => window.innerWidth >= 900;
        gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: '.hero', start: 'top top', end: () => '+=' + Math.round(window.innerHeight * (desk() ? 0.95 : 0.7)), pin: true, scrub: 0.6, invalidateOnRefresh: true, onUpdate: s => { scrollP = s.progress; } }
        })
          .to('.hero__copy', { opacity: 0, y: -70, duration: 0.32, ease: 'power2.in' }, 0)
          .to('.hero__veil', { opacity: 0.35, duration: 0.4 }, 0)
          .fromTo('.hero__caption', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.18 }, 0.76)
          .to({}, { duration: 0.06 }, 0.94);
        ScrollTrigger.refresh();
      }
    } else {
      intro.v = SKY;
    }
  });

  let rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => { if (settled && Math.abs(cv.offsetWidth - builtW) > 40) build(); }, 250);
  });
})();
