/* AS BUILT · scene: renderer, tiers, the one loop, governor, visibility and window.LHScene.
   The frame is a pure function of (pS, t): pS is the spring-smoothed progress, t a freezable clock. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { CHAPTERS, remap, makeTrack, sampleTrack, makeSpring, stepSpring, snapSpring, chapterAt } from './timeline.js';
import { buildSkyLUT, rowIndex } from './sky.js';
import { U, COMMON_FRAG } from './materials.js';
import { buildDistrictMap, makeGround, makeFloor, makePlinth, makeTowers, makeLowRise, makeSkyline, makeScanSheet } from './city.js';
import { makeHeroes } from './heroes.js';
import { makeHairlines } from './hairlines.js';
import { makePost } from './post.js';
import { attachStory } from './story.js';
import { makeNight } from './night.js';

const D2R = Math.PI / 180;

/* ---------- sky: fullscreen triangle, view ray from the inverse projection ---------- */
const SKY_VERT = /* glsl */`
uniform mat4 uInvProj; uniform mat4 uCamWorld;
varying vec3 vDir;
void main(){
  vec4 v = uInvProj * vec4(position.xy, 1., 1.);
  vDir = mat3(uCamWorld) * (v.xyz / v.w);
  gl_Position = vec4(position.xy, 1., 1.);
}`;
const SKY_FRAG = /* glsl */`
varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); gl_FragColor = vec4(skyFull(d), 1.); }`;
function makeSky() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const extra = { uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() } };
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: Object.assign(extra, U), vertexShader: SKY_VERT, fragmentShader: COMMON_FRAG + SKY_FRAG, depthTest: false, depthWrite: false }));
  m.frustumCulled = false; m.renderOrder = -1;
  return m;
}

/* ---------- tiers ---------- */
function pickTier(gl, forced) {
  if (forced && /^(high|medium|low)$/.test(forced)) return forced;
  const ua = navigator.userAgent || '';
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua) && Math.min(screen.width, screen.height) < 900);
  let r = '';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { r = ''; }
  r = String(r);
  if (mobile || /Mali|Adreno|PowerVR|Apple GPU.*iPhone/i.test(r)) return 'low';
  if (/SwiftShader|llvmpipe|Software/i.test(r)) return 'medium';
  if (/Apple|NVIDIA|GeForce|Radeon|AMD|RTX|Quadro/i.test(r)) return 'high';
  if (/Intel/i.test(r)) return 'medium';
  return 'medium';
}
const TIERS = {
  high: { msaa: true, dpr: 1.75, scale: 0.85, shadow: 2048, bloom: 4, plots: 1e9, mirror: true },
  medium: { msaa: false, dpr: 1.75, scale: 0.8, shadow: 2048, bloom: 4, plots: 1e9, mirror: true },
  low: { msaa: false, dpr: 1.5, scale: 0.8, shadow: 1024, bloom: 3, plots: 180, mirror: false }
};

/* ---------- small math helpers (allocation-free) ---------- */
function dirAzEl(az, el, out) { const a = az * D2R, e = el * D2R, c = Math.cos(e); return out.set(Math.sin(a) * c, Math.sin(e), -Math.cos(a) * c); }
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export async function start(J) {
  const canvas = J.canvas;
  const qs = J.qs;
  const [plots, skyKeys, keysD, keysP] = await Promise.all([
    fetch(J.base + 'assets/data/plots.json').then(r => r.json()),
    fetch(J.base + 'assets/data/sky-keys.json').then(r => r.json()),
    fetch(J.base + 'assets/data/keys-desktop.json').then(r => r.json()),
    fetch(J.base + 'assets/data/keys-portrait.json').then(r => (r.ok ? r.json() : null)).catch(() => null)
  ]);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!J.preserve });
  const gl = renderer.getContext();
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
  const tierName = pickTier(gl, qs.get('tier'));
  let tier = TIERS[tierName];
  renderer.setPixelRatio(1);
  renderer.autoClear = true;
  renderer.info.autoReset = false;
  renderer.setClearColor(0x070b1c, 1);

  /* ---------- data + world ---------- */
  const geo = plots;
  const P = {}; geo.fields.forEach((f, i) => (P[f] = i));
  const sky = buildSkyLUT(skyKeys);
  U.uSkyLUT.value = sky.tex;
  U.uFootprint.value.set(geo.footprint[0], geo.footprint[1], geo.footprint[2], geo.footprint[3]);
  U.uSkyline.value = makeSkyline(geo, [U.uSkyCenter.value.x, U.uSkyCenter.value.y, U.uSkyCenter.value.z]);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 30, 160000);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const skyMesh = makeSky(); scene.add(skyMesh);
  const mapTex = buildDistrictMap(geo);
  const ground = makeGround(mapTex); scene.add(ground);
  const floor = makeFloor(); scene.add(floor);
  const plinth = makePlinth(geo.footprint, 90); scene.add(plinth);
  const towers = makeTowers(geo, Math.min(geo.plots.length, tier.plots));
  towers.meshes.forEach(m => scene.add(m));
  const low = makeLowRise(geo, mapTex, { max: tierName === 'low' ? 2600 : 9000 });
  scene.add(low.mesh);
  towers.meshes.push(low.mesh);
  const heroes = makeHeroes(geo); scene.add(heroes.burj); scene.add(heroes.omni);
  const night = makeNight(geo, mapTex, { phone: tierName === 'low' }); night.meshes.forEach(m => scene.add(m));
  U.uO603.value.copy(heroes.w603);
  const hair = makeHairlines(geo, towers.count); scene.add(hair.mesh);
  const sheet = makeScanSheet(); scene.add(sheet);
  const HIDE = new Set();
  const NAMED = { sky: skyMesh, ground, floor, plinth, low: low.mesh, burj: heroes.burj, omni: heroes.omni, hair: hair.mesh, sheet, cars: night.cars, points: night.points, beacons: night.beacons };
  towers.meshes.forEach((m, i) => { if (m !== low.mesh) NAMED['t' + i] = m; });

  /* ---------- shadows: A = studio key (model), B = the real sun ---------- */
  const mkShadow = size => {
    const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true, type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
    rt.depthTexture = new THREE.DepthTexture(size, size);
    rt.depthTexture.type = THREE.UnsignedIntType;
    rt.depthTexture.compareFunction = THREE.LessEqualCompare;
    rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.LinearFilter;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
    return { rt, cam, last: new THREE.Vector3(9, 9, 9), mat: new THREE.Matrix4() };
  };
  const shA = mkShadow(tier.shadow), shB = mkShadow(tier.shadow);
  U.uShadowA.value = shA.rt.depthTexture; U.uShadowB.value = shB.rt.depthTexture;
  U.uShadowTexel.value.set(1 / tier.shadow, 1 / tier.shadow);
  const casters = [...towers.meshes, heroes.burj, heroes.omni];
  const nonCasters = [skyMesh, ground, floor, plinth, hair.mesh, sheet];
  const casterMats = casters.map(m => m.material);
  const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const fx0 = geo.footprint[0] - 300, fz0 = geo.footprint[1] - 300, fx1 = geo.footprint[2] + 300, fz1 = geo.footprint[3] + 300;
  const corners = []; for (const x of [fx0, fx1]) for (const z of [fz0, fz1]) for (const y of [0, 840]) corners.push(new THREE.Vector3(x, y, z));
  const tmpV = new THREE.Vector3(), centre = new THREE.Vector3((fx0 + fx1) / 2, 0, (fz0 + fz1) / 2);
  function renderShadow(sh, dir) {
    const cam = sh.cam;
    cam.position.copy(centre).addScaledVector(dir, 9000);
    cam.up.set(0, 1, 0); if (Math.abs(dir.y) > 0.99) cam.up.set(0, 0, -1);
    cam.lookAt(centre);
    cam.updateMatrixWorld(true);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const c of corners) { tmpV.copy(c).applyMatrix4(cam.matrixWorldInverse); x0 = Math.min(x0, tmpV.x); x1 = Math.max(x1, tmpV.x); y0 = Math.min(y0, tmpV.y); y1 = Math.max(y1, tmpV.y); z0 = Math.min(z0, tmpV.z); z1 = Math.max(z1, tmpV.z); }
    cam.left = x0; cam.right = x1; cam.bottom = y0; cam.top = y1; cam.near = Math.max(1, -z1 - 50); cam.far = -z0 + 50;
    cam.updateProjectionMatrix();
    sh.mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).premultiply(BIAS);
    for (let i = 0; i < casters.length; i++) casters[i].material = casters[i].userData.depthMat;
    for (const m of nonCasters) m.visible = false;
    renderer.setRenderTarget(sh.rt);
    renderer.clear(true, true, false);
    renderer.render(scene, cam);
    for (let i = 0; i < casters.length; i++) casters[i].material = casterMats[i];
    for (const m of nonCasters) m.visible = true;
    sh.last.copy(dir);
  }
  U.uShadowMatA.value = shA.mat; U.uShadowMatB.value = shB.mat;
  /* allocate both shadow maps through their render targets before any material samples them */
  renderShadow(shA, new THREE.Vector3(0.3, 0.8, 0.5).normalize());
  renderShadow(shB, new THREE.Vector3(-0.9, 0.12, 0.2).normalize());

  const post = makePost(renderer, { msaa: tier.msaa, bloomLevels: tier.bloom });

  /* ---------- water mirror (SPEC 4.6): quarter-res planar reflection about y = 0, high/medium only ---------- */
  const mirror = {
    rt: new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }),
    cam: new THREE.PerspectiveCamera(40, 1, 30, 160000), mat: new THREE.Matrix4(), on: false
  };
  mirror.cam.rotation.order = 'YXZ';
  const GU = ground.material.uniforms;
  GU.uMirror.value = mirror.rt.texture; GU.uMirrorMat.value = mirror.mat;
  const mirrorHide = [ground, floor, plinth, hair.mesh, sheet], mirrorVis = mirrorHide.map(() => true);
  const camSave = new THREE.Vector3();
  function renderMirror() {
    const mc = mirror.cam;
    mc.position.set(camera.position.x, -camera.position.y, camera.position.z);
    mc.rotation.set(-camera.rotation.x, camera.rotation.y, -camera.rotation.z, 'YXZ');
    mc.fov = camera.fov; mc.aspect = camera.aspect; mc.near = camera.near; mc.far = camera.far;
    mc.updateProjectionMatrix(); mc.updateMatrixWorld(true);
    mirror.mat.multiplyMatrices(mc.projectionMatrix, mc.matrixWorldInverse).premultiply(BIAS);
    const su = skyMesh.material.uniforms;
    camSave.copy(U.uCamPos.value); U.uCamPos.value.copy(mc.position);
    su.uInvProj.value.copy(mc.projectionMatrixInverse); su.uCamWorld.value.copy(mc.matrixWorld);
    for (let i = 0; i < mirrorHide.length; i++) { mirrorVis[i] = mirrorHide[i].visible; mirrorHide[i].visible = false; }
    renderer.setRenderTarget(mirror.rt);
    renderer.clear(true, true, false);
    renderer.render(scene, mc);
    for (let i = 0; i < mirrorHide.length; i++) mirrorHide[i].visible = mirrorVis[i];
    U.uCamPos.value.copy(camSave);
    su.uInvProj.value.copy(camera.projectionMatrixInverse); su.uCamWorld.value.copy(camera.matrixWorld);
  }

  /* ---------- keys -> tracks ---------- */
  function buildTracks(K) {
    let prevH = null;
    const cam = K.cam.map(k => {
      // unwrap headings so the spline always takes the short way round
      let hd = k.h;
      if (prevH !== null) { while (hd - prevH > 180) hd -= 360; while (hd - prevH < -180) hd += 360; }
      prevH = hd; k = Object.assign({}, k, { h: hd });
      const h = k.h * D2R, pt = k.pt * D2R;
      const f = [Math.sin(h) * Math.cos(pt), Math.sin(pt), -Math.cos(h) * Math.cos(pt)];
      const t = k.tgt || [k.pos[0] + f[0] * k.dist, k.pos[1] + f[1] * k.dist, k.pos[2] + f[2] * k.dist];
      return [k.p, t[0], t[1], t[2], k.dist, k.h, k.pt, k.fov, k.roll || 0];
    });
    const tr = { cam: makeTrack(cam) };
    for (const name in K.tracks) tr[name] = makeTrack(K.tracks[name]);
    return tr;
  }
  const TR = { d: buildTracks(keysD), p: keysP ? buildTracks(keysP) : null };
  let tracks = TR.d;
  const out9 = new Float64Array(9), out1 = new Float64Array(1);
  const S = {}; // sampled scalars
  const DEF = { blueprint: 0, hourModel: 1, hair: 0, rise: 1, fill: 1, tilt: 0, focusY: 0.5, keyAz: 150, keyEl: 35, scanPos: -1e5, scanGlow: 0, realAll: 1, sunAz: 245, sunEl: 6, hourReal: 2, haze: 0.0003, cirrus: 0.5, stars: 0, venus: 0, veil: 0, night: 0, wave: 0, o603: 0, exposure: 1, bloom: 0.55, sat: 1.05, contrast: 1, split: 0.4, temp: 0, vignette: 0.25, scrim: 0.12 };
  const trackNames = Object.keys(DEF);
  const OVR = {}, OVRU = {}; let OVRCAM = null, nOVR = 0, nOVRU = 0; // QA overrides; the frame path skips them when empty
  function sampleAll(u) {
    for (let i = 0; i < trackNames.length; i++) { const n = trackNames[i], t = tracks[n]; S[n] = nOVR && n in OVR ? OVR[n] : t ? sampleTrack(t, u, out1)[0] : DEF[n]; }
    sampleTrack(tracks.cam, u, out9);
  }

  /* ---------- light colours (CPU, from the same LUT the sky uses) ---------- */
  const tmp3 = [0, 0, 0], tmp3b = [0, 0, 0];
  const C_LILAC = new THREE.Color('#B8A9D9'), C_ROSE = new THREE.Color('#EDB8B0');
  function lights() {
    dirAzEl(S.sunAz, S.sunEl, U.uSunDir.value);
    dirAzEl(S.keyAz, S.keyEl, U.uKeyDir.value);
    const e = S.sunEl;
    const am = 1 / (Math.sin(Math.max(e, 0.2) * D2R) + 0.15 * Math.pow(Math.max(e, 0.2) + 3.885, -1.253));
    const tr = Math.exp(-0.055 * am), tg = Math.exp(-0.105 * am), tb = Math.exp(-0.2 * am);
    const vis = smooth01(-1.2, 0.6, e), lit = smooth01(-1.5, 2.5, e);
    U.uSunColor.value.setRGB(tr, tg, tb).multiplyScalar(70 * vis / Math.max(tr, 1e-3));
    U.uSunLight.value.setRGB(tr, tg, tb).multiplyScalar(3.4 * lit / Math.max(tr, 0.25));
    const haloK = smooth01(-7, 1, e);
    U.uSunHalo.value.setRGB(Math.max(tr, 0.25), Math.max(tg, 0.08) * 0.95, Math.max(tb, 0.02) * 0.9).multiplyScalar(0.16 * haloK);
    sky.sample(S.hourReal, 24, tmp3);
    { const l = 0.2126 * tmp3[0] + 0.7152 * tmp3[1] + 0.0722 * tmp3[2], k = 0.55; for (let i = 0; i < 3; i++) tmp3[i] = tmp3[i] * k + l * (1 - k) * (i === 2 ? 1.15 : 1); }
    U.uSkyAmb.value.setRGB(tmp3[0], tmp3[1], tmp3[2]).multiplyScalar(0.3);
    sky.sample(S.hourReal, -4, tmp3b);
    U.uGroundAmb.value.setRGB(tmp3b[0], tmp3b[1], tmp3b[2]).multiplyScalar(0.12).add(tmpC.copy(U.uSunLight.value).multiplyScalar(0.007));
    // studio: key + rose/lilac hemisphere
    U.uKeyColor.value.setRGB(1.0, 0.95, 0.9).multiplyScalar(0.78);
    U.uStudioSky.value.copy(C_LILAC).multiplyScalar(0.3);
    U.uStudioGround.value.copy(C_ROSE).multiplyScalar(0.2);
    // haze tint follows the hour (warm dust at golden hour)
    { const g = 1 - smooth01(2.4, 3.6, S.hourReal); U.uHazeTint.value.setRGB(1 + 0.06 * g, 1 - 0.03 * g, 1 - 0.12 * g); }
  }
  const tmpC = new THREE.Color();
  C_LILAC.convertSRGBToLinear(); C_ROSE.convertSRGBToLinear();

  /* ---------- state ---------- */
  const spring = makeSpring(J.portrait ? 7 : 6);
  let pS = -1, lastRenderedP = -2, clock = 0, frozen = null, quality = tierName, posterMode = false, forceScale = null;
  let showQ = 0;
  let W = 1, H = 1, dpr = 1, scale = tier.scale, cssW = 0, cssH = 0, dirty = true;
  let curChapter = -1, live = true, visibleDoc = !document.hidden;
  const timing = { ema: 16.7, over: 0, under: 0, samples: [], frameMs: 0 };
  /* QA drives frames by hand: no governor under webdriver unless ?guardtest (which also forces the guard) */
  const forceGuard = qs.has('guardtest');
  const noGovern = (navigator.webdriver || qs.has('noguard')) && !forceGuard;
  /* DPR cap: 1.75 desktop, 1.5 phone (tier); ?dpr=N lifts it for poster renders only */
  const dprCap = qs.has('dpr') ? Math.min(3, Math.max(0.5, +qs.get('dpr') || 1)) : tier.dpr;

  function resize(force) {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (!force && w === cssW && Math.abs(h - cssH) < 120 && cssH) return;
    cssW = w; cssH = h;
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    W = Math.max(2, Math.round(w * dpr)); H = Math.max(2, Math.round(h * dpr));
    renderer.setSize(W, H, false);
    applyScale();
    const portrait = w / h < 0.8;
    tracks = portrait && TR.p ? TR.p : TR.d;
    camera.aspect = w / h;
    dirty = true;
  }
  function applyScale() {
    const s = forceScale || scale;
    post.setSize(W * s, H * s);
    hair.mesh.material.uniforms.uRes.value.set(Math.round(W * s), Math.round(H * s));
    hair.mesh.material.uniforms.uWidth.value = dpr * s;
    U.uRes.value.set(Math.round(W * s), Math.round(H * s));
    mirror.rt.setSize(Math.max(2, Math.round(W * s / 2)), Math.max(2, Math.round(H * s / 2)));
    dirty = true;
  }

  /* ---------- per-frame apply: tracks -> camera + uniforms ---------- */
  const fwd = new THREE.Vector3(), sunNdc = new THREE.Vector3();
  let shadowForce = true;
  function apply(p) {
    sampleAll(remap(p));
    // camera
    if (showQ > 0) night.showcaseCam(showQ, out9);
    if (OVRCAM) { out9[0] = OVRCAM.pos[0]; out9[1] = OVRCAM.pos[1]; out9[2] = OVRCAM.pos[2]; out9[3] = 0; out9[4] = OVRCAM.h; out9[5] = OVRCAM.pt; out9[6] = OVRCAM.fov || out9[6]; out9[7] = 0; }
    const h = out9[4] * D2R, pt = out9[5] * D2R, dist = out9[3];
    fwd.set(Math.sin(h) * Math.cos(pt), Math.sin(pt), -Math.cos(h) * Math.cos(pt));
    camera.position.set(out9[0] - fwd.x * dist, out9[1] - fwd.y * dist, out9[2] - fwd.z * dist);
    camera.rotation.set(pt, -h, out9[7] * D2R, 'YXZ');
    camera.fov = out9[6];
    camera.near = Math.max(4, Math.min(60, camera.position.y * 0.15));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    skyMesh.material.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    skyMesh.material.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    U.uCamPos.value.copy(camera.position);
    // states
    U.uBlueprint.value = S.blueprint; U.uHourModel.value = S.hourModel; U.uHourReal.value = S.hourReal;
    U.uRise.value = S.rise; U.uFill.value = S.fill; U.uWire.value = 1 - S.fill;
    U.uScanPos.value = S.scanPos; U.uScanGlow.value = S.scanGlow; U.uRealAll.value = S.realAll;
    U.uNight.value = S.night; U.uWave.value = S.wave; U.u603.value = S.o603;
    U.uHazeDensity.value = S.haze * smooth01(0.0, 0.2, Math.max(S.realAll, S.scanGlow));
    U.uCirrus.value = S.cirrus; U.uStars.value = S.stars; U.uVenus.value = S.venus;
    U.uTime.value = clock;
    lights();
    night.apply(p, tracks, S.night, showQ, post.uniforms);
    const hm = hair.mesh.material.uniforms;
    hm.uAlpha.value = S.hair; hair.mesh.visible = S.hair > 0.002;
    const showTowers = S.rise > 0.001 || S.scanGlow > 0 || S.realAll > 0;
    for (const m of towers.meshes) m.visible = showTowers;
    heroes.burj.visible = heroes.omni.visible = showTowers;
    sheet.visible = S.scanGlow > 0.001;
    plinth.visible = S.realAll < 0.999 && S.blueprint < 0.999;
    floor.visible = S.realAll < 0.999 && S.blueprint < 0.999;
    if (HIDE.size) for (const k of HIDE) { const o = NAMED[k]; if (o) o.visible = false; }
    // post
    const F = post.uniforms;
    F.uExposure.value = S.exposure; F.uBloom.value = S.bloom; F.uTilt.value = S.tilt; F.uFocusY.value = S.focusY;
    F.uSat.value = S.sat; F.uContrast.value = S.contrast; F.uSplit.value = S.split; F.uTemp.value = S.temp;
    F.uVignette.value = S.vignette; F.uScrim.value = posterMode ? 0 : S.scrim; F.uTime.value = clock;
    F.uCopyRect.value.copy(J.copyRect);
    // veiling glare: project the sun; strength from the veil track, only while the sun is up
    sunNdc.copy(U.uSunDir.value).multiplyScalar(1e5).add(camera.position).project(camera);
    const vk = S.veil * smooth01(-1, 1.5, S.sunEl) * (fwd.dot(U.uSunDir.value) > -0.2 ? 1 : 0);
    F.uSunUV.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);
    F.uVeil.value.copy(U.uSunLight.value).multiplyScalar(0.035 * vk);
    // shadows only when the light moved more than 0.05 deg
    const studioOn = S.realAll < 0.999 && S.fill > 0.01;
    const realOn = S.realAll > 0.001 || S.scanGlow > 0.001;
    U.uShadowOnA.value = studioOn ? 1 : 0; U.uShadowOnB.value = realOn && S.sunEl > -0.5 ? 1 : 0;
    // softer, wider PCF once the low sun throws long shadows across the real city
    { const k = (1 + smooth01(0.26, 0.31, p)) / tier.shadow; U.uShadowTexel.value.set(k, k); }
    const th = Math.cos(0.05 * D2R);
    if (studioOn && (shadowForce || U.uKeyDir.value.dot(shA.last) < th)) renderShadow(shA, U.uKeyDir.value);
    if (U.uShadowOnB.value > 0.5 && (shadowForce || U.uSunDir.value.dot(shB.last) < th)) renderShadow(shB, U.uSunDir.value);
    shadowForce = false;
    // water mirror only while real water is on screen (03 to 05)
    mirror.on = tier.mirror && realOn && ((p > 0.2 && p < 0.8) || showQ > 0) && !HIDE.has('mirror');
    GU.uMirrorOn.value = mirror.on ? 1 : 0;
    if (nOVRU) for (const k in OVRU) if (U[k]) U[k].value = OVRU[k];
    story.apply(p);
  }

  /* draw calls / triangles per pass (main budget: <=45 calls, <=350k triangles) */
  const passes = { mirror: [0, 0], main: [0, 0], post: [0, 0] };
  function render() {
    const t0 = performance.now();
    const ri = renderer.info.render;
    renderer.info.reset();
    if (mirror.on) renderMirror();
    const c0 = ri.calls, t0r = ri.triangles;
    renderer.setRenderTarget(post.target);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    const c1 = ri.calls, t1r = ri.triangles;
    post.render(W, H);
    story.afterPost(pS);
    passes.mirror[0] = c0; passes.mirror[1] = t0r;
    passes.main[0] = c1 - c0; passes.main[1] = t1r - t0r;
    passes.post[0] = ri.calls - c1; passes.post[1] = ri.triangles - t1r;
    lastRenderedP = pS;
    dirty = false;
    timing.frameMs = performance.now() - t0;
  }

  /* ---------- chapter change (not per frame) ---------- */
  function chapterSync(p) {
    const c = chapterAt(p);
    if (c !== curChapter) { curChapter = c; J.onChapter && J.onChapter(c); }
  }

  /* ---------- the one loop: a single gsap.ticker callback ---------- */
  let lastT = performance.now(), idleSince = performance.now(), prevRendered = false, prevNow = 0, stopped = false;
  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.1);
    lastT = now;
    if (!live || !visibleDoc || stopped) { prevRendered = false; return; }
    spring.target = J.target;
    const prev = pS;
    pS = stepSpring(spring, dt);
    if (frozen === null) clock += dt;
    if (pS !== prev) { J.onProgress && J.onProgress(pS); chapterSync(pS); idleSince = now; }
    // render on demand in chapters 01-02 (no clock-driven motion), otherwise every tick; every other tick
    // after 2 s with no scroll or pointer input
    const clockDriven = pS >= 0.2 && frozen === null;
    const idle = now - idleSince > 2000;
    story.tick(dt, frozen !== null);
    if (story.busy(pS, frozen !== null)) dirty = true;
    if (!dirty && pS === lastRenderedP && (!clockDriven || (idle && (frameNo++ & 1)))) { prevRendered = false; return; }
    apply(pS);
    render();
    // the governor only reads intervals between two rendered ticks (on-demand and idle frames are not frame times)
    if (prevRendered) governor(now - prevNow);
    prevRendered = true; prevNow = now;
  }
  let frameNo = 0;
  /* render-scale governor + tier confirmation + hard guard (SPEC 4.12):
     EMA over 30 frames; step down 0.1 after 30 frames above 18.5 ms, up after 120 frames under 13 ms (0.6..1).
     The median of the first 60 frames (after 8 warm-up frames) confirms the tier: above 18.5 ms a high tier drops
     to medium (no MSAA, FXAA), above 24 ms the hard guard hands the journey to the posters. */
  const WARM = 8, NSAMP = 60, samples = new Float32Array(NSAMP);
  let nWarm = 0, nSamp = 0;
  function governor(iv) {
    if (forceScale || posterMode || noGovern || iv > 2000) return;
    if (nWarm < WARM) { nWarm++; return; }
    timing.ema += (iv - timing.ema) / 30;
    if (nSamp < NSAMP) {
      samples[nSamp++] = iv;
      if (nSamp === NSAMP) {
        samples.sort();
        timing.median = (samples[NSAMP / 2 - 1] + samples[NSAMP / 2]) / 2;
        if (timing.median > 24 || forceGuard) { guard('slow'); return; }
        if (timing.median > 18.5 && quality === 'high') setQuality('medium');
      }
    }
    if (timing.ema > 18.5) { if (++timing.over > 30 && scale > 0.6) { scale = Math.max(0.6, +(scale - 0.1).toFixed(2)); timing.over = 0; applyScale(); } } else timing.over = 0;
    if (timing.ema < 13) { if (++timing.under > 120 && scale < 1) { scale = Math.min(1, +(scale + 0.1).toFixed(2)); timing.under = 0; applyScale(); } } else timing.under = 0;
  }
  /* quality switch without a rebuild: MSAA (high only) and the mirror pass; the scale range stays governed */
  function setQuality(q) {
    if (!TIERS[q] || stopped) return quality;
    quality = q;
    const msaaOn = q === 'high' && TIERS[tierName].msaa;
    if (!msaaOn && post.target.samples) { post.target.samples = 0; post.target.dispose(); }
    post.uniforms.uFxaa.value = post.target.samples ? 0 : 1;
    tier = Object.assign({}, tier, { mirror: q !== 'low' && TIERS[tierName].mirror });
    if (q === 'low') scale = Math.min(scale, 0.8);
    applyScale();
    return quality;
  }
  /* hard guard / lost context: stop the loop for good and let journey.js crossfade to the posters */
  function guard(reason) {
    if (stopped) return;
    stopped = true; live = false;
    gsap.ticker.remove(tick);
    J.onGuard && J.onGuard(reason, timing.median);
    if (reason !== 'context') setTimeout(() => { try { renderer.dispose(); } catch (e) { /* already gone */ } }, 1200);
  }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); guard('context'); }, false);

  /* ---------- visibility + input (idle throttle) ---------- */
  document.addEventListener('visibilitychange', () => { visibleDoc = !document.hidden; lastT = performance.now(); prevRendered = false; });
  window.addEventListener('pointermove', () => { idleSince = performance.now(); }, { passive: true });
  window.addEventListener('resize', () => resize(false));
  resize(true);

  /* ---------- story layer (intro particles, X-ray lens, projected labels, scan-pass table) ---------- */
  const story = attachStory({
    J, U, S, renderer, scene, camera, skyMesh, hair: hair.mesh, GU, tierName,
    lensHide: [plinth, floor, sheet], lensShow: [...towers.meshes, heroes.burj, heroes.omni],
    size: () => ({ W, H, dpr, scale: forceScale || scale, cssW, cssH }),
    clock: () => clock, getP: () => pS, applyAt: p => apply(p), tracks: () => tracks,
    posterMode: () => posterMode, markDirty: () => { dirty = true; }
  });

  /* ---------- first frame: compile, then fade the canvas in ---------- */
  spring.target = J.target; snapSpring(spring, J.target); pS = J.target;
  apply(pS);
  try { if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera); } catch (e) { /* compile on first render */ }
  render();
  chapterSync(pS); J.onProgress && J.onProgress(pS);
  gsap.ticker.add(tick);
  night.bind({ camera, size: () => [cssW, cssH], clock: () => clock, getP: () => pS, markDirty: () => { dirty = true; } });

  /* ---------- window.LHScene (deterministic QA hooks) ---------- */
  const api = {
    setProgress(p, opts) {
      p = Math.min(1, Math.max(0, +p || 0));
      if (!opts || opts.scroll !== false) J.scrollToProgress(p);
      J.target = p; snapSpring(spring, p); pS = p;
      shadowForce = true; dirty = true;
      J.onProgress && J.onProgress(p); chapterSync(p);
      apply(p);
      return p;
    },
    renderOnce() { apply(pS); render(); return api.info(); },
    setTime(s) { frozen = s === null || s === undefined ? null : +s; if (frozen !== null) clock = frozen; dirty = true; },
    setIntro: story.api.setIntro, skipIntro: story.api.skipIntro, introDuration: story.api.introDuration,
    setCursor(x, y, tap) { if (x === null || x === undefined) return false; apply(pS); const ch = night.cursor(camera, +x, +y, cssW, cssH, clock, !!tap); dirty = true; return ch; },
    setLens: story.api.setLens, resetTouched() { night.touched.clear(); dirty = true; }, scanPass: story.api.scanPass,
    anchors: night.anchors,
    showcase(q) { const v = Math.min(1, Math.max(0, +q || 0)); if (v !== showQ) { showQ = v; dirty = true; } },
    setQuality,
    stop() { guard('manual'); },
    setScale(s) { forceScale = s ? Math.min(1, Math.max(0.3, +s)) : null; applyScale(); },
    setDate() {},
    posterMode(on) { posterMode = !!on; J.setPosterMode && J.setPosterMode(posterMode); dirty = true; },
    chapters: CHAPTERS.map(c => ({ id: c.id, start: c.start, holdStart: c.holdStart, holdEnd: c.holdEnd, end: c.end, label: c.label })),
    pose() {
      return { p: pS, pos: camera.position.toArray().map(v => +v.toFixed(1)), heading: +out9[4].toFixed(2), pitch: +out9[5].toFixed(2), fov: +camera.fov.toFixed(2), roll: +out9[7].toFixed(2), target: [out9[0], out9[1], out9[2]].map(v => +v.toFixed(1)), dist: +out9[3].toFixed(1) };
    },
    info() {
      return { tier: tierName, quality, scale: forceScale || scale, dpr, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, passes: { mirror: passes.mirror.slice(), main: passes.main.slice(), post: passes.post.slice() }, frameMs: +timing.frameMs.toFixed(2), median: timing.median === undefined ? null : +timing.median.toFixed(1), size: [W, H], p: pS, showcase: showQ, stopped };
    },
    setLive(on) { live = !!on && !stopped; prevRendered = false; if (live) { lastT = performance.now(); dirty = true; } },
    /* QA/authoring only: override a sampled track value (null clears) */
    debugCam(c) { OVRCAM = c || null; dirty = true; },
    debugTrack(name, v) { if (v === null || v === undefined) delete OVR[name]; else OVR[name] = +v; nOVR = Object.keys(OVR).length; dirty = true; },
    debugUniform(name, v) { if (v === null || v === undefined) delete OVRU[name]; else OVRU[name] = v; nOVRU = Object.keys(OVRU).length; dirty = true; },
    debugHide(names) { HIDE.clear(); for (const n of names || []) HIDE.add(n); dirty = true; },
    renderer
  };
  return api;
}
