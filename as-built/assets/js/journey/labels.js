/* AS BUILT · projected DOM labels. The Office 603 leader: a Signal Coral ring on the lit window, a
   two-stroke leader that draws on (scaleX) and the label, positioned with translate3d only.
   Pure function of (pS, camera). The text is duplicated as visually hidden copy in chapter 05. */
import * as THREE from '../../vendor/three/three.module.min.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeLabels({ root, camera, anchor }) {
  if (!root) return { apply() {}, hide() {} };
  const el = document.createElement('div');
  el.className = 'jl jl--603';
  el.innerHTML = '<i class="jl__ring"></i><i class="jl__lead jl__lead--a"></i><i class="jl__lead jl__lead--b"></i><span class="jl__txt"><b>Office 603</b><span class="jl__sep"> · </span>One by Omniyat</span>';
  root.appendChild(el);
  const ring = el.querySelector('.jl__ring'), la = el.querySelector('.jl__lead--a'), lb = el.querySelector('.jl__lead--b'), txt = el.querySelector('.jl__txt');
  const v = new THREE.Vector3();
  let shown = false, side = 0;
  const set = (node, tf, op) => { node.style.transform = tf; if (op !== undefined) node.style.opacity = op; };
  return {
    apply(p, w, h, posterMode) {
      // 603 lights at pS 0.555; the leader draws 0.557-0.57 and leaves as the camera cranes away
      const on = posterMode ? 0 : sm(0.553, 0.559, p) * (1 - sm(0.628, 0.642, p));
      if (on <= 0.001) { if (shown) { el.style.opacity = '0'; shown = false; } return; }
      v.copy(anchor).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { el.style.opacity = '0'; shown = false; return; }
      const x = (v.x * 0.5 + 0.5) * w, y = (0.5 - v.y * 0.5) * h;
      // portrait: the chapter copy owns the lower half, so the label fades out before it can sit on the headline
      const vis = h > w ? on * (1 - sm(h * 0.4, h * 0.46, y)) : on;
      if (vis <= 0.001) { if (shown) { el.style.opacity = '0'; shown = false; } return; }
      // the leader runs away from the frame edge it is nearest to
      const want = x > w * 0.62 ? 1 : 0;
      if (want !== side || !shown) { side = want; el.classList.toggle('is-left', side === 1); }
      shown = true;
      el.style.opacity = vis.toFixed(3);
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      const d1 = sm(0.556, 0.563, p), d2 = sm(0.561, 0.569, p), t = sm(0.565, 0.574, p);
      set(ring, `translate(-50%,-50%) scale(${(0.4 + 0.6 * sm(0.553, 0.558, p)).toFixed(3)})`);
      set(la, `rotate(${side ? -135 : -45}deg) scaleX(${d1.toFixed(3)})`);
      set(lb, `scaleX(${d2.toFixed(3)})`);
      set(txt, `translate3d(${((1 - t) * (side ? 10 : -10)).toFixed(1)}px,-50%,0)`, t.toFixed(3));
    },
    hide() { el.style.opacity = '0'; shown = false; }
  };
}
