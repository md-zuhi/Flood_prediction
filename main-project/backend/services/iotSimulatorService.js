// --------------------------------------------------
// iotSimulatorService.js
// --------------------------------------------------
// Software-based simulated IoT sensor source.
//
// PURPOSE:
//   Provides realistic, deterministic sensor readings that the fusion
//   pipeline would receive from a real physical IoT sensor node.
//   This simulator is clearly identified as SIMULATED_IOT — it is NOT
//   connected to real hardware.
//
// DESIGN:
//   - Values are deterministic: anchored to location + a slow hourly cycle.
//     They do NOT change randomly on every request.
//   - The slow cycle mimics diurnal moisture/rainfall patterns realistically.
//   - When integrated, a real IoT API or MQTT adapter can replace this
//     module by exporting the same getIoTReading(lat, lon) interface.
//
// FIELDS PRODUCED (matching featureSchema.js iot block):
//   source             "SIMULATED_IOT"
//   simulated          true
//   available          true
//   status             "success"
//   observation_time   ISO-8601 UTC timestamp (current time)
//   rainfall_mm        Simulated recent rainfall (mm) — non-negative
//   soil_moisture      Simulated volumetric soil moisture (m³/m³) 0.05–0.55
//   water_level        Simulated water level reading (m) — non-negative
//   temperature_c      Simulated ambient temperature (°C)
//   humidity_percent   Simulated relative humidity (%)
//
// IMPORTANT: These values are advisory only. They are NOT fed into the
// ML feature vector unless the fusion logic explicitly overrides the
// primary (Open-Meteo / NASA SMAP) sources with IoT data.
// --------------------------------------------------

'use strict';

/**
 * Deterministic pseudo-variation seeded by (lat, lon) + current UTC hour.
 * Returns a value between -1 and +1, cycling smoothly over 24 hours.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} phaseShiftHours  — shifts the cycle per-sensor to add variety
 */
function diurnalFactor(lat, lon, phaseShiftHours = 0) {
  const hourUtc = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  // Seed the amplitude slightly with location so different stations differ
  const locationSeed = ((Math.abs(lat * 100) % 7) + (Math.abs(lon * 100) % 5)) / 12; // 0..1
  const phase = (2 * Math.PI * (hourUtc + phaseShiftHours + locationSeed * 6)) / 24;
  return Math.sin(phase); // -1 to +1
}

/**
 * Clamp a number to [min, max] and round to given decimal places.
 */
function clamp(value, min, max, decimals = 2) {
  return +Math.min(max, Math.max(min, value)).toFixed(decimals);
}

/**
 * getIoTReading(lat, lon)
 *
 * Returns a simulated IoT sensor reading object.
 * On any internal error, returns a clearly-marked failure object instead
 * of pretending to succeed.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {object}
 */
function getIoTReading(lat, lon) {
  try {
    if (typeof lat !== 'number' || typeof lon !== 'number' ||
        !isFinite(lat) || !isFinite(lon)) {
      throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }

    const now = new Date();

    // ── Rainfall (mm) ─────────────────────────────────────────
    // Base: 2 mm. Peaks toward evening (phase = 3h shift).
    // Range: 0–12 mm.
    const rainfallBase   = 2.5;
    const rainfallRange  = 5.0;
    const rainfall_mm    = clamp(
      rainfallBase + rainfallRange * (0.5 + 0.5 * diurnalFactor(lat, lon, 3)),
      0, 30, 2
    );

    // ── Soil Moisture (m³/m³) ──────────────────────────────────
    // Base: 0.28. Slightly higher at night/morning (inverted phase).
    // Range: 0.18–0.42.
    const smBase  = 0.28;
    const smRange = 0.08;
    const soil_moisture = clamp(
      smBase - smRange * diurnalFactor(lat, lon, 6),
      0.05, 0.55, 4
    );

    // ── Water Level (m) ───────────────────────────────────────
    // Base: 1.2 m. Rises slightly after peak rainfall.
    // Range: 0.8–2.0 m.
    const wlBase  = 1.2;
    const wlRange = 0.4;
    const water_level = clamp(
      wlBase + wlRange * (0.5 + 0.5 * diurnalFactor(lat, lon, 5)),
      0, 10, 3
    );

    // ── Temperature (°C) ──────────────────────────────────────
    // Typical Indian tropical range: 22–36 °C diurnal.
    const tempBase  = 29;
    const tempRange = 7;
    const temperature_c = clamp(
      tempBase + tempRange * diurnalFactor(lat, lon, 0),
      15, 45, 1
    );

    // ── Humidity (%) ──────────────────────────────────────────
    // Inversely correlated with temperature (higher at night).
    const humBase  = 72;
    const humRange = 15;
    const humidity_percent = clamp(
      humBase - humRange * diurnalFactor(lat, lon, 0),
      20, 100, 1
    );

    return {
      available        : true,
      status           : 'success',
      source           : 'SIMULATED_IOT',
      simulated        : true,
      observation_time : now.toISOString(),
      rainfall_mm,
      soil_moisture,
      water_level,
      temperature_c,
      humidity_percent,
    };

  } catch (err) {
    // On any failure, return a clearly-marked unavailable object.
    // This ensures IoT shows as Unavailable rather than silently pretending.
    console.warn('[IoTSimulator] getIoTReading failed:', err.message);
    return {
      available        : false,
      status           : 'failed',
      source           : 'SIMULATED_IOT',
      simulated        : true,
      observation_time : new Date().toISOString(),
      rainfall_mm      : null,
      soil_moisture    : null,
      water_level      : null,
      temperature_c    : null,
      humidity_percent : null,
      error            : err.message,
    };
  }
}

module.exports = { getIoTReading };
