/* AS BUILT · hairlines: one instanced quad per segment, expanded in screen space, anti-aliased on
   distance to the centreline, drawn on while aOrder < uDraw. One draw call. */
import * as THREE from '../../vendor/three/three.module.min.js';

const VERT = /* glsl */`
attribute vec3 aA; attribute vec3 aB; attribute vec2 aStyle; attribute float aOrder;
uniform vec2 uRes; uniform float uWidth; uniform float uDraw; uniform float uRise;
varying float vSide; varying float vWpx; varying float vKind; varying float vShow;
void main(){
  vec4 a = projectionMatrix * viewMatrix * vec4(aA, 1.);
  vec4 b = projectionMatrix * viewMatrix * vec4(aB, 1.);
  float t = position.x;
  vec4 p = mix(a, b, t);
  vec2 sa = a.xy / max(a.w, 1e-3) * uRes * .5, sb = b.xy / max(b.w, 1e-3) * uRes * .5;
  vec2 dir = normalize(sb - sa + 1e-5);
  vec2 n = vec2(-dir.y, dir.x);
  float wpx = uWidth * aStyle.x + 1.;
  vec2 off = n * position.y * wpx * .5 + dir * (t * 2. - 1.) * .5;
  p.xy += off / (uRes * .5) * p.w;
  gl_Position = p;
  vSide = position.y; vWpx = wpx; vKind = aStyle.y;
  vShow = step(aOrder, uDraw);
}`;
const FRAG = /* glsl */`
uniform float uAlpha; uniform vec3 uColor; uniform vec3 uCoral;
varying float vSide; varying float vWpx; varying float vKind; varying float vShow;
void main(){
  if (vShow < .5) discard;
  float d = abs(vSide) * vWpx * .5;
  float core = (vWpx - 1.) * .5;
  float a = 1. - smoothstep(core - .5, core + .5, d);
  vec3 c = vKind > 1.5 ? uCoral : uColor * (vKind > .5 ? 1.25 : 1.);
  float alpha = a * uAlpha * (vKind > .5 ? 1. : .62);
  if (alpha < .003) discard;
  gl_FragColor = vec4(c * alpha, alpha);
}`;

export function makeHairlines(geo, plotCount) {
  const segs = []; // [ax,az,bx,bz,width,kind]
  const add = (a, b, w, k) => segs.push([a[0], a[1], b[0], b[1], w, k]);
  const polyline = (pts, w, k, closed) => { for (let i = 0; i < pts.length - 1; i++) add(pts[i], pts[i + 1], w, k); if (closed) add(pts[pts.length - 1], pts[0], w, k); };
  const offset = (pts, off) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1; return [p[0] - tz / l * off, p[1] + tx / l * off]; });
  // Burj Y (heaviest) first, then canal, roads, plots
  {
    const rot = 0.32, W = 27, L = 60, rj = W / Math.sqrt(3), pts = [];
    for (let i = 0; i < 3; i++) {
      const th = rot + i * Math.PI * 2 / 3, ax = [Math.cos(th), Math.sin(th)], px = [-Math.sin(th), Math.cos(th)];
      const jm = th - Math.PI / 3; pts.push([Math.cos(jm) * rj, Math.sin(jm) * rj]);
      const c = [ax[0] * (L - W / 2), ax[1] * (L - W / 2)];
      for (let k = 0; k <= 10; k++) { const ph = -Math.PI / 2 + k / 10 * Math.PI; pts.push([c[0] + W / 2 * (Math.cos(ph) * ax[0] + Math.sin(ph) * px[0]), c[1] + W / 2 * (Math.cos(ph) * ax[1] + Math.sin(ph) * px[1])]); }
    }
    polyline(pts.map(p => [p[0] + geo.burj[0], p[1] + geo.burj[1]]), 2.2, 1, true);
    const ring = []; for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; ring.push([Math.cos(t) * 185, Math.sin(t) * 185]); }
    polyline(ring, 0.4, 0, true);
  }
  polyline(offset(geo.canal, geo.canalWidth / 2), 1.0, 1); polyline(offset(geo.canal, -geo.canalWidth / 2), 1.0, 1);
  polyline(geo.lake, 1.0, 1, true);
  for (const r of geo.roads) {
    if (r.w >= 30) { polyline(offset(r.pts, r.w / 2), 0.5, 0); polyline(offset(r.pts, -r.w / 2), 0.5, 0); }
    else polyline(r.pts, 0.2, 0);
  }
  // 603 ring around One by Omniyat (Signal Coral) and its leader
  { const [ox, oz] = geo.omniyat; const ring = []; for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2; ring.push([ox + Math.cos(t) * 120, oz + Math.sin(t) * 120]); } polyline(ring, 1.1, 2, true); // leader runs toward the open plan between the two heroes (plan heading 16°): down-left, then a level shelf
    const L1 = [-0.875, 0.485], L2 = [-0.961, -0.276];
    const a = [ox + L1[0] * 120, oz + L1[1] * 120], b = [ox + L1[0] * 330, oz + L1[1] * 330], c = [b[0] + L2[0] * 260, b[1] + L2[1] * 260];
    add(a, b, 0.9, 2); add(b, c, 0.9, 2); }
  // north arrow and a 500 m scale bar, set for the chapter 01/06 plan framing (heading 16°)
  {
    const hd = 16 * Math.PI / 180, R = [Math.cos(hd), Math.sin(hd)], Up = [Math.sin(hd), -Math.cos(hd)];
    const at = (o, r, u) => [o[0] + R[0] * r + Up[0] * u, o[1] + R[1] * r + Up[1] * u];
    const na = [1052, 38];
    const circ = []; for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2; circ.push([na[0] + Math.cos(t) * 34, na[1] + Math.sin(t) * 34]); }
    polyline(circ, 0.35, 0, true);
    const tip = [na[0], na[1] - 72], tail = [na[0], na[1] + 46];
    add(tail, tip, 0.8, 1); add(tip, [tip[0] - 13, tip[1] + 26], 0.8, 1); add(tip, [tip[0] + 13, tip[1] + 26], 0.8, 1);
    const nb = [tip[0], tip[1] - 22];  // the letter N, upright on screen
    const p0 = at(nb, -9, 0), p1 = at(nb, -9, 26), p2 = at(nb, 9, 0), p3 = at(nb, 9, 26);
    add(p0, p1, 0.6, 1); add(p1, p2, 0.6, 1); add(p2, p3, 0.6, 1);
    const s0 = [477, 187];
    add(s0, at(s0, 500, 0), 0.7, 1);
    for (let m = 0; m <= 500; m += 100) add(at(s0, m, 0), at(s0, m, m % 500 === 0 ? 26 : 13), 0.6, m % 500 === 0 ? 1 : 0);
    for (let m = 0; m < 100; m += 20) add(at(s0, m, 0), at(s0, m, 7), 0.35, 0);
  }
  // plot outlines
  for (const p of geo.plots.slice(0, plotCount)) {
    const [x, z, w, d, , rot, arch, , , , , podH, podS, , , , , outside] = p;
    if (outside) continue;
    const c = Math.cos(rot), s = Math.sin(rot);
    const tr = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
    if (arch === 3) { const ring = []; for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; ring.push(tr(Math.cos(t) * w / 2, Math.sin(t) * d / 2)); } polyline(ring, 0, 0, true); }
    else polyline([tr(-w / 2, -d / 2), tr(w / 2, -d / 2), tr(w / 2, d / 2), tr(-w / 2, d / 2)], 0, 0, true);
    if (podH > 0) { const k = podS; polyline([tr(-w * k / 2, -d * k / 2), tr(w * k / 2, -d * k / 2), tr(w * k / 2, d * k / 2), tr(-w * k / 2, d * k / 2)], 0, 0, true); }
  }
  // Omniyat footprint
  { const [ox, oz, rd] = geo.omniyat; const r = -rd * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); const tr = (lx, lz) => [ox + c * lx + s * lz, oz - s * lx + c * lz]; polyline([tr(-23, -15), tr(23, -15), tr(23, 15), tr(-23, 15)], 1.4, 1, true); }
  // north arrow + scale bar (plan furniture), south-east of Business Bay
  { const nx = 2550, nz = 1000; add([nx, nz + 120], [nx, nz - 160], 0.9, 1); add([nx, nz - 160], [nx - 40, nz - 80], 0.9, 1); add([nx, nz - 160], [nx + 40, nz - 80], 0.9, 1);
    const sx = 1900, sz = 1250; add([sx, sz], [sx + 500, sz], 0.9, 1); for (let i = 0; i <= 5; i++) add([sx + i * 100, sz - (i % 5 ? 14 : 34)], [sx + i * 100, sz + (i % 5 ? 14 : 34)], 0.6, 1); }

  // cumulative draw order by length
  let total = 0; const lens = segs.map(s => { const l = Math.hypot(s[2] - s[0], s[3] - s[1]); total += l; return l; });
  const n = segs.length;
  const aA = new Float32Array(n * 3), aB = new Float32Array(n * 3), aStyle = new Float32Array(n * 2), aOrder = new Float32Array(n);
  let acc = 0;
  segs.forEach((s, i) => { aA.set([s[0], 0.8, s[1]], i * 3); aB.set([s[2], 0.8, s[3]], i * 3); aStyle.set([s[4], s[5]], i * 2); acc += lens[i]; aOrder[i] = acc / total; });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(aA, 3));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 3));
  g.setAttribute('aStyle', new THREE.InstancedBufferAttribute(aStyle, 2));
  g.setAttribute('aOrder', new THREE.InstancedBufferAttribute(aOrder, 1));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: 1 }, uDraw: { value: 1 }, uAlpha: { value: 1 }, uRise: { value: 0 }, uColor: { value: new THREE.Color(0.396, 0.578, 1.0).multiplyScalar(0.85) }, uCoral: { value: new THREE.Color(1.0, 0.11, 0.074).multiplyScalar(1.1) } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 10;
  return { mesh, count: n };
}
