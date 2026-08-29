// --------------------------------------------------
// River Alert Service
// Evaluates current readings + predictions and emits
// structured alerts for:
//   - Warning level reached
//   - Danger level reached
//   - Projected warning crossing within 3h
//   - Rapid rise detected
//
// Risk state: NORMAL / WATCH / WARNING / HIGH / CRITICAL
// Thresholds come from riverStations.js config — never
// hardcoded in this file or in React.
// --------------------------------------------------

const { STATION_MAP } = require("../config/riverStations");

// --------------------------------------------------
// Risk State Classifier
// --------------------------------------------------

/**
 * Classify risk state from current level and thresholds.
 *
 * NORMAL   → below WATCH band
 * WATCH    → within 20% gap below warning
 * WARNING  → at or above warning, below danger
 * HIGH     → at or above danger, below bankfull
 * CRITICAL → at or above bankfull
 */
function classifyRiskState(currentLevel, thresholds) {
  const { warning_m, danger_m, bankfull_m } = thresholds;

  if (currentLevel >= bankfull_m) return "CRITICAL";
  if (currentLevel >= danger_m) return "HIGH";
  if (currentLevel >= warning_m) return "WARNING";

  // WATCH band: within 20% of warning gap
  const watchBand = (warning_m - 0) * 0.2;
  if (currentLevel >= warning_m - watchBand) return "WATCH";

  return "NORMAL";
}

// --------------------------------------------------
// Rapid Rise Detection
// --------------------------------------------------

/**
 * Returns true if rate of rise exceeds the station's
 * configured rapid_rise_rate_m_per_hr threshold.
 */
function isRapidRise(rateInfo, thresholds) {
  if (rateInfo.insufficient_data || rateInfo.rate_m_per_hr === null) {
    return false;
  }
  return rateInfo.rate_m_per_hr >= thresholds.rapid_rise_rate_m_per_hr;
}

// --------------------------------------------------
// Alert Generator
// --------------------------------------------------

/**
 * Generate an array of active alerts for a station.
 *
 * @param {string} stationId
 * @param {object} currentData  - { current_level_m }
 * @param {object} prediction   - output of getPrediction()
 * @returns Array of alert objects
 */
function generateAlerts(stationId, currentData, prediction) {
  const station = STATION_MAP[stationId];
  if (!station || !currentData || currentData.current_level_m === null) {
    return [];
  }

  const alerts = [];
  const level = currentData.current_level_m;
  const thresholds = station.thresholds;
  const rateInfo = prediction?.rate_of_rise || {};
  const projections = prediction?.projections || {};

  // 1. Danger level reached
  if (level >= thresholds.danger_m) {
    alerts.push({
      type: "DANGER_REACHED",
      severity: "CRITICAL",
      message: `River level ${level.toFixed(2)} m has reached or exceeded the DANGER threshold (${thresholds.danger_m} m) at ${station.name}.`,
      station_id: stationId,
      station_name: station.name,
      timestamp_iso: new Date().toISOString()
    });
  }

  // 2. Warning level reached (below danger)
  if (level >= thresholds.warning_m && level < thresholds.danger_m) {
    alerts.push({
      type: "WARNING_REACHED",
      severity: "WARNING",
      message: `River level ${level.toFixed(2)} m has reached the WARNING threshold (${thresholds.warning_m} m) at ${station.name}.`,
      station_id: stationId,
      station_name: station.name,
      timestamp_iso: new Date().toISOString()
    });
  }

  // 3. Rapid rise detected
  if (isRapidRise(rateInfo, thresholds)) {
    alerts.push({
      type: "RAPID_RISE",
      severity: "HIGH",
      message: `Rapid rise detected at ${station.name}: ${rateInfo.rate_m_per_hr?.toFixed(3)} m/hr exceeds threshold of ${thresholds.rapid_rise_rate_m_per_hr} m/hr.`,
      station_id: stationId,
      station_name: station.name,
      timestamp_iso: new Date().toISOString()
    });
  }

  // 4. Predicted warning crossing within 3h
  if (
    level < thresholds.warning_m &&
    !rateInfo.insufficient_data &&
    rateInfo.trend === "RISING"
  ) {
    const p3h = projections.plus_3h_m;
    if (p3h !== null && p3h !== undefined && p3h >= thresholds.warning_m) {
      alerts.push({
        type: "PREDICTED_WARNING_CROSSING",
        severity: "WATCH",
        message: `Trend projection suggests river at ${station.name} may cross the WARNING level (${thresholds.warning_m} m) within 3 hours. Projected +3h: ${p3h.toFixed(2)} m. (Baseline trend — NOT ML)`,
        station_id: stationId,
        station_name: station.name,
        timestamp_iso: new Date().toISOString()
      });
    }
  }

  return alerts;
}

// --------------------------------------------------
// Full Risk Assessment
// --------------------------------------------------

/**
 * Evaluate current state and return risk + alerts.
 */
function evaluateRisk(stationId, currentData, prediction) {
  const station = STATION_MAP[stationId];
  const level = currentData ? (currentData.level_m !== undefined ? currentData.level_m : currentData.current_level_m) : null;
  const isDemo = currentData ? currentData.data_type === "DEMO" : false;
  const notice = currentData?.data_notice || (isDemo
    ? "DEMO / SIMULATED DATA — Not official gauge data"
    : "REAL DATA (Real-time gauge data is currently unavailable for this station)");

  if (!station || !currentData || level === null) {
    return {
      station_id: stationId,
      risk_state: "UNKNOWN",
      alerts: [],
      rapid_rise: false,
      data_notice: notice
    };
  }

  const thresholds = station.thresholds;
  const rateInfo = prediction?.rate_of_rise || {};

  const risk_state = classifyRiskState(level, thresholds);
  const alerts = generateAlerts(stationId, currentData, prediction);
  const rapidRise = isRapidRise(rateInfo, thresholds);

  return {
    station_id: stationId,
    station_name: station.name,
    risk_state,
    current_level_m: level,
    thresholds,
    alerts,
    rapid_rise: rapidRise,
    rate_m_per_hr: rateInfo.rate_m_per_hr ?? null,
    trend: rateInfo.trend ?? "UNKNOWN",
    data_notice: notice
  };
}

module.exports = {
  classifyRiskState,
  isRapidRise,
  generateAlerts,
  evaluateRisk
};
