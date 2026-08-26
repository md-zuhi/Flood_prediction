// ─────────────────────────────────────────────────────────────────────────────
// SIH 2026 — useWeather hook
//
// Encapsulates:
//   • Initial fetch on mount
//   • Automatic background refresh every WEATHER_REFRESH_INTERVAL ms
//   • Manual refresh with duplicate-request protection
//   • Graceful error state (last successful data remains visible)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WeatherData } from '../types';

// Configurable refresh interval — read from the build-time env var injected by Vite.
// Defaults to 10 minutes (600 000 ms) if the var is absent.
const WEATHER_REFRESH_INTERVAL: number =
  parseInt(import.meta.env.VITE_WEATHER_REFRESH_INTERVAL ?? '600000', 10);

export type WeatherFetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseWeatherResult {
  data: WeatherData | null;
  /** Whether the very first load is still in progress */
  isInitialLoading: boolean;
  /** Whether a background/manual refresh is in progress */
  isRefreshing: boolean;
  status: WeatherFetchStatus;
  /** Null when no error; a user-friendly message when set */
  error: string | null;
  /** True when an error occurred but we still have stale data from a previous success */
  isStale: boolean;
  /** Trigger a manual refresh; no-op if one is already running */
  refresh: () => void;
  /** Epoch ms of the last successful fetch */
  lastFetchedAt: number | null;
}

export interface UseWeatherOptions {
  latitude?: number;
  longitude?: number;
}

export function useWeather(options: UseWeatherOptions = {}): UseWeatherResult {
  const [data,           setData]           = useState<WeatherData | null>(null);
  const [status,         setStatus]         = useState<WeatherFetchStatus>('idle');
  const [error,          setError]          = useState<string | null>(null);
  const [isInitialLoad,  setIsInitialLoad]  = useState(true);
  const [isRefreshing,   setIsRefreshing]   = useState(false);
  const [lastFetchedAt,  setLastFetchedAt]  = useState<number | null>(null);
  const [isStale,        setIsStale]        = useState(false);

  // Guard against concurrent fetches
  const isFetchingRef = useRef(false);

  // Build query string from options
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (options.latitude  !== undefined) params.set('latitude',  String(options.latitude));
    if (options.longitude !== undefined) params.set('longitude', String(options.longitude));
    const qs = params.toString();
    return qs ? `/api/weather/current?${qs}` : '/api/weather/current';
  }, [options.latitude, options.longitude]);

  const fetchWeather = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return;   // prevent duplicate requests
    isFetchingRef.current = true;

    if (isManual) {
      setIsRefreshing(true);
    } else if (!data) {
      setStatus('loading');
    } else {
      setIsRefreshing(true);
    }

    try {
      const url      = buildUrl();
      const response = await fetch(url);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ??
          `Server responded with HTTP ${response.status}`,
        );
      }

      const json = (await response.json()) as WeatherData;

      setData(json);
      setStatus('success');
      setError(null);
      setIsStale(false);
      setLastFetchedAt(Date.now());
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error while fetching weather.';

      console.error('[useWeather]', message);
      setStatus('error');
      setError(
        data
          ? `Unable to refresh — showing last successful update. (${message})`
          : `Unable to fetch live weather data. Please check your connection and try again.`,
      );
      if (data) setIsStale(true);  // keep stale data visible with error banner
    } finally {
      isFetchingRef.current = false;
      setIsInitialLoad(false);
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildUrl, data]);

  // Initial fetch on mount
  useEffect(() => {
    fetchWeather();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatic background refresh
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchWeather(false);
    }, WEATHER_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchWeather]);

  const refresh = useCallback(() => {
    fetchWeather(true);
  }, [fetchWeather]);

  return {
    data,
    isInitialLoading: isInitialLoad && status === 'loading',
    isRefreshing,
    status,
    error,
    isStale,
    refresh,
    lastFetchedAt,
  };
}
