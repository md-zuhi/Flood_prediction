import React, { useRef, useEffect, useCallback } from "react";

// --------------------------------------------------
// RiverLevelChart
// Renders a canvas-based historical river-level line chart with:
//   - Historical level line
//   - Current level marker
//   - Warning threshold line
//   - Danger threshold line
//   - Rising / Falling / Stable trend indicator
//   - Clearly labeled as DEMO / SIMULATED DATA
// --------------------------------------------------

const COLORS = {
  bg: "#0f172a",
  gridLine: "rgba(148,163,184,0.12)",
  levelLine: "#38bdf8",
  levelFill: "rgba(56,189,248,0.08)",
  warning: "#f59e0b",
  danger: "#ef4444",
  currentDot: "#a78bfa",
  axis: "rgba(148,163,184,0.5)",
  label: "#94a3b8",
  trend: {
    RISING: "#ef4444",
    FALLING: "#22c55e",
    STABLE: "#94a3b8",
    UNKNOWN: "#94a3b8"
  }
};

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function RiverLevelChart({ readings, thresholds, trend, currentLevel }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Draw function — called on readings change and on resize
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Sync intrinsic size to CSS size to avoid distortion
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW > 0 && cssH > 0) {
      canvas.width = cssW;
      canvas.height = cssH;
    }

    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    if (!readings || readings.length < 2) {
      ctx.fillStyle = COLORS.label;
      ctx.font = "13px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Insufficient data — switch to DEMO MODE to see chart", W / 2, H / 2);
      return;
    }

    const levels = readings.map((r) => r.level_m);
    const times = readings.map((r) => r.observation_time || r.timestamp_iso);
    const minY = Math.min(...levels, thresholds?.warning_m ?? Infinity) * 0.9;
    const maxY = Math.max(...levels, thresholds?.danger_m ?? 0) * 1.1;

    const PAD_L = 52, PAD_R = 20, PAD_T = 28, PAD_B = 36;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    const toX = (i) => PAD_L + (i / (readings.length - 1)) * plotW;
    const toY = (v) => PAD_T + plotH - ((v - minY) / (maxY - minY)) * plotH;

    // Grid lines
    const gridCount = 4;
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridCount; i++) {
      const y = PAD_T + (i / gridCount) * plotH;
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
      const val = maxY - (i / gridCount) * (maxY - minY);
      ctx.fillStyle = COLORS.label;
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${val.toFixed(2)}m`, PAD_L - 4, y + 3);
    }

    // Warning threshold
    if (thresholds?.warning_m !== undefined) {
      const wy = toY(thresholds.warning_m);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = COLORS.warning;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(PAD_L, wy); ctx.lineTo(W - PAD_R, wy); ctx.stroke();
      ctx.fillStyle = COLORS.warning;
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`⚠ WARNING ${thresholds.warning_m}m`, PAD_L + 4, wy - 3);
      ctx.setLineDash([]);
    }

    // Danger threshold
    if (thresholds?.danger_m !== undefined) {
      const dy = toY(thresholds.danger_m);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(PAD_L, dy); ctx.lineTo(W - PAD_R, dy); ctx.stroke();
      ctx.fillStyle = COLORS.danger;
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`🔴 DANGER ${thresholds.danger_m}m`, PAD_L + 4, dy - 3);
      ctx.setLineDash([]);
    }

    // Fill under level line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(levels[0]));
    levels.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.lineTo(toX(levels.length - 1), PAD_T + plotH);
    ctx.lineTo(toX(0), PAD_T + plotH);
    ctx.closePath();
    ctx.fillStyle = COLORS.levelFill;
    ctx.fill();

    // Level line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(levels[0]));
    levels.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.strokeStyle = COLORS.levelLine;
    ctx.lineWidth = 2;
    ctx.stroke();

    // X-axis time labels (show ~5 evenly spaced)
    const labelCount = Math.min(5, readings.length);
    ctx.fillStyle = COLORS.label;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (readings.length - 1));
      ctx.fillText(formatTime(times[idx]), toX(idx), H - PAD_B + 14);
    }

    // Current level dot
    if (currentLevel !== null && currentLevel !== undefined) {
      const cx = toX(levels.length - 1);
      const cy = toY(currentLevel);
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.currentDot;
      ctx.fill();
    }

    // Trend label (top-right)
    const trendColor = COLORS.trend[trend] || COLORS.trend.UNKNOWN;
    const trendLabel = trend === "RISING" ? "↑ RISING" : trend === "FALLING" ? "↓ FALLING" : "→ STABLE";
    ctx.fillStyle = trendColor;
    ctx.font = "bold 11px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(trendLabel, W - PAD_R, PAD_T - 8);

    // DEMO label (top-left)
    ctx.fillStyle = "rgba(239,68,68,0.65)";
    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("DEMO / SIMULATED", PAD_L, PAD_T - 8);
  }, [readings, thresholds, trend, currentLevel]);

  // Redraw on data change
  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on container resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => { draw(); });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "300px",
        borderRadius: "8px",
        display: "block"
      }}
      aria-label="River level history chart"
    />
  );
}

export default RiverLevelChart;


