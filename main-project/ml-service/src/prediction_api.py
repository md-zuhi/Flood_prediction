from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


# --------------------------------------------------
# Model path
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "flash_flood_model_v1.joblib"
)


# --------------------------------------------------
# Features - MUST match training order
# --------------------------------------------------

FEATURES = [
    "rain_1h_mm",
    "rain_3h_mm",
    "rain_6h_mm",
    "rain_12h_mm",
    "rain_24h_mm",
    "temperature_c",
    "humidity_percent",
    "soil_moisture_m3m3",
    "elevation_m"
]


# --------------------------------------------------
# Load model
# --------------------------------------------------

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"ML model not found: {MODEL_PATH}"
    )

model = joblib.load(MODEL_PATH)


# --------------------------------------------------
# FastAPI
# --------------------------------------------------

app = FastAPI(
    title="Flash Flood Prediction API",
    version="1.0"
)


# --------------------------------------------------
# Input schema
# --------------------------------------------------

class FloodFeatures(BaseModel):

    rain_1h_mm: float
    rain_3h_mm: float
    rain_6h_mm: float
    rain_12h_mm: float
    rain_24h_mm: float

    temperature_c: float
    humidity_percent: float
    soil_moisture_m3m3: float
    elevation_m: float


# --------------------------------------------------
# Health endpoint
# --------------------------------------------------

@app.get("/")
def home():

    return {
        "status": "success",
        "message": "Flash Flood ML Prediction API is running",
        "model": "flash_flood_model_v1"
    }


# --------------------------------------------------
# Prediction endpoint
# --------------------------------------------------

@app.post("/predict")
def predict_flood(data: FloodFeatures):

    try:

        values = data.model_dump()

        input_df = pd.DataFrame(
            [[values[feature] for feature in FEATURES]],
            columns=FEATURES
        )

        probability = float(
            model.predict_proba(input_df)[0][1]
        )

        prediction = int(
            model.predict(input_df)[0]
        )

        return {
            "success": True,
            "model_version": "v1",
            "flood_probability": round(probability, 4),
            "flood_probability_percent": round(
                probability * 100,
                2
            ),
            "prediction": prediction
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )