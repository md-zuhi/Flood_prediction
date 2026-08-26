// ─────────────────────────────────────────────────────────────────────────────
// SIH 2026 — Flash Flood Prediction & Hyper-Local Risk Monitoring System
// Phase 1: Live Weather Dashboard Component
//
// Displays:
//   • Current weather metrics (real data from Open-Meteo via backend)
//   • 24-hour hourly forecast table
//   • Weather condition classification (NOT flood prediction)
//   • Loading skeleton, error state, manual + auto refresh
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  RefreshCw, MapPin, Clock, Thermometer, Droplets, Wind, CloudRain,
  Gauge, Cloud, Sprout, Eye, AlertTriangle, WifiOff, Info,
} from 'lucide-react';
import { useWeather } from '../hooks/useWeather';
import {
  classifyWeatherCondition, conditionLabel, conditionBadgeClass,
  conditionEmoji, formatTimestamp, formatTimeOnly, formatLastFetched, fmt,
} from '../lib/weatherUtils';
import type { HourlyWeatherEntry } from '../types';

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonMetricCard() {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div className="skeleton" style={{ width: '50%', height: '12px', marginBottom: '14px' }} />
      <div className="skeleton" style={{ width: '70%', height: '28px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '40%', height: '10px' }} />
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color?: string;
  sub?: string;
}

function MetricCard({ icon, label, value, unit, color = '#60a5fa', sub }: MetricCardProps) {
  return (
    <div
      className="card fade-in"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle glow accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: color }}>
        {icon}
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span className="metric-value">{value}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{unit}</span>
      </div>

      {sub && (
        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{sub}</span>
      )}
    </div>
  );
}

// ── Hourly row ─────────────────────────────────────────────────────────────────

function HourlyRow({ entry, index }: { entry: HourlyWeatherEntry; index: number }) {
  const isNow = index === 0;
  return (
    <tr style={{ background: isNow ? 'rgba(59,130,246,0.07)' : undefined }}>
      <td style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isNow && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px',
            background: 'rgba(59,130,246,0.2)', color: '#60a5fa',
            borderRadius: '999px', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>Now</span>
        )}
        {formatTimeOnly(entry.timestamp)}
      </td>
      <td style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
        {fmt(entry.temperature)}°C
      </td>
      <td>
        {entry.precipitationProbability !== null
          ? <span style={{ color: entry.precipitationProbability >= 70 ? '#38bdf8' : 'var(--color-text-secondary)' }}>
              {fmt(entry.precipitationProbability, 0)}%
            </span>
          : '—'}
      </td>
      <td>
        {fmt(entry.rain)} mm
      </td>
      <td>
        {fmt(entry.humidity, 0)}%
      </td>
      <td>
        {fmt(entry.windSpeed)} km/h
      </td>
      <td>
        {entry.soilMoisture !== null
          ? `${(entry.soilMoisture * 100).toFixed(1)}%`
          : '—'}
      </td>
    </tr>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function FloodWeatherDashboard() {
  const { data, isInitialLoading, isRefreshing, error, isStale, refresh, lastFetchedAt } =
    useWeather();

  const condition = data
    ? classifyWeatherCondition(data.current.weatherCode, data.current.precipitation)
    : 'UNKNOWN';

  // ── Loading state (first load only) ─────────────────────────────────────────
  if (isInitialLoading) {
    return (
      <div style={{ padding: '32px 24px' }}>
        <HeaderSection loading />
        <div className="metrics-grid" style={{ marginTop: '28px' }}>
          {Array.from({ length: 9 }).map((_, i) => <SkeletonMetricCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1400px', margin: '0 auto' }} className="fade-in">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <HeaderSection
        loading={false}
        isRefreshing={isRefreshing}
        lastFetchedAt={lastFetchedAt}
        onRefresh={refresh}
        locationName={data?.location.name}
        locationState={data?.location.state}
        apiTimestamp={data?.current.timestamp}
        condition={condition}
        condLabel={conditionLabel(condition)}
        condBadge={conditionBadgeClass(condition)}
        condEmoji={conditionEmoji(condition)}
        sourceUpdatedAt={data?.source.updatedAt ?? null}
      />

      {/* ── Phase 1 notice ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '12px 16px', borderRadius: 'var(--radius-md)',
        background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99,102,241,0.2)',
        marginBottom: '28px', fontSize: '0.8rem', color: '#a5b4fc',
      }}>
        <Info size={15} style={{ marginTop: '1px', flexShrink: 0 }} />
        <span>
          <strong>Phase 1 — Live Weather Data Only.</strong>{' '}
          Flash flood risk prediction (ML model) has not been implemented yet.
          The weather condition shown is a simple atmospheric classification, not a flood forecast.
        </span>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="error-box fade-in" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{error}</span>
        </div>
      )}

      {/* ── No data state ───────────────────────────────────────────────────── */}
      {!data && !isInitialLoading && (
        <div style={{
          textAlign: 'center', padding: '80px 24px',
          color: 'var(--color-text-muted)', display: 'flex',
          flexDirection: 'column', alignItems: 'center', gap: '16px',
        }}>
          <WifiOff size={48} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>Unable to fetch live weather data.</p>
          <button className="btn btn-primary" onClick={refresh} id="retry-btn">
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      )}

      {/* ── Current weather metrics ──────────────────────────────────────────── */}
      {data && (
        <>
          <div className="section-header">
            <span className="section-title">Current Conditions</span>
            {isStale && (
              <span style={{ fontSize: '0.72rem', color: 'var(--color-warn)', fontWeight: 600 }}>
                ⚠ Stale — refresh failed
              </span>
            )}
          </div>

          <div className="metrics-grid" style={{ marginBottom: '40px' }}>
            <MetricCard
              icon={<Thermometer size={15} />}
              label="Temperature"
              value={fmt(data.current.temperature)}
              unit="°C"
              color="#f97316"
              sub={data.current.apparentTemperature !== null
                ? `Feels like ${fmt(data.current.apparentTemperature)}°C`
                : undefined}
            />
            <MetricCard
              icon={<Droplets size={15} />}
              label="Humidity"
              value={fmt(data.current.humidity, 0)}
              unit="%"
              color="#38bdf8"
            />
            <MetricCard
              icon={<CloudRain size={15} />}
              label="Rainfall"
              value={fmt(data.current.precipitation)}
              unit="mm"
              color="#06b6d4"
              sub="Last hour"
            />
            <MetricCard
              icon={<CloudRain size={15} />}
              label="Rain"
              value={fmt(data.current.rain)}
              unit="mm"
              color="#3b82f6"
              sub="Rain component"
            />
            <MetricCard
              icon={<Wind size={15} />}
              label="Wind Speed"
              value={fmt(data.current.windSpeed)}
              unit="km/h"
              color="#a78bfa"
            />
            <MetricCard
              icon={<Wind size={15} />}
              label="Wind Gust"
              value={fmt(data.current.windGust)}
              unit="km/h"
              color="#c084fc"
            />
            <MetricCard
              icon={<Gauge size={15} />}
              label="Pressure"
              value={fmt(data.current.pressure, 0)}
              unit="hPa"
              color="#34d399"
            />
            <MetricCard
              icon={<Cloud size={15} />}
              label="Cloud Cover"
              value={fmt(data.current.cloudCover, 0)}
              unit="%"
              color="#94a3b8"
            />
            {/* Soil moisture from hourly[0] — not available in current block */}
            <MetricCard
              icon={<Sprout size={15} />}
              label="Soil Moisture"
              value={data.hourly[0]?.soilMoisture !== null && data.hourly[0]?.soilMoisture !== undefined
                ? ((data.hourly[0].soilMoisture) * 100).toFixed(1)
                : '—'}
              unit={data.hourly[0]?.soilMoisture !== null ? '% vol.' : ''}
              color="#86efac"
              sub="0–1 cm layer (hourly)"
            />
          </div>

          {/* ── 24-hour Hourly Forecast ────────────────────────────────────────── */}
          <div className="section-header">
            <span className="section-title">Hourly Forecast — Next 24 Hours</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              {data.hourly.length} entries · IST
            </span>
          </div>

          <div className="card" style={{ overflowX: 'auto', marginBottom: '32px' }}>
            <table className="weather-table" id="hourly-forecast-table">
              <thead>
                <tr>
                  <th>Time (IST)</th>
                  <th>Temp (°C)</th>
                  <th>Rain Prob.</th>
                  <th>Rain (mm)</th>
                  <th>Humidity</th>
                  <th>Wind (km/h)</th>
                  <th>Soil Moist.</th>
                </tr>
              </thead>
              <tbody>
                {data.hourly.map((entry, i) => (
                  <HourlyRow key={entry.timestamp} entry={entry} index={i} />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Data source footer ────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '12px',
            padding: '14px 18px', borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)',
            fontSize: '0.72rem', color: 'var(--color-text-muted)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={12} />
              <span>Data: <strong style={{ color: 'var(--color-text-secondary)' }}>Open-Meteo</strong> (free, no key required)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={12} />
              <span>
                API response generated: <strong style={{ color: 'var(--color-text-secondary)' }}>
                  {data.source.updatedAt ? formatTimestamp(data.source.updatedAt) : '—'}
                </strong>
              </span>
            </div>
            <div>
              Auto-refresh every <strong style={{ color: 'var(--color-accent-blue)' }}>10 min</strong>
              {' '}· Weather model update cadence differs from application refresh rate.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Header section (extracted to avoid prop drilling mess) ────────────────────

interface HeaderSectionProps {
  loading: boolean;
  isRefreshing?: boolean;
  lastFetchedAt?: number | null;
  onRefresh?: () => void;
  locationName?: string;
  locationState?: string;
  apiTimestamp?: string | null;
  condition?: ReturnType<typeof classifyWeatherCondition>;
  condLabel?: string;
  condBadge?: string;
  condEmoji?: string;
  sourceUpdatedAt?: string | null;
}

function HeaderSection({
  loading, isRefreshing, lastFetchedAt, onRefresh,
  locationName, locationState, apiTimestamp, condition,
  condLabel, condBadge, condEmoji, sourceUpdatedAt,
}: HeaderSectionProps) {
  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div>
          {/* System badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px',
              background: 'rgba(59,130,246,0.12)', color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.2)',
            }}>
              SIH 2026
            </span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
              Phase 1 · Live Weather Data Integration
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 900, lineHeight: 1.1,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #e2e8f0 30%, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', marginBottom: '10px',
          }}>
            Flash Flood Weather Monitor
          </h1>

          {/* Location + timestamp row */}
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                <MapPin size={13} color="#60a5fa" />
                <span>{locationName ?? '…'}, {locationState ?? '…'}</span>
              </div>

              {apiTimestamp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  <Clock size={12} />
                  <span>
                    Last updated: <strong style={{ color: 'var(--color-text-secondary)' }}>
                      {formatTimestamp(apiTimestamp)}
                    </strong>
                    {' '}IST
                  </span>
                </div>
              )}

              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div className="pulse-dot" />
                <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 600 }}>LIVE</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: condition badge + refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {condition && condition !== 'UNKNOWN' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Weather Condition
              </span>
              <span className={condBadge ?? 'badge badge-cloudy'}>
                {condEmoji} {condLabel}
              </span>
            </div>
          )}

          {onRefresh && (
            <button
              className="btn btn-primary"
              onClick={onRefresh}
              disabled={isRefreshing}
              id="refresh-weather-btn"
              title="Fetch latest weather data"
            >
              <RefreshCw
                size={14}
                style={{ animation: isRefreshing ? 'spin 1s linear infinite' : undefined }}
              />
              {isRefreshing ? 'Refreshing…' : 'Refresh Weather'}
            </button>
          )}
        </div>
      </div>

      {/* App fetch timestamp */}
      {lastFetchedAt && (
        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
          App last fetched: {formatLastFetched(lastFetchedAt)} · Auto-refresh every 10 min
        </p>
      )}
    </div>
  );
}
