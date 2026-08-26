# Phase 4 — Rainfall Forecast Test

Standalone feasibility module for the **Flash Flood Prediction System for Hilly Regions Using Multi-Source Data** (SIH 2026).

This module proves that the application can dynamically obtain genuine future hourly rainfall forecasts for a user-selected location and transform them into rainfall features (1h/3h/6h/12h/24h accumulations and peak intensity) for later use in a flash-flood prediction model.

## Purpose

Phase 4 tests **rainfall forecasting only**. It does not implement flood prediction, risk scores, ML, maps, or any other data sources.

Flow:

1. User enters a location name
2. Open-Meteo Geocoding API resolves coordinates and timezone
3. Open-Meteo Forecast API returns hourly precipitation
4. Future hours are filtered relative to the location's current local hour
5. Accumulation windows and peak intensity are calculated
6. Results, source metadata, and debug information are displayed

## Data Source

All rainfall values come from the **Open-Meteo Forecast API**. No mock data, random numbers, hardcoded rainfall, or static JSON files are used.

The module prefers the **ECMWF Forecast API** endpoint (`/v1/ecmwf`) with `models=ecmwf_ifs`. If that endpoint fails, it falls back to the generic forecast endpoint (`/v1/forecast`) with the same ECMWF model parameter.

## Open-Meteo Endpoints Used

| Step | Endpoint |
|------|----------|
| Geocoding | `https://geocoding-api.open-meteo.com/v1/search` |
| Rainfall forecast (primary) | `https://api.open-meteo.com/v1/ecmwf` |
| Rainfall forecast (fallback) | `https://api.open-meteo.com/v1/forecast` |

Example geocoding request:

```
https://geocoding-api.open-meteo.com/v1/search?name=Ooty&count=1&language=en
```

Example forecast request:

```
https://api.open-meteo.com/v1/ecmwf?latitude=11.41&longitude=76.69&hourly=precipitation,precipitation_probability&forecast_hours=48&timezone=auto&models=ecmwf_ifs
```

No API key is required for standard non-commercial use.

## How Geocoding Works

When the user submits a location:

1. The app sends the name to the Open-Meteo Geocoding API
2. The best match returns name, admin region, country, latitude, longitude, and timezone
3. No manual city-to-coordinate mapping is maintained

Example: `Ooty` resolves to **Udhagamandalam**, Tamil Nadu, India with coordinates near 11.41°N, 76.69°E and timezone `Asia/Kolkata`.

## How Hourly Precipitation Is Retrieved

After geocoding, the app requests:

- `hourly=precipitation,precipitation_probability`
- `forecast_hours=48`
- `timezone=auto`

Open-Meteo returns local timestamps and hourly precipitation in millimetres. Each value is the **preceding hour sum** for that timestamp.

## How 1h / 3h / 6h / 12h / 24h Rainfall Is Calculated

Calculations are relative to the **current local hour** at the selected location, not calendar-day totals.

1. Build a local hour key for "now" using the location timezone (e.g. `2026-08-24T14`)
2. Find the first hourly timestamp in the API response that is **≥ current local hour**
3. Exclude all earlier (past) hours
4. Sum the next N future hourly precipitation values:

| Window | Calculation |
|--------|-------------|
| Next 1h | Sum of next 1 future hour |
| Next 3h | Sum of next 3 future hours |
| Next 6h | Sum of next 6 future hours |
| Next 12h | Sum of next 12 future hours |
| Next 24h | Sum of next 24 future hours |

Example (if current hour is 2 PM and future values are 5, 8, 12 mm):

- Next 1h = 5 mm
- Next 3h = 25 mm

## How Peak Rainfall Is Calculated

Within the next 24 future hours:

1. Find the maximum hourly precipitation value
2. Report that value as **Peak Hourly Rainfall** (mm/hour)
3. Report the corresponding timestamp as **Expected Peak Time** (formatted in local timezone)

## Install Dependencies

```bash
cd phase-4-rainfall-forecast
npm install
```

## Start the Project

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## How to Verify Real API Data

1. Enter a location such as **Ooty**, **Kodaikanal**, or **Munnar**
2. Click **Get Rainfall Forecast**
3. Confirm the **Data Verification** section shows:
   - `Real API Data: Yes`
   - `API Status: Connected`
4. Check that coordinates, timezone, and hourly values change when you switch locations
5. Expand **Debug Information** to inspect:
   - Geocoding and forecast API URLs
   - Number of hourly records
   - First/last forecast timestamps used
   - Sample raw precipitation values
   - Forecast retrieval timestamp

If a request fails, the app shows an error message and verification shows `API Status: Failed`. No fake rainfall values are displayed.

## Technology

- React
- Vite
- JavaScript
- Plain CSS
- No backend, database, or authentication

## Related Phases

| Phase | Module |
|-------|--------|
| 1 | Live Weather (Open-Meteo) |
| 2 | Current/Recent Rainfall (Open-Meteo) |
| 3 | Near-Real-Time Soil Moisture (NASA SMAP NRT) |
| **4** | **Rainfall Forecast (Open-Meteo)** |
