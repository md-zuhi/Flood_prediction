// satelliteRainfallService.js
// NASA GPM IMERG Early Run — Phase 10 Data Fusion
//
// Adapted from the verified Phase 7 satellite rainfall module.
// Reads the pre-processed rainfall_data.json produced by
// Phase-7-Satellite-Rainfall/scripts/process_gpm.py from real HDF5 files.
//
// Product  : GPM_3IMERGHHE
// Version  : 07
// Temporal : 30-minute intervals
// Spatial  : ~0.1° / ~10 km
//
// Rolling accumulation windows (identical to Phase 7 buildRolling):
//   30m  →  1 step  (intensity × 0.5)
//   1h   →  2 steps
//   3h   →  6 steps
//   6h   → 12 steps
//   12h  → 24 steps
//   24h  → 48 steps
//
// If insufficient consecutive half-hour observations exist,
// the incomplete accumulation is returned as null.

'use strict';

const fs   = require('fs');
const path = require('path');

// --------------------------------------------------
// Path to the pre-processed Phase 7 JSON output
// --------------------------------------------------

const JSON_PATH = path.join(
  __dirname,
  '..',
  '..',
  'Phase-7-Satellite-Rainfall',
  'output',
  'rainfall_data.json'
);

// --------------------------------------------------
// Rolling accumulation windows (same as Phase 7)
// --------------------------------------------------

const WINDOWS = [
  { key: 'rain_30m_mm',  steps: 1  },
  { key: 'rain_1h_mm',   steps: 2  },
  { key: 'rain_3h_mm',   steps: 6  },
  { key: 'rain_6h_mm',   steps: 12 },
  { key: 'rain_12h_mm',  steps: 24 },
  { key: 'rain_24h_mm',  steps: 48 },
];

// --------------------------------------------------
// buildRolling — verbatim from Phase 7 server.js
// Each step = 0.5 hr, so accumulation per step = meanPrecip_mmhr * 0.5
// --------------------------------------------------

function buildRolling(timeseries) {
  const accum = timeseries.map((t) => t.meanPrecip_mmhr * 0.5);

  return timeseries.map((t, i) => {
    const row = { timestamp: t.timestamp };
    for (const { key, steps } of WINDOWS) {
      if (i + 1 < steps) {
        row[key] = null;  // insufficient history
      } else {
        let sum = 0;
        for (let k = i - steps + 1; k <= i; k++) sum += accum[k];
        row[key] = +sum.toFixed(3);
      }
    }
    return row;
  });
}

// --------------------------------------------------
// Nearest grid index helper
// --------------------------------------------------
// Finds the index in the sorted array whose value is closest to target.

function nearestIdx(arr, target) {
  let best = 0;
  let bestDist = Math.abs(arr[0] - target);
  for (let i = 1; i < arr.length; i++) {
    const d = Math.abs(arr[i] - target);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// --------------------------------------------------
// Load & cache the JSON once at module startup
// --------------------------------------------------

let _data       = null;
let _rolling    = null;
let _loadError  = null;

function loadJsonOnce() {
  if (_data !== null) return;   // already loaded

  if (!fs.existsSync(JSON_PATH)) {
    _loadError = `GPM rainfall_data.json not found at: ${JSON_PATH}`;
    console.error(`[SatelliteRainfall] ${_loadError}`);
    _data = false;
    return;
  }

  try {
    const raw = fs.readFileSync(JSON_PATH, 'utf8');
    _data     = JSON.parse(raw);
    _rolling  = buildRolling(_data.timeseries);
    console.log(
      `[SatelliteRainfall] GPM JSON loaded — ${_data.timeseries.length} time steps, ` +
      `bbox lat ${_data.bbox.latMin}–${_data.bbox.latMax} ` +
      `lon ${_data.bbox.lonMin}–${_data.bbox.lonMax}`
    );
  } catch (err) {
    _loadError = err.message;
    _data = false;
    console.error(`[SatelliteRainfall] Failed to load JSON: ${_loadError}`);
  }
}

// --------------------------------------------------
// Main exported function
// --------------------------------------------------

/**
 * getSatelliteRainfall(latitude, longitude)
 *
 * Returns NASA GPM IMERG satellite rainfall features for the given
 * coordinate from the pre-processed Phase 7 rainfall_data.json.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {object}  — merged into record.satellite_rainfall
 */
function getSatelliteRainfall(latitude, longitude) {

  // Ensure JSON is loaded (idempotent)
  loadJsonOnce();

  // ── Load failure ───────────────────────────────────────────────────────────
  if (!_data) {
    return {
      current_intensity_mm_hr       : null,
      regional_max_intensity_mm_hr  : null,
      rain_30m_mm                   : null,
      rain_1h_mm                    : null,
      rain_3h_mm                    : null,
      rain_6h_mm                    : null,
      rain_12h_mm                   : null,
      rain_24h_mm                   : null,
      observation_time              : null,
      source                        : 'NASA GPM IMERG',
      product                       : 'GPM_3IMERGHHE',
      version                       : '07',
      status                        : 'failed',
      error                         : _loadError || 'Unknown load failure.',
    };
  }

  const { bbox, timeseries, grid } = _data;

  // ── Bounding box check ─────────────────────────────────────────────────────
  const latPadding = 0.1;  // half a grid cell tolerance
  const lonPadding = 0.1;

  const inBbox =
    latitude  >= (bbox.latMin - latPadding) &&
    latitude  <= (bbox.latMax + latPadding) &&
    longitude >= (bbox.lonMin - lonPadding) &&
    longitude <= (bbox.lonMax + lonPadding);

  if (!inBbox) {
    return {
      current_intensity_mm_hr       : null,
      regional_max_intensity_mm_hr  : null,
      rain_30m_mm                   : null,
      rain_1h_mm                    : null,
      rain_3h_mm                    : null,
      rain_6h_mm                    : null,
      rain_12h_mm                   : null,
      rain_24h_mm                   : null,
      observation_time              : null,
      source                        : 'NASA GPM IMERG',
      product                       : 'GPM_3IMERGHHE',
      version                       : '07',
      status                        : 'unavailable',
      message                       :
        `GPM satellite rainfall dataset currently covers ` +
        `lat ${bbox.latMin}–${bbox.latMax}, lon ${bbox.lonMin}–${bbox.lonMax}. ` +
        `Requested point (${latitude}, ${longitude}) is outside this area.`,
    };
  }

  // ── Latest timestep ────────────────────────────────────────────────────────
  const n      = timeseries.length;
  const latest = timeseries[n - 1];

  // ── Nearest grid cell for target coordinates ──────────────────────────────
  const lonIdx = nearestIdx(grid.lons, longitude);
  const latIdx = nearestIdx(grid.lats, latitude);

  let localIntensity = null;
  if (
    latest.grid &&
    latest.grid[lonIdx] !== undefined &&
    latest.grid[lonIdx][latIdx] !== undefined &&
    latest.grid[lonIdx][latIdx] !== null
  ) {
    localIntensity = +(latest.grid[lonIdx][latIdx]).toFixed(4);
  }

  // Fall back to regional mean if the specific cell is missing/null
  const currentIntensity =
    (localIntensity !== null && isFinite(localIntensity))
      ? localIntensity
      : latest.meanPrecip_mmhr;

  // ── Location-specific rolling accumulations ──────────────────────────────
  // Sum precipitation over trailing timesteps for target location cell
  const locationRoll = {};
  for (const { key, steps } of WINDOWS) {
    if (n < steps) {
      locationRoll[key] = null;
    } else {
      let sum = 0;
      let valid = true;
      for (let k = n - steps; k < n; k++) {
        const stepGrid = timeseries[k].grid;
        const val = (stepGrid && stepGrid[lonIdx] && stepGrid[lonIdx][latIdx] !== undefined && stepGrid[lonIdx][latIdx] !== null)
          ? stepGrid[lonIdx][latIdx]
          : timeseries[k].meanPrecip_mmhr;

        if (val === null || val === undefined) {
          valid = false;
          break;
        }
        sum += val * 0.5;
      }
      locationRoll[key] = valid ? +sum.toFixed(3) : null;
    }
  }

  return {
    current_intensity_mm_hr       : currentIntensity,
    regional_max_intensity_mm_hr  : latest.maxPrecip_mmhr,
    rain_30m_mm                   : locationRoll.rain_30m_mm,
    rain_1h_mm                    : locationRoll.rain_1h_mm,
    rain_3h_mm                    : locationRoll.rain_3h_mm,
    rain_6h_mm                    : locationRoll.rain_6h_mm,
    rain_12h_mm                   : locationRoll.rain_12h_mm,
    rain_24h_mm                   : locationRoll.rain_24h_mm,
    observation_time              : latest.timestamp,
    source                        : 'NASA GPM IMERG',
    product                       : 'GPM_3IMERGHHE',
    version                       : '07',
    status                        : 'success',
  };
}

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------

module.exports = {
  getSatelliteRainfall,
};
