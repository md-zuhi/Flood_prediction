import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";

function LandingPage() {
  return (
    <div className="landing-premium-container">
      {/* Radial Gradient Glow in Background */}
      <div className="hero-radial-glow"></div>

      {/* Clean Minimal Navbar */}
      <nav className="premium-navbar">
        <div className="navbar-inner">
          <div className="navbar-logo-group">
            <Link to="/" className="navbar-logo-text">
              FLOODGUARD <span className="logo-accent-badge">AI</span>
            </Link>
          </div>

          <div className="navbar-actions-group">
            <Link to="/login" className="navbar-login-link">
              Log in
            </Link>
            <Link to="/signup" className="navbar-signup-btn">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Centered Hero Content */}
      <main className="premium-hero-section">
        <div className="hero-main-wrapper">
          {/* Top Pill Badge */}
          <div className="hero-badge-pill">
            <span>AI-POWERED FLASH FLOOD EARLY WARNING SYSTEM</span>
          </div>

          {/* Heading */}
          <h1 className="hero-main-heading">
            Predict flood risk,<br />
            <span className="hero-gradient-text">before danger strikes.</span>
          </h1>

          {/* Subtitle Paragraph */}
          <p className="hero-supporting-paragraph">
            Monitor rainfall, soil moisture, terrain, satellite observations and historical hazards in real time. 
            FloodGuard AI combines live environmental data with machine learning to estimate flash-flood 
            risk and support faster early-warning decisions.
          </p>

          {/* Centered Glowing CTA Button */}
          <div className="hero-cta-action">
            <Link to="/signup" className="premium-cta-btn">
              <Compass size={18} className="cta-icon" />
              <span>Get Started</span>
              <ArrowRight size={16} className="cta-arrow" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default LandingPage;
