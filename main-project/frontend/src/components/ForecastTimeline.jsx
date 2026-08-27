import React, { useState, useEffect } from "react";
import { Clock, Play, Pause, SkipForward } from "lucide-react";

const WINDOWS = [
  { id: "now", label: "NOW" },
  { id: "1h", label: "+1H" },
  { id: "3h", label: "+3H" },
  { id: "6h", label: "+6H" },
  { id: "12h", label: "+12H" },
  { id: "24h", label: "+24H" }
];

function ForecastTimeline({ activeTimeline, onSelectTimeline }) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        const curIndex = WINDOWS.findIndex((w) => w.id === activeTimeline);
        const nextIndex = (curIndex + 1) % WINDOWS.length;
        onSelectTimeline(WINDOWS[nextIndex].id);
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, activeTimeline, onSelectTimeline]);

  return (
    <div className="forecast-timeline-panel" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <button
        type="button"
        onClick={() => setIsPlaying(!isPlaying)}
        title={isPlaying ? "Pause Timeline Playback" : "Play Forecast Timeline"}
        style={{
          background: isPlaying ? "#ef4444" : "#2563eb",
          color: "#ffffff",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
        }}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: "2px" }} />}
      </button>

      <div className="timeline-icon" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)" }}>
        <Clock size={15} color="#38bdf8" />
        <span>TIMELINE</span>
      </div>

      <div className="timeline-buttons">
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`timeline-btn ${activeTimeline === w.id ? "active" : ""}`}
            onClick={() => {
              setIsPlaying(false);
              onSelectTimeline(w.id);
            }}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ForecastTimeline;

