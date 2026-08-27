import React, { useState } from "react";
import { Sun, Moon, Search } from "lucide-react";

function DashboardHeader({
  selectedLocation,
  locations,
  onLocationChange,
  loading,
  theme,
  onToggleTheme,
  allCities,
  onCitySearchSelect,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const handleSelect = (e) => {
    const loc = locations.find((item) => item.name === e.target.value);
    if (loc) {
      onLocationChange(loc);
    }
  };

  const states = [...new Set(locations.map((loc) => loc.state))];

  const filteredCities = (allCities || []).filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearchPick = (city) => {
    setSearchTerm("");
    setShowSearchResults(false);
    if (onCitySearchSelect) {
      onCitySearchSelect(city);
    }
  };

  return (
    <header className="dashboard-header">
      <div className="header-info">
        <h1>ENV-MONITOR INDIA LIVE</h1>
        <p className="subtitle">Interactive Weather Map & Flash Flood Early Warning System</p>
      </div>

      <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* India Location Search Box */}
        {allCities && (
          <div className="location-search-box" style={{ position: "relative" }}>
            <label style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 700, display: "block", marginBottom: "4px" }}>
              Search India
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", color: "var(--text-secondary)" }} />
              <input
                type="text"
                placeholder="Search city/location..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                style={{
                  padding: "8px 12px 8px 30px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                  width: "180px",
                }}
              />
            </div>

            {showSearchResults && searchTerm.trim().length > 0 && (
              <div
                className="search-results-dropdown"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 2000,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
                  marginTop: "4px",
                }}
              >
                {filteredCities.length === 0 ? (
                  <div style={{ padding: "8px 12px", fontSize: "12px", color: "var(--text-secondary)" }}>
                    No city found
                  </div>
                ) : (
                  filteredCities.map((city) => (
                    <div
                      key={city.name}
                      onClick={() => handleSearchPick(city)}
                      style={{
                        padding: "8px 12px",
                        fontSize: "13px",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--border-color)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{city.name}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{city.state}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Flood Location Selector */}
        <div className="location-selector">
          <label htmlFor="location-dropdown">Flood Monitoring Region</label>
          <select
            id="location-dropdown"
            value={selectedLocation.name}
            onChange={handleSelect}
            disabled={loading}
          >
            {states.map((stateName) => (
              <optgroup key={stateName} label={stateName}>
                {locations
                  .filter((loc) => loc.state === stateName)
                  .map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}, {loc.state}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        {onToggleTheme && (
          <button
            type="button"
            className="header-theme-toggle"
            onClick={onToggleTheme}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        )}
      </div>
    </header>
  );
}

export default DashboardHeader; 
