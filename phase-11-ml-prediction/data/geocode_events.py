"""
geocode_events.py -- Phase 11 Geocoding
=========================================

Geocodes three_state_flood_events.csv using OpenStreetMap Nominatim.

Rules:
  - Location column is entirely empty in this dataset.
  - District column often contains comma-separated lists.
  - We extract the FIRST district from each row as the geocoding target.
  - coordinate_precision = "district" (never falsely called "location").
  - If no district available: coordinate_precision = "missing".
  - Results are cached locally (geocache.json) to avoid re-querying.
  - >= 1 second delay between Nominatim requests (ToS compliance).
  - No coordinates are invented.
  - Original CSV is NOT modified.

Output:
  data/processed/three_state_flood_events_geocoded.csv
  data/processed/geocoding_report.txt
  data/geocache.json  (local cache, reused on re-runs)

Usage:
    cd phase-11-ml-prediction
    python data/geocode_events.py
"""

import json
import os
import time

import pandas as pd
import requests

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR     = os.path.dirname(__file__)
PROCESSED    = os.path.join(BASE_DIR, "processed")
INPUT_CSV    = os.path.join(PROCESSED, "three_state_flood_events.csv")
OUTPUT_CSV   = os.path.join(PROCESSED, "three_state_flood_events_geocoded.csv")
REPORT_FILE  = os.path.join(PROCESSED, "geocoding_report.txt")
CACHE_FILE   = os.path.join(BASE_DIR,  "geocache.json")

os.makedirs(PROCESSED, exist_ok=True)

# ── Nominatim settings ────────────────────────────────────────────────────────

NOMINATIM_URL   = "https://nominatim.openstreetmap.org/search"
USER_AGENT      = "phase11-flood-geocoder/1.0 (SIH-FlashFlood-Research)"
REQUEST_DELAY_S = 1.1    # >= 1 s between requests (Nominatim ToS)

# ── Load cache ────────────────────────────────────────────────────────────────

def load_cache(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_cache(path: str, cache: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

# ── Extract first usable district ─────────────────────────────────────────────

def first_district(district_str: str) -> str | None:
    """
    Extract the first district name from a potentially comma-separated list.
    Returns None if the string is empty or not useful.
    """
    if not isinstance(district_str, str) or not district_str.strip():
        return None
    # Take first token before comma
    first = district_str.split(",")[0].strip()
    # Skip obviously bad values
    bad = {"entire village", "n/a", "na", "nil", "none", "various", ""}
    if first.lower() in bad:
        return None
    return first if len(first) > 2 else None

# ── Nominatim query ───────────────────────────────────────────────────────────

def nominatim_query(query: str, session: requests.Session) -> dict | None:
    """
    Query Nominatim. Returns first result or None.
    """
    params = {
        "q"              : query,
        "format"         : "json",
        "limit"          : 1,
        "countrycodes"   : "in",   # restrict to India
        "addressdetails" : 0,
    }
    try:
        resp = session.get(NOMINATIM_URL, params=params, timeout=15)
        resp.raise_for_status()
        results = resp.json()
        if results:
            r = results[0]
            return {
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
            }
    except Exception as e:
        print(f"    [WARN] Nominatim error for '{query}': {e}")
    return None

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Phase 11 -- Geocoding Flood Events")
    print("=" * 60)

    # Load input
    df = pd.read_csv(INPUT_CSV, dtype=str)
    total = len(df)
    print(f"\nLoaded {total} events from {INPUT_CSV}")

    # Load cache
    cache = load_cache(CACHE_FILE)
    print(f"Cache loaded: {len(cache)} previously geocoded queries")

    # Prepare output columns
    df["latitude"]             = None
    df["longitude"]            = None
    df["coordinate_source"]    = None
    df["coordinate_precision"] = None

    # Counters
    n_location_level  = 0   # would be used if location col existed
    n_district_level  = 0
    n_missing         = 0
    n_cache_hits      = 0
    n_api_calls       = 0
    n_failed          = 0
    failed_queries    = []

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    print(f"\nGeocoding {total} events (district-level only)...\n")

    for idx, row in df.iterrows():
        state    = str(row.get("state", "")).strip()
        dist_raw = str(row.get("district", "")).strip() if pd.notna(row.get("district")) else ""
        district = first_district(dist_raw)

        if not district:
            # No usable district
            df.at[idx, "coordinate_precision"] = "missing"
            n_missing += 1
            continue

        # Build geocoding query
        query = f"{district}, {state}, India"

        # Check cache
        if query in cache:
            result = cache[query]
            n_cache_hits += 1
        else:
            # API call
            time.sleep(REQUEST_DELAY_S)
            result = nominatim_query(query, session)
            n_api_calls += 1

            if result is None:
                # Fallback: try just state
                fallback_query = f"{state}, India"
                if fallback_query in cache:
                    result = cache[fallback_query]
                    n_cache_hits += 1
                else:
                    time.sleep(REQUEST_DELAY_S)
                    result = nominatim_query(fallback_query, session)
                    n_api_calls += 1
                    cache[fallback_query] = result  # cache even None

                if result is None:
                    n_failed += 1
                    failed_queries.append(query)
                    df.at[idx, "coordinate_precision"] = "missing"
                    n_missing += 1
                    cache[query] = None
                    continue
                else:
                    # Got state-level fallback — still mark district
                    cache[query] = result
            else:
                cache[query] = result

            # Save cache periodically (every 50 API calls)
            if n_api_calls % 50 == 0:
                save_cache(CACHE_FILE, cache)
                print(f"  [Cache saved] API calls so far: {n_api_calls}")

        if result is None:
            df.at[idx, "coordinate_precision"] = "missing"
            n_missing += 1
            continue

        df.at[idx, "latitude"]             = result["lat"]
        df.at[idx, "longitude"]            = result["lon"]
        df.at[idx, "coordinate_source"]    = "OSM Nominatim"
        df.at[idx, "coordinate_precision"] = "district"
        n_district_level += 1

    # Final cache save
    save_cache(CACHE_FILE, cache)
    print(f"\nCache saved: {len(cache)} entries in {CACHE_FILE}")

    # Save output CSV (do NOT overwrite input)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Saved: {OUTPUT_CSV}")

    # ── Stats ─────────────────────────────────────────────────────────────────

    coord_total = n_district_level
    coverage_pct = round(100 * coord_total / total, 1)

    # Per-state coverage
    state_coverage = {}
    for state_name in ["Kerala", "Tamil Nadu", "Uttarakhand"]:
        sub = df[df["state"] == state_name]
        has_coords = sub["latitude"].notna().sum()
        state_coverage[state_name] = {
            "total"     : len(sub),
            "geocoded"  : int(has_coords),
            "pct"       : round(100 * int(has_coords) / len(sub), 1) if len(sub) else 0,
        }

    unique_queries = len(cache)

    # ── Write report ──────────────────────────────────────────────────────────

    report_lines = [
        "Phase 11 -- Geocoding Report",
        "=" * 60,
        "",
        f"Input events           : {total}",
        f"Location-level coords  : {n_location_level}  (location column was empty in dataset)",
        f"District-level coords  : {n_district_level}",
        f"Still missing          : {n_missing}",
        f"Total coverage         : {coverage_pct}%",
        "",
        "Coverage by state:",
    ]
    for s, v in state_coverage.items():
        report_lines.append(f"  {s}: {v['geocoded']}/{v['total']} ({v['pct']}%)")

    report_lines += [
        "",
        f"Unique queries cached   : {unique_queries}",
        f"API calls made          : {n_api_calls}",
        f"Cache hits              : {n_cache_hits}",
        f"Failed queries          : {n_failed}",
    ]
    if failed_queries:
        report_lines.append("Failed query list (first 20):")
        for q in failed_queries[:20]:
            report_lines.append(f"  {q}")

    report_lines += [
        "",
        "Notes:",
        "  coordinate_precision = 'district'",
        "    -> Coordinates represent the district centroid, NOT the exact",
        "       flood event location. Do not treat as precise event coordinates.",
        "  coordinate_precision = 'missing'",
        "    -> No usable district name available for geocoding.",
        "  Source: OpenStreetMap Nominatim (countrycodes=in)",
    ]

    report_text = "\n".join(report_lines)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report_text)

    # ── Print final summary ────────────────────────────────────────────────────

    print()
    print("=" * 60)
    print("GEOCODING COMPLETE")
    print("=" * 60)
    print(f"Files created:")
    print(f"  {OUTPUT_CSV}")
    print(f"  {REPORT_FILE}")
    print(f"  {CACHE_FILE}")
    print()
    print(f"Total events          : {total}")
    print(f"District-level coords : {n_district_level}")
    print(f"Missing               : {n_missing}")
    print(f"Coverage              : {coverage_pct}%")
    print()
    print("Coverage by state:")
    for s, v in state_coverage.items():
        print(f"  {s}: {v['geocoded']}/{v['total']} ({v['pct']}%)")
    print()
    print(f"API calls made        : {n_api_calls}")
    print(f"Cache hits            : {n_cache_hits}")
    print(f"Failed queries        : {n_failed}")
    if n_failed > 0:
        print("Failed queries:")
        for q in failed_queries[:10]:
            print(f"  {q}")


if __name__ == "__main__":
    main()
