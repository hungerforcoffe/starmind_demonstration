# Starmind × Rubin — Fase 3 (prototipo) y Fase 4 (verificación)

Fecha: 26-nov-2026. Entregable: **`index.html`**, un solo archivo de 1,85 MB que se abre con doble clic. Necesita internet para Three.js, satellite.js y las texturas de la Tierra (vía jsDelivr). El snapshot de TLE va incrustado.

## Uso rápido

- **Inicio:** la página abre en el fin del crepúsculo astronómico de hoy (22:01 hora de Chile del 26-nov-2026).
- **Reloj:** ▶ avanza el tiempo. Hay atajos para fin del crepúsculo, medianoche solar y solsticio de invierno.
- **Apuntar:** clic en el cielo (ojo de pez), o escribir alt/az o RA/Dec (J2000).
- **Exponer:** «Simular exposición» genera trazas, imagen CCD y pérdida de píxeles. «Estadística» repite la exposición en N apuntados aleatorios.
- **Gráfico de la noche:** pestaña inferior. Tarda unos 25 s con paso de 15 min.
- **Diagnóstico:** pestaña inferior, o abrir con `index.html?diag=1`.
- **Editor de capas:** permite cambiar altitudes, inclinaciones, N, planos y LTAN. Trae los presets FCC (escalado a 1M) y Jangid et al. 2026.
- **`desarrollo/`:** fuentes separadas (`core.js` = física, `main.js` = interfaz) y `build.py` para regenerar el HTML. `node test_core.mjs` corre las pruebas del núcleo sin navegador.

## Resultados del diagnóstico

Corrida en Edge, en este portátil (NVIDIA GeForce GTX 1060 Max-Q, Direct3D 11), sobre el archivo final: **19 pasan, 0 fallan, 1 informativa.**

| # | Prueba | Obtenido | Esperado | Estado |
|---|---|---|---|---|
| T1a | Casquete analítico vs Hainaut & Williams 2020, Tabla 1 | 63,5 / 6,19 | 63,5 / 6,2 | PASA |
| T1b | Capa uniforme de 10⁶ satélites a 550 km (pipeline) | 39.822 / 3.934 | 39.693 / 3.866 | PASA |
| T1b | Ídem a 1.000 km | 68.084 / 10.131 | 67.768 / 10.084 | PASA |
| T2a | Sol a medianoche solar del 26/27-nov | −38,64° a las 04:30 UTC | −38,64° a las 04:30 UTC (astropy) | PASA |
| T2b | Fin del crepúsculo astronómico | 01:00 UTC | 01:01 UTC | PASA |
| T2c | Sol el 21-jun-2027 a las 04:45 UTC | −83,19° | −83,19° (astropy) | PASA |
| T3 | Sombra sobre el cenit con el Sol a −12/−18/−24/−30/−38,6° (cilíndrica) | 142,5 / 328,2 / 603,6 / 986,7 / 1.783,1 km | R⊕(sec D − 1), idéntico | PASA |
| T3 | Ídem, umbra cónica | 136,1 / 318,2 / 589,3 / 967,2 / 1.753,1 km | Analítico, idéntico | PASA |
| T4a | Bassa et al. 2022: 10⁴ satélites, 1.000 km, 53°, cenit, 30 s, 2.000 épocas | 0,247 ± 0,011 trazas | 0,245 (su Ec. 1) | PASA |
| T4b | Hainaut & Williams 2020, simulación discreta | 64,21 / 6,29 | 63,5 / 6,2 | PASA |
| T4c-1 | Starmind 1M: iluminados sobre 30° a las 22:01 hora de Chile | 6.420 | 6.408 (Python independiente) | PASA |
| T4c-2 | Ídem a medianoche solar | 0 | 0 | PASA |
| T4c-3 | Trazas por exposición en 300 apuntados aleatorios, 22:01 hora de Chile | media 28,2 · 67 % afectadas · p50 6 · p90 89 | media 25,5 · 65 % | PASA |
| T4c-4 | Contexto con la literatura | 67 % afectadas en crepúsculo | Jangid: hasta 80 % en una noche · Tyson (48k): 40–90 % | INFO |
| T5 | GPU = CPU (2.000 satélites, shader → textura float) | Δ dirección máx. 0,00016°; Δρ máx. 4 m; 0 discrepancias de iluminación | < 0,01° | PASA |
| T6 | SGP4 (satellite.js) vs caso de verificación de Vallado, TLE 00005 | Δ = 0,0000 m | ±1 m | PASA |
| T7 | Rendimiento con 1.026.289 satélites (vista global + cielo) | **118,6 fps** (114 fps abriendo el archivo directamente) | ≥ 30 fps | PASA |

Notas:
- En T1b y T4b el exceso de ~0,3–1 % viene de que el observador está a 2.663 m; el horizonte geométrico baja un poco.
- En la primera versión T5 falló con 0,074°. La causa era la métrica, no la física: comparaba alt/az, y `asin` en float32 pierde precisión cerca de ±90° (la muestra incluía satélites cerca del nadir). Al comparar vectores de dirección completos, el error real es de 0,00016°.
- Con SwiftShader (render por software) T7 da 0,5 fps. Esa cifra no es representativa: con GPU real son 118 fps.

### Ejemplo de exposición (26-nov-2026, 22:04 hora de Chile, alt 45°, az 10°, banda r, 30 s)

- 85 trazas de Starmind iluminadas; la más brillante es de V = 5,1 (M₁₀₀₀ central = 5,7). Ninguna satura en r, porque el pico es de ~2×10⁴ e⁻ y el pozo lleno de 1,3×10⁵.
- Pérdida de píxeles estimada: **8,5 %**. Coincide con el 5–10 % por noche cerca del crepúsculo que informan Jangid et al. 2026.

### Gráfico de la noche del 26/27-nov-2026 (Starmind 100 %, M₁₀₀₀ = 5,7)

- **Starmind:** ~6.400 iluminados sobre 30° al fin del crepúsculo. Cae a **0 entre ~23:45 y ~03:15** hora de Chile. En crepúsculo da ~25–30 trazas por exposición.
- **Starlink actual:** ~30–50 iluminados sobre 30° en crepúsculo y ~0,3 trazas por exposición. También cae a 0 cerca de la medianoche.
- **Lectura física:** a medianoche, la sombra terrestre sobre el cenit de Rubin nunca baja de ~1.550 km. Como Starmind está a ≤ 1.002 km, el impacto se concentra en las primeras y últimas 2–3 h de la noche y en el lado del cielo hacia el Sol.

## Limitaciones conocidas (con efecto estimado)

1. **Brillo difuso con un solo M₁₀₀₀ y sin BRDF.** No se modelan los destellos especulares de los paneles. Jangid estima 2,5 % de trazas más brillantes que 2 mag. El rango 2,7–6,0 (unas 3 mag) domina la incertidumbre del número de trazas saturadas, mucho más que la geometría.
2. **LTAN de las SSO supuesto en 18:00/06:00.** Es el parámetro desconocido más influyente para la distribución en el cielo. Cambiar a un solo plano o a otra LTAN mueve los arcos SSO decenas de grados.
3. **Reparto del tope de 1M proporcional (S7a).** Si SpaceX deja vacíos G1–G2 (preset Jangid), los iluminados sobre 30° al fin del crepúsculo suben de ~6.400 a ~7.060 (+10 %).
4. **Órbitas sintéticas idealizadas:** circulares con J2 secular, sin arrastre, maniobras ni despliegue progresivo. Representan un estado estacionario, igual que en Jangid.
5. **Starlink:** un snapshot de TLE (o descarga en vivo) se degrada ~1–3 km por día en SGP4. Para años futuros no tiene sentido; usar entonces el escenario Gen2.
6. **Apuntados aleatorios, no cadencia real.** El scheduler de LSST (opsim) concentra en el crepúsculo los apuntados de búsqueda de NEO cerca del Sol. Por eso el P(≥1) "por noche" no es comparable punto a punto con Jangid (hasta 80 %).
7. **Fotometría de trazas y pérdida de píxeles simplificadas:** perfil gaussiano con desenfoque, máscaras rasterizadas a 900 px. La resolución de la máscara introduce un error que no cuantifiqué; la pérdida de píxeles es un orden de magnitud, no una cifra precisa. No se modela crosstalk ni la luz de la Luna.
8. **Precesión IAU 1976 y Sol de baja precisión (0,01°).** Basta para apuntar el campo de 1,75°; no sirve para astrometría.
9. **ICFS inaccesible:** masa, vida útil, Schedule S y Technical Attachment no se leyeron. Nada de eso entra en los cálculos ópticos salvo el área del panel, que se dedujo de 210 kW / 250 W/m².

## Qué cambiaría con mejores datos

| Dato | Efecto en los resultados |
|---|---|
| LTAN real y número de planos por subcapa SSO (Schedule S / ITU) | Reemplaza el supuesto más influyente. Cambia qué zona del cielo y qué estación son las peores. No lo cuantifiqué; se puede explorar en el editor cambiando la LTAN |
| Reparto real de los 1.000.000 por capa | ±10 % en los conteos; más si se concentran en 946–1.002 km, que permanecen iluminados más tiempo |
| Fotometría del primer AI1 en órbita (Q3-2027 según Musk), o un BRDF del fabricante | Reduce el rango de M₁₀₀₀ de ~3 mag a ~0,5 mag y define la fracción de trazas saturadas |
| Política de orientación de paneles (¿se pueden poner de canto cerca del terminador?) | Decide entre los casos central y pesimista: una diferencia de ~3 mag, o un factor ~15 en flujo |
| Cadencia opsim de Rubin en lugar de apuntados aleatorios | Comparación directa con Jangid et al. 2026 y con el uso real del tiempo de crepúsculo |
| Elección operativa de exposición (1 × 30 s o 2 × 15 s) | Efecto pequeño en el conteo de trazas (< 5 %); mayor en la estrategia de enmascarado |
