# Dataset V2 Pilot Quality Report

## 1. Summary Metrics
* **Total Rows**: 492
* **Positive Class (Flood)**: 246
* **Negative Class (Non-Flood)**: 246
* **Unique Coordinates**: 83
* **Unique Districts**: 57
* **Unique States**: 4
* **Duplicate Rows**: 0

## 2. Coordinate Precision Distribution
* **District Precision**: 408 (82.9%)
* **Town Precision**: 64 (13.0%)
* **Village Precision**: 20 (4.1%)

> [!WARNING]
> **District-Centroid Precision Alert**: 82.9% of rows are mapped to district centroids (Limit is 20%). Spatial features (slope, relief) will have reduced predictive utility for these rows.

## 3. Geographic Distribution
### Rows per Hilly State
* **Kerala**: 220
* **Himachal Pradesh**: 146
* **Tamil Nadu**: 76
* **Uttarakhand**: 50

### Rows per District (Top 10)
* **Thiruvananthapuram**: 58
* **Wayanad**: 38
* **Shimla**: 34
* **Kullu**: 22
* **Hamirpur**: 20
* **Idukki**: 16
* **Kangra**: 16
* **Thrissur**: 16
* **Mandi**: 14
* **Kozhikode**: 14

## 4. Missing Values & Feature Provenance
* **elevation_m**: 1 (0.2%)
* **slope_deg**: 492 (100.0%)
* **local_relief_m**: 492 (100.0%)
* **gpm_rain_3h_mm**: 492 (100.0%)
* **gpm_rain_12h_mm**: 492 (100.0%)
* **gpm_rain_24h_mm**: 492 (100.0%)
* **nearest_landslide_km**: 416 (84.6%)
* **landslide_count_10km**: 416 (84.6%)
* **landslide_missing_reason**: 76 (15.4%)

## 5. Leakage & Cross-Validation Safeguards
* **District-level grouping**: The `district` column is preserved for group-based splits (e.g. `GroupShuffleSplit`), ensuring no geographic leaks.
* **Event clustering**: The `event_id` column is mapped so that matching positive-negative sibling rows can be kept in the same split.