import React, { useState, useEffect, useCallback, Component } from "react";
import DashboardHeader from "../components/DashboardHeader";
import SafeRouteMap from "../components/safe-routes/SafeRouteMap";
import RouteSummaryPanel from "../components/safe-routes/RouteSummaryPanel";
import RouteAlternatives from "../components/safe-routes/RouteAlternatives";
import HazardStatusPanel from "../components/safe-routes/HazardStatusPanel";
import DataSourceHealth from "../components/safe-routes/DataSourceHealth";
import { Locate, RefreshCw, AlertTriangle, ShieldCheck, MapPin, TestTube, Layers, Info, CheckCircle2 } from "lucide-react";

class SafeRoutesErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SafeRoutes Error Boundary caught an exception:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert-banner alert-banner-error" style={{ padding: "20px", margin: "20px 0" }}>
          <AlertTriangle size={24} style={{ marginRight: "10px" }} />
          <div>
            <strong>Route visualization temporarily degraded for this region.</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
              Route data is temporarily unavailable or returned invalid geometry for this region. Select another region or retry.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SafeRoutesDashboard({
  locations = [],
  selectedLocation,
  onLocationChange,
  theme,
  onToggleTheme
}) {
  const [userLocation, setUserLocation] = useState({
    latitude: Number(selectedLocation?.latitude) || 11.3533,
    longitude: Number(selectedLocation?.longitude) || 76.7959,
    accuracy: null,
    isLiveGPS: false
  });

  const [routeResult, setRouteResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(selectedLocation ? `Region: ${selectedLocation.name}, ${selectedLocation.state}` : "Using Coordinates");
  const [testMode, setTestMode] = useState(false);

  const loadingStages = [
    "Finding verified official shelters...",
    "Evaluating destination hazards & elevation...",
    "Generating road polylines via Mappls...",
    "Checking live TomTom traffic & reported closures...",
    "Analyzing intermediate route hazard exposure...",
    "Ranking safest evacuation options..."
  ];

  useEffect(() => {
    if (selectedLocation && !userLocation.isLiveGPS) {
      setUserLocation({
        latitude: Number(selectedLocation.latitude),
        longitude: Number(selectedLocation.longitude),
        accuracy: null,
        isLiveGPS: false
      });
      setGpsStatus(`MANUAL LOCATION: ${selectedLocation.name}, ${selectedLocation.state}`);
    }
  }, [selectedLocation]);

  const fetchSafeRoute = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingStage(0);
      setError("");

      const interval = setInterval(() => {
        setLoadingStage((prev) => (prev < loadingStages.length - 1 ? prev + 1 : prev));
      }, 400);

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${apiBaseUrl}/api/safe-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: Number(userLocation.latitude),
          longitude: Number(userLocation.longitude),
          name: selectedLocation?.name,
          state: selectedLocation?.state,
          country: selectedLocation?.country,
          testMode: testMode
        })
      });

      clearInterval(interval);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to retrieve evacuation route");
      }

      setRouteResult(data);
      if (data.recommended_route) {
        setSelectedRouteId(data.recommended_route.route_id);
      }
    } catch (err) {
      console.error("Evacuation route error:", err);
      setError(err.message || "Route data is temporarily unavailable for this region.");
    } finally {
      setLoading(false);
    }
  }, [userLocation, selectedLocation, testMode]);

  useEffect(() => {
    fetchSafeRoute();
  }, [fetchSafeRoute]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchSafeRoute();
    }, 180000);
    return () => clearInterval(timer);
  }, [fetchSafeRoute]);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setGpsStatus("Detecting live device GPS...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({
          latitude: Number(latitude),
          longitude: Number(longitude),
          accuracy,
          isLiveGPS: true
        });
        setGpsStatus(`LIVE GPS ACTIVE (±${Math.round(accuracy)}m accuracy)`);
      },
      (err) => {
        console.warn("GPS detection error:", err.message);
        setGpsStatus("GPS permission denied. Using manual location.");
        setError("GPS permission denied or unavailable. Please select location manually.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const currentRoute = selectedRouteId === routeResult?.recommended_route?.route_id
    ? routeResult?.recommended_route
    : routeResult?.alternative_routes?.find((r) => r.route_id === selectedRouteId) || routeResult?.recommended_route;

  return (
    <div className="main-content safe-routes-layout">
      <DashboardHeader
        selectedLocation={selectedLocation}
        locations={locations}
        onLocationChange={(loc) => {
          setUserLocation({ latitude: Number(loc.latitude), longitude: Number(loc.longitude), accuracy: null, isLiveGPS: false });
          onLocationChange(loc);
        }}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <div className="dashboard-body">
        {/* Top Controls Toolbar */}
        <div className="routes-toolbar">
          <div className="toolbar-left">
            <div className="title-block">
              <ShieldCheck size={24} className="text-emerald-500" />
              <h2>Safe Evacuation Routes GIS</h2>
            </div>
            <span className={`gps-status-badge ${userLocation.isLiveGPS ? "badge-green" : ""}`}>
              <MapPin size={14} /> {userLocation.isLiveGPS ? "LIVE GPS" : "MANUAL LOCATION"}: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            </span>
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className={`btn-gps ${testMode ? "bg-amber-600" : ""}`}
              style={{ background: testMode ? "#d97706" : undefined }}
              onClick={() => setTestMode(!testMode)}
              title="Toggle Development Rerouting Validation Mode"
            >
              <TestTube size={16} /> {testMode ? "Test Mode: ACTIVE" : "Validation Mode"}
            </button>

            <button type="button" className="btn-gps" onClick={handleDetectGPS}>
              <Locate size={16} /> Use My Location
            </button>

            <button
              type="button"
              className="btn-refresh"
              onClick={fetchSafeRoute}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              {loading ? "Calculating..." : "Recalculate Route"}
            </button>
          </div>
        </div>

        {testMode && (
          <div className="alert-banner" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
            <AlertTriangle size={18} />
            <span>
              <strong>DEVELOPMENT VALIDATION MODE ACTIVE:</strong> A test road closure has been simulated on the primary route to validate dynamic rerouting. All test data is explicitly tagged <code>SIMULATED_TEST</code>.
            </span>
          </div>
        )}

        {error && (
          <div className="alert-banner alert-banner-error">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div style={{ background: "rgba(15, 23, 42, 0.85)", border: "1px solid #38bdf8", padding: "16px 20px", borderRadius: "10px", color: "#ffffff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
            <RefreshCw size={24} className="spin text-sky-400" />
            <div>
              <strong style={{ fontSize: "14px" }}>Analyzing evacuation routes & dynamic hazards...</strong>
              <div style={{ fontSize: "12px", color: "#93c5fd", marginTop: "2px" }}>
                {loadingStages[loadingStage]}
              </div>
            </div>
          </div>
        )}

        {/* Safety Disclaimer Banner */}
        <div className="safety-disclaimer-banner">
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            {routeResult?.disclaimer ||
              "Recommended lower-risk evacuation route based on the latest available routing, traffic, environmental, hazard and official shelter data. Physical conditions may change rapidly during emergencies. Follow official evacuation instructions where available."}
          </span>
        </div>

        {/* Core Layout Grid */}
        <SafeRoutesErrorBoundary>
          <div className="routes-grid-container">
            <div className="map-column" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, minHeight: "520px" }}>
                <SafeRouteMap
                  userLocation={userLocation}
                  recommendedDestination={routeResult?.recommended_destination}
                  recommendedRoute={routeResult?.recommended_route}
                  alternativeRoutes={routeResult?.alternative_routes || []}
                  selectedRouteId={selectedRouteId}
                  onSelectRoute={setSelectedRouteId}
                  hazardZones={routeResult?.hazard_zones || []}
                  incidents={routeResult?.incidents || []}
                />
              </div>

              {/* Map Legend */}
              <div className="map-legend-bar" style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border-color)", padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: "12px 18px", fontSize: "11px", color: "var(--text-primary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2563eb", display: "inline-block" }}></span>
                  <span>User Location</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#059669", fontWeight: "700" }}>🛡️ Green</span>
                  <span>Verified Official Shelter</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#f59e0b", fontWeight: "700" }}>📍 Yellow</span>
                  <span>Unverified Potential Facility</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "16px", height: "4px", background: "#10b981", borderRadius: "2px", display: "inline-block" }}></span>
                  <span>Recommended Lower-Risk Route</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "16px", height: "4px", background: "#06b6d4", borderRadius: "2px", display: "inline-block" }}></span>
                  <span>Alternative Route</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "16px", height: "4px", background: "#f97316", borderRadius: "2px", display: "inline-block" }}></span>
                  <span>High Risk / Caution</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "16px", height: "4px", background: "#ef4444", borderRadius: "2px", display: "inline-block" }}></span>
                  <span>Avoid / Reported Closure</span>
                </div>
              </div>
            </div>

            <div className="details-column">
              <RouteSummaryPanel
                route={currentRoute}
                destination={routeResult?.recommended_destination}
                generatedAt={routeResult?.generated_at}
                routingProvider={routeResult?.routing_provider}
                routingMode={routeResult?.routing_mode}
              />

              <RouteAlternatives
                recommendedRoute={routeResult?.recommended_route}
                alternativeRoutes={routeResult?.alternative_routes}
                selectedRouteId={selectedRouteId}
                onSelectRoute={setSelectedRouteId}
              />

              <HazardStatusPanel
                hazardZones={routeResult?.hazard_zones}
                incidents={routeResult?.incidents}
                routingStatus={routeResult?.routing_status}
              />

              <DataSourceHealth health={routeResult?.source_health} />
            </div>
          </div>
        </SafeRoutesErrorBoundary>
      </div>
    </div>
  );
}

