import React from "react";
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="public-navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <h2>ENV-MONITOR</h2>
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;
