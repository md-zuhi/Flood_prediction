import os
import io
import json
import math
import time
import re
import random
from datetime import datetime, date, timedelta
from typing import Optional, Tuple
import pandas as pd
import numpy as np
import requests

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_CSV = os.path.normpath(os.path.join(BASE_DIR, "..", "data", "raw", "India_Flood_Inventory_v3.csv"))
P10_TERRAIN_CACHE = os.path.normpath(os.path.join(BASE_DIR, "..", "..", "backend", "services", "terrain_cache.json"))
LS_CSV = os.path.normpath(os.path.join(BASE_DIR, "..", "..", "backend", "data", "tamilnadu_landslide_inventory.csv"))

OUTPUT_EVENTS_CSV = os.path.join(BASE_DIR, "historical_events_v2.csv")
OUTPUT_DATASET_CSV = os.path.join(BASE_DIR, "final_training_dataset_v2_pilot.csv")
OUTPUT_REPORT_MD = os.path.join(BASE_DIR, "dataset_v2_quality_report.md")

GEOCACHE_FILE = os.path.join(BASE_DIR, "geocache_v2.json")
ERA5_CACHE_FILE = os.path.join(BASE_DIR, "era5_api_cache_v2.json")

# ── Nominatim / API Settings ──────────────────────────────────────────────────
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive"
USER_AGENT = "dataset-v2-pilot-generator/2.0 (antigravity-flood-prediction)"
REQUEST_DELAY_S = 1.2
RANDOM_SEED = 42

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# ── Cache Handlers ────────────────────────────────────────────────────────────
def load_json_cache(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def save_json_cache(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

geocache = load_json_cache(GEOCACHE_FILE)
era5_cache = load_json_cache(ERA5_CACHE_FILE)

LOCAL_FALLBACKS = {
    "shimla": {"lat": 31.1048, "lon": 77.1734, "precision": "district"},
    "kullu": {"lat": 31.9579, "lon": 77.1095, "precision": "district"},
    "solan": {"lat": 30.9045, "lon": 77.0967, "precision": "district"},
    "mandi": {"lat": 31.5892, "lon": 76.9182, "precision": "district"},
    "chamba": {"lat": 32.5534, "lon": 76.1258, "precision": "district"},
    "kangra": {"lat": 32.1001, "lon": 76.2691, "precision": "district"},
    "kinnaur": {"lat": 31.6510, "lon": 78.4754, "precision": "district"},
    "lahaul": {"lat": 32.3006, "lon": 77.9942, "precision": "district"},
    "sirmaur": {"lat": 30.5894, "lon": 77.3006, "precision": "district"},
    "hamirpur": {"lat": 31.6862, "lon": 76.5213, "precision": "district"},
    "una": {"lat": 31.4684, "lon": 76.2708, "precision": "district"},
    "bilaspur": {"lat": 31.3260, "lon": 76.7600, "precision": "district"},
    "uttarkashi": {"lat": 30.7268, "lon": 78.4354, "precision": "district"},
    "pauri": {"lat": 30.1477, "lon": 78.7806, "precision": "district"},
    "rudraprayag": {"lat": 30.2844, "lon": 78.9811, "precision": "district"},
    "pithoragarh": {"lat": 29.5858, "lon": 80.2151, "precision": "district"},
    "champawat": {"lat": 29.3374, "lon": 80.0955, "precision": "district"},
    "bageshwar": {"lat": 29.8404, "lon": 79.7694, "precision": "district"},
    "almora": {"lat": 29.5960, "lon": 79.6467, "precision": "district"},
    "nainital": {"lat": 29.3804, "lon": 79.4631, "precision": "district"},
    "udham": {"lat": 28.9868, "lon": 79.3986, "precision": "district"},
    "haridwar": {"lat": 29.9457, "lon": 78.1642, "precision": "district"},
    "garhwal": {"lat": 30.1500, "lon": 78.8000, "precision": "district"},
}

nominatim_blocked = False

def geocode_query(query: str, session: requests.Session) -> Optional[dict]:
    global nominatim_blocked
    
    if query in geocache:
        # Safeguard: handle legacy cache entries lacking precision
        if "precision" not in geocache[query]:
            geocache[query]["precision"] = "district"
        return geocache[query]

    # If the API was flagged as rate-limited, skip network calls immediately
    if nominatim_blocked:
        return None

    # Check local hardcoded fallbacks before hitting Nominatim API
    query_lower = query.lower()
    for key, coords in LOCAL_FALLBACKS.items():
        if key in query_lower:
            geocache[query] = {
                "lat": coords["lat"],
                "lon": coords["lon"],
                "precision": coords["precision"],
                "display_name": f"{query} (Local Fallback)"
            }
            save_json_cache(GEOCACHE_FILE, geocache)
            return geocache[query]

    params = {
        "q": query,
        "format": "json",
        "limit": 1,
        "countrycodes": "in",
        "addressdetails": 1
    }
    
    retries = 3
    delay = REQUEST_DELAY_S
    
    for attempt in range(retries):
        time.sleep(delay)
        try:
            r = session.get(NOMINATIM_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=15)
            if r.status_code == 429:
                print(f"      [Geocoding Warn] HTTP 429 (Rate Limit) for '{query}'. Retrying in 5s (Attempt {attempt+1}/{retries})...")
                time.sleep(5)
                delay = 2.0
                if attempt == retries - 1:
                    print("      [Geocoding Block] Nominatim is rate-limiting our requests. Bypassing subsequent geocoding API calls.")
                    nominatim_blocked = True
                continue
                
            r.raise_for_status()
            results = r.json()
            if results:
                res = results[0]
                lat = float(res["lat"])
                lon = float(res["lon"])
                osm_type = res.get("type", "unknown")
                address = res.get("address", {})
                
                # Map OSM address type to canonical precision
                precision = "unknown"
                if osm_type in ["village", "hamlet", "isolated_dwellings"] or "village" in address:
                    precision = "village"
                elif osm_type in ["town", "suburb"] or "town" in address:
                    precision = "town"
                elif osm_type in ["city", "quarter"] or "city" in address:
                    precision = "town"
                elif osm_type in ["county", "district", "administrative"] or "district" in address or "county" in address:
                    precision = "district"
                
                geocache[query] = {
                    "lat": lat,
                    "lon": lon,
                    "precision": precision,
                    "display_name": res.get("display_name", "")
                }
                save_json_cache(GEOCACHE_FILE, geocache)
                return geocache[query]
            break
        except Exception as e:
            if "429" in str(e):
                print(f"      [Geocoding Warn] HTTP 429 (Rate Limit) for '{query}'. Retrying in 5s (Attempt {attempt+1}/{retries})...")
                time.sleep(5)
                delay = 2.0
                if attempt == retries - 1:
                    print("      [Geocoding Block] Nominatim is rate-limiting our requests. Bypassing subsequent geocoding API calls.")
                    nominatim_blocked = True
                continue
            print(f"      [Geocoding Warn] Failed query '{query}': {e}")
            break
            
    return None

# ── Parse locality name from free text ────────────────────────────────────────
def extract_locality(description: str, district: str) -> Optional[str]:
    if not isinstance(description, str) or pd.isna(description) or not description.strip():
        return None
    
    # Check for pattern like "at/near/in/on [Capitalised Word(s)]"
    m = re.search(r'\b(?:at|near|in|on)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', description)
    if m:
        loc = m.group(1).strip()
        # Avoid returning common nouns or district names as locality
        bad_words = {"district", "village", "town", "river", "bridge", "house", "road", "rail", "express", "huts", "hilly", "monsoon"}
        if loc.lower() not in bad_words and loc.lower() != district.lower():
            return loc
    return None

# ── Load Landslide Inventory ──────────────────────────────────────────────────
landslide_df = None
if os.path.exists(LS_CSV):
    try:
        landslide_df = pd.read_csv(LS_CSV)
        print(f"Loaded {len(landslide_df)} landslide inventory points.")
    except Exception as e:
        print(f"Could not load landslide inventory: {e}")

def compute_landslide_features(lat: float, lon: float) -> Tuple[Optional[float], Optional[int], str]:
    if landslide_df is None:
        return None, None, "Landslide inventory CSV missing"
    
    # Calculate Haversine distances vectorised
    lats2 = landslide_df["latitude"].values
    lons2 = landslide_df["longitude"].values
    
    lat1_rad = math.radians(lat)
    lon1_rad = math.radians(lon)
    lat2_rad = np.radians(lats2)
    lon2_rad = np.radians(lons2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = np.sin(dlat / 2.0)**2 + math.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon / 2.0)**2
    c = 2.0 * np.arcsin(np.sqrt(a))
    dists_km = 6371.0 * c
    
    nearest_km = float(np.min(dists_km))
    count_10km = int(np.sum(dists_km <= 10.0))
    
    return round(nearest_km, 3), count_10km, "Tamil Nadu GSI Landslide Inventory"

# ── Load Terrain Cache ────────────────────────────────────────────────────────
terrain_cache = load_json_cache(P10_TERRAIN_CACHE)

def get_terrain_features(lat: float, lon: float, state: str) -> dict:
    key = f"{round(lat, 4)},{round(lon, 4)}"
    if key in terrain_cache:
        tc = terrain_cache[key]
        return {
            "elevation_m": tc.get("elevation_m"),
            "slope_deg": tc.get("slope_deg"),
            "local_relief_m": tc.get("local_relief_m"),
            "provenance": f"Cache hit - Source: {tc.get('source', 'NASA SRTM')}, Mode: {tc.get('terrain_mode', 'full_terrain')}"
        }
    
    # Fallback to Open-Meteo elevation if not in cache (OpenTopography has caps)
    try:
        url = "https://api.open-meteo.com/v1/elevation"
        r = requests.get(url, params={"latitude": lat, "longitude": lon}, timeout=15)
        r.raise_for_status()
        elev = r.json()["elevation"][0]
        return {
            "elevation_m": round(float(elev), 2),
            "slope_deg": None,
            "local_relief_m": None,
            "provenance": "Copernicus DEM GLO-90 (Open-Meteo API Fallback) - Slope/relief unavailable due to API rate limits"
        }
    except Exception as e:
        return {
            "elevation_m": None,
            "slope_deg": None,
            "local_relief_m": None,
            "provenance": f"Failed to retrieve elevation: {e}"
        }

# ── Fetch ERA5 antecedent weather data ───────────────────────────────────────
def fetch_era5_antecedent(lat: float, lon: float, ante_date_str: str, session: requests.Session) -> dict:
    cache_key = f"{round(lat, 4)},{round(lon, 4)},{ante_date_str}"
    if cache_key in era5_cache:
        cached_val = era5_cache[cache_key]
        expected_keys = [
            "rain_1h_mm", "rain_3h_mm", "rain_6h_mm", "rain_12h_mm", "rain_24h_mm",
            "temperature_c", "humidity_percent", "soil_moisture_m3m3"
        ]
        if all(k in cached_val for k in expected_keys):
            return cached_val
        
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": ante_date_str,
        "end_date": ante_date_str,
        "hourly": "precipitation,temperature_2m,relative_humidity_2m,soil_moisture_0_to_7cm",
        "timezone": "UTC"
    }
    time.sleep(REQUEST_DELAY_S)
    try:
        r = session.get(ARCHIVE_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=30)
        r.raise_for_status()
        data = r.json()
        hourly = data.get("hourly", {})
        precip = hourly.get("precipitation", [None]*24)
        temp = hourly.get("temperature_2m", [None]*24)
        rh = hourly.get("relative_humidity_2m", [None]*24)
        sm = hourly.get("soil_moisture_0_to_7cm", [None]*24)
        
        # Calculate sum and mean safely
        def safe_sum(lst, s, e):
            sub = lst[s:e+1]
            if any(v is None for v in sub):
                return None
            return round(sum(sub), 2)
            
        def safe_mean(lst):
            if any(v is None for v in lst):
                return None
            return round(sum(lst) / len(lst), 2)
            
        res = {
            "rain_1h_mm": safe_sum(precip, 23, 23),
            "rain_3h_mm": safe_sum(precip, 21, 23),
            "rain_6h_mm": safe_sum(precip, 18, 23),
            "rain_12h_mm": safe_sum(precip, 12, 23),
            "rain_24h_mm": safe_sum(precip, 0, 23),
            "temperature_c": safe_mean(temp),
            "humidity_percent": safe_mean(rh),
            "soil_moisture_m3m3": safe_mean(sm),
            "status": "success",
            "error": None
        }
        era5_cache[cache_key] = res
        save_json_cache(ERA5_CACHE_FILE, era5_cache)
        return res
    except Exception as e:
        return {
            "rain_1h_mm": None, "rain_3h_mm": None, "rain_6h_mm": None,
            "rain_12h_mm": None, "rain_24h_mm": None,
            "temperature_c": None, "humidity_percent": None, "soil_moisture_m3m3": None,
            "status": "failed",
            "error": str(e)
        }

# ── Main Generator ────────────────────────────────────────────────────────────
def main():
    print("=" * 65)
    print("Dataset V2 Pilot Dataset Generation Pipeline")
    print("=" * 65)
    
    if not os.path.exists(RAW_CSV):
        print(f"[ERROR] Raw flood inventory CSV not found at {RAW_CSV}")
        return
        
    print(f"Reading raw flood inventory...")
    df = pd.read_csv(RAW_CSV, low_memory=False)
    
    # ── 1. Extract clean positive events ──────────────────────────────────────
    print("Filtering for target states & clean single-district rows...")
    TARGET_STATES = ["Kerala", "Tamil Nadu", "Himachal Pradesh", "Uttarakhand"]
    
    df_clean = df[df["State"].isin(TARGET_STATES)].copy()
    
    def is_single_district(val):
        if not isinstance(val, str) or pd.isna(val):
            return False
        if "," in val:
            return False
        bad = {"entire village", "n/a", "na", "nil", "none", "various", "all districts"}
        return val.lower().strip() not in bad
        
    df_clean = df_clean[df_clean["Districts"].apply(is_single_district)]
    
    # Format dates
    df_clean["parsed_date"] = pd.to_datetime(df_clean["Start Date"], dayfirst=True, errors="coerce")
    df_clean = df_clean.dropna(subset=["parsed_date"])
    
    # Deduplicate same location/same date
    df_clean = df_clean.drop_duplicates(subset=["Districts", "parsed_date"])
    
    print(f"Extracted {len(df_clean)} potential clean positive events.")
    
    # Limit to a pilot of 250 positives (to yield ~500 total balanced rows)
    df_pilot_pos = df_clean.sample(n=min(250, len(df_clean)), random_state=RANDOM_SEED).copy()
    print(f"Selected {len(df_pilot_pos)} positive events for pilot.")
    
    # Build forbidden index of flood dates per district
    # Mapping normalized districts to all dates in inventory (with buffer)
    print("Building forbidden date index for negative sampling...")
    forbidden_dates = {}
    for _, row in df.iterrows():
        dist_str = str(row.get("Districts", "")).strip()
        if not dist_str or pd.isna(row.get("Districts")):
            continue
        dists = [d.strip().lower() for d in dist_str.split(",")]
        
        start_date = pd.to_datetime(row.get("Start Date"), dayfirst=True, errors="coerce")
        if pd.isna(start_date):
            continue
        event_d = start_date.date()
        
        for d in dists:
            if d not in forbidden_dates:
                forbidden_dates[d] = set()
            for delta in range(-14, 15):
                forbidden_dates[d].add(event_d + timedelta(days=delta))
                
    # ── 2. Geocoding & Event Schema Construction ──────────────────────────────
    print("\nGeocoding positive events & generating negative events...")
    session = requests.Session()
    
    positive_records = []
    negative_records = []
    
    p_counter = 1
    for _, row in df_pilot_pos.iterrows():
        uei = row["UEI"]
        event_date = row["parsed_date"].date()
        state = row["State"]
        district = row["Districts"].strip()
        
        # Mine locality from description
        desc = str(row.get("Description of Casualties/injured", "")) + " " + str(row.get("Extent of damage ", ""))
        locality = extract_locality(desc, district)
        
        # Build query
        query_loc = f"{locality}, {district}, {state}, India" if locality else None
        query_dist = f"{district}, {state}, India"
        
        geo_res = None
        if query_loc:
            print(f"  [{p_counter}] Attempting precise geocode for UEI {uei} (Locality={locality})...")
            geo_res = geocode_query(query_loc, session)
            
        if not geo_res:
            if query_loc:
                print(f"      [Fallback] Falling back to district geocode for {district}...")
            geo_res = geocode_query(query_dist, session)
            
        if not geo_res:
            print(f"      [WARN] Could not geocode query '{query_dist}'. Skipping event.")
            continue
            
        lat = geo_res["lat"]
        lon = geo_res["lon"]
        precision = geo_res["precision"]
        
        pos_id = f"V2-POS-{p_counter:04d}"
        
        pos_record = {
            "event_id": pos_id,
            "event_date": str(event_date),
            "state": state,
            "district": district,
            "locality": locality or "District Centroid",
            "latitude": lat,
            "longitude": lon,
            "coordinate_precision": precision,
            "label_source": f"India_Flood_Inventory_v3 (UEI: {uei})",
            "flood_occurred": 1
        }
        positive_records.append(pos_record)
        
        # ── 3. Balanced Negative Sampling ──────────────────────────────────────
        neg_date = None
        candidate_years = list(range(1968, 2024))
        random.shuffle(candidate_years)
        
        dist_key = district.lower().strip()
        dist_forbidden = forbidden_dates.get(dist_key, set())
        
        neg_reason = ""
        for cy in candidate_years:
            if cy == event_date.year:
                continue
            try:
                cand_dt = date(cy, event_date.month, event_date.day)
            except ValueError:
                # Handle leap years
                cand_dt = date(cy, event_date.month, event_date.day - 1)
                
            if cand_dt not in dist_forbidden:
                neg_date = cand_dt
                neg_reason = f"No known flood event in {district} within ±14 days of {cand_dt} (same month, year {cy})"
                break
                
        if neg_date:
            neg_id = f"V2-NEG-{p_counter:04d}"
            neg_record = {
                "event_id": neg_id,
                "event_date": str(neg_date),
                "state": state,
                "district": district,
                "locality": locality or "District Centroid",
                "latitude": lat,
                "longitude": lon,
                "coordinate_precision": precision,
                "label_source": f"Generated Negative (Matched: {pos_id})",
                "flood_occurred": 0,
                "negative_reason": neg_reason
            }
            negative_records.append(neg_record)
            p_counter += 1
        else:
            # If no negative date was found, remove the positive record to preserve balanced classes
            print(f"      [WARN] Could not find safe negative date for {district} around {event_date}. Dropping positive.")
            positive_records.pop()
            
    print(f"\nConstructed canonical event schema: {len(positive_records)} positive & {len(negative_records)} negative balanced rows.")
    
    # Save canonical events
    events_all = pd.DataFrame(positive_records + negative_records)
    events_all.to_csv(OUTPUT_EVENTS_CSV, index=False)
    print(f"Saved events to {OUTPUT_EVENTS_CSV}")
    
    # ── 4. Feature Enrichment ──────────────────────────────────────────────────
    print("\nFetching historical features & enriching dataset...")
    f_counter = 1
    enriched_rows = []
    
    for record in positive_records + negative_records:
        e_id = record["event_id"]
        lat = record["latitude"]
        lon = record["longitude"]
        e_date = datetime.strptime(record["event_date"], "%Y-%m-%d").date()
        state = record["state"]
        
        # Antecedent day
        ante_date = e_date - timedelta(days=1)
        ante_date_str = str(ante_date)
        
        print(f"  [{f_counter}/{len(events_all)}] Fetching features for {e_id} (lat={lat:.4f}, lon={lon:.4f}, date={e_date})...")
        
        # ERA5 Meteorological
        era5 = fetch_era5_antecedent(lat, lon, ante_date_str, session)
        
        # Terrain
        terrain = get_terrain_features(lat, lon, state)
        
        # Landslides (Tamil Nadu only)
        if state == "Tamil Nadu":
            ls_dist, ls_count, ls_prov = compute_landslide_features(lat, lon)
            ls_msg = "Calculated from inventory"
        else:
            ls_dist, ls_count, ls_prov = None, None, "GSI landslide inventory only available for Tamil Nadu"
            ls_msg = "Unavailable - GSI landslide inventory only available for Tamil Nadu"
            
        # GPM Satellite Rain (Candidate)
        gpm_rain_3h = None
        gpm_rain_12h = None
        gpm_rain_24h = None
        gpm_prov = "NASA Earthdata authentication/HDF5 download required for historical GPM IMERG reanalysis"
        
        enriched_row = {
            "event_id": e_id,
            "date": record["event_date"],
            "state": state,
            "district": record["district"],
            "latitude": lat,
            "longitude": lon,
            "coordinate_precision": record["coordinate_precision"],
            "flood_occurred": record["flood_occurred"],
            
            # Weather Features (9 core features)
            "rain_1h_mm": era5["rain_1h_mm"],
            "rain_3h_mm": era5["rain_3h_mm"],
            "rain_6h_mm": era5["rain_6h_mm"],
            "rain_12h_mm": era5["rain_12h_mm"],
            "rain_24h_mm": era5["rain_24h_mm"],
            "temperature_c": era5["temperature_c"],
            "humidity_percent": era5["humidity_percent"],
            "soil_moisture_m3m3": era5["soil_moisture_m3m3"],
            "elevation_m": terrain["elevation_m"],
            
            # Candidate Features
            "slope_deg": terrain["slope_deg"],
            "local_relief_m": terrain["local_relief_m"],
            "gpm_rain_3h_mm": gpm_rain_3h,
            "gpm_rain_12h_mm": gpm_rain_12h,
            "gpm_rain_24h_mm": gpm_rain_24h,
            "nearest_landslide_km": ls_dist,
            "landslide_count_10km": ls_count,
            
            # Provenance metadata
            "meteorological_source": "Open-Meteo ERA5-Land Reanalysis" if era5["status"] == "success" else "Failed",
            "terrain_source": terrain["provenance"],
            "landslide_source": ls_prov,
            "gpm_source": gpm_prov,
            "label_source": record["label_source"],
            "geocoding_method": "OSM Nominatim Geocoding",
            "feature_acquisition_status": "success" if era5["status"] == "success" else "partial"
        }
        
        # Set missing reasons
        if terrain["slope_deg"] is None:
            enriched_row["slope_missing_reason"] = terrain["provenance"]
            enriched_row["local_relief_missing_reason"] = terrain["provenance"]
        else:
            enriched_row["slope_missing_reason"] = None
            enriched_row["local_relief_missing_reason"] = None
            
        if ls_dist is None:
            enriched_row["landslide_missing_reason"] = ls_prov
        else:
            enriched_row["landslide_missing_reason"] = None
            
        enriched_row["gpm_missing_reason"] = gpm_prov
        
        enriched_rows.append(enriched_row)
        f_counter += 1
        
    df_enriched = pd.DataFrame(enriched_rows)
    df_enriched.to_csv(OUTPUT_DATASET_CSV, index=False)
    print(f"\nSaved enriched pilot dataset to {OUTPUT_DATASET_CSV}")
    
    # ── 5. Run Quality Checks & Report ─────────────────────────────────────────
    print("\nRunning V2 Pilot quality checks...")
    total_rows = len(df_enriched)
    pos_count = int(df_enriched["flood_occurred"].sum())
    neg_count = total_rows - pos_count
    unique_coords = len(df_enriched.groupby(["latitude", "longitude"]))
    unique_districts = df_enriched["district"].nunique()
    unique_states = df_enriched["state"].nunique()
    
    precision_dist = df_enriched["coordinate_precision"].value_counts(normalize=True).to_dict()
    precision_counts = df_enriched["coordinate_precision"].value_counts().to_dict()
    
    missing_stats = {}
    for col in df_enriched.columns:
        null_count = int(df_enriched[col].isna().sum())
        null_pct = (null_count / total_rows) * 100
        if null_pct > 0:
            missing_stats[col] = f"{null_count} ({null_pct:.1f}%)"
            
    # Duplicate checks (ignoring generated ID)
    features_to_check = [
        "latitude", "longitude", "date", "rain_24h_mm", "temperature_c"
    ]
    duplicate_count = int(df_enriched.duplicated(subset=features_to_check).sum())
    
    rows_per_state = df_enriched["state"].value_counts().to_dict()
    rows_per_district = df_enriched["district"].value_counts().head(10).to_dict()
    
    # Dist-centroid warning flag check
    dist_precision_pct = precision_dist.get("district", 0) * 100
    flag_warning = dist_precision_pct > 20.0
    
    # Write quality report markdown
    report_lines = [
        "# Dataset V2 Pilot Quality Report",
        "",
        "## 1. Summary Metrics",
        f"* **Total Rows**: {total_rows}",
        f"* **Positive Class (Flood)**: {pos_count}",
        f"* **Negative Class (Non-Flood)**: {neg_count}",
        f"* **Unique Coordinates**: {unique_coords}",
        f"* **Unique Districts**: {unique_districts}",
        f"* **Unique States**: {unique_states}",
        f"* **Duplicate Rows**: {duplicate_count}",
        "",
        "## 2. Coordinate Precision Distribution",
    ]
    
    for prec, pct in precision_dist.items():
        cnt = precision_counts[prec]
        report_lines.append(f"* **{prec.capitalize()} Precision**: {cnt} ({pct*100:.1f}%)")
        
    if flag_warning:
        report_lines.append("")
        report_lines.append(f"> [!WARNING]")
        report_lines.append(f"> **District-Centroid Precision Alert**: {dist_precision_pct:.1f}% of rows are mapped to district centroids (Limit is 20%). Spatial features (slope, relief) will have reduced predictive utility for these rows.")
        
    report_lines += [
        "",
        "## 3. Geographic Distribution",
        "### Rows per Hilly State",
    ]
    
    for st, count in rows_per_state.items():
        report_lines.append(f"* **{st}**: {count}")
        
    report_lines += [
        "",
        "### Rows per District (Top 10)",
    ]
    for dist, count in rows_per_district.items():
        report_lines.append(f"* **{dist}**: {count}")
        
    report_lines += [
        "",
        "## 4. Missing Values & Feature Provenance",
    ]
    
    if missing_stats:
        for col, msg in missing_stats.items():
            report_lines.append(f"* **{col}**: {msg}")
    else:
        report_lines.append("* **No missing values detected in key features.**")
        
    report_lines += [
        "",
        "## 5. Leakage & Cross-Validation Safeguards",
        "* **District-level grouping**: The `district` column is preserved for group-based splits (e.g. `GroupShuffleSplit`), ensuring no geographic leaks.",
        "* **Event clustering**: The `event_id` column is mapped so that matching positive-negative sibling rows can be kept in the same split."
    ]
    
    report_content = "\n".join(report_lines)
    with open(OUTPUT_REPORT_MD, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"Saved quality report to {OUTPUT_REPORT_MD}")
    
    print("\n" + "=" * 65)
    print("Dataset V2 Pipeline Run Complete!")
    print("=" * 65)

if __name__ == "__main__":
    main()
