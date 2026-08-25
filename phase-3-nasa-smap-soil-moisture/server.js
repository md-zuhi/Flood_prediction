// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — NASA SMAP NRT Soil Moisture: Express + Vite Server
//
// Port: 4000  (separate from Phase 1 on port 3000)
//
// Routes:
//   GET /api/geocode?location=Ooty   → lat/lon via Nominatim
//   GET /api/smap?lat=11.41&lon=76.69 → NASA SMAP soil moisture
//   GET /api/health                  → health check
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import dotenv  from 'dotenv';
import path    from 'path';
import fs      from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  searchLatestGranule,
  downloadGranule,
  extractSoilMoisture,
  DATASET_SHORT_NAME,
  DATASET_VERSION,
} from './nasaSmap.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

app.use(express.json({ limit: '1mb' }));

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  const token = process.env.EARTHDATA_TOKEN ?? '';
  const tokenSet = token.length > 0 && token !== 'your_earthdata_token_here';
  res.json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    authStatus:  tokenSet ? 'token_configured' : 'token_missing',
    dataset:     `${DATASET_SHORT_NAME} v${DATASET_VERSION}`,
  });
});

// ── Geocode — Nominatim (OpenStreetMap) ───────────────────────────────────────

app.get('/api/geocode', async (req, res) => {
  const location = (req.query.location ?? '').trim();

  if (!location || location.length < 2) {
    return res.status(400).json({ error: 'Please enter a valid location name (minimum 2 characters).' });
  }

  try {
    const nominatimUrl =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=1`;

    console.log(`[Geocode] ${location} → ${nominatimUrl}`);

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'SIH2026-SMAP-Feasibility-Test/1.0 (contact: student@sih.gov.in)' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Nominatim returned HTTP ${response.status}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return res.status(404).json({
        error: `Location "${location}" not found. Try a different spelling or a nearby city.`,
      });
    }

    const r = results[0];
    return res.json({
      displayName: r.display_name,
      latitude:    parseFloat(r.lat),
      longitude:   parseFloat(r.lon),
      type:        r.type ?? r.class,
    });
  } catch (err) {
    console.error('[Geocode error]', err.message);
    return res.status(502).json({
      error: `Geocoding failed: ${err.message}. Check your internet connection.`,
    });
  }
});

// ── SMAP Soil Moisture ────────────────────────────────────────────────────────

app.get('/api/smap', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  // Validate coordinates
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query parameters are required.' });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: `Invalid coordinates: lat=${lat}, lon=${lon}` });
  }

  // ── Auth check — fail loudly, never substitute fake data ─────────────────
  const token = (process.env.EARTHDATA_TOKEN ?? '').trim();
  if (!token || token === 'your_earthdata_token_here') {
    return res.status(401).json({
      error:       'NASA Earthdata authentication required.',
      detail:      'Set EARTHDATA_TOKEN in your .env file. See README.md for step-by-step instructions on getting a free NASA Earthdata token.',
      authStatus:  'not_configured',
      dataset:     DATASET_SHORT_NAME,
      version:     DATASET_VERSION,
    });
  }

  let tmpFilePath = null;

  try {
    // ── Step 1: CMR Granule Search ─────────────────────────────────────────────
    console.log(`\n[SMAP] === New request: lat=${lat}, lon=${lon} ===`);
    console.log(`[SMAP] Searching CMR for ${DATASET_SHORT_NAME} v${DATASET_VERSION}...`);

    const granules = await searchLatestGranule(lat, lon);

    if (!granules || granules.length === 0) {
      return res.status(404).json({
        error:      'No recent NASA SMAP NRT granule found covering this location.',
        detail:     'The SMAP satellite may not have passed over this area recently. Try again in a few hours.',
        authStatus: 'authenticated',
        dataset:    DATASET_SHORT_NAME,
        version:    DATASET_VERSION,
      });
    }

    console.log(`[SMAP] Found ${granules.length} candidate granule(s). Trying each until valid data found...`);

    // ── Step 2 & 3: Try each granule until one has valid data for this location ──
    let result   = null;
    let granule  = null;
    let lastError = 'No valid data found in any granule.';

    for (const candidateGranule of granules) {
      console.log(`\n[SMAP] Trying granule: ${candidateGranule.granuleName}`);
      console.log(`[SMAP] Time range: ${candidateGranule.startTime} → ${candidateGranule.endTime}`);

      try {
        console.log(`[SMAP] Downloading HDF5 (may take 30–120s)...`);
        tmpFilePath = await downloadGranule(candidateGranule.downloadUrl, token);

        console.log(`[SMAP] Parsing HDF5 with h5wasm...`);
        const extracted = await extractSoilMoisture(tmpFilePath, lat, lon);

        // Clean up this temp file
        try { fs.unlinkSync(tmpFilePath); tmpFilePath = null; } catch {}

        // If we got a valid or fill-value result (not a thrown error), use it
        granule = candidateGranule;
        result  = extracted;

        // If soilMoisture is not null, we have real data — stop searching
        if (result.soilMoisture !== null) {
          console.log(`[SMAP] Valid soil moisture found: ${result.soilMoisture} m³/m³`);
          break;
        } else {
          console.log(`[SMAP] Granule returned fill value for this location. Trying next granule...`);
          lastError = result.error ?? 'Fill value at nearest cell.';
          // Continue to next granule
        }
      } catch (granuleErr) {
        console.warn(`[SMAP] Granule failed: ${granuleErr.message}. Trying next...`);
        lastError = granuleErr.message;
        if (tmpFilePath) { try { fs.unlinkSync(tmpFilePath); tmpFilePath = null; } catch {} }
        // Re-throw auth errors immediately
        if (granuleErr.message === 'NASA_AUTH_FAILED') throw granuleErr;
      }
    }

    if (!result || !granule) {
      return res.status(404).json({
        error:      'No valid SMAP soil moisture observation found for this location.',
        detail:     lastError,
        authStatus: 'authenticated',
        dataset:    DATASET_SHORT_NAME,
        version:    DATASET_VERSION,
      });
    }

    // ── Compute observation age ─────────────────────────────────────────────
    // Use per-pixel tb_time_utc if available, else fall back to granule start time
    const obsTimeStr = result.pixelTime ?? granule.startTime;
    const obsTime    = new Date(obsTimeStr);
    const ageMs      = Date.now() - obsTime.getTime();
    const ageHours   = Math.round((ageMs / 3_600_000) * 10) / 10;
    const ageDays    = Math.round((ageMs / 86_400_000) * 10) / 10;

    console.log(`[SMAP] Done. soilMoisture=${result.soilMoisture} quality=${result.quality} obsTime=${obsTimeStr}`);

    return res.json({
      // ── Location ───────────────────────────────────────────────────
      requestedLat:  lat,
      requestedLon:  lon,

      // ── Soil moisture ───────────────────────────────────────────────────
      soilMoisture:  result.soilMoisture,   // null if fill value or poor quality
      unit:          'm³/m³',
      rawValue:      result.rawValue,

      // ── Observation metadata ───────────────────────────────────────────────
      observationTime:      obsTimeStr,
      observationAgeHours:  ageHours,
      observationAgeDays:   ageDays,

      // ── Quality ───────────────────────────────────────────────────────────
      quality:      result.quality,         // 'valid' | 'fill_value' | 'poor_quality' | 'no_coverage'
      qualityFlag:  result.qualityFlag,
      qualityError: result.error,

      // ── Dataset / source ───────────────────────────────────────────────────
      source:    'NASA SMAP',
      dataset:   DATASET_SHORT_NAME,
      version:   DATASET_VERSION,

      // ── Debug info ────────────────────────────────────────────────────────
      granuleName:              granule.granuleName,
      granuleId:                granule.granuleId,
      granuleStartTime:         granule.startTime,
      granuleEndTime:           granule.endTime,
      orbitGroup:               result.group,
      nearestGridLat:           result.nearestLat,
      nearestGridLon:           result.nearestLon,
      nearestGridDistanceKm:    result.distanceKm,
      cmrSearchUrl:             granule.cmrSearchUrl,
      downloadUrl:              granule.downloadUrl,
      authStatus:               'authenticated',
    });

  } catch (err) {
    console.error('[SMAP error]', err.message);

    if (err.message === 'NASA_AUTH_FAILED') {
      return res.status(401).json({
        error:      'NASA authentication failed. Your Earthdata token is invalid or expired.',
        detail:     'Generate a new token at https://urs.earthdata.nasa.gov/user_tokens',
        authStatus: 'invalid_token',
      });
    }

    if (err.message.includes('timeout') || err.message.includes('aborted')) {
      return res.status(504).json({
        error:  'Download timed out. SMAP HDF5 files are 30–100 MB. Check your connection and retry.',
        detail: err.message,
      });
    }

    // Never send a stack trace to the client
    return res.status(500).json({
      error:  'Failed to fetch NASA SMAP data.',
      detail: err.message,
    });
  } finally {
    // Always clean up temp file — even if request handling failed
    if (tmpFilePath) {
      try {
        fs.unlinkSync(tmpFilePath);
        console.log(`[SMAP] Temp file deleted: ${tmpFilePath}`);
      } catch { /* ignore cleanup errors */ }
    }
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server:  { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    const token = (process.env.EARTHDATA_TOKEN ?? '').trim();
    const tokenOk = token.length > 0 && token !== 'your_earthdata_token_here';

    console.log(`\n🛰️  Phase 3 — NASA SMAP Soil Moisture Feasibility Test`);
    console.log(`   Server:      http://localhost:${PORT}`);
    console.log(`   API:         http://localhost:${PORT}/api/smap?lat=11.41&lon=76.69`);
    console.log(`   Auth status: ${tokenOk ? '✅ EARTHDATA_TOKEN configured' : '❌ EARTHDATA_TOKEN NOT SET — see README.md'}`);
    console.log(`   Dataset:     ${DATASET_SHORT_NAME} v${DATASET_VERSION}\n`);
  });
}

startServer();
