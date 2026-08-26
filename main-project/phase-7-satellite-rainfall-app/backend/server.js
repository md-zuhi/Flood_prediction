const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

const DATA_FILE = path.join(
  __dirname,
  "../../Phase-7-Satellite-Rainfall/output/rainfall_data.json"
);

// ── UTC → IST helper (display only, never stored) ──────────────────────────
function toIST(utcIso) {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  // Add 5h30m in ms
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().replace("T", " ").replace("Z", "") + " IST";
}

// ── Rolling accumulation helpers ────────────────────────────────────────────
// Each step = 0.5 hr, so accumulation per step = meanPrecip_mmhr * 0.5
// windows: { label, steps }
const WINDOWS = [
  { key: "rain_30m_mm",  steps: 1  },
  { key: "rain_1h_mm",   steps: 2  },
  { key: "rain_3h_mm",   steps: 6  },
  { key: "rain_6h_mm",   steps: 12 },
  { key: "rain_12h_mm",  steps: 24 },
  { key: "rain_24h_mm",  steps: 48 },
];

function buildRolling(timeseries) {
  // accum[i] = meanPrecip_mmhr[i] * 0.5  (mm per 30-min step)
  const accum = timeseries.map((t) => t.meanPrecip_mmhr * 0.5);

  return timeseries.map((t, i) => {
    const row = { timestamp: t.timestamp };
    for (const { key, steps } of WINDOWS) {
      if (i + 1 < steps) {
        row[key] = null; // insufficient history
      } else {
        // sum the current step + (steps-1) preceding steps
        let sum = 0;
        for (let k = i - steps + 1; k <= i; k++) sum += accum[k];
        row[key] = +sum.toFixed(3);
      }
    }
    return row;
  });
}

// ── Check consecutive 30-min steps ─────────────────────────────────────────
function findMissingSteps(timeseries) {
  const missing = [];
  for (let i = 1; i < timeseries.length; i++) {
    const prev = new Date(timeseries[i - 1].timestamp);
    const curr = new Date(timeseries[i].timestamp);
    const diffMin = (curr - prev) / 60000;
    if (diffMin !== 30) {
      missing.push({
        after: timeseries[i - 1].timestamp,
        before: timeseries[i].timestamp,
        gapMinutes: diffMin,
      });
    }
  }
  return missing;
}

// ── Load & pre-compute ──────────────────────────────────────────────────────
let rainfallData = null;
let rolling = null;
let missingSteps = [];

function loadData() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  rainfallData = JSON.parse(raw);
  rolling = buildRolling(rainfallData.timeseries);
  missingSteps = findMissingSteps(rainfallData.timeseries);
  console.log(`Loaded ${rainfallData.timeseries.length} time steps, ${missingSteps.length} gaps`);
}

loadData();

// ── Routes ──────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/rainfall/summary", (req, res) => {
  const ts = rainfallData.timeseries;
  const totalMm = ts.reduce((s, t) => s + t.meanPrecip_mmhr * 0.5, 0);
  const peakEntry = ts.reduce((a, b) => (b.maxPrecip_mmhr > a.maxPrecip_mmhr ? b : a));
  res.json({
    bbox: rainfallData.bbox,
    timeSteps: ts.length,
    startTime_utc: ts[0].timestamp,
    endTime_utc: ts[ts.length - 1].timestamp,
    startTime_ist: toIST(ts[0].timestamp),
    endTime_ist: toIST(ts[ts.length - 1].timestamp),
    totalAccumulation_mm: +totalMm.toFixed(2),
    peakIntensity_mmhr: peakEntry.maxPrecip_mmhr,
    peakTime_utc: peakEntry.timestamp,
    peakTime_ist: toIST(peakEntry.timestamp),
    grid: rainfallData.grid,
  });
});

app.get("/api/rainfall/timeseries", (req, res) => {
  const ts = rainfallData.timeseries;
  res.json(
    ts.map((t, i) => ({
      index: i,
      timestamp_utc: t.timestamp,
      timestamp_ist: toIST(t.timestamp),
      meanPrecip_mmhr: t.meanPrecip_mmhr,
      maxPrecip_mmhr: t.maxPrecip_mmhr,
      accum_30m_mm: +(t.meanPrecip_mmhr * 0.5).toFixed(3),
    }))
  );
});

app.get("/api/rainfall/grid/:index", (req, res) => {
  const idx = parseInt(req.params.index);
  const ts = rainfallData.timeseries;
  if (isNaN(idx) || idx < 0 || idx >= ts.length)
    return res.status(400).json({ error: "Invalid index" });
  res.json({
    timestamp_utc: ts[idx].timestamp,
    timestamp_ist: toIST(ts[idx].timestamp),
    lats: rainfallData.grid.lats,
    lons: rainfallData.grid.lons,
    grid: ts[idx].grid,
  });
});

// Rolling accumulations for all timesteps
app.get("/api/rainfall/rolling", (req, res) => {
  res.json(rolling.map((r) => ({ ...r, timestamp_ist: toIST(r.timestamp) })));
});

// Flash-flood features for the LATEST timestep
app.get("/api/rainfall/features", (req, res) => {
  const ts = rainfallData.timeseries;
  const n = ts.length;
  const latest = ts[n - 1];
  const latestRolling = rolling[n - 1];

  res.json({
    source: "NASA GPM IMERG",
    product: "GPM_3IMERGHHE",
    version: "07",
    timestamp_utc: latest.timestamp,
    timestamp_ist: toIST(latest.timestamp),
    region: {
      south: rainfallData.bbox.latMin,
      north: rainfallData.bbox.latMax,
      west: rainfallData.bbox.lonMin,
      east: rainfallData.bbox.lonMax,
    },
    rainfall: {
      current_intensity_mm_hr: latest.meanPrecip_mmhr,
      regional_max_intensity_mm_hr: latest.maxPrecip_mmhr,
      rain_30m_mm: latestRolling.rain_30m_mm,
      rain_1h_mm: latestRolling.rain_1h_mm,
      rain_3h_mm: latestRolling.rain_3h_mm,
      rain_6h_mm: latestRolling.rain_6h_mm,
      rain_12h_mm: latestRolling.rain_12h_mm,
      rain_24h_mm: latestRolling.rain_24h_mm,
    },
  });
});

// Validation / debug info
app.get("/api/rainfall/validation", (req, res) => {
  const ts = rainfallData.timeseries;
  const n = ts.length;
  const latestRolling = rolling[n - 1];

  res.json({
    nasa_product: "GPM_3IMERGHHE",
    dataset_version: "07",
    observations: n,
    first_utc: ts[0].timestamp,
    last_utc: ts[n - 1].timestamp,
    first_ist: toIST(ts[0].timestamp),
    last_ist: toIST(ts[n - 1].timestamp),
    missing_steps: missingSteps,
    missing_step_count: missingSteps.length,
    history_complete: {
      "30m":  latestRolling.rain_30m_mm  !== null,
      "1h":   latestRolling.rain_1h_mm   !== null,
      "3h":   latestRolling.rain_3h_mm   !== null,
      "6h":   latestRolling.rain_6h_mm   !== null,
      "12h":  latestRolling.rain_12h_mm  !== null,
      "24h":  latestRolling.rain_24h_mm  !== null,
    },
  });
});

app.listen(7000, () => console.log("Phase 7 backend running on port 7000"));
