/* Renders the journey posters from the live scene (SwiftShader Chromium), canvas only: never with copy baked in.
   Sequence per poster: setTime(0) -> setProgress(p) -> posterMode(true) -> renderOnce() -> canvas.toBlob('image/webp').
   Usage: python3 -m http.server 8107 (repo root), then
          NODE_PATH=$(npm root -g) node tools/render-posters.cjs [name ...]      (LH_URL overrides the page URL,
          LH_SIZES=d|m|d,m picks the crops, LH_OUT writes somewhere other than assets/img/journey)
   Writes assets/img/journey/poster-<name>-d.webp (1600x900) and poster-<name>-m.webp (780x1688, a 390x844 phone at 2x),
   plus office-night-{d,m}.webp.
   One page per size renders every poster in turn: the frame is a pure function of (p, t), so this matches a fresh load. */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = process.env.LH_OUT || path.join(__dirname, '..', 'assets', 'img', 'journey'); // LH_OUT: render elsewhere (smoke tests)
const BASE = process.env.LH_URL || 'http://localhost:8107/index.html';
const QUALITY = +(process.env.LH_Q || 0.82);
/* p = journey progress; show = showcase progress; intro = intro time (0..1) for the first-paint poster */
const POSTERS = {
  pre: { p: 0, intro: 0 },        // first paint: Blueprint Sapphire field, drafting grid, faint plot hatch; the plan is not drawn yet
  '01': { p: 0.04 },              // the hairline plan
  '02': { p: 0.17 },              // the porcelain model on its plinth, studio sky
  '03': { p: 0.34 },              // THE SCAN, poster gate frame
  '04': { p: 0.47 },              // last light over the canal, One by Omniyat
  '05': { p: 0.62 },              // 603 lit, the wave spreading
  '05b': { p: 0.74 },             // lights on: the city, the Palm, beacons
  '06': { p: 0.96 },              // as built, top-down night
  show: { p: 1, show: 0.5 },      // the night map behind the showcase
  // One by Omniyat at blue hour, only the window of Office 603 lit (Office section)
  'office-night': {
    p: 0.62, tracks: { night: 0.85, wave: 0, exposure: 1.1 },
    d: { cam: { pos: [940, 40, -400], h: 67, pt: 9, fov: 38 } },
    m: { cam: { pos: [985, 30, -425], h: 69, pt: 16, fov: 62 } }
  }
};
/* viewport, device scale: the phone poster is the real portrait framing at 2x (dpr cap lifted with ?dpr=2) */
const SIZES = { d: { w: 1600, h: 900, dsf: 1, q: '' }, m: { w: 390, h: 844, dsf: 2, q: '&dpr=2' } };

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(POSTERS);
  const variants = (process.env.LH_SIZES || 'd,m').split(',');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const summary = [];
  for (const v of variants) {
    const Z = SIZES[v];
    const page = await browser.newPage({ viewport: { width: Z.w, height: Z.h }, deviceScaleFactor: Z.dsf });
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + '?nointro&preserve&tier=high' + Z.q, { waitUntil: 'load' });
    await page.evaluate(() => window.LHScene.ready);
    for (const name of names) {
      const P = POSTERS[name]; if (!P) { console.warn('unknown poster', name); continue; }
      const t0 = Date.now();
      const r = await page.evaluate(async ({ P, cam, q }) => {
        const S = window.LHScene;
        S.debugCam(null); for (const k of ['night', 'wave', 'exposure']) S.debugTrack(k, null);
        S.showcase(0);
        S.setTime(0); S.setScale(1);
        if (P.intro !== undefined) S.setIntro(P.intro); else S.skipIntro();
        S.setProgress(P.p);
        if (P.show) S.showcase(P.show);
        S.posterMode(true);
        for (const k in P.tracks || {}) S.debugTrack(k, P.tracks[k]);
        if (cam) S.debugCam(cam);
        S.renderOnce();
        const c = document.querySelector('canvas.stage');
        const blob = await new Promise(res => c.toBlob(res, 'image/webp', q));
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        S.posterMode(false);
        return { b64: btoa(s), w: c.width, h: c.height, info: S.info() };
      }, { P, cam: (P[v] || {}).cam, q: P.q || QUALITY });
      const file = path.join(OUT, `${name === 'office-night' ? name : 'poster-' + name}-${v}.webp`);
      fs.writeFileSync(file, Buffer.from(r.b64, 'base64'));
      const kb = Math.round(fs.statSync(file).size / 1024);
      summary.push({ file: path.basename(file), w: r.w, h: r.h, kb, s: +((Date.now() - t0) / 1000).toFixed(1) });
      console.log(path.basename(file), r.w + 'x' + r.h, kb + ' KB', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
    }
    if (errs.length) console.log('ERRORS', v, errs.join(' | '));
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(summary));
})();
