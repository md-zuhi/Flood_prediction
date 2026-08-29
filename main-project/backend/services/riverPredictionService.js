// --------------------------------------------------
// River Prediction Service
// Calculates:
//   - Rate of rise (m/hr)
//   - Trend classification (rising / falling / stable)
//   - Time-to-warning estimate (rising + below warning only)
//   - Baseline +1h / +3h / +6h linear projections
//
// IMPORTANT: All projections use recent trend only (linear
// extrapolation). Clearly labeled:
//   "Baseline trend projection — NOT ML"
//
// DATA NOTICE: Inputs from SIMULATED gauge data.
// --------------------------------------------------

const { STATION_MAP } = require("../config/riverStations");
const { getHistory } = require("./riverMonitoringService");

// Minimum seconds between readings to compute a meaningful rate
const MIN_INTERVAL_SECONDS = 60; // 1 minute

// Stable band: rate within ±0.02 m/hr is "stable"
const STABLE_BAND_M_PER_HR = 0.02;

/**
 * Compute rate of rise (m/hr) from the N most-recent readings.
 * Uses a simple least-squares slope over the window for robustness
 * against irregular intervals.
 *
 * Returns:
 *   { rate_m_per_hr, trend, window_start_iso, window_end_iso,
 *     samples_used, irregular_intervals, insufficient_data }
 */
function computeRateOfRise(readings) {
  if (!readings || readings.length < 2) {
    return {
      rate_m_per_hr: null,
      trend: "UNKNOWN",
      window_start_iso: null,
      window_end_iso: null,
      samples_used: readings ? readings.length : 0,
      irregular_intervals: false,
      insufficient_data: true
    };
  }

  // Filter out any readings with missing level
  const valid = readings.filter(
    (r) => r.level_m !== null && r.level_m !== undefined
  );

  if (valid.length < 2) {
    return {
      rate_m_per_hr: null,
      trend: "UNKNOWN",
      window_start_iso: null,
      window_end_iso: null,
      samples_used: valid.length,
      irregular_intervals: false,
      insufficient_data: true
    };
  }

  // Convert timestamps to hours (relative to first reading)
  const t0 = new Date(valid[0].timestamp_iso).getTime();
  const xs = valid.map(
    (r) => (new Date(r.timestamp_iso).getTime() - t0) / 3_600_000
  );
  const ys = valid.map((r) => r.level_m);

  // Check for irregular intervals
  const intervals = [];
  for (let i = 1; i < xs.length; i++) {
    intervals.push(xs[i] - xs[i - 1]);
  }
  const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const irregular = intervals.some(
    (iv) => Math.abs(iv - meanInterval) > meanInterval * 0.5
  );

  // Guard: total time span must be meaningful
  const totalHours = xs[xs.length - 1] - xs[0];
  if (totalHours < MIN_INTERVAL_SECONDS / 3600) {
    return {
      rate_m_per_hr: null,
      trend: "UNKNOWN",
      window_start_iso: valid[0].timestamp_iso,
      window_end_iso: valid[valid.length - 1].timestamp_iso,
      samples_used: valid.length,
      irregular_intervals: irregular,
      insufficient_data: true
    };
  }

  // Least-squares linear regression: y = a + b*x  →  b = rate (m/hr)
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;

  let slope = 0;
  if (Math.abs(denom) > 1e-12) {
    slope = (n * sumXY - sumX * sumY) / denom;
  }

  const rate = parseFloat(slope.toFixed(4)); // m/hr

  let trend;
  if (Math.abs(rate) <= STABLE_BAND_M_PER_HR) {
    trend = "STABLE";
  } else if (rate > 0) {
    trend = "RISING";
  } else {
    trend = "FALLING";
  }

  return {
    rate_m_per_hr: rate,
    trend,
    window_start_iso: valid[0].timestamp_iso,
    window_end_iso: valid[valid.length - 1].timestamp_iso,
    samples_used: valid.length,
    irregular_intervals: irregular,
    insufficient_data: false
  };
}

/**
 * Compute time-to-warning estimate.
 * Only valid when: river is RISING AND current_level < warning_m.
 *
 * Formula: (warning_level - current_level) / positive_rate
 *
 * Returns hours (float) or a descriptive string.
 */
function computeTimeToWarning(currentLevel, rateInfo, thresholds) {
  const { rate_m_per_hr, trend, insufficient_data } = rateInfo;

  if (insufficient_data || rate_m_per_hr === null) {
    return {
      hours: null,
      label: "Insufficient data for estimate",
      method: "trend-based estimate"
    };
  }

  if (trend !== "RISING" || rate_m_per_hr <= 0) {
    return {
      hours: null,
      label: "Insufficient data for estimate",
      method: "trend-based estimate"
    };
  }

  if (currentLevel >= thresholds.warning_m) {
    return {
      hours: null,
      label: "Already at or above warning level",
      method: "trend-based estimate"
    };
  }

  const gap = thresholds.warning_m - currentLevel;
  const hours = parseFloat((gap / rate_m_per_hr).toFixed(2));

  return {
    hours,
    label: `~${hours} hr (trend-based estimate)`,
    method: "trend-based estimate"
  };
}

/**
 * Compute baseline +1h, +3h, +6h level projections.
 * Linear extrapolation from current level + rate.
 * Clearly labeled as NOT ML.
 *
 * Clamps results to non-negative values.
 */
function computeProjections(currentLevel, rateInfo) {
  const label = "Baseline trend projection — NOT ML";

  if (rateInfo.insufficient_data || rateInfo.rate_m_per_hr === null) {
    return {
      label,
      plus_1h_m: null,
      plus_3h_m: null,
      plus_6h_m: null,
      confidence: "Low — insufficient data"
    };
  }

  const rate = rateInfo.rate_m_per_hr;

  const project = (hours) =>
    parseFloat(Math.max(0, currentLevel + rate * hours).toFixed(3));

  return {
    label,
    plus_1h_m: project(1),
    plus_3h_m: project(3),
    plus_6h_m: project(6),
    confidence: "Low — linear trend extrapolation only"
  };
}

/**
 * Full prediction for a station.
 * Uses the 12 most-recent readings (approx 1 hour of 5-min data)
 * to compute rate and projections.
 */
function getPrediction(stationId, useDemo = false) {
  const station = STATION_MAP[stationId];
  if (!station) return null;

  const histData = getHistory(stationId, 48, useDemo);
  if (!histData) return null;

  const readings = histData.readings;
  // Use last 12 readings (~1 hour) for rate calc
  const window = readings.slice(-12);

  const currentLevel =
    readings.length > 0
      ? readings[readings.length - 1].level_m
      : null;

  const rateInfo = computeRateOfRise(window);
  const timeToWarning =
    currentLevel !== null
      ? computeTimeToWarning(currentLevel, rateInfo, station.thresholds)
      : { hours: null, label: "Insufficient data for estimate", method: "trend-based estimate" };

  const projections =
    currentLevel !== null
      ? computeProjections(currentLevel, rateInfo)
      : {
          label: "Baseline trend projection — NOT ML",
          plus_1h_m: null,
          plus_3h_m: null,
          plus_6h_m: null,
          confidence: "Low — insufficient data"
        };

  return {
    station_id: stationId,
    current_level_m: currentLevel,
    thresholds: station.thresholds,
    rate_of_rise: rateInfo,
    time_to_warning: timeToWarning,
    projections,
    data_notice: useDemo
      ? "DEMO / SIMULATED DATA — Not official gauge data"
      : "REAL DATA (Real-time gauge data is currently unavailable for this station)"
  };
}

// Exports for testing
module.exports = {
  computeRateOfRise,
  computeTimeToWarning,
  computeProjections,
  getPrediction
};
