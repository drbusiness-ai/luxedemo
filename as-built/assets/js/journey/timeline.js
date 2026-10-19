/* AS BUILT · timeline: chapters, dwell remap, monotone cubic tracks, spring, protected bands.
   Pure functions, no allocation in the per-frame paths. */

export const CHAPTERS = [
  { id: '01', label: 'Plan', start: 0.00, holdStart: 0.00, holdEnd: 0.05, end: 0.10, accent: '#A9C8FF' },
  { id: '02', label: 'Structure', start: 0.10, holdStart: 0.14, holdEnd: 0.19, end: 0.20, accent: '#EDB8B0' },
  { id: '03', label: 'Handover', start: 0.20, holdStart: 0.33, holdEnd: 0.40, end: 0.40, accent: '#FFC66E' },
  { id: '04', label: 'Last light', start: 0.40, holdStart: 0.42, holdEnd: 0.47, end: 0.54, accent: '#E07AA6' },
  { id: '05', label: 'Lights on', start: 0.54, holdStart: 0.56, holdEnd: 0.61, end: 0.76, accent: '#FFB35C', hold2: [0.70, 0.76] },
  { id: '06', label: 'As built', start: 0.76, holdStart: 0.92, holdEnd: 1.00, end: 1.00, accent: '#A9C8FF' }
];

/* protected bands: [from, to, minSeconds] */
export const BANDS = [[0.20, 0.34, 1.8], [0.55, 0.57, 0.6]];

/* ---------- dwell remap: camera covers ~8% of its motion inside holds ---------- */
const HOLD_SPEED = 0.12;
const REMAP_N = 1024;
const remapLUT = new Float32Array(REMAP_N + 1);
(function buildRemap() {
  const holds = [];
  CHAPTERS.forEach(c => { if (c.holdEnd > c.holdStart) holds.push([c.holdStart, c.holdEnd]); if (c.hold2) holds.push(c.hold2); });
  const w = p => { for (const h of holds) if (p >= h[0] && p < h[1]) return HOLD_SPEED; return 1; };
  let acc = 0; remapLUT[0] = 0;
  for (let i = 1; i <= REMAP_N; i++) { acc += w((i - 0.5) / REMAP_N); remapLUT[i] = acc; }
  for (let i = 0; i <= REMAP_N; i++) remapLUT[i] /= acc;
})();
export function remap(p) {
  if (p <= 0) return 0; if (p >= 1) return 1;
  const f = p * REMAP_N, i = Math.floor(f), t = f - i;
  return remapLUT[i] + (remapLUT[i + 1] - remapLUT[i]) * t;
}

/* ---------- monotone cubic (Fritsch–Carlson) tracks ----------
   keys: [[p, v0, v1, ...], ...] sorted by p. Times are remapped once (dwell). */
export function makeTrack(keys, useRemap = true) {
  const n = keys.length, dim = keys[0].length - 1;
  const t = new Float64Array(n), v = new Float64Array(n * dim), m = new Float64Array(n * dim);
  for (let i = 0; i < n; i++) { t[i] = useRemap ? remap(keys[i][0]) : keys[i][0]; for (let d = 0; d < dim; d++) v[i * dim + d] = keys[i][d + 1]; }
  for (let d = 0; d < dim; d++) {
    const delta = new Float64Array(Math.max(1, n - 1));
    for (let i = 0; i < n - 1; i++) { const h = t[i + 1] - t[i]; delta[i] = h > 1e-9 ? (v[(i + 1) * dim + d] - v[i * dim + d]) / h : 0; }
    for (let i = 0; i < n; i++) {
      if (i === 0) m[d] = n > 1 ? delta[0] : 0;
      else if (i === n - 1) m[i * dim + d] = delta[n - 2];
      else m[i * dim + d] = (delta[i - 1] * delta[i] <= 0) ? 0 : (delta[i - 1] + delta[i]) / 2;
    }
    for (let i = 0; i < n - 1; i++) {
      if (Math.abs(delta[i]) < 1e-12) { m[i * dim + d] = 0; m[(i + 1) * dim + d] = 0; continue; }
      const a = m[i * dim + d] / delta[i], b = m[(i + 1) * dim + d] / delta[i];
      const s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i * dim + d] = k * a * delta[i]; m[(i + 1) * dim + d] = k * b * delta[i]; }
    }
  }
  return { n, dim, t, v, m };
}
export function sampleTrack(tr, u, out) {
  const { n, dim, t, v, m } = tr;
  if (n === 1 || u <= t[0]) { for (let d = 0; d < dim; d++) out[d] = v[d]; return out; }
  if (u >= t[n - 1]) { for (let d = 0; d < dim; d++) out[d] = v[(n - 1) * dim + d]; return out; }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= u) lo = mid; else hi = mid; }
  const h = t[hi] - t[lo], s = h > 1e-12 ? (u - t[lo]) / h : 0;
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  for (let d = 0; d < dim; d++) out[d] = h00 * v[lo * dim + d] + h10 * h * m[lo * dim + d] + h01 * v[hi * dim + d] + h11 * h * m[hi * dim + d];
  return out;
}

/* ---------- critically damped spring with protected bands ---------- */
export function makeSpring(omega) {
  return { x: 0, v: 0, target: 0, omega };
}
export function stepSpring(s, dt) {
  // slow devices still scrub in real time: integrate long frames (up to 0.1 s) in 1/30 s sub-steps
  dt = Math.min(dt, 0.1);
  if (dt <= 0) return s.x;
  while (dt > 1 / 30 + 1e-6) { stepOne(s, 1 / 30); dt -= 1 / 30; }
  return stepOne(s, dt);
}
function stepOne(s, dt) {
  const w = s.omega, ex = Math.exp(-w * dt), d = s.x - s.target, tmp = (s.v + w * d) * dt;
  let nx = s.target + (d + tmp) * ex;
  let nv = (s.v - w * tmp) * ex;
  // protected bands clamp scene velocity (even a flick plays the whole sweep)
  for (let i = 0; i < BANDS.length; i++) {
    const b = BANDS[i], lo = Math.min(s.x, nx), hi = Math.max(s.x, nx);
    if (hi >= b[0] && lo <= b[1]) {
      const vmax = (b[1] - b[0]) / b[2];
      const dx = nx - s.x, lim = vmax * dt;
      if (Math.abs(dx) > lim) { nx = s.x + Math.sign(dx) * lim; nv = Math.sign(dx) * vmax; }
    }
  }
  if (Math.abs(nx - s.target) < 1e-6 && Math.abs(nv) < 1e-6) { nx = s.target; nv = 0; }
  s.x = nx; s.v = nv;
  return nx;
}
export function snapSpring(s, p) { s.x = s.target = p; s.v = 0; }

export function chapterAt(p) {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (p >= CHAPTERS[i].start - 1e-6) return i;
  return 0;
}
export const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
