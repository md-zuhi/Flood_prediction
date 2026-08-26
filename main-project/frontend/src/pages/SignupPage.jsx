import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSignup = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Frontend validation
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Success transition (without database mock operations or storing credentials)
    setSuccess("Account created successfully! Redirecting to login...");
    setTimeout(() => {
      navigate("/login");
    }, 2000);
  };

  const locationsList = ["Coonoor", "Ooty", "Kodaikanal", "Munnar", "Wayanad", "Nainital", "Mussoorie", "Dehradun"];

  return (
    <div className="auth-page-container">
      <Navbar />

      <div className="auth-card-wrapper">
        <div className="card auth-card">
          <div className="auth-header">
            <h2>Create Account</h2>
            <p>Register to monitor early warning flood parameters</p>
          </div>

          {error && <div className="error-box">⚠ {error}</div>}
          {success && <div className="success-box">✓ {success}</div>}

          <form onSubmit={handleSignup} className="auth-form">
            <div className="form-group">
              <label htmlFor="fullname">Full Name *</label>
              <input
                type="text"
                id="fullname"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                placeholder="enter@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Preferred Monitoring Location (Optional)</label>
              <select
                id="location"
                value={preferredLocation}
                onChange={(e) => setPreferredLocation(e.target.value)}
              >
                <option value="">Select a location...</option>
                {locationsList.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              Create Account
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
