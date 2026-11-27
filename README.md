# Starmind × Rubin

Prototipo visual para estudiar el impacto de la megaconstelación **Starmind** de SpaceX (hasta 1.000.000 de satélites de cómputo orbital, autorizada por la FCC el 25-nov-2026, DA 26-1273) sobre el **Observatorio Vera C. Rubin** (Cerro Pachón).

**Abrir el simulador:** https://REPO_URL/

## Qué hace

- Vista global 3D de la Tierra con día/noche, dirección del Sol y satélites coloreados según estén iluminados o en sombra (cilíndrica o cónica).
- 1.026.289 satélites propagados en la GPU: Starmind (órbitas circulares con J2 secular), Starlink actual (TLE reales con SGP4) y Gen2 autorizado.
- Cielo en ojo de pez desde Cerro Pachón, con círculos de 30° y 60°.
- Simulador de Rubin: campo de LSSTCam, exposición de 30 s, conteo de trazas, imagen CCD sintética, pérdida de píxeles y estadística sobre N apuntados aleatorios.
- Gráfico de la noche, editor de capas, rango de brillo (optimista/central/pesimista) y panel «Fuentes y supuestos» con cada parámetro marcado CONFIRMADO / SUPUESTO / DERIVADO.
- Modo diagnóstico en la página (`?diag=1`): pruebas contra soluciones analíticas, astropy, Python independiente y la literatura.

Requiere un navegador con WebGL2 y conexión a internet (Three.js, satellite.js y texturas vía jsDelivr). Con GPU dedicada corre a >100 fps.

## Documentación

- [`FASE1_FASE2.md`](FASE1_FASE2.md): tabla de fuentes y supuestos, arquitectura, casos de verificación a mano y plan de pruebas.
- [`FASE3_FASE4.md`](FASE3_FASE4.md): uso, resultados del diagnóstico, limitaciones y qué cambiaría con mejores datos.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Simulador completo en un solo archivo (lo que sirve GitHub Pages) |
| `desarrollo/` | Fuentes: `core.js` (física), `main.js` (interfaz), `template.html`, `build.py` (regenera `index.html`), `test_core.mjs` (pruebas del núcleo con Node) |
| `referencia/` | Textos FCC, lista de subcapas de McDowell, snapshot GP de Starlink del 26-nov-2026 y scripts Python de referencia |

Para regenerar el HTML tras editar las fuentes:

```
cd desarrollo
python build.py ../index.html
node test_core.mjs
```

## Advertencia

Es un modelo de estado estacionario idealizado. Los parámetros no públicos (LTAN de las órbitas heliosincrónicas, reparto por capa, brillo del satélite AI1) son supuestos declarados y configurables. El brillo (rango de ~3 mag) domina la incertidumbre. Ver las limitaciones en `FASE3_FASE4.md`.
