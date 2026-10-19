/* AS BUILT · hero meshes: Burj Khalifa (Y plan, 26 spiralling setbacks, core tube, spire ~23% of height)
   and One by Omniyat (black-glass slab + a lighter glass box cantilevered out of a notch). Art-directed massing, no logos. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { U, COMMON_FRAG, FACADE_GLSL, makeDepthMaterial } from './materials.js';

export const FLOOR_603 = 6; // confirm with client

function Geo() {
  const pos = [], nrm = [], face = [], edge = [];
  const ccwRing = ring => { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return a < 0 ? ring.slice().reverse() : ring; };
  return {
    /* vertical walls of a plan ring between y0 and y1. smooth: per-vertex flags for rounded runs; matOf(a, b): per-edge material */
    walls(ring, y0, y1, mat, smoothFlags, matOf) {
      ring = ccwRing(ring);
      const n = ring.length; let per = 0; const L = [0];
      for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); L.push(per); }
      const fn = []; for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; const ex = b[0] - a[0], ez = b[1] - a[1], el = Math.hypot(ex, ez) || 1; fn.push([ez / el, 0, -ex / el]); }
      const vn = i => { const p = fn[(i - 1 + n) % n], q = fn[i]; const x = p[0] + q[0], z = p[2] + q[2], l = Math.hypot(x, z) || 1; return [x / l, 0, z / l]; };
      for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n];
        const sm = smoothFlags ? smoothFlags(a, b) : false;
        const m = matOf ? matOf(a, b) : mat;
        const na = sm ? vn(i) : fn[i], nb = sm ? vn((i + 1) % n) : fn[i];
        const P = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
        const NV = [na, nb, nb, na];
        // axisU: flat axis-aligned faces take their along-face coordinate from the plan (x + z), so the panel grid
        // stays continuous where differently shaped rings stack on the same face
        const u = this.axisU ? [a[0] + a[1], b[0] + b[1], b[0] + b[1], a[0] + a[1]] : [L[i], L[i + 1], L[i + 1], L[i]];
        const eu = sm ? [.5, .5, .5, .5] : [0, 1, 1, 0];
        const ev = [0, 0, 1, 1];
        for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(...P[k]); nrm.push(...NV[k]); face.push(u[k], P[k][1], m, sm ? 0 : 1); edge.push(eu[k], ev[k]); }
      }
    },
    cap(ring, y, mat, down) {
      ring = ccwRing(ring);
      let cx = 0, cz = 0; ring.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= ring.length; cz /= ring.length;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const tri = down ? [[cx, cz, .5], [a[0], a[1], 0], [b[0], b[1], 0]] : [[cx, cz, .5], [b[0], b[1], 0], [a[0], a[1], 0]];
        for (const v of tri) { pos.push(v[0], y, v[1]); nrm.push(0, down ? -1 : 1, 0); face.push(v[0], v[1], mat, 0); edge.push(.5, v[2]); }
      }
    },
    box(x0, y0, z0, x1, y1, z1, mat, capMat, botMat) {
      const ring = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]];
      this.walls(ring, y0, y1, mat);
      this.cap(ring, y1, capMat === undefined ? 6 : capMat);
      this.cap(ring, y0, botMat === undefined ? (capMat === undefined ? 6 : capMat) : botMat, true);
    },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 4));
      g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 2));
      g.computeBoundingSphere();
      return g;
    }
  };
}

/* ---------- Burj Khalifa ---------- */
function yPlan(L, W, rot) {
  const pts = [], smooth = new Set();
  const rj = W / Math.sqrt(3);
  for (let i = 0; i < 3; i++) {
    const th = rot + i * Math.PI * 2 / 3;
    const ax = [Math.cos(th), Math.sin(th)], px = [-Math.sin(th), Math.cos(th)];
    const jm = th - Math.PI / 3; // junction before this wing
    const J = [Math.cos(jm) * rj, Math.sin(jm) * rj];
    const Li = Math.max(L[i], W * 0.5 + W * 0.32);
    const c = [ax[0] * (Li - W / 2), ax[1] * (Li - W / 2)], R = W / 2;
    pts.push(J);
    const mid = [(J[0] + c[0] - px[0] * R) / 2, (J[1] + c[1] - px[1] * R) / 2];
    pts.push(mid);
    for (let k = 0; k <= 12; k++) {
      const ph = -Math.PI / 2 + k / 12 * Math.PI;
      const p = [c[0] + R * (Math.cos(ph) * ax[0] + Math.sin(ph) * px[0]), c[1] + R * (Math.cos(ph) * ax[1] + Math.sin(ph) * px[1])];
      pts.push(p); smooth.add(p);
    }
    const jn = th + Math.PI / 3;
    pts.push([((Math.cos(jn) * rj) + c[0] + px[0] * R) / 2, ((Math.sin(jn) * rj) + c[1] + px[1] * R) / 2]);
  }
  return { pts, smooth };
}
export function buildBurj() {
  const g = Geo();
  const rot = 0.32; // wing orientation (art-directed)
  const W0 = 27, W1 = 17;
  const nSet = 26, h0 = 120, hTop = 585;
  // setbacks closer together as they climb; the wing length follows a concave profile (long, splayed base,
  // a slim upper third), and each setback snaps one wing in turn to it: the spiral
  const hs = [0, h0]; for (let k = 1; k <= nSet; k++) hs.push(h0 + (hTop - h0) * Math.pow(k / nSet, 0.9));
  const Lp = y => 19 + 44 * Math.pow(1 - Math.min(y, hTop) / hTop, 1.5);
  const L = [Lp(0), Lp(0), Lp(0)];
  for (let k = 0; k < hs.length - 1; k++) {
    const yb = hs[k], yt = hs[k + 1];
    const W = W0 + (W1 - W0) * Math.pow(yb / hTop, 0.85);
    const { pts, smooth } = yPlan(L, W, rot);
    g.walls(pts, yb, yt, 0, (a, b) => smooth.has(a) && smooth.has(b));
    g.cap(pts, yt, 6);
    if (k >= 1) L[(k - 1) % 3] = Lp(hs[Math.min(k + 2, hs.length - 1)]);
  }
  // the central core reads as its own tube above the last wing (about 40 m), then steps in to the spire base
  const cyl = (r) => { const a = []; for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2; a.push([Math.cos(t) * r, Math.sin(t) * r]); } return a; };
  const tubes = [[585, 606, 11.6], [606, 626, 11.0], [626, 640, 8.4]];
  for (const [a, b, r] of tubes) { const c = cyl(r); g.walls(c, a, b, 0, () => true); g.cap(c, b, 6); }
  const spire = [[640, 690, 6.2, 5.0], [690, 740, 4.6, 3.4], [740, 790, 3.0, 1.9], [790, 828, 1.6, 0.25]];
  const extra = { pos: [], nrm: [], face: [], edge: [] };
  for (const [a, b, r0, r1] of spire) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t0 = i / n * Math.PI * 2, t1 = (i + 1) / n * Math.PI * 2;
      // increasing angle in (x,z) is the outward-facing order used by walls()
      const p = [[Math.cos(t0) * r0, a, Math.sin(t0) * r0], [Math.cos(t1) * r0, a, Math.sin(t1) * r0], [Math.cos(t1) * r1, b, Math.sin(t1) * r1], [Math.cos(t0) * r1, b, Math.sin(t0) * r1]];
      const nv = [[Math.cos(t0), .05, Math.sin(t0)], [Math.cos(t1), .05, Math.sin(t1)], [Math.cos(t1), .05, Math.sin(t1)], [Math.cos(t0), .05, Math.sin(t0)]];
      for (const k of [0, 2, 1, 0, 3, 2]) {
        const v = p[k];
        extra.pos.push(...v); extra.nrm.push(...nv[k]); extra.face.push(0, v[1], 1, 0); extra.edge.push(.5, k >= 2 ? 1 : 0);
      }
    }
  }
  const geo = g.build();
  const merge = (name, size, add) => { const a = geo.getAttribute(name).array; const m = new Float32Array(a.length + add.length); m.set(a); m.set(add, a.length); geo.setAttribute(name, new THREE.Float32BufferAttribute(m, size)); };
  merge('position', 3, extra.pos); merge('normal', 3, extra.nrm); merge('aFace', 4, extra.face); merge('aEdge', 2, extra.edge);
  geo.computeBoundingSphere();
  return geo;
}

/* ---------- One by Omniyat ----------
   A black-glass slab (long face : height about 1 : 3.6). Near the top a notch is cut out of the long south face;
   a lighter glass box, 65% of the face wide and inset on both sides, sits in it and cantilevers 8 m out.
   Dark slots with pale floor-slab edges show beside and under the box. Flush parapet, no roof box. */
export const OMNI = { W: 46, D: 30, H: 162, floorH: 3.6, yb: 0.78, yt: 0.9, boxW: 0.65, proj: 8, notch: 5, gap: 2.4 };
const omniDims = () => {
  const { W, D, H, floorH } = OMNI;
  const yb = Math.round(H * OMNI.yb / floorH) * floorH, yt = Math.round(H * OMNI.yt / floorH) * floorH;
  const bx1 = W * OMNI.boxW / 2, bx0 = -bx1, nx0 = bx0 - OMNI.gap, nx1 = bx1 + OMNI.gap;
  return { W, D, H, floorH, x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, yb, yt, ny0: yb - 2 * floorH, bx0, bx1, nx0, nx1 };
};
export function buildOmniyat() {
  const g = Geo(); g.axisU = true;
  const o = omniDims();
  const { x0, x1, z0, z1, yb, yt, ny0, bx0, bx1, nx0, nx1, H } = o;
  const zN = z1 - OMNI.notch;
  // lower slab (its top cap is the floor of the slot), upper slab on the exact same footprint, flush roof
  g.box(x0, 0, z0, x1, ny0, z1, 2, 5, 7);
  g.box(x0, yt, z0, x1, H, z1, 2, 7, 5);
  // band between them: the slab outline with the notch cut into the south face; notch walls are recess (5)
  const band = [[x0, z0], [x0, z1], [nx0, z1], [nx0, zN], [nx1, zN], [nx1, z1], [x1, z1], [x1, z0]];
  const inNotch = (a, b) => (Math.abs(a[0] - nx0) < 1e-3 && Math.abs(b[0] - nx0) < 1e-3) || (Math.abs(a[0] - nx1) < 1e-3 && Math.abs(b[0] - nx1) < 1e-3) || (Math.abs(a[1] - zN) < 1e-3 && Math.abs(b[1] - zN) < 1e-3);
  g.walls(band, ny0, yt, 2, null, (a, b) => (inNotch(a, b) ? 5 : 2));
  // the cantilevered box: back in the notch, 8 m out past the face; lighter glass (3), soffit (4), roof (7)
  const bring = [[bx0, zN], [bx0, z1 + OMNI.proj], [bx1, z1 + OMNI.proj], [bx1, zN]];
  g.walls(bring, yb, yt, 3);
  g.cap(bring, yt, 7);
  g.cap(bring, yb, 4, true);
  return g.build();
}

const HERO_VERT = /* glsl */`
attribute vec4 aFace; attribute vec2 aEdge;
uniform float uRise; uniform float uRiseDelay;
varying vec3 vWorld; varying vec3 vNormal; varying vec4 vFace; varying vec2 vEdge; varying vec3 vLocal;
void main(){
  float rise = clamp((uRise - uRiseDelay) / .4, 0., 1.); rise = rise * rise * (3. - 2. * rise);
  vec3 p = position; p.y *= rise;
  vec4 w = modelMatrix * vec4(p, 1.);
  vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix) * normal);
  vFace = vec4(aFace.x, aFace.y * rise, aFace.z, aFace.w); vEdge = aEdge; vLocal = p;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const o = omniDims();
const HERO_FRAG = /* glsl */`
uniform float uKind; uniform float uTopY; uniform vec3 u603Local; uniform float uSeed; uniform vec2 uCenter;
varying vec3 vWorld; varying vec3 vNormal; varying vec4 vFace; varying vec2 vEdge; varying vec3 vLocal;
void main(){
  gIX = uCenter;
  vec3 P = vWorld; vec3 N = normalize(vNormal);
  float real = realAt(P.xz);
  float mat = floor(vFace.z + .5);
  vec2 fe = fwidth(vEdge);
  float dU = vFace.w > .5 ? min(vEdge.x, 1. - vEdge.x) / max(fe.x, 1e-5) : 1e3;
  float dV = min(vEdge.y, 1. - vEdge.y) / max(fe.y, 1e-5);
  float edge = 1. - smoothstep(.4, 1.4, min(dU, dV));
  vec3 emis = vec3(0.);
  vec3 modelC = vec3(0.);
  if (real < 1.) {
    float ao = 1. - .35 * exp(-P.y / 6.);
    modelC = uPorcelain * studioLight(N, P, .3) * ao;
    modelC *= 1. - edge * .1;
    vec3 wireC = C_SAPPHIRE * 1.6 + C_LINE * edge * 1.1 + C_LINE * .05;
    modelC = mix(wireC, modelC, uFill);
  }
  vec3 realC = vec3(0.), rimS = vec3(0.);
  if (real > 0.) {
    vec3 V = normalize(uCamPos - P);
    float sh; vec3 L = realLight(N, P, sh);
    float NdV = max(dot(N, V), 1e-3);
    if (mat < .5) {
      // Burj: reflective silver-blue glass behind vertical stainless fins
      float fin = smoothstep(.62, .7, abs(fract(vFace.x / 1.45) - .5) * 2.);
      float fw = fwidth(vFace.x / 1.45);
      fin = mix(fin, .3, smoothstep(.3, .6, fw));
      float band = 1. - smoothstep(.0, .12, abs(fract(vFace.y / 4.2) - .5) * 2. - .82);
      band *= 1. - smoothstep(.25, .5, fwidth(vFace.y / 4.2));
      vec3 R = reflect(-V, N); R = normalize(vec3(R.x, R.y * .5 + .05, R.z));
      float F = .12 + .88 * pow(1. - NdV, 5.);
      vec3 env = reflectEnv(R, P, .1);
      env = mix(vec3(luma(env)), env, .3) * vec3(.9, .86, 1.04) / (1. + 2. * luma(env));   // silver-blue glass: no copper cast, no blown sun-side wings
      vec3 glass = env * F + vec3(.025, .03, .04) * L;
      vec3 steel = vec3(.36, .37, .4) * L * .7 + env * .14;
      realC = mix(glass, steel, fin * .85);
      realC *= 1. - band * .25;
      // vertical striation: fin groups and the faceted wing noses, still legible from 1.5-2 km (6-8%), gone once sub-pixel
      float sq = vFace.x / 5.8;
      float stripe = smoothstep(.2, .8, abs(fract(sq) - .5) * 2.);
      float ang = atan(N.z, N.x) * 9.5493;   // 60 facets around
      float facet = smoothstep(.25, .75, abs(fract(ang) - .5) * 2.) * step(.5, 1. - vFace.w);
      float sf = 1. - smoothstep(.22, .45, fwidth(sq));
      float af = 1. - smoothstep(.22, .45, fwidth(ang));
      realC *= 1. - .07 * stripe * sf - .06 * facet * af;
      float sw = max(dot(normalize(N.xz + 1e-5), normalize(uSunDir.xz + 1e-5)), 0.);
      float rim = pow(1. - NdV, 4.) * sw;
      realC += uSunHalo * rim * .3 * (1. - uNight);
      // Saffron rim (SPEC 4.5): a thin line on the grazing, sun-side facets of the silhouette only; the shaded body
      // stays a cool mauve-grey (a broad grazing term turned the whole upper tower terracotta)
      float lit = smoothstep(-.03, .08, uSunDir.y) * (1. - uNight);
      float swR = smoothstep(.0, .45, dot(normalize(N.xz + 1e-5), normalize(uSunDir.xz + 1e-5)));
      rimS = uSunLight * C_SAFFRON * pow(1. - NdV, 7.) * swR * 3. * lit;
      if (uNight > 0.) {
        // sparse warm windows, a cool uplight wash on the fins that strengthens toward the top tiers
        float xb = clamp((uWave - length(P.xz - uO603.xz) + 200.) / 400., 0., 1.) * uNight;
        vec2 c = floor(vec2(vFace.x / 2.9, vFace.y / 4.2));
        float on = step(hash12(c + 7.3), .16) * step(15., vFace.y);
        // far away the windows stay a sparkle (binary supercells), never an averaged brown wash
        float w = winLOD(c, vec2(fwidth(vFace.x / 2.9), fwidth(vFace.y / 4.2)), .16, on, 3.7, vec2(3., 3.), .8);
        emis += vec3(1., .4, .12) * w * .5 * xb;
        float up = .006 + .055 * smoothstep(330., 640., P.y);
        emis += vec3(.62, .76, 1.) * up * (.35 + .65 * fin) * xb;
        // at night the tower is dark silver-blue glass: no warm cast from the reflected city
        realC = mix(realC, vec3(luma(realC)) * vec3(.62, .74, 1.15), .75 * uNight) * (1. - .5 * xb);
      }
    } else if (mat < 1.5) {
      // spire: polished steel
      vec3 R = reflect(-V, N); R = normalize(vec3(R.x, R.y * .5 + .05, R.z));
      realC = vec3(.4, .41, .44) * L + reflectEnv(R, P, .2) * .55;
      realC += uSunHalo * pow(1. - NdV, 2.) * 2.4 * (1. - uNight);
      if (uNight > 0.) {
        float xb = clamp((uWave - length(P.xz - uO603.xz) + 200.) / 400., 0., 1.) * uNight;
        // the spire is uplit white, brightest toward its tip; a red aviation light on top
        emis += vec3(.82, .88, 1.) * (.12 + .9 * smoothstep(650., 800., vLocal.y)) * xb;
        emis += vec3(1., .2, .12) * 40. * uNight * step(826., vLocal.y) * step(.45, fract(uTime * .5 + .2));
      }
    } else if (mat < 3.5) {
      // One by Omniyat through the shared glass path: black slab (2), lighter blue-grey box (3)
      bool box = mat > 2.5;
      Facade fc;
      fc.module = 1.5; fc.floorH = 3.6; fc.mull = .06; fc.stone = 0.; fc.jit = .026;
      if (box) { fc.tint = vec3(.16, .19, .23); fc.f0 = .1; fc.spandrel = .22; fc.spCol = vec3(.3, .31, .33); fc.sheen = .35; fc.rt = vec3(.9, .95, 1.05); }
      else { fc.tint = vec3(.008, .01, .016); fc.f0 = .1; fc.spandrel = .12; fc.spCol = vec3(.022, .024, .03); fc.sheen = .1; fc.rt = vec3(.86, .9, 1.04); }
      vec4 inst = vec4(uSeed + (box ? 3.7 : 0.), box ? .95 : .55, 260., 2.7);   // w >= 2: wide luxury flats
      vec3 em;
      realC = shadeFacadeF(fc, P, N, vFace.x, vFace.y, inst, ${o.H.toFixed(1)}, em);
      if (box) {
        // the box is the light one: pale steel glass that mirrors the sky it faces (the true reflection, lifted a
        // little, so its lower floors catch the afterglow band and the top the cobalt above), a clear step lighter
        // than the slab, its floor and mullion grid drawn darker; the 8 m deep end faces mirror another azimuth
        // (by day the higher anti-sun sky, desaturated: the approved golden-hour look; from dusk the true reflection)
        float dk = smoothstep(.15, .45, uNight);
        vec3 Rb0 = reflect(-V, N);
        vec3 Rb = normalize(vec3(Rb0.x, mix(abs(Rb0.y) * .6 + .3, max(Rb0.y, -.02) * .7 + .02, dk), Rb0.z));
        float Fb = .1 + .9 * pow(1. - NdV, 5.);
        vec3 eb = skyNoDisc(Rb); eb = mix(vec3(luma(eb)), eb, mix(.3, .62, dk)) * mix(vec3(.9, .96, 1.06), vec3(.94, .97, 1.04), dk);
        vec2 gq = vec2(vFace.x / 1.5, vFace.y / 3.6), gw = fwidth(gq);
        vec2 gd = abs(fract(gq + .5) - .5);
        float grid = max(1. - smoothstep(.05 - gw.x, .05 + gw.x, gd.x), 1. - smoothstep(.09 - gw.y, .09 + gw.y, gd.y));
        grid = mix(grid, .16, smoothstep(.25, .5, max(gw.x, gw.y)));
        float endF = 1. - abs(N.z * ${Math.cos(8 * Math.PI / 180).toFixed(4)} + N.x * ${Math.sin(-8 * Math.PI / 180).toFixed(4)});   // 1 on the box's end faces
        vec3 dayB = realC + eb * (.11 + Fb * .35) * (1. - uNight) * (1. - .45 * grid);
        vec3 duskB = realC * .8 + eb * (.3 + Fb * .5 + .12 * endF) * (1. - uNight * .7) * (1. - .5 * grid);
        realC = mix(dayB, duskB, dk);
        // underside shadow line along the box's lowest floor
        realC *= mix(.55, 1., smoothstep(.0, 1.4, vLocal.y - ${o.yb.toFixed(2)}));
      } else {
        emis += em;
        // a dark mirror: near-black glass whose only light is the sky it reflects (the true reflection: the afterglow
        // band at eye height, cobalt toward the top), the shared facade path kept as a faint floor and mullion
        // drawing, a gentle cassette-scale waviness, and a cool floor from the open sky so it is never a black hole
        float wav = vnoise(vec2(vFace.x / 6.5, vFace.y / 9.) + uSeed) - .5;
        float lc = luma(realC);
        float dk = smoothstep(.15, .45, uNight);
        vec3 Rs0 = reflect(-V, N);
        // by day (the approved golden-hour look): the shared path soft-clipped, a little sky on top
        vec3 Rd = normalize(vec3(Rs0.x, abs(Rs0.y) * .5 + .2, Rs0.z));
        vec3 ed = skyNoDisc(Rd); ed = mix(vec3(luma(ed)), ed, .5);
        vec3 dayS = realC / (1. + lc * 4.) * .78 * (1. + .35 * wav) + ed * .035;
        // from dusk: the true reflection of the sky and the skyline, so the afterglow band sits at eye height
        vec3 Rs = normalize(vec3(Rs0.x, Rs0.y * .92 + .02, Rs0.z));
        float Fs = .085 + .915 * pow(1. - NdV, 5.);
        vec3 es = reflectEnvJ(Rs, Rs, P, .02, 1.);
        es = mix(vec3(luma(es)), es, .8);
        vec3 duskS = realC / (1. + lc * 4.) * .42 * (1. + .35 * wav) + es * Fs * (.85 + .3 * wav) * (1. - uNight * .5);
        realC = mix(dayS, duskS, dk) + vec3(.0035, .0045, .009) * uNight;   // at night: the city glow on dark glass
        // slab glass just under the slot sits in its shade
        float dy = ${o.ny0.toFixed(2)} - vLocal.y;
        float under = step(${(o.nx0 - 1).toFixed(2)}, vLocal.x) * step(vLocal.x, ${(o.nx1 + 1).toFixed(2)}) * step(${(o.z1 - 0.5).toFixed(2)}, vLocal.z);
        realC *= 1. - .45 * under * step(0., dy) * (1. - smoothstep(0., 3., dy));
      }
      // last light (p ~ 0.47): the low sun catches the west corner of the cantilever's south glass, a small Saffron glint
      if (box && uGlint > 0.) {
        vec3 gq = vLocal - vec3(${(o.bx0 + 1.4).toFixed(2)}, ${((o.yb + o.yt) / 2 + 2.5).toFixed(2)}, ${(o.z1 + OMNI.proj).toFixed(2)});
        float gl = exp(-(gq.x * gq.x * .35 + gq.y * gq.y * .22)) * step(.5, N.z);
        emis += vec3(1., .6, .2) * gl * uGlint * 70.;
      }
      // the cantilevered box is the penthouse floor: once the wave passes, it glows warm behind its mullions
      if (box && uNight > 0.) {
        float xw = clamp((uWave - 420.) / 300., 0., 1.);
        float fy = fract(vFace.y / 3.6), fwy = fwidth(vFace.y / 3.6);
        float slab = mix(1. - smoothstep(.1, .1 + fwy * 2., fy), .1, smoothstep(.3, .6, fwy));
        // rooms 3-5 modules wide, each at its own level (a few dark, one with its sheers drawn), ceilings brightest
        float fl = floor(vFace.y / 3.6), ru = vFace.x / 1.5;
        float rw = 3. + floor(hash12(vec2(fl, 4.1)) * 3.);
        float ri = floor((ru + fl * 1.7) / rw), rf = fract((ru + fl * 1.7) / rw);
        float hr = hash12(vec2(ri, fl + uSeed));
        float rl = hr < .2 ? .12 : hr < .35 ? .55 : 1.;
        float pool = .55 + .45 * exp(-pow((rf - .25 - .5 * fract(hr * 7.3)) * 2.6, 2.));
        float ceilB = .7 + .45 * smoothstep(.2, .95, fy);
        float mm = 1. - smoothstep(.04, .04 + fwidth(ru) * 1.5, abs(fract(ru + .5) - .5));
        float det = mix(rl * pool * ceilB * (1. - .6 * mm), .62, smoothstep(.3, .6, max(fwy, fwidth(ru))));
        emis += vec3(1., .42, .14) * .5 * (1. - slab) * warmUp(xw) * uNight * det;
      }
      // window 603: lights first. A lit room, not a lamp: four floor-to-ceiling panes on the module grid, and behind
      // them an interior-mapped living room (lamp-lit west wall and back wall, the floor in shadow, a sofa back against
      // the glass, a sheer drawn across the east pane), Window Amber, peaking under the bloom threshold; its light
      // catches the mullions, the transoms and the glass round it, and nothing else
      if (!box) {
        vec3 d = vLocal - u603Local;
        float k = warmUp(clamp(u603, 0., 1.));
        if (k > 0. && abs(d.z) < .6 && abs(d.x) < 7. && abs(d.y) < 5.) {
          const float RX = 3., Y0 = -1.55, Y1 = 1.6, RD = 6.5;
          vec2 fd = max(fwidth(d.xy), vec2(1e-4));
          vec2 q = vec2(abs(d.x) - RX, max(Y0 - d.y, d.y - Y1));
          float inW = (1. - smoothstep(-fd.x, fd.x, q.x)) * (1. - smoothstep(-fd.y, fd.y, q.y));
          // the view ray in the tower's frame (x along the south face, z out of it)
          vec3 Xw = normalize(cross(vec3(0., 1., 0.), N));
          vec3 rd = normalize(P - uCamPos);
          vec3 vd = vec3(dot(rd, Xw), rd.y, dot(rd, N));
          vd.z = min(vd.z, -.05);
          vec3 o3 = vec3(clamp(d.x, -RX, RX), clamp(d.y, Y0, Y1), 0.);
          float tX = ((vd.x > 0. ? RX : -RX) - o3.x) / (abs(vd.x) > 1e-4 ? vd.x : 1e-4);
          float tY = ((vd.y > 0. ? Y1 : Y0) - o3.y) / (abs(vd.y) > 1e-4 ? vd.y : 1e-4);
          float tZ = -RD / vd.z;
          float t = min(min(abs(tX), abs(tY)), tZ);
          vec3 H = o3 + vd * t;
          vec3 A = vec3(1., .28, .03);                     // reads as Window Amber #FFB35C through AgX
          vec3 Lp = vec3(-2.1, .2, -4.6);                  // a floor lamp in the far west corner
          float pool = exp(-dot(H - Lp, H - Lp) / 5.);
          float upW = smoothstep(Y0, Y1, H.y);             // walls brighten toward the ceiling (cove light)
          vec3 room;
          if (t == tZ) room = A * (.62 + .7 * pool + .3 * upW);                                    // back wall
          else if (abs(t - abs(tX)) < 1e-4) room = A * (.55 + .75 * pool + .32 * upW) * (vd.x < 0. ? 1. : .8);   // side wall
          else if (vd.y < 0.) room = A * vec3(1., 1.15, 1.3) * (.22 + .35 * pool) * (.7 + .3 * smoothstep(-RD, 0., H.z));   // floor
          else room = vec3(1., .5, .16) * (.9 + .3 * pool);                                         // ceiling
          // the sofa back, a dark silhouette against the lit room
          {
            float ts = (-1.7 - o3.z) / vd.z;
            vec3 S = o3 + vd * ts;
            float sofa = step(ts, t) * step(abs(S.x + .3), 1.6) * step(S.y, Y0 + .82);
            room = mix(room, A * .06, sofa);
          }
          // a sheer drawn across the east pane: a soft, even glow with faint folds
          float sheer = smoothstep(1.4, 1.6, d.x);
          room = mix(room, A * vec3(1., 1.25, 1.6) * (.62 + .07 * sin(d.x * 26.)) * (.8 + .25 * upW), sheer * .85);
          // mullions every module, transom at the sill: lit from the room side, a warm mid tone, not black
          float mm = 1. - smoothstep(.07 - fd.x, .07 + fd.x, abs(fract(d.x / 1.5 + .5) - .5) * 1.5);
          float sill = 1. - smoothstep(.1 - fd.y, .1 + fd.y, abs(d.y - Y0));
          float frameW = max(mm, sill);
          vec3 win = mix(room, A * .3, frameW);
          emis += win * inW * k * 1.25;
          realC *= 1. - .85 * inW * k;
          // spill: the frame and the glass round the opening catch its light, fading over a metre or two
          float od = length(max(q, 0.));
          float fy = fract(vLocal.y / ${o.floorH.toFixed(1)}), fwy = fwidth(vLocal.y / ${o.floorH.toFixed(1)});
          float spd = 1. - smoothstep(.12 - fwy, .12 + fwy, fy);
          float mul2 = 1. - smoothstep(.06 - fd.x, .06 + fd.x, abs(fract((vLocal.x + vLocal.z) / 1.5 + .5) - .5) * 2.);
          float fr2 = max(spd, mul2);
          emis += A * (1. - inW) * k * (exp(-od * od / .5) * (.03 + .12 * fr2) + exp(-od * od / 5.) * .02);
        }
      }
    } else if (mat < 4.5) {
      // pale soffit under the cantilever, in its own shadow; from dusk a warm cove line runs round its outer edge
      // and washes the stone, so the box reads as floating over the dark slot
      realC = vec3(.55, .53, .5) * (N.y < -.5 ? (mix(uGroundAmb, uSkyAmb, .2) * 1.6 + uSunLight * .015) : L);
      {
        float eo = min(min(vLocal.x - ${o.bx0.toFixed(2)}, ${o.bx1.toFixed(2)} - vLocal.x), ${(o.z1 + OMNI.proj).toFixed(2)} - vLocal.z);
        float dusk = smoothstep(.15, .45, uNight);
        emis += vec3(1., .5, .2) * (exp(-eo * 2.4) * .5 + .03) * dusk;
      }
    } else if (mat < 5.5) {
      // recessed slot: dark interior with a pale slab edge at every floor
      float fy = vFace.y / ${o.floorH.toFixed(1)};
      float fw = fwidth(fy);
      float fl = 1. - smoothstep(.07 - fw, .07 + fw, abs(fract(fy + .5) - .5) * 2.);
      fl = mix(fl, .08, smoothstep(.2, .45, fw));
      if (N.y > .5 || N.y < -.5) fl = 0.;
      // the interior reads as a deep, warm room (never a black hole); after dusk its ceilings glow faintly
      realC = mix(vec3(.03, .027, .03) * (L * .5 + uSkyAmb * 1.2 + uGroundAmb * .5), vec3(.55, .53, .5) * (L * .5 + uSkyAmb * .6), fl);
      emis += vec3(1., .66, .42) * .006 * uNight * (1. - fl);
    } else if (mat < 6.5) {
      realC = vec3(.09, .09, .095) * L;
      if (uNight > 0. && uKind < .5) {
        float xb = clamp((uWave - length(P.xz - uO603.xz) + 200.) / 400., 0., 1.) * uNight;
        float fv = max(fwidth(vEdge.y), 1e-4);
        float line = 1. - smoothstep(fv * .7, fv * 1.8, vEdge.y);
        emis += vec3(1., .86, .7) * line * .9 * xb;
      }
    } else {
      // flush roof and parapet
      realC = vec3(.023, .02, .027) * L;
    }
    if (uNight > 0. && mat > 1.5 && mat < 3.5) realC = realC; // windows come from the shared path
  }
  vec3 col = mix(modelC, realC, real);
  col += emis * real;
  // haze: the Burj keeps its body (about half the haze); One by Omniyat sits in the near field at half too
  col = aerial(col, P, real * (mat < 1.5 ? .55 : (uKind > .5 ? .5 : 1.)));
  // the backlit Burj reads as a cool mauve-grey silhouette against the warm sky, not a copper one
  if (uKind < .5 && mat < 1.5) col = mix(col, vec3(luma(col)) * vec3(1.32, 1.1, 1.62), .7 * real * (1. - uNight));
  col += rimS * real;
  col += scanBand(P.xz) * (.35 + .65 * smoothstep(0., 30., P.y));
  gl_FragColor = vec4(col, 1.);
}`;

export function makeHeroMaterial(kind, extra) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({ uKind: { value: kind }, uTopY: { value: 828 }, u603Local: { value: new THREE.Vector3() }, uSeed: { value: kind * 17.3 }, uRiseDelay: { value: 0 }, uCenter: { value: new THREE.Vector2() } }, extra || {}, U),
    vertexShader: HERO_VERT,
    fragmentShader: COMMON_FRAG + FACADE_GLSL + HERO_FRAG
  });
}
export function makeHeroes(geo) {
  const burj = new THREE.Mesh(buildBurj(), makeHeroMaterial(0));
  burj.position.set(geo.burj[0], 0, geo.burj[1]);
  const omni = new THREE.Mesh(buildOmniyat(), makeHeroMaterial(1));
  omni.position.set(geo.omniyat[0], 0, geo.omniyat[1]);
  omni.rotation.y = -geo.omniyat[2] * Math.PI / 180;
  burj.material.uniforms.uCenter.value.set(geo.burj[0], geo.burj[1]);
  omni.material.uniforms.uCenter.value.set(geo.omniyat[0], geo.omniyat[1]);
  // 603 at the west end of the south face (the corner toward the Burj, clear of the cantilever above), floor FLOOR_603
  const y603 = FLOOR_603 * OMNI.floorH + OMNI.floorH * 0.55;
  const x603 = -OMNI.W / 2 + 3.5;   // four 1.5 m modules, x -22.5 .. -16.5 (on the facade grid)
  omni.material.uniforms.u603Local.value.set(x603, y603, OMNI.D / 2);
  omni.updateMatrixWorld(true);
  const w603 = new THREE.Vector3(x603, y603, OMNI.D / 2 + 0.5).applyMatrix4(omni.matrixWorld);
  const depth = makeDepthMaterial();
  for (const m of [burj, omni]) { m.userData.depthMat = depth; m.frustumCulled = false; }
  return { burj, omni, w603 };
}
