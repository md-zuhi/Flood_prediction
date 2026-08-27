import React, { useState, useEffect } from "react";
import { useMapEvents, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

function MapMeasureTool({ active, onClose }) {
  const [points, setPoints] = useState([]);
  const [distanceKm, setDistanceKm] = useState(null);

  useMapEvents({
    click(e) {
      if (!active) return;

      const newPt = [e.latlng.lat, e.latlng.lng];
      if (points.length >= 2) {
        setPoints([newPt]);
        setDistanceKm(null);
      } else {
        const nextPts = [...points, newPt];
        setPoints(nextPts);

        if (nextPts.length === 2) {
          const latLng1 = L.latLng(nextPts[0][0], nextPts[0][1]);
          const latLng2 = L.latLng(nextPts[1][0], nextPts[1][1]);
          const d = (latLng1.distanceTo(latLng2) / 1000).toFixed(2);
          setDistanceKm(d);
        }
      }
    }
  });

  useEffect(() => {
    if (!active) {
      setPoints([]);
      setDistanceKm(null);
    }
  }, [active]);

  if (!active || points.length === 0) return null;

  const measureIcon = L.divIcon({
    html: `<div style="width: 14px; height: 14px; background: #2563eb; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4); transform: translate(-50%, -50%);"></div>`,
    className: "measure-point-icon",
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  return (
    <>
      {points.map((pt, idx) => (
        <Marker key={`measure_${idx}`} position={pt} icon={measureIcon} />
      ))}

      {points.length === 2 && (
        <Polyline
          positions={points}
          pathOptions={{
            color: "#2563eb",
            weight: 3,
            dashArray: "6, 6"
          }}
        >
          <Popup position={points[1]} autoPan={false}>
            <div style={{ color: "#0f172a", fontSize: "12px", padding: "2px" }}>
              <strong style={{ color: "#2563eb" }}>📏 MEASURED DISTANCE</strong>
              <div style={{ fontSize: "14px", fontWeight: "800", margin: "4px 0" }}>{distanceKm} km</div>
              <button
                type="button"
                onClick={() => setPoints([])}
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" }}
              >
                Clear Measurement
              </button>
            </div>
          </Popup>
        </Polyline>
      )}
    </>
  );
}

export default MapMeasureTool;
