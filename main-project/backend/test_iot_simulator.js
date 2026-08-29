// Backend smoke test: verify iotSimulatorService and fusionService IoT integration
'use strict';

const { getIoTReading } = require('./services/iotSimulatorService');

// ─── Test A: Valid coordinates ─────────────────────────────────────────────
console.log('\n=== A. getIoTReading — valid coords ===');
const r1 = getIoTReading(11.35, 76.80);
console.log(JSON.stringify(r1, null, 2));

let pass = 0, fail = 0;

function check(label, condition) {
  if (condition) { console.log(`  ✅ PASS: ${label}`); pass++; }
  else           { console.error(`  ❌ FAIL: ${label}`); fail++; }
}

check('available = true',              r1.available === true);
check('status = success',              r1.status === 'success');
check('source = SIMULATED_IOT',        r1.source === 'SIMULATED_IOT');
check('simulated = true',              r1.simulated === true);
check('observation_time is string',    typeof r1.observation_time === 'string');
check('rainfall_mm >= 0',             typeof r1.rainfall_mm === 'number' && r1.rainfall_mm >= 0);
check('soil_moisture in range',        r1.soil_moisture >= 0.05 && r1.soil_moisture <= 0.55);
check('water_level >= 0',             typeof r1.water_level === 'number' && r1.water_level >= 0);
check('temperature_c is number',       typeof r1.temperature_c === 'number');
check('humidity_percent in range',     r1.humidity_percent >= 20 && r1.humidity_percent <= 100);

// ─── Test B: Invalid coordinates → failure object ─────────────────────────
console.log('\n=== B. getIoTReading — invalid coords ===');
const r2 = getIoTReading('bad', null);
console.log(JSON.stringify(r2, null, 2));
check('available = false on bad coords', r2.available === false);
check('status = failed on bad coords',   r2.status === 'failed');
check('error field present',             typeof r2.error === 'string');
check('source still SIMULATED_IOT',      r2.source === 'SIMULATED_IOT');
check('simulated = true on failure',     r2.simulated === true);

// ─── Test C: Determinism — same result within same UTC hour ───────────────
console.log('\n=== C. Determinism check ===');
const r3a = getIoTReading(11.35, 76.80);
const r3b = getIoTReading(11.35, 76.80);
check('rainfall_mm is deterministic',      r3a.rainfall_mm    === r3b.rainfall_mm);
check('soil_moisture is deterministic',    r3a.soil_moisture  === r3b.soil_moisture);
check('water_level is deterministic',      r3a.water_level    === r3b.water_level);
check('temperature_c is deterministic',    r3a.temperature_c  === r3b.temperature_c);
check('humidity_percent is deterministic', r3a.humidity_percent === r3b.humidity_percent);

// ─── Test D: Different locations differ ───────────────────────────────────
console.log('\n=== D. Location variety check ===');
const r4a = getIoTReading(11.35, 76.80);
const r4b = getIoTReading(28.61, 77.21);  // Delhi coords
const differs = r4a.rainfall_mm !== r4b.rainfall_mm ||
                r4a.soil_moisture !== r4b.soil_moisture;
check('Different locations produce different readings', differs);

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n==============================`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail === 0) console.log('✅ IoT Simulator — All checks PASSED');
else            console.error('❌ Some checks FAILED');
process.exit(fail > 0 ? 1 : 0);
