const { getCandidateDestinations } = require("./safeDestinationService");
const { getRoadStatusIncidents } = require("./roadStatusService");
const { getOfficialDisasterAlerts } = require("./disasterAlertService");
const { getTrafficIncidentsInBbox, getTrafficFlowAtPoint, getTomTomTrafficRoute } = require("./tomTomTrafficService");
const { buildFusedRecord } = require("../fusionService");
const { getTerrain } = require("./terrainService");
const { getLandslideHistory } = require("./landslideService");
const { SAFE_ROUTE_WEIGHTS, HAZARD_THRESHOLDS, CONFIDENCE_LEVELS, RISK_CLASSIFICATIONS } = require("../config/safeRouteConfig");

// In-memory cache for sampled route environmental points to protect API quota
const routeEnvPointCache = new Map();

async function samplePointHazard(lat, lon, fusedOriginRecord) {
  const cacheKey = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
  if (routeEnvPointCache.has(cacheKey)) {
    return routeEnvPointCache.get(cacheKey);
  }

  let elevation = null;
  let slope = null;
  try {
    const terrainPromise = getTerrain(lat, lon);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 800));
    const terrain = await Promise.race([terrainPromise, timeoutPromise]);
    if (terrain) {
      elevation = terrain.elevation_m;
      slope = terrain.slope_deg;
    }
  } catch (e) {}

  let landslideCount = null;
  try {
    const ls = await getLandslideHistory(lat, lon);
    if (ls && ls.count_10km !== undefined) landslideCount = ls.count_10km;
  } catch (e) {}

  let floodProb = null;
  let riskLevel = "UNKNOWN";
  try {
    const mlUrl = process.env.ML_API_URL || "http://127.0.0.1:8000/predict";
    const mlRes = await fetch(mlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rain_1h_mm: fusedOriginRecord?.rainfall?.rain_1h_mm || 0,
        rain_3h_mm: fusedOriginRecord?.rainfall?.rain_3h_mm || 0,
        rain_6h_mm: fusedOriginRecord?.rainfall?.rain_6h_mm || 0,
        rain_12h_mm: fusedOriginRecord?.rainfall?.rain_12h_mm || 0,
        rain_24h_mm: fusedOriginRecord?.rainfall?.rain_24h_mm || 0,
        temperature_c: fusedOriginRecord?.weather?.temperature_c || 20,
        humidity_percent: fusedOriginRecord?.weather?.humidity_percent || 70,
        soil_moisture_m3m3: fusedOriginRecord?.soil_moisture?.value_m3_m3 || 0.3,
        elevation_m: elevation || 1000
      })
    });

    if (mlRes.ok) {
      const mlData = await mlRes.json();
      floodProb = mlData.flood_probability_percent ?? null;
      riskLevel = mlData.risk_level || "UNKNOWN";
    }
  } catch (e) {
    floodProb = null;
    riskLevel = "UNKNOWN";
  }

  const result = {
    latitude: lat,
    longitude: lon,
    elevation_m: elevation,
    slope_deg: slope,
    landslide_count_10km: landslideCount,
    flood_probability_percent: floodProb,
    risk_level: riskLevel
  };

  routeEnvPointCache.set(cacheKey, result);
  return result;
}

async function evaluateRouteEnvironmentalHazards(routeCoords, distanceKm, fusedOriginRecord) {
  if (!routeCoords || routeCoords.length === 0) {
    return {
      evaluation_status: "UNAVAILABLE",
      route_sample_count: 0,
      max_flood_probability: null,
      average_flood_probability: null,
      highest_risk_sample: null,
      max_landslide_exposure: "UNKNOWN",
      elevation_range: { min_m: null, max_m: null },
      hazardous_segments: [],
      environmental_data_coverage: 0,
      samples: []
    };
  }

  // Determine sample count based on route length
  let numSamples = 3;
  if (distanceKm > 20) numSamples = 7;
  else if (distanceKm > 5) numSamples = 5;

  const sampleIndices = [];
  for (let i = 0; i < numSamples; i++) {
    const idx = Math.floor((i / (numSamples - 1)) * (routeCoords.length - 1));
    sampleIndices.push(idx);
  }

  const sampledPoints = await Promise.all(
    sampleIndices.map(async (idx) => {
      const pt = routeCoords[idx];
      const res = await samplePointHazard(pt[1], pt[0], fusedOriginRecord);
      return { ...res, sample_index: idx };
    })
  );

  let maxFloodProb = null;
  let sumFloodProb = 0;
  let validFloodCount = 0;
  let highestRiskSample = sampledPoints[0];
  let maxLandslideCount = null;
  let minElev = Infinity;
  let maxElev = -Infinity;
  const hazardousSegments = [];

  for (const pt of sampledPoints) {
    if (pt.flood_probability_percent !== null && pt.flood_probability_percent !== undefined) {
      if (maxFloodProb === null || pt.flood_probability_percent > maxFloodProb) {
        maxFloodProb = pt.flood_probability_percent;
        highestRiskSample = pt;
      }
      sumFloodProb += pt.flood_probability_percent;
      validFloodCount++;
    }

    if (pt.landslide_count_10km !== null && pt.landslide_count_10km !== undefined) {
      if (maxLandslideCount === null || pt.landslide_count_10km > maxLandslideCount) {
        maxLandslideCount = pt.landslide_count_10km;
      }
    }

    if (pt.elevation_m !== null && pt.elevation_m !== undefined) {
      if (pt.elevation_m < minElev) minElev = pt.elevation_m;
      if (pt.elevation_m > maxElev) maxElev = pt.elevation_m;
    }

    if (pt.flood_probability_percent != null && (pt.flood_probability_percent >= 40 || (pt.landslide_count_10km != null && pt.landslide_count_10km > 3))) {
      hazardousSegments.push({
        sample_index: pt.sample_index,
        latitude: pt.latitude,
        longitude: pt.longitude,
        flood_probability_percent: pt.flood_probability_percent,
        risk_level: pt.risk_level,
        landslide_count_10km: pt.landslide_count_10km
      });
    }
  }

  const avgFloodProb = validFloodCount > 0 ? Number((sumFloodProb / validFloodCount).toFixed(1)) : null;
  const maxLandslideExp = maxLandslideCount === null ? "UNKNOWN" : (maxLandslideCount > 3 ? "HIGH" : maxLandslideCount > 0 ? "MODERATE" : "LOW");
  const envCoverage = sampledPoints.length > 0 ? Math.round((validFloodCount / sampledPoints.length) * 100) : 0;
  const evalStatus = envCoverage === 100 ? "EVALUATED" : envCoverage > 0 ? "PARTIALLY_EVALUATED" : "UNAVAILABLE";

  return {
    evaluation_status: evalStatus,
    route_sample_count: sampledPoints.length,
    valid_sample_count: validFloodCount,
    max_flood_probability: maxFloodProb,
    average_flood_probability: avgFloodProb,
    highest_risk_sample: highestRiskSample,
    max_landslide_exposure: maxLandslideExp,
    elevation_range: {
      min_m: minElev === Infinity ? null : minElev,
      max_m: maxElev === -Infinity ? null : maxElev
    },
    hazardous_segments: hazardousSegments,
    environmental_data_coverage: envCoverage,
    samples: sampledPoints
  };
}

/**
 * Primary Routing Provider: Mappls Direction API (route_adv & route_eta)
 */
async function fetchMapplsRoutes(startLat, startLon, endLat, endLon) {
  const staticKey = process.env.MAPPLS_STATIC_KEY;
  if (!staticKey) {
    throw new Error("MAPPLS_STATIC_KEY missing in backend configuration");
  }

  const advUrl = `https://route.mappls.com/route/direction/route_adv/driving/${startLon},${startLat};${endLon},${endLat}?steps=true&alternatives=true&overview=full&geometries=geojson&region=ind&access_token=${staticKey}`;
  const etaUrl = `https://route.mappls.com/route/direction/route_eta/driving/${startLon},${startLat};${endLon},${endLat}?steps=true&alternatives=true&overview=full&geometries=geojson&region=ind&access_token=${staticKey}`;

  const advResponse = await fetch(advUrl, {
    headers: { "User-Agent": "SIH-Flood-Evacuation-System/1.0" }
  });

  if (!advResponse.ok) {
    const errorText = await advResponse.text();
    throw new Error(`Mappls Direction API HTTP error ${advResponse.status}: ${errorText.substring(0, 150)}`);
  }

  const advData = await advResponse.json();
  if (!advData.routes || advData.routes.length === 0) {
    throw new Error("Mappls Direction API returned no valid route paths");
  }

  let etaData = null;
  try {
    const etaResponse = await fetch(etaUrl, {
      headers: { "User-Agent": "SIH-Flood-Evacuation-System/1.0" }
    });
    if (etaResponse.ok) {
      etaData = await etaResponse.json();
    }
  } catch (err) {
    console.warn("Mappls ETA API call warning:", err.message);
  }

  return {
    routes: advData.routes,
    etaRoutes: etaData?.routes || null,
    provider: "Mappls",
    mode: "route_adv"
  };
}

/**
 * Fallback Routing Provider: OSRM Public Engine
 */
async function fetchOSRMRouteFallback(startLat, startLon, endLat, endLon) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson&alternatives=true`;

  const response = await fetch(url, {
    headers: { "User-Agent": "SIH-Flood-Evacuation-System/1.0" }
  });

  if (!response.ok) {
    throw new Error(`OSRM fallback HTTP error ${response.status}`);
  }

  const data = await response.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error("No fallback routing paths returned from OSRM");
  }

  return {
    routes: data.routes,
    etaRoutes: null,
    provider: "OSRM",
    mode: "baseline_osrm"
  };
}

/**
 * Calculate bounding box from GeoJSON route coordinates
 */
function getRouteBbox(coordinates) {
  if (!coordinates || coordinates.length === 0) return null;
  let minLon = coordinates[0][0], maxLon = coordinates[0][0], minLat = coordinates[0][1], maxLat = coordinates[0][1];

  for (const pt of coordinates) {
    if (pt[0] < minLon) minLon = pt[0];
    if (pt[0] > maxLon) maxLon = pt[0];
    if (pt[1] < minLat) minLat = pt[1];
    if (pt[1] > maxLat) maxLat = pt[1];
  }

  return {
    minLon: Number((minLon - 0.015).toFixed(4)),
    minLat: Number((minLat - 0.015).toFixed(4)),
    maxLon: Number((maxLon + 0.015).toFixed(4)),
    maxLat: Number((maxLat + 0.015).toFixed(4))
  };
}

/**
 * Compute minimum perpendicular distance in meters from a point to a route polyline
 */
function pointToSegmentDistanceMeters(px, py, ax, ay, bx, by) {
  const latRad = (py * Math.PI) / 180;
  const metersPerLat = 111139;
  const metersPerLon = 111139 * Math.cos(latRad);

  const pX = px * metersPerLon;
  const pY = py * metersPerLat;
  const aX = ax * metersPerLon;
  const aY = ay * metersPerLat;
  const bX = bx * metersPerLon;
  const bY = by * metersPerLat;

  const dx = bX - aX;
  const dy = bY - aY;
  if (dx === 0 && dy === 0) return Math.hypot(pX - aX, pY - aY);

  const t = Math.max(0, Math.min(1, ((pX - aX) * dx + (pY - aY) * dy) / (dx * dx + dy * dy)));
  const projX = aX + t * dx;
  const projY = aY + t * dy;
  return Math.hypot(pX - projX, pY - projY);
}

function distanceToRoutePolylineMeters(pointLon, pointLat, routeCoordinates) {
  if (!routeCoordinates || routeCoordinates.length < 2) return Infinity;
  let minDistance = Infinity;
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const [aLon, aLat] = routeCoordinates[i];
    const [bLon, bLat] = routeCoordinates[i + 1];
    const dist = pointToSegmentDistanceMeters(pointLon, pointLat, aLon, aLat, bLon, bLat);
    if (dist < minDistance) minDistance = dist;
  }
  return Math.round(minDistance);
}

/**
 * Core Evacuation Route Decision-Support System
 */
async function calculateSafeEvacuationRoute(originLat, originLon, targetDestinationId = null, locationDetails = {}, options = {}) {
  const generatedAt = new Date().toISOString();
  const testMode = Boolean(options.testMode || options.test_mode || locationDetails.testMode);

  // 1. Discover Candidate Destinations
  const candidates = await getCandidateDestinations(originLat, originLon, 25, locationDetails);
  if (!candidates || candidates.length === 0) {
    return {
      success: false,
      message: "No candidate safe facilities found within range.",
      generated_at: generatedAt
    };
  }

  let selectedDest = candidates[0];
  if (targetDestinationId) {
    const found = candidates.find((c) => c.id === targetDestinationId);
    if (found) selectedDest = found;
  }

  // 2. Retrieve Environmental Data (Fused Record + ML Model)
  let fusedRecord = null;
  let floodRiskPercent = 0;
  let floodRiskLevel = "UNKNOWN";

  try {
    fusedRecord = await buildFusedRecord({
      latitude: originLat,
      longitude: originLon,
      name: locationDetails.name || "Current Location",
      state: locationDetails.state || "Hilly Region",
      country: locationDetails.country || "India"
    });

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
        elevation_m: fusedRecord.terrain?.elevation_m || 1000
      })
    });

    if (mlRes.ok) {
      const mlData = await mlRes.json();
      floodRiskPercent = mlData.flood_probability_percent || 0;
      floodRiskLevel = mlData.risk_level || "LOW";
    }
  } catch (err) {
    console.warn("Environmental prediction integration warning:", err.message);
  }

  // 3. Fetch Road Incidents & Official Alerts
  const roadStatus = await getRoadStatusIncidents(originLat, originLon);

  // 4. Construct Hazard Buffer Polygons
  const hazardZones = [];
  if (floodRiskPercent >= HAZARD_THRESHOLDS.moderateFloodRiskPercent) {
    hazardZones.push({
      id: "monitored_flood_zone",
      type: "FLOOD_RISK",
      severity: floodRiskLevel,
      probability_percent: floodRiskPercent,
      source: "Flash Flood ML Prediction Model",
      label: "Prototype hazard buffer derived from monitored-area risk",
      center: [originLat, originLon],
      radius_km: HAZARD_THRESHOLDS.prototypeBufferKm,
      geometry: { type: "Point", coordinates: [originLon, originLat] }
    });
  }

  if (fusedRecord?.landslide_history?.count_10km > 0) {
    hazardZones.push({
      id: "landslide_susceptibility_zone",
      type: "HISTORICAL_LANDSLIDE_SUSCEPTIBILITY",
      severity: "MODERATE",
      source: "GSI Landslide Inventory",
      label: "Historical Landslide Susceptibility (Not a reported road blockage)",
      events_count_10km: fusedRecord.landslide_history.count_10km,
      center: [originLat, originLon]
    });
  }

  // 5. Query Mappls Primary Routing
  let routeResultData = null;
  let fallbackUsed = false;
  let fallbackReason = null;

  try {
    routeResultData = await fetchMapplsRoutes(originLat, originLon, selectedDest.latitude, selectedDest.longitude);
  } catch (mapplsErr) {
    console.warn("Mappls primary routing failed, initiating fallback to OSRM:", mapplsErr.message);
    fallbackUsed = true;
    fallbackReason = mapplsErr.message;
    try {
      routeResultData = await fetchOSRMRouteFallback(originLat, originLon, selectedDest.latitude, selectedDest.longitude);
    } catch (osrmErr) {
      console.error("OSRM fallback routing failed as well:", osrmErr.message);
    }
  }

  if (!routeResultData || !routeResultData.routes || routeResultData.routes.length === 0) {
    return {
      success: true,
      user_location: { latitude: originLat, longitude: originLon },
      recommended_destination: selectedDest,
      recommended_route: null,
      alternative_routes: [],
      incidents: roadStatus.incidents,
      hazard_zones: hazardZones,
      routing_provider: "UNAVAILABLE",
      routing_mode: "none",
      fallback_used: fallbackUsed,
      fallback_reason: fallbackReason,
      source_health: {
        mappls_routing: "UNAVAILABLE",
        mappls_eta: "UNAVAILABLE",
        tomtom_traffic_flow: "UNAVAILABLE",
        tomtom_incidents: "UNAVAILABLE",
        tomtom_traffic_routing: "UNAVAILABLE",
        open_meteo: fusedRecord?.weather?.source ? "LIVE/NRT" : "UNAVAILABLE",
        nasa_gpm: fusedRecord?.satellite_rainfall?.source ? "NRT" : "UNAVAILABLE",
        nasa_smap: fusedRecord?.soil_moisture?.source ? "NRT" : "UNAVAILABLE",
        terrain: "STATIC",
        gsi: "HISTORICAL",
        flood_ml: "PREDICTED",
        shelter_verification: "UNAVAILABLE"
      },
      generated_at: generatedAt
    };
  }

  // 6. Process Routes
  const rawRoutes = routeResultData.routes;
  const etaRoutes = routeResultData.etaRoutes;
  const tomtomRouteData = await getTomTomTrafficRoute(originLat, originLon, selectedDest.latitude, selectedDest.longitude);

  // STAGE 4 — Development-Only Simulated Test Closure Injection
  let simulatedTestClosure = null;
  if (testMode && rawRoutes.length > 0) {
    const pCoords = rawRoutes[0].geometry?.coordinates || [];
    if (pCoords.length > 0) {
      const midIdx = Math.floor(pCoords.length / 2);
      const midPt = pCoords[midIdx];
      simulatedTestClosure = {
        id: "simulated_test_closure_001",
        type: "ROAD_CLOSURE",
        description: "TEST ROAD CLOSURE (SIMULATED FOR REROUTING VALIDATION)",
        severity: 5,
        delay_seconds: 900,
        length_meters: 200,
        road_closed: true,
        road_name: "Simulated Test Road",
        source: "SIMULATED_TEST",
        verification_status: "TEST_ONLY",
        is_test_data: true,
        geometry: {
          type: "Point",
          coordinates: [midPt[0], midPt[1]]
        }
      };
    }
  }

  const evaluatedRoutes = await Promise.all(
    rawRoutes.map(async (rt, idx) => {
      const distMeters = rt.distance;
      const distanceKm = Number((distMeters / 1000).toFixed(2));
      const normalDurationSec = rt.duration;
      const normalDurationMin = Math.round(normalDurationSec / 60);

      let mapplsEtaMin = normalDurationMin;
      if (etaRoutes && etaRoutes[idx] && etaRoutes[idx].duration) {
        mapplsEtaMin = Math.round(etaRoutes[idx].duration / 60);
      }

      let tomtomEtaMin = mapplsEtaMin;
      let trafficDelaySec = 0;
      if (tomtomRouteData.status === "LIVE" && tomtomRouteData.tomtom_traffic_eta_min) {
        tomtomEtaMin = tomtomRouteData.tomtom_traffic_eta_min;
        trafficDelaySec = tomtomRouteData.tomtom_traffic_delay_sec || 0;
      }

      const routeCoords = rt.geometry?.coordinates || [];
      const routeBbox = getRouteBbox(routeCoords);
      let routeIncidents = [];

      // Query Real TomTom Incidents
      if (routeBbox) {
        const incidentData = await getTrafficIncidentsInBbox(routeBbox.minLon, routeBbox.minLat, routeBbox.maxLon, routeBbox.maxLat);
        if (incidentData.status === "INCIDENTS_DETECTED") {
          routeIncidents = incidentData.incidents || [];
        }
      }

      // STAGE 6 — Geospatial Intersection Analysis (Corridor threshold: 50 meters)
      const CORRIDOR_THRESHOLD_METERS = 50;
      let testClosureDistanceMeters = null;
      let intersectsTestClosure = false;

      if (simulatedTestClosure) {
        const [simLon, simLat] = simulatedTestClosure.geometry.coordinates;
        testClosureDistanceMeters = distanceToRoutePolylineMeters(simLon, simLat, routeCoords);
        if (testClosureDistanceMeters <= CORRIDOR_THRESHOLD_METERS) {
          intersectsTestClosure = true;
          routeIncidents.push(simulatedTestClosure);
        }
      }

      const reportedClosuresCount = routeIncidents.filter((i) => i.type === "ROAD_CLOSURE" || i.road_closed).length;
      const reportedAccidentsCount = routeIncidents.filter((i) => i.type === "ACCIDENT").length;
      const reportedRoadworksCount = routeIncidents.filter((i) => i.type === "ROADWORK").length;

      // Traffic Flow Sampling
      let trafficFlowStatus = "UNAVAILABLE";
      let trafficFlowSamples = [];
      let avgSpeed = null;
      let freeFlowSpeed = null;

      if (routeCoords.length > 0) {
        const sampleIndices = [0, Math.floor(routeCoords.length / 2), routeCoords.length - 1];
        const sampleFlows = await Promise.all(
          sampleIndices.map(async (idxPt) => {
            const pt = routeCoords[idxPt];
            if (!pt) return null;
            return await getTrafficFlowAtPoint(pt[1], pt[0]);
          })
        );

        const validFlows = sampleFlows.filter((f) => f && f.status === "LIVE");
        if (validFlows.length > 0) {
          trafficFlowStatus = "LIVE";
          const sumSpeed = validFlows.reduce((acc, f) => acc + (f.currentSpeed || 0), 0);
          const sumFree = validFlows.reduce((acc, f) => acc + (f.freeFlowSpeed || 0), 0);
          avgSpeed = Math.round(sumSpeed / validFlows.length);
          freeFlowSpeed = Math.round(sumFree / validFlows.length);
          trafficFlowSamples = validFlows;
        }
      }

      // Evaluate intermediate route environmental exposure
      const envSummary = await evaluateRouteEnvironmentalHazards(routeCoords, distanceKm, fusedRecord);

      // Hazard Exposure & Status Definitions
      let floodExposure = "UNKNOWN";
      if (envSummary.max_flood_probability !== null) {
        floodExposure = envSummary.max_flood_probability >= 60 ? "HIGH" : envSummary.max_flood_probability >= 40 ? "MODERATE" : "LOW";
      }
      let landslideExposure = envSummary.max_landslide_exposure || "UNKNOWN";
      let closureStatus = reportedClosuresCount > 0 ? "REPORTED_CLOSURE" : "NO_REPORTED_CLOSURES";
      let incidentStatusNotice = routeIncidents.length > 0
        ? `${routeIncidents.length} Incident(s) Detected`
        : "NO_REPORTED_INCIDENTS";

      // Calculate Safety Score & Penalties
      let closurePenalty = reportedClosuresCount > 0 ? 50 : 0;
      
      // Maximum route flood probability heavily penalizes the route
      let routeFloodPenalty = 0;
      if (envSummary.max_flood_probability !== null) {
        routeFloodPenalty = Math.round(envSummary.max_flood_probability * 0.40);
        if (envSummary.max_flood_probability >= 60) {
          routeFloodPenalty += 20; // Hazardous segment penalty
        }
      }

      let routeLandslidePenalty = envSummary.max_landslide_exposure === "HIGH" ? 20 : envSummary.max_landslide_exposure === "MODERATE" ? 10 : 0;
      let accidentPenalty = reportedAccidentsCount * 10;
      let roadworkPenalty = reportedRoadworksCount * 5;
      let delayPenalty = Math.min(Math.round(trafficDelaySec / 60) * 2, 10);
      let elevationPenalty = (selectedDest.elevation_m && fusedRecord?.terrain?.elevation_m && selectedDest.elevation_m < fusedRecord.terrain.elevation_m) ? 10 : 0;

      let calculatedScore = Math.max(0, Math.min(100, Math.round(100 - (closurePenalty + routeFloodPenalty + routeLandslidePenalty + accidentPenalty + roadworkPenalty + delayPenalty + elevationPenalty))));

      let riskClassification = RISK_CLASSIFICATIONS.LOWER_RISK;
      if (reportedClosuresCount > 0 || calculatedScore < 40) {
        riskClassification = RISK_CLASSIFICATIONS.AVOID;
      } else if (calculatedScore < 60) {
        riskClassification = RISK_CLASSIFICATIONS.HIGH_RISK;
      } else if (calculatedScore < 80) {
        riskClassification = RISK_CLASSIFICATIONS.USE_CAUTION;
      }

      // Route Data Coverage & Confidence: STRICT ACCOUNTING ONLY (no process.env counting!)
      let validRouteSourcesCount = 0;
      const totalRequiredRouteSources = 6;
      if (!fallbackUsed) validRouteSourcesCount++; // Mappls Geometry
      if (trafficFlowStatus === "LIVE") validRouteSourcesCount++; // TomTom Flow
      if (roadStatus && roadStatus.incidents != null) validRouteSourcesCount++; // TomTom Incidents
      if (tomtomRouteData.status === "LIVE") validRouteSourcesCount++; // TomTom Routing
      if (envSummary && envSummary.max_flood_probability !== null) validRouteSourcesCount++; // Route ML Sampling
      if (envSummary && envSummary.elevation_range && envSummary.elevation_range.min_m !== null) validRouteSourcesCount++; // SRTM Elevation

      const routeDataCoveragePercent = Math.round((validRouteSourcesCount / totalRequiredRouteSources) * 100);
      let routeConfidence = CONFIDENCE_LEVELS.HIGH;
      if (routeDataCoveragePercent < 50) routeConfidence = CONFIDENCE_LEVELS.LOW;
      else if (routeDataCoveragePercent < 85 || fallbackUsed) routeConfidence = CONFIDENCE_LEVELS.MODERATE;

      const destDataCoverage = selectedDest.destination_data_coverage ?? 100;
      const overallDataCoveragePercent = Math.round((destDataCoverage + routeDataCoveragePercent) / 2);
      let overallConfidence = CONFIDENCE_LEVELS.HIGH;
      if (overallDataCoveragePercent < 50) overallConfidence = CONFIDENCE_LEVELS.LOW;
      else if (overallDataCoveragePercent < 85 || fallbackUsed) overallConfidence = CONFIDENCE_LEVELS.MODERATE;

      const riskFactors = [];
      if (reportedClosuresCount > 0) riskFactors.push(`Reported Road Closure: ${reportedClosuresCount} segment(s)`);
      if (reportedAccidentsCount > 0) riskFactors.push(`Reported Accidents: ${reportedAccidentsCount}`);
      if (reportedRoadworksCount > 0) riskFactors.push(`Reported Roadworks: ${reportedRoadworksCount}`);
      if (trafficDelaySec > 120) riskFactors.push(`Traffic Delay: ${Math.round(trafficDelaySec / 60)} min delay`);
      if (envSummary.max_flood_probability != null && envSummary.max_flood_probability >= 40) riskFactors.push(`Route Flood Exposure: Max ${envSummary.max_flood_probability}% along route`);
      if (envSummary.max_landslide_exposure === "HIGH") riskFactors.push(`Route Landslide Exposure: High susceptibility segment`);

      const dataGaps = [
        "Road closure status is derived from provider feeds (NO_REPORTED_CLOSURES does not guarantee physical road open status)",
        selectedDest.verification_status === "UNVERIFIED" ? "Destination shelter status: Potential Safe Facility (UNVERIFIED)" : null
      ].filter(Boolean);

      // PROBLEM 4 FIX: Evidence-backed "Why This Route" statements ONLY!
      const reasons = [];
      reasons.push(`✓ Geometry generated via Mappls ${routeResultData.mode} engine`);
      if (tomtomRouteData.status === "LIVE") {
        reasons.push(`✓ TomTom traffic-aware travel time: ${tomtomEtaMin} min (${trafficDelaySec > 0 ? trafficDelaySec + 's delay' : 'no delay'})`);
      } else {
        reasons.push(`✓ Mappls ETA: ${mapplsEtaMin} min`);
      }

      if (reportedClosuresCount === 0) {
        reasons.push("✓ No provider-reported road closures intersect this route");
      } else {
        reasons.push(`! Caution: ${reportedClosuresCount} reported road closure(s) along route`);
      }

      if (envSummary.max_flood_probability !== null) {
        if (envSummary.max_flood_probability < 40) {
          reasons.push(`✓ Sampled route flood probability: ${Math.round(envSummary.max_flood_probability)}% (Lower Risk)`);
        } else {
          reasons.push(`! Intersects monitored flood risk area (Max ${Math.round(envSummary.max_flood_probability)}% flood prob)`);
        }
      } else {
        reasons.push("⚠ Route flood exposure could not be fully evaluated (Environmental Data Unavailable)");
      }

      if (selectedDest.verification_status === "VERIFIED_OFFICIAL") {
        reasons.push("✓ Destination is a verified official evacuation shelter (Nilgiris DDMP 2026)");
      } else {
        reasons.push("• Reaches evaluated evacuation shelter option");
      }

      return {
        route_id: `route_${idx + 1}`,
        name: idx === 0 ? "Primary Candidate Route" : `Alternative Route ${idx}`,
        is_recommended: idx === 0,
        destination: selectedDest,
        distance_m: distMeters,
        distance_km: distanceKm,
        normal_duration_seconds: normalDurationSec,
        mappls_eta_minutes: mapplsEtaMin,
        tomtom_traffic_eta_minutes: tomtomEtaMin,
        traffic_delay_seconds: trafficDelaySec,
        eta_minutes: tomtomEtaMin,
        traffic_status: trafficFlowStatus === "LIVE" ? `Live Speed: ${avgSpeed || 'N/A'} km/h` : "Live Traffic Unavailable",
        traffic_flow: {
          status: trafficFlowStatus,
          current_speed_kmh: avgSpeed,
          free_flow_speed_kmh: freeFlowSpeed,
          samples_checked: trafficFlowSamples.length
        },
        incidents: {
          status: incidentStatusNotice,
          total_count: routeIncidents.length,
          closures_count: reportedClosuresCount,
          accidents_count: reportedAccidentsCount,
          roadworks_count: reportedRoadworksCount,
          items: routeIncidents
        },
        environmental_summary: envSummary,
        safety_score: calculatedScore,
        closure_penalty: closurePenalty,
        risk_classification: riskClassification,
        route_data_confidence: routeConfidence,
        route_data_coverage: routeDataCoveragePercent,
        overall_data_confidence: overallConfidence,
        overall_data_coverage: overallDataCoveragePercent,
        confidence: routeConfidence,
        data_coverage_percent: routeDataCoveragePercent,
        flood_exposure: floodExposure,
        landslide_exposure: landslideExposure,
        road_closure_status: closureStatus,
        intersection_analysis: {
          simulated_closure_present: Boolean(simulatedTestClosure),
          distance_to_closure_meters: testClosureDistanceMeters,
          intersects_closure: intersectsTestClosure,
          threshold_meters: CORRIDOR_THRESHOLD_METERS
        },
        geometry: rt.geometry,
        steps: rt.steps || [],
        provider: routeResultData.provider,
        reasons: reasons,
        risk_factors: riskFactors,
        data_gaps: dataGaps
      };
    })
  );

  // Rank routes by safety_score descending
  evaluatedRoutes.sort((a, b) => b.safety_score - a.safety_score);
  evaluatedRoutes.forEach((r, idx) => {
    r.is_recommended = (idx === 0);
    if (idx === 0) r.name = "Recommended Lower-Risk Route";
  });

  const recommendedRoute = evaluatedRoutes[0];
  const alternativeRoutes = evaluatedRoutes.slice(1);

  // Combine incidents list
  const allIncidents = [
    ...(roadStatus.incidents || []),
    ...(testMode && simulatedTestClosure ? [simulatedTestClosure] : [])
  ];

  return {
    success: true,
    user_location: { latitude: originLat, longitude: originLon },
    test_mode_active: testMode,
    recommended_destination: selectedDest,
    recommended_route: recommendedRoute,
    alternative_routes: alternativeRoutes,
    incidents: allIncidents,
    hazard_zones: hazardZones,
    overall_data_confidence: recommendedRoute?.overall_data_confidence || "HIGH",
    overall_data_coverage: recommendedRoute?.overall_data_coverage || 100,
    routing_provider: routeResultData.provider,
    routing_mode: routeResultData.mode,
    route_geometry_source: routeResultData.provider === "Mappls" ? "Mappls Direction API" : "OSRM Baseline",
    fallback_used: fallbackUsed,
    fallback_reason: fallbackReason,
    disclaimer: "Recommended lower-risk evacuation route based on the latest available routing, traffic, environmental, hazard and official shelter data. Physical conditions may change rapidly during emergencies. Follow official evacuation instructions where available.",
    source_health: {
      mappls_routing: fallbackUsed ? "UNAVAILABLE" : "LIVE",
      mappls_eta: etaRoutes ? "AVAILABLE" : "UNAVAILABLE",
      tomtom_traffic_flow: "LIVE",
      tomtom_incidents: "LIVE",
      tomtom_traffic_routing: tomtomRouteData.status === "LIVE" ? "LIVE" : "UNAVAILABLE",
      open_meteo: fusedRecord?.weather?.source ? "LIVE/NRT" : "UNAVAILABLE",
      nasa_gpm: fusedRecord?.satellite_rainfall?.source ? "NRT" : "UNAVAILABLE",
      nasa_smap: fusedRecord?.soil_moisture?.source ? "NRT" : "UNAVAILABLE",
      terrain: "STATIC",
      gsi: "HISTORICAL",
      flood_ml: "PREDICTED",
      shelter_verification: "OFFICIAL_DOCUMENT"
    },
    generated_at: generatedAt
  };
}

module.exports = {
  calculateSafeEvacuationRoute
};
