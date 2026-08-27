import React from "react";
import { Settings, X, Sliders, Eye } from "lucide-react";

function SettingsDrawer({ isOpen, onClose, settings, onUpdateSettings }) {
  if (!isOpen) return null;

  return (
    <div className="settings-drawer-overlay" style={{
      position: "absolute",
      top: "16px",
      right: "64px",
      zIndex: 2000,
      width: "280px",
      background: "rgba(17, 29, 48, 0.95)",
      border: "1px solid var(--border-color)",
      backdropFilter: "blur(16px)",
      borderRadius: "12px",
      padding: "16px",
      boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
      color: "var(--text-primary)",
      fontSize: "12px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "800", fontSize: "13px" }}>
          <Settings size={16} className="text-sky-400" />
          <span>GIS DISPLAY SETTINGS</span>
        </div>
        <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: "600" }}>Temperature Unit</label>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => onUpdateSettings("tempUnit", "C")}
              style={{ flex: 1, padding: "5px", borderRadius: "6px", border: settings.tempUnit === "C" ? "1px solid #2563eb" : "1px solid var(--border-color)", background: settings.tempUnit === "C" ? "rgba(37, 99, 235, 0.2)" : "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: "700" }}
            >
              °C (Celsius)
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings("tempUnit", "F")}
              style={{ flex: 1, padding: "5px", borderRadius: "6px", border: settings.tempUnit === "F" ? "1px solid #2563eb" : "1px solid var(--border-color)", background: settings.tempUnit === "F" ? "rgba(37, 99, 235, 0.2)" : "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: "700" }}
            >
              °F (Fahrenheit)
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: "600" }}>Wind Speed Unit</label>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => onUpdateSettings("windUnit", "kmh")}
              style={{ flex: 1, padding: "5px", borderRadius: "6px", border: settings.windUnit === "kmh" ? "1px solid #2563eb" : "1px solid var(--border-color)", background: settings.windUnit === "kmh" ? "rgba(37, 99, 235, 0.2)" : "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: "700" }}
            >
              km/h
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings("windUnit", "ms")}
              style={{ flex: 1, padding: "5px", borderRadius: "6px", border: settings.windUnit === "ms" ? "1px solid #2563eb" : "1px solid var(--border-color)", background: settings.windUnit === "ms" ? "rgba(37, 99, 235, 0.2)" : "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: "700" }}
            >
              m/s
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: "600" }}>City Label Density</label>
          <select
            value={settings.cityDensity || "medium"}
            onChange={(e) => onUpdateSettings("cityDensity", e.target.value)}
            style={{ width: "100%", padding: "6px", borderRadius: "6px", background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
          >
            <option value="low">Low (Major Cities Only)</option>
            <option value="medium">Medium (Districts & Capitals)</option>
            <option value="high">High (All Towns & Stations)</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: "600" }}>Timezone</label>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => onUpdateSettings("timezone", "local")}
              style={{ flex: 1, padding: "5px", borderRadius: "6px", border: settings.timezone === "local" ? "1px solid #2563eb" : "1px solid var(--border-color)", background: settings.timezone === "local" ? "rgba(37, 99, 235, 0.2)" : "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: "700" }}
            >
              Local (IST)
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings("timezone", "utc")}
              style={{ flex: 1, padding: "5px", borderRadius: "6px", border: settings.timezone === "utc" ? "1px solid #2563eb" : "1px solid var(--border-color)", background: settings.timezone === "utc" ? "rgba(37, 99, 235, 0.2)" : "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontWeight: "700" }}
            >
              UTC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsDrawer;
