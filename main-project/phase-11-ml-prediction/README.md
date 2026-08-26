# Phase 11 — ML Flash Flood Prediction

## Overview

Phase 11 receives the multi-source fused data record produced by **Phase 10 (Data Fusion)** and prepares a canonical **27-feature vector** as input to a flash flood risk ML model.

---

## Data Flow

```
Phase 10  POST /api/fusion
        │
        ▼
  Fused JSON record
  (weather, rainfall, forecast, SMAP,
   SRTM, GSI, GPM IMERG, source health)
        │
        ▼
  src/feature_schema.py
  extract_features(fused_data)
        │
        ▼
  27-feature vector  ← YOU ARE HERE
        │
        ▼
  [future] training data collection
        │
        ▼
  [future] model training (RandomForest / XGBoost)
        │
        ▼
  [future] POST /api/predict
```

---

## 27 Canonical Features

| # | Feature | Source |
|---|---------|--------|
| 1 | rain_1h_mm | Open-Meteo (recent) |
| 2 | rain_3h_mm | Open-Meteo |
| 3 | rain_6h_mm | Open-Meteo |
| 4 | rain_12h_mm | Open-Meteo |
| 5 | rain_24h_mm | Open-Meteo |
| 6 | forecast_1h_mm | Open-Meteo (forecast) |
| 7 | forecast_3h_mm | Open-Meteo |
| 8 | forecast_6h_mm | Open-Meteo |
| 9 | forecast_12h_mm | Open-Meteo |
| 10 | forecast_24h_mm | Open-Meteo |
| 11 | soil_moisture_m3_m3 | NASA SMAP |
| 12 | elevation_m | NASA SRTM |
| 13 | slope_deg | NASA SRTM |
| 14 | local_relief_m | NASA SRTM |
| 15 | nearest_landslide_km | GSI Inventory |
| 16 | landslide_count_5km | GSI Inventory |
| 17 | landslide_count_10km | GSI Inventory |
| 18 | landslide_count_25km | GSI Inventory |
| 19 | gpm_rain_30m_mm | NASA GPM IMERG |
| 20 | gpm_rain_1h_mm | NASA GPM IMERG |
| 21 | gpm_rain_3h_mm | NASA GPM IMERG |
| 22 | gpm_rain_6h_mm | NASA GPM IMERG |
| 23 | gpm_rain_12h_mm | NASA GPM IMERG |
| 24 | gpm_rain_24h_mm | NASA GPM IMERG |
| 25 | temperature_c | Open-Meteo |
| 26 | humidity_percent | Open-Meteo |
| 27 | wind_speed_kmh | Open-Meteo |

---

## Key Rules

- **Missing values → `None`**. Never replaced with 0 or any sentinel.
- **No model training** in this phase yet.
- **No flood labels** or fake data.
- **No rule-based predictions** here.
- Phase 10 backend is not modified.

---

## Folder Structure

```
phase-11-ml-prediction/
├── README.md
├── requirements.txt
├── data/              ← training CSVs (future)
├── models/            ← trained model artefacts (future)
└── src/
    ├── __init__.py
    └── feature_schema.py   ← 27 features + extract + validate
```

---

## Usage

```python
from src.feature_schema import extract_features, validate_features

# fused_data = response["data"] from POST /api/fusion
features = extract_features(fused_data)
report   = validate_features(features)

print(report["completeness_percent"])  # e.g. 100.0
print(features["slope_deg"])           # e.g. 17.55
print(features["soil_moisture_m3_m3"]) # e.g. 0.2498 or None if unavailable
```

## Run self-test

```bash
cd phase-11-ml-prediction
python src/feature_schema.py
```

## Install dependencies

```bash
pip install -r requirements.txt
```
