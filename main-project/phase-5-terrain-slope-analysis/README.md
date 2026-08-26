# Phase 5 — Terrain & Slope Analysis Test

Standalone feasibility module for the **Flash Flood Prediction System for Hilly Regions Using Multi-Source Data** (SIH 2026).

This module proves that for any user-selected hilly location, the system can dynamically obtain real **NASA SRTM GL1** terrain data and derive elevation and slope features required later for flash-flood and slope-stability prediction.

## Purpose

Phase 5 tests **terrain analysis only**. It does not implement flood prediction, rainfall, weather, SMAP, alerts, ML, or maps.

Flow:

1. User enters a hilly location name
2. Open-Meteo Geocoding API resolves coordinates
3. OpenTopography Point Elevation API returns SRTM elevation at the center point
4. A dynamic bounding box (±0.01°) is generated around the coordinate
5. OpenTopography Global DEM API downloads a NASA SRTM GL1 GeoTIFF
6. The backend parses the raster and calculates elevation statistics and slope
7. Results, source metadata, debug information, and an optional elevation preview are displayed

## NASA SRTM GL1

**SRTM GL1** (Shuttle Radar Topography Mission Global 1 arc-second) provides global elevation at approximately **30 m** spatial resolution. It is accessed through OpenTopography using:

- Point Elevation API: dataset `SRTM_GL1`
- Global DEM API: `demtype=SRTMGL1`

## Why Terrain Is Static (Not Live)

SRTM is a **survey-based digital elevation model**, not a live sensor feed. Elevation and slope do not change over short timescales (except extreme events like landslides). For flash-flood modelling, terrain is treated as a **static input layer** combined with dynamic inputs such as rainfall and soil moisture.

## Why Slope Matters for Flash-Flood Modelling

Steeper terrain accelerates surface runoff, increases flow velocity, and concentrates water into valleys — all critical factors in hilly flash-flood risk. Phase 5 extracts:

- Elevation at location
- Min / max / mean elevation and local relief
- Slope at location, mean slope, and maximum slope

These become terrain features for a later integrated model.

## OpenTopography API Usage

| Step | Endpoint |
|------|----------|
| Point elevation | `GET /API/v1/elevation` |
| Global DEM (GeoTIFF) | `GET /API/globaldem` |

All requests require a free **OpenTopography API key** (server-side only).

## API Key Setup

1. Register at https://portal.opentopography.org/newUser
2. Request a key at https://portal.opentopography.org/requestService?service=api
3. Copy `.env.example` to `.env`
4. Set your key:

```env
OPENTOPOGRAPHY_API_KEY=your_key_here
```

**Never** commit `.env` or expose the key in frontend code.

## Geocoding

Location names are converted to coordinates using the **Open-Meteo Geocoding API**:

```
https://geocoding-api.open-meteo.com/v1/search?name=Coonoor&count=1
```

No manual city-to-coordinate mapping is maintained.

## Bounding Box Creation

For coordinates `(lat, lon)`:

```
north = lat + 0.01
south = lat - 0.01
east  = lon + 0.01
west  = lon - 0.01
```

The box is generated dynamically for every search.

## GeoTIFF Processing

The backend downloads the GeoTIFF into memory (no permanent storage), parses it with the `geotiff` Node.js library, and reads elevation values from the raster band.

Invalid / no-data cells (typically `-32768`) are excluded from statistics.

## Elevation Statistics

From all valid raster cells:

| Metric | Calculation |
|--------|-------------|
| Minimum elevation | Minimum valid cell value |
| Maximum elevation | Maximum valid cell value |
| Mean elevation | Average of valid cells |
| Elevation at location | Point API value (preferred) |
| Center raster elevation | Nearest raster cell to coordinate |
| Local relief | `maxElevation − minElevation` |

## Slope Calculation

Slope is computed using **Horn's 3×3 gradient method** on the DEM grid:

1. Horizontal and vertical cell spacing are converted from degrees to **meters**, accounting for latitude (`cos(lat)` for longitude spacing)
2. Gradients `dz/dx` and `dz/dy` are computed from neighboring cells
3. Slope in degrees: `atan(√(dz/dx² + dz/dy²)) × 180/π`

Terrain classification (descriptive only, not flood risk):

| Slope | Classification |
|-------|----------------|
| < 5° | Nearly Flat |
| 5–15° | Gentle |
| 15–30° | Steep |
| 30–45° | Very Steep |
| > 45° | Extremely Steep |

## Install Dependencies

```bash
cd phase-5-terrain-slope-analysis
npm install
```

## Start Backend + Frontend

```bash
npm run dev
```

Open http://localhost:5000

The Express server serves the API and Vite dev frontend together.

## How to Verify Real SRTM Data

1. Configure `OPENTOPOGRAPHY_API_KEY` in `.env`
2. Enter **Coonoor**, **Kodaikanal**, **Munnar**, or **Gangtok**
3. Click **Analyse Terrain**
4. Confirm verification shows:
   - `SRTM Data Connected: Connected`
   - `Real DEM Data: Yes`
5. Check that coordinates, elevation, relief, and slope change when you switch locations
6. Expand **Debug Information** to inspect bounding box, raster dimensions, valid cell counts, and point-vs-raster elevation comparison

### Manual sanity check

A coordinate near **11.353°N, 76.795°E** should return point elevation near **1813 m** via the OpenTopography SRTM API. This value is **not hardcoded** — it must come from the live API response.

## Technology

- React + Vite (frontend)
- Node.js + Express (backend)
- geotiff (GeoTIFF parsing)
- Plain CSS
- No database, authentication, or ML

## Related Phases

| Phase | Module |
|-------|--------|
| 1 | Live Weather (Open-Meteo) |
| 2 | Current/Recent Rainfall (Open-Meteo) |
| 3 | Soil Moisture (NASA SMAP NRT) |
| 4 | Rainfall Forecast (ECMWF via Open-Meteo) |
| **5** | **Terrain & Slope (NASA SRTM via OpenTopography)** |
