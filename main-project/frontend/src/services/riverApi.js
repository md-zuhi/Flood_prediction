// --------------------------------------------------
// River API Service (Frontend)
// Thin wrapper around the /api/rivers backend endpoints.
// --------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const BASE = `${API_BASE}/api/rivers`;

/**
 * Fetch all river stations (metadata only, no readings).
 */
export async function fetchStations(demo = false) {
  const url = demo ? `${BASE}?demo=true` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`/api/rivers failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch current reading for one station.
 * @param {string} stationId
 * @param {boolean} demo
 */
export async function fetchCurrentReading(stationId, demo = false) {
  const url = demo ? `${BASE}/${stationId}/current?demo=true` : `${BASE}/${stationId}/current`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`/api/rivers/${stationId}/current failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch history for one station.
 * @param {string} stationId
 * @param {number} limit  - number of readings (max 72)
 * @param {boolean} demo
 */
export async function fetchHistory(stationId, limit = 48, demo = false) {
  const url = demo
    ? `${BASE}/${stationId}/history?limit=${limit}&demo=true`
    : `${BASE}/${stationId}/history?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`/api/rivers/${stationId}/history failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch prediction (rate, projections, time-to-warning).
 * @param {string} stationId
 * @param {boolean} demo
 */
export async function fetchPrediction(stationId, demo = false) {
  const url = demo ? `${BASE}/${stationId}/prediction?demo=true` : `${BASE}/${stationId}/prediction`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`/api/rivers/${stationId}/prediction failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch risk state and alerts.
 * @param {string} stationId
 * @param {boolean} demo
 */
export async function fetchRisk(stationId, demo = false) {
  const url = demo ? `${BASE}/${stationId}/risk?demo=true` : `${BASE}/${stationId}/risk`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`/api/rivers/${stationId}/risk failed: ${res.status}`);
  return res.json();
}
