import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { ShieldAlert } from "lucide-react";

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setError("");

    // Frontend validation only
    if (!email || !password) {
      setError("Please fill in all fields.");
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

    // Since Admin Dashboard is not built yet, we transition to the Overview Dashboard
    // for design preview, indicating admin role in console logs.
    console.log("Admin authentication validated. Redirecting to system dashboard.");
    navigate("/dashboard");
  };

  return (
    <div className="auth-page-container admin-theme">
      <Navbar />

      <div className="auth-card-wrapper">
        <div className="card auth-card admin-card">
          <div className="admin-badge">
            <ShieldAlert size={16} />
            <span>RESTRICTED PORTAL</span>
          </div>

          <div className="auth-header">
            <h2>Administrator Access</h2>
            <p>Authorized personnel only</p>
          </div>

          {error && <div className="error-box">⚠ {error}</div>}

          <form onSubmit={handleAdminLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="admin-email">Admin Email</label>
              <input
                type="email"
                id="admin-email"
                placeholder="admin@env-monitor.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-password">Password</label>
              <input
                type="password"
                id="admin-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-admin">
              Admin Login
            </button>
          </form>

          <p className="admin-security-msg">
            Administrative access is restricted to authorized system personnel.
          </p>

          <div className="auth-footer">
            <Link to="/login" className="back-link">
              &larr; Back to User Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;
