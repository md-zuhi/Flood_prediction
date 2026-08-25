// ─────────────────────────────────────────────────────────────────────────────
// SIH 2026 — Flash Flood Prediction & Hyper-Local Risk Monitoring System
// Phase 1: Open-Meteo Weather Service (Node.js / server-side)
//
// This module is responsible for:
//   1. Constructing the Open-Meteo request URL using URLSearchParams
//   2. Fetching with a configurable timeout via AbortController
//   3. Normalising the raw response into the clean WeatherData shape
//
// IMPORTANT: The backend controls which external API is contacted.
//            Callers supply only latitude/longitude; the base URL is
//            taken from the environment and never exposed to clients.
// ─────────────────────────────────────────────────────────────────────────────

import type { WeatherData, CurrentWeather, HourlyWeatherEntry } from '../src/types.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const OPEN_METEO_BASE_URL =
  process.env.OPEN_METEO_BASE_URL ?? 'https://api.open-meteo.com/v1/forecast';

/** Default location: Chennai, Tamil Nadu, India */
const DEFAULT_LATITUDE  = parseFloat(process.env.WEATHER_LATITUDE  ?? '13.0827');
const DEFAULT_LONGITUDE = parseFloat(process.env.WEATHER_LONGITUDE ?? '80.2707');
const DEFAULT_TIMEZONE  = process.env.WEATHER_TIMEZONE ?? 'Asia/Kolkata';

/** HTTP timeout for Open-Meteo requests (10 seconds) */
const FETCH_TIMEOUT_MS = 10_000;

// ── Current variables to fetch ────────────────────────────────────────────────

const CURRENT_VARIABLES = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'rain',
  'wind_speed_10m',
  'wind_gusts_10m',
  'pressure_msl',
  'cloud_cover',
  'weather_code',
].join(',');

// ── Hourly variables to fetch ─────────────────────────────────────────────────

const HOURLY_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'rain',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_gusts_10m',
  'pressure_msl',
  'cloud_cover',
  'soil_moisture_0_to_1cm',
  'weather_code',
].join(',');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Safely extract a number at a given index from an array, returning null if unavailable. */
function safeNum(arr: (number | null)[] | undefined, idx: number): number | null {
  if (!arr || idx >= arr.length) return null;
  const v = arr[idx];
  return typeof v === 'number' && isFinite(v) ? v : null;
}

/** Resolve the index in the hourly arrays that corresponds to the current hour. */
function findCurrentHourIndex(times: string[]): number {
  const now = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  const idx = times.findIndex((t) => t.startsWith(now));
  return idx >= 0 ? idx : 0;
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function normalise(
  raw: Record<string, unknown>,
  lat: number,
  lon: number,
  tz: string,
): WeatherData {
  const currentRaw = (raw.current ?? {}) as Record<string, unknown>;
  const currentUnits = (raw.current_units ?? {}) as Record<string, string>;
  const hourlyRaw  = (raw.hourly ?? {}) as Record<string, (number | null)[]>;
  const times: string[] = (hourlyRaw.time as string[]) ?? [];

  // ── Current conditions ────────────────────────────────────────────────────
  const current: CurrentWeather = {
    timestamp:           (currentRaw.time as string)                   ?? new Date().toISOString(),
    temperature:         (currentRaw.temperature_2m       as number)   ?? null,
    apparentTemperature: (currentRaw.apparent_temperature as number)   ?? null,
    humidity:            (currentRaw.relative_humidity_2m as number)   ?? null,
    precipitation:       (currentRaw.precipitation        as number)   ?? null,
    rain:                (currentRaw.rain                 as number)   ?? null,
    windSpeed:           (currentRaw.wind_speed_10m       as number)   ?? null,
    windGust:            (currentRaw.wind_gusts_10m       as number)   ?? null,
    pressure:            (currentRaw.pressure_msl         as number)   ?? null,
    cloudCover:          (currentRaw.cloud_cover          as number)   ?? null,
    weatherCode:         (currentRaw.weather_code         as number)   ?? null,
  };

  // ── Hourly forecast — next 24 hours from current hour ─────────────────────
  const startIdx = findCurrentHourIndex(times);
  const endIdx   = Math.min(startIdx + 24, times.length);

  const hourly: HourlyWeatherEntry[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    hourly.push({
      timestamp:               times[i],
      temperature:             safeNum(hourlyRaw.temperature_2m,          i),
      humidity:                safeNum(hourlyRaw.relative_humidity_2m,     i),
      precipitation:           safeNum(hourlyRaw.precipitation,            i),
      rain:                    safeNum(hourlyRaw.rain,                     i),
      precipitationProbability:safeNum(hourlyRaw.precipitation_probability,i),
      windSpeed:               safeNum(hourlyRaw.wind_speed_10m,           i),
      windGust:                safeNum(hourlyRaw.wind_gusts_10m,           i),
      pressure:                safeNum(hourlyRaw.pressure_msl,             i),
      cloudCover:              safeNum(hourlyRaw.cloud_cover,              i),
      soilMoisture:            safeNum(hourlyRaw.soil_moisture_0_to_1cm,   i),
      weatherCode:             safeNum(hourlyRaw.weather_code as (number|null)[], i),
    });
  }

  return {
    location: {
      name:      'Chennai',
      state:     'Tamil Nadu',
      country:   'India',
      latitude:  lat,
      longitude: lon,
      timezone:  tz,
    },
    current,
    hourly,
    source: {
      provider:  'Open-Meteo',
      updatedAt: new Date().toISOString(),
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FetchWeatherOptions {
  latitude?:  number;
  longitude?: number;
  timezone?:  string;
}

/**
 * Fetch live weather data from Open-Meteo and return a normalised WeatherData object.
 *
 * @param options - Overrides for latitude, longitude, and timezone.
 *                  Defaults to Chennai, Asia/Kolkata when not provided.
 */
export async function fetchWeatherFromOpenMeteo(
  options: FetchWeatherOptions = {},
): Promise<WeatherData> {
  const lat = options.latitude  ?? DEFAULT_LATITUDE;
  const lon = options.longitude ?? DEFAULT_LONGITUDE;
  const tz  = options.timezone  ?? DEFAULT_TIMEZONE;

  // Build request URL using URLSearchParams — no manual string concatenation
  const params = new URLSearchParams({
    latitude:  String(lat),
    longitude: String(lon),
    timezone:  tz,
    current:   CURRENT_VARIABLES,
    hourly:    HOURLY_VARIABLES,
    forecast_days: '2',       // today + tomorrow gives us 48 h of hourly data
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;

  // Enforce a hard 10-second timeout — never hang indefinitely
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let raw: Record<string, unknown>;

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(
        `Open-Meteo responded with HTTP ${response.status} ${response.statusText}`,
      );
    }

    raw = (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }

  return normalise(raw, lat, lon, tz);
}
