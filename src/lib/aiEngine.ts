import type { DailyForecast, HourlyForecast } from "./types";

export interface Prediction {
  level: "low" | "moderate" | "high" | "severe";
  score: number; // 0-100
  message: string;
  reasons: string[];
}

function levelFromScore(score: number): Prediction["level"] {
  if (score >= 75) return "severe";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

export function predictRainProbability(daily: DailyForecast, dayIndex = 0): Prediction {
  const prob = daily.precipitation_probability_max[dayIndex] ?? 0;
  const amount = daily.precipitation_sum[dayIndex] ?? 0;
  const score = Math.min(100, prob);
  const reasons = [
    `Forecast precipitation probability: ${prob}%`,
    `Expected precipitation total: ${amount.toFixed(1)} mm`,
  ];
  return {
    level: levelFromScore(score),
    score,
    message:
      prob >= 70
        ? "High chance of rain — carry an umbrella."
        : prob >= 40
        ? "Rain is possible later — keep an eye on the sky."
        : "Low chance of rain today.",
    reasons,
  };
}

export function predictHeatwave(daily: DailyForecast): Prediction {
  const highs = daily.temperature_2m_max;
  const threshold = 38; // °C, a common heatwave reference point
  let consecutiveHot = 0;
  let maxConsecutive = 0;
  for (const t of highs) {
    if (t >= threshold) {
      consecutiveHot += 1;
      maxConsecutive = Math.max(maxConsecutive, consecutiveHot);
    } else {
      consecutiveHot = 0;
    }
  }
  const score = Math.min(100, maxConsecutive * 30);
  const reasons = [
    `${maxConsecutive} of the next ${highs.length} days forecast at or above ${threshold}°C.`,
    `Peak forecast high: ${Math.max(...highs).toFixed(1)}°C.`,
  ];
  return {
    level: levelFromScore(score),
    score,
    message:
      maxConsecutive >= 3
        ? "Heatwave conditions likely — stay hydrated and avoid peak-sun hours."
        : maxConsecutive >= 1
        ? "A hot day or two ahead, but not a sustained heatwave."
        : "No heatwave pattern detected in the 7-day outlook.",
    reasons,
  };
}

export function predictFloodRisk(daily: DailyForecast): Prediction {
  const totalRain = daily.precipitation_sum.reduce((a, b) => a + b, 0);
  const maxDayRain = Math.max(...daily.precipitation_sum);

  let score = 0;
  score += Math.min(60, (totalRain / 150) * 60);
  score += Math.min(40, (maxDayRain / 75) * 40);
  score = Math.min(100, Math.round(score));
  const reasons = [
    `Total forecast rainfall over 7 days: ${totalRain.toFixed(0)} mm.`,
    `Heaviest single day: ${maxDayRain.toFixed(0)} mm.`,
  ];
  return {
    level: levelFromScore(score),
    score,
    message:
      score >= 50
        ? "Elevated flood risk from sustained/heavy rainfall — monitor local advisories."
        : score >= 25
        ? "Some flood-prone areas could see localized water accumulation."
        : "Low flood risk based on forecast rainfall.",
    reasons,
  };
}

export function predictStorm(hourly: HourlyForecast, daily: DailyForecast): Prediction {
  const stormCodes = new Set([95, 96, 99]);
  const stormHours = daily.weathercode.filter((c) => stormCodes.has(c)).length;
  const maxWind = Math.max(...hourly.windspeed_10m.slice(0, 48));
  let score = 0;
  score += stormHours * 25;
  score += maxWind >= 60 ? 40 : maxWind >= 40 ? 20 : 0;
  score = Math.min(100, Math.round(score));
  const reasons = [
    `${stormHours} of the next 7 days show thunderstorm conditions in the forecast.`,
    `Peak forecast wind speed (next 48h): ${maxWind.toFixed(0)} km/h.`,
  ];
  return {
    level: levelFromScore(score),
    score,
    message:
      score >= 50
        ? "Storm activity likely — secure loose outdoor items."
        : score >= 25
        ? "Some storm potential in the outlook."
        : "No significant storm activity detected.",
    reasons,
  };
}

export function overallConfidence(daily: DailyForecast): number {
  const highs = daily.temperature_2m_max.slice(0, 4);
  const mean = highs.reduce((a, b) => a + b, 0) / highs.length;
  const variance =
    highs.reduce((a, b) => a + (b - mean) ** 2, 0) / highs.length;
  const stability = Math.max(0, 100 - variance * 8);
  return Math.round(Math.min(95, Math.max(40, stability)));
}

export function aiWeatherSummary(
  cityName: string,
  daily: DailyForecast,
  rain: Prediction,
  heatwave: Prediction,
  flood: Prediction,
  storm: Prediction,
  confidence: number
): string {
  const todayHigh = daily.temperature_2m_max[0];
  const todayLow = daily.temperature_2m_min[0];
  const notable = [heatwave, flood, storm]
    .filter((p) => p.level === "high" || p.level === "severe")
    .map((p) => p.message);

  const lines = [
    `**${cityName}** is forecast to reach ${todayHigh.toFixed(0)}°C / ${todayLow.toFixed(0)}°C today.`,
    rain.message,
    notable.length > 0
      ? `Notable risk this week: ${notable.join(" ")}`
      : "No elevated heatwave, flood, or storm risk detected in the 7-day outlook.",
    `Forecast confidence: ${confidence}% (based on short-range forecast stability).`,
    "Generated from rule-based thresholds over the 7-day forecast — not a substitute for official weather warnings.",
  ];
  return lines.join("\n\n");
}
