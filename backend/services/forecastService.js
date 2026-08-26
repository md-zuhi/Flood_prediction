async function getRainfallForecast(latitude, longitude) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&hourly=precipitation` +
      `&forecast_days=2` +
      `&timezone=auto`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Open-Meteo forecast API failed: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.hourly || !data.hourly.time || !data.hourly.precipitation) {
      throw new Error("Hourly forecast data missing from response");
    }

    const times  = data.hourly.time;
    const precip = data.hourly.precipitation;
    const nowMs  = Date.now();

    // Find the first index strictly in the future
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

    // Sum next N future hours starting from firstFutureIdx
    function forecastSum(n) {
      const end = firstFutureIdx + n;
      if (end > times.length) return null; // not enough forecast data
      let sum = 0;
      for (let k = firstFutureIdx; k < end; k++) {
        const v = precip[k];
        sum += (v !== null && v !== undefined) ? v : 0;
      }
      return +sum.toFixed(3);
    }

    return {
      forecast_1h_mm:   forecastSum(1),
      forecast_3h_mm:   forecastSum(3),
      forecast_6h_mm:   forecastSum(6),
      forecast_12h_mm:  forecastSum(12),
      forecast_24h_mm:  forecastSum(24),
      generated_time:   times[firstFutureIdx],
      source: "Open-Meteo",
      status: "success"
    };

  } catch (error) {
    console.error("Forecast service error:", error.message);

    return {
      forecast_1h_mm:   null,
      forecast_3h_mm:   null,
      forecast_6h_mm:   null,
      forecast_12h_mm:  null,
      forecast_24h_mm:  null,
      generated_time:   null,
      source: "Open-Meteo",
      status: "failed",
      error: error.message
    };
  }
}

module.exports = { getRainfallForecast };
