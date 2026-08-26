"use strict";

const fs = require("fs");
const path = require("path");

// --------------------------------------------------
// Dataset / API constants
// --------------------------------------------------

const OPENTOPO_BASE = "https://portal.opentopography.org/API";
const DEM_TYPE = "SRTMGL1";
const POINT_DATASET = "SRTM_GL1";
const BBOX_DELTA = 0.01;
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_NODATA = -32768;
const EARTH_RADIUS_M = 6378137;


// --------------------------------------------------
// Persistent Terrain Cache
// --------------------------------------------------

const TERRAIN_CACHE_PATH = path.join(
  __dirname,
  "terrain_cache.json"
);

function loadTerrainCache() {
  try {
    if (!fs.existsSync(TERRAIN_CACHE_PATH)) {
      return {};
    }

    return JSON.parse(
      fs.readFileSync(TERRAIN_CACHE_PATH, "utf8")
    );
  } catch (error) {
    console.warn(
      "[Terrain] Could not load cache:",
      error.message
    );

    return {};
  }
}

function saveTerrainCache(cache) {
  try {
    fs.writeFileSync(
      TERRAIN_CACHE_PATH,
      JSON.stringify(cache, null, 2),
      "utf8"
    );
  } catch (error) {
    console.warn(
      "[Terrain] Could not save cache:",
      error.message
    );
  }
}

function getTerrainCacheKey(latitude, longitude) {
  return `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;
}

const terrainCache = loadTerrainCache();


// --------------------------------------------------
// Helpers
// --------------------------------------------------

function isValidElevation(
  value,
  noData = DEFAULT_NODATA
) {
  if (value === null || value === undefined) return false;
  if (!Number.isFinite(value)) return false;
  if (value === noData) return false;
  if (value <= -500) return false;

  return true;
}

function metersPerDegreeLon(latitude) {
  const latRad = (latitude * Math.PI) / 180;

  return (
    ((Math.PI * EARTH_RADIUS_M) / 180) *
    Math.cos(latRad)
  );
}

function metersPerDegreeLat() {
  return (Math.PI * EARTH_RADIUS_M) / 180;
}

function cellIndex(row, col, width) {
  return row * width + col;
}

function getElevation(
  data,
  row,
  col,
  width,
  noData
) {
  const value =
    data[cellIndex(row, col, width)];

  return isValidElevation(value, noData)
    ? value
    : null;
}


// --------------------------------------------------
// OpenTopography Point Elevation
// --------------------------------------------------

async function fetchPointElevation(
  latitude,
  longitude,
  apiKey
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    dataset: POINT_DATASET,
    API_Key: apiKey
  });

  const url =
    `${OPENTOPO_BASE}/v1/elevation?${params}`;

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      30_000
    );

  try {
    const response =
      await fetch(url, {
        signal: controller.signal
      });

    const text =
      await response.text();

    const data =
      JSON.parse(text);

    if (!response.ok) {
      throw new Error(
        data?.Message ??
        `Point Elevation API HTTP ${response.status}`
      );
    }

    const elevation =
      Number(
        data.Elevation ??
        data.elevation ??
        data.height ??
        data.value
      );

    if (!Number.isFinite(elevation)) {
      throw new Error(
        "Point Elevation API returned no valid elevation."
      );
    }

    return elevation;

  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "Point Elevation API timed out."
      );
    }

    throw err;

  } finally {
    clearTimeout(timer);
  }
}


// --------------------------------------------------
// OpenTopography Global DEM GeoTIFF
// --------------------------------------------------

async function fetchGlobalDemGeoTiff(
  bbox,
  apiKey
) {
  const params =
    new URLSearchParams({
      demtype: DEM_TYPE,
      south: String(bbox.south),
      north: String(bbox.north),
      west: String(bbox.west),
      east: String(bbox.east),
      outputFormat: "GTiff",
      API_Key: apiKey
    });

  const url =
    `${OPENTOPO_BASE}/globaldem?${params}`;

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(url, {
        signal: controller.signal
      });

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    const head =
      buffer
        .subarray(
          0,
          Math.min(buffer.length, 256)
        )
        .toString("utf8")
        .trimStart();

    if (
      head.startsWith("<?xml") ||
      head.startsWith("<error")
    ) {
      const match =
        buffer
          .toString("utf8")
          .match(
            /<error>([^<]+)<\/error>/i
          );

      throw new Error(
        match?.[1]?.trim() ??
        "OpenTopography returned an XML error."
      );
    }

    if (!response.ok) {
      throw new Error(
        `Global DEM API HTTP ${response.status}`
      );
    }

    const le =
      buffer[0] === 0x49 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x2a &&
      buffer[3] === 0x00;

    const be =
      buffer[0] === 0x4d &&
      buffer[1] === 0x4d &&
      buffer[2] === 0x00 &&
      buffer[3] === 0x2a;

    if (!le && !be) {
      throw new Error(
        "Downloaded file is not a valid GeoTIFF."
      );
    }

    return buffer;

  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        `Global DEM API timed out after ${
          REQUEST_TIMEOUT_MS / 1000
        }s.`
      );
    }

    throw err;

  } finally {
    clearTimeout(timer);
  }
}


// --------------------------------------------------
// GeoTIFF Parsing
// --------------------------------------------------

async function parseGeoTiff(buffer) {
  const geotiffMod =
    await import("geotiff");

  const { fromArrayBuffer } =
    geotiffMod;

  const tiff =
    await fromArrayBuffer(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset +
        buffer.byteLength
      )
    );

  const image =
    await tiff.getImage();

  const width =
    image.getWidth();

  const height =
    image.getHeight();

  const [
    west,
    south,
    east,
    north
  ] =
    image.getBoundingBox();

  const rasters =
    await image.readRasters({
      interleave: true
    });

  const raw =
    ArrayBuffer.isView(rasters)
      ? rasters
      : rasters[0];

  if (
    !raw ||
    raw.length !== width * height
  ) {
    throw new Error(
      "GeoTIFF raster could not be read."
    );
  }

  const gdalNoData =
    image.getGDALNoData();

  const noDataValue =
    gdalNoData !== null &&
    gdalNoData !== undefined
      ? Number(gdalNoData)
      : DEFAULT_NODATA;

  return {
    data: raw,
    width,
    height,
    bbox: {
      west,
      south,
      east,
      north
    },
    noDataValue
  };
}


// --------------------------------------------------
// Elevation Statistics
// --------------------------------------------------

function computeElevationStats(
  data,
  noDataValue
) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (
    let i = 0;
    i < data.length;
    i++
  ) {
    const value =
      data[i];

    if (
      !isValidElevation(
        value,
        noDataValue
      )
    ) {
      continue;
    }

    count++;
    sum += value;

    if (value < min) {
      min = value;
    }

    if (value > max) {
      max = value;
    }
  }

  if (count === 0) {
    throw new Error(
      "No valid SRTM elevation cells in raster."
    );
  }

  return {
    min,
    max,
    mean: sum / count
  };
}


// --------------------------------------------------
// Horn 3×3 Slope
// --------------------------------------------------

function computeSlopeGrid(
  data,
  width,
  height,
  bbox,
  noDataValue
) {
  const centerLat =
    (
      bbox.north +
      bbox.south
    ) / 2;

  const cellSizeX =
    (
      (bbox.east - bbox.west) /
      width
    ) *
    metersPerDegreeLon(centerLat);

  const cellSizeY =
    (
      (bbox.north - bbox.south) /
      height
    ) *
    metersPerDegreeLat();

  const slopes =
    new Float32Array(
      width * height
    ).fill(NaN);

  for (
    let row = 1;
    row < height - 1;
    row++
  ) {
    for (
      let col = 1;
      col < width - 1;
      col++
    ) {
      const z =
        data[
          cellIndex(
            row,
            col,
            width
          )
        ];

      if (
        !isValidElevation(
          z,
          noDataValue
        )
      ) {
        continue;
      }

      const a =
        getElevation(
          data,
          row - 1,
          col - 1,
          width,
          noDataValue
        );

      const b =
        getElevation(
          data,
          row - 1,
          col,
          width,
          noDataValue
        );

      const c =
        getElevation(
          data,
          row - 1,
          col + 1,
          width,
          noDataValue
        );

      const d =
        getElevation(
          data,
          row,
          col - 1,
          width,
          noDataValue
        );

      const f =
        getElevation(
          data,
          row,
          col + 1,
          width,
          noDataValue
        );

      const g =
        getElevation(
          data,
          row + 1,
          col - 1,
          width,
          noDataValue
        );

      const h =
        getElevation(
          data,
          row + 1,
          col,
          width,
          noDataValue
        );

      const i =
        getElevation(
          data,
          row + 1,
          col + 1,
          width,
          noDataValue
        );

      if (
        [
          a,
          b,
          c,
          d,
          f,
          g,
          h,
          i
        ].some(
          value =>
            value === null
        )
      ) {
        continue;
      }

      const dzdx =
        (
          (
            c +
            2 * f +
            i
          ) -
          (
            a +
            2 * d +
            g
          )
        ) /
        (
          8 *
          cellSizeX
        );

      const dzdy =
        (
          (
            g +
            2 * h +
            i
          ) -
          (
            a +
            2 * b +
            c
          )
        ) /
        (
          8 *
          cellSizeY
        );

      slopes[
        cellIndex(
          row,
          col,
          width
        )
      ] =
        (
          Math.atan(
            Math.sqrt(
              dzdx ** 2 +
              dzdy ** 2
            )
          ) *
          180
        ) /
        Math.PI;
    }
  }

  return slopes;
}


// --------------------------------------------------
// Slope Statistics
// --------------------------------------------------

function computeSlopeStats(slopes) {
  let sum = 0;
  let max = -Infinity;
  let count = 0;

  for (
    let i = 0;
    i < slopes.length;
    i++
  ) {
    const value =
      slopes[i];

    if (
      !Number.isFinite(value)
    ) {
      continue;
    }

    count++;
    sum += value;

    if (value > max) {
      max = value;
    }
  }

  if (count === 0) {
    throw new Error(
      "No valid slope cells in raster."
    );
  }

  return {
    mean: sum / count,
    max
  };
}


// --------------------------------------------------
// Convert Lat/Lon to Raster Cell
// --------------------------------------------------

function latLonToCell(
  lat,
  lon,
  bbox,
  width,
  height
) {
  const col =
    Math.round(
      (
        (
          lon -
          bbox.west
        ) /
        (
          bbox.east -
          bbox.west
        )
      ) *
      (
        width - 1
      )
    );

  const row =
    Math.round(
      (
        (
          bbox.north -
          lat
        ) /
        (
          bbox.north -
          bbox.south
        )
      ) *
      (
        height - 1
      )
    );

  return {
    row:
      Math.max(
        0,
        Math.min(
          height - 1,
          row
        )
      ),

    col:
      Math.max(
        0,
        Math.min(
          width - 1,
          col
        )
      )
  };
}


// --------------------------------------------------
// Open-Meteo Elevation Fallback
// --------------------------------------------------

async function fetchOpenMeteoElevation(
  latitude,
  longitude
) {
  const url =
    `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Open-Meteo Elevation API HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  const elevation =
    Array.isArray(data.elevation)
      ? Number(data.elevation[0])
      : null;

  if (!Number.isFinite(elevation)) {
    throw new Error(
      "Open-Meteo returned no valid elevation."
    );
  }

  return elevation;
}


// --------------------------------------------------
// Main Terrain Function
// --------------------------------------------------

async function getTerrain(
  latitude,
  longitude
) {
  const cacheKey =
    getTerrainCacheKey(
      latitude,
      longitude
    );

  // ------------------------------------------------
  // 1. Return cached terrain first
  // ------------------------------------------------

  if (terrainCache[cacheKey]) {
    console.log(
      `[Terrain] Cache hit for ${cacheKey}`
    );

    return {
      ...terrainCache[cacheKey],
      cache: "hit"
    };
  }

  const apiKey =
    (
      process.env
        .OPENTOPOGRAPHY_API_KEY ??
      ""
    ).trim();

  try {
    // ------------------------------------------------
    // 2. Try OpenTopography first
    // ------------------------------------------------

    if (
      !apiKey ||
      apiKey ===
        "your_opentopography_api_key_here"
    ) {
      throw new Error(
        "OPENTOPOGRAPHY_API_KEY not configured."
      );
    }

    const bbox = {
      south:
        latitude -
        BBOX_DELTA,

      north:
        latitude +
        BBOX_DELTA,

      west:
        longitude -
        BBOX_DELTA,

      east:
        longitude +
        BBOX_DELTA
    };

    console.log(
      `[Terrain] Fetching SRTM GL1 for lat=${latitude}, lon=${longitude}...`
    );

    const [
      pointElevation,
      demBuffer
    ] =
      await Promise.all([
        fetchPointElevation(
          latitude,
          longitude,
          apiKey
        ).catch(
          () => null
        ),

        fetchGlobalDemGeoTiff(
          bbox,
          apiKey
        )
      ]);

    console.log(
      "[Terrain] Parsing GeoTIFF..."
    );

    const {
      data,
      width,
      height,
      bbox: rasterBbox,
      noDataValue
    } =
      await parseGeoTiff(
        demBuffer
      );

    const elevStats =
      computeElevationStats(
        data,
        noDataValue
      );

    const slopes =
      computeSlopeGrid(
        data,
        width,
        height,
        rasterBbox,
        noDataValue
      );

    const slopeStats =
      computeSlopeStats(
        slopes
      );

    const {
      row,
      col
    } =
      latLonToCell(
        latitude,
        longitude,
        rasterBbox,
        width,
        height
      );

    let centerSlope =
      slopes[
        cellIndex(
          row,
          col,
          width
        )
      ];

    if (
      !Number.isFinite(
        centerSlope
      )
    ) {
      const neighbors = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ];

      for (
        const [
          dr,
          dc
        ] of neighbors
      ) {
        const nr =
          row + dr;

        const nc =
          col + dc;

        if (
          nr < 0 ||
          nr >= height ||
          nc < 0 ||
          nc >= width
        ) {
          continue;
        }

        const slope =
          slopes[
            cellIndex(
              nr,
              nc,
              width
            )
          ];

        if (
          Number.isFinite(
            slope
          )
        ) {
          centerSlope =
            slope;

          break;
        }
      }
    }

    const rasterElevation =
      data[
        cellIndex(
          row,
          col,
          width
        )
      ];

    const centerRasterElev =
      isValidElevation(
        rasterElevation,
        noDataValue
      )
        ? rasterElevation
        : null;

    const elevationAtLocation =
      pointElevation !== null
        ? pointElevation
        : centerRasterElev;

    const round2 =
      value =>
        value !== null &&
        Number.isFinite(value)
          ? Math.round(
              value * 100
            ) / 100
          : null;

    const terrainResult = {
      elevation_m:
        round2(
          elevationAtLocation
        ),

      min_elevation_m:
        round2(
          elevStats.min
        ),

      max_elevation_m:
        round2(
          elevStats.max
        ),

      mean_elevation_m:
        round2(
          elevStats.mean
        ),

      local_relief_m:
        round2(
          elevStats.max -
          elevStats.min
        ),

      slope_deg:
        round2(
          Number.isFinite(
            centerSlope
          )
            ? centerSlope
            : null
        ),

      mean_slope_deg:
        round2(
          slopeStats.mean
        ),

      max_slope_deg:
        round2(
          slopeStats.max
        ),

      source:
        "NASA SRTM",

      access_service:
        "OpenTopography",

      dataset:
        "SRTMGL1",

      status:
        "success",

      terrain_mode:
        "full_terrain",

      cache:
        "miss"
    };

    terrainCache[cacheKey] = {
      ...terrainResult,
      cache: "stored"
    };

    saveTerrainCache(
      terrainCache
    );

    console.log(
      `[Terrain] Cached terrain for ${cacheKey}`
    );

    return terrainResult;

  } catch (err) {
    // ------------------------------------------------
    // 3. OpenTopography failed
    //    Try Open-Meteo elevation fallback
    // ------------------------------------------------

    console.error(
      "[Terrain] OpenTopography error:",
      err.message
    );

    try {
      console.log(
        `[Terrain] Trying Open-Meteo elevation fallback for ${latitude}, ${longitude}...`
      );

      const elevation =
        await fetchOpenMeteoElevation(
          latitude,
          longitude
        );

      const fallbackResult = {
        elevation_m:
          Math.round(
            elevation * 100
          ) / 100,

        min_elevation_m:
          null,

        max_elevation_m:
          null,

        mean_elevation_m:
          null,

        local_relief_m:
          null,

        slope_deg:
          null,

        mean_slope_deg:
          null,

        max_slope_deg:
          null,

        source:
          "Copernicus DEM GLO-90",

        access_service:
          "Open-Meteo Elevation API",

        dataset:
          "Copernicus DEM 2021 GLO-90",

        status:
          "success",

        terrain_mode:
          "elevation_fallback",

        warning:
          "OpenTopography unavailable; elevation retrieved from Open-Meteo Copernicus DEM. Slope and relief unavailable.",

        cache:
          "miss"
      };

      terrainCache[cacheKey] = {
        ...fallbackResult,
        cache: "stored"
      };

      saveTerrainCache(
        terrainCache
      );

      console.log(
        `[Terrain] Fallback elevation cached for ${cacheKey}: ${elevation} m`
      );

      return fallbackResult;

    } catch (fallbackError) {
      console.error(
        "[Terrain] Open-Meteo fallback error:",
        fallbackError.message
      );

      return {
        elevation_m:
          null,

        min_elevation_m:
          null,

        max_elevation_m:
          null,

        mean_elevation_m:
          null,

        local_relief_m:
          null,

        slope_deg:
          null,

        mean_slope_deg:
          null,

        max_slope_deg:
          null,

        source:
          "NASA SRTM / Copernicus DEM",

        access_service:
          "OpenTopography / Open-Meteo",

        status:
          "failed",

        error:
          `OpenTopography: ${err.message}; Open-Meteo fallback: ${fallbackError.message}`
      };
    }
  }
}

module.exports = {
  getTerrain
};