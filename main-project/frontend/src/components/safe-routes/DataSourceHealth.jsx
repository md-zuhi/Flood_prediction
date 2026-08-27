import React from "react";
import { Activity, CheckCircle, AlertCircle, Clock, Database } from "lucide-react";

export default function DataSourceHealth({ health = {} }) {
  const sources = [
    { name: "Mappls Routing API", key: "mappls_routing", defaultStatus: "LIVE", meta: "Live Directions & Route Polylines" },
    { name: "Mappls Place Detail", key: "mappls_place_detail", defaultStatus: "ACTIVE", meta: "Static Key / eLoc Coordinate Lookup" },
    { name: "TomTom Traffic Flow", key: "tomtom_traffic_flow", defaultStatus: "LIVE", meta: "Segment Speeds & Congestion Delays" },
    { name: "TomTom Incidents API", key: "tomtom_incidents", defaultStatus: "LIVE", meta: "Reported Closures, Accidents, Roadworks" },
    { name: "Open-Meteo Weather API", key: "open_meteo", defaultStatus: "LIVE", meta: "Real-time Rainfall & 7-day Forecast" },
    { name: "NASA GPM IMERG", key: "nasa_gpm", defaultStatus: "NEAR_REAL_TIME", meta: "30-min Satellite Rainfall Grid" },
    { name: "NASA SMAP Satellite", key: "nasa_smap", defaultStatus: "NEAR_REAL_TIME", meta: "Soil Moisture Active Passive L2/L3" },
    { name: "30m SRTM GL1 Terrain", key: "terrain", defaultStatus: "STATIC", meta: "SRTM Elevation & Slope DEM" },
    { name: "GSI Landslide Inventory", key: "gsi", defaultStatus: "HISTORICAL", meta: "Geological Survey of India Historical Data" },
    { name: "Flash Flood ML FastAPI", key: "flood_ml", defaultStatus: "PREDICTED", meta: "Monitored Sub-basin Flood Risk Model" },
    { name: "Official Shelter Dataset", key: "official_shelters", defaultStatus: "OFFICIAL_DOCUMENT", meta: "Nilgiris District DDMP 2026 Registry" }
  ];

  const getStatusBadge = (rawStatus) => {
    const status = String(rawStatus || "").toUpperCase();

    if (status.includes("UNAVAILABLE") || status.includes("FAILED") || status.includes("ERROR") || status.includes("RATE_LIMITED")) {
      return <span className="health-badge badge-red" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "2px 8px", borderRadius: "10px", fontWeight: "700", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "3px" }}><AlertCircle size={12} /> {status}</span>;
    }
    if (status.includes("DEGRADED") || status.includes("UNVERIFIED") || status.includes("CACHED") || status.includes("FALLBACK")) {
      return <span className="health-badge badge-amber" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "2px 8px", borderRadius: "10px", fontWeight: "700", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "3px" }}><AlertCircle size={12} /> {status}</span>;
    }
    if (status.includes("LIVE") || status.includes("ACTIVE") || status.includes("AVAILABLE") || status.includes("OFFICIAL") || status.includes("PREDICTED")) {
      return <span className="health-badge badge-green" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#10b981", padding: "2px 8px", borderRadius: "10px", fontWeight: "700", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "3px" }}><CheckCircle size={12} /> {status}</span>;
    }
    return <span className="health-badge badge-blue" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "2px 8px", borderRadius: "10px", fontWeight: "700", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "3px" }}><Clock size={12} /> {status || "OK"}</span>;
  };

  return (
    <div className="data-source-health">
      <h4 className="panel-title">
        <Activity size={16} /> Data Source Health & Feed Transparency
      </h4>

      <div className="source-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
        {sources.map((src) => {
          const val = health[src.key] || health[src.name] || src.defaultStatus;
          return (
            <div key={src.name} className="source-item" style={{ background: "var(--bg-secondary)", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="source-info" style={{ display: "flex", flexDirection: "column" }}>
                <span className="source-name" style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{src.name}</span>
                <span className="source-meta" style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{src.meta}</span>
              </div>
              {getStatusBadge(val)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

