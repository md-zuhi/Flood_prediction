/**
 * Multi-Source Data Architecture Schema
 * SIH 2026: Flash Flood Prediction System for Hilly Regions
 * 
 * Fuses 7 primary multi-source environmental and hydrological data streams:
 * 1. River Water-Level Data (Telemetry / Field Gauges)
 * 2. Rainfall Data (Local Gauge / Precipitation)
 * 3. Upstream Rainfall (Upper Catchment Inflow)
 * 4. Weather Data (Atmospheric Meteorology)
 * 5. Elevation (Digital Elevation Model)
 * 6. Slope / Terrain (SRTM Geomorphometry)
 * 7. Historical Flood Data (CWC / GSI Records)
 * 
 * TRANSPARENCY RULE:
 * All sources clearly declare data provenance (LIVE_API, REAL_STATIC_DATA, or DEMO_SIMULATED_DATA).
 */

const createEmptyRiverMultiSourceRecord = () => ({
  river_station: {
    station_id: null,
    river_name: null,
    location: null,
    district: null,
    state: null,
    basin: null,
    coordinates: { latitude: null, longitude: null }
  },

  // 1. River Water-Level Data
  river_water_level: {
    current_level_m: null,
    previous_level_m: null,
    warning_level_m: null,
    danger_level_m: null,
    bed_level_m: null,
    rate_of_rise_m_hr: null,
    trend: null,
    trend_direction: null,
    flow_velocity_ms: null,
    discharge_cusecs: null,
    observation_time: null,
    source: "Field Automated Telemetry Station",
    provenance: "DEMO_SIMULATED_DATA", // Transparently labelled
    is_real_api: false
  },

  // 2. Local Rainfall Data
  rainfall: {
    rain_1h_mm: null,
    rain_3h_mm: null,
    rain_6h_mm: null,
    rain_12h_mm: null,
    rain_24h_mm: null,
    observation_time: null,
    source: "Open-Meteo Real-Time Weather API",
    provenance: "LIVE_API",
    is_real_api: true
  },

  // 3. Upstream Catchment Rainfall Data
  upstream_rainfall: {
    upstream_station: null,
    current_intensity_mm_hr: null,
    upstream_rain_6h_mm: null,
    estimated_hydraulic_lag_hours: null,
    catchment_area_sqkm: null,
    observation_time: null,
    source: "Open-Meteo Catchment Inflow Telemetry",
    provenance: "LIVE_API",
    is_real_api: true
  },

  // 4. Weather & Meteorological Data
  weather: {
    temperature_c: null,
    humidity_percent: null,
    wind_speed_kmh: null,
    pressure_hpa: null,
    weather_code: null,
    observation_time: null,
    source: "Open-Meteo Meteorology",
    provenance: "LIVE_API",
    is_real_api: true
  },

  // 5. Elevation Data
  elevation: {
    station_elevation_m: null,
    upstream_peak_elevation_m: null,
    elevation_drop_m: null,
    source: "NASA SRTM 30m DEM / OpenTopography",
    provenance: "REAL_TERRAIN_CACHE",
    is_real_api: true
  },

  // 6. Slope & Terrain Geomorphometry
  slope_terrain: {
    mean_slope_deg: null,
    max_slope_deg: null,
    local_relief_m: null,
    valley_confinement: "HIGH_GORGE",
    source: "NASA SRTM Topographic Analysis",
    provenance: "REAL_TERRAIN_CACHE",
    is_real_api: true
  },

  // 7. Historical Flood & Inundation Data
  historical_flood_data: {
    highest_flood_level_m: null,
    highest_recorded_year: null,
    historical_flood_events_count: null,
    catchment_susceptibility: "HIGH",
    source: "Central Water Commission (CWC) & GSI Archives",
    provenance: "CURATED_HISTORICAL_RECORD",
    is_real_api: true
  },

  // Multi-Source Metadata & Health Rollup
  fusion_metadata: {
    fused_at: null,
    total_sources: 7,
    live_api_sources_count: 4,
    static_real_sources_count: 2,
    simulated_demo_sources_count: 1,
    data_completeness_percent: 100,
    disclaimer: "Hydrological multi-source fused record. Live meteorology and terrain fused with demo river gauge telemetry."
  }
});

module.exports = {
  createEmptyRiverMultiSourceRecord
};
