"""
feature_schema.py – Phase 11 ML Flash Flood Prediction
========================================================

Defines the canonical 27-feature vector extracted from the
Phase 10 multi-source fused data record.

Data flow:
    Phase 10 POST /api/fusion
        └─> JSON fused record
                └─> extract_features()   (this module)
                        └─> 27-key dict  (input to ML model in later sub-phase)

IMPORTANT:
    - No model training here.
    - No flood labels here.
    - No fake/hardcoded values.
    - Missing values are returned as None, never replaced with 0.
"""

from typing import Any

# ---------------------------------------------------------------------------
# Canonical feature list (exactly 27, no duplicates)
# ---------------------------------------------------------------------------

FEATURE_NAMES: list[str] = [
    # ── Recent Rainfall (Open-Meteo) ──────────────────────────────────────
    "rain_1h_mm",
    "rain_3h_mm",
    "rain_6h_mm",
    "rain_12h_mm",
    "rain_24h_mm",

    # ── Rainfall Forecast (Open-Meteo) ────────────────────────────────────
    "forecast_1h_mm",
    "forecast_3h_mm",
    "forecast_6h_mm",
    "forecast_12h_mm",
    "forecast_24h_mm",

    # ── Soil Moisture (NASA SMAP) ──────────────────────────────────────────
    "soil_moisture_m3_m3",

    # ── Terrain (NASA SRTM) ────────────────────────────────────────────────
    "elevation_m",
    "slope_deg",
    "local_relief_m",

    # ── Historical Landslide (GSI) ─────────────────────────────────────────
    "nearest_landslide_km",
    "landslide_count_5km",
    "landslide_count_10km",
    "landslide_count_25km",

    # ── Satellite Rainfall (NASA GPM IMERG) ───────────────────────────────
    "gpm_rain_30m_mm",
    "gpm_rain_1h_mm",
    "gpm_rain_3h_mm",
    "gpm_rain_6h_mm",
    "gpm_rain_12h_mm",
    "gpm_rain_24h_mm",

    # ── Weather (Open-Meteo) ───────────────────────────────────────────────
    "temperature_c",
    "humidity_percent",
    "wind_speed_kmh",
]

# Sanity check at import time – must be exactly 27, no duplicates
assert len(FEATURE_NAMES) == 27, f"Expected 27 features, got {len(FEATURE_NAMES)}"
assert len(set(FEATURE_NAMES)) == 27, "Duplicate feature names detected"


# ---------------------------------------------------------------------------
# Safe nested getter
# ---------------------------------------------------------------------------

def _get(obj: dict, *keys: str) -> Any:
    """
    Safely traverse nested dicts.
    Returns None if any key is missing or the object is not a dict.
    Never raises – missing data is always returned as None.
    """
    current = obj
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
        if current is None:
            return None
    return current


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

def extract_features(fused_data: dict) -> dict[str, Any]:
    """
    Extract the canonical 27-feature vector from a Phase 10 fused data record.

    Parameters
    ----------
    fused_data : dict
        The ``data`` object from a successful POST /api/fusion response.
        Example structure::

            {
                "location": {...},
                "weather": {"temperature_c": 16.6, "humidity_percent": 99, ...},
                "rainfall": {"rain_1h_mm": 2.2, "rain_6h_mm": 3.1, ...},
                "rainfall_forecast": {"forecast_3h_mm": 7.8, ...},
                "soil_moisture": {"value_m3_m3": 0.2498, ...},
                "terrain": {"elevation_m": 1835, "slope_deg": 17.55, ...},
                "landslide_history": {"nearest_event_km": 0.42, ...},
                "satellite_rainfall": {"rain_1h_mm": 5.019, ...},
                "metadata": {...}
            }

    Returns
    -------
    dict[str, Any]
        Exactly 27 keys matching ``FEATURE_NAMES``.
        Values are numeric (int or float) or None if the field is absent.
        Missing values are NEVER replaced with 0 or any other sentinel.
    """
    features: dict[str, Any] = {

        # ── Recent Rainfall (Open-Meteo) ─────────────────────────────────
        "rain_1h_mm":    _get(fused_data, "rainfall", "rain_1h_mm"),
        "rain_3h_mm":    _get(fused_data, "rainfall", "rain_3h_mm"),
        "rain_6h_mm":    _get(fused_data, "rainfall", "rain_6h_mm"),
        "rain_12h_mm":   _get(fused_data, "rainfall", "rain_12h_mm"),
        "rain_24h_mm":   _get(fused_data, "rainfall", "rain_24h_mm"),

        # ── Rainfall Forecast (Open-Meteo) ───────────────────────────────
        "forecast_1h_mm":  _get(fused_data, "rainfall_forecast", "forecast_1h_mm"),
        "forecast_3h_mm":  _get(fused_data, "rainfall_forecast", "forecast_3h_mm"),
        "forecast_6h_mm":  _get(fused_data, "rainfall_forecast", "forecast_6h_mm"),
        "forecast_12h_mm": _get(fused_data, "rainfall_forecast", "forecast_12h_mm"),
        "forecast_24h_mm": _get(fused_data, "rainfall_forecast", "forecast_24h_mm"),

        # ── Soil Moisture (NASA SMAP) ─────────────────────────────────────
        "soil_moisture_m3_m3": _get(fused_data, "soil_moisture", "value_m3_m3"),

        # ── Terrain (NASA SRTM) ───────────────────────────────────────────
        "elevation_m":   _get(fused_data, "terrain", "elevation_m"),
        "slope_deg":     _get(fused_data, "terrain", "slope_deg"),
        "local_relief_m":_get(fused_data, "terrain", "local_relief_m"),

        # ── Historical Landslide (GSI) ────────────────────────────────────
        "nearest_landslide_km": _get(fused_data, "landslide_history", "nearest_event_km"),
        "landslide_count_5km":  _get(fused_data, "landslide_history", "count_5km"),
        "landslide_count_10km": _get(fused_data, "landslide_history", "count_10km"),
        "landslide_count_25km": _get(fused_data, "landslide_history", "count_25km"),

        # ── Satellite Rainfall (NASA GPM IMERG) ──────────────────────────
        # Note: satellite_rainfall.rain_* fields are the GPM accumulations.
        "gpm_rain_30m_mm": _get(fused_data, "satellite_rainfall", "rain_30m_mm"),
        "gpm_rain_1h_mm":  _get(fused_data, "satellite_rainfall", "rain_1h_mm"),
        "gpm_rain_3h_mm":  _get(fused_data, "satellite_rainfall", "rain_3h_mm"),
        "gpm_rain_6h_mm":  _get(fused_data, "satellite_rainfall", "rain_6h_mm"),
        "gpm_rain_12h_mm": _get(fused_data, "satellite_rainfall", "rain_12h_mm"),
        "gpm_rain_24h_mm": _get(fused_data, "satellite_rainfall", "rain_24h_mm"),

        # ── Weather (Open-Meteo) ──────────────────────────────────────────
        "temperature_c":    _get(fused_data, "weather", "temperature_c"),
        "humidity_percent":  _get(fused_data, "weather", "humidity_percent"),
        "wind_speed_kmh":    _get(fused_data, "weather", "wind_speed_kmh"),
    }

    # Guard: returned dict must always match the canonical schema exactly
    assert set(features.keys()) == set(FEATURE_NAMES), (
        "extract_features() returned unexpected keys. Check FEATURE_NAMES."
    )

    return features


# ---------------------------------------------------------------------------
# Feature validation
# ---------------------------------------------------------------------------

def validate_features(features: dict[str, Any]) -> dict[str, Any]:
    """
    Validate a feature dict produced by ``extract_features()``.

    Parameters
    ----------
    features : dict
        Output of ``extract_features()``.

    Returns
    -------
    dict with keys:
        total_features      – int   always 27
        available_features  – int   count of non-None values
        missing_features    – list  names of None-valued features
        completeness_percent– float 0.0–100.0
    """
    total = len(FEATURE_NAMES)
    missing = [name for name in FEATURE_NAMES if features.get(name) is None]
    available = total - len(missing)
    completeness = round((available / total) * 100, 2)

    return {
        "total_features":       total,
        "available_features":   available,
        "missing_features":     missing,
        "completeness_percent": completeness,
    }


# ---------------------------------------------------------------------------
# Quick self-test (run directly: python feature_schema.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("Phase 11 -- Feature Schema Self-Test")
    print("=" * 60)

    # 1. Schema checks
    print(f"\n[1] Total features defined : {len(FEATURE_NAMES)}")
    print(f"    Unique names            : {len(set(FEATURE_NAMES))}")
    assert len(FEATURE_NAMES) == 27
    assert len(set(FEATURE_NAMES)) == 27
    print("    [OK] Exactly 27 features, no duplicates")

    # 2. Simulate a complete Phase 10 fused record
    mock_complete = {
        "weather": {
            "temperature_c": 16.6, "humidity_percent": 99, "wind_speed_kmh": 3.2
        },
        "rainfall": {
            "rain_1h_mm": 2.2, "rain_3h_mm": 3.1, "rain_6h_mm": 3.1,
            "rain_12h_mm": 5.4, "rain_24h_mm": 14.3
        },
        "rainfall_forecast": {
            "forecast_1h_mm": 1.0, "forecast_3h_mm": 7.8, "forecast_6h_mm": 8.2,
            "forecast_12h_mm": 10.1, "forecast_24h_mm": 18.5
        },
        "soil_moisture": {"value_m3_m3": 0.2498},
        "terrain": {
            "elevation_m": 1835, "slope_deg": 17.55, "local_relief_m": 195
        },
        "landslide_history": {
            "nearest_event_km": 0.42, "count_5km": 221,
            "count_10km": 362, "count_25km": 693
        },
        "satellite_rainfall": {
            "rain_30m_mm": 2.316, "rain_1h_mm": 5.019, "rain_3h_mm": 5.086,
            "rain_6h_mm": 5.536, "rain_12h_mm": 10.75, "rain_24h_mm": 15.788
        },
    }

    features_complete = extract_features(mock_complete)
    validation_complete = validate_features(features_complete)

    print(f"\n[2] Complete record extraction:")
    print(f"    Keys returned           : {len(features_complete)}")
    print(f"    Available features      : {validation_complete['available_features']}")
    print(f"    Missing features        : {validation_complete['missing_features']}")
    print(f"    Completeness            : {validation_complete['completeness_percent']}%")
    assert len(features_complete) == 27
    assert validation_complete["missing_features"] == []
    print("    [OK] All 27 values extracted correctly")

    # 3. Simulate a partial record (some sources missing)
    mock_partial = {
        "weather": {"temperature_c": 20.0},
        "rainfall": {"rain_1h_mm": 5.0},
        # soil_moisture, terrain, landslide_history, satellite_rainfall all missing
    }

    features_partial = extract_features(mock_partial)
    validation_partial = validate_features(features_partial)

    print(f"\n[3] Partial record extraction:")
    print(f"    Keys returned           : {len(features_partial)}")
    print(f"    Available features      : {validation_partial['available_features']}")
    print(f"    Missing features count  : {len(validation_partial['missing_features'])}")
    print(f"    Completeness            : {validation_partial['completeness_percent']}%")
    assert len(features_partial) == 27
    assert features_partial["soil_moisture_m3_m3"] is None
    assert features_partial["slope_deg"] is None
    assert features_partial["gpm_rain_1h_mm"] is None
    print("    [OK] Missing values correctly returned as None (not 0)")

    # 4. Empty record -- must not crash
    features_empty = extract_features({})
    validation_empty = validate_features(features_empty)
    assert len(features_empty) == 27
    assert all(v is None for v in features_empty.values())
    print(f"\n[4] Empty record: all {len(features_empty)} values = None -- [OK] no crash")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED")
    print("=" * 60)

