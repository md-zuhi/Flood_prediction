import React from "react";

function MapLegend({ activeLayer }) {
  const getLegendData = () => {
    switch (activeLayer) {
      case "temperature":
        return {
          title: "TEMPERATURE SCALE",
          subtitle: "Location & Grid Observation",
          items: [
            { label: "< 10°C", color: "#38bdf8" },
            { label: "10–20°C", color: "#22c55e" },
            { label: "20–25°C", color: "#eab308" },
            { label: "25–30°C", color: "#f97316" },
            { label: "30–35°C", color: "#ef4444" },
            { label: "> 35°C", color: "#dc2626" }
          ]
        };
      case "rainfall":
        return {
          title: "OPEN-METEO RAINFALL",
          subtitle: "Precipitation Rate (mm)",
          items: [
            { label: "0 mm", color: "#94a3b8" },
            { label: "< 2 mm", color: "#82cfff" },
            { label: "2–5 mm", color: "#3b82f6" },
            { label: "5–15 mm", color: "#8b5cf6" },
            { label: "> 15 mm", color: "#d946ef" }
          ]
        };
      case "satellite_rainfall":
        return {
          title: "NASA GPM IMERG SATELLITE",
          subtitle: "Current intensity (mm/hr)",
          items: [
            { label: "0 mm/h", color: "#94a3b8" },
            { label: "< 2 mm/h", color: "#a855f7" },
            { label: "2–5 mm/h", color: "#ec4899" },
            { label: "> 5 mm/h", color: "#ef4444" }
          ]
        };
      case "wind":
        return {
          title: "WIND SPEED (LIVE)",
          subtitle: "Streamlines & Speed (km/h)",
          items: [
            { label: "0 km/h", color: "#38bdf8" },
            { label: "20 km/h", color: "#22c55e" },
            { label: "40 km/h", color: "#eab308" },
            { label: "60 km/h", color: "#f97316" },
            { label: "80 km/h", color: "#ef4444" },
            { label: "100+ km/h", color: "#dc2626" }
          ]
        };
      case "humidity":
        return {
          title: "RELATIVE HUMIDITY",
          subtitle: "Percentage (%)",
          items: [
            { label: "< 40%", color: "#94a3b8" },
            { label: "40–70%", color: "#38bdf8" },
            { label: "> 70%", color: "#2563eb" }
          ]
        };
      case "terrain":
        return {
          title: "TERRAIN ELEVATION",
          subtitle: "NASA SRTM (m)",
          items: [
            { label: "< 500m", color: "#10b981" },
            { label: "500–1500m", color: "#f59e0b" },
            { label: "> 1500m", color: "#64748b" }
          ]
        };
      case "flood_risk":
        return {
          title: "ML FLOOD RISK LEVEL",
          subtitle: "V1 Prediction Model",
          items: [
            { label: "LOW", color: "var(--color-low)" },
            { label: "MODERATE", color: "var(--color-moderate)" },
            { label: "HIGH", color: "var(--color-high)" },
            { label: "CRITICAL", color: "var(--color-critical)" }
          ]
        };
      default:
        return null;
    }
  };

  const legend = getLegendData();
  if (!legend) return null;

  return (
    <div className="map-legend-panel">
      <div className="legend-title">{legend.title}</div>
      <div className="legend-subtitle">{legend.subtitle}</div>
      <div className="legend-items">
        {legend.items.map((item, idx) => (
          <div className="legend-item" key={idx}>
            <span className="legend-color-dot" style={{ backgroundColor: item.color }} />
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MapLegend;
