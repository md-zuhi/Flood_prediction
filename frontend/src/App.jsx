import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import "./App.css";

// Public pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminLoginPage from "./pages/AdminLoginPage";

// Dashboard
import Sidebar from "./components/Sidebar";
import OverviewDashboard from "./pages/OverviewDashboard";


// --------------------------------------------------
// AVAILABLE PROTOTYPE LOCATIONS
// --------------------------------------------------

const locations = [
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


// --------------------------------------------------
// DASHBOARD WRAPPER
// --------------------------------------------------

function DashboardPage() {
  const [selectedLocation, setSelectedLocation] =
    useState(locations[0]);

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");


  // --------------------------------------------------
  // ANALYZE FLOOD RISK
  // --------------------------------------------------

  const analyzeRisk = async () => {
    try {
      setLoading(true);
      setError("");

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
          data.message ||
            "Failed to generate flood prediction."
        );
      }

      setResult(data);
    } catch (err) {
      console.error("Prediction error:", err);

      setError(
        err.message ||
          "Unable to connect to the prediction server."
      );
    } finally {
      setLoading(false);
    }
  };


  // --------------------------------------------------
  // LOCATION CHANGE
  // --------------------------------------------------

  const handleLocationChange = (locationName) => {
    const location = locations.find(
      (item) => item.name === locationName
    );

    if (location) {
      setSelectedLocation(location);

      // Clear old location result
      setResult(null);
      setError("");
    }
  };


  // --------------------------------------------------
  // DASHBOARD UI
  // --------------------------------------------------

  return (
    <div className="dashboard-layout">

      <Sidebar />

      <OverviewDashboard
        locations={locations}

        selectedLocation={selectedLocation}

        setSelectedLocation={setSelectedLocation}

        onLocationChange={handleLocationChange}

        result={result}

        loading={loading}

        error={error}

        analyzeRisk={analyzeRisk}

        onAnalyze={analyzeRisk}
      />

    </div>
  );
}


// --------------------------------------------------
// MAIN APPLICATION
// --------------------------------------------------

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* Landing Page */}
        <Route
          path="/"
          element={<LandingPage />}
        />


        {/* User Login */}
        <Route
          path="/login"
          element={<LoginPage />}
        />


        {/* User Registration */}
        <Route
          path="/signup"
          element={<SignupPage />}
        />


        {/* Administrator Login */}
        <Route
          path="/admin/login"
          element={<AdminLoginPage />}
        />


        {/* Main Flash Flood Dashboard */}
        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />


        {/* Invalid URL -> Landing Page */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;