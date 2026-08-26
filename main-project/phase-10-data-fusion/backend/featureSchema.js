const createEmptyFeatureRecord = () => ({
  location: {
    name: null,
    state: null,
    country: null,
    latitude: null,
    longitude: null
  },

  weather: {
    temperature_c: null,
    humidity_percent: null,
    wind_speed_kmh: null,
    observation_time: null,
    source: "Open-Meteo"
  },

  rainfall: {
    rain_30m_mm: null,
    rain_1h_mm: null,
    rain_3h_mm: null,
    rain_6h_mm: null,
    rain_12h_mm: null,
    rain_24h_mm: null,
    observation_time: null,
    source: "Open-Meteo"
  },

  rainfall_forecast: {
    forecast_1h_mm: null,
    forecast_3h_mm: null,
    forecast_6h_mm: null,
    forecast_12h_mm: null,
    forecast_24h_mm: null,
    generated_time: null,
    source: "Open-Meteo / ECMWF"
  },

  soil_moisture: {
    value_m3_m3: null,
    observation_time: null,
    age_hours: null,
    quality: null,
    source: "NASA SMAP"
  },

  terrain: {
    elevation_m: null,
    min_elevation_m: null,
    max_elevation_m: null,
    mean_elevation_m: null,
    local_relief_m: null,
    slope_deg: null,
    mean_slope_deg: null,
    max_slope_deg: null,
    source: "NASA SRTM"
  },

  landslide_history: {
    nearest_event_km: null,
    count_5km: null,
    count_10km: null,
    count_25km: null,
    historical_susceptibility: null,
    source: "GSI"
  },

  satellite_rainfall: {
    current_intensity_mm_hr: null,
    regional_max_intensity_mm_hr: null,
    rain_30m_mm: null,
    rain_1h_mm: null,
    rain_3h_mm: null,
    rain_6h_mm: null,
    rain_12h_mm: null,
    rain_24h_mm: null,
    observation_time: null,
    source: "NASA GPM IMERG"
  },

  iot: {
    available: false,
    rainfall_mm: null,
    soil_moisture: null,
    water_level: null,
    observation_time: null
  },

  metadata: {
    generated_at: null,
    data_completeness_percent: null,
    missing_features: [],
    warnings: []
  }
});

module.exports = {
  createEmptyFeatureRecord
};