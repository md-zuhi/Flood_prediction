"""
resume_terrain_completion.py -- Phase 11 Step 5 (resume): complete missing terrain
==================================================================================

Completes ONLY the terrain values still missing from terrain_cache.json
(slope_deg / local_relief_m for coordinates cached as "partial" after the
previous OpenTopography free-tier quota exhaustion).

Reuses the existing implementation from prepare_training_dataset.py:
  - terrain cache load/save + coord_key
  - compute_terrain()  (Horn 3x3 slope + local relief from SRTM GL1 GeoTIFF)
  - .env loader and OpenTopography constants

Design constraints (Phase 11 retry protocol):
  1. Cached SUCCESS entries are never re-fetched.
  2. Cached elevation_m values are preserved as-is (no re-fetch needed --
     elevation for partial coords already exists). Only ONE API call per
     coordinate (globaldem GeoTIFF) is required for slope + relief,
     keeping total calls (24) well within the 50-calls/24h free tier.
  3. No values are fabricated. If the API fails, the run STOPS and reports
     the exact error plus the number of coordinates still remaining.
  4. flood labels, source datasets, ERA5 weather, landslide columns and
     Phase 10 are NOT touched here.

After the cache is complete, re-run data/prepare_training_dataset.py to
regenerate final_training_dataset.csv + report through the existing pipeline
(it performs zero additional API calls because every coordinate is cached).

Usage:
    cd phase-11-ml-prediction
    python data/resume_terrain_completion.py
"""

import math
import os
import sys
import time

import requests

# Reuse the existing Step 5 implementation (same directory)
from prepare_training_dataset import (
    BBOX_DELTA,
    DEM_TYPE,
    ENV_FILE,
    OPENTOPO_BASE,
    TERRAIN_CACHE,
    TERRAIN_DELAY,
    compute_terrain,
    coord_key,
    load_env,
    load_terrain_cache,
    save_terrain_cache,
)

# ---------------------------------------------------------------------------
# Instrumented DEM fetch -- mirrors prepare_training_dataset.fetch_dem_geotiff
# params exactly, but captures the exact HTTP/XML error so the retry protocol
# can report it verbatim (the original helper intentionally swallows details).
# ---------------------------------------------------------------------------

def fetch_dem_geotiff_with_error(lat: float, lon: float,
                                 api_key: str,
                                 session: requests.Session):
    """
    Returns (buffer, error).
      buffer is a valid GeoTIFF byte string on success (error None).
      On failure buffer is None and error carries the exact cause.
    """
    params = {
        "demtype"     : DEM_TYPE,
        "south"       : lat - BBOX_DELTA,
        "north"       : lat + BBOX_DELTA,
        "west"        : lon - BBOX_DELTA,
        "east"        : lon + BBOX_DELTA,
        "outputFormat": "GTiff",
        "API_Key"     : api_key,
    }
    try:
        r = session.get(f"{OPENTOPO_BASE}/globaldem",
                        params=params, timeout=120)
    except Exception as exc:
        return None, f"request exception: {exc}"

    if r.status_code != 200:
        return None, f"HTTP {r.status_code}: {r.text[:300]}"

    buf = r.content
    head = buf[:256].decode("utf-8", errors="ignore").strip()
    if head.startswith("<?xml") or head.startswith("<error") or "<" == head[:1]:
        return None, f"non-TIFF error response: {head[:300]}"

    le = (buf[0] == 0x49 and buf[1] == 0x49
          and buf[2] == 0x2A and buf[3] == 0x00)
    be = (buf[0] == 0x4D and buf[1] == 0x4D
          and buf[2] == 0x00 and buf[3] == 0x2A)
    if not (le or be):
        return None, f"response is not a valid GeoTIFF (head={head[:80]!r})"

    return buf, None


def main() -> int:
    print("=" * 65)
    print("Phase 11 Step 5 (resume) -- complete missing slope/local relief")
    print("=" * 65)

    env_vars = load_env(ENV_FILE)
    api_key = env_vars.get("OPENTOPOGRAPHY_API_KEY", "").strip()
    if not api_key or api_key == "your_opentopography_api_key_here":
        print("[STOP] No valid OPENTOPOGRAPHY_API_KEY found in phase-10 .env")
        return 2

    cache = load_terrain_cache(TERRAIN_CACHE)
    print(f"Cache loaded: {len(cache)} entries "
          f"from {os.path.relpath(TERRAIN_CACHE, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))}")

    # Targets: any entry still missing slope_deg or local_relief_m.
    # Fully-successful cached entries are NEVER re-fetched.
    targets = []
    for k, v in cache.items():
        if v.get("slope_deg") is None or v.get("local_relief_m") is None:
            lat_s, lon_s = k.split(",")
            targets.append((float(lat_s), float(lon_s), k))

    n_already_ok = sum(1 for v in cache.values()
                       if v.get("slope_deg") is not None
                       and v.get("local_relief_m") is not None)
    print(f"Already complete (cached, untouched) : {n_already_ok}")
    print(f"Coordinates needing slope/relief     : {len(targets)}")
    print(f"API calls planned (1 per coordinate) : {len(targets)}")
    print()

    if not targets:
        print("Nothing to fetch -- cache already complete.")
        return 0

    session = requests.Session()
    session.headers.update({
        "User-Agent": "phase11-terrain-resume/1.0 (SIH-FlashFlood-Research)"
    })

    completed = 0
    for i, (lat, lon, ck) in enumerate(targets, 1):
        print(f"[{i:02d}/{len(targets)}] lat={lat:.6f} lon={lon:.6f} ...",
              end=" ", flush=True)
        time.sleep(TERRAIN_DELAY)

        buf, err = fetch_dem_geotiff_with_error(lat, lon, api_key, session)
        if buf is None:
            remaining = len(targets) - completed
            print("FAILED")
            print()
            print("=" * 65)
            print("STOP -- OpenTopography retrieval failed (retry protocol)")
            print("=" * 65)
            print(f"Exact error                : {err}")
            print(f"Coordinates completed now  : {completed}")
            print(f"Coordinates still missing  : {remaining}")
            print("No values fabricated. Cache left unchanged for failed coord.")
            return 3

        prev_elev = cache[ck].get("elevation_m")
        try:
            result = compute_terrain(buf, lat, lon, pt_elev=prev_elev)
        except Exception as exc:
            remaining = len(targets) - completed
            print("FAILED")
            print()
            print(f"STOP -- parse/compute error: {exc}")
            print(f"Coordinates still missing  : {remaining}")
            return 3

        if result.get("slope_deg") is None or result.get("local_relief_m") is None:
            # Raster had no valid data around the centroid -- report honestly.
            cache[ck]["terrain_status"] = "partial"
            cache[ck]["terrain_error"] = ("GeoTIFF fetched but slope/relief not "
                                          "computable (nodata neighbourhood)")
            save_terrain_cache(TERRAIN_CACHE, cache)
            print("nodata neighbourhood -- left partial")
            continue

        # Preserve the previously cached elevation exactly; fill slope/relief.
        cache[ck] = {
            "elevation_m"   : prev_elev,
            "slope_deg"     : result["slope_deg"],
            "local_relief_m": result["local_relief_m"],
            "terrain_status": "success",
            "terrain_error" : None,
        }
        save_terrain_cache(TERRAIN_CACHE, cache)   # persist after each fetch
        completed += 1
        print(f"slope={result['slope_deg']}deg relief={result['local_relief_m']}m")

    print()
    print("=" * 65)
    print(f"CACHE COMPLETE: {completed} coordinates filled, "
          f"{len(targets) - completed} still missing")
    print("=" * 65)
    print("Next: re-run 'python data/prepare_training_dataset.py' to rebuild")
    print("final_training_dataset.csv + report (zero extra API calls).")
    return 0


if __name__ == "__main__":
    sys.exit(main())