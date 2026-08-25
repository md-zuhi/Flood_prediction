// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Terrain & Slope Analysis: Express + Vite Server
//
// Port: 5000
//
// Routes:
//   GET /api/health?location=...
//   GET /api/geocode?location=...
//   GET /api/terrain?location=...
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  buildBoundingBox,
  fetchGlobalDemGeoTiff,
  fetchPointElevation,
  getOpenTopographyApiKey,
  OPENTOPO_CONSTANTS,
} from './openTopography.js';
import { processDemGeoTiff } from './demProcessor.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT ?? '5000', 10);

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

app.use(express.json({ limit: '1mb' }));

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  const apiKey = getOpenTopographyApiKey();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    openTopographyKeyConfigured: !!apiKey,
    dataset: OPENTOPO_CONSTANTS.DEM_TYPE,
  });
});

// ── Geocode — Open-Meteo ──────────────────────────────────────────────────────

app.get('/api/geocode', async (req, res) => {
  const location = (req.query.location ?? '').trim();

  if (!location || location.length < 2) {
    return res.status(400).json({ error: 'Please enter a valid location name (minimum 2 characters).' });
  }

  try {
    const params = new URLSearchParams({
      name: location,
      count: '1',
      language: 'en',
      format: 'json',
    });
    const url = `${GEOCODING_URL}?${params}`;

    console.log(`[Geocode] ${location}`);

    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Geocoding API HTTP ${response.status}`);
    }

    if (!data.results?.length) {
      return res.status(404).json({
        error: `Location "${location}" not found. Try a different spelling or a nearby city.`,
      });
    }

    const place = data.results[0];

    return res.json({
      enteredLocation: location,
      name: place.name,
      admin1: place.admin1 ?? null,
      country: place.country ?? null,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone ?? null,
      geocodingUrl: url,
      geocodingStatus: response.status,
    });
  } catch (err) {
    console.error('[Geocode error]', err.message);
    return res.status(502).json({
      error: `Geocoding failed: ${err.message}. Check your internet connection.`,
    });
  }
});

// ── Terrain analysis — OpenTopography SRTM ────────────────────────────────────

app.get('/api/terrain', async (req, res) => {
  const location = (req.query.location ?? '').trim();

  if (!location) {
    return res.status(400).json({ error: 'Please enter a location name.' });
  }

  const apiKey = getOpenTopographyApiKey();
  if (!apiKey) {
    return res.status(401).json({
      error: 'OpenTopography API key required.',
      detail:
        'Set OPENTOPOGRAPHY_API_KEY in your .env file. Request a free key at https://portal.opentopography.org/requestService?service=api',
      authStatus: 'not_configured',
    });
  }

  let tempFileStatus = 'not_created';

  try {
    // Step 1: Geocode
    console.log(`\n[Terrain] === New request: ${location} ===`);

    const geoParams = new URLSearchParams({
      name: location,
      count: '1',
      language: 'en',
      format: 'json',
    });
    const geoUrl = `${GEOCODING_URL}?${geoParams}`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(15_000) });
    const geoData = await geoRes.json();

    if (!geoRes.ok || !geoData.results?.length) {
      return res.status(404).json({
        error: geoData.results?.length === 0
          ? `Location "${location}" not found.`
          : 'Geocoding failed.',
      });
    }

    const place = geoData.results[0];
    const latitude = place.latitude;
    const longitude = place.longitude;
    const bbox = buildBoundingBox(latitude, longitude);

    console.log(`[Terrain] Resolved: ${place.name} (${latitude}, ${longitude})`);
    console.log(`[Terrain] BBox: N${bbox.north} S${bbox.south} E${bbox.east} W${bbox.west}`);

    // Step 2: Point elevation
    let pointResult;
    try {
      pointResult = await fetchPointElevation(latitude, longitude, apiKey);
      console.log(`[Terrain] Point elevation: ${pointResult.elevation} m`);
    } catch (pointErr) {
      console.error('[Terrain] Point elevation failed:', pointErr.message);
      return res.status(pointErr.statusCode === 401 ? 401 : 502).json({
        error: 'Point Elevation API failed.',
        detail: pointErr.message,
        authStatus: pointErr.statusCode === 401 ? 'invalid_key' : 'error',
        geo: {
          enteredLocation: location,
          name: place.name,
          admin1: place.admin1 ?? null,
          country: place.country ?? null,
          latitude,
          longitude,
          timezone: place.timezone ?? null,
        },
        bbox,
      });
    }

    // Step 3: Download GeoTIFF (in memory — no permanent file)
    tempFileStatus = 'processing_in_memory';
    let demResult;
    try {
      demResult = await fetchGlobalDemGeoTiff(bbox, apiKey);
      console.log(`[Terrain] GeoTIFF downloaded: ${demResult.buffer.length} bytes`);
    } catch (demErr) {
      console.error('[Terrain] Global DEM failed:', demErr.message);
      return res.status(demErr.statusCode === 401 ? 401 : 502).json({
        error: 'Global DEM API failed.',
        detail: demErr.message,
        authStatus: demErr.statusCode === 401 ? 'invalid_key' : 'error',
        pointElevationStatus: pointResult.status,
        centerElevation: pointResult.elevation,
        geo: {
          enteredLocation: location,
          name: place.name,
          admin1: place.admin1 ?? null,
          country: place.country ?? null,
          latitude,
          longitude,
          timezone: place.timezone ?? null,
        },
        bbox,
      });
    }

    // Step 4: Process raster
    let analysis;
    try {
      analysis = await processDemGeoTiff(
        demResult.buffer,
        latitude,
        longitude,
        pointResult.elevation
      );
      tempFileStatus = 'processed_and_discarded';
      console.log(
        `[Terrain] Analysis done. Relief=${analysis.elevation.localRelief.toFixed(1)}m meanSlope=${analysis.slope.meanSlope.toFixed(2)}°`
      );
    } catch (parseErr) {
      console.error('[Terrain] Raster processing failed:', parseErr.message);
      tempFileStatus = 'processing_failed';
      return res.status(500).json({
        error: 'Raster parsing or terrain analysis failed.',
        detail: parseErr.message,
        pointElevationStatus: pointResult.status,
        centerElevation: pointResult.elevation,
        globalDemStatus: demResult.status,
      });
    }

    const retrievedAt = new Date().toISOString();

    return res.json({
      geo: {
        enteredLocation: location,
        name: place.name,
        admin1: place.admin1 ?? null,
        country: place.country ?? null,
        latitude,
        longitude,
        timezone: place.timezone ?? null,
      },
      bbox,
      centerElevation: pointResult.elevation,
      elevation: analysis.elevation,
      slope: analysis.slope,
      source: {
        dataset: OPENTOPO_CONSTANTS.SOURCE_LABEL,
        access: OPENTOPO_CONSTANTS.ACCESS_LABEL,
        resolution: OPENTOPO_CONSTANTS.RESOLUTION_LABEL,
        dataType: 'Static terrain data',
        demType: OPENTOPO_CONSTANTS.DEM_TYPE,
        pointDataset: OPENTOPO_CONSTANTS.POINT_DATASET,
      },
      preview: {
        grid: analysis.preview,
        width: analysis.previewWidth,
        height: analysis.previewHeight,
      },
      debug: {
        enteredLocation: location,
        latitude,
        longitude,
        bboxNorth: bbox.north,
        bboxSouth: bbox.south,
        bboxEast: bbox.east,
        bboxWest: bbox.west,
        pointElevationApiStatus: pointResult.status,
        centerElevationPointApi: pointResult.elevation,
        globalDemApiStatus: demResult.status,
        geotiffBytes: demResult.buffer.length,
        rasterWidth: analysis.raster.width,
        rasterHeight: analysis.raster.height,
        rasterCellWidthDeg: analysis.raster.pixelWidthDeg,
        rasterCellHeightDeg: analysis.raster.pixelHeightDeg,
        cellSizeXMeters: analysis.raster.cellSizeXMeters,
        cellSizeYMeters: analysis.raster.cellSizeYMeters,
        validCellCount: analysis.raster.validCellCount,
        noDataCellCount: analysis.raster.noDataCellCount,
        minRawElevation: analysis.debug.minRawElevation,
        maxRawElevation: analysis.debug.maxRawElevation,
        meanRawElevation: analysis.debug.meanRawElevation,
        centerRasterElevation: analysis.debug.centerRasterElevation,
        pointApiElevation: analysis.debug.pointElevation,
        pointRasterDifference: analysis.debug.pointRasterDifference,
        meanSlope: analysis.slope.meanSlope,
        maxSlope: analysis.slope.maxSlope,
        tempFileStatus,
        sourceDataset: OPENTOPO_CONSTANTS.DEM_TYPE,
        retrievalTimestamp: retrievedAt,
        geocodingUrl: geoUrl,
        pointElevationUrl: pointResult.url,
        globalDemUrl: demResult.url,
        centerRasterRow: analysis.raster.centerRow,
        centerRasterCol: analysis.raster.centerCol,
      },
      retrievedAt,
      srtmConnected: true,
      realDemData: true,
    });
  } catch (err) {
    console.error('[Terrain error]', err.message);
    tempFileStatus = 'error';

    return res.status(500).json({
      error: 'Unable to retrieve terrain data for this location.',
      detail: err.message,
      tempFileStatus,
    });
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    const apiKey = getOpenTopographyApiKey();

    console.log(`\n⛰️  Phase 5 — Terrain & Slope Analysis Test`);
    console.log(`   Server:      http://localhost:${PORT}`);
    console.log(`   API:         http://localhost:${PORT}/api/terrain?location=Coonoor`);
    console.log(
      `   API key:     ${apiKey ? '✅ OPENTOPOGRAPHY_API_KEY configured' : '❌ OPENTOPOGRAPHY_API_KEY NOT SET — see README.md'}`
    );
    console.log(`   Dataset:     NASA SRTM GL1 via OpenTopography\n`);
  });
}

startServer();
