import React from "react";

function RiskFactors({ rain24h, soilMoisture, slope, nearestLandslide, elevation }) {
  const formatVal = (val, suffix = "") => {
    if (val === null || val === undefined || isNaN(Number(val))) {
      return "N/A";
    }
    return `${Number(val).toFixed(2)}${suffix}`;
  };

  // Compute normalized widths for visual bars (from 0 to 100)
  const getWidth = (val, max) => {
    if (val === null || val === undefined || isNaN(Number(val))) {
      return 0;
    }
    const ratio = Number(val) / max;
    return Math.min(100, Math.max(0, ratio * 100));
  };

  const getLandslideProximityWidth = (km) => {
    if (km === null || km === undefined || isNaN(Number(km))) {
      return 0;
    }
    // High proximity = high risk (closer is higher bar width)
    const proximity = Math.max(0, 15 - Number(km));
    return (proximity / 15) * 100;
  };

  const factors = [
    {
      name: "Rainfall (24h)",
      valText: formatVal(rain24h, " mm"),
      width: getWidth(rain24h, 100), // Max standard 100mm
    },
    {
      name: "Soil Moisture",
      valText: formatVal(soilMoisture, " m³/m³"),
      width: getWidth(soilMoisture, 0.5), // Max standard 0.5
    },
    {
      name: "Terrain Slope",
      valText: formatVal(slope, "°"),
      width: getWidth(slope, 45), // Max standard 45 degrees
    },
    {
      name: "Nearest Landslide",
      valText: formatVal(nearestLandslide, " km"),
      width: getLandslideProximityWidth(nearestLandslide), // Scales up if closer than 15km
    },
    {
      name: "Elevation",
      valText: formatVal(elevation, " m"),
      width: getWidth(elevation, 3000), // Max standard 3000m
    },
  ];

  return (
    <div className="card risk-factors-card">
      <h3 className="card-title">KEY RISK INDICATORS</h3>
      <div className="factors-list">
        {factors.map((factor, idx) => (
          <div key={idx} className="factor-row">
            <div className="factor-meta">
              <span className="factor-name">{factor.name}</span>
              <span className="factor-value">{factor.valText}</span>
            </div>
            <div className="factor-bar-container">
              <div
                className="factor-bar"
                style={{ width: `${factor.width}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      <p className="explain-note">
        Visual bars represent normalized risk scaling for each environmental indicator.
      </p>
    </div>
  );
}

export default RiskFactors;
