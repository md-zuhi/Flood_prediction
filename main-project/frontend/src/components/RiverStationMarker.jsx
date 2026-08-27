import React from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { getFormattedPrediction } from "../services/riverDataService";

/**
 * Custom Leaflet divIcon for River Monitoring Stations
 */
export function createRiverMarkerIcon(riskLevel, isSelected, trend) {
  let bgColor = "#22c55e"; // LOW / SAFE
  let ringColor = "rgba(34, 197, 94, 0.4)";

  if (riskLevel === "CRITICAL") {
    bgColor = "#ef5350";
    ringColor = "rgba(239, 83, 80, 0.6)";
  } else if (riskLevel === "HIGH") {
    bgColor = "#f97316";
    ringColor = "rgba(249, 115, 22, 0.5)";
  } else if (riskLevel === "MODERATE" || riskLevel === "WATCH" || riskLevel === "WARNING") {
    bgColor = "#f5a623";
    ringColor = "rgba(245, 166, 35, 0.5)";
  }

  const isRapid = trend === "Rising Rapidly" || riskLevel === "CRITICAL";

  return L.divIcon({
    className: "custom-river-leaflet-marker",
    html: `
      <div class="river-marker-pin-wrapper ${isRapid ? "is-pulsing" : ""} ${isSelected ? "is-selected" : ""}" style="--pin-color: ${bgColor}; --pin-ring: ${ringColor};">
        <div class="river-pin-badge">
          <span class="river-pin-glyph">🌊</span>
        </div>
      </div>
    `,
    iconSize: isSelected ? [38, 38] : [32, 32],
    iconAnchor: isSelected ? [19, 19] : [16, 16],
    popupAnchor: [0, -16]
  });
}

/**
 * River Station Marker component with Popup displaying all 7 required metrics:
 * 1. River name
 * 2. Current level
 * 3. Rate of rise
 * 4. Warning level
 * 5. Danger level
 * 6. Risk
 * 7. Prediction
 */
export default function RiverStationMarker({
  station,
  isSelected = false,
  onSelect = null
}) {
  if (!station || !station.coordinates || !station.coordinates.latitude) {
    return null;
  }

  const icon = createRiverMarkerIcon(
    station.risk_level,
    isSelected,
    station.trend
  );

  const rateValue = Number(station.rate_of_rise_m_hr) || 0;
  const rateFormatted =
    rateValue > 0
      ? `+${rateValue.toFixed(2)} m/h`
      : `${rateValue.toFixed(2)} m/h`;
  const rateTrendText = station.trend ? ` (${station.trend})` : "";

  // Risk Color and Badge
  const riskColor = station.risk_color || (
    station.risk_level === "CRITICAL" ? "#ef5350" :
    station.risk_level === "HIGH" ? "#f97316" :
    station.risk_level === "MODERATE" ? "#f5a623" : "#22c55e"
  );

  // Formatted Prediction String & Horizons
  const predictionText = getFormattedPrediction(station);
  const preds = station.predictions_1h_3h_6h?.predictions || [];
  const p1 = preds.find((p) => p.horizon === "+1h")?.predicted_level_m;
  const p3 = preds.find((p) => p.horizon === "+3h")?.predicted_level_m;
  const p6 = preds.find((p) => p.horizon === "+6h")?.predicted_level_m;

  return (
    <Marker
      position={[station.coordinates.latitude, station.coordinates.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => {
          if (onSelect) onSelect(station);
        }
      }}
    >
      <Popup className="river-station-leaflet-popup" minWidth={270} maxWidth={320}>
        <div className="river-popup-container">
          {/* Header */}
          <div className="river-popup-header">
            <div className="river-popup-header-icon">🌊</div>
            <div className="river-popup-header-info">
              <div className="river-popup-title">{station.river_name}</div>
              <div className="river-popup-subtitle">
                {station.station_name || station.location} • {station.state}
              </div>
            </div>
          </div>

          <div className="river-popup-divider" />

          {/* 7 Required Metrics */}
          <div className="river-popup-grid">
            {/* 1. River Name */}
            <div className="river-popup-row">
              <span className="river-popup-label">River name:</span>
              <span className="river-popup-value highlight">{station.river_name}</span>
            </div>

            {/* 2. Current Level */}
            <div className="river-popup-row">
              <span className="river-popup-label">Current level:</span>
              <span className="river-popup-value level-value">
                <strong>{station.current_level_m} m</strong>
              </span>
            </div>

            {/* 3. Rate of Rise */}
            <div className="river-popup-row">
              <span className="river-popup-label">Rate of rise:</span>
              <span
                className="river-popup-value"
                style={{
                  color: rateValue >= 0.4 ? "#ef5350" : rateValue > 0 ? "#f97316" : "#22c55e",
                  fontWeight: 700
                }}
              >
                {rateFormatted}{rateTrendText}
              </span>
            </div>

            {/* 4. Warning Level */}
            <div className="river-popup-row">
              <span className="river-popup-label">Warning level:</span>
              <span className="river-popup-value warning-value">
                {station.warning_level_m} m
              </span>
            </div>

            {/* 5. Danger Level */}
            <div className="river-popup-row">
              <span className="river-popup-label">Danger level:</span>
              <span className="river-popup-value danger-value">
                {station.danger_level_m} m
              </span>
            </div>

            {/* 6. Risk */}
            <div className="river-popup-row">
              <span className="river-popup-label">Risk:</span>
              <span
                className="river-popup-risk-badge"
                style={{
                  backgroundColor: riskColor,
                  color: "#ffffff"
                }}
              >
                {station.risk_level || "NORMAL"}
              </span>
            </div>

            {/* 7. Prediction */}
            <div className="river-popup-prediction-block">
              <div className="river-popup-label">Prediction:</div>
              <div className="river-popup-prediction-content">
                <div className="prediction-summary-text">{predictionText}</div>
                {p1 !== undefined && p3 !== undefined && p6 !== undefined && (
                  <div className="prediction-chips">
                    <span className="pred-chip">
                      <strong>+1h:</strong> {p1}m
                    </span>
                    <span className="pred-chip">
                      <strong>+3h:</strong> {p3}m
                    </span>
                    <span className="pred-chip">
                      <strong>+6h:</strong> {p6}m
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
