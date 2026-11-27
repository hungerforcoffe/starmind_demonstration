// ============================================================================
// INTERFAZ, ESCENA 3D, VISTAS, SIMULADOR DE RUBIN, GRÁFICO, DIAGNÓSTICO
// ============================================================================
const $ = id => document.getElementById(id);
const SCEN_NAMES = ['Starlink actual', 'Starlink Gen2 autorizado', 'Starmind 1M'];
const SCEN_COLORS = ['#3987e5', '#199e70', '#d95926'];
const nf = (x, d = 0) => (x === null || x === undefined || !isFinite(x)) ? '—' : Number(x).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
const clone = o => JSON.parse(JSON.stringify(o));
const params = new URLSearchParams(location.search);

const state = {
  simMs: Date.now(), playing: false, speed: 60, tRef: 0, deploy: 1, on: [true, false, true],
  Mstar: BRILLO.central, phaseOn: false, conical: false, magLim: 12, godShadow: true, skyShadow: false, coneX: false,
  alt: 60, az: 180, band: 'r', twoSnaps: false, emin: 30,
  groupsStarmind: clone(DEFAULT_STARMIND), groupsGen2: clone(DEFAULT_GEN2), starmindPreset: 'FCC',
  lastExp: null, night: null,
};
const Mvec = () => [0, M_GEN2, state.Mstar];

// --------------------------------------------------------------- Starlink TLE
function starlinkM(name, l1) {
  if (/DTC/i.test(name)) return 6.47;
  const yy = parseInt(l1.substr(9, 2), 10), ln = parseInt(l1.substr(11, 3), 10), y = 2000 + yy;
  if (y < 2023 || (y === 2023 && ln < 26)) return 6.34; // antes del primer lanzamiento V2 Mini (2023-026)
  return 7.87;
}
function parseTLE(text) {
  const L = text.split(/\r?\n/).map(s => s.trimEnd()).filter(s => s.length);
  const recs = [], names = [], Ms = [];
  for (let i = 0; i + 2 < L.length + 1; ) {
    let name = 'SAT', l1, l2;
    if (L[i].startsWith('1 ') && L[i + 1] && L[i + 1].startsWith('2 ')) { l1 = L[i]; l2 = L[i + 1]; i += 2; }
    else if (L[i + 1] && L[i + 1].startsWith('1 ') && L[i + 2] && L[i + 2].startsWith('2 ')) { name = L[i].trim(); l1 = L[i + 1]; l2 = L[i + 2]; i += 3; }
    else { i++; continue; }
    try { const r = satellite.twoline2satrec(l1, l2); recs.push(r); names.push(name); Ms.push(starlinkM(name, l1)); } catch (e) { /* línea inválida */ }
  }
  let epMax = 0; for (const r of recs) epMax = Math.max(epMax, (r.jdsatepoch + (r.jdsatepochF || 0) - 2440587.5) * 86400000);
  return { recs, names, Ms: Float32Array.from(Ms), epoch: epMax };
}

// --------------------------------------------------------------- renderer
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setScissorTest(true);
renderer.autoClear = false;
window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight, false));

const sceneGod = new THREE.Scene(), sceneSky = new THREE.Scene();
const camGod = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
camGod.position.set(18, 14, 30);
const camSky = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
const controls = new OrbitControls(camGod, $('god'));
controls.enableDamping = true; controls.minDistance = 7; controls.maxDistance = 400;

const eci2three = (v, s = 1 / 1000) => new THREE.Vector3(v[0] * s, v[2] * s, -v[1] * s);

// Tierra con día/noche y terminador
const earthMat = new THREE.ShaderMaterial({
  uniforms: { tDay: { value: null }, tNight: { value: null }, uHasTex: { value: 0 }, uSunW: { value: new THREE.Vector3(1, 0, 0) } },
  vertexShader: `varying vec2 vUv; varying vec3 vN;
    void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDay, tNight; uniform float uHasTex; uniform vec3 uSunW; varying vec2 vUv; varying vec3 vN;
    void main(){
      float c = dot(normalize(vN), uSunW); float k = smoothstep(-0.06, 0.06, c);
      vec3 day = uHasTex > 0.5 ? texture2D(tDay, vUv).rgb : vec3(0.16, 0.30, 0.52);
      vec3 night = uHasTex > 0.5 ? texture2D(tNight, vUv).rgb : vec3(0.02);
      vec3 col = mix(night * 1.2 + day * 0.035, day * (0.30 + 0.70 * max(c, 0.0)), k);
      gl_FragColor = vec4(col, 1.0); }`,
});
const earth = new THREE.Mesh(new THREE.SphereGeometry(RE / 1000, 128, 64), earthMat);
sceneGod.add(earth);
{
  const ld = new THREE.TextureLoader(); ld.setCrossOrigin('anonymous');
  const base = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/';
  let n = 0; const done = () => { if (++n === 2) earthMat.uniforms.uHasTex.value = 1; };
  earthMat.uniforms.tDay.value = ld.load(base + 'earth_atmos_2048.jpg', done, undefined, () => console.warn('sin textura diurna'));
  earthMat.uniforms.tNight.value = ld.load(base + 'earth_lights_2048.png', done, undefined, () => console.warn('sin textura nocturna'));
}
// Cerro Pachón (hijo de la Tierra: rota con ella)
const obsE = obsECEF(RUBIN);
const obsMarker = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
obsMarker.position.set(obsE[0] / 1000, obsE[2] / 1000, -obsE[1] / 1000);
earth.add(obsMarker);
// estrellas de fondo
{
  const g = new THREE.BufferGeometry(), N = 3000, p = new Float32Array(3 * N), rng = mulberry32(5);
  for (let i = 0; i < N; i++) { const z = 2 * rng() - 1, a = TWO_PI * rng(), r = Math.sqrt(1 - z * z); p.set([1500 * r * Math.cos(a), 1500 * z, 1500 * r * Math.sin(a)], 3 * i); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  sceneGod.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8890a0, size: 1.2, sizeAttenuation: false })));
}
// dirección del Sol
const sunLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(30, 0, 0)]);
const sunLine = new THREE.Line(sunLineGeo, new THREE.LineBasicMaterial({ color: 0xffd34d }));
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
sceneGod.add(sunLine, sunBall);
// cono de LSSTCam
function makeCone(L, ang) { const g = new THREE.ConeGeometry(L * Math.tan(ang), L, 32, 1, true); g.translate(0, -L / 2, 0); g.rotateX(Math.PI); return g; }
const coneMat = new THREE.MeshBasicMaterial({ color: 0xe8eef7, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
const cone = new THREE.Mesh(makeCone(3, 1.75 * DEG), coneMat);
const coneAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 3.2, 0)]);
const coneAxis = new THREE.Line(coneAxisGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
cone.add(coneAxis);
sceneGod.add(cone);

// --------------------------------------------------------------- shaders de satélites
const U = {
  uT: { value: 0 }, uSunRA: { value: 0 }, uConical: { value: 0 }, uDeploy: { value: 1 }, uMagLim: { value: 12 }, uPhaseOn: { value: 0 },
  uShowShadowGod: { value: 1 }, uShowShadowSky: { value: 0 }, uPxGod: { value: 1.6 * DPR }, uPxSky: { value: DPR }, uProbeW: { value: 1 },
  uSun: { value: new THREE.Vector3(1, 0, 0) }, uObs: { value: new THREE.Vector3() }, uE: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3() }, uU: { value: new THREE.Vector3() },
  uOn: { value: new THREE.Vector3(1, 0, 1) }, uM: { value: new THREE.Vector3(0, M_GEN2, BRILLO.central) },
  uCol0: { value: new THREE.Color(SCEN_COLORS[0]) }, uCol1: { value: new THREE.Color(SCEN_COLORS[1]) }, uCol2: { value: new THREE.Color(SCEN_COLORS[2]) },
};
// colores en sRGB directos (sin gestión de color en ShaderMaterial)
U.uCol0.value.set(SCEN_COLORS[0]).convertLinearToSRGB(); U.uCol1.value.set(SCEN_COLORS[1]).convertLinearToSRGB(); U.uCol2.value.set(SCEN_COLORS[2]).convertLinearToSRGB();

const SAT_VS = `
#define PI 3.141592653589793
uniform float uT, uSunRA, uConical, uDeploy, uMagLim, uPhaseOn, uShowShadowGod, uShowShadowSky, uPxGod, uPxSky, uProbeW;
uniform vec3 uSun, uObs, uE, uN, uU, uOn, uM, uCol0, uCol1, uCol2;
#if ELEMENTS
attribute vec4 aOrb; attribute vec4 aRate; attribute vec2 aMisc;
#else
attribute float aM;
#endif
#if MODE == 2
attribute float aIdx;
#endif
varying vec4 vC;
const float RE = 6378.137;
vec3 eciPos(){
#if ELEMENTS
  float u = mod(aOrb.w + aRate.x * uT, 2.0 * PI);
  float raan = aRate.w > 0.5 ? uSunRA + aRate.z : aOrb.z + aRate.y * uT;
  float cO = cos(raan), sO = sin(raan), cu = cos(u), su = sin(u), ci = cos(aOrb.y), si = sin(aOrb.y);
  return aOrb.x * vec3(cO * cu - sO * su * ci, sO * cu + cO * su * ci, su * si);
#else
  return vec3(position.x, -position.z, position.y) * 1000.0;
#endif
}
float litF(vec3 r){
  float p = dot(r, uSun);
  if (p > 0.0) return 1.0;
  float d2 = dot(r, r) - p * p;
  if (uConical < 0.5) return d2 > RE * RE ? 1.0 : 0.0;
  float x = -p, d = sqrt(max(d2, 0.0)), ru = RE - x * 0.0046098, rp = RE + x * 0.0046950;
  if (d >= rp) return 1.0; if (d <= ru) return 0.0; return (d - ru) / (rp - ru);
}
vec3 magColor(float m){
  float t = clamp((m - 1.0) / 9.0, 0.0, 1.0);
  vec3 a = vec3(1.0, 0.97, 0.88), b = vec3(1.0, 0.66, 0.30), c = vec3(0.62, 0.22, 0.14);
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
}
void main(){
#if ELEMENTS
  float sc = aMisc.x;
  bool on = sc < 1.5 ? uOn.y > 0.5 : (uOn.z > 0.5 && aMisc.y <= uDeploy);
  float M = sc < 1.5 ? uM.y : uM.z; vec3 col = sc < 1.5 ? uCol1 : uCol2;
#else
  bool on = uOn.x > 0.5; float M = aM; vec3 col = uCol0;
#endif
  vec3 r = eciPos(); float f = litF(r);
  vC = vec4(0.0); gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
#if MODE == 2
  vec3 d = r - uObs; float rg = length(d);
  gl_Position = vec4((aIdx + 0.5) / uProbeW * 2.0 - 1.0, 0.0, 0.0, 1.0); gl_PointSize = 1.0;
  vC = vec4(dot(d, uE) / rg, dot(d, uN) / rg, dot(d, uU) / rg, f > 0.0 ? rg : -rg); // dirección ENU + iluminación en el signo
#elif MODE == 0
  if (!on || (f <= 0.0 && uShowShadowGod < 0.5)) return;
  gl_Position = projectionMatrix * viewMatrix * vec4(vec3(r.x, r.z, -r.y) / 1000.0, 1.0);
  vC = f > 0.0 ? vec4(col * (0.65 + 0.35 * f), 1.0) : vec4(0.30, 0.32, 0.36, 0.5);
  gl_PointSize = uPxGod * (f > 0.0 ? 1.0 : 0.75);
#else
  if (!on) return;
  vec3 d = r - uObs; float rg = length(d); float up = dot(d, uU) / rg;
  if (up <= 0.0) return;
  if (f <= 0.0 && uShowShadowSky < 0.5) return;
  float alt = asin(up), az = atan(dot(d, uE), dot(d, uN)), zd = (0.5 * PI - alt) / (0.5 * PI);
  vec4 pos = vec4(-zd * sin(az), zd * cos(az), 0.0, 1.0);
  if (f > 0.0) {
    float m = M + 5.0 * log(rg / 1000.0) / log(10.0) - 2.5 * log(max(f, 1e-3)) / log(10.0);
    if (uPhaseOn > 0.5) { float ph = degrees(acos(clamp(dot(uSun, -d / rg), -1.0, 1.0))); m += 2.630 + 0.1065 * ph - 0.0005167 * ph * ph - 8.03; }
    if (m > uMagLim) return;
    gl_Position = pos; vC = vec4(magColor(m), 1.0); gl_PointSize = uPxSky * clamp(4.4 - 0.42 * (m - 1.0), 1.4, 4.8);
  } else { gl_Position = pos; vC = vec4(0.36, 0.38, 0.44, 0.55); gl_PointSize = uPxSky * 1.2; }
#endif
}`;
const SAT_FS = `varying vec4 vC;
void main(){
#if MODE == 1
  vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard;
#endif
  gl_FragColor = vC; }`;
function satMaterial(mode, elements) {
  return new THREE.ShaderMaterial({ uniforms: U, vertexShader: SAT_VS, fragmentShader: SAT_FS, defines: { MODE: mode, ELEMENTS: elements ? 1 : 0 },
    transparent: mode !== 2, depthWrite: false, depthTest: mode === 0, blending: mode === 2 ? THREE.NoBlending : THREE.NormalBlending });
}
const matGodE = satMaterial(0, true), matSkyE = satMaterial(1, true), matGodP = satMaterial(0, false), matSkyP = satMaterial(1, false), matProbe = satMaterial(2, true);

// --------------------------------------------------------------- constelaciones
let SYN = null, synGeo = null, synGod = null, synSky = null, synSrc = null;
function buildSynthetic() {
  if (synGod) { sceneGod.remove(synGod); sceneSky.remove(synSky); synGeo.dispose(); }
  const subs = [...expandGroups(state.groupsGen2, 1), ...expandGroups(state.groupsStarmind, 2)];
  SYN = buildSynth(subs, 12345);
  state.tRef = state.simMs;
  synGeo = new THREE.BufferGeometry();
  synGeo.setAttribute('aOrb', new THREE.BufferAttribute(SYN.orb, 4));
  synGeo.setAttribute('aRate', new THREE.BufferAttribute(SYN.rate, 4));
  synGeo.setAttribute('aMisc', new THREE.BufferAttribute(SYN.misc, 2));
  synGeo.setDrawRange(0, SYN.n);
  synGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  synGod = new THREE.Points(synGeo, matGodE); synSky = new THREE.Points(synGeo, matSkyE);
  synGod.frustumCulled = synSky.frustumCulled = false;
  sceneGod.add(synGod); sceneSky.add(synSky);
  synSrc = synthSource(SYN, () => ({ tRef: state.tRef, deploy: state.deploy, on: [state.on[0], state.on[1], state.on[2], false], M: Mvec() }));
  let n1 = 0, n2 = 0; for (let k = 0; k < SYN.n; k++) (SYN.misc[2 * k] < 1.5 ? n1++ : n2++);
  $('nS1').textContent = `(${nf(n1)})`; $('nS2').textContent = `(${nf(n2)}${state.starmindPreset !== 'FCC' ? ', ' + state.starmindPreset : ''})`;
}
function maybeRebase() {
  const dt = (state.simMs - state.tRef) / 1000;
  if (Math.abs(dt) > 12 * 3600) {
    rebaseSynth(SYN, dt); state.tRef = state.simMs;
    synGeo.attributes.aOrb.needsUpdate = true;
  }
}

let TLE = null, tleGeo = null, tleGod = null, tleSky = null, tleSrc = null, tleLastMs = NaN, tleLastReal = 0;
function setTLE(parsed, origin) {
  TLE = parsed;
  if (tleGod) { sceneGod.remove(tleGod); sceneSky.remove(tleSky); tleGeo.dispose(); }
  tleGeo = new THREE.BufferGeometry();
  tleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * TLE.recs.length), 3));
  tleGeo.setAttribute('aM', new THREE.BufferAttribute(TLE.Ms, 1));
  tleGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  tleGod = new THREE.Points(tleGeo, matGodP); tleSky = new THREE.Points(tleGeo, matSkyP);
  tleGod.frustumCulled = tleSky.frustumCulled = false;
  sceneGod.add(tleGod); sceneSky.add(tleSky);
  tleSrc = tleSource(TLE.recs, TLE.Ms, satellite, () => ({ on: state.on[0] }));
  tleLastMs = NaN;
  $('nS0').textContent = `(${nf(TLE.recs.length)})`;
  $('tleInfo').textContent = `${origin}: ${nf(TLE.recs.length)} objetos; época más reciente ${new Date(TLE.epoch).toISOString().slice(0, 16).replace('T', ' ')} UTC.`;
}
function updateTLEPositions(force) {
  if (!TLE || !state.on[0]) return;
  const now = performance.now();
  if (!force && Math.abs(state.simMs - tleLastMs) < 1500 && now - tleLastReal < 2000) return;
  if (!force && now - tleLastReal < 120) return;
  tleLastMs = state.simMs; tleLastReal = now;
  const arr = tleGeo.attributes.position.array, d = new Date(state.simMs);
  for (let k = 0; k < TLE.recs.length; k++) {
    const pv = satellite.propagate(TLE.recs[k], d);
    if (pv && pv.position && !TLE.recs[k].error) { arr[3 * k] = pv.position.x / 1000; arr[3 * k + 1] = pv.position.z / 1000; arr[3 * k + 2] = -pv.position.y / 1000; }
    else { arr[3 * k] = 0; arr[3 * k + 1] = 0; arr[3 * k + 2] = 0; }
  }
  tleGeo.attributes.position.needsUpdate = true;
}
const enabledSources = () => [tleSrc, synSrc].filter(Boolean);

// --------------------------------------------------------------- uniformes por cuadro
let F = frameAt(state.simMs);
function pointingECI(Fx) { return altAzToECI(Fx, state.alt, state.az); }
function updateUniforms() {
  F = frameAt(state.simMs);
  maybeRebase();
  U.uT.value = (state.simMs - state.tRef) / 1000; U.uSunRA.value = F.sunRA;
  U.uSun.value.set(...F.sun); U.uObs.value.set(...F.obs); U.uE.value.set(...F.E); U.uN.value.set(...F.N); U.uU.value.set(...F.U);
  U.uOn.value.set(+state.on[0], +state.on[1], +state.on[2]); U.uDeploy.value = state.deploy;
  U.uM.value.set(0, M_GEN2, state.Mstar); U.uConical.value = +state.conical; U.uPhaseOn.value = +state.phaseOn;
  U.uMagLim.value = state.magLim; U.uShowShadowGod.value = +state.godShadow; U.uShowShadowSky.value = +state.skyShadow;
  earth.rotation.y = F.theta;
  const sw = eci2three(F.sun, 1); earthMat.uniforms.uSunW.value.copy(sw);
  sunLineGeo.attributes.position.setXYZ(1, sw.x * 30, sw.y * 30, sw.z * 30); sunLineGeo.attributes.position.needsUpdate = true;
  sunBall.position.copy(sw).multiplyScalar(30);
  const p = pointingECI(F), o = eci2three(F.obs);
  cone.position.copy(o); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eci2three(p, 1).normalize());
  if (cone.userData.x !== state.coneX) { cone.userData.x = state.coneX; cone.geometry.dispose(); cone.geometry = makeCone(3, (state.coneX ? 5 : 1) * 1.75 * DEG); }
}

// --------------------------------------------------------------- render
function viewRect(el) {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { x: r.left, y: window.innerHeight - r.bottom, w: r.width, h: r.height };
}
function skyBg(alt) {
  if (alt > -6) return 0x24364f; if (alt > -12) return 0x162235; if (alt > -18) return 0x0c1220; return 0x05070b;
}
let fpsT0 = performance.now(), fpsN = 0, fpsVal = 0, lastReal = performance.now(), frameTimes = [];
function render() {
  renderer.setScissorTest(false); renderer.setClearColor(0x1a1a19, 1); renderer.clear(); renderer.setScissorTest(true);
  const rg = viewRect($('god'));
  if (rg) {
    camGod.aspect = rg.w / rg.h; camGod.updateProjectionMatrix();
    renderer.setViewport(rg.x, rg.y, rg.w, rg.h); renderer.setScissor(rg.x, rg.y, rg.w, rg.h);
    renderer.setClearColor(0x050608, 1); renderer.clear(); renderer.render(sceneGod, camGod);
  }
  const rs = viewRect($('sky'));
  if (rs) {
    const s = Math.min(rs.w, rs.h);
    renderer.setViewport(rs.x, rs.y, s, s); renderer.setScissor(rs.x, rs.y, s, s);
    renderer.setClearColor(skyBg(Math.asin(dot(F.sun, F.U)) * RAD), 1); renderer.clear(); renderer.render(sceneSky, camSky);
  }
}
function loop(now) {
  const dt = Math.min(0.25, (now - lastReal) / 1000); lastReal = now;
  if (state.playing) state.simMs += dt * 1000 * state.speed;
  updateUniforms(); updateTLEPositions(false);
  controls.update();
  render(); drawSkyOverlay(); updateClock(); tickStatus();
  fpsN++; frameTimes.push(now); if (frameTimes.length > 240) frameTimes.shift();
  if (now - fpsT0 > 1000) { fpsVal = fpsN * 1000 / (now - fpsT0); fpsN = 0; fpsT0 = now; $('fps').textContent = `${nf(fpsVal, 0)} fps · ${nf(SYN ? SYN.n + (TLE ? TLE.recs.length : 0) : 0)} satélites cargados`; }
  requestAnimationFrame(loop);
}

// --------------------------------------------------------------- reloj y estado
function chileStr(ms) {
  const off = chileOffsetH(ms), d = new Date(ms + off * 3600000);
  return { s: d.toISOString().slice(0, 19).replace('T', ' '), off, input: d.toISOString().slice(0, 16) };
}
let clockLast = 0;
function updateClock() {
  const now = performance.now(); if (now - clockLast < 150) return; clockLast = now;
  const c = chileStr(state.simMs), sa = Math.asin(dot(F.sun, F.U)) * RAD;
  const lst = mod(F.theta * RAD + RUBIN.lon, 360) / 15;
  $('clock').textContent = `${c.s} Chile (UTC${c.off}) · ${new Date(state.simMs).toISOString().slice(11, 19)} UTC · Sol ${nf(sa, 1)}° · TSL ${String(Math.floor(lst)).padStart(2, '0')}:${String(Math.floor((lst % 1) * 60)).padStart(2, '0')}`;
  if (document.activeElement !== $('tLocal')) $('tLocal').value = c.input;
  $('tzlab').textContent = `hora de Chile (UTC${c.off})`;
}
let statusLast = 0, statusMs = NaN;
function tickStatus() {
  const now = performance.now();
  if (state.measuring || now - statusLast < (state.playing ? 4000 : 1200) || (state.simMs === statusMs && now - statusLast < 5000)) return;
  statusLast = now; statusMs = state.simMs;
  const lines = [];
  const cs = synSrc ? countByScen(synSrc, F, 30, state.conical) : null, ct = (tleSrc && state.on[0]) ? countVisible(tleSrc, F, 30, state.conical) : null;
  const rows = [[0, ct], [1, cs && cs[1]], [2, cs && cs[2]]];
  lines.push('escenario                 >0°  ilum>0°   >30°  ilum>30°');
  for (const [i, c] of rows) if (state.on[i] && c) lines.push(`${SCEN_NAMES[i].padEnd(24)} ${String(c.above).padStart(6)} ${String(c.lit).padStart(7)} ${String(c.aboveE).padStart(6)} ${String(c.litE).padStart(8)}`);
  const sa = Math.asin(dot(F.sun, F.U)) * RAD;
  lines.push(`Sol ${nf(sa, 1)}° · sombra sobre el cenit ≈ ${sa < 0 ? nf(shadowHeightZenith(-sa), 0) + ' km' : '—'}`);
  $('status').textContent = lines.join('\n');
  const p = pointingECI(F), rd = eciToRadecJ2000(F.jd, p);
  $('skyInfo').textContent = `Apuntado: alt ${nf(state.alt, 1)}°, az ${nf(state.az, 1)}° → RA ${nf(rd.ra, 2)}°, Dec ${nf(rd.dec, 2)}° (J2000). Color = magnitud V (blanco = brillante, rojo = débil); límite m < ${nf(state.magLim, 1)}.`;
}

// --------------------------------------------------------------- overlay del cielo
const skyov = $('skyov'), sctx = skyov.getContext('2d');
skyov.addEventListener('click', ev => {
  const r = skyov.getBoundingClientRect(), x = ((ev.clientX - r.left) / r.width) * 2 - 1, y = 1 - ((ev.clientY - r.top) / r.height) * 2;
  const zd = Math.hypot(x, y); if (zd > 1) return;
  state.alt = Math.max(15, 90 * (1 - zd)); state.az = mod(Math.atan2(-x, y) * RAD, 360);
  $('pAlt').value = state.alt.toFixed(1); $('pAz').value = state.az.toFixed(1); statusLast = 0;
});
function drawSkyOverlay() {
  const W = skyov.clientWidth * DPR, H = skyov.clientHeight * DPR;
  if (skyov.width !== W || skyov.height !== H) { skyov.width = W; skyov.height = H; }
  const c = sctx, R = W / 2, cx = W / 2, cy = H / 2, toXY = (alt, az) => { const zd = (90 - alt) / 90; return [cx - zd * Math.sin(az * DEG) * R, cy - zd * Math.cos(az * DEG) * R]; };
  c.clearRect(0, 0, W, H);
  c.strokeStyle = 'rgba(200,205,215,0.45)'; c.lineWidth = DPR; c.fillStyle = 'rgba(200,205,215,0.8)'; c.font = `${11 * DPR}px system-ui`;
  for (const a of [0, 30, 60]) { c.beginPath(); c.arc(cx, cy, R * (90 - a) / 90 - (a === 0 ? DPR : 0), 0, TWO_PI); c.stroke(); if (a) c.fillText(a + '°', cx + 3 * DPR, cy - R * (90 - a) / 90 + 12 * DPR); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', cx, 10 * DPR); c.fillText('S', cx, H - 10 * DPR); c.fillText('E', 9 * DPR, cy); c.fillText('O', W - 9 * DPR, cy);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  // Sol
  const sAA = eciToAltAz(F, F.sun);
  if (sAA.alt > 0) { const [x, y] = toXY(sAA.alt, sAA.az); c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(x, y, 6 * DPR, 0, TWO_PI); c.fill(); }
  else { const [x, y] = toXY(0, sAA.az); c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(x, y, 4 * DPR, 0, TWO_PI); c.fill();
    c.fillText(`Sol ${nf(sAA.alt, 1)}°`, Math.min(W - 70 * DPR, Math.max(4, x - 30 * DPR)), y + (y < cy ? 18 : -10) * DPR); }
  // trazas de la última exposición (si el reloj sigue cerca)
  const E = state.lastExp;
  if (E && Math.abs(state.simMs - E.t0) < 120000) {
    const B = pointingBasis(E.p);
    c.lineWidth = 1.5 * DPR;
    for (const tr of E.trails) {
      if (!tr.track || tr.track.length < 2) continue;
      c.strokeStyle = SCEN_COLORS[tr.scen]; c.beginPath();
      tr.track.forEach(([x, y], i) => { const v = norm3([B.p[0] + x * B.e[0] + y * B.n[0], B.p[1] + x * B.e[1] + y * B.n[1], B.p[2] + x * B.e[2] + y * B.n[2]]); const aa = eciToAltAz(F, v); const [px, py] = toXY(aa.alt, aa.az); i ? c.lineTo(px, py) : c.moveTo(px, py); });
      c.stroke();
    }
  }
  // apuntado + campo
  const [px, py] = toXY(state.alt, state.az), rf = Math.max(5 * DPR, R * 1.75 / 90);
  c.strokeStyle = '#ffffff'; c.lineWidth = 1.5 * DPR; c.beginPath(); c.arc(px, py, rf, 0, TWO_PI); c.stroke();
  c.beginPath(); c.moveTo(px - rf - 5 * DPR, py); c.lineTo(px - rf + 2 * DPR, py); c.moveTo(px + rf - 2 * DPR, py); c.lineTo(px + rf + 5 * DPR, py); c.stroke();
}

// --------------------------------------------------------------- simulador de exposición e imagen CCD
const RAFT = 3 * 4096 * 0.2 / 3600, CCDW = 4096 * 0.2 / 3600; // grados
function ccdRects() {
  const out = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    if (Math.abs(i) === 2 && Math.abs(j) === 2) continue;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const x0 = (i - 0.5) * RAFT + a * RAFT / 3, y0 = (j - 0.5) * RAFT + b * RAFT / 3;
      out.push([x0 + 0.003, y0 + 0.003, CCDW - 0.006, CCDW - 0.006]);
    }
  }
  return out;
}
const CCDS = ccdRects();
function classifyTrail(tr, band, texp) {
  if (!tr.lit || tr.mMin === null) return { cls: 'sombra' };
  const sp = streakPeak(tr.mMin, tr.range, tr.omega, band), sky = skyPerPix(band, texp), sig = Math.sqrt(sky + 25);
  if (tr.mMin < 2) return { cls: 'ultra', ...sp };
  if (sp.peak + sky > CAM.fullWell) return { cls: 'saturada', ...sp };
  if (sp.peak > 5 * sig) return { cls: 'normal', ...sp };
  return { cls: 'debil', ...sp };
}
function drawCCD(E) {
  const cv = $('ccd'), c = cv.getContext('2d'), W = cv.width, sc = W / (2 * 1.78), cx = W / 2, cy = W / 2;
  const toPx = (xd, yd) => [cx - xd * sc, cy - yd * sc];
  c.fillStyle = '#000'; c.fillRect(0, 0, W, W);
  const rng = mulberry32(77);
  // CCDs con ruido de cielo
  for (const [x0, y0, w, h] of CCDS) { const [a, b] = toPx(x0 + w, y0 + h); c.fillStyle = '#16171a'; c.fillRect(a, b, w * sc, h * sc); }
  const img = c.getImageData(0, 0, W, W), d = img.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 0) { const v = 18 + rng() * 14; d[i] = d[i + 1] = v; d[i + 2] = v + 3; }
  c.putImageData(img, 0, 0);
  // estrellas
  for (let s = 0; s < 700; s++) { const x = (rng() * 2 - 1) * 1.72, y = (rng() * 2 - 1) * 1.72, m = rng() ** 3; const [px, py] = toPx(x, y); c.fillStyle = `rgba(230,232,240,${0.25 + 0.75 * m})`; c.beginPath(); c.arc(px, py, 0.6 + 1.6 * m, 0, TWO_PI); c.fill(); }
  // clip al plano focal
  c.save(); c.beginPath(); for (const [x0, y0, w, h] of CCDS) { const [a, b] = toPx(x0 + w, y0 + h); c.rect(a, b, w * sc, h * sc); } c.clip();
  // máscara para pérdida de píxeles (resolución 900 px)
  const MW = 900, msc = MW / (2 * 1.78), mk = document.createElement('canvas'); mk.width = mk.height = MW; const mc = mk.getContext('2d');
  mc.fillStyle = '#000'; mc.fillRect(0, 0, MW, MW); mc.strokeStyle = '#fff'; mc.fillStyle = '#fff'; mc.lineCap = 'round';
  const mPx = (xd, yd) => [MW / 2 - xd * msc, MW / 2 - yd * msc];
  const deadCCD = new Set();
  const counts = {};
  const texp = E.twoSnaps ? 30 : 30;
  for (const tr of E.trails) {
    const k = classifyTrail(tr, E.band, texp); tr.cls = k.cls; tr.peak = k.peak;
    counts[tr.scen] = counts[tr.scen] || { n: 0, lit: 0, sat: 0, ultra: 0, debil: 0, mMin: Infinity };
    const C = counts[tr.scen]; C.n++; if (tr.lit) C.lit++; if (k.cls === 'saturada') C.sat++; if (k.cls === 'ultra') C.ultra++; if (k.cls === 'debil') C.debil++; if (tr.mMin !== null) C.mMin = Math.min(C.mMin, tr.mMin);
    if (!tr.track || tr.track.length < 2 || k.cls === 'sombra') continue;
    const pts = tr.track.map(([x, y, f, w]) => [x * RAD, y * RAD, f, w]);
    const level = k.cls === 'debil' ? 0.25 : Math.min(1, 0.35 + 0.65 * Math.log10(Math.max(k.peak, 10)) / Math.log10(CAM.fullWell));
    c.strokeStyle = k.cls === 'ultra' || k.cls === 'saturada' ? '#ffffff' : `rgba(235,235,240,${level})`;
    c.lineWidth = k.cls === 'saturada' ? 3 : k.cls === 'ultra' ? 4 : 1.4;
    if (k.cls === 'saturada' || k.cls === 'ultra') { c.shadowColor = SCEN_COLORS[tr.scen]; c.shadowBlur = 8; } else c.shadowBlur = 0;
    c.beginPath(); let prevW = -1;
    for (const [x, y, f, w] of pts) { const [px, py] = toPx(x, y); if (w !== prevW || f <= 0) c.moveTo(px, py); else c.lineTo(px, py); prevW = f > 0 ? w : -1; }
    c.stroke(); c.shadowBlur = 0;
    // máscara (Jangid et al. 2026: 100 px normal, 500 px saturada; CCD completo si m<2)
    if (k.cls === 'debil') continue;
    if (k.cls === 'ultra') {
      for (let q = 0; q < CCDS.length; q++) { const [x0, y0, w, h] = CCDS[q]; for (let s = 0; s + 1 < pts.length; s++) for (let t = 0; t <= 20; t++) { const x = pts[s][0] + (pts[s + 1][0] - pts[s][0]) * t / 20, y = pts[s][1] + (pts[s + 1][1] - pts[s][1]) * t / 20; if (x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + h) deadCCD.add(q); } }
    } else {
      mc.lineWidth = Math.max(1, (k.cls === 'saturada' ? 500 : 100) * CAM.pix / 3600 * msc);
      mc.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = mPx(x, y); i ? mc.lineTo(a, b) : mc.moveTo(a, b); }); mc.stroke();
    }
  }
  for (const q of deadCCD) { const [x0, y0, w, h] = CCDS[q]; const [a, b] = toPx(x0 + w, y0 + h); c.fillStyle = 'rgba(230,103,103,0.35)'; c.fillRect(a, b, w * sc, h * sc); const [ma, mb] = mPx(x0 + w, y0 + h); mc.fillRect(ma, mb, w * msc, h * msc); }
  c.restore();
  // pérdida de píxeles = píxeles enmascarados dentro de CCDs / píxeles de CCD
  const area = document.createElement('canvas'); area.width = area.height = MW; const ac = area.getContext('2d'); ac.fillStyle = '#000'; ac.fillRect(0, 0, MW, MW); ac.fillStyle = '#fff';
  for (const [x0, y0, w, h] of CCDS) { const [a, b] = mPx(x0 + w, y0 + h); ac.fillRect(a, b, w * msc, h * msc); }
  const A = ac.getImageData(0, 0, MW, MW).data, Mk = mc.getImageData(0, 0, MW, MW).data; let na = 0, nm = 0;
  for (let i = 0; i < A.length; i += 4) if (A[i] > 127) { na++; if (Mk[i] > 127) nm++; }
  // marco del campo de 1,75°
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.setLineDash([4, 4]); c.beginPath(); c.arc(cx, cy, 1.75 * sc, 0, TWO_PI); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#c3c2b7'; c.font = '13px system-ui'; c.fillText('N', cx - 4, 14); c.fillText('E', 6, cy + 4);
  return { counts, loss: nm / na };
}
function runExposure() {
  const t0 = state.simMs, Fm = frameAt(t0 + 15000), p = altAzToECI(Fm, state.alt, state.az);
  const t = performance.now();
  const res = simulateExposures(enabledSources(), t0, [p], { dt: 0.25, twoSnaps: state.twoSnaps, conical: state.conical, phaseOn: state.phaseOn, keepTracks: true, requireLit: false })[0];
  const E = { t0, p, trails: res.trails, band: state.band, twoSnaps: state.twoSnaps };
  state.lastExp = E;
  const out = drawCCD(E);
  const rd = eciToRadecJ2000(Fm.jd, p), sa = Math.asin(dot(Fm.sun, Fm.U)) * RAD;
  const lines = [`${chileStr(t0).s} Chile · ${state.twoSnaps ? '2×15 s' : '30 s'} · banda ${state.band} · alt ${nf(state.alt, 1)}° az ${nf(state.az, 1)}° · RA ${nf(rd.ra, 2)}° Dec ${nf(rd.dec, 2)}° · Sol ${nf(sa, 1)}°`,
    'escenario                 trazas ilum. satur. m<2  m mín (V)'];
  for (const i of [0, 1, 2]) { const C = out.counts[i]; if (!state.on[i]) continue; lines.push(`${SCEN_NAMES[i].padEnd(24)} ${String(C ? C.n : 0).padStart(6)} ${String(C ? C.lit : 0).padStart(5)} ${String(C ? C.sat : 0).padStart(6)} ${String(C ? C.ultra : 0).padStart(4)}  ${C && isFinite(C.mMin) ? nf(C.mMin, 1) : '—'}`); }
  lines.push(`Pérdida de píxeles estimada: ${nf(out.loss * 100, 2)} % (máscaras de Jangid et al. 2026: 20″ normal, 100″ saturada, CCD completo si m < 2).`);
  lines.push(`Trazas en sombra se cuentan pero no se dibujan. Cálculo: ${nf(performance.now() - t, 0)} ms.`);
  $('expOut').textContent = lines.join('\n');
}
function runStats() {
  const n = +$('nStat').value, emin = +$('emin').value, t0 = state.simMs, t = performance.now();
  const lines = [`${n} apuntados aleatorios (uniformes en ángulo sólido, alt ≥ ${emin}°), 30 s, trazas iluminadas:`];
  const srcs = [];
  if (state.on[0] && tleSrc) srcs.push([0, tleSrc]);
  for (const i of [1, 2]) if (state.on[i]) srcs.push([i, synthSource(SYN, () => ({ tRef: state.tRef, deploy: state.deploy, on: [false, i === 1, i === 2, false], M: Mvec() }))]);
  for (const [i, s] of srcs) {
    const st = pointingStats([s], t0, n, emin, { twoSnaps: state.twoSnaps, conical: state.conical }, 7);
    lines.push(`${SCEN_NAMES[i].padEnd(24)} media ${nf(st.mean, 2).padStart(6)} · afectadas ${nf(st.pAny * 100, 1).padStart(5)} % · p50 ${st.p50} · p90 ${st.p90}`);
  }
  lines.push(`(${nf(performance.now() - t, 0)} ms)`);
  $('statOut').textContent = lines.join('\n');
}

// --------------------------------------------------------------- gráfico de la noche
async function computeNight() {
  const step = +$('nStep').value * 60000, K = +$('nPerStep').value;
  const win = nightWindow(state.simMs, -12);
  if (!win.start || !win.end) { $('nightProg').textContent = 'No hay noche (Sol < −12°) en esta fecha.'; return; }
  const times = []; for (let t = win.start; t <= win.end; t += step) times.push(t);
  const srcs = [[0, tleSource(TLE.recs, TLE.Ms, satellite, () => ({ on: true }))],
    [1, synthSource(SYN, () => ({ tRef: state.tRef, deploy: state.deploy, on: [false, true, false, false], M: Mvec() }))],
    [2, synthSource(SYN, () => ({ tRef: state.tRef, deploy: state.deploy, on: [false, false, true, false], M: Mvec() }))]];
  const series = srcs.map(([i]) => ({ i, lit: [], mean: [], pAny: [] }));
  const sun = times.map(t => sunAlt(t));
  const t0 = performance.now();
  for (let j = 0; j < times.length; j++) {
    const Fj = frameAt(times[j]);
    for (let s = 0; s < srcs.length; s++) {
      const src = srcs[s][1];
      const c = countVisible(src, Fj, 30, state.conical);
      const st = pointingStats([src], times[j], K, 30, { twoSnaps: state.twoSnaps, conical: state.conical }, 100 + j);
      series[s].lit.push(c.litE); series[s].mean.push(st.mean); series[s].pAny.push(st.pAny);
    }
    $('nightProg').textContent = `calculando ${j + 1}/${times.length}…`;
    await new Promise(r => setTimeout(r, 0));
  }
  state.night = { times, sun, series, K, deploy: state.deploy, M: state.Mstar, date: chileStr(win.start).s.slice(0, 10) };
  $('nightProg').textContent = `Noche del ${state.night.date}: ${times.length} pasos, ${K} apuntados/paso, Starmind ${nf(state.deploy * 100, 0)} %, M₁₀₀₀ = ${nf(state.Mstar, 1)} · ${nf((performance.now() - t0) / 1000, 1)} s`;
  drawChart(); fillNightTable();
}
const chart = $('chart'), tip = $('tip');
let chartGeom = null;
function drawChart(hoverIdx = -1) {
  const N = state.night, W = chart.clientWidth, H = chart.clientHeight;
  chart.width = W * DPR; chart.height = H * DPR;
  const c = chart.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
  c.font = '12px system-ui'; c.fillStyle = '#8d8c84';
  if (!N) { c.fillText('Pulsa «Calcular noche actual» (Sol < −12°): satélites iluminados sobre 30° y trazas por exposición de 30 s para cada escenario.', 10, 24); return; }
  const L = 64, R = 150, T = 24, gap = 22, ph = (H - T - 26 - gap) / 2, x0 = N.times[0], x1 = N.times[N.times.length - 1];
  const X = t => L + (t - x0) / (x1 - x0) * (W - L - R);
  const panels = [{ key: 'lit', title: 'Iluminados sobre 30°', y: T }, { key: 'mean', title: 'Trazas por exposición de 30 s (media)', y: T + ph + gap }];
  chartGeom = { X, L, R, W, panels, ph };
  // sombreado del crepúsculo (Sol entre −12° y −18°)
  for (const P of panels) {
    for (let j = 0; j + 1 < N.times.length; j++) if (N.sun[j] > -18) { c.fillStyle = 'rgba(144,133,233,0.10)'; c.fillRect(X(N.times[j]), P.y, X(N.times[j + 1]) - X(N.times[j]) + 0.5, ph); }
  }
  // leyenda
  let lx = L; c.textBaseline = 'middle';
  for (const s of N.series) { c.fillStyle = SCEN_COLORS[s.i]; c.fillRect(lx, 8, 14, 3); c.fillStyle = '#c3c2b7'; c.fillText(SCEN_NAMES[s.i], lx + 18, 9); lx += c.measureText(SCEN_NAMES[s.i]).width + 34; }
  c.fillStyle = 'rgba(144,133,233,0.35)'; c.fillRect(lx, 4, 12, 10); c.fillStyle = '#c3c2b7'; c.fillText('crepúsculo (Sol > −18°)', lx + 16, 9);
  const logY = $('logY').checked;
  for (const P of panels) {
    let ymax = 0, ypos = Infinity; for (const s of N.series) for (const v of s[P.key]) { ymax = Math.max(ymax, v); if (v > 0) ypos = Math.min(ypos, v); }
    let Y, ticks;
    if (logY) {
      const lo = Math.pow(10, Math.floor(Math.log10(isFinite(ypos) ? Math.min(ypos, P.key === 'lit' ? 1 : 0.1) : 0.1))), hi = Math.pow(10, Math.ceil(Math.log10(Math.max(ymax, lo * 10))));
      const l0 = Math.log10(lo), l1 = Math.log10(hi);
      Y = v => P.y + ph - (Math.log10(Math.max(v, lo)) - l0) / (l1 - l0) * ph;
      ticks = []; for (let e = l0; e <= l1 + 1e-9; e++) ticks.push(Math.pow(10, e));
      P.floor = lo;
    } else {
      ymax = ymax > 0 ? niceMax(ymax) : 1; Y = v => P.y + ph - v / ymax * ph; ticks = [0, 1, 2, 3, 4].map(k => ymax * k / 4); P.floor = 0;
    }
    P.Y = Y;
    c.strokeStyle = '#2d2d2b'; c.lineWidth = 1; c.fillStyle = '#8d8c84'; c.textAlign = 'right';
    for (const v of ticks) { const y = Y(v); c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke(); c.fillText(nf(v, v < 0.1 ? 2 : v < 1 ? 1 : 0), L - 6, y); }
    c.textAlign = 'left'; c.fillStyle = '#c3c2b7'; c.fillText(P.title + (logY ? ' · log (0 se dibuja en el piso)' : ''), L + 4, P.y + 8);
    const labels = [];
    for (const s of N.series) {
      c.strokeStyle = SCEN_COLORS[s.i]; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath();
      s[P.key].forEach((v, j) => { const x = X(N.times[j]), y = Y(v); j ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      labels.push({ y: Y(s[P.key][s[P.key].length - 1]), t: ['Starlink', 'Gen2', 'Starmind'][s.i] });
    }
    labels.sort((a, b) => a.y - b.y);                       // etiquetas directas sin solaparse
    for (let q = 1; q < labels.length; q++) labels[q].y = Math.max(labels[q].y, labels[q - 1].y + 13);
    for (let q = labels.length - 2; q >= 0; q--) labels[q].y = Math.min(labels[q].y, labels[q + 1].y - 13);
    c.fillStyle = '#c3c2b7'; for (const lb of labels) c.fillText(lb.t, W - R + 6, Math.min(P.y + ph, Math.max(P.y + 6, lb.y)));
  }
  // eje de tiempo (hora de Chile)
  c.fillStyle = '#8d8c84'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const off = chileOffsetH(x0) * 3600000; let t = Math.ceil((x0 + off) / 3600000) * 3600000 - off;
  for (; t <= x1; t += 3600000) { const x = X(t); c.fillText(new Date(t + off).toISOString().slice(11, 16), x, H - 8); c.strokeStyle = '#2d2d2b'; c.beginPath(); c.moveTo(x, T); c.lineTo(x, H - 22); c.stroke(); }
  c.textAlign = 'left';
  if (hoverIdx >= 0) {
    const x = X(N.times[hoverIdx]); c.strokeStyle = '#c3c2b7'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, T); c.lineTo(x, H - 22); c.stroke();
    for (const P of panels) for (const s of N.series) { const y = P.Y(s[P.key][hoverIdx]); c.fillStyle = SCEN_COLORS[s.i]; c.strokeStyle = '#1a1a19'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 4, 0, TWO_PI); c.fill(); c.stroke(); }
  }
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
chart.addEventListener('mousemove', ev => {
  const N = state.night; if (!N || !chartGeom) return;
  const r = chart.getBoundingClientRect(), x = ev.clientX - r.left;
  let best = 0, bd = 1e9; N.times.forEach((t, j) => { const d = Math.abs(chartGeom.X(t) - x); if (d < bd) { bd = d; best = j; } });
  drawChart(best);
  const off = chileOffsetH(N.times[best]) * 3600000;
  tip.innerHTML = `<b>${new Date(N.times[best] + off).toISOString().slice(11, 16)}</b> Chile · Sol ${nf(N.sun[best], 1)}°<br>` +
    N.series.map(s => `<span class="sw" style="background:${SCEN_COLORS[s.i]}"></span>${SCEN_NAMES[s.i]}: ${nf(s.lit[best])} ilum. >30° · ${nf(s.mean[best], 2)} trazas · ${nf(s.pAny[best] * 100, 0)} % afectadas`).join('<br>');
  tip.style.display = 'block';
  const tx = Math.min(x + 14, r.width - tip.offsetWidth - 4); tip.style.left = tx + 'px'; tip.style.top = '30px';
});
chart.addEventListener('mouseleave', () => { tip.style.display = 'none'; if (state.night) drawChart(); });
function fillNightTable() {
  const N = state.night; if (!N) return;
  const off = chileOffsetH(N.times[0]) * 3600000;
  let h = '<table><tr><th>Hora Chile</th><th>Sol (°)</th>' + N.series.map(s => `<th>${SCEN_NAMES[s.i]}: ilum. >30°</th><th>trazas/exp.</th><th>% afect.</th>`).join('') + '</tr>';
  N.times.forEach((t, j) => { h += `<tr><td>${new Date(t + off).toISOString().slice(11, 16)}</td><td class="num">${nf(N.sun[j], 1)}</td>` + N.series.map(s => `<td class="num">${nf(s.lit[j])}</td><td class="num">${nf(s.mean[j], 2)}</td><td class="num">${nf(s.pAny[j] * 100, 0)}</td>`).join('') + '</tr>'; });
  $('nightTable').innerHTML = h + '</table>';
}

// --------------------------------------------------------------- fuentes y supuestos
function fillSources() {
  const rows = JSON.parse($('fuentes').textContent);
  let h = '<div class="muted">Tabla de la Fase 1 (detalle en FASE1_FASE2.md). Estado: CONFIRMADO = fuente primaria leída · SECUNDARIA = cita fiable de la primaria · DERIVADO = calculado · SUPUESTO = no público, editable · NO PÚBLICO · MODELO = aproximación del simulador.</div>';
  h += '<table><tr><th>#</th><th>Parámetro</th><th>Valor usado</th><th>Estado</th><th>Fuente / justificación</th></tr>';
  for (const r of rows) {
    const b = r.estado.startsWith('NO') ? 'NO' : r.estado;
    h += `<tr><td>${r.id}</td><td>${r.p}</td><td>${r.v}</td><td><span class="badge b-${b}">${r.estado}</span></td><td>${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${r.f}</a>` : r.f}</td></tr>`;
  }
  $('tSrc').innerHTML = h + '</table>';
}

// --------------------------------------------------------------- editor de capas
const COLS = [['off', 'activo', 'chk'], ['nombre', 'nombre', 'txt'], ['hIni', 'h ini (km)', 'num'], ['hFin', 'h fin', 'num'], ['nSub', 'subcapas', 'num'], ['iIni', 'i ini (°)', 'num'], ['iFin', 'i fin', 'num'],
  ['N', 'N total', 'num'], ['planes', 'planos/subcapa', 'num'], ['modo', 'modo', 'sel'], ['ltans', 'LTAN (h) o RAAN (°)', 'txt']];
function layerTable(groups, id) {
  let h = '<table><tr>' + COLS.map(c => `<th>${c[1]}</th>`).join('') + '<th>sat/plano</th></tr>';
  groups.forEach((g, gi) => {
    h += '<tr>' + COLS.map(([k, , t]) => {
      if (t === 'chk') return `<td><input type="checkbox" data-g="${id}" data-i="${gi}" data-k="off" ${g.off ? '' : 'checked'}></td>`;
      if (t === 'sel') return `<td><select data-g="${id}" data-i="${gi}" data-k="modo">${['incl', 'sso', 'fijo'].map(m => `<option ${g.modo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></td>`;
      if (t === 'txt') return `<td><input type="text" data-g="${id}" data-i="${gi}" data-k="${k}" value="${g[k]}" ${k === 'nombre' ? 'style="width:200px"' : ''}></td>`;
      return `<td><input type="number" step="any" data-g="${id}" data-i="${gi}" data-k="${k}" value="${g[k]}"></td>`;
    }).join('') + `<td class="num">${nf(Math.max(1, Math.round(g.N / g.nSub / g.planes)))}</td></tr>`;
  });
  return h + '</table>';
}
let editS = null, editG = null;
function openLayers() { editS = clone(state.groupsStarmind); editG = clone(state.groupsGen2); renderLayers(); $('dlgLayers').showModal(); }
function renderLayers() {
  $('layStarmind').innerHTML = layerTable(editS, 'S'); $('layGen2').innerHTML = layerTable(editG, 'G');
  const tot = gs => gs.filter(g => !g.off).reduce((a, g) => a + g.nSub * g.planes * Math.max(1, Math.round(g.N / g.nSub / g.planes)), 0);
  $('layTot').textContent = `Total Starmind: ${nf(tot(editS))} · Gen2: ${nf(tot(editG))}`;
  document.querySelectorAll('#dlgLayers [data-g]').forEach(el => el.addEventListener('change', () => {
    const arr = el.dataset.g === 'S' ? editS : editG, g = arr[+el.dataset.i], k = el.dataset.k;
    if (k === 'off') g.off = !el.checked; else if (el.type === 'number') g[k] = parseFloat(el.value); else g[k] = el.value;
    renderLayers();
  }));
}
$('layApply').onclick = () => { state.groupsStarmind = editS; state.groupsGen2 = editG; state.starmindPreset = 'editado'; buildSynthetic(); $('dlgLayers').close(); statusLast = 0; };
$('layReset').onclick = () => { editS = clone(DEFAULT_STARMIND); editG = clone(DEFAULT_GEN2); renderLayers(); state.starmindPreset = 'FCC'; };
$('layJangid').onclick = () => { editS = clone(JANGID_STARMIND); renderLayers(); };
$('layClose').onclick = () => $('dlgLayers').close();

// --------------------------------------------------------------- diagnóstico (incluye GPU y fps)
function gpuProbeTest() {
  updateUniforms();
  const N = 2000, rng = mulberry32(31), idx = [];
  for (let q = 0; q < N; q++) idx.push(Math.floor(rng() * SYN.n));
  const g = new THREE.BufferGeometry(), o = new Float32Array(4 * N), r = new Float32Array(4 * N), m = new Float32Array(2 * N), id = new Float32Array(N);
  idx.forEach((k, q) => { o.set(SYN.orb.subarray(4 * k, 4 * k + 4), 4 * q); r.set(SYN.rate.subarray(4 * k, 4 * k + 4), 4 * q); m.set(SYN.misc.subarray(2 * k, 2 * k + 2), 2 * q); id[q] = q; });
  g.setAttribute('aOrb', new THREE.BufferAttribute(o, 4)); g.setAttribute('aRate', new THREE.BufferAttribute(r, 4)); g.setAttribute('aMisc', new THREE.BufferAttribute(m, 2)); g.setAttribute('aIdx', new THREE.BufferAttribute(id, 1));
  g.setDrawRange(0, N); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const pts = new THREE.Points(g, matProbe); pts.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(pts);
  const rt = new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  U.uProbeW.value = N;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, camSky);
  const buf = new Float32Array(4 * N); renderer.readRenderTargetPixels(rt, 0, 0, N, 1, buf); renderer.setRenderTarget(null);
  rt.dispose(); g.dispose();
  synSrc.begin(); const pos = [0, 0, 0]; let maxSep = 0, litMis = 0, litEdge = 0, written = 0, worstAlt = 0, rgErr = 0;
  idx.forEach((k, q) => {
    synSrc.pos(k, state.simMs, F, pos);
    const d = [pos[0] - F.obs[0], pos[1] - F.obs[1], pos[2] - F.obs[2]], rg = Math.hypot(...d), u = [d[0] / rg, d[1] / rg, d[2] / rg];
    const f = litFactor(pos[0], pos[1], pos[2], F.sun, state.conical);
    const c = [dot(u, F.E), dot(u, F.N), dot(u, F.U)], gv = norm3([buf[4 * q], buf[4 * q + 1], buf[4 * q + 2]]), gr = buf[4 * q + 3], gf = gr > 0 ? 1 : 0;
    if (Math.abs(gr) > 0) written++;
    const x = cross(c, gv), sep = Math.atan2(Math.hypot(...x), dot(c, gv)) * RAD;
    if (sep > maxSep) { maxSep = sep; worstAlt = Math.asin(c[2]) * RAD; }
    rgErr = Math.max(rgErr, Math.abs(Math.abs(gr) - rg));
    if ((gf > 0) !== (f > 0)) { const p = dot(pos, F.sun), dperp = Math.sqrt(dot(pos, pos) - p * p); if (Math.abs(dperp - RE) < 2) litEdge++; else litMis++; }
  });
  return { id: 'T5', nombre: `GPU = CPU: ${N} satélites renderizados a textura float (shader) vs CPU float64`, obtenido: `máx. Δ dirección = ${nf(maxSep, 5)}° (en alt ${nf(worstAlt, 1)}°) · máx. Δρ = ${nf(rgErr, 3)} km · iluminación distinta: ${litMis} (+${litEdge} a <2 km del borde) · escritos ${written}/${N}`,
    esperado: 'Δ < 0,01° · 0 discrepancias', tol: '0,01°', estado: (maxSep < 0.01 && litMis === 0 && written === N) ? 'PASA' : 'FALLA', nota: 'Mismos elementos float32 en GPU y CPU; compara la dirección topocéntrica completa (no alt/az, que en float32 pierde precisión cerca de ±90°).' };
}
function measureFPS(ms) {
  return new Promise(res => {
    const saved = { on: [...state.on], deploy: state.deploy, playing: state.playing };
    state.on = [true, true, true]; state.deploy = 1; state.playing = true; state.measuring = true; syncInputs();
    const t0 = performance.now(), n0 = frameTimes.length;
    setTimeout(() => {
      const ts = frameTimes.filter(t => t >= t0 + 300); const fps = ts.length > 1 ? (ts.length - 1) * 1000 / (ts[ts.length - 1] - ts[0]) : 0;
      Object.assign(state, saved); state.measuring = false; syncInputs();
      res(fps);
    }, ms);
  });
}
async function runDiagnostics() {
  const out = [], prog = $('diagProg'), tick = msg => { prog.textContent = msg; return new Promise(r => setTimeout(r, 30)); };
  await tick('T1–T4, T6 (núcleo, ~10 s)…');
  out.push(...runCoreTests({ satlib: satellite, quick: params.has('quick') }));
  await tick('T4c: Starmind por defecto (1M) vs predicción en Python…');
  const Sdef = buildSynth(expandGroups(DEFAULT_STARMIND, 2), 12345), tRefD = Date.UTC(2026, 10, 27, 0, 0);
  const srcD = synthSource(Sdef, () => ({ tRef: tRefD, deploy: 1, on: [false, false, true, false], M: [0, M_GEN2, BRILLO.central] }));
  out.push(...runContextTests([srcD], srcD, { nPoint: 300 }));
  await tick('T5: GPU vs CPU…');
  try { out.push(gpuProbeTest()); } catch (e) { out.push({ id: 'T5', nombre: 'GPU = CPU', obtenido: 'error: ' + e.message, esperado: '', tol: '', estado: 'FALLA', nota: '' }); }
  await tick('T7: midiendo fps con todos los escenarios (3 s)…');
  const fps = await measureFPS(3300);
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info'), gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'desconocida';
  out.push({ id: 'T7', nombre: `Rendimiento con ${nf(SYN.n + TLE.recs.length)} satélites (vista global + cielo)`, obtenido: `${nf(fps, 1)} fps`, esperado: '≥ 30 fps', tol: '—', estado: fps >= 30 ? 'PASA' : 'FALLA', nota: `GPU: ${gpu}` });
  const np = out.filter(r => r.estado === 'PASA').length, nfail = out.filter(r => r.estado === 'FALLA').length;
  prog.textContent = `${np} pasan · ${nfail} fallan · ${out.length - np - nfail} informativas`;
  $('diagOut').innerHTML = '<table><tr><th>#</th><th>Prueba</th><th>Obtenido</th><th>Esperado</th><th>Tolerancia</th><th>Estado</th><th>Nota</th></tr>' +
    out.map(r => `<tr><td>${r.id}</td><td>${r.nombre}</td><td class="num">${r.obtenido}</td><td class="num">${r.esperado}</td><td>${r.tol}</td><td><span class="badge b-${r.estado}">${r.estado}</span></td><td class="muted">${r.nota || ''}</td></tr>`).join('') + '</table>';
  $('diag-json').textContent = JSON.stringify({ fecha: new Date().toISOString(), gpu, resultados: out });
  window.__diag = out; document.title = `Starmind × Rubin · diag ${np}/${out.length}`;
}

// --------------------------------------------------------------- controles
function setTime(ms) { state.simMs = ms; statusLast = 0; }
function syncInputs() {
  ['onS0', 'onS1', 'onS2'].forEach((id, i) => $(id).checked = state.on[i]);
  $('deploy').value = Math.round(state.deploy * 100); $('deployLab').textContent = `${Math.round(state.deploy * 100)} %`;
  $('bPlay').textContent = state.playing ? '⏸ Pausa' : '▶ Reproducir';
}
$('bPlay').onclick = () => { state.playing = !state.playing; syncInputs(); };
$('speed').onchange = e => state.speed = +e.target.value;
$('bM10').onclick = () => setTime(state.simMs - 600000); $('bP10').onclick = () => setTime(state.simMs + 600000);
$('bNow').onclick = () => setTime(Date.now());
$('bTwi').onclick = () => { const t = astroTwilightEnd(state.simMs); if (t) setTime(t); };
$('bMid').onclick = () => setTime(solarMidnight(state.simMs).ms);
$('bSol').onclick = () => { let y = new Date(state.simMs).getUTCFullYear(); if (state.simMs > Date.UTC(y, 5, 25)) y++; setTime(solarMidnight(Date.UTC(y, 5, 21, 20)).ms); };
$('tLocal').onchange = e => {
  const v = e.target.value; if (!v) return; const [d, t] = v.split('T'), [Y, Mo, D] = d.split('-').map(Number), [h, mi] = t.split(':').map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h, mi); setTime(guess - chileOffsetH(guess) * 3600000);
};
['onS0', 'onS1', 'onS2'].forEach((id, i) => $(id).onchange = e => { state.on[i] = e.target.checked; statusLast = 0; if (i === 0) updateTLEPositions(true); });
$('deploy').oninput = e => { state.deploy = e.target.value / 100; $('deployLab').textContent = `${e.target.value} %`; statusLast = 0; };
$('brillo').onchange = e => { const v = e.target.value; $('Mcustom').style.display = v === 'custom' ? '' : 'none'; state.Mstar = v === 'custom' ? +$('Mcustom').value : BRILLO[v]; };
$('Mcustom').onchange = e => state.Mstar = +e.target.value;
$('phase').onchange = e => state.phaseOn = e.target.checked;
$('shadow').onchange = e => { state.conical = e.target.value === '1'; statusLast = 0; };
$('godShadow').onchange = e => state.godShadow = e.target.checked;
$('skyShadow').onchange = e => state.skyShadow = e.target.checked;
$('magLim').oninput = e => { state.magLim = +e.target.value; $('magLimLab').textContent = e.target.value; };
$('coneX').onchange = e => state.coneX = e.target.checked;
$('bCam').onclick = () => { const o = eci2three(F.obs); camGod.position.copy(o.clone().multiplyScalar(2.2)); controls.target.set(0, 0, 0); };
$('bPointAA').onclick = () => { state.alt = Math.max(15, Math.min(90, +$('pAlt').value)); state.az = mod(+$('pAz').value, 360); statusLast = 0; };
$('bPointRD').onclick = () => { const v = radecToECI(F.jd, +$('pRA').value, +$('pDec').value), aa = eciToAltAz(F, v);
  if (aa.alt < 15) { $('skyInfo').textContent = `Ese objeto está a alt ${nf(aa.alt, 1)}° (< 15°, límite del telescopio).`; return; }
  state.alt = aa.alt; state.az = aa.az; $('pAlt').value = aa.alt.toFixed(1); $('pAz').value = aa.az.toFixed(1); statusLast = 0; };
$('band').onchange = e => state.band = e.target.value;
$('expMode').onchange = e => state.twoSnaps = e.target.value === '2';
$('bExpose').onclick = () => { $('expOut').textContent = 'Calculando…'; setTimeout(runExposure, 20); };
$('bStats').onclick = () => { $('statOut').textContent = 'Calculando…'; setTimeout(runStats, 20); };
$('bLayers').onclick = openLayers;
$('bNight').onclick = () => computeNight();
$('logY').onchange = () => drawChart();
$('bTable').onclick = () => { const t = $('nightTable'); t.style.display = t.style.display === 'none' ? '' : 'none'; $('bTable').textContent = t.style.display === 'none' ? 'Ver tabla' : 'Ocultar tabla'; };
$('bDiag').onclick = () => runDiagnostics();
$('bTle').onclick = async () => {
  $('tleInfo').textContent = 'Descargando de CelesTrak…';
  try {
    const r = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle');
    const txt = await r.text();
    if (!r.ok || !txt.includes('\n1 ')) throw new Error(txt.slice(0, 160));
    setTLE(parseTLE(txt), 'CelesTrak en vivo'); updateTLEPositions(true);
  } catch (e) { $('tleInfo').textContent = `CelesTrak no entregó datos (${e.message.trim()}). Se mantiene el snapshot del 26-nov-2026.`; }
};
document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabbar button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tabbody').forEach(x => x.classList.toggle('on', x.id === b.dataset.tab));
  if (b.dataset.tab === 'tNight') drawChart();
});
window.addEventListener('resize', () => drawChart());

// --------------------------------------------------------------- inicio
setTLE(parseTLE($('tle-snapshot').textContent), 'Snapshot CelesTrak 26-nov-2026');
state.simMs = params.has('t') ? Date.parse(params.get('t')) : (astroTwilightEnd(Date.now()) || Date.now());
buildSynthetic();
fillSources(); syncInputs(); drawChart(); drawCCD({ trails: [], band: state.band, twoSnaps: false });
updateUniforms(); updateTLEPositions(true);
{ const o = eci2three(F.obs); camGod.position.copy(o.clone().normalize().multiplyScalar(26).add(new THREE.Vector3(0, 6, 0))); }
requestAnimationFrame(loop);
if (params.has('diag')) setTimeout(runDiagnostics, 800);
if (params.has('fps')) setTimeout(async () => { const fps = await measureFPS(5000); const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__fps = { fps, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?' }; document.title = 'fps ' + fps.toFixed(1); }, 2500);
