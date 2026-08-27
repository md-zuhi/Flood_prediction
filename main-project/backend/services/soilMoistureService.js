"use strict";

// Adapted from phase-3-nasa-smap-soil-moisture/nasaSmap.js
// Dataset: SPL2SMP_NRT v107 (NASA SMAP L2 NRT Radiometer Half-Orbit)
// Grid:    EASE-Grid 2.0, 36 km resolution
// Auth:    NASA Earthdata Bearer Token (EARTHDATA_TOKEN in .env)

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const DATASET_SHORT_NAME  = "SPL2SMP_NRT";
const DATASET_VERSION     = "107";
const CMR_SEARCH_URL      = "https://cmr.earthdata.nasa.gov/search/granules.json";
const SMAP_FILL_VALUE     = -9999.0;
const MAX_VALID_DIST_KM   = 80;
const DOWNLOAD_TIMEOUT_MS = 180_000;

// ── Haversine ────────────────────────────────────────────────────────────────

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

// ── CMR Granule Search ───────────────────────────────────────────────────────

async function searchLatestGranule(lat, lon) {
  const margin = 3;
  const bbox   = `${lon - margin},${lat - margin},${lon + margin},${lat + margin}`;

  const params = new URLSearchParams({
    short_name:   DATASET_SHORT_NAME,
    version:      DATASET_VERSION,
    bounding_box: bbox,
    page_size:    "15",
  });
  params.append("sort_key[]", "-start_date");

  const url      = `${CMR_SEARCH_URL}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal:  AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`CMR search failed: HTTP ${response.status}`);

  const body    = await response.json();
  const entries = body.feed?.entry ?? [];

  const results = [];
  for (const entry of entries) {
    const h5Link = (entry.links ?? []).find(
      (l) =>
        l.rel === "http://esipfed.org/ns/fedsearch/1.1/data#" &&
        (l.href.endsWith(".h5") || l.href.includes(".h5?"))
    );
    if (h5Link) {
      results.push({
        granuleId:   entry.id,
        granuleName: entry.title,
        downloadUrl: h5Link.href,
        startTime:   entry.time_start,
        endTime:     entry.time_end,
      });
    }
  }
  return results.length > 0 ? results : null;
}

// ── Authenticated HDF5 Download ──────────────────────────────────────────────

async function downloadGranule(downloadUrl, token) {
  const tmpPath  = path.join(os.tmpdir(), `smap_nrt_${Date.now()}.h5`);
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "follow",
    signal:   AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (response.status === 401 || response.status === 403) throw new Error("NASA_AUTH_FAILED");
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));
  return tmpPath;
}

// ── HDF5 Parse + Nearest Cell ────────────────────────────────────────────────

async function extractSoilMoisture(filePath, targetLat, targetLon) {
  // h5wasm is an ES module — use dynamic import
  const h5wasmMod = await import("h5wasm/node");
  const h5wasm    = h5wasmMod.default ?? h5wasmMod;
  await h5wasm.ready;

  let f = null;
  try {
    f = new h5wasm.File(filePath, "r");

    const groups = [
      "Soil_Moisture_Retrieval_Data",
      "Soil_Moisture_Retrieval_Data_AM",
      "Soil_Moisture_Retrieval_Data_PM",
    ];

    for (const group of groups) {
      let groupHandle = null;
      try { groupHandle = f.get(group); if (!groupHandle) continue; } catch { continue; }

      const latDs  = f.get(`${group}/latitude`);
      const lonDs  = f.get(`${group}/longitude`);
      const smDs   = f.get(`${group}/soil_moisture`);
      const qfDs   = f.get(`${group}/retrieval_qual_flag`);
      const timeDs = f.get(`${group}/tb_time_utc`);

      if (!latDs || !lonDs || !smDs) continue;

      const lats  = latDs.value;
      const lons  = lonDs.value;
      const sms   = smDs.value;
      const qfs   = qfDs   ? qfDs.value   : null;
      const times = timeDs ? timeDs.value : null;

      let fillValue = SMAP_FILL_VALUE;
      try {
        const attrs = smDs.attrs;
        if (attrs && "_FillValue" in attrs) {
          const fv = attrs["_FillValue"].value;
          fillValue = Array.isArray(fv) ? Number(fv[0]) : Number(fv);
        }
      } catch { /* use default */ }

      // Find nearest valid pixel
      let minDist = Infinity, minIdx = -1;
      for (let i = 0; i < lats.length; i++) {
        const plat = lats[i], plon = lons[i];
        if (plat < -90 || plat > 90 || plon < -180 || plon > 180) continue;
        const d = haversineKm(targetLat, targetLon, plat, plon);
        if (d < minDist) { minDist = d; minIdx = i; }
      }

      if (minIdx === -1) continue;

      const rawSm     = sms[minIdx];
      const qf        = qfs   !== null ? qfs[minIdx]   : null;
      const pixelTime = times !== null ? times[minIdx] : null;

      // Fill value check
      if (Math.abs(rawSm - fillValue) < 0.001 || rawSm <= fillValue) {
        return { soilMoisture: null, pixelTime, qualityFlag: qf, quality: "fill_value",
                 nearestLat: lats[minIdx], nearestLon: lons[minIdx], distanceKm: Math.round(minDist * 10) / 10,
                 error: "Fill value — no retrieval at this cell." };
      }

      // Distance check
      if (minDist > MAX_VALID_DIST_KM) {
        return { soilMoisture: null, pixelTime, qualityFlag: qf, quality: "no_coverage",
                 nearestLat: lats[minIdx], nearestLon: lons[minIdx], distanceKm: Math.round(minDist * 10) / 10,
                 error: `Nearest cell is ${minDist.toFixed(0)} km away — no coverage.` };
      }

      // Quality flag: bit 0 = 0 means recommended
      let quality = "good";
      if (qf !== null && (qf & 0x01) !== 0) quality = "poor";

      return {
        soilMoisture: Math.round(rawSm * 10000) / 10000,
        pixelTime,
        qualityFlag: qf,
        quality,
        nearestLat:  lats[minIdx],
        nearestLon:  lons[minIdx],
        distanceKm:  Math.round(minDist * 10) / 10,
        error: null,
      };
    }

    throw new Error("No valid SMAP data found in this granule.");
  } finally {
    if (f) { try { f.close(); } catch { /* ignore */ } }
  }
}

// ── Main exported function ───────────────────────────────────────────────────

// ── In-Memory Cache ──────────────────────────────────────────────────────────
const _smapCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

async function getSoilMoisture(latitude, longitude) {
  const token = (process.env.EARTHDATA_TOKEN ?? "").trim();

  if (!token || token === "your_earthdata_token_here") {
    return {
      value_m3_m3:      null,
      observation_time: null,
      age_hours:        null,
      quality:          "unknown",
      source:           "NASA SMAP",
      status:           "failed",
      error:            "EARTHDATA_TOKEN not configured.",
    };
  }

  // Check cache first
  const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  const cached = _smapCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    const ageHours = Math.round(((Date.now() - new Date(cached.result.observation_time).getTime()) / 3_600_000) * 10) / 10;
    return {
      ...cached.result,
      age_hours: ageHours,
    };
  }

  let tmpFilePath = null;

  try {
    console.log(`[SMAP] Searching CMR for lat=${latitude}, lon=${longitude}...`);
    const granules = await searchLatestGranule(latitude, longitude);

    if (!granules || granules.length === 0) {
      return {
        value_m3_m3:      null,
        observation_time: null,
        age_hours:        null,
        quality:          "unknown",
        source:           "NASA SMAP",
        status:           "failed",
        error:            "No recent SMAP granule found for this location.",
      };
    }

    let result  = null;
    let granule = null;
    let lastError = "No valid data found in any granule.";

    for (const candidate of granules) {
      console.log(`[SMAP] Trying granule: ${candidate.granuleName}`);
      try {
        tmpFilePath = await downloadGranule(candidate.downloadUrl, token);
        const extracted = await extractSoilMoisture(tmpFilePath, latitude, longitude);
        try { fs.unlinkSync(tmpFilePath); tmpFilePath = null; } catch { /* ignore */ }

        granule = candidate;
        result  = extracted;

        if (result.soilMoisture !== null) {
          console.log(`[SMAP] Valid: ${result.soilMoisture} m³/m³`);
          break;
        }
        lastError = result.error ?? "Fill value.";
      } catch (err) {
        lastError = err.message;
        if (tmpFilePath) { try { fs.unlinkSync(tmpFilePath); tmpFilePath = null; } catch { /* ignore */ } }
        if (err.message === "NASA_AUTH_FAILED") throw err;
      }
    }

    if (!result || !granule) {
      return {
        value_m3_m3:      null,
        observation_time: null,
        age_hours:        null,
        quality:          "unknown",
        source:           "NASA SMAP",
        status:           "failed",
        error:            lastError,
      };
    }

    // Compute age
    const obsTimeStr = result.pixelTime ?? granule.startTime;
    const ageHours   = Math.round(((Date.now() - new Date(obsTimeStr).getTime()) / 3_600_000) * 10) / 10;

    // Map quality
    const qualityMap = { good: "good", poor: "poor", fill_value: "poor", no_coverage: "poor", valid: "good" };
    const qualityLabel = qualityMap[result.quality] ?? "unknown";

    const resData = {
      value_m3_m3:      result.soilMoisture,
      observation_time: obsTimeStr,
      age_hours:        ageHours,
      quality:          qualityLabel,
      source:           "NASA SMAP",
      dataset:          DATASET_SHORT_NAME,
      version:          DATASET_VERSION,
      quality_flag:     result.qualityFlag,
      status:           result.soilMoisture !== null ? "success" : "failed",
      error:            result.error ?? null,
    };

    if (result.soilMoisture !== null) {
      _smapCache.set(cacheKey, { result: resData, cachedAt: Date.now() });
    }

    return resData;

  } catch (err) {
    console.error("[SMAP] Error:", err.message);
    return {
      value_m3_m3:      null,
      observation_time: null,
      age_hours:        null,
      quality:          "unknown",
      source:           "NASA SMAP",
      status:           "failed",
      error:            err.message,
    };
  } finally {
    if (tmpFilePath) { try { fs.unlinkSync(tmpFilePath); } catch { /* ignore */ } }
  }
}

module.exports = { getSoilMoisture };
