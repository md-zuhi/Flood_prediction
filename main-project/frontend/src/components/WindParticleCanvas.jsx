import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

function WindParticleCanvas({ gridPoints, activeLayer, animEnabled = true }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (activeLayer !== "wind" || !animEnabled || !gridPoints || gridPoints.length === 0) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Match canvas size to Leaflet map container
    const updateCanvasSize = () => {
      const container = map.getContainer();
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    updateCanvasSize();

    // Convert Open-Meteo wind direction & speed to vector (u: East-West, v: North-South)
    const validPoints = gridPoints
      .filter((p) => p.wind_speed_kmh !== null && p.wind_direction_deg !== null)
      .map((p) => {
        // Meteorological direction is direction FROM which wind blows
        // Flow direction (towards which wind moves) is (270 - deg)
        const rad = ((270 - p.wind_direction_deg) * Math.PI) / 180;
        return {
          lat: p.latitude,
          lon: p.longitude,
          u: p.wind_speed_kmh * Math.cos(rad),
          v: p.wind_speed_kmh * Math.sin(rad),
          speed: p.wind_speed_kmh,
        };
      });

    if (validPoints.length === 0) return;

    // Interpolate wind vector (u, v) at any given (lat, lon) using Inverse Distance Weighting
    const getInterpolatedWind = (lat, lon) => {
      let totalWeight = 0;
      let uSum = 0;
      let vSum = 0;

      for (let i = 0; i < validPoints.length; i++) {
        const pt = validPoints[i];
        const dLat = lat - pt.lat;
        const dLon = lon - pt.lon;
        const distSq = dLat * dLat + dLon * dLon;

        if (distSq < 0.0001) {
          return { u: pt.u, v: pt.v, speed: pt.speed };
        }

        const weight = 1 / (distSq + 0.1);
        totalWeight += weight;
        uSum += pt.u * weight;
        vSum += pt.v * weight;
      }

      if (totalWeight === 0) return { u: 0, v: 0, speed: 0 };
      const u = uSum / totalWeight;
      const v = vSum / totalWeight;
      const speed = Math.sqrt(u * u + v * v);
      return { u, v, speed };
    };

    // Spawn initial particles inside current map bounds
    const PARTICLE_COUNT = 450;

    const getRandomLatLon = () => {
      const bounds = map.getBounds();
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const west = bounds.getWest();
      const east = bounds.getEast();
      return {
        lat: south + Math.random() * (north - south),
        lon: west + Math.random() * (east - west),
        age: Math.floor(Math.random() * 50),
        maxAge: 35 + Math.floor(Math.random() * 45),
      };
    };

    const particles = Array.from({ length: PARTICLE_COUNT }, getRandomLatLon);

    // Animation loop using requestAnimationFrame
    const renderFrame = () => {
      // Clear canvas with subtle trail fade while keeping map 100% visible
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";

      const curBounds = map.getBounds();

      // Draw animated streamline particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.age >= p.maxAge || !curBounds.contains([p.lat, p.lon])) {
          particles[i] = getRandomLatLon();
          continue;
        }

        const point0 = map.latLngToContainerPoint([p.lat, p.lon]);
        const wind = getInterpolatedWind(p.lat, p.lon);

        // Scale factor based on wind speed & zoom
        const scale = 0.0006 * Math.pow(1.15, map.getZoom());
        const dLat = (wind.v * scale);
        const dLon = (wind.u * scale);

        const nextLat = p.lat + dLat;
        const nextLon = p.lon + dLon;
        const point1 = map.latLngToContainerPoint([nextLat, nextLon]);

        // Draw streamline segment
        ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(0.9, 0.45 + wind.speed / 30)})`;
        ctx.lineWidth = Math.min(2.5, 1.0 + wind.speed / 18);
        ctx.beginPath();
        ctx.moveTo(point0.x, point0.y);
        ctx.lineTo(point1.x, point1.y);
        ctx.stroke();

        p.lat = nextLat;
        p.lon = nextLon;
        p.age++;
      }

      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [map, gridPoints, activeLayer, animEnabled]);

  if (activeLayer !== "wind") return null;

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
        zIndex: 400,
      }}
    />
  );
}

export default WindParticleCanvas;
