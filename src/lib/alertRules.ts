import type { DailyForecast, WeatherAlert } from "./types";

export function evaluateAlerts(cityName: string, daily: DailyForecast): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const now = new Date().toISOString();

  const rainToday = daily.precipitation_sum[0] ?? 0;
  if (rainToday >= 50) {
    alerts.push({
      id: `heavyRain-${cityName}`,
      kind: "heavyRain",
      severity: rainToday >= 100 ? "warning" : "watch",
      title: "Heavy Rain Alert",
      message: `${cityName}: ${rainToday.toFixed(0)}mm of rain expected today.`,
      triggeredAt: now,
    });
  }

  const stormCodes = new Set([95, 96, 99]);
  if (stormCodes.has(daily.weathercode[0])) {
    alerts.push({
      id: `thunderstorm-${cityName}`,
      kind: "thunderstorm",
      severity: "warning",
      title: "Thunderstorm Alert",
      message: `${cityName}: Thunderstorms are in today's forecast.`,
      triggeredAt: now,
    });
  }

  const highToday = daily.temperature_2m_max[0] ?? 0;
  if (highToday >= 38) {
    alerts.push({
      id: `heatwave-${cityName}`,
      kind: "heatwave",
      severity: highToday >= 42 ? "warning" : "watch",
      title: "Heatwave Alert",
      message: `${cityName}: Forecast high of ${highToday.toFixed(0)}°C today.`,
      triggeredAt: now,
    });
  }

  const weekRain = daily.precipitation_sum.reduce((a, b) => a + b, 0);
  if (weekRain >= 150) {
    alerts.push({
      id: `flood-${cityName}`,
      kind: "flood",
      severity: weekRain >= 250 ? "warning" : "watch",
      title: "Flood Risk Alert",
      message: `${cityName}: ${weekRain.toFixed(0)}mm of rain forecast over the next 7 days.`,
      triggeredAt: now,
    });
  }

  return alerts;
}
