import React, { useEffect, useRef } from "react";

// --------------------------------------------------
// RiverAlertCard
// Displays active river alerts with toast + persistent
// card behavior.
//
// Props:
//   alerts: Array of alert objects from /api/rivers/:id/risk
//   onDismiss: (index) => void  - dismiss a persistent alert
// --------------------------------------------------

const SEVERITY_STYLE = {
  CRITICAL: {
    bg: "rgba(239,68,68,0.18)",
    border: "#dc2626",
    iconBg: "#7f1d1d",
    icon: "🔴",
    textColor: "#fca5a5",
    label: "CRITICAL"
  },
  WARNING: {
    bg: "rgba(249,115,22,0.15)",
    border: "#f97316",
    iconBg: "#431407",
    icon: "⚠",
    textColor: "#fed7aa",
    label: "WARNING"
  },
  HIGH: {
    bg: "rgba(239,68,68,0.12)",
    border: "#ef4444",
    iconBg: "#450a0a",
    icon: "↑",
    textColor: "#fca5a5",
    label: "HIGH"
  },
  WATCH: {
    bg: "rgba(245,158,11,0.12)",
    border: "#f59e0b",
    iconBg: "#451a03",
    icon: "👁",
    textColor: "#fde68a",
    label: "WATCH"
  },
  INFO: {
    bg: "rgba(56,189,248,0.1)",
    border: "#38bdf8",
    iconBg: "#082f49",
    icon: "ℹ",
    textColor: "#bae6fd",
    label: "INFO"
  }
};

function AlertItem({ alert, index, onDismiss }) {
  const style = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.INFO;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: "10px",
        padding: "12px 14px",
        marginBottom: "8px",
        position: "relative",
        animation: "riverAlertIn 0.35s ease"
      }}
    >
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%",
        background: style.iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "14px", flexShrink: 0
      }}>
        {style.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span style={{
            fontSize: "10px", fontWeight: 700, color: style.textColor,
            background: `${style.border}22`, padding: "1px 7px",
            borderRadius: "20px", border: `1px solid ${style.border}`
          }}>
            {style.label}
          </span>
          <span style={{ fontSize: "10px", color: "#475569" }}>
            {new Date(alert.timestamp_iso).toLocaleTimeString()}
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: "1.5" }}>
          {alert.message}
        </div>
        <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>
          {alert.type.replace(/_/g, " ")}
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(index)}
          aria-label="Dismiss alert"
          style={{
            position: "absolute", top: "8px", right: "8px",
            background: "none", border: "none", color: "#475569",
            cursor: "pointer", fontSize: "14px", padding: "0"
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function RiverAlertCard({ alerts, onDismiss }) {
  const prevCountRef = useRef(0);

  useEffect(() => {
    prevCountRef.current = alerts?.length || 0;
  }, [alerts]);

  if (!alerts || alerts.length === 0) {
    return (
      <div style={{
        background: "rgba(34,197,94,0.07)",
        border: "1px solid rgba(34,197,94,0.25)",
        borderRadius: "12px", padding: "14px 16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>✅</span>
          <span style={{ fontSize: "13px", color: "#86efac", fontWeight: 600 }}>
            No active alerts
          </span>
        </div>
        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
          All river levels within normal parameters (DEMO data)
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Active Alerts ({alerts.length})
      </div>
      {alerts.map((alert, idx) => (
        <AlertItem key={`${alert.type}-${idx}`} alert={alert} index={idx} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default RiverAlertCard;
