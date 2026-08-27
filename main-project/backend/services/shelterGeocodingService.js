/**
 * shelterGeocodingService.js
 *
 * Purpose:
 * ------------------------------------------------------------
 * Handles spatial resolution and candidate validation for official
 * evacuation shelters using Mappls Geocoding API.
 *
 * STRICT RULES:
 * - Never guess coordinates.
 * - Distinguish spatial precision (POI/BUILDING vs VILLAGE/LOCALITY).
 * - Only set routing_eligible = true for FACILITY/POI level matches.
 * - Village-level matches receive routing_eligible = false.
 * - Cache all geocoding results in geocoding-cache.json.
 * ------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const CACHE_FILE_PATH = path.join(__dirname, "../data/official-shelters/geocoding-cache.json");

// Helper to load geocoding cache
function loadGeocodingCache() {
  if (!fs.existsSync(CACHE_FILE_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[ShelterGeocodingService] Error loading cache:", err.message);
    return {};
  }
}

// Helper to save geocoding cache
function saveGeocodingCache(cacheData) {
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), "utf-8");
  } catch (err) {
    console.error("[ShelterGeocodingService] Error saving cache:", err.message);
  }
}

/**
 * Normalizes strings for similarity comparison
 */
function cleanStr(str = "") {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Classifies spatial precision based on Mappls geocodeLevel
 */
function classifySpatialPrecision(geocodeLevel = "") {
  const lvl = String(geocodeLevel).toLowerCase();
  if (lvl === "poi" || lvl === "building" || lvl === "housenumber" || lvl === "establishment") {
    return "POI_LEVEL";
  }
  if (lvl === "street" || lvl === "subsublocality" || lvl === "sublocality") {
    return "STREET_LEVEL";
  }
  if (lvl === "locality" || lvl === "subdistrict") {
    return "LOCALITY_LEVEL";
  }
  if (lvl === "village") {
    return "VILLAGE_LEVEL";
  }
  if (lvl === "city" || lvl === "district" || lvl === "state") {
    return "ADMIN_LEVEL";
  }
  return "UNKNOWN";
}

/**
 * Evaluates candidate result and assigns confidence & spatial precision
 */
function evaluateGeocodingResult(shelter, copResults) {
  if (!copResults) {
    return {
      geocoding_status: "UNRESOLVED",
      geocoding_confidence: "UNRESOLVED",
      spatial_precision: "UNKNOWN",
      routing_eligible: false,
      latitude: null,
      longitude: null
    };
  }

  const state = copResults.state || "";
  const district = copResults.district || "";
  const subDistrict = copResults.subDistrict || copResults.city || "";
  const village = copResults.village || copResults.locality || "";
  const poiName = copResults.poi || copResults.houseName || "";
  const geocodeLevel = copResults.geocodeLevel || "";
  const confScore = Number(copResults.confidenceScore) || 0;

  // 1. Strict Geographic Boundaries Check (Tamil Nadu & The Nilgiris)
  const isStateMatch = cleanStr(state).includes("tamil nadu");
  const isDistrictMatch = cleanStr(district).includes("nilgiris");

  if (!isStateMatch || !isDistrictMatch) {
    return {
      geocoding_status: "REJECTED",
      geocoding_confidence: "REJECTED",
      spatial_precision: "UNKNOWN",
      routing_eligible: false,
      latitude: null,
      longitude: null,
      reason: "Out-of-bounds geographic match (State/District mismatch)"
    };
  }

  // 2. Determine Spatial Precision
  const spatialPrecision = classifySpatialPrecision(geocodeLevel);

  // 3. Compare Name / Locality Similarity
  const cleanOfficialName = cleanStr(shelter.name);
  const cleanPoiName = cleanStr(poiName);
  const cleanLocalPanchayat = cleanStr(shelter.panchayat_or_municipality || shelter.taluk_or_block);

  let isPoiMatch = false;
  if (cleanPoiName && (cleanOfficialName.includes(cleanPoiName) || cleanPoiName.includes(cleanOfficialName))) {
    isPoiMatch = true;
  }

  // 4. Calculate Confidence Level
  let confidenceLevel = "LOW_CONFIDENCE";
  if (spatialPrecision === "POI_LEVEL" && isPoiMatch) {
    confidenceLevel = "HIGH_CONFIDENCE";
  } else if (spatialPrecision === "POI_LEVEL" || (spatialPrecision === "STREET_LEVEL" && confScore >= 0.5)) {
    confidenceLevel = "MODERATE_CONFIDENCE";
  } else if (spatialPrecision === "VILLAGE_LEVEL" || spatialPrecision === "LOCALITY_LEVEL") {
    confidenceLevel = "MODERATE_CONFIDENCE";
  } else {
    confidenceLevel = "LOW_CONFIDENCE";
  }

  // 5. Determine Routing Eligibility
  // CRITICAL RULE: VILLAGE_LEVEL or LOCALITY_LEVEL matches are NOT routing_eligible!
  const isPrecise = spatialPrecision === "POI_LEVEL" || spatialPrecision === "STREET_LEVEL";
  const isTrustedConfidence = confidenceLevel === "HIGH_CONFIDENCE" || confidenceLevel === "MODERATE_CONFIDENCE";

  const routingEligible = isPrecise && isTrustedConfidence;

  const status = routingEligible ? "RESOLVED" : (spatialPrecision === "VILLAGE_LEVEL" ? "PARTIAL" : "AMBIGUOUS");

  return {
    geocoding_status: status,
    geocoding_confidence: confidenceLevel,
    spatial_precision: spatialPrecision,
    routing_eligible: routingEligible,
    matched_name: poiName || copResults.formattedAddress || null,
    matched_address: copResults.formattedAddress || null,
    matched_locality: village || subDistrict || null,
    matched_district: district,
    matched_state: state,
    eloc: copResults.eLoc || null,
    confidence_score: confScore,
    latitude: copResults.latitude ? Number(copResults.latitude) : null,
    longitude: copResults.longitude ? Number(copResults.longitude) : null
  };
}

/**
 * Geocodes an official shelter using Mappls Geocoding API
 */
async function geocodeOfficialShelter(shelter, forceRefresh = false) {
  const cache = loadGeocodingCache();
  if (!forceRefresh && cache[shelter.id]) {
    return { ...cache[shelter.id], from_cache: true };
  }

  const staticKey = process.env.MAPPLS_STATIC_KEY;
  if (!staticKey) {
    throw new Error("MAPPLS_STATIC_KEY is missing in backend configuration");
  }

  // Construct contextual search query
  const queryAddress = `${shelter.name}, ${shelter.panchayat_or_municipality || ''}, ${shelter.taluk_or_block || ''}, Nilgiris District, Tamil Nadu, India`.replace(/\s+/g, ' ').trim();

  const params = new URLSearchParams({
    address: queryAddress,
    access_token: staticKey
  });

  const url = `https://search.mappls.com/search/address/geocode?${params.toString()}`;

  let evalResult = null;
  let apiSuccess = false;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "SIH-Flood-Evacuation-System/1.0" }
    });

    if (res.ok) {
      apiSuccess = true;
      const data = await res.json();
      evalResult = evaluateGeocodingResult(shelter, data.copResults);
    } else {
      console.warn(`[Geocoding] HTTP ${res.status} for shelter ${shelter.id}`);
      evalResult = {
        geocoding_status: "UNRESOLVED",
        geocoding_confidence: "UNRESOLVED",
        spatial_precision: "UNKNOWN",
        routing_eligible: false,
        latitude: null,
        longitude: null,
        error: `HTTP ${res.status}`
      };
    }
  } catch (err) {
    console.error(`[Geocoding] Fetch exception for ${shelter.id}:`, err.message);
    evalResult = {
      geocoding_status: "UNRESOLVED",
      geocoding_confidence: "UNRESOLVED",
      spatial_precision: "UNKNOWN",
      routing_eligible: false,
      latitude: null,
      longitude: null,
      error: err.message
    };
  }

  const cacheEntry = {
    shelter_id: shelter.id,
    official_name: shelter.name,
    query: queryAddress,
    latitude: evalResult.latitude,
    longitude: evalResult.longitude,
    geocoding_status: evalResult.geocoding_status,
    geocoding_source: "MAPPLS",
    geocoding_confidence: evalResult.geocoding_confidence,
    spatial_precision: evalResult.spatial_precision,
    routing_eligible: evalResult.routing_eligible,
    matched_name: evalResult.matched_name,
    matched_address: evalResult.matched_address,
    matched_locality: evalResult.matched_locality,
    matched_district: evalResult.matched_district,
    matched_state: evalResult.matched_state,
    eloc: evalResult.eloc,
    confidence_score: evalResult.confidence_score,
    geocoded_at: new Date().toISOString()
  };

  cache[shelter.id] = cacheEntry;
  saveGeocodingCache(cache);

  return { ...cacheEntry, from_cache: false, api_success: apiSuccess };
}

/**
 * Geocodes a batch of shelters with rate-limiting delay
 */
async function geocodeShelterBatch(shelters = [], batchSize = 5, delayMs = 600) {
  const results = [];
  for (let i = 0; i < shelters.length; i += batchSize) {
    const batch = shelters.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((s) => geocodeOfficialShelter(s))
    );
    results.push(...batchResults);
    if (i + batchSize < shelters.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

module.exports = {
  geocodeOfficialShelter,
  geocodeShelterBatch,
  loadGeocodingCache,
  evaluateGeocodingResult
};
