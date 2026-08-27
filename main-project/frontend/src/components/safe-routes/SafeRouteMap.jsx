import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";

const createCustomIcon = (color, type = "pin", iconInner = "") => {
  let svg = "";
  if (type === "shield") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="2.5"></path>
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
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
      </svg>`;
  }

  return L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;transform:translate(-50%, -100%);">${svg}</div>`,
    className: "custom-leaflet-marker",
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
  });
};

const userIcon = createCustomIcon("#2563eb", "pin"); // Blue (User Location)
const officialDestinationIcon = createCustomIcon("#059669", "shield"); // Emerald Green Shield (Verified Official Shelter)
const unverifiedDestinationIcon = createCustomIcon("#f59e0b", "pin"); // Yellow/Amber Pin (Unverified Potential Facility)
const closureIcon = createCustomIcon("#dc2626", "closure"); // Red (Reported Road Closure)
const accidentIcon = createCustomIcon("#f97316", "accident"); // Orange (Accident)
const roadworksIcon = createCustomIcon("#eab308", "roadworks"); // Yellow (Roadworks)
const testClosureIcon = createCustomIcon("#d97706", "closure"); // Amber (Simulated Test Incident)

function MapController({ bounds }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (err) {}
    }, 200);

    if (bounds && Array.isArray(bounds) && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } catch (err) {
        console.warn("Leaflet fitBounds error:", err.message);
      }
    }
    return () => clearTimeout(timer);
  }, [bounds, map]);
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

export default function SafeRouteMap({
  userLocation,
  recommendedDestination,
  recommendedRoute,
  alternativeRoutes = [],
  selectedRouteId,
  onSelectRoute,
  hazardZones = [],
  incidents = []
}) {
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

  const recCoords = recommendedRoute ? extractPolylineCoords(recommendedRoute.geometry) : [];

  const rawBounds = [];
  if (userLocation && !isNaN(userLocation.latitude) && !isNaN(userLocation.longitude)) {
    rawBounds.push([Number(userLocation.latitude), Number(userLocation.longitude)]);
  }
  if (recommendedDestination && !isNaN(recommendedDestination.latitude) && !isNaN(recommendedDestination.longitude)) {
    rawBounds.push([Number(recommendedDestination.latitude), Number(recommendedDestination.longitude)]);
  }
  recCoords.forEach((pt) => {
    if (Array.isArray(pt) && pt.length === 2 && !isNaN(pt[0]) && !isNaN(pt[1])) {
      rawBounds.push(pt);
    }
  });

  const getRouteColor = (route, isSelected) => {
    if (route?.risk_classification === "AVOID" || route?.road_closure_status === "REPORTED_CLOSURE") return "#ef4444"; // Red
    if (route?.risk_classification === "HIGH RISK") return "#f97316"; // Orange
    if (route?.risk_classification === "USE CAUTION") return "#eab308"; // Yellow/Amber
    return isSelected ? "#06b6d4" : "#10b981"; // Cyan / Emerald for Lower Risk
  };

  const isOfficial = recommendedDestination?.verification_status === "VERIFIED_OFFICIAL";
  const destIcon = isOfficial ? officialDestinationIcon : unverifiedDestinationIcon;

  // Extract route sample points from environmental_summary if available
  const samplePoints = recommendedRoute?.environmental_summary?.samples || [];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", minHeight: "500px" }}>
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={13}
        style={{ width: "100%", height: "100%", borderRadius: "12px" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController bounds={rawBounds.length > 0 ? rawBounds : null} />

        {/* User Location Marker */}
        {userLocation && !isNaN(userLocation.latitude) && !isNaN(userLocation.longitude) && (
          <Marker position={[Number(userLocation.latitude), Number(userLocation.longitude)]} icon={userIcon}>
            <Popup>
              <div style={{ color: "#111827", fontWeight: "600", fontSize: "12px" }}>
                <strong style={{ color: "#2563eb", fontSize: "13px" }}>📍 CURRENT USER LOCATION</strong>
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

        {/* Destination Marker */}
        {recommendedDestination && !isNaN(recommendedDestination.latitude) && !isNaN(recommendedDestination.longitude) && (
          <Marker position={[Number(recommendedDestination.latitude), Number(recommendedDestination.longitude)]} icon={destIcon}>
            <Popup>
              <div style={{ color: "#111827", minWidth: "220px", fontSize: "12px" }}>
                <strong style={{ color: isOfficial ? "#059669" : "#d97706", fontSize: "14px" }}>
                  {recommendedDestination.name} {isOfficial ? "🛡️" : ""}
                </strong>
                <div style={{ margin: "4px 0" }}>
                  {isOfficial ? (
                    <span className="badge-official" style={{ background: "#065f46", color: "#a7f3d0", padding: "2px 8px", borderRadius: "4px", fontWeight: "700", fontSize: "11px" }}>
                      VERIFIED OFFICIAL SHELTER
                    </span>
                  ) : (
                    <span className="badge-unverified" style={{ background: "#78350f", color: "#fde68a", padding: "2px 8px", borderRadius: "4px", fontWeight: "700", fontSize: "11px" }}>
                      POTENTIAL SAFE FACILITY (UNVERIFIED)
                    </span>
                  )}
                </div>
                {isOfficial && (
                  <>
                    <div><strong>Authority:</strong> {recommendedDestination.authority || "Nilgiris District Administration"}</div>
                    <div><strong>Source:</strong> {recommendedDestination.source_document || recommendedDestination.source}</div>
                    <div><strong>Precision:</strong> {recommendedDestination.spatial_precision || "POI / Building Level"}</div>
                  </>
                )}
                {recommendedDestination.elevation_m != null && <div><strong>Elevation:</strong> {recommendedDestination.elevation_m} m</div>}
                <div><strong>Destination Safety Score:</strong> {recommendedDestination.destination_safety_score ?? "N/A"}/100</div>
                <div><strong>Flood Risk:</strong> {recommendedDestination.flood_risk || "UNKNOWN"}</div>
                <div><strong>Landslide Risk:</strong> {recommendedDestination.landslide_risk || "UNKNOWN"}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Recommended Safest Route Polyline */}
        {recCoords.length > 0 && (
          <Polyline
            positions={recCoords}
            pathOptions={{
              color: getRouteColor(recommendedRoute, selectedRouteId === recommendedRoute?.route_id),
              weight: 7,
              opacity: 0.95
            }}
            eventHandlers={{
              click: () => onSelectRoute && onSelectRoute(recommendedRoute?.route_id)
            }}
          >
            <Popup>
              <div style={{ color: "#111827", fontSize: "12px" }}>
                <strong style={{ color: "#059669", fontSize: "13px" }}>RECOMMENDED LOWER-RISK ROUTE</strong>
                <div>Distance: {recommendedRoute?.distance_km} km</div>
                <div>Mappls ETA: {recommendedRoute?.mappls_eta_minutes} min</div>
                <div>TomTom Traffic ETA: {recommendedRoute?.tomtom_traffic_eta_minutes} min</div>
                <div>Traffic Delay: {recommendedRoute?.traffic_delay_seconds > 0 ? `${Math.round(recommendedRoute.traffic_delay_seconds / 60)} min` : "None"}</div>
                <div>Safety Score: {recommendedRoute?.safety_score}/100</div>
                <div>Classification: <strong>{recommendedRoute?.risk_classification}</strong></div>
              </div>
            </Popup>
          </Polyline>
        )}

        {/* Intermediate Environmental Route Sample Points */}
        {Array.isArray(samplePoints) && samplePoints.map((sample, sIdx) => {
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
                fillOpacity: 0.9,
                weight: 1.5
              }}
            >
              <Popup>
                <div style={{ color: "#111827", fontSize: "12px" }}>
                  <strong style={{ color: circleColor }}>ROUTE SAMPLE POINT #{sample.sample_index != null ? sample.sample_index + 1 : sIdx + 1}</strong>
                  <div>Flood Probability: {probVal != null ? `${probVal}%` : "UNAVAILABLE"}</div>
                  <div>Elevation: {sample.elevation_m != null ? `${sample.elevation_m} m` : "N/A"}</div>
                  <div>Slope: {sample.slope_degrees != null ? `${sample.slope_degrees}°` : "N/A"}</div>
                  <div>Landslide Exposure: {sample.landslide_exposure || "LOW"}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Alternative Routes Polylines */}
        {Array.isArray(alternativeRoutes) && alternativeRoutes.map((alt) => {
          const altCoords = extractPolylineCoords(alt.geometry);
          if (altCoords.length === 0) return null;
          const isSelected = selectedRouteId === alt.route_id;

          return (
            <Polyline
              key={alt.route_id}
              positions={altCoords}
              pathOptions={{
                color: getRouteColor(alt, isSelected),
                weight: isSelected ? 6 : 4,
                dashArray: "5, 8",
                opacity: isSelected ? 0.9 : 0.7
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
          );
        })}

        {/* TomTom Traffic Incidents & Reported Closures */}
        {Array.isArray(incidents) && incidents.map((inc, idx) => {
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
    </div>
  );
}

