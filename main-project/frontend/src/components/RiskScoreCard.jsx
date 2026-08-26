import React from "react";

function RiskScoreCard({ floodProbability, riskLevel, riskColor }) {
  const prob = typeof floodProbability === "number" ? floodProbability : 0;
  const displayPercent = typeof floodProbability === "number" ? `${Math.round(prob)}%` : "N/A";

  // SVG parameters
  const radius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (prob / 100) * circumference;

  return (
    <div className="card risk-score-card">
      <h3 className="card-title">Flood Risk Score</h3>
      <div className="risk-score-content">
        <div className="circular-progress">
          <svg className="progress-ring" width="130" height="130">
            <circle
              className="progress-ring-bg"
              stroke="#1b283d"
              strokeWidth={strokeWidth}
              fill="transparent"
              r={radius}
              cx="65"
              cy="65"
            />
            <circle
              className="progress-ring-fg"
              stroke={riskColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              r={radius}
              cx="65"
              cy="65"
            />
          </svg>
          <div className="progress-text" style={{ color: riskColor }}>
            {displayPercent}
          </div>
        </div>

        <div className="risk-label-group">
          <span className="risk-badge" style={{ backgroundColor: `${riskColor}22`, color: riskColor, borderColor: riskColor }}>
            {riskLevel || "UNKNOWN"} RISK
          </span>
          <p className="risk-desc">
            Model calculated probability based on real-time environmental indicators.
          </p>
        </div>
      </div>
    </div>
  );
}

export default RiskScoreCard;
