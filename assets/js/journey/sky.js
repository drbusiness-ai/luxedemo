/* AS BUILT · sky: OKLab-interpolated 256x8 LUT from sky-keys.json, and the one GLSL sky() every surface uses. */
import * as THREE from '../../vendor/three/three.module.min.js';

const srgbToLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexToLin = h => { const n = parseInt(h.slice(1), 16); return [srgbToLin(((n >> 16) & 255) / 255), srgbToLin(((n >> 8) & 255) / 255), srgbToLin((n & 255) / 255)]; };
function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklabToLin([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
export const LUT_W = 256, LUT_H = 8;
/* texel u <-> elevation: more resolution near the horizon */
const uToElev = u => { const x = (u - 0.5) * 2; return Math.sign(x) * x * x * 90; };

export function buildSkyLUT(keys) {
  const data = new Uint16Array(LUT_W * LUT_H * 4);
  const LIN = new Float32Array(LUT_W * LUT_H * 3);
  const toHalf = THREE.DataUtils.toHalfFloat;
  keys.rows.forEach((row, ri) => {
    const stops = row.stops.map(([e, hex]) => [e, linToOklab(hexToLin(hex))]);
    for (let i = 0; i < LUT_W; i++) {
      const e = uToElev((i + 0.5) / LUT_W);
      let j = 0; while (j < stops.length - 2 && e > stops[j + 1][0]) j++;
      const a = stops[j], b = stops[j + 1];
      let t = (e - a[0]) / (b[0] - a[0]); t = Math.max(0, Math.min(1, t));
      t = t * t * (3 - 2 * t) * 0.35 + t * 0.65; // slightly eased, avoids visible kinks at stops
      const lab = [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t];
      const lin = oklabToLin(lab);
      const o = (ri * LUT_W + i) * 4, o3 = (ri * LUT_W + i) * 3;
      LIN[o3] = lin[0] * row.gain; LIN[o3 + 1] = lin[1] * row.gain; LIN[o3 + 2] = lin[2] * row.gain;
      data[o] = toHalf(lin[0] * row.gain); data[o + 1] = toHalf(lin[1] * row.gain); data[o + 2] = toHalf(lin[2] * row.gain); data[o + 3] = toHalf(1);
    }
  });
  const tex = new THREE.DataTexture(data, LUT_W, LUT_H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  /* CPU sampler for ambient/light colours: (row float, elevation deg) -> [r,g,b] linear */
  const sample = (row, elevDeg, out = [0, 0, 0]) => {
    const e = Math.max(-90, Math.min(90, elevDeg)) / 90;
    const u = 0.5 + 0.5 * Math.sign(e) * Math.sqrt(Math.abs(e));
    const fi = Math.max(0, Math.min(LUT_W - 1, u * LUT_W - 0.5)), i0 = Math.floor(fi), i1 = Math.min(LUT_W - 1, i0 + 1), ti = fi - i0;
    const r0 = Math.max(0, Math.min(LUT_H - 1, Math.floor(row))), r1 = Math.min(LUT_H - 1, r0 + 1), tr = Math.max(0, Math.min(1, row - r0));
    for (let c = 0; c < 3; c++) {
      const a = LIN[(r0 * LUT_W + i0) * 3 + c] * (1 - ti) + LIN[(r0 * LUT_W + i1) * 3 + c] * ti;
      const b = LIN[(r1 * LUT_W + i0) * 3 + c] * (1 - ti) + LIN[(r1 * LUT_W + i1) * 3 + c] * ti;
      out[c] = a * (1 - tr) + b * tr;
    }
    return out;
  };
  return { tex, sample };
}
export const rowIndex = (keys, id) => keys.rows.findIndex(r => r.id === id);

/* GLSL: hashing/noise + sky. Requires the global uniforms declared in materials.js (U). */
export const SKY_GLSL = /* glsl */`
#define PI 3.14159265
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm2(vec2 p){ return vnoise(p) * .65 + vnoise(p * 2.13 + 7.1) * .35; }
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }

vec3 lutRow(float elev, float row){
  float e = clamp(elev / (PI * .5), -1., 1.);
  float u = .5 + .5 * sign(e) * sqrt(abs(e));
  return texture(uSkyLUT, vec2(u * (255. / 256.) + .5 / 256., (row + .5) / 8.)).rgb;
}
float hgPhase(float mu, float g){ float g2 = g * g; return (1. - g2) / (4. * PI * pow(max(1. + g2 - 2. * g * mu, 1e-4), 1.5)); }

/* azimuth model: the LUT is the sky profile toward the sun; away from it the sky dims and cools,
   most strongly near the horizon (Earth-shadow side). Shared by the sky, haze and reflections. */
vec3 skyAz(float el, vec3 d){
  vec3 c = lutRow(el, uHourReal);
  vec2 dh = normalize(d.xz + vec2(1e-5, 0.));
  vec2 sh = normalize(uSunDir.xz + vec2(1e-5, 0.));
  float muA = dot(dh, sh);
  float side = pow(muA * .5 + .5, 2.2);
  float hz = exp(-max(el, 0.) * 3.2);
  // away from the sun the low sky turns to the cool Earth-shadow blue (reflections on shaded glass pick this up)
  vec3 coolH = vec3(luma(c)) * vec3(.52, .64, 1.08);
  vec3 anti = mix(c, coolH, hz * .9) * mix(1., .5, hz);
  float sunUp = smoothstep(-.12, .02, uSunDir.y);
  vec3 sunw = c * (1. + (.55 * pow(max(muA, 0.), 4.) * hz + .45 * pow(max(muA, 0.), 36.) * exp(-max(el, 0.) * 1.4)) * sunUp);
  vec3 o = mix(anti, sunw, mix(.35, side, .2 + .8 * sunUp));
  // the low sky dims steadily with azimuth away from a low sun: the sun side of the frame is always the brightest
  float az3 = pow(max(muA, 0.), 3.);
  return o * mix(1., mix(.55, 1.07, az3), exp(-max(el, 0.) * 1.6) * sunUp);
}
/* real-world sky (no sun disc): azimuthal LUT + halo + Belt of Venus + cirrus */
vec3 skyRealBase(vec3 d){
  float el = asin(clamp(d.y, -1., 1.));
  // the sliver between the far ground and the true horizon takes the horizon colour: no dark seam at the skyline
  el = mix(max(el, .0015), el, smoothstep(-.02, -.06, el));
  vec3 c = skyAz(el, d);
  vec2 dh = normalize(d.xz + vec2(1e-5, 0.));
  // blue hour (sun 4-7 deg down, the 603 beat): a deep sapphire zenith over cobalt and lavender, and low on the
  // horizon a band of afterglow, apricot under Venus pink. The band is broad in azimuth (strongest under the set
  // sun, still clear 60-90 deg round from it), so the skyline stands as a silhouette against it in any heading.
  // (below the horizon sliver, as seen in reflections, the LUT's dark ground colour takes over again)
  float bh = smoothstep(3.7, 4.3, uHourReal) * (1. - smoothstep(4.8, 5.4, uHourReal)) * smoothstep(-.06, -.02, el);
  if (bh > 0.) {
    float e = max(el, 0.);
    float sSide = dot(dh, normalize(uSunDir.xz + vec2(1e-5, 0.))) * .5 + .5;
    float azK = mix(.42, 1., pow(sSide, 1.4));
    vec3 cool = mix(vec3(.08, .066, .2), vec3(.022, .04, .15), smoothstep(.04, .2, e));
    cool = mix(cool, vec3(.0055, .015, .068), smoothstep(.12, .5, e));
    float hb = mix(.05, .08, sSide);
    vec3 band = mix(vec3(.8, .31, .085), vec3(.42, .12, .24), smoothstep(.0, hb * .9, e));
    band = mix(band, vec3(.18, .08, .21), smoothstep(hb * .75, hb * 2.4, e));
    float wB = (1. - smoothstep(hb * .55, hb * 3.4, e)) * azK;
    vec3 g = mix(cool, band, wB) * mix(.85, 1.05, azK);
    c = mix(c, g, bh);
  }
  float mu = dot(d, uSunDir);
  float horizonW = exp(-max(el, 0.) * 5.5);
  float halo = hgPhase(mu, .76) * 2.4 + hgPhase(mu, .2) * 1.2;
  c += uSunHalo * halo * (.25 + .75 * horizonW);
  // Belt of Venus over the Earth's shadow (anti-solar, sun 1-6 deg down): a slate-blue shadow band that climbs as
  // the sun sinks, and a soft rose band just above it. Both take the sky's own luminance: a tint, never a glow.
  float anti = max(-dot(dh, normalize(uSunDir.xz + vec2(1e-5, 0.))), 0.);
  if (uVenus > 0.) {
    float sEl = asin(clamp(uSunDir.y, -1., 1.));
    float es = .022 + 1.05 * max(-sEl, 0.);
    float aw = smoothstep(.1, .9, anti) * uVenus;
    float Lc = max(luma(c), 1e-5);
    float wedge = (1. - smoothstep(es - .014, es + .008, el)) * smoothstep(-.03, .002, el);
    float belt = smoothstep(es - .01, es + .028, el) * (1. - smoothstep(es + .045, es + .16, el));
    vec3 slate = vec3(.044, .069, .195) * (Lc * .78 / .0636);
    vec3 rose = vec3(.745, .24, .42) * (Lc * 1.18 / .3735);
    c = mix(c, slate, aw * wedge * .8);
    c = mix(c, rose, aw * belt * .5);
  }
  // night: the city's light dome, low and warm over the land, faint over the Gulf
  if (uNight > 0.) {
    float land = .3 + .7 * smoothstep(-.6, .5, dot(dh, vec2(.7071, .7071)));
    c += vec3(.011, .0062, .0042) * exp(-max(el, 0.) * 11.) * land * uNight;
  }
  // cirrus: stretched value noise on the sky dome
  if (d.y > 0.01 && uCirrus > 0.) {
    vec2 q = d.xz / (d.y + .1);
    // streaks run N-S (across the west-facing view), never radiating from a vanishing point
    q = vec2(q.x * 2.6 - q.y * .22, q.y * .5 + q.x * .32);
    float n0 = fbm2(q * 1.1 + vec2(0., uTime * .004));
    float n = n0 * .78 + vnoise(q * 4.3 + n0 * 1.5) * .22;
    n = smoothstep(.6, .92, n) * smoothstep(.02, .2, d.y) * (1. - smoothstep(.38, .8, d.y)) * .8;
    // lit from below by the low sun: always brighter than the sky behind it
    vec3 lit = c * 1.2 + uSunHalo * (.6 + 2.2 * hgPhase(mu, .55)) * 1.8;
    c = mix(c, lit, n * uCirrus);
  }
  // stars
  if (uStars > 0. && d.y > 0.) {
    vec2 sp = vec2(atan(d.x, d.z) * 180., d.y * 260.);
    vec2 cell = floor(sp); vec2 f = fract(sp) - .5;
    float h = hash12(cell);
    float star = step(.985, h) * smoothstep(.12, .0, length(f + (hash22(cell) - .5) * .5)) * (h - .985) * 60.;
    c += star * uStars * (.7 + .3 * sin(uTime * 3. + h * 50.)) * vec3(.85, .9, 1.);
  }
  return c;
}
float gGreenM = 0.;   // green-flash coverage of the last sliver (set by sunDisc, composited in skyFull)
vec3 sunDisc(vec3 d){
  float el = asin(clamp(d.y, -1., 1.));
  float sel = asin(clamp(uSunDir.y, -1., 1.));
  float az = atan(d.x, -d.z), saz = atan(uSunDir.x, -uSunDir.z);
  float daz = az - saz; daz = mod(daz + PI, 2. * PI) - PI;
  float flatK = 1. + 1.4 * exp(-max(sel, 0.) * 40.);
  vec2 o = vec2(daz * cos(el), (el - sel) * flatK);
  float r = length(o) / uSunSize;
  // omega: while the sun touches the sea an inferior mirage of the disc sits under the horizon line, squashed,
  // joined to the disc by a neck (SDF smooth union); it fades as the sun sinks into it
  float omK = smoothstep(.02, .005, sel) * smoothstep(-.012, -.004, sel);
  float rr = r;
  if (omK > 0.) {
    vec2 o2 = vec2(o.x, (el + sel) * flatK * 1.8);
    float r2 = length(o2) / uSunSize + .12;
    float k = .5;
    float h = clamp(.5 + .5 * (r2 - r) / k, 0., 1.);
    float ru = mix(r2, r, h) - k * h * (1. - h);
    rr = mix(r, ru, omK * smoothstep(-.0015, .002, sel));
  }
  float disc = 1. - smoothstep(.92, 1.04, rr);
  float mu = sqrt(max(1. - rr * rr, 0.));
  float limb = 1. - .6 * (1. - sqrt(mu));
  // the disc stops at the horizon line; below it only the mirage shows (the ground covers the rest)
  // (an inferior mirage exists only while the sun itself is up: once it has sunk, nothing shows below the line)
  float mirK = smoothstep(-.0015, .002, sel);
  disc *= max(smoothstep(-.0035, .0015, el), omK * mirK * smoothstep(-.03, -.0, el) * .75);
  // green flash: the last sliver turns #3DFFB0 for an instant (scrubbed by p, so QA can hold it). It replaces the
  // sky under it rather than adding to it (added to the bright horizon any green reads as cream)
  float gk = uGreen * (1. - smoothstep(-.0015, .0005, sel));
  gGreenM = disc * gk;
  // on the horizon the disc is the brightest thing in the frame, a deep saffron-red ball through the dust
  float lowK = smoothstep(.07, .0, sel) * smoothstep(-.02, -.004, sel);
  vec3 sc = mix(uSunColor, uSunColor * vec3(1.15, .78, .55), lowK) * (1. + 1.8 * lowK);
  return sc * (1. - gk) * disc * limb;
}
vec3 skyModelBase(vec3 d){
  float el = asin(clamp(d.y, -1., 1.));
  vec3 c = lutRow(el, uHourModel);
  // blueprint: radial falloff around the view axis keeps the field from looking flat
  return c;
}
/* scan in the sky: reality follows the projected scan line on the far ground */
float skyRealMask(vec3 d){
  vec2 h = normalize(d.xz + 1e-5);
  vec2 far = uCamPos.xz + h * 8000.;
  float s = dot(far, uScanDir);
  return clamp(uRealAll + smoothstep(0., 240., uScanPos - s), 0., 1.);
}
vec3 skyNoDisc(vec3 d){
  float rm = skyRealMask(d);
  vec3 m = rm < 1. ? skyModelBase(d) : vec3(0.);
  vec3 r = rm > 0. ? skyRealBase(d) : vec3(0.);
  return mix(m, r, rm);
}
vec3 skyFull(vec3 d){
  float rm = skyRealMask(d);
  vec3 c = skyNoDisc(d);
  c += sunDisc(d) * rm;
  c = mix(c, vec3(.05, 1.15, .4), gGreenM * rm);
  return c;
}
/* haze colour along a view ray: the horizon in that azimuth + forward scatter around the sun */
vec3 hazeColor(vec3 d){
  float mu = dot(normalize(vec3(d.x, 0., d.z) + vec3(1e-5, 0., 0.)), normalize(vec3(uSunDir.x, 0., uSunDir.z) + vec3(1e-5, 0., 0.)));
  // the dust under the sun stays well below the sky behind it, so the skyline still reads as a silhouette there
  vec3 c = skyAz(.035, d) * mix(.55, .2, smoothstep(.4, .98, mu) * smoothstep(-.12, .05, uSunDir.y));
  // gold dust toward the sun, rose-mauve dust across and away from it
  float away = smoothstep(.95, .15, mu) * smoothstep(-.12, .05, uSunDir.y);
  c = mix(c, vec3(luma(c)) * vec3(1., .8, 1.06), away * .75);
  // toward the sun the dust is a pale rose-beige, not orange: the ground and parks under it never turn copper
  c = mix(c, vec3(luma(c)) * vec3(1.08, .93, .9), (1. - away) * .45);
  c += uSunHalo * (hgPhase(mu, .7) * .15 + .05) * (1. - smoothstep(-.1, .35, uSunDir.y) * .3);
  return c * uHazeTint;
}
`;
