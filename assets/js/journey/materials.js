/* AS BUILT · one material system. Every surface reads the same global uniforms (U) and the same sky().
   States: rise, wire (blueprint), fill (porcelain), scan (reality behind the blade), glass, night windows, wave. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { SKY_GLSL } from './sky.js';

const v3 = (x = 0, y = 0, z = 0) => ({ value: new THREE.Vector3(x, y, z) });
const c3 = (r = 0, g = 0, b = 0) => ({ value: new THREE.Color(r, g, b) });
const f = v => ({ value: v });

export const U = {
  uCamPos: v3(), uTime: f(0), uRes: { value: new THREE.Vector2(1, 1) },
  uSkyLUT: f(null), uHourModel: f(0), uHourReal: f(2),
  uSunDir: v3(0, 0.1, -1), uSunColor: c3(), uSunHalo: c3(), uSunSize: f(0.011),
  uSunLight: c3(), uSkyAmb: c3(), uGroundAmb: c3(),
  uKeyDir: v3(0, 1, 0), uKeyColor: c3(), uStudioSky: c3(), uStudioGround: c3(),
  uCirrus: f(0), uStars: f(0), uVenus: f(0),
  uScanDir: { value: new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2) }, uScanPos: f(-1e5), uScanGlow: f(0), uRealAll: f(0),
  uHazeDensity: f(0), uHazeFalloff: f(1 / 180), uHazeTint: c3(1, 1, 1),
  uWire: f(1), uFill: f(0), uRise: f(0), uNight: f(0), uWave: f(0), uBlueprint: f(1), u603: f(0), uO603: v3(),
  uShadowA: f(null), uShadowB: f(null), uShadowMatA: { value: new THREE.Matrix4() }, uShadowMatB: { value: new THREE.Matrix4() },
  uShadowTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) }, uShadowOnA: f(0), uShadowOnB: f(0),
  uSkyline: f(null), uSkyCenter: v3(700, 120, -200),
  uFootprint: { value: new THREE.Vector4(-1900, -1900, 3100, 1500) },
  uPlinthH: f(90), uDraw: f(1), uLensMode: f(0), uExposure: f(1),
  uPorcelain: c3(0.87, 0.83, 0.77),
  // night layer: touched map (cursor lamp / tap-to-light; texel = touch time + 1 s, 0 = untouched), glint
  uTouched: f(null), uTouchRect: { value: new THREE.Vector4(-3400, -4100, 8000, 0) }, uGlint: f(0), uGreen: f(0)
};
{ const t = new THREE.DataTexture(new Float32Array(4), 2, 2, THREE.RedFormat, THREE.FloatType); t.needsUpdate = true; U.uTouched.value = t; }

export const UNIFORM_DECL = /* glsl */`
uniform vec3 uCamPos; uniform float uTime; uniform vec2 uRes;
uniform sampler2D uSkyLUT; uniform float uHourModel, uHourReal;
uniform vec3 uSunDir, uSunColor, uSunHalo; uniform float uSunSize;
uniform vec3 uSunLight, uSkyAmb, uGroundAmb;
uniform vec3 uKeyDir, uKeyColor, uStudioSky, uStudioGround;
uniform float uCirrus, uStars, uVenus;
uniform vec2 uScanDir; uniform float uScanPos, uScanGlow, uRealAll;
uniform float uHazeDensity, uHazeFalloff; uniform vec3 uHazeTint;
uniform float uWire, uFill, uRise, uNight, uWave, uBlueprint, u603; uniform vec3 uO603;
uniform sampler2DShadow uShadowA, uShadowB; uniform mat4 uShadowMatA, uShadowMatB; uniform vec2 uShadowTexel; uniform float uShadowOnA, uShadowOnB;
uniform sampler2D uSkyline; uniform vec3 uSkyCenter;
uniform vec4 uFootprint; uniform float uPlinthH, uDraw, uLensMode, uExposure;
uniform vec3 uPorcelain;
uniform sampler2D uTouched; uniform vec4 uTouchRect; uniform float uGlint, uGreen;
`;

export const LIGHT_GLSL = /* glsl */`
const vec3 C_SAFFRON = vec3(1.0, 0.565, 0.155);
const vec3 C_APRICOT = vec3(1.0, 0.25, 0.046);
const vec3 C_VENUS = vec3(0.745, 0.195, 0.38);
const vec3 C_LINE = vec3(0.396, 0.578, 1.0);
const vec3 C_SAPPHIRE = vec3(0.0037, 0.0137, 0.085);
float scanS(vec2 xz){ return dot(xz, uScanDir); }
float sdFoot(vec2 xz){ vec2 c = (uFootprint.xy + uFootprint.zw) * .5, hs = (uFootprint.zw - uFootprint.xy) * .5; vec2 d = abs(xz - c) - hs; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
/* reality behind the blade; beyond the model's footprint (300 m feather) the city waits for the end of the sweep */
float realAt(vec2 xz){ float sc = clamp(uRealAll + smoothstep(0., 40., uScanPos - scanS(xz)), 0., 1.); return mix(sc, uRealAll, smoothstep(0., 300., sdFoot(xz))); }
vec3 scanBand(vec2 xz){
  if (uScanGlow <= 0.) return vec3(0.);
  float s = scanS(xz);
  float w = max(5., fwidth(s) * 1.4);
  float x = (s - uScanPos);
  float core = exp(-(x / w) * (x / w));
  float k = 1. + w / 8.;
  vec3 fr = C_SAFFRON * exp(-pow((x + 12. * k) / (9. * k), 2.)) * 1.3
          + C_APRICOT * exp(-pow((x + 30. * k) / (14. * k), 2.)) * 1.0
          + C_VENUS * exp(-pow((x + 58. * k) / (22. * k), 2.)) * 0.8;
  return (vec3(1., .96, .9) * core * 4. + fr * 1.8) * uScanGlow;
}
float pcf(sampler2DShadow sm, mat4 M, vec3 P, vec3 N, vec3 L){
  float ndl = dot(N, L);
  // normal offset scaled by the shadow texel and the light's slope: no acne bands on faces grazed by a low sun
  float tw = uShadowTexel.x * 2900.;
  vec3 Pb = P + N * tw * (.6 + 2.2 * (1. - abs(ndl))) + L * tw * .8;
  vec4 c = M * vec4(Pb, 1.);
  vec3 sc = c.xyz / c.w;
  if (sc.x <= 0.001 || sc.x >= .999 || sc.y <= 0.001 || sc.y >= .999 || sc.z >= 1.) return 1.;
  float z = sc.z - .0004;
  float s = 0.;
  s += texture(sm, vec3(sc.xy + vec2(-.5, -.5) * uShadowTexel, z));
  s += texture(sm, vec3(sc.xy + vec2(.5, -.5) * uShadowTexel, z));
  s += texture(sm, vec3(sc.xy + vec2(-.5, .5) * uShadowTexel, z));
  s += texture(sm, vec3(sc.xy + vec2(.5, .5) * uShadowTexel, z));
  return s * .25;
}
float shadowA(vec3 P, vec3 N){ return uShadowOnA > .5 ? pcf(uShadowA, uShadowMatA, P, N, uKeyDir) : 1.; }
float shadowB(vec3 P, vec3 N){ return uShadowOnB > .5 ? pcf(uShadowB, uShadowMatB, P, N, uSunDir) : 1.; }
/* skyline seen in reflections: max elevation by azimuth from the district centre */
float skylineElev(vec3 R){
  float az = atan(R.x, -R.z) / (2. * PI) + .5;
  return texture(uSkyline, vec2(az, .5)).r;
}
/* R: the (jittered) reflection used for the sky; R0: the unjittered one used for the skyline, so per-panel
   jitter wobbles the sky but never flips a panel across the city silhouette (no blocky checker) */
vec3 reflectEnvJ(vec3 R, vec3 R0, vec3 P, float rough, float soft){
  vec3 c = skyNoDisc(R);
  // the anti-sun half of the sky (behind the camera in the backlit shots, never seen directly there) is a little
  // darker than the sun side, but it is still open sky: shaded glass carries a violet-to-rose gradient, not a hole
  float muR = dot(normalize(R.xz + vec2(1e-5, 0.)), normalize(uSunDir.xz + vec2(1e-5, 0.)));
  c *= mix(1., .78, smoothstep(.1, -.9, muR) * smoothstep(-.12, .02, uSunDir.y) * (1. - uNight));
  float el = asin(clamp(R0.y, -1., 1.));
  // the skyline map is measured from the district centre: shrink it with distance and fade it out over open water
  float dc = length(P.xz - uSkyCenter.xz);
  float se = skylineElev(R0);
  if (soft > 0.) {
    // azimuth-blurred skyline: no hard steps sweeping across twisted or curved glass
    float az = atan(R0.x, -R0.z) / (2. * PI) + .5;
    for (int i = 1; i <= 3; i++) se += texture(uSkyline, vec2(az + float(i) * .005, .5)).r + texture(uSkyline, vec2(az - float(i) * .005, .5)).r;
    se /= 7.;
  }
  se *= min(1., 2200. / max(dc, 1.));
  se += .1 * (1. - smoothstep(0., 260., P.y)) * soft;
  float real = realAt(P.xz);
  float occ = (1. - smoothstep(se - mix(.02, .07, soft), se + mix(.012, .03, soft), el)) * real * smoothstep(6500., 3200., dc);
  occ *= mix(1., .72, soft);
  // the city in reflections: hazy, cool on the anti-sun side, lighter toward its tops; slow variation by azimuth
  vec2 rh = normalize(R0.xz + vec2(1e-5, 0.)), sh2 = normalize(uSunDir.xz + vec2(1e-5, 0.));
  float away = max(-dot(rh, sh2), 0.);
  float band = vnoise(vec2(atan(R0.x, -R0.z) * 22., 7.));
  float topF = smoothstep(se - .06, se, el);
  // looking away from the sun the reflected neighbours show their sunlit faces: a warm band low in the glass
  vec3 city = hazeColor(R0) * mix(.13, .3, topF) * (.7 + .6 * band) + vec3(.006, .008, .016) + uSunLight * C_SAFFRON * .03 * pow(away, 1.5) * (.25 + band) * (1. - uNight);
  // toward the sun the reflected neighbours are hazy, glowing silhouettes, not black cut-outs
  city *= mix(1., 2.2, pow(max(dot(rh, sh2), 0.), 2.) * (1. - uNight));
  if (uNight > 0.) {
    // reflected city lights: discrete only while the reflection is stable on screen, otherwise their average glow
    vec2 q = vec2(atan(R0.x, -R0.z) * 900., el * 1400.);
    vec2 fq = fwidth(q);
    float lights = mix(step(.82, hash12(floor(q))) * .6, .05, smoothstep(.25, .8, max(fq.x, fq.y)));
    city = mix(city, city * .35, uNight) + vec3(1., .66, .34) * lights * uNight * 1.1 * smoothstep(se, se - .02, el);
  }
  c = mix(c, city, occ);
  // below the horizon: the city floor seen through the dust. Bright haze just under the horizon, darkening toward
  // the street, so a tower's base mirrors the dim ground and its upper floors the luminous horizon and sky
  float dn = smoothstep(.0, .26, -el);
  vec3 floorC = hazeColor(R) * mix(.85, .17, dn) + vec3(.004, .005, .01) * uNight;
  c = mix(c, floorC, (1. - smoothstep(-.04, .0, el)) * (1. - occ) * real);
  return c;
}
vec3 reflectEnvK(vec3 R, vec3 P, float rough, float soft){ return reflectEnvJ(R, R, P, rough, soft); }
vec3 reflectEnv(vec3 R, vec3 P, float rough){ return reflectEnvK(R, P, rough, 0.); }
vec3 aerial(vec3 col, vec3 P, float amt){
  if (uHazeDensity <= 0. || amt <= 0.) return col;
  vec3 v = P - uCamPos; float dist = length(v); vec3 d = v / max(dist, 1e-3);
  float k = uHazeFalloff, h0 = abs(uCamPos.y), h1 = max(P.y, 0.), dh = h1 - h0; // abs: the water mirror pass sees the same air
  float dens = abs(dh) > 1. ? (exp(-k * h0) - exp(-k * h1)) / (k * dh) : exp(-k * h0);
  // near field stays crisp (the heroes and the first rows read dark and defined); haze builds with depth
  // graded depth: haze starts at 250 m and builds steadily, so every layer of the city sits at its own value
  float T = exp(-uHazeDensity * max(dist - 400., 0.) * smoothstep(400., 3600., dist) * dens * amt);
  // a short path in front of a building scatters a whiter, cooler light than the long horizon path behind it:
  // near and mid towers fade toward mauve-grey, only the far layers take the full horizon colour
  vec3 hc = hazeColor(d);
  float od = 1. - T;
  hc = mix(mix(vec3(luma(hc)) * vec3(.95, .92, 1.04), hc, .35 + .65 * od), hc, uNight);
  col = col * T + hc * od;
  // blue hour: a light, low-lying mist (22 m scale height) that lifts the ground with distance while walls and roofs
  // above it stay clear, so the mid city stands off the ground as darker blocks
  float bhK = smoothstep(.25, .45, uNight) * (1. - smoothstep(.72, .95, uNight));
  if (bhK > 0.) {
    const float km = 1. / 22.;
    float dhm = h1 - h0;
    float dm = abs(dhm) > 1. ? (exp(-km * h0) - exp(-km * h1)) / (km * dhm) : exp(-km * h0);
    float Tm = exp(-.0013 * max(dist - 250., 0.) * dm * bhK * amt);
    vec3 mc = hazeColor(vec3(d.x, 0., d.z)) * vec3(1., 1.12, 1.6);
    col = col * Tm + mc * (1. - Tm);
  }
  return col;
}
/* studio light (model): key + rose/lilac hemisphere */
vec3 studioLight(vec3 N, vec3 P, float wrapK){
  float ndl = dot(N, uKeyDir);
  float w = max((ndl + wrapK) / (1. + wrapK), 0.);
  float sh = shadowA(P, N);
  vec3 hemi = mix(uStudioGround, uStudioSky, N.y * .5 + .5);
  return uKeyColor * w * mix(.12, 1., sh) + hemi;
}
/* real light: sun + sky ambient */
vec3 realLight(vec3 N, vec3 P, out float sh){
  float ndl = max(dot(N, uSunDir), 0.);
  sh = shadowB(P, N);
  vec3 hemi = mix(uGroundAmb, uSkyAmb, N.y * .5 + .5);
  return uSunLight * ndl * sh + hemi;
}
`;

export const COMMON_FRAG = UNIFORM_DECL + SKY_GLSL + LIGHT_GLSL;

/* ---------- facade: glass, mullions, spandrels, night windows ---------- */
export const FACADE_GLSL = /* glsl */`
struct Facade { vec3 tint; float f0; float module; float floorH; float spandrel; float mull; vec3 spCol; float stone; float sheen; float jit; vec3 rt; };
/* five glass families (no bronze, no gold): blue-green, silver-grey, warm grey, near-black, pale stone frame */
Facade facadeOf(float id){
  Facade f; f.stone = 0.; f.sheen = 1.; f.jit = .016; f.rt = vec3(1.);
  if (id < .22) { f.tint = vec3(.027, .069, .091); f.f0 = .26; f.module = 1.5; f.floorH = 3.6; f.spandrel = .2; f.mull = .05; f.spCol = vec3(.05, .075, .085); f.rt = vec3(.52, .84, 1.); }            // blue-green #2E4A55
  else if (id < .42) { f.tint = vec3(.102, .117, .162); f.f0 = .3; f.module = 1.5; f.floorH = 3.8; f.spandrel = .22; f.mull = .05; f.spCol = vec3(.15, .16, .18); f.rt = vec3(.8, .88, 1.1); }       // silver-grey #5A6070
  else if (id < .6) { f.tint = vec3(.144, .111, .102); f.f0 = .16; f.module = 1.2; f.floorH = 3.6; f.spandrel = .26; f.mull = .06; f.spCol = vec3(.19, .165, .15); f.rt = vec3(.94, .9, .94); }       // warm grey #6A5E5A
  else if (id < .8) { f.tint = vec3(.013, .016, .03); f.f0 = .28; f.module = 1.8; f.floorH = 3.4; f.spandrel = .16; f.mull = .045; f.spCol = vec3(.026, .028, .036); f.rt = vec3(.76, .84, 1.08); }    // near-black #1E2230
  else if (id < 1.) { f.tint = vec3(.03, .034, .042); f.f0 = .045; f.module = 3.; f.floorH = 3.6; f.spandrel = .36; f.mull = .26; f.spCol = vec3(.42, .35, .27); f.stone = 1.; } // pale stone frame, punched glazing
  else { f.tint = vec3(.03, .032, .038); f.f0 = .04; f.module = 3.; f.floorH = 3.4; f.spandrel = .35; f.mull = .25; f.spCol = vec3(.4, .33, .25); f.stone = 1.; }               // low-rise (night only)
  return f;
}
float gSh = 1.; // the sun shadow term of the last shade*() call
vec2 gIX = vec2(0.);   // the instance's centre (xz): the touched map is read per building
float gFaceK = 0.;     // per-face offset (-.5...5) set by the caller: neighbouring faces of one tower differ
float touchedAt(vec2 xz){
  vec2 uv = (xz - uTouchRect.xy) / uTouchRect.z;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.;
  return texture(uTouched, uv).r;
}
/* a touched building (cursor lamp / tap) lights floor by floor from the street, about 16 floors a second */
float touchCascade(float floorIdx){
  float t0 = touchedAt(gIX);
  if (t0 <= 0.) return 0.;
  return clamp((uTime - (t0 - 1.)) * 16. - floorIdx * .85 + 1., 0., 1.);
}
/* tungsten warm-up: a pure function of the wave (or touch) front, with a 25% overshoot */
float warmUp(float x){ return x * (1. + .25 * sin(PI * x)); }
/* statistically consistent window LOD. Up close every window is drawn; as windows shrink below ~2 px they are
   replaced by 2^k x 2^k supercells that are either dark or lit a little brighter (probability p * .55, value 1 / .55),
   so the mean is kept but a far facade stays a sparkle of points on dark glass: never a flat amber-brown wash, no
   crawling moire (the supercells are anchored to the facade grid). */
float superV(vec2 cell, vec2 k, float p, float seed){
  vec2 S = exp2(k); vec2 sc = floor(cell / S);
  float u = hash13(vec3(sc + .37, seed + k.x * 3.31 + k.y * 7.17));
  float q = p * .55;
  return (1. - smoothstep(q - .015, q + .015, u)) / .55;
}
float winLOD(vec2 cell, vec2 fw, float p, float exact, float seed, vec2 kmax, float avgK){
  vec2 l = log2(max(fw * 1.7, vec2(1.)));
  vec2 k0 = min(floor(l), kmax), k1 = min(k0 + 1., kmax);
  float t = clamp(max(l.x - k0.x, l.y - k0.y), 0., 1.);
  if (k1.x + k1.y < .5) return exact;
  float v0 = k0.x + k0.y < .5 ? exact : superV(cell, k0, p, seed) * avgK;
  if (t <= 0.) return v0;
  float v1 = superV(cell, k1, p, seed) * avgK;
  return mix(v0, v1, t);
}
/* night windows. Homes: each floor splits into flats 2-5 modules wide, a flat of three or more into two rooms. A lit
   flat has most rooms on, at one of three levels (living room, a lamp in a far room, a hall light), each room lit by a
   lamp pool that runs continuously across its mullions and brighter at the ceiling than at the sill; curtains are
   open, a sheer drawn across (softer, warmer, even), or a blackout part-drawn from one side. A dark flat now and then
   keeps a dim hall light. Offices (about a quarter of the towers) light long runs of a floor under a luminaire rhythm.
   Nothing varies per pane, so up close a facade reads as rooms and floors, never a checkerboard. Returns emission;
   cover = lit fraction (for darkening the glass behind). gRev: window-reveal occlusion (recessed glass hides its light
   at grazing angles). */
float gRev = 1.;
vec2 gIM = vec2(0.);          // view ray slopes inside the facade (along-face, up) per metre of depth, set by the caller
vec2 gFM = vec2(1.5, 3.6);    // module width, floor height (m)
/* interior mapping: the ray through the glass runs into the room until it meets the ceiling, the floor or the back
   wall; returns the hit (x along the face in m, depth in m) and which surface (0 back wall, 1 ceiling, 2 floor) */
vec3 roomHit(float u, float hM, float D){
  float hF = gFM.y * .16, hC = gFM.y - .1;
  float tC = gIM.y > 1e-3 ? (hC - hM) / gIM.y : 1e3;
  float tF = gIM.y < -1e-3 ? (hF - hM) / gIM.y : 1e3;
  float t = max(min(min(tC, tF), D), 0.);
  return vec3(u + gIM.x * t, t, t >= D - 1e-3 ? 0. : (tC < tF ? 1. : 2.));
}
vec3 nightWin(vec2 cell, vec2 fr, vec2 fw, float pane, vec4 inst, float ym, float topY, float paneAvg, out float cover){
  float lit = inst.y;
  float lux = step(1.9, inst.w);   // inst.w >= 2: a luxury residential tower (wide flats, never offices)
  float office = step(.76, hash12(vec2(inst.x * 3.3, 8.1))) * (1. - lux);
  float hw = hash12(vec2(cell.y, inst.x * 31.7 + 2.3));
  float bw = office > .5 ? 10. + floor(hw * 9.) : lux > .5 ? 4. + floor(hw * 5.) : 2. + floor(hw * 4.);
  float ux = cell.x + floor(hw * 97.);
  vec2 bc = vec2(floor(ux / bw), cell.y);
  float px = ux - bc.x * bw + fr.x;
  float hb = hash13(vec3(bc, inst.x * 57.1 + 1.3));
  float hc = hash13(vec3(bc.yx + 3.7, inst.x * 23.9 + .7));
  float blockP = lit * mix(.5, .42, office);
  float bOn = step(hb, blockP);
  // rooms
  float split = bw > 2.5 ? 1. + floor(hash12(bc + inst.x * 2.9) * (bw - 1.)) : bw;
  float room = step(split, px);
  float rW = max(room > .5 ? bw - split : split, 1.);
  float rx = px - room * split;
  float hr = hash13(vec3(bc, room + inst.x * 9.7 + 4.4));
  float hr2 = hash13(vec3(bc.yx, room * 3.1 + inst.x * 17.3 + 2.2));
  float hr3 = hash13(vec3(bc + 7.7, room * 5.1 + inst.x * 3.3));
  float lvl = office > .5 ? bOn * step(.12, hr) * (.85 + .15 * hr2)
                          : (bOn > .5 ? (hr < .18 ? 0. : hr < .62 ? 1. : hr < .86 ? .42 : .15) : (hr < .07 ? .13 : 0.));
  float lamp, ceil, curt = 1.;
  // up close the window opens into a room (interior mapping): floors above the eye show their lit ceilings in
  // perspective, floors below show the floor and the desks, every floor a little different, and it all moves with
  // the camera. Resolves to a plain ceiling gradient once a floor is under ~12 px.
  float imK = 1. - smoothstep(.06, .12, fw.y);
  vec3 rh = roomHit((cell.x + fr.x) * gFM.x, fr.y * gFM.y, office > .5 ? 11. : 6.5);
  if (office > .5) {
    // open-plan office: troffers on a 1.5 x 2.4 m ceiling grid, the desk zone dimmer, the core wall at the back
    lamp = .9 + .1 * cos(rx * 3.14159);
    float strip = smoothstep(.8, .86, fr.y) * (1. - smoothstep(.93, .97, fr.y)) * (.5 + .5 * cos(fract(rx) * 6.2832));
    float ceilF = .3 + .25 * smoothstep(.3, .8, fr.y) + 1.1 * strip;
    float trof = (1. - smoothstep(.16, .24, abs(fract(rh.x / 1.5) - .5))) * (1. - smoothstep(.1, .16, abs(fract(rh.y / 2.4 + .3) - .5)));
    float desk = .1 + .16 * hash12(floor(vec2(rh.x / 1.6, rh.y / 1.4)) + cell.y * 7.1 + inst.x);
    float iv = rh.z > 1.5 ? desk : rh.z > .5 ? .32 + 1.5 * trof : .38;
    iv *= 1. - .35 * smoothstep(3., 11., rh.y);
    ceil = mix(ceilF, iv * 1.15, imK);
    lvl *= hr < .3 ? .35 : 1.;   // a third of the lit runs are on their night setting
  } else {
    float lampX = (.2 + .6 * hr2) * rW;
    float dl = (rx - lampX) / max(rW * .42, .55);
    lamp = .45 + .55 * exp(-dl * dl);
    ceil = .62 + .55 * smoothstep(.2, .95, fr.y);
    // homes: the lamp stands about three metres in; ceiling and back wall take its pool, the floor less of it
    float lxm = (rh.x - (cell.x + fr.x) * gFM.x) / gFM.x + rx - lampX;
    float poolI = exp(-(lxm * lxm * gFM.x * gFM.x + (rh.y - 3.) * (rh.y - 3.)) / 9.);
    float iv = rh.z > 1.5 ? .22 + .4 * poolI : rh.z > .5 ? .55 + .7 * poolI : .45 + .75 * poolI;
    ceil = mix(ceil, iv * 1.25, imK);
    lamp = mix(lamp, .75 + .25 * lamp, imK);
    if (hr3 > .55 && hr3 < .85) { lamp = mix(lamp, .78, .75); ceil = mix(ceil, .9, .6); curt = .66 * (.93 + .07 * sin(rx * 21.)); }
    else if (hr3 >= .85) {
      float cf = .3 + .45 * fract(hr3 * 13.7);
      float cxr = rx / rW; cxr = fract(hr3 * 7.1) > .5 ? cxr : 1. - cxr;
      curt = mix(.05, 1., smoothstep(cf - .03, cf + .03, cxr));
    }
  }
  float mech = mix(step(.5, mod(cell.y + 1., 20.)), .95, smoothstep(.3, .6, fw.y));
  float inside = step(.8, ym) * step(ym, topY - 2.5);
  // the wave front breaks up by flat and room: it spreads through the city unevenly, not as a perfect ring
  float thr = inst.z + 150. * hc + 50. * hash12(vec2(bc.x * 2. + room, cell.y) * .37 + inst.x);
  float x = clamp((uWave - thr) / 90., 0., 1.);
  x = max(x, touchCascade(cell.y));
  // colour by room: 2700K Window Amber, 3500K pearl, now and then the blue of a screen; offices 4000K
  vec3 wc = office > .5 ? (hc < .7 ? vec3(.74, .7, .64) : vec3(1., .6, .3))
                        : (hr2 < .62 ? vec3(1., .36, .08) : hr2 < .965 ? vec3(1., .56, .26) : vec3(.5, .64, 1.) * .4);
  if (office < .5 && hr3 > .55 && hr3 < .85) wc = mix(wc, vec3(1., .5, .2), .4);   // light through a sheer is warmer
  float exact = pane * lvl * lamp * ceil * curt * 1.45;
  float pMean = blockP * mix(.78, .9, office) + (1. - blockP) * .035;
  float v = winLOD(cell, fw, pMean, exact, inst.x * 13.1, vec2(3., 2.), paneAvg * .55);
  v *= mech * inside * gRev;
  float tone = .7 + .5 * hash12(vec2(inst.x * 9.7, 1.9));   // some towers burn brighter than others
  float floorT = .88 + .22 * hash12(vec2(cell.y * 1.7, inst.x * 5.3 + 4.1));
  cover = v * warmUp(x);
  // peak below the bloom threshold: thousands of windows must stay crisp points, not a glowing wash
  return wc * cover * tone * floorT * mix(.55, .4, office) * (.9 + .2 * hr2);
}
/* lit colour of a real glass facade fragment; um/ym metres along face, N normal, inst = (seed, lit, dist603, facadeId) */
vec3 shadeFacadeF(Facade fc, vec3 P, vec3 N, float um, float ym, vec4 inst, float topY, out vec3 emis){
  emis = vec3(0.);
  vec3 V0 = uCamPos - P; float dist = length(V0); vec3 V = V0 / max(dist, 1e-3);
  vec2 g = vec2(um / fc.module, ym / fc.floorH);
  vec2 cell = floor(g); vec2 fr = fract(g);
  vec2 fw = fwidth(g);
  // sub-pixel guards per axis: once a module or a floor is under ~3 px it resolves to its average (no crawl)
  vec2 g0 = vec2(.15, .32);
  // near floors (within ~600 m) resolve to their average a little earlier: no shimmer on the spandrel lines without MSAA
  float g0y = mix(.22, .15, smoothstep(450., 700., dist));
  float subX = smoothstep(g0.x, g0.y, fw.x), subY = smoothstep(g0y, g0y + .17, fw.y);
  float sub = max(subX, subY);
  float mullX = 1. - smoothstep(fc.mull - fw.x, fc.mull + fw.x, min(fr.x, 1. - fr.x) * 2.);
  float spand = 1. - smoothstep(fc.spandrel - fw.y, fc.spandrel + fw.y, fr.y);
  mullX = mix(mullX, fc.mull, subX); spand = mix(spand, fc.spandrel, subY);
  // far facades: the floor rhythm softens to half contrast beyond a kilometre
  spand *= mix(1., .5, smoothstep(800., 1500., dist));
  float frameAmt = (1. - (1. - mullX) * (1. - spand)) * (fc.stone > .5 ? 1. : .8);
  if (fc.stone > .5) frameAmt = mix(max(frameAmt, smoothstep(.7 - fw.x, .7 + fw.x, fr.x)), max(frameAmt, .3), subX);
  // mechanical floors: a darker band 1.5 floors tall every 10-14 floors (per tower). At 1.5 km they sit 30-45 px
  // apart, so the floor rhythm survives where single floors have resolved to their average
  float mPer = 10. + floor(hash12(vec2(inst.x * 7.7, 3.1)) * 5.);
  float my = ym / (fc.floorH * mPer) + hash12(vec2(inst.x * 3.3, 9.7));
  float fwm = max(fwidth(my), 1e-5), bw = 1.5 / mPer;
  float mdd = abs(fract(my - bw * .5 + .5) - .5);
  float mBand = (1. - smoothstep(bw * .5 - fwm, bw * .5 + fwm, mdd)) * step(14., ym) * step(ym, topY - 10.);
  mBand = mix(mBand, bw, smoothstep(.45, .8, fwm * mPer));
  frameAmt = max(frameAmt, mBand * (fc.stone > .5 ? .5 : .85));
  // per-panel normal jitter (oil-canning) perturbs only the sky lookup; roughness variance
  vec2 j = hash22(cell + inst.x * 173.1) - .5;
  // after sunset the low sky is a steep gradient (the afterglow band): vertical tilt jitter would turn it into a
  // pane-by-pane checker of blues, so it settles to a third of its day value
  j.y *= mix(1., .35, uNight);
  vec3 T = normalize(vec3(-N.z, 0., N.x) + 1e-5);
  vec3 Nj = normalize(N + (T * j.x + vec3(0., 1., 0.) * j.y) * fc.jit * (1. - sub));
  float rough = .04 + .08 * hash12(cell * 1.7 + inst.x);
  float NdV0 = max(dot(N, V), 1e-3);
  float F = fc.f0 + (1. - fc.f0) * pow(1. - NdV0, 5.);
  vec3 R0 = reflect(-V, N), R = reflect(-V, Nj);
  float sunFace = max(dot(normalize(N.xz + 1e-5), normalize(uSunDir.xz + 1e-5)), 0.);
  float warmF = smoothstep(.0, .3, sunFace);
  // reflections strengthen up the shaft: the base mirrors the dim street and the haze, the upper floors the
  // luminous horizon and the violet sky above it (a tall face carries a real sky gradient, tops brighter)
  float hgt = smoothstep(-20., topY * .9 + 40., ym);
  // neighbouring faces of one tower mirror slightly different skies: faceted glass, never one flat value
  float lean = mix(.0, .5, pow(hgt, 1.2)) * (1. - .6 * warmF) + gFaceK * .16;
  vec3 Rl = normalize(vec3(R.x, R.y * .85 + lean, R.z)), R0l = normalize(vec3(R0.x, R0.y * .85 + lean, R0.z));
  vec3 env = reflectEnvJ(Rl, R0l, P, rough, 1.) * (1. + gFaceK * .25);
  // by night dark glass mirrors a deep but greyed sapphire, never an electric blue
  env = mix(env, vec3(luma(env)) * vec3(.88, .92, 1.08), .35 * uNight);
  float ndl = max(dot(N, uSunDir), 0.);
  float sh = shadowB(P, N); gSh = sh;
  vec3 hemi = mix(uGroundAmb, uSkyAmb, N.y * .5 + .5);
  vec3 Lsun = uSunLight * ndl * sh;
  vec3 H = normalize(uSunDir + V);
  float a = rough * rough; float nh = max(dot(Nj, H), 0.);
  float D = a * a / (PI * pow(nh * nh * (a * a - 1.) + 1., 2.));
  vec3 spec = uSunLight * min(D, 400.) * F * .2 * sh * max(dot(Nj, uSunDir), 0.) / max(NdV0, .25);
  // glass = mirror (F) + the body seen through it (family tint, lit by sun and sky) + a faint dusty sheen
  vec3 hemiW = mix(uGroundAmb, uSkyAmb, .5 + .3 * (1. - abs(N.y)) + .5 * N.y);
  vec3 body = fc.tint * (Lsun * .6 + hemiW * 1.5) * (1. - F);
  vec3 glass = env * fc.rt * F * mix(.78, 1., hgt) + body + spec;
  glass += uSunLight * ndl * sh * .1 * fc.sheen * vec3(.95, .9, .86) * (1. - uNight);
  // the sun's path in the glass: faces whose reflection swings past the low sun's azimuth flare in narrow
  // apricot-white streaks (HDR, so the bloom catches them); never brighter than the scan core
  float gAz = pow(max(dot(normalize(R0l.xz + 1e-5), normalize(uSunDir.xz + 1e-5)), 0.), 80.);
  float glintS = gAz * smoothstep(-.06, .1, R0l.y) * smoothstep(.15, .6, 1. - NdV0) * smoothstep(-.03, .06, uSunDir.y) * (1. - uNight);
  glass += uSunLight * C_SAFFRON * glintS * 2.5 * mix(.35, 1., sh) * (.6 + .8 * j.x * (1. - sub) + .4 * sub);
  vec3 frameC = fc.spCol * (Lsun * .45 + hemi * 1.4) + env * .06;
  vec3 col = mix(glass, frameC, frameAmt);
  // rim light (SPEC 4.5): sun-facing faces seen edge-on flare Saffron at golden hour
  float rim = pow(1. - NdV0, 3.) * sunFace * sh;
  col += uSunLight * rim * .3 * (1. - uNight) * smoothstep(-.05, .1, uSunDir.y);
  // night windows: the wave of light from 603 (tenant blocks, then windows)
  if (uNight > 0.) {
    // dark glass at night still carries the city's sapphire sky glow, so towers read against the black ground
    col += vec3(.0022, .004, .013) * uNight * (1. - frameAmt * .6) * (.6 + .4 * hgt);
    float paneAvg = (1. - fc.spandrel) * (1. - fc.mull) * mix(1., .75, fc.stone);
    float pane = 1. - frameAmt;
    float cover;
    gRev = mix(.22, 1., smoothstep(.06, .45, NdV0));
    { vec3 rd = -V; float dz = max(dot(rd, -N), .08); gIM = vec2(dot(rd, T), rd.y) / dz; gFM = vec2(fc.module, fc.floorH); }
    vec3 wl = nightWin(cell, fr, fw, pane, inst, ym, topY, paneAvg, cover);
    emis = wl * uNight;
    col = col * (1. - .55 * min(cover, 1.) * uNight);
  }
  return col;
}
vec3 shadeFacade(vec3 P, vec3 N, float um, float ym, vec4 inst, float topY, out vec3 emis){
  return shadeFacadeF(facadeOf(inst.w), P, N, um, ym, inst, topY, emis);
}
/* ---------- low-rise and podiums: Dubai render and stone, windows only as a faint band ---------- */
vec3 lowRiseAlb(float seed, float pale){
  float h = fract(seed * 7.31 + .17);
  vec3 a = h < .4 ? vec3(.485, .376, .27) : h < .72 ? vec3(.624, .54, .43) : vec3(.33, .27, .216);   // #B9A58E, #CFC2B0, #9C8E80
  a = mix(a, vec3(.6, .53, .44), pale);
  a = mix(a, vec3(dot(a, vec3(.2126, .7152, .0722))), .35);
  return a * (.88 + .24 * fract(seed * 13.7));
}
/* sun + sky + the bounce from sunlit ground and walls: shaded render stays a warm grey near a quarter of the lit side */
vec3 lowLight(vec3 N, vec3 P, out float sh){
  float ndl = max(dot(N, uSunDir), 0.);
  sh = shadowB(P, N);
  vec3 hemi = mix(uGroundAmb, uSkyAmb, .62 + .38 * N.y);
  return uSunLight * ndl * sh + hemi * .72 + uSunLight * .006 * (1. - uNight) * (1. - N.y * .5);
}
vec3 shadeLowRise(vec3 P, vec3 N, float um, float ym, vec4 inst, float topY, float pale, out vec3 emis){
  emis = vec3(0.);
  vec3 alb = lowRiseAlb(inst.x, pale);
  float sh; vec3 L = lowLight(N, P, sh); gSh = sh;
  vec3 col = alb * L;
  // windows: one faint band per floor (about 9%), gone once floors are under ~4 px
  float fy = ym / 3.4, fwy = max(fwidth(fy), 1e-4), fry = fract(fy);
  float band = smoothstep(.3 - fwy, .3 + fwy, fry) * (1. - smoothstep(.78 - fwy, .78 + fwy, fry));
  band *= (1. - smoothstep(.18, .3, fwy)) * step(1.2, ym) * step(ym, topY - 1.4);
  // pilasters every 6-8 m break the long walls into bays
  float bayW = 6. + 2. * fract(inst.x * 5.3);
  float bu = um / bayW, fwb = max(fwidth(bu), 1e-4);
  float pil = smoothstep(.9 - 2. * fwb, .9 + 2. * fwb, abs(fract(bu) - .5) * 2.) * (1. - smoothstep(.2, .4, fwb));
  col *= 1. - .2 * band * (1. - pil);
  col *= 1. + .06 * pil * (1. - smoothstep(.2, .4, fwb));
  if (uNight > 0.) {
    // homes: punched windows, mostly 2700K, a few cool kitchens; whole flats on or off
    vec2 q = vec2(um / 3., fy), cell = floor(q), fr = fract(q);
    float flt = hash13(vec3(floor(cell.x / 3.), cell.y, inst.x * 57.1));
    float on = step(hash13(vec3(cell, inst.x * 131.7)), mix(.03, .7, step(flt, inst.y * .7))) * step(1.2, ym) * step(ym, topY - 1.4);
    float h2 = hash13(vec3(cell.yx, inst.x * 71.3 + 3.1));
    float x = clamp((uWave - inst.z - 160. * h2) / 90., 0., 1.);
    x = max(x, touchCascade(cell.y));
    vec3 wc = flt < .72 ? vec3(1., .36, .08) : flt < .93 ? vec3(1., .58, .28) : vec3(.6, .72, 1.) * .6;
    float pane = smoothstep(.15, .25, fr.x) * (1. - smoothstep(.75, .85, fr.x)) * smoothstep(.3, .4, fr.y) * (1. - smoothstep(.75, .85, fr.y));
    float sub = smoothstep(.15, .35, max(fwidth(q.x), fwy));
    float pL = mix(.03, .7, step(flt, inst.y * .7));
    float lw = winLOD(cell, vec2(fwidth(q.x), fwy), pL, pane * on, inst.x * 7.7, vec2(2., 1.), .27 * .42) * step(1.2, ym) * step(ym, topY - 1.4) * warmUp(x);
    float rev = mix(.18, 1., smoothstep(.06, .45, abs(dot(N, normalize(uCamPos - P)))));
    emis = wc * lw * uNight * .8 * rev;
    col *= 1. - .6 * min(lw, 1.) * uNight;
  }
  return col;
}
`;

/* tower vertex: instanced archetypes, rise, taper, twist, podium, crown */
const TOWER_VERT = /* glsl */`
attribute vec4 aFace; attribute vec3 aTan;
attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iD; attribute vec2 iE; attribute vec2 iF;
uniform float uRise, uScanPos, uRealAll; uniform vec2 uScanDir; uniform vec4 uFootprint;
varying vec3 vWorld; varying vec3 vNormal; varying vec4 vFace; flat varying vec4 vInst; varying vec3 vMisc; flat varying vec2 vIX; flat varying float vFaceK; flat varying float vCt;
float hv(float x){ return fract(sin(x) * 43758.5453); }
void main(){
  float W = iB.x, Dd = iB.y, H = iB.z, CH = iB.w;
  float twist = iD.x, taper = iD.y, podH = iD.z, podS = iD.w;
  float part = aFace.z;
  float rise = clamp((uRise - iC.x) / .4, 0., 1.);
  float s = dot(iA.xy, uScanDir);
  if (iE.x > .5) {
    vec2 fc = (uFootprint.xy + uFootprint.zw) * .5, fh = (uFootprint.zw - uFootprint.xy) * .5, fd = abs(iA.xy - fc) - fh;
    float ext = smoothstep(0., 300., length(max(fd, 0.)) + min(max(fd.x, fd.y), 0.));
    rise = clamp(mix(uRealAll + smoothstep(0., 320., uScanPos - s), uRealAll, ext), 0., 1.);
  }
  rise = rise * rise * (3. - 2. * rise);
  // not yet risen: no flattened roofs left lying on the studio floor (they read as dark dashes)
  if (rise < .002) { gl_Position = vec4(0., 0., 2., 1.); vWorld = vec3(0.); vNormal = vec3(0., 1., 0.); vFace = vec4(0.); vInst = vec4(0.); vMisc = vec3(0.); return; }
  // crown types: 0 box, 1 slanted cut top, 2 slim crown + mast, 3 fin-frame screen (+ a low box behind it), 4 flat
  float ct = iE.y > .5 ? 0. : floor(iF.x + .5);
  float yb = podH, yt = H; vec2 sc = vec2(W, Dd);
  if (part > .5 && part < 1.5) { yb = H; yt = H + CH * (ct > 2.5 && ct < 3.5 ? .55 : 1.); if (ct > 1.5 && ct < 3.5) sc *= .84; }
  else if (part > 1.5 && part < 2.5) { yb = 0.; yt = podH; sc *= podS; }
  else if (part > 2.5 && part < 3.5) { yb = H + CH - 1.; yt = H + CH + iF.y; sc = vec2(2.6) * mix(1., .3, position.y); }
  else if (part > 3.5) { yb = H; yt = H + CH; }
  if ((part > 1.5 && part < 2.5 && podH < .5) || (part > .5 && part < 1.5 && (CH < .5 || (ct > .5 && ct < 1.5)))) sc = vec2(0.);
  if (part > 2.5 && part < 3.5 && (ct < 1.5 || ct > 2.5 || iF.y < .5)) sc = vec2(0.);
  if (part > 3.5 && (ct < 2.5 || ct > 3.5 || CH < .5)) sc = vec2(0.);
  vec2 boxOff = vec2(0.);
  // low-rise roofs: 0-3 plant boxes per block, each sized by its own hash
  if (iE.y > .5 && part > .5 && part < 1.5) {
    float bi = position.x > 0. ? (position.z > 0. ? 0. : 2.) : 1.;
    float nBox = floor(hv(iA.w * 91.7 + 17.3) * 4.);
    if (bi >= nBox) sc = vec2(0.);
    sc *= .42 + .36 * hv(iA.w * 57.3 + bi * 11.1);
    // a third of the blocks carry a set-back penthouse storey instead of a plant box: the roofline steps
    if (bi < .5 && hv(iA.w * 23.9 + 4.4) > .66) { sc *= 3.3; yt = H + CH * 1.7; }
  }
  float yu = mix(yb, yt, position.y);
  // slanted cut: the shaft's roof rises across the footprint (its cap becomes a sloped glass plane)
  bool slant = ct > .5 && ct < 1.5 && part < .5;
  if (slant && position.y > .5) yu += CH * (position.x + .5);
  float yM = yu * rise;
  float hf = clamp(yu / max(H, 1.), 0., 1.2);
  bool shaftLike = part < 1.5 || part > 3.5;
  float tp = shaftLike ? 1. - taper * hf : 1.;
  vec2 lxz = position.xz * sc * tp;
  float ang = iA.z + (shaftLike ? twist * hf : 0.);
  float c = cos(ang), sn = sin(ang);
  vec2 wxz = vec2(c * lxz.x + sn * lxz.y, -sn * lxz.x + c * lxz.y) + iA.xy;
  vec3 P = vec3(wxz.x, yM, wxz.y);
  vec3 n = normal;
  if (slant && normal.y > .5) n = normalize(vec3(-CH / max(W * tp, 1.), 1., 0.));
  vec3 nr = vec3(c * n.x + sn * n.z, n.y, -sn * n.x + c * n.z);
  float fw = aTan.y > .5 ? PI_HALF * (sc.x + sc.y) * tp : length(aTan.xz * sc) * tp;
  vWorld = P; vNormal = nr;
  vFace = vec4(aFace.x * fw, yM, aFace.x, aFace.y);
  vInst = vec4(iA.w, iC.y, iC.z, iC.w);
  vIX = iA.xy;
  // per-face reflection offset: flat faces carry their own (constant) edge vector
  vFaceK = aFace.w > .5 ? hv(dot(aTan, vec3(1.7, 0., 3.1)) * 3.7 + iA.w * 13.1 + part * 5.3) - .5 : 0.;
  vCt = ct;
  vMisc = vec3(part, aFace.w, (H + CH) * rise);
  if (iE.y > .5) vMisc.z = H * rise;
  // abutting blocks can share a wall plane: a per-instance nudge toward the camera (same pixel, depth only) stops
  // their two window patterns z-fighting into crosses
  vec4 vp = viewMatrix * vec4(P, 1.);
  vp.xyz *= 1. - 2.5e-5 * fract(iA.w * 91.7 + iA.x * .0137);
  gl_Position = projectionMatrix * vp;
}
`;

const TOWER_FRAG = /* glsl */`
varying vec3 vWorld; varying vec3 vNormal; varying vec4 vFace; flat varying vec4 vInst; varying vec3 vMisc; flat varying vec2 vIX; flat varying float vFaceK;
void main(){
  gIX = vIX; gFaceK = vFaceK;
  vec3 P = vWorld;
  vec3 N = normalize(vNormal);
  float real = realAt(P.xz);
  // edges from face coordinates (screen-space, ~1px)
  vec2 e = vFace.zw;
  vec2 fe = fwidth(e);
  float dU = vMisc.y > .5 ? min(e.x, 1. - e.x) / max(fe.x, 1e-5) : 1e3;
  float dV = min(e.y, 1. - e.y) / max(fe.y, 1e-5);
  float edge = 1. - smoothstep(.4, 1.4, min(dU, dV));
  vec3 col;
  vec3 emis = vec3(0.);
  bool mast = vMisc.x > 2.5 && vMisc.x < 3.5, screen = vMisc.x > 3.5;
  // fin-frame crown screen: vertical fins (0.6 m every 2.2 m) with the sky between them; once the fins are
  // sub-pixel the screen is drawn whole at its average (no crawl)
  float finCov = 1.;
  if (screen) {
    float fu = vFace.x / 2.2, ffw = fwidth(fu);
    float fin = 1. - smoothstep(.14 - ffw, .14 + ffw, abs(fract(fu) - .5));
    fin = max(fin, 1. - smoothstep(.04, .07, min(vFace.w, 1. - vFace.w)) );
    float subF = smoothstep(.3, .55, ffw);
    if (subF < .5 && fin < .5) discard;
    finCov = mix(1., .3, subF);
  }
  // model: porcelain on a studio set
  vec3 modelC = vec3(0.);
  if (real < 1.) {
    float ao = 1. - .35 * exp(-P.y / 6.);
    float ao2 = mix(.82, 1., smoothstep(0., 60., P.y));
    vec3 Lm = studioLight(N, P, .3);
    modelC = uPorcelain * Lm * ao * ao2;
    modelC *= 1. - edge * .08;
    // blueprint wireframe state
    vec3 wireC = C_SAPPHIRE * 1.6 + C_LINE * edge * .9 + C_LINE * .04;
    modelC = mix(wireC, modelC, uFill);
  }
  vec3 realC = vec3(0.);
  bool lowR = vInst.w >= 1.;
  bool crown = vMisc.x > .5 && vMisc.x < 1.5, podium = vMisc.x > 1.5 && vMisc.x < 2.5;
  if (real > 0.) {
    float sh;
    if (lowR || podium) {
      // render and stone: low-rise blocks and the pale podiums of the towers
      float pale = podium ? 1. : 0.;
      if (N.y > .5) {
        // roofs: a lighter parapet coping with its inner shadow; gravel and slab between
        vec3 ra = lowRiseAlb(vInst.x, pale) * .78;
        if (!crown) {
          float v = vFace.w, fv = fwidth(v);
          float lipR = 1. - smoothstep(.022 - fv, .022 + fv, v);
          float inner = (1. - smoothstep(.03, .07, v)) * (1. - lipR);
          ra = mix(ra * (1. - .3 * inner), lowRiseAlb(vInst.x, pale) * 1.08, lipR);
        }
        // plant rooms and penthouses: the roof's own render within a few percent (no dark studs on every roof)
        if (crown) ra = lowRiseAlb(vInst.x, pale) * mix(.9, 1.04, hash12(vec2(vInst.x * 37.1, 5.)));
        realC = ra * lowLight(N, P, sh); gSh = sh;
      } else if (crown) {
        realC = lowRiseAlb(vInst.x, pale) * mix(.86, 1., hash12(vec2(vInst.x * 37.1, 5.))) * lowLight(N, P, sh); gSh = sh;
      } else if (!podium && hash12(vec2(vInst.x * 53.1, 2.7)) < .24) {
        // a quarter of the mid-rise is glass office: the same families as the towers, so the carpet is not all render
        realC = shadeFacadeF(facadeOf(fract(vInst.x * 3.71) * .8), P, N, vFace.x, vFace.y, vInst, vMisc.z, emis);
      } else {
        realC = shadeLowRise(P, N, vFace.x, vFace.y, vInst, podium ? vMisc.z * 0. + 1e4 : vMisc.z, pale, emis);
        // coping along the parapet and a shadow line under it
        float dTop = vMisc.z - vFace.y;
        float fvy = fwidth(vFace.y);
        float lip = (1. - smoothstep(.9, 1.15, dTop)) * (1. - smoothstep(.3, .9, fvy)) * (podium ? 0. : 1.);
        float under = (1. - smoothstep(1.15, 1.6, dTop)) * (1. - lip) * (podium ? 0. : 1.);
        realC = mix(realC * (1. - .3 * under), lowRiseAlb(vInst.x, pale) * 1.1 * lowLight(N, P, sh), lip);
      }
    } else {
      bool slope = N.y > .5 && N.y < .985;
      realC = shadeFacade(P, N, slope ? P.x + P.z : vFace.x, vFace.y, vInst, vMisc.z, emis);
      if (crown) realC *= .82; // crowns read slightly darker
      if (N.y > .5 && !slope) { realC = vec3(.11, .11, .115) * lowLight(N, P, sh); emis = vec3(0.); }
      if (mast) {
        // a steel mast: dark against the sky, its sun side catching a thread of light
        vec3 Vm = normalize(uCamPos - P);
        realC = vec3(.2, .205, .22) * lowLight(N, P, sh) + skyNoDisc(normalize(reflect(-Vm, N) + vec3(0., .3, 0.))) * .12;
        emis = vec3(0.);
      }
      if (screen) {
        // pale aluminium fins, lit by the low sun on their faces; between them (sub-pixel) the sky behind
        vec3 Vs = normalize(uCamPos - P);
        vec3 finC = vec3(.46, .45, .44) * lowLight(N, P, sh) + skyNoDisc(normalize(reflect(-Vs, N) + vec3(0., .2, 0.))) * .1;
        realC = mix(skyNoDisc(-Vs) * .9, finC, finCov);
        emis = vec3(0.);
      }
    }
  }
  // Saffron rim: the vertical corner on the sun side of every tower face catches the low sun (1-2 px)
  if (real > 0. && vMisc.y > .5 && abs(N.y) < .5 && uNight < 1.) {
    vec3 Tf = vec3(-N.z, 0., N.x);
    float ts = dot(normalize(Tf.xz + 1e-5), normalize(uSunDir.xz + 1e-5));
    float uS = ts > 0. ? 1. - e.x : e.x;
    float dpx = uS / max(fe.x, 1e-5);
    float line = (1. - smoothstep(.9, 2.6, dpx)) * smoothstep(.1, .5, abs(ts));
    float facing = max(dot(normalize(N.xz + 1e-5), normalize(uSunDir.xz + 1e-5)) + .35, 0.);
    float hz = smoothstep(.1, .9, vFace.y / max(vMisc.z, 1.));
    realC += uSunLight * C_SAFFRON * line * facing * gSh * (.35 + .65 * hz) * .55 * (lowR ? .35 : 1.) * (1. - uNight) * smoothstep(-.03, .08, uSunDir.y);
  }
  // golden hour: glass turned from the sun (or in cast shadow) cools a little toward violet, keeping its family hue
  if (real > 0. && abs(N.y) < .5 && uNight < 1. && !lowR && !podium) {
    float sf = smoothstep(.0, .3, dot(normalize(N.xz + 1e-5), normalize(uSunDir.xz + 1e-5)));
    float coolF = max(1. - sf, 1. - gSh) * (1. - uNight) * smoothstep(-.1, .05, uSunDir.y);
    realC = mix(realC, realC * vec3(.9, .9, 1.22), coolF * .6);
  }
  // night jewellery on the generic towers: crown washes and a thin light line round some roofs (the plan, drawn in light)
  if (uNight > 0. && real > 0. && !lowR && !podium) {
    float hk = hash12(vec2(vInst.x * 41.3, 8.1)), hk2 = hash12(vec2(vInst.x * 13.7, 2.9));
    float xw = clamp((uWave - vInst.z - 260.) / 160., 0., 1.);
    vec3 lc = hk2 < .06 ? vec3(.8, .86, 1.) : vec3(1., .58, .27);
    if ((crown || screen) && abs(N.y) < .5 && (hk < .28 || screen)) {
      // uplights at the foot of the crown, washing up its walls
      float dTop = vMisc.z - vFace.y;
      float wash = .12 + .88 * smoothstep(7., 0., abs(dTop - 2.5 - 9. * hk));
      emis += lc * wash * .2 * xw;
      realC *= 1. - .4 * xw;
    }
    if (N.y > .5 && hk2 < .12) {
      float v = vFace.w, fv = max(fwidth(v), 1e-4);
      float line = 1. - smoothstep(fv * .6, fv * 1.6, v);
      emis += vec3(1., .58, .27) * line * .14 * xw;
    }
  }
  // dusk: ground-floor lobbies and shopfronts light before the windows, a warm line along the street that lifts the
  // blocks off the ground (about half the buildings, glazed bays between darker piers; one line once sub-pixel)
  if (uNight > 0. && real > 0. && abs(N.y) < .5 && !crown && !mast && !screen && vFace.y < 4.2) {
    float hb = hash12(vec2(vInst.x * 29.3, 4.7));
    if (hb < .55) {
      float bu = vFace.x / (5. + 3. * hash12(vec2(vInst.x, 9.1))), fb = max(fwidth(bu), 1e-4);
      float pier = mix(smoothstep(.76 - fb, .76 + fb, abs(fract(bu) - .5) * 2.), .24, smoothstep(.3, .6, fb));
      float vy = smoothstep(.4, .8, vFace.y) * (1. - smoothstep(3.4, 3.8, vFace.y));
      float dk = smoothstep(.3, .5, uNight);
      // up close: storefront mullions every 1.5 m and a brighter ceiling line; each bay at its own level
      float mu = vFace.x / 1.5, fm = max(fwidth(mu), 1e-4);
      float mull = (1. - smoothstep(.04, .04 + fm * 1.5, abs(fract(mu + .5) - .5))) * (1. - smoothstep(.25, .5, fm));
      float hbay = hash12(vec2(floor(bu), vInst.x * 7.3));
      float lv = (.55 + .45 * smoothstep(1.2, 3.4, vFace.y)) * (1. - .7 * mull) * step(.25, hbay) * (.6 + .5 * hbay);
      emis += vec3(1., .42, .14) * (.1 + .1 * hb) * (1. - pier) * vy * dk * lv;
      realC *= 1. - .5 * dk * vy;
    }
  }
  col = mix(modelC, realC, real);
  col += emis * real;
  col = aerial(col, P, real);
  col += scanBand(P.xz) * (.35 + .65 * smoothstep(0., 30., P.y));
  gl_FragColor = vec4(col, 1.);
}
`;

export function makeTowerMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: '#define PI_HALF 1.5707963\n' + TOWER_VERT,
    fragmentShader: COMMON_FRAG + FACADE_GLSL + TOWER_FRAG
  });
  return m;
}
export function makeTowerDepthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: '#define PI_HALF 1.5707963\n' + TOWER_VERT,
    fragmentShader: 'void main(){ gl_FragColor = vec4(1.); }'
  });
}
/* generic depth material for plain meshes */
export function makeDepthMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: 'void main(){ gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(1.); }'
  });
}
