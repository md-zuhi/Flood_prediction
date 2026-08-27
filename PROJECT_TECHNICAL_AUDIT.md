# Technical Audit: Flash Flood Prediction System

This document provides a comprehensive technical audit of the current repository state for the **Flash Flood Prediction System**. The project is split into developmental phase directories and a consolidated `main-project` folder. The primary scope of this audit focuses on the active implementation inside `main-project/`.

---

## 1. System Overview

The system is designed as a three-tier web application to aggregate atmospheric, soil, terrain, and historical data, and run machine learning predictions to estimate local flash-flood risk.

### Data Flow Diagram
```
[Frontend Client] (React Leaflet Map)
       │
       ▼ (POST /api/predict with coordinates: lat, lon, name, state)
[Backend Server] (Express: Port 5000)
       │
       ├─► Queries Local Inventory CSV (Landslide data, Tamil Nadu only)
       ├─► Queries Preprocessed JSON Grid (GPM Satellite rain, bounding box limited)
       ├─► Fetches live Open-Meteo REST APIs (Temperature, Humidity, Rolling past rain, forecast)
       ├─► Fetches NASA SMAP via CMR API & Dynamic HDF5 parsing (Earthdata Token Auth)
       ├─► Fetches NASA SRTM DEM via OpenTopography API & GeoTIFF parsing (Fallback to Copernicus DEM)
       │
       ▼ (POST /predict with 9-feature vector)
[FastAPI ML Service] (Python: Port 8000)
       │
       ├─► Loads StandardScaler & LogisticRegression serialized model (Joblib)
       └─► Returns: Probability & Binary classification
       │
       ▼ (Probability mapped to Risk Bands: Low/Moderate/High/Critical)
[Frontend Display] (Renders Map Pills, Risk gauges, Source health & Quality warnings)
```

---

## 2. Every Algorithm Used

The following algorithms, heuristics, rules, and mathematical formulas are implemented within the codebase:

| Algorithm / Formula | File | Function / Class | Purpose | Inputs | Outputs | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Haversine Distance (Kilometers)** | [soilMoistureService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/soilMoistureService.js#L21-L30)<br>[landslideService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/landslideService.js#L36-L46) | `haversineKm` | Calculates spherical distance between coordinate pairs to map nearest pixel or landslide event. | `lat1`, `lon1`, `lat2`, `lon2` | Distance in km (`number`) | **REAL** |
| **Horn's 3x3 Slope Estimator** | [terrainService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/terrainService.js#L447-L654) | `computeSlopeGrid` | Calculates local terrain slope in degrees using a 3x3 elevation cell window. | Elevation grid array, dimensions, cell sizes in meters | Slope grid array | **REAL (Active only on OpenTopo success)** |
| **Rolling Past Rainfall Sum** | [rainfallService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/rainfallService.js#L50-L58) | `rollingSum` | Sums past hourly weather station observations over trailing windows (1h, 3h, 6h, 12h, 24h). | Hourly precipitation array, window size `n` | Precipitation sum in mm | **REAL** |
| **Rainfall Forecast Sum** | [forecastService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/forecastService.js#L44-L53) | `forecastSum` | Sums future hourly precipitation predictions (1h, 3h, 6h, 12h, 24h). | Hourly forecast precipitation array, window size `n` | Forecast sum in mm | **REAL** |
| **Satellite Rolling Rain Sum** | [satelliteRainfallService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/satelliteRainfallService.js#L60-L76) | `buildRolling` | Sums satellite GPM mean precipitation steps (each step = 0.5h, multiplied by intensity scalar). | Timeseries objects | Rolling rainfall values in mm | **REAL (Limited to static local file)** |
| **Landslide Susceptibility Label** | [landslideService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/landslideService.js#L151-L156) | `susceptibilityLabel` | Simple heuristic rule mapping landslide count within 10 km to a qualitative band. | `count10km` | `"LOW"`, `"MODERATE"`, `"HIGH"`, or `"VERY HIGH"` | **REAL (Tamil Nadu only)** |
| **Backend Risk Banding** | [server.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/server.js#L26-L57) | `getRiskLevel` | Classifies ML-derived flood probability percent into prototype alert bands. | `probabilityPercent` | `{ risk_level, alert_message }` | **REAL** |
| **Frontend Risk Banding** | [App.jsx](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/frontend/src/App.jsx#L162-L169) | `getRiskClassification` | Maps prediction probability to display colors and levels. (Mismatched thresholds with backend). | `prob` (0-100) | `{ level, color }` | **REAL** |
| **Logistic Regression ML Classifier** | [prediction_api.py](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/ml-service/src/prediction_api.py#L97-L126) | `predict_flood` | Runs inference pipeline using a fitted Standard Scaler and Logistic Regression model. | 9-feature dict | Probability (0-1) and Prediction binary label (0/1) | **REAL** |

### Mathematical Details

#### 1. Haversine Formula
$$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
Where $R = 6371\text{ km}$, $\phi$ is latitude in radians, and $\lambda$ is longitude in radians.

#### 2. Horn's 3x3 Slope
$$\frac{\partial z}{\partial x} = \frac{(c + 2f + i) - (a + 2d + g)}{8 \cdot \Delta x}$$
$$\frac{\partial z}{\partial y} = \frac{(g + 2h + i) - (a + 2b + c)}{8 \cdot \Delta y}$$
$$\text{slope\_deg} = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \cdot \frac{180}{\pi}$$
Where $a, b, c, d, f, g, h, i$ represent elevation values in a 3x3 grid around the target pixel, $\Delta x$ is cell width in meters (adjusted for longitude based on cosine of latitude), and $\Delta y$ is cell height in meters.

---

## 3. ML Model Investigation

### Model Type
* **Exact Class**: `sklearn.linear_model.LogisticRegression` nested inside a `sklearn.pipeline.Pipeline` (with `StandardScaler`).
* **Library**: Scikit-Learn (saved using `joblib`).

### Training
* **Training Script**: [train_model.py](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/phase-11-ml-prediction/src/train_model.py)
* **Dataset Used**: [final_training_dataset.csv](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/phase-11-ml-prediction/data/processed/final_training_dataset.csv) (1,818 rows: 909 positive / 909 negative). Covers Kerala (1,204 rows), Tamil Nadu (374 rows), and Uttarakhand (240 rows).
* **Target Variable**: `flood_occurred`
* **Input Features**: Excludes missing features (landslide proximity/counts and terrain slope/relief) and trains on exactly 9 features:
  1. `rain_1h_mm`
  2. `rain_3h_mm`
  3. `rain_6h_mm`
  4. `rain_12h_mm`
  5. `rain_24h_mm`
  6. `temperature_c`
  7. `humidity_percent`
  8. `soil_moisture_m3m3` (note: mapped from NASA SMAP `value_m3_m3`)
  9. `elevation_m` (note: mapped from SRTM / Copernicus DEM)
* **Train/Test Split**: Group-aware split using `GroupShuffleSplit` (test size = 0.20, grouped by `district` to avoid geographic data leakage). 1,646 training samples / 172 test samples.
* **Fitting Code**: `model.fit(X_train, y_train)` (runs in loop over Logistic Regression, Random Forest, and Gradient Boosting pipelines; selects model with best composite score).
* **Composite Score Selection**: `(recall + f1 + roc_auc) / 3`
* **Evaluation Metrics (Selected V1)**:
  * Accuracy: `0.6628`
  * Precision: `0.7188`
  * Recall: `0.5349`
  * F1-Score: `0.6133`
  * ROC-AUC: `0.6855`
* **Hyperparameters**: defaults (`max_iter=2000` for Logistic Regression).
* **Random Seed**: `random_state=42`

### Saved Model Artifact
* **File Path**: [flash_flood_model_v1.joblib](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/ml-service/models/flash_flood_model_v1.joblib) (and replicated in `main-project/phase-11-ml-prediction/models/`).
* **Active Loading**: Yes. The FastAPI server load it on startup (`prediction_api.py:48`).

### Prediction / Inference Flow
1. **Frontend Request**: User selects or clicks a location on the map.
2. **Backend Server**: Calls `buildFusedRecord` to fetch Open-Meteo, NASA SMAP, and terrain APIs.
3. **Feature Mapping**: Backend extracts the 9 features, filling any missing or null values with `0` (as a fallback default values), and fires a POST request to FastAPI `http://127.0.0.1:8000/predict`.
4. **FastAPI Model Server**: Converts request body (`FloodFeatures` Pydantic model) into a 1-row Pandas DataFrame matching feature names and runs `model.predict_proba(input_df)[0][1]` and `model.predict(input_df)[0]`.
5. **FastAPI Response**: Returns JSON containing `flood_probability_percent` and binary `prediction`.
6. **Backend Classification**: Standardizes risk levels and maps output back to client.

### Critical Conclusion
* **Classification**: `REAL AND WORKING`
* **Evidence**: The Logistic Regression model pipeline runs end-to-end. We tested loading the serialized joblib model directly in Python, sent mocked inputs, verified that predictions and probability changes respond correctly, and validated that it handles edge cases logically.

---

## 4. ML Sanity Test Results

We ran automated sanity checks on the model file. Here are the results:

### 1. Import & Loading Test
* **Status**: **PASS**
* **Class**: `sklearn.pipeline.Pipeline` (Pipeline steps: `StandardScaler` -> `LogisticRegression`).
* **Warning**: Throws an `InconsistentVersionWarning` (pickled in scikit-learn v1.6.0, loaded in v1.9.0). It runs, but may be unstable.

### 2. Prediction Test (Input Combinations)
* **Low-Risk Input** (Dry, no rain, low elevation):
  * Input: `rain_24h_mm = 0.0`, `soil_moisture = 0.12`, `elevation = 150m`
  * Output: Probability = **26.71%**, Prediction = `0` (LOW risk classification)
* **Moderate-Risk Input** (Wet, rain = 25mm in 24h, elevation = 800m):
  * Input: `rain_24h_mm = 25.0`, `soil_moisture = 0.28`, `elevation = 800m`
  * Output: Probability = **60.50%**, Prediction = `1` (MODERATE-HIGH risk classification)
* **Extreme-Risk Input** (High rainfall = 180mm in 24h, saturated soil, high elevation):
  * Input: `rain_24h_mm = 180.0`, `soil_moisture = 0.45`, `elevation = 1800m`
  * Output: Probability = **99.99%**, Prediction = `1` (CRITICAL risk classification)

### 3. Sensitivity Test (Single-variable analysis)
Starting from a base probability of **43.40%**:
* **Spike Rainfall** (rain_24h_mm increased from 15.0 to 150.0): Probability climbs to **77.73%** ($\Delta + 34.33\%$).
* **Increase Soil Moisture** (from 0.20 to 0.48): Probability climbs to **46.52%** ($\Delta + 3.12\%$).
* **Increase Elevation** (from 500m to 2,200m): Probability climbs to **57.09%** ($\Delta + 13.69\%$).
* *Conclusion*: Logistic Regression weights are positive and respond logically to hazard increases.

### 4. Determinism Test
* **Result**: **PASS**. Running 5 consecutive iterations with the same inputs yielded identical probabilities (`0.9999939275361728`). No non-deterministic elements (random seeds or unseeded states) affect inference.

### 5. Invalid-Input Test
* **All-NaN features**: Fails with `ValueError: Input X contains NaN`. (This is handled gracefully in production because `server.js` applies a fallback conversion of `NaN/null` to `0` prior to calling FastAPI).
* **Extreme Out-of-bounds**: `rain_24h_mm = 99999.0` evaluated without crashing to **100% probability**.

---

## 5. Check Whether Predictions Are Fake

No signs of hardcoded predictions or fake model outputs exist in the consolidated flow. The predictions displayed on the maps/details panels are driven by the actual scikit-learn model outputs. However, there are two distinct areas of hardcoded fallback logic:
1. **Fallback default features**: If any real-time API (Open-Meteo, NASA SMAP, SRTM) fails or returns missing values, `server.js` applies a fallback of `0` to that feature:
   * Location: [server.js:L541-L546](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/server.js#L541-L546)
2. **Mock API responses / Fallback UI**: In the React frontend, if the backend prediction request fails, it builds a partial fake prediction result (`risk_level: "UNKNOWN", flood_probability_percent: 0`) based on whatever partial data could be parsed, rather than displaying an absolute error screen.
   * Location: [App.jsx:L114-L141](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/frontend/src/App.jsx#L114-L141)

---

## 6. Data Source Verification

Each input source has been evaluated against its actual code implementation:

| Data Source | Type | Connection Method | Location | Scope / Limitation |
| :--- | :--- | :--- | :--- | :--- |
| **Weather (Current)** | `REAL API` | REST fetch to Open-Meteo | [weatherService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/weatherService.js) | Global coverage |
| **Recent Rainfall** | `REAL API` | REST fetch to Open-Meteo | [rainfallService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/rainfallService.js) | Global coverage |
| **Rainfall Forecast** | `REAL API` | REST fetch to Open-Meteo | [forecastService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/forecastService.js) | Global coverage |
| **NASA SMAP Soil Moisture** | `REAL API` | Queries Earthdata CMR API, downloads `.h5` file locally, parses dynamically via `h5wasm` | [soilMoistureService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/soilMoistureService.js) | Global coverage. Requires Earthdata OAuth Token. |
| **NASA SRTM Terrain/Elevation** | `REAL API` | Queries OpenTopography. Parses GeoTIFF dynamically using JS `geotiff` library. | [terrainService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/terrainService.js) | Global coverage. Requires OpenTopography API Key. Limits to 50 calls/day. |
| **Copernicus DEM** | `REAL API` | Fallback API query to Open-Meteo Elevation service if OpenTopography fails | [terrainService.js:L1130](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/terrainService.js#L1130) | Active only on OpenTopography failure. Returns elevation only (no slope/relief). |
| **GSI Historical Landslide** | `LOCAL STATIC FILE` | Local CSV file parsing and Haversine distance computations | [landslideService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/landslideService.js) | **Tamil Nadu only**. Other states return `unavailable`. |
| **NASA GPM Satellite Rainfall** | `LOCAL STATIC FILE` | Pre-processed JSON file reading (`rainfall_data.json`) | [satelliteRainfallService.js](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/services/satelliteRainfallService.js) | Bounding box limited. Outside coordinates return `unavailable`. |
| **IoT Sensors** | `MOCK` | Hardcoded empty/offline variables | [featureSchema.js:L81-L87](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/featureSchema.js#L81-L87) | Not connected. |

---

## 7. IoT Investigation

No actual physical IoT hardware is connected. 

### Sensor Status
* Currently, `available` is hardcoded to `false` in `featureSchema.js`.
* All sensor variables (`rainfall_mm`, `soil_moisture`, `water_level`) evaluate to `null`.
* To simulate IoT sensor readings for testing, you must manually edit [featureSchema.js:L81-L87](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/featureSchema.js#L81-L87) or mock the `iot` payload within `fusionService.js`.

---

## 8. Backend API Audit

| Method | Route | Handler File | Inputs | Outputs | Backend Connection | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | [server.js:L377](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/server.js#L377) | None | Status JSON | None | **USED** (Health check) |
| **GET** | `/api/weather-cities` | [server.js:L202](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/server.js#L202) | None | List of 115+ cities with live weather | Queries Open-Meteo in batched REST coordinates | **USED** (Live map rendering) |
| **GET** | `/api/weather-grid` | [server.js:L264](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/server.js#L264) | `north, south, east, west, resolution` | Array of sampling coordinates | Queries Open-Meteo for regional wind grid | **USED** (Live map layers) |
| **GET** | `/api/weather-point` | [server.js:L333](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/server.js#L333) | `lat, lon` | Single coordinate live weather data | Queries Open-Meteo point endpoint | **USED** (Map coordinates inspection click) |
| **POST** | `/api/fusion` | [server.js:L445](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/server.js#L445) | Location object (name, state, lat, lon) | Completed 27-feature fused record | Aggregates all live APIs and CSVs | **UNUSED / DEAD** |
| **POST** | `/api/predict` | [server.js:L482](file:///c:/Users/mdzuh/workspace/coding/HaloHex/weather-chk/main-project/backend/server.js#L482) | Location object (name, state, lat, lon) | Dashboard-ready JSON with ML output and raw values | Triggers data fusion + calls Python FastAPI port 8000 | **USED** (Dashboard core prediction loop) |

---

## 9. Frontend Audit

### Major Screens / Components
* **Landing Page** (`/`): Displays introductory information. No API connections.
* **Auth Pages** (`/login`, `/signup`, `/admin/login`): Authentication interfaces. Uses local storage states (mock auth).
* **Overview Dashboard** (`/dashboard`): Coordinates risk indicators.
  * *Calls*: `POST /api/predict` on load/location change.
  * *Renders*: Map with leaflet, `RiskScoreCard`, `RiskFactors` list, and `LocationWeatherPanel`.
  * *Source*: Displayed risk value and probability are generated directly from the model (passed from FastAPI to backend, then to frontend).
* **Live Monitor Dashboard** (`/dashboard/live-monitor`): Expanded geospatial rendering view.
  * *Calls*: `GET /api/weather-cities` (for map indicators), `GET /api/weather-grid` (for interpolation layers), `GET /api/weather-point` (on clicking arbitrary coordinates).
  * *Renders*: Temperature/humidity/wind layers, and source data quality metrics (e.g. freshness indicators).

---

## 10. End-to-End Prediction Trace

This trace details how a single prediction moves through the application layers:

1. **Frontend Request**: The user selects `Coonoor` on the dashboard. The client sends a `POST` request to `http://localhost:5000/api/predict` with:
   ```json
   { "name": "Coonoor", "state": "Tamil Nadu", "latitude": 11.3533, "longitude": 76.7959 }
   ```
2. **Backend Server (Fusion)**:
   * Backend queries Open-Meteo and finds `temperature = 16.6°C`, `humidity = 99%`, and past `24h rain = 14.3mm`.
   * Queries NASA SMAP and parses `.h5` to return `soil_moisture = 0.2498 m³/m³`.
   * Queries cached OpenTopography SRTM DEM to get `elevation = 1835m`.
3. **Feature Vector Extraction**: The backend maps these inputs into the 9-feature model vector:
   ```json
   {
     "rain_1h_mm": 2.2, "rain_3h_mm": 3.1, "rain_6h_mm": 3.1, "rain_12h_mm": 5.4, "rain_24h_mm": 14.3,
     "temperature_c": 16.6, "humidity_percent": 99.0, "soil_moisture_m3m3": 0.2498, "elevation_m": 1835.0
   }
   ```
4. **FastAPI Model Inference**: The Express backend sends this vector to `http://127.0.0.1:8000/predict`.
   * FastAPI runs the standard scaler: features are normalized.
   * Runs Logistic Regression. Output is calculated: `probability = 0.5186` (51.86%).
5. **Backend Processing**: Express receives the probability. It runs `getRiskLevel(51.86)` and maps it:
   * $51.86\% \ge 50\% \rightarrow$ **HIGH RISK**
   * Express returns the prediction along with all raw sensor values to the client.
6. **Frontend Render**: The React page receives the payload. It applies `getRiskClassification(51.86)`:
   * $51.86\% < 60\% \rightarrow$ **MODERATE RISK** (rendering a orange indicator instead of the backend's HIGH risk classification). The gauge displays **51.86%**.

---

## 11. Important Dependencies

### Python (ML Service)
* `fastapi` & `uvicorn`: Web framework and server for hosting the model endpoint.
* `joblib`: Model serialization/deserialization.
* `pandas` & `numpy`: Data manipulation during feature vector creation.
* `scikit-learn` (v1.9.0): Model execution (standard scaling and logistic regression).

### Node.js (Backend)
* `express`: Web server.
* `h5wasm` (v0.10.3): Dynamic WebAssembly-based HDF5 parsing for NASA SMAP files.
* `geotiff` (v3.0.5): Pure JavaScript GeoTIFF parser for NASA SRTM DEM images.
* `cors` & `dotenv`: Configurations.

### React (Frontend)
* `leaflet` & `react-leaflet`: Geospatial map rendering and coordinate inspection.
* `lucide-react`: Icon sets.

---

## 12. What Is Actually Complete?

| Component | Claimed Purpose | Actual Implementation | Connected? | Tested? | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rainfall API** | Query live precipitation | Queries Open-Meteo REST API and sums historical values | Yes | Yes | **WORKING** |
| **Soil Moisture API** | Query NASA SMAP satellite soil moisture | Queries CMR catalog, downloads `.h5` files, and extracts closest coordinate | Yes | Yes | **WORKING (Requires Token)** |
| **Terrain API** | Query elevation & slope | Queries OpenTopography, parses GeoTIFF, and calculates Horn 3x3 slope. Fallbacks to Open-Meteo Copernicus DEM. | Yes | Yes | **WORKING (Limited to 50 API calls/day)** |
| **Historical Proximity** | Fetch historical landslides | Runs Haversine distance over local GSI Tamil Nadu inventory CSV | Yes | Yes | **PARTIAL (Tamil Nadu only)** |
| **Satellite Rainfall** | Read GPM IMERG rainfall | Parses local preprocessed JSON database grid | Yes | Yes | **PARTIAL (Area limited)** |
| **IoT Integration** | Incorporate live local sensors | Offline placeholders | No | No | **MOCK** |
| **ML Inference** | Estimate flood probability | FastAPI wrapper running Scikit-Learn Logistic Regression | Yes | Yes | **WORKING** |
| **Data Quality Layer** | Verify freshness/quality | Service check mapping data ages and reporting Warnings | Yes | Yes | **WORKING** |
| **Web Frontend** | Display risk and metrics | Leaflet interface rendering gauges, layers, and tables | Yes | Yes | **WORKING** |

---

## 13. Major Technical Problems

### 1. Root Directory is Broken (CRITICAL)
* **Description**: The root folder contains a duplicate `frontend/` directory that lacks `components/` and `pages/` folders, and does not have `react-router-dom` in `package.json`. Running the root `./start-all.ps1` runs this broken directory, crashing instantly.
* **Impact**: Blocks standard startup for users running scripts from the workspace root.

### 2. OpenTopography 50-Call Limit (HIGH)
* **Description**: OpenTopography API keys are rate-limited to 50 calls/24 hours. The historical dataset has 146 incomplete rows (8% of coordinates) because the training script ran out of quota.
* **Impact**: In live runs, exceeding this rate limit triggers the Copernicus DEM fallback, meaning slope and relief features are returned as `null`.

### 3. Risk Threshold Mismatch (HIGH)
* **Description**: The risk thresholds differ between frontend and backend:
  * Backend: Moderate $\ge$ 30%, High $\ge$ 50%, Critical $\ge$ 70%.
  * Frontend: Moderate $\ge$ 30%, High $\ge$ 60%, Critical $\ge$ 80%.
* **Impact**: A single location could display different risk levels (e.g. "HIGH" in the backend log, but "MODERATE" on the frontend layout).

### 4. Version Mismatch in Pickled Classifier (MEDIUM)
* **Description**: The model pipeline was compiled in scikit-learn version 1.6.0, but the active Python environment uses version 1.9.0.
* **Impact**: Throws runtime warnings on startup. Could cause prediction drift or crashes on micro-version changes.

### 5. Landslide Inventory Area Limit (MEDIUM)
* **Description**: GSI dataset only covers Tamil Nadu. For Kerala and Uttarakhand, landslide counts return `null` and default to `0`.
* **Impact**: Weakens prediction reliability outside Tamil Nadu since the model assumes no landslides are present.

### 6. Model-Feature Mismatch (LOW)
* **Description**: `feature_schema.py` outputs a 27-feature vector, but both the training script and the inference API only accept 9 features.
* **Impact**: Inconsistencies when trying to inspect or expand features.

---

## 14. Final Verdict

1. **Is there a real ML model?**  
   Yes, there is a serialized Scikit-Learn Pipeline (`flash_flood_model_v1.joblib`).
2. **Was it actually trained?**  
   Yes. It was trained using `train_model.py` on `final_training_dataset.csv`.
3. **What algorithm does it use?**  
   Logistic Regression (preceded by Standard Scaling).
4. **What data was it trained on?**  
   1,818 samples representing historical floods in Kerala, Tamil Nadu, and Uttarakhand.
5. **Is the trained model currently loaded by the application?**  
   Yes, it is loaded into memory on startup by the FastAPI server in `prediction_api.py`.
6. **Are predictions actually generated by that model?**  
   Yes, predictions are generated dynamically via model inference.
7. **Is the frontend displaying those predictions?**  
   Yes, the dashboard displays the probabilities returned by the ML server.
8. **Which parts use real data?**  
   Weather APIs, rainfall APIs, NASA SMAP soil moisture, and NASA SRTM terrain elevation.
9. **Which parts are simulated?**  
   IoT sensors are mocked (offline placeholders). Landslide proximity and GPM satellite rainfall are mapped from static local datasets.
10. **Can this project currently be demonstrated end-to-end?**  
    Yes, if launched from the `main-project` subdirectory.
11. **What would fail during a live demonstration?**  
    * Running standard scripts from the workspace root will crash.
    * Running coordinates outside the static database bounds for GPM satellite rainfall will output missing data.
    * Querying too many novel locations will trigger OpenTopography rate limits, forcing Copernicus DEM elevation fallbacks.
12. **What should be tested next?**  
    * Unify risk classification thresholds across the backend and frontend.
    * Re-pickle the model within the current scikit-learn environment (v1.9.0) to eliminate version warnings.
    * Fix the root `start-all.ps1` script to point to `main-project/` files.
