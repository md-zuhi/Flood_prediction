import React from "react";
import {
  LayoutDashboard,
  Radio,
  CloudRain,
  Map,
  Bell,
  History,
  Settings,
} from "lucide-react";

function Sidebar() {
  const menuItems = [
    { name: "Overview", icon: LayoutDashboard, active: true },
    { name: "Live Monitor", icon: Radio, active: false },
    { name: "Forecast", icon: CloudRain, active: false },
    { name: "Risk Map", icon: Map, active: false },
    { name: "Alerts", icon: Bell, active: false },
    { name: "History", icon: History, active: false },
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
                className={item.active ? "active" : ""}
              >
                <button type="button" className="nav-btn">
                  <Icon className="nav-icon" size={18} />
                  <span>{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="nav-btn footer-btn">
          <Settings className="nav-icon" size={18} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
