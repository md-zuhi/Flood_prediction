import React, { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  MapPin,
  AlertTriangle,
  ShieldAlert,
  CloudRain,
  Droplets,
  Waves,
  Mountain,
  History,
  Activity,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  ChevronRight,
  Info,
  Clock,
  Compass
} from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { getEnrichedVillageWards } from "../services/floodRiskIntegrationService";
import "./HyperLocalRiskMap.css";

// Smooth Fly-to Helper for Leaflet Map
function RecenterWardMap({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || 11, { duration: 1.0 });
    }
  }, [center, zoom, map]);
  return null;
}

function HyperLocalRiskMapDashboard({
  locations,
  selectedLocation,
  onLocationChange,
  theme,
  onToggleTheme,
  isSidebarOpen,
  onToggleSidebar
}) {
  const [wards, setWards] = useState(() => getEnrichedVillageWards());
  const [selectedWardId, setSelectedWardId] = useState("ward-nilgiris-pykara");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPolygons, setShowPolygons] = useState(true);

  // Active selected village/ward object
  const activeWard = useMemo(() => {
    return wards.find((w) => w.id === selectedWardId) || wards[0];
  }, [wards, selectedWardId]);

  // Unique mountain states
  const uniqueStates = useMemo(() => {
    return ["ALL", ...Array.from(new Set(wards.map((w) => w.state)))];
  }, [wards]);

  // Filtered wards for table and map search
  const filteredWards = useMemo(() => {
    return wards.filter((w) => {
      const matchSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.river_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchState = stateFilter === "ALL" || w.state === stateFilter;
      const matchRisk = riskFilter === "ALL" || w.risk_level === riskFilter;

      return matchSearch && matchState && matchRisk;
    });
  }, [wards, searchQuery, stateFilter, riskFilter]);

  // Executive Rollup Stats
  const riskSummary = useMemo(() => {
    const total = wards.length;
    const critical = wards.filter((w) => w.risk_level === "CRITICAL").length;
    const high = wards.filter((w) => w.risk_level === "HIGH").length;
    const moderate = wards.filter((w) => w.risk_level === "MODERATE").length;
    const low = wards.filter((w) => w.risk_level === "LOW").length;

    return { total, critical, high, moderate, low };
  }, [wards]);

  // Map center calculation
  const mapCenter = useMemo(() => {
    if (activeWard && activeWard.coordinates) {
      return activeWard.coordinates;
    }
    return [11.4550, 76.6020];
  }, [activeWard]);

  return (
    <div className="main-content hyper-local-map-page">
      {/* Global Dashboard Header */}
      <DashboardHeader
        selectedLocation={selectedLocation}
        locations={locations}
        onLocationChange={onLocationChange}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      {/* Main Command Bar */}
      <div className="risk-map-header-bar">
        <div className="header-title-block">
          <div className="title-icon-badge">
            <Layers size={20} />
          </div>
          <div>
            <h1>Hyper-Local Mountain Ward & Village Risk Map</h1>
            <p className="header-subtitle">
              High-resolution disaster-management risk zoning across mountain settlements, slopes, and riverfront sectors
            </p>
          </div>
        </div>

        {/* Executive Risk Ribbon */}
        <div className="risk-summary-ribbon">
          <div className="ribbon-item critical">
            <span className="ribbon-count">{riskSummary.critical}</span>
            <span className="ribbon-label">Critical</span>
          </div>
          <div className="ribbon-item high">
            <span className="ribbon-count">{riskSummary.high}</span>
            <span className="ribbon-label">High Risk</span>
          </div>
          <div className="ribbon-item moderate">
            <span className="ribbon-count">{riskSummary.moderate}</span>
            <span className="ribbon-label">Moderate</span>
          </div>
          <div className="ribbon-item low">
            <span className="ribbon-count">{riskSummary.low}</span>
            <span className="ribbon-label">Low / Safe</span>
          </div>
        </div>
      </div>

      {/* Map Layout Grid: Left Interactive GIS Map + Right Detailed Ward Inspection Dossier */}
      <div className="hyper-local-grid">
        {/* Left GIS Map View */}
        <div className="gis-map-card">
          <div className="gis-map-controls-row">
            <div className="search-box-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search village, ward, district..."
                className="gis-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="gis-filter-group">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="gis-select"
              >
                {uniqueStates.map((st) => (
                  <option key={st} value={st}>
                    {st === "ALL" ? "All Mountain States" : st}
                  </option>
                ))}
              </select>

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="gis-select"
              >
                <option value="ALL">All Risk Stages</option>
                <option value="CRITICAL">🔴 Critical Risk</option>
                <option value="HIGH">🟠 High Risk</option>
                <option value="MODERATE">🟡 Moderate Watch</option>
                <option value="LOW">🟢 Low / Safe</option>
              </select>

              <button
                type="button"
                className={`gis-toggle-btn ${showPolygons ? "active" : ""}`}
                onClick={() => setShowPolygons(!showPolygons)}
                title="Toggle Ward Boundary Zones"
              >
                {showPolygons ? "Zonal Sectors: ON" : "Zonal Sectors: OFF"}
              </button>
            </div>
          </div>

          <div className="gis-leaflet-container">
            <MapContainer
              center={mapCenter}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              className="leaflet-styled-canvas"
            >
              <RecenterWardMap center={mapCenter} zoom={11} />
              <TileLayer
                attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Render Ward Boundary Polygons */}
              {showPolygons &&
                filteredWards.map((w) => {
                  const isSelected = w.id === selectedWardId;
                  return (
                    <Polygon
                      key={`poly-${w.id}`}
                      positions={w.polygon}
                      pathOptions={{
                        color: w.risk_color,
                        fillColor: w.risk_color,
                        fillOpacity: isSelected ? 0.45 : 0.22,
                        weight: isSelected ? 3 : 1.5,
                        dashArray: isSelected ? undefined : "4, 4"
                      }}
                      eventHandlers={{
                        click: () => setSelectedWardId(w.id)
                      }}
                    />
                  );
                })}

              {/* Render Village/Ward Center Risk Pins */}
              {filteredWards.map((w) => {
                const isSelected = w.id === selectedWardId;
                return (
                  <CircleMarker
                    key={`marker-${w.id}`}
                    center={w.coordinates}
                    radius={isSelected ? 10 : 7}
                    pathOptions={{
                      color: "#ffffff",
                      fillColor: w.risk_color,
                      fillOpacity: 1,
                      weight: isSelected ? 3 : 1.5
                    }}
                    eventHandlers={{
                      click: () => setSelectedWardId(w.id)
                    }}
                  >
                    <Popup className="ward-leaflet-popup" minWidth={260}>
                      <div className="ward-popup-content">
                        <div className="popup-title-line">
                          <strong>{w.name}</strong>
                          <span
                            className="popup-risk-tag"
                            style={{ backgroundColor: `${w.risk_color}25`, color: w.risk_color, borderColor: `${w.risk_color}60` }}
                          >
                            {w.risk_level} ({w.risk_score})
                          </span>
                        </div>
                        <div className="popup-meta-line">
                          {w.district}, {w.state} • Elev {w.elevation_m}m
                        </div>
                        <div className="popup-divider"></div>
                        <div className="popup-stat-grid">
                          <div>Rainfall: <strong>{w.rainfall_mm_hr} mm/h</strong></div>
                          <div>Soil Moisture: <strong>{w.soil_moisture_pct}%</strong></div>
                          <div>River Stage: <strong>{w.water_level_m} m</strong></div>
                          <div>Slope Tilt: <strong>{w.slope_tilt_deg}°</strong></div>
                        </div>
                        <button
                          type="button"
                          className="popup-inspect-btn"
                          onClick={() => setSelectedWardId(w.id)}
                        >
                          Inspect Full Ward Risk Profile →
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Map Legend Overlay */}
            <div className="map-legend-overlay">
              <div className="legend-title">Disaster Risk Scale</div>
              <div className="legend-items-list">
                <div className="legend-row">
                  <span className="legend-dot critical"></span>
                  <span className="legend-text">Critical (Score 75–100)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot high"></span>
                  <span className="legend-text">High Risk (Score 50–74)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot moderate"></span>
                  <span className="legend-text">Moderate (Score 30–49)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot low"></span>
                  <span className="legend-text">Low / Safe (Score 0–29)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Ward Detail & Multi-Factor Risk Assessment Dossier */}
        <div className="ward-dossier-card">
          {activeWard ? (
            <div className="dossier-inner">
              {/* Top Title & Risk Score Box */}
              <div className="dossier-header-strip">
                <div>
                  <div className="dossier-id-tag">WARD ID: {activeWard.id}</div>
                  <h2 className="dossier-ward-title">{activeWard.name}</h2>
                  <div className="dossier-geo-meta">
                    <MapPin size={13} />
                    <span>{activeWard.district}, {activeWard.state}</span>
                    <span className="meta-dot">•</span>
                    <span>Elevation: {activeWard.elevation_m}m MSL</span>
                  </div>
                </div>

                <div
                  className="dossier-score-badge"
                  style={{
                    backgroundColor: `${activeWard.risk_color}18`,
                    borderColor: `${activeWard.risk_color}50`
                  }}
                >
                  <span className="score-val" style={{ color: activeWard.risk_color }}>
                    {activeWard.risk_score}
                  </span>
                  <span className="score-lbl">RISK SCORE</span>
                  <span
                    className="risk-tier-pill"
                    style={{ backgroundColor: activeWard.risk_color }}
                  >
                    {activeWard.risk_level}
                  </span>
                </div>
              </div>

              {/* Recommended Disaster Management Action Directive */}
              <div className={`dossier-action-banner ${activeWard.risk_level.toLowerCase()}`}>
                <div className="action-banner-headline">
                  <ShieldAlert size={16} />
                  <span>Recommended Disaster-Management Protocol</span>
                </div>
                <p className="action-banner-text">{activeWard.recommended_action}</p>
              </div>

              {/* 4 Core Parameter Cards (Rainfall, Soil Moisture, Water Level, Slope Risk) */}
              <div className="dossier-parameters-grid">
                {/* 1. Rainfall */}
                <div className="param-tile">
                  <div className="param-tile-header">
                    <CloudRain size={16} className="param-icon rain-icon" />
                    <span>Rainfall Intensity</span>
                  </div>
                  <div className="param-tile-value">
                    {activeWard.rainfall_mm_hr} <small>mm/hr</small>
                  </div>
                  <div className="param-tile-sub">
                    24h Total: <strong>{activeWard.rainfall_24h_mm} mm</strong>
                  </div>
                  <div className="param-tile-meter">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${Math.min(100, (activeWard.rainfall_mm_hr / 60) * 100)}%`,
                        backgroundColor: activeWard.rainfall_mm_hr >= 35 ? "#ef4444" : activeWard.rainfall_mm_hr >= 15 ? "#f97316" : "#10b981"
                      }}
                    />
                  </div>
                </div>

                {/* 2. Soil Moisture */}
                <div className="param-tile">
                  <div className="param-tile-header">
                    <Droplets size={16} className="param-icon soil-icon" />
                    <span>Soil Moisture</span>
                  </div>
                  <div className="param-tile-value">
                    {activeWard.soil_moisture_pct} <small>% saturation</small>
                  </div>
                  <div className="param-tile-sub">
                    Pore Pressure: <strong>{activeWard.soil_moisture_pct >= 85 ? "Critical Saturation" : "Standard Moisture"}</strong>
                  </div>
                  <div className="param-tile-meter">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${activeWard.soil_moisture_pct}%`,
                        backgroundColor: activeWard.soil_moisture_pct >= 85 ? "#ef4444" : activeWard.soil_moisture_pct >= 70 ? "#f97316" : "#10b981"
                      }}
                    />
                  </div>
                </div>

                {/* 3. Water Level & River Channel */}
                <div className="param-tile">
                  <div className="param-tile-header">
                    <Waves size={16} className="param-icon water-icon" />
                    <span>River Water Level</span>
                  </div>
                  <div className="param-tile-value">
                    {activeWard.water_level_m.toFixed(2)} <small>m (Stage)</small>
                  </div>
                  <div className="param-tile-sub">
                    Rate: <strong>{activeWard.rate_of_rise_m_hr > 0 ? `+${activeWard.rate_of_rise_m_hr.toFixed(2)}` : activeWard.rate_of_rise_m_hr} m/h</strong>
                  </div>
                  <div className="param-tile-meter">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${Math.min(100, (activeWard.water_level_m / activeWard.danger_level_m) * 100)}%`,
                        backgroundColor: activeWard.water_level_m >= activeWard.danger_level_m ? "#ef4444" : "#0284c7"
                      }}
                    />
                  </div>
                </div>

                {/* 4. Slope / Terrain Risk */}
                <div className="param-tile">
                  <div className="param-tile-header">
                    <Mountain size={16} className="param-icon slope-icon" />
                    <span>Slope & Ground Tilt</span>
                  </div>
                  <div className="param-tile-value">
                    {activeWard.slope_tilt_deg.toFixed(1)} <small>° inclination</small>
                  </div>
                  <div className="param-tile-sub">
                    Slope Risk: <strong style={{ color: activeWard.slope_risk === "CRITICAL" ? "#ef4444" : activeWard.slope_risk === "HIGH" ? "#f97316" : "#10b981" }}>{activeWard.slope_risk}</strong>
                  </div>
                  <div className="param-tile-meter">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${Math.min(100, (activeWard.slope_tilt_deg / 45) * 100)}%`,
                        backgroundColor: activeWard.slope_tilt_deg >= 30 ? "#ef4444" : activeWard.slope_tilt_deg >= 20 ? "#f97316" : "#10b981"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Historical Flood & Channel Profile */}
              <div className="dossier-history-section">
                <div className="history-title-row">
                  <History size={14} />
                  <span>Historical Hazard & Watershed Record</span>
                </div>
                <div className="history-details-grid">
                  <div className="hist-cell">
                    <span className="hist-lbl">Channel Name</span>
                    <span className="hist-val">{activeWard.river_name}</span>
                  </div>
                  <div className="hist-cell">
                    <span className="hist-lbl">Historical Inundation Frequency</span>
                    <span className="hist-val">{activeWard.historical_flood_risk} RECORD</span>
                  </div>
                  <div className="hist-cell">
                    <span className="hist-lbl">Linked Telemetry IoT Node</span>
                    <span className="hist-val">{activeWard.sensor_id} (ONLINE)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-ward-selected">Select a village or ward on the map to inspect details</div>
          )}
        </div>
      </div>

      {/* Ward Telemetry Register Table */}
      <div className="wards-table-section">
        <div className="wards-table-header">
          <div className="table-title">
            <Activity size={16} />
            <h3>Mountain Village/Ward Multi-Hazard Matrix ({filteredWards.length} Zones)</h3>
          </div>
          <span className="table-subtitle-badge">Unified 4-Factor Telemetry Matrix</span>
        </div>

        <div className="wards-table-container">
          <table className="wards-table">
            <thead>
              <tr>
                <th>Village / Ward</th>
                <th>District & State</th>
                <th>Risk Score</th>
                <th>Rainfall</th>
                <th>Soil Saturation</th>
                <th>River Stage</th>
                <th>Slope Tilt</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredWards.map((w) => {
                const isSelected = w.id === selectedWardId;
                return (
                  <tr
                    key={w.id}
                    className={`ward-table-row ${isSelected ? "selected-row" : ""}`}
                    onClick={() => setSelectedWardId(w.id)}
                  >
                    <td>
                      <div className="ward-name-block">
                        <strong>{w.name}</strong>
                        <span className="ward-river-sub">{w.river_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="dist-text">{w.district}, {w.state}</span>
                    </td>
                    <td>
                      <div className="score-cell">
                        <strong style={{ color: w.risk_color }}>{w.risk_score} / 100</strong>
                      </div>
                    </td>
                    <td>
                      <span className="metric-val">{w.rainfall_mm_hr} mm/h</span>
                    </td>
                    <td>
                      <span className="metric-val">{w.soil_moisture_pct}%</span>
                    </td>
                    <td>
                      <span className="metric-val">{w.water_level_m.toFixed(2)} m</span>
                    </td>
                    <td>
                      <span className="metric-val">{w.slope_tilt_deg}°</span>
                    </td>
                    <td>
                      <span
                        className="ward-badge"
                        style={{
                          backgroundColor: `${w.risk_color}20`,
                          color: w.risk_color,
                          borderColor: `${w.risk_color}50`
                        }}
                      >
                        {w.risk_level}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ward-inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWardId(w.id);
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HyperLocalRiskMapDashboard;
