import React from "react";
import { Navigation, Clock, ShieldCheck, AlertTriangle, AlertOctagon, Car } from "lucide-react";

export default function RouteAlternatives({
  recommendedRoute,
  alternativeRoutes = [],
  selectedRouteId,
  onSelectRoute
}) {
  const safeAlternatives = Array.isArray(alternativeRoutes) ? alternativeRoutes : [];

  const allRoutes = [
    ...(recommendedRoute ? [{ ...recommendedRoute, tag: "RECOMMENDED", isSafest: true }] : []),
    ...safeAlternatives.map((r, i) => ({ ...r, tag: `ALT ${i + 1}`, isSafest: false }))
  ];

  const getClassificationBadgeClass = (riskClass) => {
    if (riskClass === "AVOID" || riskClass === "HIGH RISK") return "pill-red";
    if (riskClass === "USE CAUTION") return "pill-amber";
    return "pill-green";
  };

  return (
    <div className="route-alternatives-panel">
      <h4 className="panel-title">
        <Navigation size={16} /> Evacuation Route Options ({allRoutes.length})
      </h4>

      {safeAlternatives.length === 0 && recommendedRoute && (
        <div className="status-notice notice-info" style={{ marginBottom: "12px", background: "var(--bg-secondary)", color: "var(--text-secondary)", fontSize: "12px", padding: "8px 12px", borderRadius: "6px" }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, color: "#f59e0b" }} />
          <span>No alternative route returned by routing provider.</span>
        </div>
      )}

      <div className="alternatives-list">
        {allRoutes.map((rt) => {
          const isSelected = selectedRouteId === rt.route_id;
          const closures = rt.incidents?.closures_count ?? rt.closures_count ?? 0;
          const totalIncidents = rt.incidents?.total_count ?? rt.total_incidents_count ?? 0;
          const trafficEta = rt.tomtom_traffic_eta_minutes || rt.eta_minutes;

          return (
            <div
              key={rt.route_id}
              className={`alt-route-card ${isSelected ? "active-route" : ""}`}
              onClick={() => onSelectRoute(rt.route_id)}
              style={{
                borderLeft: isSelected
                  ? "4px solid #2563eb"
                  : rt.isSafest
                  ? "4px solid #10b981"
                  : "4px solid var(--border-color)",
                background: isSelected ? "rgba(37, 99, 235, 0.08)" : "var(--bg-secondary)"
              }}
            >
              <div className="alt-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className={`tag-pill ${rt.isSafest ? "tag-safest" : "tag-alt"}`} style={{ padding: "2px 8px", borderRadius: "4px", fontWeight: "800", fontSize: "10px" }}>
                    {rt.tag}
                  </span>
                  <span className={`status-pill ${getClassificationBadgeClass(rt.risk_classification)}`}>
                    {rt.risk_classification || "LOWER RISK"}
                  </span>
                </div>
                <span className="alt-score" style={{ fontWeight: "800", fontSize: "14px", color: rt.safety_score >= 80 ? "#10b981" : rt.safety_score >= 60 ? "#f59e0b" : "#ef4444" }}>
                  {rt.safety_score != null ? `${rt.safety_score}/100` : "N/A"}
                </span>
              </div>

              <div className="alt-card-body">
                <div className="alt-destination" style={{ fontWeight: "600", fontSize: "13px", color: "var(--text-primary)" }}>
                  {rt.name || rt.destination?.name || "Evacuation Route"} ({rt.provider || "Mappls"})
                </div>

                <div className="alt-stats" style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  <span><Clock size={11} style={{ display: "inline", marginRight: "2px" }} /> {rt.mappls_eta_minutes || rt.eta_minutes} min</span>
                  <span>•</span>
                  <span><Car size={11} style={{ display: "inline", marginRight: "2px" }} /> Traffic: {trafficEta} min</span>
                  <span>•</span>
                  <span>{rt.distance_km} km</span>
                  <span>•</span>
                  <span>Flood: {rt.environmental_summary?.max_flood_probability != null ? `${Math.round(rt.environmental_summary.max_flood_probability)}%` : rt.flood_exposure || "LOW"}</span>
                </div>

                {closures > 0 && (
                  <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                    <AlertOctagon size={12} /> {closures} REPORTED ROAD CLOSURE(S)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

