#!/usr/bin/env node
/* Builds assets/data/plots.json for the AS BUILT journey.
   Art-directed (not survey-accurate) geography of Downtown + Business Bay.
   1 unit = 1 m, origin = Burj Khalifa base, +X east, -Z north.
   Deterministic: same seed, same file. Run: node tools/build-journey-data.cjs

   The skyline is composed, not sprinkled: most towers are mid-rise (h = 50 + 170 r^2.2, median ~90 m, a few
   percent over 200 m), and the height lives in a few hand-placed clusters with open ground between them:
   the Downtown ring round the Burj, the Business Bay canal bend, and the DIFC / Sheikh Zayed Road spine.
   Every tower carries a crown type so no two neighbours share a silhouette:
   0 box crown, 1 slanted cut top, 2 slim crown + mast, 3 fin-frame crown screen, 4 flat parapet. */
const fs = require('fs');
const path = require('path');

let seed = 20261019;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
const pick = (weights) => { const s = weights.reduce((a, b) => a + b, 0); let r = rnd() * s; for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; } return weights.length - 1; };
const D2R = Math.PI / 180;
/* smooth value noise for clustering (deterministic) */
const hsh = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const vnoise = (x, z, s = 0) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (hsh(i, j, s) * (1 - ux) + hsh(i + 1, j, s) * ux) * (1 - uz) + (hsh(i, j + 1, s) * (1 - ux) + hsh(i + 1, j + 1, s) * ux) * uz; };

/* ---------- geography ---------- */
const BURJ = [0, 0];
const OMNIYAT = [1300, -560, 8]; // x, z, rotDeg (long faces face ~S/N)
const FOOT = [-1900, -1900, 3100, 1500]; // plinth / model footprint minX,minZ,maxX,maxZ
const COAST = 5200; // Gulf where x+z < -COAST
const SZR_C = -950; // Sheikh Zayed Road: x+z = SZR_C
const canal = [
  [5200, -1750], [4300, -1450], [3500, -1120], [2700, -760], [2050, -470], [1500, -330], [1050, -230],
  [850, 30], [760, 380], [640, 760], [380, 1080], [-150, 1290], [-800, 1330], [-1400, 1150],
  [-1950, 760], [-2550, 230], [-3150, -420], [-3650, -1100], [-4100, -1700]
];
const CANAL_W = 95;
/* Burj Lake: an irregular shoreline (not an ellipse): the long basin south-east of the tower, a promenade spit
   reaching in from the south (the souk side), a rounded bay under the Burj Park and a narrow eastern arm */
const LAKE_C = [260, 230], LAKE_ROT = -28 * D2R;
const lake = [];
{
  const n = 72;
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2;
    let a = 330, b = 120;
    let r = 1 + 0.07 * Math.sin(2 * t + 1.1) + 0.045 * Math.sin(5 * t + 0.4) + 0.025 * Math.sin(9 * t + 2.0);
    // the southern spit (souk promenade) pushes in; the eastern arm stretches out
    r -= 0.32 * Math.exp(-Math.pow((t - 1.75) / 0.2, 2));
    r += 0.16 * Math.exp(-Math.pow((t - 0.05) / 0.32, 2)) + 0.16 * Math.exp(-Math.pow((t - 6.28) / 0.32, 2));
    r -= 0.12 * Math.exp(-Math.pow((t - 4.4) / 0.25, 2));
    const x = Math.cos(t) * a * r, z = Math.sin(t) * b * r;
    lake.push([+(LAKE_C[0] + x * Math.cos(LAKE_ROT) - z * Math.sin(LAKE_ROT)).toFixed(1), +(LAKE_C[1] + x * Math.sin(LAKE_ROT) + z * Math.cos(LAKE_ROT)).toFixed(1)]);
  }
}

const line = (c, from, to, step) => { const pts = []; for (let s = from; s <= to; s += step) { pts.push([+(s).toFixed(0), +(c - s).toFixed(0)]); } return pts; }; // x+z=c param by x
const roads = [
  { w: 64, kind: 'szr', pts: line(SZR_C, -4700, 3900, 200) },
  { w: 40, kind: 'art', pts: line(2350, -1800, 5600, 200) }, // Al Khail-ish, SE of Business Bay
  { w: 34, kind: 'art', pts: line(-2700, -5600, 2600, 200) }, // Al Wasl-ish
  { w: 26, kind: 'art', pts: line(-4100, -6500, 1300, 200) }, // Jumeirah-ish near coast
];
// cross streets perpendicular to SZR: x - z = c
for (const c of [-3600, -2200, -900, 1400, 2900, 4300]) {
  const pts = []; for (let s = -4200; s <= 4600; s += 220) { const x = (s + c) / 2, z = (s - c) / 2; pts.push([+x.toFixed(0), +z.toFixed(0)]); }
  roads.push({ w: c === 1400 ? 36 : 24, kind: 'cross', pts });
}
// Downtown boulevard ring
{ const pts = []; for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI * 2; pts.push([+(140 + Math.cos(t) * 820).toFixed(0), +(160 + Math.sin(t) * 690).toFixed(0)]); } roads.push({ w: 26, kind: 'blvd', pts }); }
// Business Bay streets parallel to the canal (north and south banks)
const canalOffset = (off, i0, i1) => { const pts = []; for (let i = i0; i <= i1; i++) { const a = canal[Math.max(0, i - 1)], b = canal[Math.min(canal.length - 1, i + 1)]; const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz); pts.push([+(canal[i][0] - tz / l * off).toFixed(0), +(canal[i][1] + tx / l * off).toFixed(0)]); } return pts; };
roads.push({ w: 22, kind: 'bay', pts: canalOffset(260, 0, 7) });
roads.push({ w: 22, kind: 'bay', pts: canalOffset(-250, 0, 7) });
roads.push({ w: 18, kind: 'bay', pts: canalOffset(560, 1, 6) });

/* ---------- helpers ---------- */
const distSeg = (px, pz, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / (vx * vx + vz * vz))); return Math.hypot(px - a[0] - vx * t, pz - a[1] - vz * t); };
const distPoly = (px, pz, pts, closed) => { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, pz, pts[i], pts[i + 1])); if (closed) d = Math.min(d, distSeg(px, pz, pts[pts.length - 1], pts[0])); return d; };
const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const canalTan = (px, pz) => { let d = 1e9, best = 0; for (let i = 0; i < canal.length - 1; i++) { const q = distSeg(px, pz, canal[i], canal[i + 1]); if (q < d) { d = q; best = i; } } const a = canal[best], b = canal[best + 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const inLake = (x, z, pad) => inPoly(x, z, lake) || distPoly(x, z, lake, true) < pad;
const inFoot = (x, z) => x > FOOT[0] + 40 && x < FOOT[2] - 40 && z > FOOT[1] + 40 && z < FOOT[3] - 40;
const roadClear = (x, z, r) => { for (const rd of roads) { if (distPoly(x, z, rd.pts) < rd.w / 2 + r + 6) return false; } return true; };

const plots = [];
const occupied = [];
/* camera stations (keys-desktop.json): nothing tall may stand where the camera flies, and the hero frames keep
   their sightlines. Zones [x, z, radius, maxH] (towers taller than maxH are refused; maxH 0 = nothing at all) and
   lines [ax, az, bx, bz, halfWidth, maxH] */
const CAM_ZONES = [
  [2300, -170, 200, 0], [2420, -110, 160, 0],     // 03 poster station (0.33-0.40), 250 m up
  [1650, -380, 180, 0], [1900, -280, 200, 70],     // 04 low glide (0.47), 92 m up
  [2060, -60, 220, 120],                           // 04 omega station (0.50), high
  [820, -40, 200, 0], [880, -150, 150, 0]          // 05a station SW of One by Omniyat (0.56-0.61)
];
const CAM_LINES = [
  [2300, -170, 1650, -380, 110, 120],              // 0.40 -> 0.47 descent
  [1650, -380, 1300, -560, 70, 0],                 // 0.47 sightline to One by Omniyat
  [880, -120, 1300, -560, 90, 0],                  // 05a sightline to the 603 face and the cantilever
  [880, -120, 1330, -380, 70, 0]
];
const zoneBlock = (x, z, r, h) => CAM_ZONES.some(c => Math.hypot(x - c[0], z - c[1]) < c[2] + r && h > c[3]) ||
  CAM_LINES.some(l => distSeg(x, z, [l[0], l[1]], [l[2], l[3]]) < l[4] + r && Math.hypot(x - l[2], z - l[3]) > 60 && h > l[5]);
const free = (x, z, r) => { for (const o of occupied) if (Math.hypot(o[0] - x, o[1] - z) < o[2] + r) return false; return true; };
const reserve = (x, z, r) => occupied.push([x, z, r]);
reserve(BURJ[0], BURJ[1], 190); reserve(OMNIYAT[0], OMNIYAT[1], 75);

function addPlot(o) {
  if (zoneBlock(o.x, o.z, Math.max(o.w || 30, o.d || 30) * 0.6, o.h + (o.crownH || 0))) return false;
  const p = Object.assign({ arch: 0, crownH: 0, taper: 0, twist: 0, podH: 0, podScale: 1, facade: rnd(), lit: 0.55, tier: 1, ct: 0, mast: 0 }, o);
  plots.push(p);
  reserve(p.x, p.z, Math.max(p.w, p.d) * 0.62 * Math.max(1, p.podScale) + 10);
  return true;
}
/* height distributions */
const hFill = (lo = 50, span = 170, k = 2.2) => lo + span * Math.pow(rnd(), k);
/* archetype + crown. arch: 0 slab, 1 tapered, 2 twisted, 3 round/elliptic, 4 stepped (podium + crown).
   crown ct: 0 box, 1 slanted cut, 2 slim crown + mast, 3 fin-frame screen, 4 flat */
const CT_W = [
  [24, 26, 12, 24, 14],   // slab
  [44, 6, 30, 0, 20],     // tapered
  [26, 0, 22, 0, 52],     // twisted
  [36, 14, 26, 14, 10],   // round
  [52, 0, 34, 14, 0]      // stepped
];
function shape(o, h, archW) {
  const arch = pick(archW || [21, 20, 12, 25, 22]);
  const slender = h > 220 ? rr(5.0, 7.2) : h > 120 ? rr(3.4, 5.4) : rr(1.6, 3.4);
  const w = Math.max(20, Math.min(62, h / slender));
  let d = w / rr(1, 2.6);                       // footprints from square to 1:2.6 slabs
  if (arch === 2) d = w * rr(0.86, 1.0);
  if (arch === 3) d = w * rr(0.6, 1.0);
  d = Math.max(16, d);
  const r = { arch, w: +w.toFixed(1), d: +d.toFixed(1), h: +h.toFixed(1) };
  r.ct = pick(CT_W[arch]);
  if (h < 75 && r.ct === 2) r.ct = 4;           // no masts on mid-rise
  r.crownH = 0; r.mast = 0;
  if (r.ct === 0) r.crownH = arch === 2 ? rr(2, 6) : h * rr(0.05, 0.12);
  else if (r.ct === 1) r.crownH = Math.min(w, d) * rr(0.45, 0.95) + h * 0.03;
  else if (r.ct === 2) { r.crownH = h * rr(0.06, 0.11); r.mast = rr(15, 30); }
  else if (r.ct === 3) r.crownH = rr(7, 15);
  r.crownH = +r.crownH.toFixed(1); r.mast = +r.mast.toFixed(1);
  r.taper = +(arch === 1 ? rr(0.16, 0.34) : arch === 3 ? rr(0, 0.1) : 0).toFixed(3);
  r.twist = +(arch === 2 ? rr(0.55, 1.2) * (rnd() < 0.5 ? -1 : 1) : 0).toFixed(3);
  if (arch === 4 || (arch === 0 && rnd() < 0.35) || (arch === 3 && rnd() < 0.2)) { r.podH = +rr(12, Math.min(40, h * 0.3)).toFixed(1); r.podScale = +rr(1.25, 1.7).toFixed(2); }
  return Object.assign(o, r);
}
function poisson(n, test, minD, make, tries = 60) {
  let placed = 0, attempts = 0;
  while (placed < n && attempts < n * tries) {
    attempts++;
    const c = test.sample();
    if (!test.ok(c[0], c[1])) continue;
    const o = make(c[0], c[1]);
    if (!o) continue;
    const rad = Math.max(o.w, o.d) * 0.62 * Math.max(1, o.podScale || 1);
    if (!free(c[0], c[1], rad + minD * 0.5)) continue;
    if (!roadClear(c[0], c[1], rad)) continue;
    if (distPoly(c[0], c[1], canal) < CANAL_W / 2 + rad + 14) continue;
    if (inLake(c[0], c[1], rad + 30)) continue;
    if (c[0] + c[1] < -COAST + 300) continue;
    if (!addPlot(o)) continue;
    placed++;
  }
  return placed;
}

/* ---------- landmarks (hand-authored silhouettes, 260-380 m, in two clusters) ---------- */
const A = (x, z, h, arch, extra) => { const o = shape({ x, z, rot: 0, seed: rnd(), tier: 0 }, h, null); o.arch = arch; Object.assign(o, extra || {}); if (o.ct !== 2) o.mast = 0; if (o.arch !== 4 && !(extra && extra.podH)) { o.podH = 0; o.podScale = 1; } if (!addPlot(o)) console.log('landmark refused', x, z); };
// Downtown ring round the Burj: a stepped crown of landmarks, all well under the Burj's mid-height
A(470, 520, 306, 1, { w: 42, d: 36, taper: 0.32, crownH: 34, ct: 2, mast: 26, rot: -0.5, lit: 0.6 });                  // Address Downtown-like
A(-330, 640, 372, 4, { w: 40, d: 34, crownH: 30, ct: 0, podH: 30, podScale: 1.6, rot: 0.2, lit: 0.6 });                 // Address Boulevard-like
A(-520, -260, 268, 3, { w: 46, d: 38, taper: 0.08, crownH: 12, ct: 3, lit: 0.55 });
A(640, -340, 285, 0, { w: 50, d: 24, crownH: 30, ct: 1, rot: 0.45 });
A(-260, -540, 262, 2, { w: 38, d: 36, twist: 0.95, crownH: 3, ct: 4, rot: 0.78 });
A(380, 790, 248, 3, { w: 40, d: 30, taper: 0.06, crownH: 18, ct: 2, mast: 20, rot: 0.3 });
// Emirates-towers-like twin triangles NE on SZR (outside the model)
A(1650, -2700, 355, 1, { w: 46, d: 40, taper: 0.55, crownH: 22, ct: 2, mast: 28, rot: 0.78, outside: 1, lit: 0.5 });
A(1520, -2860, 309, 1, { w: 42, d: 36, taper: 0.55, crownH: 18, ct: 0, rot: 0.78, outside: 1, lit: 0.5 });
// DIFC gate cluster
A(1000, -1500, 272, 4, { w: 52, d: 34, crownH: 30, ct: 3, podH: 36, podScale: 1.4, rot: 0.78 });
A(760, -1720, 292, 1, { w: 44, d: 40, taper: 0.22, crownH: 26, ct: 1, rot: 0.78 });
// Business Bay landmarks at the canal bend
A(2050, -900, 300, 2, { w: 40, d: 38, twist: 0.9, crownH: 4, ct: 4 });
A(2560, -420, 330, 3, { w: 46, d: 40, taper: 0.1, crownH: 22, ct: 2, mast: 24 });
A(2240, -1180, 276, 0, { w: 54, d: 26, crownH: 26, ct: 3, rot: 0.42 });
A(1760, -1060, 262, 1, { w: 44, d: 34, taper: 0.28, crownH: 30, ct: 0, rot: -0.4 });
A(2860, -1300, 284, 4, { w: 42, d: 32, crownH: 22, ct: 0, podH: 28, podScale: 1.5, rot: 0.42 });
A(1490, -1260, 240, 2, { w: 36, d: 34, twist: -1.1, crownH: 3, ct: 4 });

/* ---------- SZR spine: a tall wall with breathing gaps ---------- */
{
  const dir = [Math.SQRT1_2, -Math.SQRT1_2], nrm = [Math.SQRT1_2, Math.SQRT1_2];
  const c0 = [SZR_C / 2, SZR_C / 2];
  for (let s = -5200; s <= 5200; s += rr(70, 100)) {
    // gaps of 150 m+ where the cross streets and plazas break the wall
    const gapN = vnoise(s / 520 + 3.3, 1.7, 5);
    if (gapN < 0.3) continue;
    for (const side of [-1, 1]) {
      if (rnd() < 0.24) continue;
      const off = side * rr(95, 150);
      const x = c0[0] + dir[0] * s + nrm[0] * off, z = c0[1] + dir[1] * s + nrm[1] * off;
      const near = Math.abs(s) < 2600;
      const h = near ? hFill(90, 230, 1.5) : hFill(60, 170, 1.8);
      const o = shape({ x, z, rot: 45 * D2R + rr(-0.04, 0.04), seed: rnd(), tier: inFoot(x, z) ? 1 : 2, outside: inFoot(x, z) ? 0 : 1, lit: rr(0.45, 0.7) }, h);
      const rad = Math.max(o.w, o.d) * 0.62 * Math.max(1, o.podScale);
      if (!free(x, z, rad + 8) || !roadClear(x, z, rad) || distPoly(x, z, canal) < CANAL_W / 2 + rad + 10 || x + z < -COAST + 300) continue;
      addPlot(o);
    }
  }
}

/* ---------- cluster fields: towers bunch into blocks with open ground between them ---------- */
const clump = (x, z, s) => vnoise(x / 520 + 11.3, z / 520 - 2.9, s) * 0.7 + vnoise(x / 190 - 4.1, z / 190 + 8.3, s + 1) * 0.3;
const box = (x0, z0, x1, z1) => () => [rr(x0, x1), rr(z0, z1)];
/* ---------- Downtown fill ---------- */
poisson(70, { sample: box(-760, -620, 980, 920), ok: (x, z) => ((x - 140) / 860) ** 2 + ((z - 160) / 730) ** 2 < 1 && Math.hypot(x, z) > 230 && x + z > SZR_C + 140 && clump(x, z, 1) > 0.36 }, 20, (x, z) => {
  const nearLake = inLake(x, z, 170);
  const h = nearLake ? rr(22, 56) : hFill(45, 165, 2.2);
  const ang = Math.atan2(z - 160, x - 140);
  return shape({ x, z, rot: -ang + Math.PI / 2 + rr(-0.08, 0.08), seed: rnd(), lit: rr(0.5, 0.72) }, h, nearLake ? [40, 5, 0, 25, 30] : null);
});
/* ---------- DIFC fill: the financial district stands taller ---------- */
poisson(18, { sample: box(500, -1880, 1500, -1150), ok: (x, z) => inFoot(x, z) }, 24, (x, z) => shape({ x, z, rot: 45 * D2R + rr(-0.05, 0.05), seed: rnd(), lit: rr(0.4, 0.62) }, hFill(80, 170, 1.7)));
/* ---------- Business Bay: clumps along the canal, taller toward the water ---------- */
poisson(124, { sample: box(700, -1880, 3080, 900), ok: (x, z) => inFoot(x, z) && distPoly(x, z, canal) < 760 && x + z < 2350 - 40 && x > 650 + Math.max(0, z) * 0.1 && clump(x, z, 2) > 0.34 }, 16, (x, z) => {
  const t = canalTan(x, z);
  const dc = distPoly(x, z, canal);
  const h = hFill(50, dc < 260 ? 190 : 160, 2.2);
  return shape({ x, z, rot: Math.atan2(-t[1], t[0]) + (rnd() < 0.5 ? 0 : Math.PI / 2) + rr(-0.06, 0.06), seed: rnd(), lit: rr(0.45, 0.75) }, h);
});
/* ---------- south of the canal (inside the model, Al Khail side) ---------- */
poisson(30, { sample: box(-1500, 700, 2400, 1480), ok: (x, z) => inFoot(x, z) && x + z > SZR_C + 120 && clump(x, z, 3) > 0.3 }, 28, (x, z) => shape({ x, z, rot: rr(0, 0.3), seed: rnd(), lit: rr(0.4, 0.65) }, hFill(35, 110, 1.8)));
/* ---------- outside the model: mid-rise districts, only real behind the scan ---------- */
poisson(70, { sample: box(-4200, -4200, 5200, 3600), ok: (x, z) => !inFoot(x, z) && Math.hypot(x - 600, z + 100) < 5200 && x + z > -COAST + 500 }, 70, (x, z) => {
  const h = rr(28, 110) * (rnd() < 0.1 ? 1.8 : 1);
  return shape({ x, z, rot: 45 * D2R + (rnd() < 0.5 ? 0 : Math.PI / 2) + rr(-0.05, 0.05), seed: rnd(), tier: 2, outside: 1, lit: rr(0.35, 0.6) }, h, [26, 16, 6, 28, 24]);
});

/* ---------- no repeated silhouettes side by side: a neighbour that shares archetype, crown and height (±12%)
   takes a different crown and a height step ---------- */
for (let i = 0; i < plots.length; i++) {
  const p = plots[i];
  for (let j = 0; j < i; j++) {
    const q = plots[j];
    if (Math.hypot(p.x - q.x, p.z - q.z) > 260) continue;
    if (p.arch === q.arch && p.ct === q.ct && Math.abs(p.h - q.h) < 0.12 * Math.max(p.h, q.h)) {
      p.ct = (p.ct + 1 + Math.floor(rnd() * 3)) % 5;
      if (p.ct === 2 && p.h < 75) p.ct = 4;
      p.h = +(p.h * (rnd() < 0.5 ? 0.8 : 1.22)).toFixed(1);
      p.crownH = p.ct === 4 ? 0 : p.ct === 1 ? +(Math.min(p.w, p.d) * 0.7).toFixed(1) : p.ct === 3 ? 10 : +(p.h * 0.08).toFixed(1);
      p.mast = p.ct === 2 ? 20 : 0;
    }
  }
}

/* ---------- derived per-plot values ---------- */
for (const p of plots) {
  p.dist603 = Math.hypot(p.x - OMNIYAT[0], p.z - OMNIYAT[1]);
  // rise delay ripples out from the Burj with jitter, 0..0.6
  p.riseDelay = Math.min(0.6, Math.hypot(p.x, p.z) / 5200 * 0.45 + rnd() * 0.15);
  if (p.outside) p.riseDelay = 0;
}
/* ---------- shot corridors, applied after generation so the random sequence (and the rest of the layout) is
   untouched. Lines/zones drop towers from a hero sightline; the sun line keeps the omega sun clear at p=0.50. ---------- */
const SHOT_LINES = [
  [1645, -330, 1300, -560, 60],    // 04 omega station (0.50) to One by Omniyat
  [1450, -318, 1300, -560, 85]     // 05a station (0.56-0.61) to the 603 corner and the cantilever
];
const SHOT_ZONES = [[1645, -330, 200], [1545, -322, 120], [1450, -318, 190],
  [1814, 149, 30], [1639, 134, 30], [1910, -584, 30]];   // 03 poster: no cropped near towers at the left and right frame edges
const SUN_LINE = { from: [1645, -330], az: 253.4 * D2R, len: 9500, hw0: 70, k: 0.035, top0: 118, drop: 0.0055 };
{
  const sd = [Math.sin(SUN_LINE.az), -Math.cos(SUN_LINE.az)];
  for (let i = plots.length - 1; i >= 0; i--) {
    const p = plots[i], r = Math.max(p.w, p.d) * 0.6;
    if (SHOT_ZONES.some(z => Math.hypot(p.x - z[0], p.z - z[1]) < z[2] + r) ||
        SHOT_LINES.some(l => distSeg(p.x, p.z, [l[0], l[1]], [l[2], l[3]]) < l[4] + r && Math.hypot(p.x - l[2], p.z - l[3]) > 60)) { plots.splice(i, 1); continue; }
    const dx = p.x - SUN_LINE.from[0], dz = p.z - SUN_LINE.from[1];
    const t = dx * sd[0] + dz * sd[1], lat = Math.abs(dx * sd[1] - dz * sd[0]);
    if (t > 150 && t < SUN_LINE.len && lat < SUN_LINE.hw0 + SUN_LINE.k * t + r) {
      const cap = SUN_LINE.top0 - SUN_LINE.drop * t, top = p.h + p.crownH + p.mast;
      if (top > cap) { const k = Math.max(0.2, cap / top); p.h = +Math.max(24, p.h * k).toFixed(1); p.crownH = +(p.crownH * k).toFixed(1); p.mast = 0; if (p.ct === 2) p.ct = 0; }
    }
  }
}
plots.sort((a, b) => (a.tier - b.tier) || (b.h - a.h));
const r1 = v => +(+v).toFixed(1), r3 = v => +(+v).toFixed(3);
const out = {
  version: 2,
  note: 'Art-directed layout, not survey-accurate. Generated by tools/build-journey-data.cjs',
  fields: ['x', 'z', 'w', 'd', 'h', 'rot', 'arch', 'seed', 'crownH', 'taper', 'twist', 'podH', 'podScale', 'facade', 'lit', 'riseDelay', 'dist603', 'outside', 'tier', 'ct', 'mast'],
  footprint: FOOT, coast: COAST, szr: SZR_C,
  burj: BURJ, omniyat: OMNIYAT,
  canal, canalWidth: CANAL_W, lake, roads,
  phoneCount: plots.filter(p => p.tier < 2).length > 180 ? 180 : plots.filter(p => p.tier < 2).length,
  plots: plots.map(p => [r1(p.x), r1(p.z), r1(p.w), r1(p.d), r1(p.h), r3(p.rot), p.arch, r3(p.seed), r1(p.crownH), r3(p.taper), r3(p.twist), r1(p.podH), r3(p.podScale), r3(p.facade), r3(p.lit), r3(p.riseDelay), r1(p.dist603), p.outside ? 1 : 0, p.tier, p.ct, r1(p.mast)])
};
const file = process.env.PLOTS_OUT || path.join(__dirname, '..', 'assets', 'data', 'plots.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
const counts = [0, 0, 0]; plots.forEach(p => counts[p.tier]++);
const hs = plots.map(p => p.h).sort((a, b) => a - b);
console.log('plots', plots.length, 'tiers', counts, 'arch', [0, 1, 2, 3, 4].map(a => plots.filter(p => p.arch === a).length), 'ct', [0, 1, 2, 3, 4].map(a => plots.filter(p => p.ct === a).length),
  'median h', hs[hs.length >> 1], '>200m', (plots.filter(p => p.h > 200).length / plots.length).toFixed(3), 'bytes', fs.statSync(file).size);
