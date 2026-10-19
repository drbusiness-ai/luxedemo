/* Derives assets/data/keys-portrait.json (aspect < 0.8) from keys-desktop.json.
   Portrait frames put the hero in the upper 58% (copy sits in the bottom 42%), use a longer
   vertical FOV so the narrow width still holds the subject, and aim at the Burj in 03-04.
   Run: node tools/build-journey-keys-portrait.cjs */
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'assets', 'data');
const K = JSON.parse(fs.readFileSync(path.join(dir, 'keys-desktop.json'), 'utf8'));
const plots = JSON.parse(fs.readFileSync(path.join(dir, 'plots.json'), 'utf8'));
const D = Math.PI / 180, B = plots.burj, O = plots.omniyat;
const az = (dx, dz) => ((Math.atan2(dx, -dz) / D) + 360) % 360;

// plan framing (01 and 06): Burj lower-left, One by Omniyat upper-right, both above the copy band
function plan(fov) {
  const aspect = 0.462, Hm = 3060, Wm = Hm * aspect;
  const v = [O[0] - B[0], O[1] - B[1]], vAz = az(v[0], v[1]);
  const bx = 0.32, by = 0.55, ox = 0.70, oy = 0.14;
  const th = Math.atan2((ox - bx) * Wm, (by - oy) * Hm) / D, h = vAz - th;
  const R = [Math.cos(h * D), Math.sin(h * D)], Up = [Math.sin(h * D), -Math.cos(h * D)];
  const rx = (bx - 0.5) * Wm, uy = (0.5 - by) * Hm;
  const c = [B[0] - rx * R[0] - uy * Up[0], B[1] - rx * R[1] - uy * Up[1]];
  return { tgt: [Math.round(c[0]), 0, Math.round(c[1])], dist: Math.round(Hm / 2 / Math.tan(fov / 2 * D)), h: +h.toFixed(1), pt: -90, fov, roll: 0 };
}
const out = JSON.parse(JSON.stringify(K));
out.note = 'Portrait keys (aspect < 0.8), derived by tools/build-journey-keys-portrait.cjs from keys-desktop.json.';
for (const k of out.cam) {
  if (k.pt === -90) { Object.assign(k, plan(k.p > 0.5 ? 36 : 34)); delete k.pos; continue; }
  if (k.pos && k.p >= 0.33 && k.p <= 0.47) {
    // aim at the Burj, lift the pitch so its full height sits above the copy band
    const a = az(B[0] - k.pos[0], B[1] - k.pos[2]);
    // 03 (poster gate): a long lens (fov 40) so the Burj runs nearly the full height; 04 opens back up
    const tele = k.p <= 0.4;
    k.h = +(a + (k.p >= 0.42 ? 6 : 2)).toFixed(1); k.fov = tele ? 40 : 54; k.pt = +(tele ? k.pt - 0.5 : k.pt + 8).toFixed(1); k.roll = 0;
    continue;
  }
  k.fov = Math.min(60, Math.round(k.fov * 1.45)); k.roll = 0;
  if (k.pt > -60) k.pt = +(k.pt + 4).toFixed(1);
}
out.tracks.focusY = [[0, 0.4], [0.13, 0.36], [0.21, 0.38], [0.3, 0.35]];
out.tracks.scrim = [[0, 0.16], [0.29, 0.16], [0.315, 0.33], [0.4, 0.33], [0.415, 0.16], [1, 0.16]];
fs.writeFileSync(path.join(dir, 'keys-portrait.json'), JSON.stringify(out, null, 1));
console.log('keys-portrait.json', out.cam.map(k => `${k.p}:h${k.h}/fov${k.fov}`).join(' '));
