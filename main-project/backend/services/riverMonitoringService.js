// --------------------------------------------------
// River Monitoring Service
// Generates SIMULATED river-level history for demo
// purposes when no real gauge API is available.
//
// DATA NOTICE: All readings are DEMO / SIMULATED DATA.
// They are clearly labeled and must NEVER be presented
// as real or official gauge readings.
//
// Multi-source architecture is ready to slot in:
//   - CWC (Central Water Commission) gauge feeds
//   - IMD gauge telemetry
//   - Any REST-accessible gauge API
// --------------------------------------------------

const { STATION_MAP, RIVER_STATIONS } = require("../config/riverStations");

// In-memory history store per station (bounded ring buffer)
// Key: stationId → Array of { timestamp_iso, level_m, source }
const historyStore = new Map();
const MAX_HISTORY_POINTS = 72; // 72 x 5-min = 6 hours of 5-min readings

// Seed a deterministic-but-realistic base level for each station
const stationBaseLevel = new Map();

function getBaseLevel(station) {
  if (!stationBaseLevel.has(station.id)) {
    const range = station.typical_range_m;
    const base =
      range.min + (range.max - range.min) * (0.25 + Math.random() * 0.35);
    stationBaseLevel.set(station.id, base);
  }
  return stationBaseLevel.get(station.id);
}

// Simulate a single realistic reading with slow drift + noise
function simulateLevel(station, prevLevel) {
  if (prevLevel === null || prevLevel === undefined) {
    return getBaseLevel(station);
  }

  const { min, max } = station.typical_range_m;
  // Small random walk delta: ±0.08m per 5-minute interval
  const drift = (Math.random() - 0.48) * 0.08;
  let next = prevLevel + drift;

  // Soft boundary reflection to stay within typical range
  if (next < min) next = min + Math.abs(drift);
  if (next > max) next = max - Math.abs(drift);

  return parseFloat(next.toFixed(3));
}

// Ensure station has a history buffer seeded with back-filled readings
function ensureHistory(station) {
  if (!historyStore.has(station.id)) {
    const buf = [];
    let level = getBaseLevel(station);
    const now = Date.now();

    // Back-fill 6 hours (72 readings × 5 min)
    for (let i = MAX_HISTORY_POINTS - 1; i >= 0; i--) {
      const ts = new Date(now - i * 5 * 60 * 1000).toISOString();
      level = simulateLevel(station, level);
      buf.push({
        timestamp_iso: ts,
        level_m: level,
        source: "SIMULATED",
        source_url_or_id: `${station.id}-sim`,
        data_type: "DEMO",
        status: "OK"
      });
    }

    historyStore.set(station.id, buf);
  }
}

// Tick: add one new simulated reading for a station
function tickStation(station) {
  ensureHistory(station);
  const buf = historyStore.get(station.id);
  const prevLevel = buf.length > 0 ? buf[buf.length - 1].level_m : null;
  const newLevel = simulateLevel(station, prevLevel);
  buf.push({
    timestamp_iso: new Date().toISOString(),
    level_m: newLevel,
    source: "SIMULATED",
    source_url_or_id: `${station.id}-sim`,
    data_type: "DEMO",
    status: "OK"
  });
  if (buf.length > MAX_HISTORY_POINTS) buf.shift();
}

// Auto-tick all stations every 5 minutes to keep readings fresh
setInterval(() => {
  for (const station of RIVER_STATIONS) {
    tickStation(station);
  }
}, 5 * 60 * 1000);

// Eagerly seed all stations on load
for (const station of RIVER_STATIONS) {
  ensureHistory(station);
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/**
 * Get the list of all stations with minimal metadata (no readings).
 */
function getAllStations(useDemo = false) {
  return RIVER_STATIONS.map((s) => ({
    id: s.id,
    name: s.name,
    river: s.river,
    region: s.region,
    state: s.state,
    latitude: s.latitude,
    longitude: s.longitude,
    thresholds: s.thresholds,
    typical_range_m: s.typical_range_m,
    data_sources: {
      ...s.data_sources,
      river_level: useDemo ? "SIMULATED" : "UNAVAILABLE"
    },
    real_source: s.real_source,
    data_notice: useDemo
      ? "DEMO / SIMULATED DATA — Not official gauge data"
      : "REAL DATA (Real-time gauge data is currently unavailable for this station)"
  }));
}

/**
 * Get the current (latest) reading for a station.
 * Returns null level if station not found or real data is unavailable.
 */
function getCurrentReading(stationId, useDemo = false) {
  const station = STATION_MAP[stationId];
  if (!station) return null;

  if (!useDemo) {
    return {
      station_id: station.id,
      station_name: station.name,
      river: station.river,
      region: station.region,
      state: station.state,
      latitude: station.latitude,
      longitude: station.longitude,
      thresholds: station.thresholds,
      // Normalized properties
      level_m: null,
      observation_time: null,
      source: "CWC",
      source_url_or_id: station.real_source?.station_id || `cwc-${station.id}`,
      data_type: "UNAVAILABLE",
      status: "UNAVAILABLE",
      // Backwards compatibility
      current_level_m: null,
      timestamp_iso: null,
      data_notice: "Real-time gauge data is currently unavailable for this station."
    };
  }

  ensureHistory(station);
  const buf = historyStore.get(station.id);
  const latest = buf[buf.length - 1];

  return {
    station_id: station.id,
    station_name: station.name,
    river: station.river,
    region: station.region,
    state: station.state,
    latitude: station.latitude,
    longitude: station.longitude,
    thresholds: station.thresholds,
    // Normalized properties
    level_m: latest.level_m,
    observation_time: latest.timestamp_iso,
    source: latest.source,
    source_url_or_id: latest.source_url_or_id,
    data_type: latest.data_type,
    status: latest.status,
    // Backwards compatibility
    current_level_m: latest.level_m,
    timestamp_iso: latest.timestamp_iso,
    data_notice: "DEMO / SIMULATED DATA — Not official gauge data"
  };
}

/**
 * Get the last N readings for a station (history).
 * @param {string} stationId
 * @param {number} limit  - how many recent readings (max 72)
 */
function getHistory(stationId, limit = 48, useDemo = false) {
  const station = STATION_MAP[stationId];
  if (!station) return null;

  if (!useDemo) {
    return {
      station_id: station.id,
      station_name: station.name,
      river: station.river,
      thresholds: station.thresholds,
      readings: [],
      data_notice: "Real-time gauge data is currently unavailable for this station."
    };
  }

  ensureHistory(station);
  const buf = historyStore.get(station.id);
  const capped = Math.min(limit, MAX_HISTORY_POINTS);
  const slice = buf.slice(-capped);

  const readings = slice.map((r) => ({
    level_m: r.level_m,
    observation_time: r.timestamp_iso,
    timestamp_iso: r.timestamp_iso, // Backwards compat
    source: r.source,
    source_url_or_id: r.source_url_or_id,
    data_type: r.data_type,
    status: r.status
  }));

  return {
    station_id: station.id,
    station_name: station.name,
    river: station.river,
    thresholds: station.thresholds,
    readings,
    data_notice: "DEMO / SIMULATED DATA — Not official gauge data"
  };
}

module.exports = {
  getAllStations,
  getCurrentReading,
  getHistory
};
