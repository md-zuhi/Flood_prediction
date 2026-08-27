import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

function InterpolatedHeatmapCanvas({ gridPoints, activeLayer }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!["temperature", "rainfall", "humidity"].includes(activeLayer) || !gridPoints || gridPoints.length === 0) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const updateCanvasSize = () => {
      const container = map.getContainer();
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    updateCanvasSize();

    // Filter points with valid metric
    const validPoints = gridPoints
      .map((p) => {
        let val = null;
        if (activeLayer === "temperature") val = p.temperature_c;
        else if (activeLayer === "rainfall") val = p.precipitation_mm ?? p.rain_24h_mm;
        else if (activeLayer === "humidity") val = p.humidity_percent;

        if (val === null || val === undefined) return null;
        return { lat: p.latitude, lon: p.longitude, val: Number(val) };
      })
      .filter(Boolean);

    if (validPoints.length === 0) return;

    // Convert lat/lon points to pixel coordinates on canvas
    const pixelPoints = validPoints.map((pt) => {
      const latLng = L.latLng(pt.lat, pt.lon);
      const containerPoint = map.latLngToContainerPoint(latLng);
      return { x: containerPoint.x, y: containerPoint.y, val: pt.val };
    });

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Color mapper for continuous field gradient
    const getColorForValue = (val) => {
      if (activeLayer === "temperature") {
        if (val < 10) return [56, 189, 248, 0.45]; // Cool blue
        if (val < 20) return [34, 197, 94, 0.45]; // Green
        if (val < 25) return [234, 179, 8, 0.5]; // Yellow
        if (val < 30) return [249, 115, 22, 0.55]; // Orange
        if (val < 35) return [239, 68, 68, 0.6]; // Red
        return [220, 38, 38, 0.7]; // Deep red
      }
      if (activeLayer === "rainfall") {
        if (val <= 0) return [0, 0, 0, 0];
        if (val < 2) return [130, 207, 255, 0.4];
        if (val < 5) return [59, 130, 246, 0.5];
        if (val < 15) return [139, 92, 246, 0.6];
        return [217, 70, 239, 0.7];
      }
      // Humidity
      if (val < 40) return [148, 163, 184, 0.3];
      if (val < 70) return [56, 189, 248, 0.45];
      return [37, 99, 235, 0.6];
    };

    // Render radial heat blobs for smooth visual effect
    const radius = Math.min(width, height) / 5;

    pixelPoints.forEach((pt) => {
      if (pt.x < -radius || pt.x > width + radius || pt.y < -radius || pt.y > height + radius) return;

      const [r, g, b, a] = getColorForValue(pt.val);
      if (a === 0) return;

      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
      grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${a * 0.4})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [gridPoints, activeLayer, map]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 400
      }}
    />
  );
}

export default InterpolatedHeatmapCanvas;
