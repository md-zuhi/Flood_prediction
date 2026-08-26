"""
fetch_historical_features.py -- Phase 11 Historical Feature Retrieval Test
============================================================================

Tests historical environmental feature retrieval on 5 geocoded flood events
using the Open-Meteo Historical Weather API (ERA5-Land reanalysis).

Data source:
    https://archive-api.open-meteo.com/v1/archive
    ERA5-Land hourly reanalysis, available from 1940-01-01 to ~5 days ago.
    Free, no API key required.

IMPORTANT:
    - This uses the HISTORICAL archive API, NOT the current/forecast API.
    - All values are ERA5-Land reanalysis, not station observations.
    - Antecedent rainfall = rainfall in the 24h BEFORE the event date.
      Since event time is unknown (only date available), we treat the
      full previous calendar day as the antecedent window and mark
      temporal_precision = "date".
    - Missing values are returned as None, never replaced with 0.
    - No synthetic or invented values.

Antecedent window strategy (temporal_precision = "date"):
    Event date known, time unknown.
    Antecedent window = 24h ending at 00:00 UTC on event_date
                      = the complete previous UTC day (event_date - 1).
    rain_24h_mm = sum of hourly precip for event_date-1 (all 24h)
    rain_12h_mm = sum of hours 12-23 of event_date-1
    rain_6h_mm  = sum of hours 18-23 of event_date-1
    rain_3h_mm  = sum of hours 21-23 of event_date-1
    rain_1h_mm  = hour 23 of event_date-1
    Point-in-time variables (temperature, humidity, soil_moisture)
    are taken as the mean over event_date-1.

Usage:
    cd phase-11-ml-prediction
    python data/fetch_historical_features.py
"""

import os
import json
from datetime import date, timedelta
from typing import Optional

import pandas as pd
import requests

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR    = os.path.dirname(__file__)
PROCESSED   = os.path.join(BASE_DIR, "processed")
INPUT_CSV   = os.path.join(PROCESSED, "three_state_flood_events_geocoded.csv")
OUTPUT_CSV  = os.path.join(PROCESSED, "historical_features_test.csv")
REPORT_FILE = os.path.join(PROCESSED, "historical_features_test_report.txt")
os.makedirs(PROCESSED, exist_ok=True)

# ── 5 Pre-selected test events ────────────────────────────────────────────────
# Selected to cover different states, districts, and years (2008-2023).
# event_id values correspond to three_state_flood_events_geocoded.csv.

TEST_EVENT_IDS = [
    "PH11-00471",   # Kerala,       2011-04-25, Alappuzha
    "PH11-00419",   # Tamil Nadu,   2008-05-25, Coimbatore
    "PH11-00617",   # Uttarakhand,  2016-05-08, Chamoli
    "PH11-00895",   # Kerala,       2023-07-23, Wayanad
    "PH11-00879",   # Tamil Nadu,   2022-11-01, Tiruvannamalai
]

# ── ERA5-Land historical API ──────────────────────────────────────────────────

ARCHIVE_API  = "https://archive-api.open-meteo.com/v1/archive"
HOURLY_VARS  = [
    "temperature_2m",
    "precipitation",
    "relative_humidity_2m",
    "soil_moisture_0_to_7cm",
]


def fetch_era5(lat: float, lon: float,
               start: str, end: str) -> Optional[dict]:
    """
    Fetch hourly ERA5-Land data for a lat/lon and date range.

    Parameters
    ----------
    lat, lon : float
    start, end : str  YYYY-MM-DD  (end is inclusive)

    Returns dict with 'time' list and one list per variable, or None on error.
    """
    params = {
        "latitude"         : lat,
        "longitude"        : lon,
        "start_date"       : start,
        "end_date"         : end,
        "hourly"           : ",".join(HOURLY_VARS),
        "timezone"         : "UTC",
        "wind_speed_unit"  : "kmh",
    }
    try:
        r = requests.get(ARCHIVE_API, params=params, timeout=30)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        return {"_error": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as e:
        return {"_error": str(e)}


def safe_sum(values: list, start_h: int, end_h: int) -> Optional[float]:
    """
    Sum hourly values[start_h:end_h+1].
    Returns None if any value in the slice is None/NaN.
    """
    if not values or len(values) < end_h + 1:
        return None
    slice_ = values[start_h:end_h + 1]
    if any(v is None for v in slice_):
        return None
    try:
        return round(sum(slice_), 3)
    except TypeError:
        return None


def safe_mean(values: list) -> Optional[float]:
    """Mean of a list, None if any element is None."""
    if not values or any(v is None for v in values):
        return None
    try:
        return round(sum(values) / len(values), 4)
    except TypeError:
        return None


def process_event(row: pd.Series) -> dict:
    """
    Fetch ERA5-Land data for one event and compute antecedent features.
    """
    event_id  = row["event_id"]
    state     = row["state"]
    district  = str(row.get("district", ""))[:60]
    lat       = float(row["latitude"])
    lon       = float(row["longitude"])
    coord_prec= row.get("coordinate_precision", "district")

    # Parse event date
    event_date = pd.to_datetime(row["date"], errors="coerce")
    if pd.isna(event_date):
        return _missing_row(row, "invalid date")

    edate = event_date.date()

    # Antecedent window: the full calendar day BEFORE the event date
    ante_day   = edate - timedelta(days=1)
    fetch_start = str(ante_day)
    fetch_end   = str(ante_day)       # only need the antecedent day

    print(f"  Fetching ERA5 for {event_id} ({state}) "
          f"date={edate} antecedent={ante_day} "
          f"lat={lat:.4f} lon={lon:.4f}")

    data = fetch_era5(lat, lon, fetch_start, fetch_end)

    if data is None or "_error" in data:
        err = data.get("_error", "unknown error") if data else "null response"
        print(f"    [FAIL] API error: {err}")
        return _missing_row(row, err)

    hourly = data.get("hourly", {})
    times  = hourly.get("time", [])

    if len(times) != 24:
        print(f"    [WARN] Expected 24 hourly steps, got {len(times)}")

    precip  = hourly.get("precipitation",          [None]*24)
    temp    = hourly.get("temperature_2m",          [None]*24)
    rh      = hourly.get("relative_humidity_2m",    [None]*24)
    sm      = hourly.get("soil_moisture_0_to_7cm",  [None]*24)

    # Antecedent rainfall (rolling windows ENDING at 23:00 of ante_day)
    # Hours are 0-indexed (0=00:00, 23=23:00 UTC)
    rain_1h_mm  = safe_sum(precip, 23, 23)      # last 1h
    rain_3h_mm  = safe_sum(precip, 21, 23)      # last 3h
    rain_6h_mm  = safe_sum(precip, 18, 23)      # last 6h
    rain_12h_mm = safe_sum(precip, 12, 23)      # last 12h
    rain_24h_mm = safe_sum(precip,  0, 23)      # full 24h

    # Point-in-time variables: daily mean of antecedent day
    temperature_c       = safe_mean(temp)
    humidity_percent    = safe_mean(rh)
    soil_moisture_m3m3  = safe_mean(sm)

    print(f"    [OK] rain_24h={rain_24h_mm} mm  temp={temperature_c} C  "
          f"rh={humidity_percent}%  sm={soil_moisture_m3m3}")

    return {
        "event_id"           : event_id,
        "date"               : str(edate),
        "state"              : state,
        "district"           : district,
        "latitude"           : lat,
        "longitude"          : lon,
        "coordinate_precision": coord_prec,
        "temporal_precision" : "date",
        "antecedent_day"     : str(ante_day),
        # Antecedent rainfall (ERA5-Land, mm)
        "rain_1h_mm"         : rain_1h_mm,
        "rain_3h_mm"         : rain_3h_mm,
        "rain_6h_mm"         : rain_6h_mm,
        "rain_12h_mm"        : rain_12h_mm,
        "rain_24h_mm"        : rain_24h_mm,
        # Weather on antecedent day (ERA5-Land daily means)
        "temperature_c"      : temperature_c,
        "humidity_percent"   : humidity_percent,
        "soil_moisture_m3m3" : soil_moisture_m3m3,
        # Metadata
        "data_source"        : "ERA5-Land via Open-Meteo Historical API",
        "api_url"            : ARCHIVE_API,
        "retrieval_status"   : "success",
        "retrieval_error"    : None,
    }


def _missing_row(row: pd.Series, error: str) -> dict:
    """Return a row with all features as None and status = failed."""
    return {
        "event_id"           : row["event_id"],
        "date"               : str(row.get("date","")),
        "state"              : row.get("state",""),
        "district"           : str(row.get("district",""))[:60],
        "latitude"           : row.get("latitude"),
        "longitude"          : row.get("longitude"),
        "coordinate_precision": row.get("coordinate_precision"),
        "temporal_precision" : "date",
        "antecedent_day"     : None,
        "rain_1h_mm"         : None,
        "rain_3h_mm"         : None,
        "rain_6h_mm"         : None,
        "rain_12h_mm"        : None,
        "rain_24h_mm"        : None,
        "temperature_c"      : None,
        "humidity_percent"   : None,
        "soil_moisture_m3m3" : None,
        "data_source"        : "ERA5-Land via Open-Meteo Historical API",
        "api_url"            : ARCHIVE_API,
        "retrieval_status"   : "failed",
        "retrieval_error"    : error,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Phase 11 -- Historical Feature Retrieval Test (5 events)")
    print("=" * 60)

    # Load geocoded events
    df = pd.read_csv(INPUT_CSV, dtype=str)
    test_df = df[df["event_id"].isin(TEST_EVENT_IDS)].copy()

    if len(test_df) < len(TEST_EVENT_IDS):
        found = test_df["event_id"].tolist()
        missing_ids = [i for i in TEST_EVENT_IDS if i not in found]
        print(f"WARNING: Could not find event IDs: {missing_ids}")

    print(f"\nSelected {len(test_df)} test events:")
    for _, r in test_df.iterrows():
        print(f"  {r['event_id']} | {r['state']} | {str(r['date'])[:10]} | "
              f"lat={r['latitude']} lon={r['longitude']}")
    print()

    # Process each event
    results = []
    n_success = 0
    n_failed  = 0
    errors    = []

    for _, row in test_df.iterrows():
        result = process_event(row)
        results.append(result)
        if result["retrieval_status"] == "success":
            n_success += 1
        else:
            n_failed += 1
            errors.append(f"{result['event_id']}: {result['retrieval_error']}")

    # Save output CSV
    out_df = pd.DataFrame(results)
    out_df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSaved: {OUTPUT_CSV}")

    # ── Compute report stats ──────────────────────────────────────────────────

    feature_cols = [
        "rain_1h_mm","rain_3h_mm","rain_6h_mm",
        "rain_12h_mm","rain_24h_mm",
        "temperature_c","humidity_percent","soil_moisture_m3m3",
    ]
    available_vars = [c for c in feature_cols if out_df[c].notna().any()]
    missing_vars   = [c for c in feature_cols if out_df[c].isna().all()]

    # ── Write report ──────────────────────────────────────────────────────────

    report_lines = [
        "Phase 11 -- Historical Feature Retrieval Test Report",
        "=" * 60,
        "",
        f"Events attempted       : {len(test_df)}",
        f"Successful retrievals  : {n_success}",
        f"Failed retrievals      : {n_failed}",
        "",
        "Variables obtained:",
    ]
    for v in available_vars:
        report_lines.append(f"  {v}")

    report_lines.append("Variables not obtained (all None):")
    if missing_vars:
        for v in missing_vars:
            report_lines.append(f"  {v}")
    else:
        report_lines.append("  (none -- all variables retrieved)")

    report_lines += [
        "",
        "Data source:",
        f"  ERA5-Land reanalysis via Open-Meteo Historical Archive API",
        f"  URL: {ARCHIVE_API}",
        f"  Variables: {', '.join(HOURLY_VARS)}",
        "",
        "Temporal handling:",
        "  temporal_precision = 'date'",
        "  Event time is unknown (only event date available).",
        "  Antecedent window = full calendar day BEFORE the event date (UTC).",
        "  rain_1h_mm  = hour 23 of antecedent day",
        "  rain_3h_mm  = hours 21-23 of antecedent day",
        "  rain_6h_mm  = hours 18-23 of antecedent day",
        "  rain_12h_mm = hours 12-23 of antecedent day",
        "  rain_24h_mm = hours 0-23 of antecedent day (full day)",
        "  temperature_c / humidity_percent / soil_moisture_m3m3 = daily mean",
        "",
        "Coordinate precision:",
        "  coordinate_precision = 'district' for all 5 events.",
        "  Coordinates are district centroids, not exact flood locations.",
        "",
        "Limitations:",
        "  1. ERA5-Land is a reanalysis product (~0.1-degree grid ~11km).",
        "     It may not capture highly localised convective rainfall.",
        "  2. Only the antecedent day is used (no event-day rainfall included).",
        "  3. No event-hour precision -- temporal_precision = 'date'.",
        "  4. Soil moisture is 0-7cm layer only (top layer).",
        "",
        "Errors:",
    ]
    if errors:
        for e in errors:
            report_lines.append(f"  {e}")
    else:
        report_lines.append("  None")

    report_lines += ["", "Results summary:"]
    for r in results:
        report_lines.append(
            f"  {r['event_id']} | {r['state']} | {r['date']} | "
            f"status={r['retrieval_status']} | "
            f"rain_24h={r['rain_24h_mm']} mm | "
            f"temp={r['temperature_c']} C | "
            f"rh={r['humidity_percent']}% | "
            f"sm={r['soil_moisture_m3m3']}"
        )

    report_text = "\n".join(report_lines)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"Saved: {REPORT_FILE}")

    # ── Final summary ─────────────────────────────────────────────────────────

    print()
    print("=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
    print(f"Events attempted       : {len(test_df)}")
    print(f"Successful retrievals  : {n_success}")
    print(f"Failed retrievals      : {n_failed}")
    print()
    print("Variables obtained:", available_vars)
    print("Variables missing :", missing_vars or "none")
    print()
    print("Results per event:")
    for r in results:
        print(f"  {r['event_id']} | {r['state'][:12]:12s} | {r['date']} | "
              f"status={r['retrieval_status']:7s} | "
              f"rain_24h={str(r['rain_24h_mm']):>7} mm | "
              f"temp={str(r['temperature_c']):>6} C | "
              f"soil_moisture={r['soil_moisture_m3m3']}")
    if errors:
        print()
        print("Errors:")
        for e in errors:
            print(f"  {e}")


if __name__ == "__main__":
    main()
