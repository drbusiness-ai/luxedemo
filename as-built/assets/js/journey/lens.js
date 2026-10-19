/* AS BUILT · X-ray lens (chapter 01, SPEC 4.9). A second render of the same scene, limited to the lens
   box through a view offset, with the materials switched to the finished night state; then composited
   over the graded frame as a circle with a Drafting Line ring and a 2 px chromatic ring. Runs only
   while p < 0.08. The lens auto-drifts on a slow Lissajous path; on desktop the cursor takes it over
   and it returns to the drift 3 s after the pointer leaves. */
import * as THREE from '../../vendor/three/three.module.min.js';

const VERT = /* glsl */`void main(){ gl_Position = vec4(position.xy, 0., 1.); }`;
const FRAG = /* glsl */`
uniform sampler2D tLens; uniform vec2 uC; uniform float uR, uAlpha, uExposure, uPx; uniform vec3 uRing;
vec3 agxContrast(vec3 x){ vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + .4298 * x2 + .1191 * x - .00232; }
vec3 agx(vec3 v){
  const mat3 m = mat3(.842479062253094, .0423282422610123, .0423756549057051, .0784335999999992, .878468636469772, .0784336, .0792237451477643, .0791661274605434, .879142973793104);
  const mat3 mi = mat3(1.19687900512017, -.0528968517574562, -.0529716355144438, -.0980208811401368, 1.15190312990417, -.0980434501171241, -.0990297440797205, -.0989611768448433, 1.15107367264116);
  v = m * max(v, vec3(1e-10));
  v = clamp(log2(v), -12.47393, 4.026069);
  v = (v + 12.47393) / 16.500999;
  return mi * agxContrast(v);
}
vec3 look(vec2 uv){
  vec3 c = texture(tLens, clamp(uv, vec2(.002), vec2(.998))).rgb * uExposure;
  vec3 d = agx(c);
  float l = dot(d, vec3(.2126, .7152, .0722));
  d = mix(vec3(l), d, 1.08);
  return d;
}
void main(){
  vec2 q = gl_FragCoord.xy - uC;
  float r = length(q);
  float e = uPx;
  if (r > uR + 4. * e || uAlpha < .002) discard;
  vec2 uv = q / (2. * uR) + .5;
  // glass: a slight barrel at the rim and a cool inner edge
  float k = r / uR;
  uv = (uv - .5) * (1. - .045 * k * k) + .5;
  vec3 c = look(uv);
  c *= 1. - .28 * smoothstep(.55, 1., k);
  float inside = 1. - smoothstep(uR - .75 * e, uR + .75 * e, r);
  // 1.5 px Drafting Line ring + a 2 px chromatic ring just outside it (red out, blue in)
  float ring = 1. - smoothstep(.75 * e, 1.5 * e, abs(r - uR));
  float cr = 1. - smoothstep(.6 * e, 1.4 * e, abs(r - (uR + 2. * e)));
  float cb = 1. - smoothstep(.6 * e, 1.4 * e, abs(r - (uR - 1.6 * e)));
  vec3 col = c * inside;
  col = mix(col, uRing, ring * .9);
  col += vec3(1., .37, .3) * cr * .35 + vec3(.35, .55, 1.) * cb * .3;
  float a = max(inside, max(ring * .9, max(cr, cb) * .35));
  gl_FragColor = vec4(col, a * uAlpha);
}`;

export function makeLens(ctx) {
  const { renderer, scene, camera } = ctx;
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  const uniforms = {
    tLens: { value: rt.texture }, uC: { value: new THREE.Vector2() }, uR: { value: 60 }, uAlpha: { value: 0 }, uExposure: { value: 1.6 }, uPx: { value: 1 },
    uRing: { value: new THREE.Color('#A9C8FF') }
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(tri, mat); quad.frustumCulled = false;
  const fsScene = new THREE.Scene(); fsScene.add(quad);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* the night state comes from the scene itself: the story runs a full apply at p = 0.93 around the
     lens pass (camera held at the current pose), so every layer (towers, carpet, cars) agrees */
  let exposure = 1.6;
  const keepV = [];

  /* drift + cursor */
  const pos = { x: -1, y: -1 }, cur = { x: 0, y: 0, on: false, lastSeen: -1e9, w: 0 };
  let override = null;
  const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (fine) {
    window.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return; cur.x = e.clientX; cur.y = e.clientY; cur.on = true; cur.lastSeen = performance.now(); }, { passive: true });
    document.addEventListener('pointerleave', () => { cur.on = false; cur.lastSeen = performance.now(); });
    document.documentElement.addEventListener('mouseleave', () => { cur.on = false; cur.lastSeen = performance.now(); });
  }
  function drift(t, w, h, out) {
    if (w / h < 0.8) { out.x = w * (0.5 + 0.24 * Math.sin(t * 0.21 + 0.6)); out.y = h * (0.29 + 0.11 * Math.sin(t * 0.29 + 2.1)); }
    else { out.x = w * (0.74 + 0.15 * Math.sin(t * 0.19 + 0.4)); out.y = h * (0.47 + 0.2 * Math.sin(t * 0.27 + 1.3)); }
    return out;
  }
  const dr = { x: 0, y: 0 };
  /* the cursor weight: 1 while the pointer is on the page, back to 0 three seconds after it leaves */
  function update(t, dt, w, h) {
    drift(t, w, h, dr);
    const now = performance.now();
    const want = cur.on || now - cur.lastSeen < 3000 ? 1 : 0;
    cur.w += (want - cur.w) * Math.min(1, dt * (want ? 6 : 1.4));
    if (pos.x < 0) { pos.x = dr.x; pos.y = dr.y; }
    const tx = dr.x + (cur.x - dr.x) * cur.w, ty = dr.y + (cur.y - dr.y) * cur.w;
    const k = Math.min(1, dt * 9);
    pos.x += (tx - pos.x) * k; pos.y += (ty - pos.y) * k;
    if (cur.w < 0.001) { pos.x = dr.x; pos.y = dr.y; }
  }

  const hidden = [];
  const job = { sz: null, cx: 0, cy: 0, R: 60 };
  const api = {
    get active() { return uniforms.uAlpha.value > 0.002; },
    set(x, y, r) { override = x === null || x === undefined ? null : { x: +x, y: +y, r: r ? +r : null }; },
    update,
    /* render the lens view and composite it over the frame already on screen */
    render(alpha, sz, withNight) {
      uniforms.uAlpha.value = alpha;
      if (alpha <= 0.002) return;
      const portrait = sz.cssW / sz.cssH < 0.8;
      const R = override && override.r ? override.r : portrait ? 48 : 60;
      const cx = override ? override.x : pos.x, cy = override ? override.y : pos.y;
      const s = sz.dpr * sz.scale;
      const size = Math.max(8, Math.round(2 * R * s));
      if (rt.width !== size) rt.setSize(size, size);
      job.sz = sz; job.cx = cx; job.cy = cy; job.R = R;
      withNight(lensPass);
      // composite on the default framebuffer
      uniforms.uC.value.set(cx * sz.dpr, sz.H - cy * sz.dpr);
      uniforms.uR.value = R * sz.dpr; uniforms.uPx.value = sz.dpr; uniforms.uExposure.value = exposure;
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, sz.W, sz.H);
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(fsScene, fsCam);
      renderer.autoClear = ac;
    }
  };
  /* the night pass itself, hoisted so a lens frame allocates no closure: reads its box from job */
  function lensPass(S) {
    const { sz, cx, cy, R } = job;
    exposure = Math.max(1.2, S.exposure || 1.6);
    // view offset: render only the lens box at the main camera's projection
    camera.setViewOffset(sz.cssW, sz.cssH, cx - R, cy - R, 2 * R, 2 * R);
    camera.updateProjectionMatrix();
    const su = ctx.skyMesh.material.uniforms;
    su.uInvProj.value.copy(camera.projectionMatrixInverse);
    keepV.length = ctx.lensHide.length;
    for (let i = 0; i < ctx.lensHide.length; i++) { const o = ctx.lensHide[i]; keepV[i] = o.visible; o.visible = false; }
    const mirrorOn = ctx.GU.uMirrorOn.value; ctx.GU.uMirrorOn.value = 0;
    const sa = ctx.U.uShadowOnA.value, sb = ctx.U.uShadowOnB.value; ctx.U.uShadowOnA.value = 0; ctx.U.uShadowOnB.value = 0;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x070b1c, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    ctx.U.uShadowOnA.value = sa; ctx.U.uShadowOnB.value = sb;
    ctx.GU.uMirrorOn.value = mirrorOn;
    for (let i = 0; i < ctx.lensHide.length; i++) ctx.lensHide[i].visible = keepV[i];
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    su.uInvProj.value.copy(camera.projectionMatrixInverse);
  }
  return api;
}
