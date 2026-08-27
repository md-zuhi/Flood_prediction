// Configuration file for Safe Evacuation Routes decision-support system

const SAFE_ROUTE_WEIGHTS = {
  floodSafety: 0.30,
  roadClosures: 0.25,        // Strongest incident penalty for reported closures
  landslideSafety: 0.15,
  trafficCongestion: 0.15,
  elevationSafety: 0.10,
  travelTime: 0.05
};

const HAZARD_THRESHOLDS = {
  prototypeBufferKm: 3.0,
  criticalFloodRiskPercent: 70,
  highFloodRiskPercent: 50,
  moderateFloodRiskPercent: 30
};

const CONFIDENCE_LEVELS = {
  HIGH: "HIGH",
  MODERATE: "MODERATE",
  LOW: "LOW"
};

const RISK_CLASSIFICATIONS = {
  LOWER_RISK: "LOWER RISK",
  USE_CAUTION: "USE CAUTION",
  HIGH_RISK: "HIGH RISK",
  AVOID: "AVOID"
};

module.exports = {
  SAFE_ROUTE_WEIGHTS,
  HAZARD_THRESHOLDS,
  CONFIDENCE_LEVELS,
  RISK_CLASSIFICATIONS
};
