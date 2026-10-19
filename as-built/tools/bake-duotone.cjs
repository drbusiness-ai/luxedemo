// Dev-only: bakes the duotone versions of the client's own photos so the page pays no runtime filter cost.
//   office photos  -> Night Ink -> Porcelain duotone with fine grain  (assets/img/*-duo.webp)
//   walk-up frames -> sapphire duotone                                 (assets/img/seq/oNN-duo.webp)
// Usage (repo served on a local port): NODE_PATH=$(npm root -g) node tools/bake-duotone.cjs http://localhost:8102
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const base = process.argv[2] || 'http://localhost:8102';
const root = path.resolve(__dirname, '..');

const OFFICE = { stops: [[0, '#070B1C'], [0.42, '#26345F'], [0.78, '#B9B8C4'], [1, '#F1ECE3']], grain: 4, contrast: 1.12 };
const SAPPHIRE = { stops: [[0, '#070B1C'], [0.38, '#0B1F52'], [0.7, '#1D3D9A'], [1, '#D6E6FF']], grain: 0, contrast: 1.18 };
const jobs = [
  { src: 'assets/img/office-reception.jpg', out: 'assets/img/office-reception-duo.webp', w: 820, map: OFFICE, q: 0.74 },
  { src: 'assets/img/omniyat-tower.jpg', out: 'assets/img/omniyat-tower-duo.webp', w: 820, map: OFFICE, q: 0.74 }
];
for (let i = 1; i <= 18; i++) {
  const n = String(i).padStart(2, '0');
  jobs.push({ src: `assets/img/seq/o${n}.avif`, out: `assets/img/seq/o${n}-duo.webp`, w: 440, map: SAPPHIRE, q: 0.78 });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + '/privacy.html');
  for (const j of jobs) {
    const url = await page.evaluate(async ({ src, w, map, q, seed }) => {
      const img = new Image(); img.src = src; await img.decode();
      const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h), p = d.data;
      const hex = s => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16));
      const st = map.stops.map(([t, s]) => [t, hex(s)]);
      const lut = new Uint8ClampedArray(256 * 3);
      for (let i = 0; i < 256; i++) {
        let t = i / 255; t = Math.min(1, Math.max(0, (t - 0.5) * map.contrast + 0.5));
        let k = 0; while (k < st.length - 2 && t > st[k + 1][0]) k++;
        const [t0, c0] = st[k], [t1, c1] = st[k + 1], u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
        const sm = u * u * (3 - 2 * u);
        for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = c0[ch] + (c1[ch] - c0[ch]) * sm;
      }
      let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < p.length; i += 4) {
        let l = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
        if (map.grain) l += (rnd() - 0.5) * 2 * map.grain;
        const li = Math.max(0, Math.min(255, Math.round(l))) * 3;
        p[i] = lut[li]; p[i + 1] = lut[li + 1]; p[i + 2] = lut[li + 2];
      }
      x.putImageData(d, 0, 0);
      return c.toDataURL('image/webp', q);
    }, { src: '/' + j.src, w: j.w, map: j.map, q: j.q, seed: 1234 });
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(root, j.out), buf);
    console.log(j.out, buf.length);
  }
  await browser.close();
})();
