// --------------------------------------------------
// River Routes
// Mounts on /api/rivers
//
// GET /api/rivers                      - list all stations
// GET /api/rivers/:id/current          - current reading
// GET /api/rivers/:id/history          - level history
// GET /api/rivers/:id/prediction       - rate + projections
// GET /api/rivers/:id/risk             - risk state + alerts
//
// This file only adds NEW routes and does NOT modify
// the existing server.js endpoints.
// --------------------------------------------------

const express = require("express");
const router = express.Router();

const {
  getAllStations,
  getCurrentReading,
  getHistory
} = require("../services/riverMonitoringService");

const { getPrediction } = require("../services/riverPredictionService");
const { evaluateRisk } = require("../services/riverAlertService");

// --------------------------------------------------
// GET /api/rivers
// Returns metadata for all configured river stations.
// --------------------------------------------------
router.get("/", (req, res) => {
  try {
    const useDemo = req.query.demo === "true";
    const stations = getAllStations(useDemo);
    return res.json({
      success: true,
      count: stations.length,
      stations,
      data_notice: useDemo
        ? "DEMO / SIMULATED DATA — Not official gauge data"
        : "REAL DATA (Real-time gauge data is currently unavailable for this station)"
    });
  } catch (err) {
    console.error("[riverRoutes] GET /api/rivers error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// GET /api/rivers/:id/current
// Latest reading for one station.
// --------------------------------------------------
router.get("/:id/current", (req, res) => {
  try {
    const useDemo = req.query.demo === "true";
    const data = getCurrentReading(req.params.id, useDemo);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: `Station '${req.params.id}' not found` });
    }
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("[riverRoutes] GET current error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// GET /api/rivers/:id/history?limit=48
// Up to 72 recent readings.
// --------------------------------------------------
router.get("/:id/history", (req, res) => {
  try {
    const useDemo = req.query.demo === "true";
    const limit = Math.min(
      parseInt(req.query.limit, 10) || 48,
      72
    );
    const data = getHistory(req.params.id, limit, useDemo);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: `Station '${req.params.id}' not found` });
    }
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("[riverRoutes] GET history error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// GET /api/rivers/:id/prediction
// Rate of rise, time-to-warning, +1h/+3h/+6h projections.
// --------------------------------------------------
router.get("/:id/prediction", (req, res) => {
  try {
    const useDemo = req.query.demo === "true";
    const data = getPrediction(req.params.id, useDemo);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: `Station '${req.params.id}' not found` });
    }
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("[riverRoutes] GET prediction error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// GET /api/rivers/:id/risk
// Risk state + all active alerts.
// --------------------------------------------------
router.get("/:id/risk", (req, res) => {
  try {
    const useDemo = req.query.demo === "true";
    const currentData = getCurrentReading(req.params.id, useDemo);
    if (!currentData) {
      return res
        .status(404)
        .json({ success: false, error: `Station '${req.params.id}' not found` });
    }

    const prediction = getPrediction(req.params.id, useDemo);
    const risk = evaluateRisk(req.params.id, currentData, prediction);

    return res.json({ success: true, ...risk });
  } catch (err) {
    console.error("[riverRoutes] GET risk error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
