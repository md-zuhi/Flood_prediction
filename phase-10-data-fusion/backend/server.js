require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { buildFusedRecord } = require("./fusionService");

const app = express();

const PORT = process.env.PORT || 5000;

// Phase 11 FastAPI prediction service
const ML_API_URL =
  process.env.ML_API_URL || "http://127.0.0.1:8000/predict";

  // --------------------------------------------------
// Prototype Risk Classification
// --------------------------------------------------

const RISK_THRESHOLDS = {
  moderate: 30,
  high: 50,
  critical: 70
};

function getRiskLevel(probabilityPercent) {

  if (probabilityPercent >= RISK_THRESHOLDS.critical) {
    return {
      risk_level: "CRITICAL",
      alert_message:
        "Critical flash-flood risk. Immediate precautionary action recommended."
    };
  }

  if (probabilityPercent >= RISK_THRESHOLDS.high) {
    return {
      risk_level: "HIGH",
      alert_message:
        "High flash-flood risk. Prepare for possible local flooding."
    };
  }

  if (probabilityPercent >= RISK_THRESHOLDS.moderate) {
    return {
      risk_level: "MODERATE",
      alert_message:
        "Monitor local weather and rainfall conditions."
    };
  }

  return {
    risk_level: "LOW",
    alert_message:
      "No immediate flash-flood threat detected."
  };
}

app.use(cors());
app.use(express.json());


// --------------------------------------------------
// Health Check
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    message: "Phase 10 Data Fusion API is running",
    status: "OK"
  });
});


// --------------------------------------------------
// Validate Location
// --------------------------------------------------

function validateLocation(body) {
  const {
    name,
    state,
    country,
    latitude,
    longitude
  } = body;

  if (
    !name ||
    latitude === undefined ||
    longitude === undefined
  ) {
    return {
      error: "name, latitude and longitude are required"
    };
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return {
      error: "latitude and longitude must be valid numbers"
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      error: "latitude must be between -90 and 90"
    };
  }

  if (lon < -180 || lon > 180) {
    return {
      error: "longitude must be between -180 and 180"
    };
  }

  return {
    locationData: {
      name,
      state: state || null,
      country: country || null,
      latitude: lat,
      longitude: lon
    }
  };
}


// --------------------------------------------------
// Existing Phase 10 Fusion Endpoint
// --------------------------------------------------

app.post("/api/fusion", async (req, res) => {
  try {
    const validation = validateLocation(req.body);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    const fusedRecord = await buildFusedRecord(
      validation.locationData
    );

    return res.status(200).json({
      success: true,
      message: "Unified data record generated successfully",
      data: fusedRecord
    });

  } catch (error) {
    console.error("Data fusion error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate unified data record",
      error: error.message
    });
  }
});


// --------------------------------------------------
// Phase 10 + Phase 11 ML Prediction Endpoint
// --------------------------------------------------

app.post("/api/predict", async (req, res) => {
  try {
    const validation = validateLocation(req.body);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // STEP 1:
    // Get live fused environmental data
    const fusedRecord = await buildFusedRecord(
      validation.locationData
    );

    // STEP 2:
    // Extract exactly the 9 features used by Model V1
    const mlFeatures = {
      rain_1h_mm:
        fusedRecord.rainfall.rain_1h_mm,

      rain_3h_mm:
        fusedRecord.rainfall.rain_3h_mm,

      rain_6h_mm:
        fusedRecord.rainfall.rain_6h_mm,

      rain_12h_mm:
        fusedRecord.rainfall.rain_12h_mm,

      rain_24h_mm:
        fusedRecord.rainfall.rain_24h_mm,

      temperature_c:
        fusedRecord.weather.temperature_c,

      humidity_percent:
        fusedRecord.weather.humidity_percent,

      soil_moisture_m3m3:
        fusedRecord.soil_moisture.value_m3_m3,

      elevation_m:
        fusedRecord.terrain.elevation_m
    };

    // STEP 3:
    // Validate ML features
    const missingFeatures = Object.entries(mlFeatures)
      .filter(
        ([_, value]) =>
          value === null ||
          value === undefined ||
          Number.isNaN(Number(value))
      )
      .map(([name]) => name);

    if (missingFeatures.length > 0) {
      return res.status(422).json({
        success: false,
        message:
          "ML prediction cannot run because required live features are missing.",
        missing_features: missingFeatures,
        data: fusedRecord
      });
    }

    // STEP 4:
    // Send features to Phase 11 FastAPI model
    const mlResponse = await fetch(ML_API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(mlFeatures)
    });

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();

      throw new Error(
        `ML API returned ${mlResponse.status}: ${errorText}`
      );
    }

    const prediction = await mlResponse.json();

    // STEP 5:
    // Convert ML probability into prototype risk band
    const risk = getRiskLevel(
      prediction.flood_probability_percent
    );

    // STEP 6:
    // Return full dashboard-ready response
    return res.status(200).json({
      success: true,

      message:
        "Live data fusion and ML prediction completed successfully",

      // ---------------------------------------------
      // LOCATION
      // ---------------------------------------------
      location: fusedRecord.location,

      // ---------------------------------------------
      // EXACT FEATURES USED BY ML MODEL V1
      // ---------------------------------------------
      ml_features: mlFeatures,

      // ---------------------------------------------
      // ML PREDICTION + ALERT
      // ---------------------------------------------
      prediction: {
        model_version:
          prediction.model_version,

        flood_probability:
          prediction.flood_probability,

        flood_probability_percent:
          prediction.flood_probability_percent,

        flood_prediction:
          prediction.prediction,

        risk_level:
          risk.risk_level,

        alert_message:
          risk.alert_message
      },

      // ---------------------------------------------
      // FULL ENVIRONMENTAL DATA
      // ---------------------------------------------
      environmental_data: {
        weather:
          fusedRecord.weather,

        rainfall:
          fusedRecord.rainfall,

        rainfall_forecast:
          fusedRecord.rainfall_forecast,

        soil_moisture:
          fusedRecord.soil_moisture,

        terrain:
          fusedRecord.terrain,

        landslide_history:
          fusedRecord.landslide_history,

        satellite_rainfall:
          fusedRecord.satellite_rainfall,

        iot:
          fusedRecord.iot
      },

      // ---------------------------------------------
      // DATA QUALITY / HEALTH
      // ---------------------------------------------
      metadata: {
        generated_at:
          fusedRecord.metadata.generated_at,

        data_completeness_percent:
          fusedRecord.metadata
            .data_completeness_percent,

        missing_features:
          fusedRecord.metadata
            .missing_features,

        warnings:
          fusedRecord.metadata
            .warnings,

        overall_data_confidence:
          fusedRecord.metadata
            .overall_data_confidence,

        source_health:
          fusedRecord.metadata
            .source_health
      },

      // ---------------------------------------------
      // SIMPLE SOURCE SUMMARY
      // ---------------------------------------------
      data_sources: {
        weather:
          fusedRecord.weather.source,

        rainfall:
          fusedRecord.rainfall.source,

        rainfall_forecast:
          fusedRecord.rainfall_forecast.source,

        soil_moisture:
          fusedRecord.soil_moisture.source,

        terrain:
          fusedRecord.terrain.source,

        landslide_history:
          fusedRecord.landslide_history.source,

        satellite_rainfall:
          fusedRecord.satellite_rainfall.source
      },

      generated_at:
        new Date().toISOString()
    });

  } catch (error) {
    console.error(
      "Prediction error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate flash flood prediction",
      error:
        error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `Phase 10 Data Fusion server running on port ${PORT}`
  );
});