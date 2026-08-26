import React from "react";

function DataConfidence({ dataCompleteness, overallConfidence, sourceHealth }) {
  const completeness = typeof dataCompleteness === "number" ? dataCompleteness : 0;
  const displayPercent = typeof dataCompleteness === "number" ? `${Math.round(completeness)}%` : "N/A";

  // Calculate sources available
  let totalSources = 0;
  let availableSources = 0;

  if (sourceHealth && typeof sourceHealth === "object") {
    const keys = Object.keys(sourceHealth);
    totalSources = keys.length;
    availableSources = Object.values(sourceHealth).filter((info) => {
      if (!info || !info.status) return false;
      const status = info.status.toLowerCase();
      return status !== "unavailable" && status !== "failed" && status !== "offline";
    }).length;
  }

  // SVG parameters
  const radius = 35;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completeness / 100) * circumference;

  return (
    <div className="card data-confidence-card">
      <h3 className="card-title">DATA CONFIDENCE</h3>
      <div className="confidence-content">
        <div className="circular-progress-small">
          <svg className="progress-ring-small" width="90" height="90">
            <circle
              className="progress-ring-bg"
              stroke="#1b283d"
              strokeWidth={strokeWidth}
              fill="transparent"
              r={radius}
              cx="45"
              cy="45"
            />
            <circle
              className="progress-ring-fg"
              stroke="#82cfff"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              r={radius}
              cx="45"
              cy="45"
            />
          </svg>
          <div className="progress-text-small">{displayPercent}</div>
        </div>

        <div className="confidence-details">
          <span className="confidence-label">Overall State</span>
          <strong className="confidence-val">{overallConfidence || "N/A"}</strong>
          <span className="sources-count">
            {totalSources > 0 ? `${availableSources}/${totalSources} sources active` : "N/A"}
          </span>
        </div>
      </div>

      {sourceHealth && typeof sourceHealth === "object" && (
        <div className="source-mini-badges">
          {Object.entries(sourceHealth).map(([source, info]) => {
            const isAvailable = info && info.status && info.status.toLowerCase() !== "unavailable";
            return (
              <div key={source} className="source-mini-badge-row">
                <span className="source-mini-name">{source.replace(/_/g, " ")}</span>
                <span className={`source-mini-status ${isAvailable ? "up" : "down"}`}>
                  {isAvailable ? "Available" : "Unavailable"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DataConfidence;
