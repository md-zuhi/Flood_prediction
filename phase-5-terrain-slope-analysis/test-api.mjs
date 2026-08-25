import dotenv from 'dotenv';
dotenv.config();

const key = process.env.OPENTOPOGRAPHY_API_KEY;
console.log('Key loaded:', !!key, '| Length:', key?.length);

// Test 1: Point Elevation API (sanity check coordinate)
const pointUrl = `https://portal.opentopography.org/API/v1/elevation?latitude=11.353&longitude=76.795&dataset=SRTM_GL1&API_Key=${key}`;
console.log('\n--- Point Elevation API ---');
try {
  const r = await fetch(pointUrl, { signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  console.log('HTTP:', r.status);
  console.log('Body:', text.substring(0, 600));
} catch (e) {
  console.error('ERROR:', e.message);
}

// Test 2: Geocoding (Coonoor)
console.log('\n--- Geocoding: Coonoor ---');
try {
  const geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?name=Coonoor&count=1&language=en&format=json';
  const r = await fetch(geoUrl, { signal: AbortSignal.timeout(15000) });
  const data = await r.json();
  console.log('HTTP:', r.status);
  if (data.results?.length) {
    const p = data.results[0];
    console.log(`Resolved: ${p.name}, ${p.admin1}, ${p.country}`);
    console.log(`Lat: ${p.latitude}, Lon: ${p.longitude}`);
  } else {
    console.log('No results:', JSON.stringify(data));
  }
} catch (e) {
  console.error('ERROR:', e.message);
}
