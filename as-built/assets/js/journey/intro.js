/* AS BUILT · intro particles (chapter 00). Drafting dust converges into LUXE HAVEN (sampled from
   'Archivo Expanded' on a canvas), holds, then streams down the plan's polylines while the hairlines
   draw on behind the particle front. One Points draw; a pure function of introT (seconds). */
import * as THREE from '../../vendor/three/three.module.min.js';

/* seconds: each particle forms over FORM after a delay in [0, DELAY]; the word holds; then particle i
   leaves at TS + order_i * SPREAD (+ jitter) and lands FLY later, where its hairline segment draws on */
export const T = { FORM: 0.95, DELAY: 0.35, HOLD: 0.38, FLY: 0.82, SPREAD: 1.15, JIT: 0.12, FADE: 0.28 };
T.TS = T.DELAY + T.FORM + T.HOLD;
T.TOTAL = T.TS + T.SPREAD + T.JIT + T.FLY + T.FADE;

const VERT = /* glsl */`
attribute vec2 aWord; attribute vec3 aPlan; attribute vec4 aA; attribute vec4 aB;
uniform float uT, uPx, uAlpha;
uniform float FORM, DELAY, TS, FLY, SPREAD, JIT, FADE;
uniform vec3 uLine, uSpark;
varying vec3 vCol; varying float vA;
vec2 bez(vec2 a, vec2 c, vec2 b, float t){ float u = 1. - t; return u * u * a + 2. * u * t * c + t * t * b; }
float expoOut(float x){ return x >= 1. ? 1. : 1. - pow(2., -10. * x); }
float inOut(float x){ return x < .5 ? 4. * x * x * x : 1. - pow(-2. * x + 2., 3.) * .5; }
void main(){
  // 1 · form: from a loose cloud around the word, along a curved path, expo-out
  vec2 start = aWord + aB.xy * vec2(.55, .5) + vec2(.18, -.06) * aB.z;
  vec2 d1 = aWord - start, n1 = vec2(-d1.y, d1.x);
  vec2 c1 = mix(start, aWord, .45) + n1 * (aB.z - .5) * .7;
  float f = clamp((uT - aA.x * DELAY) / FORM, 0., 1.);
  vec2 pos = bez(start, c1, aWord, expoOut(f));
  // hold: a faint living shimmer on the letters
  pos += vec2(sin(uT * 2.3 + aB.w * 40.), cos(uT * 1.9 + aB.z * 40.)) * .0012;
  // 2 · stream: from the letter down onto the plan point (projected live, so it follows the camera)
  vec4 cp = projectionMatrix * viewMatrix * vec4(aPlan, 1.);
  vec2 plan = cp.xy / max(cp.w, 1e-3);
  float t0 = TS + aA.y * SPREAD + aA.z * JIT;
  float s = clamp((uT - t0) / FLY, 0., 1.);
  vec2 d2 = plan - aWord, n2 = vec2(-d2.y, d2.x);
  vec2 c2 = mix(aWord, plan, .5) + n2 * (aB.w - .5) * .5 + vec2(0., -.12);
  pos = s > 0. ? bez(aWord, c2, plan, inOut(s)) : pos;
  // alpha: fade in while forming, burn bright in flight, then settle into the drawn line
  float land = clamp((uT - t0 - FLY) / FADE, 0., 1.);
  vA = smoothstep(0., .35, f) * (1. - land) * uAlpha * (.55 + .45 * aA.w);
  float spark = step(.95, aA.w);
  vCol = mix(uLine * (1.15 + .5 * s * (1. - s) * 4.), uSpark, spark);
  gl_PointSize = uPx * (1.9 + spark * .5 + .7 * s * (1. - s) * 4.);
  gl_Position = vec4(pos, 0., 1.);
}`;
const FRAG = /* glsl */`
varying vec3 vCol; varying float vA;
void main(){
  if (vA < .004) discard;
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .12, d) * vA;
  gl_FragColor = vec4(vCol, a);
}`;

/* seeded PRNG (deterministic layouts) */
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/* wait for the expanded static face (Safari's canvas fontStretch is unreliable), 800 ms cap */
export function loadWordFont() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
  return Promise.race([
    document.fonts.load('500 100px "Archivo Expanded"').then(f => f && f.length > 0).catch(() => false),
    new Promise(r => setTimeout(() => r(false), 800))
  ]);
}

/* sample the wordmark into NDC positions. Desktop: one line between the copy column and the rail.
   Portrait: LUXE / HAVEN stacked in the upper 40%. */
function sampleWord(n, cssW, cssH, expanded, rand) {
  const portrait = cssW / cssH < 0.8;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(cssW); cv.height = Math.ceil(cssH);
  const g = cv.getContext('2d', { willReadFrequently: true });
  const face = expanded ? '"Archivo Expanded", "Archivo", sans-serif' : '"Archivo", sans-serif';
  const lines = portrait ? ['LUXE', 'HAVEN'] : ['LUXE HAVEN'];
  const track = 0.06;
  const widthAt = (txt, fs) => { g.font = `500 ${fs}px ${face}`; let w = 0; for (const ch of txt) w += g.measureText(ch).width + fs * track; return w - fs * track; };
  const target = portrait ? cssW * 0.8 : cssW * 0.38;
  let fs = 100; fs = fs * target / Math.max(...lines.map(l => widthAt(l, fs)));
  if (!expanded) { try { g.fontStretch = 'expanded'; } catch (e) { /* not supported */ } }
  g.font = `500 ${fs}px ${face}`;
  g.fillStyle = '#fff'; g.textBaseline = 'middle';
  const cx = portrait ? cssW * 0.5 : cssW * 0.665, cy = portrait ? cssH * 0.27 : cssH * 0.44;
  const lh = fs * 1.02;
  lines.forEach((l, i) => {
    const w = widthAt(l, fs);
    let x = cx - w / 2;
    const y = cy + (i - (lines.length - 1) / 2) * lh;
    for (const ch of l) { g.fillText(ch, x, y); x += g.measureText(ch).width + fs * track; }
  });
  const x0 = Math.max(0, Math.floor(cx - target / 2 - 4)), x1 = Math.min(cv.width, Math.ceil(cx + target / 2 + 4));
  const y0 = Math.max(0, Math.floor(cy - lh * lines.length / 2 - fs * 0.3)), y1 = Math.min(cv.height, Math.ceil(cy + lh * lines.length / 2 + fs * 0.3));
  const data = g.getImageData(x0, y0, x1 - x0, y1 - y0).data, w = x1 - x0;
  const px = [];
  for (let i = 0, k = 3; k < data.length; i++, k += 4) if (data[k] > 150) px.push(i);
  const out = new Float32Array(n * 2);
  if (!px.length) return out;
  for (let i = 0; i < n; i++) {
    const j = px[Math.floor(rand() * px.length)];
    const sx = x0 + (j % w) + rand(), sy = y0 + Math.floor(j / w) + rand();
    out[i * 2] = sx / cssW * 2 - 1; out[i * 2 + 1] = 1 - sy / cssH * 2;
  }
  return out;
}

/* plan targets: points on the visible hairline segments, weighted by length, with their draw order */
function samplePlan(n, hairGeo, camera, rand) {
  const A = hairGeo.attributes.aA.array, B = hairGeo.attributes.aB.array, O = hairGeo.attributes.aOrder.array;
  const segs = [], v = new THREE.Vector3();
  const inView = (x, y, z) => { v.set(x, y, z).project(camera); return Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && v.z < 1; };
  let total = 0, oMin = 1, oMax = 0;
  for (let i = 0; i < O.length; i++) {
    const a = i * 3;
    if (!inView(A[a], A[a + 1], A[a + 2]) && !inView(B[a], B[a + 1], B[a + 2])) continue;
    const l = Math.hypot(B[a] - A[a], B[a + 2] - A[a + 2]);
    if (l < 1) continue;
    total += l; segs.push([i, total]);
    oMin = Math.min(oMin, O[i]); oMax = Math.max(oMax, O[i]);
  }
  const plan = new Float32Array(n * 3), order = new Float32Array(n);
  if (!segs.length) return { plan, order, oMin: 0, oMax: 1 };
  for (let k = 0; k < n; k++) {
    const r = rand() * total;
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (segs[m][1] < r) lo = m + 1; else hi = m; }
    const i = segs[lo][0], a = i * 3, u = rand();
    plan[k * 3] = A[a] + (B[a] - A[a]) * u; plan[k * 3 + 1] = A[a + 1]; plan[k * 3 + 2] = A[a + 2] + (B[a + 2] - A[a + 2]) * u;
    order[k] = O[i];
  }
  return { plan, order, oMin, oMax: Math.max(oMax, oMin + 1e-3) };
}

export function makeIntro({ count, hairMesh, camera, cssW, cssH, expanded }) {
  const rand = rng(0x1a2b3c);
  const word = sampleWord(count, cssW, cssH, expanded, rand);
  const pl = samplePlan(count, hairMesh.geometry, camera, rand);
  const aA = new Float32Array(count * 4), aB = new Float32Array(count * 4);
  const span = pl.oMax - pl.oMin;
  for (let i = 0; i < count; i++) {
    aA[i * 4] = rand();                                   // form delay
    aA[i * 4 + 1] = (pl.order[i] - pl.oMin) / span;       // stream order (draw front)
    aA[i * 4 + 2] = rand();                               // jitter
    aA[i * 4 + 3] = rand();                               // brightness / spark (top 8%)
    const ang = rand() * Math.PI * 2, rad = Math.sqrt(rand());
    aB[i * 4] = Math.cos(ang) * rad; aB[i * 4 + 1] = Math.sin(ang) * rad;
    aB[i * 4 + 2] = rand(); aB[i * 4 + 3] = rand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aWord', new THREE.Float32BufferAttribute(word, 2));
  g.setAttribute('aPlan', new THREE.Float32BufferAttribute(pl.plan, 3));
  g.setAttribute('aA', new THREE.Float32BufferAttribute(aA, 4));
  g.setAttribute('aB', new THREE.Float32BufferAttribute(aB, 4));
  const line = new THREE.Color('#A9C8FF').convertSRGBToLinear(), spark = new THREE.Color('#FFC66E').convertSRGBToLinear().multiplyScalar(2.4);
  const uniforms = {
    uT: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: 1 }, uLine: { value: line.lerp(new THREE.Color(1, 1, 1), 0.25).multiplyScalar(2.1) }, uSpark: { value: spark }
  };
  for (const k of ['FORM', 'DELAY', 'TS', 'FLY', 'SPREAD', 'JIT', 'FADE']) uniforms[k] = { value: T[k] };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false; points.renderOrder = 30;
  /* hairline draw-on that follows the particle front: segments with aOrder <= uDraw are drawn */
  const drawAt = t => {
    const k = Math.min(1, Math.max(0, (t - T.TS - T.FLY - T.JIT * 0.5) / T.SPREAD));
    return k >= 1 ? 1 : pl.oMin + span * k;
  };
  return {
    points, uniforms, drawAt,
    dispose() { g.dispose(); mat.dispose(); }
  };
}
