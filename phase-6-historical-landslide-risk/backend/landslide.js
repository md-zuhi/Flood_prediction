// landslide.js — CSV parsing + Haversine distance analysis

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '..', 'data', 'tamilnadu_landslide_inventory.csv');

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

// Parse a CSV line respecting quoted fields
function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

export function loadLandslides() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at ${CSV_PATH}`);
  }

  const text = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, ''); // strip BOM
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // header: sl_no,slide_no,state,district,slide_name,nh_sh_location,latitude,longitude,material_involved,movement_type,history
  const records = [];
  let invalidCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const lat = parseFloat(cols[6]);
    const lon = parseFloat(cols[7]);

    if (!isFinite(lat) || !isFinite(lon) || lat === 0 || lon === 0) {
      invalidCount++;
      continue;
    }

    records.push({
      slNo: cols[0] || '',
      slideNo: cols[1] || '',
      state: cols[2] || '',
      district: cols[3] || '',
      slideName: cols[4] || '',
      nhShLocation: cols[5] || '',
      latitude: lat,
      longitude: lon,
      materialInvolved: cols[8] || '',
      movementType: cols[9] || '',
      history: cols[10] || '',
    });
  }

  return {
    records,
    totalRows: lines.length - 1,
    validRows: records.length,
    invalidRows: invalidCount,
  };
}

export function susceptibilityLabel(count10km) {
  if (count10km === 0) return 'LOW';
  if (count10km <= 5) return 'MODERATE';
  if (count10km <= 15) return 'HIGH';
  return 'VERY HIGH';
}

export function analyseLocation(records, userLat, userLon) {
  const withDistance = records.map((r) => ({
    ...r,
    distanceKm: haversineKm(userLat, userLon, r.latitude, r.longitude),
  }));

  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  const within5 = withDistance.filter((r) => r.distanceKm <= 5).length;
  const within10 = withDistance.filter((r) => r.distanceKm <= 10).length;
  const within25 = withDistance.filter((r) => r.distanceKm <= 25).length;

  const nearest = withDistance[0] ?? null;
  const nearest5 = withDistance.slice(0, 5);

  return {
    nearestEvent: nearest,
    nearest5Events: nearest5,
    within5km: within5,
    within10km: within10,
    within25km: within25,
    susceptibility: susceptibilityLabel(within10),
    totalChecked: records.length,
  };
}
