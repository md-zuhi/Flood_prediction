# Flash Flood Prediction System - Final Consolidated Project

An integrated, end-to-end prototype for predicting flash flood risks using live weather, terrain, satellite rainfall, soil moisture, and historical landslide data.

## Project Overview

This project fuses real-time environmental data streams with a machine learning classification model to predict local flash flood probabilities. It covers key mountainous states in India prone to flash floods.

## Architecture

The application comprises three major service tiers:

```
                  ┌──────────────────────┐
                  │  React-Leaflet Map   │ (Frontend: Port 5173)
                  │      Dashboard       │
                  └──────────┬───────────┘
                             │
                             ▼  [Fetch /api/predict]
                  ┌──────────────────────┐
                  │   Node.js / Express  │ (Backend: Port 5000)
                  │   Data Fusion API    │
                  └──────────┬───────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐      ┌─────────────────┐
│ Weather/Rain │      │  Soil/Slope  │      │ FastAPI ML API  │ (Port 8000)
│ Live APIs    │      │ Cache & CSV  │      │ Scikit-Learn V1 │
└──────────────┘      └──────────────┘      └─────────────────┘
```

## Folder Structure

* `frontend/`: React + Leaflet single page dashboard.
* `backend/`: Node.js Express service querying APIs, loading terrain/historical datasets, and fusing data records.
* `ml-service/`: FastAPI web app wrapping the pre-trained Scikit-Learn model and features.

## Tech Stack

* **Frontend**: React, Leaflet (Map visualization), Vite
* **Backend**: Node.js, Express, Fetch
* **ML Service**: Python, FastAPI, Uvicorn, Pandas, Scikit-Learn, Joblib

## Data Sources

* **Weather & Live Rainfall**: Open-Meteo Weather API
* **Rainfall Forecast**: Open-Meteo Forecast
* **Soil Moisture**: NASA SMAP (via Earthdata API)
* **Terrain & Elevation**: OpenTopography API (SRTMGL1 DEM)
* **Historical Landslides**: Geological Survey of India (GSI) Inventory
* **Satellite Rainfall**: GPM (Global Precipitation Measurement)

## Supported States

* Tamil Nadu (e.g. Coonoor, Ooty, Kodaikanal)
* Kerala (e.g. Munnar, Wayanad)
* Uttarakhand (e.g. Nainital, Mussoorie, Dehradun)

## Ports

* **Frontend**: `5173`
* **Backend**: `5000`
* **ML Service**: `8000`

---

## Installation Steps

### 1. Prerequisites
Ensure you have the following installed:
* [Node.js (v18+)](https://nodejs.org/)
* [Python (v3.10+)](https://www.python.org/)

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 3. Install Backend Dependencies
```bash
cd ../backend
npm install
```

### 4. Install ML Service Dependencies
```bash
cd ../ml-service
python -m pip install -r requirements.txt
```

---

## Running the Services

### Automated Startup (Windows PowerShell)
From the `main-project/` directory, run:
```powershell
./start-all.ps1
```

### Manual Startup

1. **ML Service**:
   ```bash
   cd ml-service
   python -m uvicorn src.prediction_api:app --port 8000
   ```

2. **Backend**:
   ```bash
   cd backend
   npm start
   ```

3. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

---

## Prototype Limitations & Disclaimer

> [!WARNING]
> This software is an engineering **prototype** designed for demonstration and research.
> * The **ML risk bands** (Low, Moderate, High, Critical) are prototype thresholds calculated by the model.
> * They do **NOT** constitute official government alerts, weather warnings, or disaster evacuations.
