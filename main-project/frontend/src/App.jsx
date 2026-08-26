import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import OverviewDashboard from "./pages/OverviewDashboard";
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
  const [selectedLocation, setSelectedLocation] = useState(locations[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeRisk = async () => {
    try {
      setLoading(true);
      setError("");
      // Do not clear the previous result immediately to avoid layout thrashing,
      // but let the UI know it is loading.

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${apiBaseUrl}/api/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selectedLocation),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Prediction request failed");
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run analysis automatically when location changes (includes mount)
  useEffect(() => {
    analyzeRisk();
  }, [selectedLocation]);

  // Dynamic risk level classification based on flood probability percentage
  const getRiskClassification = (prob) => {
    const p = Number(prob);
    if (isNaN(p)) return { level: "UNKNOWN", color: "#82cfff" };
    if (p < 30) return { level: "LOW", color: "#22c55e" };      // 0-29%
    if (p < 60) return { level: "MODERATE", color: "#f5a623" }; // 30-59%
    if (p < 80) return { level: "HIGH", color: "#f97316" };     // 60-79%
    return { level: "CRITICAL", color: "#ef5350" };             // 80-100%
  };

  const classification = result
    ? getRiskClassification(result.prediction.flood_probability_percent)
    : { level: "UNKNOWN", color: "#82cfff" };

  const uiResult = result
    ? {
        ...result,
        prediction: {
          ...result.prediction,
          risk_level: classification.level,
        },
      }
    : null;

  const riskColor = classification.color;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <OverviewDashboard
        result={uiResult}
        selectedLocation={selectedLocation}
        locations={locations}
        onLocationChange={setSelectedLocation}
        loading={loading}
        error={error}
        riskColor={riskColor}
      />
    </div>
  );
}

export default App;