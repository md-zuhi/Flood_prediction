// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Rainfall Forecast Feasibility Test
// React Frontend
//
// Flow:
//   User types location → Open-Meteo Geocoding → Forecast API → display results
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react';
import {
  formatMm,
  formatMmPerHour,
  formatTimestamp,
  getRainfallForecast,
} from './openMeteo.js';

function DebugRow({ label, value }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value === null || value === undefined ? '—' : String(value)}</td>
    </tr>
  );
}

export default function App() {
  const [location, setLocation] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const isFetchingRef = useRef(false);

  async function handleGetForecast() {
    if (isFetchingRef.current) return;

    const loc = location.trim();
    if (!loc) {
      setErrorMsg('Please enter a location name.');
      setPhase('error');
      setResult(null);
      return;
    }

    isFetchingRef.current = true;
    setPhase('loading');
    setErrorMsg('');
    setResult(null);

    try {
      const data = await getRainfallForecast(loc);
      setResult(data);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err.message || 'Unable to retrieve rainfall forecast for this location.');
      setPhase('error');
    } finally {
      isFetchingRef.current = false;
    }
  }

  const isLoading = phase === 'loading';
  const { geo, forecast } = result ?? {};
  const apiConnected = phase === 'done' && !!forecast;
  const realApiData = apiConnected;

  return (
    <div>
      <h1>Phase 4 — Rainfall Forecast Test</h1>
      <p className="subtitle">
        Feasibility test — retrieves real hourly precipitation forecasts from Open-Meteo.
      </p>

      <hr />

      <h2>Location Search</h2>
      <div className="input-row">
        <input
          id="location-input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGetForecast()}
          placeholder="Enter location"
          disabled={isLoading}
        />
        <button id="get-forecast-btn" onClick={handleGetForecast} disabled={isLoading}>
          {isLoading ? 'Fetching…' : 'Get Rainfall Forecast'}
        </button>
      </div>
      <p className="hint">
        Examples: Ooty · Kodaikanal · Munnar · Darjeeling · Shimla · Manali · Gangtok
      </p>

      {isLoading && <p className="status-loading">Fetching rainfall forecast…</p>}

      {phase === 'error' && errorMsg && (
        <p className="status-error">{errorMsg}</p>
      )}

      <div className="verification-box">
        <h3>Data Verification</h3>
        <p>
          <span className="data-label">Real API Data: </span>
          <span className={`data-value ${realApiData ? 'value-valid' : ''}`}>
            {realApiData ? 'Yes' : 'No'}
          </span>
        </p>
        <p>
          <span className="data-label">API Status: </span>
          <span className={`data-value ${apiConnected ? 'value-valid' : 'value-fail'}`}>
            {apiConnected ? 'Connected' : 'Failed'}
          </span>
        </p>
      </div>

      {geo && forecast && phase === 'done' && (
        <>
          <hr />
          <h2>Location Information</h2>
          <p>
            <span className="data-label">Location: </span>
            <span className="data-value">{geo.name}</span>
          </p>
          <p>
            <span className="data-label">State/Region: </span>
            <span className="data-value">{geo.admin1 ?? '—'}</span>
          </p>
          <p>
            <span className="data-label">Country: </span>
            <span className="data-value">{geo.country ?? '—'}</span>
          </p>
          <p>
            <span className="data-label">Latitude: </span>
            <span className="data-value">{geo.latitude}</span>
          </p>
          <p>
            <span className="data-label">Longitude: </span>
            <span className="data-value">{geo.longitude}</span>
          </p>
          <p>
            <span className="data-label">Timezone: </span>
            <span className="data-value">{forecast.timezone}</span>
          </p>

          <h2>Forecast Summary</h2>
          <div className="card-grid">
            <div className="card">
              <div className="card-label">Next 1 Hour Rainfall</div>
              <div className="card-value">{formatMm(forecast.windows.next1h)}</div>
            </div>
            <div className="card">
              <div className="card-label">Next 3 Hours Rainfall</div>
              <div className="card-value">{formatMm(forecast.windows.next3h)}</div>
            </div>
            <div className="card">
              <div className="card-label">Next 6 Hours Rainfall</div>
              <div className="card-value">{formatMm(forecast.windows.next6h)}</div>
            </div>
            <div className="card">
              <div className="card-label">Next 12 Hours Rainfall</div>
              <div className="card-value">{formatMm(forecast.windows.next12h)}</div>
            </div>
            <div className="card">
              <div className="card-label">Next 24 Hours Rainfall</div>
              <div className="card-value">{formatMm(forecast.windows.next24h)}</div>
            </div>
          </div>

          <h2>Peak Forecast</h2>
          <p>
            <span className="data-label">Peak Hourly Rainfall: </span>
            <span className="data-value">{formatMmPerHour(forecast.peak.value)}</span>
          </p>
          <p>
            <span className="data-label">Expected Peak Time: </span>
            <span className="data-value">{forecast.peak.timeLabel}</span>
          </p>

          <h2>Hourly Forecast</h2>
          <table className="forecast-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Forecast Rainfall</th>
                {forecast.hasPrecipitationProbability && <th>Precipitation Probability</th>}
              </tr>
            </thead>
            <tbody>
              {forecast.hourlyTable.map((row) => (
                <tr key={row.time}>
                  <td>{row.timeLabel}</td>
                  <td>{formatMm(row.precipitation)}</td>
                  {forecast.hasPrecipitationProbability && (
                    <td>
                      {row.precipitationProbability !== null &&
                      row.precipitationProbability !== undefined
                        ? `${row.precipitationProbability}%`
                        : 'N/A'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Source Information</h2>
          <p>
            <span className="data-label">Source: </span>
            <span className="data-value">{forecast.endpointLabel}</span>
          </p>
          <p>
            <span className="data-label">Model / Data Source: </span>
            <span className="data-value">{forecast.modelInfo}</span>
          </p>
          {forecast.usedFallback && (
            <p className="status-loading">
              Note: ECMWF endpoint unavailable; used generic forecast endpoint with ECMWF model.
            </p>
          )}
          <p>
            <span className="data-label">Forecast Retrieved At: </span>
            <span className="data-value">
              {formatTimestamp(forecast.retrievedAt, forecast.timezone)}
            </span>
          </p>
          <p>
            <span className="data-label">Forecast Timezone: </span>
            <span className="data-value">
              {forecast.timezone}
              {forecast.timezoneAbbreviation ? ` (${forecast.timezoneAbbreviation})` : ''}
            </span>
          </p>

          <details>
            <summary>Debug Information</summary>
            <table className="debug-table">
              <tbody>
                <DebugRow label="Entered location" value={geo.enteredLocation} />
                <DebugRow label="Resolved location" value={geo.name} />
                <DebugRow label="State/region" value={geo.admin1} />
                <DebugRow label="Country" value={geo.country} />
                <DebugRow label="Latitude" value={geo.latitude} />
                <DebugRow label="Longitude" value={geo.longitude} />
                <DebugRow label="Timezone" value={forecast.timezone} />
                <DebugRow label="Forecast window logic" value={forecast.forecastWindowLogic} />
                <DebugRow
                  label="Partial current hour included"
                  value={forecast.partialCurrentHourIncluded ? 'Yes' : 'No'}
                />
                <DebugRow label="Current local datetime" value={forecast.currentLocalDatetime} />
                <DebugRow label="Current local hour" value={forecast.currentLocalHour} />
                <DebugRow label="Current local minute" value={forecast.currentLocalMinute} />
                <DebugRow label="Current local hour key" value={forecast.currentHourKey} />
                <DebugRow
                  label="First complete future hour key"
                  value={forecast.firstHourKey}
                />
                <DebugRow
                  label="Current partial hour skipped"
                  value={forecast.partialHourSkipped ? 'Yes' : 'No'}
                />
                <DebugRow label="Geocoding API URL" value={geo.geocodingUrl} />
                <DebugRow label="Forecast API URL" value={forecast.forecastUrl} />
                <DebugRow label="Forecast API endpoint" value={forecast.endpointLabel} />
                <DebugRow label="Model / source" value={forecast.modelInfo} />
                <DebugRow label="Total hourly records received" value={forecast.rawHourlyCount} />
                <DebugRow
                  label="First available API timestamp"
                  value={forecast.firstAvailableApiTimestamp}
                />
                <DebugRow label="Future hourly records available" value={forecast.futureHourCount} />
                <DebugRow label="Start index used" value={forecast.startIndex} />
                <DebugRow
                  label="First forecast timestamp used"
                  value={forecast.firstForecastTimestamp}
                />
                <DebugRow
                  label="Last forecast timestamp used (table)"
                  value={forecast.lastForecastTimestampUsed}
                />
                <DebugRow
                  label="First 5 precipitation values after filtering"
                  value={JSON.stringify(forecast.samplePrecipitation)}
                />
                <DebugRow label="Geocoding API status" value={geo.geocodingStatus} />
                <DebugRow label="Forecast API status" value={forecast.apiStatus} />
                <DebugRow label="Forecast retrieval timestamp" value={forecast.retrievedAt} />
                <DebugRow label="API generation time (ms)" value={forecast.generationTimeMs} />
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
