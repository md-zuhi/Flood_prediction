import { useState } from 'react';
import './App.css';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmt(value, unit = '') {
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
    return 'N/A';
  }
  return unit ? `${value} ${unit}` : String(value);
}

function fmtTime(ts) {
  if (!ts) return 'N/A';
  try {
    return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
  } catch {
    return ts;
  }
}

function Badge({ label, type }) {
  const map = {
    success: 'badge-success', failed: 'badge-failed', unavailable: 'badge-unavail',
    FRESH: 'badge-fresh', ACCEPTABLE: 'badge-acceptable', STALE: 'badge-stale',
    STATIC: 'badge-static', HISTORICAL: 'badge-historical', UNAVAILABLE: 'badge-unavail',
    HIGH: 'badge-high', MODERATE: 'badge-moderate', LOW: 'badge-low',
    VALID: 'badge-valid', poor: 'badge-poor', INVALID: 'badge-invalid',
    unknown: 'badge-unavail',
  };
  const cls = map[label] || map[type] || 'badge-default';
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Row({ label, value, unit }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value">{fmt(value, unit)}</span>
    </div>
  );
}

function SHRow({ label, sh }) {
  if (!sh) return null;
  return (
    <div className="sh-row">
      <span className="sh-label">{label}</span>
      <Badge label={sh.status} />
      <Badge label={sh.freshness} />
      {sh.age_hours != null && <span className="sh-age">{sh.age_hours}h</span>}
      <Badge label={sh.quality} />
      {sh.quality_flag != null && <span className="sh-flag">flag {sh.quality_flag}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Card components
// ─────────────────────────────────────────────

function Card({ title, children, accent }) {
  return (
    <div className={`card ${accent || ''}`}>
      <h2 className="card-title">{title}</h2>
      {children}
    </div>
  );
}

function FreshnessBar({ sh }) {
  if (!sh) return null;
  return (
    <div className="freshness-bar">
      <Badge label={sh.freshness} />
      {sh.age_hours != null && <span className="sh-age">{sh.age_hours}h old</span>}
      <Badge label={sh.quality} />
      {sh.quality_flag != null && <span className="sh-flag">flag: {sh.quality_flag}</span>}
    </div>
  );
}

function WeatherCard({ weather, sh }) {
  return (
    <Card title="🌡 Current Weather">
      <FreshnessBar sh={sh} />
      <Row label="Temperature"      value={weather.temperature_c}    unit="°C" />
      <Row label="Humidity"         value={weather.humidity_percent}  unit="%" />
      <Row label="Wind Speed"       value={weather.wind_speed_kmh}   unit="km/h" />
      <Row label="Observation Time" value={fmtTime(weather.observation_time)} />
      <Row label="Source"           value={weather.source} />
      <Row label="Status"           value={weather.status} />
    </Card>
  );
}

function RainfallCard({ rainfall, sh }) {
  return (
    <Card title="🌧 Recent Rainfall">
      <FreshnessBar sh={sh} />
      <Row label="Last 30 min"      value={rainfall.rain_30m_mm}  unit="mm" />
      <Row label="Last 1 hour"      value={rainfall.rain_1h_mm}   unit="mm" />
      <Row label="Last 3 hours"     value={rainfall.rain_3h_mm}   unit="mm" />
      <Row label="Last 6 hours"     value={rainfall.rain_6h_mm}   unit="mm" />
      <Row label="Last 12 hours"    value={rainfall.rain_12h_mm}  unit="mm" />
      <Row label="Last 24 hours"    value={rainfall.rain_24h_mm}  unit="mm" />
      <Row label="Observation Time" value={fmtTime(rainfall.observation_time)} />
      <Row label="Source"           value={rainfall.source} />
      <Row label="Status"           value={rainfall.status} />
    </Card>
  );
}

function ForecastCard({ forecast, sh }) {
  return (
    <Card title="🔮 Rainfall Forecast">
      <FreshnessBar sh={sh} />
      <Row label="Next 1 hour"   value={forecast.forecast_1h_mm}  unit="mm" />
      <Row label="Next 3 hours"  value={forecast.forecast_3h_mm}  unit="mm" />
      <Row label="Next 6 hours"  value={forecast.forecast_6h_mm}  unit="mm" />
      <Row label="Next 12 hours" value={forecast.forecast_12h_mm} unit="mm" />
      <Row label="Next 24 hours" value={forecast.forecast_24h_mm} unit="mm" />
      <Row label="Generated"     value={fmtTime(forecast.generated_time)} />
      <Row label="Source"        value={forecast.source} />
      <Row label="Status"        value={forecast.status} />
    </Card>
  );
}

function SoilCard({ soil, sh }) {
  return (
    <Card title="🌱 Soil Moisture (NASA SMAP)">
      <FreshnessBar sh={sh} />
      <Row label="Soil Moisture"    value={soil.value_m3_m3}        unit="m³/m³" />
      <Row label="Observation Time" value={fmtTime(soil.observation_time)} />
      <Row label="Age"              value={soil.age_hours}           unit="hours" />
      <Row label="Quality"          value={soil.quality} />
      <Row label="Quality Flag"     value={soil.quality_flag} />
      <Row label="Dataset"          value={soil.dataset} />
      <Row label="Version"          value={soil.version} />
      <Row label="Source"           value={soil.source} />
      <Row label="Status"           value={soil.status} />
    </Card>
  );
}

function TerrainCard({ terrain, sh }) {
  return (
    <Card title="⛰ Terrain / Slope (NASA SRTM)">
      <FreshnessBar sh={sh} />
      <Row label="Elevation"        value={terrain.elevation_m}      unit="m" />
      <Row label="Min Elevation"    value={terrain.min_elevation_m}  unit="m" />
      <Row label="Max Elevation"    value={terrain.max_elevation_m}  unit="m" />
      <Row label="Mean Elevation"   value={terrain.mean_elevation_m} unit="m" />
      <Row label="Local Relief"     value={terrain.local_relief_m}   unit="m" />
      <Row label="Slope at Location" value={terrain.slope_deg}       unit="°" />
      <Row label="Mean Slope"       value={terrain.mean_slope_deg}   unit="°" />
      <Row label="Max Slope"        value={terrain.max_slope_deg}    unit="°" />
      <Row label="Dataset"          value={terrain.dataset} />
      <Row label="Source"           value={terrain.source} />
      <Row label="Access Service"   value={terrain.access_service} />
      <Row label="Status"           value={terrain.status} />
    </Card>
  );
}

function LandslideCard({ ls, sh }) {
  const ne = ls.nearest_event;
  return (
    <Card title="🪨 Historical Landslide Susceptibility (GSI)">
      <FreshnessBar sh={sh} />
      <div className="disclaimer">
        ⚠ Historical Landslide Susceptibility — NOT current risk or flash-flood probability
      </div>
      <Row label="Nearest Event Distance" value={ls.nearest_event_km} unit="km" />
      <Row label="Count within 5 km"     value={ls.count_5km} />
      <Row label="Count within 10 km"    value={ls.count_10km} />
      <Row label="Count within 25 km"    value={ls.count_25km} />
      <Row label="Historical Susceptibility" value={ls.historical_susceptibility} />
      <Row label="Source"                value={ls.source} />
      <Row label="Dataset"               value={ls.dataset} />
      <Row label="Status"                value={ls.status} />
      {ne && (
        <div className="sub-section">
          <h3>Nearest Recorded Event</h3>
          <Row label="Slide ID"       value={ne.slide_no} />
          <Row label="Name / Location" value={ne.slide_name} />
          <Row label="Road / NH-SH"   value={ne.location} />
          <Row label="District"       value={ne.district} />
          <Row label="Latitude"       value={ne.latitude} />
          <Row label="Longitude"      value={ne.longitude} />
          <Row label="Material"       value={ne.material_involved} />
          <Row label="Movement Type"  value={ne.movement_type} />
          <Row label="History"        value={ne.history} />
          <Row label="Distance"       value={ne.distance_km} unit="km" />
        </div>
      )}
    </Card>
  );
}

function GpmCard({ gpm, sh }) {
  return (
    <Card title="🛰 Satellite Rainfall (NASA GPM IMERG)">
      <FreshnessBar sh={sh} />
      <Row label="Latest Available Satellite Intensity" value={gpm.current_intensity_mm_hr} unit="mm/hr" />
      <Row label="Regional Max Intensity"   value={gpm.regional_max_intensity_mm_hr} unit="mm/hr" />
      <Row label="Last 30 min"              value={gpm.rain_30m_mm}                  unit="mm" />
      <Row label="Last 1 hour"              value={gpm.rain_1h_mm}                   unit="mm" />
      <Row label="Last 3 hours"             value={gpm.rain_3h_mm}                   unit="mm" />
      <Row label="Last 6 hours"             value={gpm.rain_6h_mm}                   unit="mm" />
      <Row label="Last 12 hours"            value={gpm.rain_12h_mm}                  unit="mm" />
      <Row label="Last 24 hours"            value={gpm.rain_24h_mm}                  unit="mm" />
      <Row label="Observation Time"         value={fmtTime(gpm.observation_time)} />
      <Row label="Product"                  value={gpm.product} />
      <Row label="Version"                  value={gpm.version} />
      <Row label="Source"                   value={gpm.source} />
      <Row label="Status"                   value={gpm.status} />
    </Card>
  );
}

function IotCard({ iot, sh }) {
  return (
    <Card title="📡 IoT Sensors">
      <FreshnessBar sh={sh} />
      <div className="iot-status">
        {iot.available
          ? <span className="badge badge-success">Connected</span>
          : <span className="badge badge-unavail">Not Connected / Unavailable</span>
        }
      </div>
      <Row label="Rainfall"         value={iot.rainfall_mm}       unit="mm" />
      <Row label="Soil Moisture"    value={iot.soil_moisture} />
      <Row label="Water Level"      value={iot.water_level} />
      <Row label="Observation Time" value={fmtTime(iot.observation_time)} />
    </Card>
  );
}

function SourceHealthSection({ health }) {
  if (!health) return null;
  const keys = [
    'weather','rainfall','rainfall_forecast','soil_moisture',
    'terrain','landslide_history','satellite_rainfall','iot'
  ];
  const labels = {
    weather: 'Weather', rainfall: 'Rainfall', rainfall_forecast: 'Rainfall Forecast',
    soil_moisture: 'Soil Moisture', terrain: 'Terrain', landslide_history: 'Landslide History',
    satellite_rainfall: 'Satellite Rainfall', iot: 'IoT Sensors',
  };
  return (
    <div className="card card-health">
      <h2 className="card-title">📊 Source Health</h2>
      <div className="sh-grid">
        {keys.map(k => (
          <SHRow key={k} label={labels[k]} sh={health[k]} />
        ))}
      </div>
    </div>
  );
}

function WarningsSection({ warnings }) {
  if (!warnings?.length) return (
    <div className="card card-warnings">
      <h2 className="card-title">✅ Data Warnings</h2>
      <p className="no-warnings">No warnings.</p>
    </div>
  );
  return (
    <div className="card card-warnings">
      <h2 className="card-title">⚠ Data Warnings</h2>
      <ul className="warn-list">
        {warnings.map((w, i) => <li key={i}>{w}</li>)}
      </ul>
    </div>
  );
}

function RawJsonSection({ data }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card card-raw">
      <button className="raw-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲ Hide' : '▼ View'} Raw Fused JSON
      </button>
      {open && (
        <pre className="raw-json">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

export default function App() {
  const [form, setForm] = useState({
    name: 'Coonoor', state: 'Tamil Nadu', country: 'India',
    latitude: '11.3533', longitude: '76.7959',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [result,  setResult]  = useState(null);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleFetch(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('http://localhost:5000/api/fusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          state: form.state,
          country: form.country,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'API error');
      } else {
        setResult(json.data);
      }
    } catch (err) {
      setError('Could not reach backend at http://localhost:5000. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  const d = result;
  const sh = d?.metadata?.source_health;

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <h1>Phase 10 – Multi-Source Data Fusion Verification</h1>
        <p>Flash Flood Prediction System · Hilly Regions · Verification Interface</p>
      </header>

      {/* ── Input Form ── */}
      <form className="input-form" onSubmit={handleFetch}>
        <div className="form-grid">
          <label>
            Location Name
            <input name="name"      value={form.name}      onChange={handleChange} required />
          </label>
          <label>
            State
            <input name="state"     value={form.state}     onChange={handleChange} />
          </label>
          <label>
            Country
            <input name="country"   value={form.country}   onChange={handleChange} />
          </label>
          <label>
            Latitude
            <input name="latitude"  value={form.latitude}  onChange={handleChange} type="number" step="any" required />
          </label>
          <label>
            Longitude
            <input name="longitude" value={form.longitude} onChange={handleChange} type="number" step="any" required />
          </label>
        </div>
        <button className="fetch-btn" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Fetch Fused Data'}
        </button>
      </form>

      {/* ── Error ── */}
      {error && (
        <div className="error-box">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <div className="loading">Fetching data from all sources…</div>}

      {/* ── Results ── */}
      {d && (
        <>
          {/* Summary */}
          <div className="summary-bar">
            <div className="sum-item">
              <span className="sum-label">Location</span>
              <span className="sum-value">
                {fmt(d.location.name)}{d.location.state ? `, ${d.location.state}` : ''}
              </span>
            </div>
            <div className="sum-item">
              <span className="sum-label">Coordinates</span>
              <span className="sum-value">{fmt(d.location.latitude)}, {fmt(d.location.longitude)}</span>
            </div>
            <div className="sum-item">
              <span className="sum-label">Data Completeness</span>
              <span className="sum-value sum-big">{fmt(d.metadata.data_completeness_percent)}%</span>
            </div>
            <div className="sum-item">
              <span className="sum-label">Overall Confidence</span>
              <span className="sum-value">
                <Badge label={d.metadata.overall_data_confidence} />
              </span>
            </div>
            <div className="sum-item">
              <span className="sum-label">Warnings</span>
              <span className="sum-value sum-big">{d.metadata.warnings?.length ?? 0}</span>
            </div>
            <div className="sum-item">
              <span className="sum-label">Generated</span>
              <span className="sum-value">{fmtTime(d.metadata.generated_at)}</span>
            </div>
          </div>

          {/* Missing features */}
          {d.metadata.missing_features?.length > 0 && (
            <div className="missing-bar">
              Missing features: {d.metadata.missing_features.join(', ')}
            </div>
          )}

          {/* Cards Grid */}
          <div className="cards-grid">
            <WeatherCard  weather={d.weather}           sh={sh?.weather} />
            <RainfallCard rainfall={d.rainfall}         sh={sh?.rainfall} />
            <ForecastCard forecast={d.rainfall_forecast} sh={sh?.rainfall_forecast} />
            <SoilCard     soil={d.soil_moisture}        sh={sh?.soil_moisture} />
            <TerrainCard  terrain={d.terrain}           sh={sh?.terrain} />
            <LandslideCard ls={d.landslide_history}     sh={sh?.landslide_history} />
            <GpmCard      gpm={d.satellite_rainfall}    sh={sh?.satellite_rainfall} />
            <IotCard      iot={d.iot}                   sh={sh?.iot} />
          </div>

          {/* Source Health */}
          <SourceHealthSection health={sh} />

          {/* Warnings */}
          <WarningsSection warnings={d.metadata.warnings} />

          {/* Raw JSON */}
          <RawJsonSection data={d} />
        </>
      )}
    </div>
  );
}
