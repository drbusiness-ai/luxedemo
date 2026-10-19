/* AS BUILT · post chain: HDR scene target (MSAA on high) → bloom (bright-pass + dual Kawase) →
   tilt-shift (quarter res + Kawase) → final: tilt mix, bloom, AgX, exposure, grade, scrim, vignette,
   grain, FXAA (medium/low), blue-noise dither. */
import * as THREE from '../../vendor/three/three.module.min.js';

const FS_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`;

const BRIGHT = /* glsl */`
uniform sampler2D tSrc; uniform float uThreshold; uniform float uKnee; uniform vec2 uTexel;
varying vec2 vUv;
void main(){
  vec3 c = texture(tSrc, vUv + uTexel * vec2(-.5, -.5)).rgb + texture(tSrc, vUv + uTexel * vec2(.5, -.5)).rgb
         + texture(tSrc, vUv + uTexel * vec2(-.5, .5)).rgb + texture(tSrc, vUv + uTexel * vec2(.5, .5)).rgb;
  c *= .25;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold + uKnee, 0., 2. * uKnee); rq = rq * rq / (4. * uKnee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  c = min(c * w, vec3(60.));
  gl_FragColor = vec4(c, 1.);
}`;
const DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec3 s = texture(tSrc, vUv).rgb * 4.;
  s += texture(tSrc, vUv - uTexel).rgb; s += texture(tSrc, vUv + uTexel).rgb;
  s += texture(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb; s += texture(tSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  gl_FragColor = vec4(s / 8., 1.);
}`;
const UP = /* glsl */`
uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uTexel; uniform float uAddW; varying vec2 vUv;
void main(){
  vec2 h = uTexel * .5;
  vec3 s = texture(tSrc, vUv + vec2(-h.x * 2., 0.)).rgb + texture(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.
         + texture(tSrc, vUv + vec2(0., h.y * 2.)).rgb + texture(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.
         + texture(tSrc, vUv + vec2(h.x * 2., 0.)).rgb + texture(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.
         + texture(tSrc, vUv + vec2(0., -h.y * 2.)).rgb + texture(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.;
  s /= 12.;
  gl_FragColor = vec4(s + texture(tAdd, vUv).rgb * uAddW, 1.);
}`;
const KAWASE = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uOff; varying vec2 vUv;
void main(){
  vec2 o = uTexel * (uOff + .5);
  vec3 s = texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture(tSrc, vUv + vec2(o.x, o.y)).rgb;
  gl_FragColor = vec4(s * .25, 1.);
}`;
const FINAL = /* glsl */`
uniform sampler2D tScene, tBloom, tTilt, tBlue, tStreak;
uniform vec2 uRes; uniform float uBloom, uTilt, uFocusY, uTiltBand, uExposure, uGrain, uVignette, uFxaa, uTime;
uniform float uSat, uSplit, uTemp, uContrast; uniform vec4 uCopyRect; uniform float uScrim; uniform float uStreak;
uniform vec3 uVeil; uniform vec2 uSunUV;
varying vec2 vUv;
vec3 agxContrast(vec3 x){ vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + .4298 * x2 + .1191 * x - .00232; }
vec3 agx(vec3 v){
  const mat3 m = mat3(.842479062253094, .0423282422610123, .0423756549057051, .0784335999999992, .878468636469772, .0784336, .0792237451477643, .0791661274605434, .879142973793104);
  const float mn = -12.47393, mx = 4.026069;
  v = m * max(v, vec3(1e-10));
  v = clamp(log2(v), mn, mx);
  v = (v - mn) / (mx - mn);
  return agxContrast(v);
}
vec3 agxOut(vec3 v){
  const mat3 mi = mat3(1.19687900512017, -.0528968517574562, -.0529716355144438, -.0980208811401368, 1.15190312990417, -.0980434501171241, -.0990297440797205, -.0989611768448433, 1.15107367264116);
  return mi * v;
}
float lumC(vec3 c){ vec3 t = c / (1. + c); return dot(t, vec3(.299, .587, .114)); }
vec3 fxaa(vec2 uv){
  vec2 px = 1. / uRes;
  vec3 cM = texture(tScene, uv).rgb;
  vec3 cNW = texture(tScene, uv + vec2(-1., -1.) * px).rgb, cNE = texture(tScene, uv + vec2(1., -1.) * px).rgb;
  vec3 cSW = texture(tScene, uv + vec2(-1., 1.) * px).rgb, cSE = texture(tScene, uv + vec2(1., 1.) * px).rgb;
  float lM = lumC(cM), lNW = lumC(cNW), lNE = lumC(cNE), lSW = lumC(cSW), lSE = lumC(cSE);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float red = max((lNW + lNE + lSW + lSE) * .03125, 1. / 128.);
  float rcp = 1. / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, vec2(-8.), vec2(8.)) * px;
  vec3 a = .5 * (texture(tScene, uv + dir * (1. / 3. - .5)).rgb + texture(tScene, uv + dir * (2. / 3. - .5)).rgb);
  vec3 b = a * .5 + .25 * (texture(tScene, uv - dir * .5).rgb + texture(tScene, uv + dir * .5).rgb);
  float lB = lumC(b);
  return (lB < lMin || lB > lMax) ? a : b;
}
void main(){
  vec2 uv = vUv;
  vec3 c = uFxaa > .5 ? fxaa(uv) : texture(tScene, uv).rgb;
  if (uTilt > 0.) {
    vec3 b = texture(tTilt, uv).rgb;
    float t = smoothstep(uTiltBand, uTiltBand + .28, abs(uv.y - uFocusY)) * uTilt;
    c = mix(c, b, t);
  }
  vec3 bl = texture(tBloom, uv).rgb;
  c += bl * uBloom;
  // anamorphic streak (last-light glint): a soft horizontal smear of the blurriest bloom level, only while uStreak > 0
  if (uStreak > 0.) {
    vec3 s = vec3(0.); float ws = 0.;
    for (int i = -12; i <= 12; i++) { float x = float(i) / 12.; float w = exp(-x * x * 3.); s += texture(tStreak, uv + vec2(x * .11, 0.)).rgb * w; ws += w; }
    c += s / ws * uStreak * .9;
  }
  // veiling glare from a low sun just outside the frame: the golden key light that lifts the sun side
  if (uVeil.r > 0.) {
    vec2 sd = (uv - uSunUV) * vec2(uRes.x / uRes.y, 1.);
    float r = length(sd);
    c += uVeil * (exp(-r * 2.4) * .8 + exp(-r * 7.) * .6);
  }
  c *= uExposure;
  // white balance (temp) before the curve
  c *= vec3(1. + uTemp * .08, 1., 1. - uTemp * .1);
  vec3 d = agx(c);
  // look: saturation + contrast around mid grey, split-tone
  float l = dot(d, vec3(.2126, .7152, .0722));
  d = mix(vec3(l), d, uSat);
  d = (d - .5) * uContrast + .5;
  vec3 shadowT = vec3(.03, .07, .2), highT = vec3(1., .54, .24);
  d += uSplit * (shadowT * (1. - smoothstep(.0, .45, l)) * .25 + (highT - .5) * smoothstep(.55, 1., l) * .08);
  d = agxOut(d);
  // copy scrim (shader-side, no CSS blur)
  if (uScrim > 0.) {
    vec2 q = (uv - uCopyRect.xy) / max(uCopyRect.zw - uCopyRect.xy, vec2(1e-3));
    vec2 e = max(max(-q, q - 1.), 0.);
    // a raised scrim (ch03 over the bright golden-hour sky): tighter above the copy, harder on bright sky
    // than on the dark city, and it settles toward Ink rather than a muddy multiply of the peach sky
    float up = smoothstep(.17, .3, uScrim);
    e.y *= 1. + 1.6 * up * step(1., q.y);
    float m = exp(-dot(e, e) * 9.);
    float k = min(uScrim * m * (1. + .6 * up * smoothstep(.4, .85, dot(d, vec3(.2126, .7152, .0722)))), .55);
    d = mix(d * (1. - k), mix(d, vec3(.027, .043, .11), k), up);
  }
  // vignette
  vec2 vq = uv - .5; vq.x *= uRes.x / uRes.y;
  d *= 1. - uVignette * smoothstep(.35, 1.15, length(vq));
  d = clamp(d, 0., 1.);
  // grain (24 fps step of the scene clock), luminance weighted
  vec2 fc = gl_FragCoord.xy;
  float seed = floor(uTime * 24.);
  float gn = fract(sin(dot(fc + seed * vec2(17.13, 31.7), vec2(12.9898, 78.233))) * 43758.5453) - .5;
  float lw = l * (1. - l) * 4.;
  d += gn * uGrain * (.4 + .6 * lw);
  // blue-noise dither before 8-bit
  float bn = texture(tBlue, (fc + vec2(seed * 7., seed * 13.)) / 64.).r - .5;
  d += bn / 255.;
  gl_FragColor = vec4(d, 1.);
}`;

function blueNoiseTex() {
  // void-and-cluster-lite: Mitchell's best-candidate ranking on a 64^2 torus, quick and good enough for dither
  const N = 64, n = N * N, rank = new Float32Array(n);
  const taken = new Uint8Array(n), px = [], pz = [];
  let s = 1234567;
  const r = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  for (let k = 0; k < n; k++) {
    let best = -1, bestD = -1;
    const cands = Math.min(12, n - k);
    for (let c = 0; c < cands; c++) {
      let i; do { i = Math.floor(r() * n); } while (taken[i]);
      const x = i % N, y = (i / N) | 0;
      let dmin = 1e9;
      for (let j = Math.max(0, px.length - 600); j < px.length; j++) { let dx = Math.abs(px[j] - x), dy = Math.abs(pz[j] - y); if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy; const d = dx * dx + dy * dy; if (d < dmin) dmin = d; }
      if (dmin > bestD) { bestD = dmin; best = i; }
    }
    taken[best] = 1; px.push(best % N); pz.push((best / N) | 0); rank[best] = k / n;
  }
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = Math.round(rank[i] * 255); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

export function makePost(renderer, opts) {
  const msaa = opts.msaa ? 4 : 0;
  const half = THREE.HalfFloatType;
  const rtOpts = { type: half, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  const scene = new THREE.WebGLRenderTarget(4, 4, { type: half, format: THREE.RGBAFormat, depthBuffer: true, samples: msaa, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const levels = opts.bloomLevels || 4;
  const bright = new THREE.WebGLRenderTarget(4, 4, rtOpts);
  const down = [], up = [];
  for (let i = 0; i < levels; i++) { down.push(new THREE.WebGLRenderTarget(4, 4, rtOpts)); up.push(new THREE.WebGLRenderTarget(4, 4, rtOpts)); }
  const tiltA = new THREE.WebGLRenderTarget(4, 4, rtOpts), tiltB = new THREE.WebGLRenderTarget(4, 4, rtOpts);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(tri);
  quad.frustumCulled = false;
  const fsScene = new THREE.Scene(); fsScene.add(quad);
  const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const mBright = mk(BRIGHT, { tSrc: { value: null }, uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uTexel: { value: new THREE.Vector2() } });
  const mDown = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const mUp = mk(UP, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() }, uAddW: { value: 1 } });
  const mKawase = mk(KAWASE, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uOff: { value: 1 } });
  const blue = blueNoiseTex();
  const F = {
    tScene: { value: scene.texture }, tBloom: { value: null }, tTilt: { value: tiltB.texture }, tBlue: { value: blue }, tStreak: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) }, uBloom: { value: 0.55 }, uTilt: { value: 0 }, uFocusY: { value: 0.5 }, uTiltBand: { value: 0.12 },
    uExposure: { value: 1 }, uGrain: { value: 0.025 }, uVignette: { value: 0.22 }, uFxaa: { value: msaa ? 0 : 1 }, uTime: { value: 0 },
    uSat: { value: 1.1 }, uSplit: { value: 0.5 }, uTemp: { value: 0 }, uContrast: { value: 1.04 },
    uCopyRect: { value: new THREE.Vector4(0, 0, 0.4, 1) }, uScrim: { value: 0 }, uStreak: { value: 0 },
    uVeil: { value: new THREE.Color(0, 0, 0) }, uSunUV: { value: new THREE.Vector2(-1, 0.5) }
  };
  const mFinal = mk(FINAL, F);
  let W = 4, H = 4;
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, cam); };
  return {
    target: scene, uniforms: F, msaa,
    setSize(w, h) {
      W = Math.max(4, Math.round(w)); H = Math.max(4, Math.round(h));
      scene.setSize(W, H);
      let bw = Math.max(2, W >> 1), bh = Math.max(2, H >> 1);
      bright.setSize(bw, bh);
      for (let i = 0; i < levels; i++) { bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1); down[i].setSize(bw, bh); }
      for (let i = 0; i < levels; i++) { const s = i === 0 ? bright : down[i - 1]; up[i].setSize(s.width, s.height); }
      tiltA.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2)); tiltB.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2));
      F.uRes.value.set(W, H);
    },
    render(outW, outH) {
      // bloom
      mBright.uniforms.tSrc.value = scene.texture; mBright.uniforms.uTexel.value.set(1 / W, 1 / H);
      pass(mBright, bright);
      let src = bright;
      for (let i = 0; i < levels; i++) { mDown.uniforms.tSrc.value = src.texture; mDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); pass(mDown, down[i]); src = down[i]; }
      for (let i = levels - 1; i >= 0; i--) {
        const dst = up[i], add = i === 0 ? bright : down[i - 1];
        mUp.uniforms.tSrc.value = (i === levels - 1 ? down[i] : up[i + 1]).texture;
        mUp.uniforms.tAdd.value = add.texture; mUp.uniforms.uAddW.value = 1;
        const s = i === levels - 1 ? down[i] : up[i + 1];
        mUp.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
        pass(mUp, dst);
      }
      F.tBloom.value = up[0].texture;
      F.tStreak.value = up[Math.min(2, levels - 1)].texture;
      // tilt-shift blur
      if (F.uTilt.value > 0.001) {
        mDown.uniforms.tSrc.value = scene.texture; mDown.uniforms.uTexel.value.set(2 / W, 2 / H); pass(mDown, tiltA);
        mKawase.uniforms.tSrc.value = tiltA.texture; mKawase.uniforms.uTexel.value.set(1 / tiltA.width, 1 / tiltA.height); mKawase.uniforms.uOff.value = 1; pass(mKawase, tiltB);
        mKawase.uniforms.tSrc.value = tiltB.texture; mKawase.uniforms.uOff.value = 2; pass(mKawase, tiltA);
        mKawase.uniforms.tSrc.value = tiltA.texture; mKawase.uniforms.uOff.value = 3; pass(mKawase, tiltB);
      }
      F.tTilt.value = tiltB.texture;
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, outW, outH);
      quad.material = mFinal;
      renderer.render(fsScene, cam);
    },
    passes: () => 2 + levels * 2 + (F.uTilt.value > 0.001 ? 4 : 0)
  };
}
