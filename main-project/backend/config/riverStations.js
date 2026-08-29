// --------------------------------------------------
// River Station Configuration
// Per-station thresholds, metadata, and multi-source
// readiness flags. Thresholds are DEMO/SIMULATED values.
// Replace with real gauge authority data when available.
// --------------------------------------------------

const RIVER_STATIONS = [
  {
    id: "coonoor-river-01",
    name: "Coonoor River",
    river: "Coonoor River",
    region: "Nilgiris",
    state: "Tamil Nadu",
    latitude: 11.3533,
    longitude: 76.7959,
    // Level thresholds in metres (DEMO thresholds — not official)
    thresholds: {
      warning_m: 1.8,
      danger_m: 2.5,
      bankfull_m: 3.0,
      rapid_rise_rate_m_per_hr: 0.3
    },
    // Normal seasonal range (for chart scaling guidance)
    typical_range_m: { min: 0.2, max: 3.5 },
    // CWC official gauge details (technically inaccessible without private API keys)
    real_source: {
      name: "Central Water Commission (CWC) - Cauvery Basin",
      station_id: "COONOOR-CWC-01",
      url: "https://nwdp.nwic.gov.in/",
      status: "UNAVAILABLE"
    },
    // Multi-source readiness flags
    data_sources: {
      river_level: "UNAVAILABLE", // defaults to UNAVAILABLE in production
      rainfall_local: "ready",       // could connect to Open-Meteo
      rainfall_upstream: "pending",
      weather: "ready",              // Open-Meteo available
      terrain: "ready",              // SRTM available
      historical_floods: "pending"
    }
  },
  {
    id: "ooty-pykara-01",
    name: "Pykara River at Ooty",
    river: "Pykara River",
    region: "Nilgiris",
    state: "Tamil Nadu",
    latitude: 11.4102,
    longitude: 76.6950,
    // DEMO thresholds — not official
    thresholds: {
      warning_m: 2.0,
      danger_m: 2.8,
      bankfull_m: 3.5,
      rapid_rise_rate_m_per_hr: 0.35
    },
    typical_range_m: { min: 0.3, max: 4.0 },
    real_source: {
      name: "TANGEDCO Reservoir Telemetry / CWC Pykara Division",
      station_id: "PYKARA-OOTY-01",
      url: "https://india-wris.gov.in/",
      status: "UNAVAILABLE"
    },
    data_sources: {
      river_level: "UNAVAILABLE",
      rainfall_local: "ready",
      rainfall_upstream: "pending",
      weather: "ready",
      terrain: "ready",
      historical_floods: "pending"
    }
  },
  {
    id: "munnar-periyar-01",
    name: "Periyar River at Munnar",
    river: "Periyar River",
    region: "Idukki",
    state: "Kerala",
    latitude: 10.0889,
    longitude: 77.0595,
    // DEMO thresholds — not official
    thresholds: {
      warning_m: 2.5,
      danger_m: 3.5,
      bankfull_m: 4.5,
      rapid_rise_rate_m_per_hr: 0.4
    },
    typical_range_m: { min: 0.5, max: 5.0 },
    real_source: {
      name: "Kerala Water Authority / CWC Periyar Gauge Division",
      station_id: "PERIYAR-MUNNAR-01",
      url: "https://nwdp.nwic.gov.in/",
      status: "UNAVAILABLE"
    },
    data_sources: {
      river_level: "UNAVAILABLE",
      rainfall_local: "ready",
      rainfall_upstream: "pending",
      weather: "ready",
      terrain: "ready",
      historical_floods: "pending"
    }
  },
  {
    id: "wayanad-kabani-01",
    name: "Kabani River at Wayanad",
    river: "Kabani River",
    region: "Wayanad",
    state: "Kerala",
    latitude: 11.6854,
    longitude: 76.1320,
    // DEMO thresholds — not official
    thresholds: {
      warning_m: 2.2,
      danger_m: 3.2,
      bankfull_m: 4.0,
      rapid_rise_rate_m_per_hr: 0.4
    },
    typical_range_m: { min: 0.4, max: 4.5 },
    real_source: {
      name: "Cauvery Basin CWC Hydro-Telemetry Station",
      station_id: "KABANI-WAYANAD-01",
      url: "https://india-wris.gov.in/",
      status: "UNAVAILABLE"
    },
    data_sources: {
      river_level: "UNAVAILABLE",
      rainfall_local: "ready",
      rainfall_upstream: "pending",
      weather: "ready",
      terrain: "ready",
      historical_floods: "pending"
    }
  },
  {
    id: "uttarakhand-nainital-01",
    name: "Baliya Nala at Nainital",
    river: "Baliya Nala",
    region: "Nainital",
    state: "Uttarakhand",
    latitude: 29.3919,
    longitude: 79.4542,
    // DEMO thresholds — not official
    thresholds: {
      warning_m: 1.5,
      danger_m: 2.2,
      bankfull_m: 2.8,
      rapid_rise_rate_m_per_hr: 0.25
    },
    typical_range_m: { min: 0.1, max: 3.0 },
    real_source: {
      name: "Uttarakhand Hydro-Met Department / Nainital Gauge",
      station_id: "BALIYA-NAINITAL-01",
      url: "https://nwdp.nwic.gov.in/",
      status: "UNAVAILABLE"
    },
    data_sources: {
      river_level: "UNAVAILABLE",
      rainfall_local: "ready",
      rainfall_upstream: "pending",
      weather: "ready",
      terrain: "ready",
      historical_floods: "pending"
    }
  }
];

// Quick lookup by station ID
const STATION_MAP = Object.fromEntries(
  RIVER_STATIONS.map((s) => [s.id, s])
);

module.exports = {
  RIVER_STATIONS,
  STATION_MAP
};
