import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import Sidebar from "./components/Sidebar";
import OverviewDashboard from "./pages/OverviewDashboard";
import LiveMonitorDashboard from "./pages/LiveMonitorDashboard";
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

// Dashboard wrapper coordinating predictions and stats
function DashboardWrapper({ view }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });
  const [selectedLocation, setSelectedLocation] = useState(locations[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const analyzeRisk = async () => {
    try {
      setLoading(true);
      setError("");

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
        if (data.data) {
           // Backend provided partial environmental data (fusedRecord) despite ML failure
           const partialResult = {
             location: data.data.location,
             ml_features: {
               rain_1h_mm: data.data.rainfall?.rain_1h_mm,
               rain_3h_mm: data.data.rainfall?.rain_3h_mm,
               rain_6h_mm: data.data.rainfall?.rain_6h_mm,
               rain_12h_mm: data.data.rainfall?.rain_12h_mm,
               rain_24h_mm: data.data.rainfall?.rain_24h_mm,
               temperature_c: data.data.weather?.temperature_c,
               humidity_percent: data.data.weather?.humidity_percent,
               soil_moisture_m3m3: data.data.soil_moisture?.value_m3_m3,
               elevation_m: data.data.terrain?.elevation_m
             },
             prediction: { risk_level: "UNKNOWN", flood_probability_percent: 0, alert_message: data.message },
             environmental_data: {
               weather: data.data.weather,
               rainfall: data.data.rainfall,
               rainfall_forecast: data.data.rainfall_forecast,
               soil_moisture: data.data.soil_moisture,
               terrain: data.data.terrain,
               landslide_history: data.data.landslide_history,
               satellite_rainfall: data.data.satellite_rainfall,
               iot: data.data.iot
             },
             metadata: data.data.metadata,
             data_sources: data.data.data_sources,
             generated_at: data.data.generated_at
           };
           setResult(partialResult);
           setError(data.message);
        } else {
           throw new Error(data.message || "Prediction request failed");
        }
      } else {
         setResult(data);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeRisk();
  }, [selectedLocation]);

  const getRiskClassification = (prob) => {
    const p = Number(prob);
    if (isNaN(p)) return { level: "UNKNOWN", color: "#82cfff" };
    if (p < 30) return { level: "LOW", color: "#22c55e" };
    if (p < 60) return { level: "MODERATE", color: "#f5a623" };
    if (p < 80) return { level: "HIGH", color: "#f97316" };
    return { level: "CRITICAL", color: "#ef5350" };
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
      <Sidebar activeView={view} theme={theme} onToggleTheme={toggleTheme} />
      {view === "overview" && (
        <OverviewDashboard
          result={uiResult}
          selectedLocation={selectedLocation}
          locations={locations}
          onLocationChange={setSelectedLocation}
          loading={loading}
          error={error}
          riskColor={riskColor}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      {view === "live-monitor" && (
        <LiveMonitorDashboard
          result={uiResult}
          selectedLocation={selectedLocation}
          locations={locations}
          onLocationChange={setSelectedLocation}
          loading={loading}
          error={error}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/dashboard" element={<DashboardWrapper view="overview" />} />
        <Route path="/dashboard/live-monitor" element={<DashboardWrapper view="live-monitor" />} />
        <Route path="/dashboard/forecast" element={<DashboardWrapper view="rainfall" />} />
        <Route path="/dashboard/rainfall" element={<DashboardWrapper view="rainfall" />} />
        <Route path="/dashboard/river-rise" element={<DashboardWrapper view="river-rise" />} />
        <Route path="/dashboard/risk-map" element={<DashboardWrapper view="risk-map" />} />
        <Route path="/dashboard/alerts" element={<DashboardWrapper view="alerts" />} />
        <Route path="/dashboard/history" element={<DashboardWrapper view="alerts" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;