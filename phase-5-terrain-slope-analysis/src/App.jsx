// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Terrain & Slope Analysis Feasibility Test
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react';

function DebugRow({ label, value }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value === null || value === undefined ? '—' : String(value)}</td>
    </tr>
  );
}

function formatMeters(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} m`;
}

function formatDegrees(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}°`;
}

function ElevationPreview({ grid }) {
  if (!grid?.grid?.length) return null;

  const flat = grid.grid.flat().filter((v) => v !== null);
  if (flat.length === 0) return null;

  const min = Math.min(...flat);
  const max = Math.max(...flat);

  return (
    <div>
      <p className="hint">Grayscale elevation preview (downsampled DEM)</p>
      <div
        className="elevation-preview"
        style={{
          gridTemplateColumns: `repeat(${grid.width}, 10px)`,
        }}
      >
        {grid.grid.flatMap((row, ri) =>
          row.map((value, ci) => {
            if (value === null) {
              return (
                <div
                  key={`${ri}-${ci}`}
                  className="elevation-preview-cell"
                  style={{ background: '#eee' }}
                />
              );
            }
            const t = max === min ? 0.5 : (value - min) / (max - min);
            const gray = Math.round(255 - t * 200);
            return (
              <div
                key={`${ri}-${ci}`}
                className="elevation-preview-cell"
                style={{ background: `rgb(${gray},${gray},${gray})` }}
                title={`${value.toFixed(0)} m`}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [location, setLocation] = useState('');
  const [phase, setPhase] = useState('idle');
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [authError, setAuthError] = useState(false);
  const isFetchingRef = useRef(false);

  async function handleAnalyseTerrain() {
    if (isFetchingRef.current) return;

    const loc = location.trim();
    if (!loc) {
      setErrorMsg('Please enter a location name.');
      setPhase('error');
      setData(null);
      return;
    }

    isFetchingRef.current = true;
    setPhase('loading');
    setErrorMsg('');
    setAuthError(false);
    setData(null);

    try {
      const res = await fetch(`/api/terrain?location=${encodeURIComponent(loc)}`);
      const json = await res.json();

      if (res.status === 401) {
        setAuthError(true);
        setErrorMsg(json.detail ?? json.error ?? 'OpenTopography API key required.');
        setPhase('error');
        return;
      }

      if (!res.ok) {
        setErrorMsg(json.detail ?? json.error ?? `Server error: HTTP ${res.status}`);
        setData(json);
        setPhase('error');
        return;
      }

      setData(json);
      setPhase('done');
    } catch (err) {
      setErrorMsg(`Network error: ${err.message}`);
      setPhase('error');
    } finally {
      isFetchingRef.current = false;
    }
  }

  const isLoading = phase === 'loading';
  const srtmConnected = phase === 'done' && data?.srtmConnected === true;
  const realDemData = phase === 'done' && data?.realDemData === true;

  return (
    <div>
      <h1>Phase 5 — Terrain &amp; Slope Analysis Test</h1>
      <p className="subtitle">
        Feasibility test — retrieves NASA SRTM GL1 terrain data via OpenTopography and computes
        elevation and slope features.
      </p>

      <hr />

      <h2>Location</h2>
      <div className="input-row">
        <input
          id="location-input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalyseTerrain()}
          placeholder="Enter Hilly Location"
          disabled={isLoading}
        />
        <button id="analyse-btn" onClick={handleAnalyseTerrain} disabled={isLoading}>
          {isLoading ? 'Analysing…' : 'Analyse Terrain'}
        </button>
      </div>
      <p className="hint">
        Examples: Coonoor · Ooty · Kodaikanal · Munnar · Gangtok · Shimla · Manali · Darjeeling
      </p>

      {isLoading && (
        <p className="status-loading">
          Fetching geocoding, SRTM point elevation, and DEM raster…
        </p>
      )}

      {authError && (
        <div className="auth-box">
          <h3>OpenTopography API Key Required</h3>
          <ol>
            <li>
              Register at{' '}
              <strong>https://portal.opentopography.org/newUser</strong>
            </li>
            <li>
              Request a free API key at{' '}
              <strong>https://portal.opentopography.org/requestService?service=api</strong>
            </li>
            <li>
              Copy the key into <code>phase-5-terrain-slope-analysis/.env</code>
            </li>
            <li>
              Set: <code>OPENTOPOGRAPHY_API_KEY=&lt;your key&gt;</code>
            </li>
            <li>
              Restart the server: <code>npm run dev</code>
            </li>
          </ol>
        </div>
      )}

      {phase === 'error' && !authError && errorMsg && (
        <p className="status-error">{errorMsg}</p>
      )}

      <div className="verification-box">
        <h3>Data Verification</h3>
        <p>
          <span className="data-label">SRTM Data Connected: </span>
          <span className={`data-value ${srtmConnected ? 'value-valid' : 'value-fail'}`}>
            {srtmConnected ? 'SRTM Data Connected' : 'SRTM Data Connection Failed'}
          </span>
        </p>
        <p>
          <span className="data-label">Real DEM Data: </span>
          <span className={`data-value ${realDemData ? 'value-valid' : 'value-fail'}`}>
            {realDemData ? 'Yes' : 'No'}
          </span>
        </p>
      </div>

      {data && phase === 'done' && (
        <>
          <hr />
          <h2>Location</h2>
          <p>
            <span className="data-label">Entered location: </span>
            <span className="data-value">{data.geo.enteredLocation}</span>
          </p>
          <p>
            <span className="data-label">Resolved location: </span>
            <span className="data-value">{data.geo.name}</span>
          </p>
          <p>
            <span className="data-label">State/Region: </span>
            <span className="data-value">{data.geo.admin1 ?? '—'}</span>
          </p>
          <p>
            <span className="data-label">Country: </span>
            <span className="data-value">{data.geo.country ?? '—'}</span>
          </p>
          <p>
            <span className="data-label">Latitude: </span>
            <span className="data-value">{data.geo.latitude}</span>
          </p>
          <p>
            <span className="data-label">Longitude: </span>
            <span className="data-value">{data.geo.longitude}</span>
          </p>
          {data.geo.timezone && (
            <p>
              <span className="data-label">Timezone: </span>
              <span className="data-value">{data.geo.timezone}</span>
            </p>
          )}

          <h2>Terrain Elevation</h2>
          <p>
            <span className="data-label">Elevation at location: </span>
            <span className="data-value">{formatMeters(data.elevation.atLocation)}</span>
          </p>
          <p>
            <span className="data-label">Minimum elevation: </span>
            <span className="data-value">{formatMeters(data.elevation.minElevation)}</span>
          </p>
          <p>
            <span className="data-label">Maximum elevation: </span>
            <span className="data-value">{formatMeters(data.elevation.maxElevation)}</span>
          </p>
          <p>
            <span className="data-label">Mean elevation: </span>
            <span className="data-value">{formatMeters(data.elevation.meanElevation)}</span>
          </p>
          <p>
            <span className="data-label">Local relief: </span>
            <span className="data-value">{formatMeters(data.elevation.localRelief)}</span>
          </p>

          <h2>Slope</h2>
          <p>
            <span className="data-label">Slope at location: </span>
            <span className="data-value">{formatDegrees(data.slope.atLocation)}</span>
          </p>
          <p>
            <span className="data-label">Mean slope: </span>
            <span className="data-value">{formatDegrees(data.slope.meanSlope)}</span>
          </p>
          <p>
            <span className="data-label">Maximum slope: </span>
            <span className="data-value">{formatDegrees(data.slope.maxSlope)}</span>
          </p>
          <p>
            <span className="data-label">Terrain classification: </span>
            <span className="data-value">{data.slope.terrainClassification ?? '—'}</span>
          </p>

          <h2>Data Source</h2>
          <p>
            <span className="data-label">Dataset: </span>
            <span className="data-value">{data.source.dataset}</span>
          </p>
          <p>
            <span className="data-label">Access: </span>
            <span className="data-value">{data.source.access}</span>
          </p>
          <p>
            <span className="data-label">Resolution: </span>
            <span className="data-value">{data.source.resolution}</span>
          </p>
          <p className="static-label">{data.source.dataType}</p>

          <ElevationPreview grid={data.preview} />

          <details>
            <summary>Debug Information</summary>
            <table className="debug-table">
              <tbody>
                <DebugRow label="Entered location" value={data.debug.enteredLocation} />
                <DebugRow label="Latitude" value={data.debug.latitude} />
                <DebugRow label="Longitude" value={data.debug.longitude} />
                <DebugRow label="Timezone" value={data.geo.timezone} />
                <DebugRow label="Bounding box north" value={data.debug.bboxNorth} />
                <DebugRow label="Bounding box south" value={data.debug.bboxSouth} />
                <DebugRow label="Bounding box east" value={data.debug.bboxEast} />
                <DebugRow label="Bounding box west" value={data.debug.bboxWest} />
                <DebugRow
                  label="SRTM point-elevation API status"
                  value={data.debug.pointElevationApiStatus}
                />
                <DebugRow
                  label="Center elevation from point API"
                  value={data.debug.centerElevationPointApi}
                />
                <DebugRow label="Global DEM API status" value={data.debug.globalDemApiStatus} />
                <DebugRow label="Downloaded GeoTIFF size (bytes)" value={data.debug.geotiffBytes} />
                <DebugRow
                  label="Downloaded GeoTIFF dimensions"
                  value={
                    data.debug.rasterWidth && data.debug.rasterHeight
                      ? `${data.debug.rasterWidth} × ${data.debug.rasterHeight}`
                      : '—'
                  }
                />
                <DebugRow label="Raster width" value={data.debug.rasterWidth} />
                <DebugRow label="Raster height" value={data.debug.rasterHeight} />
                <DebugRow
                  label="Raster cell width (degrees)"
                  value={data.debug.rasterCellWidthDeg}
                />
                <DebugRow
                  label="Raster cell height (degrees)"
                  value={data.debug.rasterCellHeightDeg}
                />
                <DebugRow label="Cell size X (meters)" value={data.debug.cellSizeXMeters} />
                <DebugRow label="Cell size Y (meters)" value={data.debug.cellSizeYMeters} />
                <DebugRow label="Number of valid cells" value={data.debug.validCellCount} />
                <DebugRow label="Number of no-data cells" value={data.debug.noDataCellCount} />
                <DebugRow label="Minimum raw elevation" value={data.debug.minRawElevation} />
                <DebugRow label="Maximum raw elevation" value={data.debug.maxRawElevation} />
                <DebugRow label="Mean raw elevation" value={data.debug.meanRawElevation} />
                <DebugRow
                  label="Center raster elevation"
                  value={data.debug.centerRasterElevation}
                />
                <DebugRow label="Point API elevation" value={data.debug.pointApiElevation} />
                <DebugRow
                  label="Difference (point API − raster center)"
                  value={data.debug.pointRasterDifference}
                />
                <DebugRow label="Mean slope" value={data.debug.meanSlope} />
                <DebugRow label="Maximum slope" value={data.debug.maxSlope} />
                <DebugRow label="Temporary file processing status" value={data.debug.tempFileStatus} />
                <DebugRow label="Source dataset" value={data.debug.sourceDataset} />
                <DebugRow label="Retrieval timestamp" value={data.debug.retrievalTimestamp} />
                <DebugRow label="Center raster row" value={data.debug.centerRasterRow} />
                <DebugRow label="Center raster col" value={data.debug.centerRasterCol} />
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
