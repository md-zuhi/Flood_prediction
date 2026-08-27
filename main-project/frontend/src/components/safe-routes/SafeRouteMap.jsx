import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { Locate, Maximize2, Layers, ShieldCheck, MapPin, Navigation, AlertTriangle, Search, Filter } from "lucide-react";

const createCustomIcon = (color, type = "pin") => {
  let svg = "";
  if (type === "shield") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="2.5"></path>
      </svg>`;
  } else if (type === "user") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="#2563eb" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" fill="#2563eb"></circle>
        <circle cx="12" cy="12" r="4" fill="#ffffff"></circle>
      </svg>`;
  } else if (type === "closure") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" fill="${color}"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="#ffffff" stroke-width="3"></line>
      </svg>`;
  } else if (type === "accident") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 2 22 22 22 12 2" fill="${color}"></polygon>
        <line x1="12" y1="9" x2="12" y2="15" stroke="#ffffff" stroke-width="2.5"></line>
        <circle cx="12" cy="18" r="1" fill="#ffffff"></circle>
      </svg>`;
  } else if (type === "roadworks") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" fill="${color}"></polygon>
        <line x1="12" y1="8" x2="12" y2="12" stroke="#ffffff" stroke-width="2.5"></line>
        <circle cx="12" cy="16" r="1" fill="#ffffff"></circle>
      </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
      </svg>`;
  }

  return L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;transform:translate(-50%, -100%);filter:drop-shadow(0 3px 8px rgba(0,0,0,0.45));">${svg}</div>`,
    className: "custom-leaflet-marker",
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -42]
  });
};

const createEtaCalloutIcon = (etaMin, distanceKm, isTraffic = false) => {
  const label = isTraffic ? `${etaMin} min traffic` : `${etaMin} min`;
  return L.divIcon({
    html: `<div style="
      background: #ffffff;
      color: #0f172a;
      padding: 5px 12px;
      border-radius: 20px;
      font-weight: 800;
      font-size: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      border: 2px solid #2563eb;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      transform: translate(-50%, -100%);
    ">
      <span style="background: #2563eb; color: #ffffff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px;">🚗</span>
      <span><strong>${label}</strong> • ${distanceKm} km</span>
    </div>`,
    className: "custom-eta-callout",
    iconSize: [160, 36],
    iconAnchor: [80, 36]
  });
};

const userIcon = createCustomIcon("#2563eb", "user"); // Blue (User Location Pin)
const officialDestinationIcon = createCustomIcon("#059669", "shield"); // Emerald Green Shield (Verified Official Shelter)
const unverifiedDestinationIcon = createCustomIcon("#d97706", "pin"); // Yellow/Amber Pin (Unverified Potential Facility)
const closureIcon = createCustomIcon("#dc2626", "closure"); // Red (Reported Road Closure)
const accidentIcon = createCustomIcon("#f97316", "accident"); // Orange (Accident)
const roadworksIcon = createCustomIcon("#eab308", "roadworks"); // Yellow (Roadworks)
const testClosureIcon = createCustomIcon("#d97706", "closure"); // Amber (Simulated Test Incident)

function MapController({ bounds, mapRef, flyToCoords, fitBoundsTrigger }) {
  const map = useMap();

  useEffect(() => {
    if (mapRef) mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (err) {}
    }, 200);

    if (bounds && Array.isArray(bounds) && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (err) {
        console.warn("Leaflet fitBounds error:", err.message);
      }
    }
    return () => clearTimeout(timer);
  }, [bounds, map, fitBoundsTrigger]);

  useEffect(() => {
    if (flyToCoords && Array.isArray(flyToCoords) && flyToCoords.length === 2) {
      try {
        map.flyTo(flyToCoords, 14, { animate: true, duration: 1.2 });
      } catch (e) {}
    }
  }, [flyToCoords, map]);

  return null;
}

function extractCenterPoint(geometry) {
  if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const coords = geometry.coordinates;
  if (geometry.type === "Point" && typeof coords[0] === "number" && typeof coords[1] === "number") {
    return [coords[1], coords[0]];
  }
  if (geometry.type === "LineString" && Array.isArray(coords[0]) && typeof coords[0][0] === "number" && typeof coords[0][1] === "number") {
    return [coords[0][1], coords[0][0]];
  }
  if (geometry.type === "MultiLineString" && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    const pt = coords[0][0];
    if (typeof pt[0] === "number" && typeof pt[1] === "number") {
      return [pt[1], pt[0]];
    }
  }
  return null;
}

function getRouteMidpoint(coords) {
  if (!coords || !Array.isArray(coords) || coords.length === 0) return null;
  const midIndex = Math.floor(coords.length / 2);
  return coords[midIndex];
}

export default function SafeRouteMap({
  userLocation,
  recommendedDestination,
  recommendedRoute,
  alternativeRoutes = [],
  selectedRouteId,
  onSelectRoute,
  hazardZones = [],
  incidents = [],
  locations = [],
  onSelectLocation
}) {
  const mapRef = useRef(null);
  const [showIncidentsLayer, setShowIncidentsLayer] = useState(true);
  const [showSamplesLayer, setShowSamplesLayer] = useState(true);
  const [flyToCoords, setFlyToCoords] = useState(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL"); // ALL | OFFICIAL | HOSPITALS

  const centerLat = Number(userLocation?.latitude) || 11.3533;
  const centerLon = Number(userLocation?.longitude) || 76.7959;

  const extractPolylineCoords = (geometry) => {
    if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates)) return [];
    try {
      return geometry.coordinates
        .filter((coord) => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
        .map((coord) => [coord[1], coord[0]]);
    } catch (e) {
      return [];
    }
  };

  const activeRoute = selectedRouteId === recommendedRoute?.route_id
    ? recommendedRoute
    : alternativeRoutes?.find((r) => r.route_id === selectedRouteId) || recommendedRoute;

  const activeCoords = activeRoute ? extractPolylineCoords(activeRoute.geometry) : [];

  const rawBounds = [];
  if (userLocation && !isNaN(userLocation.latitude) && !isNaN(userLocation.longitude)) {
    rawBounds.push([Number(userLocation.latitude), Number(userLocation.longitude)]);
  }
  if (recommendedDestination && !isNaN(recommendedDestination.latitude) && !isNaN(recommendedDestination.longitude)) {
    rawBounds.push([Number(recommendedDestination.latitude), Number(recommendedDestination.longitude)]);
  }
  activeCoords.forEach((pt) => {
    if (Array.isArray(pt) && pt.length === 2 && !isNaN(pt[0]) && !isNaN(pt[1])) {
      rawBounds.push(pt);
    }
  });

  const getRouteStyle = (route, isSelected) => {
    const isAvoid = route?.risk_classification === "AVOID" || route?.road_closure_status === "REPORTED_CLOSURE";
    const isHighRisk = route?.risk_classification === "HIGH RISK";
    const isCaution = route?.risk_classification === "USE CAUTION";

    if (isAvoid) {
      return {
        casingColor: "#7f1d1d",
        innerColor: "#ef4444",
        casingWeight: isSelected ? 11 : 7,
        innerWeight: isSelected ? 6 : 4
      };
    }
    if (isHighRisk) {
      return {
        casingColor: "#7c2d12",
        innerColor: "#f97316",
        casingWeight: isSelected ? 11 : 7,
        innerWeight: isSelected ? 6 : 4
      };
    }
    if (isCaution) {
      return {
        casingColor: "#78350f",
        innerColor: "#f59e0b",
        casingWeight: isSelected ? 11 : 7,
        innerWeight: isSelected ? 6 : 4
      };
    }

    // Default Lower Risk Navigation Blue/Purple
    return {
      casingColor: isSelected ? "#1e1b4b" : "#334155",
      innerColor: isSelected ? "#2563eb" : "#64748b",
      casingWeight: isSelected ? 11 : 7,
      innerWeight: isSelected ? 6 : 4
    };
  };

  const isOfficial = recommendedDestination?.verification_status === "VERIFIED_OFFICIAL";
  const destIcon = isOfficial ? officialDestinationIcon : unverifiedDestinationIcon;
  const samplePoints = activeRoute?.environmental_summary?.samples || [];

  const handleRecenterUser = () => {
    if (userLocation && !isNaN(userLocation.latitude) && !isNaN(userLocation.longitude)) {
      setFlyToCoords([Number(userLocation.latitude), Number(userLocation.longitude)]);
    }
  };

  const handleFitRouteBounds = () => {
    setFitTrigger((prev) => prev + 1);
  };

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const recMidpoint = getRouteMidpoint(activeCoords);
  const recEtaMinutes = activeRoute?.tomtom_traffic_eta_minutes || activeRoute?.mappls_eta_minutes || activeRoute?.eta_minutes;
  const recDistanceKm = activeRoute?.distance_km;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", minHeight: "580px" }}>
      {/* Top Map Navigation Bar & Search Overlay */}
      <div style={{
        position: "absolute",
        top: "14px",
        left: "14px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "360px",
        width: "calc(100% - 100px)"
      }}>
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "24px",
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)"
        }}>
          <Search size={16} className="text-sky-400" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search location or shelter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "13px",
              width: "100%"
            }}
          />
        </div>

        {/* Quick Filter Chips */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            style={{
              background: categoryFilter === "ALL" ? "#2563eb" : "var(--bg-card)",
              color: categoryFilter === "ALL" ? "#ffffff" : "var(--text-primary)",
              border: "1px solid var(--border-color)",
              padding: "4px 10px",
              borderRadius: "14px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}
          >
            📍 All Locations
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter("OFFICIAL")}
            style={{
              background: categoryFilter === "OFFICIAL" ? "#059669" : "var(--bg-card)",
              color: categoryFilter === "OFFICIAL" ? "#ffffff" : "var(--text-primary)",
              border: "1px solid var(--border-color)",
              padding: "4px 10px",
              borderRadius: "14px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}
          >
            🛡️ Official Shelters
          </button>
        </div>
      </div>

      <MapContainer
        center={[centerLat, centerLon]}
        zoom={13}
        style={{ width: "100%", height: "100%", borderRadius: "12px" }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        {/* OpenStreetMap Standard Basemap (100% Watermark Free, No API Key Required) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController bounds={rawBounds.length > 0 ? rawBounds : null} mapRef={mapRef} flyToCoords={flyToCoords} fitBoundsTrigger={fitTrigger} />

        {/* User Start Location Marker */}
        {userLocation && !isNaN(userLocation.latitude) && !isNaN(userLocation.longitude) && (
          <Marker position={[Number(userLocation.latitude), Number(userLocation.longitude)]} icon={userIcon}>
            <Popup>
              <div style={{ color: "#111827", fontWeight: "600", fontSize: "12px" }}>
                <strong style={{ color: "#2563eb", fontSize: "13px" }}>📍 CURRENT LOCATION (START)</strong>
                <div style={{ margin: "4px 0 2px 0" }}>
                  <span className={`status-pill ${userLocation.isLiveGPS ? "pill-green" : "pill-blue"}`}>
                    {userLocation.isLiveGPS ? "LIVE GPS ACTIVE" : "MANUAL LOCATION"}
                  </span>
                </div>
                {userLocation.accuracy && <div>GPS Accuracy: ±{Math.round(userLocation.accuracy)}m</div>}
                <div style={{ color: "#4b5563", fontSize: "11px", marginTop: "4px" }}>
                  Lat: {Number(userLocation.latitude).toFixed(5)}, Lon: {Number(userLocation.longitude).toFixed(5)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Shelter Destination Marker & Interactive Popup */}
        {recommendedDestination && !isNaN(recommendedDestination.latitude) && !isNaN(recommendedDestination.longitude) && (
          <Marker position={[Number(recommendedDestination.latitude), Number(recommendedDestination.longitude)]} icon={destIcon}>
            <Popup>
              <div style={{ color: "#111827", minWidth: "240px", fontSize: "12px", padding: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <strong style={{ color: isOfficial ? "#059669" : "#d97706", fontSize: "15px", lineHeight: "1.2" }}>
                    {recommendedDestination.name}
                  </strong>
                </div>

                <div style={{ margin: "4px 0 8px 0" }}>
                  {isOfficial ? (
                    <span className="badge-official" style={{ background: "#065f46", color: "#a7f3d0", padding: "3px 8px", borderRadius: "4px", fontWeight: "700", fontSize: "11px" }}>
                      🛡️ VERIFIED OFFICIAL SHELTER
                    </span>
                  ) : (
                    <span className="badge-unverified" style={{ background: "#78350f", color: "#fde68a", padding: "3px 8px", borderRadius: "4px", fontWeight: "700", fontSize: "11px" }}>
                      ⚠️ POTENTIAL SAFE FACILITY (UNVERIFIED)
                    </span>
                  )}
                </div>

                <div style={{ background: "#f3f4f6", padding: "8px", borderRadius: "6px", margin: "6px 0", border: "1px solid #e5e7eb" }}>
                  <div><strong>Authority:</strong> {recommendedDestination.authority || "Nilgiris District Administration"}</div>
                  <div><strong>Source:</strong> {recommendedDestination.source_document || recommendedDestination.source || "Official Registry"}</div>
                  <div><strong>Distance:</strong> {recommendedDestination.distance_km != null ? `${recommendedDestination.distance_km} km` : activeRoute?.distance_km ? `${activeRoute.distance_km} km` : "N/A"}</div>
                  <div><strong>Mappls ETA:</strong> {activeRoute?.mappls_eta_minutes ? `${activeRoute.mappls_eta_minutes} min` : "N/A"}</div>
                  <div><strong>Dest Safety Score:</strong> <span style={{ fontWeight: "700", color: "#059669" }}>{recommendedDestination.destination_safety_score ?? "N/A"}/100</span></div>
                  <div><strong>Route Safety Score:</strong> <span style={{ fontWeight: "700", color: "#2563eb" }}>{activeRoute?.safety_score ?? "N/A"}/100</span></div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (recommendedRoute) onSelectRoute(recommendedRoute.route_id);
                    handleFitRouteBounds();
                  }}
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    background: "#059669",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontWeight: "800",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <Navigation size={14} /> VIEW SAFE ROUTE
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Primary Navigation Route (Double Polyline Casing Technique) */}
        {recommendedRoute && extractPolylineCoords(recommendedRoute.geometry).length > 0 && (() => {
          const isSelected = selectedRouteId === recommendedRoute.route_id;
          const style = getRouteStyle(recommendedRoute, isSelected);
          const coords = extractPolylineCoords(recommendedRoute.geometry);

          return (
            <React.Fragment key="primary_rec_route">
              {/* Outer Polyline Casing */}
              <Polyline
                positions={coords}
                pathOptions={{
                  color: style.casingColor,
                  weight: style.casingWeight,
                  opacity: isSelected ? 0.95 : 0.5,
                  lineCap: "round",
                  lineJoin: "round"
                }}
              />

              {/* Inner Main Navigation Route */}
              <Polyline
                positions={coords}
                pathOptions={{
                  color: style.innerColor,
                  weight: style.innerWeight,
                  opacity: isSelected ? 1.0 : 0.7,
                  lineCap: "round",
                  lineJoin: "round"
                }}
                eventHandlers={{
                  click: () => onSelectRoute && onSelectRoute(recommendedRoute.route_id)
                }}
              >
                <Popup>
                  <div style={{ color: "#111827", fontSize: "12px" }}>
                    <strong style={{ color: "#059669", fontSize: "13px" }}>RECOMMENDED LOWER-RISK ROUTE</strong>
                    <div>Distance: {recommendedRoute?.distance_km} km</div>
                    <div>Mappls ETA: {recommendedRoute?.mappls_eta_minutes} min</div>
                    <div>TomTom Traffic ETA: {recommendedRoute?.tomtom_traffic_eta_minutes} min</div>
                    <div>Traffic Delay: {recommendedRoute?.traffic_delay_seconds > 0 ? `${Math.round(recommendedRoute.traffic_delay_seconds / 60)} min` : "None"}</div>
                    <div>Route Safety Score: {recommendedRoute?.safety_score}/100</div>
                    <div>Classification: <strong>{recommendedRoute?.risk_classification}</strong></div>
                  </div>
                </Popup>
              </Polyline>
            </React.Fragment>
          );
        })()}

        {/* Alternative Routes Polylines (Double Polyline Casing) */}
        {Array.isArray(alternativeRoutes) && alternativeRoutes.map((alt) => {
          const altCoords = extractPolylineCoords(alt.geometry);
          if (altCoords.length === 0) return null;
          const isSelected = selectedRouteId === alt.route_id;
          const style = getRouteStyle(alt, isSelected);

          return (
            <React.Fragment key={`alt_casing_${alt.route_id}`}>
              {/* Outer Casing */}
              <Polyline
                positions={altCoords}
                pathOptions={{
                  color: style.casingColor,
                  weight: isSelected ? 10 : 7,
                  opacity: isSelected ? 0.9 : 0.4,
                  lineCap: "round",
                  lineJoin: "round"
                }}
              />

              {/* Inner Polyline */}
              <Polyline
                positions={altCoords}
                pathOptions={{
                  color: style.innerColor,
                  weight: isSelected ? 6 : 4,
                  opacity: isSelected ? 1.0 : 0.6,
                  dashArray: isSelected ? undefined : "6, 8",
                  lineCap: "round",
                  lineJoin: "round"
                }}
                eventHandlers={{
                  click: () => onSelectRoute && onSelectRoute(alt.route_id)
                }}
              >
                <Popup>
                  <div style={{ color: "#111827", fontSize: "12px" }}>
                    <strong style={{ color: "#2563eb" }}>ALTERNATIVE ROUTE ({alt.provider || "Routing Provider"})</strong>
                    <div>Distance: {alt.distance_km} km</div>
                    <div>TomTom Traffic ETA: {alt.tomtom_traffic_eta_minutes || alt.eta_minutes} min</div>
                    <div>Safety Score: {alt.safety_score}/100</div>
                    <div>Classification: <strong>{alt.risk_classification}</strong></div>
                  </div>
                </Popup>
              </Polyline>
            </React.Fragment>
          );
        })}

        {/* Navigation Route ETA Callout Overlay Bubble */}
        {recMidpoint && recEtaMinutes != null && recDistanceKm != null && (
          <Marker
            position={recMidpoint}
            icon={createEtaCalloutIcon(recEtaMinutes, recDistanceKm, Boolean(activeRoute?.tomtom_traffic_eta_minutes))}
            interactive={false}
          />
        )}

        {/* Intermediate Environmental Route Sample Points */}
        {showSamplesLayer && Array.isArray(samplePoints) && samplePoints.map((sample, sIdx) => {
          if (!sample.latitude || !sample.longitude) return null;
          const prob = sample.flood_probability_percent ?? sample.flood_probability;
          const probVal = prob != null ? Math.round(prob) : null;
          const circleColor = probVal != null && probVal >= 60 ? "#ef4444" : probVal != null && probVal >= 40 ? "#f97316" : "#10b981";

          return (
            <CircleMarker
              key={`sample_${sIdx}`}
              center={[sample.latitude, sample.longitude]}
              radius={5}
              pathOptions={{
                color: "#ffffff",
                fillColor: circleColor,
                fillOpacity: 0.95,
                weight: 1.5
              }}
            >
              <Popup>
                <div style={{ color: "#111827", fontSize: "12px" }}>
                  <strong style={{ color: circleColor }}>ROUTE SAMPLE POINT #{sample.sample_index != null ? sample.sample_index + 1 : sIdx + 1}</strong>
                  <div>Flood Probability: {probVal != null ? `${probVal}%` : "UNAVAILABLE"}</div>
                  <div>Elevation: {sample.elevation_m != null ? `${sample.elevation_m} m` : "N/A"}</div>
                  <div>Slope: {sample.slope_degrees != null ? `${sample.slope_degrees}°` : "N/A"}</div>
                  <div>Landslide Exposure: {sample.landslide_exposure || "UNKNOWN"}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* TomTom Traffic Incidents & Reported Closures */}
        {showIncidentsLayer && Array.isArray(incidents) && incidents.map((inc, idx) => {
          const pos = extractCenterPoint(inc.geometry);
          if (!pos || isNaN(pos[0]) || isNaN(pos[1])) return null;

          const isClosure = inc.is_closure || inc.type === "ROAD_CLOSURE" || inc.road_closure_status === "REPORTED_CLOSURE";
          const isAccident = inc.type === "ACCIDENT" || inc.type === "INCIDENT";
          const isRoadworks = inc.type === "ROADWORKS";
          const isTestIncident = inc.source === "SIMULATED_TEST" || inc.verification_status === "TEST_ONLY";

          let iconToUse = closureIcon;
          if (isTestIncident) iconToUse = testClosureIcon;
          else if (isClosure) iconToUse = closureIcon;
          else if (isAccident) iconToUse = accidentIcon;
          else if (isRoadworks) iconToUse = roadworksIcon;

          return (
            <Marker key={inc.id || `inc_marker_${idx}`} position={pos} icon={iconToUse}>
              <Popup>
                <div style={{ color: "#111827", fontSize: "12px", minWidth: "200px" }}>
                  {isTestIncident ? (
                    <>
                      <strong style={{ color: "#d97706", fontSize: "13px" }}>⚠️ SIMULATED TEST CLOSURE</strong>
                      <div style={{ fontWeight: "700", color: "#b45309", fontSize: "10px", margin: "3px 0", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>
                        SIMULATED_TEST — NOT LIVE TOMTOM FEED
                      </div>
                      <div>Road: {inc.road_name || "Simulated Test Segment"}</div>
                      <div>Description: {inc.description}</div>
                    </>
                  ) : (
                    <>
                      <strong style={{ color: isClosure ? "#dc2626" : isAccident ? "#f97316" : "#eab308", fontSize: "13px" }}>
                        {isClosure ? "REPORTED ROAD CLOSURE" : `TOMTOM ${inc.type || "INCIDENT"}`}
                      </strong>
                      <div style={{ margin: "4px 0" }}>
                        <span className={`status-pill ${isClosure ? "pill-red" : "pill-amber"}`}>
                          {isClosure ? "REPORTED ROAD CLOSURE" : inc.severity || "MODERATE"}
                        </span>
                      </div>
                      <div>Road: {inc.road_name || "Monitored Segment"}</div>
                      <div>Description: {inc.description || "Reported Traffic Incident"}</div>
                      {inc.delay_seconds != null && <div>Delay: {Math.round(inc.delay_seconds / 60)} min</div>}
                      <div>Provider: TomTom Live Traffic</div>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Navigation Controls (Right Side) */}
      <div style={{ position: "absolute", top: "16px", right: "16px", zIndex: 1000, display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          type="button"
          onClick={handleZoomIn}
          className="map-nav-control-btn"
          title="Zoom In"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "800", fontSize: "18px" }}
        >
          +
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className="map-nav-control-btn"
          title="Zoom Out"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "800", fontSize: "18px" }}
        >
          -
        </button>

        <button
          type="button"
          onClick={handleRecenterUser}
          className="map-nav-control-btn"
          title="Recenter Map to My Location"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
        >
          <Locate size={18} className="text-sky-400" />
        </button>

        <button
          type="button"
          onClick={handleFitRouteBounds}
          className="map-nav-control-btn"
          title="Fit Map to Evacuation Route & Shelter"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
        >
          <Maximize2 size={18} className="text-emerald-400" />
        </button>
      </div>
    </div>
  );
}



