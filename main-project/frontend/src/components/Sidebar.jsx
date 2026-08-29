import React from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Radio,
  Bell,
  Settings,
  Sun,
  Moon,
  ShieldAlert,
  Droplets,
} from "lucide-react";

function Sidebar({ activeView, theme, onToggleTheme }) {
  const navigate = useNavigate();
  const menuItems = [
    { name: "Overview", icon: LayoutDashboard, id: "overview", path: "/dashboard" },
    { name: "Live Monitor", icon: Radio, id: "live-monitor", path: "/dashboard/live-monitor" },
    { name: "Safe Routes", icon: ShieldAlert, id: "safe-routes", path: "/dashboard/safe-routes" },
    { name: "River Monitor", icon: Droplets, id: "river-monitor", path: "/dashboard/river-monitor" },
    { name: "Alerts", icon: Bell, id: "alerts", path: "/dashboard/alerts" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>ENV-MONITOR</h2>
        <span className="badge">V3.2 Active</span>
      </div>

      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.name}
                className={activeView === item.id ? "active" : ""}
              >
                <button
                  type="button"
                  className="nav-btn"
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="nav-icon" size={18} />
                  <span>{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {onToggleTheme && (
          <button
            type="button"
            className="nav-btn theme-toggle-btn"
            onClick={onToggleTheme}
            style={{ marginBottom: "8px" }}
          >
            {theme === "light" ? (
              <Moon className="nav-icon" size={18} />
            ) : (
              <Sun className="nav-icon" size={18} />
            )}
            <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
          </button>
        )}
        <button type="button" className="nav-btn footer-btn">
          <Settings className="nav-icon" size={18} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
