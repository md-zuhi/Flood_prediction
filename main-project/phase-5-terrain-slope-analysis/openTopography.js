// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — OpenTopography API client (server-side only)
// ─────────────────────────────────────────────────────────────────────────────

const OPENTOPO_BASE = 'https://portal.opentopography.org/API';
const REQUEST_TIMEOUT_MS = 120_000;
const BBOX_DELTA = 0.01;
const DEM_TYPE = 'SRTMGL1';
const POINT_DATASET = 'SRTM_GL1';

export function getOpenTopographyApiKey() {
  const key = (process.env.OPENTOPOGRAPHY_API_KEY ?? '').trim();
  if (!key || key === 'your_opentopography_api_key_here') {
    return null;
  }
  return key;
}

export function buildBoundingBox(latitude, longitude, delta = BBOX_DELTA) {
  return {
    south: latitude - delta,
    north: latitude + delta,
    west: longitude - delta,
    east: longitude + delta,
  };
}

function isXmlErrorPayload(buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 256)).toString('utf8').trimStart();
  return head.startsWith('<?xml') || head.startsWith('<error');
}

function parseXmlError(buffer) {
  const text = buffer.toString('utf8');
  const match = text.match(/<error>([^<]+)<\/error>/i);
  return match?.[1]?.trim() ?? 'OpenTopography returned an XML error response.';
}

function assertTiffMagic(buffer) {
  if (buffer.length < 4) {
    throw new Error('Downloaded file is too small to be a valid GeoTIFF.');
  }
  const le = buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00;
  const be = buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a;
  if (!le && !be) {
    throw new Error('Downloaded file is not a valid GeoTIFF (missing TIFF magic bytes).');
  }
}

async function fetchBinary(url, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const buffer = Buffer.from(await response.arrayBuffer());

    if (isXmlErrorPayload(buffer)) {
      const message = parseXmlError(buffer);
      const err = new Error(`${label}: ${message}`);
      err.statusCode = response.status === 200 ? 502 : response.status;
      err.isOpenTopoError = true;
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`${label} failed with HTTP ${response.status}.`);
      err.statusCode = response.status;
      throw err;
    }

    return { buffer, status: response.status, url };
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
 * Point Elevation API — SRTM_GL1 at a single coordinate.
 */
export async function fetchPointElevation(latitude, longitude, apiKey) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    dataset: POINT_DATASET,
    API_Key: apiKey,
  });

  const url = `${OPENTOPO_BASE}/v1/elevation?${params}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Point Elevation API returned invalid JSON.');
    }

    if (!response.ok) {
      const err = new Error(data?.Message ?? data?.message ?? `Point Elevation API HTTP ${response.status}`);
      err.statusCode = response.status;
      throw err;
    }

    const statusText = data.Status ?? data.status ?? data.state;
    if (statusText && !['Success', 'OK', 'ok', 'success'].includes(String(statusText))) {
      throw new Error(data.Message ?? data.message ?? 'Point Elevation API request failed.');
    }

    const elevation = Number(
      data.Elevation ?? data.elevation ?? data.height ?? data.value
    );
    if (!Number.isFinite(elevation)) {
      throw new Error('Point Elevation API did not return a valid numeric elevation.');
    }

    return {
      elevation,
      unit: data.Unit ?? data.Units ?? data.unit ?? 'Meters',
      dataset: data['Reference Dataset'] ?? data.Dataset ?? data.dataset ?? POINT_DATASET,
      status: response.status,
      url: url.replace(apiKey, '[REDACTED]'),
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Point Elevation API timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Global DEM API — download NASA SRTM GL1 GeoTIFF for a bounding box.
 */
export async function fetchGlobalDemGeoTiff(bbox, apiKey) {
  const params = new URLSearchParams({
    demtype: DEM_TYPE,
    south: String(bbox.south),
    north: String(bbox.north),
    west: String(bbox.west),
    east: String(bbox.east),
    outputFormat: 'GTiff',
    API_Key: apiKey,
  });

  const url = `${OPENTOPO_BASE}/globaldem?${params}`;
  const { buffer, status } = await fetchBinary(url, 'Global DEM API');

  assertTiffMagic(buffer);

  return {
    buffer,
    status,
    url: url.replace(apiKey, '[REDACTED]'),
    demType: DEM_TYPE,
  };
}

export const OPENTOPO_CONSTANTS = {
  BBOX_DELTA,
  DEM_TYPE,
  POINT_DATASET,
  SOURCE_LABEL: 'NASA SRTM GL1',
  ACCESS_LABEL: 'Accessed through OpenTopography',
  RESOLUTION_LABEL: 'Approx. spatial resolution: 30 m',
};
