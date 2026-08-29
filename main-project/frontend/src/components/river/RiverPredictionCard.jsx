import React from "react";

// --------------------------------------------------
// RiverPredictionCard
// Shows:
//   - Rate of rise (m/hr) with confidence note
//   - Trend classification
//   - Time-to-warning (only when rising + below warning)
//   - +1h / +3h / +6h baseline projections
//   - Clearly labeled as "Baseline trend projection — NOT ML"
// --------------------------------------------------

const TREND_STYLE = {
  RISING: { color: "#ef4444", icon: "↑ Rising" },
  FALLING: { color: "#22c55e", icon: "↓ Falling" },
  STABLE: { color: "#94a3b8", icon: "→ Stable" },
  UNKNOWN: { color: "#64748b", icon: "— Unknown" }
};

function ProjectionRow({ label, value_m, thresholds }) {
  if (value_m == null) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: "12px", color: "#64748b" }}>{label}</span>
        <span style={{ fontSize: "12px", color: "#475569" }}>—</span>
      </div>
    );
  }

  const atWarning = thresholds && value_m >= thresholds.warning_m;
  const atDanger = thresholds && value_m >= thresholds.danger_m;
  let color = "#e2e8f0";
  if (atDanger) color = "#ef4444";
  else if (atWarning) color = "#f59e0b";

  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color }}>
        {value_m.toFixed(2)} m {atDanger ? "🔴" : atWarning ? "⚠" : ""}
      </span>
    </div>
  );
}

function RiverPredictionCard({ prediction, thresholds }) {
  if (!prediction) {
    return (
      <div style={{ background: "rgba(15,23,42,0.6)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: "12px", color: "#64748b" }}>Loading prediction…</div>
      </div>
    );
  }

  const rate = prediction.rate_of_rise || {};
  const proj = prediction.projections || {};
  const ttw = prediction.time_to_warning || {};
  const trendStyle = TREND_STYLE[rate.trend] || TREND_STYLE.UNKNOWN;

  return (
    <div style={{
      background: "rgba(15,23,42,0.6)",
      borderRadius: "12px",
      padding: "16px",
      border: "1px solid rgba(255,255,255,0.06)",
      backdropFilter: "blur(8px)"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Trend Predictions
        </div>
        <span style={{
          fontSize: "10px", background: "rgba(167,139,250,0.15)",
          border: "1px solid #7c3aed", color: "#a78bfa",
          padding: "2px 8px", borderRadius: "20px", fontWeight: 600
        }}>
          NOT ML
        </span>
      </div>

      {/* Rate & Trend */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px" }}>
          <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "4px" }}>Rate of Rise</div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: trendStyle.color }}>
            {rate.rate_m_per_hr != null
              ? `${rate.rate_m_per_hr >= 0 ? "+" : ""}${rate.rate_m_per_hr.toFixed(3)}`
              : "—"}
          </div>
          <div style={{ fontSize: "10px", color: "#64748b" }}>m/hr</div>
        </div>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px" }}>
          <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "4px" }}>Trend</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: trendStyle.color }}>
            {trendStyle.icon}
          </div>
          <div style={{ fontSize: "10px", color: "#475569" }}>
            {rate.samples_used ?? "—"} samples
            {rate.irregular_intervals ? " (irregular)" : ""}
          </div>
        </div>
      </div>

      {/* Time to Warning */}
      <div style={{
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: "8px", padding: "10px", marginBottom: "12px"
      }}>
        <div style={{ fontSize: "10px", color: "#f59e0b", fontWeight: 600, marginBottom: "4px" }}>
          ⏱ Time to Warning (trend-based estimate)
        </div>
        <div style={{ fontSize: "13px", color: "#e2e8f0" }}>
          {ttw.label || "Insufficient data for estimate"}
        </div>
      </div>

      {/* Projections */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "6px", fontWeight: 600 }}>
          {proj.label || "Baseline trend projection — NOT ML"}
        </div>
        <ProjectionRow label="+1 hour" value_m={proj.plus_1h_m} thresholds={thresholds} />
        <ProjectionRow label="+3 hours" value_m={proj.plus_3h_m} thresholds={thresholds} />
        <ProjectionRow label="+6 hours" value_m={proj.plus_6h_m} thresholds={thresholds} />
      </div>

      <div style={{ fontSize: "10px", color: "rgba(100,116,139,0.7)", marginTop: "8px" }}>
        {proj.confidence || ""}
      </div>

      {/* DEMO notice */}
      <div style={{ marginTop: "10px", fontSize: "9px", color: "rgba(239,68,68,0.7)", fontWeight: 600 }}>
        ⚠ DEMO / SIMULATED DATA — inputs from simulated gauge
      </div>
    </div>
  );
}

export default RiverPredictionCard;
