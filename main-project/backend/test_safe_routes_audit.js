const { calculateSafeEvacuationRoute } = require("./services/safeRouteService");
const { evaluateDestinationHazards } = require("./services/safeDestinationService");

async function runAuditTests() {
  console.log("==================================================");
  console.log("SAFE ROUTES FINAL INTEGRITY & CONSISTENCY AUDIT");
  console.log("==================================================\n");

  // TEST 1 — COONOOR AUDIT
  console.log("--- VALIDATION TEST 1 — COONOOR (11.3533, 76.7959) ---");
  const coonoorResult = await calculateSafeEvacuationRoute(11.3533, 76.7959, null, {
    name: "Coonoor",
    state: "Tamil Nadu",
    country: "India"
  }, { testMode: false });

  const dest = coonoorResult.recommended_destination;
  const route = coonoorResult.recommended_route;
  const env = route.environmental_summary;

  console.log("Selected shelter:", dest.name);
  console.log("Verification status:", dest.verification_status);
  console.log("Destination safety score:", dest.destination_safety_score);
  console.log("Destination flood risk:", dest.flood_risk || dest.destination_hazards?.flood_risk);
  console.log("Destination landslide risk:", dest.landslide_risk || dest.destination_hazards?.landslide_risk);
  console.log("Destination elevation:", dest.elevation_m);
  console.log("Destination data coverage:", dest.destination_data_coverage, "%");
  console.log("Destination confidence:", dest.destination_data_confidence);
  console.log("---");
  console.log("Route safety score:", route.safety_score);
  console.log("Route classification:", route.risk_classification);
  console.log("Mappls ETA:", route.mappls_eta_minutes, "min");
  console.log("TomTom ETA:", route.tomtom_traffic_eta_minutes, "min");
  console.log("---");
  console.log("Environmental sample count:", env.route_sample_count);
  console.log("Max route flood probability:", env.max_flood_probability);
  console.log("Average route flood probability:", env.average_flood_probability);
  console.log("Maximum landslide exposure:", env.max_landslide_exposure);
  console.log("---");
  console.log("TomTom closures:", route.incidents?.closures_count);
  console.log("TomTom incidents:", route.incidents?.total_count);
  console.log("---");
  console.log("Route data coverage:", route.route_data_coverage, "%");
  console.log("Route confidence:", route.route_data_confidence);
  console.log("Overall data coverage:", coonoorResult.overall_data_coverage, "%");
  console.log("Overall confidence:", coonoorResult.overall_data_confidence);
  console.log("Why this route reasons:", route.reasons);
  console.log("\n==================================================\n");

  // TEST 2 — CONTROLLED MISSING DATA FAILURE TEST
  console.log("--- VALIDATION TEST 2 — CONTROLLED MISSING DATA FAILURE TEST ---");
  // Evaluate coordinates with zero data (simulating total API failure)
  const missingDataEval = await evaluateDestinationHazards(null, null);
  console.log("Missing Data Evaluation Status:", missingDataEval.evaluation_status);
  console.log("Missing Data Flood Risk:", missingDataEval.flood_risk);
  console.log("Missing Data Landslide Risk:", missingDataEval.landslide_risk);
  console.log("Missing Data Destination Score:", missingDataEval.destination_safety_score);
  console.log("Missing Data Coverage:", missingDataEval.destination_data_coverage, "%");
  console.log("Missing Data Confidence:", missingDataEval.destination_data_confidence);

  const missingScoreIsSafe = missingDataEval.destination_safety_score === 100;
  const missingRiskIsLow = missingDataEval.flood_risk === "LOW" || missingDataEval.landslide_risk === "LOW";
  console.log("VERIFICATION — Missing Score == 100:", missingScoreIsSafe ? "FAILED (STILL 100)" : "PASSED (NOT 100)");
  console.log("VERIFICATION — Missing Risk == LOW:", missingRiskIsLow ? "FAILED (CONVERTED TO LOW)" : "PASSED (STAYED UNKNOWN)");
  console.log("\n==================================================\n");

  // TEST 3 — 5-REGION REGRESSION TEST
  console.log("--- VALIDATION TEST 3 — REGRESSION ACROSS ALL 5 NILGIRIS REGIONS ---");
  const testRegions = [
    { name: "Coonoor", lat: 11.3533, lon: 76.7959 },
    { name: "Ooty", lat: 11.4102, lon: 76.6950 },
    { name: "Kotagiri", lat: 11.4230, lon: 76.8580 },
    { name: "Gudalur", lat: 11.5033, lon: 76.4950 },
    { name: "Kundah", lat: 11.2380, lon: 76.6210 }
  ];

  for (const reg of testRegions) {
    console.log(`Testing ${reg.name} (${reg.lat}, ${reg.lon})...`);
    const res = await calculateSafeEvacuationRoute(reg.lat, reg.lon, null, { name: reg.name }, { testMode: false });
    const r = res.recommended_route;
    const d = res.recommended_destination;
    console.log(`  ✓ Destination: ${d.name} (${d.verification_status}, Dest Score: ${d.destination_safety_score})`);
    console.log(`  ✓ Route: ${r.distance_km} km | Mappls ETA: ${r.mappls_eta_minutes} min | Route Score: ${r.safety_score}`);
    console.log(`  ✓ Samples: ${r.environmental_summary.route_sample_count} pts | Max Flood: ${r.environmental_summary.max_flood_probability}% | Overall Coverage: ${res.overall_data_coverage}% (${res.overall_data_confidence})`);
  }

  console.log("\n==================================================");
  console.log("ALL INTEGRITY AUDIT TESTS COMPLETE");
  console.log("==================================================");
}

runAuditTests().catch(err => {
  console.error("Audit test execution error:", err);
  process.exit(1);
});
