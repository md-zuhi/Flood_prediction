const { createEmptyFeatureRecord } = require("./featureSchema");
const { getWeather } = require("./services/weatherService");
const { getRainfall } = require("./services/rainfallService");
const { getRainfallForecast } = require("./services/forecastService");
const { getSoilMoisture } = require("./services/soilMoistureService");
const { getTerrain } = require("./services/terrainService");
const { getLandslideHistory } = require("./services/landslideService");
const { getSatelliteRainfall } = require("./services/satelliteRainfallService");
const { getIoTReading }       = require("./services/iotSimulatorService");
const { evaluateDataQuality }  = require("./services/dataQualityService");


// --------------------------------------------------
// Calculate Data Completeness
// --------------------------------------------------

function calculateCompleteness(record) {
  const requiredFeatures = [
    record.weather.temperature_c,
    record.weather.humidity_percent,

    record.rainfall.rain_1h_mm,
    record.rainfall.rain_3h_mm,
    record.rainfall.rain_6h_mm,

    record.rainfall_forecast.forecast_3h_mm,
    record.rainfall_forecast.forecast_6h_mm,

    record.soil_moisture.value_m3_m3,

    record.terrain.elevation_m,
    record.terrain.slope_deg,

    record.landslide_history.nearest_event_km,
    record.landslide_history.count_10km,

    record.satellite_rainfall.rain_1h_mm,
    record.satellite_rainfall.rain_3h_mm,
    record.satellite_rainfall.rain_6h_mm
  ];

  const availableCount = requiredFeatures.filter(
    (value) => value !== null && value !== undefined
  ).length;

  const percentage =
    (availableCount / requiredFeatures.length) * 100;

  return Number(percentage.toFixed(2));
}


// --------------------------------------------------
// Find Missing Features
// --------------------------------------------------

function findMissingFeatures(record) {
  const features = {
    temperature_c:
      record.weather.temperature_c,

    humidity_percent:
      record.weather.humidity_percent,

    openmeteo_rain_1h:
      record.rainfall.rain_1h_mm,

    openmeteo_rain_3h:
      record.rainfall.rain_3h_mm,

    openmeteo_rain_6h:
      record.rainfall.rain_6h_mm,

    forecast_3h:
      record.rainfall_forecast.forecast_3h_mm,

    forecast_6h:
      record.rainfall_forecast.forecast_6h_mm,

    soil_moisture:
      record.soil_moisture.value_m3_m3,

    elevation:
      record.terrain.elevation_m,

    slope:
      record.terrain.slope_deg,

    nearest_landslide:
      record.landslide_history.nearest_event_km,

    landslide_count_10km:
      record.landslide_history.count_10km,

    gpm_rain_1h:
      record.satellite_rainfall.rain_1h_mm,

    gpm_rain_3h:
      record.satellite_rainfall.rain_3h_mm,

    gpm_rain_6h:
      record.satellite_rainfall.rain_6h_mm
  };

  return Object.entries(features)
    .filter(
      ([_, value]) =>
        value === null || value === undefined
    )
    .map(([name]) => name);
}


// --------------------------------------------------
// Build Unified/Fused Record
// --------------------------------------------------

async function buildFusedRecord(locationData) {

  // Create empty Phase 10 feature structure
  const record = createEmptyFeatureRecord();


  // --------------------------------------------------
  // LOCATION INFORMATION
  // --------------------------------------------------

  record.location.name =
    locationData.name || null;

  record.location.state =
    locationData.state || null;

  record.location.country =
    locationData.country || null;

  record.location.latitude =
    locationData.latitude ?? null;

  record.location.longitude =
    locationData.longitude ?? null;


  // --------------------------------------------------
  // PHASE 1 — LIVE WEATHER INTEGRATION
  // --------------------------------------------------

  const weather = await getWeather(
    locationData.latitude,
    locationData.longitude
  );

  record.weather = {
    ...record.weather,
    ...weather
  };


  // Add warning if weather retrieval failed
  if (weather.status === "failed") {
    record.metadata.warnings.push(
      "Weather data could not be retrieved."
    );
  }


  // --------------------------------------------------
  // PHASE 2 — OPEN-METEO RECENT RAINFALL
  // --------------------------------------------------

  const rainfall = await getRainfall(
    locationData.latitude,
    locationData.longitude
  );

  record.rainfall = {
    ...record.rainfall,
    ...rainfall
  };

  if (rainfall.status === "failed") {
    record.metadata.warnings.push(
      "Rainfall data could not be retrieved."
    );
  }


  // --------------------------------------------------
  // PHASE 3 — RAINFALL FORECAST
  // --------------------------------------------------

  const forecast = await getRainfallForecast(
    locationData.latitude,
    locationData.longitude
  );

  record.rainfall_forecast = {
    ...record.rainfall_forecast,
    ...forecast
  };

  if (forecast.status === "failed") {
    record.metadata.warnings.push(
      "Rainfall forecast data could not be retrieved."
    );
  }


  // --------------------------------------------------
  // OTHER DATA SOURCES
  // --------------------------------------------------

  // --------------------------------------------------
  // PHASE 4 — NASA SMAP SOIL MOISTURE
  // --------------------------------------------------

  const soilMoisture = await getSoilMoisture(
    locationData.latitude,
    locationData.longitude
  );

  record.soil_moisture = {
    ...record.soil_moisture,
    ...soilMoisture
  };

  if (soilMoisture.status === "failed") {
    record.metadata.warnings.push(
      "Soil moisture data could not be retrieved."
    );
  }


  // --------------------------------------------------
  // PHASE 5 — NASA SRTM TERRAIN / SLOPE
  // --------------------------------------------------

  const terrain = await getTerrain(
    locationData.latitude,
    locationData.longitude
  );

  record.terrain = {
    ...record.terrain,
    ...terrain
  };

  if (terrain.status === "failed") {
    record.metadata.warnings.push(
      "Terrain data could not be retrieved."
    );
  }


  // --------------------------------------------------
  // PHASE 6 — GSI HISTORICAL LANDSLIDE DATA
  // --------------------------------------------------

  const landslideHistory = getLandslideHistory(
    locationData.latitude,
    locationData.longitude,
    locationData.state
  );

  record.landslide_history = {
    ...record.landslide_history,
    ...landslideHistory
  };

  if (landslideHistory.status === "failed") {
    record.metadata.warnings.push(
      "Historical landslide data could not be retrieved."
    );
  }

  if (landslideHistory.status === "unavailable") {
    record.metadata.warnings.push(
      "Historical landslide dataset currently covers Tamil Nadu only. No data available for this location."
    );
  }


  // --------------------------------------------------
  // PHASE 8 — NASA GPM IMERG SATELLITE RAINFALL
  // --------------------------------------------------

  const satelliteRainfall = getSatelliteRainfall(
    locationData.latitude,
    locationData.longitude
  );

  record.satellite_rainfall = {
    ...record.satellite_rainfall,
    ...satelliteRainfall
  };

  if (satelliteRainfall.status === "failed") {
    record.metadata.warnings.push(
      "NASA GPM satellite rainfall data could not be retrieved."
    );
  }

  if (satelliteRainfall.status === "unavailable") {
    record.metadata.warnings.push(
      "NASA GPM satellite rainfall dataset does not currently cover this location."
    );
  }


  // --------------------------------------------------
  // PHASE 9 — SIMULATED IoT SENSOR
  // --------------------------------------------------
  // getIoTReading returns a clearly-labelled SIMULATED_IOT object.
  // It will be replaced by a real IoT API / MQTT adapter in production.
  // These values are advisory; they do NOT overwrite Open-Meteo or NASA sources.

  const iotReading = getIoTReading(
    locationData.latitude,
    locationData.longitude
  );

  record.iot = {
    ...record.iot,
    ...iotReading
  };

  if (!iotReading.available) {
    record.metadata.warnings.push(
      "IoT sensor data is currently unavailable."
    );
  }


  // --------------------------------------------------
  // METADATA
  // --------------------------------------------------

  record.metadata.generated_at =
    new Date().toISOString();


  // Find missing features
  record.metadata.missing_features =
    findMissingFeatures(record);


  // Calculate current data completeness
  record.metadata.data_completeness_percent =
    calculateCompleteness(record);


  // --------------------------------------------------
  // PHASE 10 — DATA FRESHNESS + QUALITY VALIDATION
  // --------------------------------------------------
  // Runs AFTER all sources are merged and generated_at is set.
  // Adds: metadata.source_health, metadata.overall_data_confidence
  // Merges freshness/quality warnings (deduplicated).

  const qualityResult = evaluateDataQuality(record);

  record.metadata.source_health          = qualityResult.source_health;
  record.metadata.overall_data_confidence = qualityResult.overall_data_confidence;

  // Add quality/freshness warnings without duplicating existing warnings
  for (const w of qualityResult.newWarnings) {
    if (!record.metadata.warnings.includes(w)) {
      record.metadata.warnings.push(w);
    }
  }


  // Return complete unified record
  return record;
}


// --------------------------------------------------
// EXPORT FUNCTIONS
// --------------------------------------------------

module.exports = {
  buildFusedRecord,
  calculateCompleteness,
  findMissingFeatures
};