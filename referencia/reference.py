"""Cálculos de referencia (float64) para la Fase 2. Mismas fórmulas que irán al HTML."""
import math, numpy as np
from datetime import datetime, timedelta, timezone

MU = 398600.4418; RE = 6378.137; F_WGS = 1/298.257223563; J2 = 1.08262668e-3
DEG = math.pi/180
LAT, LON, H_OBS = -30.2446, -70.7494, 2.663   # km

def jd(dt): return dt.timestamp()/86400 + 2440587.5

def gmst(jd_ut1):  # IAU 1982, rad
    T = (jd_ut1-2451545.0)/36525
    s = 67310.54841 + (876600*3600+8640184.812866)*T + 0.093104*T*T - 6.2e-6*T**3
    return (s % 86400)/240*DEG

def sun_eci(jd_):  # Astronomical Almanac low precision (~0.01 deg), unit vector, mean equator of date
    n = jd_-2451545.0
    L = (280.460+0.9856474*n) % 360; g = (357.528+0.9856003*n) % 360
    lam = (L + 1.915*math.sin(g*DEG) + 0.020*math.sin(2*g*DEG))*DEG
    eps = (23.439-4e-7*n)*DEG
    return np.array([math.cos(lam), math.cos(eps)*math.sin(lam), math.sin(eps)*math.sin(lam)]), lam, eps

def obs_ecef(lat=LAT, lon=LON, h=H_OBS):
    a = RE; e2 = F_WGS*(2-F_WGS); la, lo = lat*DEG, lon*DEG
    N = a/math.sqrt(1-e2*math.sin(la)**2)
    return np.array([(N+h)*math.cos(la)*math.cos(lo), (N+h)*math.cos(la)*math.sin(lo), (N*(1-e2)+h)*math.sin(la)])

def ecef_to_enu(v, lat=LAT, lon=LON):
    la, lo = lat*DEG, lon*DEG
    E = np.array([-math.sin(lo), math.cos(lo), 0])
    N = np.array([-math.sin(la)*math.cos(lo), -math.sin(la)*math.sin(lo), math.cos(la)])
    U = np.array([math.cos(la)*math.cos(lo), math.cos(la)*math.sin(lo), math.sin(la)])
    return np.array([v@E, v@N, v@U])

def eci_to_ecef(r, th):
    c, s = math.cos(th), math.sin(th)
    return np.array([c*r[0]+s*r[1], -s*r[0]+c*r[1], r[2]])

def altaz(r_eci, jd_):
    th = gmst(jd_); d = eci_to_ecef(r_eci, th) - obs_ecef(); enu = ecef_to_enu(d)
    rng = np.linalg.norm(enu)
    return math.degrees(math.asin(enu[2]/rng)), math.degrees(math.atan2(enu[0], enu[1])) % 360, rng

def sun_alt(dt):
    s, _, _ = sun_eci(jd(dt)); a, z, _ = altaz(s*1.496e8, jd(dt)); return a

def sso_inc(h):
    a = RE+h; n = math.sqrt(MU/a**3); Od = 2*math.pi/(365.2422*86400)
    return math.degrees(math.acos(-Od/(1.5*n*J2*(RE/a)**2)))

def raan_rate(h, i):  # deg/day
    a = RE+h; n = math.sqrt(MU/a**3)
    return math.degrees(-1.5*n*J2*(RE/a)**2*math.cos(i*DEG))*86400

def u_rate(h, i):  # rad/s, argumento de latitud (M + w seculares, J2)
    a = RE+h; n = math.sqrt(MU/a**3); k = J2*(RE/a)**2; s2 = math.sin(i*DEG)**2
    return n*(1 + 0.75*k*(2-3*s2)) + 0.75*n*k*(4-5*s2)

def sat_eci(h, i, raan, u):
    a = RE+h; ci, si = math.cos(i*DEG), math.sin(i*DEG); cO, sO = math.cos(raan*DEG), math.sin(raan*DEG)
    cu, su = math.cos(u*DEG), math.sin(u*DEG)
    return a*np.array([cO*cu - sO*su*ci, sO*cu + cO*su*ci, su*si])

def shadow_cyl(r, s):
    p = r@s; return (p < 0) and (r@r - p*p < RE*RE)

def cap_fraction(h, emin):  # fracción de una capa esférica uniforme sobre elevación emin
    lam = math.acos(RE*math.cos(emin*DEG)/(RE+h)) - emin*DEG
    return (1-math.cos(lam))/2

def shadow_height_zenith(dep):  # altura de la sombra cilíndrica sobre el cenit, Sol a 'dep' bajo el horizonte
    return RE*(1/math.cos(dep*DEG)-1)

if __name__ == '__main__':
    print('== 1. Inclinación heliosincrónica exacta (J2, circular)')
    for h, ifil in [(550, None), (565, 97.7), (585, 97.7), (707, 97.2), (744, 97.2), (967, 99.4), (1002, 99.4), (360, 96.9), (465, 97.3)]:
        si = sso_inc(h)
        msg = ''
        if ifil:
            drift = raan_rate(h, ifil) - 360/365.2422
            msg = f'  filing {ifil}°: deriva nodo-Sol {drift:+.3f}°/día = {drift*365.25:+.0f}°/año ({drift*365.25/15:+.1f} h LTAN/año)'
        print(f'  h={h:5d} km  i_SSO={si:6.2f}°{msg}')

    print('\n== 2. Sol en Cerro Pachón, 26-27 nov 2026')
    t0 = datetime(2026, 11, 27, 0, 0, tzinfo=timezone.utc)
    ts = [t0 + timedelta(minutes=m) for m in range(0, 12*60)]
    alts = [sun_alt(t) for t in ts]
    k = int(np.argmin(alts)); print(f'  mínimo (medianoche solar): {ts[k]:%Y-%m-%d %H:%M} UTC  alt={alts[k]:.2f}°')
    # fin crepúsculo astronómico (tarde del 26)
    t1 = datetime(2026, 11, 26, 22, 0, tzinfo=timezone.utc)
    for m in range(0, 240):
        t = t1 + timedelta(minutes=m)
        if sun_alt(t) < -18: print(f'  fin crepúsculo astronómico: {t:%Y-%m-%d %H:%M} UTC ({(t-timedelta(hours=3)):%H:%M} CLT, UTC-3)'); break
    try:
        from astropy.coordinates import EarthLocation, AltAz, get_sun
        from astropy.time import Time
        import astropy.units as u
        loc = EarthLocation(lat=LAT*u.deg, lon=LON*u.deg, height=2663*u.m)
        tt = Time(ts[k]); aa = get_sun(tt).transform_to(AltAz(obstime=tt, location=loc))
        print(f'  astropy (independiente) en ese instante: alt={aa.alt.deg:.2f}°  (diferencia {alts[k]-aa.alt.deg:+.3f}°)')
        tj = Time('2027-06-21T04:45:00'); aj = get_sun(tj).transform_to(AltAz(obstime=tj, location=loc))
        print(f'  astropy solsticio jun-2027 ~medianoche: alt={aj.alt.deg:.2f}°, nuestro={sun_alt(datetime(2027,6,21,4,45,tzinfo=timezone.utc)):.2f}°')
    except Exception as e:
        print('  astropy no disponible:', e)

    print('\n== 3. Altura de la sombra (cilíndrica) sobre el cenit')
    for dep in [12, 18, 24, 30, 38.6]:
        print(f'  Sol a -{dep:4.1f}°  ->  h_sombra = {shadow_height_zenith(dep):7.0f} km')

    print('\n== 4. Casquete esférico (capa uniforme): fracción sobre el horizonte / sobre 30°')
    for h in [550, 700, 1000]:
        print(f'  h={h:5d} km  f(0°)={cap_fraction(h,0)*100:5.2f}%   f(30°)={cap_fraction(h,30)*100:5.3f}%')
    print('  Hainaut & Williams 2020, Tabla 1, Starlink 1600 sats @550 km: 4.0% (63.5) sobre horizonte, 0.4% (6.2) sobre z=60°')
    print(f'  nuestro: {1600*cap_fraction(550,0):.1f} y {1600*cap_fraction(550,30):.1f}')

    print('\n== 5. Bassa et al. 2022: densidad de una capa inclinada (10 000 sats, 1000 km, 53°), cenit en lat -30.24°')
    h, i, N = 1000, 53, 10000
    # punto subsatelital del cenit: latitud geocéntrica ~ latitud del observador
    phi = math.atan((1-F_WGS)**2*math.tan(LAT*DEG))
    P = 1/(2*math.pi**2*(RE+h)**2*math.sqrt(math.sin(i*DEG)**2 - math.sin(phi)**2))
    A = (math.pi/180)**2
    rho = N*P*(h-H_OBS)**2*A
    v = math.sqrt(MU/(RE+h)); w = v/(h-H_OBS)/DEG  # deg/s aprox. (sin rotación terrestre)
    Nt = rho*(9.6 + 3.5*w*30)
    print(f'  P={P:.3e} /km²  rho={rho:.3e} sats/deg²  omega≈{w:.3f}°/s  -> N_trazas(LSSTCam, 30 s) ≈ {Nt:.3f}')
    rho_unif = N/(4*math.pi*(RE+h)**2)*(h-H_OBS)**2*A
    print(f'  (misma capa si fuera uniforme: rho={rho_unif:.3e}; factor de sobredensidad por latitud {rho/rho_unif:.2f})')

    print('\n== 6. Traza a mano: satélite SSO 967 km, i=99.4°, LTAN 18:00, instante 2026-11-27 00:30 UTC')
    t = datetime(2026, 11, 27, 0, 30, tzinfo=timezone.utc); J = jd(t)
    s, lam, eps = sun_eci(J)
    ra_sun = math.degrees(math.atan2(math.cos(eps)*math.sin(lam), math.cos(lam))) % 360
    dec_sun = math.degrees(math.asin(math.sin(eps)*math.sin(lam)))
    raan = (ra_sun + (18-12)*15) % 360
    th = gmst(J)
    print(f'  JD={J:.6f}  GMST={math.degrees(th):.4f}°  Sol: RA={ra_sun:.4f}° Dec={dec_sun:.4f}°  -> RAAN={raan:.4f}°')
    # buscar u que deje el satélite más alto sobre Rubin en este plano
    best = max(((altaz(sat_eci(967, 99.4, raan, uu), J)[0], uu) for uu in np.arange(0, 360, 0.25)))
    u0 = best[1]; r = sat_eci(967, 99.4, raan, u0)
    el, az, rng = altaz(r, J)
    lit = not shadow_cyl(r, s)
    o = obs_ecef(); obs_eci = np.array([math.cos(th)*o[0]-math.sin(th)*o[1], math.sin(th)*o[0]+math.cos(th)*o[1], o[2]])
    ro = obs_eci - r
    phase = math.degrees(math.acos(np.dot(s, ro/np.linalg.norm(ro))))  # ángulo Sol-satélite-observador
    print(f'  u={u0:.2f}°  r_ECI=({r[0]:.1f}, {r[1]:.1f}, {r[2]:.1f}) km  |r|={np.linalg.norm(r):.1f}')
    print(f'  alt={el:.2f}°  az={az:.2f}°  distancia={rng:.1f} km  iluminado(cil)={lit}  ángulo de fase={phase:.1f}°')
    print(f'  Sol en Rubin: {sun_alt(t):.2f}°')
    for name, M in [('optimista', 6.0), ('central', 5.5), ('pesimista', 2.7)]:
        print(f'   m_{name} = {M} + 5 log10({rng:.1f}/1000) = {M + 5*math.log10(rng/1000):.2f}')
