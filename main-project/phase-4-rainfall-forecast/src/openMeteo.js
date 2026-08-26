// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Open-Meteo Geocoding + Rainfall Forecast API helpers
// ─────────────────────────────────────────────────────────────────────────────

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const ECMWF_FORECAST_URL = 'https://api.open-meteo.com/v1/ecmwf';
const GENERIC_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const FORECAST_HOURS = 48;
const REQUEST_TIMEOUT_MS = 15000;

/** @returns {{ year: string, month: string, day: string, hour: string, minute: number, second: number }} */
export function getLocalDateTimeParts(date, timezone) {
  const parts = {};
  for (const { type, value } of new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)) {
    parts[type] = value;
  }

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function formatLocalDatetime(parts) {
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`;
}

/** @returns {string} Hour key like "2026-08-24T14" in the given IANA timezone */
export function getLocalHourKey(date, timezone) {
  const parts = getLocalDateTimeParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
}

/**
 * Determine the first complete future forecast hour key.
 * At exactly HH:00:00 → current hour; with any minutes/seconds → next full hour.
 */
export function getFirstCompleteFutureHourKey(now, timezone, utcOffsetSeconds) {
  const dt = getLocalDateTimeParts(now, timezone);
  const currentHourKey = `${dt.year}-${dt.month}-${dt.day}T${dt.hour}`;
  const partialHourSkipped = dt.minute > 0 || dt.second > 0;

  if (!partialHourSkipped) {
    return {
      firstHourKey: currentHourKey,
      partialHourSkipped: false,
      partialCurrentHourIncluded: true,
      currentLocalDatetime: formatLocalDatetime(dt),
      currentLocalHour: dt.hour,
      currentLocalMinute: dt.minute,
      currentHourKey,
    };
  }

  const hourStart = localPartsToDate(
    { ...dt, minute: 0, second: 0 },
    utcOffsetSeconds
  );
  const nextHourKey = getLocalHourKey(new Date(hourStart.getTime() + 3600000), timezone);

  return {
    firstHourKey: nextHourKey,
    partialHourSkipped: true,
    partialCurrentHourIncluded: false,
    currentLocalDatetime: formatLocalDatetime(dt),
    currentLocalHour: dt.hour,
    currentLocalMinute: dt.minute,
    currentHourKey,
  };
}

/** @returns {string} Hour key from an Open-Meteo local ISO timestamp */
export function apiTimeToHourKey(iso) {
  return iso.slice(0, 13);
}

/** Convert local datetime parts + utc offset to a Date object */
export function localPartsToDate(parts, utcOffsetSeconds) {
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      parts.minute ?? 0,
      parts.second ?? 0
    ) -
      utcOffsetSeconds * 1000
  );
}

/** Convert Open-Meteo local ISO timestamp + utc offset to a Date object */
export function localIsoToDate(isoLocal, utcOffsetSeconds) {
  const [datePart, timePart] = isoLocal.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min = 0, sec = 0] = timePart.split(':').map(Number);
  return localPartsToDate(
    {
      year: String(y),
      month: String(m).padStart(2, '0'),
      day: String(d).padStart(2, '0'),
      hour: String(h).padStart(2, '0'),
      minute: min,
      second: sec,
    },
    utcOffsetSeconds
  );
}

export function formatHourTime(isoLocal, utcOffsetSeconds, timezone) {
  const date = localIsoToDate(isoLocal, utcOffsetSeconds);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatTimestamp(isoString, timezone) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

export function formatMm(value) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)} mm`;
}

export function formatMmPerHour(value) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)} mm/hour`;
}

async function fetchJson(url, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`${label} returned an invalid JSON response.`);
    }

    if (!response.ok) {
      const reason = data?.reason ?? data?.error ?? `HTTP ${response.status}`;
      throw new Error(`${label} failed: ${reason}`);
    }

    return { data, status: response.status };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Geocode a location name via Open-Meteo Geocoding API.
 * @param {string} locationName
 */
export async function geocodeLocation(locationName) {
  const params = new URLSearchParams({
    name: locationName,
    count: '1',
    language: 'en',
    format: 'json',
  });

  const url = `${GEOCODING_URL}?${params}`;
  const { data, status } = await fetchJson(url, 'Geocoding API');

  if (!data.results?.length) {
    throw new Error(`No matching location found for "${locationName}".`);
  }

  const place = data.results[0];

  return {
    enteredLocation: locationName,
    name: place.name,
    admin1: place.admin1 ?? null,
    country: place.country ?? null,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'UTC',
    elevation: place.elevation ?? null,
    geocodingUrl: url,
    geocodingStatus: status,
  };
}

function buildForecastUrl(baseUrl, latitude, longitude, useEcmwfModel) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'precipitation,precipitation_probability',
    forecast_hours: String(FORECAST_HOURS),
    timezone: 'auto',
  });

  if (useEcmwfModel) {
    params.set('models', 'ecmwf_ifs');
  }

  return `${baseUrl}?${params}`;
}

/**
 * Fetch hourly precipitation forecast. Prefers ECMWF endpoint; falls back to generic forecast.
 */
export async function fetchRainfallForecast(latitude, longitude) {
  const ecmwfUrl = buildForecastUrl(ECMWF_FORECAST_URL, latitude, longitude, true);
  let forecastUrl = ecmwfUrl;
  let endpointLabel = 'Open-Meteo ECMWF Forecast API (/v1/ecmwf)';
  let modelInfo = 'ECMWF IFS (requested via /v1/ecmwf, models=ecmwf_ifs)';
  let usedFallback = false;

  let result;
  try {
    result = await fetchJson(ecmwfUrl, 'ECMWF Forecast API');
  } catch (ecmwfErr) {
    const fallbackUrl = buildForecastUrl(GENERIC_FORECAST_URL, latitude, longitude, true);
    try {
      result = await fetchJson(fallbackUrl, 'Forecast API');
      forecastUrl = fallbackUrl;
      endpointLabel = 'Open-Meteo Forecast API (/v1/forecast)';
      modelInfo = 'ECMWF IFS (requested via /v1/forecast, models=ecmwf_ifs)';
      usedFallback = true;
    } catch (fallbackErr) {
      throw new Error(
        `Unable to retrieve rainfall forecast for this location. ${ecmwfErr.message}`
      );
    }
  }

  const { data, status } = result;
  const hourly = data.hourly;

  if (!hourly?.time?.length) {
    throw new Error('Forecast API response is missing hourly time data.');
  }

  if (!hourly.precipitation?.length) {
    throw new Error('Forecast API response is missing hourly precipitation data.');
  }

  if (hourly.time.length !== hourly.precipitation.length) {
    throw new Error('Forecast API returned mismatched hourly precipitation arrays.');
  }

  const retrievedAt = new Date().toISOString();
  const timezone = data.timezone ?? 'UTC';
  const utcOffsetSeconds = data.utc_offset_seconds ?? 0;

  const forecast = processHourlyForecast({
    times: hourly.time,
    precipitation: hourly.precipitation,
    precipitationProbability: hourly.precipitation_probability ?? null,
    timezone,
    utcOffsetSeconds,
  });

  const hasProbability =
    Array.isArray(hourly.precipitation_probability) &&
    hourly.precipitation_probability.length === hourly.time.length;

  return {
    ...forecast,
    latitude: data.latitude,
    longitude: data.longitude,
    elevation: data.elevation ?? null,
    timezone,
    timezoneAbbreviation: data.timezone_abbreviation ?? null,
    utcOffsetSeconds,
    retrievedAt,
    forecastUrl,
    endpointLabel,
    modelInfo,
    usedFallback,
    apiStatus: status,
    generationTimeMs: data.generationtime_ms ?? null,
    hasPrecipitationProbability: hasProbability,
    rawHourlyCount: hourly.time.length,
  };
}

/**
 * Filter to complete future hours only, then compute accumulations and peak.
 * All summary cards, peak, and hourly table derive from the same filtered slice.
 */
export function processHourlyForecast({
  times,
  precipitation,
  precipitationProbability,
  timezone,
  utcOffsetSeconds,
  now = new Date(),
}) {
  const hourSelection = getFirstCompleteFutureHourKey(now, timezone, utcOffsetSeconds);
  const startIndex = times.findIndex(
    (t) => apiTimeToHourKey(t) >= hourSelection.firstHourKey
  );

  if (startIndex === -1) {
    throw new Error('No future hourly forecast hours remain in the API response.');
  }

  const futureTimes = times.slice(startIndex);
  const futurePrecip = precipitation.slice(startIndex);
  const futureProb = precipitationProbability
    ? precipitationProbability.slice(startIndex)
    : null;

  const availableHours = futurePrecip.length;

  if (availableHours < 24) {
    throw new Error(
      `Insufficient forecast hours: only ${availableHours} future hour(s) available (24 required).`
    );
  }

  const windows = {
    next1h: sumHours(futurePrecip, 1),
    next3h: sumHours(futurePrecip, 3),
    next6h: sumHours(futurePrecip, 6),
    next12h: sumHours(futurePrecip, 12),
    next24h: sumHours(futurePrecip, 24),
  };

  const peak = findPeakInWindow(futurePrecip, futureTimes, 24);

  const tableHours = Math.min(24, availableHours);
  const hourlyTable = futureTimes.slice(0, tableHours).map((time, i) => ({
    time,
    timeLabel: formatHourTime(time, utcOffsetSeconds, timezone),
    precipitation: futurePrecip[i],
    precipitationProbability: futureProb ? futureProb[i] : null,
  }));

  return {
    ...hourSelection,
    forecastWindowLogic: 'Complete future hours only',
    startIndex,
    firstAvailableApiTimestamp: times[0],
    firstForecastTimestamp: futureTimes[0],
    lastForecastTimestampUsed: futureTimes[tableHours - 1],
    futureHourCount: availableHours,
    windows,
    peak: {
      value: peak.value,
      time: peak.time,
      timeLabel: formatHourTime(peak.time, utcOffsetSeconds, timezone),
    },
    hourlyTable,
    samplePrecipitation: futurePrecip.slice(0, 5),
  };
}

function sumHours(values, hours) {
  const slice = values.slice(0, hours);
  if (slice.length < hours) return null;
  return slice.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
}

function findPeakInWindow(precip, times, hours) {
  const slicePrecip = precip.slice(0, hours);
  const sliceTimes = times.slice(0, hours);

  let maxValue = -Infinity;
  let maxIndex = 0;

  for (let i = 0; i < slicePrecip.length; i++) {
    const value = typeof slicePrecip[i] === 'number' ? slicePrecip[i] : 0;
    if (value > maxValue) {
      maxValue = value;
      maxIndex = i;
    }
  }

  return {
    value: maxValue === -Infinity ? 0 : maxValue,
    time: sliceTimes[maxIndex],
  };
}

/**
 * Full pipeline: geocode → fetch forecast → return combined result.
 * @param {string} locationName
 */
export async function getRainfallForecast(locationName) {
  const trimmed = locationName.trim();
  if (!trimmed) {
    throw new Error('Please enter a location name.');
  }

  const geo = await geocodeLocation(trimmed);
  const forecast = await fetchRainfallForecast(geo.latitude, geo.longitude);

  return { geo, forecast };
}
