import React from "react";
import { Thermometer, Droplets, Wind, CloudRain, ShieldAlert, MapPin, Compass } from "lucide-react";

function getCompassDir(deg) {
  if (deg === null || deg === undefined) return "N/A";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.round(deg / 22.5) % 16;
  const flowDeg = (deg + 180) % 360;
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  const arrowIdx = Math.round(flowDeg / 45) % 8;
  return `${dirs[idx]} (${deg}°) ${arrows[arrowIdx]}`;
}

function LocationWeatherPanel({ result, selectedLocation, activeTimeline, riskColor, clickedPointWeather, activeLayer }) {
  // If clicked point weather is active, show point weather
  if (clickedPointWeather && !result) {
    const w = clickedPointWeather.weather || {};
    return (
      <div className="location-weather-panel">
        <div className="panel-header">
          <div className="location-title">
            <h3>{clickedPointWeather.name || "Inspected Location"}</h3>
            <span className="location-subtitle">
              {clickedPointWeather.latitude.toFixed(4)}°N, {clickedPointWeather.longitude.toFixed(4)}°E
            </span>
          </div>
          <div className="risk-badge" style={{ backgroundColor: "#0284c7" }}>
            LIVE WEATHER
          </div>
        </div>

        <div className="panel-section">
          <div className="section-header">
            {activeLayer === "wind" ? "WIND CONDITIONS (OPEN-METEO)" : "CURRENT WEATHER (OPEN-METEO)"}
          </div>
          <div className="conditions-grid">
            <div className="condition-item">
              <Wind size={14} color="#c084fc" />
              <span className="cond-label">Wind Speed</span>
              <span className="cond-val">{w.wind_speed_kmh !== null ? `${w.wind_speed_kmh} km/h` : "N/A"}</span>
            </div>
            <div className="condition-item">
              <Compass size={14} color="#c084fc" />
              <span className="cond-label">Direction</span>
              <span className="cond-val">{getCompassDir(w.wind_direction_deg)}</span>
            </div>
            <div className="condition-item">
              <Thermometer size={14} color="var(--color-moderate)" />
              <span className="cond-label">Temp</span>
              <span className="cond-val">{w.temperature_c !== null ? `${w.temperature_c} °C` : "N/A"}</span>
            </div>
            <div className="condition-item">
              <Droplets size={14} color="var(--color-accent)" />
              <span className="cond-label">Humidity</span>
              <span className="cond-val">{w.humidity_percent !== null ? `${w.humidity_percent}%` : "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="panel-section risk-summary" style={{ background: "rgba(2, 132, 199, 0.08)" }}>
          <div className="risk-summary-row" style={{ borderColor: "#0284c7" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={14} color="#0284c7" />
              <span className="cond-label" style={{ fontWeight: 600 }}>Flash Flood Analysis</span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Supported Hilly Regions Only
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const weather = result.environmental_data?.weather || {};
  const rainfall = result.environmental_data?.rainfall || {};
  const forecast = result.environmental_data?.rainfall_forecast || {};
  const prediction = result.prediction || {};
  const isFloodSupported = selectedLocation?.isSupportedFloodLoc || true;

  const getSafeVal = (val, suffix = "") => {
    if (val === null || val === undefined) return "N/A";
    return `${val}${suffix}`;
  };

  return (
    <div className="location-weather-panel">
      <div className="panel-header">
        <div className="location-title">
          <h3>{selectedLocation.name}</h3>
          <span className="location-subtitle">{selectedLocation.state}, India</span>
        </div>
        <div className="risk-badge" style={{ backgroundColor: isFloodSupported ? (riskColor || "var(--color-low)") : "#0284c7" }}>
          {isFloodSupported ? (prediction.risk_level || "LOW") : "LIVE WEATHER"}
        </div>
      </div>

      <div className="panel-section">
        <div className="section-header">
          {activeLayer === "wind" ? "WIND CONDITIONS (OPEN-METEO)" : "CURRENT CONDITIONS"}
        </div>
        <div className="conditions-grid">
          <div className="condition-item">
            <Wind size={14} color="#c084fc" />
            <span className="cond-label">Wind Speed</span>
            <span className="cond-val">{getSafeVal(weather.wind_speed_kmh, " km/h")}</span>
          </div>
          <div className="condition-item">
            <Compass size={14} color="#c084fc" />
            <span className="cond-label">Direction</span>
            <span className="cond-val">{getCompassDir(weather.wind_direction_deg)}</span>
          </div>
          <div className="condition-item">
            <Thermometer size={14} color="var(--color-moderate)" />
            <span className="cond-label">Temp</span>
            <span className="cond-val">{getSafeVal(weather.temperature_c, " °C")}</span>
          </div>
          <div className="condition-item">
            <Droplets size={14} color="var(--color-accent)" />
            <span className="cond-label">Humidity</span>
            <span className="cond-val">{getSafeVal(weather.humidity_percent, "%")}</span>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <div className="section-header">RAINFALL FORECAST</div>
        <div className="forecast-mini-grid">
          <div className={`forecast-box ${activeTimeline === "1h" ? "highlight" : ""}`}>
            <span className="fc-lbl">1h</span>
            <span className="fc-val">{getSafeVal(forecast.forecast_1h_mm, " mm")}</span>
          </div>
          <div className={`forecast-box ${activeTimeline === "3h" ? "highlight" : ""}`}>
            <span className="fc-lbl">3h</span>
            <span className="fc-val">{getSafeVal(forecast.forecast_3h_mm, " mm")}</span>
          </div>
          <div className={`forecast-box ${activeTimeline === "6h" ? "highlight" : ""}`}>
            <span className="fc-lbl">6h</span>
            <span className="fc-val">{getSafeVal(forecast.forecast_6h_mm, " mm")}</span>
          </div>
          <div className={`forecast-box ${activeTimeline === "12h" ? "highlight" : ""}`}>
            <span className="fc-lbl">12h</span>
            <span className="fc-val">{getSafeVal(forecast.forecast_12h_mm, " mm")}</span>
          </div>
          <div className={`forecast-box ${activeTimeline === "24h" ? "highlight" : ""}`}>
            <span className="fc-lbl">24h</span>
            <span className="fc-val">{getSafeVal(forecast.forecast_24h_mm, " mm")}</span>
          </div>
        </div>
      </div>

      <div className="panel-section risk-summary">
        <div className="risk-summary-row">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ShieldAlert size={16} color={riskColor || "var(--color-low)"} />
            <span className="cond-label" style={{ fontWeight: 700 }}>Flood Probability</span>
          </div>
          <span className="risk-prob-val" style={{ color: riskColor }}>
            {prediction.flood_probability_percent !== undefined ? `${prediction.flood_probability_percent}%` : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default LocationWeatherPanel;
