/* AS BUILT · the night layer ("life"): car rivers on the main roads, one draw of light points (street lamps,
   the far-city light carpet, the Palm drawn in light, the Marina, aviation lights), two beacons (Mina by Azizi on
   the Palm, One by Omniyat in Business Bay), and the touched-window map behind the cursor lamp and tap-to-light.
   Everything is a pure function of the global uniforms (uTime, uNight, uWave) plus uPalm / uBeacon; nothing is
   allocated per frame. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { U, UNIFORM_DECL } from './materials.js';
import { MAP } from './city.js';
import { remap, makeTrack, sampleTrack } from './timeline.js';

const SQ = Math.SQRT1_2;
/* the Palm: trunk base on the coast (x + z = -5200), axis toward the NW, art-directed, compressed */
export const PALM = { c0: [-5289, 90], a: [-SQ, -SQ], b: [SQ, -SQ], crescentU: 3100, crescentR: 2500, minaAng: 60 };
const palmXZ = (u, v) => [PALM.c0[0] + PALM.a[0] * u + PALM.b[0] * v, PALM.c0[1] + PALM.a[1] * u + PALM.b[1] * v];
export const MINA = (() => { const t = PALM.minaAng * Math.PI / 180; return palmXZ(PALM.crescentU + PALM.crescentR * Math.cos(t), PALM.crescentR * Math.sin(t)); })();

/* seeded random (deterministic layout) */
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function vnoise2(seed) {
  const h = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7 + seed * 17.13) * 43758.5453; return v - Math.floor(v); };
  return (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    return (h(i, j) * (1 - ux) + h(i + 1, j) * ux) * (1 - uz) + (h(i, j + 1) * (1 - ux) + h(i + 1, j + 1) * ux) * uz; };
}
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
/* walk a polyline every `step` metres, calling fn(x, z, tx, tz, s) */
function walk(pts, step, fn, jitter, R) {
  let acc = 0, next = jitter ? R() * step : 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    while (next <= acc + L) { const t = next - acc; fn(a[0] + tx * t, a[1] + tz * t, tx, tz, next); next += step * (jitter ? 0.6 + 0.8 * R() : 1); }
    acc += L;
  }
}

/* ---------- shared GLSL: a world segment expanded to a screen-space ribbon (never thinner than minPx) ---------- */
const RIBBON_GLSL = /* glsl */`
vec4 ribbon(vec3 A, vec3 B, float wM, float minPx, vec2 corner, out float wpx, out float energy){
  vec4 a = projectionMatrix * viewMatrix * vec4(A, 1.), b = projectionMatrix * viewMatrix * vec4(B, 1.);
  if (a.w < 2. || b.w < 2.) { wpx = 0.; energy = 0.; return vec4(2., 2., 2., 1.); }
  vec2 hr = uRes * .5;
  vec2 sa = a.xy / a.w * hr, sb = b.xy / b.w * hr;
  vec2 d = sb - sa; float L = length(d);
  vec2 dir = L > 1e-4 ? d / L : vec2(0., 1.);
  vec2 n = vec2(-dir.y, dir.x);
  vec4 p = mix(a, b, corner.x);
  float pxm = hr.y * projectionMatrix[1][1] / p.w;
  float w = wM * pxm;
  wpx = max(w, minPx);
  float Lp = max(L, minPx);
  energy = clamp((w * max(L, 1e-3)) / (wpx * Lp), 0., 1.);
  vec2 off = n * corner.y * wpx * .5 + dir * (corner.x * 2. - 1.) * (Lp - L) * .5;
  p.xy += off / hr * p.w;
  return p;
}
float gate603(vec2 xz, float lag, float ramp){ return clamp((uWave - length(xz - uO603.xz) - lag) / ramp, 0., 1.); }
`;

/* ---------- car rivers ---------- */
const ROAD_N = 1024;
const CAR_VERT = /* glsl */`
attribute vec2 corner;
attribute vec4 aCar;   // road row, offset 0..1, speed (fraction of the road per second, signed), lane offset (m)
attribute float aTone;
uniform sampler2D uRoads; uniform float uCarK;
varying vec3 vCol; varying float vAcross; varying float vAlong; varying float vWpx;
vec4 roadAt(float s, float row){
  float x = s * ${(ROAD_N - 1).toFixed(1)}; float i = floor(x), f = x - i;
  vec4 a = texelFetch(uRoads, ivec2(int(i), int(row)), 0), b = texelFetch(uRoads, ivec2(int(min(i + 1., ${(ROAD_N - 1).toFixed(1)})), int(row)), 0);
  return mix(a, b, f);
}
void main(){
  float s = fract(aCar.y + uTime * aCar.z);
  vec4 r = roadAt(s, aCar.x);
  float dirS = sign(aCar.z);
  vec2 t = normalize(r.zw + 1e-6) * dirS;
  vec2 n = vec2(-t.y, t.x);
  vec2 c = r.xy + vec2(-r.w, r.z) / max(length(r.zw), 1e-6) * aCar.w;
  bool head = aCar.w > 0.;
  float len = head ? 5.5 : 7.5;
  vec3 A = vec3(c.x - t.x * len, 1.4, c.y - t.y * len), B = vec3(c.x, 1.4, c.y);
  float wpx, energy;
  vec4 p = ribbon(A, B, 1.9, 1.25, corner, wpx, energy);
  // dusk: half the traffic already runs on its lights before the wave arrives (thin threads, a third as bright)
  float early = step(fract(aCar.y * 13.7 + aCar.x * .618), .5) * smoothstep(.36, .5, uNight) * .65;
  float g = max(gate603(c, 250., 700.), early) * uNight * uCarK;
  vec3 col = head ? vec3(1., .9, .76) * 1.7 : vec3(1., .2, .1) * 1.6;
  vCol = col * aTone * g * mix(.22, 1., energy);
  if (g < .002) p = vec4(2., 2., 2., 1.);
  gl_Position = p;
  vAcross = corner.y; vAlong = corner.x; vWpx = wpx;
}`;
const CAR_FRAG = /* glsl */`
varying vec3 vCol; varying float vAcross; varying float vAlong; varying float vWpx;
void main(){
  float d = abs(vAcross) * vWpx * .5;
  float a = 1. - smoothstep(max(vWpx * .5 - 1., 0.), vWpx * .5, d);
  // a light streak: brightest at the lamp end
  a *= .45 + .55 * vAlong;
  gl_FragColor = vec4(vCol * a, 1.);
}`;

function makeCars(geo, count) {
  const roads = geo.roads.filter(r => r.pts.length > 1 && polyLen(r.pts) > 400);
  const rows = roads.length;
  const data = new Float32Array(ROAD_N * rows * 4);
  const lens = [];
  roads.forEach((r, row) => {
    const pts = r.pts, L = polyLen(pts); lens.push(L);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    let k = 1;
    for (let i = 0; i < ROAD_N; i++) {
      const s = i / (ROAD_N - 1) * L;
      while (k < pts.length - 1 && cum[k] < s) k++;
      const a = pts[k - 1], b = pts[k], seg = Math.max(cum[k] - cum[k - 1], 1e-6), t = Math.min(1, Math.max(0, (s - cum[k - 1]) / seg));
      const o = (row * ROAD_N + i) * 4;
      data[o] = a[0] + (b[0] - a[0]) * t; data[o + 1] = a[1] + (b[1] - a[1]) * t;
      data[o + 2] = (b[0] - a[0]) / seg; data[o + 3] = (b[1] - a[1]) / seg;
    }
  });
  const tex = new THREE.DataTexture(data, ROAD_N, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  // share of the traffic: SZR carries the most, then the arterials; the Business Bay roads either side of the canal
  // carry enough to draw threads of light through the 05 foreground
  const weight = roads.map((r, i) => lens[i] * (r.kind === 'szr' ? 3.2 : r.kind === 'art' ? 1.6 : r.kind === 'bay' ? 1.5 : r.kind === 'cross' ? 0.9 : 0.6) * Math.sqrt(r.w / 30));
  const wsum = weight.reduce((a, b) => a + b, 0);
  const R = rng(4242);
  const car = new Float32Array(count * 4), tone = new Float32Array(count);
  let n = 0;
  roads.forEach((r, row) => {
    const m = row === roads.length - 1 ? count - n : Math.round(count * weight[row] / wsum);
    const L = lens[row];
    const lanes = Math.max(1, Math.min(4, Math.round(r.w / 14)));
    // traffic in platoons: cluster centres along the road, cars spread round them
    const nc = Math.max(2, Math.round(L / 420));
    const centres = []; for (let i = 0; i < nc; i++) centres.push(R());
    for (let i = 0; i < m && n < count; i++, n++) {
      const dir = R() < 0.5 ? 1 : -1;
      const lane = 1 + Math.floor(R() * lanes);
      const off = dir * Math.min(r.w * 0.44, (lane - 0.5) * (r.w * 0.42 / lanes) + 2);
      const c = centres[Math.floor(R() * nc)] + (R() - 0.5) * (R() < 0.7 ? 0.035 : 0.4);
      const v = (r.kind === 'szr' ? 24 : r.kind === 'art' ? 19 : 14) * (0.85 + 0.3 * R());
      car.set([row, ((c % 1) + 1) % 1, dir * v / L, off], n * 4);
      tone[n] = 0.6 + 0.6 * R();
    }
  });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('corner', new THREE.Float32BufferAttribute([0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1], 2));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3));
  g.setAttribute('aCar', new THREE.InstancedBufferAttribute(car, 4));
  g.setAttribute('aTone', new THREE.InstancedBufferAttribute(tone, 1));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uRoads: { value: tex }, uCarK: { value: 1 } }, U),
    vertexShader: UNIFORM_DECL + RIBBON_GLSL + CAR_VERT, fragmentShader: CAR_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 3;
  return mesh;
}

/* ---------- light points: street lamps, light carpet, Palm, Marina, aviation (one draw) ---------- */
const PT_VERT = /* glsl */`
attribute vec3 aCol; attribute vec4 aP;   // kind, order/phase, size (m), gate distance (m)
uniform float uPalm, uMinPx;
varying vec3 vC; varying float vSoft;
void main(){
  vec4 mv = viewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 1.);
  float kind = aP.x;
  float pxm = uRes.y * .5 * projectionMatrix[1][1] / dist;
  float sz = aP.z * pxm;
  float px = max(sz, uMinPx);
  float energy = clamp(pow(sz / px, 1.15), .06, 1.);
  float g;
  float head = 0.;
  if (kind < .5) {                                                                        // street lamps follow the wave,
    g = clamp((uWave - aP.w - 150.) / 300., 0., 1.);
    vec3 p3 = fract(position.xzx * .1031); p3 += dot(p3, p3.yzx + 33.33);
    g = max(g, step(fract((p3.x + p3.y) * p3.z), .55) * smoothstep(.36, .5, uNight) * .5);   // but half are on at dusk
  }
  else if (kind < 1.5) g = clamp((uWave - min(aP.w, 8200. + 600. * aP.y) - 200.) / 600., 0., 1.);  // far carpet
  else if (kind < 2.5) {                                                                  // the Palm, drawn in light
    float k = uPalm - aP.y;
    g = smoothstep(0., .012, k);
    head = exp(-k * k / .00018) * step(0., k) * step(uPalm, .995) * 2.5;
  }
  else if (kind < 3.5) g = clamp((uWave - 8200. - 150. * aP.y) / 500., 0., 1.);       // Marina
  else g = step(.5, fract(uTime * .5 + aP.y)) * clamp((uWave - aP.w) / 200., 0., 1.);   // aviation: 1 s blink, frozen with the clock
  float T = exp(-uHazeDensity * .35 * max(dist - 2000., 0.));
  vC = aCol * (g + head) * energy * T * uNight;
  vSoft = sz < px ? 1. : 0.;
  gl_PointSize = px;
  if (vC.r + vC.g + vC.b < .0005) gl_Position = vec4(2., 2., 2., 1.);
}`;
const PT_FRAG = /* glsl */`
varying vec3 vC; varying float vSoft;
void main(){
  vec2 q = gl_PointCoord - .5;
  float r2 = dot(q, q) * 4.;
  float a = exp(-r2 * 2.6) * (1. - smoothstep(.7, 1., r2));
  gl_FragColor = vec4(vC * a * 1.6, 1.);
}`;

function makePoints(geo, mapImg, MAP, opts) {
  const P = [], C = [], A = [];
  const R = rng(9137);
  const add = (x, y, z, col, kind, ord, size, gateD) => { P.push(x, y, z); C.push(col[0], col[1], col[2]); A.push(kind, ord, size, gateD); };
  const o603 = geo.omniyat;
  const d603 = (x, z) => Math.hypot(x - o603[0], z - o603[1]);
  const LED = [1.25, 1.02, .74], SOD = [1.3, .6, .19], PEARL = [1.15, .92, .66], COOL = [.62, .76, 1.05];
  // street lamps along every road, both kerbs
  for (const r of geo.roads) {
    if (r.pts.length < 2) continue;
    const col = r.kind === 'szr' || r.kind === 'art' ? LED : SOD;
    const step = r.kind === 'szr' ? 34 : 38;
    for (const side of [-1, 1]) {
      const off = side * (r.w * 0.5 - 1.5);
      walk(r.pts, step, (x, z, tx, tz) => { const px = x - tz * off, pz = z + tx * off; add(px, 11, pz, col, 0, 0, 1.7, d603(px, pz)); });
    }
    if (r.kind === 'szr') walk(r.pts, 30, (x, z) => add(x, 12, z, LED, 0, 0, 1.6, d603(x, z)));
  }
  // promenades: the canal and Burj Lake outlined in lamps (the water reads as a dark ribbon edged in light)
  for (const side of [-1, 1]) {
    const off = side * (geo.canalWidth * 0.5 + 5);
    walk(geo.canal, 22, (x, z, tx, tz) => { const px = x - tz * off, pz = z + tx * off; add(px, 4, pz, PEARL, 0, 0, 1.6, d603(px, pz)); });
  }
  walk(geo.lake.concat([geo.lake[0]]), 16, (x, z) => add(x, 3, z, PEARL, 0, 0, 1.5, d603(x, z)));
  // the far city: a light carpet to the horizon (land only), thickened along a few highways that run off the map
  const NC = opts.carpet;
  const vn = vnoise2(3), vn2 = vnoise2(11);
  const cx = 600, cz = -200, coast = geo.coast;
  let placed = 0, guard = 0;
  while (placed < NC * 0.72 && guard++ < NC * 40) {
    const ang = R() * Math.PI * 2, rr = 5600 + Math.pow(R(), 1.7) * 21000;
    const x = cx + Math.sin(ang) * rr, z = cz - Math.cos(ang) * rr;
    if (x + z < -coast + 120) continue;
    if (x > MAP.x0 && x < MAP.x0 + MAP.size && z > MAP.z0 && z < MAP.z0 + MAP.size) continue;
    const dens = Math.pow(vn(x / 1700, z / 1700), 1.6) * 1.4 + 0.25 * vn2(x / 400, z / 400);
    if (R() > dens) continue;
    const hue = R();
    const col = hue < 0.55 ? SOD : hue < 0.85 ? PEARL : COOL;
    const k = 0.45 + 0.55 * R();
    add(x, 4 + R() * 30, z, [col[0] * k, col[1] * k, col[2] * k], 1, R(), 9, d603(x, z));
    placed++;
  }
  // highways and the coast road: strings of light converging on the horizon
  const strings = [
    [[-950 - 3400 - 10, 3400], [-950 - 17000, 17000]], [[3900, -4850], [16000, -16950]],          // SZR beyond the map, SW and NE
    [[2600, 2400], [16000, 15800]], [[7200, 600], [24000, 9000]], [[4800, -2800], [22000, -7000]],  // E44, E311-ish, Al Ain road
    [[-4400, -900], [-15200, 10000]]                                                                   // Jumeirah coast road
  ];
  for (const s of strings) walk(s, 26, (x, z) => { if (x + z < -coast + 60) return; if (x > MAP.x0 && x < MAP.x0 + MAP.size && z > MAP.z0 && z < MAP.z0 + MAP.size) return; add(x, 10, z, R() < 0.5 ? LED : SOD, 1, R(), 6, d603(x, z)); placed++; }, true, R);
  // the Palm: trunk, 16 fronds, crescent (Atlantis bright at the apex); aOrder drives the draw-on
  const palmPts = (u, v, ord, col, size) => { const [x, z] = palmXZ(u, v); add(x, 3 + R() * 6, z, [col[0] * .55, col[1] * .55, col[2] * .55], 2, ord, size * .7, 0); };
  const VILLA = [1.2, .64, .26];
  for (let u = 0; u <= 2300; u += 18) { for (const s of [-1, 1]) palmPts(u, s * (120 + R() * 8), (u / 2300) * 0.22, PEARL, 7); if (u % 36 === 0) palmPts(u, 0, (u / 2300) * 0.22, LED, 6); }
  for (let k = 0; k < 8; k++) for (const s of [-1, 1]) {
    const u0 = 2150 + k * 235, L = 1650 - k * 120, phi = (16 + k * 5) * Math.PI / 180;
    for (let t = 0; t <= L; t += 15) {
      const f = t / L, bend = f * f * 260;
      const u = u0 + Math.sin(phi) * t + bend, v = s * (120 + Math.cos(phi) * t);
      const ord = 0.22 + (k / 8) * 0.42 + f * 0.06;
      palmPts(u, v + s * 26, ord, VILLA, 7); palmPts(u, v - s * 26, ord, VILLA, 7);
    }
  }
  for (let deg = -112; deg <= 112; deg += 0.55) {
    const t = deg * Math.PI / 180, ord = 0.7 + Math.abs(deg) / 112 * 0.29;
    for (const rr of [PALM.crescentR - 55, PALM.crescentR + 55]) palmPts(PALM.crescentU + rr * Math.cos(t), rr * Math.sin(t), ord, Math.abs(deg) < 6 ? [2.2, 1.6, 1.0] : PEARL, Math.abs(deg) < 6 ? 10 : 7);
  }
  // the Marina, beside the Palm: towers as vertical strings of lit floors
  {
    const base = [PALM.c0[0] - SQ * 2900 + 300, PALM.c0[1] + SQ * 2900 + 300];
    for (let i = 0; i < 46; i++) {
      const x = base[0] + (R() - 0.5) * 1300, z = base[1] + (R() - 0.5) * 900 + (x - base[0]) * 0.6;
      if (x + z < -coast + 80) continue;
      const h = 90 + Math.pow(R(), 0.8) * 300;
      const col = R() < 0.7 ? PEARL : SOD;
      for (let y = 8; y < h; y += 9) if (R() < 0.62) add(x + (R() - 0.5) * 18, y, z + (R() - 0.5) * 18, col, 3, R(), 7, 0);
      add(x, h + 3, z, [6, 0.6, 0.3], 4, R(), 4, 0);
    }
  }
  // aviation lights on the tall towers (the Burj carries its own)
  for (const p of geo.plots) {
    const top = p[4] + p[8] + (p[20] || 0);
    if (top < 190) continue;
    add(p[0], top + 2, p[1], [7, 0.75, 0.32], 4, R(), 2.6, d603(p[0], p[1]) + 300);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aP', new THREE.Float32BufferAttribute(A, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uPalm: { value: 0 }, uMinPx: { value: opts.minPx || 1.35 } }, U),
    vertexShader: UNIFORM_DECL + PT_VERT, fragmentShader: PT_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = 4;
  return { mesh: pts, count: P.length / 3 };
}

/* ---------- beacons: thin vertical shafts of light over the two verified addresses ---------- */
const BEACON_VERT = /* glsl */`
attribute vec2 corner; attribute vec4 aB;   // x, z, base y, colour index
uniform float uBeacon;
varying float vAcross; varying float vAlong; varying float vWpx; varying float vE; varying float vK;
void main(){
  float H = 1500. * uBeacon;
  vec3 A = vec3(aB.x, aB.z, aB.y), B = vec3(aB.x, aB.z + max(H, 1.), aB.y);
  float wpx, energy;
  vec4 p = ribbon(A, B, 3., 1.6, corner, wpx, energy);
  if (uBeacon < .002) p = vec4(2., 2., 2., 1.);
  gl_Position = p;
  vAcross = corner.y; vAlong = corner.x; vWpx = wpx; vE = energy; vK = aB.w;
}`;
const BEACON_FRAG = /* glsl */`
uniform float uBeacon;
varying float vAcross; varying float vAlong; varying float vWpx; varying float vE; varying float vK;
void main(){
  float x = abs(vAcross);
  float core = exp(-x * x * 9.);
  float glow = exp(-x * x * 2.2) * .35;
  float fade = (1. - smoothstep(.0, 1., vAlong)) * (.15 + .85 * exp(-vAlong * 5.));
  vec3 c = vK > .5 ? vec3(1., .66, .36) : vec3(1., .8, .58);
  gl_FragColor = vec4(c * (core * .75 + glow * .4) * fade * mix(.45, 1., vE) * uNight * smoothstep(0., .25, uBeacon), 1.);
}`;
function makeBeacons(spots) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('corner', new THREE.Float32BufferAttribute([0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1], 2));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3));
  const b = new Float32Array(spots.length * 4); spots.forEach((s, i) => b.set(s, i * 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 4));
  g.instanceCount = spots.length;
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uBeacon: { value: 0 } }, U),
    vertexShader: UNIFORM_DECL + RIBBON_GLSL + BEACON_VERT, fragmentShader: UNIFORM_DECL + BEACON_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = 6;
  return m;
}

/* ---------- touched map (cursor lamp, tap-to-light): 256^2 texels over the district map, value = touch time + 1 ---------- */
function makeTouched(MAP) {
  const N = 256, data = new Float32Array(N * N);
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  let any = false;
  return {
    tex, N,
    stamp(x, z, r, t) {
      const k = N / MAP.size, cu = (x - MAP.x0) * k, cv = (z - MAP.z0) * k, rr = Math.max(0.75, r * k);
      let changed = false;
      for (let v = Math.max(0, Math.floor(cv - rr)); v <= Math.min(N - 1, Math.ceil(cv + rr)); v++)
        for (let u = Math.max(0, Math.floor(cu - rr)); u <= Math.min(N - 1, Math.ceil(cu + rr)); u++) {
          if ((u + 0.5 - cu) ** 2 + (v + 0.5 - cv) ** 2 > rr * rr) continue;
          const i = v * N + u; if (data[i] === 0) { data[i] = t + 1; changed = true; }
        }
      if (changed) { tex.needsUpdate = true; any = true; }
      return changed;
    },
    clear() { if (!any) return; data.fill(0); tex.needsUpdate = true; any = false; },
    get any() { return any; }
  };
}

export function makeNight(geo, mapTex, opts = {}) {
  const phone = !!opts.phone;
  const cars = makeCars(geo, phone ? 800 : 2400);
  const pts = makePoints(geo, mapTex.userData.img, MAP, { carpet: phone ? 10000 : 24000, minPx: phone ? 1.2 : 1.35 });
  const omni = geo.omniyat;
  const beacons = makeBeacons([[omni[0], omni[1], 168, 1], [MINA[0], MINA[1], 30, 0]]);
  const touched = makeTouched(MAP);
  U.uTouched.value = touched.tex;
  U.uTouchRect.value.set(MAP.x0, MAP.z0, MAP.size, 0);
  /* ray picking for the lamp: towers as oriented boxes, otherwise the ground plane */
  // the two heroes are their own meshes, not plots: add them as boxes so they can be tapped too
  const plots = geo.plots.concat([
    [geo.omniyat[0], geo.omniyat[1], 46, 30, 160, -geo.omniyat[2] * Math.PI / 180, 0, 0, 0],
    [geo.burj[0], geo.burj[1], 70, 70, 640, 0, 0, 0, 0]
  ]);
  const ray = new THREE.Ray(), ndc = new THREE.Vector2(), inv = new THREE.Vector3();
  function pick(camera, x, y, w, h, out) {
    ndc.set(x / w * 2 - 1, -(y / h) * 2 + 1);
    ray.origin.setFromMatrixPosition(camera.matrixWorld);
    ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(ray.origin).normalize();
    const o = ray.origin, d = ray.direction;
    let best = Infinity, bi = -1;
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i], H = p[4] + p[8], c = Math.cos(p[5]), s = Math.sin(p[5]);
      // into the box frame (rotation about y by rot, same convention as the tower vertex shader)
      const ox = o.x - p[0], oz = o.z - p[1];
      const lx = c * ox - s * oz, lz = s * ox + c * oz, dx = c * d.x - s * d.z, dz = s * d.x + c * d.z;
      const hw = p[2] * 0.5 + 4, hd = p[3] * 0.5 + 4;
      let t0 = 0, t1 = best;
      const slab = (o1, d1, lo, hi) => { if (Math.abs(d1) < 1e-9) return o1 >= lo && o1 <= hi; let a = (lo - o1) / d1, b = (hi - o1) / d1; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); return t0 <= t1; };
      if (slab(lx, dx, -hw, hw) && slab(o.y, d.y, 0, H) && slab(lz, dz, -hd, hd) && t0 < best) { best = t0; bi = i; }
    }
    if (bi >= 0) { const p = plots[bi]; out.set(p[0], Math.max(p[2], p[3]) * 0.6 + 20, p[1]); return true; }
    if (d.y < -1e-4) { const t = -o.y / d.y; out.set(o.x + d.x * t, 70, o.z + d.z * t); return true; }
    return false;
  }
  /* ---------- tracks the night layer owns (a keys-*.json track of the same name wins) ---------- */
  const T = {};
  for (const k in NIGHT_KEYS) T[k] = makeTrack(NIGHT_KEYS[k]);
  const SHOW = makeTrack(SHOW_KEYS, false);
  const o1 = new Float64Array(1), s9 = new Float64Array(9);
  const val = (tracks, name, u) => sampleTrack((tracks && tracks[name]) || T[name], u, o1)[0];
  const cm = new THREE.Vector3();
  const state = { palm: 0, beacons: 0, glint: 0, streak: 0, green: 0, cars: 0 };
  let lastClearP = 1;
  const api = {
    cars, points: pts.mesh, beacons, touched, MINA, PALM,
    meshes: [cars, pts.mesh, beacons],
    pointCount: pts.count, state,
    /* world anchors for projected labels (beacon tops) */
    anchors: { omniyat: new THREE.Vector3(omni[0], 168, omni[1]), mina: new THREE.Vector3(MINA[0], 30, MINA[1]) },
    apply(p, tracks, night, showQ, postU) {
      const u = remap(p);
      for (const k in state) state[k] = val(tracks, k, u);
      if (showQ > 0) { state.palm = 1; state.beacons = 1; state.cars = 1; }
      pts.mesh.material.uniforms.uPalm.value = state.palm;
      beacons.material.uniforms.uBeacon.value = state.beacons;
      cars.material.uniforms.uCarK.value = state.cars;
      U.uGlint.value = state.glint; U.uGreen.value = state.green;
      if (postU && postU.uStreak) postU.uStreak.value = state.streak;
      const on = night > 0.005 || showQ > 0;
      cars.visible = on && state.cars > 0.002;
      pts.mesh.visible = on;
      beacons.visible = on && state.beacons > 0.002;
      // the cursor-lit map resets when the visitor scrolls back before the 603 light
      if (p < 0.55 && lastClearP >= 0.55) touched.clear();
      lastClearP = p;
      if (api.flush) api.flush();
    },
    /* showcase truck: crane up from the chapter 06 plan and truck west -> east across the night map at ~62 deg */
    showcaseCam(q, out) {
      const k = q <= 0 ? 0 : q >= 0.12 ? 1 : (t => t * t * (3 - 2 * t))(q / 0.12);
      sampleTrack(SHOW, Math.max(q, 0.12), s9);
      let h = s9[4]; while (h - out[4] > 180) h -= 360; while (h - out[4] < -180) h += 360;
      s9[4] = h;
      for (let i = 0; i < 8; i++) out[i] += (s9[i] - out[i]) * k;
    },
    /* cursor lamp (desktop hover) and tap-to-light (phone): returns true when the map changed */
    cursor(camera, x, y, w, h, clock, tap) {
      if (!pick(camera, x, y, w, h, cm)) return false;
      return touched.stamp(cm.x, cm.z, tap ? Math.max(cm.y * 0.5, 40) : 150, clock);
    },
    /* pointer wiring: only in chapter 05 (lights on), only after 603 has lit */
    bind(ctx) {
      if (api.bound) return; api.bound = true;
      const live = () => { const p = ctx.getP(); return p >= 0.556 && p <= 0.78; };
      let pend = null, down = null;
      const flush = () => {
        if (!pend) return;
        const [x, y, tap] = pend; pend = null;
        const [w, h] = ctx.size();
        if (api.cursor(ctx.camera, x, y, w, h, ctx.clock(), tap)) ctx.markDirty();
      };
      api.flush = flush;
      window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && live()) pend = [e.clientX, e.clientY, false]; }, { passive: true });
      window.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') down = [e.clientX, e.clientY, performance.now()]; }, { passive: true });
      window.addEventListener('pointerup', e => {
        if (!down || e.pointerType === 'mouse') return;
        const [x0, y0, t0] = down; down = null;
        if (Math.hypot(e.clientX - x0, e.clientY - y0) > 12 || performance.now() - t0 > 450 || !live()) return;
        if (e.target && e.target.closest && e.target.closest('a,button,input,select,textarea,label,summary,[data-nyla-open],nav,header')) return;
        pend = [e.clientX, e.clientY, true];
      }, { passive: true });
    }
  };
  return api;
}

/* night-layer tracks (journey p; the dwell remap is applied like every other key) */
const NIGHT_KEYS = {
  palm: [[0, 0], [0.64, 0], [0.72, 1]],
  beacons: [[0, 0], [0.66, 0], [0.72, 1]],
  glint: [[0, 0], [0.45, 0], [0.468, 1], [0.474, 1], [0.49, 0]],
  streak: [[0, 0], [0.455, 0], [0.47, 1], [0.485, 0]],
  green: [[0, 0], [0.5008, 0], [0.5022, 1], [0.5032, 1], [0.5042, 0]],
  cars: [[0, 0], [0.55, 0], [0.6, 1]]
};
/* showcase camera keys over q (0..1): [q, target x, y, z, dist, heading, pitch, fov, roll] */
const SHOW_KEYS = [
  [0.12, -5600, 0, -2500, 5200, 0, -62, 34, 0],
  [0.55, -2400, 0, -1500, 5000, 2, -63, 34, 0],
  [1.0, 1500, 0, -760, 4800, 4, -64, 34, 0]
];
