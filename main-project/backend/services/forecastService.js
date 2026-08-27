const _forecastCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function getRainfallForecast(latitude, longitude) {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const now = Date.now();
  const cached = _forecastCache.get(key);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 700));
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        `&hourly=precipitation` +
        `&forecast_days=2` +
        `&timezone=auto`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo forecast API failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.hourly || !data.hourly.time || !data.hourly.precipitation) {
        throw new Error("Hourly forecast data missing from response");
      }

      const times  = data.hourly.time;
      const precip = data.hourly.precipitation;
      const nowMs  = Date.now();

      let firstFutureIdx = -1;
      for (let i = 0; i < times.length; i++) {
        const tMs = new Date(times[i] + ":00Z").getTime();
        if (tMs > nowMs) {
          firstFutureIdx = i;
          break;
        }
      }

      if (firstFutureIdx < 0) {
        throw new Error("No future forecast hours found");
      }

      function forecastSum(n) {
        const end = firstFutureIdx + n;
        if (end > times.length) return null;
        let sum = 0;
        for (let k = firstFutureIdx; k < end; k++) {
          const v = precip[k];
          sum += (v !== null && v !== undefined) ? v : 0;
        }
        return +sum.toFixed(3);
      }

      const result = {
        forecast_1h_mm:   forecastSum(1),
        forecast_3h_mm:   forecastSum(3),
        forecast_6h_mm:   forecastSum(6),
        forecast_12h_mm:  forecastSum(12),
        forecast_24h_mm:  forecastSum(24),
        generated_time:   times[firstFutureIdx],
        source: "Open-Meteo",
        status: "success"
      };

      _forecastCache.set(key, { timestamp: now, data: result });
      return result;
    } catch (error) {
      if (attempt === 1) {
        console.error("Forecast service error:", error.message);
        if (cached) return { ...cached.data, status: "stale" };
      }
    }
  }

  return {
    forecast_1h_mm:   null,
    forecast_3h_mm:   null,
    forecast_6h_mm:   null,
    forecast_12h_mm:  null,
    forecast_24h_mm:  null,
    generated_time:   null,
    source: "Open-Meteo",
    status: "failed"
  };
}

module.exports = { getRainfallForecast };


