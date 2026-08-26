async function getWeather(latitude, longitude) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m` +
      `&timezone=auto`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Open-Meteo weather API failed: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.current) {
      throw new Error("Current weather data missing");
    }

    return {
      temperature_c:
        data.current.temperature_2m ?? null,

      humidity_percent:
        data.current.relative_humidity_2m ?? null,

      wind_speed_kmh:
        data.current.wind_speed_10m ?? null,

      observation_time:
        data.current.time ?? null,

      source: "Open-Meteo",

      status: "success"
    };

  } catch (error) {
    console.error(
      "Weather service error:",
      error.message
    );

    return {
      temperature_c: null,
      humidity_percent: null,
      wind_speed_kmh: null,
      observation_time: null,

      source: "Open-Meteo",

      status: "failed",

      error: error.message
    };
  }
}


module.exports = {
  getWeather
};