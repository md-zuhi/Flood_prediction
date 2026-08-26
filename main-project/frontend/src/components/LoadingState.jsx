import React from "react";

function LoadingState() {
  return (
    <div className="loading-overlay">
      <div className="spinner-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Fetching live environmental data...</p>
      </div>
    </div>
  );
}

export default LoadingState;
