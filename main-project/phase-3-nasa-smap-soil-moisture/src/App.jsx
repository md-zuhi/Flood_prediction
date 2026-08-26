// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — NASA SMAP NRT Soil Moisture Feasibility Test
// React Frontend
//
// Flow:
//   User types location → geocode → lat/lon → GET /api/smap → display result
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';

// ── Helper: format ISO timestamp readably ─────────────────────────────────────
function fmtTime(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(isoStr)) + ' IST';
  } catch {
    return isoStr;
  }
}

// ── Quality badge text ────────────────────────────────────────────────────────
function qualityDisplay(q) {
  switch (q) {
    case 'valid':        return { text: 'Valid (recommended quality)', cls: 'value-valid' };
    case 'poor_quality': return { text: 'Poor quality (flag set)',     cls: 'value-quality' };
    case 'fill_value':   return { text: 'No retrieval (fill value)',   cls: 'value-fill' };
    case 'no_coverage':  return { text: 'No coverage at this location', cls: 'value-fill' };
    default:             return { text: q ?? '—',                      cls: '' };
  }
}

// ── Debug table row ───────────────────────────────────────────────────────────
function DebugRow({ label, value }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value === null || value === undefined ? '—' : String(value)}</td>
    </tr>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [location,  setLocation]  = useState('Ooty');
  const [phase,     setPhase]     = useState('idle'); // idle | geocoding | fetching | done | error
  const [geoData,   setGeoData]   = useState(null);   // {latitude, longitude, displayName}
  const [smapData,  setSmapData]  = useState(null);   // full API response
  const [errorMsg,  setErrorMsg]  = useState('');
  const [authError, setAuthError] = useState(false);
  const isFetchingRef = useRef(false);

  // ── Main fetch pipeline ─────────────────────────────────────────────────────
  async function handleGetSoilMoisture() {
    if (isFetchingRef.current) return;
    const loc = location.trim();
    if (!loc) { setErrorMsg('Please enter a location name.'); return; }

    isFetchingRef.current = true;
    setPhase('geocoding');
    setErrorMsg('');
    setAuthError(false);
    setSmapData(null);
    setGeoData(null);

    try {
      // Step 1: Geocode
      const geoRes  = await fetch(`/api/geocode?location=${encodeURIComponent(loc)}`);
      const geoJson = await geoRes.json();

      if (!geoRes.ok) {
        setErrorMsg(geoJson.error ?? 'Geocoding failed.');
        setPhase('error');
        return;
      }

      setGeoData(geoJson);
      setPhase('fetching');

      // Step 2: Fetch NASA SMAP data
      const smapRes  = await fetch(
        `/api/smap?lat=${geoJson.latitude}&lon=${geoJson.longitude}`
      );
      const smapJson = await smapRes.json();

      if (smapRes.status === 401) {
        setAuthError(true);
        setErrorMsg(smapJson.detail ?? smapJson.error ?? 'Authentication required.');
        setSmapData(smapJson);
        setPhase('error');
        return;
      }

      if (!smapRes.ok) {
        setErrorMsg(smapJson.error ?? `Server error: HTTP ${smapRes.status}`);
        setSmapData(smapJson);
        setPhase('error');
        return;
      }

      setSmapData(smapJson);
      setPhase('done');

    } catch (err) {
      setErrorMsg(`Network error: ${err.message}`);
      setPhase('error');
    } finally {
      isFetchingRef.current = false;
    }
  }

  const isLoading = phase === 'geocoding' || phase === 'fetching';
  const qd = smapData ? qualityDisplay(smapData.quality) : null;

  return (
    <div>
      <h1>NASA SMAP Soil Moisture Test</h1>
      <p className="subtitle">
        Phase 3 feasibility test — retrieves real NASA SMAP NRT satellite data.<br />
        Dataset: <strong>SPL2SMP_NRT v107</strong> · Source: NASA / NSIDC DAAC
      </p>

      <hr />

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="input-row">
        <input
          id="location-input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGetSoilMoisture()}
          placeholder="Enter location (e.g. Ooty, Munnar)"
          disabled={isLoading}
        />
        <button
          id="get-sm-btn"
          onClick={handleGetSoilMoisture}
          disabled={isLoading}
        >
          {isLoading ? 'Fetching…' : 'Get Soil Moisture'}
        </button>
      </div>

      <p style={{ fontSize: '0.75rem', color: '#888' }}>
        Examples: Ooty · Kodaikanal · Munnar · Darjeeling · Shimla · Manali · Gangtok
      </p>

      {/* ── Status ─────────────────────────────────────────────────────────── */}
      {phase === 'geocoding' && (
        <p className="status-loading">Step 1/2 — Geocoding location via Nominatim…</p>
      )}
      {phase === 'fetching' && (
        <p className="status-loading">
          Step 2/2 — Fetching latest NASA SMAP observation (downloading HDF5, may take 30–120s)…
        </p>
      )}

      {/* ── Auth error box ──────────────────────────────────────────────────── */}
      {authError && (
        <div className="auth-box">
          <h3>⛔ NASA Earthdata Authentication Required</h3>
          <p>You need a free NASA Earthdata Bearer Token to download SMAP data.</p>
          <ol>
            <li>Go to <strong>https://urs.earthdata.nasa.gov/</strong> and create a free account.</li>
            <li>Log in → click your username → <strong>Generate Token</strong>.</li>
            <li>Copy the token string.</li>
            <li>Open the file <code>phase-3-nasa-smap-soil-moisture/.env</code></li>
            <li>Set: <code>EARTHDATA_TOKEN=&lt;paste your token here&gt;</code></li>
            <li>Restart the server: <code>npm run dev</code></li>
          </ol>
        </div>
      )}

      {/* ── Generic error ───────────────────────────────────────────────────── */}
      {phase === 'error' && !authError && errorMsg && (
        <p className="status-error">Error: {errorMsg}</p>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {(geoData || smapData) && (
        <>
          <hr />
          <h2>Result</h2>

          {geoData && (
            <>
              <p>
                <span className="data-label">Location: </span>
                <span className="data-value">{geoData.displayName}</span>
              </p>
              <p>
                <span className="data-label">Coordinates: </span>
                <span className="data-value">{geoData.latitude}, {geoData.longitude}</span>
              </p>
            </>
          )}

          {smapData && phase === 'done' && (
            <>
              <p style={{ marginTop: '10px' }}>
                <span className="data-label">Latest Surface Soil Moisture: </span>
                <span className={`data-value ${smapData.soilMoisture !== null ? 'value-valid' : 'value-fill'}`}>
                  {smapData.soilMoisture !== null
                    ? `${smapData.soilMoisture} m³/m³`
                    : 'No valid value — see quality below'}
                </span>
              </p>
              <p>
                <span className="data-label">Observation Time: </span>
                <span className="data-value">{fmtTime(smapData.observationTime)}</span>
              </p>
              <p>
                <span className="data-label">Observation Age: </span>
                <span className="data-value">
                  {smapData.observationAgeHours < 24
                    ? `${smapData.observationAgeHours} hours ago`
                    : `${smapData.observationAgeDays} days ago`}
                </span>
              </p>
              <p>
                <span className="data-label">Dataset: </span>
                <span className="data-value">{smapData.dataset} v{smapData.version}</span>
              </p>
              <p>
                <span className="data-label">Source: </span>
                <span className="data-value">NASA SMAP / NSIDC DAAC</span>
              </p>
              <p>
                <span className="data-label">Quality: </span>
                <span className={`data-value ${qd?.cls}`}>{qd?.text}</span>
              </p>
              <p>
                <span className="data-label">Orbit Group: </span>
                <span className="data-value">{smapData.orbitGroup}</span>
              </p>
              <p>
                <span className="data-label">Nearest EASE-Grid Cell: </span>
                <span className="data-value">
                  {smapData.nearestGridLat?.toFixed(3)}, {smapData.nearestGridLon?.toFixed(3)}
                  {' '}({smapData.nearestGridDistanceKm} km away)
                </span>
              </p>
              <p>
                <span className="data-label">Connection Status: </span>
                <span className="data-value value-valid">NASA Data Connected</span>
              </p>

              {/* Show quality error if present */}
              {smapData.qualityError && (
                <p className="status-warn">⚠ {smapData.qualityError}</p>
              )}
            </>
          )}

          {/* ── Debug Section ──────────────────────────────────────────────── */}
          {smapData && (
            <details>
              <summary>▶ Debug Information (click to expand)</summary>
              <table className="debug-table">
                <tbody>
                  <DebugRow label="Requested location"      value={location} />
                  <DebugRow label="Geocoded lat"            value={geoData?.latitude} />
                  <DebugRow label="Geocoded lon"            value={geoData?.longitude} />
                  <DebugRow label="Geocoded display name"   value={geoData?.displayName} />
                  <DebugRow label="NASA dataset ID"         value={smapData.dataset} />
                  <DebugRow label="Dataset version"         value={smapData.version} />
                  <DebugRow label="Granule name"            value={smapData.granuleName} />
                  <DebugRow label="Granule start time"      value={smapData.granuleStartTime} />
                  <DebugRow label="Granule end time"        value={smapData.granuleEndTime} />
                  <DebugRow label="Orbit group (AM/PM)"     value={smapData.orbitGroup} />
                  <DebugRow label="Nearest grid lat"        value={smapData.nearestGridLat?.toFixed(4)} />
                  <DebugRow label="Nearest grid lon"        value={smapData.nearestGridLon?.toFixed(4)} />
                  <DebugRow label="Distance to grid cell"   value={smapData.nearestGridDistanceKm + ' km'} />
                  <DebugRow label="Soil moisture raw value" value={smapData.rawValue} />
                  <DebugRow label="Quality flag (uint16)"   value={smapData.qualityFlag} />
                  <DebugRow label="Quality label"           value={smapData.quality} />
                  <DebugRow label="Auth status"             value={smapData.authStatus} />
                  <DebugRow label="CMR search URL"          value={smapData.cmrSearchUrl} />
                  <DebugRow label="Download URL"            value={smapData.downloadUrl} />
                </tbody>
              </table>

              <p style={{ marginTop: '10px', fontSize: '0.82rem' }}>
                <strong>Full API response JSON:</strong>
              </p>
              <pre id="raw-json">{JSON.stringify(smapData, null, 2)}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}
