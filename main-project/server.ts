// ─────────────────────────────────────────────────────────────────────────────
// SIH 2026 — Flash Flood Prediction & Hyper-Local Risk Monitoring System
// Phase 1: Express + Vite unified server
//
// Architecture:
//   • Express handles all /api/* routes
//   • In development, Vite runs as an Express middleware (single port, no CORS)
//   • In production, Express serves the pre-built static files from /dist
//
// Run:  npm run dev  →  tsx server.ts
// ─────────────────────────────────────────────────────────────────────────────

import express, { Request, Response, NextFunction } from 'express';
import path    from 'path';
import dotenv  from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { fetchWeatherFromOpenMeteo } from './weatherService.js';

// Load environment variables (.env.local takes precedence, then .env)
dotenv.config({ path: '.env.local' });
dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json({ limit: '1mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Utility: validate a numeric query parameter within an inclusive range
// ─────────────────────────────────────────────────────────────────────────────

function parseCoordinate(
  value: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number | { error: string } {
  if (value === undefined || value === '') return fallback;
  const n = parseFloat(value);
  if (isNaN(n) || n < min || n > max) {
    return { error: `Value "${value}" is out of range [${min}, ${max}]` };
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/weather/current
//
// Query parameters (all optional — defaults to Chennai):
//   latitude  : -90  to 90
//   longitude : -180 to 180
//   timezone  : IANA timezone string (e.g. "Asia/Kolkata")
//
// Returns the normalised WeatherData JSON.
// NOTE: The backend controls which external API is called.
//       Clients cannot pass an arbitrary external URL.
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/weather/current', async (req: Request, res: Response) => {
  try {
    // Validate and parse coordinates
    const latResult = parseCoordinate(
      req.query.latitude as string | undefined,
      -90, 90,
      parseFloat(process.env.WEATHER_LATITUDE ?? '13.0827'),
    );
    const lonResult = parseCoordinate(
      req.query.longitude as string | undefined,
      -180, 180,
      parseFloat(process.env.WEATHER_LONGITUDE ?? '80.2707'),
    );

    if (typeof latResult === 'object') {
      return res.status(400).json({ error: `Invalid latitude: ${latResult.error}` });
    }
    if (typeof lonResult === 'object') {
      return res.status(400).json({ error: `Invalid longitude: ${lonResult.error}` });
    }

    // Only allow known IANA timezone strings (basic safeguard)
    const rawTz   = (req.query.timezone as string | undefined) ?? '';
    const timezone = rawTz.match(/^[A-Za-z_\/]+$/) ? rawTz
                   : (process.env.WEATHER_TIMEZONE ?? 'Asia/Kolkata');

    const data = await fetchWeatherFromOpenMeteo({
      latitude:  latResult,
      longitude: lonResult,
      timezone,
    });

    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/weather/current]', message);

    // Never expose internal stack traces to the client
    if (message.includes('aborted') || message.includes('timeout')) {
      return res.status(504).json({
        error: 'Weather service timed out. Please try again later.',
      });
    }
    if (message.includes('fetch')) {
      return res.status(502).json({
        error: 'Unable to reach the Open-Meteo weather service. Check network connectivity.',
      });
    }
    res.status(500).json({
      error: 'Failed to fetch weather data. Please try again later.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start server — attach Vite dev middleware or serve production build
// ─────────────────────────────────────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Development: Vite runs as Express middleware — same port, no CORS needed
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve the pre-built frontend
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌊 SIH 2026 Flash Flood Prediction System`);
    console.log(`   Phase 1 — Live Weather Data Integration`);
    console.log(`   Server: http://localhost:${PORT}`);
    console.log(`   Weather API: http://localhost:${PORT}/api/weather/current\n`);
  });
}

startServer();
