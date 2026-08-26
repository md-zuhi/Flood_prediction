// ─────────────────────────────────────────────────────────────────────────────
// SIH 2026 — Weather utility helpers (frontend only)
// ─────────────────────────────────────────────────────────────────────────────

import type { WeatherCondition } from '../types';

/**
 * Derive a simple weather condition from WMO weather codes and precipitation.
 * This is NOT a flood risk assessment — it is only a surface-level classification
 * of current atmospheric conditions.
 *
 * WMO code reference: https://open-meteo.com/en/docs#weathervariables
 */
export function classifyWeatherCondition(
  weatherCode: number | null,
  precipitation: number | null,
): WeatherCondition {
  if (weatherCode === null) return 'UNKNOWN';

  // Thunderstorms
  if (weatherCode >= 95) return 'STORM';

  // Heavy rain
  if (weatherCode >= 65 || (precipitation !== null && precipitation >= 7.6)) {
    return 'HEAVY_RAIN';
  }

  // Moderate/light rain, drizzle, showers
  if (weatherCode >= 51) return 'RAIN';

  // Overcast/fog/mist
  if (weatherCode >= 45) return 'CLOUDY';

  // Partly cloudy
  if (weatherCode >= 3) return 'CLOUDY';

  // Clear/mainly clear
  return 'CLEAR';
}

/** Human-readable label for the condition */
export function conditionLabel(c: WeatherCondition): string {
  switch (c) {
    case 'CLEAR':      return 'Clear';
    case 'CLOUDY':     return 'Cloudy';
    case 'RAIN':       return 'Rain';
    case 'HEAVY_RAIN': return 'Heavy Rain';
    case 'STORM':      return 'Thunderstorm';
    default:           return 'Unknown';
  }
}

/** CSS class for the condition badge */
export function conditionBadgeClass(c: WeatherCondition): string {
  switch (c) {
    case 'CLEAR':      return 'badge badge-clear';
    case 'CLOUDY':     return 'badge badge-cloudy';
    case 'RAIN':       return 'badge badge-rain';
    case 'HEAVY_RAIN': return 'badge badge-heavy';
    case 'STORM':      return 'badge badge-storm';
    default:           return 'badge badge-cloudy';
  }
}

/** Emoji icon for the condition */
export function conditionEmoji(c: WeatherCondition): string {
  switch (c) {
    case 'CLEAR':      return '☀️';
    case 'CLOUDY':     return '☁️';
    case 'RAIN':       return '🌧️';
    case 'HEAVY_RAIN': return '⛈️';
    case 'STORM':      return '🌩️';
    default:           return '🌡️';
  }
}

/**
 * Format an ISO-8601 timestamp for display in IST (Asia/Kolkata).
 * Returns a short, human-readable string.
 */
export function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone:    'Asia/Kolkata',
      day:         '2-digit',
      month:       'short',
      year:        'numeric',
      hour:        '2-digit',
      minute:      '2-digit',
      hour12:      true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Format only the time portion of an ISO timestamp in IST.
 */
export function formatTimeOnly(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   true,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

/**
 * Format the epoch ms of our own last fetch for display.
 */
export function formatLastFetched(epochMs: number | null): string {
  if (!epochMs) return '—';
  return formatTimestamp(new Date(epochMs).toISOString());
}

/** Round to 1 decimal place for display, returning '—' for null */
export function fmt(value: number | null, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(decimals);
}
