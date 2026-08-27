const { buildFusedRecord } = require("../fusionService");
const { getTerrain } = require("./terrainService");
const { getVerifiedShelters } = require("./verifiedShelterService");

// Fallback monitored emergency facilities directory for hilly regions
const MONITORED_POTENTIAL_FACILITIES = [
  // Coonoor
  {
    id: "coonoor_govt_hosp",
    name: "Coonoor Government Lawley Hospital",
    type: "GOVERNMENT_HOSPITAL",
    latitude: 11.3556,
    longitude: 76.7960,
    source: "Verified Emergency Directory"
  },
  {
    id: "coonoor_st_joseph",
    name: "St. Joseph's Boys Higher Secondary School (Elevated Grounds)",
    type: "SCHOOL",
    latitude: 11.3620,
    longitude: 76.7912,
    source: "District Disaster Directory"
  },
  {
    id: "coonoor_town_hall",
    name: "Coonoor Municipality Community Centre",
    type: "COMMUNITY_HALL",
    latitude: 11.3490,
    longitude: 76.7985,
    source: "District Disaster Directory"
  },
  // Ooty
  {
    id: "ooty_govt_hosp",
    name: "Ooty District Headquarters Hospital",
    type: "GOVERNMENT_HOSPITAL",
    latitude: 11.4125,
    longitude: 76.7031,
    source: "Verified Emergency Directory"
  },
  {
    id: "ooty_breeks",
    name: "Breeks Memorial Higher Secondary School Hall",
    type: "SCHOOL",
    latitude: 11.4150,
    longitude: 76.7080,
    source: "Nilgiris Administration Directory"
  },
  // Kodaikanal
  {
    id: "kodai_govt_hosp",
    name: "Kodaikanal Government Hospital",
    type: "GOVERNMENT_HOSPITAL",
    latitude: 10.2355,
    longitude: 77.4880,
    source: "Verified Emergency Directory"
  },
  {
    id: "kodai_st_xaviers",
    name: "St. Xavier's High School Relief Centre",
    type: "SCHOOL",
    latitude: 10.2420,
    longitude: 77.4930,
    source: "Dindigul Disaster Management Directory"
  },
  // Munnar
  {
    id: "munnar_tata_hosp",
    name: "Tata General Hospital Munnar",
    type: "HOSPITAL",
    latitude: 10.0895,
    longitude: 77.0620,
    source: "Verified Emergency Directory"
  },
  {
    id: "munnar_govt_vocal",
    name: "Munnar Panchayat Community Hall (High Ground)",
    type: "COMMUNITY_HALL",
    latitude: 10.0940,
    longitude: 77.0650,
    source: "Idukki District Directory"
  },
  // Wayanad
  {
    id: "wayanad_med_college",
    name: "Wayanad Government Medical College",
    type: "GOVERNMENT_HOSPITAL",
    latitude: 11.6890,
    longitude: 76.1380,
    source: "Verified Emergency Directory"
  },
  {
    id: "wayanad_st_marys",
    name: "St. Mary's Higher Secondary School Relief Camp",
    type: "SCHOOL",
    latitude: 11.6920,
    longitude: 76.1410,
    source: "Wayanad DDMA Directory"
  },
  // Nainital
  {
    id: "nainital_bd_hosp",
    name: "BD Pandey District Hospital",
    type: "GOVERNMENT_HOSPITAL",
    latitude: 29.3945,
    longitude: 79.4560,
    source: "Verified Emergency Directory"
  },
  {
    id: "nainital_crst",
    name: "CRST Inter College Shelter Grounds",
    type: "SCHOOL",
    latitude: 29.3980,
    longitude: 79.4590,
    source: "Uttarakhand SDMA Directory"
  },
  // Mussoorie
  {
    id: "mussoorie_civil_hosp",
    name: "St. Mary's Civil Hospital Mussoorie",
    type: "GOVERNMENT_HOSPITAL",
    latitude: 30.4610,
    longitude: 78.0670,
    source: "Verified Emergency Directory"
  },
  // Dehradun
  {
    id: "dehradun_doon_hosp",
    name: "Doon Medical College Hospital",
    type: "GOVERNMENT_HOSPITAL",
    latitude: 30.3190,
    longitude: 78.0350,
    source: "Verified Emergency Directory"
  }
];

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// In-memory cache for destination hazard evaluations to protect API quota
const destHazardCache = new Map();

/**
 * Dynamically evaluates environmental hazards for a specific destination coordinate.
 */
async function evaluateDestinationHazards(latitude, longitude) {
  const cacheKey = `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;
  if (destHazardCache.has(cacheKey)) {
    return destHazardCache.get(cacheKey);
  }

  let fusedRecord = null;
  let terrainData = null;
  let floodProbability = null;
  let floodRisk = "UNKNOWN";

  const penalties = {
    flood_penalty: 0,
    landslide_penalty: 0,
    rainfall_penalty: 0,
    elevation_penalty: 0
  };

  try {
    fusedRecord = await buildFusedRecord({
      latitude,
      longitude,
      name: "Destination Facility",
      state: "Tamil Nadu",
      country: "India"
    });
  } catch (e) {
    console.warn("Destination fused record evaluation warning:", e.message);
  }

  try {
    const terrainPromise = getTerrain(latitude, longitude);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 800));
    terrainData = await Promise.race([terrainPromise, timeoutPromise]);
  } catch (e) {
    console.warn("Destination terrain lookup warning:", e.message);
  }

  // ML Flood Prediction
  if (fusedRecord) {
    try {
      const mlUrl = process.env.ML_API_URL || "http://127.0.0.1:8000/predict";
      const mlRes = await fetch(mlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rain_1h_mm: fusedRecord.rainfall?.rain_1h_mm || 0,
          rain_3h_mm: fusedRecord.rainfall?.rain_3h_mm || 0,
          rain_6h_mm: fusedRecord.rainfall?.rain_6h_mm || 0,
          rain_12h_mm: fusedRecord.rainfall?.rain_12h_mm || 0,
          rain_24h_mm: fusedRecord.rainfall?.rain_24h_mm || 0,
          temperature_c: fusedRecord.weather?.temperature_c || 20,
          humidity_percent: fusedRecord.weather?.humidity_percent || 70,
          soil_moisture_m3m3: fusedRecord.soil_moisture?.value_m3_m3 || 0.3,
          elevation_m: terrainData?.elevation_m || fusedRecord.terrain?.elevation_m || 1000
        })
      });

      if (mlRes.ok) {
        const mlData = await mlRes.json();
        floodProbability = mlData.flood_probability_percent ?? null;
        floodRisk = mlData.risk_level || "UNKNOWN";
      }
    } catch (e) {
      floodProbability = null;
      floodRisk = "UNKNOWN";
    }
  }

  // Strict coverage accounting: ONLY count inputs that are non-null and valid!
  let validSourcesCount = 0;
  const totalRequiredSources = 7;

  if (fusedRecord?.weather && fusedRecord.weather.source && !fusedRecord.weather.source.includes("UNAVAILABLE")) validSourcesCount++;
  if (fusedRecord?.rainfall && fusedRecord.rainfall.rain_24h_mm != null) validSourcesCount++;
  if (fusedRecord?.satellite_rainfall && fusedRecord.satellite_rainfall.rain_1h_mm != null) validSourcesCount++;
  if (fusedRecord?.soil_moisture && fusedRecord.soil_moisture.value_m3_m3 != null) validSourcesCount++;
  if (terrainData?.elevation_m != null || fusedRecord?.terrain?.elevation_m != null) validSourcesCount++;
  if (fusedRecord?.landslide_history && fusedRecord.landslide_history.count_10km != null) validSourcesCount++;
  if (floodProbability !== null) validSourcesCount++;

  const dataCoveragePercent = Math.round((validSourcesCount / totalRequiredSources) * 100);

  let evalStatus = "EVALUATED";
  if (dataCoveragePercent === 100) evalStatus = "EVALUATED";
  else if (dataCoveragePercent > 0) evalStatus = "PARTIALLY_EVALUATED";
  else evalStatus = "UNAVAILABLE";

  let confidence = "HIGH";
  if (dataCoveragePercent < 50) confidence = "LOW";
  else if (dataCoveragePercent < 85) confidence = "MODERATE";

  // Penalties
  if (floodProbability !== null) {
    penalties.flood_penalty = Math.round(floodProbability * 0.30);
  }

  const landslideCount = fusedRecord?.landslide_history?.count_10km ?? null;
  const slopeDeg = terrainData?.slope_deg ?? fusedRecord?.terrain?.slope_deg ?? null;

  if (landslideCount !== null && landslideCount > 0) {
    penalties.landslide_penalty = Math.min(25, landslideCount * 5);
  }
  if (slopeDeg !== null && slopeDeg > 25) {
    penalties.landslide_penalty += 10;
  }

  const rain24h = fusedRecord?.rainfall?.rain_24h_mm ?? null;
  if (rain24h !== null && rain24h > 50) {
    penalties.rainfall_penalty = Math.min(20, Math.round(rain24h * 0.15));
  }

  const elev = terrainData?.elevation_m ?? fusedRecord?.terrain?.elevation_m ?? null;
  if (elev !== null && elev < 500) {
    penalties.elevation_penalty = 10;
  }

  const totalPenalties = penalties.flood_penalty + penalties.landslide_penalty + penalties.rainfall_penalty + penalties.elevation_penalty;
  
  let destScore = null;
  if (evalStatus !== "UNAVAILABLE") {
    destScore = Math.max(0, Math.min(100, 100 - totalPenalties));
  }

  const rainfallRisk = rain24h === null ? "UNKNOWN" : (rain24h > 100 ? "HIGH" : rain24h > 50 ? "MODERATE" : "LOW");
  const landslideRisk = (fusedRecord?.landslide_history && fusedRecord.landslide_history.count_10km != null)
    ? (landslideCount > 3 ? "HIGH" : landslideCount > 0 ? "MODERATE" : "LOW")
    : "UNKNOWN";

  const result = {
    evaluation_status: evalStatus,
    flood_probability: floodProbability,
    flood_risk: floodRisk,
    rainfall_risk: rainfallRisk,
    soil_moisture: fusedRecord?.soil_moisture?.value_m3_m3 ?? null,
    satellite_rainfall: fusedRecord?.satellite_rainfall?.rain_1h_mm ?? null,
    elevation_m: elev,
    slope_deg: slopeDeg,
    landslide_risk: landslideRisk,
    individual_penalties: penalties,
    destination_safety_score: destScore,
    destination_data_confidence: confidence,
    destination_data_coverage: dataCoveragePercent,
    confidence: confidence,
    sources: {
      open_meteo: (fusedRecord?.weather?.source && !fusedRecord.weather.source.includes("UNAVAILABLE")) ? "LIVE/NRT" : "UNAVAILABLE",
      nasa_gpm: (fusedRecord?.satellite_rainfall?.source && !fusedRecord.satellite_rainfall.source.includes("UNAVAILABLE")) ? "NRT" : "UNAVAILABLE",
      nasa_smap: (fusedRecord?.soil_moisture?.source && !fusedRecord.soil_moisture.source.includes("UNAVAILABLE")) ? "NRT" : "UNAVAILABLE",
      srtm_terrain: terrainData?.elevation_m != null ? "STATIC_GEOTIFF" : "UNAVAILABLE",
      gsi_landslide: fusedRecord?.landslide_history?.count_10km != null ? "HISTORICAL_INVENTORY" : "UNAVAILABLE",
      ml_prediction: floodProbability !== null ? "PREDICTED_FASTAPI" : "UNAVAILABLE"
    }
  };

  destHazardCache.set(cacheKey, result);
  return result;
}

/**
 * Finds and evaluates candidate safe evacuation destinations.
 */
async function getCandidateDestinations(userLat, userLon, maxDistanceKm = 25, locationDetails = {}) {
  try {
    const shelterResult = await getVerifiedShelters({
      latitude: userLat,
      longitude: userLon,
      district: locationDetails.district || null,
      state: locationDetails.state || null,
      potentialFacilities: MONITORED_POTENTIAL_FACILITIES,
      radiusKm: maxDistanceKm
    });

    const rawShelters = shelterResult.shelters || [];
    if (rawShelters.length === 0) return [];

    // Evaluate destination hazard suitability for candidates dynamically
    const evaluatedCandidates = await Promise.all(
      rawShelters.map(async (dest) => {
        const hazardEval = await evaluateDestinationHazards(dest.latitude, dest.longitude);

        let destRiskClass = "LOWER_RISK";
        if (hazardEval.destination_safety_score < 40) destRiskClass = "AVOID";
        else if (hazardEval.destination_safety_score < 60) destRiskClass = "HIGH_RISK";
        else if (hazardEval.destination_safety_score < 80) destRiskClass = "USE_CAUTION";

        const isOfficial = dest.verification_status === "VERIFIED_OFFICIAL";

        return {
          id: dest.id,
          name: dest.name,
          type: dest.type,
          verification_status: dest.verification_status,
          official_designation: dest.official_designation,
          authority: dest.authority || (isOfficial ? "Nilgiris District Administration" : null),
          source: dest.source || "UNKNOWN",
          source_document: dest.source_document || null,
          source_url: dest.source_url || null,
          last_verified: dest.last_verified || null,
          contact: dest.contact || null,
          capacity: dest.capacity || null,
          latitude: dest.latitude,
          longitude: dest.longitude,
          distance_from_user_km: dest.distance_from_user_km,
          distance_km: dest.distance_from_user_km,
          elevation_m: hazardEval.elevation_m,
          slope_deg: hazardEval.slope_deg,
          destination_safety_score: hazardEval.destination_safety_score,
          destination_data_confidence: hazardEval.destination_data_confidence,
          destination_data_coverage: hazardEval.destination_data_coverage,
          destination_risk_classification: destRiskClass,
          destination_hazards: {
            evaluation_status: hazardEval.evaluation_status,
            flood_risk: hazardEval.flood_risk,
            flood_probability_percent: hazardEval.flood_probability,
            rainfall_risk: hazardEval.rainfall_risk,
            soil_moisture: hazardEval.soil_moisture,
            satellite_rainfall: hazardEval.satellite_rainfall,
            landslide_risk: hazardEval.landslide_risk,
            elevation_m: hazardEval.elevation_m,
            slope_deg: hazardEval.slope_deg,
            individual_penalties: hazardEval.individual_penalties,
            data_confidence: hazardEval.destination_data_confidence,
            data_coverage_percent: hazardEval.destination_data_coverage,
            sources: hazardEval.sources
          },
          classification: isOfficial ? "Official Evacuation Shelter" : "Potential Safe Facility",
          shelter_verification_notice: isOfficial
            ? "OFFICIAL EVACUATION SHELTER (Nilgiris District Disaster Management Plan 2026)"
            : "Potential Safe Facility (UNVERIFIED — local directory item)."
        };
      })
    );

    // Rank: VERIFIED_OFFICIAL first, then Destination Safety Score, then Distance
    evaluatedCandidates.sort((a, b) => {
      const pA = a.verification_status === "VERIFIED_OFFICIAL" ? 2 : 1;
      const pB = b.verification_status === "VERIFIED_OFFICIAL" ? 2 : 1;
      if (pA !== pB) return pB - pA;
      if (b.destination_safety_score !== a.destination_safety_score) {
        return b.destination_safety_score - a.destination_safety_score;
      }
      return a.distance_km - b.distance_km;
    });

    return evaluatedCandidates;
  } catch (error) {
    console.error("Error discovering candidate destinations:", error);
    return [];
  }
}

module.exports = {
  getCandidateDestinations,
  evaluateDestinationHazards,
  calculateHaversineDistanceKm,
  MONITORED_POTENTIAL_FACILITIES
};

