# Starmind × Rubin

[Español](README.md) · **English**

Interactive 3D simulator for studying how SpaceX's **Starmind** megaconstellation affects observations at the **Vera C. Rubin Observatory** (Cerro Pachón, Chile). Starmind covers up to 1,000,000 orbital compute satellites; the FCC authorized it on 25 Nov 2026 (DA 26-1273).

### ▶ [Open the simulator](https://hungerforcoffe.github.io/starmind_demonstration/)

It runs in the browser with nothing to install. The interface is in Spanish (see the glossary below).

---

## Motivation

Existing studies of megaconstellations and astronomy (Tyson et al. 2020; Hainaut & Williams 2020; Bassa et al. 2022) deal with tens of thousands of satellites. Starmind is more than an order of magnitude larger and adds sun-synchronous shells that stay sunlit through twilight. The project aims to:

1. **See** the full constellation at true scale, around the Earth and in Rubin's sky, at any date and time.
2. **Quantify** its effect on LSSTCam images (streaks per exposure, saturation and lost-pixel fraction) through a traceable calculation chain. Every parameter is tagged with its source and whether it is confirmed data or an assumption.

## Key results (night of 26/27 Nov 2026)

| Quantity | Starmind (1M, M₁₀₀₀ = 5.7) | Current Starlink (11,189) |
|---|---|---|
| Sunlit satellites above 30° at end of astronomical twilight (22:01 Chile time) | ~6,400 | ~30–50 |
| Streaks per 30 s exposure, random twilight pointings | mean 28; 67 % of exposures with ≥ 1 streak | ~0.3 |
| Sunlit above 30° between ~23:45 and ~03:15 | 0 | 0 |

- **The impact is concentrated in twilight.** Seen from Rubin, the Earth's shadow above the zenith never drops below ~1,550 km at midnight, while Starmind orbits at ≤ 1,002 km. The satellites therefore mostly affect the first and last 2–3 hours of the night, on the sunward side of the sky.
- **Example exposure:** alt 45°, az 10°, r band, 22:04. It shows 85 streaks, the brightest at V = 5.1. None saturate, but ~8.5 % of pixels are lost, in line with the 5–10 % reported by Jangid et al. (2026).
- **Brightness is the largest uncertainty.** The AI1 satellite's intrinsic brightness has not been measured; the plausible range is M₁₀₀₀ = 2.7–6.0, about 3 magnitudes. That range outweighs any geometric uncertainty.

## Features

**Global view ("god's eye")**
- Earth with day and night, the Sun direction and a free-orbit camera.
- Each satellite is colored by whether it is sunlit or in shadow. The shadow can be cylindrical or conical with penumbra.
- About 1,026,000 satellites, all propagated on the GPU every frame:
  - **Starmind:** 114 subshells in 6 orbital groups.
  - **Current Starlink:** real TLEs propagated with SGP4.
  - **Starlink Gen2:** the authorized shells.

**Sky from Cerro Pachón**
- Fisheye projection with 30° and 60° altitude circles.
- Adjustable limiting magnitude and an option to show satellites in shadow.

**Rubin simulator**
- LSSTCam field (1.75° radius, 189 CCDs). Point it by clicking the sky or entering alt/az or RA/Dec.
- The 30 s exposure computes:
  - the streaks crossing the field;
  - the V magnitude and the magnitude in the chosen LSST band;
  - the peak in electrons including defocus, and whether it saturates;
  - a synthetic CCD image with masks;
  - the lost-pixel fraction.
- "Estadística" (statistics) repeats the exposure at N random pointings and reports the mean, percentiles and the fraction of affected exposures.

**Night chart**
- Sunlit satellites above 30° and streaks per exposure across the whole night, per scenario.
- Log scale, tooltip and a data table.

**Controls**
- Date and time, speed, play/pause.
- Shortcuts to end of twilight, solar midnight and the winter solstice.
- Toggles for each scenario, and a deployed-fraction slider that follows the FCC milestones (10 % by 2035, 50 % by 2038, 100 % by 2040).
- Optimistic / central / pessimistic brightness range and an optional phase function (Mallama 2023).

**Layer editor**
- Change the altitude, inclination, N, planes and LTAN of each subshell.
- Two presets: FCC scaled to 1M, and Jangid et al. 2026.

**"Fuentes y supuestos" (sources & assumptions) panel**
- Every model parameter with its status (CONFIRMED, SECONDARY, ASSUMPTION, DERIVED, MODEL or NOT PUBLIC) and a link to its source.

**Diagnostic mode**
- Automated in-page tests, each reporting pass or fail.

### URL parameters

| Parameter | Effect |
|---|---|
| `?diag=1` | Runs the diagnostics on load |
| `?t=2026-11-27T01:00:00Z` | Opens at a given UTC date and time (default: today's end of astronomical twilight) |

### UI glossary

| Spanish | English |
|---|---|
| Reproducir / Ahora | Play / Now |
| Fin crepúsculo astronómico / Medianoche solar | End of astronomical twilight / Solar midnight |
| Editor de capas | Layer editor |
| Actualizar TLE | Refresh TLEs (live download from CelesTrak, at most once every 2 h) |
| Simular exposición / Estadística | Simulate exposure / Statistics |
| Calcular noche actual | Compute current night |
| Correr diagnóstico | Run diagnostics |
| iluminado / en sombra | sunlit / in shadow |
| traza | streak |

## Physical model

| Component | Implementation |
|---|---|
| Starmind / Gen2 orbits | Circular, with secular J2 precession of the node and argument of latitude. Sun-synchronous shells keep RAAN fixed relative to the Sun (LTAN 18:00 / 06:00) |
| Current Starlink | SGP4 (satellite.js) on CelesTrak TLEs; bundled snapshot or live download |
| Time and frames | GMST IAU-82, IAU 1976 precession, WGS-84 observer |
| Sun | Astronomical Almanac low-precision formula (~0.01°) |
| Shadow | Cylindrical (default) or conical (umbra/penumbra with a linear transition) |
| Brightness | m = M₁₀₀₀ + 5 log₁₀(ρ/1000 km) − 2.5 log₁₀(f_lit), with an optional phase function |
| Streaks | Intersection of the 30 s path segment with the LSSTCam field, in the tangent plane |
| Photometry | Per-band zero point, 0.67″ PSF, defocus 206265·D/ρ with D = 8.36 m, full well 130,000 e⁻ |
| Masks | 20″ (normal), 100″ (saturated), whole CCD if m < 2 (Jangid et al. 2026 convention) |

Propagation runs in a WebGL vertex shader, and the same formula is mirrored in JavaScript for the CPU-side calculations (exposures, statistics, chart). The diagnostics check that the two agree.

## Main assumptions

Non-public data were replaced by declared assumptions that can be changed in the interface:

| Parameter | Value used | Status |
|---|---|---|
| Orbital groups (altitude / inclination) | 6 groups between 550 and 1,002 km, at 26–32°, 30° and ~97–99° | Confirmed (FCC DA 26-1273) |
| N per subshell | McDowell's list (1,198,120) scaled ×0.83464 to the 1M cap | Secondary + assumption |
| LTAN of the sun-synchronous orbits | 18:00 and 06:00 (dawn-dusk) | Assumption |
| In-plane phasing | Uniform, with a random offset per plane | Assumption |
| Starmind M₁₀₀₀ | 6.0 / **5.7** / 2.7 (optimistic / central / pessimistic), area-scaled from the V2 Mini | Derived assumption |
| Exposure | 30 s continuous, analysis at alt ≥ 30° | Assumption (convention) |

The full sourced table (in Spanish) is in [`FASE1_FASE2.md`](FASE1_FASE2.md) and in the simulator's sources panel.

## Validation

Diagnostic mode runs 19 tests plus 1 informational check. All pass on a GeForce GTX 1060 Max-Q GPU:

| Test | Result | Reference |
|---|---|---|
| Satellites above the horizon and above 30° for 1,600 satellites at 550 km | 63.5 / 6.19 | 63.5 / 6.2 (Hainaut & Williams 2020) |
| Sun altitude at solar midnight, 26/27 Nov 2026 | −38.64° | −38.64° (astropy) |
| Shadow height above the zenith | identical | R⊕(sec D − 1), analytic |
| Streaks per exposure, Bassa et al. 2022 case | 0.247 ± 0.011 | 0.245 (their Eq. 1) |
| Starmind sunlit above 30° at end of twilight | 6,420 | 6,408 (independent Python script) |
| GPU vs CPU positions | max Δ 0.00016° | < 0.01° |
| SGP4 vs Vallado verification case | Δ = 0 m | ±1 m |
| Performance with ~1,026,000 satellites | 118 fps | ≥ 30 fps |

The full table and discussion (in Spanish) are in [`FASE3_FASE4.md`](FASE3_FASE4.md).

## Limitations

- Brightness uses a single diffuse M₁₀₀₀, with no BRDF and no specular glints from the panels. The pessimistic case serves as a bound.
- The LTAN of the sun-synchronous shells is the assumption that most changes the distribution on the sky.
- Orbits are idealized: steady state, no drag, no maneuvers and no progressive deployment.
- Pointings are random rather than the real LSST scheduler cadence (opsim), so fractions are not directly comparable with Jangid et al. (2026).
- The lost-pixel fraction is an order-of-magnitude estimate, not a precise figure.
- Starlink TLEs degrade by ~1–3 km per day. For distant dates, use the Gen2 scenario instead.

## Requirements

- A modern browser with WebGL2 (Chrome, Edge or Firefox) and an internet connection: Three.js, satellite.js and the Earth textures load from jsDelivr.
- A dedicated GPU is recommended. Integrated graphics work, at lower frame rates.

## Repository layout

| Path | Contents |
|---|---|
| `index.html` | The whole simulator in a single file (what GitHub Pages serves) |
| `desarrollo/` | Sources: `core.js` (physics, no UI), `main.js` (scene, shaders, UI), `template.html` (styles and layout), `build.py` (generates `index.html`), `test_core.mjs` (core tests with Node) |
| `referencia/` | FCC texts, McDowell's subshell list, the Starlink GP snapshot from 26 Nov 2026 and reference Python scripts (`reference.py`, `montecarlo.py`) |
| `FASE1_FASE2.md` | Source research, architecture, hand-checkable cases and test plan (Spanish) |
| `FASE3_FASE4.md` | Usage, diagnostic results, limitations and what better data would change (Spanish) |

To regenerate the HTML after editing the sources:

```
cd desarrollo
python build.py
node test_core.mjs
```

## Main references

- FCC DA 26-1273 (25 Nov 2026), Starmind authorization; DA 26-113 (application); DA 26-36 (Starlink Gen2).
- J. McDowell, *Enormous Constellations*, planet4589.org.
- Jangid et al. 2026, arXiv:2610.31772, and their public code.
- Tyson et al. 2020, AJ 160, 226.
- Hainaut & Williams 2020, A&A 636, A121.
- Bassa et al. 2022, A&A 657, A75.
- Mallama et al. 2023, arXiv:2306.06657 (Starlink V2 Mini photometry).
- Ivezić et al. 2019, ApJ 873, 111 (LSST parameters).
- CelesTrak, Starlink GP elements.
