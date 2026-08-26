import { loadLandslides, analyseLocation } from './landslide.js';

const { records, totalRows, validRows, invalidRows } = loadLandslides();
console.log(`CSV: total=${totalRows} valid=${validRows} invalid=${invalidRows}`);

const tests = [
  { name: 'Coonoor',    lat: 11.34979, lon: 76.79375 },
  { name: 'Ooty',       lat: 11.41379, lon: 76.69542 },
  { name: 'Kodaikanal', lat: 10.23952, lon: 77.48938 },
  { name: 'Theni',      lat: 10.01204, lon: 77.47695 },
];

for (const t of tests) {
  const r = analyseLocation(records, t.lat, t.lon);
  const n = r.nearestEvent;
  console.log(`\n${t.name} (${t.lat}, ${t.lon})`);
  console.log(`  within5=${r.within5km} within10=${r.within10km} within25=${r.within25km}`);
  console.log(`  susceptibility=${r.susceptibility}`);
  console.log(`  nearest: ${(n?.slideName || n?.nhShLocation || '?')} @ ${n?.distanceKm.toFixed(3)} km`);
}
