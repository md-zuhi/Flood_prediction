import React from "react";
import {
  Thermometer,
  CloudRain,
  Satellite,
  Wind,
  Droplets,
  Mountain,
  TriangleAlert,
  Map,
  Moon,
  Layers,
  Flame
} from "lucide-react";

const OVERLAY_CATEGORIES = [
  {
    category: "WEATHER (LIVE)",
    items: [
      { id: "temperature", label: "Temperature", icon: Thermometer, color: "#f97316" },
      { id: "rainfall", label: "Rainfall", icon: CloudRain, color: "#38bdf8" },
      { id: "wind", label: "Wind Particles", icon: Wind, color: "#c084fc" },
      { id: "humidity", label: "Humidity", icon: Droplets, color: "#06b6d4" }
    ]
  },
  {
    category: "SATELLITE & SENSORS",
    items: [
      { id: "satellite_rainfall", label: "NASA GPM IMERG", icon: Satellite, color: "#a855f7" }
    ]
  },
  {
    category: "HAZARDS & ML",
    items: [
      { id: "flood_risk", label: "Flood Risk (ML)", icon: TriangleAlert, color: "#ef4444" },
      { id: "landslide_history", label: "Landslide History", icon: Flame, color: "#f59e0b" }
    ]
  }
];

const BASEMAP_ITEMS = [
  { id: "standard", label: "Standard Road", icon: Map },
  { id: "satellite", label: "Satellite View", icon: Satellite },
  { id: "terrain", label: "Terrain Topo", icon: Mountain },
  { id: "dark", label: "Dark Navigation", icon: Moon }
];

function MapLayerControl({ activeLayer, onSelectLayer, basemapStyle, onSelectBasemap }) {
  return (
    <div className="map-layer-panel">
      <div className="layer-panel-header" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Layers size={16} className="text-sky-400" />
        <span className="panel-title">LIVE MAPS</span>
      </div>

      <div className="layer-categories">
        {/* Weather & Hazard Overlays */}
        {OVERLAY_CATEGORIES.map((cat, idx) => (
          <div key={idx} className="category-group">
            <div className="category-label">{cat.category}</div>
            <div className="layer-list">
              {cat.items.map((layer) => {
                const Icon = layer.icon;
                const isActive = activeLayer === layer.id;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    className={`layer-item-btn ${isActive ? "active" : ""}`}
                    onClick={() => onSelectLayer(layer.id)}
                  >
                    <Icon size={15} className="layer-icon" style={{ color: isActive ? "#ffffff" : layer.color }} />
                    <span className="layer-label">{layer.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Basemap Selection */}
        <div className="category-group" style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid var(--border-color)" }}>
          <div className="category-label">MAP STYLE (BASEMAP)</div>
          <div className="layer-list">
            {BASEMAP_ITEMS.map((b) => {
              const Icon = b.icon;
              const isActive = basemapStyle === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`layer-item-btn ${isActive ? "active-basemap" : ""}`}
                  onClick={() => onSelectBasemap(b.id)}
                  style={{
                    background: isActive ? "rgba(37, 99, 235, 0.2)" : undefined,
                    border: isActive ? "1px solid #2563eb" : undefined,
                    color: isActive ? "#38bdf8" : undefined
                  }}
                >
                  <Icon size={15} style={{ color: isActive ? "#38bdf8" : "var(--text-secondary)" }} />
                  <span className="layer-label">{b.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapLayerControl;

