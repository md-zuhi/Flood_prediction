import React from "react";

// --------------------------------------------------
// RiverStatusCard
// Displays:
//   - Station name, river, region
//   - Current level with threshold context bar
//   - Rate of rise + trend badge
//   - Risk state badge
//   - Notice depending on REAL vs DEMO data
// --------------------------------------------------

const RISK_COLORS = {
  NORMAL: { bg: "rgba(34,197,94,0.15)", border: "#22c55e", text: "#22c55e" },
  WATCH: { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", text: "#f59e0b" },
  WARNING: { bg: "rgba(249,115,22,0.2)", border: "#f97316", text: "#f97316" },
  HIGH: { bg: "rgba(239,68,68,0.2)", border: "#ef4444", text: "#ef4444" },
  CRITICAL: { bg: "rgba(239,68,68,0.35)", border: "#dc2626", text: "#fca5a5" },
  UNKNOWN: { bg: "rgba(100,116,139,0.15)", border: "#64748b", text: "#94a3b8" }
};

const TREND_STYLE = {
  RISING: { color: "#ef4444", icon: "↑" },
  FALLING: { color: "#22c55e", icon: "↓" },
  STABLE: { color: "#94a3b8", icon: "→" },
  UNKNOWN: { color: "#64748b", icon: "—" }
};

function ThresholdBar({ level, thresholds }) {
  if (!thresholds || level == null) return null;
  const max = thresholds.bankfull_m || thresholds.danger_m * 1.2;
  const pct = Math.min(100, (level / max) * 100);
  const warnPct = (thresholds.warning_m / max) * 100;
  const dangerPct = (thresholds.danger_m / max) * 100;

  let fillColor = "#22c55e";
  if (level >= thresholds.danger_m) fillColor = "#ef4444";
  else if (level >= thresholds.warning_m) fillColor = "#f97316";
  else if (level >= thresholds.warning_m * 0.8) fillColor = "#f59e0b";

  return (
    <div style={{ position: "relative", height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", margin: "8px 0 4px" }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: fillColor, borderRadius: "4px", transition: "width 0.6s ease" }} />
      {/* Warning marker */}
      <div style={{ position: "absolute", left: `${warnPct}%`, top: "-3px", width: "2px", height: "14px", background: "#f59e0b" }} title={`Warning: ${thresholds.warning_m}m`} />
      {/* Danger marker */}
      <div style={{ position: "absolute", left: `${dangerPct}%`, top: "-3px", width: "2px", height: "14px", background: "#ef4444" }} title={`Danger: ${thresholds.danger_m}m`} />
    </div>
  );
}

function RiverStatusCard({ station, currentData, riskData, selected, onClick }) {
  // Support both level_m (normalized) and current_level_m (backwards compatibility)
  const level = currentData ? (currentData.level_m !== undefined ? currentData.level_m : currentData.current_level_m) : null;
  const dataType = currentData?.data_type || "UNAVAILABLE";
  const thresholds = station?.thresholds;
  const risk = riskData?.risk_state || "UNKNOWN";
  const riskStyle = RISK_COLORS[risk] || RISK_COLORS.UNKNOWN;
  const rateInfo = riskData?.rate_m_per_hr;
  const trend = riskData?.trend || "UNKNOWN";
  const trendStyle = TREND_STYLE[trend] || TREND_STYLE.UNKNOWN;

  const isUnavailable = dataType === "UNAVAILABLE";

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(56,189,248,0.08)" : "rgba(15,23,42,0.7)",
        border: selected ? "1px solid #38bdf8" : `1px solid ${riskStyle.border}`,
        borderRadius: "12px",
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.25s ease",
        width: "280px",
        flexShrink: 0,
        margin: "0",
        backdropFilter: "blur(8px)",
        textAlign: "left"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", marginRight: "8px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{station.name}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{station.river} · {station.state}</div>
        </div>
        <span style={{
          fontSize: "10px", fontWeight: 700, padding: "2px 6px",
          background: riskStyle.bg, border: `1px solid ${riskStyle.border}`,
          borderRadius: "20px", color: riskStyle.text, flexShrink: 0
        }}>
          {isUnavailable ? "UNAVAILABLE" : risk}
        </span>
      </div>

      {/* Level */}
      {!isUnavailable && level != null ? (
        <>
          <div style={{ marginTop: "10px", display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "-1px" }}>
              {level.toFixed(2)}
            </span>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>m</span>
            <span style={{ marginLeft: "auto", fontSize: "13px", color: trendStyle.color, fontWeight: 700 }}>
              {trendStyle.icon} {trend}
            </span>
          </div>

          <ThresholdBar level={level} thresholds={thresholds} />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b" }}>
            <span>Warning: {thresholds?.warning_m}m</span>
            <span>Danger: {thresholds?.danger_m}m</span>
          </div>

          {/* Rate of rise */}
          {rateInfo != null && (
            <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
              Rate: <span style={{ color: trendStyle.color, fontWeight: 600 }}>
                {rateInfo >= 0 ? "+" : ""}{rateInfo.toFixed(3)} m/hr
              </span>
            </div>
          )}

          {/* DEMO notice */}
          <div style={{ marginTop: "8px", fontSize: "9px", color: "rgba(245,158,11,0.9)", fontWeight: 600 }}>
            ⚠ DEMO / SIMULATED DATA
          </div>
        </>
      ) : (
        <div style={{ marginTop: "14px", padding: "12px 6px" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
            🔴 Real Data Unavailable
          </div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>
            Requires CWC telemetry auth keys
          </div>
        </div>
      )}
    </div>
  );
}

export default RiverStatusCard;
