import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import DashboardHeader from "../components/DashboardHeader";
import MapLayerControl from "../components/MapLayerControl";
import LocationWeatherPanel from "../components/LocationWeatherPanel";
import ForecastTimeline from "../components/ForecastTimeline";
import MapLegend from "../components/MapLegend";
import { Activity, RefreshCw } from "lucide-react";
import "./LiveMonitor.css";

// Helper component to recenter map smoothly
function RecenterMap({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || 10, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

// Map Event Listener for Click Inspection and Viewport/Zoom tracking
function MapStateTracker({ onMapClick, onViewStateChange }) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
    moveend() {
      onViewStateChange(map.getZoom(), map.getBounds());
    },
    zoomend() {
      onViewStateChange(map.getZoom(), map.getBounds());
    },
  });

  useEffect(() => {
    if (map) {
      onViewStateChange(map.getZoom(), map.getBounds());
    }
  }, [map]);

  return null;
}

// Convert wind direction in degrees to flow direction compass arrow symbol
function getWindArrow(deg) {
  if (deg === null || deg === undefined) return "";
  // Meteorological wind direction is direction FROM which wind blows.
  // The arrow indicates flow direction (towards which wind moves).
  const flowDeg = (deg + 180) % 360;
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  const idx = Math.round(flowDeg / 45) % 8;
  return arrows[idx];
}

// Function to create ultra-compact Zoom Earth style pill marker icons
function createBadgeIcon(cityName, valueText, isSelected, isFloodLoc, statusColor) {
  const colorHex = statusColor || "var(--color-accent)";
  return L.divIcon({
    className: "custom-map-badge-marker",
    html: `
      <div class="map-badge-container ${isSelected ? "selected-badge" : ""} ${isFloodLoc ? "flood-loc-badge" : ""}">
        <span class="map-badge-city">${cityName}</span>
        <span class="map-badge-val" style="color: ${colorHex}">${valueText}</span>
      </div>
    `,
    iconSize: [80, 24],
    iconAnchor: [40, 12],
  });
}

function LiveMonitorDashboard({
  result,
  selectedLocation,
  locations,
  onLocationChange,
  loading,
  error,
  theme,
  onToggleTheme,
}) {
  const [activeLayer, setActiveLayer] = useState("temperature");
  const [activeTimeline, setActiveTimeline] = useState("now");
  const [mapCenter, setMapCenter] = useState([22.5, 79.0]); // Initial India Center
  const [mapZoom, setMapZoom] = useState(5); // Initial India Zoom

  // Viewport tracking for zoom-dependent density & bounds filtering
  const [currentZoom, setCurrentZoom] = useState(5);
  const [currentBounds, setCurrentBounds] = useState(null);

  // India-wide lightweight data states
  const [cityList, setCityList] = useState([]);
  const [gridPoints, setGridPoints] = useState([]);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Clicked arbitrary point state
  const [clickedPoint, setClickedPoint] = useState(null);
  const [clickedPointWeather, setClickedPointWeather] = useState(null);
  const [loadingPoint, setLoadingPoint] = useState(false);

  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
    []
  );

  // Fetch lightweight India weather grid & 115+ cities/districts
  useEffect(() => {
    let isMounted = true;
    const fetchIndiaWeatherData = async () => {
      try {
        setLoadingWeather(true);
        const [citiesRes, gridRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/weather-cities`),
          fetch(`${apiBaseUrl}/api/weather-grid`),
        ]);

        if (citiesRes.ok) {
          const cData = await citiesRes.json();
          if (isMounted && cData.cities) setCityList(cData.cities);
        }

        if (gridRes.ok) {
          const gData = await gridRes.json();
          if (isMounted && gData.points) setGridPoints(gData.points);
        }
      } catch (err) {
        console.error("India weather fetch error:", err);
      } finally {
        if (isMounted) setLoadingWeather(false);
      }
    };

    fetchIndiaWeatherData();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  // Handle view state changes (zoom & bounds) for zoom-dependent label density
  const handleViewStateChange = useCallback((zoom, bounds) => {
    setCurrentZoom(zoom);
    setCurrentBounds(bounds);
  }, []);

  // Handle map click for arbitrary coordinate weather inspection
  const handleMapClick = async (lat, lon) => {
    setClickedPoint({ lat, lon });
    setLoadingPoint(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/weather-point?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        setClickedPointWeather({
          latitude: lat,
          longitude: lon,
          name: `Lat ${lat.toFixed(2)}°, Lon ${lon.toFixed(2)}°`,
          weather: data.weather,
        });
      }
    } catch (err) {
      console.error("Point weather error:", err);
    } finally {
      setLoadingPoint(false);
    }
  };

  // Handle location search selection
  const handleCitySearchSelect = (city) => {
    setMapCenter([city.latitude, city.longitude]);
    setMapZoom(9);
    setClickedPoint(null);
    setClickedPointWeather(null);

    const matchedFloodLoc = locations.find((l) => l.name.toLowerCase() === city.name.toLowerCase());
    if (matchedFloodLoc) {
      onLocationChange(matchedFloodLoc);
    } else {
      handleMapClick(city.latitude, city.longitude);
    }
  };

  const getRiskColor = (prob) => {
    const p = Number(prob);
    if (isNaN(p)) return "#82cfff";
    if (p < 30) return "#22c55e";
    if (p < 60) return "#f5a623";
    if (p < 80) return "#f97316";
    return "#ef5350";
  };

  const riskColor = useMemo(() => {
    if (!result?.prediction) return "#82cfff";
    return getRiskColor(result.prediction.flood_probability_percent);
  }, [result]);

  // Format metric text and layer-driven color classification
  const getMetricDisplay = (weatherObj, satObj, terrainObj, predObj) => {
    const w = weatherObj || {};
    const sat = satObj || {};
    const t = terrainObj || {};
    const p = predObj || {};

    switch (activeLayer) {
      case "temperature": {
        const temp = w.temperature_c;
        if (temp === undefined || temp === null) return { text: "N/A", color: "#94a3b8" };
        let col = "#38bdf8"; // <10°C cool blue
        if (temp >= 35) col = "#dc2626"; // >35°C red
        else if (temp >= 30) col = "#ef4444"; // 30-35°C orange/red
        else if (temp >= 25) col = "#f97316"; // 25-30°C orange
        else if (temp >= 20) col = "#eab308"; // 20-25°C yellow
        else if (temp >= 10) col = "#22c55e"; // 10-20°C green
        return { text: `${Math.round(temp)}°`, color: col };
      }
      case "rainfall": {
        const rain = w.precipitation_mm !== undefined && w.precipitation_mm !== null ? w.precipitation_mm : (w.rain_24h_mm || 0);
        let col = "#82cfff";
        if (rain > 15) col = "#d946ef";
        else if (rain > 5) col = "#8b5cf6";
        else if (rain > 2) col = "#3b82f6";
        return { text: `${rain} mm`, color: col };
      }
      case "satellite_rainfall": {
        const satVal = sat.current_intensity_mm_hr;
        if (satVal === undefined || satVal === null) return { text: "N/A", color: "#ef5350" };
        let col = "#a855f7";
        if (satVal > 5) col = "#ef4444";
        else if (satVal > 2) col = "#ec4899";
        return { text: `${satVal} mm/h`, color: col };
      }
      case "wind": {
        const speed = w.wind_speed_kmh;
        const deg = w.wind_direction_deg;
        if (speed === undefined || speed === null) return { text: "N/A", color: "#94a3b8" };
        let col = "#38bdf8";
        if (speed >= 60) col = "#dc2626";
        else if (speed >= 40) col = "#f97316";
        else if (speed >= 20) col = "#eab308";
        else if (speed >= 10) col = "#22c55e";
        const arrow = getWindArrow(deg);
        return { text: `${Math.round(speed)} ${arrow}`, color: col };
      }
      case "humidity": {
        const h = w.humidity_percent;
        if (h === undefined || h === null) return { text: "N/A", color: "#94a3b8" };
        let col = "#38bdf8";
        if (h > 70) col = "#2563eb";
        return { text: `${h}%`, color: col };
      }
      case "terrain": {
        const elev = t.elevation_m;
        if (elev === undefined || elev === null) return { text: "N/A", color: "#94a3b8" };
        return { text: `${elev}m`, color: "#10b981" };
      }
      case "flood_risk": {
        const risk = p.risk_level || "LOW";
        const prob = p.flood_probability_percent;
        const col = getRiskColor(prob);
        return { text: risk, color: col };
      }
      default:
        return { text: "N/A", color: "var(--text-secondary)" };
    }
  };

  const displayCities = useMemo(() => {
    if (cityList.length > 0) return cityList;
    return locations.map((loc) => ({ ...loc, weather: result?.environmental_data?.weather || {} }));
  }, [cityList, locations, result]);

  // Viewport & Zoom-dependent filtering for decluttered label rendering
  const visibleCities = useMemo(() => {
    if (!displayCities || displayCities.length === 0) return [];

    return displayCities.filter((city) => {
      const p = city.priority || 3;
      if (currentZoom <= 5 && p > 1) return false;
      if (currentZoom === 6 && p > 2) return false;

      if (currentBounds) {
        const inBounds = currentBounds.contains([city.latitude, city.longitude]);
        if (!inBounds && !city.isSupportedFloodLoc) return false;
      }

      return true;
    });
  }, [displayCities, currentZoom, currentBounds]);

  const sourceHealth = result?.metadata?.source_health || {};

  return (
    <div className="main-content" style={{ padding: "16px", display: "flex", flexDirection: "column" }}>
      <DashboardHeader
        selectedLocation={selectedLocation}
        locations={locations}
        onLocationChange={(loc) => {
          onLocationChange(loc);
          setMapCenter([loc.latitude, loc.longitude]);
          setMapZoom(10);
          setClickedPoint(null);
          setClickedPointWeather(null);
        }}
        loading={loading}
        theme={theme}
        onToggleTheme={onToggleTheme}
        allCities={displayCities}
        onCitySearchSelect={handleCitySearchSelect}
      />

      {error && <div className="error-box">⚠ {error}</div>}

      <div className="live-monitor-wrapper">
        <div className="live-monitor-container">
          {/* Status Banner */}
          {(loading || loadingWeather || loadingPoint) && (
            <div className="live-status-banner">
              <RefreshCw size={14} className="spin-icon" style={{ animation: "spin 1s linear infinite" }} />
              <span>
                {loadingPoint
                  ? "Inspecting location weather..."
                  : "Fetching India-wide Open-Meteo live weather..."}
              </span>
            </div>
          )}

          {/* Full Interactive Map */}
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            className="live-map-instance"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <RecenterMap center={mapCenter} zoom={mapZoom} />
            <MapStateTracker onMapClick={handleMapClick} onViewStateChange={handleViewStateChange} />

            {/* Render Sampling Grid Circles for India-wide Weather Layers */}
            {gridPoints.map((pt, idx) => {
              const metric = getMetricDisplay(pt, null, null, null);
              return (
                <CircleMarker
                  key={`grid-${idx}`}
                  center={[pt.latitude, pt.longitude]}
                  radius={currentZoom <= 5 ? 5 : 8}
                  pathOptions={{
                    fillColor: metric.color,
                    fillOpacity: activeLayer === "wind" ? 0.4 : 0.55,
                    stroke: true,
                    color: "#ffffff",
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: "12px", color: "#0f172a" }}>
                      <strong>Grid Sampling Point</strong>
                      <div>Lat: {pt.latitude}°, Lon: {pt.longitude}°</div>
                      <div>
                        {activeLayer.toUpperCase()}: <strong>{metric.text}</strong>
                      </div>
                      {pt.wind_direction_deg !== undefined && pt.wind_direction_deg !== null && (
                        <div>Wind Direction: <strong>{pt.wind_direction_deg}° {getWindArrow(pt.wind_direction_deg)}</strong></div>
                      )}
                      <div>Source: Open-Meteo (Real Wind Grid Sample)</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Render Ultra-Compact City Badges based on Zoom Density & Viewport */}
            {visibleCities.map((city) => {
              const isSelected = selectedLocation && city.name.toLowerCase() === selectedLocation.name.toLowerCase();
              const isFloodLoc = locations.some((l) => l.name.toLowerCase() === city.name.toLowerCase());
              const locData = isSelected ? result : null;
              const weatherObj = city.weather || locData?.environmental_data?.weather || {};
              const satObj = locData?.environmental_data?.satellite_rainfall || {};
              const terrainObj = locData?.environmental_data?.terrain || {};
              const predObj = locData?.prediction || {};

              const metric = getMetricDisplay(weatherObj, satObj, terrainObj, predObj);
              const badgeIcon = createBadgeIcon(city.name, metric.text, isSelected, isFloodLoc, metric.color);

              return (
                <Marker
                  key={city.name}
                  position={[city.latitude, city.longitude]}
                  icon={badgeIcon}
                  eventHandlers={{
                    click: () => {
                      if (isFloodLoc) {
                        const target = locations.find((l) => l.name.toLowerCase() === city.name.toLowerCase());
                        if (target) onLocationChange(target);
                      }
                      handleMapClick(city.latitude, city.longitude);
                    },
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: "190px", color: "#0f172a" }}>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 800 }}>
                        {city.name}, {city.state}
                      </h4>
                      <div style={{ fontSize: "12px", color: "#0284c7", marginBottom: "6px" }}>
                        {isFloodLoc ? "Supported Flash-Flood Location" : "District / City Weather Observation"}
                      </div>
                      <hr style={{ borderColor: "#e2e8f0", margin: "6px 0" }} />
                      <div style={{ fontSize: "11px", lineHeight: "1.6" }}>
                        <div><strong>Wind Speed:</strong> {weatherObj.wind_speed_kmh !== null ? `${weatherObj.wind_speed_kmh} km/h` : "N/A"}</div>
                        <div><strong>Wind Direction:</strong> {weatherObj.wind_direction_deg !== null ? `${weatherObj.wind_direction_deg}° ${getWindArrow(weatherObj.wind_direction_deg)}` : "N/A"}</div>
                        <div><strong>Temperature:</strong> {weatherObj.temperature_c !== null ? `${weatherObj.temperature_c}°C` : "N/A"}</div>
                        <div><strong>Humidity:</strong> {weatherObj.humidity_percent !== null ? `${weatherObj.humidity_percent}%` : "N/A"}</div>
                        <div><strong>Precipitation:</strong> {weatherObj.precipitation_mm !== null ? `${weatherObj.precipitation_mm} mm` : "N/A"}</div>
                        {weatherObj.observation_time && (
                          <div style={{ marginTop: "4px", color: "#64748b" }}>
                            Obs: {weatherObj.observation_time}
                          </div>
                        )}
                        <div style={{ marginTop: "4px", fontWeight: 600, color: "#16a34a" }}>
                          Source: Open-Meteo
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Clicked arbitrary point marker */}
            {clickedPoint && (
              <Marker position={[clickedPoint.lat, clickedPoint.lon]}>
                <Popup>
                  <div style={{ minWidth: "190px", color: "#0f172a" }}>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: 800 }}>
                      INSPECTED COORDINATE
                    </h4>
                    <div style={{ fontSize: "11px", color: "#475569" }}>
                      {clickedPoint.lat.toFixed(4)}°N, {clickedPoint.lon.toFixed(4)}°E
                    </div>
                    <hr style={{ borderColor: "#e2e8f0", margin: "6px 0" }} />
                    {clickedPointWeather?.weather ? (
                      <div style={{ fontSize: "11px", lineHeight: "1.6" }}>
                        <div><strong>Wind Speed:</strong> {clickedPointWeather.weather.wind_speed_kmh} km/h</div>
                        <div><strong>Wind Direction:</strong> {clickedPointWeather.weather.wind_direction_deg}° {getWindArrow(clickedPointWeather.weather.wind_direction_deg)}</div>
                        <div><strong>Temperature:</strong> {clickedPointWeather.weather.temperature_c} °C</div>
                        <div><strong>Humidity:</strong> {clickedPointWeather.weather.humidity_percent} %</div>
                        <div><strong>Precipitation:</strong> {clickedPointWeather.weather.precipitation_mm} mm</div>
                        <div style={{ marginTop: "4px", fontWeight: 600, color: "#16a34a" }}>
                          Source: Open-Meteo (Lightweight Point API)
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: "11px" }}>Loading weather...</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Floating Overlay Controls */}
          <MapLayerControl activeLayer={activeLayer} onSelectLayer={setActiveLayer} />
          <LocationWeatherPanel
            result={result}
            selectedLocation={selectedLocation}
            activeTimeline={activeTimeline}
            riskColor={riskColor}
            clickedPointWeather={clickedPointWeather}
            activeLayer={activeLayer}
          />
          <ForecastTimeline activeTimeline={activeTimeline} onSelectTimeline={setActiveTimeline} />
          <MapLegend activeLayer={activeLayer} />

          {/* Source Health Floating Panel */}
          <div className="source-health-panel">
            <div className="source-health-item">
              <span className="source-dot" style={{ background: "#16a34a" }} />
              <span>India Weather: Open-Meteo Real Wind Vectors</span>
            </div>
            <div className="source-health-item">
              <span className={`source-dot ${sourceHealth.soil_moisture?.freshness?.toLowerCase() || ""}`} />
              <span>NASA SMAP: {sourceHealth.soil_moisture?.freshness || "STALE"}</span>
            </div>
            <div className="source-health-item">
              <span className={`source-dot ${sourceHealth.satellite_rainfall?.freshness?.toLowerCase() || ""}`} />
              <span>NASA GPM: {sourceHealth.satellite_rainfall?.freshness || "STALE"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveMonitorDashboard;
