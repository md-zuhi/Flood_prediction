"""
prepare_training_dataset.py -- Phase 11 Step 5: Final Training Dataset Assembly
================================================================================

Combines 909 positive + 909 negative historical feature samples into a single
balanced training dataset (1818 rows), then enriches each row with:

  Static terrain features  (NASA SRTM GL1 via OpenTopography API)
    elevation_m       -- point elevation at district centroid (m)
    slope_deg         -- Horn 3x3 slope at centroid cell (degrees)
    local_relief_m    -- max - min elevation in 0.02deg bbox (m)

  Historical landslide context  (GSI Tamil Nadu inventory only)
    nearest_landslide_km  -- Haversine km to closest GSI landslide point
    landslide_count_5km   -- inventory points within 5 km
    landslide_count_10km  -- inventory points within 10 km
    landslide_count_25km  -- inventory points within 25 km

Terrain is fetched for the 60 unique (lat,lon) coordinate pairs that appear
across all 1818 rows.  Results are cached in terrain_cache.json so the script
is fully resumable after Ctrl-C.

Landslide context is computed purely from the local GSI Tamil Nadu CSV using
vectorised Haversine -- no API calls required.  Kerala and Uttarakhand rows
receive NaN because no inventory exists for those states.

Constraints
-----------
  No values are fabricated or synthesised.
  Positive and negative source CSVs are NOT modified.
  Phase 10 code is NOT modified.
  ML training is NOT performed here.
  Missing values remain NaN, never replaced with 0.

Usage
-----
    cd phase-11-ml-prediction
    python data/prepare_training_dataset.py

Resumable: terrain_cache.json is updated after every successful API fetch.
"""

import io
import json
import math
import os
import time
from typing import Optional

import numpy as np
import pandas as pd
import requests
from PIL import Image

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
PROCESSED     = os.path.join(BASE_DIR, "processed")

POS_CSV       = os.path.join(PROCESSED, "historical_positive_features.csv")
NEG_CSV       = os.path.join(PROCESSED, "historical_negative_features.csv")

# Phase 10 assets (read-only – never modified)
_P10_BACKEND  = os.path.normpath(os.path.join(
    BASE_DIR, "..", "..", "phase-10-data-fusion", "backend"))
LS_CSV        = os.path.join(_P10_BACKEND, "data",
                              "tamilnadu_landslide_inventory.csv")
ENV_FILE      = os.path.join(_P10_BACKEND, ".env")

TERRAIN_CACHE = os.path.join(BASE_DIR, "terrain_cache.json")
OUTPUT_CSV    = os.path.join(PROCESSED, "final_training_dataset.csv")
REPORT_FILE   = os.path.join(PROCESSED, "final_training_dataset_report.txt")

os.makedirs(PROCESSED, exist_ok=True)

# ---------------------------------------------------------------------------
# OpenTopography constants  (mirror Phase 10 terrainService.js)
# ---------------------------------------------------------------------------

OPENTOPO_BASE  = "https://portal.opentopography.org/API"
POINT_DATASET  = "SRTM_GL1"
DEM_TYPE       = "SRTMGL1"
BBOX_DELTA     = 0.01        # half-width of bbox in degrees
DEFAULT_NODATA = -32768.0
TERRAIN_DELAY  = 2.0         # polite delay between API calls (seconds)

# ---------------------------------------------------------------------------
# Helpers: .env loader
# ---------------------------------------------------------------------------

def load_env(path: str) -> dict:
    env: dict = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env

# ---------------------------------------------------------------------------
# Helpers: terrain cache
# ---------------------------------------------------------------------------

def load_terrain_cache(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_terrain_cache(path: str, cache: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

def coord_key(lat: float, lon: float) -> str:
    return f"{round(lat, 6)},{round(lon, 6)}"

# ---------------------------------------------------------------------------
# OpenTopography: point elevation  (single float, metres)
# ---------------------------------------------------------------------------

def fetch_point_elevation(lat: float, lon: float,
                           api_key: str,
                           session: requests.Session) -> Optional[float]:
    params = {
        "latitude" : lat,
        "longitude": lon,
        "dataset"  : POINT_DATASET,
        "API_Key"  : api_key,
    }
    try:
        r = session.get(f"{OPENTOPO_BASE}/v1/elevation",
                        params=params, timeout=30)
        r.raise_for_status()
        d = r.json()
        val = d.get("Elevation") or d.get("elevation") \
              or d.get("height") or d.get("value")
        v = float(val)
        return v if math.isfinite(v) else None
    except Exception:
        return None

# ---------------------------------------------------------------------------
# OpenTopography: Global DEM GeoTIFF
# ---------------------------------------------------------------------------

def fetch_dem_geotiff(lat: float, lon: float,
                      api_key: str,
                      session: requests.Session) -> Optional[bytes]:
    params = {
        "demtype"     : DEM_TYPE,
        "south"       : lat  - BBOX_DELTA,
        "north"       : lat  + BBOX_DELTA,
        "west"        : lon  - BBOX_DELTA,
        "east"        : lon  + BBOX_DELTA,
        "outputFormat": "GTiff",
        "API_Key"     : api_key,
    }
    try:
        r = session.get(f"{OPENTOPO_BASE}/globaldem",
                        params=params, timeout=120)
        r.raise_for_status()
        buf = r.content
        # Reject XML error responses
        head = buf[:256].decode("utf-8", errors="ignore").strip()
        if head.startswith("<?xml") or head.startswith("<error"):
            return None
        # Validate TIFF magic bytes
        le = (buf[0] == 0x49 and buf[1] == 0x49
              and buf[2] == 0x2a and buf[3] == 0x00)
        be = (buf[0] == 0x4d and buf[1] == 0x4d
              and buf[2] == 0x00 and buf[3] == 0x2a)
        return buf if (le or be) else None
    except Exception:
        return None

# ---------------------------------------------------------------------------
# GeoTIFF parsing via Pillow  (rasterio is blocked by App Control policy)
# ---------------------------------------------------------------------------

def parse_geotiff_pillow(buf: bytes, lat: float, lon: float):
    """
    Parse a GeoTIFF with Pillow.
    Returns (data_np, width, height, bbox_dict, nodata_float).
    bbox is reconstructed from BBOX_DELTA because Pillow does not read
    GeoTIFF spatial metadata -- this is fine since we know the exact bbox
    we requested.
    """
    img  = Image.open(io.BytesIO(buf))
    data = np.array(img, dtype=float)   # shape (height, width)
    h, w = data.shape
    bbox = {
        "west" : lon - BBOX_DELTA, "east" : lon + BBOX_DELTA,
        "south": lat - BBOX_DELTA, "north": lat + BBOX_DELTA,
    }
    return data, w, h, bbox, DEFAULT_NODATA

# ---------------------------------------------------------------------------
# Terrain computation  (mirrors Phase 10 terrainService.js logic)
# ---------------------------------------------------------------------------

def compute_terrain(buf: bytes, lat: float, lon: float,
                    pt_elev: Optional[float]) -> dict:
    """
    Given a downloaded GeoTIFF buffer and an optional point-elevation value,
    compute elevation_m, slope_deg, local_relief_m.
    """
    data, w, h, bbox, nodata = parse_geotiff_pillow(buf, lat, lon)

    # Valid mask
    valid_mask = (data != nodata) & np.isfinite(data) & (data > -500)
    valid_vals = data[valid_mask]
    if valid_vals.size == 0:
        return {"elevation_m": None, "slope_deg": None,
                "local_relief_m": None,
                "terrain_status": "failed",
                "terrain_error" : "no valid elevation cells in raster"}

    elev_min = float(valid_vals.min())
    elev_max = float(valid_vals.max())
    local_relief = round(elev_max - elev_min, 2)

    # Centre cell (lat/lon -> row/col)
    col_c = int(round(((lon - bbox["west"])  / (bbox["east"]  - bbox["west"]))  * (w - 1)))
    row_c = int(round(((bbox["north"] - lat) / (bbox["north"] - bbox["south"])) * (h - 1)))
    col_c = max(0, min(w - 1, col_c))
    row_c = max(0, min(h - 1, row_c))

    center_raster = data[row_c, col_c]
    center_elev   = float(center_raster) \
                    if (math.isfinite(center_raster)
                        and center_raster != nodata
                        and center_raster > -500) else None

    # Prefer point-elevation API result
    elevation_m = pt_elev if pt_elev is not None else center_elev

    # Horn 3×3 slope at centre cell
    slope_deg = None
    if 1 <= row_c < h - 1 and 1 <= col_c < w - 1:
        lat_rad = math.radians(lat)
        mpp_lat = (math.pi * 6378137) / 180.0
        mpp_lon = mpp_lat * math.cos(lat_rad)
        px_h    = (bbox["north"] - bbox["south"]) / h * mpp_lat
        px_w    = (bbox["east"]  - bbox["west"])  / w * mpp_lon

        def _z(r: int, c: int) -> Optional[float]:
            v = data[r, c]
            return float(v) if (math.isfinite(v) and v != nodata and v > -500) else None

        nw = _z(row_c-1, col_c-1); n = _z(row_c-1, col_c); ne = _z(row_c-1, col_c+1)
        ww = _z(row_c,   col_c-1);                           ee = _z(row_c,   col_c+1)
        sw = _z(row_c+1, col_c-1); s = _z(row_c+1, col_c); se = _z(row_c+1, col_c+1)

        if all(v is not None for v in [nw, n, ne, ww, ee, sw, s, se]):
            dzdx = ((ne + 2*ee + se) - (nw + 2*ww + sw)) / (8 * px_w)
            dzdy = ((sw + 2*s  + se) - (nw + 2*n  + ne)) / (8 * px_h)
            slope_deg = round(
                math.degrees(math.atan(math.sqrt(dzdx**2 + dzdy**2))), 2)
        else:
            # Fallback: search 8-neighbours for valid slope
            for dr, dc in [(0,1),(0,-1),(1,0),(-1,0),(1,1),(1,-1),(-1,1),(-1,-1)]:
                nr, nc = row_c + dr, col_c + dc
                if 1 <= nr < h-1 and 1 <= nc < w-1:
                    candidates = [_z(nr+i, nc+j)
                                  for i in [-1,0,1] for j in [-1,0,1]]
                    if all(v is not None for v in candidates):
                        nw2,n2,ne2 = candidates[0],candidates[1],candidates[2]
                        ww2,ee2    = candidates[3],candidates[5]
                        sw2,s2,se2 = candidates[6],candidates[7],candidates[8]
                        dzdx2 = ((ne2+2*ee2+se2)-(nw2+2*ww2+sw2))/(8*px_w)
                        dzdy2 = ((sw2+2*s2+se2)-(nw2+2*n2+ne2))/(8*px_h)
                        slope_deg = round(
                            math.degrees(math.atan(
                                math.sqrt(dzdx2**2+dzdy2**2))), 2)
                        break

    return {
        "elevation_m"   : round(elevation_m, 2) if elevation_m is not None else None,
        "slope_deg"     : slope_deg,
        "local_relief_m": local_relief,
        "terrain_status": "success",
        "terrain_error" : None,
    }

# ---------------------------------------------------------------------------
# Full terrain fetch for one coordinate
# ---------------------------------------------------------------------------

def fetch_terrain_for_coord(lat: float, lon: float,
                             api_key: str,
                             session: requests.Session) -> dict:
    _fail = {"elevation_m": None, "slope_deg": None, "local_relief_m": None,
             "terrain_status": "failed", "terrain_error": None}

    # Download GeoTIFF
    buf = fetch_dem_geotiff(lat, lon, api_key, session)
    if buf is None:
        _fail["terrain_error"] = "GeoTIFF download failed"
        return _fail

    # Point elevation (refines elevation_m)
    pt_elev = fetch_point_elevation(lat, lon, api_key, session)

    # Parse + compute
    try:
        result = compute_terrain(buf, lat, lon, pt_elev)
    except Exception as exc:
        _fail["terrain_error"] = f"parse/compute error: {exc}"
        return _fail

    return result

# ---------------------------------------------------------------------------
# Landslide proximity  (vectorised, TN GSI inventory)
# ---------------------------------------------------------------------------

EARTH_R_KM = 6371.0

def landslide_proximity(lat: float, lon: float,
                         ls_lats: np.ndarray,
                         ls_lons: np.ndarray) -> dict:
    """Vectorised Haversine distances from (lat,lon) to all landslide points."""
    lat1r = math.radians(lat)
    lon1r = math.radians(lon)
    lat2r = np.radians(ls_lats)
    lon2r = np.radians(ls_lons)

    dlat  = lat2r - lat1r
    dlon  = lon2r - lon1r
    a     = (np.sin(dlat / 2)**2
             + math.cos(lat1r) * np.cos(lat2r) * np.sin(dlon / 2)**2)
    dists = 2 * EARTH_R_KM * np.arcsin(np.sqrt(a))

    return {
        "nearest_landslide_km": float(round(float(np.min(dists)), 3)),
        "landslide_count_5km" : int(np.sum(dists <=  5.0)),
        "landslide_count_10km": int(np.sum(dists <= 10.0)),
        "landslide_count_25km": int(np.sum(dists <= 25.0)),
    }

_NULL_LS = {
    "nearest_landslide_km": None,
    "landslide_count_5km" : None,
    "landslide_count_10km": None,
    "landslide_count_25km": None,
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 65)
    print("Phase 11 Step 5 -- Final Training Dataset Assembly")
    print("=" * 65)

    # ── 1. Load source CSVs ───────────────────────────────────────────────
    print("\n[1/6] Loading positive and negative feature CSVs ...")
    pos = pd.read_csv(POS_CSV)
    neg = pd.read_csv(NEG_CSV)
    print(f"  Positives : {len(pos)}")
    print(f"  Negatives : {len(neg)}")
    assert len(pos) == 909, "Positive CSV row count unexpected"
    assert len(neg) == 909, "Negative CSV row count unexpected"

    # Add sample_type to positives (negatives already carry it)
    if "sample_type" not in pos.columns:
        pos = pos.copy()
        pos.insert(pos.columns.get_loc("flood_occurred"), "sample_type", "flood")

    # ── 2. Combine ────────────────────────────────────────────────────────
    print("\n[2/6] Combining datasets ...")
    combined = pd.concat([pos, neg], ignore_index=True)
    print(f"  Combined  : {len(combined)} rows")

    # ── 3. Terrain enrichment ─────────────────────────────────────────────
    print("\n[3/6] Fetching terrain (OpenTopography SRTM GL1) ...")

    env_vars = load_env(ENV_FILE)
    api_key  = env_vars.get("OPENTOPOGRAPHY_API_KEY", "").strip()

    terrain_cache = load_terrain_cache(TERRAIN_CACHE)

    unique_coords = (combined[["latitude", "longitude"]]
                     .drop_duplicates()
                     .reset_index(drop=True))
    n_unique = len(unique_coords)
    print(f"  Unique coordinate pairs : {n_unique}")
    print(f"  Cache entries loaded    : {len(terrain_cache)}")

    if not api_key or api_key == "your_opentopography_api_key_here":
        print("  [ERROR] No valid OPENTOPOGRAPHY_API_KEY -- terrain will be null.")
        for _, row in unique_coords.iterrows():
            ck = coord_key(float(row["latitude"]), float(row["longitude"]))
            if ck not in terrain_cache:
                terrain_cache[ck] = {
                    "elevation_m": None, "slope_deg": None,
                    "local_relief_m": None,
                    "terrain_status": "no_api_key", "terrain_error": "no API key"
                }
    else:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "phase11-terrain/1.0 (SIH-FlashFlood-Research)"
        })

        to_fetch = [
            (float(row["latitude"]), float(row["longitude"]))
            for _, row in unique_coords.iterrows()
            if coord_key(float(row["latitude"]), float(row["longitude"]))
               not in terrain_cache
        ]
        n_cached_start = n_unique - len(to_fetch)
        print(f"  Already cached          : {n_cached_start}")
        print(f"  To fetch via API        : {len(to_fetch)}")

        for i, (lat, lon) in enumerate(to_fetch, 1):
            ck = coord_key(lat, lon)
            print(f"  [{i:02d}/{len(to_fetch)}] lat={lat:.4f} lon={lon:.4f} ...",
                  end=" ", flush=True)
            time.sleep(TERRAIN_DELAY)

            t = fetch_terrain_for_coord(lat, lon, api_key, session)
            terrain_cache[ck] = t
            save_terrain_cache(TERRAIN_CACHE, terrain_cache)   # persist after each fetch

            if t["terrain_status"] == "success":
                print(f"elev={t['elevation_m']}m  "
                      f"slope={t['slope_deg']}deg  "
                      f"relief={t['local_relief_m']}m")
            else:
                print(f"FAILED -- {t['terrain_error']}")

    # Summarise
    n_t_success = sum(1 for v in terrain_cache.values()
                      if v.get("terrain_status") == "success")
    n_t_failed  = sum(1 for v in terrain_cache.values()
                      if v.get("terrain_status") != "success")
    print(f"\n  Terrain cache final: {n_t_success} success, {n_t_failed} failed")

    # Join terrain to combined
    def _terrain(lat: float, lon: float, field: str):
        return terrain_cache.get(coord_key(lat, lon), {}).get(field)

    combined["elevation_m"]    = [_terrain(r.latitude, r.longitude, "elevation_m")    for _, r in combined.iterrows()]
    combined["slope_deg"]      = [_terrain(r.latitude, r.longitude, "slope_deg")      for _, r in combined.iterrows()]
    combined["local_relief_m"] = [_terrain(r.latitude, r.longitude, "local_relief_m") for _, r in combined.iterrows()]
    combined["terrain_status"] = [_terrain(r.latitude, r.longitude, "terrain_status") for _, r in combined.iterrows()]
    combined["terrain_error"]  = [_terrain(r.latitude, r.longitude, "terrain_error")  for _, r in combined.iterrows()]

    # ── 4. Landslide proximity ─────────────────────────────────────────────
    print("\n[4/6] Computing landslide proximity ...")

    ls_df = None
    if os.path.exists(LS_CSV):
        ls_df    = pd.read_csv(LS_CSV)
        ls_lats  = ls_df["latitude"].to_numpy(dtype=float)
        ls_lons  = ls_df["longitude"].to_numpy(dtype=float)
        print(f"  GSI inventory loaded: {len(ls_df)} records (Tamil Nadu only)")
    else:
        ls_lats = ls_lons = None
        print(f"  [WARN] GSI inventory not found at {LS_CSV}")

    ls_map: dict[str, dict] = {}
    unique_coords2 = (combined[["latitude", "longitude", "state"]]
                      .drop_duplicates(subset=["latitude", "longitude"]))
    n_tn_coords = 0; n_other_coords = 0

    for _, row in unique_coords2.iterrows():
        lat   = float(row["latitude"])
        lon   = float(row["longitude"])
        state = row["state"]
        ck    = coord_key(lat, lon)

        if ls_df is not None and state == "Tamil Nadu":
            ls_map[ck] = landslide_proximity(lat, lon, ls_lats, ls_lons)
            n_tn_coords += 1
        else:
            ls_map[ck] = dict(_NULL_LS)   # Kerala / Uttarakhand: null
            n_other_coords += 1

    print(f"  TN coords computed    : {n_tn_coords}")
    print(f"  Non-TN (null)         : {n_other_coords}")

    def _ls(lat: float, lon: float, field: str):
        return ls_map.get(coord_key(lat, lon), {}).get(field)

    combined["nearest_landslide_km"] = [_ls(r.latitude, r.longitude, "nearest_landslide_km") for _, r in combined.iterrows()]
    combined["landslide_count_5km"]  = [_ls(r.latitude, r.longitude, "landslide_count_5km")  for _, r in combined.iterrows()]
    combined["landslide_count_10km"] = [_ls(r.latitude, r.longitude, "landslide_count_10km") for _, r in combined.iterrows()]
    combined["landslide_count_25km"] = [_ls(r.latitude, r.longitude, "landslide_count_25km") for _, r in combined.iterrows()]

    # ── 5. Select and write final CSV ─────────────────────────────────────
    print("\n[5/6] Writing final_training_dataset.csv ...")

    FINAL_COLS = [
        # Identity / metadata
        "event_id", "date", "year", "state", "district",
        "latitude", "longitude", "coordinate_precision",
        "sample_type",
        # Label
        "flood_occurred",
        # Dynamic weather features  (ERA5-Land antecedent day)
        "rain_1h_mm", "rain_3h_mm", "rain_6h_mm",
        "rain_12h_mm", "rain_24h_mm",
        "temperature_c", "humidity_percent", "soil_moisture_m3m3",
        # Static terrain features  (SRTM GL1)
        "elevation_m", "slope_deg", "local_relief_m",
        # Landslide context  (GSI Tamil Nadu)
        "nearest_landslide_km",
        "landslide_count_5km", "landslide_count_10km", "landslide_count_25km",
        # Provenance
        "terrain_status", "terrain_error", "retrieval_status",
    ]
    out_cols = [c for c in FINAL_COLS if c in combined.columns]
    final_df = combined[out_cols].copy()
    final_df.to_csv(OUTPUT_CSV, index=False)
    print(f"  Rows: {len(final_df)}  Columns: {len(final_df.columns)}")
    print(f"  Saved: {OUTPUT_CSV}")

    # ── 6. Report ─────────────────────────────────────────────────────────
    print("\n[6/6] Writing report ...")

    total      = len(final_df)
    n_pos_out  = int((final_df["flood_occurred"] == 1).sum())
    n_neg_out  = int((final_df["flood_occurred"] == 0).sum())
    bal_pos    = round(n_pos_out / total * 100, 1)
    bal_neg    = round(100 - bal_pos, 1)

    state_vc   = final_df["state"].value_counts()
    coord_vc   = final_df["coordinate_precision"].value_counts()

    feat_cols  = [
        "rain_1h_mm", "rain_3h_mm", "rain_6h_mm", "rain_12h_mm", "rain_24h_mm",
        "temperature_c", "humidity_percent", "soil_moisture_m3m3",
        "elevation_m", "slope_deg", "local_relief_m",
        "nearest_landslide_km", "landslide_count_5km",
        "landslide_count_10km", "landslide_count_25km",
    ]
    feat_cols_present = [c for c in feat_cols if c in final_df.columns]
    miss = {c: int(final_df[c].isna().sum()) for c in feat_cols_present}

    dup_rows  = int(final_df.duplicated().sum())
    dup_ids   = int(final_df["event_id"].duplicated().sum())

    t_success_rows = int((final_df["terrain_status"] == "success").sum()) \
                     if "terrain_status" in final_df else 0
    t_fail_rows    = total - t_success_rows

    ls_coverage    = int(final_df["nearest_landslide_km"].notna().sum()) \
                     if "nearest_landslide_km" in final_df else 0
    tn_total_rows  = int((final_df["state"] == "Tamil Nadu").sum())
    ls_inv_size    = len(ls_df) if ls_df is not None else 0

    # Write report
    def _miss(col: str) -> str:
        m = miss.get(col, "N/A")
        if isinstance(m, int):
            return f"{m} ({round(m/total*100,1)}%)"
        return str(m)

    lines = [
        "Phase 11 Step 5 -- Final Training Dataset Report",
        "=" * 65,
        "",
        f"Output  : data/processed/final_training_dataset.csv",
        f"Script  : data/prepare_training_dataset.py",
        f"Created : {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "-" * 65,
        "ROW COUNTS",
        "-" * 65,
        f"  Total rows                 : {total}",
        f"  Positive samples (flood=1) : {n_pos_out}",
        f"  Negative samples (flood=0) : {n_neg_out}",
        f"  Class balance              : {bal_pos}% positive / {bal_neg}% negative",
        "",
        "-" * 65,
        "ROWS PER STATE",
        "-" * 65,
    ]
    for st, cnt in state_vc.items():
        lines.append(f"  {st:<20} : {cnt}")
    lines += [
        "",
        "-" * 65,
        "FINAL FEATURE COLUMNS  (28 total)",
        "-" * 65,
    ]
    for i, col in enumerate(final_df.columns, 1):
        lines.append(f"  {i:02d}. {col}")
    lines += [
        "",
        "-" * 65,
        "MISSING VALUES PER FEATURE",
        "-" * 65,
    ]
    for col in feat_cols_present:
        lines.append(f"  {col:<30} : {_miss(col)}")
    lines += [
        "",
        "-" * 65,
        "DUPLICATE ROWS",
        "-" * 65,
        f"  Exact duplicate rows       : {dup_rows}",
        f"  Duplicate event_id values  : {dup_ids}",
        "",
        "-" * 65,
        "COORDINATE PRECISION SUMMARY",
        "-" * 65,
    ]
    for prec, cnt in coord_vc.items():
        lines.append(f"  {prec:<20} : {cnt} rows")
    lines += [
        "",
        "-" * 65,
        "TERRAIN RETRIEVAL  (NASA SRTM GL1 via OpenTopography)",
        "-" * 65,
        f"  Unique (lat,lon) pairs     : {n_unique}",
        f"  Terrain success (rows)     : {t_success_rows}",
        f"  Terrain failed/null (rows) : {t_fail_rows}",
        f"  elevation_m missing        : {_miss('elevation_m')}",
        f"  slope_deg missing          : {_miss('slope_deg')}",
        f"  local_relief_m missing     : {_miss('local_relief_m')}",
        f"  Cache file                 : data/terrain_cache.json",
        "",
        "-" * 65,
        "LANDSLIDE FEATURE COVERAGE  (GSI Tamil Nadu Inventory)",
        "-" * 65,
        f"  Inventory records          : {ls_inv_size}",
        f"  States covered             : Tamil Nadu only",
        f"  Tamil Nadu rows in dataset : {tn_total_rows}",
        f"  Rows with landslide data   : {ls_coverage} / {total}  ({round(ls_coverage/total*100,1)}%)",
        f"  Kerala rows                : no coverage -- GSI TN inventory only",
        f"  Uttarakhand rows           : no coverage -- GSI TN inventory only",
        f"  nearest_landslide_km miss  : {_miss('nearest_landslide_km')}",
        f"  landslide_count_5km miss   : {_miss('landslide_count_5km')}",
        f"  landslide_count_10km miss  : {_miss('landslide_count_10km')}",
        f"  landslide_count_25km miss  : {_miss('landslide_count_25km')}",
        "",
        "-" * 65,
        "NOTES",
        "-" * 65,
        "  1. Terrain values are static per district centroid.",
        "     All 1818 rows sharing a centroid get identical terrain values.",
        "  2. Landslide proximity is NULL for Kerala and Uttarakhand because",
        "     the only available inventory (GSI) covers Tamil Nadu only.",
        "     These four columns should be treated as optional features in",
        "     the ML model (present for TN, absent for KL/UK).",
        "  3. No values were fabricated or synthesised.",
        "  4. Positive and negative source CSVs were NOT modified.",
        "  5. Phase 10 code was NOT modified.",
        "  6. ML training has NOT been performed.",
    ]

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"  Saved: {REPORT_FILE}")

    # ── Console summary ───────────────────────────────────────────────────
    print()
    print("=" * 65)
    print("FINAL STATISTICS")
    print("=" * 65)
    print(f"  Total rows        : {total}")
    print(f"  Positives         : {n_pos_out}")
    print(f"  Negatives         : {n_neg_out}")
    print(f"  Class balance     : {bal_pos}% / {bal_neg}%")
    print(f"  Columns           : {len(final_df.columns)}")
    print(f"  Terrain success   : {t_success_rows} rows / {total}")
    print(f"  Landslide covered : {ls_coverage} / {total}  ({round(ls_coverage/total*100,1)}%)")
    print(f"  Duplicate rows    : {dup_rows}")
    print()
    print("  Missing values:")
    for col in feat_cols_present:
        m = miss.get(col, 0)
        if m > 0:
            print(f"    {col:<30}: {m} ({round(m/total*100,1)}%)")
        else:
            print(f"    {col:<30}: 0")
    print()
    print("Done.")


if __name__ == "__main__":
    main()
