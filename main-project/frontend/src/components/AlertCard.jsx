import React from "react";

function AlertCard({ riskLevel, alertMessage, riskColor, timestamp }) {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "N/A";

  const getAlertTitle = (level) => {
    switch (level) {
      case "LOW":
        return "LOW RISK STATUS";
      case "MODERATE":
        return "MODERATE RISK ADVISORY";
      case "HIGH":
        return "HIGH RISK FLOOD ALERT";
      case "CRITICAL":
        return "CRITICAL RISK EMERGENCY ALERT";
      default:
        return "UNKNOWN RISK STATUS";
    }
  };

  return (
    <div className="card alert-card" style={{ borderLeft: `4px solid ${riskColor}` }}>
      <h3 className="card-title">Current Alert</h3>

      <div className="alert-content">
        <h4 className="alert-heading" style={{ color: riskColor }}>
          {getAlertTitle(riskLevel)}
        </h4>
        <p className="alert-message">{alertMessage || "No active warning messages available."}</p>
      </div>

      <div className="alert-footer">
        <div className="status-indicator">
          <span className="pulse-dot" style={{ backgroundColor: riskColor }}></span>
          <span className="safe-notice">Stay Alert. Stay Safe.</span>
        </div>
        <div className="timestamp-group">
          <span className="timestamp-label">Generated:</span>
          <span className="timestamp-value">{formattedTime}</span>
        </div>
      </div>
    </div>
  );
}

export default AlertCard;
