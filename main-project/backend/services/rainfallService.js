const _rainfallCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function getRainfall(latitude, longitude) {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const now = Date.now();
  const cached = _rainfallCache.get(key);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        `&hourly=precipitation` +
        `&past_days=2` +
        `&forecast_days=1` +
        `&timezone=auto`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo rainfall API failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.hourly || !data.hourly.time || !data.hourly.precipitation) {
        throw new Error("Hourly precipitation data missing from response");
      }

      const times  = data.hourly.time;
      const precip = data.hourly.precipitation;
      const nowMs  = Date.now();

      let latestIdx = -1;
      for (let i = 0; i < times.length; i++) {
        const tMs = new Date(times[i] + ":00Z").getTime();
        if (tMs <= nowMs) {
          latestIdx = i;
        }
      }

      if (latestIdx < 0) {
        throw new Error("No past hourly observations found");
      }

      function rollingSum(n) {
        if (latestIdx + 1 < n) return null;
        let sum = 0;
        for (let k = latestIdx - n + 1; k <= latestIdx; k++) {
          const v = precip[k];
          sum += (v !== null && v !== undefined) ? v : 0;
        }
        return +sum.toFixed(3);
      }

      const result = {
        rain_30m_mm:  null,
        rain_1h_mm:   rollingSum(1),
        rain_3h_mm:   rollingSum(3),
        rain_6h_mm:   rollingSum(6),
        rain_12h_mm:  rollingSum(12),
        rain_24h_mm:  rollingSum(24),
        observation_time: times[latestIdx],
        source: "Open-Meteo",
        status: "success"
      };

      _rainfallCache.set(key, { timestamp: now, data: result });
      return result;
    } catch (error) {
      if (attempt === 1) {
        console.error("Rainfall service error:", error.message);
        if (cached) return { ...cached.data, status: "stale" };
      }
    }
  }

  return {
    rain_30m_mm:  null,
    rain_1h_mm:   null,
    rain_3h_mm:   null,
    rain_6h_mm:   null,
    rain_12h_mm:  null,
    rain_24h_mm:  null,
    observation_time: null,
    source: "Open-Meteo",
    status: "failed"
  };
}

module.exports = { getRainfall };


