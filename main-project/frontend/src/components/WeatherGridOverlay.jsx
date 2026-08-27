import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

function WeatherGridOverlay({ gridPoints, activeLayer }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    // Create dedicated weather overlay pane if not exists
    let pane = map.getPane("weather-overlay-pane");
    if (!pane) {
      pane = map.createPane("weather-overlay-pane");
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
    }

    const validLayers = ["temperature", "rainfall", "humidity", "satellite_rainfall"];
    if (!validLayers.includes(activeLayer) || !gridPoints || gridPoints.length === 0) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Attach to pane if not already attached
    if (canvas.parentNode !== pane) {
      pane.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");

    const updateAndDraw = () => {
      const size = map.getSize();
      if (!size || size.x === 0 || size.y === 0) return;

      canvas.width = size.x;
      canvas.height = size.y;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      canvas.style.position = "absolute";
      canvas.style.top = "0px";
      canvas.style.left = "0px";

      ctx.clearRect(0, 0, size.x, size.y);

      // Extract valid points for the active layer
      const activePoints = gridPoints
        .map((pt) => {
          let val = null;
          if (activeLayer === "temperature") val = pt.temperature_c;
          else if (activeLayer === "rainfall") val = pt.precipitation_mm ?? pt.rain_24h_mm;
          else if (activeLayer === "humidity") val = pt.humidity_percent;
          else if (activeLayer === "satellite_rainfall") val = pt.current_intensity_mm_hr ?? pt.precipitation_mm;

          if (val === null || val === undefined) return null;
          return { lat: pt.latitude, lon: pt.longitude, val: Number(val) };
        })
        .filter(Boolean);

      if (activePoints.length === 0) return;

      // Color mapping functions
      const getColor = (val) => {
        if (activeLayer === "temperature") {
          if (val < 15) return [56, 189, 248, 0.55];   // <15°C cool blue
          if (val < 22) return [34, 197, 94, 0.55];   // 15-22°C green
          if (val < 27) return [234, 179, 8, 0.6];    // 22-27°C yellow
          if (val < 32) return [249, 115, 22, 0.65];  // 27-32°C orange
          return [239, 68, 68, 0.75];                 // >32°C red
        }
        if (activeLayer === "rainfall") {
          if (val <= 0) return [0, 0, 0, 0];
          if (val < 2) return [130, 207, 255, 0.5];
          if (val < 5) return [59, 130, 246, 0.6];
          if (val < 15) return [139, 92, 246, 0.7];
          return [217, 70, 239, 0.8];
        }
        if (activeLayer === "humidity") {
          if (val < 50) return [148, 163, 184, 0.35];
          if (val < 70) return [56, 189, 248, 0.55];
          if (val < 85) return [37, 99, 235, 0.65];
          return [2, 132, 199, 0.75];
        }
        // GPM Satellite Rainfall
        if (val <= 0) return [0, 0, 0, 0];
        if (val < 2) return [168, 85, 247, 0.55];
        if (val < 5) return [236, 72, 153, 0.7];
        return [239, 68, 68, 0.8];
      };

      const radius = Math.max(45, Math.min(size.x, size.y) / 4);

      activePoints.forEach((pt) => {
        const latLng = L.latLng(pt.lat, pt.lon);
        const containerPoint = map.latLngToContainerPoint(latLng);
        const x = containerPoint.x;
        const y = containerPoint.y;

        if (x < -radius || x > size.x + radius || y < -radius || y > size.y + radius) return;

        const [r, g, b, a] = getColor(pt.val);
        if (a === 0) return;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${a * 0.5})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    updateAndDraw();

    map.on("move", updateAndDraw);
    map.on("zoom", updateAndDraw);
    map.on("resize", updateAndDraw);

    return () => {
      map.off("move", updateAndDraw);
      map.off("zoom", updateAndDraw);
      map.off("resize", updateAndDraw);
    };
  }, [gridPoints, activeLayer, map]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

export default WeatherGridOverlay;

