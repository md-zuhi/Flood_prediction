import React, { useState } from "react";
import { Thermometer, Droplets, Wind, CloudRain, ShieldAlert, MapPin, Compass, Satellite, Activity } from "lucide-react";
import { normalizeWeatherResponse } from "../utils/weatherNormalizer";

function getCompassDir(deg) {
  if (deg === null || deg === undefined) return "N/A";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.round(deg / 22.5) % 16;
  const flowDeg = (deg + 180) % 360;
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  const arrowIdx = Math.round(flowDeg / 45) % 8;
  return `${dirs[idx]} (${deg}°) ${arrows[arrowIdx]}`;
}

function LocationWeatherPanel({
  result,
  selectedLocation,
  activeTimeline,
  riskColor,
  clickedPointWeather,
  activeLayer,
  onLocationChange
}) {
  const [gpmInterval, setGpmInterval] = useState("intensity");

  // Normalize clicked arbitrary point weather OR selected location result
  const rawData = clickedPointWeather ? clickedPointWeather.weather : result;
  const normalized = normalizeWeatherResponse(rawData, selectedLocation);

  const isInspectedPoint = Boolean(clickedPointWeather && !result);

  return (
    <div className="location-weather-panel">
      <div className="panel-header">
        <div className="location-title">
          <h3>{isInspectedPoint ? (clickedPointWeather.name || "Inspected Point") : normalized.name}</h3>
          <span className="location-subtitle">
            {isInspectedPoint
              ? `${clickedPointWeather.latitude.toFixed(4)}°N, ${clickedPointWeather.longitude.toFixed(4)}°E`
              : `${normalized.state}, India`}
          </span>
        </div>
        <div
          className="risk-badge"
          style={{
            backgroundColor: normalized.isFloodSupported && !isInspectedPoint
              ? (riskColor || "var(--color-low)")
              : "#0284c7"
          }}
        >
          {normalized.isFloodSupported && !isInspectedPoint
            ? (normalized.risk_level || "LOW")
            : "LIVE WEATHER"}
        </div>
      </div>

      {/* NASA GPM Satellite Interval Selector if GPM layer active */}
      {activeLayer === "satellite_rainfall" && (
        <div className="panel-section" style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: "8px", padding: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#c084fc", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
              <Satellite size={14} /> NASA GPM IMERG (NRT)
            </span>
            <span style={{ fontSize: "10px", color: normalized.gpm_freshness === "FRESH" ? "#10b981" : "#f59e0b", fontWeight: "700" }}>
              ● {normalized.gpm_freshness}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", marginBottom: "8px" }}>
            {["intensity", "1h", "3h", "6h", "12h", "24h"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setGpmInterval(item)}
                style={{
                  padding: "4px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: "700",
                  border: gpmInterval === item ? "1px solid #a855f7" : "1px solid var(--border-color)",
                  background: gpmInterval === item ? "rgba(168, 85, 247, 0.25)" : "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  textTransform: "uppercase"
                }}
              >
                {item}
              </button>
            ))}
          </div>

          <div style={{ fontSize: "11px", color: "var(--text-primary)" }}>
            <strong>Selected Interval:</strong>{" "}
            {gpmInterval === "intensity"
              ? `${normalized.gpm_intensity_mm_hr ?? "N/A"} mm/hr`
              : `${normalized[`gpm_rain_${gpmInterval}_mm`] ?? "N/A"} mm`}
          </div>
          {normalized.gpm_observation_time && (
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Obs: {normalized.gpm_observation_time}
            </div>
          )}
        </div>
      )}

      {/* Main Meteorological Conditions */}
      <div className="panel-section">
        <div className="section-header">
          {activeLayer === "wind" ? "WIND STREAMLINE METRICS" : "LIVE METEOROLOGICAL METRICS"}
        </div>
        <div className="conditions-grid">
          <div className="condition-item">
            <Thermometer size={14} color="#f97316" />
            <span className="cond-label">Temp</span>
            <span className="cond-val">{normalized.temperature_c !== null ? `${normalized.temperature_c} °C` : "N/A"}</span>
          </div>
          <div className="condition-item">
            <Droplets size={14} color="#06b6d4" />
            <span className="cond-label">Humidity</span>
            <span className="cond-val">{normalized.humidity_percent !== null ? `${normalized.humidity_percent}%` : "N/A"}</span>
          </div>
          <div className="condition-item">
            <Wind size={14} color="#c084fc" />
            <span className="cond-label">Wind Speed</span>
            <span className="cond-val">{normalized.wind_speed_kmh !== null ? `${normalized.wind_speed_kmh} km/h` : "N/A"}</span>
          </div>
          <div className="condition-item">
            <Compass size={14} color="#c084fc" />
            <span className="cond-label">Direction</span>
            <span className="cond-val">{getCompassDir(normalized.wind_direction_deg)}</span>
          </div>
          <div className="condition-item">
            <CloudRain size={14} color="#38bdf8" />
            <span className="cond-label">Precip 1H</span>
            <span className="cond-val">{normalized.rain_1h_mm !== null ? `${normalized.rain_1h_mm} mm` : "N/A"}</span>
          </div>
          <div className="condition-item">
            <CloudRain size={14} color="#38bdf8" />
            <span className="cond-label">Precip 24H</span>
            <span className="cond-val">{normalized.rain_24h_mm !== null ? `${normalized.rain_24h_mm} mm` : "N/A"}</span>
          </div>
        </div>
      </div>

      {/* 6-Hour Forecast Preview */}
      <div className="panel-section">
        <div className="section-header">RAINFALL FORECAST (OPEN-METEO)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
          {[
            { key: "1h", val: normalized.forecast_1h_mm },
            { key: "3h", val: normalized.forecast_3h_mm },
            { key: "6h", val: normalized.forecast_6h_mm }
          ].map((fItem) => (
            <div key={fItem.key} style={{ background: "var(--bg-secondary)", padding: "6px", borderRadius: "6px", border: "1px solid var(--border-color)", textAlign: "center" }}>
              <span style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", display: "block" }}>+{fItem.key}</span>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "#38bdf8" }}>{fItem.val !== null ? `${fItem.val} mm` : "N/A"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Flood Analysis Trigger for Supported Locations */}
      {normalized.isFloodSupported && !isInspectedPoint && (
        <div className="panel-section risk-summary" style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldAlert size={16} className="text-red-500" />
              <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>ML Flood Prediction</strong>
            </div>
            <span style={{ fontSize: "14px", fontWeight: "800", color: riskColor }}>
              {normalized.flood_probability_percent !== null ? `${normalized.flood_probability_percent}%` : "N/A"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onLocationChange && onLocationChange(selectedLocation)}
            style={{
              width: "100%",
              marginTop: "4px",
              background: "#ef4444",
              color: "#ffffff",
              border: "none",
              padding: "7px 10px",
              borderRadius: "6px",
              fontWeight: "700",
              fontSize: "11px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
          >
            <Activity size={13} /> VIEW FULL FLOOD ANALYSIS
          </button>
        </div>
      )}
    </div>
  );
}

export default LocationWeatherPanel;

