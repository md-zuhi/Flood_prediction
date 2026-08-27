/**
 * River Rise Intelligence & Telemetry RESTful API Router
 * SIH 2026: Flash Flood Prediction System for Hilly Regions
 * 
 * Endpoints:
 * - GET /api/rivers                : List all monitored river stations with summary metrics
 * - GET /api/rivers/:id/current    : Real-time telemetry, gauge reading, rate of rise, and warning headroom
 * - GET /api/rivers/:id/history    : Historical water-level readings (24h time-series hydrograph)
 * - GET /api/rivers/:id/prediction : Predicted river level horizons (+1h, +3h, +6h) and projected curve
 * - GET /api/rivers/:id/risk       : Dynamic 5-state risk classification and station threshold profile
 * - GET /api/rivers/:id/multi-source: Unified 7-stream multi-source environmental record
 */

const express = require("express");
const router = express.Router();

const {
  getAllRiverStations,
  getStationDetails,
  getStationThresholds,
  checkLiveRiverStage
} = require("../services/riverMonitoringService");
const { buildRiverMultiSourceRecord } = require("../services/riverMultiSourceFusionService");

/**
 * GET /api/rivers
 * List all monitored river stations with executive summary metrics
 */
router.get("/", async (req, res) => {
  try {
    const data = await getAllRiverStations();
    return res.status(200).json(data);
  } catch (err) {
    console.error("GET /api/rivers error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/rivers/:id/current
 * Real-time telemetry, gauge readings, rate of rise, and time-to-warning estimation
 */
router.get("/:id/current", async (req, res) => {
  try {
    const stationId = req.params.id;
    const stationRes = await getStationDetails(stationId);
    if (!stationRes || !stationRes.data) {
      return res.status(404).json({ success: false, message: `River station '${stationId}' not found` });
    }

    const st = stationRes.data;

    return res.status(200).json({
      success: true,
      station_id: st.id,
      river_name: st.river_name,
      location: st.location,
      state: st.state,
      basin: st.basin,
      coordinates: st.coordinates,
      telemetry: {
        current_level_m: st.current_level_m,
        previous_level_m: st.previous_level_m,
        warning_level_m: st.warning_level_m,
        danger_level_m: st.danger_level_m,
        bed_level_m: st.bed_level_m,
        warning_headroom_m: Number(Math.max(0, st.warning_level_m - st.current_level_m).toFixed(2)),
        danger_headroom_m: Number(Math.max(0, st.danger_level_m - st.current_level_m).toFixed(2)),
        rate_of_rise_m_hr: st.rate_of_rise_m_hr,
        trend: st.trend,
        trend_direction: st.trend_direction,
        flow_velocity_ms: st.flow_velocity_ms,
        discharge_cusecs: st.discharge_cusecs,
        time_to_warning: st.time_to_warning,
        rapid_rise_detection: st.rapid_rise_detection,
        observation_time: st.telemetry_updated_at || new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("GET /api/rivers/:id/current error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/rivers/:id/history
 * Historical water-level readings (24h time-series hydrograph)
 */
router.get("/:id/history", async (req, res) => {
  try {
    const stationId = req.params.id;
    const stationRes = await getStationDetails(stationId);
    if (!stationRes || !stationRes.data) {
      return res.status(404).json({ success: false, message: `River station '${stationId}' not found` });
    }

    const st = stationRes.data;
    const history = st.history || [];

    const levels = history.map((h) => h.level_m);
    const minLevel = levels.length ? Math.min(...levels) : st.current_level_m;
    const maxLevel = levels.length ? Math.max(...levels) : st.current_level_m;
    const avgLevel = levels.length ? Number((levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(2)) : st.current_level_m;

    return res.status(200).json({
      success: true,
      station_id: st.id,
      river_name: st.river_name,
      location: st.location,
      warning_level_m: st.warning_level_m,
      danger_level_m: st.danger_level_m,
      statistics: {
        readings_count: history.length,
        time_span_hours: 24,
        min_recorded_level_m: minLevel,
        max_recorded_level_m: maxLevel,
        average_recorded_level_m: avgLevel
      },
      history: history
    });
  } catch (err) {
    console.error("GET /api/rivers/:id/history error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/rivers/:id/prediction
 * Predicted river level horizons (+1h, +3h, +6h) and projected hydrograph curve
 */
router.get("/:id/prediction", async (req, res) => {
  try {
    const stationId = req.params.id;
    const stationRes = await getStationDetails(stationId);
    if (!stationRes || !stationRes.data) {
      return res.status(404).json({ success: false, message: `River station '${stationId}' not found` });
    }

    const st = stationRes.data;
    const predictions = st.predictions_1h_3h_6h || {};
    const forecastCurve = st.forecast || [];

    return res.status(200).json({
      success: true,
      station_id: st.id,
      river_name: st.river_name,
      location: st.location,
      current_level_m: st.current_level_m,
      warning_level_m: st.warning_level_m,
      danger_level_m: st.danger_level_m,
      rate_of_rise_m_hr: st.rate_of_rise_m_hr,
      method: predictions.method || "BASELINE_HYDRO_TREND",
      is_ml_model: false,
      disclaimer: "Kinematic trend-based hydrological baseline. Modular architecture ready for ML neural replacement.",
      horizons: predictions.predictions || [],
      forecast_curve: forecastCurve,
      projected_warning_breach: (predictions.predictions || []).some((p) => p.predicted_level_m >= st.warning_level_m && st.current_level_m < st.warning_level_m),
      projected_danger_breach: (predictions.predictions || []).some((p) => p.predicted_level_m >= st.danger_level_m && st.current_level_m < st.danger_level_m)
    });
  } catch (err) {
    console.error("GET /api/rivers/:id/prediction error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/rivers/:id/risk
 * Configurable 5-state risk classification, official threshold profile, and rapid-rise evaluation
 */
router.get("/:id/risk", async (req, res) => {
  try {
    const stationId = req.params.id;
    const stationRes = await getStationDetails(stationId);
    if (!stationRes || !stationRes.data) {
      return res.status(404).json({ success: false, message: `River station '${stationId}' not found` });
    }

    const st = stationRes.data;
    const thresholdProfile = getStationThresholds(stationId) || {};

    return res.status(200).json({
      success: true,
      station_id: st.id,
      river_name: st.river_name,
      location: st.location,
      current_level_m: st.current_level_m,
      risk_classification: {
        risk_level: st.risk_level,
        risk_color: st.risk_color,
        action_directive: st.risk_classification?.action_directive || "Standard monitoring protocol.",
        status_note: st.status_note
      },
      rapid_rise_detection: st.rapid_rise_detection,
      threshold_profile: {
        bed_level_m: st.bed_level_m,
        normal_max_level_m: thresholdProfile.normal_max_level_m,
        watch_level_m: thresholdProfile.watch_level_m,
        warning_level_m: st.warning_level_m,
        danger_level_m: st.danger_level_m,
        highest_flood_level_m: st.highest_flood_level_m
      }
    });
  } catch (err) {
    console.error("GET /api/rivers/:id/risk error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/rivers/:id/multi-source
 * 7-Stream Multi-Source Fused Record (IoT, Rainfall, Upstream, Weather, Elevation, Slope, Historical)
 */
router.get("/:id/multi-source", async (req, res) => {
  try {
    const stationId = req.params.id;
    const fusedRecord = await buildRiverMultiSourceRecord(stationId);
    if (!fusedRecord) {
      return res.status(404).json({ success: false, message: `River station '${stationId}' not found for multi-source fusion` });
    }
    return res.status(200).json({ success: true, data: fusedRecord });
  } catch (err) {
    console.error("GET /api/rivers/:id/multi-source error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/rivers/:id
 * Detailed telemetry, history, forecast, and risk profile for a single station
 */
router.get("/:id", async (req, res) => {
  try {
    const stationId = req.params.id;
    const stationRes = await getStationDetails(stationId);
    if (!stationRes || !stationRes.data) {
      return res.status(404).json({ success: false, message: `River station '${stationId}' not found` });
    }
    return res.status(200).json(stationRes);
  } catch (err) {
    console.error("GET /api/rivers/:id error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/rivers/:id/live-check or POST /api/rivers/:id/live-check
 * Actively queries real-time upstream weather and computes verified live river stage
 */
router.get("/:id/live-check", async (req, res) => {
  try {
    const stationId = req.params.id;
    const result = await checkLiveRiverStage(stationId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("GET /api/rivers/:id/live-check error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/:id/live-check", async (req, res) => {
  try {
    const stationId = req.params.id;
    const result = await checkLiveRiverStage(stationId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("POST /api/rivers/:id/live-check error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
