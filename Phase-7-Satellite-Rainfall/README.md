# Phase 7 — Satellite Rainfall Analysis

Standalone feasibility module for the **Flash Flood Prediction System for Hilly Regions Using Multi-Source Data** (SIH 2026).

## Purpose

Retrieve NASA GPM IMERG satellite precipitation data for a selected hilly region and later calculate rainfall accumulation for flash-flood prediction.

This module tests **satellite rainfall data retrieval only**. It does not implement flood prediction, terrain analysis, soil moisture, landslide risk, or any integration with Phase 1–6.

## Data Source

| Field | Value |
|-------|-------|
| Provider | NASA Goddard Earth Sciences Data and Information Services Center (GES DISC) |
| Product | GPM IMERG Early Precipitation |
| Product ID | GPM_3IMERGHHE |
| Version | 07 |
| Temporal resolution | 30-minute |
| Spatial resolution | 0.1° × 0.1° (~10 km) |
| Format | HDF5 (.HDF5) |
| Coverage | Global (60°S – 60°N) |

## Folder Structure

```
Phase-7-Satellite-Rainfall/
├── data/           ← Downloaded NASA GPM HDF5 files go here
├── scripts/        ← Place download_files_GPM_3IMERGHHE_07.py here
├── output/         ← Processed results will go here (later phase)
├── README.md
└── requirements.txt
```

## NASA Earthdata Account Required

The NASA download script requires a free NASA Earthdata account.

1. Register at: https://urs.earthdata.nasa.gov/users/new
2. After registering, approve the GES DISC application:
   https://disc.gsfc.nasa.gov/earthdata-login
3. Your credentials are used by the download script (via `.netrc` or prompted login).

## Setup

### 1. Install Python dependencies

```bash
cd Phase-7-Satellite-Rainfall
pip install -r requirements.txt
```

Or using a virtual environment (recommended):

```bash
cd Phase-7-Satellite-Rainfall
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Place the NASA download script

Copy `download_files_GPM_3IMERGHHE_07.py` into:

```
Phase-7-Satellite-Rainfall/scripts/download_files_GPM_3IMERGHHE_07.py
```

### 3. Run the NASA download script

```bash
cd Phase-7-Satellite-Rainfall/scripts
python download_files_GPM_3IMERGHHE_07.py
```

Downloaded `.HDF5` files will appear in the location specified by the NASA script (move or configure them to `data/`).

## Current Status

> Folder structure created. Waiting for NASA GPM HDF5 files to be downloaded and confirmed before proceeding to rainfall processing.

## Next Steps (after download confirmed)

- Read precipitation values from HDF5 files using `h5py`
- Extract rainfall for a specific bounding box (hilly region)
- Calculate 30-minute and cumulative rainfall accumulation
- Prepare data for integration with Phase 5 (terrain) and Phase 6 (landslide) inputs

## Related Phases

| Phase | Module |
|-------|--------|
| 1 | Live Weather (Open-Meteo) |
| 2 | Current/Recent Rainfall (Open-Meteo) |
| 3 | Soil Moisture (NASA SMAP NRT) |
| 4 | Rainfall Forecast (ECMWF via Open-Meteo) |
| 5 | Terrain & Slope (NASA SRTM via OpenTopography) |
| 6 | Historical Landslide Analysis (GSI Inventory) |
| **7** | **Satellite Rainfall (NASA GPM IMERG)** |
