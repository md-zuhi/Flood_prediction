# Phase 6 — Historical Landslide Analysis Test

Standalone feasibility module for the **Flash Flood Prediction System for Hilly Regions Using Multi-Source Data** (SIH 2026).

## Purpose

Phase 6 proves that for any user-entered hilly location in Tamil Nadu, the system can use real Geological Survey of India (GSI) historical landslide coordinates to calculate nearby historical landslide activity and produce a location-specific historical susceptibility indicator.

This module tests **historical landslide analysis only**. It does not implement flood prediction, rainfall, weather, soil moisture, terrain slope, alerts, ML, or maps.

## GSI Historical Inventory

The dataset (`data/tamilnadu_landslide_inventory.csv`) is a field-validated landslide inventory from the **Geological Survey of India**. It contains records for Tamil Nadu covering districts including Nilgiri, Theni, Kodaikanal (Dindigul), Kanyakumari, Tirunelveli, Coimbatore, Salem, Madurai, and Virudhunagar.

Key fields: `sl_no`, `slide_no`, `state`, `district`, `slide_name`, `nh_sh_location`, `latitude`, `longitude`, `material_involved`, `movement_type`, `history`

## Why Historical Landslide Data Is Static

Landslide inventories are compiled from field surveys, satellite imagery, and post-event assessments. They represent **past events** at fixed coordinates. Unlike rainfall or soil moisture, historical landslide locations do not change in real time. For flash-flood modelling, this static layer is combined with dynamic inputs (rainfall, soil moisture, terrain slope) in the integrated system.

## Why Slope Matters for Flash-Flood Modelling

Historical landslide density at a location is a strong proxy for terrain instability. Areas with many past events indicate steep, unstable slopes prone to rapid runoff concentration — a key flash-flood trigger.

## Haversine Formula

Distance between user coordinates and each landslide record is calculated using the Haversine formula:

```
a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
d = 2 · R · arcsin(√a)     where R = 6371 km
```

This gives the great-circle distance in kilometres, correctly accounting for Earth's curvature.

## Distance-Radius Analysis

For each search, the backend counts historical landslide records within:
- **5 km** — immediate vicinity
- **10 km** — local area (used for susceptibility)
- **25 km** — regional context

## Susceptibility Logic

Based solely on historical event density within 10 km:

| Events within 10 km | Indicator |
|---------------------|-----------|
| 0 | LOW |
| 1–5 | MODERATE |
| 6–15 | HIGH |
| > 15 | VERY HIGH |

This is a **historical susceptibility indicator only** — not a live or current risk assessment.

## CSV File Location

```
phase-6-historical-landslide-risk/data/tamilnadu_landslide_inventory.csv
```

Do not rename or move this file.

## How to Run the Backend

```bash
cd phase-6-historical-landslide-risk/backend
npm install
npm run dev
```

Backend runs at: **http://localhost:6000**

Test endpoint: `http://localhost:6000/api/analyse?location=Coonoor`

## How to Run the Frontend

In a second terminal:

```bash
cd phase-6-historical-landslide-risk/frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5006**

The Vite dev server proxies `/api` requests to the backend on port 6000.

## Limitations

- Tamil Nadu only (GSI inventory scope)
- Static dataset — does not reflect events after the survey date
- Susceptibility is based on historical density only, not current conditions
- Locations outside Tamil Nadu return an out-of-scope message, not fabricated results

## Verified Test Results (from CSV)

| Location | Within 5 km | Within 10 km | Within 25 km | Susceptibility |
|----------|-------------|--------------|--------------|----------------|
| Coonoor | 218 | 363 | 697 | VERY HIGH |
| Ooty | 36 | 116 | 667 | VERY HIGH |
| Kodaikanal | 46 | 98 | 196 | VERY HIGH |
| Theni | 0 | 0 | 61 | LOW |

## Related Phases

| Phase | Module |
|-------|--------|
| 1 | Live Weather (Open-Meteo) |
| 2 | Current/Recent Rainfall (Open-Meteo) |
| 3 | Soil Moisture (NASA SMAP NRT) |
| 4 | Rainfall Forecast (ECMWF via Open-Meteo) |
| 5 | Terrain & Slope (NASA SRTM via OpenTopography) |
| **6** | **Historical Landslide Analysis (GSI Inventory)** |
