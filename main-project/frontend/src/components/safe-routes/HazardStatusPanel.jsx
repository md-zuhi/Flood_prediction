import React from "react";
import { AlertOctagon, ShieldAlert, AlertTriangle, Info, Clock, MapPin } from "lucide-react";

export default function HazardStatusPanel({ hazardZones = [], incidents = [], routingStatus }) {
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const safeHazardZones = Array.isArray(hazardZones) ? hazardZones : [];

  return (
    <div className="hazard-status-panel">
      <h4 className="panel-title">
        <ShieldAlert size={16} /> Reported Road Closures & Incidents
      </h4>

      {/* Incidents & Closures */}
      <div className="hazard-section">
        <h5 className="section-subtitle">TomTom Live Incidents & Road Blockages</h5>
        {safeIncidents.length === 0 ? (
          <div className="status-notice notice-info">
            <Info size={14} />
            <span>No provider-reported road closures or incidents along evaluated routes.</span>
          </div>
        ) : (
          safeIncidents.map((inc, i) => {
            const isClosure = inc.is_closure || inc.type === "ROAD_CLOSURE" || inc.road_closure_status === "REPORTED_CLOSURE";
            const isTestIncident = inc.source === "SIMULATED_TEST" || inc.verification_status === "TEST_ONLY";

            return (
              <div key={inc.id || `inc_${i}`} className="incident-card" style={{ borderLeft: isClosure ? "3px solid #ef4444" : "3px solid #f59e0b", padding: "10px", background: "var(--bg-secondary)", borderRadius: "6px", marginBottom: "8px" }}>
                <AlertOctagon size={18} className={isClosure ? "text-red-500" : "text-amber-500"} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div style={{ flex: 1, fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ color: isClosure ? "#ef4444" : "#f59e0b", fontSize: "13px" }}>
                      {isClosure ? "REPORTED ROAD CLOSURE" : inc.type || "TRAFFIC INCIDENT"}
                    </strong>
                    <span className={`status-pill ${isClosure ? "pill-red" : "pill-amber"}`}>
                      {inc.severity || (isClosure ? "SEVERE" : "MODERATE")}
                    </span>
                  </div>

                  {isTestIncident && (
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#b45309", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", margin: "4px 0", display: "inline-block" }}>
                      SIMULATED_TEST — NOT LIVE TOMTOM FEED
                    </div>
                  )}

                  <p style={{ margin: "4px 0 2px 0", color: "var(--text-primary)" }}>
                    <MapPin size={12} style={{ display: "inline", marginRight: "3px" }} />
                    <strong>Road:</strong> {inc.road_name || "Local Evacuation Segment"}
                  </p>

                  <p style={{ margin: "0 0 4px 0", color: "var(--text-secondary)" }}>
                    {inc.description || "Provider reported traffic blockage."}
                  </p>

                  <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "var(--text-secondary)" }}>
                    {inc.delay_seconds != null && (
                      <span><Clock size={11} style={{ display: "inline", marginRight: "2px" }} /> Delay: {Math.round(inc.delay_seconds / 60)} min</span>
                    )}
                    <span>Provider: {inc.source || "TomTom Live Traffic"}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Active Hazard Zones */}
      <div className="hazard-section" style={{ marginTop: "16px" }}>
        <h5 className="section-subtitle">Monitored Hazard Polygons</h5>
        {safeHazardZones.length === 0 ? (
          <div className="status-notice notice-info">
            <Info size={14} />
            <span>No active hazard buffers intersecting monitored evacuation area.</span>
          </div>
        ) : (
          safeHazardZones.map((hz, i) => (
            <div key={hz.id || `hz_${i}`} className="hazard-zone-card" style={{ padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: "6px", marginBottom: "6px" }}>
              <AlertTriangle size={16} className="text-amber-500" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: "12px" }}>
                <strong>{hz.type} ({hz.severity || "ACTIVE"})</strong>
                <p style={{ margin: "2px 0", color: "var(--text-secondary)" }}>{hz.label}</p>
                <span className="source-tag">Source: {hz.source}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

