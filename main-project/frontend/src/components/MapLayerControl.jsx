import React from "react";
import {
  Thermometer,
  CloudRain,
  Satellite,
  Wind,
  Droplets,
  Mountain,
  TriangleAlert
} from "lucide-react";

const LAYER_CATEGORIES = [
  {
    category: "WEATHER (INDIA-WIDE)",
    items: [
      { id: "temperature", label: "Temperature", icon: Thermometer, color: "var(--color-moderate)" },
      { id: "rainfall", label: "Rainfall", icon: CloudRain, color: "var(--color-accent)" },
      { id: "wind", label: "Wind", icon: Wind, color: "#c084fc" },
      { id: "humidity", label: "Humidity", icon: Droplets, color: "#38bdf8" }
    ]
  },
  {
    category: "SATELLITE",
    items: [
      { id: "satellite_rainfall", label: "GPM IMERG", icon: Satellite, color: "#a855f7" }
    ]
  },
  {
    category: "GEOGRAPHY",
    items: [
      { id: "terrain", label: "Terrain", icon: Mountain, color: "#94a3b8" }
    ]
  },
  {
    category: "FLOOD RISK",
    items: [
      { id: "flood_risk", label: "Flood Risk (ML)", icon: TriangleAlert, color: "var(--color-critical)" }
    ]
  }
];

function MapLayerControl({ activeLayer, onSelectLayer }) {
  return (
    <div className="map-layer-panel">
      <div className="layer-panel-header">
        <span className="panel-title">LIVE MAPS</span>
      </div>
      <div className="layer-categories">
        {LAYER_CATEGORIES.map((cat, idx) => (
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
      </div>
    </div>
  );
}

export default MapLayerControl;
