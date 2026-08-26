// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — NASA SMAP NRT Soil Moisture: Data Access Module
//
// Responsibilities:
//   1. Search CMR for the latest SPL2SMP_NRT granules covering a location
//   2. Download HDF5 files with NASA Earthdata Bearer Token auth
//   3. Parse HDF5 with h5wasm (pure WASM, no Python required)
//   4. Find the nearest EASE-Grid cell to the target coordinates
//   5. Extract soil_moisture + retrieval_qual_flag
//   6. Validate against fill values and quality flags
//
// NASA Dataset:  SPL2SMP_NRT  (Near Real-Time SMAP L2 Radiometer Half-Orbit)
// Version:       107
// Grid:          EASE-Grid 2.0, 36 km resolution
// HDF5 group:    Soil_Moisture_Retrieval_Data  (confirmed from real file inspection)
//                (NRT v107 does NOT use _AM/_PM suffixes)
// ─────────────────────────────────────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import os   from 'os';

// ── Constants ─────────────────────────────────────────────────────────────────

export const DATASET_SHORT_NAME = 'SPL2SMP_NRT';
export const DATASET_VERSION    = '107';
const CMR_SEARCH_URL = 'https://cmr.earthdata.nasa.gov/search/granules.json';
const SMAP_FILL_VALUE = -9999.0;      // default fill; overridden by HDF5 _FillValue attr
const MAX_VALID_DIST_KM = 80;         // reject if nearest cell is > 80 km away
const DOWNLOAD_TIMEOUT_MS = 180_000;  // 3 min — granules are 30–100 MB

// ── Haversine great-circle distance (km) ─────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Step 1: CMR Granule Search ────────────────────────────────────────────────
// No authentication required for CMR search — it is a public metadata API.

export async function searchLatestGranule(lat, lon) {
  // Use a ±3° bounding box to ensure we catch granules that swing over the area
  const margin = 3;
  const bbox = `${lon - margin},${lat - margin},${lon + margin},${lat + margin}`;

  const params = new URLSearchParams({
    short_name:     DATASET_SHORT_NAME,
    version:        DATASET_VERSION,
    bounding_box:   bbox,
    page_size:      '5',
  });
  // CMR accepts repeated sort_key[] params
  params.append('sort_key[]', '-start_date');

  const url = `${CMR_SEARCH_URL}?${params.toString()}`;
  console.log(`[CMR] Searching: ${url}`);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`CMR search failed: HTTP ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const entries = body.feed?.entry ?? [];

  console.log(`[CMR] Found ${entries.length} granule(s) matching bounding box`);

  // Return ALL granules that have a direct .h5 download link (caller tries each)
  const results = [];
  for (const entry of entries) {
    const h5Link = (entry.links ?? []).find(
      (l) =>
        l.rel === 'http://esipfed.org/ns/fedsearch/1.1/data#' &&
        (l.href.endsWith('.h5') || l.href.includes('.h5?'))
    );
    if (h5Link) {
      results.push({
        granuleId:    entry.id,
        granuleName:  entry.title,
        downloadUrl:  h5Link.href,
        startTime:    entry.time_start,
        endTime:      entry.time_end,
        bboxUsed:     bbox,
        cmrSearchUrl: url,
      });
    }
  }

  return results.length > 0 ? results : null;
}

// ── Step 2: Authenticated HDF5 Download ──────────────────────────────────────

export async function downloadGranule(downloadUrl, token) {
  const tmpPath = path.join(os.tmpdir(), `smap_nrt_${Date.now()}.h5`);
  console.log(`[Download] Starting: ${downloadUrl}`);
  console.log(`[Download] Temp path: ${tmpPath}`);

  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow', // NASA EDL uses redirects for auth handshake
    signal:   AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('NASA_AUTH_FAILED');
  }
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  console.log(`[Download] File size: ${contentLength ? Math.round(contentLength / 1024 / 1024) + ' MB' : 'unknown'}`);

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));
  const sizeMB = (fs.statSync(tmpPath).size / 1024 / 1024).toFixed(1);
  console.log(`[Download] Saved ${sizeMB} MB → ${tmpPath}`);

  return tmpPath;
}

// ── Step 3: HDF5 Parse + Nearest Cell Extraction ─────────────────────────────

export async function extractSoilMoisture(filePath, targetLat, targetLon) {
  // h5wasm is dynamically imported to avoid top-level WASM init at startup
  const h5wasmMod = await import('h5wasm/node');
  const h5wasm    = h5wasmMod.default ?? h5wasmMod;
  await h5wasm.ready;

  let f = null;
  try {
    f = new h5wasm.File(filePath, 'r');

    // SPL2SMP_NRT v107 confirmed group name (from real file inspection):
    // 'Soil_Moisture_Retrieval_Data' — NO _AM/_PM suffix in NRT v107
    // Also try legacy names in case older granules differ.
    const groups = [
      'Soil_Moisture_Retrieval_Data',
      'Soil_Moisture_Retrieval_Data_AM',
      'Soil_Moisture_Retrieval_Data_PM',
    ];

    for (const group of groups) {
      let groupHandle = null;
      try {
        groupHandle = f.get(group);
        if (!groupHandle) continue;
      } catch {
        continue;
      }

      // Read coordinate and data arrays
      const latDs  = f.get(`${group}/latitude`);
      const lonDs  = f.get(`${group}/longitude`);
      const smDs   = f.get(`${group}/soil_moisture`);
      const qfDs   = f.get(`${group}/retrieval_qual_flag`);
      const timeDs = f.get(`${group}/tb_time_utc`);

      if (!latDs || !lonDs || !smDs) {
        console.warn(`[HDF5] ${group} missing expected datasets, skipping`);
        continue;
      }

      const lats  = latDs.value;  // Float32Array — one entry per retrieval pixel
      const lons  = lonDs.value;  // Float32Array
      const sms   = smDs.value;   // Float32Array
      const qfs   = qfDs  ? qfDs.value  : null; // Uint16Array or null
      const times = timeDs ? timeDs.value : null; // string array

      // Read _FillValue attribute if present (defaults to -9999)
      let fillValue = SMAP_FILL_VALUE;
      try {
        const attrs = smDs.attrs;
        if (attrs && '_FillValue' in attrs) {
          const fv = attrs['_FillValue'].value;
          fillValue = Array.isArray(fv) ? Number(fv[0]) : Number(fv);
        }
      } catch { /* use default fill value */ }

      console.log(`[HDF5] ${group}: ${lats.length} pixels, fill=${fillValue}`);

      // ── Find nearest valid pixel ────────────────────────────────────────
      let minDist = Infinity;
      let minIdx  = -1;

      for (let i = 0; i < lats.length; i++) {
        const plat = lats[i];
        const plon = lons[i];

        // Skip geographic fill values
        if (plat < -90 || plat > 90 || plon < -180 || plon > 180) continue;

        const d = haversineKm(targetLat, targetLon, plat, plon);
        if (d < minDist) {
          minDist = d;
          minIdx  = i;
        }
      }

      if (minIdx === -1) {
        console.warn(`[HDF5] ${group}: no valid pixels found`);
        continue;
      }

      const nearLat = lats[minIdx];
      const nearLon = lons[minIdx];
      const rawSm    = sms[minIdx];
      const qf       = qfs  !== null ? qfs[minIdx]  : null;
      const pixelTime = times !== null ? times[minIdx] : null;

      console.log(
        `[HDF5] Nearest pixel: idx=${minIdx} lat=${nearLat.toFixed(3)} lon=${nearLon.toFixed(3)} ` +
        `dist=${minDist.toFixed(1)} km sm=${rawSm} qf=${qf} time=${pixelTime}`
      );

      // ── Validate: fill value ─────────────────────────────────────────────
      if (rawSm === fillValue || rawSm <= fillValue || Math.abs(rawSm - fillValue) < 0.001) {
        return {
          group,
          nearestLat: nearLat,
          nearestLon: nearLon,
          distanceKm: minDist,
          pixelTime,
          soilMoisture: null,
          rawValue: rawSm,
          qualityFlag: qf,
          quality: 'fill_value',
          error: 'No valid soil moisture retrieval at this grid cell (fill value — satellite may not have covered this area in this pass).',
        };
      }

      // ── Validate: distance sanity check ─────────────────────────────────
      if (minDist > MAX_VALID_DIST_KM) {
        return {
          group,
          nearestLat: nearLat,
          nearestLon: nearLon,
          distanceKm: minDist,
          soilMoisture: null,
          rawValue: rawSm,
          qualityFlag: qf,
          quality: 'no_coverage',
          error: `Nearest SMAP grid cell is ${minDist.toFixed(0)} km away — no coverage for this exact location.`,
        };
      }

      // ── Validate: quality flag ───────────────────────────────────────────
      // retrieval_qual_flag bit 0: 0 = recommended, 1 = uncertain/bad
      let qualityLabel = 'valid';
      let qualityError = null;
      if (qf !== null) {
        const recommended = (qf & 0x01) === 0;
        if (!recommended) {
          qualityLabel = 'poor_quality';
          qualityError = `SMAP quality flag (${qf}) indicates poor retrieval quality at this cell.`;
        }
      }

      return {
          group,
          nearestLat: nearLat,
          nearestLon: nearLon,
          distanceKm: Math.round(minDist * 10) / 10,
          pixelTime,
          soilMoisture: Math.round(rawSm * 10000) / 10000, // 4 dp
          rawValue: rawSm,
          qualityFlag: qf,
          quality: qualityLabel,
          error: qualityError,
        };
    }

    // If we reach here, no group had usable data (all fill-value or error)
    throw new Error('No valid SMAP data found in this granule for the target location.');

  } finally {
    if (f) {
      try { f.close(); } catch { /* ignore */ }
    }
  }
}
