/**
 * Unified Weather Normalizer Helper
 * Normalizes backend responses from:
 * - POST /api/predict
 * - GET /api/weather-point
 * - GET /api/weather-cities
 * - GET /api/weather-grid
 * into ONE consistent frontend structure.
 */

export function normalizeWeatherResponse(raw, locationObj = null) {
  if (!raw) {
    return {
      name: locationObj?.name || "Selected Location",
      state: locationObj?.state || "",
      latitude: locationObj?.latitude ?? null,
      longitude: locationObj?.longitude ?? null,
      temperature_c: null,
      humidity_percent: null,
      wind_speed_kmh: null,
      wind_direction_deg: null,
      precipitation_mm: null,
      rain_1h_mm: null,
      rain_24h_mm: null,
      forecast_1h_mm: null,
      forecast_3h_mm: null,
      forecast_6h_mm: null,
      forecast_12h_mm: null,
      forecast_24h_mm: null,
      gpm_intensity_mm_hr: null,
      gpm_freshness: "N/A",
      gpm_observation_time: null,
      flood_probability_percent: null,
      risk_level: "LOW",
      observation_time: null,
      source: "Open-Meteo",
      isFloodSupported: locationObj?.isSupportedFloodLoc ?? true
    };
  }

  // Handle nested /api/predict format vs flat weather format
  const env = raw.environmental_data || {};
  const loc = raw.location || locationObj || {};
  const w = env.weather || raw.weather || raw || {};
  const r = env.rainfall || raw.rainfall || {};
  const f = env.rainfall_forecast || raw.rainfall_forecast || raw.forecast || {};
  const gpm = env.satellite_rainfall || raw.satellite_rainfall || {};
  const pred = raw.prediction || {};

  const temp = w.temperature_c ?? w.temperature ?? null;
  const humidity = w.humidity_percent ?? w.relative_humidity ?? null;
  const windSpeed = w.wind_speed_kmh ?? w.wind_speed ?? null;
  const windDir = w.wind_direction_deg ?? w.wind_direction ?? null;
  const precip = w.precipitation_mm ?? r.rain_1h_mm ?? w.precipitation ?? null;

  return {
    name: loc.name || locationObj?.name || "Inspected Location",
    state: loc.state || locationObj?.state || "",
    latitude: loc.latitude ?? locationObj?.latitude ?? null,
    longitude: loc.longitude ?? locationObj?.longitude ?? null,

    // Real Meteorological Metrics
    temperature_c: temp !== null ? Number(temp) : null,
    humidity_percent: humidity !== null ? Number(humidity) : null,
    wind_speed_kmh: windSpeed !== null ? Number(windSpeed) : null,
    wind_direction_deg: windDir !== null ? Number(windDir) : null,
    precipitation_mm: precip !== null ? Number(precip) : null,

    // Rolling Rainfall
    rain_1h_mm: r.rain_1h_mm ?? precip ?? null,
    rain_3h_mm: r.rain_3h_mm ?? null,
    rain_6h_mm: r.rain_6h_mm ?? null,
    rain_12h_mm: r.rain_12h_mm ?? null,
    rain_24h_mm: r.rain_24h_mm ?? null,

    // Rainfall Forecast (Open-Meteo)
    forecast_1h_mm: f.forecast_1h_mm ?? f['1h'] ?? null,
    forecast_3h_mm: f.forecast_3h_mm ?? f['3h'] ?? null,
    forecast_6h_mm: f.forecast_6h_mm ?? f['6h'] ?? null,
    forecast_12h_mm: f.forecast_12h_mm ?? f['12h'] ?? null,
    forecast_24h_mm: f.forecast_24h_mm ?? f['24h'] ?? null,

    // NASA GPM Satellite Rainfall Metrics
    gpm_intensity_mm_hr: gpm.current_intensity_mm_hr ?? null,
    gpm_rain_1h_mm: gpm.rain_1h_mm ?? null,
    gpm_rain_3h_mm: gpm.rain_3h_mm ?? null,
    gpm_rain_6h_mm: gpm.rain_6h_mm ?? null,
    gpm_rain_12h_mm: gpm.rain_12h_mm ?? null,
    gpm_rain_24h_mm: gpm.rain_24h_mm ?? null,
    gpm_freshness: gpm.freshness || "NEAR REAL-TIME",
    gpm_observation_time: gpm.observation_time || null,

    // ML Flood Prediction (Sub-basins)
    flood_probability_percent: pred.flood_probability_percent ?? null,
    risk_level: pred.risk_level || "LOW",
    alert_message: pred.alert_message || null,

    observation_time: w.observation_time || r.observation_time || "NRT",
    source: w.source || "Open-Meteo",
    isFloodSupported: locationObj?.isSupportedFloodLoc ?? (pred.flood_probability_percent !== undefined)
  };
}
