import React from "react";
import { Clock } from "lucide-react";

const WINDOWS = [
  { id: "now", label: "NOW" },
  { id: "1h", label: "+1H" },
  { id: "3h", label: "+3H" },
  { id: "6h", label: "+6H" },
  { id: "12h", label: "+12H" },
  { id: "24h", label: "+24H" },
];

function ForecastTimeline({ activeTimeline, onSelectTimeline }) {
  return (
    <div className="forecast-timeline-panel">
      <div className="timeline-icon">
        <Clock size={16} color="var(--color-accent)" />
      </div>
      <div className="timeline-buttons">
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`timeline-btn ${activeTimeline === w.id ? "active" : ""}`}
            onClick={() => onSelectTimeline(w.id)}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ForecastTimeline;
