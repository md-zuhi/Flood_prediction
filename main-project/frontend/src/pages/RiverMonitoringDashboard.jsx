import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  fetchStations,
  fetchCurrentReading,
  fetchHistory,
  fetchPrediction,
  fetchRisk
} from "../services/riverApi";
import RiverLevelChart from "../components/river/RiverLevelChart";
import RiverStatusCard from "../components/river/RiverStatusCard";
import RiverPredictionCard from "../components/river/RiverPredictionCard";
import RiverAlertCard from "../components/river/RiverAlertCard";

// -----------------------------------------------------------------------
// River Station Map Marker icon factory
// -----------------------------------------------------------------------
const RISK_COLORS_MAP = {
  NORMAL: "#22c55e",
  WATCH: "#f59e0b",
  WARNING: "#f97316",
  HIGH: "#ef4444",
  CRITICAL: "#dc2626",
  UNKNOWN: "#94a3b8"
};

function createRiverMarkerIcon(stationName, riskState, selected, isUnavailable) {
  const color = isUnavailable ? "#94a3b8" : (RISK_COLORS_MAP[riskState] || RISK_COLORS_MAP.UNKNOWN);
  return L.divIcon({
    className: "river-station-marker",
    html: `
      <div style="
        background: rgba(15,23,42,0.92);
        border: 2px solid ${color};
        border-radius: 8px;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 700;
        color: ${color};
        white-space: nowrap;
        box-shadow: 0 0 10px ${color}55;
        ${selected ? `outline: 2px solid #38bdf8; outline-offset: 2px;` : ""}
      ">
        🌊 ${stationName} ${isUnavailable ? "(No Data)" : ""}
      </div>`,
    iconSize: [140, 26],
    iconAnchor: [70, 13]
  });
}

// Helper: fly map to a station
function MapFlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 10, { duration: 1.0 });
  }, [center, zoom, map]);
  return null;
}

// -----------------------------------------------------------------------
// Toast notification component
// -----------------------------------------------------------------------
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "8px", pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.bg || "rgba(15,23,42,0.95)",
            border: `1px solid ${t.border || "#64748b"}`,
            borderRadius: "10px",
            padding: "12px 16px",
            color: t.color || "#e2e8f0",
            fontSize: "13px",
            maxWidth: "340px",
            pointerEvents: "all",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            animation: "riverAlertIn 0.3s ease"
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>{t.title}</div>
          <div style={{ fontSize: "11px", opacity: 0.85 }}>{t.message}</div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Main Dashboard
// -----------------------------------------------------------------------
function RiverMonitoringDashboard({ theme, onToggleTheme }) {
  const [stations, setStations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [demoMode, setDemoMode] = useState(false); // DEFAULT: REAL CWC Mode (Unavailable)

  // Per-station cached data (keyed by station id)
  const [currentMap, setCurrentMap] = useState({});
  const [historyMap, setHistoryMap] = useState({});
  const [predictionMap, setPredictionMap] = useState({});
  const [riskMap, setRiskMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const [mapCenter, setMapCenter] = useState([15.0, 77.5]);
  const [mapZoom, setMapZoom] = useState(6);

  const selectedStation = stations.find((s) => s.id === selectedId) || null;

  // -----------------------------------------------------------------------
  // Toast helper
  // -----------------------------------------------------------------------
  const pushToast = useCallback((title, message, severity) => {
    const styleMap = {
      CRITICAL: { bg: "rgba(127,29,29,0.97)", border: "#dc2626", color: "#fca5a5" },
      WARNING: { bg: "rgba(67,20,7,0.97)", border: "#f97316", color: "#fed7aa" },
      HIGH: { bg: "rgba(69,10,10,0.97)", border: "#ef4444", color: "#fca5a5" },
      WATCH: { bg: "rgba(69,26,3,0.97)", border: "#f59e0b", color: "#fde68a" }
    };
    const s = styleMap[severity] || { bg: "rgba(15,23,42,0.95)", border: "#64748b", color: "#e2e8f0" };
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, title, message, ...s }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  // -----------------------------------------------------------------------
  // Load all stations
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function loadStations() {
      try {
        setLoading(true);
        const data = await fetchStations(demoMode);
        setStations(data.stations || []);
        if (data.stations?.length > 0) {
          // Keep current selection if valid, else pick first
          if (!selectedId || !data.stations.some((s) => s.id === selectedId)) {
            setSelectedId(data.stations[0].id);
            setMapCenter([data.stations[0].latitude, data.stations[0].longitude]);
            setMapZoom(9);
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadStations();
  }, [demoMode]);

  // -----------------------------------------------------------------------
  // Load data for a station on selection
  // -----------------------------------------------------------------------
  const loadStationData = useCallback(async (stationId, isDemo) => {
    try {
      const [cur, hist, pred, risk] = await Promise.all([
        fetchCurrentReading(stationId, isDemo),
        fetchHistory(stationId, 48, isDemo),
        fetchPrediction(stationId, isDemo),
        fetchRisk(stationId, isDemo)
      ]);

      setCurrentMap((p) => ({ ...p, [stationId]: cur }));
      setHistoryMap((p) => ({ ...p, [stationId]: hist }));
      setPredictionMap((p) => ({ ...p, [stationId]: pred }));
      setRiskMap((p) => ({ ...p, [stationId]: risk }));

      // Only toast when demoMode matches
      if (isDemo) {
        const prevAlerts = riskMap[stationId]?.alerts || [];
        const newAlerts = risk?.alerts || [];
        newAlerts.forEach((alert) => {
          const already = prevAlerts.some(
            (a) => a.type === alert.type && a.message === alert.message
          );
          if (!already) {
            pushToast(
              `${alert.type.replace(/_/g, " ")} — ${risk.station_name}`,
              alert.message,
              alert.severity
            );
          }
        });
      }
    } catch (e) {
      console.error("[RiverMonitoringDashboard] loadStationData error:", e.message);
    }
  }, [pushToast]);

  // Load on station selection or mode toggle
  useEffect(() => {
    if (selectedId) {
      loadStationData(selectedId, demoMode);
    }
  }, [selectedId, demoMode, loadStationData]);

  // Refresh current station data every 5 minutes
  useEffect(() => {
    if (stations.length === 0) return;
    const interval = setInterval(() => {
      stations.forEach((s) => loadStationData(s.id, demoMode));
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [stations, demoMode, loadStationData]);

  // Pre-load all stations for metadata mapping
  useEffect(() => {
    if (stations.length > 0) {
      stations.forEach((s) => loadStationData(s.id, demoMode));
    }
  }, [stations, demoMode, loadStationData]);

  // -----------------------------------------------------------------------
  // Station selection handler
  // -----------------------------------------------------------------------
  const handleSelectStation = (stationId) => {
    setSelectedId(stationId);
    setDismissedAlerts([]); // reset dismissed alerts on station change
    const st = stations.find((s) => s.id === stationId);
    if (st) {
      setMapCenter([st.latitude, st.longitude]);
      setMapZoom(11);
    }
  };

  const handleDismissAlert = (idx) => {
    setDismissedAlerts((prev) => [...prev, idx]);
  };

  const rawAlerts = riskMap[selectedId]?.alerts || [];
  const activeAlerts = rawAlerts.filter((_, i) => !dismissedAlerts.includes(i));

  const selectedCurrent = currentMap[selectedId] || null;
  const selectedHistory = historyMap[selectedId] || null;
  const selectedPrediction = predictionMap[selectedId] || null;
  const selectedRisk = riskMap[selectedId] || null;

  const currentLevel = selectedCurrent ? (selectedCurrent.level_m !== undefined ? selectedCurrent.level_m : selectedCurrent.current_level_m) : null;
  const isUnavailable = !demoMode;

  return (
    <>
      <style>{`
        @keyframes riverAlertIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes riverPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .river-dashboard-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow-y: auto;
          background: #080f1e;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          color: #e2e8f0;
          scrollbar-width: thin;
        }
        .river-dashboard-header {
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          background: rgba(15,23,42,0.4);
        }
        .river-dashboard-title h1 {
          font-size: 20px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0;
          text-align: left;
        }
        .river-dashboard-title p {
          font-size: 12px;
          color: #64748b;
          margin: 4px 0 0 0;
          text-align: left;
        }
        .river-mode-toggle {
          display: flex;
          background: rgba(15,23,42,0.8);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 3px;
        }
        .river-toggle-btn {
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          background: transparent;
          color: #94a3b8;
        }
        .river-toggle-btn.active {
          background: #38bdf8;
          color: #0f172a;
          box-shadow: 0 2px 8px rgba(56,189,248,0.25);
        }
        .river-station-list-horizontal {
          display: flex;
          flex-wrap: nowrap;
          gap: 16px;
          overflow-x: auto;
          overflow-y: visible;
          padding: 16px 24px 20px;
          background: rgba(15,23,42,0.3);
          border-bottom: 2px solid rgba(255,255,255,0.08);
          scrollbar-width: thin;
          position: relative;
          z-index: 10;
          flex-shrink: 0;
        }
        .river-station-list-horizontal::-webkit-scrollbar {
          height: 6px;
        }
        .river-station-list-horizontal::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
        }
        .river-station-list-horizontal::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 4px;
        }
        .river-map-container-full {
          width: 100%;
          height: 450px;
          min-height: 350px;
          position: relative;
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          display: block;
          overflow: hidden;
        }
        .river-map-instance {
          width: 100%;
          height: 100%;
        }
        .river-details-container {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1280px;
          margin: 0 auto;
          width: 100%;
        }
        .river-chart-section {
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 20px;
          backdrop-filter: blur(8px);
          width: 100%;
          max-width: 1000px;
          box-sizing: border-box;
        }
        .river-grid-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .river-grid-layout {
            grid-template-columns: 1fr;
          }
        }
        .river-card-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }
        .river-detail-card {
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 16px;
          backdrop-filter: blur(8px);
          text-align: left;
        }
        .river-alert-section {
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 20px;
          backdrop-filter: blur(8px);
          text-align: left;
        }
        .river-section-label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 10px 0;
          text-align: left;
        }
        .river-banner-alert {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px;
          padding: 12px 16px;
          color: #fca5a5;
          font-size: 13px;
          text-align: left;
          margin-bottom: 16px;
        }
        .leaflet-container {
          background: #0a1628 !important;
        }
      `}</style>

      <Toast toasts={toasts} />

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#080f1e", color: "#94a3b8" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", animation: "riverPulse 1.4s infinite" }}>🌊</div>
            <div>Loading river stations…</div>
          </div>
        </div>
      ) : error ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#080f1e", color: "#ef4444" }}>
          Error: {error}
        </div>
      ) : (
        <div className="river-dashboard-container">
          {/* ROW 1: HEADER & HORIZONTAL CARDS */}
          <header className="river-dashboard-header">
            <div className="river-dashboard-title">
              <h1>🌊 River monitor</h1>
              <p>Real-time depth telemetry & rate-of-rise warnings</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "11px", color: "#64748b", maxWidth: "250px", textAlign: "right" }}>
                {demoMode
                  ? "Showing SIMULATED readings for inspection"
                  : "REAL CWC Telemetry is UNAVAILABLE without API authorization keys"}
              </span>
              <div className="river-mode-toggle">
                <button
                  type="button"
                  className={`river-toggle-btn ${!demoMode ? "active" : ""}`}
                  onClick={() => setDemoMode(false)}
                >
                  REAL CWC
                </button>
                <button
                  type="button"
                  className={`river-toggle-btn ${demoMode ? "active" : ""}`}
                  onClick={() => setDemoMode(true)}
                >
                  DEMO MODE
                </button>
              </div>
            </div>
          </header>

          <div className="river-station-list-horizontal">
            {stations.map((st) => (
              <RiverStatusCard
                key={st.id}
                station={st}
                currentData={currentMap[st.id]}
                riskData={riskMap[st.id]}
                selected={st.id === selectedId}
                onClick={() => handleSelectStation(st.id)}
              />
            ))}
          </div>

          {/* ROW 2: LARGE FULL-WIDTH MAP */}
          <section className="river-map-container-full">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom={true}
              className="river-map-instance"
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFlyTo center={mapCenter} zoom={mapZoom} />

              {stations.map((st) => {
                const risk = riskMap[st.id]?.risk_state || "UNKNOWN";
                const cur = currentMap[st.id];
                const pred = predictionMap[st.id];
                const icon = createRiverMarkerIcon(st.name, risk, st.id === selectedId, isUnavailable);

                return (
                  <Marker
                    key={st.id}
                    position={[st.latitude, st.longitude]}
                    icon={icon}
                    eventHandlers={{
                      click: () => handleSelectStation(st.id)
                    }}
                  >
                    <Popup>
                      <div style={{ minWidth: "220px", fontFamily: "Inter, system-ui, sans-serif", color: "#0f172a" }}>
                        <div style={{ fontWeight: 800, fontSize: "14px", marginBottom: "4px" }}>
                          🌊 {st.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#475569", marginBottom: "6px" }}>
                          {st.river} · {st.state}
                        </div>
                        <hr style={{ borderColor: "#e2e8f0", margin: "6px 0" }} />
                        
                        {isUnavailable ? (
                          <div style={{ fontSize: "11px", color: "#b91c1c", fontWeight: 600, padding: "4px 0" }}>
                            Real-time CWC gauge levels are currently UNAVAILABLE. Turn on DEMO mode at the top right to simulate readings.
                          </div>
                        ) : (
                          <div style={{ fontSize: "12px", lineHeight: "1.7" }}>
                            <div><strong>Level:</strong> {cur?.level_m?.toFixed(2) ?? "—"} m</div>
                            <div><strong>Risk:</strong> {risk}</div>
                            <div><strong>Rate:</strong> {riskMap[st.id]?.rate_m_per_hr != null
                              ? `${riskMap[st.id].rate_m_per_hr >= 0 ? "+" : ""}${riskMap[st.id].rate_m_per_hr.toFixed(3)} m/hr`
                              : "—"}</div>
                            <div><strong>Trend:</strong> {riskMap[st.id]?.trend ?? "—"}</div>
                            <hr style={{ borderColor: "#e2e8f0", margin: "6px 0" }} />
                            <div><strong>⚠ Warning:</strong> {st.thresholds?.warning_m} m</div>
                            <div><strong>🔴 Danger:</strong> {st.thresholds?.danger_m} m</div>
                            <hr style={{ borderColor: "#e2e8f0", margin: "6px 0" }} />
                            <div style={{ fontSize: "11px" }}>
                              <strong>+1h:</strong> {pred?.projections?.plus_1h_m?.toFixed(2) ?? "—"} m &nbsp;
                              <strong>+3h:</strong> {pred?.projections?.plus_3h_m?.toFixed(2) ?? "—"} m &nbsp;
                              <strong>+6h:</strong> {pred?.projections?.plus_6h_m?.toFixed(2) ?? "—"} m
                            </div>
                            <div style={{ marginTop: "4px", fontSize: "10px", color: "#f59e0b", fontWeight: 600 }}>
                              DEMO / SIMULATED DATA
                            </div>
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </section>

          {/* ROW 3: DETAILED INSPECTION ROW */}
          <main className="river-details-container">
            {selectedStation ? (
              <>
                {/* Station Identification Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Station Inspection Panel
                    </div>
                    <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "4px 0 0 0", color: "#f8fafc" }}>
                      {selectedStation.name}
                    </h2>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                      {selectedStation.river} · {selectedStation.region}, {selectedStation.state}
                    </div>
                  </div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>
                    Lat {selectedStation.latitude}° · Lon {selectedStation.longitude}°
                  </div>
                </div>

                {isUnavailable && (
                  <div className="river-banner-alert">
                    <strong>Notice:</strong> Real-time hydrological water levels for {selectedStation.name} are currently unavailable on public REST endpoints due to Central Water Commission access restriction limits. Switch to <strong>DEMO MODE</strong> at the top right to visualize chart trends and alarm triggers.
                  </div>
                )}

                {/* Historical Chart (Prominent Full Width) */}
                <div className="river-chart-section">
                  <div className="river-section-label">Historical Level (Last 6 hours)</div>
                  <RiverLevelChart
                    readings={selectedHistory?.readings || []}
                    thresholds={selectedStation.thresholds}
                    trend={isUnavailable ? "UNKNOWN" : (selectedRisk?.trend || "UNKNOWN")}
                    currentLevel={currentLevel}
                  />
                </div>

                {/* Details layout Grid */}
                <div className="river-grid-layout">
                  {/* Left Column: Stats & Projections */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div className="river-detail-card" style={{ display: "flex", flexDirection: "column" }}>
                      <div className="river-section-label">Current Water Level Stats</div>
                      
                      <div className="river-card-details-grid">
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#64748b" }}>Current Level</div>
                          <div style={{ fontSize: "24px", fontWeight: 800, color: currentLevel != null ? "#e2e8f0" : "#64748b", margin: "4px 0" }}>
                            {currentLevel != null ? `${currentLevel.toFixed(2)} m` : "N/A"}
                          </div>
                          <div style={{ fontSize: "10px", color: "#475569" }}>
                            {isUnavailable ? "Unavailable" : "Sensor Reading"}
                          </div>
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#64748b" }}>Rate of Rise</div>
                          <div style={{ fontSize: "24px", fontWeight: 800, color: (selectedRisk?.rate_m_per_hr != null && !isUnavailable) ? "#e2e8f0" : "#64748b", margin: "4px 0" }}>
                            {!isUnavailable && selectedRisk?.rate_m_per_hr != null
                              ? `${selectedRisk.rate_m_per_hr >= 0 ? "+" : ""}${selectedRisk.rate_m_per_hr.toFixed(3)}`
                              : "N/A"}
                          </div>
                          <div style={{ fontSize: "10px", color: "#475569" }}>
                            {!isUnavailable && selectedRisk?.rate_m_per_hr != null ? "m/hour" : "No trend"}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                        <div>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>Warning Threshold:</span>
                          <span style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700, marginLeft: "6px" }}>{selectedStation.thresholds?.warning_m} m</span>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>Danger Threshold:</span>
                          <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: 700, marginLeft: "6px" }}>{selectedStation.thresholds?.danger_m} m</span>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                        <div>
                          <div style={{ fontSize: "10px", color: "#64748b" }}>Risk Classification</div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: isUnavailable ? "#64748b" : "#e2e8f0", marginTop: "2px" }}>
                            {isUnavailable ? "UNKNOWN" : (selectedRisk?.risk_state || "UNKNOWN")}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "10px", color: "#64748b" }}>Estimated Warning Time</div>
                          <div style={{ fontSize: "11px", color: "#e2e8f0", marginTop: "2px" }}>
                            {isUnavailable ? "Insufficient data for estimate" : (selectedPrediction?.time_to_warning?.label || "Insufficient data for estimate")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <RiverPredictionCard
                      prediction={isUnavailable ? null : selectedPrediction}
                      thresholds={selectedStation.thresholds}
                    />
                  </div>

                  {/* Right Column: Alerts & Readiness */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div className="river-alert-section">
                      <RiverAlertCard
                        alerts={isUnavailable ? [] : activeAlerts}
                        onDismiss={handleDismissAlert}
                      />
                    </div>

                    {/* Sensor sources and references */}
                    <div className="river-detail-card" style={{ display: "flex", flexDirection: "column" }}>
                      <div className="river-section-label">Station Metadata & Readiness</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "6px" }}>
                          <span style={{ color: "#64748b" }}>Official Authority</span>
                          <span>{selectedStation.real_source?.name || "CWC / Irrigation Dept"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "6px" }}>
                          <span style={{ color: "#64748b" }}>Gauge Registry ID</span>
                          <span><code>{selectedStation.real_source?.station_id || "N/A"}</code></span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "6px" }}>
                          <span style={{ color: "#64748b" }}>Official Portal URL</span>
                          <span>
                            <a href={selectedStation.real_source?.url} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", textDecoration: "none" }}>
                              nwic.gov.in ↗
                            </a>
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "4px" }}>
                          <span style={{ color: "#64748b" }}>Local Weather Forecast</span>
                          <span style={{ color: "#22c55e", fontWeight: 600 }}>READY (Open-Meteo)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "60px", color: "#64748b", fontSize: "15px" }}>
                Select a station from the cards above to inspect.
              </div>
            )}
          </main>
        </div>
      )}
    </>
  );
}

export default RiverMonitoringDashboard;
