/* AS BUILT · story layer glue: intro particles, the X-ray lens, projected labels and the scan-pass
   table that keys the chapter 03 copy to the scan. scene.js calls tick / apply / afterPost / busy. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { remap, sampleTrack } from './timeline.js';
import { makeIntro, loadWordFont, T as IT } from './intro.js?v=20261020-1';
import { makeLens } from './lens.js';
import { makeLabels } from './labels.js?v=20261024-2';

const D2R = Math.PI / 180;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const LENS_OUT = [0.05, 0.08];

export function attachStory(ctx) {
  const J = ctx.J;
  const hairU = ctx.hair.material.uniforms;
  const lensHide = [ctx.hair, ...ctx.lensHide];
  const lens = makeLens(Object.assign({}, ctx, { lensHide }));
  /* run fn with the whole scene in its finished night state (p = 0.93) but the camera held where it is */
  const cam = ctx.camera, keepPos = new THREE.Vector3(), keepQ = new THREE.Quaternion();
  let inNight = false;
  function withNight(fn) {
    const p = ctx.getP();
    keepPos.copy(cam.position); keepQ.copy(cam.quaternion);
    const fov = cam.fov, near = cam.near, far = cam.far;
    const su = ctx.skyMesh.material.uniforms;
    inNight = true;
    ctx.applyAt(0.93);
    cam.position.copy(keepPos); cam.quaternion.copy(keepQ); cam.fov = fov; cam.near = near; cam.far = far;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    su.uInvProj.value.copy(cam.projectionMatrixInverse); su.uCamWorld.value.copy(cam.matrixWorld);
    ctx.U.uCamPos.value.copy(cam.position);
    try { fn(ctx.S); } finally { inNight = false; ctx.applyAt(p); }
  }
  const labels = makeLabels({ root: document.querySelector('.journey__labels'), camera: ctx.camera, anchor: ctx.U.uO603.value });

  /* ---------- intro: wait (font) -> run -> done ---------- */
  let intro = null, introT = 0, introOverride = null, lastDt = 0;
  let state = J.introSkip ? 'done' : 'wait';
  let fontOK = false;
  function build() {
    const sz = ctx.size();
    intro = makeIntro({ count: ctx.tierName === 'low' ? 2500 : 5000, hairMesh: ctx.hair, camera: ctx.camera, cssW: sz.cssW, cssH: sz.cssH, expanded: fontOK });
    ctx.scene.add(intro.points);
    lensHide.push(intro.points);
  }
  function finish() {
    if (state === 'done' && !intro) return;
    state = 'done';
    if (intro) { intro.points.visible = false; }
    hairU.uDraw.value = 1;
    try { sessionStorage.setItem('lh-intro', '1'); } catch (e) { /* private mode */ }
    ctx.markDirty();
  }
  if (state === 'wait') {
    loadWordFont().then(ok => {
      fontOK = ok;
      if (state !== 'wait') return;
      build(); state = 'run'; introT = 0; ctx.markDirty();
    });
  }

  /* ---------- scan-pass table: the p at which the scan has turned the world behind a screen point real ---------- */
  const camT = new THREE.PerspectiveCamera(40, 1, 10, 200000); camT.rotation.order = 'YXZ';
  const o9 = new Float64Array(9), o1 = new Float64Array(1), ray = new THREE.Vector3();
  function poseAt(p, cam) {
    const tr = ctx.tracks();
    sampleTrack(tr.cam, remap(p), o9);
    const h = o9[4] * D2R, pt = o9[5] * D2R, dist = o9[3];
    const fx = Math.sin(h) * Math.cos(pt), fy = Math.sin(pt), fz = -Math.cos(h) * Math.cos(pt);
    cam.position.set(o9[0] - fx * dist, o9[1] - fy * dist, o9[2] - fz * dist);
    cam.rotation.set(pt, -h, o9[7] * D2R, 'YXZ');
    cam.fov = o9[6]; cam.aspect = ctx.size().cssW / ctx.size().cssH;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    return tr.scanPos ? sampleTrack(tr.scanPos, remap(p), o1)[0] : -1e5;
  }
  function scanPass(pts, from = 0.2, to = 0.36) {
    const out = pts.map(() => null);
    const dir = ctx.U.uScanDir.value;
    for (let p = from; p <= to + 1e-9; p += 0.001) {
      const sp = poseAt(p, camT);
      pts.forEach((q, i) => {
        if (out[i] !== null) return;
        ray.set(q[0] * 2 - 1, 1 - q[1] * 2, 0.5).unproject(camT).sub(camT.position).normalize();
        let x, z;
        const c = camT.position;
        if (ray.y < -1e-4 && -c.y / ray.y < 8000) { const t = -c.y / ray.y; x = c.x + ray.x * t; z = c.z + ray.z * t; }
        else { const l = Math.hypot(ray.x, ray.z) || 1; x = c.x + ray.x / l * 8000; z = c.z + ray.z / l * 8000; }
        if (sp - (x * dir.x + z * dir.y) > 120) out[i] = +p.toFixed(4);
      });
      if (out.every(v => v !== null)) break;
    }
    return out.map(v => (v === null ? to : v));
  }

  return {
    tick(dt, frozen) {
      lastDt = dt;
      if (state === 'run') {
        if (introOverride === null && !frozen) introT += dt;
        // the visitor started scrolling: the intro never holds the page
        if ((J.target > 0.012 || window.scrollY > innerHeight * 0.05) && introOverride === null) finish();
        else if (introOverride === null && introT >= IT.TOTAL) finish();
      }
    },
    apply(p) {
      if (inNight) return;
      const sz = ctx.size();
      if (state === 'run' && intro) {
        const t = introOverride === null ? introT : introOverride;
        intro.uniforms.uT.value = t;
        intro.uniforms.uPx.value = sz.dpr * sz.scale;
        intro.uniforms.uAlpha.value = 1 - sm(0.004, 0.02, p);
        intro.points.visible = !ctx.posterMode();
        hairU.uDraw.value = intro.drawAt(t);
      } else hairU.uDraw.value = state === 'wait' ? 0 : 1;
      labels.apply(p, sz.cssW, sz.cssH, ctx.posterMode());
    },
    lensAlpha(p) {
      if (ctx.posterMode() || p >= LENS_OUT[1]) return 0;
      const t = introOverride === null ? introT : introOverride;
      const k = state === 'done' ? 1 : state === 'wait' ? 0 : sm(IT.TS + IT.FLY * 0.6, IT.TS + IT.FLY + 0.7, t);
      return k * (1 - sm(LENS_OUT[0], LENS_OUT[1], p));
    },
    afterPost(p) {
      const a = this.lensAlpha(p);
      if (a <= 0.002) return;
      const sz = ctx.size();
      lens.update(ctx.clock(), lastDt, sz.cssW, sz.cssH);
      lens.render(a, sz, withNight);
    },
    busy(p, frozen) {
      if (state === 'run') return true;
      return this.lensAlpha(p) > 0.002 && !frozen;
    },
    api: {
      setIntro(t01) {
        if (t01 === null || t01 === undefined) { introOverride = null; ctx.markDirty(); return; }
        if (!intro) { fontOK = fontOK || (document.fonts && document.fonts.check && document.fonts.check('500 100px "Archivo Expanded"')); build(); }
        state = 'run'; intro.points.visible = true;
        introOverride = Math.min(1, Math.max(0, +t01)) * IT.TOTAL;
        ctx.markDirty();
      },
      skipIntro() { introOverride = null; finish(); },
      introDuration: IT.TOTAL,
      setLens(x, y, r) { lens.set(x, y, r); ctx.markDirty(); },
      scanPass
    }
  };
}
