"""
prepare_dataset.py — Phase 11 Dataset Preparation
===================================================

Reads raw flood inventory CSVs, filters for Tamil Nadu / Kerala / Uttarakhand,
saves processed files, and writes a dataset report.

Usage:
    cd phase-11-ml-prediction
    python data/prepare_dataset.py

DO NOT:
    - train any model
    - create fake/negative samples
    - modify Phase 10
"""

import os
import pandas as pd

# ── Paths ─────────────────────────────────────────────────────────────────────

RAW_DIR       = os.path.join(os.path.dirname(__file__), "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)

INVENTORY_CSV = os.path.join(RAW_DIR, "India_Flood_Inventory_v3.csv")
DISTRICT_CSV  = os.path.join(RAW_DIR, "District_FloodedArea.csv")

EVENTS_OUT    = os.path.join(PROCESSED_DIR, "three_state_flood_events.csv")
DISTRICT_OUT  = os.path.join(PROCESSED_DIR, "district_flood_exposure.csv")
REPORT_OUT    = os.path.join(PROCESSED_DIR, "dataset_report.txt")

# Target states
TARGET_STATES = ["Tamil Nadu", "Kerala", "Uttarakhand"]

# ── Helper: state match ────────────────────────────────────────────────────────
# The State column sometimes contains multi-state strings like
# "Kerala, Karnataka" or "Uttar Pradesh, Uttarakhand".
# We include any row where the State field *contains* the target state name.

def matches_target(state_val: str, targets: list[str]) -> list[str]:
    """Return list of matched target states for a state-field value."""
    if not isinstance(state_val, str):
        return []
    matched = [t for t in targets if t.lower() in state_val.lower()]
    return matched


# ── 1. Load raw inventory ──────────────────────────────────────────────────────

print("Loading India_Flood_Inventory_v3.csv ...")
raw_inv = pd.read_csv(INVENTORY_CSV, encoding="utf-8", low_memory=False)
total_inventory_rows = len(raw_inv)

print(f"  Columns  : {list(raw_inv.columns)}")
print(f"  Total rows: {total_inventory_rows}")
print()

# ── 2. Filter for target states ───────────────────────────────────────────────

# For rows that span multiple states we create ONE row per matched state
# so each row represents a single state's event.

records = []
for _, row in raw_inv.iterrows():
    matched = matches_target(row.get("State", ""), TARGET_STATES)
    for state in matched:
        records.append({
            "original_state_field": row.get("State"),
            "matched_state": state,
            "row": row,
        })

print(f"  Matched rows (one per state): {len(records)}")

# ── 3. Build clean event dataframe ────────────────────────────────────────────

def safe_str(val):
    if pd.isna(val):
        return None
    return str(val).strip() or None

def safe_float(val):
    try:
        f = float(val)
        return f if pd.notna(f) else None
    except (TypeError, ValueError):
        return None

def extract_year(date_str):
    """Extract 4-digit year from a date string."""
    if not isinstance(date_str, str):
        return None
    import re
    m = re.search(r'\b(\d{4})\b', date_str)
    return int(m.group(1)) if m else None

rows_out = []
event_counter = 1

for item in records:
    row   = item["row"]
    state = item["matched_state"]

    # Date — use Start Date as the event date
    start_date_raw = safe_str(row.get("Start Date"))
    year = extract_year(start_date_raw)

    # Parse date to standard format if possible
    event_date = None
    if start_date_raw:
        try:
            event_date = pd.to_datetime(start_date_raw, dayfirst=True, errors="coerce")
            event_date = event_date.strftime("%Y-%m-%d") if pd.notna(event_date) else start_date_raw
        except Exception:
            event_date = start_date_raw

    rows_out.append({
        "event_id"     : f"PH11-{event_counter:05d}",
        "date"         : event_date,
        "year"         : year,
        "state"        : state,
        "district"     : safe_str(row.get("Districts")),
        "location"     : safe_str(row.get("Location")),
        "latitude"     : safe_float(row.get("Latitude")),
        "longitude"    : safe_float(row.get("Longitude")),
        "event_type"   : safe_str(row.get("Main Cause")) or "flood",
        "flood_occurred": 1,
        "source"       : safe_str(row.get("Event Source")) or "India_Flood_Inventory_v3",
    })
    event_counter += 1

events_df = pd.DataFrame(rows_out)

# ── 4. Remove exact duplicate rows (all columns equal) ────────────────────────

before_dedup = len(events_df)
events_df = events_df.drop_duplicates()
dupes_removed = before_dedup - len(events_df)

# ── 5. Stats ──────────────────────────────────────────────────────────────────

rows_per_state   = events_df["state"].value_counts().to_dict()
has_lat          = events_df["latitude"].notna().sum()
has_lon          = events_df["longitude"].notna().sum()
has_coords       = events_df[["latitude","longitude"]].notna().all(axis=1).sum()
missing_district = events_df["district"].isna().sum()
missing_location = events_df["location"].isna().sum()

# Date range
valid_dates = pd.to_datetime(events_df["date"], errors="coerce").dropna()
date_min = valid_dates.min().strftime("%Y-%m-%d") if len(valid_dates) else "unknown"
date_max = valid_dates.max().strftime("%Y-%m-%d") if len(valid_dates) else "unknown"

# Save events
events_df.to_csv(EVENTS_OUT, index=False)
print(f"  Saved: {EVENTS_OUT}")
print(f"  Rows: {len(events_df)}")
print(f"  Rows per state: {rows_per_state}")
print(f"  Date range: {date_min} to {date_max}")
print(f"  With coordinates: {has_coords} / {len(events_df)}")
print()

# ── 6. District flood exposure (District_FloodedArea.csv) ─────────────────────

print("Loading District_FloodedArea.csv ...")
raw_dist = pd.read_csv(DISTRICT_CSV, encoding="utf-8", low_memory=False)
total_district_rows = len(raw_dist)

print(f"  Columns: {list(raw_dist.columns)}")
print(f"  Total rows: {total_district_rows}")

# District_FloodedArea.csv has only Dist_Name — no state column.
# We cannot reliably filter by state without a state-district mapping.
# Per instructions: keep only districts that can be mapped to target states.
# Since no state column exists, we save the FULL file with a note.
# The user is warned below.

dist_df = raw_dist.copy()
dist_df.to_csv(DISTRICT_OUT, index=False)
print(f"  NOTE: District_FloodedArea.csv has no state column.")
print(f"        Full file saved to district_flood_exposure.csv.")
print(f"        State-based filtering requires an external district-state mapping.")
print(f"  Saved: {DISTRICT_OUT}")
print()

# ── 7. Dataset report ─────────────────────────────────────────────────────────

report_lines = [
    "Phase 11 -- Dataset Preparation Report",
    "=" * 60,
    "",
    "SOURCE FILE 1: India_Flood_Inventory_v3.csv",
    f"  Columns : {list(raw_inv.columns)}",
    f"  Total rows (original) : {total_inventory_rows}",
    "",
    "SOURCE FILE 2: District_FloodedArea.csv",
    f"  Columns : {list(raw_dist.columns)}",
    f"  Total rows (original) : {total_district_rows}",
    "",
    "=" * 60,
    "OUTPUT: three_state_flood_events.csv",
    "=" * 60,
    f"  Target states         : {TARGET_STATES}",
    f"  Filtered rows         : {len(events_df)}",
    f"  Rows per state:",
]
for state, count in rows_per_state.items():
    report_lines.append(f"    {state}: {count}")

report_lines += [
    "",
    f"  Date range            : {date_min} to {date_max}",
    f"  With latitude         : {has_lat}",
    f"  With longitude        : {has_lon}",
    f"  With both coordinates : {has_coords} / {len(events_df)}",
    f"  Missing district      : {missing_district}",
    f"  Missing location      : {missing_location}",
    f"  Exact duplicates removed: {dupes_removed}",
    "",
    "=" * 60,
    "OUTPUT: district_flood_exposure.csv",
    "=" * 60,
    f"  Total rows saved      : {len(dist_df)}",
    "  WARNING: No state column in District_FloodedArea.csv.",
    "           Full file saved. State-based filtering requires an",
    "           external district-to-state mapping (not available in raw data).",
    "           Do NOT use this file as flood labels.",
    "",
    "=" * 60,
    "PROCESSING RULES APPLIED",
    "=" * 60,
    "  - Rows matched where State column *contains* the target state name.",
    "  - Multi-state rows: one output row created per matched target state.",
    "  - Missing values returned as None/NaN — never replaced with 0.",
    "  - Exact duplicate rows removed only.",
    "  - flood_occurred = 1 for all events (positive class, historical records).",
    "  - No negative samples created.",
    "  - No model trained.",
]

report_text = "\n".join(report_lines)
with open(REPORT_OUT, "w", encoding="utf-8") as f:
    f.write(report_text)
print(f"  Saved: {REPORT_OUT}")
print()

# ── 8. Final summary ──────────────────────────────────────────────────────────

print("=" * 60)
print("DONE")
print("=" * 60)
print(f"Files created:")
print(f"  {EVENTS_OUT}")
print(f"  {DISTRICT_OUT}")
print(f"  {REPORT_OUT}")
print()
print(f"Rows per state:")
for state, count in rows_per_state.items():
    print(f"  {state}: {count}")
print()
print(f"Date range: {date_min} to {date_max}")
print(f"Coordinate coverage: {has_coords} / {len(events_df)} rows have lat+lon")
print()
if has_coords == 0:
    print("WARNING: No rows have coordinates. Coordinates are missing in the raw data.")
if dupes_removed > 0:
    print(f"WARNING: {dupes_removed} exact duplicate rows removed.")
print("WARNING: District_FloodedArea.csv has no state column — saved as-is.")
