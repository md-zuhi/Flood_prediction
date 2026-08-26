import { useRef, useState } from 'react';

const SUSCEPTIBILITY_COLOR = {
  LOW: '#2a7a2a',
  MODERATE: '#b07800',
  HIGH: '#c04000',
  'VERY HIGH': '#900',
};

function Row({ label, value }) {
  return (
    <p>
      <span className="label">{label}: </span>
      <span className="value">{value === null || value === undefined ? '—' : String(value)}</span>
    </p>
  );
}

function DebugRow({ label, value }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value === null || value === undefined ? '—' : String(value)}</td>
    </tr>
  );
}

const BLANK = new Set(['', 'null', 'undefined', 'na', 'nil', 'n/a', 'not available']);
function displayName(slideName, nhShLocation) {
  const clean = (v) => (v && !BLANK.has(String(v).trim().toLowerCase()) ? String(v).trim() : null);
  return clean(slideName) ?? clean(nhShLocation) ?? 'Location name unavailable';
}

function fmt(km) {
  if (km === null || km === undefined || !isFinite(km)) return '—';
  return `${km.toFixed(2)} km`;
}

export default function App() {
  const [location, setLocation] = useState('');
  const [phase, setPhase] = useState('idle');
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fetchingRef = useRef(false);

  async function handleAnalyse() {
    if (fetchingRef.current) return;
    const loc = location.trim();
    if (!loc) { setErrorMsg('Please enter a location name.'); setPhase('error'); return; }

    fetchingRef.current = true;
    setPhase('loading');
    setErrorMsg('');
    setData(null);

    try {
      const res = await fetch(`/api/analyse?location=${encodeURIComponent(loc)}`);
      const json = await res.json();
      if (!res.ok) { setErrorMsg(json.detail ?? json.error ?? `Server error ${res.status}`); setPhase('error'); return; }
      setData(json);
      setPhase('done');
    } catch (err) {
      setErrorMsg(`Network error: ${err.message}`);
      setPhase('error');
    } finally {
      fetchingRef.current = false;
    }
  }

  const isLoading = phase === 'loading';
  const d = data;

  return (
    <div>
      <h1>Phase 6 — Historical Landslide Analysis Test</h1>
      <p className="subtitle">
        Feasibility test — uses real GSI field-validated historical landslide inventory to calculate
        nearby historical events and susceptibility for any Tamil Nadu hilly location.
      </p>

      <hr />

      <div className="input-row">
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalyse()}
          placeholder="Enter Location"
          disabled={isLoading}
        />
        <button onClick={handleAnalyse} disabled={isLoading}>
          {isLoading ? 'Analysing…' : 'Analyse Landslide History'}
        </button>
      </div>
      <p className="hint">Examples: Coonoor · Ooty · Kodaikanal · Theni · Munnar · Chennai</p>

      {isLoading && <p className="status-loading">Geocoding location and analysing historical landslide records…</p>}
      {phase === 'error' && <p className="status-error">{errorMsg}</p>}

      {d?.outOfScope && (
        <div className="scope-box">
          <strong>Out of Scope</strong>
          <p>{d.message}</p>
          {d.geo && (
            <p className="hint">
              Resolved: {d.geo.name}, {d.geo.admin1}, {d.geo.country} ({d.geo.latitude}, {d.geo.longitude})
            </p>
          )}
        </div>
      )}

      {phase === 'done' && d && !d.outOfScope && (
        <>
          <hr />

          <h2>Location Information</h2>
          <Row label="Entered location" value={d.geo.enteredLocation} />
          <Row label="Resolved location" value={d.geo.name} />
          <Row label="State / Region" value={d.geo.admin1} />
          <Row label="Country" value={d.geo.country} />
          <Row label="Latitude" value={d.geo.latitude} />
          <Row label="Longitude" value={d.geo.longitude} />

          <h2>Historical Landslide Analysis</h2>
          <Row label="Nearest historical landslide" value={d.analysis.nearestEvent ? displayName(d.analysis.nearestEvent.slideName, d.analysis.nearestEvent.nhShLocation) : '—'} />
          <Row label="Distance to nearest" value={fmt(d.analysis.nearestEvent?.distanceKm)} />
          <Row label="Landslides within 5 km" value={d.analysis.within5km} />
          <Row label="Landslides within 10 km" value={d.analysis.within10km} />
          <Row label="Landslides within 25 km" value={d.analysis.within25km} />
          <Row label="Total records checked" value={d.analysis.totalChecked} />

          <div className="susceptibility-box" style={{ borderColor: SUSCEPTIBILITY_COLOR[d.analysis.susceptibility] ?? '#555' }}>
            <span className="sus-label">Historical Landslide Susceptibility</span>
            <span className="sus-value" style={{ color: SUSCEPTIBILITY_COLOR[d.analysis.susceptibility] ?? '#555' }}>
              {d.analysis.susceptibility}
            </span>
            <p className="hint">Historical susceptibility is based only on nearby recorded GSI landslide events. It is not a live landslide prediction or current hazard warning.</p>
          </div>

          {d.analysis.nearestEvent && (
            <>
              <h2>Nearest Historical Event</h2>
              <Row label="Slide number" value={d.analysis.nearestEvent.slideNo} />
              <Row label="Location / Name" value={displayName(d.analysis.nearestEvent.slideName, d.analysis.nearestEvent.nhShLocation)} />
              <Row label="District" value={d.analysis.nearestEvent.district} />
              <Row label="Latitude" value={d.analysis.nearestEvent.latitude} />
              <Row label="Longitude" value={d.analysis.nearestEvent.longitude} />
              <Row label="Material involved" value={d.analysis.nearestEvent.materialInvolved} />
              <Row label="Movement type" value={d.analysis.nearestEvent.movementType} />
              <Row label="History / Date" value={d.analysis.nearestEvent.history} />
              <Row label="Distance from searched location" value={fmt(d.analysis.nearestEvent.distanceKm)} />
            </>
          )}

          {d.analysis.nearest5Events?.length > 0 && (
            <>
              <h2>Nearest 5 Historical Events</h2>
              <table className="events-table">
                <thead>
                  <tr>
                    <th>Distance</th>
                    <th>Location / Name</th>
                    <th>District</th>
                    <th>Material</th>
                    <th>Movement</th>
                    <th>History</th>
                  </tr>
                </thead>
                <tbody>
                  {d.analysis.nearest5Events.map((e, i) => (
                    <tr key={i}>
                      <td>{fmt(e.distanceKm)}</td>
                      <td>{displayName(e.slideName, e.nhShLocation)}</td>
                      <td>{e.district}</td>
                      <td>{e.materialInvolved || '—'}</td>
                      <td>{e.movementType || '—'}</td>
                      <td>{e.history || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h2>Data Source</h2>
          <Row label="Source" value={d.source.name} />
          <Row label="Dataset" value={d.source.dataset} />
          <p className="static-label">{d.source.dataType}</p>

          <details>
            <summary>Debug Information</summary>
            <table className="debug-table">
              <tbody>
                <DebugRow label="Entered location" value={d.debug.enteredLocation} />
                <DebugRow label="Resolved latitude" value={d.debug.resolvedLatitude} />
                <DebugRow label="Resolved longitude" value={d.debug.resolvedLongitude} />
                <DebugRow label="CSV file loaded" value={d.debug.csvLoaded ? 'Yes' : 'No'} />
                <DebugRow label="Total CSV rows" value={d.debug.totalCsvRows} />
                <DebugRow label="Valid coordinate rows" value={d.debug.validCoordinateRows} />
                <DebugRow label="Invalid coordinate rows" value={d.debug.invalidCoordinateRows} />
                <DebugRow label="Nearest distance (km)" value={d.debug.nearestDistanceKm?.toFixed(4)} />
                <DebugRow label="Count within 5 km" value={d.debug.within5km} />
                <DebugRow label="Count within 10 km" value={d.debug.within10km} />
                <DebugRow label="Count within 25 km" value={d.debug.within25km} />
                <DebugRow label="Geocoding API status" value={d.debug.geocodingStatus} />
                <DebugRow label="Processing timestamp" value={d.debug.processingTimestamp} />
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
