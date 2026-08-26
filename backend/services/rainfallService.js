async function getRainfall(latitude, longitude) {
  try {
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
      throw new Error(
        `Open-Meteo rainfall API failed: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.hourly || !data.hourly.time || !data.hourly.precipitation) {
      throw new Error("Hourly precipitation data missing from response");
    }

    const times  = data.hourly.time;          // ISO strings e.g. "2026-08-24T14:00"
    const precip = data.hourly.precipitation; // mm per hour

    // Find the index of the most recent hour at or before now (local time)
    const nowMs = Date.now();

    let latestIdx = -1;
    for (let i = 0; i < times.length; i++) {
      // Open-Meteo returns local time strings without timezone offset.
      // Parsing as-is gives UTC interpretation in JS, but since we only
      // need relative ordering and "not in the future" we compare against
      // the UTC wall-clock shifted by the same offset implicitly.
      // Safer: compare epoch ms — treat the time string as UTC for ordering.
      const tMs = new Date(times[i] + ":00Z").getTime();
      if (tMs <= nowMs) {
        latestIdx = i;
      }
    }

    if (latestIdx < 0) {
      throw new Error("No past hourly observations found");
    }

    // Rolling sums: sum the last N hours ending at latestIdx (inclusive)
    function rollingSum(n) {
      if (latestIdx + 1 < n) return null; // insufficient history
      let sum = 0;
      for (let k = latestIdx - n + 1; k <= latestIdx; k++) {
        const v = precip[k];
        sum += (v !== null && v !== undefined) ? v : 0;
      }
      return +sum.toFixed(3);
    }

    return {
      rain_30m_mm:  null,           // hourly data cannot provide true 30-min observation
      rain_1h_mm:   rollingSum(1),
      rain_3h_mm:   rollingSum(3),
      rain_6h_mm:   rollingSum(6),
      rain_12h_mm:  rollingSum(12),
      rain_24h_mm:  rollingSum(24),
      observation_time: times[latestIdx],
      source: "Open-Meteo",
      status: "success"
    };

  } catch (error) {
    console.error("Rainfall service error:", error.message);

    return {
      rain_30m_mm:  null,
      rain_1h_mm:   null,
      rain_3h_mm:   null,
      rain_6h_mm:   null,
      rain_12h_mm:  null,
      rain_24h_mm:  null,
      observation_time: null,
      source: "Open-Meteo",
      status: "failed",
      error: error.message
    };
  }
}

module.exports = { getRainfall };
