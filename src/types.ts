// ─────────────────────────────────────────────────────────────────────────────
// SIH 2026 — Flash Flood Prediction & Hyper-Local Risk Monitoring System
// Phase 1: Weather Data Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WeatherLocation {
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/** Current real-time conditions from Open-Meteo's "current" block */
export interface CurrentWeather {
  /** ISO-8601 timestamp as returned by the API (Asia/Kolkata) */
  timestamp: string;
  /** Air temperature 2 m above ground (°C) */
  temperature: number | null;
  /** Apparent / feels-like temperature (°C) */
  apparentTemperature: number | null;
  /** Relative humidity 2 m above ground (%) */
  humidity: number | null;
  /** Total precipitation in the last hour (mm) */
  precipitation: number | null;
  /** Rain component of precipitation (mm) */
  rain: number | null;
  /** Wind speed at 10 m (km/h) */
  windSpeed: number | null;
  /** Wind gust speed at 10 m (km/h) */
  windGust: number | null;
  /** Mean sea-level pressure (hPa) */
  pressure: number | null;
  /** Total cloud cover (%) */
  cloudCover: number | null;
  /** WMO weather interpretation code */
  weatherCode: number | null;
}

/** One hour slot from the hourly forecast */
export interface HourlyWeatherEntry {
  /** ISO-8601 timestamp */
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  rain: number | null;
  /** Probability of precipitation (%) */
  precipitationProbability: number | null;
  windSpeed: number | null;
  windGust: number | null;
  pressure: number | null;
  cloudCover: number | null;
  /** Volumetric soil moisture content, 0–1 cm layer (m³/m³) */
  soilMoisture: number | null;
  weatherCode: number | null;
}

/** Fully normalized weather response returned by GET /api/weather/current */
export interface WeatherData {
  location: WeatherLocation;
  current: CurrentWeather;
  /** Next 24 hourly entries starting from the current hour */
  hourly: HourlyWeatherEntry[];
  source: {
    provider: string;   // "Open-Meteo"
    /** ISO timestamp of when the backend fetched the data from Open-Meteo */
    updatedAt: string;
  };
}

/** Simple weather condition classification (NOT flood risk) */
export type WeatherCondition =
  | 'CLEAR'
  | 'CLOUDY'
  | 'RAIN'
  | 'HEAVY_RAIN'
  | 'STORM'
  | 'UNKNOWN';
