// ============================================================================
// NÚCLEO DE CÁLCULO (sin dependencias de interfaz). Unidades: km, s, rad.
// Mismas fórmulas que referencia/reference.py y que el vertex shader.
// ============================================================================
export const DEG = Math.PI / 180, RAD = 180 / Math.PI, TWO_PI = 2 * Math.PI;
export const MU = 398600.4418, RE = 6378.137, J2 = 1.08262668e-3, F_WGS = 1 / 298.257223563;
// Semiángulos de umbra/penumbra: asin((R☉ ∓ R⊕)/1 UA). Distancia Tierra-Sol fija (±1,7 %).
export const TAN_AU = 0.0046098, TAN_AP = 0.0046950;
export const RUBIN = { lat: -30.2446, lon: -70.7494, h: 2.663 };
export const PHASE_REF = 8.03; // Φ(90°) de la función de fase V2 Mini (Mallama et al. 2023)

export const mod = (x, m) => ((x % m) + m) % m;
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- tiempo, Sol
export const jdFromMs = ms => ms / 86400000 + 2440587.5;
export function gmst(jd) { // IAU 1982
  const T = (jd - 2451545.0) / 36525;
  const s = 67310.54841 + (876600 * 3600 + 8640184.812866) * T + 0.093104 * T * T - 6.2e-6 * T * T * T;
  return mod(s, 86400) / 240 * DEG;
}
export function sunECI(jd) { // Astronomical Almanac, baja precisión (~0,01°)
  const n = jd - 2451545.0;
  const L = mod(280.460 + 0.9856474 * n, 360), g = mod(357.528 + 0.9856003 * n, 360) * DEG;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG, eps = (23.439 - 4e-7 * n) * DEG;
  const s = [Math.cos(lam), Math.cos(eps) * Math.sin(lam), Math.sin(eps) * Math.sin(lam)];
  return { s, ra: Math.atan2(s[1], s[0]), dec: Math.asin(s[2]) };
}

// ------------------------------------------------------------ observador y marcos
export function obsECEF(site) {
  const e2 = F_WGS * (2 - F_WGS), la = site.lat * DEG, lo = site.lon * DEG;
  const N = RE / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  return [(N + site.h) * Math.cos(la) * Math.cos(lo), (N + site.h) * Math.cos(la) * Math.sin(lo), (N * (1 - e2) + site.h) * Math.sin(la)];
}
export function enuECEF(site) {
  const la = site.lat * DEG, lo = site.lon * DEG;
  return { E: [-Math.sin(lo), Math.cos(lo), 0],
    N: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
    U: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)] };
}
const _siteCache = new Map();
/** Todo lo que depende solo del instante: GMST, Sol, observador y base ENU en ECI. */
export function frameAt(ms, site = RUBIN) {
  const key = site.lat + ',' + site.lon + ',' + site.h;
  let sc = _siteCache.get(key); if (!sc) { sc = { o: obsECEF(site), b: enuECEF(site) }; _siteCache.set(key, sc); }
  const jd = jdFromMs(ms), th = gmst(jd), c = Math.cos(th), s = Math.sin(th);
  const rot = v => [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
  const sun = sunECI(jd);
  return { ms, jd, theta: th, sun: sun.s, sunRA: sun.ra, sunDec: sun.dec,
    obs: rot(sc.o), E: rot(sc.b.E), N: rot(sc.b.N), U: rot(sc.b.U) };
}
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const sunAlt = (ms, site = RUBIN) => { const F = frameAt(ms, site); return Math.asin(dot(F.sun, F.U)) * RAD; };
export function enuToECI(F, e, n, u) { return [e * F.E[0] + n * F.N[0] + u * F.U[0], e * F.E[1] + n * F.N[1] + u * F.U[1], e * F.E[2] + n * F.N[2] + u * F.U[2]]; }
export function altAzToECI(F, altDeg, azDeg) {
  const a = altDeg * DEG, z = azDeg * DEG;
  return enuToECI(F, Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a));
}
export function eciToAltAz(F, v) {
  const e = dot(v, F.E), n = dot(v, F.N), u = dot(v, F.U);
  return { alt: Math.asin(Math.max(-1, Math.min(1, u))) * RAD, az: mod(Math.atan2(e, n) * RAD, 360) };
}
// Precesión IAU 1976 (J2000 → equinoccio de la fecha); TEME≈fecha para este uso (<0,01°).
export function precessJ2000ToDate(jd, v) {
  const T = (jd - 2451545) / 36525, as = DEG / 3600;
  const z0 = (2306.2181 * T + 0.30188 * T * T) * as, z = (2306.2181 * T + 1.09468 * T * T) * as, th = (2004.3109 * T - 0.42665 * T * T) * as;
  const cz0 = Math.cos(z0), sz0 = Math.sin(z0), cz = Math.cos(z), sz = Math.sin(z), ct = Math.cos(th), st = Math.sin(th);
  const P = [[cz0 * ct * cz - sz0 * sz, -sz0 * ct * cz - cz0 * sz, -st * cz],
    [cz0 * ct * sz + sz0 * cz, -sz0 * ct * sz + cz0 * cz, -st * sz], [cz0 * st, -sz0 * st, ct]];
  return [dot(P[0], v), dot(P[1], v), dot(P[2], v)];
}
export function radecToECI(jd, raDeg, decDeg) {
  const r = raDeg * DEG, d = decDeg * DEG;
  return precessJ2000ToDate(jd, [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)]);
}
export function eciToRadecJ2000(jd, v) { // inversa (transpuesta) de la precesión
  const T = (jd - 2451545) / 36525, as = DEG / 3600;
  const z0 = (2306.2181 * T + 0.30188 * T * T) * as, z = (2306.2181 * T + 1.09468 * T * T) * as, th = (2004.3109 * T - 0.42665 * T * T) * as;
  const cz0 = Math.cos(z0), sz0 = Math.sin(z0), cz = Math.cos(z), sz = Math.sin(z), ct = Math.cos(th), st = Math.sin(th);
  const P = [[cz0 * ct * cz - sz0 * sz, -sz0 * ct * cz - cz0 * sz, -st * cz],
    [cz0 * ct * sz + sz0 * cz, -sz0 * ct * sz + cz0 * cz, -st * sz], [cz0 * st, -sz0 * st, ct]];
  const w = [P[0][0] * v[0] + P[1][0] * v[1] + P[2][0] * v[2], P[0][1] * v[0] + P[1][1] * v[1] + P[2][1] * v[2], P[0][2] * v[0] + P[1][2] * v[1] + P[2][2] * v[2]];
  return { ra: mod(Math.atan2(w[1], w[0]) * RAD, 360), dec: Math.asin(Math.max(-1, Math.min(1, w[2]))) * RAD };
}

// ---------------------------------------------------------------- sombra, brillo
/** Fracción del disco solar visible: cilíndrica (0/1) o cónica (umbra 0, penumbra lineal). */
export function litFactor(x, y, z, s, conical) {
  const p = x * s[0] + y * s[1] + z * s[2];
  if (p > 0) return 1;
  const d2 = x * x + y * y + z * z - p * p;
  if (!conical) return d2 > RE * RE ? 1 : 0;
  const xx = -p, d = Math.sqrt(Math.max(d2, 0)), ru = RE - xx * TAN_AU, rp = RE + xx * TAN_AP;
  if (d >= rp) return 1; if (d <= ru) return 0; return (d - ru) / (rp - ru);
}
export function phasePoly(phDeg) { return 2.630 + 0.1065 * phDeg - 0.0005167 * phDeg * phDeg; }
/** m_V = M1000 + 5 log10(ρ/1000) [+ Φ(φ) − Φ(90°)] − 2,5 log10(f_penumbra) */
export function magnitude(M, rg, f, cosPh, phaseOn) {
  let m = M + 5 * Math.log10(rg / 1000) - 2.5 * Math.log10(Math.max(f, 1e-3));
  if (phaseOn) { const ph = Math.acos(Math.max(-1, Math.min(1, cosPh))) * RAD; m += phasePoly(ph) - PHASE_REF; }
  return m;
}
export function capFraction(h, eminDeg) {
  const e = eminDeg * DEG, lam = Math.acos(RE * Math.cos(e) / (RE + h)) - e;
  return (1 - Math.cos(lam)) / 2;
}
export const shadowHeightZenith = Ddeg => RE * (1 / Math.cos(Ddeg * DEG) - 1);
export function ssoInclination(h) {
  const a = RE + h, n = Math.sqrt(MU / a ** 3), Od = TWO_PI / (365.2422 * 86400);
  return Math.acos(-Od / (1.5 * n * J2 * (RE / a) ** 2)) * RAD;
}
export function orbitRates(h, incDeg) {
  const a = RE + h, n = Math.sqrt(MU / a ** 3), k = J2 * (RE / a) ** 2, i = incDeg * DEG, s2 = Math.sin(i) ** 2;
  return { a, n, udot: n * (1 + 0.75 * k * (2 - 3 * s2)) + 0.75 * n * k * (4 - 5 * s2), Odot: -1.5 * n * k * Math.cos(i) };
}

// ------------------------------------------------- constelaciones sintéticas (datos)
// Grupos de la orden FCC DA 26-1273; subcapas y planos según McDowell (planet4589);
// N escalado ×0,83464 para respetar el tope de 1.000.000 (supuesto S7a).
// N por grupo = reparto proporcional de McDowell (×0,83464) ajustado para que, con satélites enteros por plano,
// el total sea 999.996 ≤ 1.000.000 (máximo autorizado, DA 26-1273). Cambio < 0,03 % por grupo.
export const DEFAULT_STARMIND = [
  { id: 'G1', nombre: 'G1 550–568 km · 26–32°', hIni: 550, hFin: 568, nSub: 10, iIni: 32.0, iFin: 26.0, N: 83400, planes: 30, modo: 'incl', ltans: '18,6' },
  { id: 'G2', nombre: 'G2 565–585 km · SSO 97,7°', hIni: 565, hFin: 585, nSub: 10, iIni: 97.7, iFin: 97.7, N: 83400, planes: 2, modo: 'sso', ltans: '18,6' },
  { id: 'G3', nombre: 'G3 686–718 km · 30°', hIni: 686, hFin: 718, nSub: 25, iIni: 30.0, iFin: 30.0, N: 208500, planes: 30, modo: 'incl', ltans: '18,6' },
  { id: 'G4', nombre: 'G4 707–744 km · SSO 97,2°', hIni: 707, hFin: 744, nSub: 22, iIni: 97.2, iFin: 97.2, N: 204336, planes: 2, modo: 'sso', ltans: '18,6' },
  { id: 'G5', nombre: 'G5 946–978 km · 30°', hIni: 946, hFin: 978, nSub: 25, iIni: 30.0, iFin: 30.0, N: 208500, planes: 30, modo: 'incl', ltans: '18,6' },
  { id: 'G6', nombre: 'G6 967–1002 km · SSO 99,4°', hIni: 967, hFin: 1002, nSub: 22, iIni: 99.4, iFin: 99.4, N: 211860, planes: 2, modo: 'sso', ltans: '18,6' },
];
// Preset que imita Jangid et al. 2026 (Step1.py): 4 regímenes, SSO en 1 plano con RAAN fija = 0°.
export const JANGID_STARMIND = [
  { id: 'J1', nombre: 'LEO-30 686–718 km', hIni: 686, hFin: 718, nSub: 25, iIni: 30.5, iFin: 29.3, N: 249750, planes: 30, modo: 'incl', ltans: '18' },
  { id: 'J2', nombre: 'H-LEO-30 946–978 km', hIni: 946, hFin: 978, nSub: 25, iIni: 30.5, iFin: 29.4, N: 249750, planes: 30, modo: 'incl', ltans: '18' },
  { id: 'J3', nombre: 'SSO-97 707–744 km (RAAN fija 0°)', hIni: 707, hFin: 744, nSub: 22, iIni: 97.1, iFin: 98.2, N: 244882, planes: 1, modo: 'fijo', ltans: '0' },
  { id: 'J4', nombre: 'SSO-99 967–1002 km (RAAN fija 0°)', hIni: 967, hFin: 1002, nSub: 22, iIni: 99.4, iFin: 99.5, N: 253858, planes: 1, modo: 'fijo', ltans: '0' },
];
// Gen2 (FCC DA 26-36): capas confirmadas; N por capa supuesto (15.000 / 9).
export const DEFAULT_GEN2 = [
  [340, 53, 72], [345, 48, 72], [350, 38, 72], [355, 43, 72], [360, 96.9, 36], [365, 32, 72], [475, 32, 56], [480, 53, 56], [485, 43, 56],
].map(([h, i, p], k) => ({ id: 'S' + (k + 1), nombre: `${h} km · ${String(i).replace('.', ',')}°`, hIni: h, hFin: h, nSub: 1, iIni: i, iFin: i, N: 1667, planes: p, modo: 'incl', ltans: '18' }));

export const BRILLO = { optimista: 6.0, central: 5.7, pesimista: 2.7 };
export const M_GEN2 = 7.87; // V2 Mini en mitigación (Mallama et al. 2023); el brillo de V3 no es público

/** Expande grupos editables a subcapas. modo: 'incl' (RAAN equiespaciada) | 'sso' (RAAN = α☉ + 15°(LTAN−12)) | 'fijo' (RAAN fija = primer valor de ltans, en grados). */
export function expandGroups(groups, scen) {
  const out = [];
  groups.forEach((g, gi) => {
    if (g.off) return;
    const lts = String(g.ltans).split(/[;, ]+/).filter(Boolean).map(Number);
    for (let s = 0; s < g.nSub; s++) {
      const f = g.nSub > 1 ? s / (g.nSub - 1) : 0;
      const nsub = g.N / g.nSub, spp = Math.max(1, Math.round(nsub / g.planes));
      out.push({ h: g.hIni + (g.hFin - g.hIni) * f, i: g.iIni + (g.iFin - g.iIni) * f, planes: g.planes, spp,
        modo: g.modo, ltans: lts.length ? lts : [18], scen, group: gi });
    }
  });
  return out;
}

/** Arreglos Float32 compartidos por CPU y GPU.
 *  orb = (a, i, Ω0, u0) · rate = (u̇, Ω̇, ΔΩ_LTAN, amarrada_al_Sol) · misc = (escenario, rango_despliegue) */
export function buildSynth(subshells, seed = 12345) {
  const rng = mulberry32(seed);
  let n = 0; for (const s of subshells) n += s.planes * s.spp;
  const orb = new Float32Array(4 * n), rate = new Float32Array(4 * n), misc = new Float32Array(2 * n), group = new Uint16Array(n);
  let k = 0;
  for (const s of subshells) {
    const R = orbitRates(s.h, s.i);
    for (let p = 0; p < s.planes; p++) {
      const off = rng() * TWO_PI / s.spp;
      let raan0 = 0, sun = 0, dO = 0;
      if (s.modo === 'sso') { sun = 1; dO = (s.ltans[p % s.ltans.length] - 12) * 15 * DEG; }
      else if (s.modo === 'fijo') raan0 = mod(s.ltans[0] * DEG, TWO_PI);
      else raan0 = TWO_PI * p / s.planes;
      for (let j = 0; j < s.spp; j++, k++) {
        orb[4 * k] = R.a; orb[4 * k + 1] = s.i * DEG; orb[4 * k + 2] = raan0; orb[4 * k + 3] = mod(TWO_PI * j / s.spp + off, TWO_PI);
        rate[4 * k] = R.udot; rate[4 * k + 1] = R.Odot; rate[4 * k + 2] = dO; rate[4 * k + 3] = sun;
        misc[2 * k] = s.scen; misc[2 * k + 1] = s.scen === 2 ? rng() : 0; group[k] = s.group;
      }
    }
  }
  return { n, orb, rate, misc, group };
}
/** Reancla la época: u0 += u̇Δt (y Ω0 += Ω̇Δt si no está amarrada al Sol). Mantiene t_rel pequeño (float32). */
export function rebaseSynth(S, dt) {
  const { orb, rate } = S;
  for (let k = 0; k < S.n; k++) {
    const j = 4 * k;
    orb[j + 3] = mod(orb[j + 3] + rate[j] * dt, TWO_PI);
    if (rate[j + 3] < 0.5) orb[j + 2] = mod(orb[j + 2] + rate[j + 1] * dt, TWO_PI);
  }
}

// ------------------------------------------------------------------- fuentes
// Una "fuente" expone: n, on(k), pos(k, ms, F, out)→bool, M(k), name, scen
export function synthSource(S, st) { // st: () => {tRef, deploy, on:[s0,s1,s2], M:[m0,m1,m2], maxA?: km (solo Starmind)}
  return {
    name: 'synth', S, n: S.n,
    begin() { this._s = st(); },
    on(k) { const sc = S.misc[2 * k]; const s = this._s; return s.on[sc] && (sc !== 2 || (S.misc[2 * k + 1] <= s.deploy && S.orb[4 * k] <= (s.maxA ?? Infinity))); },
    scen(k) { return S.misc[2 * k]; },
    M(k) { return this._s.M[S.misc[2 * k]]; },
    pos(k, ms, F, out) {
      const o = S.orb, r = S.rate, j = 4 * k, t = (ms - this._s.tRef) / 1000;
      const a = o[j], inc = o[j + 1], u = o[j + 3] + r[j] * t;
      const raan = r[j + 3] > 0.5 ? F.sunRA + r[j + 2] : o[j + 2] + r[j + 1] * t;
      const cO = Math.cos(raan), sO = Math.sin(raan), cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(inc), si = Math.sin(inc);
      out[0] = a * (cO * cu - sO * su * ci); out[1] = a * (sO * cu + cO * su * ci); out[2] = a * su * si;
      return true;
    },
  };
}
export function tleSource(recs, Ms, satlib, st) { // st: () => ({on:bool})
  return {
    name: 'tle', n: recs.length,
    begin() { this._on = st().on; this._cacheMs = NaN; },
    on() { return this._on; }, scen() { return 0; }, M(k) { return Ms[k]; },
    pos(k, ms, F, out) {
      const pv = satlib.propagate(recs[k], new Date(ms));
      if (!pv || !pv.position || recs[k].error) return false;
      out[0] = pv.position.x; out[1] = pv.position.y; out[2] = pv.position.z; return true;
    },
  };
}
export function pointsSource(arr) { // posiciones ECI fijas (pruebas)
  return { name: 'pts', n: arr.length / 3, begin() {}, on: () => true, scen: () => 3, M: () => 5,
    pos(k, ms, F, out) { out[0] = arr[3 * k]; out[1] = arr[3 * k + 1]; out[2] = arr[3 * k + 2]; return true; } };
}

// ----------------------------------------------------------------- conteos
export function countVisible(src, F, eminDeg, conical) {
  src.begin(); const r = [0, 0, 0], se = Math.sin(eminDeg * DEG);
  let above = 0, aboveE = 0, lit = 0, litE = 0;
  for (let k = 0; k < src.n; k++) {
    if (!src.on(k) || !src.pos(k, F.ms, F, r)) continue;
    const dx = r[0] - F.obs[0], dy = r[1] - F.obs[1], dz = r[2] - F.obs[2];
    const sa = (dx * F.U[0] + dy * F.U[1] + dz * F.U[2]) / Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (sa <= 0) continue;
    const L = litFactor(r[0], r[1], r[2], F.sun, conical) > 0;
    above++; if (L) lit++; if (sa > se) { aboveE++; if (L) litE++; }
  }
  return { above, aboveE, lit, litE };
}

export function countByScen(src, F, eminDeg, conical) {
  src.begin(); const r = [0, 0, 0], se = Math.sin(eminDeg * DEG), out = [0, 1, 2, 3].map(() => ({ above: 0, aboveE: 0, lit: 0, litE: 0 }));
  for (let k = 0; k < src.n; k++) {
    if (!src.on(k) || !src.pos(k, F.ms, F, r)) continue;
    const dx = r[0] - F.obs[0], dy = r[1] - F.obs[1], dz = r[2] - F.obs[2];
    const sa = (dx * F.U[0] + dy * F.U[1] + dz * F.U[2]) / Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (sa <= 0) continue;
    const L = litFactor(r[0], r[1], r[2], F.sun, conical) > 0, o = out[src.scen(k)];
    o.above++; if (L) o.lit++; if (sa > se) { o.aboveE++; if (L) o.litE++; }
  }
  return out;
}

// ----------------------------------------------------------------- exposiciones
export function exposureTimes(t0, texp, dt, twoSnaps) {
  const wins = twoSnaps ? [[0, 15], [17, 32]] : [[0, texp]], out = [];
  wins.forEach(([a, b], w) => { for (let t = a; t <= b + 1e-9; t += dt) out.push({ ms: t0 + t * 1000, w }); });
  return { samples: out, span: twoSnaps ? 32 : texp };
}
export function pointingBasis(p) {
  let e = cross([0, 0, 1], p); const l = Math.hypot(e[0], e[1], e[2]);
  e = l < 1e-8 ? [1, 0, 0] : [e[0] / l, e[1] / l, e[2] / l];
  return { p, e, n: cross(p, e) }; // e: este en el cielo, n: norte
}
/** Distancia mínima del origen al segmento (x1,y1)-(x2,y2). */
function segDist(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? -(x1 * dx + y1 * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(x1 + t * dx, y1 + t * dy);
}
/**
 * Exposición(es) con seguimiento sidéreo (apuntado fijo en ECI). Cuenta trazas cuyo recorrido muestreado
 * (segmentos rectos en el plano tangente) entra al círculo de radio rfov, y si opts.requireLit, iluminadas.
 * pointings: arreglo de vectores unitarios ECI. Devuelve por apuntado {trails:[...]}.
 */
export function simulateExposures(sources, t0, pointings, opts) {
  const o = Object.assign({ texp: 30, dt: 0.25, twoSnaps: false, rfov: 1.75, requireLit: true, conical: false, phaseOn: false, keepTracks: false, band: 'r' }, opts);
  const { samples, span } = exposureTimes(t0, o.texp, o.dt, o.twoSnaps);
  const frames = samples.map(s => frameAt(s.ms));
  const Fm = frameAt(t0 + span * 500);
  const rpre = Math.min(60, 0.95 * span / 2 + o.rfov + 1.5) * DEG, cpre = Math.cos(rpre), tanR = Math.tan(o.rfov * DEG), tanKeep = Math.tan(2.6 * DEG);
  const bases = pointings.map(pointingBasis);
  const res = pointings.map(() => ({ trails: [] }));
  const r = [0, 0, 0];
  const ns = samples.length;
  const X = new Float64Array(ns), Y = new Float64Array(ns), V = new Uint8Array(ns), Fl = new Float32Array(ns), Rg = new Float64Array(ns), Cp = new Float64Array(ns);
  const UX = new Float64Array(ns), UY = new Float64Array(ns), UZ = new Float64Array(ns);
  const Fs = frameAt(t0), Fe = frameAt(t0 + span * 1000), tanPre = Math.tan((o.rfov + (o.margin ?? 1.0)) * DEG);
  for (const src of sources) {
    src.begin();
    // Prefiltro: dirección al inicio, mitad y fin de la exposición; candidato si la poligonal S→M→E pasa a < rfov + margen.
    const n = src.n, U3 = [new Float32Array(3 * n), new Float32Array(3 * n), new Float32Array(3 * n)], ok = new Uint8Array(n); // ok: 1 = mitad, 2 = + extremos, 3 = falló
    const put = (q, k, Fx) => { if (!src.pos(k, Fx.ms, Fx, r)) return false;
      const dx = r[0] - Fx.obs[0], dy = r[1] - Fx.obs[1], dz = r[2] - Fx.obs[2], l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      U3[q][3 * k] = dx / l; U3[q][3 * k + 1] = dy / l; U3[q][3 * k + 2] = dz / l; return true; };
    // Solo pueden aportar satélites que a mitad de exposición estén sobre (alt mínima de los apuntados − radio del prefiltro).
    let altMin = 90; for (const p of pointings) altMin = Math.min(altMin, Math.asin(Math.max(-1, Math.min(1, dot(p, Fm.U)))) * RAD);
    const sThr = Math.sin(Math.max(-90, altMin - rpre * RAD) * DEG), list = [];
    for (let k = 0; k < n; k++) if (src.on(k) && put(1, k, Fm) && U3[1][3 * k] * Fm.U[0] + U3[1][3 * k + 1] * Fm.U[1] + U3[1][3 * k + 2] * Fm.U[2] > sThr) { ok[k] = 1; list.push(k); }
    const mid = U3[1];
    for (let pi = 0; pi < pointings.length; pi++) {
      const B = bases[pi], p = B.p;
      for (const k of list) {
        if (ok[k] === 3 || mid[3 * k] * p[0] + mid[3 * k + 1] * p[1] + mid[3 * k + 2] * p[2] < cpre) continue;
        if (ok[k] === 1) ok[k] = (put(0, k, Fs) && put(2, k, Fe)) ? 2 : 3;
        if (ok[k] === 3) continue;
        const P = [0, 1, 2].map(q => { const a = U3[q], j = 3 * k, g = a[j] * p[0] + a[j + 1] * p[1] + a[j + 2] * p[2];
          return g > 0.2 ? [(a[j] * B.e[0] + a[j + 1] * B.e[1] + a[j + 2] * B.e[2]) / g, (a[j] * B.n[0] + a[j + 1] * B.n[1] + a[j + 2] * B.n[2]) / g] : null; });
        let near = false;
        for (let q = 0; q < 2 && !near; q++) {
          if (P[q] && P[q + 1]) near = segDist(P[q][0], P[q][1], P[q + 1][0], P[q + 1][1]) < tanPre;
          else if (P[q] || P[q + 1]) near = true; // un extremo detrás del plano tangente: no descartar
        }
        if (!near) continue;
        let good = true;
        for (let j = 0; j < ns; j++) {
          const F = frames[j];
          if (!src.pos(k, F.ms, F, r)) { good = false; break; }
          const dx = r[0] - F.obs[0], dy = r[1] - F.obs[1], dz = r[2] - F.obs[2], l = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const ux = dx / l, uy = dy / l, uz = dz / l, g = ux * p[0] + uy * p[1] + uz * p[2];
          UX[j] = ux; UY[j] = uy; UZ[j] = uz; Rg[j] = l;
          V[j] = g > 0.2 ? 1 : 0;
          X[j] = (ux * B.e[0] + uy * B.e[1] + uz * B.e[2]) / g; Y[j] = (ux * B.n[0] + uy * B.n[1] + uz * B.n[2]) / g;
          Fl[j] = litFactor(r[0], r[1], r[2], F.sun, o.conical);
          Cp[j] = -(ux * F.sun[0] + uy * F.sun[1] + uz * F.sun[2]);
        }
        if (!good) continue;
        let inside = false, litIn = false, mMin = Infinity, jMin = -1, dMin = Infinity, jClose = -1;
        for (let j = 0; j + 1 < ns; j++) {
          if (samples[j].w !== samples[j + 1].w || !V[j] || !V[j + 1]) continue;
          const d = segDist(X[j], Y[j], X[j + 1], Y[j + 1]);
          if (d < dMin) { dMin = d; jClose = j; }
          if (d < tanR) {
            inside = true;
            const lit = Fl[j] > 0 || Fl[j + 1] > 0;
            if (lit) {
              litIn = true;
              for (const jj of [j, j + 1]) if (Fl[jj] > 0) {
                const m = magnitude(src.M(k), Rg[jj], Fl[jj], Cp[jj], o.phaseOn);
                if (m < mMin) { mMin = m; jMin = jj; }
              }
            }
          }
        }
        if (!inside || (o.requireLit && !litIn)) continue;
        const jc = Math.min(Math.max(jClose, 0), ns - 2);
        const cosw = UX[jc] * UX[jc + 1] + UY[jc] * UY[jc + 1] + UZ[jc] * UZ[jc + 1];
        const omega = Math.acos(Math.min(1, cosw)) * RAD / ((samples[jc + 1].ms - samples[jc].ms) / 1000);
        const tr = { srcName: src.name, scen: src.scen(k), k, lit: litIn, mMin: isFinite(mMin) ? mMin : null,
          range: jMin >= 0 ? Rg[jMin] : Rg[jc], omega };
        if (o.keepTracks) {
          tr.track = [];
          for (let j = 0; j < ns; j++) if (V[j] && Math.hypot(X[j], Y[j]) < tanKeep) tr.track.push([X[j], Y[j], Fl[j], samples[j].w]);
        }
        res[pi].trails.push(tr);
      }
    }
  }
  return res;
}
export function randomPointings(F, n, eminDeg, rng) {
  const out = [], z0 = Math.sin(eminDeg * DEG);
  for (let i = 0; i < n; i++) {
    const z = z0 + (1 - z0) * rng(), az = TWO_PI * rng(), rr = Math.sqrt(1 - z * z);
    out.push(enuToECI(F, rr * Math.sin(az), rr * Math.cos(az), z));
  }
  return out;
}
export function summarize(counts) {
  const s = [...counts].sort((a, b) => a - b), n = s.length;
  const q = f => s[Math.min(n - 1, Math.floor(f * n))];
  return { mean: s.reduce((a, b) => a + b, 0) / n, pAny: s.filter(x => x > 0).length / n, p50: q(0.5), p90: q(0.9), n };
}
export function pointingStats(sources, t0, nPoint, eminDeg, opts, seed = 7) {
  const rng = mulberry32(seed), F = frameAt(t0 + 15000);
  const P = randomPointings(F, nPoint, eminDeg, rng);
  const res = simulateExposures(sources, t0, P, Object.assign({ dt: 1.0 }, opts));
  return summarize(res.map(r => r.trails.filter(t => t.lit).length));
}

// ------------------------------------------------------------ fotometría Rubin
// Jangid et al. 2026, Tabla 2 (ZP = mag que da 1 e⁻/s); Δ☉ = corrección V→banda (reflectancia gris).
// Cielo oscuro en el cenit: Ivezić et al. 2019 (ApJ 873, 111), Tabla 2.
export const BANDS = {
  u: { zp: 26.52, dSun: 1.43, sky: 22.99 }, g: { zp: 28.51, dSun: 0.25, sky: 22.26 }, r: { zp: 28.36, dSun: -0.21, sky: 21.20 },
  i: { zp: 28.17, dSun: -0.32, sky: 20.48 }, z: { zp: 27.78, dSun: -0.36, sky: 19.60 }, y: { zp: 26.82, dSun: -0.37, sky: 18.61 },
};
export const CAM = { D: 8.36, psf: 0.67, pix: 0.2, fullWell: 130000 };
/** Electrones en el píxel más brillante de la traza (perfil transversal gaussiano con desenfoque). */
export function streakPeak(mV, rangeKm, omegaDegS, band) {
  const B = BANDS[band], mb = mV + B.dSun;
  const rate = Math.pow(10, -0.4 * (mb - B.zp));                    // e⁻/s total
  const wpx = omegaDegS * 3600 / CAM.pix;                             // px/s a lo largo de la traza
  const lam = rate / Math.max(wpx, 1e-6);                             // e⁻ por píxel de longitud
  const thDef = 206265 * CAM.D / (rangeKm * 1000), thEff = Math.hypot(CAM.psf, thDef);
  const sig = thEff / 2.3548 / CAM.pix;
  const peak = sig > 0.6 ? lam / (sig * Math.sqrt(TWO_PI)) : lam;
  return { mb, rate, lam, peak, thEff };
}
export function skyPerPix(band, texp) { const B = BANDS[band]; return Math.pow(10, -0.4 * (B.sky - B.zp)) * CAM.pix * CAM.pix * texp; }

// ------------------------------------------------------------ análisis de la noche
export function nightWindow(msAny, limitDeg = -12) {
  // Noche que comienza la tarde del día local (UTC−3/−4 no importa: se busca alrededor del mediodía solar local)
  const off = RUBIN.lon / 15 * 3600000, tls = msAny + off;               // hora solar media local
  let noonLs = tls - mod(tls, 86400000) + 12 * 3600000;
  if (tls < noonLs) noonLs -= 86400000;                                    // antes del mediodía: noche anterior
  const noonLocal = Math.round((noonLs - off) / 60000) * 60000;
  let start = null, end = null;
  for (let t = noonLocal; t < noonLocal + 86400000; t += 60000) {
    const a = sunAlt(t);
    if (start === null && a < limitDeg) start = t;
    if (start !== null && a > limitDeg) { end = t; break; }
  }
  return { start, end };
}
export function solarMidnight(msAny) {
  const { start, end } = nightWindow(msAny, -0.833);
  let best = start, ba = 99;
  for (let t = start; t <= end; t += 60000) { const a = sunAlt(t); if (a < ba) { ba = a; best = t; } }
  return { ms: best, alt: ba };
}
export function astroTwilightEnd(msAny) {
  const { start } = nightWindow(msAny, -0.833);
  for (let t = start; t < start + 6 * 3600000; t += 30000) if (sunAlt(t) < -18) return t;
  return null;
}

// ------------------------------------------------------------ hora de Chile
function firstSunday(y, m) { const d = new Date(Date.UTC(y, m, 1)); return 1 + mod(7 - d.getUTCDay(), 7); }
/** Chile continental: UTC−3 desde el 1.er domingo de septiembre hasta el 1.er domingo de abril; UTC−4 el resto. */
export function chileOffsetH(ms) {
  const y = new Date(ms).getUTCFullYear();
  const aprEnd = Date.UTC(y, 3, firstSunday(y, 3), 3), sepStart = Date.UTC(y, 8, firstSunday(y, 8), 4);
  return (ms < aprEnd || ms >= sepStart) ? -3 : -4;
}

// ------------------------------------------------------------ pruebas (sin GPU)
export function runCoreTests(ctx) {
  const T = [], add = (id, nombre, obtenido, esperado, tol, pasa, nota = '') => T.push({ id, nombre, obtenido, esperado, tol, estado: pasa === null ? 'INFO' : (pasa ? 'PASA' : 'FALLA'), nota });
  const fx = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x)) ? '—' : Number(x).toFixed(d).replace('.', ',').replace('-', '−');
  // T1a
  const n0 = 1600 * capFraction(550, 0), n30 = 1600 * capFraction(550, 30);
  add('T1a', 'Casquete analítico vs Hainaut & Williams 2020 (Tabla 1, 1600 sats @550 km)', `${fx(n0, 1)} / ${fx(n30, 2)}`, '63,5 / 6,2', '±0,5 %',
    Math.abs(n0 - 63.5) / 63.5 < 0.005 && Math.abs(n30 - 6.2) / 6.2 < 0.01);
  // T1b
  const F = frameAt(Date.UTC(2026, 10, 27, 1, 1));
  for (const h of [550, 1000]) {
    const N = 1000000, rng = mulberry32(99 + h); let c0 = 0, c30 = 0; const s30 = 0.5;
    for (let k = 0; k < N; k++) {
      const z = 2 * rng() - 1, ph = TWO_PI * rng(), rr = Math.sqrt(1 - z * z), R = RE + h;
      const dx = R * rr * Math.cos(ph) - F.obs[0], dy = R * rr * Math.sin(ph) - F.obs[1], dz = R * z - F.obs[2];
      const sa = (dx * F.U[0] + dy * F.U[1] + dz * F.U[2]) / Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (sa > 0) { c0++; if (sa > s30) c30++; }
    }
    const e0 = N * capFraction(h, 0), e30 = N * capFraction(h, 30);
    // el observador está a 2,66 km de altura y sobre el elipsoide: corrección <0,5 %
    const ok = Math.abs(c0 - e0) < 3 * Math.sqrt(e0) + 0.005 * e0 && Math.abs(c30 - e30) < 3 * Math.sqrt(e30) + 0.005 * e30;
    add('T1b', `Capa uniforme sintética 10⁶ sats @${h} km (conteo del pipeline)`, `${c0} / ${c30}`, `${fx(e0, 0)} / ${fx(e30, 0)}`, '3σ + 0,5 %', ok);
  }
  // T2
  let best = 0, ba = 99; for (let t = Date.UTC(2026, 10, 27, 0, 0); t < Date.UTC(2026, 10, 27, 12, 0); t += 60000) { const a = sunAlt(t); if (a < ba) { ba = a; best = t; } }
  const dtm = (best - Date.UTC(2026, 10, 27, 4, 30)) / 60000;
  add('T2a', 'Sol a medianoche solar 26/27-nov-2026 (astropy: −38,64° a las 04:30 UTC)', `${fx(ba, 2)}° a las ${new Date(best).toISOString().slice(11, 16)} UTC`, '−38,64° · 04:30 UTC', '±0,05° · ±2 min', Math.abs(ba + 38.64) < 0.05 && Math.abs(dtm) <= 2);
  let tw = null; for (let t = Date.UTC(2026, 10, 26, 22, 0); t < Date.UTC(2026, 10, 27, 4, 0); t += 30000) if (sunAlt(t) < -18) { tw = t; break; }
  add('T2b', 'Fin del crepúsculo astronómico 26-nov-2026', `${new Date(tw).toISOString().slice(11, 16)} UTC`, '01:01 UTC (22:01 CLT)', '±2 min', Math.abs((tw - Date.UTC(2026, 10, 27, 1, 1)) / 60000) <= 2);
  const aj = sunAlt(Date.UTC(2027, 5, 21, 4, 45));
  add('T2c', 'Sol 21-jun-2027 04:45 UTC (astropy: −83,19°)', `${fx(aj, 2)}°`, '−83,19°', '±0,05°', Math.abs(aj + 83.19) < 0.05);
  // T3
  const u = norm3([0.6, -0.3, -0.5]), e = norm3(cross(u, [0, 0, 1]));
  for (const D of [12, 18, 24, 30, 38.6]) {
    const s = [-Math.sin(D * DEG) * u[0] + Math.cos(D * DEG) * e[0], -Math.sin(D * DEG) * u[1] + Math.cos(D * DEG) * e[1], -Math.sin(D * DEG) * u[2] + Math.cos(D * DEG) * e[2]];
    const flip = conical => { let lo = 0, hi = 4000; for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2, R = RE + m; (litFactor(R * u[0], R * u[1], R * u[2], s, conical) > 0 ? hi = m : lo = m); } return (lo + hi) / 2; };
    const hc = flip(false), hk = flip(true), ec = shadowHeightZenith(D);
    const ek = RE / (Math.cos(D * DEG) + Math.sin(D * DEG) * TAN_AU) - RE;
    add('T3', `Sombra sobre el cenit, Sol a −${String(D).replace('.', ',')}° (cil. | cónica-umbra)`, `${fx(hc, 1)} | ${fx(hk, 1)} km`, `${fx(ec, 1)} | ${fx(ek, 1)} km`, '±3 km | ±1 km', Math.abs(hc - ec) < 3 && Math.abs(hk - ek) < 1,
      `cónica − cilíndrica = ${fx(hk - hc, 1)} km`);
  }
  // T4a Bassa et al. 2022
  {
    const h = 1000, inc = 53, N = 10000, phi = Math.atan((1 - F_WGS) ** 2 * Math.tan(RUBIN.lat * DEG));
    const P = 1 / (2 * Math.PI ** 2 * (RE + h) ** 2 * Math.sqrt(Math.sin(inc * DEG) ** 2 - Math.sin(phi) ** 2));
    const rho = N * P * (h - RUBIN.h) ** 2 * DEG * DEG, w = Math.sqrt(MU / (RE + h)) / (h - RUBIN.h) * RAD;
    const Rf = 1.75, A = Math.PI * Rf * Rf, expect = rho * (A + 2 * Rf * w * 30);
    const nreal = ctx && ctx.quick ? 300 : 2000, rng = mulberry32(2022); let tot = 0;
    const sub = [{ h, i: inc, planes: 100, spp: 100, modo: 'incl', ltans: [18], scen: 1, group: 0 }];
    for (let it = 0; it < nreal; it++) {
      const S = buildSynth(sub, 1000 + it); const rot = rng() * TWO_PI;
      for (let k = 0; k < S.n; k++) S.orb[4 * k + 2] = mod(S.orb[4 * k + 2] + rot, TWO_PI);
      const t0 = Date.UTC(2026, 10, 27) + rng() * 86400000;
      const src = synthSource(S, () => ({ tRef: t0, deploy: 1, on: [1, 1, 1, 1], M: [5, 5, 5, 5] }));
      const Fz = frameAt(t0 + 15000), pz = Fz.U;
      tot += simulateExposures([src], t0, [pz], { dt: 0.5, requireLit: false })[0].trails.length;
    }
    const got = tot / nreal, err = Math.sqrt(got / nreal);
    add('T4a', `Bassa et al. 2022 (10⁴ sats 100×100, 1000 km, 53°): trazas en LSSTCam 30 s al cenit, ${nreal} épocas`, `${fx(got, 3)} ± ${fx(err, 3)}`, `${fx(expect, 3)} (Ec. 1)`, '±15 %', Math.abs(got - expect) / expect < 0.15,
      `ρ = ${rho.toExponential(3).replace('.', ',')} sats/deg², ω = ${fx(w, 3)}°/s`);
  }
  // T4b Hainaut & Williams 2020 discreto
  {
    const rng = mulberry32(2020), nreal = 400; let s0 = 0, s30 = 0;
    for (let it = 0; it < nreal; it++) for (let k = 0; k < 1600; k++) {
      const z = 2 * rng() - 1, ph = TWO_PI * rng(), rr = Math.sqrt(1 - z * z), R = RE + 550;
      const dx = R * rr * Math.cos(ph) - F.obs[0], dy = R * rr * Math.sin(ph) - F.obs[1], dz = R * z - F.obs[2];
      const sa = (dx * F.U[0] + dy * F.U[1] + dz * F.U[2]) / Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (sa > 0) { s0++; if (sa > 0.5) s30++; }
    }
    const m0 = s0 / nreal, m30 = s30 / nreal;
    add('T4b', 'Hainaut & Williams 2020, simulación discreta (1600 sats @550 km, 400 realizaciones)', `${fx(m0, 2)} / ${fx(m30, 2)}`, '63,5 / 6,2', '3σ de la media',
      Math.abs(m0 - 63.5) < 3 * Math.sqrt(63.5 / nreal) + 0.4 && Math.abs(m30 - 6.2) < 3 * Math.sqrt(6.2 / nreal) + 0.05);
  }
  // T6 SGP4
  if (ctx && ctx.satlib) {
    const rec = ctx.satlib.twoline2satrec('1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753', '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667');
    const p = ctx.satlib.sgp4(rec, 0).position, dd = Math.hypot(p.x - 7022.46529266, p.y + 1400.08296755, p.z - 0.03995155) * 1000;
    add('T6', 'SGP4 (satellite.js) vs caso de verificación de Vallado, TLE 00005, t = 0', `(${fx(p.x, 3)}, ${fx(p.y, 3)}, ${fx(p.z, 3)}) km`, '(7022,465, −1400,083, 0,040) km', '±1 m', dd < 1, `Δ = ${fx(dd, 4)} m`);
  }
  return T;
}
/** T4c: contexto contra la predicción independiente en Python y la literatura (requiere la constelación cargada). */
export function runContextTests(sources, starmindOnly, opts) {
  const T = [], fx = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
  const add = (id, nombre, obtenido, esperado, tol, pasa, nota = '') => T.push({ id, nombre, obtenido, esperado, tol, estado: pasa === null ? 'INFO' : (pasa ? 'PASA' : 'FALLA'), nota });
  const t1 = Date.UTC(2026, 10, 27, 1, 1), t2 = Date.UTC(2026, 10, 27, 4, 30);
  const c1 = countVisible(starmindOnly, frameAt(t1), 30, false), c2 = countVisible(starmindOnly, frameAt(t2), 30, false);
  add('T4c-1', 'Starmind 1M: iluminados >30° a las 22:01 CLT del 26-nov (Python: 6408)', `${c1.litE} (sobre 30°: ${c1.aboveE})`, '6408 (6612)', '±7 %', Math.abs(c1.litE - 6408) / 6408 < 0.07);
  add('T4c-2', 'Starmind 1M: iluminados >30° a medianoche solar (Python: 0)', `${c2.litE}`, '0', '≤ 5', c2.litE <= 5);
  const st = pointingStats([starmindOnly], t1, opts.nPoint || 300, 30, { requireLit: true }, 11);
  add('T4c-3', 'Starmind 1M, 22:01 CLT: trazas iluminadas por exposición, apuntados aleatorios >30° (Python: media 25,5; P≥1 65 %)',
    `media ${fx(st.mean)} · P≥1 ${fx(st.pAny * 100, 0)} % · p50 ${st.p50} · p90 ${st.p90}`, 'media 25,5 · P≥1 65 %', 'media ±30 % · P ±10 pts',
    Math.abs(st.mean - 25.5) / 25.5 < 0.3 && Math.abs(st.pAny * 100 - 65) < 10);
  add('T4c-4', 'Contexto literatura: Jangid 2026 (hasta 80 % de apuntados por noche; mediana ~100 trazas en crepúsculo con opsim) · Tyson 2020 (40–90 % en crepúsculo, 48k sats)',
    `P≥1 = ${fx(st.pAny * 100, 0)} % · mediana ${st.p50}`, 'mismo orden de magnitud', 'factor 3', null,
    'No comparable punto a punto: distinta fecha, apuntados (opsim vs aleatorios), modelo SSO (RAAN fija en Jangid) y umbral de detección.');
  return T;
}
