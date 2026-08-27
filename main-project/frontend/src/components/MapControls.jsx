import React from "react";
import { Locate, Maximize2, Ruler, Settings, ZoomIn, ZoomOut } from "lucide-react";

function MapControls({
  onZoomIn,
  onZoomOut,
  onRecenterUser,
  onFitIndia,
  isMeasuring,
  onToggleMeasure,
  onToggleSettings
}) {
  return (
    <div style={{
      position: "absolute",
      top: "16px",
      right: "16px",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      gap: "8px"
    }}>
      <button
        type="button"
        onClick={onZoomIn}
        className="map-nav-control-btn"
        title="Zoom In"
        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "800", fontSize: "18px" }}
      >
        +
      </button>

      <button
        type="button"
        onClick={onZoomOut}
        className="map-nav-control-btn"
        title="Zoom Out"
        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "800", fontSize: "18px" }}
      >
        -
      </button>

      <button
        type="button"
        onClick={onRecenterUser}
        className="map-nav-control-btn"
        title="Recenter Map to My Location"
        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
      >
        <Locate size={18} className="text-sky-400" />
      </button>

      <button
        type="button"
        onClick={onFitIndia}
        className="map-nav-control-btn"
        title="Fit Map to Entire India View"
        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
      >
        <Maximize2 size={18} className="text-emerald-400" />
      </button>

      <button
        type="button"
        onClick={onToggleMeasure}
        className="map-nav-control-btn"
        title="Measure Distance Between Points"
        style={{ background: isMeasuring ? "#2563eb" : "var(--bg-card)", color: isMeasuring ? "#ffffff" : "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
      >
        <Ruler size={18} />
      </button>

      <button
        type="button"
        onClick={onToggleSettings}
        className="map-nav-control-btn"
        title="GIS Display Settings"
        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
      >
        <Settings size={18} />
      </button>
    </div>
  );
}

export default MapControls;
