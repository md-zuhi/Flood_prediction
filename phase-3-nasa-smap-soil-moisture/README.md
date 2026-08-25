# Phase 3 — NASA SMAP Near-Real-Time Soil Moisture Feasibility Test

## What This Project Does

This is a **standalone feasibility test** with one purpose only:

> **User enters a location → convert to coordinates (Nominatim) → retrieve the latest valid NASA SMAP NRT satellite soil moisture observation → display the value, timestamp, quality and source.**

It does NOT contain ML prediction, flood risk, rainfall, maps, charts, login, or a database.

---

## NASA Dataset Being Used

| Field | Value |
|---|---|
| **Dataset** | Near Real-Time SMAP L2 Radiometer Half-Orbit 36 km EASE-Grid Soil Moisture |
| **Short Name** | `SPL2SMP_NRT` |
| **Version** | `107` |
| **Format** | HDF5 |
| **Grid** | EASE-Grid 2.0, 36 km resolution |
| **Source** | NASA JPL / NSIDC DAAC |
| **Coverage** | Global (satellite half-orbit swaths, ~twice/day) |
| **Latency** | Near-real-time (~3–12 hours after observation) |

---

## How It Works (Technical Flow)

```
1. User types location (e.g. "Ooty")
        ↓
2. Backend calls OpenStreetMap Nominatim → gets lat/lon
        ↓
3. Backend queries NASA CMR Search API (no auth required)
   https://cmr.earthdata.nasa.gov/search/granules.json
   ?short_name=SPL2SMP_NRT&version=107&bounding_box=...
        ↓
4. Gets download URL for latest granule covering that location
        ↓
5. Downloads HDF5 file with NASA Earthdata Bearer Token
   (30–100 MB — takes 30–120 seconds)
        ↓
6. Parses HDF5 with h5wasm (pure WebAssembly, no Python needed)
   Reads: Soil_Moisture_Retrieval_Data_AM/latitude
          Soil_Moisture_Retrieval_Data_AM/longitude
          Soil_Moisture_Retrieval_Data_AM/soil_moisture
          Soil_Moisture_Retrieval_Data_AM/retrieval_qual_flag
        ↓
7. Finds the nearest EASE-Grid cell to user's coordinates
        ↓
8. Validates value (fill value check + quality flag check)
        ↓
9. Returns clean JSON to React frontend
```

---

## Step 1: Create a Free NASA Earthdata Account

1. Go to: **https://urs.earthdata.nasa.gov/users/new**
2. Fill in the form and create your account (free, takes 2 minutes)
3. Verify your email

---

## Step 2: Generate a Bearer Token

1. Log in at: **https://urs.earthdata.nasa.gov/**
2. Click your username (top right) → **My Profile**
3. Click **"Generate Token"** (or "Manage Tokens")
4. Click **"Generate Token"** button
5. Copy the long alphanumeric string — this is your Bearer Token

The token looks like: `eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...`

---

## Step 3: Place the Token in `.env`

Open the file:
```
phase-3-nasa-smap-soil-moisture/.env
```

Replace the placeholder:
```
EARTHDATA_TOKEN=your_earthdata_token_here
```

With your actual token:
```
EARTHDATA_TOKEN=eyJ0eXAiOiJKV1Qi...  (your actual token)
```

> ⚠️ Never commit `.env` to Git. It is already in `.gitignore`.

---

## Step 4: Install Dependencies

```bash
cd phase-3-nasa-smap-soil-moisture
npm install
```

---

## Step 5: Start the Server

```bash
npm run dev
```

The server starts on **http://localhost:4000**

You will see in the terminal:
```
🛰️  Phase 3 — NASA SMAP Soil Moisture Feasibility Test
   Server:      http://localhost:4000
   Auth status: ✅ EARTHDATA_TOKEN configured
   Dataset:     SPL2SMP_NRT v107
```

If auth is not configured you will see `❌ EARTHDATA_TOKEN NOT SET`.

---

## Step 6: Test the Application

1. Open **http://localhost:4000** in your browser
2. Type **Ooty** in the location input
3. Click **"Get Soil Moisture"**
4. Wait 30–120 seconds (the backend downloads a 30–100 MB NASA HDF5 file)
5. See the result:
   - Latest Surface Soil Moisture (m³/m³)
   - Observation Time (actual NASA satellite pass time)
   - Observation Age
   - Quality flag
   - Dataset source

**Also try:** Kodaikanal, Munnar, Darjeeling, Shimla, Manali, Gangtok

---

## How to Verify the Value Came from NASA (Not Generated Locally)

### Method 1: Check the Debug Section
Click **"▶ Debug Information"** on the results page. You will see:
- **Granule name**: the actual SMAP file name (e.g. `SMAP_L2_SM_P_NRT_20260824T...`)
- **CMR search URL**: the exact NASA CMR API URL used
- **Download URL**: the exact NSIDC file URL downloaded
- **Raw value**: the unmodified float from the HDF5 array

### Method 2: Chrome DevTools Network Tab
1. Open **http://localhost:4000**
2. Press **F12** → **Network** tab → **Fetch/XHR** filter
3. Click "Get Soil Moisture"
4. You will see requests to `/api/geocode` and `/api/smap`
5. Check the `/api/smap` response — it contains `granuleName`, `downloadUrl` (pointing to NASA servers), and `cmrSearchUrl`

### Method 3: Check Server Terminal Logs
The terminal will print:
```
[CMR] Searching: https://cmr.earthdata.nasa.gov/search/granules.json?...
[CMR] Found 3 granule(s) matching bounding box
[SMAP] Found granule: SMAP_L2_SM_P_NRT_20260824T...
[Download] Starting: https://n5eil01u.ecs.nsidc.org/...
[Download] File size: 47 MB
[Download] Saved 47.2 MB → C:\...\smap_nrt_1234.h5
[HDF5] Soil_Moisture_Retrieval_Data_AM: 21856 pixels, fill=-9999
[HDF5] Nearest pixel: idx=12847 lat=11.422 lon=76.701 dist=7.3 km sm=0.3124 qf=0
[SMAP] Done. soilMoisture=0.3124 quality=valid
```

---

## Backend API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/geocode?location=Ooty` | Convert location to lat/lon |
| `GET /api/smap?lat=11.41&lon=76.69` | Fetch NASA SMAP soil moisture |
| `GET /api/health` | Check server + auth status |

---

## Important Notes

### SMAP is NOT minute-by-minute data
The SMAP satellite orbits Earth ~14–15 times per day. A specific location may only be observed **once or twice every 1–3 days** depending on latitude. The "Near Real-Time" means the data is available **3–12 hours** after the satellite pass — not "live" like a weather station.

### Observation Age
The result will always show how old the observation is. A value like "18 hours ago" is normal and expected for satellite data.

### Fill Values
If the satellite was unable to retrieve soil moisture at a pixel (heavy rain, frozen ground, water body, dense vegetation), the value will be a fill value (-9999). The application detects this and reports "No valid retrieval" rather than displaying -9999 as a real measurement.

### Download Time
HDF5 granule files are 30–100 MB. Expect 30–120 seconds for the first fetch on a typical broadband connection.
