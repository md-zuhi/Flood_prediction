require("dotenv").config();

const express = require("express");
const cors = require("cors");

const riverRoutes = require("./routes/riverRoutes");
const { buildFusedRecord } = require("./fusionService");
const { buildRiverMultiSourceRecord } = require("./services/riverMultiSourceFusionService");
const {
  calculateRateOfRise,
  calculateTimeToWarning,
  predictRiverLevels,
  classifyRiverRisk,
  detectRapidRise,
  getStationThresholds,
  updateStationThresholds,
  getAllRiverStations,
  getStationDetails,
  applySimulationScenario
} = require("./services/riverMonitoringService");

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

// Dedicated RESTful River Endpoints (Requirement 10)
app.use("/api/rivers", riverRoutes);
app.use("/api/river-monitoring", riverRoutes);

// --------------------------------------------------
// Lightweight India Weather Grid & City Endpoints
// --------------------------------------------------

const MAJOR_INDIAN_CITIES = [
  // Metro / Capitals (Priority 1)
  { name: "Delhi", state: "Delhi", latitude: 28.6139, longitude: 77.2090, priority: 1 },
  { name: "Mumbai", state: "Maharashtra", latitude: 19.0760, longitude: 72.8777, priority: 1 },
  { name: "Chennai", state: "Tamil Nadu", latitude: 13.0827, longitude: 80.2707, priority: 1 },
  { name: "Kolkata", state: "West Bengal", latitude: 22.5726, longitude: 88.3639, priority: 1 },
  { name: "Bengaluru", state: "Karnataka", latitude: 12.9716, longitude: 77.5946, priority: 1 },
  { name: "Hyderabad", state: "Telangana", latitude: 17.3850, longitude: 78.4867, priority: 1 },
  { name: "Ahmedabad", state: "Gujarat", latitude: 23.0225, longitude: 72.5714, priority: 1 },
  { name: "Jaipur", state: "Rajasthan", latitude: 26.9124, longitude: 75.7873, priority: 1 },
  { name: "Lucknow", state: "Uttar Pradesh", latitude: 26.8467, longitude: 80.9462, priority: 1 },
  { name: "Patna", state: "Bihar", latitude: 25.5941, longitude: 85.1376, priority: 1 },
  { name: "Bhopal", state: "Madhya Pradesh", latitude: 23.2599, longitude: 77.4126, priority: 1 },
  { name: "Bhubaneswar", state: "Odisha", latitude: 20.2961, longitude: 85.8245, priority: 1 },
  { name: "Guwahati", state: "Assam", latitude: 26.1445, longitude: 91.7362, priority: 1 },
  { name: "Srinagar", state: "Jammu & Kashmir", latitude: 34.0837, longitude: 74.7973, priority: 1 },
  { name: "Thiruvananthapuram", state: "Kerala", latitude: 8.5241, longitude: 76.9366, priority: 1 },
  { name: "Chandigarh", state: "Chandigarh", latitude: 30.7333, longitude: 76.7794, priority: 1 },
  { name: "Ranchi", state: "Jharkhand", latitude: 23.3441, longitude: 85.3096, priority: 1 },
  { name: "Raipur", state: "Chhattisgarh", latitude: 21.2514, longitude: 81.6296, priority: 1 },
  { name: "Dehradun", state: "Uttarakhand", latitude: 30.3165, longitude: 78.0322, priority: 1, isSupportedFloodLoc: true },
  { name: "Shimla", state: "Himachal Pradesh", latitude: 31.1048, longitude: 77.1734, priority: 1 },

  // Tamil Nadu Districts & Towns
  { name: "Coimbatore", state: "Tamil Nadu", latitude: 11.0168, longitude: 76.9558, priority: 2 },
  { name: "Madurai", state: "Tamil Nadu", latitude: 9.9252, longitude: 78.1198, priority: 2 },
  { name: "Tiruchirappalli", state: "Tamil Nadu", latitude: 10.7905, longitude: 78.7047, priority: 2 },
  { name: "Salem", state: "Tamil Nadu", latitude: 11.6643, longitude: 78.1460, priority: 2 },
  { name: "Erode", state: "Tamil Nadu", latitude: 11.3410, longitude: 77.7172, priority: 2 },
  { name: "Vellore", state: "Tamil Nadu", latitude: 12.9165, longitude: 79.1325, priority: 2 },
  { name: "Tirunelveli", state: "Tamil Nadu", latitude: 8.7139, longitude: 77.7567, priority: 2 },
  { name: "Thoothukudi", state: "Tamil Nadu", latitude: 8.7642, longitude: 78.1348, priority: 2 },
  { name: "Dindigul", state: "Tamil Nadu", latitude: 10.3673, longitude: 77.9803, priority: 3 },
  { name: "Thanjavur", state: "Tamil Nadu", latitude: 10.7870, longitude: 79.1378, priority: 3 },
  { name: "Kanchipuram", state: "Tamil Nadu", latitude: 12.8342, longitude: 79.7036, priority: 3 },
  { name: "Cuddalore", state: "Tamil Nadu", latitude: 11.7480, longitude: 79.7714, priority: 3 },
  { name: "Nagapattinam", state: "Tamil Nadu", latitude: 10.7672, longitude: 79.8449, priority: 3 },
  { name: "Dharmapuri", state: "Tamil Nadu", latitude: 12.1211, longitude: 78.1582, priority: 3 },
  { name: "Krishnagiri", state: "Tamil Nadu", latitude: 12.5186, longitude: 78.2137, priority: 3 },
  { name: "Namakkal", state: "Tamil Nadu", latitude: 11.2189, longitude: 78.1674, priority: 3 },
  { name: "Karur", state: "Tamil Nadu", latitude: 10.9601, longitude: 78.0766, priority: 3 },
  { name: "Sivaganga", state: "Tamil Nadu", latitude: 9.8433, longitude: 78.4809, priority: 3 },
  { name: "Ramanathapuram", state: "Tamil Nadu", latitude: 9.3639, longitude: 78.8395, priority: 3 },
  { name: "Virudhunagar", state: "Tamil Nadu", latitude: 9.5872, longitude: 77.9514, priority: 3 },
  { name: "Tenkasi", state: "Tamil Nadu", latitude: 8.9593, longitude: 77.3130, priority: 3 },
  { name: "Ooty", state: "Tamil Nadu", latitude: 11.4102, longitude: 76.6950, priority: 3, isSupportedFloodLoc: true },
  { name: "Coonoor", state: "Tamil Nadu", latitude: 11.3533, longitude: 76.7959, priority: 3, isSupportedFloodLoc: true },
  { name: "Kodaikanal", state: "Tamil Nadu", latitude: 10.2381, longitude: 77.4892, priority: 3, isSupportedFloodLoc: true },

  // Kerala Districts
  { name: "Kochi", state: "Kerala", latitude: 9.9312, longitude: 76.2673, priority: 2 },
  { name: "Kozhikode", state: "Kerala", latitude: 11.2588, longitude: 75.7804, priority: 2 },
  { name: "Thrissur", state: "Kerala", latitude: 10.5276, longitude: 76.2144, priority: 2 },
  { name: "Kollam", state: "Kerala", latitude: 8.8932, longitude: 76.6141, priority: 2 },
  { name: "Palakkad", state: "Kerala", latitude: 10.7867, longitude: 76.6548, priority: 3 },
  { name: "Kannur", state: "Kerala", latitude: 11.8745, longitude: 75.3704, priority: 3 },
  { name: "Kottayam", state: "Kerala", latitude: 9.5916, longitude: 76.5222, priority: 3 },
  { name: "Alappuzha", state: "Kerala", latitude: 9.4981, longitude: 76.3388, priority: 3 },
  { name: "Munnar", state: "Kerala", latitude: 10.0889, longitude: 77.0595, priority: 3, isSupportedFloodLoc: true },
  { name: "Wayanad", state: "Kerala", latitude: 11.6854, longitude: 76.1320, priority: 3, isSupportedFloodLoc: true },

  // Karnataka Districts
  { name: "Mysuru", state: "Karnataka", latitude: 12.2958, longitude: 76.6394, priority: 2 },
  { name: "Hubballi", state: "Karnataka", latitude: 15.3647, longitude: 75.1240, priority: 2 },
  { name: "Mangaluru", state: "Karnataka", latitude: 12.9141, longitude: 74.8560, priority: 2 },
  { name: "Belagavi", state: "Karnataka", latitude: 15.8497, longitude: 74.4977, priority: 2 },
  { name: "Kalaburagi", state: "Karnataka", latitude: 17.3297, longitude: 76.8343, priority: 3 },
  { name: "Davanagere", state: "Karnataka", latitude: 14.4644, longitude: 75.9218, priority: 3 },
  { name: "Shivamogga", state: "Karnataka", latitude: 13.9299, longitude: 75.5681, priority: 3 },

  // Andhra Pradesh & Telangana
  { name: "Visakhapatnam", state: "Andhra Pradesh", latitude: 17.6868, longitude: 83.2185, priority: 2 },
  { name: "Vijayawada", state: "Andhra Pradesh", latitude: 16.5062, longitude: 80.6480, priority: 2 },
  { name: "Tirupati", state: "Andhra Pradesh", latitude: 13.6288, longitude: 79.4192, priority: 2 },
  { name: "Guntur", state: "Andhra Pradesh", latitude: 16.3067, longitude: 80.4365, priority: 3 },
  { name: "Nellore", state: "Andhra Pradesh", latitude: 14.4426, longitude: 79.9865, priority: 3 },
  { name: "Warangal", state: "Telangana", latitude: 17.9689, longitude: 79.5941, priority: 2 },
  { name: "Nizamabad", state: "Telangana", latitude: 18.6725, longitude: 78.0941, priority: 3 },

  // Maharashtra & Gujarat
  { name: "Pune", state: "Maharashtra", latitude: 18.5204, longitude: 73.8567, priority: 2 },
  { name: "Nagpur", state: "Maharashtra", latitude: 21.1458, longitude: 79.0882, priority: 2 },
  { name: "Nashik", state: "Maharashtra", latitude: 19.9975, longitude: 73.7898, priority: 2 },
  { name: "Aurangabad", state: "Maharashtra", latitude: 19.8762, longitude: 75.3433, priority: 3 },
  { name: "Solapur", state: "Maharashtra", latitude: 17.6599, longitude: 75.9064, priority: 3 },
  { name: "Surat", state: "Gujarat", latitude: 21.1702, longitude: 72.8311, priority: 2 },
  { name: "Vadodara", state: "Gujarat", latitude: 22.3072, longitude: 73.1812, priority: 2 },
  { name: "Rajkot", state: "Gujarat", latitude: 22.3039, longitude: 70.8022, priority: 2 },

  // Rajasthan & MP & UP
  { name: "Jodhpur", state: "Rajasthan", latitude: 26.2389, longitude: 73.0243, priority: 2 },
  { name: "Udaipur", state: "Rajasthan", latitude: 24.5854, longitude: 73.7125, priority: 2 },
  { name: "Kota", state: "Rajasthan", latitude: 25.2138, longitude: 75.8648, priority: 3 },
  { name: "Indore", state: "Madhya Pradesh", latitude: 22.7196, longitude: 75.8577, priority: 2 },
  { name: "Gwalior", state: "Madhya Pradesh", latitude: 26.2183, longitude: 78.1828, priority: 2 },
  { name: "Jabalpur", state: "Madhya Pradesh", latitude: 23.1815, longitude: 79.9864, priority: 3 },
  { name: "Kanpur", state: "Uttar Pradesh", latitude: 26.8467, longitude: 80.3318, priority: 2 },
  { name: "Varanasi", state: "Uttar Pradesh", latitude: 25.3176, longitude: 82.9739, priority: 2 },
  { name: "Agra", state: "Uttar Pradesh", latitude: 27.1767, longitude: 78.0081, priority: 2 },
  { name: "Prayagraj", state: "Uttar Pradesh", latitude: 25.4358, longitude: 81.8463, priority: 2 },
  { name: "Gorakhpur", state: "Uttar Pradesh", latitude: 26.7606, longitude: 83.3732, priority: 3 },
  { name: "Bareilly", state: "Uttar Pradesh", latitude: 28.3670, longitude: 79.4304, priority: 3 },
  { name: "Meerut", state: "Uttar Pradesh", latitude: 28.9845, longitude: 77.7064, priority: 3 },

  // Uttarakhand & Himachal
  { name: "Haridwar", state: "Uttarakhand", latitude: 29.9457, longitude: 78.1642, priority: 2 },
  { name: "Rishikesh", state: "Uttarakhand", latitude: 30.0869, longitude: 78.2676, priority: 3 },
  { name: "Mussoorie", state: "Uttarakhand", latitude: 30.4598, longitude: 78.0644, priority: 3, isSupportedFloodLoc: true },
  { name: "Nainital", state: "Uttarakhand", latitude: 29.3919, longitude: 79.4542, priority: 3, isSupportedFloodLoc: true },
  { name: "Almora", state: "Uttarakhand", latitude: 29.5971, longitude: 79.6591, priority: 3 },
  { name: "Dharamshala", state: "Himachal Pradesh", latitude: 32.2190, longitude: 76.3234, priority: 3 },

  // East & North-East
  { name: "Gaya", state: "Bihar", latitude: 24.7914, longitude: 85.0002, priority: 2 },
  { name: "Bhagalpur", state: "Bihar", latitude: 25.2425, longitude: 87.0139, priority: 3 },
  { name: "Jamshedpur", state: "Jharkhand", latitude: 22.8046, longitude: 86.2029, priority: 2 },
  { name: "Siliguri", state: "West Bengal", latitude: 26.7271, longitude: 88.3953, priority: 2 },
  { name: "Cuttack", state: "Odisha", latitude: 20.4625, longitude: 85.8828, priority: 2 },
  { name: "Puri", state: "Odisha", latitude: 19.8135, longitude: 85.8312, priority: 3 },
  { name: "Shillong", state: "Meghalaya", latitude: 25.5788, longitude: 91.8933, priority: 2 },
  { name: "Imphal", state: "Manipur", latitude: 24.8170, longitude: 93.9368, priority: 2 },
  { name: "Agartala", state: "Tripura", latitude: 23.8315, longitude: 91.2868, priority: 2 },

  // North (Punjab, Haryana, J&K)
  { name: "Ludhiana", state: "Punjab", latitude: 30.9010, longitude: 75.8573, priority: 2 },
  { name: "Amritsar", state: "Punjab", latitude: 31.6340, longitude: 74.8723, priority: 2 },
  { name: "Gurugram", state: "Haryana", latitude: 28.4595, longitude: 77.0266, priority: 2 },
  { name: "Jammu", state: "Jammu & Kashmir", latitude: 32.7266, longitude: 74.8570, priority: 2 }
];

let _cityCacheData = null;
let _cityCacheTime = 0;
let _gridCacheData = null;
let _gridCacheTime = 0;

// GET /api/weather-cities — Lightweight batch fetch for 115+ Indian cities/districts
app.get("/api/weather-cities", async (req, res) => {
  try {
    const now = Date.now();
    if (_cityCacheData && now - _cityCacheTime < 5 * 60 * 1000) {
      return res.json(_cityCacheData);
    }

    // Split 115 locations into batches of 45 coordinates to keep Open-Meteo requests ultra-fast
    const BATCH_SIZE = 45;
    const batches = [];
    for (let i = 0; i < MAJOR_INDIAN_CITIES.length; i += BATCH_SIZE) {
      batches.push(MAJOR_INDIAN_CITIES.slice(i, i + BATCH_SIZE));
    }

    const batchPromises = batches.map(async (batch) => {
      const latStr = batch.map((c) => c.latitude).join(",");
      const lonStr = batch.map((c) => c.longitude).join(",");
      const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation&timezone=auto`;
      const omRes = await fetch(omUrl);
      if (!omRes.ok) throw new Error(`Batch Open-Meteo failed: ${omRes.status}`);
      const omData = await omRes.json();
      return Array.isArray(omData) ? omData : [omData];
    });

    const batchResults = await Promise.all(batchPromises);
    const flatResults = batchResults.flat();

    const resultCities = MAJOR_INDIAN_CITIES.map((city, i) => {
      const cur = flatResults[i]?.current || {};
      return {
        ...city,
        district: city.district || city.name,
        weather: {
          temperature_c: cur.temperature_2m ?? null,
          humidity_percent: cur.relative_humidity_2m ?? null,
          wind_speed_kmh: cur.wind_speed_10m ?? null,
          wind_direction_deg: cur.wind_direction_10m ?? null,
          precipitation_mm: cur.precipitation ?? null,
          observation_time: cur.time ?? null,
          source: "Open-Meteo"
        }
      };
    });

    const payload = {
      success: true,
      source: "Open-Meteo",
      generated_at: new Date().toISOString(),
      total_locations: resultCities.length,
      cities: resultCities
    };

    _cityCacheData = payload;
    _cityCacheTime = now;
    return res.json(payload);
  } catch (err) {
    console.error("weather-cities error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/weather-grid — Lightweight India-wide weather sampling grid
app.get("/api/weather-grid", async (req, res) => {
  try {
    const now = Date.now();
    if (_gridCacheData && now - _gridCacheTime < 5 * 60 * 1000) {
      return res.json(_gridCacheData);
    }

    const north = parseFloat(req.query.north) || 35.0;
    const south = parseFloat(req.query.south) || 8.0;
    const east = parseFloat(req.query.east) || 94.0;
    const west = parseFloat(req.query.west) || 68.0;
    const step = parseFloat(req.query.resolution) || 2.5;

    const points = [];
    for (let lat = south; lat <= north; lat += step) {
      for (let lon = west; lon <= east; lon += step) {
        points.push({
          latitude: parseFloat(lat.toFixed(2)),
          longitude: parseFloat(lon.toFixed(2))
        });
      }
    }

    const latStr = points.map((p) => p.latitude).join(",");
    const lonStr = points.map((p) => p.longitude).join(",");

    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation&timezone=auto`;

    const omRes = await fetch(omUrl);
    if (!omRes.ok) {
      throw new Error(`Open-Meteo grid batch failed: ${omRes.status}`);
    }

    const omData = await omRes.json();
    const dataList = Array.isArray(omData) ? omData : [omData];

    const gridPoints = points.map((pt, i) => {
      const cur = dataList[i]?.current || {};
      return {
        latitude: pt.latitude,
        longitude: pt.longitude,
        temperature_c: cur.temperature_2m ?? null,
        humidity_percent: cur.relative_humidity_2m ?? null,
        wind_speed_kmh: cur.wind_speed_10m ?? null,
        wind_direction_deg: cur.wind_direction_10m ?? null,
        precipitation_mm: cur.precipitation ?? null,
        observation_time: cur.time ?? null
      };
    });

    const payload = {
      success: true,
      source: "Open-Meteo",
      generated_at: new Date().toISOString(),
      grid_resolution_deg: step,
      total_points: gridPoints.length,
      points: gridPoints
    };

    _gridCacheData = payload;
    _gridCacheTime = now;
    return res.json(payload);
  } catch (err) {
    console.error("weather-grid error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/weather-point — Lightweight single coordinate weather inspection
app.get("/api/weather-point", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ success: false, error: "Invalid lat/lon parameters" });
    }

    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation&timezone=auto`;

    const omRes = await fetch(omUrl);
    if (!omRes.ok) {
      throw new Error(`Open-Meteo point request failed: ${omRes.status}`);
    }

    const omData = await omRes.json();
    const cur = omData.current || {};

    return res.json({
      success: true,
      latitude: lat,
      longitude: lon,
      weather: {
        temperature_c: cur.temperature_2m ?? null,
        humidity_percent: cur.relative_humidity_2m ?? null,
        wind_speed_kmh: cur.wind_speed_10m ?? null,
        wind_direction_deg: cur.wind_direction_10m ?? null,
        precipitation_mm: cur.precipitation ?? null,
        observation_time: cur.time ?? null,
        source: "Open-Meteo"
      }
    });
  } catch (err) {
    console.error("weather-point error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});


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
    // Validate ML features and apply fallback for prototype
    const missingFeatures = Object.entries(mlFeatures)
      .filter(
        ([_, value]) =>
          value === null ||
          value === undefined ||
          Number.isNaN(Number(value))
      )
      .map(([name]) => name);

    // Apply defaults to missing features so the ML prediction can proceed
    Object.keys(mlFeatures).forEach(key => {
      if (mlFeatures[key] === null || mlFeatures[key] === undefined || Number.isNaN(Number(mlFeatures[key]))) {
        mlFeatures[key] = 0;
      }
    });

    if (missingFeatures.length > 0) {
      // Add a warning instead of failing
      fusedRecord.metadata.warnings.push(`ML prototype is using fallback value (0) for missing features: ${missingFeatures.join(", ")}`);
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


// --------------------------------------------------
// SIH 2026: River Rise Intelligence Endpoints
// --------------------------------------------------

// GET /api/river-monitoring: List all monitored river telemetry stations
app.get("/api/river-monitoring", async (req, res) => {
  try {
    const data = await getAllRiverStations();
    return res.status(200).json(data);
  } catch (err) {
    console.error("River monitoring error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/river-monitoring/thresholds: Retrieve configurable risk threshold profiles
app.get("/api/river-monitoring/thresholds", (req, res) => {
  try {
    const thresholds = getStationThresholds();
    return res.status(200).json({ success: true, count: thresholds.length, data: thresholds });
  } catch (err) {
    console.error("Get thresholds error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/river-monitoring/thresholds/:stationId: Single station threshold configuration
app.get("/api/river-monitoring/thresholds/:stationId", (req, res) => {
  try {
    const threshold = getStationThresholds(req.params.stationId);
    if (!threshold) {
      return res.status(404).json({ success: false, message: "Station threshold profile not found" });
    }
    return res.status(200).json({ success: true, data: threshold });
  } catch (err) {
    console.error("Get station threshold error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/river-monitoring/thresholds/:stationId: Dynamically configure thresholds per station
app.put("/api/river-monitoring/thresholds/:stationId", (req, res) => {
  try {
    const updated = updateStationThresholds(req.params.stationId, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Station not found to update thresholds" });
    }
    return res.status(200).json({
      success: true,
      message: `Configurable thresholds updated for station ${req.params.stationId}`,
      data: updated
    });
  } catch (err) {
    console.error("Update thresholds error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/river-monitoring/multi-source/:stationId: 7-Stream Multi-Source Fused Record
app.get("/api/river-monitoring/multi-source/:stationId", async (req, res) => {
  try {
    const stationId = req.params.stationId;
    const fusedRecord = await buildRiverMultiSourceRecord(stationId);
    if (!fusedRecord) {
      return res.status(404).json({ success: false, message: "River station not found for multi-source fusion" });
    }
    return res.status(200).json({ success: true, data: fusedRecord });
  } catch (err) {
    console.error("Multi-source fusion error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/river-monitoring/:stationId: Single station hydro-telemetry details
app.get("/api/river-monitoring/:stationId", async (req, res) => {
  try {
    const stationId = req.params.stationId;
    const result = await getStationDetails(stationId);
    if (!result) {
      return res.status(404).json({ success: false, message: "River monitoring station not found" });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("River station detail error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/river-monitoring/simulate: Hackathon simulation scenario trigger
app.post("/api/river-monitoring/simulate", (req, res) => {
  try {
    const mode = req.body?.mode || "standard";
    const result = applySimulationScenario(mode);
    return res.status(200).json(result);
  } catch (err) {
    console.error("River simulation error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/river-monitoring/calculate-rate: Rate of rise calculation endpoint
app.post("/api/river-monitoring/calculate-rate", (req, res) => {
  try {
    const {
      current_level,
      previous_level,
      current_time,
      previous_time,
      time_difference_hours,
      history
    } = req.body || {};

    const calculation = calculateRateOfRise({
      currentLevel: current_level,
      previousLevel: previous_level,
      currentTime: current_time,
      previousTime: previous_time,
      timeDiffHours: time_difference_hours,
      history: history || []
    });

    return res.status(200).json({
      success: true,
      data: calculation
    });
  } catch (err) {
    console.error("Rate calculation error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/river-monitoring/detect-rapid-rise: Test configurable rapid rise detection
app.post("/api/river-monitoring/detect-rapid-rise", (req, res) => {
  try {
    const {
      rate_of_rise,
      current_level,
      warning_level,
      custom_thresholds
    } = req.body || {};

    const detection = detectRapidRise({
      rateOfRise: rate_of_rise,
      currentLevel: current_level,
      warningLevel: warning_level,
      customThresholds: custom_thresholds
    });

    return res.status(200).json({
      success: true,
      data: detection
    });
  } catch (err) {
    console.error("Rapid rise detection error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `Phase 10 Data Fusion server running on port ${PORT}`
  );
});