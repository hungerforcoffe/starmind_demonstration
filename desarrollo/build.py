import json, re, os, sys
here = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(here, *a)
OUT = sys.argv[1] if len(sys.argv) > 1 else P('..', 'index.html')

FCC = 'https://docs.fcc.gov/public/attachments/DA-26-1273A1.pdf'
F = [
 ('S1','Autorización Starmind','Hasta 1.000.000 satélites; 25-nov-2026 (granted-in-part / deferred-in-part)','CONFIRMADO','FCC DA 26-1273',FCC),
 ('S2','Envolvente orbital','Capas de 50 km entre 500 y 1.002 km; 30° y heliosincrónicas','CONFIRMADO','FCC DA 26-1273',FCC),
 ('S3','Solicitud original','30-ene-2026; 500–2.000 km; waiver del Schedule S para la configuración de planos','CONFIRMADO','FCC DA 26-113','https://docs.fcc.gov/public/attachments/DA-26-113A1.pdf'),
 ('S4','6 grupos (altitud / inclinación)','550–568/26–32° · 565–585/97,7° · 686–718/30° · 707–744/97,2° · 946–978/30° · 967–1.002/99,4°','CONFIRMADO','DA 26-1273 (carta SpaceX 29-may-2026, p. 3)',FCC),
 ('S5','Subcapas y N por subcapa','114 subcapas; total 1.198.120','SECUNDARIA','McDowell, Enormous Constellations','https://planet4589.org/space/con/conlist.html'),
 ('S6','Planos × sat/plano','30 × 333 (capas de 30°); 2 planos por subcapa SSO','SECUNDARIA','McDowell (íd.)','https://planet4589.org/space/con/conlist.html'),
 ('S7','Reparto hasta el tope de 1M','Escalado proporcional ×0,83464 en las 114 subcapas, con satélites enteros por plano: 999.996 en total (≤ 1.000.000 autorizado)','SUPUESTO','Neutro; decisión aprobada por el usuario',''),
 ('S8','Fase en el plano / Walker F','Uniforme con desfase aleatorio por plano','SUPUESTO','No público: SpaceX pidió no declarar en el Schedule S la configuración de planos (DA 26-113) y la FCC concedió ese waiver (DA 26-1273, cond. 7). La condición 5 obliga a desplegar según las fichas ITU, donde estaría ese dato',FCC),
 ('S9','LTAN de las SSO','18:00 y 06:00 (dawn-dusk), RAAN amarrada al Sol','SUPUESTO','SpaceX: SSO para energía solar continua (spacex.com vía Wikipedia)','https://en.wikipedia.org/wiki/Starmind_(satellite)'),
 ('S10','Inclinación G4 (707–744 km)','97,2° registrada (SSO exacta 98,2–98,4°: probable errata); LTAN mantenida','DERIVADO','Cálculo J2 (referencia/reference.py)',''),
 ('S11','Satélite AI1','Envergadura 75 m; panel 210 kW; radiador 160 m²; 250 kW pico','SECUNDARIA','spacex.com vía Wikipedia; Spaceflight Now 26-nov-2026','https://en.wikipedia.org/wiki/Starmind_(satellite)'),
 ('S12','AI1 borrador (jun-2026)','70 m; 150 kW; radiador 110 m² de canto al Sol; 250 W/m²','SECUNDARIA','DCD, 9-jun-2026','https://www.datacenterdynamics.com/en/news/spacex-details-ai1-satellite-data-center-claims-150kw-peak-compute/'),
 ('S13','Área de paneles','840 m² (600 m² el borrador)','DERIVADO','S11/S12 con 250 W/m²',''),
 ('S14','Masa del satélite','Desconocida (no se usa)','NO PÚBLICO','Probablemente en el Technical Attachment (ICFS inaccesible)',''),
 ('S15','Vida útil','Desconocida (la licencia de 15 años no es la vida útil)','NO PÚBLICO','—',''),
 ('S16','Hitos de despliegue','1.º antes de 2033 · 10 % 2035 · 50 % 2038 · 100 % 2040 (deslizador «desplegado»)','CONFIRMADO','DA 26-1273, condición 10',FCC),
 ('S17','Disposición final','<600 km reingreso; >600 km diferido (heliocéntrica/disposición)','CONFIRMADO','DA 26-1273, condición 4',FCC),
 ('S19','Condiciones de astronomía óptica','Ninguna; basta el compromiso de coordinar con la NSF. El IR térmico se declara fuera de competencia. Peticiones de la AAS, Amazon Kuiper y Viasat denegadas','CONFIRMADO','DA 26-1273, ¶16–17 y ¶20',FCC),
 ('S20','Despliegue inicial','SpaceX desplegará primero a menor altitud para probar los satélites antes de subirlos a su capa (población transitoria baja, no modelada)','CONFIRMADO','DA 26-1273, ¶12–13',FCC),
 ('L1','Starlink actual','11.189 objetos (TLE/GP del 26-nov-2026), SGP4','CONFIRMADO','CelesTrak GROUP=starlink','https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json'),
 ('L2','Gen2: capas autorizadas','340/53 · 345/48 · 350/38 · 355/43 · 360/96,9 · 365/32 · 475/32 · 480/53 · 485/43; 15.000','CONFIRMADO','FCC DA 26-36 (9-ene-2026)','https://docs.fcc.gov/public/attachments/DA-26-36A1.pdf'),
 ('L3','Gen2: N por capa','1.667 por capa; RAAN uniforme (72 o 56 planos; 36 en 360 km)','SUPUESTO','La FCC concede despliegue flexible',''),
 ('L4','M₁₀₀₀ Starlink por generación','V1.x 6,34 (antes de 2023-026) · DTC 6,47 · resto (V2 Mini) 7,87','SUPUESTO','Mallama et al. 2023 y 2025','https://arxiv.org/abs/2306.06657'),
 ('B1','V2 Mini en mitigación','M₁₀₀₀ = 7,87 ± 0,09 (σ 0,79); área 116 m²','CONFIRMADO','Mallama et al. 2023','https://arxiv.org/abs/2306.06657'),
 ('B2','V2 Mini sin mitigar','M₁₀₀₀ = 5,08 (σ 1,70)','CONFIRMADO','Mallama et al. 2023','https://arxiv.org/abs/2306.06657'),
 ('B4','Función de fase (opcional)','M₁₀₀₀(φ) = 2,630 + 0,1065 φ − 0,0005167 φ², normalizada a φ = 90°','CONFIRMADO','Mallama et al. 2023, Fig. 5','https://arxiv.org/abs/2306.06657'),
 ('B8','Starmind M₁₀₀₀','Optimista 6,0 · central 5,7 · pesimista 2,7 (escalado por área desde la V2 Mini). El central supone mitigación como la V2 Mini; en el expediente no hay compromiso de reducir la reflectividad (Dark Sky, citado en DA 26-1273 nota 52) y la FCC no impone ninguno','SUPUESTO','Derivación en FASE1_FASE2.md §3',''),
 ('B9','Contraste con BRDF de Jangid 2026','Pico difuso ~6 mag AB; destellos 2–4 mag; 2,5 % de trazas < 2 mag','CONFIRMADO','Jangid et al. 2026','https://arxiv.org/abs/2610.31772'),
 ('B10','V → bandas LSST','Δu +1,43 · g +0,25 · r −0,21 · i −0,32 · z −0,36 · y −0,37','CONFIRMADO','Jangid et al. 2026, Tabla 2','https://arxiv.org/abs/2610.31772'),
 ('B11','Destellos especulares','No modelados (modelo difuso); el caso pesimista sirve de cota','MODELO','Limitación declarada',''),
 ('R1','Sitio Rubin','−30,2446°, −70,7494°, 2.663 m','CONFIRMADO','Jangid et al. 2026, §2.4','https://arxiv.org/abs/2610.31772'),
 ('R2','Campo de LSSTCam','9,6 deg², radio 1,75°, 189 CCD 4k×4k, 0,2″/px','CONFIRMADO','Tyson et al. 2020; Jangid et al. 2026','https://arxiv.org/abs/2006.12417'),
 ('R3','Fotometría de trazas','D = 8,36 m; PSF 0,67″; desenfoque 206265·D/ρ; ZP por banda; pozo lleno 130.000 e⁻','CONFIRMADO','Jangid et al. 2026, §2.6–2.7','https://arxiv.org/abs/2610.31772'),
 ('R3b','Cielo oscuro (cenit)','u 22,99 · g 22,26 · r 21,20 · i 20,48 · z 19,60 · y 18,61 mag/arcsec²','CONFIRMADO','Ivezić et al. 2019, Tabla 2','https://arxiv.org/abs/0805.2366'),
 ('R4','Exposición','30 s continuos (opción 2 × 15 s con pausa de 2 s)','SUPUESTO','Baselines de rubin_sim; elección operativa no verificada',''),
 ('R5','Límite de altura','Telescopio 15°–86,5°; análisis con alt ≥ 30°','SUPUESTO','Hardware vía Jangid 2026; 30° por convención (Hainaut, Bassa)',''),
 ('M1','Sombra','Cilíndrica (por defecto) o cónica con penumbra lineal','MODELO','Diferencia en el borde: 6–30 km (diagnóstico T3)',''),
 ('M2','Posición del Sol','Almanaque Astronómico, baja precisión (~0,01°)','MODELO','Validado contra astropy (T2)',''),
 ('M3','Órbitas sintéticas','Circulares con J2 secular; sin arrastre, maniobras ni despliegue progresivo','MODELO','Equivalente a Jangid 2026 (estado estacionario idealizado)',''),
 ('M4','Imagen CCD y pérdida de píxeles','Máscaras de 20″ (normal), 100″ (saturada) y CCD completo si m < 2','MODELO','Convención de Jangid et al. 2026 §2.7','https://arxiv.org/abs/2610.31772'),
 ('V1','Tyson et al. 2020','48k sats a 550 km: ~30 % de imágenes con traza; 40–90 % en crepúsculo','CONFIRMADO','AJ 160, 226','https://arxiv.org/abs/2006.12417'),
 ('V2','Hainaut & Williams 2020','1.600 sats a 550 km: 63,5 sobre el horizonte y 6,2 sobre 30°','CONFIRMADO','A&A 636, A121','https://arxiv.org/abs/2003.01992'),
 ('V3','Bassa et al. 2022','N_trazas = ρ(A + Lωt); densidad de capa inclinada','CONFIRMADO','A&A 657, A75','https://arxiv.org/abs/2108.12335'),
 ('V4','Jangid et al. 2026','Hasta 80 % de apuntados por noche con traza; media anual ~20 %; SSO con RAAN fija (Step1.py)','CONFIRMADO','arXiv:2610.31772 y código público','https://github.com/njangid2/rubin-odc-simulation-pipeline'),
]
fuentes = [dict(id=a, p=b, v=c, estado=d, f=e, url=g) for a, b, c, d, e, g in F]

tpl = open(P('template.html'), encoding='utf8').read()
core = open(P('core.js'), encoding='utf8').read()
core = re.sub(r'^export ', '', core, flags=re.M)
main = open(P('main.js'), encoding='utf8').read()
tle = open(P('starlink_snapshot.tle'), encoding='utf8').read()
assert '</script' not in tle
html = tpl.replace('/*CORE*/', core).replace('/*MAIN*/', main).replace('%%TLE%%', tle).replace('%%FUENTES%%', json.dumps(fuentes, ensure_ascii=False).replace('</', '<\\/'))
open(OUT, 'w', encoding='utf8', newline='\n').write(html)
print('escrito', OUT, f'{len(html)/1e6:.2f} MB')
