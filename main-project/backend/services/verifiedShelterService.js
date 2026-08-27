/**
 * verifiedShelterService.js
 *
 * Purpose:
 * ------------------------------------------------------------
 * Handles evacuation shelters / safe destinations and keeps
 * OFFICIAL VERIFIED shelters separate from UNVERIFIED facilities.
 *
 * IMPORTANT:
 * - Never mark a hospital/school/facility as an official shelter
 *   unless an authoritative source explicitly identifies it.
 * - Never fabricate shelter verification.
 * - If no official shelter source is connected, return that fact.
 * ------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ============================================================
// 1. VERIFICATION STATUS
// ============================================================

const VERIFICATION_STATUS = {
    VERIFIED_OFFICIAL: "VERIFIED_OFFICIAL",
    VERIFIED_FACILITY: "VERIFIED_FACILITY",
    UNVERIFIED: "UNVERIFIED",
};

// ============================================================
// 2. DESTINATION TYPES
// ============================================================

const DESTINATION_TYPES = {
    OFFICIAL_SHELTER: "OFFICIAL_SHELTER",
    RELIEF_CAMP: "RELIEF_CAMP",
    GOVERNMENT_HOSPITAL: "GOVERNMENT_HOSPITAL",
    HOSPITAL: "HOSPITAL",
    SCHOOL: "SCHOOL",
    COMMUNITY_HALL: "COMMUNITY_HALL",
    EMERGENCY_FACILITY: "EMERGENCY_FACILITY",
    POTENTIAL_SAFE_FACILITY: "POTENTIAL_SAFE_FACILITY",
};

const OFFICIAL_SHELTER_API_URL = process.env.OFFICIAL_SHELTER_API_URL || null;

// ============================================================
// 4. HELPER — VALIDATE COORDINATES
// ============================================================

function isValidCoordinate(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    return (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
    );
}

// ============================================================
// 5. HELPER — HAVERSINE DISTANCE
// ============================================================

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRadians = (degree) => (degree * Math.PI) / 180;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// ============================================================
// 6. NORMALIZE SHELTER OBJECT
// ============================================================

function normalizeShelter(raw = {}) {
    const latitude = raw.latitude !== null && raw.latitude !== undefined ? Number(raw.latitude) : null;
    const longitude = raw.longitude !== null && raw.longitude !== undefined ? Number(raw.longitude) : null;

    return {
        id: raw.id || `shelter-${latitude || "loc"}-${longitude || "unknown"}`,
        name: raw.name || "Unnamed Facility",
        type: raw.type || DESTINATION_TYPES.POTENTIAL_SAFE_FACILITY,
        latitude: isValidCoordinate(latitude, longitude) ? latitude : null,
        longitude: isValidCoordinate(latitude, longitude) ? longitude : null,
        district: raw.district || null,
        state: raw.state || null,
        country: raw.country || "India",
        panchayat_or_municipality: raw.panchayat_or_municipality || null,
        taluk_or_block: raw.taluk_or_block || null,
        verification_status: raw.verification_status || VERIFICATION_STATUS.UNVERIFIED,
        official_designation: raw.official_designation || false,
        authority: raw.authority || null,
        source: raw.source || "UNKNOWN",
        source_document: raw.source_document || null,
        source_url: raw.source_url || null,
        last_verified: raw.last_verified || null,
        contact: raw.contact || null,
        capacity: raw.capacity !== undefined && raw.capacity !== null ? Number(raw.capacity) : null,
        elevation_m: raw.elevation_m ?? null,
        flood_risk: raw.flood_risk || "NOT_EVALUATED",
        landslide_risk: raw.landslide_risk || "NOT_EVALUATED",
        destination_safety_score: raw.destination_safety_score ?? null,
        distance_from_user_km: raw.distance_from_user_km ?? null,
        geocoding_status: raw.geocoding_status || (isValidCoordinate(latitude, longitude) ? "VERIFIED" : "UNRESOLVED"),
        geocoding_source: raw.geocoding_source || null,
        matched_address: raw.matched_address || null,
        geocoding_confidence: raw.geocoding_confidence || null
    };
}

// ============================================================
// 7. VALIDATE OFFICIAL SHELTER
// ============================================================

function validateOfficialShelter(shelter) {
    if (!shelter) return false;
    if (!shelter.name) return false;

    if (
        shelter.verification_status === VERIFICATION_STATUS.VERIFIED_OFFICIAL &&
        shelter.source &&
        shelter.source !== "UNKNOWN" &&
        shelter.authority
    ) {
        return true;
    }

    return false;
}

// ============================================================
// 8. LOAD LOCAL OFFICIAL SHELTER DATASETS
// ============================================================

let cachedOfficialShelters = null;

function loadLocalOfficialShelterDatasets() {
    if (cachedOfficialShelters) return cachedOfficialShelters;

    const officialDir = path.join(__dirname, "../data/official-shelters");
    const cachePath = path.join(officialDir, "geocoding-cache.json");
    let geocodingCache = {};

    if (fs.existsSync(cachePath)) {
        try {
            geocodingCache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
        } catch (err) {
            console.error(`[VerifiedShelterService] Error reading geocoding cache:`, err.message);
        }
    }

    const loadedShelters = [];

    if (fs.existsSync(officialDir)) {
        const files = fs.readdirSync(officialDir);
        for (const file of files) {
            if (file.endsWith(".json") && file !== "geocoding-cache.json") {
                try {
                    const filePath = path.join(officialDir, file);
                    const fileContent = fs.readFileSync(filePath, "utf-8");
                    const parsedData = JSON.parse(fileContent);
                    const rawList = parsedData.shelters || [];
                    for (const s of rawList) {
                        // Merge geocoding cache if present for this shelter ID
                        const cached = geocodingCache[s.id];
                        let shelterObj = { ...s };
                        if (cached) {
                            shelterObj.latitude = cached.latitude ?? s.latitude;
                            shelterObj.longitude = cached.longitude ?? s.longitude;
                            shelterObj.geocoding_status = cached.geocoding_status || s.geocoding_status;
                            shelterObj.geocoding_confidence = cached.geocoding_confidence || s.geocoding_confidence;
                            shelterObj.spatial_precision = cached.spatial_precision || s.spatial_precision;
                            shelterObj.routing_eligible = cached.routing_eligible ?? false;
                            shelterObj.geocoding_source = cached.geocoding_source || s.geocoding_source;
                            shelterObj.matched_address = cached.matched_address || s.matched_address;
                        }

                        const normalized = normalizeShelter(shelterObj);
                        // Attach routing_eligible property
                        normalized.routing_eligible = shelterObj.routing_eligible ?? false;

                        if (validateOfficialShelter(normalized)) {
                            // STRICT RULE: Only pass to candidate routing if routing_eligible === true AND has valid coordinates
                            if (normalized.routing_eligible && isValidCoordinate(normalized.latitude, normalized.longitude)) {
                                loadedShelters.push(normalized);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`[VerifiedShelterService] Error reading ${file}:`, err.message);
                }
            }
        }
    }

    cachedOfficialShelters = loadedShelters;
    return loadedShelters;
}

// ============================================================
// 9. FETCH OFFICIAL SHELTERS (LOCAL JSON + OPTIONAL REMOTE API)
// ============================================================

async function fetchOfficialShelters({ latitude, longitude, district, state }) {
    const localShelters = loadLocalOfficialShelterDatasets();
    let remoteShelters = [];
    let remoteStatus = "LOCAL_DATASET_ONLY";
    let remoteMessage = "Official local government shelter datasets loaded.";

    if (OFFICIAL_SHELTER_API_URL) {
        try {
            const response = await axios.get(OFFICIAL_SHELTER_API_URL, {
                params: { latitude, longitude, district, state },
                timeout: 10000
            });
            const rawShelters = Array.isArray(response.data) ? response.data : response.data?.shelters || [];
            remoteShelters = rawShelters.map(normalizeShelter).filter(validateOfficialShelter);
            remoteStatus = "LIVE_OFFICIAL_API";
            remoteMessage = "Official shelter API successfully queried.";
        } catch (error) {
            console.error("[VerifiedShelterService] Official shelter API request failed:", error.message);
            remoteStatus = "ERROR";
            remoteMessage = "Official shelter API could not be reached. Used local official dataset.";
        }
    }

    const allOfficial = [...localShelters, ...remoteShelters];

    return {
        status: allOfficial.length > 0 ? "AVAILABLE" : "UNAVAILABLE",
        source: "Nilgiris District Administration (District Disaster Management Plan 2026)",
        message: remoteMessage,
        shelters: allOfficial
    };
}

// ============================================================
// 10. NORMALIZE EXISTING POTENTIAL FACILITIES
// ============================================================

function normalizePotentialFacilities(facilities = []) {
    if (!Array.isArray(facilities)) return [];

    return facilities
        .map((facility) => {
            return normalizeShelter({
                ...facility,
                type: facility.type || DESTINATION_TYPES.POTENTIAL_SAFE_FACILITY,
                verification_status: VERIFICATION_STATUS.UNVERIFIED,
                official_designation: false,
                source: facility.source || "LOCAL_FACILITY_DIRECTORY",
                source_url: facility.source_url || null
            });
        })
        .filter((facility) => isValidCoordinate(facility.latitude, facility.longitude));
}

// ============================================================
// 11. ADD DISTANCE FROM USER
// ============================================================

function attachDistances(shelters, userLatitude, userLongitude) {
    return shelters.map((shelter) => {
        if (!isValidCoordinate(shelter.latitude, shelter.longitude)) {
            return shelter;
        }

        const distance = calculateDistanceKm(
            Number(userLatitude),
            Number(userLongitude),
            Number(shelter.latitude),
            Number(shelter.longitude)
        );

        return {
            ...shelter,
            distance_from_user_km: Number(distance.toFixed(2))
        };
    });
}

// ============================================================
// 12. REMOVE DUPLICATE DESTINATIONS
// ============================================================

function removeDuplicateShelters(shelters = []) {
    const unique = new Map();

    for (const shelter of shelters) {
        const key = [
            String(shelter.name || "").trim().toLowerCase(),
            shelter.latitude ? Number(shelter.latitude).toFixed(4) : "null",
            shelter.longitude ? Number(shelter.longitude).toFixed(4) : "null"
        ].join("|");

        if (!unique.has(key)) {
            unique.set(key, shelter);
            continue;
        }

        const existing = unique.get(key);
        const priority = {
            VERIFIED_OFFICIAL: 3,
            VERIFIED_FACILITY: 2,
            UNVERIFIED: 1
        };

        const existingPriority = priority[existing.verification_status] || 0;
        const newPriority = priority[shelter.verification_status] || 0;

        if (newPriority > existingPriority) {
            unique.set(key, shelter);
        }
    }

    return Array.from(unique.values());
}

// ============================================================
// 13. SORT DESTINATIONS
// ============================================================

function sortShelters(shelters = []) {
    const verificationPriority = {
        VERIFIED_OFFICIAL: 3,
        VERIFIED_FACILITY: 2,
        UNVERIFIED: 1
    };

    return [...shelters].sort((a, b) => {
        const verificationDifference =
            (verificationPriority[b.verification_status] || 0) -
            (verificationPriority[a.verification_status] || 0);

        if (verificationDifference !== 0) return verificationDifference;

        return (a.distance_from_user_km ?? Infinity) - (b.distance_from_user_km ?? Infinity);
    });
}

// ============================================================
// 14. MAIN FUNCTION
// ============================================================

async function getVerifiedShelters({
    latitude,
    longitude,
    district = null,
    state = null,
    potentialFacilities = [],
    radiusKm = 25
}) {
    if (!isValidCoordinate(latitude, longitude)) {
        return {
            success: false,
            official_source_status: "INVALID_LOCATION",
            official_shelters_count: 0,
            potential_facilities_count: 0,
            shelters: [],
            message: "Invalid latitude or longitude supplied."
        };
    }

    const officialResult = await fetchOfficialShelters({
        latitude,
        longitude,
        district,
        state
    });

    const potential = normalizePotentialFacilities(potentialFacilities);
    let combined = [...officialResult.shelters, ...potential];

    combined = attachDistances(combined, latitude, longitude);

    // Only keep candidate destinations that have valid coordinates within radius
    combined = combined.filter((shelter) => {
        if (!isValidCoordinate(shelter.latitude, shelter.longitude)) return false;
        if (shelter.distance_from_user_km === null) return false;
        return shelter.distance_from_user_km <= radiusKm;
    });

    combined = removeDuplicateShelters(combined);
    combined = sortShelters(combined);

    const officialCount = combined.filter((s) => s.verification_status === VERIFICATION_STATUS.VERIFIED_OFFICIAL).length;
    const potentialCount = combined.filter((s) => s.verification_status === VERIFICATION_STATUS.UNVERIFIED).length;

    return {
        success: true,
        query: {
            latitude: Number(latitude),
            longitude: Number(longitude),
            district,
            state,
            radius_km: radiusKm
        },
        official_source_status: officialResult.status,
        official_source_message: officialResult.message,
        official_shelters_count: officialCount,
        potential_facilities_count: potentialCount,
        total_candidates: combined.length,
        shelters: combined,
        generated_at: new Date().toISOString()
    };
}

// ============================================================
// 15. EXPORTS
// ============================================================

module.exports = {
    getVerifiedShelters,
    fetchOfficialShelters,
    loadLocalOfficialShelterDatasets,
    normalizeShelter,
    normalizePotentialFacilities,
    validateOfficialShelter,
    calculateDistanceKm,
    isValidCoordinate,

    VERIFICATION_STATUS,
    DESTINATION_TYPES
};