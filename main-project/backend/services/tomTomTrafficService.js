/**
 * TomTom Live Traffic, Incidents, and Traffic-Aware Routing Service
 * Operates securely using process.env.TOMTOM_API_KEY
 */

async function getTrafficIncidentsInBbox(minLon, minLat, maxLon, maxLat) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    return { status: "UNAVAILABLE", incidents: [], error: "TOMTOM_API_KEY missing" };
  }

  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${minLon},${minLat},${maxLon},${maxLat}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "SIH-Flood-Evacuation-System/1.0" }
    });

    if (!response.ok) {
      return {
        status: "UNAVAILABLE",
        incidents: [],
        error: `TomTom Incidents HTTP ${response.status}`
      };
    }

    const data = await response.json();
    if (!data || !data.incidents) {
      return { status: "NO_REPORTED_INCIDENTS", incidents: [], count: 0 };
    }

    const normalizedIncidents = data.incidents.map((inc, i) => {
      const props = inc.properties || {};
      let type = "OTHER_INCIDENT";
      if (props.iconCategory === 6 || (props.events && props.events.some((e) => e.code === 500))) {
        type = "ROAD_CLOSURE";
      } else if (props.iconCategory === 1) {
        type = "ACCIDENT";
      } else if (props.iconCategory === 0) {
        type = "ROADWORK";
      } else if (props.iconCategory === 9 || props.magnitudeOfDelay > 1) {
        type = "CONGESTION";
      }

      return {
        id: props.id || `tomtom_inc_${i}`,
        type: type,
        description: props.events && props.events.length > 0 ? props.events[0].description : "Reported Traffic Incident",
        severity: props.magnitudeOfDelay || 0,
        delay_seconds: props.delay || 0,
        length_meters: props.length || 0,
        road_closed: type === "ROAD_CLOSURE",
        road_name: props.roadNumbers ? props.roadNumbers.join(", ") : "Local Road",
        start_time: props.startTime || null,
        end_time: props.endTime || null,
        geometry: inc.geometry || null,
        source: "TomTom Traffic Incidents API"
      };
    });

    return {
      status: normalizedIncidents.length > 0 ? "INCIDENTS_DETECTED" : "NO_REPORTED_INCIDENTS",
      count: normalizedIncidents.length,
      incidents: normalizedIncidents,
      fetched_at: new Date().toISOString()
    };
  } catch (err) {
    console.warn("TomTom Incidents API fetch warning:", err.message);
    return { status: "UNAVAILABLE", incidents: [], error: err.message };
  }
}

async function getTrafficFlowAtPoint(lat, lon) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    return { status: "UNAVAILABLE", flow: null };
  }

  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative-delay/10/json?key=${apiKey}&point=${lat},${lon}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "SIH-Flood-Evacuation-System/1.0" }
    });

    if (!response.ok) {
      return { status: "UNAVAILABLE", flow: null };
    }

    const data = await response.json();
    if (!data || !data.flowSegmentData) {
      return { status: "UNAVAILABLE", flow: null };
    }

    const seg = data.flowSegmentData;
    return {
      status: "LIVE",
      currentSpeed: seg.currentSpeed,
      freeFlowSpeed: seg.freeFlowSpeed,
      currentTravelTime: seg.currentTravelTime,
      freeFlowTravelTime: seg.freeFlowTravelTime,
      confidence: seg.confidence,
      roadClosed: seg.roadClosed || false
    };
  } catch (err) {
    return { status: "UNAVAILABLE", flow: null };
  }
}

async function getTomTomTrafficRoute(startLat, startLon, endLat, endLon) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    return { status: "UNAVAILABLE", route: null };
  }

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLon}:${endLat},${endLon}/json?key=${apiKey}&traffic=true`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "SIH-Flood-Evacuation-System/1.0" }
    });

    if (!response.ok) {
      return { status: "UNAVAILABLE", route: null };
    }

    const data = await response.json();
    if (!data || !data.routes || data.routes.length === 0) {
      return { status: "UNAVAILABLE", route: null };
    }

    const r0 = data.routes[0];
    const summary = r0.summary || {};

    return {
      status: "LIVE",
      tomtom_distance_m: summary.lengthInMeters,
      tomtom_travel_time_sec: summary.travelTimeInSeconds,
      tomtom_traffic_delay_sec: summary.trafficDelayInSeconds,
      tomtom_traffic_eta_min: Math.round((summary.travelTimeInSeconds + summary.trafficDelayInSeconds) / 60),
      tomtom_eta_available: true
    };
  } catch (err) {
    return { status: "UNAVAILABLE", route: null };
  }
}

module.exports = {
  getTrafficIncidentsInBbox,
  getTrafficFlowAtPoint,
  getTomTomTrafficRoute
};
