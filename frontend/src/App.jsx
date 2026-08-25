import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import "./App.css";

const locations = [
  // Tamil Nadu
  {
    name: "Coonoor",
    state: "Tamil Nadu",
    country: "India",
    latitude: 11.3533,
    longitude: 76.7959,
  },
  {
    name: "Ooty",
    state: "Tamil Nadu",
    country: "India",
    latitude: 11.4102,
    longitude: 76.695,
  },
  {
    name: "Kodaikanal",
    state: "Tamil Nadu",
    country: "India",
    latitude: 10.2381,
    longitude: 77.4892,
  },

  // Kerala
  {
    name: "Munnar",
    state: "Kerala",
    country: "India",
    latitude: 10.0889,
    longitude: 77.0595,
  },
  {
    name: "Wayanad",
    state: "Kerala",
    country: "India",
    latitude: 11.6854,
    longitude: 76.132,
  },

  // Uttarakhand
  {
    name: "Nainital",
    state: "Uttarakhand",
    country: "India",
    latitude: 29.3919,
    longitude: 79.4542,
  },
  {
    name: "Mussoorie",
    state: "Uttarakhand",
    country: "India",
    latitude: 30.4598,
    longitude: 78.0644,
  },
  {
    name: "Dehradun",
    state: "Uttarakhand",
    country: "India",
    latitude: 30.3165,
    longitude: 78.0322,
  },
];

function App() {
  const [selectedLocation, setSelectedLocation] =
    useState(locations[0]);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeRisk = async () => {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const response = await fetch(
        "http://localhost:5000/api/predict",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(selectedLocation),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Prediction failed"
        );
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskClass = () => {
    if (!result) return "";
    return result.prediction.risk_level.toLowerCase();
  };

  const displayValue = (value, suffix = "") => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "N/A";
    }

    return `${value}${suffix}`;
  };

  const getRecommendedActions = (riskLevel) => {
    switch (riskLevel) {
      case "CRITICAL":
        return [
          "Avoid low-lying roads, streams and flood-prone crossings.",
          "Prepare for immediate evacuation if local authorities advise.",
          "Continuously monitor rainfall and emergency alerts.",
        ];

      case "HIGH":
        return [
          "Avoid unnecessary travel in vulnerable hilly areas.",
          "Monitor rainfall, streams and drainage conditions.",
          "Keep emergency contacts and evacuation routes ready.",
        ];

      case "MODERATE":
        return [
          "Monitor weather and rainfall updates frequently.",
          "Stay alert near steep slopes and drainage channels.",
          "Keep basic emergency supplies ready.",
        ];

      default:
        return [
          "Continue monitoring local weather conditions.",
          "No immediate precautionary action is required.",
        ];
    }
  };

  const environmental =
    result?.environmental_data;

  const metadata =
    result?.metadata;

  return (
    <div className="app">
      {/* HEADER */}
      <header className="hero">
        <div>
          <h1>Flash Flood Prediction System</h1>

          <p>
            AI-Based Early Warning System for Hilly Regions
          </p>
        </div>
      </header>

      {/* LOCATION SELECTOR */}
      <section className="location-panel">
        <div>
          <label>Select Location</label>

          <select
            value={selectedLocation.name}
            onChange={(e) => {
              const location = locations.find(
                (item) =>
                  item.name === e.target.value
              );

              setSelectedLocation(location);
              setResult(null);
              setError("");
            }}
          >
            <optgroup label="Tamil Nadu">
              {locations
                .filter(
                  (loc) =>
                    loc.state === "Tamil Nadu"
                )
                .map((location) => (
                  <option
                    key={location.name}
                    value={location.name}
                  >
                    {location.name}
                  </option>
                ))}
            </optgroup>

            <optgroup label="Kerala">
              {locations
                .filter(
                  (loc) =>
                    loc.state === "Kerala"
                )
                .map((location) => (
                  <option
                    key={location.name}
                    value={location.name}
                  >
                    {location.name}
                  </option>
                ))}
            </optgroup>

            <optgroup label="Uttarakhand">
              {locations
                .filter(
                  (loc) =>
                    loc.state === "Uttarakhand"
                )
                .map((location) => (
                  <option
                    key={location.name}
                    value={location.name}
                  >
                    {location.name}
                  </option>
                ))}
            </optgroup>
          </select>

          <p className="location-note">
            Prototype coverage: Tamil Nadu, Kerala and
            Uttarakhand hilly regions.
          </p>
        </div>

        <button
          onClick={analyzeRisk}
          disabled={loading}
        >
          {loading
            ? "Analyzing..."
            : "Analyze Flood Risk"}
        </button>
      </section>

      {/* ERROR */}
      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {/* RESULTS */}
      {result && (
        <>
          {/* CURRENT RISK */}
          <section
            className={`risk-panel ${getRiskClass()}`}
          >
            <p className="small-label">
              Current Flood Risk
            </p>

            <h2>
              {result.location.name},{" "}
              {result.location.state}
            </h2>

            <div className="probability">
              {
                result.prediction
                  .flood_probability_percent
              }
              %
            </div>

            <div className="risk-level">
              {
                result.prediction
                  .risk_level
              }{" "}
              RISK
            </div>

            <p className="alert-message">
              {
                result.prediction
                  .alert_message
              }
            </p>
          </section>

          {/* WHY THIS RISK */}
          <section>
            <h2>Why This Risk?</h2>

            <div className="data-grid">
              <div className="data-card">
                <span>Recent Rainfall — 24h</span>
                <strong>
                  {displayValue(
                    result.ml_features.rain_24h_mm,
                    " mm"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Soil Moisture</span>
                <strong>
                  {displayValue(
                    result.ml_features
                      .soil_moisture_m3m3,
                    " m³/m³"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Elevation</span>
                <strong>
                  {displayValue(
                    result.ml_features.elevation_m,
                    " m"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>
                  Historical Susceptibility
                </span>

                <strong>
                  {displayValue(
                    environmental
                      ?.landslide_history
                      ?.historical_susceptibility
                  )}
                </strong>
              </div>
            </div>

            <p className="explain-note">
              These are important environmental inputs
              and contextual indicators used by the
              prototype. They are not exact ML feature
              contributions.
            </p>
          </section>

          {/* RECOMMENDED ACTIONS */}
          <section>
            <h2>Recommended Actions</h2>

            <div
              className={`action-panel ${getRiskClass()}`}
            >
              {getRecommendedActions(
                result.prediction.risk_level
              ).map((action, index) => (
                <div
                  className="action-item"
                  key={index}
                >
                  <span>✓</span>
                  <p>{action}</p>
                </div>
              ))}
            </div>
          </section>

          {/* LIVE ENVIRONMENTAL CONDITIONS */}
          <section>
            <h2>Live Environmental Conditions</h2>

            <div className="data-grid">
              <div className="data-card">
                <span>Rainfall — 1 Hour</span>
                <strong>
                  {displayValue(
                    result.ml_features.rain_1h_mm,
                    " mm"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Rainfall — 3 Hours</span>
                <strong>
                  {displayValue(
                    result.ml_features.rain_3h_mm,
                    " mm"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Rainfall — 6 Hours</span>
                <strong>
                  {displayValue(
                    result.ml_features.rain_6h_mm,
                    " mm"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Rainfall — 24 Hours</span>
                <strong>
                  {displayValue(
                    result.ml_features.rain_24h_mm,
                    " mm"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Temperature</span>
                <strong>
                  {displayValue(
                    result.ml_features.temperature_c,
                    " °C"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Humidity</span>
                <strong>
                  {displayValue(
                    result.ml_features.humidity_percent,
                    "%"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Soil Moisture</span>
                <strong>
                  {displayValue(
                    result.ml_features
                      .soil_moisture_m3m3,
                    " m³/m³"
                  )}
                </strong>
              </div>

              <div className="data-card">
                <span>Elevation</span>
                <strong>
                  {displayValue(
                    result.ml_features.elevation_m,
                    " m"
                  )}
                </strong>
              </div>
            </div>
          </section>

          {/* RAINFALL FORECAST */}
          {environmental?.rainfall_forecast && (
            <section>
              <h2>Rainfall Forecast</h2>

              <div className="data-grid">
                <div className="data-card">
                  <span>Next 1 Hour</span>
                  <strong>
                    {displayValue(
                      environmental
                        .rainfall_forecast
                        .forecast_1h_mm,
                      " mm"
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Next 3 Hours</span>
                  <strong>
                    {displayValue(
                      environmental
                        .rainfall_forecast
                        .forecast_3h_mm,
                      " mm"
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Next 6 Hours</span>
                  <strong>
                    {displayValue(
                      environmental
                        .rainfall_forecast
                        .forecast_6h_mm,
                      " mm"
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Next 12 Hours</span>
                  <strong>
                    {displayValue(
                      environmental
                        .rainfall_forecast
                        .forecast_12h_mm,
                      " mm"
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Next 24 Hours</span>
                  <strong>
                    {displayValue(
                      environmental
                        .rainfall_forecast
                        .forecast_24h_mm,
                      " mm"
                    )}
                  </strong>
                </div>
              </div>
            </section>
          )}

          {/* LANDSLIDE HISTORY */}
          {environmental?.landslide_history && (
            <section>
              <h2>Historical Landslide Analysis</h2>

              <div className="data-grid">
                <div className="data-card">
                  <span>
                    Nearest Recorded Event
                  </span>

                  <strong>
                    {displayValue(
                      environmental
                        .landslide_history
                        .nearest_event_km,
                      " km"
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Events within 5 km</span>

                  <strong>
                    {displayValue(
                      environmental
                        .landslide_history
                        .count_5km
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Events within 10 km</span>

                  <strong>
                    {displayValue(
                      environmental
                        .landslide_history
                        .count_10km
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Events within 25 km</span>

                  <strong>
                    {displayValue(
                      environmental
                        .landslide_history
                        .count_25km
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>
                    Historical Susceptibility
                  </span>

                  <strong>
                    {displayValue(
                      environmental
                        .landslide_history
                        .historical_susceptibility
                    )}
                  </strong>
                </div>
              </div>

              {environmental
                .landslide_history
                .nearest_event && (
                <div className="info-panel">
                  <h3>
                    Nearest Recorded Landslide
                  </h3>

                  <p>
                    <strong>Location:</strong>{" "}
                    {
                      environmental
                        .landslide_history
                        .nearest_event
                        .location
                    }
                  </p>

                  <p>
                    <strong>District:</strong>{" "}
                    {
                      environmental
                        .landslide_history
                        .nearest_event
                        .district
                    }
                  </p>

                  <p>
                    <strong>Movement:</strong>{" "}
                    {
                      environmental
                        .landslide_history
                        .nearest_event
                        .movement_type
                    }
                  </p>

                  <p>
                    <strong>Material:</strong>{" "}
                    {
                      environmental
                        .landslide_history
                        .nearest_event
                        .material_involved
                    }
                  </p>
                </div>
              )}
            </section>
          )}

          {/* NASA GPM */}
          {environmental?.satellite_rainfall && (
            <section>
              <h2>NASA GPM Satellite Rainfall</h2>

              {environmental
                .satellite_rainfall
                .status === "success" ? (
                <div className="data-grid">
                  <div className="data-card">
                    <span>Current Intensity</span>

                    <strong>
                      {displayValue(
                        environmental
                          .satellite_rainfall
                          .current_intensity_mm_hr,
                        " mm/hr"
                      )}
                    </strong>
                  </div>

                  <div className="data-card">
                    <span>
                      Satellite Rain — 1h
                    </span>

                    <strong>
                      {displayValue(
                        environmental
                          .satellite_rainfall
                          .rain_1h_mm,
                        " mm"
                      )}
                    </strong>
                  </div>

                  <div className="data-card">
                    <span>
                      Satellite Rain — 3h
                    </span>

                    <strong>
                      {displayValue(
                        environmental
                          .satellite_rainfall
                          .rain_3h_mm,
                        " mm"
                      )}
                    </strong>
                  </div>

                  <div className="data-card">
                    <span>
                      Satellite Rain — 24h
                    </span>

                    <strong>
                      {displayValue(
                        environmental
                          .satellite_rainfall
                          .rain_24h_mm,
                        " mm"
                      )}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="info-panel">
                  Satellite rainfall is not currently
                  available for this selected region.
                </div>
              )}
            </section>
          )}

          {/* DATA RELIABILITY */}
          {metadata && (
            <section>
              <h2>Data Reliability & Source Health</h2>

              <div className="data-grid">
                <div className="data-card">
                  <span>Data Completeness</span>

                  <strong>
                    {displayValue(
                      metadata
                        .data_completeness_percent,
                      "%"
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Overall Confidence</span>

                  <strong>
                    {displayValue(
                      metadata
                        .overall_data_confidence
                    )}
                  </strong>
                </div>

                <div className="data-card">
                  <span>Model Version</span>

                  <strong>
                    {displayValue(
                      result.prediction.model_version
                    )}
                  </strong>
                </div>
              </div>

              {metadata.source_health && (
                <div className="source-health-list">
                  {Object.entries(
                    metadata.source_health
                  ).map(
                    ([source, info]) => (
                      <div
                        className="source-health-row"
                        key={source}
                      >
                        <strong>
                          {source.replaceAll(
                            "_",
                            " "
                          )}
                        </strong>

                        <div className="health-badges">
                          <span className="health-badge">
                            {info.status ?? "N/A"}
                          </span>

                          <span className="health-badge">
                            {info.freshness ?? "N/A"}
                          </span>

                          <span className="health-badge">
                            {info.quality ?? "N/A"}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {/* SYSTEM WARNINGS */}
          {metadata?.warnings?.length > 0 && (
            <section>
              <h2>System Warnings</h2>

              <div className="warning-panel">
                {metadata.warnings.map(
                  (warning, index) => (
                    <p key={index}>
                      ⚠ {warning}
                    </p>
                  )
                )}
              </div>
            </section>
          )}

          {/* MAP */}
          <section>
            <h2>Risk Location Map</h2>

            <div className="map-wrapper">
              <MapContainer
                key={`${result.location.latitude}-${result.location.longitude}`}
                center={[
                  result.location.latitude,
                  result.location.longitude,
                ]}
                zoom={12}
                className="map"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker
                  position={[
                    result.location.latitude,
                    result.location.longitude,
                  ]}
                >
                  <Popup>
                    <strong>
                      {result.location.name}
                    </strong>

                    <br />

                    Risk:{" "}
                    {result.prediction.risk_level}

                    <br />

                    Probability:{" "}
                    {
                      result.prediction
                        .flood_probability_percent
                    }
                    %
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </section>

          {/* DATA SOURCES */}
          <section>
            <h2>Data Sources</h2>

            <div className="sources">
              <span>Open-Meteo</span>
              <span>NASA SMAP</span>
              <span>NASA SRTM</span>
              <span>GSI Landslide Inventory</span>
              <span>NASA GPM IMERG</span>
              <span>OpenStreetMap</span>
            </div>
          </section>

          {/* LAST UPDATED */}
          <p className="generated">
            Last generated:{" "}
            {new Date(
              result.generated_at
            ).toLocaleString()}
          </p>

          {/* DISCLAIMER */}
          <p className="prototype-note">
            Prototype model output for decision-support
            demonstration. Not an official disaster warning.
          </p>
        </>
      )}
    </div>
  );
}

export default App;