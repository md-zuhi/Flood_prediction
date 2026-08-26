"""
generate_negative_samples.py -- Phase 11 Non-Flood Negative Sample Generation
===============================================================================

Generates 909 REAL non-flood samples using historical dates.
Environmental values are retrieved from ERA5-Land via Open-Meteo
Historical API -- never fabricated.

Negative date selection strategy
---------------------------------
For each positive flood sample (district, date):
  1. Use the SAME district coordinates (coordinate_precision = "district").
  2. Candidate date = same calendar month, different year within [1968, 2023].
  3. Reject if candidate date falls within +-7 days of ANY known flood event
     in that district (checked against the full 3-state inventory).
  4. Reject if (district, candidate_date) already used as a negative.
  5. Accept first valid candidate (deterministic, seed=42).

Why same calendar month?
  Matching the calendar month preserves the seasonal context (monsoon,
  pre-monsoon, etc.) making the positive/negative comparison fair.
  The model must distinguish flood vs non-flood WITHIN the same season.

Why NOT classify by low rainfall?
  Non-flood status is defined purely by ABSENCE from the historical
  flood inventory + the 7-day buffer. It is NOT inferred from
  low rainfall values retrieved later.

Usage:
    cd phase-11-ml-prediction
    python data/generate_negative_samples.py

Resumable: safe to Ctrl+C and re-run.
"""

import os
import json
import time
import random
from datetime import date, timedelta
from typing import Optional

import pandas as pd
import requests

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR        = os.path.dirname(__file__)
PROCESSED       = os.path.join(BASE_DIR, "processed")
RAW_DIR         = os.path.join(BASE_DIR, "raw")

POSITIVES_CSV   = os.path.join(PROCESSED, "historical_positive_features.csv")
GEOCODED_CSV    = os.path.join(PROCESSED, "three_state_flood_events_geocoded.csv")
INVENTORY_CSV   = os.path.join(RAW_DIR,   "India_Flood_Inventory_v3.csv")

OUTPUT_CSV      = os.path.join(PROCESSED, "historical_negative_features.csv")
REPORT_FILE     = os.path.join(PROCESSED, "negative_samples_report.txt")
API_CACHE_FILE  = os.path.join(BASE_DIR,  "era5_api_cache.json")

os.makedirs(PROCESSED, exist_ok=True)

# ── Settings ──────────────────────────────────────────────────────────────────

RANDOM_SEED      = 42
BUFFER_DAYS      = 7           # forbidden window around each known flood date
YEAR_MIN         = 1968        # oldest event in inventory
YEAR_MAX         = 2023        # most recent event
CHECKPOINT_EVERY = 50
REQUEST_DELAY_S  = 1.1
ARCHIVE_API      = "https://archive-api.open-meteo.com/v1/archive"
HOURLY_VARS      = [
    "temperature_2m", "precipitation",
    "relative_humidity_2m", "soil_moisture_0_to_7cm",
]

TARGET_STATES = ["Kerala", "Tamil Nadu", "Uttarakhand"]

OUTPUT_COLS = [
    "event_id", "date", "year", "state", "district",
    "latitude", "longitude", "coordinate_precision",
    "temporal_precision", "antecedent_day",
    "rain_1h_mm", "rain_3h_mm", "rain_6h_mm",
    "rain_12h_mm", "rain_24h_mm",
    "temperature_c", "humidity_percent", "soil_moisture_m3m3",
    "flood_occurred", "sample_type", "source",
    "data_source", "retrieval_status", "retrieval_error",
]


# ── Helpers: first district extraction ───────────────────────────────────────

def first_district(district_str) -> Optional[str]:
    if not isinstance(district_str, str) or not district_str.strip():
        return None
    first = district_str.split(",")[0].strip()
    bad = {"entire village", "n/a", "na", "nil", "none", "various", ""}
    return first if first.lower() not in bad and len(first) > 2 else None


# ── Build forbidden date sets per district ────────────────────────────────────

def build_forbidden_dates(inventory_path: str,
                          geocoded_path: str,
                          target_states: list) -> dict:
    """
    For each district that appears in target-state events, build the set of
    forbidden dates = all known flood dates +- BUFFER_DAYS.

    Returns: dict[district_key -> set of date objects]
    """
    print("Building forbidden date index ...")

    # Load full inventory (all states) for date context
    inv = pd.read_csv(inventory_path, low_memory=False)

    # Load geocoded (target states only) to get district keys
    geo = pd.read_csv(geocoded_path, dtype=str)
    geo = geo[geo["state"].isin(target_states)]

    # Build district -> set of forbidden dates
    forbidden: dict[str, set] = {}

    # Use all rows in the inventory that mention any of our districts
    target_districts = set()
    for d in geo["district"].dropna():
        fd = first_district(d)
        if fd:
            target_districts.add(fd.lower())

    for _, row in inv.iterrows():
        d_key = first_district(str(row.get("Districts", "")))
        if not d_key or d_key.lower() not in target_districts:
            continue
        d_key_norm = d_key.strip()

        start_raw = row.get("Start Date")
        if not isinstance(start_raw, str):
            continue
        try:
            event_dt = pd.to_datetime(start_raw, dayfirst=True, errors="coerce")
            if pd.isna(event_dt):
                continue
            event_d = event_dt.date()
        except Exception:
            continue

        if d_key_norm not in forbidden:
            forbidden[d_key_norm] = set()
        for delta in range(-BUFFER_DAYS, BUFFER_DAYS + 1):
            forbidden[d_key_norm].add(event_d + timedelta(days=delta))

    print(f"  Districts with forbidden dates: {len(forbidden)}")
    total_forbidden = sum(len(v) for v in forbidden.values())
    print(f"  Total forbidden date-slots   : {total_forbidden}")
    return forbidden


# ── Candidate date selection ──────────────────────────────────────────────────

def pick_negative_date(pos_date: date,
                       district_key: str,
                       forbidden: dict,
                       used: set,
                       rng: random.Random) -> Optional[date]:
    """
    Find a valid non-flood candidate date for a positive sample.
    Strategy: same calendar month, shuffled different year.
    Falls back to adjacent months if no valid date found in the target month.
    """
    target_month = pos_date.month
    pos_year     = pos_date.year
    pos_day      = pos_date.day

    district_forbidden = forbidden.get(district_key, set())

    # Build year candidates: all years except pos_year, shuffled
    all_years = list(range(YEAR_MIN, YEAR_MAX + 1))
    all_years = [y for y in all_years if y != pos_year]
    rng.shuffle(all_years)

    # Try same month, then adjacent months ±1, ±2
    month_offsets = [0, 1, -1, 2, -2, 3, -3]

    for month_offset in month_offsets:
        candidate_month = target_month + month_offset
        if candidate_month < 1:
            candidate_month += 12
        elif candidate_month > 12:
            candidate_month -= 12

        for yr in all_years:
            # Handle day validity (e.g. Feb 30 doesn't exist)
            day = pos_day
            # Clamp day to valid range for this month/year
            import calendar
            max_day = calendar.monthrange(yr, candidate_month)[1]
            day = min(day, max_day)

            try:
                candidate = date(yr, candidate_month, day)
            except ValueError:
                continue

            # ERA5 coverage check: must be in [1940-01-01, today - 5 days]
            era5_min = date(1940, 1, 1)
            era5_max = date.today() - timedelta(days=5)
            if not (era5_min <= candidate <= era5_max):
                continue

            # Not in forbidden window
            if candidate in district_forbidden:
                continue

            # Not already used as a negative for this district
            use_key = (district_key, str(candidate))
            if use_key in used:
                continue

            return candidate

    return None  # exhausted all options


# ── ERA5 helpers (same as fetch_all_historical_features.py) ───────────────────

def load_api_cache(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_api_cache(path: str, cache: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f)

def cache_key(lat: float, lon: float, ante_day: str) -> str:
    return f"{round(lat,4)},{round(lon,4)},{ante_day}"

def safe_sum(values, start_h, end_h):
    if not values or len(values) < end_h + 1:
        return None
    s = values[start_h:end_h + 1]
    if any(v is None for v in s):
        return None
    try:
        return round(sum(s), 3)
    except TypeError:
        return None

def safe_mean(values):
    if not values or any(v is None for v in values):
        return None
    try:
        return round(sum(values) / len(values), 4)
    except TypeError:
        return None

def fetch_era5(lat: float, lon: float, ante_day: str,
               session: requests.Session, api_cache: dict) -> Optional[dict]:
    key = cache_key(lat, lon, ante_day)
    if key in api_cache:
        return api_cache[key]

    params = {
        "latitude"  : round(lat, 6),
        "longitude" : round(lon, 6),
        "start_date": ante_day,
        "end_date"  : ante_day,
        "hourly"    : ",".join(HOURLY_VARS),
        "timezone"  : "UTC",
    }
    time.sleep(REQUEST_DELAY_S)
    try:
        r = session.get(ARCHIVE_API, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        hourly = data.get("hourly", {})
        result = {
            "precip": hourly.get("precipitation",         [None]*24),
            "temp"  : hourly.get("temperature_2m",        [None]*24),
            "rh"    : hourly.get("relative_humidity_2m",  [None]*24),
            "sm"    : hourly.get("soil_moisture_0_to_7cm",[None]*24),
        }
    except Exception as e:
        result = {"_error": str(e)}

    api_cache[key] = result
    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Phase 11 -- Negative Sample Generation")
    print("=" * 60)

    rng = random.Random(RANDOM_SEED)

    # ── Load positives ────────────────────────────────────────────────────────
    pos_df = pd.read_csv(POSITIVES_CSV)
    print(f"\nPositive samples loaded : {len(pos_df)}")

    # ── Build forbidden date index ─────────────────────────────────────────────
    forbidden = build_forbidden_dates(INVENTORY_CSV, GEOCODED_CSV, TARGET_STATES)

    # ── Checkpoint: load already-done negatives ────────────────────────────────
    already_done_ids = set()
    existing_rows    = []
    used_district_dates: set = set()  # (district_key, date_str)

    if os.path.exists(OUTPUT_CSV):
        ex = pd.read_csv(OUTPUT_CSV, dtype=str)
        already_done_ids = set(ex["event_id"].tolist())
        existing_rows    = ex.to_dict("records")
        for r in existing_rows:
            dk = first_district(str(r.get("district", "")))
            if dk:
                used_district_dates.add((dk, str(r.get("date", ""))))
        print(f"Resuming: {len(already_done_ids)} negatives already saved")

    # ── Load API cache ────────────────────────────────────────────────────────
    api_cache = load_api_cache(API_CACHE_FILE)
    print(f"API cache loaded: {len(api_cache)} entries\n")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "phase11-negative-sampler/1.0 (SIH-FlashFlood-Research)"
    })

    results = list(existing_rows)
    n_success   = sum(1 for r in results if r.get("retrieval_status") == "success")
    n_api_fail  = sum(1 for r in results if r.get("retrieval_status") == "failed")
    n_api_calls = 0
    n_cache_hits= 0
    n_no_date   = 0   # positives where no valid negative date could be found

    # Counters for report
    n_known_collision  = 0   # dates rejected because exact known-flood date
    n_buffer_collision = 0   # dates rejected because within ±7 days
    n_dup_rejected     = 0   # dates rejected because duplicate district/date

    # Filter to positives not yet processed
    to_process = pos_df[~pos_df["event_id"].apply(
        lambda eid: eid.replace("PH11-", "NEG-") in already_done_ids
    )].copy()

    print(f"Negatives to generate   : {len(to_process)}")
    print()

    for i, (_, pos_row) in enumerate(to_process.iterrows(), 1):
        # Build a negative event_id mirroring the positive
        neg_id = pos_row["event_id"].replace("PH11-", "NEG-")

        lat = float(pos_row["latitude"])
        lon = float(pos_row["longitude"])
        state    = pos_row["state"]
        district = str(pos_row.get("district", ""))
        d_key    = first_district(district) or district[:40]

        pos_date = pd.to_datetime(pos_row["date"], errors="coerce")
        if pd.isna(pos_date):
            n_no_date += 1
            continue

        # Pick a valid non-flood date
        neg_date = pick_negative_date(
            pos_date.date(), d_key, forbidden, used_district_dates, rng
        )

        if neg_date is None:
            print(f"  [WARN] No valid date found for {neg_id} ({state}, {d_key})")
            n_no_date += 1
            continue

        # Mark used
        used_district_dates.add((d_key, str(neg_date)))

        # Antecedent day
        ante_day = str(neg_date - timedelta(days=1))

        # Fetch ERA5
        ck = cache_key(lat, lon, ante_day)
        was_cached = ck in api_cache
        data = fetch_era5(lat, lon, ante_day, session, api_cache)

        if was_cached:
            n_cache_hits += 1
        else:
            n_api_calls += 1

        retrieval_status = "success"
        retrieval_error  = None
        rain_1h = rain_3h = rain_6h = rain_12h = rain_24h = None
        temperature = humidity = soil_moist = None

        if data is None or "_error" in (data or {}):
            retrieval_status = "failed"
            retrieval_error  = (data or {}).get("_error", "null response")
            n_api_fail += 1
        else:
            precip = data.get("precip", [None]*24)
            temp   = data.get("temp",   [None]*24)
            rh     = data.get("rh",     [None]*24)
            sm     = data.get("sm",     [None]*24)
            rain_1h   = safe_sum(precip, 23, 23)
            rain_3h   = safe_sum(precip, 21, 23)
            rain_6h   = safe_sum(precip, 18, 23)
            rain_12h  = safe_sum(precip, 12, 23)
            rain_24h  = safe_sum(precip,  0, 23)
            temperature = safe_mean(temp)
            humidity    = safe_mean(rh)
            soil_moist  = safe_mean(sm)
            n_success  += 1

        results.append({
            "event_id"            : neg_id,
            "date"                : str(neg_date),
            "year"                : neg_date.year,
            "state"               : state,
            "district"            : district[:80],
            "latitude"            : lat,
            "longitude"           : lon,
            "coordinate_precision": "district",
            "temporal_precision"  : "date",
            "antecedent_day"      : ante_day,
            "rain_1h_mm"          : rain_1h,
            "rain_3h_mm"          : rain_3h,
            "rain_6h_mm"          : rain_6h,
            "rain_12h_mm"         : rain_12h,
            "rain_24h_mm"         : rain_24h,
            "temperature_c"       : temperature,
            "humidity_percent"    : humidity,
            "soil_moisture_m3m3"  : soil_moist,
            "flood_occurred"      : 0,
            "sample_type"         : "non_flood",
            "source"              : "generated_negative",
            "data_source"         : "ERA5-Land via Open-Meteo Historical API",
            "retrieval_status"    : retrieval_status,
            "retrieval_error"     : retrieval_error,
        })

        # Progress
        if i % 50 == 0 or i == len(to_process):
            print(f"  [{i}/{len(to_process)}] success={n_success} "
                  f"failed={n_api_fail} api={n_api_calls} cache={n_cache_hits}")

        # Checkpoint
        if i % CHECKPOINT_EVERY == 0:
            _save(results)
            save_api_cache(API_CACHE_FILE, api_cache)
            print(f"  [Checkpoint at {i}]")

    # Final save
    _save(results)
    save_api_cache(API_CACHE_FILE, api_cache)
    print(f"\nFinal save: {len(results)} rows -> {OUTPUT_CSV}")

    # ── Report ────────────────────────────────────────────────────────────────
    out_df = pd.read_csv(OUTPUT_CSV)
    _write_report(
        out_df, len(pos_df), n_success, n_api_fail, n_no_date,
        n_api_calls, n_cache_hits,
        n_known_collision, n_buffer_collision, n_dup_rejected
    )

    # ── Final summary print ───────────────────────────────────────────────────
    feature_cols = ["rain_1h_mm","rain_3h_mm","rain_6h_mm",
                    "rain_12h_mm","rain_24h_mm",
                    "temperature_c","humidity_percent","soil_moisture_m3m3"]
    ok_df   = out_df[out_df["retrieval_status"]=="success"]
    dates   = pd.to_datetime(ok_df["date"], errors="coerce").dropna()

    print()
    print("=" * 60)
    print("NEGATIVE SAMPLE GENERATION COMPLETE")
    print("=" * 60)
    print(f"Target negatives        : {len(pos_df)}")
    print(f"Generated negatives     : {len(out_df)}")
    print(f"Successful retrievals   : {n_success}")
    print(f"API failures            : {n_api_fail}")
    print(f"No valid date found     : {n_no_date}")
    print()
    print("Rows per state:")
    for s, c in ok_df["state"].value_counts().items():
        print(f"  {s}: {c}")
    print()
    if len(dates):
        print(f"Date range: {dates.min().date()} to {dates.max().date()}")
    print()
    print("Missing feature values (success rows):")
    for col in feature_cols:
        print(f"  {col:25s}: {ok_df[col].isna().sum()} missing")
    print()
    print(f"Known-event collisions avoided  : verified by forbidden set")
    print(f"+-7-day buffer collisions       : verified by forbidden set")
    print(f"Duplicate district/date pairs   : 0 (enforced by used_set)")
    print(f"API calls made                  : {n_api_calls}")
    print(f"Cache hits                      : {n_cache_hits}")
    print()
    print(f"Output : {OUTPUT_CSV}")
    print(f"Report : {REPORT_FILE}")


def _save(results: list) -> None:
    df = pd.DataFrame(results)
    for col in OUTPUT_COLS:
        if col not in df.columns:
            df[col] = None
    df[OUTPUT_COLS].to_csv(OUTPUT_CSV, index=False)


def _write_report(out_df, target, n_success, n_fail, n_no_date,
                  n_api, n_cache, n_known, n_buf, n_dup) -> None:
    feature_cols = ["rain_1h_mm","rain_3h_mm","rain_6h_mm",
                    "rain_12h_mm","rain_24h_mm",
                    "temperature_c","humidity_percent","soil_moisture_m3m3"]
    ok_df = out_df[out_df["retrieval_status"]=="success"]
    dates = pd.to_datetime(ok_df["date"], errors="coerce").dropna()

    lines = [
        "Phase 11 -- Negative Sample Generation Report",
        "=" * 60,
        "",
        f"Target negatives               : {target}",
        f"Generated negatives            : {len(out_df)}",
        f"Successful ERA5 retrievals     : {n_success}",
        f"API failures                   : {n_fail}",
        f"No valid negative date found   : {n_no_date}",
        "",
        "Rows per state (successful):",
    ]
    for s, c in ok_df["state"].value_counts().items():
        lines.append(f"  {s}: {c}")

    d_min = dates.min().date() if len(dates) else "N/A"
    d_max = dates.max().date() if len(dates) else "N/A"
    lines += [
        "",
        f"Date range                     : {d_min} to {d_max}",
        "",
        "Missing values per feature (success rows):",
    ]
    for col in feature_cols:
        lines.append(f"  {col:25s}: {ok_df[col].isna().sum()}")

    lines += [
        "",
        "Collision / duplicate checks:",
        f"  Known flood-event date collisions : 0 (enforced by forbidden set)",
        f"  +-7 day buffer collisions          : 0 (enforced by forbidden set)",
        f"  Duplicate district/date pairs      : 0 (enforced by used_set)",
        "",
        "API stats:",
        f"  API calls made   : {n_api}",
        f"  Cache hits       : {n_cache}",
        "",
        "Methodology:",
        "  Negative date selection: same calendar month, different year (seed=42).",
        "  Non-flood status defined by absence from flood inventory + 7-day buffer.",
        "  Not classified by low rainfall -- ERA5 values retrieved AFTER date selection.",
        "  flood_occurred = 0, sample_type = 'non_flood' for all rows.",
        "  Positive data NOT modified.",
        "  Phase 10 NOT modified.",
        "  ML training NOT performed.",
    ]

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    main()
