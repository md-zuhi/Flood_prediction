import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import Sidebar from "./components/Sidebar";
import OverviewDashboard from "./pages/OverviewDashboard";
import LiveMonitorDashboard from "./pages/LiveMonitorDashboard";
import SafeRoutesDashboard from "./pages/SafeRoutesDashboard";
import RiverMonitoringDashboard from "./pages/RiverMonitoringDashboard";
import AlertsDashboard from "./pages/AlertsDashboard";
import { alarmController } from "./services/alarmController";
import { AlertOctagon } from "lucide-react";
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

  const [activeAlert, setActiveAlert] = useState(() => {
    try {
      const stored = localStorage.getItem("active_emergency_alert");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAlarmPlaying, setIsAlarmPlaying] = useState(() => {
    try {
      const storedAlert = localStorage.getItem("active_emergency_alert");
      const acked = localStorage.getItem("acknowledged_emergency_alert") === "true";
      return storedAlert && !acked;
    } catch {
      return false;
    }
  });

  const [alertHistory, setAlertHistory] = useState(() => {
    try {
      const history = localStorage.getItem("flood_alert_history");
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  });

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

  // Prime browser AudioContext on first user interaction
  useEffect(() => {
    const handleGesture = () => {
      alarmController.init();
    };
    window.addEventListener("click", handleGesture);
    window.addEventListener("keydown", handleGesture);
    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, []);

  // Sync Audio Playback status
  useEffect(() => {
    if (activeAlert && isAlarmPlaying) {
      alarmController.play();
    } else {
      alarmController.stop();
    }
  }, [activeAlert, isAlarmPlaying]);

  // Acknowledge Active Threat
  const handleAcknowledge = () => {
    setIsAlarmPlaying(false);
    localStorage.setItem("acknowledged_emergency_alert", "true");
    alarmController.stop();
  };

  // Hackathon Test Trigger
  const handleTriggerTestAlert = async () => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${apiBaseUrl}/api/alerts/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to trigger test alert SMS.");
      }

      const smsResult = data.sms;

      const testAlert = {
        id: `test-alert-${Date.now()}`,
        location: `${selectedLocation.name} (TEST)`,
        probability: 88,
        severity: "CRITICAL (DEMO)",
        timestamp: smsResult.timestamp || new Date().toISOString(),
        message: "DEMO TEST SIGNAL: Extreme flash-flood hazard simulated. Evacuation protocols active. Seek high ground immediately.",
        triggerReasons: [
          "Demo Mode: Hackathon manual test alert override active.",
          `SMS Provider: ${smsResult.provider.toUpperCase()} (${smsResult.status})`,
          `Recipient: ${smsResult.phoneMasked || "******4459"}`,
          smsResult.requestId ? `Request ID: ${smsResult.requestId}` : "Request ID: N/A"
        ],
        isDemo: true,
        sms: smsResult
      };

      setActiveAlert(testAlert);
      setIsAlarmPlaying(true);
      localStorage.setItem("active_emergency_alert", JSON.stringify(testAlert));
      localStorage.setItem("acknowledged_emergency_alert", "false");

      setAlertHistory((prev) => {
        const updated = [testAlert, ...prev];
        localStorage.setItem("flood_alert_history", JSON.stringify(updated));
        return updated;
      });

    } catch (err) {
      console.error(err);
      alert(`Failed to send test alert: ${err.message}`);

      // Keep test UI warning alive but with FAILED SMS state
      const failedSmsResult = {
        success: false,
        provider: "twilio",
        status: "FAILED",
        error: err.message,
        timestamp: new Date().toISOString()
      };

      const testAlert = {
        id: `test-alert-${Date.now()}`,
        location: `${selectedLocation.name} (TEST)`,
        probability: 88,
        severity: "CRITICAL (DEMO)",
        timestamp: new Date().toISOString(),
        message: "DEMO TEST SIGNAL: Extreme flash-flood hazard simulated. Evacuation protocols active. Seek high ground immediately.",
        triggerReasons: [
          "Demo Mode: Hackathon manual test alert override active.",
          "SMS Delivery status: FAILED",
          `Error: ${err.message}`
        ],
        isDemo: true,
        sms: failedSmsResult
      };

      setActiveAlert(testAlert);
      setIsAlarmPlaying(true);
      localStorage.setItem("active_emergency_alert", JSON.stringify(testAlert));
      localStorage.setItem("acknowledged_emergency_alert", "false");
    }
  };

  const handleClearHistory = () => {
    setAlertHistory([]);
    localStorage.removeItem("flood_alert_history");
  };

  // Monitor predictions to auto-trigger alarms
  useEffect(() => {
    if (!result || !result.prediction) return;
    const level = classification.level;
    if (level === "HIGH" || level === "CRITICAL") {
      const reasons = [];
      const rain24h = result.ml_features?.rain_24h_mm || 0;
      const rain3h = result.ml_features?.rain_3h_mm || 0;
      const soilMoisture = result.ml_features?.soil_moisture_m3m3 || 0;
      const slope = result.environmental_data?.terrain?.slope_deg || 0;
      const prob = result.prediction?.flood_probability_percent || 0;

      if (prob > 0) {
        reasons.push(`Model Warning: ML Model evaluated flood risk at ${prob}%.`);
      }
      if (rain24h > 40) {
        reasons.push(`Extreme Rainfall: 24h accumulated rainfall is high at ${rain24h.toFixed(1)} mm.`);
      }
      if (rain3h > 15) {
        reasons.push(`Intense Downpour: Short-term 3h rainfall reached ${rain3h.toFixed(1)} mm.`);
      }
      if (soilMoisture > 0.35) {
        reasons.push(`Soil Saturated: Moisture level at ${(soilMoisture * 100).toFixed(1)}% limits land absorption.`);
      }
      if (slope > 15) {
        reasons.push(`Terrain Hazard: Runoff accelerated by local slope gradients of ${slope.toFixed(1)}°.`);
      }

      const existingAlert = activeAlert;
      const isNew = !existingAlert || 
                    existingAlert.location !== result.location.name || 
                    existingAlert.timestamp !== result.generated_at;

      if (isNew) {
        const newAlert = {
          id: `alert-${Date.now()}`,
          location: result.location.name,
          probability: prob,
          severity: level,
          timestamp: result.generated_at || new Date().toISOString(),
          message: result.prediction.alert_message || "Emergency flash flood risk detected.",
          triggerReasons: reasons,
          isDemo: false
        };

        setActiveAlert(newAlert);
        setIsAlarmPlaying(true);
        localStorage.setItem("active_emergency_alert", JSON.stringify(newAlert));
        localStorage.setItem("acknowledged_emergency_alert", "false");

        setAlertHistory((prev) => {
          const duplicate = prev.some((h) => h.location === newAlert.location && h.timestamp === newAlert.timestamp);
          if (duplicate) return prev;
          const updated = [newAlert, ...prev];
          localStorage.setItem("flood_alert_history", JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [result]);

  const getRiskClassification = (predictionOrProb) => {
    let level = "UNKNOWN";
    let prob = null;

    if (predictionOrProb && typeof predictionOrProb === "object") {
      level = predictionOrProb.risk_level || "UNKNOWN";
      prob = predictionOrProb.flood_probability_percent;
    } else if (predictionOrProb !== undefined && predictionOrProb !== null) {
      prob = Number(predictionOrProb);
    }

    if ((level === "UNKNOWN" || !level) && prob !== null && !isNaN(prob)) {
      if (prob < 30) level = "LOW";
      else if (prob < 50) level = "MODERATE";
      else if (prob < 70) level = "HIGH";
      else level = "CRITICAL";
    }

    let color = "#82cfff";
    if (level === "LOW") color = "#22c55e";
    else if (level === "MODERATE") color = "#f5a623";
    else if (level === "HIGH") color = "#f97316";
    else if (level === "CRITICAL") color = "#ef5350";

    return { level, color };
  };

  const classification = result && result.prediction
    ? getRiskClassification(result.prediction)
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
      {activeAlert && isAlarmPlaying && (
        <div className="global-emergency-banner" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          background: "#ef4444",
          color: "#ffffff",
          padding: "14px 24px",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 25px rgba(239, 68, 68, 0.6)",
          fontWeight: 800,
          fontSize: "14px",
          fontFamily: "Inter, sans-serif"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <AlertOctagon className="alert-pulse-animation" size={20} />
            <span>
              EMERGENCY ALARM: High Flood Risk Detected in {activeAlert.location} ({activeAlert.probability}%)!
            </span>
          </div>
          <button 
            onClick={handleAcknowledge}
            style={{
              background: "#ffffff",
              color: "#ef4444",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: 800,
              fontSize: "11px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              textTransform: "uppercase"
            }}
          >
            Acknowledge & Silence
          </button>
        </div>
      )}
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
      {view === "safe-routes" && (
        <SafeRoutesDashboard
          locations={locations}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      {view === "river-monitor" && (
        <RiverMonitoringDashboard
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      {view === "alerts" && (
        <AlertsDashboard
          activeAlert={activeAlert}
          isAlarmPlaying={isAlarmPlaying}
          onAcknowledge={handleAcknowledge}
          onTriggerTestAlert={handleTriggerTestAlert}
          alertHistory={alertHistory}
          onClearHistory={handleClearHistory}
          locations={locations}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          loading={loading}
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
        <Route path="/dashboard/safe-routes" element={<DashboardWrapper view="safe-routes" />} />
        <Route path="/dashboard/river-monitor" element={<DashboardWrapper view="river-monitor" />} />
        <Route path="/dashboard/alerts" element={<DashboardWrapper view="alerts" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;