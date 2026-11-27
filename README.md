# Starmind × Rubin

**Español** · [English](README.en.md)

Simulador 3D interactivo para estudiar el impacto de la megaconstelación **Starmind** de SpaceX sobre las observaciones del **Observatorio Vera C. Rubin** (Cerro Pachón, Chile). Starmind contempla hasta 1.000.000 de satélites de cómputo orbital; la FCC la autorizó el 25-nov-2026 (DA 26-1273).

### ▶ [Abrir el simulador](https://hungerforcoffe.github.io/starmind_demonstration/)

Corre en el navegador y no hay que instalar nada. La interfaz está en español.

---

## Motivación

Los estudios existentes sobre megaconstelaciones y astronomía (Tyson et al. 2020; Hainaut & Williams 2020; Bassa et al. 2022) trabajan con decenas de miles de satélites. Starmind sube la escala en más de un orden de magnitud y agrega capas heliosincrónicas que siguen iluminadas durante el crepúsculo. Este proyecto busca dos cosas:

1. **Ver** la constelación completa a escala real, alrededor de la Tierra y en el cielo de Rubin, en cualquier fecha y hora.
2. **Cuantificar** su efecto en las imágenes de LSSTCam (trazas por exposición, saturación y fracción de píxeles perdidos) con una cadena de cálculo trazable. Cada parámetro indica su fuente y si es un dato confirmado o un supuesto.

## Resultados principales (noche del 26/27-nov-2026)

| Magnitud | Starmind (1M, M₁₀₀₀ = 5,7) | Starlink actual (11.189) |
|---|---|---|
| Satélites iluminados sobre 30° al fin del crepúsculo (22:01, hora de Chile) | ~6.400 | ~30–50 |
| Trazas por exposición de 30 s, apuntados aleatorios en crepúsculo | media 28; 67 % de las exposiciones con ≥ 1 traza | ~0,3 |
| Iluminados sobre 30° entre ~23:45 y ~03:15 | 0 | 0 |

- **El impacto se concentra en el crepúsculo.** Desde Rubin, a medianoche la sombra de la Tierra sobre el cenit nunca baja de ~1.550 km, y Starmind orbita a ≤ 1.002 km. Por eso los satélites afectan sobre todo las primeras y últimas 2–3 horas de la noche, y en el lado del cielo hacia el Sol.
- **Exposición de ejemplo:** alt 45°, az 10°, banda r, 22:04. Aparecen 85 trazas y la más brillante es de V = 5,1. Ninguna satura, pero se pierde ~8,5 % de los píxeles, coherente con el 5–10 % que informan Jangid et al. (2026).
- **La mayor incertidumbre es el brillo.** El brillo intrínseco del satélite AI1 no se ha medido; el rango plausible es M₁₀₀₀ = 2,7–6,0, unas 3 magnitudes. Ese rango pesa más que cualquier incertidumbre geométrica.

## Qué incluye

**Vista global («ojo de Dios»)**
- Tierra con día y noche, dirección del Sol y órbita libre de la cámara.
- Cada satélite se colorea según esté iluminado o en sombra. La sombra puede ser cilíndrica o cónica con penumbra.
- Hay ~1.026.000 satélites, todos propagados en la GPU en cada cuadro:
  - **Starmind:** 114 subcapas en 6 grupos orbitales.
  - **Starlink actual:** TLE reales propagados con SGP4.
  - **Starlink Gen2:** las capas autorizadas.

**Cielo desde Cerro Pachón**
- Proyección de ojo de pez con círculos de altura de 30° y 60°.
- Magnitud límite configurable y opción de mostrar los satélites en sombra.

**Simulador de Rubin**
- Campo de LSSTCam (radio 1,75°, 189 CCD). Se apunta haciendo clic en el cielo o ingresando alt/az o AR/Dec.
- La exposición de 30 s calcula:
  - las trazas que cruzan el campo;
  - la magnitud V y la magnitud en la banda LSST elegida;
  - el pico en electrones con desenfoque, y si satura;
  - una imagen CCD sintética con máscaras;
  - la fracción de píxeles perdidos.
- «Estadística» repite la exposición en N apuntados aleatorios y entrega media, percentiles y la fracción de exposiciones afectadas.

**Gráfico de la noche**
- Iluminados sobre 30° y trazas por exposición a lo largo de toda la noche, por escenario.
- Escala logarítmica, tooltip y tabla de datos.

**Controles**
- Fecha y hora, velocidad, reproducir/pausa.
- Atajos a «fin del crepúsculo», «medianoche solar» y «solsticio de invierno».
- Activar o desactivar cada escenario, y un deslizador de fracción desplegada que sigue los hitos de la FCC (10 % en 2035, 50 % en 2038, 100 % en 2040).
- Rango de brillo optimista / central / pesimista y función de fase opcional (Mallama 2023).

**Editor de capas**
- Permite cambiar la altitud, la inclinación, N, los planos y el LTAN de cada subcapa.
- Trae dos presets: FCC escalado a 1M y Jangid et al. 2026.

**Panel «Fuentes y supuestos»**
- Cada parámetro del modelo con su estado (CONFIRMADO, SECUNDARIA, SUPUESTO, DERIVADO, MODELO o NO PÚBLICO) y un enlace a la fuente.

**Modo diagnóstico**
- Pruebas automáticas dentro de la página, cada una con resultado PASA o FALLA.

### Parámetros de URL

| Parámetro | Efecto |
|---|---|
| `?diag=1` | Corre el diagnóstico al cargar |
| `?t=2026-11-27T01:00:00Z` | Abre en una fecha y hora UTC concreta (por defecto, el fin del crepúsculo astronómico de hoy) |

## Modelo físico

| Componente | Implementación |
|---|---|
| Órbitas Starmind / Gen2 | Circulares, con precesión secular J2 del nodo y del argumento de latitud. Las capas heliosincrónicas mantienen el RAAN fijo respecto del Sol (LTAN 18:00 / 06:00) |
| Starlink actual | SGP4 (satellite.js) sobre los TLE de CelesTrak; snapshot incluido o descarga en vivo |
| Tiempo y marcos | GMST IAU-82, precesión IAU 1976, observador WGS-84 |
| Sol | Fórmula de baja precisión del Astronomical Almanac (~0,01°) |
| Sombra | Cilíndrica (por defecto) o cónica (umbra/penumbra con transición lineal) |
| Brillo | m = M₁₀₀₀ + 5 log₁₀(ρ/1000 km) − 2,5 log₁₀(f_iluminada), con función de fase opcional |
| Trazas | Intersección del segmento recorrido en 30 s con el campo de LSSTCam, en el plano tangente |
| Fotometría | Punto cero por banda, PSF 0,67″, desenfoque 206265·D/ρ con D = 8,36 m, pozo lleno de 130.000 e⁻ |
| Máscaras | 20″ (normal), 100″ (saturada), CCD completo si m < 2 (convención de Jangid et al. 2026) |

La propagación ocurre en un vertex shader de WebGL, y la misma fórmula está duplicada en JavaScript para los cálculos de la CPU (exposiciones, estadística, gráfico). El diagnóstico verifica que ambas coincidan.

## Supuestos principales

Los datos no públicos se reemplazaron por supuestos declarados que se pueden modificar en la interfaz:

| Parámetro | Valor usado | Estado |
|---|---|---|
| Grupos orbitales (altitud / inclinación) | 6 grupos entre 550 y 1.002 km, a 26–32°, 30° y ~97–99° | Confirmado (FCC DA 26-1273) |
| N por subcapa | Lista de McDowell (1.198.120) escalada ×0,83464 hasta el tope de 1M | Secundaria + supuesto |
| LTAN de las órbitas heliosincrónicas | 18:00 y 06:00 (dawn-dusk) | Supuesto |
| Fase dentro de cada plano | Uniforme, con desfase aleatorio por plano | Supuesto |
| M₁₀₀₀ de Starmind | 6,0 / **5,7** / 2,7 (optimista / central / pesimista), escalado por área desde la V2 Mini | Supuesto derivado |
| Exposición | 30 s continuos, análisis con alt ≥ 30° | Supuesto (convención) |

El detalle completo con citas está en [`FASE1_FASE2.md`](FASE1_FASE2.md) y en el panel de fuentes del simulador.

## Validación

El modo diagnóstico corre 19 pruebas más 1 informativa. Todas pasan en una GPU GeForce GTX 1060 Max-Q:

| Prueba | Obtenido | Referencia |
|---|---|---|
| Satélites sobre el horizonte y sobre 30° para 1.600 satélites a 550 km | 63,5 / 6,19 | 63,5 / 6,2 (Hainaut & Williams 2020) |
| Altura del Sol a la medianoche solar del 26/27-nov-2026 | −38,64° | −38,64° (astropy) |
| Altura de la sombra sobre el cenit | idéntica | R⊕(sec D − 1), analítico |
| Trazas por exposición, caso de Bassa et al. 2022 | 0,247 ± 0,011 | 0,245 (su Ec. 1) |
| Starmind iluminados sobre 30° al fin del crepúsculo | 6.420 | 6.408 (script Python independiente) |
| Posiciones GPU vs CPU | Δ máx. 0,00016° | < 0,01° |
| SGP4 vs caso de verificación de Vallado | Δ = 0 m | ±1 m |
| Rendimiento con ~1.026.000 satélites | 118 fps | ≥ 30 fps |

La tabla completa y la discusión están en [`FASE3_FASE4.md`](FASE3_FASE4.md).

## Limitaciones

- El brillo usa un solo M₁₀₀₀ difuso, sin BRDF y sin destellos especulares de los paneles. El caso pesimista sirve como cota.
- El LTAN de las capas heliosincrónicas es el supuesto que más cambia la distribución en el cielo.
- Las órbitas son idealizadas: estado estacionario, sin arrastre, sin maniobras y sin despliegue progresivo.
- Los apuntados son aleatorios, no la cadencia real del scheduler de LSST (opsim). Por eso las fracciones no se comparan punto a punto con Jangid et al. (2026).
- La pérdida de píxeles es un orden de magnitud, no una cifra precisa.
- Los TLE de Starlink se degradan ~1–3 km por día. Para fechas lejanas conviene usar el escenario Gen2.

## Requisitos

- Navegador moderno con WebGL2 (Chrome, Edge o Firefox) y conexión a internet: Three.js, satellite.js y las texturas de la Tierra se cargan desde jsDelivr.
- Se recomienda una GPU dedicada. Con gráficos integrados funciona, pero a menos fps.

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `index.html` | El simulador completo en un solo archivo (es lo que sirve GitHub Pages) |
| `desarrollo/` | Fuentes: `core.js` (física, sin interfaz), `main.js` (escena, shaders, interfaz), `template.html` (estilos y diseño), `build.py` (genera `index.html`), `test_core.mjs` (pruebas del núcleo con Node) |
| `referencia/` | Textos de la FCC, lista de subcapas de McDowell, snapshot GP de Starlink del 26-nov-2026 y scripts Python de referencia (`reference.py`, `montecarlo.py`) |
| `FASE1_FASE2.md` | Investigación de fuentes, arquitectura, casos verificables a mano y plan de pruebas |
| `FASE3_FASE4.md` | Uso, resultados del diagnóstico, limitaciones y qué cambiaría con mejores datos |

Para regenerar el HTML después de editar las fuentes:

```
cd desarrollo
python build.py
node test_core.mjs
```

## Referencias principales

- FCC DA 26-1273 (25-nov-2026), autorización de Starmind; DA 26-113 (solicitud); DA 26-36 (Starlink Gen2).
- J. McDowell, *Enormous Constellations*, planet4589.org.
- Jangid et al. 2026, arXiv:2610.31772, y su código público.
- Tyson et al. 2020, AJ 160, 226.
- Hainaut & Williams 2020, A&A 636, A121.
- Bassa et al. 2022, A&A 657, A75.
- Mallama et al. 2023, arXiv:2306.06657 (fotometría de la Starlink V2 Mini).
- Ivezić et al. 2019, ApJ 873, 111 (parámetros de LSST).
- CelesTrak, elementos GP de Starlink.
