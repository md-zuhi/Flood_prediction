// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — SRTM GeoTIFF parsing, elevation statistics, and slope analysis
// ─────────────────────────────────────────────────────────────────────────────

import { fromArrayBuffer } from 'geotiff';

const DEFAULT_NODATA = -32768;
const EARTH_RADIUS_M = 6378137;

export function isValidElevation(value, noData = DEFAULT_NODATA) {
  if (value === null || value === undefined) return false;
  if (!Number.isFinite(value)) return false;
  if (value === noData) return false;
  if (value <= -500) return false;
  return true;
}

/** Meters per degree longitude at a given latitude */
export function metersPerDegreeLon(latitude) {
  const latRad = (latitude * Math.PI) / 180;
  return ((Math.PI * EARTH_RADIUS_M) / 180) * Math.cos(latRad);
}

/** Meters per degree latitude (approximate) */
export function metersPerDegreeLat() {
  return (Math.PI * EARTH_RADIUS_M) / 180;
}

export function classifyTerrain(slopeDeg) {
  if (slopeDeg < 5) return 'Nearly Flat';
  if (slopeDeg < 15) return 'Gentle';
  if (slopeDeg < 30) return 'Steep';
  if (slopeDeg < 45) return 'Very Steep';
  return 'Extremely Steep';
}

/**
 * Parse a GeoTIFF buffer into elevation raster data.
 */
export async function parseGeoTiff(buffer) {
  const tiff = await fromArrayBuffer(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox(); // [west, south, east, north]
  const [west, south, east, north] = bbox;

  const rasters = await image.readRasters({ interleave: true });
  const raw = ArrayBuffer.isView(rasters) ? rasters : rasters[0];
  if (!raw || raw.length !== width * height) {
    throw new Error('GeoTIFF raster band could not be read as a 2D elevation grid.');
  }

  const gdalNoData = image.getGDALNoData();
  const noDataValue =
    gdalNoData !== null && gdalNoData !== undefined ? Number(gdalNoData) : DEFAULT_NODATA;

  const pixelWidthDeg = (east - west) / width;
  const pixelHeightDeg = (north - south) / height;

  return {
    data: raw,
    width,
    height,
    bbox: { west, south, east, north },
    noDataValue,
    pixelWidthDeg,
    pixelHeightDeg,
  };
}

/** Map lat/lon to nearest raster row/col (north-up image) */
export function latLonToCell(latitude, longitude, bbox, width, height) {
  const { west, south, east, north } = bbox;
  const col = Math.round(((longitude - west) / (east - west)) * (width - 1));
  const row = Math.round(((north - latitude) / (north - south)) * (height - 1));
  return {
    row: Math.max(0, Math.min(height - 1, row)),
    col: Math.max(0, Math.min(width - 1, col)),
  };
}

function cellIndex(row, col, width) {
  return row * width + col;
}

function getElevation(data, row, col, width, noData) {
  const value = data[cellIndex(row, col, width)];
  return isValidElevation(value, noData) ? value : null;
}

/**
 * Horn (1981) 3×3 slope on geographic raster with lat-aware cell spacing.
 */
export function computeSlopeGrid(data, width, height, bbox, noDataValue) {
  const centerLat = (bbox.north + bbox.south) / 2;
  const mPerDegLat = metersPerDegreeLat();
  const mPerDegLon = metersPerDegreeLon(centerLat);
  const cellSizeX = ((bbox.east - bbox.west) / width) * mPerDegLon;
  const cellSizeY = ((bbox.north - bbox.south) / height) * mPerDegLat;

  const slopes = new Float32Array(width * height).fill(NaN);

  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      const idx = cellIndex(row, col, width);
      const z = data[idx];
      if (!isValidElevation(z, noDataValue)) continue;

      const a = getElevation(data, row - 1, col - 1, width, noDataValue);
      const b = getElevation(data, row - 1, col, width, noDataValue);
      const c = getElevation(data, row - 1, col + 1, width, noDataValue);
      const d = getElevation(data, row, col - 1, width, noDataValue);
      const f = getElevation(data, row, col + 1, width, noDataValue);
      const g = getElevation(data, row + 1, col - 1, width, noDataValue);
      const h = getElevation(data, row + 1, col, width, noDataValue);
      const i = getElevation(data, row + 1, col + 1, width, noDataValue);

      if ([a, b, c, d, f, g, h, i].some((v) => v === null)) continue;

      const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cellSizeX);
      const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cellSizeY);
      slopes[idx] = (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
    }
  }

  return {
    slopes,
    cellSizeX,
    cellSizeY,
    cellSizeXMeters: cellSizeX,
    cellSizeYMeters: cellSizeY,
  };
}

function computeElevationStats(data, noDataValue) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let validCount = 0;
  let noDataCount = 0;

  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (!isValidElevation(value, noDataValue)) {
      noDataCount++;
      continue;
    }
    validCount++;
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (validCount === 0) {
    throw new Error('No valid SRTM elevation cells found in the downloaded raster.');
  }

  return {
    minElevation: min,
    maxElevation: max,
    meanElevation: sum / validCount,
    validCellCount: validCount,
    noDataCellCount: noDataCount,
  };
}

function computeSlopeStats(slopes) {
  let mean = 0;
  let max = -Infinity;
  let count = 0;

  for (let i = 0; i < slopes.length; i++) {
    const value = slopes[i];
    if (!Number.isFinite(value)) continue;
    count++;
    mean += value;
    if (value > max) max = value;
  }

  if (count === 0) {
    throw new Error('Unable to compute slope — no valid slope cells in raster.');
  }

  return {
    meanSlope: mean / count,
    maxSlope: max,
    validSlopeCellCount: count,
  };
}

/** Downsample elevation grid for a simple heatmap preview (max 32×32) */
export function buildElevationPreviewGrid(data, width, height, noDataValue, maxSize = 32) {
  const scale = Math.max(width, height) / maxSize;
  const outW = Math.max(1, Math.round(width / scale));
  const outH = Math.max(1, Math.round(height / scale));
  const grid = [];

  for (let r = 0; r < outH; r++) {
    const row = [];
    for (let c = 0; c < outW; c++) {
      const srcR = Math.min(height - 1, Math.round(r * scale));
      const srcC = Math.min(width - 1, Math.round(c * scale));
      const value = data[cellIndex(srcR, srcC, width)];
      row.push(isValidElevation(value, noDataValue) ? value : null);
    }
    grid.push(row);
  }

  return { grid, previewWidth: outW, previewHeight: outH };
}

/**
 * Full DEM analysis from parsed raster + optional point API elevation.
 */
export function analyzeDemRaster({
  data,
  width,
  height,
  bbox,
  noDataValue,
  pixelWidthDeg,
  pixelHeightDeg,
  centerLatitude,
  centerLongitude,
  pointElevation,
}) {
  const elevStats = computeElevationStats(data, noDataValue);
  const localRelief = elevStats.maxElevation - elevStats.minElevation;

  const { row, col } = latLonToCell(centerLatitude, centerLongitude, bbox, width, height);
  const centerIdx = cellIndex(row, col, width);
  const centerRasterElevation = isValidElevation(data[centerIdx], noDataValue)
    ? data[centerIdx]
    : null;

  const { slopes, cellSizeX, cellSizeY } = computeSlopeGrid(
    data,
    width,
    height,
    bbox,
    noDataValue
  );

  const slopeStats = computeSlopeStats(slopes);
  let centerSlope = Number.isFinite(slopes[centerIdx]) ? slopes[centerIdx] : null;
  if (centerSlope === null) {
    for (const [dr, dc] of [
      [0, 1], [0, -1], [1, 0], [-1, 0],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ]) {
      const nRow = row + dr;
      const nCol = col + dc;
      if (nRow < 0 || nRow >= height || nCol < 0 || nCol >= width) continue;
      const neighbor = slopes[cellIndex(nRow, nCol, width)];
      if (Number.isFinite(neighbor)) {
        centerSlope = neighbor;
        break;
      }
    }
  }

  const elevationAtLocation =
    pointElevation !== null && pointElevation !== undefined
      ? pointElevation
      : centerRasterElevation;

  const pointRasterDifference =
    pointElevation !== null &&
    pointElevation !== undefined &&
    centerRasterElevation !== null
      ? pointElevation - centerRasterElevation
      : null;

  const preview = buildElevationPreviewGrid(data, width, height, noDataValue);

  return {
    elevation: {
      atLocation: elevationAtLocation,
      centerRasterElevation,
      pointElevation: pointElevation ?? null,
      minElevation: elevStats.minElevation,
      maxElevation: elevStats.maxElevation,
      meanElevation: elevStats.meanElevation,
      localRelief,
    },
    slope: {
      atLocation: centerSlope,
      meanSlope: slopeStats.meanSlope,
      maxSlope: slopeStats.maxSlope,
      terrainClassification: centerSlope !== null ? classifyTerrain(centerSlope) : null,
    },
    raster: {
      width,
      height,
      pixelWidthDeg,
      pixelHeightDeg,
      cellSizeXMeters: cellSizeX,
      cellSizeYMeters: cellSizeY,
      validCellCount: elevStats.validCellCount,
      noDataCellCount: elevStats.noDataCellCount,
      centerRow: row,
      centerCol: col,
    },
    debug: {
      minRawElevation: elevStats.minElevation,
      maxRawElevation: elevStats.maxElevation,
      meanRawElevation: elevStats.meanElevation,
      centerRasterElevation,
      pointElevation: pointElevation ?? null,
      pointRasterDifference,
      validSlopeCellCount: slopeStats.validSlopeCellCount,
    },
    preview: preview.grid,
    previewWidth: preview.previewWidth,
    previewHeight: preview.previewHeight,
  };
}

/**
 * Parse GeoTIFF buffer and run full terrain analysis.
 */
export async function processDemGeoTiff(buffer, centerLatitude, centerLongitude, pointElevation) {
  const parsed = await parseGeoTiff(buffer);
  const analysis = analyzeDemRaster({
    ...parsed,
    centerLatitude,
    centerLongitude,
    pointElevation,
  });

  return {
    ...analysis,
    bbox: parsed.bbox,
    noDataValue: parsed.noDataValue,
  };
}
