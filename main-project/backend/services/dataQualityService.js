// dataQualityService.js
// Phase 10 — Data Freshness + Quality Validation Layer
//
// This service ONLY evaluates data already present in the fused record.
// It does NOT fetch any new data.
// It does NOT modify scientific measurements.
// It does NOT change data_completeness_percent.
//
// It produces:
//   metadata.source_health        — per-source freshness + quality summary
//   metadata.overall_data_confidence — HIGH / MODERATE / LOW
//   additional metadata.warnings  — freshness/quality warnings (deduplicated)
//
// Concepts kept strictly separate:
//   DATA COMPLETENESS  — is the required value present?       (unchanged)
//   DATA FRESHNESS     — how old is the observation?          (this service)
//   DATA QUALITY       — is the source/value trustworthy?     (this service)
//   SOURCE STATUS      — did the source succeed/fail?         (from services)

'use strict';

// --------------------------------------------------
// Freshness thresholds (hours)
// --------------------------------------------------

const THRESHOLDS = {
  // Dynamic live sources
  weather:           { fresh: 2,  acceptable: 6  },
  rainfall:          { fresh: 2,  acceptable: 6  },
  rainfall_forecast: { fresh: 6,  acceptable: 12 },
  soil_moisture:     { fresh: 12, acceptable: 36 },
  satellite_rainfall:{ fresh: 3,  acceptable: 6  },
};

// --------------------------------------------------
// Timestamp → UTC milliseconds
// --------------------------------------------------
//
// Strategy for timestamps WITHOUT explicit timezone info (no Z, no +/-offset):
//   1. Try appending 'Z' (treat as UTC).
//      If the resulting time is no more than 1h in the future,
//      accept it as UTC (handles Open-Meteo hourly data in UTC).
//   2. Otherwise fall back to Node.js local parsing.
//      On this machine (IST = UTC+5:30) that correctly interprets
//      Open-Meteo "current" timestamps which are in local time.

function parseToUtcMs(ts, nowMs) {
  if (!ts || typeof ts !== 'string') return null;

  // Has explicit TZ? (Z suffix or ±HH:MM offset)
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(ts)) {
    const d = new Date(ts);
    return isNaN(d) ? null : d.getTime();
  }

  // No explicit TZ — try UTC first
  const asUtc = new Date(ts + 'Z');
  if (!isNaN(asUtc)) {
    // Accept as UTC if not more than 1 hour in the future
    // (covers minor model-run clock offsets)
    if ((nowMs - asUtc.getTime()) >= -3_600_000) {
      return asUtc.getTime();
    }
  }

  // Assume machine local time (IST on this server)
  const asLocal = new Date(ts);
  return isNaN(asLocal) ? null : asLocal.getTime();
}

// --------------------------------------------------
// Age helpers
// --------------------------------------------------

function calcAgeHours(tsMs, nowMs) {
  if (tsMs === null) return null;
  const h = (nowMs - tsMs) / 3_600_000;
  // Clamp slight negatives (≤1h in future) to 0 to handle rounding
  if (h < -1) return null;
  return +Math.max(0, h).toFixed(2);
}

function freshnessLabel(ageHours, thresholds) {
  if (ageHours === null) return 'UNKNOWN';
  if (ageHours <= thresholds.fresh)      return 'FRESH';
  if (ageHours <= thresholds.acceptable) return 'ACCEPTABLE';
  return 'STALE';
}

function isValidPositive(v) {
  return typeof v === 'number' && isFinite(v) && v >= 0;
}

// --------------------------------------------------
// Overall confidence rule
// --------------------------------------------------
//
// Critical dynamic sources: weather, rainfall, rainfall_forecast,
//                           soil_moisture, satellite_rainfall
//
// Issue scoring per source:
//   +2  if status !== "success"       (source unavailable/failed)
//   +1  if freshness is STALE or UNKNOWN  (data may be outdated)
//   +1  if quality is "poor" or "INVALID" (data quality concern)
//
// Thresholds:
//   0 issues  → HIGH
//   1–3 issues → MODERATE
//   ≥4 issues  → LOW
//
// Terrain (STATIC) and landslide_history (HISTORICAL) are not penalised
// for not having a recent timestamp — that would be meaningless for them.
// IoT being unavailable produces a warning but does not force LOW at
// the prototype stage.

const CRITICAL_DYNAMIC = [
  'weather',
  'rainfall',
  'rainfall_forecast',
  'soil_moisture',
  'satellite_rainfall',
];

function computeConfidence(source_health) {
  let issueCount = 0;

  for (const key of CRITICAL_DYNAMIC) {
    const s = source_health[key];
    if (!s) { issueCount += 2; continue; }

    if (s.status !== 'success') {
      issueCount += 2;
    } else {
      if (s.freshness === 'STALE' || s.freshness === 'UNKNOWN') issueCount += 1;
      if (s.quality === 'poor' || s.quality === 'INVALID')      issueCount += 1;
    }
  }

  if (issueCount === 0) return 'HIGH';
  if (issueCount <= 3)  return 'MODERATE';
  return 'LOW';
}

// --------------------------------------------------
// Main exported function
// --------------------------------------------------

/**
 * evaluateDataQuality(record)
 *
 * Evaluates freshness and quality of all sources in the fused record.
 * Must be called AFTER record.metadata.generated_at has been set.
 *
 * @param  {object} record  — the fully assembled fused record
 * @returns {{ source_health, overall_data_confidence, newWarnings }}
 */
function evaluateDataQuality(record) {

  // Use generated_at as the reference point for all age calculations.
  // This ensures consistent ages relative to when the data was fetched.
  const nowMs = record.metadata.generated_at
    ? new Date(record.metadata.generated_at).getTime()
    : Date.now();

  const source_health = {};
  const newWarnings   = [];

  // ── 1. WEATHER (Open-Meteo) ───────────────────────────────────────────────

  {
    const w      = record.weather;
    const status = w.status || 'unknown';

    if (status === 'success') {
      const tsMs     = parseToUtcMs(w.observation_time, nowMs);
      const age      = calcAgeHours(tsMs, nowMs);
      const freshness = freshnessLabel(age, THRESHOLDS.weather);
      const quality  = (w.temperature_c !== null && w.humidity_percent !== null)
        ? 'VALID' : 'INVALID';

      source_health.weather = { status, freshness, age_hours: age, quality };

      if (freshness === 'STALE')    newWarnings.push('Current weather data is stale.');
      if (quality   === 'INVALID')  newWarnings.push('Current weather values are incomplete.');
    } else {
      source_health.weather = { status, freshness: 'UNKNOWN', age_hours: null, quality: 'INVALID' };
    }
  }

  // ── 2. RECENT RAINFALL (Open-Meteo) ───────────────────────────────────────

  {
    const r      = record.rainfall;
    const status = r.status || 'unknown';

    if (status === 'success') {
      const tsMs     = parseToUtcMs(r.observation_time, nowMs);
      const age      = calcAgeHours(tsMs, nowMs);
      const freshness = freshnessLabel(age, THRESHOLDS.rainfall);
      const quality  = (r.rain_1h_mm !== null) ? 'VALID' : 'INVALID';

      source_health.rainfall = { status, freshness, age_hours: age, quality };

      if (freshness === 'STALE')   newWarnings.push('Recent rainfall data is stale.');
      if (quality   === 'INVALID') newWarnings.push('Recent rainfall values are incomplete.');
    } else {
      source_health.rainfall = { status, freshness: 'UNKNOWN', age_hours: null, quality: 'INVALID' };
    }
  }

  // ── 3. RAINFALL FORECAST (Open-Meteo / ECMWF) ─────────────────────────────
  //
  // Forecasts are generated products, not past observations.
  // We evaluate the age of the model run (generated_time), not a sensor.

  {
    const f      = record.rainfall_forecast;
    const status = f.status || 'unknown';

    if (status === 'success') {
      const tsMs     = parseToUtcMs(f.generated_time, nowMs);
      const age      = calcAgeHours(tsMs, nowMs);
      const freshness = freshnessLabel(age, THRESHOLDS.rainfall_forecast);
      const quality  = (f.forecast_3h_mm !== null && f.forecast_6h_mm !== null)
        ? 'VALID' : 'INVALID';

      source_health.rainfall_forecast = { status, freshness, age_hours: age, quality };

      if (freshness === 'STALE')   newWarnings.push('Rainfall forecast model run is stale.');
      if (quality   === 'INVALID') newWarnings.push('Rainfall forecast values are incomplete.');
    } else {
      source_health.rainfall_forecast = { status, freshness: 'UNKNOWN', age_hours: null, quality: 'INVALID' };
    }
  }

  // ── 4. SOIL MOISTURE (NASA SMAP) ──────────────────────────────────────────
  //
  // SMAP already computes age_hours and quality internally.
  // PRESERVE existing quality and quality_flag — do not overwrite.

  {
    const s      = record.soil_moisture;
    const status = s.status || 'unknown';

    if (status === 'success') {
      // Use SMAP's own age_hours if valid, otherwise recalculate from timestamp
      let age = (typeof s.age_hours === 'number' && s.age_hours >= 0)
        ? +s.age_hours.toFixed(2)
        : calcAgeHours(parseToUtcMs(s.observation_time, nowMs), nowMs);

      const freshness = freshnessLabel(age, THRESHOLDS.soil_moisture);

      // Preserve the quality classification from SMAP service (e.g. "poor")
      const quality = s.quality || 'unknown';

      source_health.soil_moisture = {
        status,
        freshness,
        age_hours    : age,
        quality,
        quality_flag : s.quality_flag !== undefined ? s.quality_flag : null,
      };

      if (freshness === 'STALE') {
        newWarnings.push('NASA SMAP soil moisture data is stale.');
      }
      if (quality === 'poor') {
        newWarnings.push(
          'NASA SMAP soil moisture quality is poor' +
          (s.quality_flag !== undefined ? ` (quality_flag: ${s.quality_flag})` : '') + '.'
        );
      }
    } else {
      source_health.soil_moisture = { status, freshness: 'UNKNOWN', age_hours: null, quality: 'INVALID' };
    }
  }

  // ── 5. TERRAIN (NASA SRTM via OpenTopography) — STATIC ───────────────────
  //
  // SRTM is a static DEM. It is never "stale" in a temporal sense.
  // We validate the internal consistency of the returned values instead.

  {
    const t      = record.terrain;
    const status = t.status || 'unknown';

    if (status === 'success') {
      const sane =
        typeof t.elevation_m     === 'number' && isFinite(t.elevation_m)          &&
        typeof t.slope_deg       === 'number' && isFinite(t.slope_deg)             &&
        t.slope_deg >= 0 && t.slope_deg <= 90                                      &&
        typeof t.min_elevation_m === 'number' && isFinite(t.min_elevation_m)       &&
        typeof t.mean_elevation_m === 'number' && isFinite(t.mean_elevation_m)     &&
        typeof t.max_elevation_m === 'number' && isFinite(t.max_elevation_m)       &&
        t.min_elevation_m <= t.mean_elevation_m                                    &&
        t.mean_elevation_m <= t.max_elevation_m                                    &&
        typeof t.local_relief_m  === 'number'                                      &&
        Math.abs(t.local_relief_m - (t.max_elevation_m - t.min_elevation_m)) < 5; // 5m tolerance

      source_health.terrain = {
        status,
        freshness : 'STATIC',
        quality   : sane ? 'VALID' : 'INVALID',
      };

      if (!sane) newWarnings.push('Terrain data failed internal sanity checks.');
    } else if (status === 'partial') {
      const sane = typeof t.elevation_m === 'number' && isFinite(t.elevation_m);

      source_health.terrain = {
        status,
        freshness : 'STATIC',
        quality   : sane ? 'VALID' : 'INVALID',
      };

      if (!sane) {
        newWarnings.push('Terrain fallback elevation failed sanity checks.');
      }
    } else {
      source_health.terrain = { status, freshness: 'STATIC', quality: 'INVALID' };
    }
  }

  // ── 6. HISTORICAL LANDSLIDE (GSI) — HISTORICAL ────────────────────────────
  //
  // Field-validated inventory: not a live sensor. Not time-dependent.
  // Validate logical consistency of returned counts and susceptibility.

  {
    const l      = record.landslide_history;
    const status = l.status || 'unknown';

    if (status === 'success') {
      const consistent =
        isValidPositive(l.nearest_event_km)                    &&
        isValidPositive(l.count_5km)                           &&
        isValidPositive(l.count_10km)  && l.count_10km  >= l.count_5km  &&
        isValidPositive(l.count_25km)  && l.count_25km  >= l.count_10km &&
        typeof l.historical_susceptibility === 'string'        &&
        l.historical_susceptibility.length > 0;

      source_health.landslide_history = {
        status,
        freshness : 'HISTORICAL',
        quality   : consistent ? 'VALID' : 'INVALID',
      };

      if (!consistent) {
        newWarnings.push('Historical landslide data failed logical consistency checks.');
      }
    } else if (status === 'unavailable') {
      source_health.landslide_history = {
        status,
        freshness : 'HISTORICAL',
        quality   : 'UNAVAILABLE',
      };
    } else {
      source_health.landslide_history = {
        status,
        freshness : 'HISTORICAL',
        quality   : 'INVALID',
      };
    }
  }

  // ── 7. SATELLITE RAINFALL (NASA GPM IMERG) ────────────────────────────────
  //
  // GPM IMERG Early Run has a latency of ~4–6 hours.
  // Pre-processed HDF5 files may be 12–24+ hours old.
  // STALE is expected when static files are used — report it honestly.

  {
    const g      = record.satellite_rainfall;
    const status = g.status || 'unknown';

    if (status === 'success') {
      const tsMs     = parseToUtcMs(g.observation_time, nowMs);
      const age      = calcAgeHours(tsMs, nowMs);
      const freshness = freshnessLabel(age, THRESHOLDS.satellite_rainfall);

      // Validate that core rainfall values are finite and non-negative
      const valuesValid =
        isValidPositive(g.current_intensity_mm_hr)  &&
        isValidPositive(g.rain_30m_mm)              &&
        isValidPositive(g.rain_1h_mm);

      source_health.satellite_rainfall = {
        status,
        freshness,
        age_hours : age,
        quality   : valuesValid ? 'VALID' : 'INVALID',
      };

      if (freshness === 'STALE') {
        newWarnings.push(
          'NASA GPM satellite rainfall data is stale' +
          (age !== null ? ` (observation ~${Math.round(age)}h ago)` : '') + '.'
        );
      }
      if (!valuesValid) {
        newWarnings.push('NASA GPM satellite rainfall values are invalid or missing.');
      }
    } else if (status === 'unavailable') {
      source_health.satellite_rainfall = {
        status,
        freshness : 'UNAVAILABLE',
        age_hours : null,
        quality   : 'UNAVAILABLE',
      };
    } else {
      source_health.satellite_rainfall = {
        status,
        freshness : 'UNKNOWN',
        age_hours : null,
        quality   : 'INVALID',
      };
    }
  }

  // ── 8. IoT SENSORS ────────────────────────────────────────────────────────
  //
  // Currently not connected. This is expected at the prototype stage.
  // IoT being unavailable does NOT force LOW confidence.

  {
    const iot = record.iot;
    if (iot.available) {
      source_health.iot = { status: 'success',     freshness: 'FRESH',       quality: 'VALID'       };
    } else {
      source_health.iot = { status: 'unavailable', freshness: 'UNAVAILABLE', quality: 'UNAVAILABLE' };
      newWarnings.push('IoT sensor data is currently unavailable.');
    }
  }

  // ── 9. OVERALL DATA CONFIDENCE ────────────────────────────────────────────

  const overall_data_confidence = computeConfidence(source_health);

  return { source_health, overall_data_confidence, newWarnings };
}

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------

module.exports = {
  evaluateDataQuality,
};
