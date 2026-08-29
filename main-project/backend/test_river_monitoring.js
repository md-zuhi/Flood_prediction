// --------------------------------------------------
// River Monitoring Test Suite
// Tests: rate-of-rise, falling/stable cases, irregular
// intervals, time-to-warning, projections, risk thresholds,
// rapid-rise detection.
//
// Run: node test_river_monitoring.js
// --------------------------------------------------

const { computeRateOfRise, computeTimeToWarning, computeProjections } =
  require("./services/riverPredictionService");
const { classifyRiskState, isRapidRise, generateAlerts } =
  require("./services/riverAlertService");
const { getAllStations, getCurrentReading, getHistory } =
  require("./services/riverMonitoringService");

let passed = 0;
let failed = 0;

function assert(name, condition, info = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${info ? " — " + info : ""}`);
    failed++;
  }
}

function makeReadings(levels, intervalMin = 5) {
  const now = Date.now();
  return levels.map((level_m, i) => ({
    timestamp_iso: new Date(now - (levels.length - 1 - i) * intervalMin * 60 * 1000).toISOString(),
    level_m
  }));
}

// -----------------------------------------------------------------------
console.log("\n=== 1. Rate of Rise ===");

const risingReadings = makeReadings([1.0, 1.1, 1.2, 1.3, 1.4, 1.5]); // +0.1m per 5 min
const rr = computeRateOfRise(risingReadings);
console.log("  rate_m_per_hr:", rr.rate_m_per_hr);
assert("Rising trend is RISING", rr.trend === "RISING");
assert("Rate > 0 for rising", rr.rate_m_per_hr > 0);
assert("Expected ~1.2 m/hr (±0.3)", Math.abs(rr.rate_m_per_hr - 1.2) < 0.3, `got ${rr.rate_m_per_hr}`);
assert("sufficient_data = true", !rr.insufficient_data);

// -----------------------------------------------------------------------
console.log("\n=== 2. Falling Case ===");

const fallingReadings = makeReadings([2.0, 1.9, 1.8, 1.7, 1.6, 1.5]);
const rrf = computeRateOfRise(fallingReadings);
console.log("  rate_m_per_hr:", rrf.rate_m_per_hr);
assert("Falling trend is FALLING", rrf.trend === "FALLING");
assert("Rate < 0 for falling", rrf.rate_m_per_hr < 0);

// -----------------------------------------------------------------------
console.log("\n=== 3. Stable Case ===");

const stableReadings = makeReadings([1.5, 1.51, 1.499, 1.502, 1.5, 1.501]);
const rrs = computeRateOfRise(stableReadings);
console.log("  rate_m_per_hr:", rrs.rate_m_per_hr);
assert("Stable trend is STABLE or very small rate", Math.abs(rrs.rate_m_per_hr) <= 0.05);

// -----------------------------------------------------------------------
console.log("\n=== 4. Missing Data ===");

const missingReadings = [
  { timestamp_iso: new Date().toISOString(), level_m: null },
  { timestamp_iso: new Date().toISOString(), level_m: null }
];
const rrm = computeRateOfRise(missingReadings);
assert("Missing data → insufficient_data flag", rrm.insufficient_data);
assert("Missing data → null rate", rrm.rate_m_per_hr === null);

// -----------------------------------------------------------------------
console.log("\n=== 5. Irregular Intervals ===");

const now = Date.now();
const irregReadings = [
  { timestamp_iso: new Date(now - 60 * 60 * 1000).toISOString(), level_m: 1.0 },  // 60 min ago
  { timestamp_iso: new Date(now - 50 * 60 * 1000).toISOString(), level_m: 1.05 }, // 50 min ago
  { timestamp_iso: new Date(now - 5 * 60 * 1000).toISOString(), level_m: 1.3 },   // 5 min ago
  { timestamp_iso: new Date(now).toISOString(), level_m: 1.35 }                    // now
];
const rri = computeRateOfRise(irregReadings);
console.log("  irregular_intervals:", rri.irregular_intervals, "rate:", rri.rate_m_per_hr);
assert("Irregular intervals flagged", rri.irregular_intervals === true);
assert("Still computes a rate", rri.rate_m_per_hr !== null);

// -----------------------------------------------------------------------
console.log("\n=== 6. Time to Warning ===");

const thresholds = { warning_m: 2.0, danger_m: 3.0, bankfull_m: 4.0, rapid_rise_rate_m_per_hr: 0.3 };

// Should compute: (2.0 - 1.4) / 1.2 ≈ 0.5 hr
const ttwRising = computeTimeToWarning(1.4, { rate_m_per_hr: 1.2, trend: "RISING", insufficient_data: false }, thresholds);
console.log("  TTW (rising):", ttwRising);
assert("TTW returns numeric hours when rising", ttwRising.hours !== null);
assert("TTW ~0.5hr", Math.abs(ttwRising.hours - 0.5) < 0.1, `got ${ttwRising.hours}`);

// Not rising → insufficient data
const ttwFalling = computeTimeToWarning(1.4, { rate_m_per_hr: -0.5, trend: "FALLING", insufficient_data: false }, thresholds);
assert("TTW returns null when falling", ttwFalling.hours === null);
assert("TTW label = 'Insufficient data for estimate' when not rising", ttwFalling.label === "Insufficient data for estimate");

// Above warning → already reached
const ttwAbove = computeTimeToWarning(2.2, { rate_m_per_hr: 0.5, trend: "RISING", insufficient_data: false }, thresholds);
assert("TTW null when above warning", ttwAbove.hours === null);

// -----------------------------------------------------------------------
console.log("\n=== 7. +1h / +3h / +6h Projections ===");

const proj = computeProjections(1.5, { rate_m_per_hr: 0.2, trend: "RISING", insufficient_data: false });
console.log("  projections:", proj.plus_1h_m, proj.plus_3h_m, proj.plus_6h_m);
assert("Projections labeled NOT ML", proj.label.includes("NOT ML"));
assert("+1h = 1.7", Math.abs(proj.plus_1h_m - 1.7) < 0.01, `got ${proj.plus_1h_m}`);
assert("+3h = 2.1", Math.abs(proj.plus_3h_m - 2.1) < 0.01, `got ${proj.plus_3h_m}`);
assert("+6h = 2.7", Math.abs(proj.plus_6h_m - 2.7) < 0.01, `got ${proj.plus_6h_m}`);

// Insufficient data → all nulls
const projInsuf = computeProjections(1.0, { rate_m_per_hr: null, trend: "UNKNOWN", insufficient_data: true });
assert("Projections null when no data", projInsuf.plus_1h_m === null);

// -----------------------------------------------------------------------
console.log("\n=== 8. Risk Thresholds / State Classification ===");

assert("Below watch → NORMAL", classifyRiskState(0.5, thresholds) === "NORMAL");
assert("Near warning → WATCH", classifyRiskState(1.65, thresholds) === "WATCH");
assert("At warning → WARNING", classifyRiskState(2.0, thresholds) === "WARNING");
assert("Between warning and danger → WARNING", classifyRiskState(2.5, thresholds) === "WARNING");
assert("At danger → HIGH", classifyRiskState(3.0, thresholds) === "HIGH");
assert("At bankfull → CRITICAL", classifyRiskState(4.0, thresholds) === "CRITICAL");

// -----------------------------------------------------------------------
console.log("\n=== 9. Rapid Rise Detection ===");

assert("Rapid rise detected", isRapidRise({ rate_m_per_hr: 0.5, trend: "RISING", insufficient_data: false }, thresholds));
assert("No rapid rise below threshold", !isRapidRise({ rate_m_per_hr: 0.1, trend: "RISING", insufficient_data: false }, thresholds));
assert("No rapid rise with insufficient data", !isRapidRise({ rate_m_per_hr: null, trend: "UNKNOWN", insufficient_data: true }, thresholds));

// -----------------------------------------------------------------------
console.log("\n=== 10. Alert Generation (Demo Mode) ===");

const stationId = "coonoor-river-01";
const stations = getAllStations(true);
assert("Station list non-empty", stations.length > 0);
assert("Demo mode stations have SIMULATED status", stations[0].data_sources.river_level === "SIMULATED");

const cur = getCurrentReading(stationId, true);
assert("getCurrentReading returns object", cur !== null);
assert("getCurrentReading has current_level_m", cur.current_level_m !== null);
assert("DEMO notice present", cur.data_notice.includes("DEMO"));

const hist = getHistory(stationId, 12, true);
assert("getHistory returns readings array", Array.isArray(hist.readings));
assert("getHistory limited to 12", hist.readings.length <= 12);
assert("getHistory readings have DEMO data_type", hist.readings[0].data_type === "DEMO");

// -----------------------------------------------------------------------
console.log("\n=== 11. Edge Cases ===");

// Single reading → insufficient data
const singleReading = makeReadings([1.5]);
const rrSingle = computeRateOfRise(singleReading);
assert("Single reading → insufficient_data", rrSingle.insufficient_data);

// Zero time span → insufficient data
const zeroSpan = [
  { timestamp_iso: new Date().toISOString(), level_m: 1.0 },
  { timestamp_iso: new Date().toISOString(), level_m: 1.1 }
];
const rrZero = computeRateOfRise(zeroSpan);
assert("Zero time span → insufficient_data or null rate", rrZero.insufficient_data || rrZero.rate_m_per_hr === null);

// Non-negative projection clamp
const projNeg = computeProjections(0.1, { rate_m_per_hr: -0.5, trend: "FALLING", insufficient_data: false });
assert("Projections never negative", projNeg.plus_1h_m >= 0 && projNeg.plus_3h_m >= 0 && projNeg.plus_6h_m >= 0);

// -----------------------------------------------------------------------
console.log("\n=== 12. Real Data / Unavailable Production Mode ===");

const realStations = getAllStations(false);
assert("Production mode lists stations as UNAVAILABLE", realStations[0].data_sources.river_level === "UNAVAILABLE");
assert("Production notice refers to REAL DATA / UNAVAILABLE", realStations[0].data_notice.includes("REAL DATA"));

const realCur = getCurrentReading(stationId, false);
assert("Production reading has level_m = null", realCur.level_m === null);
assert("Production reading has current_level_m = null", realCur.current_level_m === null);
assert("Production reading has UNAVAILABLE data_type", realCur.data_type === "UNAVAILABLE");

const realHist = getHistory(stationId, 12, false);
assert("Production history returns empty readings", realHist.readings.length === 0);

// -----------------------------------------------------------------------
console.log("\n==============================");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("⚠ Some tests FAILED");
  process.exit(1);
} else {
  console.log("✅ All tests PASSED");
}
