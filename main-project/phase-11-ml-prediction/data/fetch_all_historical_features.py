"""
fetch_all_historical_features.py -- Phase 11 Full-Scale Historical Retrieval
==============================================================================

Scales the tested 5-event retrieval logic to all 909 eligible geocoded events.

Same ERA5-Land / Open-Meteo Historical API logic as fetch_historical_features.py.

Key additions:
  - API cache keyed by (lat_4dp, lon_4dp, antecedent_date)
    -> multiple events in the same district on the same date share one API call.
  - Checkpoint resume: skips event_ids already saved in OUTPUT_CSV.
  - Saves progress every CHECKPOINT_EVERY events.
  - Missing values stay None, never replaced with 0.
  - flood_occurred = 1 for all rows (positive samples only).

Antecedent window (unchanged from test):
  temporal_precision = "date"
  antecedent_day = event_date - 1 calendar day
  rain_Xh_mm    = rolling sums ending at 23:00 UTC of antecedent_day
  temperature / humidity / soil_moisture = daily mean of antecedent_day

Usage:
    cd phase-11-ml-prediction
    python data/fetch_all_historical_features.py

Resumable: safe to Ctrl+C and re-run -- already-processed events are skipped.
"""

import os
import json
import time
from datetime import timedelta
from typing import Optional

import pandas as pd
import requests

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR        = os.path.dirname(__file__)
PROCESSED       = os.path.join(BASE_DIR, "processed")
INPUT_CSV       = os.path.join(PROCESSED, "three_state_flood_events_geocoded.csv")
OUTPUT_CSV      = os.path.join(PROCESSED, "historical_positive_features.csv")
REPORT_FILE     = os.path.join(PROCESSED, "historical_positive_features_report.txt")
API_CACHE_FILE  = os.path.join(BASE_DIR,  "era5_api_cache.json")

os.makedirs(PROCESSED, exist_ok=True)

# ── Settings ──────────────────────────────────────────────────────────────────

CHECKPOINT_EVERY = 50      # save output CSV every N events
REQUEST_DELAY_S  = 1.1     # >= 1 s between Nominatim/ERA5 calls (ToS)
ARCHIVE_API      = "https://archive-api.open-meteo.com/v1/archive"
HOURLY_VARS      = [
    "temperature_2m",
    "precipitation",
    "relative_humidity_2m",
    "soil_moisture_0_to_7cm",
]

# ── Output schema columns (in order) ─────────────────────────────────────────

OUTPUT_COLS = [
    "event_id", "date", "year", "state", "district",
    "latitude", "longitude", "coordinate_precision",
    "temporal_precision", "antecedent_day",
    "rain_1h_mm", "rain_3h_mm", "rain_6h_mm",
    "rain_12h_mm", "rain_24h_mm",
    "temperature_c", "humidity_percent", "soil_moisture_m3m3",
    "flood_occurred", "source",
    "data_source", "retrieval_status", "retrieval_error",
]

# ── Cache I/O ──────────────────────────────────────────────────────────────────

def load_api_cache(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_api_cache(path: str, cache: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f)

def cache_key(lat: float, lon: float, ante_day: str) -> str:
    """Round lat/lon to 4 dp to match ERA5-Land grid (~11km cell size)."""
    return f"{round(lat,4)},{round(lon,4)},{ante_day}"

# ── ERA5 fetch ────────────────────────────────────────────────────────────────

def fetch_era5(lat: float, lon: float,
               ante_day: str,
               session: requests.Session,
               api_cache: dict) -> Optional[dict]:
    """
    Fetch 24h of hourly ERA5-Land data for the antecedent day.
    Returns dict with lists for each variable, or None on error.
    Uses api_cache to skip duplicate requests.
    """
    key = cache_key(lat, lon, ante_day)
    if key in api_cache:
        return api_cache[key]

    params = {
        "latitude"   : round(lat, 6),
        "longitude"  : round(lon, 6),
        "start_date" : ante_day,
        "end_date"   : ante_day,
        "hourly"     : ",".join(HOURLY_VARS),
        "timezone"   : "UTC",
    }
    time.sleep(REQUEST_DELAY_S)
    try:
        r = session.get(ARCHIVE_API, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        hourly = data.get("hourly", {})
        result = {
            "precip" : hourly.get("precipitation",         [None]*24),
            "temp"   : hourly.get("temperature_2m",        [None]*24),
            "rh"     : hourly.get("relative_humidity_2m",  [None]*24),
            "sm"     : hourly.get("soil_moisture_0_to_7cm",[None]*24),
            "steps"  : len(hourly.get("time", [])),
        }
    except Exception as e:
        result = {"_error": str(e)}

    api_cache[key] = result
    return result

# ── Feature computation ───────────────────────────────────────────────────────

def safe_sum(values: list, start_h: int, end_h: int) -> Optional[float]:
    if not values or len(values) < end_h + 1:
        return None
    s = values[start_h:end_h + 1]
    if any(v is None for v in s):
        return None
    try:
        return round(sum(s), 3)
    except TypeError:
        return None

def safe_mean(values: list) -> Optional[float]:
    if not values or any(v is None for v in values):
        return None
    try:
        return round(sum(values) / len(values), 4)
    except TypeError:
        return None

# ── Per-event processing ──────────────────────────────────────────────────────

def process_event(row: pd.Series, session: requests.Session,
                  api_cache: dict) -> dict:

    base = {
        "event_id"            : row["event_id"],
        "date"                : str(row.get("date", "")),
        "year"                : row.get("year"),
        "state"               : row.get("state", ""),
        "district"            : str(row.get("district", ""))[:80],
        "latitude"            : row.get("latitude"),
        "longitude"           : row.get("longitude"),
        "coordinate_precision": row.get("coordinate_precision", "district"),
        "temporal_precision"  : "date",
        "antecedent_day"      : None,
        "rain_1h_mm"          : None,
        "rain_3h_mm"          : None,
        "rain_6h_mm"          : None,
        "rain_12h_mm"         : None,
        "rain_24h_mm"         : None,
        "temperature_c"       : None,
        "humidity_percent"    : None,
        "soil_moisture_m3m3"  : None,
        "flood_occurred"      : 1,
        "source"              : str(row.get("source", "")),
        "data_source"         : "ERA5-Land via Open-Meteo Historical API",
        "retrieval_status"    : "failed",
        "retrieval_error"     : None,
    }

    # Parse date
    event_date = pd.to_datetime(row.get("date"), errors="coerce")
    if pd.isna(event_date):
        base["retrieval_error"] = "invalid date"
        return base

    ante_day = str((event_date.date() - timedelta(days=1)))
    base["antecedent_day"] = ante_day

    lat = float(row["latitude"])
    lon = float(row["longitude"])

    data = fetch_era5(lat, lon, ante_day, session, api_cache)

    if data is None or "_error" in (data or {}):
        base["retrieval_error"] = (data or {}).get("_error", "null response")
        return base

    precip = data.get("precip", [None]*24)
    temp   = data.get("temp",   [None]*24)
    rh     = data.get("rh",     [None]*24)
    sm     = data.get("sm",     [None]*24)

    base["rain_1h_mm"]        = safe_sum(precip, 23, 23)
    base["rain_3h_mm"]        = safe_sum(precip, 21, 23)
    base["rain_6h_mm"]        = safe_sum(precip, 18, 23)
    base["rain_12h_mm"]       = safe_sum(precip, 12, 23)
    base["rain_24h_mm"]       = safe_sum(precip,  0, 23)
    base["temperature_c"]     = safe_mean(temp)
    base["humidity_percent"]  = safe_mean(rh)
    base["soil_moisture_m3m3"]= safe_mean(sm)
    base["retrieval_status"]  = "success"

    return base

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Phase 11 -- Full Historical Feature Retrieval")
    print("=" * 60)

    # Load input
    df = pd.read_csv(INPUT_CSV, dtype=str)
    total_raw = len(df)

    # Filter eligible: valid coords + valid date
    eligible = df[
        df["latitude"].notna() & (df["latitude"] != "") &
        df["longitude"].notna() & (df["longitude"] != "") &
        df["date"].notna() & (df["date"] != "")
    ].copy()
    n_eligible = len(eligible)
    n_skipped_ineligible = total_raw - n_eligible

    print(f"\nTotal events in CSV     : {total_raw}")
    print(f"Eligible (coords+date)  : {n_eligible}")
    print(f"Ineligible (skipped)    : {n_skipped_ineligible}")

    # Checkpoint: load already-processed event_ids
    already_done = set()
    existing_rows = []
    if os.path.exists(OUTPUT_CSV):
        existing_df = pd.read_csv(OUTPUT_CSV, dtype=str)
        already_done = set(existing_df["event_id"].tolist())
        existing_rows = existing_df.to_dict("records")
        print(f"Resuming -- already processed: {len(already_done)}")

    to_process = eligible[~eligible["event_id"].isin(already_done)]
    print(f"Events to process now   : {len(to_process)}")
    print()

    if len(to_process) == 0:
        print("Nothing to process -- all events already in output CSV.")
    else:
        # Load API cache
        api_cache = load_api_cache(API_CACHE_FILE)
        print(f"API cache loaded: {len(api_cache)} entries")

        session = requests.Session()
        session.headers.update({
            "User-Agent": "phase11-historical-retrieval/1.0 (SIH-FlashFlood-Research)"
        })

        results = list(existing_rows)
        n_success  = sum(1 for r in results if r.get("retrieval_status") == "success")
        n_failed   = sum(1 for r in results if r.get("retrieval_status") == "failed")
        n_api_new  = 0
        n_cache_hits = 0

        for i, (_, row) in enumerate(to_process.iterrows(), 1):
            key = cache_key(
                float(row["latitude"]),
                float(row["longitude"]),
                str((pd.to_datetime(row["date"]).date() - timedelta(days=1)))
                if pd.to_datetime(row["date"], errors="coerce") is not pd.NaT
                else "invalid"
            )
            was_cached = key in api_cache

            result = process_event(row, session, api_cache)
            results.append(result)

            if was_cached:
                n_cache_hits += 1
            else:
                n_api_new += 1

            if result["retrieval_status"] == "success":
                n_success += 1
            else:
                n_failed += 1

            # Progress print every 50
            if i % 50 == 0 or i == len(to_process):
                print(f"  [{i}/{len(to_process)}] success={n_success} "
                      f"failed={n_failed} api_calls={n_api_new} "
                      f"cache_hits={n_cache_hits}")

            # Checkpoint save
            if i % CHECKPOINT_EVERY == 0:
                _save_output(results)
                save_api_cache(API_CACHE_FILE, api_cache)
                print(f"  [Checkpoint saved at {i}]")

        # Final save
        _save_output(results)
        save_api_cache(API_CACHE_FILE, api_cache)
        print(f"\nFinal save: {len(results)} rows -> {OUTPUT_CSV}")

    # ── Report ────────────────────────────────────────────────────────────────

    out_df = pd.read_csv(OUTPUT_CSV)
    _write_report(out_df, total_raw, n_eligible)

    # ── Summary print ─────────────────────────────────────────────────────────

    n_ok   = (out_df["retrieval_status"] == "success").sum()
    n_fail = (out_df["retrieval_status"] != "success").sum()
    feature_cols = ["rain_1h_mm","rain_3h_mm","rain_6h_mm",
                    "rain_12h_mm","rain_24h_mm",
                    "temperature_c","humidity_percent","soil_moisture_m3m3"]

    print()
    print("=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"Total raw events        : {total_raw}")
    print(f"Eligible                : {n_eligible}")
    print(f"Successful retrievals   : {n_ok}")
    print(f"Failed retrievals       : {n_fail}")
    print(f"Success rate            : {100*n_ok/n_eligible:.1f}%")
    print()
    print("Rows per state:")
    for state, cnt in out_df[out_df["retrieval_status"]=="success"]["state"].value_counts().items():
        print(f"  {state}: {cnt}")
    print()
    dates = pd.to_datetime(out_df["date"], errors="coerce").dropna()
    print(f"Date range: {dates.min().date()} to {dates.max().date()}")
    print()
    print("Missing values per feature (success rows only):")
    ok = out_df[out_df["retrieval_status"]=="success"]
    for col in feature_cols:
        null_n = ok[col].isna().sum()
        print(f"  {col:25s}: {null_n} missing")
    print()
    print(f"Output: {OUTPUT_CSV}")
    print(f"Report: {REPORT_FILE}")


def _save_output(results: list) -> None:
    df = pd.DataFrame(results)
    for col in OUTPUT_COLS:
        if col not in df.columns:
            df[col] = None
    df[OUTPUT_COLS].to_csv(OUTPUT_CSV, index=False)


def _write_report(out_df: pd.DataFrame, total_raw: int, n_eligible: int) -> None:
    n_ok   = (out_df["retrieval_status"] == "success").sum()
    n_fail = (out_df["retrieval_status"] != "success").sum()
    feature_cols = ["rain_1h_mm","rain_3h_mm","rain_6h_mm",
                    "rain_12h_mm","rain_24h_mm",
                    "temperature_c","humidity_percent","soil_moisture_m3m3"]
    dates = pd.to_datetime(out_df["date"], errors="coerce").dropna()
    ok_df = out_df[out_df["retrieval_status"]=="success"]

    lines = [
        "Phase 11 -- Full Historical Feature Retrieval Report",
        "=" * 60,
        "",
        f"Input file             : three_state_flood_events_geocoded.csv",
        f"Total events in CSV    : {total_raw}",
        f"Eligible (coords+date) : {n_eligible}",
        f"Successful retrievals  : {n_ok}",
        f"Failed retrievals      : {n_fail}",
        f"Success rate           : {100*n_ok/n_eligible:.1f}%",
        "",
        "Rows per state (successful):",
    ]
    for state, cnt in ok_df["state"].value_counts().items():
        lines.append(f"  {state}: {cnt}")

    lines += [
        "",
        f"Date range             : {dates.min().date()} to {dates.max().date()}",
        "",
        "Missing values per feature (success rows only):",
    ]
    for col in feature_cols:
        null_n = ok_df[col].isna().sum()
        lines.append(f"  {col:25s}: {null_n} missing")

    lines += [
        "",
        "Data source            : ERA5-Land via Open-Meteo Historical API",
        f"API URL                : https://archive-api.open-meteo.com/v1/archive",
        "Authentication         : None (free API)",
        "",
        "Temporal handling      : temporal_precision = 'date'",
        "                         antecedent_day = event_date - 1",
        "                         rain windows end at 23:00 UTC of antecedent_day",
        "",
        "Coordinate precision   : 'district' for all rows",
        "                         Coordinates are district centroids.",
        "",
        "Flood label            : flood_occurred = 1 (all positive samples)",
        "Negative samples       : NOT created in this step",
        "ML training            : NOT performed",
    ]

    failed_rows = out_df[out_df["retrieval_status"] != "success"]
    if len(failed_rows):
        lines += ["", f"Failed events ({len(failed_rows)}):"]
        for _, r in failed_rows.head(20).iterrows():
            lines.append(f"  {r['event_id']} | {r.get('retrieval_error','')}")

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
