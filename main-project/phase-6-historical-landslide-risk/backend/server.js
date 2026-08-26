// server.js — Phase 6 Historical Landslide Analysis backend

import express from 'express';
import cors from 'cors';
import { loadLandslides, analyseLocation } from './landslide.js';

const app = express();
const PORT = process.env.PORT ?? 6000;

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TAMIL_NADU_VARIANTS = ['tamil nadu', 'tamilnadu', 'tn'];

app.use(cors());
app.use(express.json());

// Pre-load CSV once at startup
let csvData = null;
let csvLoadError = null;
try {
  csvData = loadLandslides();
  console.log(`[CSV] Loaded ${csvData.validRows} valid records (${csvData.invalidRows} invalid) from ${csvData.totalRows} total rows.`);
} catch (err) {
  csvLoadError = err.message;
  console.error('[CSV] Failed to load:', csvLoadError);
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    csvLoaded: !!csvData,
    csvError: csvLoadError ?? null,
    validRecords: csvData?.validRows ?? 0,
    timestamp: new Date().toISOString(),
  });
});

// ── Analyse ───────────────────────────────────────────────────────────────────
app.get('/api/analyse', async (req, res) => {
  const location = (req.query.location ?? '').trim();

  if (!location || location.length < 2) {
    return res.status(400).json({ error: 'Please enter a valid location name.' });
  }

  if (!csvData) {
    return res.status(500).json({
      error: 'Historical landslide CSV could not be loaded on the server.',
      detail: csvLoadError,
    });
  }

  // Step 1: Geocode
  let place;
  try {
    const params = new URLSearchParams({ name: location, count: '1', language: 'en', format: 'json' });
    const geoUrl = `${GEOCODING_URL}?${params}`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(15_000) });
    const geoData = await geoRes.json();

    if (!geoRes.ok || !geoData.results?.length) {
      return res.status(404).json({
        error: `Location "${location}" not found. Try a different spelling or nearby city.`,
      });
    }
    place = geoData.results[0];
    console.log(`[Analyse] ${location} → ${place.name}, ${place.admin1}, ${place.country} (${place.latitude}, ${place.longitude})`);
  } catch (err) {
    return res.status(502).json({ error: `Geocoding failed: ${err.message}` });
  }

  // Step 2: Tamil Nadu scope check
  const admin1 = (place.admin1 ?? '').toLowerCase();
  const country = (place.country ?? '').toLowerCase();
  const isTamilNadu = TAMIL_NADU_VARIANTS.some((v) => admin1.includes(v));
  const isIndia = country.includes('india');

  if (!isIndia || !isTamilNadu) {
    return res.status(200).json({
      outOfScope: true,
      message:
        'Historical landslide inventory in this Phase 6 test currently covers Tamil Nadu only.',
      geo: {
        enteredLocation: location,
        name: place.name,
        admin1: place.admin1 ?? null,
        country: place.country ?? null,
        latitude: place.latitude,
        longitude: place.longitude,
      },
    });
  }

  // Step 3: Haversine analysis
  const analysis = analyseLocation(csvData.records, place.latitude, place.longitude);

  return res.json({
    geo: {
      enteredLocation: location,
      name: place.name,
      admin1: place.admin1 ?? null,
      country: place.country ?? null,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? null,
    },
    analysis,
    source: {
      name: 'Geological Survey of India (GSI)',
      dataset: 'Field-Validated Landslide Inventory',
      dataType: 'Historical / Static',
      scope: 'Tamil Nadu',
    },
    debug: {
      enteredLocation: location,
      resolvedLatitude: place.latitude,
      resolvedLongitude: place.longitude,
      csvLoaded: true,
      totalCsvRows: csvData.totalRows,
      validCoordinateRows: csvData.validRows,
      invalidCoordinateRows: csvData.invalidRows,
      nearestDistanceKm: analysis.nearestEvent?.distanceKm ?? null,
      within5km: analysis.within5km,
      within10km: analysis.within10km,
      within25km: analysis.within25km,
      geocodingStatus: 200,
      processingTimestamp: new Date().toISOString(),
    },
  });
});

app.listen(PORT, () => {
  console.log(`\n⛰  Phase 6 — Historical Landslide Analysis`);
  console.log(`   Backend: http://localhost:${PORT}`);
  console.log(`   Test:    http://localhost:${PORT}/api/analyse?location=Coonoor\n`);
});
