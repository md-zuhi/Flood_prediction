#!/usr/bin/env python3
"""
Sync NASA GPM IMERG Early Run granules from NASA CMR API using EARTHDATA_TOKEN,
and process them into rainfall_data.json.
"""

import os
import re
import json
import glob
import requests
import numpy as np
import h5py
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(SCRIPTS_DIR, "..", "..", "backend")
ENV_PATH = os.path.join(BACKEND_DIR, ".env")
HDF5_DIR = os.path.join(SCRIPTS_DIR, "GPM_3IMERGHHE_07")
OUT_FILE = os.path.join(SCRIPTS_DIR, "..", "output", "rainfall_data.json")
ALT_OUT_FILE = os.path.normpath(os.path.join(SCRIPTS_DIR, "..", "..", "..", "Phase-7-Satellite-Rainfall", "output", "rainfall_data.json"))

# Target bounding box covering Tamil Nadu, Kerala, Uttarakhand
LAT_MIN, LAT_MAX = 9.5, 31.0
LON_MIN, LON_MAX = 75.5, 80.0

def load_earthdata_token():
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                if line.startswith("EARTHDATA_TOKEN="):
                    return line.strip().split("=", 1)[1].strip('"').strip("'")
    return os.environ.get("EARTHDATA_TOKEN")

def parse_timestamp(filename):
    m = re.search(r'3IMERG\.(\d{8})-S(\d{6})', filename)
    if not m:
        return None
    return datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc).isoformat()

def download_file(args):
    url, filename, token = args
    local_path = os.path.join(HDF5_DIR, filename)
    if os.path.exists(local_path) and os.path.getsize(local_path) > 1000000:
        return ("skipped", filename)
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with requests.get(url, headers=headers, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(local_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    f.write(chunk)
        return ("downloaded", filename)
    except Exception as e:
        print(f"Download failed for {filename}: {e}")
        return ("failed", filename)

def fetch_latest_granules(token, hours=24):
    os.makedirs(HDF5_DIR, exist_ok=True)
    now = datetime.now(timezone.utc)
    start = (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    url = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
    params = {
        "short_name": "GPM_3IMERGHHE",
        "version": "07",
        "temporal": f"{start},{end}",
        "page_size": 100,
        "sort_key": "-start_date"
    }
    try:
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        items = r.json().get("items", [])
        print(f"[SyncGPM] Found {len(items)} GPM granules on NASA CMR for the last {hours} hours.")
        
        tasks = []
        for item in items:
            urls = item.get("umm", {}).get("RelatedUrls", [])
            for u in urls:
                if u.get("Type") == "GET DATA" and u.get("URL", "").endswith(".HDF5"):
                    file_url = u["URL"]
                    filename = os.path.basename(file_url)
                    tasks.append((file_url, filename, token))
                    break
        
        if tasks:
            with ThreadPoolExecutor(max_workers=3) as executor:
                results = list(executor.map(download_file, tasks))
            dl = sum(1 for status, _ in results if status == "downloaded")
            sk = sum(1 for status, _ in results if status == "skipped")
            print(f"[SyncGPM] Downloaded {dl} new files, {sk} existing files up to date.")
    except Exception as e:
        print(f"[SyncGPM] CMR query/download warning: {e}")

def process():
    files = sorted([f for f in os.listdir(HDF5_DIR) if f.endswith(".HDF5")])
    if not files:
        print("[SyncGPM] No HDF5 files found to process.")
        return

    # Process files
    result = {"bbox": {"latMin": LAT_MIN, "latMax": LAT_MAX, "lonMin": LON_MIN, "lonMax": LON_MAX}, "timeseries": [], "grid": None}
    lat_idx = lon_idx = None

    for fname in files:
        path = os.path.join(HDF5_DIR, fname)
        try:
            with h5py.File(path, "r") as f:
                lat = f["Grid/lat"][:]
                lon = f["Grid/lon"][:]

                if lat_idx is None:
                    lat_idx = np.where((lat >= LAT_MIN) & (lat <= LAT_MAX))[0]
                    lon_idx = np.where((lon >= LON_MIN) & (lon <= LON_MAX))[0]
                    result["grid"] = {
                        "lats": lat[lat_idx].tolist(),
                        "lons": lon[lon_idx].tolist()
                    }

                precip = f["Grid/precipitation"][0]  # shape (3600, 1800)
                subset = precip[np.ix_(lon_idx, lat_idx)]
                subset = np.where(subset < 0, np.nan, subset)

                mean_val = float(np.nanmean(subset)) if not np.all(np.isnan(subset)) else 0.0
                max_val  = float(np.nanmax(subset)) if not np.all(np.isnan(subset)) else 0.0

                grid_snap = np.where(np.isnan(subset), None, np.round(subset, 4)).tolist()

                result["timeseries"].append({
                    "timestamp": parse_timestamp(fname),
                    "meanPrecip_mmhr": round(mean_val, 4),
                    "maxPrecip_mmhr":  round(max_val, 4),
                    "grid": grid_snap
                })
        except Exception as e:
            print(f"[SyncGPM] Error processing file {fname}: {e}")

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w") as fout:
        json.dump(result, fout)

    if os.path.exists(os.path.dirname(ALT_OUT_FILE)):
        with open(ALT_OUT_FILE, "w") as fout:
            json.dump(result, fout)

    print(f"[SyncGPM] Done. {len(result['timeseries'])} timesteps saved to {OUT_FILE}")

def main():
    token = load_earthdata_token()
    print(f"[SyncGPM] EARTHDATA_TOKEN loaded: {'Yes' if token else 'No'}")
    fetch_latest_granules(token, hours=24)
    process()

if __name__ == "__main__":
    main()
