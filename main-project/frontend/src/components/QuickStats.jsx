import React from "react";

function QuickStats({ rain24h, soilMoisture, elevation, temperature }) {
  const formatVal = (val, suffix = "") => {
    if (val === null || val === undefined || isNaN(Number(val))) {
      return "N/A";
    }
    return `${Number(val).toLocaleString(undefined, { maximumFractionDigits: 4 })}${suffix}`;
  };

  const stats = [
    { label: "Rainfall (24h)", value: formatVal(rain24h, " mm"), type: "rain" },
    { label: "Soil Moisture", value: formatVal(soilMoisture, " m³/m³"), type: "soil" },
    { label: "Elevation", value: formatVal(elevation, " m"), type: "elevation" },
    { label: "Temperature", value: formatVal(temperature, " °C"), type: "temp" },
  ];

  return (
    <div className="card quick-stats-card">
      <h3 className="card-title">QUICK STATS</h3>
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="stat-item">
            <span className="stat-label">{stat.label}</span>
            <strong className="stat-value">{stat.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QuickStats;
