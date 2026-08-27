import React from "react";
import { ShieldCheck, CheckCircle2, MapPin, Clock, Gauge, Car, Info, ShieldAlert, Award, AlertTriangle, Layers, CloudRain, Mountain, AlertOctagon } from "lucide-react";

export default function RouteSummaryPanel({ route, destination, generatedAt, routingProvider, routingMode }) {
  if (!route || !destination) {
    return (
      <div className="route-panel empty-panel" style={{ padding: "30px", textAlign: "center", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <AlertTriangle size={36} color="#f59e0b" style={{ margin: "0 auto 12px" }} />
        <h3 style={{ color: "var(--text-primary)", margin: "0 0 6px 0" }}>Evacuation Route Analysis Pending</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
          Select a location and click "Recalculate Route" to analyze emergency evacuation options.
        </p>
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score == null) return "#9ca3af";
    if (score >= 80) return "#10b981"; // Emerald Green
    if (score >= 60) return "#eab308"; // Amber / Yellow
    if (score >= 40) return "#f97316"; // Orange
    return "#ef4444"; // Red
  };

  const routeScoreColor = getScoreColor(route.safety_score);
  const destScoreColor = getScoreColor(destination.destination_safety_score);
  const isOfficial = destination.verification_status === "VERIFIED_OFFICIAL";

  const envSummary = route.environmental_summary || {};
  const maxFloodProb = envSummary.max_flood_probability != null ? `${Math.round(envSummary.max_flood_probability)}%` : route.max_flood_probability != null ? `${Math.round(route.max_flood_probability)}%` : "N/A";
  const avgFloodProb = envSummary.average_flood_probability != null ? `${Math.round(envSummary.average_flood_probability * 10) / 10}%` : route.average_flood_probability != null ? `${Math.round(route.average_flood_probability * 10) / 10}%` : "N/A";
  const sampleCount = envSummary.sample_count || route.sample_count || (envSummary.samples ? envSummary.samples.length : null) || "N/A";

  const closuresCount = route.incidents?.closures_count ?? route.closures_count ?? 0;
  const totalIncidentsCount = route.incidents?.total_count ?? route.total_incidents_count ?? 0;
  const accidentsCount = route.incidents?.accidents_count ?? 0;
  const roadworksCount = route.incidents?.roadworks_count ?? 0;

  return (
    <div className="route-summary-panel">
      {/* Header */}
      <div className="summary-header">
        <div className="badge-recommended">
          <ShieldCheck size={16} />
          <span>RECOMMENDED LOWER-RISK ROUTE</span>
        </div>
        <span className="last-updated">Updated: {generatedAt ? new Date(generatedAt).toLocaleTimeString() : "Live"}</span>
      </div>

      {/* Recommended Destination Banner */}
      <div className="destination-banner" style={{ borderLeft: isOfficial ? "4px solid #10b981" : "4px solid #f59e0b", background: "var(--bg-secondary)", padding: "14px", borderRadius: "8px" }}>
        <MapPin size={26} className="dest-icon" style={{ color: isOfficial ? "#10b981" : "#f59e0b", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h2 className="dest-name" style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>{destination.name}</h2>
            {destination.destination_safety_score != null ? (
              <div style={{ textAlign: "right", marginLeft: "10px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", display: "block" }}>Dest Safety</span>
                <span style={{ fontSize: "18px", fontWeight: "800", color: destScoreColor }}>
                  {destination.destination_safety_score}/100
                </span>
              </div>
            ) : (
              <div style={{ textAlign: "right", marginLeft: "10px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", display: "block" }}>Dest Safety</span>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#9ca3af" }}>
                  UNAVAILABLE
                </span>
              </div>
            )}
          </div>

          <div className="dest-type" style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {isOfficial ? (
              <span className="badge-official" style={{ background: "#065f46", color: "#a7f3d0", padding: "3px 8px", borderRadius: "4px", fontWeight: "700", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Award size={13} /> VERIFIED OFFICIAL SHELTER
              </span>
            ) : (
              <span className="badge-unverified" style={{ background: "#78350f", color: "#fde68a", padding: "3px 8px", borderRadius: "4px", fontWeight: "700", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <ShieldAlert size={13} /> POTENTIAL SAFE FACILITY (UNVERIFIED)
              </span>
            )}
            <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              {destination.classification || "Evacuation Shelter"}
            </span>
          </div>

          {/* Destination Metadata */}
          <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 12px", fontSize: "12px", color: "var(--text-primary)", background: "var(--bg-card)", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
            <div><strong>Authority:</strong> {destination.authority || "N/A"}</div>
            <div><strong>Source:</strong> {destination.source_document || destination.source || "N/A"}</div>
            <div><strong>Flood Risk:</strong> <span style={{ color: destination.flood_risk === "HIGH" ? "#ef4444" : destination.flood_risk === "MODERATE" ? "#f59e0b" : destination.flood_risk === "LOW" ? "#10b981" : "#9ca3af" }}>{destination.flood_risk || "UNKNOWN"}</span></div>
            <div><strong>Landslide Risk:</strong> <span style={{ color: destination.landslide_risk === "HIGH" ? "#ef4444" : destination.landslide_risk === "MODERATE" ? "#f59e0b" : destination.landslide_risk === "LOW" ? "#10b981" : "#9ca3af" }}>{destination.landslide_risk || "UNKNOWN"}</span></div>
            <div><strong>Elevation:</strong> {destination.elevation_m != null ? `${destination.elevation_m} m` : "N/A"}</div>
            <div><strong>Distance:</strong> {destination.distance_km != null ? `${destination.distance_km} km` : `${route.distance_km} km`}</div>
          </div>
        </div>
      </div>

      {/* Primary Route Metrics Grid */}
      <div className="metrics-grid" style={{ marginTop: "16px" }}>
        <div className="metric-card">
          <div className="metric-label"><ShieldCheck size={14} /> Route Safety Score</div>
          <div className="metric-value" style={{ color: routeScoreColor }}>
            {route.safety_score != null ? route.safety_score : "N/A"} <span className="unit">/100</span>
          </div>
          <div className="metric-sub font-semibold" style={{ color: routeScoreColor }}>
            {route.risk_classification || "LOWER RISK"}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label"><Clock size={14} /> Mappls ETA</div>
          <div className="metric-value">{route.mappls_eta_minutes || route.eta_minutes || "N/A"} <span className="unit">min</span></div>
          <div className="metric-sub">Distance: {route.distance_km} km</div>
        </div>

        <div className="metric-card">
          <div className="metric-label"><Car size={14} /> TomTom Traffic ETA</div>
          <div className="metric-value text-sky-400">
            {route.tomtom_traffic_eta_minutes || route.eta_minutes || "N/A"} <span className="unit">min</span>
          </div>
          <div className="metric-sub">
            {route.traffic_delay_seconds > 0 ? `+${Math.round(route.traffic_delay_seconds / 60)} min delay` : "No traffic delay"}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label"><Gauge size={14} /> Data Confidence</div>
          <div className="metric-value confidence-tag">{route.overall_data_confidence || route.confidence || "HIGH"}</div>
          <div className="metric-sub">Coverage: {route.overall_data_coverage != null ? `${route.overall_data_coverage}%` : route.data_coverage_percent != null ? `${route.data_coverage_percent}%` : "N/A"}</div>
        </div>
      </div>

      {/* TomTom Traffic & Incidents Summary */}
      <div className="exposure-breakdown">
        <h4><AlertOctagon size={14} style={{ display: "inline", marginRight: "6px" }} /> TomTom Traffic & Incident Status</h4>
        <div className="exposure-rows">
          <div className="exposure-row">
            <span>Reported Road Closures</span>
            <span className={`status-pill ${closuresCount > 0 ? "pill-red" : "pill-green"}`}>
              {closuresCount > 0 ? `${closuresCount} REPORTED ROAD CLOSURE(S)` : "0 Reported Closures"}
            </span>
          </div>
          <div className="exposure-row">
            <span>Reported Incidents / Roadworks</span>
            <span className="status-pill pill-blue">
              {totalIncidentsCount} Total ({accidentsCount} Accidents, {roadworksCount} Roadworks)
            </span>
          </div>
          <div className="exposure-row">
            <span>Traffic Delay</span>
            <span className="status-pill pill-cyan">
              {route.traffic_delay_seconds > 0 ? `${Math.round(route.traffic_delay_seconds / 60)} min delay` : "0 sec delay"}
            </span>
          </div>
        </div>
      </div>

      {/* Route Environmental Hazard Sampling Summary */}
      <div className="exposure-breakdown">
        <h4><CloudRain size={14} style={{ display: "inline", marginRight: "6px" }} /> Route Hazard Exposure (Environmental Sampling)</h4>
        <div className="exposure-rows">
          <div className="exposure-row">
            <span>Max Route Flood Probability</span>
            <span className={`status-pill ${maxFloodProb !== "N/A" && parseInt(maxFloodProb) >= 60 ? "pill-red" : maxFloodProb !== "N/A" && parseInt(maxFloodProb) >= 40 ? "pill-amber" : "pill-green"}`}>
              {maxFloodProb}
            </span>
          </div>
          <div className="exposure-row">
            <span>Average Route Flood Probability</span>
            <span className="status-pill pill-blue">{avgFloodProb}</span>
          </div>
          <div className="exposure-row">
            <span>Landslide Exposure</span>
            <span className={`status-pill ${route.landslide_exposure === "HIGH" ? "pill-red" : route.landslide_exposure === "MODERATE" ? "pill-amber" : route.landslide_exposure === "LOW" ? "pill-green" : "pill-blue"}`}>
              {route.landslide_exposure || "UNKNOWN"}
            </span>
          </div>
          <div className="exposure-row">
            <span>Route Environmental Sample Points</span>
            <span className="status-pill pill-blue"><Layers size={11} style={{ display: "inline", marginRight: "3px" }} /> {sampleCount} Points Evaluated</span>
          </div>
        </div>
      </div>

      {/* Why This Route Section */}
      <div className="why-route-section">
        <h4><ShieldCheck size={14} style={{ display: "inline", marginRight: "6px" }} /> Why this route was selected</h4>
        <ul className="reasons-list">
          {Array.isArray(route.reasons) && route.reasons.length > 0 ? (
            route.reasons.map((reason, idx) => (
              <li key={idx} className="reason-item">
                <CheckCircle2 size={16} className="check-icon" />
                <span>{reason}</span>
              </li>
            ))
          ) : (
            <>
              {isOfficial && (
                <li className="reason-item">
                  <CheckCircle2 size={16} className="check-icon" />
                  <span>Official DDMP 2026 shelter with precise POI/building-level coordinates</span>
                </li>
              )}
              {closuresCount === 0 && (
                <li className="reason-item">
                  <CheckCircle2 size={16} className="check-icon" />
                  <span>No provider-reported closures intersect this evacuation route</span>
                </li>
              )}
              <li className="reason-item">
                <CheckCircle2 size={16} className="check-icon" />
                <span>Lowest combined destination hazard score and route environmental exposure</span>
              </li>
            </>
          )}
        </ul>
      </div>

      <div className="provider-disclaimer-note" style={{ marginTop: "14px", fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: "6px" }}>
        <Info size={13} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
        Recommended lower-risk evacuation route based on latest available routing, traffic, environmental, hazard and official shelter data. Physical conditions may change rapidly during emergencies. Follow official evacuation instructions.
      </div>
    </div>
  );
}

