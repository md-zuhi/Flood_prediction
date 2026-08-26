import React from "react";

function DashboardHeader({
  selectedLocation,
  locations,
  onLocationChange,
  loading,
}) {
  const handleSelect = (e) => {
    const loc = locations.find((item) => item.name === e.target.value);
    if (loc) {
      onLocationChange(loc);
    }
  };

  // Group locations by state
  const states = [...new Set(locations.map((loc) => loc.state))];

  return (
    <header className="dashboard-header">
      <div className="header-info">
        <h1>FLASH FLOOD PREDICTION SYSTEM</h1>
        <p className="subtitle">AI-Based Early Warning for Hilly Regions</p>
      </div>

      <div className="location-selector">
        <label htmlFor="location-dropdown">Monitoring Location</label>
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
    </header>
  );
}

export default DashboardHeader;
