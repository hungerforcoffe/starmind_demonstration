# Starmind × Rubin — Fase 1 (investigación) y Fase 2 (plan y validación)

Fecha de corte: 26-nov-2026. Todos los números de este documento son reproducibles con los scripts en `referencia/`.

Leyenda de estado:
- **CONFIRMADO**: fuente primaria leída (orden FCC, paper, catálogo).
- **CONF. (secundaria)**: fuente secundaria fiable que cita la primaria; no pude leer la primaria.
- **DERIVADO**: calculado aquí a partir de datos confirmados.
- **SUPUESTO**: no es público; valor elegido con justificación. Queda editable en la interfaz.
- **NO PÚBLICO**: no encontré el dato. No se inventa; se deja configurable o fuera del modelo.

> **Limitación de acceso.** El ICFS de la FCC (licensing.fcc.gov / icfs.fcc.gov) responde "Access Denied" (Akamai) a cualquier acceso automatizado desde aquí. **No pude leer** la solicitud original, el Technical Attachment, el Schedule S, la carta del 29-may-2026 ni las respuestas técnicas. Todo lo que cito de esos documentos viene de cómo los resume la orden DA 26-1273 o de la compilación de J. McDowell. Si puedes bajar esos PDF manualmente (sobre todo la carta del 29-may-2026, pág. 3, y el Technical Attachment), los reviso y actualizo la tabla.

---

## FASE 1 — Tabla de parámetros

### 1. Starmind (SpaceX Orbital Data Center System, call sign S00798)

| # | Parámetro | Valor | Estado | Fuente |
|---|---|---|---|---|
| S1 | Autorización | Hasta **1.000.000** satélites; *granted-in-part / deferred-in-part, with conditions*; adoptada y publicada el 25-nov-2026 | CONFIRMADO | FCC DA 26-1273 (MO&O and Authorization), ICFS SAT-LOA-20260108-00016 |
| S2 | Envolvente orbital | "orbital shells each spanning 50 km at altitudes from 500 to 1,002 km and in 30-degree inclinations and sun-synchronous inclinations" | CONFIRMADO | DA 26-1273, encabezado del Grant |
| S3 | Solicitud original | 30-ene-2026; 500–2.000 km; capas de hasta 50 km; 30° y SSO; waiver del Schedule S para *"orbital plane configurations"* | CONFIRMADO | FCC DA 26-113 (Public Notice, 4-feb-2026) |
| S4 | **6 grupos nominales** (altitud / inclinación) | 550–568 km / 26–32° · 565–585 km / 97,7° · 686–718 km / 30° · 707–744 km / 97,2° · 946–978 km / 30° · 967–1.002 km / 99,4° | CONFIRMADO | DA 26-1273, que cita la carta de SpaceX del 29-may-2026, pág. 3 |
| S5 | Subcapas y satélites por subcapa | 114 subcapas. G1: 10 × 9.990 (i de 32,0° a 26,0° en pasos de 0,67°). G2: 10 × 9.998. G3: 25 × 9.990. G4: 22 × 11.130. G5: 25 × 9.990. G6: 22 × 11.540. **Total 1.198.120** | CONF. (secundaria) | McDowell, *Jonathan's Space Pages: Enormous Constellations* (planet4589.org/space/con/conlist.html), compilado "a partir de la solicitud" |
| S6 | Planos × sat/plano | Capas de 30°: **30 planos × 333**. Capas SSO: **2 planos × 4.999 / 5.565 / 5.770** | CONF. (secundaria) | McDowell (íd.). Jangid et al. 2026 usan los mismos 30 × 333 y 1 plano para las SSO |
| S7 | **Discrepancia de totales** | La compilación suma 1.198.120, pero la FCC autoriza 1.000.000. No es público cómo se recortan esos 198.120. | — | — |
| S7a | Reparto por defecto en la simulación | **Escalado proporcional ×0,83464** en las 114 subcapas, manteniendo planos y bajando sat/plano. Por grupo: 83.381 / 83.447 / 208.452 / 204.370 / 208.452 / 211.899 | SUPUESTO | Es el reparto neutro. Preset alternativo "Jangid": sin G1–G2, 998.240 satélites |
| S8 | Fase dentro del plano y entre planos (Walker F) | No publicado; además, la configuración de planos quedó exenta del Schedule S (condición 7) | NO PÚBLICO → SUPUESTO | Espaciado uniforme en el plano con desfase aleatorio por plano (como Jangid). Opción en la interfaz: Walker con F editable |
| S9 | **LTAN de las SSO** | No publicado | NO PÚBLICO → SUPUESTO | Por defecto, **18:00 y 06:00**, un plano en cada uno (dawn-dusk). Justificación: SpaceX declara SSO "para captar energía solar continua" (spacex.com/starmind, vía Wikipedia "Starmind (satellite)"). Solo las órbitas cercanas al terminador tienen β alto. Ojo: en 565–744 km ninguna LTAN única evita eclipses todo el año; el plano de 18:00 tiene eclipses cerca del solsticio de junio y el de 06:00 cerca del de diciembre. LTAN editable por capa |
| S10 | **Inclinación del G4 (707–744 km, 97,2°)** | La inclinación SSO exacta a esas alturas es **98,22–98,37°** (J2, circular). Con 97,2° el nodo deriva −44 a −50°/año respecto del Sol (≈ −3 h de LTAN por año) | DERIVADO | `referencia/reference.py` §1. Probable errata (98,2 → 97,2) en la carta o en la orden. Los otros grupos SSO calzan con SSO dentro de 0,1° |
| S10a | Tratamiento en la simulación | Geometría con la i registrada (97,2°) y RAAN amarrada al Sol según la LTAN, es decir, se supone que SpaceX mantiene la LTAN. Hay un interruptor para usar la i SSO exacta | SUPUESTO | — |
| S11 | Satélite AI1, versión oct-2026 | Envergadura **75 m**, altura desplegada 30 m, panel solar **210 kW**, radiador líquido **160 m²**, cómputo 250 kW pico / 175 kW medio | CONF. (secundaria) | spacex.com/starmind (página renderizada con JS, no pude leerla) citada por Wikipedia; Spaceflight Now 26-nov-2026 repite 75 m × 30 m |
| S12 | Satélite AI1, borrador jun-2026 | 70 m × 20 m; 150 kW pico / 120 kW medio; radiador 110 m², dos caras, orientado "de canto" (knife-edge) al Sol; supuesto de **250 W/m²** en el panel | CONF. (secundaria) | DCD, 9-jun-2026, que cita a Musk e I. Dahl (SpaceX) |
| S13 | Área de paneles | **840 m²** (210 kW / 250 W/m²); borrador: 600 m² | DERIVADO | S11, S12 |
| S14 | Masa | No encontrada | NO PÚBLICO | Probablemente está en el Technical Attachment (ICFS inaccesible). No afecta la óptica; solo se muestra como "desconocida" |
| S15 | Vida útil del satélite | No encontrada. **No confundir** con el plazo de licencia de 15 años (condición 11) | NO PÚBLICO | — |
| S16 | Hitos de despliegue | 1.er satélite antes del 25-nov-2033; 10 % antes del 25-nov-2035; 50 % antes del 25-nov-2038; 100 % antes del 25-nov-2040 | CONFIRMADO | DA 26-1273, condición 10. En la interfaz: deslizador de "fracción desplegada" |
| S17 | Disposición final | Por debajo de 600 km, reingreso (plan de desechos aprobado). Por encima de 600 km, **diferido**: SpaceX pidió órbitas de disposición o heliocéntricas y debe pedir una modificación antes de desplegar allí | CONFIRMADO | DA 26-1273, condición 4 y ¶11 |
| S18 | "Respuesta técnica de sep-2026 sobre reingreso y colisiones" | **Corrección:** la carta del 16-sep-2026 trata del TT&C de respaldo en banda Ka. El riesgo de víctimas y el reingreso dirigido están en la carta del **7-oct-2026**; desechos y colisiones, en la Consolidated Opposition (16-mar-2026) y en la carta del 29-may-2026 | CONFIRMADO (según las citas de la orden) | DA 26-1273, ¶5, ¶12, ¶13 |
| S19 | Condiciones sobre astronomía óptica | **Ninguna.** La FCC considera suficiente el compromiso de SpaceX de "coordinar con la NSF" y declara fuera de su competencia el IR térmico | CONFIRMADO | DA 26-1273, ¶16–17 |

### 2. Starlink actual (CelesTrak GP, grupo `starlink`, bajado el 26-nov-2026 19:42 CLT)

11.189 objetos con épocas entre el 19 y el 26 de noviembre de 2026. Altitud = a − R_eq, con a obtenido del movimiento medio (Kepler); la convención de altitud "nominal" de la FCC puede diferir en ±15 km a 53°.

| Inclinación (mediana) | Altitud media, km (mediana) | N | Capa autorizada más cercana |
|---|---|---|---|
| 43,00° | 470–495 (483) | **3.223** | Gen2 485 km / 43° |
| 53,16° | 450–482 (463) | **3.944** | Gen1 y Gen2 bajados a la capa de 480 km / 53° |
| 97,28° | 455–475 (466) | **1.447** | Polar SSO (97,27° a 465 km es SSO exacta) |
| 70,00° | 465–482 (475) | 610 | Gen1 70° bajada |
| 53,16° | 340–365 (360) | 453 | Gen2 340 km / 53° |
| 43,00° | 345–362 (352) | 327 | Gen2 355 km / 43° |
| 30,50° | 335–360 (346) | 42 | Lanzamiento 2026-225 (¿V3 desde Starship?, SUPUESTO); está fuera de las capas Gen2 listadas |
| fuera de capas | — | 1.143 | Subiendo, bajando o reingresando |

- 636 objetos llevan "[DTC]" (Direct-to-Cell) en el nombre.
- El LTAN de las Starlink de ~97,3° **no es dawn-dusk**: se agrupa en ~06–10 h y ~18–22 h.
- **Comparación con Gen2 (FCC DA 26-36, 9-ene-2026), estado CONFIRMADO:** 15.000 satélites en 340/53°, 345/48°, 350/38°, 355/43°, 360/96,9°, 365/28 o 32°, 475/28 o 32°, 480/53° y 485/43°, más operación continuada en 525/530/535 km mientras bajan. Máximos de 72 planos × 144 en 340–365 km y 56 × 120 en 480/485 km. **No fija N por capa**: concede "despliegue flexible".
- Hoy están pobladas sobre todo 480/485 km (unos 7.100 satélites) y empieza a llenarse la familia de 340–355 km (unos 800). No veo todavía 345/48°, 350/38°, 360/96,9° ni 365/475 km a 28–32°.
- **Escenario "Gen2 autorizado" (SUPUESTO):** 15.000 repartidos en partes iguales entre las 9 capas nuevas (1.667 por capa), con 32° en 365 y 475 km, 72 planos (340–365 km) o 56 planos (475–485 km) y RAAN uniforme, incluida la SSO de 360 km. El editor permite cambiarlo.

### 3. Brillo

| # | Parámetro | Valor | Estado | Fuente |
|---|---|---|---|---|
| B1 | Starlink V2 Mini en modo de mitigación (en estación) | m aparente media 7,06 (σ 0,91); **M₁₀₀₀ = 7,87 ± 0,09** (σ 0,79) | CONFIRMADO | Mallama et al. 2023, arXiv:2306.06657, Tabla 2 |
| B2 | V2 Mini sin mitigar (subida de órbita) | M₁₀₀₀ = 5,08 (σ 1,70); la mitigación reduce el brillo 12 veces | CONFIRMADO | íd. |
| B3 | Área de la V2 Mini | 116 m² (antena de 11,07 m²) | CONFIRMADO | íd., Tabla 3 |
| B4 | Función de fase de la V2 Mini (todas las observaciones) | M₁₀₀₀(φ) = 2,630 + 0,1065 φ − 0,0005167 φ² | CONFIRMADO | íd., Fig. 5 |
| B5 | Otros Starlink (M₁₀₀₀) | Gen1 original 6,08 · VisorSat 7,00 · V1.5 6,34 · DTC en mitigación 6,47 | CONFIRMADO | Mallama 2023, Tabla 3; Mallama et al. 2025, arXiv:2502.03651 |
| B6 | Deriva secular | VisorSat se aclara 0,12 mag/año (3,1σ); V1.5 0,07 mag/año (no significativo) | CONFIRMADO | Mallama 2026, arXiv:2604.13145 |
| B7 | Límite recomendado | V > 7,0 + 2,5 log₁₀(h/550 km) (SATCON1). IAU CPS: 7 mag AB a 550 km | CONFIRMADO / CONF. (sec.) | Informe SATCON1 (2020); Boley et al. 2025, vía Jangid 2026 |
| B8 | **Escalado a Starmind** | M₁₀₀₀ = M_ref − 2,5 log₁₀(A_eff / A_ref), con la misma reflectividad por unidad de área que la referencia | DERIVADO | — |
| B8a | Optimista | **M₁₀₀₀ = 6,0**: V2 Mini mitigada (7,87) con área de 600 + 25 m² (borrador; paneles + bus) | SUPUESTO trazable | — |
| B8b | Central | **M₁₀₀₀ = 5,7**: V2 Mini mitigada con 840 + 25 m² (AI1 de octubre) | SUPUESTO trazable | — |
| B8c | Pesimista | **M₁₀₀₀ = 2,7**: V2 Mini **sin** mitigar (5,08) con 840 + 25 + 160 m² (radiador iluminado) | SUPUESTO trazable | Argumento físico: un centro de datos no puede girar los paneles de canto para atenuarse sin perder potencia, que es justamente lo que hace Starlink cerca del terminador. Por eso el modo mitigado de Starlink es optimista para Starmind |
| B9 | Contraste con Jangid et al. 2026 | Su modelo BRDF da un pico difuso de unos 6 mag AB y destellos especulares de 2–4 mag; el 2,5 % de las trazas es más brillante que 2. Con el valor central y distancias típicas de 1.000–1.500 km resulta m ≈ 5,7–6,6, compatible con su pico difuso. Su panel está escalado a 400 kW (≈ 1.680 m², el doble que AI1) | DERIVADO | Jangid et al. 2026, arXiv:2610.31772, §2.5 y §3.3 |
| B10 | Paso de V a bandas LSST | m_g ≈ V + 0,25; m_r ≈ V − 0,21; m_i ≈ V − 0,32 (reflectancia gris, espectro solar) | CONFIRMADO | Jangid 2026, Tabla 2 |
| B11 | Destellos especulares | No los representa un solo M₁₀₀₀. El modelo de la Fase 3 es difuso. El valor pesimista sirve de cota y la limitación queda declarada | — | — |

Rango que llevaré a la interfaz: **M₁₀₀₀ ∈ [2,7; 6,0], con 5,7 como valor central**, más la función de fase de B4 como opción, desactivada por defecto. El ancho de unas 3 mag del rango refleja la incertidumbre real; no es un error del modelo.

### 4. Literatura para validar (cifras comparables)

| Trabajo | Configuración | Cifras |
|---|---|---|
| **Tyson et al. 2020**, AJ 160, 226 | 48.000 satélites a 550 km, opsim LSST | ~**30 %** de las imágenes LSST con ≥1 traza. Crepúsculo (−12° a −18°): **40–90 %**. Medianoche: 10–20 % en verano chileno, ~0 en invierno. Unas **2 trazas por exposición** en crepúsculo. Meta de g ≳ 7 a 550 km; crosstalk no lineal sobre 5.000–10.000 e⁻. Con 48.000 satélites de mag 4,5, ~1 % de píxeles enmascarados en crepúsculo náutico |
| **Hainaut & Williams 2020**, A&A 636, A121 | 26.000 satélites, capas uniformes | ~1.600 sobre el horizonte y ~250 sobre 30° en latitudes medias. Al final del crepúsculo astronómico: ~1.100 iluminados sobre el horizonte y ~150 sobre 30°. LSST: **30–40 %** de exposiciones comprometidas en la primera y última hora; ~50 % en crepúsculo. Tabla 1: Starlink 1.600 satélites a 550 km → **4,0 % (63,5) sobre el horizonte y 0,4 % (6,2) sobre 30°** |
| **Bassa et al. 2022**, A&A 657, A75 | Analítico, Ec. 1: N_trazas = ρ (A_FOV + L_FOV ω t) | Caso discreto de su Fig. 3: 10.000 satélites, 100 × 100, 1.000 km, 53°, observador a −30°, cenit. SST/LSSTCam con 15 s, Sol a −20°, equinoccio, más de 60.000 satélites: **0,41 trazas por exposición y 22 % de pérdida**. Densidad de capa inclinada P(φ, i, h) = [2π² (R+h)² √(sin² i − sin² φ)]⁻¹ |
| **Jangid et al. 2026**, arXiv:2610.31772 (Rawls, Yoachim, Walker, Eggl; IAU CPS) | 998.240 satélites ODC (4 regímenes, 686–1.002 km), un año de opsim LSST | Hasta **80 %** de los apuntados de una noche con ≥1 traza iluminada; media anual de **~20 %**. ~9×10⁶ trazas iluminadas por año (≤12,5 mag), 83,9 % más brillantes que 7 mag. En crepúsculo, mediana de **~100 trazas visibles simultáneas** por apuntado (media 295). Pérdida media de píxeles de 5–10 % por noche cerca del crepúsculo. Con 10 % desplegado: 2,33 % |
| **SATCON1** (2020) | Recomendaciones | Altitud < 600 km; V > 7 + 2,5 log₁₀(h/550) |
| IAU CPS | Recomendaciones consolidadas | 7 mag AB a 550 km. No leí el documento primario (cps.iau.org); lo cito vía Jangid 2026 |

> **Advertencia metodológica sobre Jangid et al. 2026** (verificada en su código público, `Step1.py`, función `make_tles_for_shell`):
> - Las capas SSO se generan con **RAAN = 0° fijo** (en TEME) cada día a mediodía UTC, sin relación con el Sol. Su LTAN efectivo recorre las 24 h a lo largo del año (≈ 20 h en noviembre). Por eso su resultado estacional para las SSO, por ejemplo "julio con menos SSO visibles", depende de esa elección y no de una órbita dawn-dusk.
> - Usan i = 97,1–98,2° en la capa de 707–744 km, contra 97,2° en el registro.
> - Fase en el plano: uniforme con un desfase aleatorio, más un argumento de perigeo aleatorio. En la práctica, la fase a lo largo de la órbita es aleatoria.
> - No incluyen los grupos de 550–585 km.
>
> Conclusión: sirve como orden de magnitud, no para una comparación punto a punto en las SSO. La interfaz tendrá un preset "Jangid" (mismas capas y RAAN = 0 fijo) para reproducirlos y luego comparar con el caso amarrado al Sol.

### 5. Rubin

| # | Parámetro | Valor | Estado | Fuente |
|---|---|---|---|---|
| R1 | Sitio | Latitud −30,2446°, longitud −70,7494°, 2.663 m (Jangid: 30°14′40,70″S, 70°44′57,90″W = −30,24464°, −70,74942°) | CONFIRMADO | Jangid 2026, §2.4 |
| R2 | Campo de LSSTCam | 9,6 deg²; 3,5° de diámetro (radio 1,75°); 189 CCD de 4k × 4k; 0,2″/px | CONFIRMADO | Tyson 2020; Jangid 2026 |
| R3 | Óptica para la imagen sintética | D = 8,36 m; A_eff = 33,1 m²; PSF 0,67″; desenfoque θ_def = 206265·D/s; pozo lleno 130.000 e⁻; ZP y throughput por banda (Tabla 2) | CONFIRMADO | Jangid 2026, §2.6–2.7 |
| R4 | Exposición | Los baselines de rubin_sim v2–v4 usan 2 × 15 s en grizy (variante one_snap: 1 × 29,2 s) y u = 1 × 38 s. No pude verificar la elección operativa actual | CONF. (secundaria) | Resultado de búsqueda sobre baselines de rubin_sim (SCOC). Por defecto **30 s continuos**, con interruptor a 2 × 15 s (pausa de 2 s). El número de trazas cambia poco, porque la travesía típica del campo dura 5–8 s, más que la pausa |
| R5 | Límites de altura | Telescopio: 15°–86,5° | CONF. (secundaria) | Jangid 2026, Fig. 2, que cita rubinobservatory.org |
| R5a | Límite "práctico" | El WFD observa mayoritariamente con masa de aire < 1,5 (alt > 41,8°); no lo verifiqué en esta sesión | SUPUESTO | Por defecto el corte de análisis es **alt ≥ 30°** (convención de Hainaut y Bassa), editable |

---

## FASE 2 — Arquitectura, traza de cálculo y pruebas

### A. Arquitectura (un solo `index.html`, ES modules desde CDN, sin compilación)

```
index.html
├─ <script type="importmap">  three@0.160 (jsdelivr), satellite.js@5 (jsdelivr)
├─ datos embebidos
│   ├─ FUENTES[]            ← tabla de la Fase 1 (alimenta el panel "Fuentes y supuestos")
│   ├─ STARMIND_SHELLS[]    ← 114 subcapas (McDowell) + presets (escalado 1M, Jangid, editable)
│   ├─ GEN2_SHELLS[]        ← 9 capas (DA 26-36) con N supuesto
│   └─ STARLINK_TLE_SNAPSHOT (26-nov-2026, ~1,6 MB) + intento de fetch en vivo a CelesTrak (CORS *)
├─ astro (float64, CPU): JD, GMST (IAU-82), Sol (Almanaque, 0,01°), WGS-84, ECI↔ECEF↔ENU, sombra cil./cónica
├─ prop
│   ├─ GPU: THREE.Points con 1M vértices; atributos por satélite (a, i, Ω₀ o LTAN, u₀, u̇, Ω̇, flags)
│   │       vertex shader = órbita circular + J2 secular; Ω de las SSO = α☉(t) + 15°·(LTAN − 12 h)
│   │       el mismo shader se usa en 3 modos: god's eye | ojo de pez | "probe" (escribe a textura float)
│   ├─ CPU espejo (float64) de las mismas fórmulas: para el simulador de Rubin, la estadística y el diagnóstico
│   └─ SGP4 (satellite.js) para Starlink real: unos 11k objetos a 2 Hz en la vista y a 0,25 s en la exposición
├─ vistas
│   ├─ god's eye: Tierra (texturas día/noche de three.js examples, terminador en shader), vector Sol,
│   │             satélites coloreados iluminado/sombra, cono del FOV de LSSTCam desde Cerro Pachón
│   ├─ observador: proyección azimutal equidistante (r ∝ distancia cenital), color por magnitud,
│   │              círculos de 30° y 60°, Sol y Luna bajo el horizonte indicados
│   └─ CCD: canvas 2D con el plano focal (21 rafts, 189 CCD), trazas con ancho θ_eff y e⁻ a partir de m_b
├─ rubin
│   ├─ apuntado alt/az o RA/Dec → exposición de 30 s: candidatos (sats a <20° del eje en t₀, t₀+15, t₀+30)
│   │   → muestreo fino de 0,25 s + intersección segmento-cono exacta → lista de trazas (m, ω, longitud)
│   └─ estadística: N apuntados uniformes en ángulo sólido sobre alt_min → media de trazas, P(≥1), p50, p90
├─ noche: cada 10 min entre el ocaso y el orto → iluminados >30° y trazas por exposición, por escenario
├─ controles: fecha/hora (UTC y CLT), velocidad del reloj, play/pausa, atajos (fin del crepúsculo astronómico,
│             medianoche solar, solsticio de invierno), escenarios, fracción desplegada, editor de capas, M₁₀₀₀
└─ diagnóstico: corre T1–T7 y muestra pasa/falla con valor obtenido, esperado y tolerancia
```

**Rendimiento.** Un millón de puntos con un vertex shader de unas 40 operaciones trigonométricas es poco para cualquier GPU integrada moderna (unos 40 M de operaciones por cuadro). El cuello de botella son el blending y el tamaño de los puntos, así que uso puntos de 1–2 px sin blending aditivo en la vista global.

**Precisión.** El tiempo entra al shader como t_rel en segundos desde una época de referencia que se reinicia en cada salto de fecha (|t_rel| < 2 días): el error de u en float32 es menor que 0,003°. El simulador de Rubin y el conteo de trazas corren en CPU con float64.

### B. Traza paso a paso para un satélite (lo que hará el shader y su espejo en CPU)

Para un instante UTC t:

1. **Tiempo:** JD = t_unix/86400 + 2440587,5. GMST = 67310,54841 s + (876600·3600 + 8640184,812866) T + 0,093104 T² − 6,2×10⁻⁶ T³, con T = (JD − 2451545)/36525; luego θ = (GMST mod 86400)/240 grados.
2. **Sol:** con n = JD − 2451545, L = 280,460 + 0,9856474 n y g = 357,528 + 0,9856003 n. Entonces λ = L + 1,915 sin g + 0,020 sin 2g y ε = 23,439 − 4×10⁻⁷ n. El vector unitario es ŝ = (cos λ, cos ε sin λ, sin ε sin λ) y α☉ = atan2(cos ε sin λ, cos λ).
3. **Elementos medios:** a = R⊕ + h, n = √(μ/a³) y k = J₂ (R⊕/a)².
   - u̇ = n[1 + ¾ k (2 − 3 sin² i)] + ¾ n k (4 − 5 sin² i).
   - Ω̇ = −3/2 n k cos i.
   - Ω(t) = Ω₀ + Ω̇ Δt; en una SSO amarrada al Sol, Ω(t) = α☉(t) + 15°·(LTAN − 12).
   - u(t) = u₀ + u̇ Δt.
4. **Posición ECI:** r = a·(cos Ω cos u − sin Ω sin u cos i, sin Ω cos u + cos Ω sin u cos i, sin u sin i).
5. **ECEF:** rotación R_z(θ). Observador WGS-84: N = a/√(1 − e² sin² φ), r_obs = ((N+h) cos φ cos λ, (N+h) cos φ sin λ, (N(1−e²)+h) sin φ).
6. **Topocéntrico ENU:** d = r_ECEF − r_obs. Altura = asin(d_U/|d|), azimut = atan2(d_E, d_N) y distancia ρ = |d|.
7. **Sombra cilíndrica:** p = r·ŝ. El satélite está iluminado si p > 0 o |r|² − p² > R⊕². En la **cónica**, la umbra tiene radio R⊕ − x tan α_u y la penumbra R⊕ + x tan α_p, con x = −p, α_u = asin((R☉ − R⊕)/d☉) ≈ 0,264° y α_p ≈ 0,269°. La diferencia con el modelo cilíndrico es de unos ±10–20 km en el borde de la sombra.
8. **Magnitud:** m_V = M₁₀₀₀ + 5 log₁₀(ρ/1000 km) + [opcional: Φ(φ) − Φ(φ_ref)], con el ángulo de fase φ = acos(ŝ · (r_obs − r)/|r_obs − r|). En banda LSST: m_b = m_V + Δ_b (B10).
9. **Traza en la exposición:** se calculan los vectores topocéntricos en t₀ … t₀ + 30 s cada 0,25 s. La traza se cuenta si algún segmento entra al cono de 1,75° alrededor del apuntado **y** el satélite está iluminado en ese tramo. Se guardan la longitud dentro del campo, ω y la m más brillante.

#### Caso numérico 1 — verificable a mano (satélite cerca del cenit)
- **Datos:** capa de 686 km, i = 30°, instante 2026-11-27 01:01 UTC (22:01 CLT, fin del crepúsculo astronómico).
- **Tiempo y Sol:** JD = 2461371,542361; GMST = 81,2162°; Sol en Cerro Pachón a −18,12°.
- **Elementos elegidos:** Ω = 100,49° y u = 269,98° (el punto del plano más alto sobre Rubin).
- **Posición:** r_ECI = (6015,9; 1111,4; −3532,1) km. Altura = 89,04° (una órbita de 30° no llega al cenit exacto de −30,24°), azimut = 0,03°.
- **Distancia, a mano:** ρ ≈ h − h_obs = 686 − 2,66 ≈ 683 km. El código da 688,8 km; los 6 km de diferencia vienen de R_geodésico ≠ R_eq a −30° y del cenit no exacto.
- **Sombra, a mano:** la altura de la sombra sobre el cenit es R⊕(sec 18,12° − 1) = 6378·(1,0522 − 1) ≈ 333 km, menor que 686 km, así que el satélite está **iluminado**. En el código: p = r·ŝ = −2214,8 km (lado nocturno) y distancia al eje Tierra-Sol 6708,0 km > 6378,1 km. Con el modelo cónico, el radio de la umbra a x = 2215 km es 6367,8 km; sigue iluminado.
- **Fase:** 71,3°.
- **Magnitud:** m = M₁₀₀₀ + 5 log₁₀(0,6888) = M₁₀₀₀ − 0,81. Resultado: **5,19 (optimista) / 4,89 (central) / 1,89 (pesimista)**.
- **Velocidad aparente, a mano:** ω ≈ v/ρ = 7,512/688,8 rad/s = 0,625°/s (sin la rotación terrestre), unos **18,7° en 30 s**. Cruza los 3,5° del campo en unos 5,6 s.

#### Caso numérico 2 — SSO dawn-dusk en crepúsculo náutico
- **Datos:** capa de 967 km, i = 99,4°, LTAN 18:00, instante 2026-11-27 00:30 UTC.
- **Tiempo y Sol:** JD = 2461371,520833; GMST = 73,4450°; α☉ = 242,8069°, δ☉ = −21,0844°.
- **Plano:** Ω = α☉ + 90° = 332,8069°. El punto del plano más alto sobre Rubin está en u = 323,00°, con altura **11,77°**, azimut 245,6° y distancia 2.577 km. Está iluminado, con fase 153,7°; el Sol está a −12,74°.
- **Magnitud central:** 5,7 + 5 log₁₀(2,577) = 7,76.
- **Consecuencia:** el plano de las 18:00 queda **bajo, hacia el oeste-suroeste**, y en noviembre no pasa sobre 30°. En noviembre el plano está inclinado 13,8° respecto del terminador, porque n̂·ŝ = sin(i + δ☉). Ese ángulo es estacional. Por eso la LTAN supuesta (S9) es **el parámetro desconocido más influyente** para Rubin, y queda editable y destacado.

### C. Pruebas de validación (modo diagnóstico: pasa/falla con tolerancia explícita)

| Prueba | Qué se compara | Valor esperado | Tolerancia |
|---|---|---|---|
| **T1a** Casquete (analítico) | f(e) = (1 − cos λ)/2, con λ = acos(R⊕ cos e /(R⊕+h)) − e, contra Hainaut & Williams, Tabla 1 | 1.600 satélites a 550 km → **63,5** sobre el horizonte y **6,2** sobre 30° (se obtiene 63,5 y 6,2) | ±0,5 % |
| **T1b** Casquete (simulación) | Capa uniforme sintética de 10⁶ satélites a 550 y 1.000 km, contada con el pipeline CPU y con el GPU (probe) | 550 km: 3,97 % y 0,387 %. 1.000 km: 6,78 % y 1,008 % | 3σ de Poisson |
| **T2** Sol | Altura en Cerro Pachón | Medianoche solar 2026-11-27 **04:30 UTC: −38,64°** (astropy: −38,64°, Δ = 0,002°). Fin del crepúsculo astronómico el 26-nov: **22:01 CLT**. 2027-06-21 04:45 UTC: −83,19° | ±0,05°; ±2 min |
| **T3** Sombra | Satélites de prueba en el cenit, h barrido: el cambio iluminado/sombra debe ocurrir en h_s = R⊕(sec D − 1) | D = 12° → 142 km · 18° → 328 km · 24° → 604 km · 30° → 987 km · 38,6° → 1.783 km | ±3 km (cilíndrico); ±25 km (cónico) |
| **T4a** Literatura (Bassa 2022) | Su constelación discreta (10.000 = 100 × 100, 1.000 km, 53°), cenit en Rubin, LSSTCam a 30 s, 2.000 épocas aleatorias. Se compara el número de trazas contra su Ec. 1 | ρ = 4,54×10⁻³ sats/deg² y ω = 0,42°/s → **0,245 trazas por exposición** | ±15 % (el error de Poisson de la media es de ±4,5 % a 1σ; la Ec. 1 ignora la rotación terrestre) |
| **T4b** Literatura (H&W 2020) | Igual que T1a, pero con la simulación discreta | 63,5 / 6,2 | 3σ |
| **T4c** Contexto, no pasa/falla | Starmind 1M a −18° y apuntados aleatorios sobre 30°, contra Jangid ("hasta 80 %", mediana de ~100 en crepúsculo) y Tyson (40–90 % en crepúsculo con 48k) | Predicción independiente en Python (`montecarlo.py`): **media de 25,5 trazas, P(≥1) = 65 %, p50 = 3, p90 = 83** el 26-nov a las 22:01 CLT; a las 21:30 CLT, 29,1 y 69 %; a medianoche solar, **0** | Se informa la razón; se marca si difiere más de un factor 3 |
| **T5** GPU = CPU | Muestra de 2.000 satélites renderizados a una textura float: alt/az/iluminación del shader contra CPU float64 | Coincidencia | Δ < 0,01°; iluminación idéntica salvo a < 1 km del borde |
| **T6** SGP4 | satellite.js contra el caso de verificación de Vallado (TLE 00005, t = 0 min) | r = (7022,465; −1400,083; 0,040) km | ±1 m |
| **T7** Rendimiento | fps medidos con 1M satélites en la vista global | ≥ 30 fps | Se informa el valor medido |

Predicción adicional para comparar en la Fase 4 (Python, mismo modelo, 26/27-nov-2026). "Iluminados" = sombra cilíndrica.

| Escenario | Instante | Sobre el horizonte | Sobre 30° | Iluminados sobre el horizonte | Iluminados sobre 30° |
|---|---|---|---|---|---|
| 1M, 6 grupos, LTAN 18/06 | 22:01 CLT (Sol −18,1°) | 42.400 | 6.612 | 28.917 | **6.408** |
| | 01:30 CLT (Sol −38,6°) | 33.262 | 6.521 | 57 | **0** |
| Preset Jangid (998.240) | 22:01 CLT | 45.638 | 7.164 | 32.096 | 7.060 |

Lectura física: desde Rubin, **la altura de la sombra sobre el cenit a medianoche nunca baja de unos 1.550 km** (depresión mínima del Sol a medianoche = 90° − 30,2° − 23,4° = 36,4°, y R⊕(sec 36,4° − 1) ≈ 1.546 km). Por eso Starmind (≤ 1.002 km) **nunca** está iluminado cerca del cenit a medianoche; todo el impacto se concentra en las primeras y últimas 2–3 h de la noche y hacia el horizonte del lado del Sol. Esto calza cualitativamente con Tyson 2020 y Jangid 2026.

### D. Decisiones que tomé (recomendaciones; cámbialas si no estás de acuerdo)

1. **Starmind por defecto:** 6 grupos de la orden de la FCC, con subcapas de McDowell escaladas a 1.000.000. El preset Jangid queda para validar.
2. **SSO por defecto:** LTAN 18:00 y 06:00 (un plano en cada uno), con RAAN amarrada al Sol. El G4 usa la i registrada (97,2°) con la LTAN mantenida.
3. **Brillo:** M₁₀₀₀ = 5,7 (central), con rango 2,7–6,0; la función de fase está desactivada por defecto.
4. **Starlink actual:** TLE reales con SGP4 (snapshot embebido más actualización en vivo). M₁₀₀₀ por generación según la fecha de lanzamiento y el sufijo [DTC].
5. **Gen2 autorizado:** 15.000 repartidos en partes iguales entre las 9 capas nuevas (sintético, editable).
6. **Rubin:** exposición de 30 s continuos, FOV con radio de 1,75° y corte de análisis en alt ≥ 30°.
