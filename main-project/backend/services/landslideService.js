// landslideService.js
// GSI Historical Landslide Analysis — Phase 10 Data Fusion
//
// Adapted from the verified Phase 6 landslide.js module.
// Uses the real Geological Survey of India (GSI) field-validated
// Tamil Nadu landslide inventory CSV.
//
// Functions exported:
//   getLandslideHistory(latitude, longitude, state)
//
// Haversine distance formula used throughout — no simple lat/lon subtraction.

'use strict';

const fs   = require('fs');
const path = require('path');

// --------------------------------------------------
// CSV path — already present in backend/data/
// --------------------------------------------------

const CSV_PATH = path.join(
  __dirname,
  '..',
  'data',
  'tamilnadu_landslide_inventory.csv'
);

// --------------------------------------------------
// Haversine distance (kilometres)
// Reused verbatim from Phase 6 landslide.js
// --------------------------------------------------

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

// --------------------------------------------------
// CSV parser — handles quoted fields (same as Phase 6)
// --------------------------------------------------

function parseCsvLine(line) {
  const cols   = [];
  let   cur    = '';
  let   inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"')                   { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote)       { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

// --------------------------------------------------
// Load & cache CSV records at module startup
// --------------------------------------------------
// CSV columns (0-indexed):
//   0  sl_no
//   1  slide_no
//   2  state
//   3  district
//   4  slide_name
//   5  nh_sh_location
//   6  latitude
//   7  longitude
//   8  material_involved
//   9  movement_type
//   10 history

let _csvCache   = null;
let _loadError  = null;
let _totalRows  = 0;
let _validRows  = 0;
let _invalidRows = 0;

function loadCsvOnce() {
  if (_csvCache !== null) return;   // already loaded

  if (!fs.existsSync(CSV_PATH)) {
    _loadError = `GSI CSV not found at: ${CSV_PATH}`;
    console.error(`[LandslideService] ${_loadError}`);
    _csvCache = [];
    return;
  }

  try {
    const text  = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, ''); // strip BOM
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    _totalRows  = lines.length - 1;   // exclude header row

    const records = [];
    let   invalid = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const lat  = parseFloat(cols[6]);
      const lon  = parseFloat(cols[7]);

      // Skip rows where coordinates are missing, non-finite, or zero
      if (!isFinite(lat) || !isFinite(lon) || lat === 0 || lon === 0) {
        invalid++;
        continue;
      }

      records.push({
        slideNo          : cols[1]  || '',
        slideName        : cols[4]  || '',
        nhShLocation     : cols[5]  || '',
        district         : cols[3]  || '',
        latitude         : lat,
        longitude        : lon,
        materialInvolved : cols[8]  || '',
        movementType     : cols[9]  || '',
        history          : cols[10] || '',
      });
    }

    _validRows   = records.length;
    _invalidRows = invalid;
    _csvCache    = records;

    console.log(
      `[LandslideService] CSV loaded — total rows: ${_totalRows}, ` +
      `valid coordinates: ${_validRows}, ` +
      `invalid/skipped: ${_invalidRows}`
    );
  } catch (err) {
    _loadError = err.message;
    _csvCache  = [];
    console.error(`[LandslideService] Failed to load CSV: ${_loadError}`);
  }
}

// --------------------------------------------------
// Susceptibility label (Phase 6 rule, unchanged)
// --------------------------------------------------

function susceptibilityLabel(count10km) {
  if (count10km === 0) return 'LOW';
  if (count10km <= 5)  return 'MODERATE';
  if (count10km <= 15) return 'HIGH';
  return 'VERY HIGH';
}

// --------------------------------------------------
// Location name display fallback (Phase 6 rule)
// --------------------------------------------------
// Order: slide_name → nh_sh_location → "Location name unavailable"
// Treats null, NULL, empty string, undefined as missing.

function resolveLocationName(record) {
  const clean = (v) =>
    v && v.trim() && v.trim().toUpperCase() !== 'NULL' ? v.trim() : null;

  return (
    clean(record.slideName) ||
    clean(record.nhShLocation) ||
    'Location name unavailable'
  );
}

// --------------------------------------------------
// Tamil Nadu scope check
// --------------------------------------------------

const TAMIL_NADU_VARIANTS = ['tamil nadu', 'tamilnadu', 'tn'];

function isTamilNadu(state) {
  if (!state) return false;
  const s = state.toLowerCase().trim();
  return TAMIL_NADU_VARIANTS.some((v) => s.includes(v));
}

// --------------------------------------------------
// Main exported function
// --------------------------------------------------

/**
 * getLandslideHistory(latitude, longitude, state)
 *
 * Returns historical GSI landslide analysis for the given coordinate.
 * Only Tamil Nadu is covered by the current dataset.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string|null} state   — e.g. "Tamil Nadu" from POST /api/fusion body
 * @returns {object}            — merged into record.landslide_history
 */
function getLandslideHistory(latitude, longitude, state) {

  // Ensure CSV is loaded (idempotent)
  loadCsvOnce();

  // ── Scope guard ────────────────────────────────────────────────────────────
  if (latitude == null || longitude == null || isNaN(Number(latitude)) || isNaN(Number(longitude)) || !isTamilNadu(state)) {
    return {
      nearest_event_km          : null,
      count_5km                 : null,
      count_10km                : null,
      count_25km                : null,
      historical_susceptibility : null,
      nearest_event             : null,
      source                    : 'GSI',
      dataset                   : 'Field-Validated Landslide Inventory',
      status                    : 'unavailable',
      message                   : 'Coordinates missing or location outside supported region.',
    };
  }

  // ── CSV load failure ───────────────────────────────────────────────────────
  if (_loadError || !_csvCache || _csvCache.length === 0) {
    return {
      nearest_event_km          : null,
      count_5km                 : null,
      count_10km                : null,
      count_25km                : null,
      historical_susceptibility : null,
      nearest_event             : null,
      source                    : 'GSI',
      dataset                   : 'Field-Validated Landslide Inventory',
      status                    : 'failed',
      message                   : _loadError || 'No valid records in CSV.',
    };
  }

  // ── Haversine analysis (adapted from Phase 6 analyseLocation) ──────────────
  const withDistance = _csvCache.map((r) => ({
    ...r,
    distanceKm: haversineKm(latitude, longitude, r.latitude, r.longitude),
  }));

  // Sort ascending by distance
  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  const within5  = withDistance.filter((r) => r.distanceKm <=  5).length;
  const within10 = withDistance.filter((r) => r.distanceKm <= 10).length;
  const within25 = withDistance.filter((r) => r.distanceKm <= 25).length;

  const nearest = withDistance[0] ?? null;

  // ── Build nearest_event details ────────────────────────────────────────────
  const nearestEventDetails = nearest
    ? {
        slide_no          : nearest.slideNo          || null,
        slide_name        : resolveLocationName(nearest),
        location          : nearest.nhShLocation     || null,
        district          : nearest.district         || null,
        latitude          : nearest.latitude,
        longitude         : nearest.longitude,
        material_involved : nearest.materialInvolved || null,
        movement_type     : nearest.movementType     || null,
        history           : nearest.history          || null,
        distance_km       : Number(nearest.distanceKm.toFixed(4)),
      }
    : null;

  return {
    nearest_event_km          : nearest
                                  ? Number(nearest.distanceKm.toFixed(4))
                                  : null,
    count_5km                 : within5,
    count_10km                : within10,
    count_25km                : within25,
    historical_susceptibility : susceptibilityLabel(within10),
    nearest_event             : nearestEventDetails,
    source                    : 'GSI',
    dataset                   : 'Field-Validated Landslide Inventory',
    status                    : 'success',
  };
}

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------

module.exports = {
  getLandslideHistory,
};
