import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  Waves,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Clock,
  MapPin,
  Compass,
  Zap,
  Info,
  ShieldAlert,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  Ruler,
  Layers,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Search,
  ChevronDown
} from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { fetchRiverStations, BASELINE_RIVER_STATIONS } from "../services/riverDataService";
import "./RiverMonitoring.css";

// Helper component to smoothly center Leaflet map on active river station
function RecenterRiverMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, 9, { duration: 1.0 });
    }
  }, [center, map]);
  return null;
}

// Professional Leaflet pin marker for river gauge stations
function createRiverPinIcon(riskLevel, isSelected, level) {
  let strokeColor = "#10b981";
  let badgeClass = "marker-normal";
  if (riskLevel === "CRITICAL") {
    strokeColor = "#ef4444";
    badgeClass = "marker-critical";
  } else if (riskLevel === "HIGH" || riskLevel === "WARNING") {
    strokeColor = "#f97316";
    badgeClass = "marker-warning";
  } else if (riskLevel === "MODERATE" || riskLevel === "WATCH") {
    strokeColor = "#f59e0b";
    badgeClass = "marker-watch";
  }

  const levelStr = typeof level === "number" ? `${level.toFixed(1)}m` : "";

  return L.divIcon({
    className: "custom-river-marker-container",
    html: `
      <div class="river-marker-badge ${badgeClass} ${isSelected ? "selected" : ""}" style="border-color: ${strokeColor}">
        <span class="marker-dot" style="background-color: ${strokeColor}"></span>
        <span class="marker-val">${levelStr}</span>
      </div>
    `,
    iconSize: isSelected ? [54, 28] : [48, 24],
    iconAnchor: isSelected ? [27, 14] : [24, 12],
  });
}

function RiverMonitoringDashboard({
  locations,
  selectedLocation,
  onLocationChange,
  theme,
  onToggleTheme,
  isSidebarOpen,
  onToggleSidebar
}) {
  const [stations, setStations] = useState(BASELINE_RIVER_STATIONS);
  const [summary, setSummary] = useState(null);
  const [selectedStationId, setSelectedStationId] = useState("pykara-ooty");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
    []
  );

  // Fetch all river stations list and telemetry summary
  const fetchRiverTelemetry = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${apiBaseUrl}/api/rivers`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}: Failed to load river telemetry`);
      const data = await res.json();
      if (data.success && data.stations) {
        setStations(data.stations);
        setSummary(data.summary);
      }
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (err) {
      setStations(BASELINE_RIVER_STATIONS);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // Combined Sync Now action
  const handleSyncNow = useCallback(async () => {
    await fetchRiverTelemetry();
  }, [fetchRiverTelemetry]);

  // Initial load & 30s auto polling
  useEffect(() => {
    fetchRiverTelemetry();
    const interval = setInterval(() => {
      fetchRiverTelemetry();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchRiverTelemetry]);

  // Timer counter for 'seconds ago'
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Sync active station with selectedLocation prop from header
  useEffect(() => {
    if (!selectedLocation || !stations || stations.length === 0) return;
    const locName = (selectedLocation.name || "").toLowerCase();
    const locState = (selectedLocation.state || "").toLowerCase();

    const matched = stations.find((st) => {
      const stLoc = (st.location || "").toLowerCase();
      const stRiver = (st.river_name || "").toLowerCase();
      const stState = (st.state || "").toLowerCase();
      return (
        stLoc.includes(locName) ||
        locName.includes(stLoc) ||
        stRiver.includes(locName) ||
        (stState.includes(locState) && locState.length > 3)
      );
    });

    if (matched) {
      setSelectedStationId(matched.id);
    }
  }, [selectedLocation, stations]);

  // Active Station
  const activeStation = useMemo(() => {
    const found = stations.find((s) => s.id === selectedStationId);
    return found || stations[0] || BASELINE_RIVER_STATIONS[0];
  }, [stations, selectedStationId]);

  // Safe water level calculation
  const safeWaterLevel = useMemo(() => {
    if (!activeStation) return 2.0;
    return Number((activeStation.warning_level_m * 0.65).toFixed(2));
  }, [activeStation]);

  // Is rapid rise active?
  const isRapidRiseActive = useMemo(() => {
    return Boolean(activeStation && activeStation.rate_of_rise_m_hr >= 0.30);
  }, [activeStation]);

  // Staff Gauge Metrics
  const staffGaugeMetrics = useMemo(() => {
    if (!activeStation) return { maxVal: 10, heightPct: 40, warningPct: 60, dangerPct: 80, ticks: [] };
    const maxVal = Math.max(activeStation.danger_level_m * 1.35, 6.0);
    const heightPct = Math.min(100, Math.max(0, (activeStation.current_level_m / maxVal) * 100));
    const warningPct = Math.min(100, (activeStation.warning_level_m / maxVal) * 100);
    const dangerPct = Math.min(100, (activeStation.danger_level_m / maxVal) * 100);

    const ticks = [];
    const step = maxVal > 8 ? 2 : 1;
    for (let v = 0; v <= maxVal; v += step) {
      ticks.push({ val: v, pct: (v / maxVal) * 100 });
    }

    return { maxVal, heightPct, warningPct, dangerPct, ticks };
  }, [activeStation]);

  // Filtered stations list
  const filteredStations = useMemo(() => {
    return stations.filter((st) => {
      const matchesSearch =
        (st.river_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (st.location || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (st.state || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRisk =
        riskFilter === "ALL" ||
        st.risk_level === riskFilter ||
        (riskFilter === "WARNING" && (st.risk_level === "WARNING" || st.risk_level === "HIGH")) ||
        (riskFilter === "NORMAL" && (st.risk_level === "LOW" || st.risk_level === "NORMAL"));

      return matchesSearch && matchesRisk;
    });
  }, [stations, searchQuery, riskFilter]);

  // Render trend icon helper
  const renderTrendIcon = (direction) => {
    switch (direction) {
      case "RISING_RAPIDLY":
      case "RISING":
        return <TrendingUp size={16} className="trend-up" />;
      case "FALLING":
      case "RECEDING":
        return <TrendingDown size={16} className="trend-down" />;
      default:
        return <Minus size={16} className="trend-steady" />;
    }
  };

  return (
    <div className="main-content river-monitoring-page">
      {/* Top Standard Header */}
      <DashboardHeader
        selectedLocation={selectedLocation}
        locations={locations}
        onLocationChange={onLocationChange}
        loading={loading}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      {/* Hero Header & River Basin Command Banner */}
      <div className="river-hero-banner">
        <div className="hero-left-col">
          <div className="hero-badge-row">
            <span className="live-telemetry-badge">
              <span className="live-pulsar"></span>
              REAL-TIME RIVER TELEMETRY
            </span>
            <span className="sensor-source-tag">Sensor: {activeStation.sensor_id || "RADAR-WL-04"}</span>
          </div>

          <h1 className="hero-river-title">
            {activeStation.river_name} <span className="hero-station-sub">• {activeStation.station_name || activeStation.location}</span>
          </h1>

          <div className="hero-meta-row">
            <span className="meta-chip"><MapPin size={13} /> {activeStation.location}, {activeStation.state}</span>
            <span className="meta-chip"><Compass size={13} /> Basin Elev: {activeStation.elevation_m || 1850}m MSL</span>
            <span className="meta-chip"><Activity size={13} /> Velocity: {activeStation.flow_velocity_ms || "1.8"} m/s</span>
          </div>
        </div>

        <div className="hero-right-col">
          {/* Quick Station Dropdown */}
          <div className="station-selector-wrapper">
            <label>Select Gauge Station:</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="river-station-dropdown"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.river_name} — {s.location} ({s.current_level_m.toFixed(1)}m)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="sync-telemetry-btn"
            onClick={handleSyncNow}
            title="Poll River Gauge Data"
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            <span>Sync ({secondsAgo}s ago)</span>
          </button>
        </div>
      </div>

      {/* Dynamic Status / Rapid Rise Advisory Banner (Visible only when alert active) */}
      {isRapidRiseActive && (
        <div className="rapid-surge-alert-strip">
          <div className="alert-strip-content">
            <AlertTriangle size={20} className="surge-warning-icon" />
            <div>
              <strong>⚠️ Water level rising rapidly — Flash Flood Risk Increasing</strong>
              <span>Rate of rise: <strong>+{activeStation.rate_of_rise_m_hr.toFixed(2)} m/hr</strong> in {activeStation.river_name} catchment.</span>
            </div>
          </div>
          <span className="alert-action-pill">ELEVATED VIGILANCE</span>
        </div>
      )}

      {/* 4 CORE EXECUTIVE METRICS TILES */}
      <div className="river-core-metrics-grid">
        {/* Metric 1: Current Stage */}
        <div className="river-kpi-tile stage-tile">
          <div className="tile-header">
            <span className="tile-label">Current Water Level</span>
            <span
              className="stage-status-chip"
              style={{
                backgroundColor: `${activeStation.risk_color}18`,
                color: activeStation.risk_color,
                borderColor: `${activeStation.risk_color}40`
              }}
            >
              {activeStation.risk_level}
            </span>
          </div>

          <div className="tile-hero-value">
            <span className="hero-num font-num" style={{ color: activeStation.risk_color }}>
              {activeStation.current_level_m.toFixed(2)}
            </span>
            <span className="hero-unit">meters</span>
          </div>

          <div className="tile-progress-wrapper">
            <div className="tile-bar-track">
              <div
                className="tile-bar-fill"
                style={{
                  width: `${Math.min(100, Math.max(5, (activeStation.current_level_m / activeStation.danger_level_m) * 100))}%`,
                  backgroundColor: activeStation.risk_color
                }}
              />
            </div>
            <div className="tile-sub-caption">
              <span>Safe: {safeWaterLevel}m</span>
              <span style={{ color: activeStation.risk_color, fontWeight: 700 }}>
                {((activeStation.current_level_m / activeStation.danger_level_m) * 100).toFixed(0)}% of Danger Mark
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2: Rate of Rise Velocity */}
        <div className="river-kpi-tile rate-tile">
          <div className="tile-header">
            <span className="tile-label">Rate of Rise Velocity</span>
            <div className="trend-direction-badge">
              {renderTrendIcon(activeStation.trend_direction)}
              <span>{activeStation.trend}</span>
            </div>
          </div>

          <div className="tile-hero-value">
            <span
              className="hero-num font-num"
              style={{
                color:
                  activeStation.rate_of_rise_m_hr >= 0.3
                    ? "#ef4444"
                    : activeStation.rate_of_rise_m_hr > 0
                    ? "#f97316"
                    : "#10b981"
              }}
            >
              {activeStation.rate_of_rise_m_hr > 0
                ? `+${activeStation.rate_of_rise_m_hr.toFixed(2)}`
                : activeStation.rate_of_rise_m_hr.toFixed(2)}
            </span>
            <span className="hero-unit">m / hour</span>
          </div>

          <div className="tile-details-row">
            <div className="mini-stat">
              <span className="stat-lbl">Hourly Delta:</span>
              <strong className="stat-val font-num">
                {activeStation.current_level_m - activeStation.previous_level_m >= 0 ? "+" : ""}
                {(activeStation.current_level_m - activeStation.previous_level_m).toFixed(2)}m
              </strong>
            </div>
            <div className="mini-stat">
              <span className="stat-lbl">Flow Velocity:</span>
              <strong className="stat-val font-num">{activeStation.flow_velocity_ms} m/s</strong>
            </div>
          </div>
        </div>

        {/* Metric 3: Warning & Danger Thresholds */}
        <div className="river-kpi-tile threshold-tile">
          <div className="tile-header">
            <span className="tile-label">Threshold Clearances</span>
            <span className="threshold-tag">GAUGE DATUM</span>
          </div>

          <div className="threshold-benchmarks-box">
            <div className="benchmark-row warning-row">
              <span className="bench-name">⚠️ Warning Mark</span>
              <span className="bench-val font-num">{activeStation.warning_level_m.toFixed(2)} m</span>
            </div>
            <div className="benchmark-row danger-row">
              <span className="bench-name">🚨 Danger Mark</span>
              <span className="bench-val font-num">{activeStation.danger_level_m.toFixed(2)} m</span>
            </div>
          </div>

          <div className="tile-details-row">
            <div className="mini-stat">
              <span className="stat-lbl">Danger Margin:</span>
              <strong className="stat-val font-num">
                {Math.max(0, activeStation.danger_level_m - activeStation.current_level_m).toFixed(2)}m
              </strong>
            </div>
            <div className="mini-stat">
              <span className="stat-lbl">Historic Flood (HFL):</span>
              <strong className="stat-val font-num">{activeStation.highest_flood_level_m.toFixed(2)}m</strong>
            </div>
          </div>
        </div>

        {/* Metric 4: Predicted Stage (+3H) */}
        <div className="river-kpi-tile forecast-tile">
          <div className="tile-header">
            <span className="tile-label">Predicted Water Level</span>
            <span className="forecast-horizon-chip">+3H HORIZON</span>
          </div>

          <div className="tile-hero-value">
            <span className="hero-num font-num forecast-color">
              {(activeStation.current_level_m + (activeStation.rate_of_rise_m_hr || 0.2) * 2.5).toFixed(2)}
            </span>
            <span className="hero-unit">meters</span>
          </div>

          <div className="forecast-chips-grid">
            <div className="horizon-pill">
              <span>+1h:</span>
              <strong>{(activeStation.current_level_m + (activeStation.rate_of_rise_m_hr || 0.2)).toFixed(2)}m</strong>
            </div>
            <div className="horizon-pill active">
              <span>+3h:</span>
              <strong>{(activeStation.current_level_m + (activeStation.rate_of_rise_m_hr || 0.2) * 2.5).toFixed(2)}m</strong>
            </div>
            <div className="horizon-pill">
              <span>+6h:</span>
              <strong>{(activeStation.current_level_m + (activeStation.rate_of_rise_m_hr || 0.2) * 4.5).toFixed(2)}m</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SCROLL SECTION 1: VISUAL COMPARISON (SAFE → WARNING → DANGER) & STAFF GAUGE */}
      <div className="river-content-card visual-gauge-section">
        <div className="card-header-row">
          <div className="card-title-group">
            <Gauge size={18} className="card-icon" />
            <div>
              <h2>Visual Hydrometric Comparison & Staff Gauge</h2>
              <p className="card-sub">Comparative stage benchmark (Safe &rarr; Warning &rarr; Danger) and hydraulic proximity readout</p>
            </div>
          </div>

          <div className="gauge-legend-chips">
            <span className="legend-chip safe"><span className="chip-dot"></span> Safe (&le; {safeWaterLevel}m)</span>
            <span className="legend-chip warning"><span className="chip-dot"></span> Warning ({activeStation.warning_level_m.toFixed(2)}m)</span>
            <span className="legend-chip danger"><span className="chip-dot"></span> Danger (&ge; {activeStation.danger_level_m.toFixed(2)}m)</span>
          </div>
        </div>

        {/* Horizontal Visual Comparison Bar */}
        <div className="horizontal-comparison-track">
          <div className="comp-segment safe-segment" style={{ width: "35%" }}>
            <span className="segment-title">Safe Zone (&le; {safeWaterLevel}m)</span>
          </div>
          <div className="comp-segment warning-segment" style={{ width: "40%" }}>
            <span className="segment-title">Warning Zone ({activeStation.warning_level_m.toFixed(2)}m)</span>
          </div>
          <div className="comp-segment danger-segment" style={{ width: "25%" }}>
            <span className="segment-title">Danger Zone (&ge; {activeStation.danger_level_m.toFixed(2)}m)</span>
          </div>

          {/* Current Needle Indicator */}
          <div
            className="gauge-needle-indicator"
            style={{
              left: `${Math.min(98, Math.max(2, (activeStation.current_level_m / activeStation.danger_level_m) * 75))}%`,
              borderColor: activeStation.risk_color
            }}
          >
            <div className="needle-pointer" style={{ backgroundColor: activeStation.risk_color }} />
            <div className="needle-tag" style={{ backgroundColor: activeStation.risk_color }}>
              {activeStation.current_level_m.toFixed(2)}m
            </div>
          </div>
        </div>

        {/* Staff Gauge Visualizer Layout */}
        <div className="staff-gauge-interactive-layout">
          {/* Vertical Staff Gauge Column */}
          <div className="staff-gauge-ruler-box">
            <div className="staff-ruler-track">
              {staffGaugeMetrics.ticks.map((t) => (
                <div key={`tick-${t.val}`} className="ruler-tick-mark" style={{ bottom: `${t.pct}%` }}>
                  <span className="tick-val font-num">{t.val}m</span>
                </div>
              ))}

              {/* Danger Mark Line */}
              <div className="threshold-indicator danger-line" style={{ bottom: `${staffGaugeMetrics.dangerPct}%` }}>
                <span className="threshold-pill font-num">DANGER {activeStation.danger_level_m.toFixed(2)}m</span>
              </div>

              {/* Warning Mark Line */}
              <div className="threshold-indicator warning-line" style={{ bottom: `${staffGaugeMetrics.warningPct}%` }}>
                <span className="threshold-pill font-num">WARNING {activeStation.warning_level_m.toFixed(2)}m</span>
              </div>

              {/* Water Level Fill */}
              <div
                className={`ruler-water-fill ${
                  activeStation.current_level_m >= activeStation.danger_level_m
                    ? "danger-fill"
                    : activeStation.current_level_m >= activeStation.warning_level_m
                    ? "warning-fill"
                    : "normal-fill"
                }`}
                style={{ height: `${staffGaugeMetrics.heightPct}%` }}
              >
                <div className="water-wave-top"></div>
              </div>
            </div>

            <div className="gauge-elevation-readout">
              <span className="readout-label">TELEMETRY READING</span>
              <span className="readout-val font-num" style={{ color: activeStation.risk_color }}>
                {activeStation.current_level_m.toFixed(2)} <small>m</small>
              </span>
            </div>
          </div>

          {/* Analytical Breakdown Side Cards */}
          <div className="staff-gauge-analytics-side">
            <div className="analytics-box condition-box">
              <div className="analytics-header">
                <span className="analytics-label">Operational Hydraulic Assessment</span>
                <span
                  className="risk-tag"
                  style={{
                    backgroundColor: `${activeStation.risk_color}20`,
                    color: activeStation.risk_color,
                    borderColor: `${activeStation.risk_color}50`
                  }}
                >
                  {activeStation.risk_level}
                </span>
              </div>
              <p className="analytics-body-text">
                {activeStation.alert_message ||
                  `Water stage in ${activeStation.river_name} is currently ${
                    activeStation.current_level_m >= activeStation.warning_level_m
                      ? "at elevated hazard level. Continuous flood watch in effect."
                      : "within stable flow baseline."
                  }`}
              </p>
            </div>

            {/* Time-to-Breach Estimation */}
            <div className="analytics-box projection-box">
              <div className="analytics-header">
                <div className="proj-title">
                  <Clock size={15} />
                  <span>Warning Stage Projection</span>
                </div>
                <span className="est-badge">MODEL ESTIMATE</span>
              </div>

              {activeStation.current_level_m < activeStation.warning_level_m && activeStation.rate_of_rise_m_hr > 0 ? (
                <div className="projection-metric-grid">
                  <div className="proj-cell">
                    <span className="p-lbl">Warning Clearance</span>
                    <strong className="p-val font-num">
                      {(activeStation.warning_level_m - activeStation.current_level_m).toFixed(2)} m
                    </strong>
                  </div>
                  <div className="proj-cell">
                    <span className="p-lbl">Rise Velocity</span>
                    <strong className="p-val font-num" style={{ color: "#f97316" }}>
                      +{activeStation.rate_of_rise_m_hr.toFixed(2)} m/h
                    </strong>
                  </div>
                  <div className="proj-cell highlight">
                    <span className="p-lbl">Est. Time to Breach</span>
                    <strong className="p-val font-num highlight-val">
                      ≈ {((activeStation.warning_level_m - activeStation.current_level_m) / activeStation.rate_of_rise_m_hr).toFixed(1)} hrs
                    </strong>
                  </div>
                </div>
              ) : activeStation.current_level_m >= activeStation.warning_level_m ? (
                <div className="warning-breach-box">
                  <AlertTriangle size={16} />
                  <span>Threshold Exceeded: Stage is currently &ge; {activeStation.warning_level_m.toFixed(2)}m Warning Mark</span>
                </div>
              ) : (
                <div className="safe-baseline-box">
                  <CheckCircle2 size={16} />
                  <span>Steady Hydraulic Baseline — Stage is stable; no breach projected within 12 hours.</span>
                </div>
              )}
            </div>

            {/* Action Directives */}
            <div className="analytics-box action-directive-box">
              <span className="analytics-label">Hydraulic Control Directive</span>
              <p className="directive-text">
                {activeStation.risk_level === "CRITICAL"
                  ? "🔴 Immediate evacuation of riverine lowlands and closure of downstream culverts."
                  : activeStation.risk_level === "HIGH" || activeStation.risk_level === "WARNING"
                  ? "🟠 Activate sluice gates, verify overflow spillways, and alert zonal response units."
                  : "🟢 Maintain routine hourly telemetry polling and standard runoff clearance."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SCROLL SECTION 2: 24-HOUR HYDROGRAPH & RECENT TREND */}
      <div className="river-content-card hydrograph-section">
        <div className="card-header-row">
          <div className="card-title-group">
            <BarChart3 size={18} className="card-icon" />
            <div>
              <h2>24-Hour Stage Hydrograph & Forward Horizon</h2>
              <p className="card-sub">Recorded sensor water levels and multi-hour predictive curve</p>
            </div>
          </div>

          <div className="chart-legend-row">
            <span className="c-legend history"><span className="c-dot"></span> Recorded 24h</span>
            <span className="c-legend forecast"><span className="c-dot"></span> +6h Forecast</span>
            <span className="c-legend warning-line-legend"><span className="c-dot"></span> Warning ({activeStation.warning_level_m}m)</span>
            <span className="c-legend danger-line-legend"><span className="c-dot"></span> Danger ({activeStation.danger_level_m}m)</span>
          </div>
        </div>

        {/* SVG Hydrograph Visualization */}
        <div className="hydrograph-svg-container">
          <svg className="hydrograph-svg" viewBox="0 0 800 240" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hydroGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Warning Guide Line */}
            <line x1="40" y1="80" x2="780" y2="80" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5,5" />
            <text x="740" y="75" fill="#f59e0b" fontSize="10" fontWeight="700">Warning {activeStation.warning_level_m}m</text>

            {/* Danger Guide Line */}
            <line x1="40" y1="40" x2="780" y2="40" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5,5" />
            <text x="740" y="35" fill="#ef4444" fontSize="10" fontWeight="700">Danger {activeStation.danger_level_m}m</text>

            {/* Hydrograph Curve Area */}
            <path
              d="M 50,180 Q 150,170 250,160 T 450,140 T 600,110 L 600,220 L 50,220 Z"
              fill="url(#hydroGradient)"
            />

            {/* Hydrograph Historical Line */}
            <path
              d="M 50,180 Q 150,170 250,160 T 450,140 T 600,110"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3"
            />

            {/* Forecast Projection Dotted Line */}
            <path
              d="M 600,110 Q 680,90 770,75"
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeDasharray="6,4"
            />

            {/* Data Points */}
            <circle cx="50" cy="180" r="4" fill="#38bdf8" />
            <circle cx="250" cy="160" r="4" fill="#38bdf8" />
            <circle cx="450" cy="140" r="4" fill="#38bdf8" />
            <circle cx="600" cy="110" r="6" fill="#ffffff" stroke="#38bdf8" strokeWidth="3" />
            <circle cx="770" cy="75" r="4" fill="#f97316" />

            {/* Current Value Pill on Chart */}
            <rect x="560" y="85" width="80" height="20" rx="4" fill="#0284c7" />
            <text x="600" y="99" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
              {activeStation.current_level_m.toFixed(2)}m (Now)
            </text>

            {/* X-Axis Time Labels */}
            <text x="50" y="235" fill="var(--text-secondary)" fontSize="10">-24h</text>
            <text x="250" y="235" fill="var(--text-secondary)" fontSize="10">-16h</text>
            <text x="450" y="235" fill="var(--text-secondary)" fontSize="10">-8h</text>
            <text x="600" y="235" fill="var(--text-primary)" fontSize="10" fontWeight="700">NOW</text>
            <text x="770" y="235" fill="#f97316" fontSize="10" fontWeight="700">+6h Forecast</text>
          </svg>
        </div>
      </div>

      {/* SCROLL SECTION 3: RIVER BASIN NETWORK & GAUGE REGISTRY */}
      <div className="river-content-card network-registry-section">
        <div className="card-header-row">
          <div className="card-title-group">
            <Layers size={18} className="card-icon" />
            <div>
              <h2>Regional River Network & Gauge Registry</h2>
              <p className="card-sub">Real-time status across all regional river basins and hydrometric telemetry nodes</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="registry-controls-row">
            <div className="search-input-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search river or district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="risk-filter-pills">
              {["ALL", "CRITICAL", "WARNING", "NORMAL"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`filter-pill ${riskFilter === filter ? "active" : ""}`}
                  onClick={() => setRiskFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Station Cards Grid */}
        <div className="stations-cards-grid">
          {filteredStations.map((st) => (
            <div
              key={st.id}
              className={`station-summary-card ${st.id === selectedStationId ? "active-selected" : ""}`}
              onClick={() => setSelectedStationId(st.id)}
            >
              <div className="st-card-top">
                <div>
                  <h4 className="st-river-name">{st.river_name}</h4>
                  <span className="st-location-name">{st.location}, {st.state}</span>
                </div>
                <span
                  className="st-risk-pill"
                  style={{
                    backgroundColor: `${st.risk_color}20`,
                    color: st.risk_color,
                    borderColor: `${st.risk_color}50`
                  }}
                >
                  {st.risk_level}
                </span>
              </div>

              <div className="st-card-metrics">
                <div className="st-metric">
                  <span className="st-m-lbl">Current Stage</span>
                  <span className="st-m-val font-num" style={{ color: st.risk_color }}>
                    {st.current_level_m.toFixed(2)}m
                  </span>
                </div>
                <div className="st-metric">
                  <span className="st-m-lbl">Danger Mark</span>
                  <span className="st-m-val font-num">{st.danger_level_m.toFixed(2)}m</span>
                </div>
                <div className="st-metric">
                  <span className="st-m-lbl">Rate of Rise</span>
                  <span className="st-m-val font-num">
                    {st.rate_of_rise_m_hr > 0 ? `+${st.rate_of_rise_m_hr.toFixed(2)}` : st.rate_of_rise_m_hr.toFixed(2)} m/h
                  </span>
                </div>
              </div>

              <div className="st-card-footer">
                <span className="st-sensor-tag">Node: {st.sensor_id || "WL-IOT"}</span>
                <span className="st-select-hint">
                  {st.id === selectedStationId ? "● Selected Station" : "Click to View Details →"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RiverMonitoringDashboard;
