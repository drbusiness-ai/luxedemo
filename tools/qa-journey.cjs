/* QA for the home journey: the scene, its fallbacks and the page around it.
   Serve the repo root (python3 -m http.server 8107), then
     NODE_PATH=$(npm root -g) node tools/qa-journey.cjs
   Env: LH_URL (page URL, default http://localhost:8107/index.html), LH_SHOTS (output dir for screenshots + sheets),
        LH_ONLY (comma list of sections: live, copy, scroll, rm, nowebgl, guard; default all), LH_SIZES (desktop,phone),
        LH_REPORT (report file name, default report.json; lets sections run as separate jobs into one folder).
   Sections, each at 1440x780 desktop and 390x844 phone (iPhone UA, 2x, so the phone gets its real low tier):
     live     14 QA points: setTime(0) + setProgress + renderOnce. Determinism (canvas readback after a round trip to
              another p must be identical, and two page screenshots must match), main-pass calls/triangles against the
              budget, zero console errors. Pin length, scan start (vh), chapter rail / accent / live chapter at each
              dwell, Skip + nav CTA through the pin, honesty caption from ch03, the 603 label, copy contrast at every
              dwell (text hidden, background sampled under each copy box; 4.5:1 body, 3:1 display).
     copy     every copy beat swept in p with the scene stopped: during each dwell all lines out of their masks, full
              opacity, nothing off screen or under the nav / rail / NYLA / skip / caption; exits never half-cut a line.
     scroll   a full-page scroll-through of index.html: console errors, failed requests, the canvas renders only
              while the journey or #projects is on screen, the office-night still loads.
     rm       prefers-reduced-motion: six stacked chapters, posters loaded, identical copy + CTAs, no pin, no three.js
              request, caption visible, contrast on every poster.
     nowebgl  Chromium with --disable-webgl, and a Save-Data visit: the same stack, no three.js request.
     guard    the hard guard (?guardtest forces it after the 60-frame median) and a lost WebGL context both
              crossfade to the posters inside the same pin.
   Every run checks the request log for anything that is not same-origin (no CDN). Writes contact sheets
   sheet-desktop.png / sheet-phone.png (+ rm / nowebgl / scroll strips) and report.json to LH_SHOTS.
   Exits 1 on any failure. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const URL0 = process.env.LH_URL || 'http://localhost:8107/index.html';
const ORIGIN = new URL(URL0).origin;
const SHOTS = process.env.LH_SHOTS || path.join(__dirname, '..', '.qa');
const ONLY = (process.env.LH_ONLY || 'live,copy,scroll,rm,nowebgl,guard').split(',');
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SIZES = [
  { name: 'desktop', tag: 'd', w: 1440, h: 780, dsf: 1, scanVh: 110, pinVh: 5.2 },
  { name: 'phone', tag: 'm', w: 390, h: 844, dsf: 2, scanVh: 90, pinVh: 4.2, ua: IPHONE_UA, mobile: true }
].filter(s => (process.env.LH_SIZES || 'desktop,phone').split(',').includes(s.name));
const BUDGET = { calls: 45, tris: 350000 };
/* the 14 QA points (SPEC 7: intro, each chapter's key frame, both protected bands, the one-shots, the showcase) */
const POINTS = [
  { id: '01', label: 'intro: LUXE HAVEN formed', p: 0, intro: 0.32 },
  { id: '02', label: '01 plan + X-ray lens', p: 0.04 },
  { id: '03', label: '01>02 wireframes rise', p: 0.11 },
  { id: '04', label: '02 porcelain model', p: 0.17 },
  { id: '05', label: '03 scan mid-sweep', p: 0.25 },
  { id: '06', label: '03 scan, camera drops', p: 0.30 },
  { id: '07', label: '03 poster gate', p: 0.34 },
  { id: '08', label: '04 last light glint', p: 0.47 },
  { id: '09', label: '04 omega sun', p: 0.502 },
  { id: '10', label: '05a 603 first light', p: 0.585 },
  { id: '11', label: '05 wave spreading', p: 0.625 },
  { id: '12', label: '05b lights on, Palm', p: 0.73 },
  { id: '13', label: '06 as built', p: 0.96 },
  { id: '14', label: '07 showcase night map', p: 1, show: 0.5 }
];
const DWELL = [0.02, 0.165, 0.36, 0.445, 0.585, 0.73, 0.95];
const DWELL_CH = [0, 1, 2, 3, 4, 4, 5];
const ACCENTS = ['#A9C8FF', '#EDB8B0', '#FFC66E', '#E07AA6', '#FFB35C', '#FFB35C', '#A9C8FF'];
const UI_SAMPLE = [0, 0.04, 0.12, 0.2, 0.27, 0.34, 0.42, 0.5, 0.56, 0.62, 0.75, 0.9, 1];
const MODEL_MIN_S = -2687; // plinth corner (-1900, -1900) on the scan axis (sqrt .5, sqrt .5)
const TEXT_SEL = '.ch__eyebrow, .ch__label, .ch__serif, .ch__display, .ch__body, .ch__readout, .ch__micro, .ch__link';
const LARGE = ['ch__serif', 'ch__display'];
/* glyphs go transparent but keep their text-shadow halos: a halo is part of the background the reader sees */
const HIDE_TEXT_CSS = `.journey .ch__in, .journey .ch__in * { color: transparent !important; -webkit-text-stroke: 0 !important; caret-color: transparent !important; transition: none !important }
  .journey .ch__in .btn, .journey .ch__in .ch__chip, .journey .ch__eyebrow::before, .journey .ch__label::before, .jl, .journey__caption, .journey__skip, .journey__rail, .journey__titleblock { visibility: hidden !important }`;

fs.mkdirSync(SHOTS, { recursive: true });
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { url: URL0, when: new Date().toISOString(), sections: {} };
let FAIL = false;
const fail = (sec, msg) => { FAIL = true; (report.failures = report.failures || []).push(`${sec}: ${msg}`); };

/* request + console log for a page; returns the shared log object */
function watch(page, log) {
  log.errors = log.errors || []; log.external = log.external || []; log.failed = log.failed || []; log.three = log.three || []; log.posters = log.posters || [];
  page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text().slice(0, 240)); });
  page.on('pageerror', e => log.errors.push('pageerror: ' + e.message.slice(0, 240)));
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith(ORIGIN) && !/^(data|blob|about):/.test(u)) log.external.push(u);
    if (/vendor\/three\/|journey\/scene\.js/.test(u)) log.three.push(u.replace(ORIGIN, ''));
    if (/img\/journey\/poster-/.test(u)) log.posters.push(u.replace(ORIGIN, '').replace(/^.*\//, ''));
  });
  page.on('requestfailed', r => log.failed.push(r.url().replace(ORIGIN, '') + ' ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) log.failed.push(r.url().replace(ORIGIN, '') + ' ' + r.status()); });
  return log;
}
async function newPage(browser, S, extra = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: S.dsf, isMobile: !!S.mobile, hasTouch: !!S.mobile, userAgent: S.ua }, extra));
  await ctx.addInitScript(() => { try { sessionStorage.setItem('lh-nyla-seen', '1'); } catch (e) { /* no storage */ } });
  const page = await ctx.newPage();
  const shot = page.screenshot.bind(page);
  page.screenshot = o => shot(Object.assign({ animations: 'disabled' }, o)); // the grain overlay is a CSS animation
  return { ctx, page };
}

/* contrast of copy over whatever is behind it: read text boxes + colours, hide the text, screenshot, then sample
   the screenshot under each box in the page itself (no PNG decoder needed in node) */
async function contrast(page, rootSel) {
  const boxes = await page.evaluate(({ rootSel, TEXT_SEL, LARGE }) => {
    const root = document.querySelector(rootSel); if (!root) return [];
    const vis = el => { let e = el, a = 1; while (e && e !== document.body) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; a *= +cs.opacity; e = e.parentElement; } return a; };
    return [...root.querySelectorAll(TEXT_SEL)].map(el => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const op = vis(el);
      if (op < 0.9 || r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
      const m = cs.color.match(/[\d.]+/g).map(Number);
      // the glyph line boxes, not the column: a Range over the element's text gives one rect per line
      const rg = document.createRange(); rg.selectNodeContents(el);
      const lines = [...rg.getClientRects()].filter(q => q.width > 2 && q.height > 2).map(q => ({ x: Math.max(0, q.left), y: Math.max(0, q.top), w: Math.min(innerWidth, q.right) - Math.max(0, q.left), h: Math.min(innerHeight, q.bottom) - Math.max(0, q.top) })).filter(q => q.w > 1 && q.h > 1);
      return { cls: [...el.classList].find(c => c.startsWith('ch__')), large: LARGE.some(c => el.classList.contains(c)), lines, rgb: m.slice(0, 3), a: m[3] === undefined ? 1 : m[3], text: el.textContent.trim().slice(0, 28) };
    }).filter(b => b && b.lines.length);
  }, { rootSel, TEXT_SEL, LARGE });
  if (!boxes.length) return [];
  await page.addStyleTag({ content: HIDE_TEXT_CSS }).then(h => h.evaluate(n => n.setAttribute('data-qa-hide', '')));
  await sleep(120);
  const png = await page.screenshot({ type: 'png' });
  if (process.env.LH_SAVEHIDE) fs.writeFileSync(path.join(SHOTS, `hide-${Date.now()}.png`), png); // debug: the background the ratios were read from
  await page.evaluate(() => document.querySelectorAll('style[data-qa-hide]').forEach(n => n.remove()));
  return page.evaluate(async ({ b64, boxes }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = img.naturalWidth / innerWidth;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    return boxes.map(bx => {
      const ratios = [];
      for (const q of bx.lines) {
      const d = g.getImageData(Math.round(q.x * k), Math.round(q.y * k), Math.max(1, Math.round(q.w * k)), Math.max(1, Math.round(q.h * k))).data;
      for (let i = 0; i < d.length; i += 4 * 3) {
        const fr = bx.a * bx.rgb[0] + (1 - bx.a) * d[i], fg = bx.a * bx.rgb[1] + (1 - bx.a) * d[i + 1], fb = bx.a * bx.rgb[2] + (1 - bx.a) * d[i + 2];
        const l1 = L(fr, fg, fb), l2 = L(d[i], d[i + 1], d[i + 2]);
        ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
      }
      ratios.sort((a, b) => a - b);
      const p10 = ratios[Math.floor(ratios.length * 0.1)] || 0;
      const need = bx.large ? 3 : 4.5;
      return { cls: bx.cls, text: bx.text, ratio: +p10.toFixed(2), need, ok: p10 >= need };
    });
  }, { b64: png.toString('base64'), boxes });
}

/* page screenshots of the same moment: count differing pixels in the browser (no PNG decoder in node here).
   Chrome's compositor (SwiftShader raster of rotated, glowing layers) can move a handful of pixels by one level */
async function pixDiff(page, a, b) {
  return page.evaluate(async ({ a, b }) => {
    const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const A = await load(a), B = await load(b);
    if (A.length !== B.length) return { n: -1, max: 255 };
    let n = 0, max = 0;
    for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d) { n++; if (d > max) max = d; } }
    return { n, max };
  }, { a: a.toString('base64'), b: b.toString('base64') });
}
const SHOT_TOL = { max: 2, n: 200 }; // a page pair passes when identical, or when <= 200 px differ by <= 2 levels

/* CSS transitions (the chapter accent, rail ticks, nav) must finish before a page screenshot is compared */
async function cssCalm(page) {
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || !isFinite(a.effect.getComputedTiming().endTime)), null, { timeout: 6000, polling: 100 }).catch(() => {});
}

/* deterministic moment: setTime(0) + setProgress(p) (+ the showcase, scrolled to its own position so the page around
   the canvas is the real one), then one synchronous render whose canvas is read back in the same task */
async function settle(page, p, show) {
  await page.evaluate(({ p }) => { const S = window.LHScene; S.setTime(0); S.showcase(0); S.setProgress(p); }, { p });
  if (show) {
    await page.evaluate(q => {
      const sh = document.querySelector('#projects'), pin = sh.querySelector('.show__pin');
      const st = ScrollTrigger.getAll().find(t => t.pin === pin);
      const r = sh.getBoundingClientRect();
      const y = st ? st.start + q * (st.end - st.start) : scrollY + r.top - innerHeight + q * (r.height + innerHeight);
      const l = window.LH && window.LH.lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
      ScrollTrigger.update();
      // land the scrubbed track exactly on its scroll position (scrub: 1 would otherwise ease in from wherever it was)
      ScrollTrigger.getAll().forEach(t => { const tw = t.getTween && t.getTween(); if (tw) tw.progress(1); });
    }, show);
    /* the page's own showcase (scrub: 1 track, 1.2 s tower replays) must come to rest before the page screenshot:
       wait until no GSAP tween is running and the track has stopped moving, twice in a row */
    let calm = 0;
    for (let i = 0; i < 40 && calm < 2; i++) {
      await sleep(300);
      const still = await page.evaluate(() => {
        const tr = document.querySelector('.show__track');
        const x = tr ? Math.round(+gsap.getProperty(tr, 'x') * 10) : 0;
        const busy = gsap.globalTimeline.getChildren(true, true, false).some(t => t.isActive());
        const was = window.__qaTrackX; window.__qaTrackX = x;
        return !busy && was === x;
      });
      calm = still ? calm + 1 : 0;
    }
  } else await sleep(260);
  const r = await page.evaluate(({ p, show }) => {
    const S = window.LHScene; S.setTime(0); S.setProgress(p, { scroll: false }); S.showcase(show || 0);
    const info = S.renderOnce();
    return { info, png: document.querySelector('canvas.stage').toDataURL('image/png') };
  }, { p, show });
  return { info: r.info, hash: md5(r.png), png: r.png };
}

/* ================= live ================= */
async function live(browser, S) {
  const sec = 'live-' + S.name, log = {};
  const { ctx, page } = await newPage(browser, S);
  watch(page, log);
  await page.goto(URL0 + '?nointro', { waitUntil: 'load' });
  await page.evaluate(() => window.LHScene.ready);
  const r = { log, points: [] };
  r.info0 = await page.evaluate(() => window.LHScene.info());
  /* pin + scan start */
  Object.assign(r, await page.evaluate(async ({ minS, portrait }) => {
    const st = ScrollTrigger.getAll().find(t => t.vars.refreshPriority === 10);
    const pinVh = st ? (st.end - st.start) / innerHeight : null;
    const tl = await import(new URL('assets/js/journey/timeline.js', location.href).href);
    const keys = await (await fetch(new URL(`assets/data/keys-${portrait ? 'portrait' : 'desktop'}.json`, location.href))).json();
    const tr = tl.makeTrack(keys.tracks.scanPos), out = [0];
    let scanP = null;
    for (let p = 0; p <= 0.5; p += 0.0005) { tl.sampleTrack(tr, tl.remap(p), out); if (out[0] > minS) { scanP = +p.toFixed(4); break; } }
    return { pinVh: pinVh && +pinVh.toFixed(2), scanP, scanVh: scanP !== null && pinVh ? +(scanP * pinVh * 100).toFixed(1) : null, bands: tl.BANDS };
  }, { minS: MODEL_MIN_S, portrait: S.w / S.h < 0.8 }));
  if (r.pinVh !== S.pinVh) fail(sec, `pin ${r.pinVh} vh, want ${S.pinVh}`);
  r.scanOk = r.scanVh !== null && r.scanVh <= S.scanVh && r.bands.some(b => b[0] <= r.scanP && b[2] >= 1.8);
  if (!r.scanOk) fail(sec, `scan starts at ${r.scanVh} vh (budget ${S.scanVh})`);

  /* 14 points: determinism + budget + screenshots */
  const only = process.env.LH_POINTS ? process.env.LH_POINTS.split(',') : null; // e.g. LH_POINTS=06,07 (debug)
  for (const P of POINTS) {
    if (only && !only.includes(P.id)) continue;
    if (P.intro !== undefined) await page.evaluate(t => window.LHScene.setIntro(t), P.intro);
    const { info, hash: hA, png: pA } = await settle(page, P.p, P.show);
    await sleep(650); await cssCalm(page); // CSS transitions (accent, rail) settle
    const shotA = await page.screenshot({ type: 'png' });
    const file = path.join(SHOTS, `qa-${S.tag}-${P.id}.png`);
    fs.writeFileSync(file, shotA);
    // round trip through another moment, then back: the frame must be a pure function of (p, t)
    await settle(page, P.p > 0.5 ? 0.2 : 0.8);
    if (P.intro !== undefined) await page.evaluate(t => window.LHScene.setIntro(t), P.intro);
    const { hash: hB, png: pB } = await settle(page, P.p, P.show);
    await sleep(650); await cssCalm(page);
    const shotB = await page.screenshot({ type: 'png' });
    /* keep the evidence of a determinism failure next to the shot */
    const dataPng = d => Buffer.from(d.split(',')[1], 'base64');
    if (hA !== hB) { fs.writeFileSync(file.replace('.png', '-canvasA.png'), dataPng(pA)); fs.writeFileSync(file.replace('.png', '-canvasB.png'), dataPng(pB)); }
    const exact = md5(shotA) === md5(shotB), sd = exact ? { n: 0, max: 0 } : await pixDiff(page, shotA, shotB);
    if (!exact) fs.writeFileSync(file.replace('.png', '-B.png'), shotB);
    const pt = { id: P.id, p: P.p, label: P.label, main: info.passes.main, mirror: info.passes.mirror, post: info.passes.post, scale: info.scale, size: info.size, canvasSame: hA === hB, shotExact: exact, shotDiff: sd, shotSame: exact || (sd.n >= 0 && sd.n <= SHOT_TOL.n && sd.max <= SHOT_TOL.max), shot: path.basename(file) };
    pt.budgetOk = pt.main[0] <= BUDGET.calls && pt.main[1] <= BUDGET.tris;
    r.points.push(pt);
    if (!pt.canvasSame) fail(sec, `point ${P.id} (p=${P.p}) canvas not deterministic`);
    if (!pt.shotSame) fail(sec, `point ${P.id} (p=${P.p}) page screenshots differ (${sd.n} px, max ${sd.max} levels)`);
    if (!pt.budgetOk) fail(sec, `point ${P.id} main pass ${pt.main[0]} calls / ${Math.round(pt.main[1] / 1000)}k tris over budget`);
    if (P.intro !== undefined) await page.evaluate(() => window.LHScene.skipIntro());
  }
  await page.evaluate(() => window.LHScene.showcase(0));

  /* dwells: rail, live chapter, accent, 603 label, contrast */
  r.dwell = [];
  const onlyD = process.env.LH_DWELL ? process.env.LH_DWELL.split(',').map(Number) : null; // e.g. LH_DWELL=2,4 or LH_DWELL=-1 (debug)
  for (let i = 0; i < DWELL.length; i++) {
    if (onlyD && !onlyD.includes(i)) continue;
    await settle(page, DWELL[i]);
    await sleep(500); await cssCalm(page);
    const d = await page.evaluate(p => {
      const rail = [...document.querySelectorAll('.journey__rail button')].findIndex(b => b.hasAttribute('aria-current'));
      const live = [...document.querySelectorAll('.journey .ch')].findIndex(c => c.classList.contains('is-live'));
      const accent = document.querySelector('.journey').style.getPropertyValue('--accent').trim().toUpperCase();
      const lab = document.querySelector('.jl');
      const ctas = [...document.querySelectorAll('.journey .ch.is-live .ch__beat.is-live .btn, .journey .ch.is-live > .ch__in > .ch__ctas .btn, .journey .ch.is-live .ch__chip')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && +getComputedStyle(b).opacity > 0.5; }).length;
      return { p, rail, live, accent, ctas, label603: lab ? +getComputedStyle(lab).opacity : null };
    }, DWELL[i]);
    d.ok = d.rail === DWELL_CH[i] && d.live === DWELL_CH[i] && d.accent === ACCENTS[i] && d.ctas > 0;
    if (!d.ok) fail(sec, `dwell p=${DWELL[i]}: rail ${d.rail} live ${d.live} accent ${d.accent} ctas ${d.ctas}`);
    d.contrast = await contrast(page, '.journey .ch.is-live');
    const bad = d.contrast.filter(c => !c.ok);
    if (bad.length) fail(sec, `contrast at p=${DWELL[i]}: ` + bad.map(b => `${b.cls} "${b.text}" ${b.ratio}<${b.need}`).join('; '));
    r.dwell.push(d);
  }
  const d4 = r.dwell.find(d => d.p === DWELL[4]), lab = d4 ? d4.label603 : null;
  if (!(lab === null || lab > 0.9)) fail(sec, `603 label opacity ${lab} at its dwell`);

  /* persistent UI + honesty caption */
  r.ui = [];
  for (const p of UI_SAMPLE) {
    await page.evaluate(p => window.LHScene.setProgress(p), p);
    await sleep(80);
    r.ui.push(await page.evaluate(p => {
      const on = el => { if (!el) return false; const b = el.getBoundingClientRect(), cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.5 && b.width > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth; };
      return { p, skip: on(document.querySelector('.journey__skip')), cta: on(document.querySelector('.nav__cta')), caption: on(document.querySelector('.journey__caption')) };
    }, p));
  }
  r.uiOk = r.ui.every(u => u.skip && u.cta && (u.p < 0.205 ? !u.caption : u.caption));
  if (!r.uiOk) fail(sec, 'skip / nav CTA / caption visibility: ' + JSON.stringify(r.ui.filter(u => !(u.skip && u.cta && (u.p < 0.205 ? !u.caption : u.caption)))));
  /* in live mode only the first-paint poster may be requested (stack stills are display:none + lazy) */
  const extraPosters = log.posters.filter(f => !/poster-pre-/.test(f));
  if (extraPosters.length) fail(sec, 'stack posters requested in live mode: ' + extraPosters.join(', '));
  if (log.errors.length) fail(sec, 'console errors: ' + log.errors.join(' | '));
  if (log.external.length) fail(sec, 'external requests: ' + log.external.join(', '));
  if (log.failed.length) fail(sec, 'failed requests: ' + log.failed.join(', '));
  report.sections[sec] = r;
  await ctx.close();
}

/* ================= full-page scroll-through ================= */
async function scroll(browser, S) {
  const sec = 'scroll-' + S.name, log = {};
  const { ctx, page } = await newPage(browser, S);
  watch(page, log);
  await page.goto(URL0, { waitUntil: 'load' });
  await page.evaluate(() => window.LHScene.ready);
  const r = { log, stops: [] };
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = S.h, step = Math.round(vh * 0.5);
  const frames = [];
  for (let y = 0, k = 0; y <= H; y += step, k++) {
    await page.evaluate(y => { const l = window.LH && window.LH.lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
    await sleep(140);
    /* two frames + a task: the IntersectionObserver callbacks for this scroll position have been delivered */
    await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 0)))));
    const st = await page.evaluate(() => {
      const sec = [...document.querySelectorAll('main section, footer')].filter(s => s.parentElement.id === 'main' || s.parentElement.classList.contains('pin-spacer') || s.tagName === 'FOOTER').find(s => { const r = s.getBoundingClientRect(); return r.top <= innerHeight * 0.5 && r.bottom > innerHeight * 0.5; });
      // what the stage should be: .journey or #projects within the viewport grown by the observer's 10% margins
      const m = innerHeight * 0.1, gap = el => { const r = el.getBoundingClientRect(); return Math.max(r.top - (innerHeight + m), -m - r.bottom); };
      const g = Math.min(gap(document.querySelector('.journey')), gap(document.querySelector('#projects')));
      return { y: Math.round(scrollY), sec: sec ? (sec.id || sec.className.split(' ')[0]) : null, stage: document.documentElement.classList.contains('jr-stage-on'), want: g < 0, edge: Math.abs(g) < 4, p: window.LHScene.info().p };
    });
    r.stops.push(st);
    if (k % Math.max(1, Math.round(H / step / 14)) === 0) { const f = path.join(SHOTS, `scroll-${S.tag}-${String(frames.length).padStart(2, '0')}.png`); await page.screenshot({ path: f }); frames.push(f); }
  }
  const stageWrong = r.stops.filter(s => s.stage !== s.want && !s.edge);
  r.stageOk = !stageWrong.length;
  if (!r.stageOk) fail(sec, 'canvas live state wrong at ' + JSON.stringify(stageWrong.slice(0, 4)));
  r.officeNight = await page.evaluate(() => { const im = document.querySelector('img[src*="office-night"]'); if (!im) return 'missing'; const s = im.currentSrc || im.src; return im.complete && im.naturalWidth ? s.replace(/^.*\//, '') : 'not loaded'; });
  if (!/office-night-/.test(r.officeNight)) fail(sec, 'office-night still: ' + r.officeNight);
  r.frames = frames.map(f => path.basename(f));
  if (log.errors.length) fail(sec, 'console errors: ' + log.errors.join(' | '));
  if (log.external.length) fail(sec, 'external requests: ' + log.external.join(', '));
  if (log.failed.length) fail(sec, 'failed requests: ' + log.failed.join(', '));
  report.sections[sec] = r;
  await ctx.close();
  return frames;
}

/* ================= stacks: reduced motion / no WebGL / Save-Data ================= */
async function stack(browser, S, kind, extra = {}, init) {
  const sec = `${kind}-${S.name}`, log = {};
  const { ctx, page } = await newPage(browser, S, extra);
  if (init) await page.addInitScript(init);
  watch(page, log);
  await page.goto(URL0, { waitUntil: 'load' });
  await sleep(600);
  const r = { log };
  Object.assign(r, await page.evaluate(() => {
    const h = document.documentElement, j = document.querySelector('.journey');
    return { mode: ['jr-static', 'jr-poster', 'jr-live'].find(c => h.classList.contains(c)), pinned: !!j.closest('.pin-spacer'), journeyVh: +(j.getBoundingClientRect().height / innerHeight).toFixed(2), chapters: document.querySelectorAll('.journey .ch').length };
  }));
  const want = kind === 'rm' ? 'jr-static' : 'jr-poster';
  if (r.mode !== want) fail(sec, `mode ${r.mode}, want ${want}`);
  if (r.pinned) fail(sec, 'journey is pinned');
  if (r.journeyVh < 6.5) fail(sec, `journey only ${r.journeyVh} screens tall`);
  /* each chapter (and ch05's second beat) on screen in turn: poster loaded, copy + CTAs visible, caption on, contrast */
  const blocks = await page.evaluate(() => [...document.querySelectorAll('.journey .ch:not(.ch--05), .journey .ch--05 .ch__beat')].map((el, i) => { el.setAttribute('data-qa-block', i); return i; }));
  r.blocks = [];
  const shots = [];
  for (const i of blocks) {
    await page.evaluate(i => { const el = document.querySelector(`[data-qa-block="${i}"]`); window.scrollTo(0, el.getBoundingClientRect().top + scrollY); }, i);
    await page.waitForFunction(i => { const im = document.querySelector(`[data-qa-block="${i}"] .ch__poster img`); return im && im.complete; }, i, { timeout: 8000 }).catch(() => {});
    await sleep(250);
    const b = await page.evaluate(i => {
      const el = document.querySelector(`[data-qa-block="${i}"]`), im = el.querySelector('.ch__poster img');
      const on = e => { if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.5 && r.width > 0 && r.bottom > 0 && r.top < innerHeight; };
      const ctas = [...el.querySelectorAll('.btn, .ch__chip, .ch__link')];
      const over = [];
      const fixed = ['.journey__caption', '.journey__skip', '.nyla-launch'].map(s => document.querySelector(s)).filter(on);
      el.querySelectorAll('.ch__label, .ch__eyebrow, .ch__serif, .ch__display, .ch__body, .ch__readout, .ch__micro, .btn, .ch__chip, .ch__link').forEach(u => {
        const a = u.getBoundingClientRect();
        fixed.forEach(f => { const b = f.getBoundingClientRect(); const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 2 && iy > 2) over.push(`"${u.textContent.trim().slice(0, 20)}" under ${f.className.split(' ')[0]}`); });
      });
      return { i, over, poster: im ? (im.currentSrc || im.src).replace(/^.*\//, '') : null, loaded: !!(im && im.complete && im.naturalWidth), heading: !!el.querySelector('h1, h2, h3'), ctas: ctas.length, ctasVisible: ctas.filter(on).length, caption: on(document.querySelector('.journey__caption')), skip: on(document.querySelector('.journey__skip')) };
    }, i);
    const f = path.join(SHOTS, `${kind}-${S.tag}-${b.i + 1}.png`);
    await page.screenshot({ path: f }); shots.push(f);
    b.contrast = await contrast(page, `[data-qa-block="${i}"]`);
    const bad = b.contrast.filter(c => !c.ok);
    if (!b.loaded) fail(sec, `block ${i + 1}: poster ${b.poster} not loaded`);
    if (!b.heading || b.ctasVisible < 1 || b.ctasVisible !== b.ctas) fail(sec, `block ${i + 1}: heading ${b.heading}, CTAs ${b.ctasVisible}/${b.ctas} visible`);
    if (!b.caption) fail(sec, `block ${i + 1}: honesty caption not visible`);
    if (b.over.length) fail(sec, `block ${i + 1}: ` + b.over.join('; '));
    if (bad.length) fail(sec, `block ${i + 1} contrast: ` + bad.map(x => `${x.cls} "${x.text}" ${x.ratio}<${x.need}`).join('; '));
    r.blocks.push(b);
  }
  /* the caption must not follow the visitor out of the journey */
  r.captionAfter = await page.evaluate(() => { document.querySelector('#projects').scrollIntoView(); const c = document.querySelector('.journey__caption').getBoundingClientRect(); return c.bottom > 0 && c.top < innerHeight; });
  await sleep(300);
  r.showBg = await page.evaluate(() => getComputedStyle(document.querySelector('.show__pin'), '::before').backgroundImage.replace(/^.*\//, '').replace(/["')]/g, ''));
  if (!/poster-show-/.test(r.showBg)) fail(sec, 'showcase has no night-map still: ' + r.showBg);
  const fs1 = path.join(SHOTS, `${kind}-${S.tag}-show.png`); await page.screenshot({ path: fs1 }); shots.push(fs1);
  if (log.three.length) fail(sec, 'three.js / scene requested: ' + log.three.join(', '));
  if (log.errors.length) fail(sec, 'console errors: ' + log.errors.join(' | '));
  if (log.external.length) fail(sec, 'external requests: ' + log.external.join(', '));
  if (log.failed.length) fail(sec, 'failed requests: ' + log.failed.join(', '));
  report.sections[sec] = r;
  await ctx.close();
  return shots;
}

/* ================= hard guard + lost context ================= */
async function guard(browser, S) {
  const sec = 'guard-' + S.name, log = {};
  const r = { log };
  {
    const { ctx, page } = await newPage(browser, S);
    watch(page, log);
    const t0 = Date.now();
    await page.goto(URL0 + '?nointro&guardtest', { waitUntil: 'load' });
    await page.evaluate(() => window.LHScene.ready);
    await page.mouse.move(S.w * 0.6, S.h * 0.5).catch(() => {});
    const ok = await page.waitForFunction(() => document.documentElement.classList.contains('jr-guard'), null, { timeout: 180000, polling: 500 }).then(() => true).catch(() => false);
    r.slowGuard = ok; r.slowGuardS = +((Date.now() - t0) / 1000).toFixed(1);
    if (!ok) fail(sec, 'hard guard never fired');
    else {
      // the canvas crossfades out over 0.8 s (SwiftShader can stretch that): wait for it, up to 6 s
      const t1 = Date.now();
      r.stageGone = await page.waitForFunction(() => getComputedStyle(document.querySelector('canvas.stage')).opacity === '0', null, { timeout: 6000, polling: 100 }).then(() => true).catch(() => false);
      r.stageGoneS = +((Date.now() - t1) / 1000).toFixed(1);
      r.slow = await page.evaluate(() => ({ stageOpacity: getComputedStyle(document.querySelector('canvas.stage')).opacity, layers: document.querySelectorAll('.journey__posters .jposter').length, info: window.LHScene.info() }));
      for (const [p, k] of [[0.36, '03'], [0.585, '05']]) {
        await page.evaluate(p => window.LHScene.setProgress(p), p);
        await page.waitForFunction(k => { const d = document.querySelector(`.journey__posters .jposter[data-k="${k}"]`); const im = d && d.querySelector('img'); return d && +d.style.opacity > 0.99 && im.complete && im.naturalWidth; }, k, { timeout: 8000 }).then(() => true).catch(() => fail(sec, `guard poster ${k} not shown at p=${p}`));
        await sleep(500);
        await page.screenshot({ path: path.join(SHOTS, `guard-${S.tag}-${k}.png`) });
      }
      if (r.slow.stageOpacity !== '0' || r.slow.layers < 7) fail(sec, `after the guard: stage opacity ${r.slow.stageOpacity}, ${r.slow.layers} poster layers`);
    }
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, S);
    watch(page, log);
    await page.goto(URL0 + '?nointro', { waitUntil: 'load' });
    await page.evaluate(() => window.LHScene.ready);
    await page.evaluate(() => window.LHScene.setProgress(0.34));
    await page.evaluate(() => { const gl = window.LHScene.renderer.getContext(); gl.getExtension('WEBGL_lose_context').loseContext(); });
    r.contextGuard = await page.waitForFunction(() => document.documentElement.classList.contains('jr-guard'), null, { timeout: 5000 }).then(() => true).catch(() => false);
    if (!r.contextGuard) fail(sec, 'lost context did not fall back to the posters');
    await sleep(1200);
    await page.screenshot({ path: path.join(SHOTS, `guard-${S.tag}-ctx.png`) });
    await ctx.close();
  }
  const errs = log.errors.filter(e => !/CONTEXT_LOST_WEBGL|Context Lost/i.test(e));
  if (errs.length) fail(sec, 'console errors: ' + errs.join(' | '));
  if (log.external.length) fail(sec, 'external requests: ' + log.external.join(', '));
  if (log.failed.length) fail(sec, 'failed requests: ' + log.failed.join(', '));
  report.sections[sec] = r;
}

/* ================= copy layout sweep ================= */
/* The scene is stopped (LHScene.stop() hands the pin to the guard posters; the DOM copy timeline and layout are the
   same as live, and setProgress is then DOM-only, so p can be stepped finely). For every copy beat:
     dwell (show end -> hide start): every line fully out of its mask, every unit at full opacity, nothing off screen,
       nothing under the nav, rail, NYLA button / teaser, skip link, caption or title block;
     exit (hide window): no line is ever parked half-cut by its mask (exits dissolve, they never wipe). */
async function copySweep(browser, S) {
  const sec = 'copy-' + S.name, log = {};
  const { ctx, page } = await newPage(browser, S);
  watch(page, log);
  await page.goto(URL0 + '?nointro', { waitUntil: 'load' });
  await page.evaluate(() => window.LHScene.ready);
  await sleep(400);
  await page.evaluate(() => window.LHScene.stop());
  await sleep(300);
  const r = await page.evaluate(async () => {
    const R = e => e.getBoundingClientRect();
    const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const opa = el => { let e = el, a = 1; while (e && e !== document.body) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; a *= +cs.opacity; e = e.parentElement; } return a; };
    const short = e => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 22);
    const FIXED = { nav: '.nav', rail: '.journey__rail', nyla: '.nyla-launch', teaser: '.nyla-teaser', skip: '.journey__skip', caption: '.journey__caption', titleblock: '.journey__titleblock' };
    const arts = [...document.querySelectorAll('.journey .ch')];
    const out = { dwell: [], exit: [], samples: 0 };
    const at = async p => { window.LHScene.setProgress(p); await new Promise(res => requestAnimationFrame(res)); };
    for (const [ci, c] of window.LHScene.copyWindows.entries()) {
      for (const [bi, b] of c.beats.entries()) {
        const root = b.sel ? arts[ci].querySelector(b.sel) : arts[ci];
        const from = b.show ? b.show[1] + 0.008 : 0, to = b.hide ? b.hide[0] - 0.001 : 1;
        const issues = new Set();
        for (let p = from; p <= to + 1e-9; p += 0.005) {
          await at(+p.toFixed(4)); out.samples++;
          const fixed = {}; for (const k in FIXED) { const e = document.querySelector(FIXED[k]); if (e && opa(e) > 0.3) { const q = R(e); if (q.width > 0 && q.height > 0) fixed[k] = q; } }
          root.querySelectorAll('.ln').forEach(l => {
            const lr = R(l), mr = R(l.parentElement), vis = Math.max(0, Math.min(lr.bottom, mr.bottom) - Math.max(lr.top, mr.top)) / lr.height;
            if (vis < 0.99) issues.add(`"${short(l)}" clipped (${vis.toFixed(2)} shown)`);
          });
          root.querySelectorAll('.ch__eyebrow, .ch__label, .ch__serif, .ch__display, .ch__body, .ch__readout, .ch__micro, .ch__ctas, .ch__chips').forEach(u => { const o = opa(u); if (o < 0.99) issues.add(`"${short(u)}" at opacity ${o.toFixed(2)}`); });
          root.querySelectorAll('.ch__label, .ch__eyebrow, .ln, .ch__readout, .ch__micro, .btn, .ch__chip, .ch__link').forEach(u => {
            const q = R(u); if (q.width < 2) return;
            if (q.top < 0 || q.bottom > innerHeight || q.left < 0 || q.right > innerWidth) issues.add(`"${short(u)}" off screen`);
            for (const k in fixed) if (inter(q, fixed[k]) > 4) issues.add(`"${short(u)}" under the ${k}`);
          });
        }
        out.dwell.push({ ch: c.id, beat: bi, from: +from.toFixed(3), to: +to.toFixed(3), issues: [...issues] });
        if (b.hide) {
          const ex = new Set();
          for (let p = b.hide[0]; p <= b.hide[1] + 1e-9; p += 0.001) {
            await at(+p.toFixed(4)); out.samples++;
            root.querySelectorAll('.ln').forEach(l => {
              if (opa(l) < 0.15) return;
              const lr = R(l), mr = R(l.parentElement), vis = Math.max(0, Math.min(lr.bottom, mr.bottom) - Math.max(lr.top, mr.top)) / lr.height;
              if (vis > 0.02 && vis < 0.97) ex.add(`"${short(l)}" half-cut at p=${p.toFixed(3)}`);
            });
          }
          out.exit.push({ ch: c.id, beat: bi, issues: [...ex] });
        }
      }
    }
    return out;
  });
  for (const d of r.dwell) if (d.issues.length) fail(sec, `ch${d.ch}${d.beat ? 'b' : ''} dwell ${d.from}-${d.to}: ` + d.issues.slice(0, 6).join('; '));
  for (const d of r.exit) if (d.issues.length) fail(sec, `ch${d.ch}${d.beat ? 'b' : ''} exit: ` + d.issues.slice(0, 4).join('; '));
  if (log.errors.length) fail(sec, 'console errors: ' + log.errors.join(' | '));
  if (log.external.length) fail(sec, 'external requests: ' + log.external.join(', '));
  report.sections[sec] = { log, dwell: r.dwell, exit: r.exit, samples: r.samples };
  await ctx.close();
}

/* ================= contact sheets (ffmpeg) ================= */
function sheet(files, labels, out, cols, cellW) {
  const tmp = fs.mkdtempSync(path.join(SHOTS, '.sheet-'));
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
  files.forEach((f, i) => {
    const txt = (labels[i] || '').replace(/[:'\\%]/g, ' ');
    const draw = fs.existsSync(font) ? `,drawbox=x=0:y=ih-26:w=iw:h=26:color=0x070B1C@0.82:t=fill,drawtext=fontfile=${font}:text='${txt}':x=10:y=h-19:fontsize=13:fontcolor=0xD6E6FF` : '';
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', f, '-vf', `scale=${cellW}:-2${draw}`, path.join(tmp, `c${String(i).padStart(2, '0')}.png`)]);
  });
  const rows = Math.ceil(files.length / cols);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, 'c%02d.png'), '-vf', `tile=${cols}x${rows}:padding=6:margin=6:color=0x070B1C`, '-frames:v', '1', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ args: ARGS });
  const extraSheets = {};
  for (const S of SIZES) {
    if (ONLY.includes('live')) {
      await live(browser, S);
      const PS = POINTS.filter(P => fs.existsSync(path.join(SHOTS, `qa-${S.tag}-${P.id}.png`)));
      const files = PS.map(P => path.join(SHOTS, `qa-${S.tag}-${P.id}.png`));
      if (PS.length) sheet(files, PS.map(P => `${P.id}  p=${P.show ? 'show ' + P.show : P.p}  ${P.label}`), path.join(SHOTS, `sheet-${S.name}.png`), S.tag === 'd' ? 4 : 7, S.tag === 'd' ? 480 : 260);
    }
    if (ONLY.includes('copy')) await copySweep(browser, S);
    if (ONLY.includes('scroll')) { const fr = await scroll(browser, S); extraSheets[`scroll-${S.name}`] = fr; }
    if (ONLY.includes('rm')) extraSheets[`rm-${S.name}`] = await stack(browser, S, 'rm', { reducedMotion: 'reduce' });
    if (ONLY.includes('guard')) await guard(browser, S);
  }
  await browser.close();
  if (ONLY.includes('nowebgl')) {
    const b2 = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
    for (const S of SIZES) extraSheets[`nowebgl-${S.name}`] = await stack(b2, S, 'nowebgl');
    await b2.close();
    const b3 = await chromium.launch({ args: ARGS });
    for (const S of SIZES) await stack(b3, S, 'savedata', {}, () => { Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true, effectiveType: '4g' }) }); });
    await b3.close();
  }
  for (const k in extraSheets) {
    const fr = extraSheets[k]; if (!fr || !fr.length) continue;
    const phone = /phone/.test(k);
    sheet(fr, fr.map(f => path.basename(f, '.png')), path.join(SHOTS, `sheet-${k}.png`), phone ? 8 : 4, phone ? 220 : 400);
  }
  report.seconds = Math.round((Date.now() - t0) / 1000);
  report.pass = !FAIL;
  fs.writeFileSync(path.join(SHOTS, process.env.LH_REPORT || 'report.json'), JSON.stringify(report, null, 1));
  /* the pass/fail table */
  const rows = [];
  for (const k in report.sections) {
    const s = report.sections[k], f = (report.failures || []).filter(x => x.startsWith(k + ':'));
    rows.push(`${f.length ? 'FAIL' : 'pass'}  ${k}${f.length ? '\n        ' + f.map(x => x.slice(k.length + 2)).join('\n        ') : ''}`);
    if (s.points) for (const pt of s.points) rows.push(`        ${pt.id} p=${pt.p}${pt.p === 1 ? ' show' : ''}  det ${pt.canvasSame ? 'ok' : 'FAIL'}/${pt.shotExact ? 'ok' : pt.shotSame ? `~${pt.shotDiff.n}px±${pt.shotDiff.max}` : 'FAIL'}  main ${pt.main[0]} calls ${Math.round(pt.main[1] / 1000)}k tris  mirror ${pt.mirror[0]}  post ${pt.post[0]}  scale ${pt.scale}`);
  }
  console.log(rows.join('\n'));
  console.log(report.pass ? 'PASS' : 'FAIL', `(${report.seconds}s) report: ${path.join(SHOTS, process.env.LH_REPORT || 'report.json')}`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
