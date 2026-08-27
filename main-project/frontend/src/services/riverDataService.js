/**
 * River Data Service & Baseline Telemetry Provider
 * SIH 2026 Flash Flood Prediction System
 *
 * Provides real-time telemetry fetching from /api/rivers with fallback
 * to baseline monitoring stations for key mountain river basins across India.
 */

export const BASELINE_RIVER_STATIONS = [
  {
    id: "bhavani-coonoor",
    river_name: "Bhavani River",
    station_name: "Kattery - Coonoor Confluence",
    location: "Coonoor",
    district: "Nilgiris",
    state: "Tamil Nadu",
    basin: "Bhavani Sub-Basin",
    coordinates: { latitude: 11.3410, longitude: 76.8120 },
    current_level_m: 2.65,
    previous_level_m: 2.63,
    warning_level_m: 4.80,
    danger_level_m: 5.30,
    highest_flood_level_m: 5.70,
    bed_level_m: 1.00,
    flow_velocity_ms: 1.4,
    discharge_cusecs: 580,
    rate_of_rise_m_hr: 0.02,
    trend: "Stable",
    risk_level: "NORMAL",
    risk_color: "#22c55e",
    time_to_warning: "> 24 hours (Safe Clearance)",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 2.67, projected_delta_m: 0.02, risk_assessment: "NORMAL" },
        { horizon: "+3h", predicted_level_m: 2.71, projected_delta_m: 0.06, risk_assessment: "NORMAL" },
        { horizon: "+6h", predicted_level_m: 2.76, projected_delta_m: 0.11, risk_assessment: "NORMAL" }
      ],
      summary: "Water level comfortably within seasonal baseline. Safe operational clearance (2.15m headroom)."
    }
  },
  {
    id: "kallar-kodaikanal",
    river_name: "Gundar / Kallar River",
    station_name: "Silver Cascade Gorge Gauge",
    location: "Kodaikanal",
    district: "Dindigul",
    state: "Tamil Nadu",
    basin: "Vaigai - Gundar Basin",
    coordinates: { latitude: 10.2450, longitude: 77.5120 },
    current_level_m: 2.10,
    previous_level_m: 2.08,
    warning_level_m: 4.20,
    danger_level_m: 4.80,
    highest_flood_level_m: 5.10,
    bed_level_m: 0.80,
    flow_velocity_ms: 1.2,
    discharge_cusecs: 420,
    rate_of_rise_m_hr: 0.02,
    trend: "Stable",
    risk_level: "NORMAL",
    risk_color: "#22c55e",
    time_to_warning: "> 24 hours (Safe Clearance)",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 2.12, projected_delta_m: 0.02, risk_assessment: "NORMAL" },
        { horizon: "+3h", predicted_level_m: 2.15, projected_delta_m: 0.05, risk_assessment: "NORMAL" },
        { horizon: "+6h", predicted_level_m: 2.20, projected_delta_m: 0.10, risk_assessment: "NORMAL" }
      ],
      summary: "Clear weather across Berijam catchment. Normal safe streamflow (2.10m headroom)."
    }
  },
  {
    id: "bhagirathi-ganga-rishikesh",
    river_name: "Ganga River (Bhagirathi Confluence)",
    station_name: "Rishikesh Parmarth Ghat Sensor",
    location: "Rishikesh",
    district: "Dehradun",
    state: "Uttarakhand",
    basin: "Ganga Main Channel",
    coordinates: { latitude: 30.1030, longitude: 78.2980 },
    current_level_m: 4.80,
    previous_level_m: 4.78,
    warning_level_m: 8.50,
    danger_level_m: 9.50,
    highest_flood_level_m: 10.40,
    bed_level_m: 2.00,
    flow_velocity_ms: 1.8,
    discharge_cusecs: 3200,
    rate_of_rise_m_hr: 0.02,
    trend: "Stable",
    risk_level: "NORMAL",
    risk_color: "#22c55e",
    time_to_warning: "> 24 hours (Safe Clearance)",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 4.82, projected_delta_m: 0.02, risk_assessment: "NORMAL" },
        { horizon: "+3h", predicted_level_m: 4.86, projected_delta_m: 0.06, risk_assessment: "NORMAL" },
        { horizon: "+6h", predicted_level_m: 4.92, projected_delta_m: 0.12, risk_assessment: "NORMAL" }
      ],
      summary: "Main Ganga channel capacity ample; flows smoothly through foothills with 3.70m headroom."
    }
  },
  {
    id: "kosi-nainital",
    river_name: "Kosi River",
    station_name: "Ramnagar Foothill Outflow",
    location: "Nainital / Ramnagar",
    district: "Nainital",
    state: "Uttarakhand",
    basin: "Kosi Sub-Basin",
    coordinates: { latitude: 29.3950, longitude: 79.1250 },
    current_level_m: 2.60,
    previous_level_m: 2.58,
    warning_level_m: 5.20,
    danger_level_m: 6.00,
    highest_flood_level_m: 6.80,
    bed_level_m: 1.00,
    flow_velocity_ms: 1.5,
    discharge_cusecs: 780,
    rate_of_rise_m_hr: 0.02,
    trend: "Stable",
    risk_level: "NORMAL",
    risk_color: "#22c55e",
    time_to_warning: "> 24 hours (Safe Clearance)",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 2.62, projected_delta_m: 0.02, risk_assessment: "NORMAL" },
        { horizon: "+3h", predicted_level_m: 2.66, projected_delta_m: 0.06, risk_assessment: "NORMAL" },
        { horizon: "+6h", predicted_level_m: 2.71, projected_delta_m: 0.11, risk_assessment: "NORMAL" }
      ],
      summary: "Controlled discharge; channel capacity fully adequate with 2.60m headroom."
    }
  },
  {
    id: "mandakini-kedarnath",
    river_name: "Mandakini River",
    station_name: "Tilwara - Agastyamuni Bridge",
    location: "Kedarnath Valley",
    district: "Rudraprayag",
    state: "Uttarakhand",
    basin: "Mandakini Basin",
    coordinates: { latitude: 30.4010, longitude: 79.0250 },
    current_level_m: 3.80,
    previous_level_m: 3.77,
    warning_level_m: 7.20,
    danger_level_m: 8.00,
    highest_flood_level_m: 9.10,
    bed_level_m: 1.90,
    flow_velocity_ms: 2.1,
    discharge_cusecs: 1650,
    rate_of_rise_m_hr: 0.03,
    trend: "Stable",
    risk_level: "NORMAL",
    risk_color: "#22c55e",
    time_to_warning: "> 24 hours (Safe Clearance)",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 3.83, projected_delta_m: 0.03, risk_assessment: "NORMAL" },
        { horizon: "+3h", predicted_level_m: 3.89, projected_delta_m: 0.09, risk_assessment: "NORMAL" },
        { horizon: "+6h", predicted_level_m: 3.96, projected_delta_m: 0.16, risk_assessment: "NORMAL" }
      ],
      summary: "Seasonal alpine flow within standard safe clearance (3.40m to warning mark)."
    }
  },
  {
    id: "teesta-sikkim",
    river_name: "Teesta River",
    station_name: "Melli Bridge Telemetry",
    location: "Teesta Valley / Siliguri",
    district: "Kalimpong",
    state: "West Bengal",
    basin: "Brahmaputra - Teesta Basin",
    coordinates: { latitude: 27.0980, longitude: 88.4520 },
    current_level_m: 4.50,
    previous_level_m: 4.47,
    warning_level_m: 7.50,
    danger_level_m: 8.40,
    highest_flood_level_m: 9.60,
    bed_level_m: 2.10,
    flow_velocity_ms: 2.3,
    discharge_cusecs: 2400,
    rate_of_rise_m_hr: 0.03,
    trend: "Stable",
    risk_level: "NORMAL",
    risk_color: "#22c55e",
    time_to_warning: "> 24 hours (Safe Clearance)",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 4.53, projected_delta_m: 0.03, risk_assessment: "NORMAL" },
        { horizon: "+3h", predicted_level_m: 4.59, projected_delta_m: 0.09, risk_assessment: "NORMAL" },
        { horizon: "+6h", predicted_level_m: 4.67, projected_delta_m: 0.17, risk_assessment: "NORMAL" }
      ],
      summary: "Controlled hydel reservoir levels; standard flow with 3.00m warning headroom."
    }
  },
  {
    id: "pykara-ooty",
    river_name: "Pykara River",
    station_name: "Pykara Dam Gauging Station",
    location: "Ooty",
    district: "Nilgiris",
    state: "Tamil Nadu",
    basin: "Cauvery - Bhavani Basin",
    coordinates: { latitude: 11.4550, longitude: 76.6020 },
    current_level_m: 3.40,
    previous_level_m: 3.32,
    warning_level_m: 5.00,
    danger_level_m: 5.50,
    highest_flood_level_m: 5.85,
    bed_level_m: 1.20,
    flow_velocity_ms: 2.2,
    discharge_cusecs: 1050,
    rate_of_rise_m_hr: 0.08,
    trend: "Rising",
    risk_level: "WATCH",
    risk_color: "#82cfff",
    time_to_warning: "20.0 hours",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 3.48, projected_delta_m: 0.08, risk_assessment: "WATCH" },
        { horizon: "+3h", predicted_level_m: 3.62, projected_delta_m: 0.22, risk_assessment: "WATCH" },
        { horizon: "+6h", predicted_level_m: 3.82, projected_delta_m: 0.42, risk_assessment: "WATCH" }
      ],
      summary: "Moderate hillside runoff observed from upper Nilgiri tea estates. Elevated watch (1.60m headroom)."
    }
  },
  {
    id: "kabini-wayanad",
    river_name: "Kabini River",
    station_name: "Mananthavady River Bridge",
    location: "Wayanad",
    district: "Wayanad",
    state: "Kerala",
    basin: "Kabini / Cauvery Basin",
    coordinates: { latitude: 11.8020, longitude: 76.0020 },
    current_level_m: 3.80,
    previous_level_m: 3.71,
    warning_level_m: 5.50,
    danger_level_m: 6.20,
    highest_flood_level_m: 6.90,
    bed_level_m: 1.10,
    flow_velocity_ms: 2.1,
    discharge_cusecs: 1350,
    rate_of_rise_m_hr: 0.09,
    trend: "Rising",
    risk_level: "WATCH",
    risk_color: "#82cfff",
    time_to_warning: "18.8 hours",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 3.89, projected_delta_m: 0.09, risk_assessment: "WATCH" },
        { horizon: "+3h", predicted_level_m: 4.05, projected_delta_m: 0.25, risk_assessment: "WATCH" },
        { horizon: "+6h", predicted_level_m: 4.28, projected_delta_m: 0.48, risk_assessment: "WATCH" }
      ],
      summary: "Steady monsoon runoff active in Banasura Hills catchment. Telemetry watch active (1.70m headroom)."
    }
  },
  {
    id: "beas-kullu",
    river_name: "Beas River",
    station_name: "Bhuntar Confluence Sensor",
    location: "Kullu",
    district: "Kullu",
    state: "Himachal Pradesh",
    basin: "Indus - Beas Basin",
    coordinates: { latitude: 31.9570, longitude: 77.1090 },
    current_level_m: 4.20,
    previous_level_m: 4.10,
    warning_level_m: 5.80,
    danger_level_m: 6.60,
    highest_flood_level_m: 7.80,
    bed_level_m: 1.60,
    flow_velocity_ms: 2.5,
    discharge_cusecs: 2200,
    rate_of_rise_m_hr: 0.10,
    trend: "Rising",
    risk_level: "WATCH",
    risk_color: "#82cfff",
    time_to_warning: "16.0 hours",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 4.30, projected_delta_m: 0.10, risk_assessment: "WATCH" },
        { horizon: "+3h", predicted_level_m: 4.48, projected_delta_m: 0.28, risk_assessment: "WATCH" },
        { horizon: "+6h", predicted_level_m: 4.72, projected_delta_m: 0.52, risk_assessment: "WATCH" }
      ],
      summary: "Parbati-Beas confluence showing moderate swelling from upper valley."
    }
  },
  {
    id: "alaknanda-rudraprayag",
    river_name: "Alaknanda River",
    station_name: "Rudraprayag Sangam Hydrometric Post",
    location: "Rudraprayag",
    district: "Rudraprayag",
    state: "Uttarakhand",
    basin: "Upper Ganga Basin",
    coordinates: { latitude: 30.2850, longitude: 78.9810 },
    current_level_m: 6.60,
    previous_level_m: 6.48,
    warning_level_m: 9.00,
    danger_level_m: 10.20,
    highest_flood_level_m: 11.50,
    bed_level_m: 2.50,
    flow_velocity_ms: 3.2,
    discharge_cusecs: 3600,
    rate_of_rise_m_hr: 0.12,
    trend: "Rising",
    risk_level: "WATCH",
    risk_color: "#82cfff",
    time_to_warning: "20.0 hours",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 6.72, projected_delta_m: 0.12, risk_assessment: "WATCH" },
        { horizon: "+3h", predicted_level_m: 6.94, projected_delta_m: 0.34, risk_assessment: "WATCH" },
        { horizon: "+6h", predicted_level_m: 7.24, projected_delta_m: 0.64, risk_assessment: "WATCH" }
      ],
      summary: "High volume flow from Joshimath confluence; active watch maintained (2.40m headroom)."
    }
  },
  {
    id: "muthirapuzha-munnar",
    river_name: "Muthirapuzha / Periyar River",
    station_name: "Old Munnar Bridge Telemetry Station",
    location: "Munnar",
    district: "Idukki",
    state: "Kerala",
    basin: "Periyar Basin",
    coordinates: { latitude: 10.0820, longitude: 77.0610 },
    current_level_m: 4.85,
    previous_level_m: 4.60,
    warning_level_m: 5.20,
    danger_level_m: 5.80,
    highest_flood_level_m: 6.40,
    bed_level_m: 1.50,
    flow_velocity_ms: 3.1,
    discharge_cusecs: 2450,
    rate_of_rise_m_hr: 0.25,
    trend: "Rising Rapidly",
    risk_level: "WARNING",
    risk_color: "#f5a623",
    time_to_warning: "1.4 hours",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 5.08, projected_delta_m: 0.23, risk_assessment: "WARNING" },
        { horizon: "+3h", predicted_level_m: 5.42, projected_delta_m: 0.57, risk_assessment: "WARNING_EXCEEDED" },
        { horizon: "+6h", predicted_level_m: 5.68, projected_delta_m: 0.83, risk_assessment: "WARNING_EXCEEDED" }
      ],
      summary: "River approaching Warning threshold due to localized Western Ghats downpour (~1.4h to warning)."
    }
  },
  {
    id: "pamba-pathanamthitta",
    river_name: "Pamba River",
    station_name: "Ranni - Sabarimala Foothills",
    location: "Pathanamthitta",
    district: "Pathanamthitta",
    state: "Kerala",
    basin: "Pamba Basin",
    coordinates: { latitude: 9.3820, longitude: 76.7840 },
    current_level_m: 6.05,
    previous_level_m: 5.65,
    warning_level_m: 6.00,
    danger_level_m: 6.80,
    highest_flood_level_m: 7.45,
    bed_level_m: 1.80,
    flow_velocity_ms: 3.6,
    discharge_cusecs: 3200,
    rate_of_rise_m_hr: 0.40,
    trend: "Rising Rapidly",
    risk_level: "CRITICAL",
    risk_color: "#ef5350",
    time_to_warning: "BREACHED (Active)",
    predictions_1h_3h_6h: {
      predictions: [
        { horizon: "+1h", predicted_level_m: 6.42, projected_delta_m: 0.37, risk_assessment: "WARNING_EXCEEDED" },
        { horizon: "+3h", predicted_level_m: 6.95, projected_delta_m: 0.90, risk_assessment: "DANGER_EXCEEDED" },
        { horizon: "+6h", predicted_level_m: 7.30, projected_delta_m: 1.25, risk_assessment: "DANGER_EXCEEDED" }
      ],
      summary: "WARNING LEVEL BREACHED: High volume flow from Western Ghats ridgeline spillway."
    }
  }
];

/**
 * Fetch all river monitoring stations from backend API with fallback
 */
export async function fetchRiverStations() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
  try {
    const res = await fetch(`${apiBaseUrl}/api/rivers`);
    if (!res.ok) {
      throw new Error(`API error: ${res.statusText}`);
    }
    const data = await res.json();
    if (data && data.success && Array.isArray(data.stations) && data.stations.length > 0) {
      return data.stations;
    }
    return BASELINE_RIVER_STATIONS;
  } catch (err) {
    console.warn("Using baseline river station telemetry fallback:", err.message);
    return BASELINE_RIVER_STATIONS;
  }
}

/**
 * Helper to get a nicely formatted prediction string for popup display
 */
export function getFormattedPrediction(station) {
  if (!station) return "Stable flow projected";

  if (station.predictions_1h_3h_6h) {
    const preds = station.predictions_1h_3h_6h.predictions || [];
    const p1 = preds.find((p) => p.horizon === "+1h")?.predicted_level_m;
    const p3 = preds.find((p) => p.horizon === "+3h")?.predicted_level_m;
    const p6 = preds.find((p) => p.horizon === "+6h")?.predicted_level_m;

    let horizonsStr = "";
    if (p1 !== undefined && p3 !== undefined && p6 !== undefined) {
      horizonsStr = `+1h: ${p1}m | +3h: ${p3}m | +6h: ${p6}m`;
    }

    const summary = station.predictions_1h_3h_6h.summary || "";
    if (summary && horizonsStr) {
      return `${summary} (${horizonsStr})`;
    }
    return summary || horizonsStr || "Stable flow projected";
  }

  // Fallback heuristic if predictions_1h_3h_6h missing
  const rate = Number(station.rate_of_rise_m_hr) || 0;
  const current = Number(station.current_level_m) || 0;
  const warning = Number(station.warning_level_m) || 0;
  const danger = Number(station.danger_level_m) || 0;

  if (rate > 0) {
    const p1 = Number((current + rate * 0.95).toFixed(2));
    const p3 = Number((current + rate * 0.90 * 3).toFixed(2));
    const p6 = Number((current + rate * 0.85 * 6).toFixed(2));
    const willCrossWarning = p3 >= warning && current < warning;
    const willCrossDanger = p6 >= danger && current < danger;

    let note = "Rising trend";
    if (willCrossDanger) note = "Projected to cross Danger Level within 6h";
    else if (willCrossWarning) note = "Projected to cross Warning Level within 3h";

    return `${note} (+1h: ${p1}m | +3h: ${p3}m | +6h: ${p6}m)`;
  }

  return "Steady water level; no warning breach projected (+1h, +3h, +6h stable).";
}
