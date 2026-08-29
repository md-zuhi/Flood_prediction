import React from "react";
import {
  AlertOctagon,
  VolumeX,
  Bell,
  Trash2,
  MapPin,
  Clock,
  ShieldAlert,
  Droplets,
  CloudRain,
  Compass,
  Thermometer,
  Zap,
} from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";

/**
 * Renders the circular SVG risk score gauge.
 */
function CircularRiskGauge({ probability, riskColor }) {
  const radius = 70;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, probability)) / 100) * circumference;

  return (
    <div style={{ position: "relative", width: "180px", height: "180px", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }}>
        {/* Background track circle */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Color-coded risk level ring */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="transparent"
          stroke={riskColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease-out, stroke 0.4s ease" }}
        />
      </svg>
      {/* Center text overlay */}
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: "36px", fontWeight: 800, color: "#f8fafc", lineHeight: 1 }}>{probability}%</div>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>
          Flood Risk
        </div>
      </div>
    </div>
  );
}

function AlertsDashboard({
  activeAlert,
  isAlarmPlaying,
  isAcknowledged,
  onAcknowledge,
  onTriggerTestAlert,
  alertHistory,
  onClearHistory,
  locations,
  selectedLocation,
  onLocationChange,
  loading,
  theme,
  onToggleTheme
}) {

  // Helper to determine the text color and background color based on severity/risk_level
  const getSeverityBadgeStyle = (severity = "UNKNOWN") => {
    const sev = severity.toUpperCase();
    if (sev.startsWith("CRITICAL")) {
      return { bg: "rgba(239, 68, 68, 0.2)", border: "#ef4444", text: "#fca5a5" };
    }
    if (sev.startsWith("HIGH")) {
      return { bg: "rgba(249, 115, 22, 0.2)", border: "#f97316", text: "#fed7aa" };
    }
    if (sev.startsWith("MODERATE")) {
      return { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#fef08a" };
    }
    return { bg: "rgba(34, 197, 94, 0.15)", border: "#22c55e", text: "#bbf7d0" };
  };

  const activeBadge = activeAlert ? getSeverityBadgeStyle(activeAlert.severity) : null;

  return (
    <div className="main-content">
      <DashboardHeader
        selectedLocation={selectedLocation}
        locations={locations}
        onLocationChange={onLocationChange}
        loading={loading}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <div style={{ padding: "0 24px 24px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        
        {/* MAIN COMMAND-CENTER GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }} className="alerts-dashboard-grid">
          
          {/* LEFT PANEL: ACTIVE EMERGENCY ALARM CONTAINER */}
          <div 
            className={`card ${activeAlert && isAlarmPlaying ? "emergency-pulse-border" : ""}`}
            style={{
              background: activeAlert
                ? "linear-gradient(135deg, rgba(239, 68, 68, 0.07) 0%, rgba(15, 23, 42, 0.8) 100%)"
                : "rgba(15, 23, 42, 0.6)",
              border: activeAlert && isAlarmPlaying 
                ? "1px solid rgba(239, 68, 68, 0.5)" 
                : "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              padding: "24px",
              backdropFilter: "blur(12px)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
                  🔴 System Status Room
                </span>
                {activeAlert && (
                  <span style={{
                    fontSize: "11px", fontWeight: 700, padding: "3px 8px",
                    borderRadius: "6px", border: `1px solid ${activeBadge.border}`,
                    background: activeBadge.bg, color: activeBadge.text
                  }}>
                    {activeAlert.isDemo ? "DEMO TEST" : activeAlert.severity} ALERT
                  </span>
                )}
              </div>

              {activeAlert ? (
                <>
                  <CircularRiskGauge 
                    probability={activeAlert.probability} 
                    riskColor={activeBadge.border} 
                  />

                  <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#f8fafc", margin: "16px 0 8px" }}>
                    {activeAlert.isDemo ? "🚨 DEMO EMERGENCY SIGNAL" : "🚨 ACTIVE FLOOD ALARM"}
                  </h2>

                  <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.6", margin: "0 auto 20px", maxWidth: "440px" }}>
                    {activeAlert.message}
                  </p>

                  <div style={{ background: "rgba(0, 0, 0, 0.25)", borderRadius: "8px", padding: "12px 16px", margin: "0 auto 20px", maxWidth: "440px", textAlign: "left" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase" }}>
                      Threat Metadata
                    </div>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px", color: "#cbd5e1" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={14} style={{ color: "#38bdf8" }} />
                        <strong>{activeAlert.location}</strong>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={14} style={{ color: "#38bdf8" }} />
                        <span>{new Date(activeAlert.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    {activeAlert.sms && (
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "12px", color: "#cbd5e1" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ color: "#64748b" }}>Provider:</span>
                          <span style={{ fontWeight: 700, color: "#38bdf8" }}>{activeAlert.sms.provider?.toUpperCase()}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ color: "#64748b" }}>Status:</span>
                          <span style={{
                            fontWeight: 800,
                            color: activeAlert.sms.status === "ACCEPTED" ? "#22c55e" : activeAlert.sms.status === "SIMULATED" ? "#38bdf8" : "#ef4444"
                          }}>{activeAlert.sms.status}</span>
                        </div>
                        {activeAlert.sms.phoneMasked && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ color: "#64748b" }}>Recipient:</span>
                            <span style={{ fontFamily: "monospace" }}>{activeAlert.sms.phoneMasked}</span>
                          </div>
                        )}
                        {activeAlert.sms.requestId && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ color: "#64748b" }}>Request ID:</span>
                            <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{activeAlert.sms.requestId}</span>
                          </div>
                        )}
                        {activeAlert.sms.error && (
                          <div style={{ color: "#ef4444", marginTop: "6px", fontSize: "11px", lineHeight: "1.4" }}>
                            <strong>Error:</strong> {activeAlert.sms.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ padding: "60px 0" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>🟢</div>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#94a3b8" }}>No Active Alarm</h3>
                  <p style={{ fontSize: "13px", color: "#475569", maxWidth: "300px", margin: "8px auto 0" }}>
                    All local telemetry systems reporting normal water heights and soil absorbing capacity.
                  </p>
                </div>
              )}
            </div>

            {activeAlert && (
              <div style={{ marginTop: "16px" }}>
                {isAlarmPlaying ? (
                  <button
                    onClick={onAcknowledge}
                    className="emergency-silence-btn"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#ef4444",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)",
                      animation: "pulseRedButton 1.5s infinite"
                    }}
                  >
                    <VolumeX size={18} />
                    <span>STOP ALARM / ACKNOWLEDGE</span>
                  </button>
                ) : (
                  <div style={{
                    padding: "14px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                    color: "#64748b", fontSize: "13px", fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                  }}>
                    <span>✓ Alert Acknowledged & Silenced</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: TRIGGER REASONS & DEMO TESTING CONTROLS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* CARD 1: contributing trigger factors */}
            <div className="card" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "20px", textAlign: "left" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc", margin: "0 0 16px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldAlert size={16} style={{ color: "#ef4444" }} />
                Trigger Analysis & Factors
              </h3>

              {activeAlert && activeAlert.triggerReasons && activeAlert.triggerReasons.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {activeAlert.triggerReasons.map((reason, i) => {
                    // Match icons to reason content
                    let IconComponent = Zap;
                    let iconColor = "#ef4444";
                    if (reason.toLowerCase().includes("rainfall") || reason.toLowerCase().includes("precipitation")) {
                      IconComponent = CloudRain;
                      iconColor = "#38bdf8";
                    } else if (reason.toLowerCase().includes("soil")) {
                      IconComponent = Droplets;
                      iconColor = "#a78bfa";
                    } else if (reason.toLowerCase().includes("slope") || reason.toLowerCase().includes("elevation")) {
                      IconComponent = Compass;
                      iconColor = "#fb923c";
                    } else if (reason.toLowerCase().includes("demo") || reason.toLowerCase().includes("simulated")) {
                      IconComponent = Thermometer;
                      iconColor = "#ec4899";
                    }

                    return (
                      <li key={i} style={{ display: "flex", gap: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "8px", padding: "12px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <IconComponent size={16} style={{ color: iconColor }} />
                        </div>
                        <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.4" }}>{reason}</div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div style={{ padding: "24px", textAlign: "center", color: "#475569", fontSize: "13px" }}>
                  Select an active warning or trigger a test signal to view contributing environmental factors.
                </div>
              )}
            </div>

            {/* CARD 2: hackathon demo test alert trigger panel */}
            <div className="card" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "20px", textAlign: "left" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fb923c", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={16} />
                Hackathon Demo Center
              </h3>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                Simulate a high-severity emergency condition to trigger the wailing browser alarm, pulsing warnings, and dashboard status elements instantly.
              </p>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={onTriggerTestAlert}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(234, 88, 12, 0.25)"
                  }}
                >
                  ⚠ Send Test Alert (HIGH)
                </button>
                <button
                  type="button"
                  onClick={onClearHistory}
                  disabled={alertHistory.length === 0}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "transparent",
                    color: alertHistory.length === 0 ? "#475569" : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: alertHistory.length === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Trash2 size={14} />
                  Clear Logs
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM ROW: HISTORICAL ALERT LOG TABLE */}
        <div className="card" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "16px", padding: "20px", marginTop: "24px", textAlign: "left" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={16} style={{ color: "#38bdf8" }} />
            Emergency Alerts History Logs
          </h3>

          <div style={{ overflowX: "auto" }}>
            {alertHistory.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#cbd5e1" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#64748b", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Timestamp</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Location</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Risk Index</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Severity</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Type</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Trigger Reason Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {alertHistory.map((log, idx) => {
                    const rowBadge = getSeverityBadgeStyle(log.severity);
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.2s" }} className="alert-history-row">
                        <td style={{ padding: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", fontWeight: 700 }}>
                          {log.location}
                        </td>
                        <td style={{ padding: "12px", fontWeight: 700, color: rowBadge.border }}>
                          {log.probability}%
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span style={{
                            fontSize: "10px", fontWeight: 700, padding: "2px 6px",
                            borderRadius: "4px", border: `1px solid ${rowBadge.border}`,
                            background: rowBadge.bg, color: rowBadge.text
                          }}>
                            {log.severity}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: log.isDemo ? "#fb923c" : "#38bdf8", fontWeight: 600 }}>
                          {log.isDemo ? "DEMO TEST" : "ML SYSTEM"}
                        </td>
                        <td style={{ padding: "12px", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "320px" }}>
                          {log.triggerReasons ? log.triggerReasons.join(" | ") : log.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "#475569" }}>
                No past warnings logged.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default AlertsDashboard;
