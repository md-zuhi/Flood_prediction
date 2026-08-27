import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import DashboardHeader from "../components/DashboardHeader";
import RiskScoreCard from "../components/RiskScoreCard";
import AlertCard from "../components/AlertCard";
import QuickStats from "../components/QuickStats";
import RiskFactors from "../components/RiskFactors";
import DataConfidence from "../components/DataConfidence";
import LoadingState from "../components/LoadingState";

function OverviewDashboard({
  result,
  selectedLocation,
  locations,
  onLocationChange,
  loading,
  error,
  riskColor,
  getRiskColor,
  theme,
  onToggleTheme,
}) {
  return (
    <div className="main-content">
      <DashboardHeader
        selectedLocation={selectedLocation}
        locations={locations}
        onLocationChange={onLocationChange}
        loading={loading}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {error && <div className="error-box">⚠ {error}</div>}

      {loading && <LoadingState />}

      {result && (
        <div className="dashboard-grid">
          {/* Top Row: Risk Score and Alert */}
          <div className="row top-row">
            <RiskScoreCard
              floodProbability={result.prediction.flood_probability_percent}
              riskLevel={result.prediction.risk_level}
              riskColor={riskColor}
            />
            <AlertCard
              riskLevel={result.prediction.risk_level}
              alertMessage={result.prediction.alert_message}
              riskColor={riskColor}
              timestamp={result.generated_at}
            />
          </div>

          {/* Bottom Row: Quick Stats, Contributing Factors, and Data Confidence */}
          <div className="row bottom-row">
            <QuickStats
              rain24h={result.ml_features.rain_24h_mm}
              soilMoisture={result.ml_features.soil_moisture_m3m3}
              elevation={result.ml_features.elevation_m}
              temperature={result.ml_features.temperature_c}
            />
            <RiskFactors
              rain24h={result.ml_features.rain_24h_mm}
              soilMoisture={result.ml_features.soil_moisture_m3m3}
              slope={result.environmental_data?.terrain?.slope_deg}
              nearestLandslide={
                result.environmental_data?.landslide_history?.nearest_event_km
              }
              elevation={result.ml_features.elevation_m}
            />
            <DataConfidence
              dataCompleteness={result.metadata?.data_completeness_percent}
              overallConfidence={result.metadata?.overall_data_confidence}
              sourceHealth={result.metadata?.source_health}
            />
          </div>

          {/* Map and Sources Section */}
          <div className="row map-row">
            <div className="card map-card">
              <h3 className="card-title">Risk Location Map</h3>
              <div className="map-wrapper">
                <MapContainer
                  key={`${result.location.latitude}-${result.location.longitude}`}
                  center={[result.location.latitude, result.location.longitude]}
                  zoom={12}
                  className="map-container-leaflet"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker
                    position={[
                      result.location.latitude,
                      result.location.longitude,
                    ]}
                  >
                    <Popup>
                      <strong>{result.location.name}</strong>
                      <br />
                      Risk: {result.prediction.risk_level}
                      <br />
                      Probability: {result.prediction.flood_probability_percent}%
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          </div>

          {/* Footer Metadata */}
          <footer className="dashboard-footer-info">
            <div className="sources-container">
              <span className="source-tag">Open-Meteo API</span>
              <span className="source-tag">NASA SMAP</span>
              <span className="source-tag">NASA SRTM DEM</span>
              <span className="source-tag">GSI Landslide Inventory</span>
              <span className="source-tag">NASA GPM IMERG</span>
            </div>
            <p className="disclaimer">
              * Disclaimer: This application is a decision-support prototype. Risk bands are
              model-calculated indicators and do not serve as official disaster notifications.
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}

export default OverviewDashboard;
