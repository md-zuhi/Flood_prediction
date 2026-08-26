// ─────────────────────────────────────────────────────────────────────────────
// SIH 2026 — Flash Flood Prediction & Hyper-Local Risk Monitoring System
// Root Application Component
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { CloudRain, Activity, Info } from 'lucide-react';
import FloodWeatherDashboard from './components/FloodWeatherDashboard';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top navigation bar ─────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid var(--color-border)',
        background: 'rgba(6, 13, 26, 0.95)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 24px',
      }}>
        <div style={{
          maxWidth: '1400px', margin: '0 auto',
          height: '60px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59,130,246,0.35)',
            }}>
              <CloudRain size={18} color="#fff" />
            </div>
            <div>
              <div style={{
                fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.01em',
                color: 'var(--color-text-primary)', lineHeight: 1.1,
              }}>
                FloodWatch AI
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '0.05em' }}>
                SIH 2026 · Smart India Hackathon
              </div>
            </div>
          </div>

          {/* Nav pills */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Active tab */}
            <button
              id="nav-weather"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                fontSize: '0.82rem', fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <CloudRain size={14} />
              Weather Monitor
            </button>
            <button
              id="nav-prediction-placeholder"
              disabled
              title="Available in Phase 2"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'not-allowed',
                background: 'transparent', color: 'var(--color-text-muted)',
                fontSize: '0.82rem', fontWeight: 500, opacity: 0.5,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Activity size={14} />
              Flood Prediction
              <span style={{
                fontSize: '0.58rem', fontWeight: 700, padding: '1px 5px',
                background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
                borderRadius: '999px', letterSpacing: '0.06em',
              }}>Phase 2</span>
            </button>
          </nav>

          {/* Right side info chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 10px', borderRadius: '8px',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
            fontSize: '0.72rem', color: '#a5b4fc',
          }}>
            <Info size={11} />
            Phase 1 of 4
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1 }}>
        <FloodWeatherDashboard />
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: '0.72rem',
        color: 'var(--color-text-muted)',
      }}>
        SIH 2026 — AI-Based Flash Flood Prediction &amp; Hyper-Local Risk Monitoring System ·
        Weather data provided by{' '}
        <a
          href="https://open-meteo.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-accent-blue)', textDecoration: 'none' }}
        >
          Open-Meteo
        </a>
        {' '}(open-source, no API key required)
      </footer>
    </div>
  );
}
