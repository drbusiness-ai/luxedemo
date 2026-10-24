/* AS BUILT · journey entry (module). Capability gate, the pinned journey, the DOM copy timeline
   (SplitText line masks scrubbed by pS), the chapter rail and fallbacks, then the WebGL scene is
   imported on idle. window.LHScene is a facade from the first moment; scene.js fills it in. */
const html = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const journey = $('.journey');
const canvas = $('canvas.stage');
const qs = new URLSearchParams(location.search);
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = !!(window.gsap && window.ScrollTrigger);
if (hasGsap && window.SplitText) gsap.registerPlugin(SplitText);

/* chapters (kept in sync with journey/timeline.js; duplicated so the DOM never waits for three.js).
   beats: copy windows in p. show/hide are [from, to]; ch01 is on screen from the first paint. */
const CH = [
  { id: '01', start: 0.00, hold: [0.00, 0.05], end: 0.10, accent: '#A9C8FF', beats: [{ show: null, hide: [0.07, 0.096] }] },
  { id: '02', start: 0.10, hold: [0.14, 0.19], end: 0.20, accent: '#EDB8B0', beats: [{ show: [0.128, 0.15], hide: [0.188, 0.204] }] },
  { id: '03', start: 0.20, hold: [0.33, 0.40], end: 0.40, accent: '#FFC66E', beats: [{ show: [0.284, 0.324], hide: [0.397, 0.411], scan: true }] },
  { id: '04', start: 0.40, hold: [0.42, 0.47], end: 0.54, accent: '#E07AA6', beats: [{ show: [0.412, 0.434], hide: [0.479, 0.495] }] },
  { id: '05', start: 0.54, hold: [0.56, 0.61], end: 0.76, accent: '#FFB35C', beats: [{ sel: '.ch__beat--a', show: [0.556, 0.576], hide: [0.636, 0.652], dwell: 0.585 }, { sel: '.ch__beat--b', show: [0.662, 0.69], hide: [0.75, 0.766], dwell: 0.73 }] },
  { id: '06', start: 0.76, hold: [0.92, 1.00], end: 1.00, accent: '#A9C8FF', beats: [{ show: [0.86, 0.888], hide: null }] }
];
const chapterOf = p => { for (let i = CH.length - 1; i >= 0; i--) if (p >= CH[i].start - 1e-6) return i; return 0; };
const dwellOf = (i, b = 0) => { const c = CH[i]; const bt = c.beats[b] || c.beats[0]; return bt.dwell !== undefined ? bt.dwell : i === 0 ? 0.02 : (c.hold[0] + c.hold[1]) / 2; };

/* ---------- facade: QA can await LHScene.ready even before three.js arrives ---------- */
let resolveReady, rejectReady;
const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
ready.catch(() => {});
let introSeen = false;
try { introSeen = sessionStorage.getItem('lh-intro') === '1'; } catch (e) { /* storage blocked */ }
const J = {
  canvas, qs, target: 0, base: new URL('../../', import.meta.url).href,
  portrait: innerWidth / innerHeight < 0.8,
  copyRect: { x: 0, y: 0, z: 0.42, w: 1 },
  preserve: qs.has('preserve') || navigator.webdriver === true,
  introSkip: reduce || qs.has('nointro') || qs.has('p') || introSeen || window.scrollY > innerHeight * 0.05
};
const LHScene = window.LHScene = {
  ready, chapters: CH.map(c => ({ id: c.id, start: c.start, holdStart: c.hold[0], holdEnd: c.hold[1], end: c.end })),
  /* QA: each copy beat's reveal (show) and exit (hide) windows in p */
  copyWindows: CH.map(c => ({ id: c.id, beats: c.beats.map(b => ({ sel: b.sel || null, show: b.show, hide: b.hide })) })),
  setProgress(p) { scrollToProgress(p); setDom(p); return p; },
  renderOnce() {}, setTime() {}, setIntro() {}, skipIntro() {}, setCursor() {}, setLens() {}, resetTouched() {},
  showcase() {}, setQuality() {}, setDate() {}, setScale() {},
  posterMode(on) { setPosterMode(on); },
  pose() { return null; }, info() { return { tier: 'none' }; },
  /* QA: the copy scrim rect the post pass reads (viewport fractions) */
  scrimRect() { return Object.assign({}, J.copyRect); }
};

/* ---------- capability gate ---------- */
function gate() {
  if (!journey || !canvas) return 'none';
  if (reduce) return 'static';
  if (!hasGsap) return 'static';
  const conn = navigator.connection;
  if ((conn && conn.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2) || qs.get('tier') === 'poster') return 'poster';
  try { const t = document.createElement('canvas').getContext('webgl2'); if (!t) return 'poster'; const lose = t.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e) { return 'poster'; }
  return 'live';
}
const mode = gate();
html.classList.add('jr-' + mode);

/* ---------- DOM copy timeline: SplitText line masks, scrubbed by pS (never the raw scroll) ---------- */
let tl = null, lastDom = -1, splits = [], built = false, scanKeys = null;
const chEls = $$('.journey .ch');
const caption = $('.journey__caption');
const titleblock = $('.journey__titleblock');
const railBtns = $$('.journey__rail button');
const UNIT_SEL = '.ch__eyebrow, .ch__label, .ch__serif, .ch__display, .ch__body, .ch__ctas, .ch__readout, .ch__chips, .ch__micro';
const LINE_SEL = '.ch__serif, .ch__display, .ch__body';
/* one live target per beat: its opacity decides pointer events (hidden CTAs stay focusable for keyboard users) */
const beats = [];
CH.forEach((c, i) => c.beats.forEach((b, k) => {
  const art = chEls[i]; if (!art) return;
  const root = b.sel ? $(b.sel, art) : art;
  beats.push({ ch: i, k, b, art, root, units: [] });
}));

function splitAll() {
  splits.forEach(s => { try { s.revert(); } catch (e) { /* already reverted */ } });
  splits = [];
  beats.forEach(bt => {
    bt.units = $$(UNIT_SEL, bt.root).map(el => {
      if (el.matches(LINE_SEL) && window.SplitText) {
        try { const s = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'ln' }); splits.push(s); return { kind: 'lines', el, els: s.lines }; } catch (e) { /* fall through */ }
      }
      return { kind: 'fade', el, els: [el] };
    });
  });
}

function buildTimeline() {
  if (!hasGsap || mode === 'static') return;
  if (tl) { tl.kill(); tl = null; }
  tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const EPS = 0.0015;
  chEls.forEach((el, i) => {
    const bs = CH[i].beats, first = bs[0], last = bs[bs.length - 1];
    if (first.show) tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: EPS, immediateRender: false }, first.show[0]);
    if (last.hide) tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: EPS, immediateRender: false }, last.hide[1] - EPS);
  });
  beats.forEach(bt => {
    const { b, root, units } = bt;
    const n = units.length;
    /* every unit carries its (identity) exit transform from the start: otherwise a unit gains an inline transform
       only once its exit has rendered, and the same p would rasterise its text differently before and after */
    units.forEach(u => gsap.set(u.el, { opacity: 1, y: 0 }));
    if (b.sel) {
      if (b.show) tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: EPS, immediateRender: false }, b.show[0]);
      if (b.hide) tl.fromTo(root, { opacity: 1 }, { opacity: 0, duration: EPS, immediateRender: false }, b.hide[1] - EPS);
    }
    if (b.show) {
      const [s0, s1] = b.show, D = s1 - s0;
      units.forEach((u, k) => {
        let at = s0 + D * 0.52 * (n > 1 ? k / (n - 1) : 0), dur = D * 0.48;
        if (b.scan && scanKeys && scanKeys[k] !== undefined) { at = scanKeys[k]; dur = 0.012; }
        if (u.kind === 'lines') tl.fromTo(u.els, { yPercent: 108 }, { yPercent: 0, duration: dur, ease: 'power3.out', stagger: Math.min(0.006, dur * 0.25), immediateRender: false }, at);
        else tl.fromTo(u.els, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: dur, ease: 'power2.out', immediateRender: false }, at);
      });
    }
    /* exits dissolve whole units (opacity + a short lift of the unit, masks included) instead of wiping the lines
       up through their masks: a scrubbed wipe parks the copy half-cut at the top whenever the scroll stops in it
       (ch05 at p 0.64-0.65 read as a clipping bug), a dissolve never shows cut letterforms at any p */
    if (b.hide) {
      const [h0, h1] = b.hide, D = h1 - h0;
      units.forEach((u, k) => {
        const at = h0 + D * 0.3 * (n > 1 ? k / (n - 1) : 0), dur = D * 0.7 - EPS;
        tl.fromTo(u.el, { opacity: 1, y: 0 }, { opacity: 0, y: -10, duration: dur, ease: 'power1.in', immediateRender: false }, at);
      });
    }
  });
  if (caption) tl.fromTo(caption, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.012, immediateRender: false }, 0.205);
  if (titleblock) {
    tl.fromTo(titleblock, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.02, immediateRender: false }, 0.075);
    tl.fromTo(titleblock, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03, immediateRender: false }, 0.9);
  }
  tl.set({}, {}, 1);
  built = true;
  const p = lastDom < 0 ? J.target : lastDom;
  lastDom = -1;
  setDom(p);
}
/* a chapter is live while any of its beats is (ch05 has two beats in one article: the article must
   carry .is-live too, or its .ch__in keeps pointer-events off and the beat CTAs cannot be clicked) */
/* runs every frame the DOM timeline moves: index loops and flags only, nothing allocated */
const artOn = new Array(chEls.length).fill(false);
function syncLive() {
  for (let i = 0; i < artOn.length; i++) artOn[i] = false;
  for (let i = 0; i < beats.length; i++) {
    const bt = beats[i];
    const on = +gsap.getProperty(bt.art, 'opacity') > 0.5 && (!bt.b.sel || +gsap.getProperty(bt.root, 'opacity') > 0.5);
    if (bt.live !== on) { bt.live = on; bt.root.classList.toggle('is-live', on); }
    if (on) artOn[bt.ch] = true;
  }
  for (let i = 0; i < chEls.length; i++) if (chEls[i].classList.contains('is-live') !== artOn[i]) chEls[i].classList.toggle('is-live', artOn[i]);
}
function setDom(p) {
  domP = p;
  if (tl && Math.abs(p - lastDom) > 1e-5) { tl.progress(Math.min(1, Math.max(0, p))); lastDom = p; syncLive(); }
  onChapter(chapterOf(p));
  /* ch05 carries two beats in one article: the scrim follows the beat on screen, re-measured only when it flips */
  if (curCh === 4) { const b = p >= 0.657 ? 1 : 0; if (b !== ch5Beat) { ch5Beat = b; measureCopy(); } } else ch5Beat = -1;
  if (guardLayers) guardPaint(p);
}
let ch5Beat = -1, domP = 0;

/* chapter 03: each copy unit unlocks once the scan has turned the world behind it real */
function keyToScan() {
  const bt = beats.find(x => x.b.scan);
  if (!bt || !LHScene.scanPass || !bt.units.length) return;
  const w = innerWidth, h = innerHeight;
  const pts = bt.units.map(u => {
    const r = (u.kind === 'lines' ? (u.els[0].parentElement || u.els[0]) : u.el).getBoundingClientRect();
    return [Math.min(0.99, Math.max(0.01, (r.left + 16) / w)), Math.min(0.99, Math.max(0.01, (r.top + r.height / 2) / h))];
  });
  const raw = LHScene.scanPass(pts);
  const [s0, s1] = bt.b.show;
  // keep the reveal order top to bottom, inside the chapter's window, at least 4 ms of scroll apart
  let prev = -1;
  scanKeys = raw.map((v, k) => { let at = Math.min(s1 - 0.012, Math.max(s0, v)); if (at < prev + 0.003) at = prev + 0.003; prev = at; return +at.toFixed(4); });
  J.scanKeys = { raw, keys: scanKeys };
  buildTimeline();
}

/* ---------- chapter change: rail, accent, aria-current, copy scrim rect, title block ---------- */
let curCh = -1;
function onChapter(i) {
  if (i === curCh) return;
  const prev = curCh;
  curCh = i;
  railBtns.forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  journey.style.setProperty('--accent', CH[i].accent);
  journey.dataset.ch = CH[i].id;
  if (titleblock) titleSwap(i === 5, prev >= 0 && (prev === 5) !== (i === 5));
  measureCopy();
}
/* STATUS: PROPOSED -> AS BUILT, DWG 01 -> DWG 02: the end state is a function of p, the scramble a 300 ms one-shot */
const GLYPHS = 'ABCDEFGHIJKLMNOPRSTUVXYZ0123456789/·';
function titleSwap(done, animate) {
  const s = $('[data-status]', titleblock), d = $('[data-dwg]', titleblock);
  const pairs = [[s, done ? 'As built' : 'Proposed'], [d, done ? 'DWG 02 · As built' : 'DWG 01 · Site plan']].filter(x => x[0]);
  if (!animate || !hasGsap || reduce) { pairs.forEach(([el, t]) => { el.textContent = t; }); return; }
  const st = { k: 0 };
  gsap.to(st, {
    k: 1, duration: 0.3, ease: 'none', overwrite: true,
    onUpdate() { pairs.forEach(([el, t]) => { const n = Math.floor(st.k * t.length); let o = t.slice(0, n); for (let j = n; j < t.length; j++) o += t[j] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]; el.textContent = o; }); },
    onComplete() { pairs.forEach(([el, t]) => { el.textContent = t; }); }
  });
}
function measureCopy() {
  const bt = beats.filter(x => x.ch === curCh);
  if (!bt.length) return;
  let box = $('.ch__in', bt[0].art);
  if (curCh === 4) box = (domP >= 0.657 ? bt[1] && bt[1].root : bt[0].root) || box;
  if (!box) return;
  const r = box.getBoundingClientRect();
  if (!r.width) return;
  const w = innerWidth, h = innerHeight;
  /* a ScrollTrigger refresh while the visitor is in the showcase would measure the copy scrolled away and move the
     scrim: only an on-screen box counts, so the frame stays a pure function of (pS, t) */
  if (r.bottom <= 0 || r.top >= h) return;
  /* whole CSS pixels: the pinned layout carries ~0.001 px of scroll-dependent noise, which would otherwise make the
     soft scrim (and so the frame) depend on where the visitor scrolled from */
  const L = Math.round(r.left), R = Math.round(r.right), T = Math.round(r.top), B = Math.round(r.bottom);
  J.copyRect.x = Math.max(0, L / w - 0.03); J.copyRect.z = Math.min(1, R / w + 0.05);
  J.copyRect.y = Math.max(0, 1 - B / h - 0.04); J.copyRect.w = Math.min(1, 1 - T / h + 0.04);
}

/* ---------- pin ---------- */
let st = null;
function pinRange() { return st ? { start: st.start, end: st.end } : { start: 0, end: innerHeight * 5.2 }; }
function scrollToProgress(p, smooth) {
  const r = pinRange();
  const y = r.start + Math.min(1, Math.max(0, p)) * (r.end - r.start);
  const lenis = window.LH && window.LH.lenis;
  if (lenis) lenis.scrollTo(y, smooth ? { duration: 1.4, force: true } : { immediate: true, force: true });
  else window.scrollTo(0, y);
  if (!smooth && window.ScrollTrigger) ScrollTrigger.update();
  if (!smooth) J.target = Math.min(1, Math.max(0, p));
}
J.scrollToProgress = scrollToProgress;
let sceneLive = false;
function setTarget(p) {
  J.target = p;
  if (!sceneLive) setDom(p);
}

function setPosterMode(on) { html.classList.toggle('jr-postermode', !!on); }
J.setPosterMode = setPosterMode;
J.onProgress = setDom;
J.onChapter = () => {};
J.onGuard = reason => enterGuard(reason);

/* ---------- hard guard (median frame > 24 ms) or a lost WebGL context: the canvas crossfades out and the chapter
   posters take over the same pin, crossfading on opacity with the same DOM copy and CTAs ---------- */
const GUARD_KEYS = [['01', -1, 0], ['02', 0.1, 0.135], ['03', 0.215, 0.3], ['04', 0.4, 0.425], ['05', 0.545, 0.575], ['05b', 0.655, 0.69], ['06', 0.775, 0.84]];
let guardLayers = null;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function enterGuard(reason) {
  if (guardLayers || mode !== 'live') return;
  const v = window.matchMedia('(max-width: 760px)').matches ? 'm' : 'd';
  const box = document.createElement('div');
  box.className = 'journey__posters'; box.setAttribute('aria-hidden', 'true');
  guardLayers = GUARD_KEYS.map(([k, a, b]) => {
    const d = document.createElement('div'); d.className = 'jposter'; d.dataset.k = k;
    const im = new Image(); im.alt = ''; im.decoding = 'async'; d.appendChild(im); box.appendChild(d);
    return { k, a, b, d, im, src: `${J.base}assets/img/journey/poster-${k}-${v}.webp`, o: -1 };
  });
  const pre = $('.journey__poster', journey);
  journey.insertBefore(box, pre ? pre.nextSibling : journey.firstChild);
  sceneLive = false;
  J.guard = reason || 'guard';
  html.classList.add('jr-guard');
  Object.assign(LHScene, {
    renderOnce() {}, setTime() {}, showcase() {},
    setProgress(p) { scrollToProgress(p); setDom(p); return p; },
    info() { return { tier: 'poster', guard: J.guard }; }
  });
  guardPaint(J.target);
}
function guardPaint(p) {
  let covered = false;
  for (let i = guardLayers.length - 1; i >= 0; i--) {
    const L = guardLayers[i];
    const o = L.a < 0 ? 1 : smooth(L.a, L.b, p);
    // load a still only when it is (or is about to be) on screen and nothing opaque covers it
    if (!covered && !L.im.getAttribute('src') && (o > 0 || p >= L.a - 0.12)) L.im.src = L.src;
    if (o !== L.o) { L.d.style.opacity = o.toFixed(3); L.o = o; }
    if (o >= 1 && L.im.complete && L.im.naturalWidth) covered = true;
  }
}

if (mode === 'live') {
  chEls.forEach((el, i) => el.classList.toggle('is-live', i === 0));
  /* html.jr-pin for the whole pin, both ends included (isActive drops at exactly p = 1) */
  const pinClass = s => { const y = s.scroll(); html.classList.toggle('jr-pin', y >= s.start - 1 && y <= s.end + 1); };
  const mm = gsap.matchMedia();
  mm.add({ phone: '(max-width: 760px)', desk: '(min-width: 761px)' }, ctx => {
    const len = ctx.conditions.phone ? 420 : 520;
    st = ScrollTrigger.create({
      trigger: journey, start: 'top top', end: '+=' + len + '%', pin: true, pinSpacing: true, refreshPriority: 10,
      onUpdate: s => { setTarget(s.progress); pinClass(s); },
      onToggle: pinClass,
      onRefresh: s => { setTarget(s.progress); pinClass(s); measureCopy(); }
    });
    return () => { st = null; };
  });
  ScrollTrigger.sort();
  /* split once the faces are in (line breaks must match the final font), 1.5 s cap */
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))]);
  fontsReady.then(() => { splitAll(); buildTimeline(); if (sceneLive) keyToScan(); });
  /* rebuild on width changes only (the iOS URL bar must not re-split) */
  let lastW = innerWidth, rt = null;
  window.addEventListener('resize', () => {
    J.portrait = innerWidth / innerHeight < 0.8;
    measureCopy();
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(rt);
    rt = setTimeout(() => { if (!built) return; splitAll(); scanKeys = null; buildTimeline(); if (sceneLive) requestAnimationFrame(keyToScan); }, 250);
  });
  setDom(0);
  /* rail: each tick scrolls to its chapter's dwell; arrow keys move along the rail */
  railBtns.forEach((b, i) => {
    b.addEventListener('click', () => scrollToProgress(dwellOf(i), true));
    b.addEventListener('keydown', e => {
      const k = e.key, n = railBtns.length;
      const j = k === 'ArrowDown' || k === 'ArrowRight' ? (i + 1) % n : k === 'ArrowUp' || k === 'ArrowLeft' ? (i + n - 1) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
      if (j < 0) return;
      e.preventDefault(); railBtns[j].focus();
    });
  });
  /* keyboard: focusing a chapter CTA brings its chapter (and beat) into view first */
  journey.addEventListener('focusin', e => {
    const art = e.target.closest('.ch'); if (!art) return;
    const i = chEls.indexOf(art); if (i < 0) return;
    const beat = e.target.closest('.ch__beat--b') ? 1 : 0;
    const bt = beats.find(x => x.ch === i && x.k === beat);
    if (bt && bt.live) return;
    scrollToProgress(dwellOf(i, beat), false);
  });
}
if (mode !== 'live') resolveReadyLater(false);

/* the scene could not start: drop the pin and the scrubbed copy, fall back to the stacked chapters */
function toStatic() {
  try {
    if (st) { st.kill(true); st = null; }
    if (tl) { tl.progress(0).kill(); tl = null; }
    splits.forEach(s => { try { s.revert(); } catch (e) { /* noop */ } }); splits = [];
    gsap.set($$(UNIT_SEL + ', .ch, .ch__beat, .journey__caption, .journey__titleblock', journey), { clearProps: 'all' });
    html.classList.remove('jr-pin');
    ScrollTrigger.refresh();
  } catch (e) { /* best effort */ }
}

/* ---------- visibility: render only while the journey or the showcase is on screen ---------- */
let api = null, visJ = true, visS = false;
function updateLive() {
  const on = visJ || visS;
  html.classList.toggle('jr-stage-on', on);
  if (api) api.setLive(on);
}
if (mode === 'live' && 'IntersectionObserver' in window) {
  const show = $('#projects');
  const io = new IntersectionObserver(es => { es.forEach(e => { if (e.target === journey) visJ = e.isIntersecting; else visS = e.isIntersecting; }); updateLive(); }, { rootMargin: '10% 0px 10% 0px' });
  io.observe(journey); if (show) io.observe(show);
}
updateLive();

/* ---------- the scene: imported on idle (immediately for QA / deep links) ---------- */
function resolveReadyLater(ok) { if (ok) resolveReady(); else rejectReady(new Error('scene unavailable: ' + mode)); }
async function loadScene() {
  try {
    const mod = await import('./journey/scene.js?v=20261024-2');
    api = await mod.start(J);
    Object.assign(LHScene, api, { ready });
    sceneLive = true;
    html.classList.add('jr-ready');
    updateLive();
    if (built) keyToScan();
    resolveReadyLater(true);
    if (qs.has('lhdebug')) debugOverlay();
    if (qs.has('cam')) window.addEventListener('keydown', e => { if (e.key === 'c') console.info('[LHScene pose]', JSON.stringify(LHScene.pose())); });
  } catch (err) {
    html.classList.remove('jr-live'); html.classList.add('jr-poster', 'jr-failed');
    toStatic();
    resolveReadyLater(false);
    if (qs.has('lhdebug')) console.warn('[journey] scene failed', err);
  }
}
if (mode === 'live') {
  const deep = qs.has('p');
  const startP = deep ? Math.min(1, Math.max(0, parseFloat(qs.get('p')) || 0)) : null;
  const go = () => loadScene().then(() => { if (startP !== null && api) LHScene.setProgress(startP); });
  if (deep || navigator.webdriver) go();
  else if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1200 });
  else setTimeout(go, 300);
  if (startP !== null) requestAnimationFrame(() => scrollToProgress(startP));
}

/* ---------- ?lhdebug overlay ---------- */
function debugOverlay() {
  const d = document.createElement('div');
  d.className = 'jr-debug'; d.setAttribute('aria-hidden', 'true');
  document.body.appendChild(d);
  const hist = [];
  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now(); hist.push(now - last); last = now; if (hist.length > 120) hist.shift();
    if ((hist.length & 7) !== 0) return;
    const i = LHScene.info(); const s = hist.slice().sort((a, b) => a - b);
    d.textContent = `p ${J.target.toFixed(3)}  pS ${(+i.p).toFixed(3)}  tier ${i.tier}  scale ${(+i.scale).toFixed(2)}\ncalls ${i.calls}  tris ${(i.tris / 1000).toFixed(0)}k  cpu ${i.frameMs}ms\nframe p50 ${s[s.length >> 1].toFixed(1)}  p95 ${s[Math.floor(s.length * 0.95)].toFixed(1)} ms`;
  });
}

/* ---------- sunset readout (NOAA approximation, Business Bay) ---------- */
(function sunset() {
  const el = $('[data-sunset]'); if (!el) return;
  const lat = 25.186, lon = 55.268, tz = 4;
  const d = new Date();
  const start = Date.UTC(d.getFullYear(), 0, 0), doy = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 864e5);
  const g = 2 * Math.PI / 365 * (doy - 1 + 0.5);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const la = lat * Math.PI / 180;
  const ha = Math.acos(Math.cos(90.833 * Math.PI / 180) / (Math.cos(la) * Math.cos(dec)) - Math.tan(la) * Math.tan(dec)) * 180 / Math.PI;
  const mins = Math.round(720 - 4 * (lon - ha) - eqt + tz * 60);
  const hh = Math.floor(mins / 60), mm = mins % 60;
  el.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
})();
