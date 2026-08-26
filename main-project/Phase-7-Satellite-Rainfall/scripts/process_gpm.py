"""
Process GPM IMERG HDF5 files -> output/rainfall_data.json
Extracts 30-min precipitation for bbox: lat 11.2-11.5, lon 76.65-76.95
"""
import h5py, numpy as np, json, os, re
from datetime import datetime, timezone

HDF5_DIR = os.path.join(os.path.dirname(__file__), "GPM_3IMERGHHE_07")
OUT_FILE  = os.path.join(os.path.dirname(__file__), "..", "output", "rainfall_data.json")

LAT_MIN, LAT_MAX = 11.2, 11.5
LON_MIN, LON_MAX = 76.65, 76.95

def parse_timestamp(filename):
    m = re.search(r'3IMERG\.(\d{8})-S(\d{6})', filename)
    if not m:
        return None
    return datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc).isoformat()

def process():
    files = sorted([f for f in os.listdir(HDF5_DIR) if f.endswith(".HDF5")])
    print(f"Processing {len(files)} files...")

    result = {"bbox": {"latMin": LAT_MIN, "latMax": LAT_MAX, "lonMin": LON_MIN, "lonMax": LON_MAX}, "timeseries": [], "grid": None}

    lat_idx = lon_idx = None

    for fname in files:
        path = os.path.join(HDF5_DIR, fname)
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
            # slice: [lon_idx, :][:, lat_idx]
            subset = precip[np.ix_(lon_idx, lat_idx)]  # shape (n_lon, n_lat)
            subset = np.where(subset < 0, np.nan, subset)

            mean_val = float(np.nanmean(subset))
            max_val  = float(np.nanmax(subset))

            # grid snapshot: 2D array [lon][lat] -> list of lists
            grid_snap = np.where(np.isnan(subset), None, np.round(subset, 4)).tolist()

            result["timeseries"].append({
                "timestamp": parse_timestamp(fname),
                "meanPrecip_mmhr": round(mean_val, 4),
                "maxPrecip_mmhr":  round(max_val, 4),
                "grid": grid_snap
            })

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w") as fout:
        json.dump(result, fout)

    total_mm = sum(t["meanPrecip_mmhr"] * 0.5 for t in result["timeseries"] if t["meanPrecip_mmhr"] > 0)
    print(f"Done. {len(result['timeseries'])} time steps written to {OUT_FILE}")
    print(f"Estimated total accumulation (area mean): {total_mm:.2f} mm")

if __name__ == "__main__":
    process()
