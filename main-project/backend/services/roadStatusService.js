const { getTrafficIncidentsInBbox } = require("./tomTomTrafficService");

/**
 * Aggregates road status evidence (closures, traffic incidents, blockages).
 * Uses TomTom Traffic Incidents API as verified incident provider.
 * Never fabricates closures or converts missing information to safe.
 */
async function getRoadStatusIncidents(lat, lon, radiusKm = 15) {
  // Approximate bounding box around coordinates (~15km)
  const deltaLat = radiusKm / 111;
  const deltaLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const minLat = Number((lat - deltaLat).toFixed(4));
  const maxLat = Number((lat + deltaLat).toFixed(4));
  const minLon = Number((lon - deltaLon).toFixed(4));
  const maxLon = Number((lon + deltaLon).toFixed(4));

  const result = await getTrafficIncidentsInBbox(minLon, minLat, maxLon, maxLat);

  return {
    provider_configured: Boolean(process.env.TOMTOM_API_KEY),
    provider_name: "TomTom Traffic Incidents API",
    status: result.status,
    verification_status: "UNVERIFIED_FOR_PHYSICAL_ROADS",
    road_closure_status: result.incidents?.some((i) => i.road_closed) ? "REPORTED_CLOSURE" : "NO_REPORTED_CLOSURES",
    road_closure_notice: "No provider can guarantee that every physical road hazard or closure is reported.",
    traffic_routing_status: result.status === "UNAVAILABLE" ? "UNAVAILABLE" : "LIVE",
    incidents: result.incidents || [],
    incidents_count: result.count || 0,
    fetched_at: new Date().toISOString()
  };
}

module.exports = {
  getRoadStatusIncidents
};
