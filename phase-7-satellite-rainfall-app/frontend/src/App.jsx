import { useEffect, useState } from "react";
import "./App.css";

const API = "/api/rainfall";

// All timestamps arrive from backend already labelled as IST strings
// or as UTC ISO strings. We only convert UTC→IST here for display.
function utcToIST(utcIso) {
  if (!utcIso) return "-";
  const d = new Date(utcIso);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return (
    ist.toISOString().slice(0, 16).replace("T", " ") + " IST"
  );
}

// Backend already returns timestamp_ist strings — use directly
function displayIST(istStr) {
  return istStr ?? "-";
}

function rainColor(val) {
  if (val === null || val === undefined) return "#e8e8e8";
  if (val <= 0) return "#f0f4ff";
  if (val < 1)  return "#c6e0ff";
  if (val < 3)  return "#6ab4ff";
  if (val < 7)  return "#1a7de8";
  if (val < 15) return "#0a4fa0";
  if (val < 30) return "#6a0dad";
  return "#cc0000";
}

function GridMap({ gridData }) {
  if (!gridData) return null;
  const { lats, lons, grid } = gridData;
  const cellSize = 18;
  return (
    <div className="grid-wrap">
      <svg width={lons.length * cellSize} height={lats.length * cellSize}>
        {lons.map((lon, xi) =>
          [...lats].reverse().map((lat, yi) => {
            const latOrigIdx = lats.length - 1 - yi;
            const val = grid[xi]?.[latOrigIdx];
            return (
              <rect
                key={`${xi}-${yi}`}
                x={xi * cellSize} y={yi * cellSize}
                width={cellSize} height={cellSize}
                fill={rainColor(val)} stroke="#fff" strokeWidth={0.3}
              >
                <title>{`Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}: ${val !== null ? val + " mm/hr" : "N/A"}`}</title>
              </rect>
            );
          })
        )}
      </svg>
      <div className="legend">
        {[["#f0f4ff","0"],["#c6e0ff","<1"],["#6ab4ff","1–3"],
          ["#1a7de8","3–7"],["#0a4fa0","7–15"],["#6a0dad","15–30"],["#cc0000",">30"]
        ].map(([c, l]) => (
          <span key={l} className="legend-item">
            <span style={{ background: c }} className="legend-box" />{l}
          </span>
        ))}
        <span className="legend-unit">mm/hr</span>
      </div>
    </div>
  );
}

function val(v, unit = "") {
  if (v === null || v === undefined) return <span className="na">Insufficient history</span>;
  return <>{v} {unit}</>;
}

export default function App() {
  const [summary, setSummary]       = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [rolling, setRolling]       = useState([]);
  const [features, setFeatures]     = useState(null);
  const [validation, setValidation] = useState(null);
  const [gridData, setGridData]     = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/summary`).then((r) => r.json()),
      fetch(`${API}/timeseries`).then((r) => r.json()),
      fetch(`${API}/rolling`).then((r) => r.json()),
      fetch(`${API}/features`).then((r) => r.json()),
      fetch(`${API}/validation`).then((r) => r.json()),
    ])
      .then(([s, ts, ro, fe, va]) => {
        setSummary(s);
        setTimeseries(ts);
        setRolling(ro);
        setFeatures(fe);
        setValidation(va);
        setSelectedIdx(ts.length - 1); // default to latest
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (timeseries.length === 0) return;
    fetch(`${API}/grid/${selectedIdx}`)
      .then((r) => r.json())
      .then(setGridData);
  }, [selectedIdx, timeseries]);

  if (loading) return <div className="center">Loading satellite rainfall data...</div>;
  if (error)   return <div className="center error">Error: {error}</div>;

  const maxBar = Math.max(...timeseries.map((t) => t.maxPrecip_mmhr), 1);

  // Build IST x-axis tick labels from actual data
  const tickIndices = [0, Math.floor(timeseries.length / 3), Math.floor(2 * timeseries.length / 3), timeseries.length - 1];

  return (
    <div className="app">
      <h1>Phase 7 — NASA GPM Satellite Rainfall</h1>
      <p className="subtitle">
        Real IMERG HHR data · Nilgiris region (11.2–11.5°N, 76.65–76.95°E) ·{" "}
        {displayIST(summary.startTime_ist)} → {displayIST(summary.endTime_ist)}
      </p>

      {/* ── Summary cards ── */}
      <div className="cards">
        <div className="card">
          <div className="card-val">{summary.totalAccumulation_mm} mm</div>
          <div className="card-label">Total Accumulation (Regional Mean)</div>
        </div>
        <div className="card">
          <div className="card-val">{summary.peakIntensity_mmhr} mm/hr</div>
          <div className="card-label">Peak Regional Max Intensity</div>
        </div>
        <div className="card">
          <div className="card-val">{summary.timeSteps}</div>
          <div className="card-label">30-min Time Steps</div>
        </div>
        <div className="card">
          <div className="card-val">{displayIST(summary.peakTime_ist).replace(" IST","")}</div>
          <div className="card-label">Peak Time (IST)</div>
        </div>
      </div>

      {/* ── Flash-Flood Rainfall Features ── */}
      <div className="section-title">Flash-Flood Rainfall Features</div>
      <p className="note">Regional mean over bbox · Source: NASA GPM IMERG V07 · All times IST</p>
      {features && (
        <div className="features-grid">
          <div className="feat-card">
            <div className="feat-label">Latest Observation</div>
            <div className="feat-val">{displayIST(features.timestamp_ist)}</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Current Intensity (Regional Mean)</div>
            <div className="feat-val">{features.rainfall.current_intensity_mm_hr} mm/hr</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Regional Max Intensity</div>
            <div className="feat-val">{features.rainfall.regional_max_intensity_mm_hr} mm/hr</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Rainfall last 30 min</div>
            <div className="feat-val">{val(features.rainfall.rain_30m_mm, "mm")}</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Rainfall last 1 hour</div>
            <div className="feat-val">{val(features.rainfall.rain_1h_mm, "mm")}</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Rainfall last 3 hours</div>
            <div className="feat-val">{val(features.rainfall.rain_3h_mm, "mm")}</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Rainfall last 6 hours</div>
            <div className="feat-val">{val(features.rainfall.rain_6h_mm, "mm")}</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Rainfall last 12 hours</div>
            <div className="feat-val">{val(features.rainfall.rain_12h_mm, "mm")}</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Rainfall last 24 hours</div>
            <div className="feat-val">{val(features.rainfall.rain_24h_mm, "mm")}</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Peak Intensity</div>
            <div className="feat-val">{summary.peakIntensity_mmhr} mm/hr</div>
          </div>
          <div className="feat-card">
            <div className="feat-label">Peak Time</div>
            <div className="feat-val">{displayIST(summary.peakTime_ist)}</div>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <div className="section-title">Rainfall Intensity Timeline (IST)</div>
      <div className="chart-legend-row">
        <span className="cl-box" style={{background:"#1a7de8"}} /> Regional Max &nbsp;
        <span className="cl-box" style={{background:"#6ab4ff"}} /> Regional Mean
      </div>
      <div className="chart">
        {timeseries.map((t, i) => (
          <div
            key={i}
            className={`bar-wrap ${i === selectedIdx ? "active" : ""}`}
            onClick={() => setSelectedIdx(i)}
            title={`${displayIST(t.timestamp_ist)}\nMean: ${t.meanPrecip_mmhr} mm/hr\nMax: ${t.maxPrecip_mmhr} mm/hr`}
          >
            <div className="bar"     style={{ height: `${(t.maxPrecip_mmhr  / maxBar) * 120}px` }} />
            <div className="bar mean" style={{ height: `${(t.meanPrecip_mmhr / maxBar) * 120}px` }} />
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {tickIndices.map((idx) => (
          <span key={idx}>{displayIST(timeseries[idx]?.timestamp_ist).replace(" IST","")}</span>
        ))}
      </div>

      {/* ── Spatial Grid ── */}
      <div className="section-title">
        Spatial Grid — {gridData ? displayIST(gridData.timestamp_ist) : "..."}
        <span className="hint"> (click a bar above to change time step)</span>
      </div>
      <p className="note">Each cell = 0.1° × 0.1° · Colour = rainfall intensity mm/hr</p>
      <GridMap gridData={gridData} />

      {/* ── All Time Steps table ── */}
      <div className="section-title">All 30-min Observations</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Time (IST)</th>
              <th>Regional Mean (mm/hr)</th>
              <th>Regional Max (mm/hr)</th>
              <th>Step Accum (mm)</th>
              <th>Rain 1h (mm)</th>
              <th>Rain 3h (mm)</th>
              <th>Rain 6h (mm)</th>
            </tr>
          </thead>
          <tbody>
            {timeseries.map((t, i) => {
              const r = rolling[i] || {};
              return (
                <tr
                  key={i}
                  className={i === selectedIdx ? "selected-row" : ""}
                  onClick={() => setSelectedIdx(i)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{i + 1}</td>
                  <td>{displayIST(t.timestamp_ist)}</td>
                  <td>{t.meanPrecip_mmhr}</td>
                  <td>{t.maxPrecip_mmhr}</td>
                  <td>{t.accum_30m_mm}</td>
                  <td>{r.rain_1h_mm  ?? "—"}</td>
                  <td>{r.rain_3h_mm  ?? "—"}</td>
                  <td>{r.rain_6h_mm  ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Validation / Debug ── */}
      {validation && (
        <div className="validation-wrap">
          <button className="collapsible" onClick={() => setShowValidation((v) => !v)}>
            {showValidation ? "▲" : "▼"} Data Validation &amp; Debug Info
          </button>
          {showValidation && (
            <div className="validation-body">
              <table className="val-table">
                <tbody>
                  <tr><td>NASA Product</td><td>{validation.nasa_product}</td></tr>
                  <tr><td>Dataset Version</td><td>{validation.dataset_version}</td></tr>
                  <tr><td>Observations</td><td>{validation.observations}</td></tr>
                  <tr><td>First Observation (UTC)</td><td>{validation.first_utc}</td></tr>
                  <tr><td>Last Observation (UTC)</td><td>{validation.last_utc}</td></tr>
                  <tr><td>First Observation (IST)</td><td>{validation.first_ist}</td></tr>
                  <tr><td>Last Observation (IST)</td><td>{validation.last_ist}</td></tr>
                  <tr><td>Missing Time Steps</td><td>{validation.missing_step_count}</td></tr>
                  {validation.missing_steps.length > 0 && (
                    <tr><td>Gap Details</td><td>{validation.missing_steps.map((g, i) => (
                      <div key={i}>{g.after} → {g.before} ({g.gapMinutes} min)</div>
                    ))}</td></tr>
                  )}
                  <tr><td>30m history complete</td><td>{validation.history_complete["30m"] ? "Yes" : "No"}</td></tr>
                  <tr><td>1h history complete</td><td>{validation.history_complete["1h"]  ? "Yes" : "No"}</td></tr>
                  <tr><td>3h history complete</td><td>{validation.history_complete["3h"]  ? "Yes" : "No"}</td></tr>
                  <tr><td>6h history complete</td><td>{validation.history_complete["6h"]  ? "Yes" : "No"}</td></tr>
                  <tr><td>12h history complete</td><td>{validation.history_complete["12h"] ? "Yes" : "No"}</td></tr>
                  <tr><td>24h history complete</td><td>{validation.history_complete["24h"] ? "Yes" : "No"}</td></tr>
                </tbody>
              </table>
              <p className="note" style={{marginTop:8}}>
                Machine-readable features JSON: <code>GET /api/rainfall/features</code>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
