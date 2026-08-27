/**
 * Central Flood Risk Integration & IoT Telemetry Service
 * SIH 2026: Flash Flood Prediction System for Hilly Regions
 *
 * Connects:
 * Rainfall ↑ + Soil Moisture ↑ + Water Level ↑ rapidly + Slope Risk ↑
 * => Flood Risk Score ↑ => Village/Ward Risk Level changes => Early Warning triggers
 */

// Comprehensive Village/Ward Geodatabase for High-Risk Mountain Regions
export const MOUNTAIN_VILLAGE_WARDS = [
  // Nilgiris District, Tamil Nadu
  {
    id: "ward-nilgiris-coonoor",
    name: "Coonoor Upper Ridge Ward",
    district: "Nilgiris",
    state: "Tamil Nadu",
    coordinates: [11.3530, 76.7959],
    polygon: [
      [11.3620, 76.7850],
      [11.3650, 76.8100],
      [11.3450, 76.8150],
      [11.3420, 76.7900]
    ],
    rainfall_mm_hr: 38.5,
    rainfall_24h_mm: 142.0,
    soil_moisture_pct: 88,
    water_level_m: 3.45,
    danger_level_m: 4.80,
    rate_of_rise_m_hr: 0.28,
    slope_tilt_deg: 32.4,
    slope_risk: "HIGH",
    historical_flood_risk: "HIGH",
    river_name: "Bhavani Tributary",
    elevation_m: 1850,
    sensor_id: "IOT-NIL-01"
  },
  {
    id: "ward-nilgiris-pykara",
    name: "Pykara Valley Village",
    district: "Nilgiris",
    state: "Tamil Nadu",
    coordinates: [11.4550, 76.6020],
    polygon: [
      [11.4680, 76.5900],
      [11.4720, 76.6200],
      [11.4450, 76.6250],
      [11.4400, 76.5950]
    ],
    rainfall_mm_hr: 44.0,
    rainfall_24h_mm: 168.5,
    soil_moisture_pct: 92,
    water_level_m: 4.90,
    danger_level_m: 5.50,
    rate_of_rise_m_hr: 0.38,
    slope_tilt_deg: 28.5,
    slope_risk: "CRITICAL",
    historical_flood_risk: "HIGH",
    river_name: "Pykara River",
    elevation_m: 2060,
    sensor_id: "IOT-NIL-02"
  },
  {
    id: "ward-nilgiris-ooty-lake",
    name: "Ooty Lakeside & Fingerpost Ward",
    district: "Nilgiris",
    state: "Tamil Nadu",
    coordinates: [11.4064, 76.6932],
    polygon: [
      [11.4180, 76.6800],
      [11.4200, 76.7100],
      [11.3950, 76.7150],
      [11.3920, 76.6850]
    ],
    rainfall_mm_hr: 18.0,
    rainfall_24h_mm: 68.0,
    soil_moisture_pct: 65,
    water_level_m: 2.10,
    danger_level_m: 4.20,
    rate_of_rise_m_hr: 0.06,
    slope_tilt_deg: 16.2,
    slope_risk: "MODERATE",
    historical_flood_risk: "MODERATE",
    river_name: "Ooty Stream Channel",
    elevation_m: 2240,
    sensor_id: "IOT-NIL-03"
  },
  {
    id: "ward-nilgiris-kotagiri",
    name: "Kotagiri Slope Sector",
    district: "Nilgiris",
    state: "Tamil Nadu",
    coordinates: [11.4280, 76.8640],
    polygon: [
      [11.4400, 76.8500],
      [11.4420, 76.8800],
      [11.4150, 76.8850],
      [11.4120, 76.8550]
    ],
    rainfall_mm_hr: 24.5,
    rainfall_24h_mm: 86.0,
    soil_moisture_pct: 74,
    water_level_m: 2.60,
    danger_level_m: 4.50,
    rate_of_rise_m_hr: 0.12,
    slope_tilt_deg: 24.0,
    slope_risk: "HIGH",
    historical_flood_risk: "HIGH",
    river_name: "Kotagiri Ravine",
    elevation_m: 1790,
    sensor_id: "IOT-NIL-04"
  },

  // Wayanad District, Kerala
  {
    id: "ward-wayanad-meppadi",
    name: "Meppadi Hill Settlement",
    district: "Wayanad",
    state: "Kerala",
    coordinates: [11.5510, 76.1280],
    polygon: [
      [11.5650, 76.1150],
      [11.5680, 76.1450],
      [11.5380, 76.1500],
      [11.5350, 76.1200]
    ],
    rainfall_mm_hr: 62.0,
    rainfall_24h_mm: 240.0,
    soil_moisture_pct: 96,
    water_level_m: 4.60,
    danger_level_m: 5.00,
    rate_of_rise_m_hr: 0.45,
    slope_tilt_deg: 38.0,
    slope_risk: "CRITICAL",
    historical_flood_risk: "CRITICAL",
    river_name: "Chaliyar Riverhead",
    elevation_m: 980,
    sensor_id: "IOT-WAY-01"
  },
  {
    id: "ward-wayanad-chooralmala",
    name: "Chooralmala Valley Ward",
    district: "Wayanad",
    state: "Kerala",
    coordinates: [11.5320, 76.1650],
    polygon: [
      [11.5450, 76.1500],
      [11.5480, 76.1800],
      [11.5200, 76.1850],
      [11.5180, 76.1550]
    ],
    rainfall_mm_hr: 68.5,
    rainfall_24h_mm: 285.0,
    soil_moisture_pct: 98,
    water_level_m: 5.20,
    danger_level_m: 5.10,
    rate_of_rise_m_hr: 0.52,
    slope_tilt_deg: 42.5,
    slope_risk: "CRITICAL",
    historical_flood_risk: "CRITICAL",
    river_name: "Iruvanji Stream Channel",
    elevation_m: 860,
    sensor_id: "IOT-WAY-02"
  },
  {
    id: "ward-wayanad-mananthavady",
    name: "Mananthavady Riverfront Ward",
    district: "Wayanad",
    state: "Kerala",
    coordinates: [11.8020, 76.0020],
    polygon: [
      [11.8150, 75.9900],
      [11.8180, 76.0200],
      [11.7900, 76.0250],
      [11.7880, 75.9950]
    ],
    rainfall_mm_hr: 28.0,
    rainfall_24h_mm: 110.0,
    soil_moisture_pct: 78,
    water_level_m: 3.80,
    danger_level_m: 6.20,
    rate_of_rise_m_hr: 0.14,
    slope_tilt_deg: 18.0,
    slope_risk: "MODERATE",
    historical_flood_risk: "HIGH",
    river_name: "Kabini River",
    elevation_m: 760,
    sensor_id: "IOT-WAY-03"
  },

  // Munnar / Idukki, Kerala
  {
    id: "ward-idukki-old-munnar",
    name: "Old Munnar Bridge Ward",
    district: "Idukki",
    state: "Kerala",
    coordinates: [10.0820, 77.0610],
    polygon: [
      [10.0950, 77.0500],
      [10.0980, 77.0750],
      [10.0700, 77.0800],
      [10.0680, 77.0550]
    ],
    rainfall_mm_hr: 54.0,
    rainfall_24h_mm: 195.0,
    soil_moisture_pct: 91,
    water_level_m: 4.85,
    danger_level_m: 5.80,
    rate_of_rise_m_hr: 0.35,
    slope_tilt_deg: 34.0,
    slope_risk: "CRITICAL",
    historical_flood_risk: "HIGH",
    river_name: "Muthirapuzha River",
    elevation_m: 1530,
    sensor_id: "IOT-IDK-01"
  },
  {
    id: "ward-idukki-devikulam",
    name: "Devikulam Ridge Village",
    district: "Idukki",
    state: "Kerala",
    coordinates: [10.0610, 77.1020],
    polygon: [
      [10.0720, 77.0900],
      [10.0750, 77.1200],
      [10.0480, 77.1250],
      [10.0450, 77.0950]
    ],
    rainfall_mm_hr: 32.0,
    rainfall_24h_mm: 125.0,
    soil_moisture_pct: 82,
    water_level_m: 3.10,
    danger_level_m: 5.20,
    rate_of_rise_m_hr: 0.18,
    slope_tilt_deg: 26.0,
    slope_risk: "HIGH",
    historical_flood_risk: "MODERATE",
    river_name: "Devikulam Headwaters",
    elevation_m: 1800,
    sensor_id: "IOT-IDK-02"
  },

  // Uttarakhand Mountain Valleys (Rudraprayag / Kedarnath / Rishikesh)
  {
    id: "ward-uk-sonprayag",
    name: "Sonprayag Confluence Ward",
    district: "Rudraprayag",
    state: "Uttarakhand",
    coordinates: [30.6300, 78.9800],
    polygon: [
      [30.6420, 78.9680],
      [30.6450, 78.9950],
      [30.6180, 79.0000],
      [30.6150, 78.9720]
    ],
    rainfall_mm_hr: 48.0,
    rainfall_24h_mm: 175.0,
    soil_moisture_pct: 89,
    water_level_m: 5.60,
    danger_level_m: 6.80,
    rate_of_rise_m_hr: 0.40,
    slope_tilt_deg: 44.0,
    slope_risk: "CRITICAL",
    historical_flood_risk: "CRITICAL",
    river_name: "Mandakini - Songanga Sangam",
    elevation_m: 1820,
    sensor_id: "IOT-UK-01"
  },
  {
    id: "ward-uk-rudraprayag-sangam",
    name: "Rudraprayag Sangam Ward",
    district: "Rudraprayag",
    state: "Uttarakhand",
    coordinates: [30.2850, 78.9810],
    polygon: [
      [30.2980, 78.9680],
      [30.3000, 78.9950],
      [30.2720, 79.0000],
      [30.2700, 78.9720]
    ],
    rainfall_mm_hr: 22.0,
    rainfall_24h_mm: 92.0,
    soil_moisture_pct: 76,
    water_level_m: 6.60,
    danger_level_m: 10.20,
    rate_of_rise_m_hr: 0.12,
    slope_tilt_deg: 28.0,
    slope_risk: "HIGH",
    historical_flood_risk: "HIGH",
    river_name: "Alaknanda - Mandakini Sangam",
    elevation_m: 895,
    sensor_id: "IOT-UK-02"
  },
  {
    id: "ward-uk-rishikesh-ghat",
    name: "Rishikesh Parmarth Ghat Ward",
    district: "Dehradun",
    state: "Uttarakhand",
    coordinates: [30.1030, 78.2980],
    polygon: [
      [30.1150, 78.2850],
      [30.1180, 78.3120],
      [30.0900, 78.3150],
      [30.0880, 78.2880]
    ],
    rainfall_mm_hr: 12.0,
    rainfall_24h_mm: 45.0,
    soil_moisture_pct: 58,
    water_level_m: 4.80,
    danger_level_m: 9.50,
    rate_of_rise_m_hr: 0.04,
    slope_tilt_deg: 12.0,
    slope_risk: "LOW",
    historical_flood_risk: "MODERATE",
    river_name: "Ganga Main Channel",
    elevation_m: 372,
    sensor_id: "IOT-UK-03"
  },

  // Himachal Pradesh (Kullu / Manali / Shimla)
  {
    id: "ward-hp-manali-town",
    name: "Manali Old Town & Riverbed Ward",
    district: "Kullu",
    state: "Himachal Pradesh",
    coordinates: [32.2432, 77.1892],
    polygon: [
      [32.2550, 77.1750],
      [32.2580, 77.2050],
      [32.2300, 77.2100],
      [32.2280, 77.1800]
    ],
    rainfall_mm_hr: 36.0,
    rainfall_24h_mm: 135.0,
    soil_moisture_pct: 84,
    water_level_m: 3.90,
    danger_level_m: 5.20,
    rate_of_rise_m_hr: 0.26,
    slope_tilt_deg: 36.0,
    slope_risk: "HIGH",
    historical_flood_risk: "HIGH",
    river_name: "Upper Beas River",
    elevation_m: 2050,
    sensor_id: "IOT-HP-01"
  },
  {
    id: "ward-hp-bhuntar-confluence",
    name: "Bhuntar Confluence Sector",
    district: "Kullu",
    state: "Himachal Pradesh",
    coordinates: [31.9570, 77.1090],
    polygon: [
      [31.9700, 77.0950],
      [31.9720, 77.1250],
      [31.9450, 77.1300],
      [31.9420, 77.1000]
    ],
    rainfall_mm_hr: 26.5,
    rainfall_24h_mm: 98.0,
    soil_moisture_pct: 75,
    water_level_m: 4.20,
    danger_level_m: 6.60,
    rate_of_rise_m_hr: 0.15,
    slope_tilt_deg: 22.0,
    slope_risk: "MODERATE",
    historical_flood_risk: "HIGH",
    river_name: "Beas - Parbati Confluence",
    elevation_m: 1089,
    sensor_id: "IOT-HP-02"
  },

  // West Bengal / Sikkim (Kalimpong / Teesta)
  {
    id: "ward-wb-teesta-bazaar",
    name: "Teesta Bazaar & Melli Ward",
    district: "Kalimpong",
    state: "West Bengal",
    coordinates: [27.0980, 88.4520],
    polygon: [
      [27.1100, 88.4380],
      [27.1120, 88.4680],
      [27.0850, 88.4720],
      [27.0820, 88.4420]
    ],
    rainfall_mm_hr: 42.0,
    rainfall_24h_mm: 155.0,
    soil_moisture_pct: 87,
    water_level_m: 6.10,
    danger_level_m: 8.40,
    rate_of_rise_m_hr: 0.32,
    slope_tilt_deg: 40.0,
    slope_risk: "CRITICAL",
    historical_flood_risk: "CRITICAL",
    river_name: "Teesta Main Channel",
    elevation_m: 215,
    sensor_id: "IOT-TEESTA-01"
  },

  // Tamil Nadu (Kodaikanal)
  {
    id: "ward-tn-kodaikanal",
    name: "Kodaikanal Lake & Gundar Basin",
    district: "Dindigul",
    state: "Tamil Nadu",
    coordinates: [10.2381, 77.4892],
    polygon: [
      [10.2480, 77.4750],
      [10.2500, 77.5050],
      [10.2250, 77.5100],
      [10.2220, 77.4800]
    ],
    rainfall_mm_hr: 21.0,
    rainfall_24h_mm: 76.0,
    soil_moisture_pct: 68,
    water_level_m: 2.30,
    danger_level_m: 4.40,
    rate_of_rise_m_hr: 0.08,
    slope_tilt_deg: 19.5,
    slope_risk: "MODERATE",
    historical_flood_risk: "MODERATE",
    river_name: "Gundar Stream",
    elevation_m: 2133,
    sensor_id: "IOT-TN-KOD01"
  },

  // Uttarakhand (Nainital)
  {
    id: "ward-uk-nainital",
    name: "Nainital Lake Catchment & Mallital",
    district: "Nainital",
    state: "Uttarakhand",
    coordinates: [29.3919, 79.4542],
    polygon: [
      [29.4020, 29.4400],
      [29.4050, 79.4700],
      [29.3800, 79.4750],
      [29.3780, 79.4450]
    ],
    rainfall_mm_hr: 22.5,
    rainfall_24h_mm: 82.0,
    soil_moisture_pct: 71,
    water_level_m: 3.10,
    danger_level_m: 5.60,
    rate_of_rise_m_hr: 0.09,
    slope_tilt_deg: 26.0,
    slope_risk: "MODERATE",
    historical_flood_risk: "HIGH",
    river_name: "Naini Lake Overflow",
    elevation_m: 2084,
    sensor_id: "IOT-UK-NAI01"
  },

  // Uttarakhand (Mussoorie)
  {
    id: "ward-uk-mussoorie",
    name: "Mussoorie Kempty & Barlowganj Ridge",
    district: "Dehradun",
    state: "Uttarakhand",
    coordinates: [30.4598, 78.0644],
    polygon: [
      [30.4700, 78.0500],
      [30.4720, 78.0800],
      [30.4450, 78.0850],
      [30.4420, 78.0550]
    ],
    rainfall_mm_hr: 33.0,
    rainfall_24h_mm: 120.0,
    soil_moisture_pct: 81,
    water_level_m: 3.40,
    danger_level_m: 4.90,
    rate_of_rise_m_hr: 0.22,
    slope_tilt_deg: 31.0,
    slope_risk: "HIGH",
    historical_flood_risk: "HIGH",
    river_name: "Kempty Falls Stream",
    elevation_m: 2005,
    sensor_id: "IOT-UK-MUS01"
  },

  // Uttarakhand (Dehradun)
  {
    id: "ward-uk-dehradun",
    name: "Dehradun Bindal & Rispana Basin",
    district: "Dehradun",
    state: "Uttarakhand",
    coordinates: [30.3165, 78.0322],
    polygon: [
      [30.3300, 78.0180],
      [30.3320, 78.0480],
      [30.3000, 78.0520],
      [30.2980, 78.0220]
    ],
    rainfall_mm_hr: 16.0,
    rainfall_24h_mm: 58.0,
    soil_moisture_pct: 62,
    water_level_m: 2.20,
    danger_level_m: 5.50,
    rate_of_rise_m_hr: 0.05,
    slope_tilt_deg: 14.0,
    slope_risk: "LOW",
    historical_flood_risk: "MODERATE",
    river_name: "Bindal River",
    elevation_m: 435,
    sensor_id: "IOT-UK-DDN01"
  }
];

/**
 * Multi-Factor Flash Flood Risk Computation
 * Formula:
 * RiskScore = 0.35 * (Rainfall Intensity & 24h Accumulation Index)
 *           + 0.25 * (Soil Moisture Saturation Index)
 *           + 0.25 * (River Level Proximity & Rate-of-Rise Surge Index)
 *           + 0.15 * (Slope Steepness & Ground Inclinometer Index)
 */
export function calculateIntegratedFloodRisk(metrics) {
  const rainIntensity = Number(metrics.rainfall_mm_hr || 0);
  const rain24h = Number(metrics.rainfall_24h_mm || 0);
  const soilMoisture = Number(metrics.soil_moisture_pct || 0);
  const waterLevel = Number(metrics.water_level_m || 0);
  const dangerLevel = Number(metrics.danger_level_m || 5.0);
  const rateOfRise = Number(metrics.rate_of_rise_m_hr || 0);
  const slopeTilt = Number(metrics.slope_tilt_deg || 15);

  // 1. Rainfall Factor (0 - 100)
  // Considers both instantaneous intensity and cumulative saturation
  const intensityFactor = Math.min(100, (rainIntensity / 60) * 100);
  const accumFactor = Math.min(100, (rain24h / 200) * 100);
  const rainfallScore = intensityFactor * 0.55 + accumFactor * 0.45;

  // 2. Soil Moisture Factor (0 - 100)
  // Superlinear risk above 75% saturation (soil pore pressure barrier)
  let soilScore = 0;
  if (soilMoisture < 50) {
    soilScore = (soilMoisture / 50) * 35;
  } else if (soilMoisture < 80) {
    soilScore = 35 + ((soilMoisture - 50) / 30) * 40;
  } else {
    soilScore = 75 + ((soilMoisture - 80) / 20) * 25;
  }

  // 3. River Level & Surge Factor (0 - 100)
  // Evaluates both proximity to Danger Mark and rate-of-rise velocity
  const levelRatio = Math.min(1.2, waterLevel / dangerLevel);
  const baseLevelScore = levelRatio * 70;
  const surgeScore = Math.min(30, Math.max(0, rateOfRise * 60));
  const riverScore = Math.min(100, baseLevelScore + surgeScore);

  // 4. Slope / Ground Movement Factor (0 - 100)
  // In hilly terrain, slope > 25° combined with tilt dramatically amplifies debris/flash flood velocity
  const slopeScore = Math.min(100, (slopeTilt / 45) * 100);

  // Composite Weighted Risk Score (0 - 100)
  let compositeScore = (
    rainfallScore * 0.35 +
    soilScore * 0.25 +
    riverScore * 0.25 +
    slopeScore * 0.15
  );

  // Severe surge acceleration penalty
  if (rateOfRise >= 0.40 && soilMoisture >= 85) {
    compositeScore = Math.min(100, compositeScore * 1.15);
  }

  const finalScore = Math.round(Math.max(5, Math.min(100, compositeScore)));

  // Risk Classification
  let riskLevel = "LOW";
  let riskColor = "#10b981";
  let recommendedAction = "Standard vigilance; normal agricultural & baseline drainage monitoring.";

  if (finalScore >= 75) {
    riskLevel = "CRITICAL";
    riskColor = "#ef4444";
    recommendedAction = "EVACUATION ADVISORY: Immediate relocation of riverside & steep-slope settlements to designated emergency shelters. Activate zonal disaster relief units.";
  } else if (finalScore >= 50) {
    riskLevel = "HIGH";
    riskColor = "#f97316";
    recommendedAction = "PREPAREDNESS ALERT: Inspect flood barriers, verify spillway clearances, restrict vehicular traffic across culverts, and notify district emergency control desk.";
  } else if (finalScore >= 30) {
    riskLevel = "MODERATE";
    riskColor = "#f59e0b";
    recommendedAction = "ELEVATED WATCH: Continuous hydrometric telemetry monitoring; check drainage bottlenecks and alert local ward responders.";
  }

  return {
    risk_score: finalScore,
    risk_level: riskLevel,
    risk_color: riskColor,
    rainfall_score: Math.round(rainfallScore),
    soil_score: Math.round(soilScore),
    river_score: Math.round(riverScore),
    slope_score: Math.round(slopeScore),
    recommended_action: recommendedAction,
    is_rapid_rise: rateOfRise >= 0.30,
    is_soil_saturated: soilMoisture >= 85,
    is_extreme_rain: rainIntensity >= 35
  };
}

/**
 * Enrich village wards with computed live multi-factor risk scores
 */
export function getEnrichedVillageWards(customModifiers = {}) {
  return MOUNTAIN_VILLAGE_WARDS.map((ward) => {
    // Apply custom dynamic modifiers if live simulation is active
    const rainfallMod = customModifiers.rainfall_multiplier || 1.0;
    const soilMod = customModifiers.soil_multiplier || 1.0;
    const waterMod = customModifiers.water_multiplier || 1.0;
    const slopeMod = customModifiers.slope_multiplier || 1.0;

    const modifiedWard = {
      ...ward,
      rainfall_mm_hr: Number((ward.rainfall_mm_hr * rainfallMod).toFixed(1)),
      rainfall_24h_mm: Number((ward.rainfall_24h_mm * rainfallMod).toFixed(1)),
      soil_moisture_pct: Math.min(100, Math.round(ward.soil_moisture_pct * soilMod)),
      water_level_m: Number((ward.water_level_m * waterMod).toFixed(2)),
      rate_of_rise_m_hr: Number((ward.rate_of_rise_m_hr * waterMod).toFixed(2)),
      slope_tilt_deg: Number((ward.slope_tilt_deg * slopeMod).toFixed(1))
    };

    const riskAssessment = calculateIntegratedFloodRisk(modifiedWard);

    return {
      ...modifiedWard,
      risk_score: riskAssessment.risk_score,
      risk_level: riskAssessment.risk_level,
      risk_color: riskAssessment.risk_color,
      recommended_action: riskAssessment.recommended_action,
      factors: {
        rainfall_score: riskAssessment.rainfall_score,
        soil_score: riskAssessment.soil_score,
        river_score: riskAssessment.river_score,
        slope_score: riskAssessment.slope_score
      },
      flags: {
        is_rapid_rise: riskAssessment.is_rapid_rise,
        is_soil_saturated: riskAssessment.is_soil_saturated,
        is_extreme_rain: riskAssessment.is_extreme_rain
      }
    };
  });
}

/**
 * Generate 4 Real-time IoT Sensors with 12-point rolling trend buffer
 */
export function generateIoTSensorsState(activeWardId = "ward-nilgiris-pykara") {
  const wards = getEnrichedVillageWards();
  const ward = wards.find((w) => w.id === activeWardId) || wards[0];

  // 1. Rainfall Sensor
  const rainStatus = ward.rainfall_mm_hr >= 35 ? "CRITICAL" : ward.rainfall_mm_hr >= 15 ? "HIGH" : ward.rainfall_mm_hr >= 7.5 ? "WARNING" : "NORMAL";
  const rainTrend = Array.from({ length: 12 }, (_, i) => {
    const base = ward.rainfall_mm_hr * (0.6 + (i / 11) * 0.4);
    const noise = (Math.sin(i * 0.8) * 4);
    return Math.max(0, Number((base + noise).toFixed(1)));
  });

  // 2. Soil Moisture Sensor
  const soilStatus = ward.soil_moisture_pct >= 90 ? "CRITICAL" : ward.soil_moisture_pct >= 80 ? "HIGH" : ward.soil_moisture_pct >= 65 ? "WARNING" : "NORMAL";
  const soilTrend = Array.from({ length: 12 }, (_, i) => {
    const base = ward.soil_moisture_pct - (11 - i) * 1.8;
    return Math.min(100, Math.max(30, Math.round(base)));
  });

  // 3. River Water Level Sensor
  const waterStatus = ward.water_level_m >= ward.danger_level_m ? "CRITICAL" : ward.water_level_m >= (ward.danger_level_m - 0.7) ? "HIGH" : ward.water_level_m >= (ward.danger_level_m - 1.5) ? "WARNING" : "NORMAL";
  const waterTrend = Array.from({ length: 12 }, (_, i) => {
    const base = ward.water_level_m - (11 - i) * (ward.rate_of_rise_m_hr * 0.5);
    return Math.max(0.8, Number(base.toFixed(2)));
  });

  // 4. Slope Ground Movement Sensor
  const slopeStatus = ward.slope_tilt_deg >= 35 ? "CRITICAL" : ward.slope_tilt_deg >= 25 ? "HIGH" : ward.slope_tilt_deg >= 18 ? "WARNING" : "NORMAL";
  const slopeTrend = Array.from({ length: 12 }, (_, i) => {
    const base = ward.slope_tilt_deg - (11 - i) * 0.2;
    const jitter = (Math.cos(i * 1.2) * 0.3);
    return Math.max(5, Number((base + jitter).toFixed(1)));
  });

  return [
    {
      sensor_id: `IOT-RN-${ward.id.split("-")[2]?.toUpperCase() || "042"}`,
      type: "RAINFALL",
      name: "Optical Pluviometer & Rainfall Intensity Sensor",
      icon: "CloudRain",
      value: ward.rainfall_mm_hr,
      unit: "mm/hr",
      status: rainStatus,
      status_color: rainStatus === "CRITICAL" ? "#ef4444" : rainStatus === "HIGH" ? "#f97316" : rainStatus === "WARNING" ? "#f59e0b" : "#10b981",
      location: `${ward.name}, ${ward.district}`,
      battery_pct: 96,
      signal_dbm: -64,
      is_online: true,
      last_updated: "Just now",
      trend_points: rainTrend,
      telemetry_source: "Live IoT Simulation Feed"
    },
    {
      sensor_id: `IOT-SM-${ward.id.split("-")[2]?.toUpperCase() || "109"}`,
      type: "SOIL_MOISTURE",
      name: "TDR Deep-Soil Moisture & Saturation Probe",
      icon: "Droplets",
      value: ward.soil_moisture_pct,
      unit: "% Saturation",
      status: soilStatus,
      status_color: soilStatus === "CRITICAL" ? "#ef4444" : soilStatus === "HIGH" ? "#f97316" : soilStatus === "WARNING" ? "#f59e0b" : "#10b981",
      location: `${ward.name} Ridge Sector`,
      battery_pct: 92,
      signal_dbm: -72,
      is_online: true,
      last_updated: "Just now",
      trend_points: soilTrend,
      telemetry_source: "Live IoT Simulation Feed"
    },
    {
      sensor_id: `IOT-WL-${ward.id.split("-")[2]?.toUpperCase() || "008"}`,
      type: "WATER_LEVEL",
      name: "Radar Stream-Stage & Velocity Gauge",
      icon: "Waves",
      value: ward.water_level_m,
      unit: "meters",
      status: waterStatus,
      status_color: waterStatus === "CRITICAL" ? "#ef4444" : waterStatus === "HIGH" ? "#f97316" : waterStatus === "WARNING" ? "#f59e0b" : "#10b981",
      location: `${ward.river_name} Gauging Post`,
      battery_pct: 98,
      signal_dbm: -58,
      is_online: true,
      last_updated: "Just now",
      trend_points: waterTrend,
      danger_threshold_m: ward.danger_level_m,
      rate_of_rise_m_hr: ward.rate_of_rise_m_hr,
      telemetry_source: "Live IoT Simulation Feed"
    },
    {
      sensor_id: `IOT-TL-${ward.id.split("-")[2]?.toUpperCase() || "023"}`,
      type: "SLOPE_TILT",
      name: "MEMS Inclinometer & Ground Displacement Sensor",
      icon: "Mountain",
      value: ward.slope_tilt_deg,
      unit: "° Tilt Angle",
      status: slopeStatus,
      status_color: slopeStatus === "CRITICAL" ? "#ef4444" : slopeStatus === "HIGH" ? "#f97316" : slopeStatus === "WARNING" ? "#f59e0b" : "#10b981",
      location: `${ward.name} Upper Scarp`,
      battery_pct: 88,
      signal_dbm: -78,
      is_online: true,
      last_updated: "Just now",
      trend_points: slopeTrend,
      telemetry_source: "Live IoT Simulation Feed"
    }
  ];
}
