/* AS BUILT · city: district map, ground (blueprint / model / real / night), studio floor, plinth,
   instanced tower archetypes, skyline texture, the scan blade. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { U, COMMON_FRAG, makeTowerMaterial, makeTowerDepthMaterial, makeDepthMaterial } from './materials.js';

export const MAP = { x0: -3400, z0: -4100, size: 8000, res: 1024 };

/* ---------- district map: R water, G roads, B plots, A parks/sand ---------- */
export function buildDistrictMap(geo) {
  const N = MAP.res, k = N / MAP.size;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.setTransform(k, 0, 0, k, -MAP.x0 * k, -MAP.z0 * k); x.fillStyle = '#000'; x.fillRect(MAP.x0, MAP.z0, MAP.size, MAP.size); x.lineCap = 'round'; x.lineJoin = 'round'; return x; };
  const poly = (x, pts) => { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); };
  // water
  const W = mk();
  W.strokeStyle = '#fff'; W.lineWidth = geo.canalWidth; poly(W, geo.canal); W.stroke();
  W.fillStyle = '#fff'; poly(W, geo.lake); W.closePath(); W.fill();
  W.beginPath(); W.moveTo(-geo.coast - MAP.z0 + 4000, MAP.z0 - 4000); W.lineTo(MAP.x0 - 4000, -geo.coast - MAP.x0 + 4000); W.lineTo(MAP.x0 - 4000, MAP.z0 - 4000); W.closePath(); W.fill();
  // roads (soft edge: wide faint + core)
  const R = mk();
  for (const pass of [[1.9, 0.35], [1, 1]]) for (const r of geo.roads) { R.strokeStyle = `rgba(255,255,255,${pass[1]})`; R.lineWidth = r.w * pass[0]; poly(R, r.pts); R.stroke(); }
  // plots: footprint pads
  const B = mk();
  B.fillStyle = 'rgba(255,255,255,0.55)';
  for (const p of geo.plots) {
    const [x, z, w, d, , rot, , , , , , podH, podS] = p;
    const s = podH > 0 ? podS : 1;
    B.save(); B.translate(x, z); B.rotate(-rot); B.fillRect(-w * s * 0.8, -d * s * 0.8, w * s * 1.6, d * s * 1.6); B.restore();
  }
  B.fillStyle = '#fff';
  for (const p of geo.plots) { const [x, z, w, d, , rot] = p; B.save(); B.translate(x, z); B.rotate(-rot); B.fillRect(-w / 2, -d / 2, w, d); B.restore(); }
  // parks / open sand
  const A = mk();
  A.fillStyle = '#fff';
  A.beginPath(); A.arc(0, 0, 175, 0, Math.PI * 2); A.fill(); // Burj Park
  A.beginPath(); A.ellipse(-120, 260, 140, 70, 0.4, 0, Math.PI * 2); A.fill();
  A.beginPath(); A.ellipse(1900, 300, 160, 90, -0.5, 0, Math.PI * 2); A.fill();
  A.beginPath(); A.ellipse(-1500, -1800, 260, 160, 0.78, 0, Math.PI * 2); A.fill();
  // canal park on the north bank in front of One by Omniyat: the 05a foreground is palms and lawn, not blocks
  A.beginPath(); A.ellipse(1300, -385, 300, 80, -0.22, 0, Math.PI * 2); A.fill();
  A.beginPath(); A.ellipse(1395, -470, 85, 60, -0.9, 0, Math.PI * 2); A.fill();
  A.fillStyle = 'rgba(255,255,255,0.5)';
  A.beginPath(); A.ellipse(2600, 1500, 900, 500, 0.3, 0, Math.PI * 2); A.fill(); // open sand SE (Ras Al Khor side)
  const img = new Uint8Array(N * N * 4);
  const dW = blurChannel(W.getImageData(0, 0, N, N).data, N, 2, 2), dR = R.getImageData(0, 0, N, N).data, dB = B.getImageData(0, 0, N, N).data, dA = A.getImageData(0, 0, N, N).data;
  for (let i = 0; i < N * N; i++) { img[i * 4] = dW[i * 4]; img[i * 4 + 1] = dR[i * 4]; img[i * 4 + 2] = dB[i * 4]; img[i * 4 + 3] = dA[i * 4]; }
  const tex = new THREE.DataTexture(img, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.userData.img = img;
  tex.flipY = false; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  return tex;
}

/* separable box blur of channel 0 (radius r, n passes): the water mask becomes a smooth ramp whose 0.5 contour
   is a clean shoreline instead of 8 m texel steps */
function blurChannel(src, N, r, n) {
  let a = new Float32Array(N * N), b = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) a[i] = src[i * 4];
  const w = 1 / (2 * r + 1);
  for (let it = 0; it < n; it++) {
    for (let y = 0; y < N; y++) { const o = y * N; let acc = 0; for (let k = -r; k <= r; k++) acc += a[o + Math.min(N - 1, Math.max(0, k))];
      for (let x = 0; x < N; x++) { b[o + x] = acc * w; acc += a[o + Math.min(N - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < N; x++) { let acc = 0; for (let k = -r; k <= r; k++) acc += b[Math.min(N - 1, Math.max(0, k)) * N + x];
      for (let y = 0; y < N; y++) { a[y * N + x] = acc * w; acc += b[Math.min(N - 1, y + r + 1) * N + x] - b[Math.max(0, y - r) * N + x]; } }
  }
  const out = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) out[i * 4] = Math.round(Math.min(255, Math.max(0, a[i])));
  return out;
}

/* ---------- ground ---------- */
const GROUND_VERT = /* glsl */`
varying vec3 vWorld;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
/* studio cyc colour (seamless sweep under the model): shared by the floor and the not-yet-real ground */
const CYC_GLSL = /* glsl */`
vec3 cycColor(vec3 P){
  vec3 V = normalize(P - uCamPos);
  float sd = max(sdFoot(P.xz), 0.);
  float contact = 1. - .75 * exp(-sd / 160.) - .2 * exp(-sd / 900.);
  vec3 col = lutRow(-.2, uHourModel) * .75 * contact;
  // studio: a seamless sweep, Studio Lilac under the camera rising to Dawn Rose toward the horizon
  vec3 rose = vec3(.84, .47, .42), lilac = vec3(.48, .40, .70);
  float t = smoothstep(-.9, -.25, V.y);
  vec3 sweep = mix(lilac * .5, rose * .72, t) * contact;
  col = mix(col, sweep, clamp(uHourModel, 0., 1.));
  col += uKeyColor * .05 * contact;
  vec2 c = (uFootprint.xy + uFootprint.zw) * .5;
  float far = smoothstep(2500., 16000., length(P.xz - c));
  vec3 farC = skyModelBase(V);
  float rm = skyRealMask(V);
  if (rm > 0.) farC = mix(farC, skyRealBase(normalize(vec3(V.x, .0015, V.z))), rm);
  return mix(col, farC, far);
}
`;
const GROUND_FRAG = /* glsl */`
uniform sampler2D uMap; uniform vec4 uMapRect;
uniform sampler2D uMirror; uniform mat4 uMirrorMat; uniform float uMirrorOn;
varying vec3 vWorld;
float gridLine(vec2 p, float spacing, float px){
  vec2 g = abs(fract(p / spacing - .5) - .5) * spacing;
  vec2 fw = fwidth(p);
  vec2 l = 1. - smoothstep(fw * .5 * px, fw * (.5 * px + 1.), g);
  float fade = 1. - smoothstep(.12, .3, max(fw.x, fw.y) / spacing * 2.);
  return max(l.x, l.y) * fade;
}
/* a contour of a soft mask drawn with a world-space width (metres); fades out once it is sub-pixel */
float contourM(float v, float level, float fv, float mPerPx, float widthM){
  float dM = abs(v - level) / max(fv, 1e-5) * mPerPx;
  float l = 1. - smoothstep(widthM * .5 - mPerPx * .5, widthM * .5 + mPerPx * .5, dM);
  return l * clamp(widthM / mPerPx, 0., 1.);
}
/* analytic water reflection (low tier / no mirror): sky plus a soft, azimuth-blurred city silhouette */
vec3 reflectWater(vec3 R, vec3 P){
  vec3 c = skyNoDisc(R);
  float el = asin(clamp(R.y, -1., 1.));
  float dc = length(P.xz - uSkyCenter.xz);
  float az = atan(R.x, -R.z) / (2. * PI) + .5;
  float se = 0.;
  for (int i = -4; i <= 4; i++) se += texture(uSkyline, vec2(az + float(i) * .004, .5)).r;
  se = se / 9. * min(1., 2200. / max(dc, 1.));
  float occ = 0.;
  for (int k = 0; k < 6; k++) occ += 1. - smoothstep(se - .05, se + .03, el + (float(k) - 2.5) * .012);
  occ = occ / 6. * .6 * realAt(P.xz) * smoothstep(6500., 3200., dc);
  return mix(c, hazeColor(R) * .35, occ);
}
/* cubic B-spline lookup in four bilinear taps: map edges seen up close curve instead of stair-stepping along the texel grid */
vec4 bsCubic(float v){
  vec4 n = vec4(1., 2., 3., 4.) - v; vec4 s = n * n * n;
  float x = s.x, y = s.y - 4. * s.x, z = s.z - 4. * s.y + 6. * s.x;
  return vec4(x, y, z, 6. - x - y - z) / 6.;
}
vec4 texBSpline(sampler2D t, vec2 uv){
  vec2 ts = vec2(textureSize(t, 0));
  vec2 st = uv * ts - .5; vec2 f = fract(st); st -= f;
  vec4 xc = bsCubic(f.x), yc = bsCubic(f.y);
  vec4 c = st.xxyy + vec2(-.5, 1.5).xyxy;
  vec4 sm = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / sm) / ts.xxyy;
  float sx = sm.x / (sm.x + sm.y), sy = sm.z / (sm.z + sm.w);
  return mix(mix(texture(t, o.yw), texture(t, o.xw), sx), mix(texture(t, o.yz), texture(t, o.xz), sx), sy);
}
void main(){
  vec3 P = vWorld;
  vec2 muv = (P.xz - uMapRect.xy) / uMapRect.z;
  bool inMap = muv.x > 0. && muv.x < 1. && muv.y > 0. && muv.y < 1.;
  vec4 m = inMap ? texBSpline(uMap, muv) : vec4(0.);
  float coast = smoothstep(30., -30., P.x + P.z + 5200.);
  if (!inMap) m.r = coast;
  float sdF = sdFoot(P.xz);
  bool inFoot = sdF < 0.;
  float real = realAt(P.xz);
  float bp = uBlueprint;
  if (!inFoot && real < .01 && bp < .01) discard;
  vec3 N = vec3(0., 1., 0.);
  vec3 V = normalize(uCamPos - P);
  float dist = length(uCamPos - P);
  // ---------- blueprint paper ----------
  vec3 bpC = vec3(0.);
  if (bp > 0.) {
    float r = length(P.xz - uCamPos.xz) / max(uCamPos.y, 1.);
    bpC = C_SAPPHIRE * (1.25 - .45 * smoothstep(0., 1.2, r));
    float g = gridLine(P.xz, 100., 1.) * .5 + gridLine(P.xz, 500., 1.2) * .7 + gridLine(P.xz, 20., .8) * .35;
    bpC += C_LINE * g * .07;
    float hs = 14.;
    float hatch = 1. - smoothstep(.0, fwidth((P.x + P.z) / hs) * 1.2, abs(fract((P.x + P.z) / hs) - .5) - .38);
    float hfade = 1. - smoothstep(.2, .45, fwidth((P.x + P.z) / hs));
    // the map is soft; threshold it per pixel so water, pads and road beds have drawn, not blurred, edges
    vec3 fm = max(fwidth(m.rgb), vec3(1e-4));
    float wC = smoothstep(.5 - fm.r, .5 + fm.r, m.r);
    float pC = smoothstep(.45 - fm.b, .45 + fm.b, m.b);
    float rC = smoothstep(.5 - fm.g, .5 + fm.g, m.g);
    bpC += C_LINE * hatch * hfade * (wC * .16 + pC * .07);
    bpC += C_LINE * (pC * .025 + rC * .03);
  }
  // ---------- studio model: graphite plinth top, engraved roads, glossy canal groove; the cyc beyond it ----------
  vec3 mdC = vec3(0.);
  if (real < 1. && bp < 1.) {
    if (inFoot) {
      vec3 Lm = studioLight(N, P, 0.);
      vec3 base = vec3(.0105, .011, .0165) * 1.3;
      base = mix(base, base * 1.8, smoothstep(.2, .7, m.b));
      base += uPorcelain * .03 * smoothstep(.55, .95, m.g);
      mdC = base * Lm;
      float F = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
      vec3 R = reflect(-V, N);
      vec3 gloss = skyModelBase(R) * (F * .5 + .02);
      mdC += gloss * (1. + m.r * 5.);
      mdC = mix(mdC, vec3(.002, .003, .006) + skyModelBase(R) * (F * .9 + .03), smoothstep(.4, .7, m.r));
    } else mdC = cycColor(P);
  }
  // ---------- real ground ----------
  vec3 rlC = vec3(0.);
  vec3 emis = vec3(0.);
  if (real > 0.) {
    vec2 q = P.xz;
    vec2 fq = fwidth(q);
    float mPerPx = max(length(fq) * .7071, 1e-3);
    // dusty paving and sand lots, broken up at two scales (no tile grid: it read as a game board from 220 m)
    float n1 = fbm2(q / 380.), n2 = vnoise(q / 61.), n3 = vnoise(q / 9.);
    float urban = inMap ? clamp(.45 + .55 * smoothstep(0., .6, 1. - m.a), 0., 1.) : smoothstep(14000., 6000., length(q - vec2(600., -100.))) * .8;
    vec3 sand = vec3(.22, .185, .15) * (.82 + .3 * n1);
    vec3 paved = mix(vec3(.15, .14, .13), vec3(.2, .19, .175), n2) * (.9 + .2 * n1);
    vec3 alb = mix(sand, paved, urban * .85);
    alb *= .92 + .16 * mix(n3, .5, smoothstep(.5, 2., mPerPx));
    alb = mix(alb, vec3(.22, .21, .2), smoothstep(.2, .7, m.b) * .8);        // plazas, plot pads
    float park = smoothstep(.5, .9, m.a) * step(.75, m.a + .2) * (inMap ? 1. : 0.);
    // gardens and sand lots in irregular patches between the blocks (no tile grid)
    float gard = smoothstep(.64, .74, vnoise(q / 92. + 3.1)) * urban;
    float lot = smoothstep(.6, .68, vnoise(q / 150. - 7.7)) * (1. - gard);
    alb = mix(alb, vec3(.25, .2, .155) * (.85 + .3 * n2), lot * .8);
    alb = mix(alb, vec3(.04, .055, .032) * (.75 + .5 * n3), gard * .75);
    alb = mix(alb, mix(vec3(.05, .066, .036), vec3(.075, .08, .045), n2) * (.8 + .4 * n3), park);   // lawn and planting: olive, never teal or copper
    // roads: asphalt at about 0.75x the paving beside it, a 1 px pale kerb, a faint lane line inside the carriageway
    float fg = fwidth(m.g);
    float road = smoothstep(.25, .8, m.g);
    vec3 asph = mix(vec3(.078, .074, .082), vec3(.092, .088, .094), n2);
    alb = mix(alb, asph, road);
    float kerbW = max(1.6, mPerPx * .9);
    float kerbFade = 1. - smoothstep(1.2, 3.5, mPerPx);   // from the air the kerb is part of the road, not a drawn outline
    alb = mix(alb, vec3(.3, .28, .25), contourM(m.g, .5, fg, mPerPx, kerbW) * .6 * kerbFade * float(inMap));
    alb = mix(alb, vec3(.24, .23, .21), contourM(m.g, .86, fg, mPerPx, .6) * .5 * float(inMap));
    // palms along the verges: dark canopies with a short shadow toward the anti-sun
    float verge = (1. - smoothstep(.04, .09, abs(m.g - .3))) * urban * (1. - park);
    float palm = 0., palmSh = 0.;
    if (verge > 0.) {
      vec2 ps = q / 11.;
      vec2 pc = floor(ps);
      vec2 jit = hash22(pc) * .5 + .25;
      float r = length((ps - pc - jit) * 11.);
      vec2 sOff = -normalize(uSunDir.xz + 1e-5) * 6.;
      float rs = length((ps - pc - jit) * 11. - sOff);
      float aa = mPerPx * .8;
      palm = (1. - smoothstep(2.6 - aa, 2.6 + aa, r)) * step(.25, hash12(pc + 4.1));
      palmSh = (1. - smoothstep(2.4 - aa, 2.4 + aa, rs)) * step(.25, hash12(pc + 4.1)) * (1. - palm);
      float sub = smoothstep(1.2, 3., mPerPx);
      palm = mix(palm, .12, sub) * verge; palmSh = mix(palmSh, .1, sub) * verge;
    }
    float sh;
    vec3 L = realLight(N, P, sh);
    L += uSkyAmb * 1.1;   // open ground sees the whole sky dome: shadows stay lilac, never black (>= 35% of lit)
    L += uSunLight * .045 * (1. - uNight) * smoothstep(-.1, .1, uSunDir.y);   // and the bright dusty horizon round the sun: shaded paving reads warm mauve, not blue
    rlC = alb * L * (1. - palmSh * .55);
    rlC = mix(rlC, vec3(.025, .045, .035) * (uSkyAmb * 1.75 + uSunLight * max(uSunDir.y, 0.) * sh * 1.6), palm);
    // Sheikh Zayed Road traffic: sparse warm heads one way, coral tails the other (a scale cue by day, rivers at night)
    {
      float dS = (P.x + P.z + 950.) * .70711, aS = (P.x - P.z) * .70711;
      if (abs(dS) < 30. && abs(dS) > 3. && inMap) {
        float lane = floor(dS / 3.6), laneC = (lane + .5) * 3.6;
        float cl = floor(aS / 18.);
        float dens = mix(.15, .7, uNight);
        float on = step(hash12(vec2(lane * 1.7, cl)), dens);
        float pc = (cl + .2 + .6 * hash12(vec2(cl, lane + 7.))) * 18.;
        float dd = length(vec2((aS - pc) * .45, dS - laneC));
        float aa = mPerPx * .7;
        float dotC = 1. - smoothstep(.7 - aa, .7 + aa, dd);
        float sub = smoothstep(.8, 2.4, mPerPx);
        float lit = mix(on * dotC, dens * .05, sub);
        vec3 cc = dS < 0. ? vec3(1., .86, .66) : vec3(1., .24, .15);
        emis += cc * lit * 2.4 * (1. - smoothstep(4., 12., mPerPx)) * (1. - uNight);   // by night the instanced car rivers take over
      }
    }
    // water: canal, lake, Gulf. The blurred mask gives a clean contour; its gradient gives the distance to the edge in metres
    float fr = max(fwidth(m.r) * .75, 1e-3);
    float wat = smoothstep(.5 - fr, .5 + fr, m.r);
    float dEdge = 1e3;
    if (inMap && m.r > .02 && m.r < .98) {
      float tx = uMapRect.z / 1024.;
      vec2 du = vec2(1. / 1024., 0.);
      vec2 gr = vec2(textureLod(uMap, muv + du.xy, 0.).r - textureLod(uMap, muv - du.xy, 0.).r, textureLod(uMap, muv + du.yx, 0.).r - textureLod(uMap, muv - du.yx, 0.).r) / (2. * tx);
      dEdge = (m.r - .5) / max(length(gr), 1e-5);   // metres, + into the water
    }
    // a pale stone quay lip (2.6 m) along every edge
    {
      float aa = mPerPx * .7;
      float lipD = -dEdge;
      float lip = smoothstep(-aa, aa, lipD) * (1. - smoothstep(5. - aa, 5. + aa, lipD)) * clamp(5. / mPerPx, 0., 1.);
      rlC = mix(rlC, vec3(.584, .479, .381) * L * .8, lip * (1. - wat));
    }
    if (wat > 0.) {
      vec2 wq = P.xz * vec2(.06, .02);
      float t = uTime * .6;
      // ripples grow with distance so far reflections break up instead of mirroring hard edges
      float amp = mix(1., 2., smoothstep(250., 1500., dist));
      vec2 nw = (vec2(vnoise(wq * 3. + t) - .5, vnoise(wq * 3.3 - t * .8 + 9.) - .5) * .18 + vec2(vnoise(wq * 9. + t * 1.7) - .5, vnoise(wq * 8. - t * 1.3) - .5) * .08) * amp;
      float fadeN = 1. - smoothstep(.3, 3., fwidth(wq.x) * 40.);
      vec3 Nw = normalize(vec3(nw.x * fadeN, 1., nw.y * fadeN));
      vec3 R = reflect(-V, Nw);
      R.y = abs(R.y);
      float F = .02 + .98 * pow(1. - max(dot(Nw, V), 0.), 5.);
      float slick = smoothstep(.38, .72, fbm2(P.xz / 240. + vec2(uTime * .004, 0.)));
      vec3 env;
      if (uMirrorOn > .5) {
        // planar mirror: ripple distortion, then 6 vertical taps so lit edges smear into soft streaks
        vec4 mc = uMirrorMat * vec4(P.x, 0., P.z, 1.);
        vec2 mu = mc.xy / mc.w;
        float dk = 1. / (1. + dist / 700.);
        mu += vec2(nw.x * .03, nw.y * .09) * dk * fadeN;
        // long low swell: rows of water across the view shift the image sideways a little
        vec2 vf = normalize(P.xz - uCamPos.xz);
        float across = dot(P.xz, vec2(-vf.y, vf.x));
        float swell = (vnoise(vec2(dist * .07, across * .008) + vec2(t * .2, 0.)) - .5) + (vnoise(vec2(dist * .19, across * .015 + 3.1) - vec2(t * .35, 0.)) - .5) * .6;
        mu.x += swell * .007 * dk;
        float st = mix(.007, .013, 1. - slick) * dk;
        env = vec3(0.);
        for (int k = 0; k < 6; k++) env += texture(uMirror, mu + vec2((mod(float(k), 2.) - .5) * st * .5, (float(k) - 2.5) * st)).rgb;
        env /= 6.;
        // bright reflected edges (sunlit rims) are soft-clamped: a soft vertical streak, never a zig-zag of glitter
        float le = luma(env);
        env *= min(1., 1.1 / max(le, 1e-4)) * mix(1., .85, smoothstep(.5, 1.1, le));
      } else env = reflectWater(R, P);
      vec3 sunR = sunDisc(R) * .9;
      // golden hour: the body of the canal glows apricot; at dusk it cools to Gulf Teal
      float gold = smoothstep(-.02, .12, uSunDir.y) * (1. - uNight);
      vec3 deep = mix(vec3(.004, .018, .022), vec3(.03, .012, .006), gold);
      // reflectance: Schlick plus a calm-water floor, kept below the sky so the water reads as water, not a bright sheet
      float Fr = mix(.07, .12, slick) + F * .5;
      vec3 wc = deep * (luma(uSkyAmb) + luma(uSunLight) * .22) * 2.2 + (env * Fr + sunR * F);
      // statistical sun glitter (Cox-Munk style slope distribution): the molten column under a low sun
      vec3 Hs = normalize(uSunDir + V);
      float t2 = (1. - Hs.y * Hs.y) / max(Hs.y * Hs.y, 1e-4);
      float s2 = mix(.02, .05, 1. - slick);
      float glc = exp(-t2 / s2) / (s2 * 16.);
      float spark = mix(1., .45 + 1.5 * step(.7, hash12(floor(P.xz * vec2(.7, .25) + floor(uTime * 3.)))), fadeN);
      wc += uSunLight * vec3(1., .78, .55) * glc * spark * (.25 + F) * .9 * mix(.45, 1., sh) * smoothstep(-.02, .03, uSunDir.y);
      // the low sun sits just off the left of the long views: its glitter path runs across the water toward it
      vec2 toS = normalize(uSunDir.xz + 1e-5), toP = normalize(P.xz - uCamPos.xz + 1e-5);
      float pathK = pow(max(dot(toS, toP), 0.), 8.) * smoothstep(-.02, .04, uSunDir.y) * (1. - uNight);
      float glint = .35 + 1.3 * smoothstep(.55, .9, vnoise(vec2(P.x * .5 + P.z * .21, (P.z - P.x * .3) * .09) * vec2(1., 2.6) + vec2(uTime * .7, 0.)));
      wc += uSunLight * vec3(1., .6, .28) * pathK * (.05 + .3 * F) * mix(glint, 1., 1. - fadeN) * mix(.5, 1., sh) * mix(.2, 1., smoothstep(.04, .3, luma(env)));
      // a darker wet band along the quay
      float aa = mPerPx * .7;
      float wet = (1. - smoothstep(2.2 - aa, 2.2 + aa, dEdge)) * clamp(2.2 / mPerPx, 0., 1.);
      wc *= 1. - .35 * wet;
      rlC = mix(rlC, wc, wat);
    }
    // night: the road beds glow faintly under their lamps (the lamps and the traffic are the life layer), and the
    // urban fabric carries a fine grain of small lights (garden lamps, car parks, lobbies), never squares
    if (uNight > 0.) {
      float xw = clamp((uWave - length(P.xz - uO603.xz) - 200.) / 500., 0., 1.) * uNight;
      float roadC = smoothstep(.45, .9, m.g) * float(inMap);
      // from high up the lamps and headlights along a road are sub-pixel: their light is carried by the road itself
      // (the verges under the lamp heads brightest, pooled), so the street grid reads as warm lines from the air
      float farG = smoothstep(.9, 3., mPerPx);
      float kerb = smoothstep(.38, .55, m.g) * (1. - smoothstep(.8, .97, m.g)) * float(inMap);
      float pool = vnoise(P.xz / 16.); pool = .3 + 1.2 * pool * pool;
      // (the street lamps come on at dusk, ahead of the wave: the road beds carry a dimmer version of their light)
      float xr = max(xw, smoothstep(.36, .5, uNight) * .45 * uNight);
      emis += vec3(1., .46, .16) * (roadC * .006 + (kerb * .05 + roadC * .006) * pool * farG) * xr;
      vec2 cq = P.xz / 11.;
      vec2 ci = floor(cq);
      vec2 cj = hash22(ci) * .7 + .15;
      float hs = hash12(ci + 17.7);
      float dM = length((cq - ci - cj) * 11.);
      float r = .8, aa = max(mPerPx * .7, r);
      float dotv = (1. - smoothstep(aa * .4, aa, dM)) * (r * r) / (aa * aa);
      // lights cluster by neighbourhood and round the plots; open lots stay dark
      float hood = smoothstep(.35, .75, fbm2(P.xz / 520.)) * .8 + .2;
      float fab = urban * (1. - wat) * (1. - park * .7) * (1. - roadC) * (.45 + .55 * smoothstep(.05, .5, m.b)) * hood;
      float pd = .2;
      float dens = step(hs, pd) * fab;
      vec3 lc = hs < pd * .72 ? vec3(1., .42, .12) : vec3(1., .66, .36);
      float avg = pd * 3.1416 * r * r / 121.;
      float subD = smoothstep(3., 6., mPerPx);
      emis += mix(lc * dotv * dens, vec3(1., .56, .26) * avg * fab, subD) * 1.1 * xw;
    }
    // park paths: bollards on at dusk with the street lamps (small warm points, each in a faint pool)
    float parkL = park * (1. - wat) * smoothstep(.36, .5, uNight) * uNight;
    if (parkL > 0.) {
      vec2 pq = P.xz / 15., pi = floor(pq), pj = hash22(pi + 31.7) * .6 + .2;
      float dP = length((pq - pi - pj) * 15.);
      float aa = max(mPerPx * .7, .45);
      float bol = (1. - smoothstep(aa * .4, aa, dP)) * (.2 / (aa * aa)) * step(hash12(pi + 5.1), .4);
      emis += vec3(1., .5, .2) * (bol * 1.2 + exp(-dP * dP / 18.) * .012 * step(hash12(pi + 5.1), .4)) * parkL;
    }
    rlC += emis;
    // the ground is seen down through the dust, mostly in the city's shade: a lighter veil than the skyline gets
    rlC = aerial(rlC, P, .7);
    // far ground melts into the horizon sky itself: no colour step at the horizon line
    float farK = smoothstep(4500., 9000., length(P.xz - uCamPos.xz));
    if (farK > 0.) { vec3 dv = normalize(P - uCamPos); rlC = mix(rlC, skyNoDisc(normalize(vec3(dv.x, .0015, dv.z))) * mix(1., mix(.8, mix(.86, .4, smoothstep(.004, .05, -dv.y)), wat), uNight) + sunDisc(dv) * wat, farK); }
  }
  vec3 col = mix(mix(mdC, rlC, real), bpC, bp);
  col += scanBand(P.xz) * .7 * (1. - bp);
  gl_FragColor = vec4(col, 1.);
}`;

export function makeGround(mapTex) {
  const geo = new THREE.PlaneGeometry(140000, 140000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uMap: { value: mapTex }, uMapRect: { value: new THREE.Vector4(MAP.x0, MAP.z0, MAP.size, 0) }, uMirror: { value: null }, uMirrorMat: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 } }, U),
    vertexShader: GROUND_VERT, fragmentShader: COMMON_FRAG + CYC_GLSL + GROUND_FRAG
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  return mesh;
}

/* ---------- studio floor (cyc) under the plinth, fades into the studio sky ---------- */
const FLOOR_FRAG = /* glsl */`
varying vec3 vWorld;
void main(){ gl_FragColor = vec4(cycColor(vWorld), 1.); }`;
export function makeFloor() {
  const geo = new THREE.PlaneGeometry(90000, 90000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: GROUND_VERT, fragmentShader: COMMON_FRAG + CYC_GLSL + FLOOR_FRAG });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(600, -90, -200);
  mesh.frustumCulled = false;
  return mesh;
}

/* ---------- plinth: graphite sides with an engraved front edge; dissolves behind the scan ---------- */
function engravingTexture() {
  const c = document.createElement('canvas'); c.width = 4096; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff';
  x.font = '500 46px "IBM Plex Mono", ui-monospace, monospace';
  x.textBaseline = 'middle';
  const t = 'DOWNTOWN  ·  BUSINESS BAY  ·  DUBAI';
  const spaced = t.split('').join(' ');
  x.letterSpacing = '14px';
  x.fillText(spaced, 220, 64);
  x.fillRect(220, 104, 3200, 2);
  x.font = '400 26px "IBM Plex Mono", ui-monospace, monospace';
  x.fillText(((window.MF_BRAND && window.MF_BRAND.name) || 'MAFSAN Realty').toUpperCase() + '  ·  MODEL 1:1000  ·  ILLUSTRATIVE', 2600, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 8;
  return tex;
}
const PLINTH_VERT = /* glsl */`
varying vec3 vWorld; varying vec3 vNormal; varying vec2 vUv;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz; vNormal = normal; vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
const PLINTH_FRAG = /* glsl */`
uniform sampler2D uEngrave;
varying vec3 vWorld; varying vec3 vNormal; varying vec2 vUv;
void main(){
  vec3 P = vWorld; vec3 N = normalize(vNormal);
  float real = realAt(P.xz);
  if (real > .5 || uBlueprint > .99) discard;
  vec3 V = normalize(uCamPos - P);
  vec3 Lm = studioLight(N, P, .1);
  vec3 base = vec3(.0105, .011, .0165);
  float F = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
  vec3 col = base * Lm + skyModelBase(reflect(-V, N)) * F * .6;
  float eng = 0.;
  if (N.z > .5) eng = texture(uEngrave, vec2(vUv.x * 2.2 - .05, vUv.y * 3. - 1.35)).r * step(0., vUv.x * 2.2 - .05) * step(vUv.x * 2.2 - .05, 1.) * step(0., vUv.y * 3. - 1.35) * step(vUv.y * 3. - 1.35, 1.);
  col = mix(col, uPorcelain * Lm * .55, eng * .85);
  // top lip catches the key light
  col += uPorcelain * Lm * .25 * (1. - smoothstep(0., 2.5, -P.y));
  col += scanBand(P.xz) * 1.4;
  gl_FragColor = vec4(col, 1.);
}`;
export function makePlinth(foot, H) {
  const [x0, z0, x1, z1] = foot;
  const w = x1 - x0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, H, d);
  geo.translate((x0 + x1) / 2, -H / 2 - 0.4, (z0 + z1) / 2);
  const mat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uEngrave: { value: engravingTexture() } }, U), vertexShader: PLINTH_VERT, fragmentShader: COMMON_FRAG + PLINTH_FRAG });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ---------- tower archetypes (unit footprint [-.5,.5]^2, part height 0..1) ---------- */
function Builder() {
  const pos = [], nrm = [], face = [], tan = [];
  const api = {
    quad(a, b, c, d, n, u0, u1, part, uEdge, t) { // a,b bottom; c,d top (b->c same side)
      const P = [a, b, c, a, c, d], UV = [[u0, 0], [u1, 0], [u1, 1], [u0, 0], [u1, 1], [u0, 1]];
      for (let i = 0; i < 6; i++) { pos.push(...P[i]); nrm.push(...n); face.push(UV[i][0], P[i][1] - (part === 1 ? 0 : 0), part, uEdge); tan.push(...t); }
    },
    cap(ring, y, part) { // fan, perimeter v=0, centre v=.5
      let cx = 0, cz = 0; ring.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= ring.length; cz /= ring.length;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const tri = [[cx, y, cz, .5], [b[0], y, b[1], 0], [a[0], y, a[1], 0]];
        for (const v of tri) { pos.push(v[0], v[1], v[2]); nrm.push(0, 1, 0); face.push(.5, v[3], part, 0); tan.push(0, 0, 0); }
      }
    },
    capQuad(ring, y, part) { // two-triangle cap for a 4-point ring (plant boxes: no radial v needed)
      for (const k of [0, 2, 1, 0, 3, 2]) { const a = ring[k]; pos.push(a[0], y, a[1]); nrm.push(0, 1, 0); face.push(.5, 0, part, 0); tan.push(0, 0, 0); }
    },
    prism(ring, part, segs, round) { // vertical sides from y 0..1, ring CCW seen from above (x right, z down)
      let per = 0; const L = [];
      for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; L.push(per); per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const ex = b[0] - a[0], ez = b[1] - a[1], el = Math.hypot(ex, ez);
        const n = [ez / el, 0, -ex / el];
        const na = round ? [a[0] / Math.hypot(a[0], a[1]), 0, a[1] / Math.hypot(a[0], a[1])] : n, nb = round ? [b[0] / Math.hypot(b[0], b[1]), 0, b[1] / Math.hypot(b[0], b[1])] : n;
        const NV = [na, nb, nb, na];
        for (let s = 0; s < segs; s++) {
          const y0 = s / segs, y1 = (s + 1) / segs;
          const u0 = round ? L[i] / per : 0, u1 = round ? (L[i] + el) / per : 1;
          const t = round ? [0, 1, 0] : [ex, 0, ez];
          // vertex order: a(y0), b(y0), b(y1), a(y1)
          const P = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
          const UV = [[u0, y0], [u1, y0], [u1, y1], [u0, y1]];
          for (const k of [0, 2, 1, 0, 3, 2]) {
            pos.push(...P[k]); nrm.push(...NV[k]); face.push(UV[k][0], UV[k][1], part, round ? 0 : 1); tan.push(...t);
          }
        }
      }
    },
    build() {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 4));
      g.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 3));
      return g;
    }
  };
  return api;
}
const rect = (sx, sz, ox = 0, oz = 0) => [[-sx / 2 + ox, -sz / 2 + oz], [-sx / 2 + ox, sz / 2 + oz], [sx / 2 + ox, sz / 2 + oz], [sx / 2 + ox, -sz / 2 + oz]];
const chamfer = (s, c) => { const h = s / 2; return [[-h, -h + c], [-h, h - c], [-h + c, h], [h - c, h], [h, h - c], [h, -h + c], [h - c, -h], [-h + c, -h]]; };
const circle = (n, r = .5) => { const a = []; for (let i = 0; i < n; i++) { const t = -i / n * Math.PI * 2; a.push([Math.cos(t) * r, -Math.sin(t) * r]); } return a.reverse(); };
function ccw(ring) { // ensure CCW when viewed from +Y with x right, z down => signed area > 0 in (x,z)
  let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a < 0 ? ring.slice().reverse() : ring;
}
function archetype(kind) {
  const b = Builder();
  let shaft, crown, segs = 1, round = false, crownRound = false;
  if (kind === 0) { shaft = rect(1, 1); crown = rect(.78, .62, .06, 0); }
  else if (kind === 1) { shaft = chamfer(1, .16); crown = chamfer(.62, .12); }
  else if (kind === 2) { shaft = rect(1, 1); crown = rect(.9, .9); segs = 48; }
  else if (kind === 3) { shaft = circle(24); crown = circle(24, .34); round = true; crownRound = true; }
  else if (kind === 4) { shaft = rect(1, 1); crown = rect(.6, .7, -.08, .04); }
  else { // 5: low-rise box with up to 3 rooftop plant boxes in separate quadrants (the vertex shader keeps 0-3 per block)
    shaft = ccw(rect(1, 1)); b.prism(shaft, 0, 1, false); b.cap(shaft, 1, 0);
    for (const r of [rect(.24, .26, .22, .2), rect(.2, .22, -.24, -.1)]) { const q = ccw(r); b.prism(q, 1, 1, false); b.capQuad(q, 1, 1); }
    return b.build();
  }
  shaft = ccw(shaft); crown = ccw(crown);
  b.prism(shaft, 0, segs, round); b.cap(shaft, 1, 0);
  b.prism(crown, 1, 1, crownRound); b.cap(crown, 1, 1);
  const pod = ccw(rect(1, 1));
  b.prism(pod, 2, 1, false); b.cap(pod, 1, 2);
  // part 3: a mast on the crown (crown type 2 only); part 4: a fin-frame crown screen flush with the shaft
  // (crown type 3 only). Both collapse to nothing for the other crown types
  b.prism(ccw(rect(1, 1)), 3, 1, false);
  b.prism(shaft.map(q => [q[0] * 0.995, q[1] * 0.995]), 4, 1, round);
  return b.build();
}

let sharedMat = null, sharedDepth = null;
function towerMats() { if (!sharedMat) { sharedMat = makeTowerMaterial(); sharedDepth = makeTowerDepthMaterial(); } return [sharedMat, sharedDepth]; }
export function makeTowers(geo, count) {
  const plots = geo.plots.slice(0, count);
  const groups = [];
  const [mat, depth] = towerMats();
  for (let kind = 0; kind < 6; kind++) {
    const list = plots.filter(p => p[6] === kind);
    if (!list.length) continue;
    const g = archetype(kind);
    const A = new Float32Array(list.length * 4), B = new Float32Array(list.length * 4), C = new Float32Array(list.length * 4), D = new Float32Array(list.length * 4), E = new Float32Array(list.length * 2), F = new Float32Array(list.length * 2);
    list.forEach((p, i) => {
      const [x, z, w, d, h, rot, , seed, crownH, taper, twist, podH, podScale, facade, lit, riseDelay, dist603, outside, , ct, mast] = p;
      A.set([x, z, rot, seed], i * 4); B.set([w, d, h, crownH], i * 4); C.set([riseDelay, lit, dist603, facade], i * 4); D.set([twist, taper, podH, podScale], i * 4); E.set([outside, 0], i * 2); F.set([ct || 0, mast || 0], i * 2);
    });
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
    g.setAttribute('iC', new THREE.InstancedBufferAttribute(C, 4));
    g.setAttribute('iD', new THREE.InstancedBufferAttribute(D, 4));
    g.setAttribute('iE', new THREE.InstancedBufferAttribute(E, 2));
    g.setAttribute('iF', new THREE.InstancedBufferAttribute(F, 2));
    g.instanceCount = list.length;
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.userData.depthMat = depth;
    groups.push(mesh);
  }
  return { meshes: groups, material: mat, count: plots.length };
}

/* ---------- low-rise carpet: thousands of small blocks between the towers, placed from the district map ---------- */
export function makeLowRise(geo, mapTex, opts = {}) {
  const img = mapTex.userData.img, N = MAP.res;
  const look = (x, z, c) => { const u = Math.floor((x - MAP.x0) / MAP.size * N), v = Math.floor((z - MAP.z0) / MAP.size * N); if (u < 0 || v < 0 || u >= N || v >= N) return 255; return img[(v * N + u) * 4 + c]; };
  let seed = 917331;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const cell = opts.cell || 78, list = [];
  const [fx0, fz0, fx1, fz1] = geo.footprint;
  const c45 = Math.SQRT1_2;
  // value noise for empty lots: sand plots and gaps between blocks show through in patches
  const hsh = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    return (hsh(i, j) * (1 - ux) + hsh(i + 1, j) * ux) * (1 - uz) + (hsh(i, j + 1) * (1 - ux) + hsh(i + 1, j + 1) * ux) * uz; };
  const camK = opts.thinAround || [1650, -120];
  for (let a = -6400; a < 6400; a += cell) for (let b = -6400; b < 6400; b += cell) {
    // grid aligned with the SZR diagonal
    const jx = (rnd() - .5) * cell * .35, jz = (rnd() - .5) * cell * .35;
    const x = 600 + (a + jx) * c45 - (b + jz) * c45, z = -200 + (a + jx) * c45 + (b + jz) * c45;
    const r = Math.hypot(x - 600, z + 200);
    if (r > 6200 || rnd() > (r < 3200 ? 0.92 : 0.92 - (r - 3200) / 3000 * 0.6)) { rnd(); rnd(); rnd(); rnd(); continue; }
    if (x + z < -geo.coast + 260) { rnd(); rnd(); rnd(); rnd(); continue; }
    const gapN = vn(x / 430 + 17.3, z / 430 - 4.1) * 0.65 + vn(x / 160 - 3.7, z / 160 + 9.2) * 0.35;
    const rc = Math.hypot(x - camK[0], z - camK[1]);
    const thin = rc > 700 && rc < 1500 ? 0.3 : 0;
    if (gapN < 0.3 || rnd() < thin) { rnd(); rnd(); rnd(); continue; }
    const w = 18 + rnd() * 30, d = 15 + rnd() * 28, hr = rnd();
    // heights over twice the old range: villas and walk-ups to mid-rise slabs, a few taller
    const h = hr < 0.08 ? 45 + rnd() * 50 : 6 + Math.pow(rnd(), 1.4) * 54;
    const rr = rnd();
    const rot = rr < 0.15 ? rr / 0.15 * Math.PI : Math.PI / 4 + (rr < 0.575 ? 0 : Math.PI / 2) + (rnd() - .5) * 0.05;
    let bad = false;
    for (const [ox, oz] of [[0, 0], [w * .5, d * .5], [-w * .5, d * .5], [w * .5, -d * .5], [-w * .5, -d * .5]]) {
      const px = x + ox * Math.cos(rot) + oz * Math.sin(rot), pz = z - ox * Math.sin(rot) + oz * Math.cos(rot);
      if (look(px, pz, 0) > 40 || look(px, pz, 1) > 70 || look(px, pz, 2) > 25 || look(px, pz, 3) > 150) { bad = true; break; }
    }
    if (bad) continue;
    const outside = !(x > fx0 && x < fx1 && z > fz0 && z < fz1);
    const riseDelay = outside ? 0 : Math.min(0.6, Math.hypot(x, z) / 5200 * 0.45 + rnd() * 0.15);
    const dist603 = Math.hypot(x - geo.omniyat[0], z - geo.omniyat[1]);
    // x z w d h rot arch seed crownH taper twist podH podScale facade lit riseDelay dist603 outside
    list.push([x, z, w, d, h, rot, 5, rnd(), 0, 0, 0, 0, 1, 1.0 + rnd() * 0.99, 0.25 + rnd() * 0.3, riseDelay, dist603, outside ? 1 : 0]);
  }
  const max = opts.max || 1e9;
  const use = list.length > max ? list.slice(0, max) : list;
  const g = archetype(5);
  const n = use.length;
  const A = new Float32Array(n * 4), B = new Float32Array(n * 4), C = new Float32Array(n * 4), D = new Float32Array(n * 4), E = new Float32Array(n * 2);
  use.forEach((p, i) => {
    A.set([p[0], p[1], p[5], p[7]], i * 4); B.set([p[2], p[3], p[4], 2.2 + ((p[7] * 7.13) % 1) * 2], i * 4); C.set([p[15], p[14], p[16], p[13]], i * 4); D.set([0, 0, 0, 1], i * 4); E.set([p[17], 1], i * 2);
  });
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
  g.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
  g.setAttribute('iC', new THREE.InstancedBufferAttribute(C, 4));
  g.setAttribute('iD', new THREE.InstancedBufferAttribute(D, 4));
  g.setAttribute('iE', new THREE.InstancedBufferAttribute(E, 2));
  g.setAttribute('iF', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2));
  g.instanceCount = n;
  const [mat, depth] = towerMats();
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.userData.depthMat = depth;
  // street trees and park planting ride on the low-rise mesh (one instanced draw, casts into the sun shadow map)
  const trees = makeTrees(geo, img, look, (opts.max || 1e9) < 5000 ? 1000 : 4200);
  mesh.add(trees);
  return { mesh, count: n, trees };
}

/* ---------- trees: palms along the verges and clumps in the parks (dark olive canopies, thin trunks) ---------- */
const TREE_VERT = /* glsl */`
attribute vec4 iT;
varying vec3 vWorld; varying vec3 vNormal; varying float vSeed; varying float vPart;
void main(){
  float s = iT.z;
  vec3 p = position;
  float trunk = step(.5, uv.x);
  // palm: six drooping fronds from the crown, a trunk of two crossed quads; s = frond length
  float H = s * 2.4;
  vec3 q = trunk > .5 ? vec3(p.x * .22, p.y * H, p.z * .22) : vec3(p.x * s, H + p.y * s, p.z * s);
  float c = cos(iT.w * 6.283), sn = sin(iT.w * 6.283);
  q.xz = vec2(c * q.x + sn * q.z, -sn * q.x + c * q.z);
  vec3 P = q + vec3(iT.x, 0., iT.y);
  vWorld = P; vNormal = normalize(vec3(c * normal.x + sn * normal.z, normal.y, -sn * normal.x + c * normal.z));
  vSeed = fract(iT.w * 17.31); vPart = trunk;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.);
}`;
const TREE_FRAG = /* glsl */`
varying vec3 vWorld; varying vec3 vNormal; varying float vSeed; varying float vPart;
void main(){
  vec3 P = vWorld;
  float real = realAt(P.xz);
  if (real < .5 || uBlueprint > .5) discard;
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - P);
  float sh; vec3 L = realLight(N, P, sh);
  // dark olive canopy (#34402F family) with a little per-tree variation; trunks a warm grey
  vec3 alb = vPart > .5 ? vec3(.028, .024, .021) : mix(vec3(.04, .058, .03), vec3(.055, .066, .032), vSeed);
  vec3 col = alb * L;
  // backlit fronds glow at their edges when the low sun is behind them
  float back = pow(max(dot(-V, uSunDir), 0.), 4.) * (1. - uNight) * smoothstep(-.03, .06, uSunDir.y);
  col += uSunLight * vec3(.32, .36, .1) * back * .08 * (1. - vPart) * mix(.3, 1., sh);
  // dusk: about half the palms are uplit (a warm trunk, brightest near its lamp, and a faint glow under the crown)
  float up = smoothstep(.36, .5, uNight) * step(vSeed, .55);
  if (up > 0.) col += vec3(1., .42, .14) * up * (vPart > .5 ? .018 + .14 * exp(-P.y / 2.2) : .045 * smoothstep(-.2, .4, -N.y + .3));
  col = aerial(col, P, 1.);
  gl_FragColor = vec4(col, 1.);
}`;
function makeTrees(geo, img, look, maxN) {
  let seed = 4412093;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const out = [];
  const cx = 900, cz = -250, R = 3000, step = 12;
  for (let a = -R; a <= R; a += step) for (let b = -R; b <= R; b += step) {
    const x = cx + a + (rnd() - .5) * step * .8, z = cz + b + (rnd() - .5) * step * .8, u = rnd(), sz = rnd(), rot = rnd();
    if (Math.hypot(x - cx, z - cz) > R) continue;
    const W = look(x, z, 0), G = look(x, z, 1), B = look(x, z, 2), A = look(x, z, 3);
    if (W > 30 || B > 20) continue;
    const verge = G > 55 && G < 140, park = A > 200 && G < 40;
    if (!(verge && u < .5) && !(park && u < .55)) continue;
    // keep the two hero sightlines clean: nothing near the Omniyat base
    if (Math.hypot(x - geo.omniyat[0], z - geo.omniyat[1]) < 60) continue;
    out.push([x, z, park ? 3.6 + sz * 1.4 : 3.2 + sz * 1.2, rot]);
  }
  // even thinning to the budget (deterministic)
  const keep = out.length > maxN ? out.filter((_, i) => (i * maxN) % out.length < maxN) : out;
  const pos = [], nrm = [], uv = [];
  // six fronds (uv.x 0): each a triangle from a narrow base at the crown out to a drooping tip
  for (let k = 0; k < 6; k++) {
    const t = k / 6 * Math.PI * 2 + (k % 2) * 0.2, c = Math.cos(t), s = Math.sin(t), w = 0.16, droop = k % 2 ? 0.55 : 0.35;
    const tri = [[-s * w, 0.05, c * w], [s * w, 0.05, -c * w], [c, -droop, s]];
    const n = [c * 0.9, 1, s * 0.9], l = Math.hypot(...n);
    for (const v of tri) { pos.push(...v); nrm.push(n[0] / l, n[1] / l, n[2] / l); uv.push(0, 0); }
  }
  // trunk: two crossed quads from y 0 to 1 (uv.x 1)
  for (const [dx, dz] of [[1, 0], [0, 1]]) {
    const P = [[-dx, 0, -dz], [dx, 0, dz], [dx, 1, dz], [-dx, 1, -dz]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...P[k]); nrm.push(dz, 0, -dx); uv.push(1, 0); }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const T = new Float32Array(keep.length * 4); keep.forEach((t, i) => T.set(t, i * 4));
  g.setAttribute('iT', new THREE.InstancedBufferAttribute(T, 4));
  g.instanceCount = keep.length;
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: TREE_VERT, fragmentShader: COMMON_FRAG + TREE_FRAG, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.userData.count = keep.length;
  // the sun shadow maps are drawn with orthographic cameras: the trees sample those maps, so they sit that pass out
  // (zero instances = no draw, no feedback loop); every perspective pass (main, water mirror) draws them all
  const nT = keep.length;
  m.onBeforeRender = (r, sc, cam) => { g.instanceCount = cam.isOrthographicCamera ? 0 : nT; };
  return m;
}

/* ---------- skyline texture: max elevation by azimuth seen from the district centre ---------- */
export function makeSkyline(geo, center) {
  const N = 1024, el = new Float32Array(N).fill(0.004);
  const add = (x, z, h, r) => {
    const dx = x - center[0], dz = z - center[2], dist = Math.hypot(dx, dz); if (dist < 60) return;
    const e = Math.atan2(h - center[1], dist), az = Math.atan2(dx, -dz), half = Math.atan2(r, dist);
    const i0 = Math.floor((az - half) / (Math.PI * 2) * N + N / 2), i1 = Math.ceil((az + half) / (Math.PI * 2) * N + N / 2);
    for (let i = i0; i <= i1; i++) { const k = ((i % N) + N) % N; if (e > el[k]) el[k] = e; }
  };
  for (const p of geo.plots) add(p[0], p[1], p[4] + p[8], Math.max(p[2], p[3]) * 0.5);
  add(geo.burj[0], geo.burj[1], 828, 30); add(geo.omniyat[0], geo.omniyat[1], 160, 24);
  const data = new Uint16Array(N);
  for (let i = 0; i < N; i++) data[i] = THREE.DataUtils.toHalfFloat(el[i]);
  const tex = new THREE.DataTexture(data, N, 1, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true;
  return tex;
}

/* ---------- the scan blade: a thin vertical curtain of light ---------- */
const SHEET_VERT = /* glsl */`
uniform vec2 uScanDir; uniform float uScanPos;
varying vec3 vWorld; varying vec2 vUv;
void main(){
  vec2 t = vec2(-uScanDir.y, uScanDir.x);
  vec2 xz = uScanDir * uScanPos + t * position.x;
  vec3 P = vec3(xz.x, position.y, xz.y);
  vWorld = P; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.);
}`;
const SHEET_FRAG = /* glsl */`
varying vec3 vWorld; varying vec2 vUv;
void main(){
  float h = vWorld.y;
  float fall = exp(-h / 260.) * .8 + exp(-h / 40.) * .6;
  float side = smoothstep(0., .18, vUv.x) * smoothstep(1., .82, vUv.x);
  vec3 V = normalize(vWorld - uCamPos);
  vec3 n = vec3(uScanDir.x, 0., uScanDir.y);
  float graze = 1. / max(abs(dot(V, n)), .08);
  float a = fall * side * min(graze, 6.) * .045 * uScanGlow;
  vec3 col = mix(vec3(1., .78, .5), vec3(1., .95, .88), exp(-h / 90.)) * a;
  gl_FragColor = vec4(col, 1.);
}`;
export function makeScanSheet() {
  const g = new THREE.PlaneGeometry(14000, 1400, 1, 1);
  g.translate(0, 700, 0);
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SHEET_VERT, fragmentShader: COMMON_FRAG.replace('', '') + SHEET_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = 5;
  return m;
}
export { makeDepthMaterial };
