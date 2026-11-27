"""Predicción independiente (numpy, float64) para Starmind: conteos y trazas en LSSTCam.
Sirve como valor esperado contra el que se comparará el modo diagnóstico del HTML."""
import math, re, numpy as np
from datetime import datetime, timedelta, timezone
from reference import (MU, RE, J2, DEG, jd, gmst, sun_eci, obs_ecef, raan_rate, u_rate, sun_alt)

rng = np.random.default_rng(1)

def mcdowell_shells():
    out = []
    for l in open(__import__('os').path.join(__import__('os').path.dirname(__file__),'starmind_mcdowell.txt')):
        p = l.split()
        if len(p) > 11 and p[5] == 'Shell':
            h, i, npl, spp = float(p[7]), float(p[9]), int(p[10]), int(p[11])
            out.append(dict(h=h, i=i, planes=npl, spp=spp, sso=i > 90))
    return out

def build(shells, scale=1.0, ltans=(18.0, 6.0), sso_mode='sun'):
    H, I, O, U, SSO, LT = [], [], [], [], [], []
    for s in shells:
        spp = max(1, int(round(s['spp']*scale)))
        for k in range(s['planes']):
            if s['sso']:
                lt = ltans[k % len(ltans)]
                raan = np.nan  # se fija al Sol en cada instante
            else:
                lt = np.nan; raan = 360*k/s['planes']
            u0 = (np.arange(spp)*360/spp + rng.uniform(0, 360/spp)) % 360
            H.append(np.full(spp, s['h'])); I.append(np.full(spp, s['i'])); O.append(np.full(spp, raan))
            U.append(u0); SSO.append(np.full(spp, s['sso'])); LT.append(np.full(spp, lt))
    return dict(h=np.concatenate(H), i=np.concatenate(I), raan0=np.concatenate(O), u0=np.concatenate(U),
                sso=np.concatenate(SSO), ltan=np.concatenate(LT))

T0 = datetime(2026, 11, 27, 0, 0, tzinfo=timezone.utc)

def positions(C, t):
    J = jd(t); dt = (t - T0).total_seconds()
    s, lam, eps = sun_eci(J)
    ra_sun = math.degrees(math.atan2(math.cos(eps)*math.sin(lam), math.cos(lam)))
    a = RE + C['h']; n = np.sqrt(MU/a**3); k = J2*(RE/a)**2; ci = np.cos(C['i']*DEG); s2 = np.sin(C['i']*DEG)**2
    udot = n*(1 + 0.75*k*(2-3*s2)) + 0.75*n*k*(4-5*s2)
    Odot = -1.5*n*k*ci
    raan = np.where(C['sso'], ra_sun + (C['ltan']-12)*15, C['raan0'] + np.degrees(Odot*dt))*DEG
    u = (C['u0']*DEG + udot*dt)
    cO, sO, cu, su, si = np.cos(raan), np.sin(raan), np.cos(u), np.sin(u), np.sin(C['i']*DEG)
    r = np.stack([a*(cO*cu - sO*su*ci), a*(sO*cu + cO*su*ci), a*su*si], 1)
    return r, s, J

def topo(r, J):
    th = gmst(J); c, s_ = math.cos(th), math.sin(th)
    x = c*r[:, 0] + s_*r[:, 1]; y = -s_*r[:, 0] + c*r[:, 1]; z = r[:, 2]
    o = obs_ecef(); d = np.stack([x-o[0], y-o[1], z-o[2]], 1)
    la, lo = -30.2446*DEG, -70.7494*DEG
    E = np.array([-math.sin(lo), math.cos(lo), 0]); N = np.array([-math.sin(la)*math.cos(lo), -math.sin(la)*math.sin(lo), math.cos(la)])
    Up = np.array([math.cos(la)*math.cos(lo), math.cos(la)*math.sin(lo), math.sin(la)])
    e, nn, uu = d@E, d@N, d@Up; rg = np.sqrt(e*e+nn*nn+uu*uu)
    return np.degrees(np.arcsin(uu/rg)), np.degrees(np.arctan2(e, nn)) % 360, rg, np.stack([e, nn, uu], 1)/rg[:, None]

def lit_cyl(r, s):
    p = r@s; return ~((p < 0) & ((r*r).sum(1) - p*p < RE*RE))

def report(name, C, times):
    print(f'\n### {name}: {len(C["h"]):,} satélites')
    for lab, t in times:
        r, s, J = positions(C, t); el, az, rg, _ = topo(r, J); L = lit_cyl(r, s)
        print(f'  {lab:32s} Sol={sun_alt(t):6.1f}°  sobre horizonte={np.sum(el>0):6d}  sobre 30°={np.sum(el>30):5d}  '
              f'iluminados>0°={np.sum((el>0)&L):5d}  iluminados>30°={np.sum((el>30)&L):5d}')

def trails(C, t, npoint=300, texp=30.0, rfov=1.75, emin=30.0, step=1.0):
    """Trazas iluminadas en apuntados aleatorios (uniformes en ángulo sólido sobre emin)."""
    r, s, J = positions(C, t); el, az, rg, _ = topo(r, J)
    cand = el > emin - 20  # prefiltro generoso (en 30 s un sat recorre <~15°)
    Cc = {k: v[cand] for k, v in C.items()}
    nst = int(texp/step) + 1
    U = []; LIT = []
    for j in range(nst):
        rr, ss, JJ = positions(Cc, t + timedelta(seconds=j*step)); _, _, _, uvec = topo(rr, JJ)
        U.append(uvec); LIT.append(lit_cyl(rr, ss))
    U = np.stack(U); LIT = np.stack(LIT)  # (nst, Ncand, 3)
    # apuntados aleatorios uniformes en el casquete el>emin
    zmax = math.sin(emin*DEG)
    zz = rng.uniform(zmax, 1, npoint); ph = rng.uniform(0, 2*math.pi, npoint); rr_ = np.sqrt(1-zz*zz)
    P = np.stack([rr_*np.sin(ph), rr_*np.cos(ph), zz], 1)  # ENU
    cosr = math.cos(rfov*DEG); counts = []
    for p in P:
        inside = (U@p > cosr) & LIT  # (nst, Ncand)
        counts.append(np.sum(inside.any(0)))
    counts = np.array(counts)
    return counts.mean(), np.mean(counts > 0), np.percentile(counts, [50, 90])

if __name__ == '__main__':
    sh = mcdowell_shells()
    tot = sum(s['planes']*s['spp'] for s in sh)
    print('McDowell total', tot, 'subcapas', len(sh))
    times = [('fin crep. astronómico 22:01 CLT', datetime(2026, 11, 27, 1, 1, tzinfo=timezone.utc)),
             ('medianoche solar 01:30 CLT', datetime(2026, 11, 27, 4, 30, tzinfo=timezone.utc)),
             ('crep. náutico tarde 21:30 CLT', datetime(2026, 11, 27, 0, 30, tzinfo=timezone.utc))]
    A = build(sh, scale=1_000_000/tot)
    report('Starmind 6 grupos escalado a 1M, SSO LTAN 18/06', A, times)
    jang = [s for s in sh if s['h'] > 600]
    B = build(jang, scale=1.0)
    report('Starmind sin capas 550-585 (≈ preset Jangid, 4 regímenes)', B, times)
    for lab, t in times:
        m, f, pc = trails(A, t)
        print(f'  TRAZAS 1M/6 grupos  {lab:32s} media={m:6.2f}  P(≥1)={f*100:5.1f}%  p50,p90={pc}')
