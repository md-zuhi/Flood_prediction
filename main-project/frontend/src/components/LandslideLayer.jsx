import React, { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

const createLandslideIcon = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#f59e0b" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 22h20L12 2z"></path>
      <path d="M12 9v4" stroke="#ffffff" stroke-width="2"></path>
      <circle cx="12" cy="16" r="1" fill="#ffffff"></circle>
    </svg>`;

  return L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;transform:translate(-50%, -100%);filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4));">${svg}</div>`,
    className: "landslide-gsi-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
};

const landslideIcon = createLandslideIcon();

function LandslideLayer({ activeLayer, apiBaseUrl }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeLayer !== "landslide_history") return;

    const fetchLandslides = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBaseUrl}/api/landslide-inventory`);
        if (res.ok) {
          const data = await res.json();
          if (data.points) setPoints(data.points);
        }
      } catch (err) {
        console.error("Landslide inventory fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLandslides();
  }, [activeLayer, apiBaseUrl]);

  if (activeLayer !== "landslide_history") return null;

  return (
    <>
      {points.map((pt, idx) => {
        if (!pt.latitude || !pt.longitude) return null;
        return (
          <Marker key={`ls_${idx}`} position={[pt.latitude, pt.longitude]} icon={landslideIcon}>
            <Popup>
              <div style={{ color: "#0f172a", fontSize: "12px", minWidth: "210px" }}>
                <strong style={{ color: "#d97706", fontSize: "13px" }}>⛰ HISTORICAL LANDSLIDE EVENT</strong>
                <div style={{ margin: "4px 0", fontWeight: "700" }}>{pt.name || pt.location || "GSI Landslide Point"}</div>
                <div style={{ background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", marginBottom: "6px" }}>
                  HISTORICAL LANDSLIDE INVENTORY (GSI)
                </div>
                <div><strong>District:</strong> {pt.district || "N/A"}</div>
                <div><strong>Location:</strong> {pt.location || "N/A"}</div>
                <div><strong>Movement Type:</strong> {pt.movementType || "Debris Flow / Fall"}</div>
                <div><strong>Material:</strong> {pt.material || "Soil / Rock Debris"}</div>
                <div><strong>Source:</strong> Geological Survey of India</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default LandslideLayer;
