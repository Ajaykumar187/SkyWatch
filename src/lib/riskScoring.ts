import type { DailyForecast, HourlyForecast, AirQuality } from "./types";
import { getWeatherCodeInfo } from "./weatherCodes";

export interface RiskCategory {
  score: number; // 0 - 100
  level: "Low" | "Moderate" | "High" | "Severe";
  headline: string;
  advice: string;
  factors: string[];
}

export interface ComprehensiveRiskAssessment {
  overallScore: number;
  overallLevel: "Low" | "Moderate" | "High" | "Severe";
  outdoorRisk: RiskCategory;
  commuteRisk: RiskCategory;
  thermalRisk: RiskCategory;
  respiratoryRisk: RiskCategory;
  floodRisk: RiskCategory;
}

export function computeRiskLevel(score: number): "Low" | "Moderate" | "High" | "Severe" {
  if (score < 25) return "Low";
  if (score < 55) return "Moderate";
  if (score < 80) return "High";
  return "Severe";
}

export function calculateHeatIndex(tempC: number, rh: number): number {
  if (tempC < 27) return tempC;
  const T = (tempC * 9) / 5 + 32;
  const R = rh;
  const c1 = -42.379;
  const c2 = 2.04901523;
  const c3 = 10.14333127;
  const c4 = -0.22475541;
  const c5 = -0.00683783;
  const c6 = -0.05481717;
  const c7 = 0.00122874;
  const c8 = 0.00085282;
  const c9 = -0.00000199;

  let hiF =
    c1 +
    c2 * T +
    c3 * R +
    c4 * T * R +
    c5 * T * T +
    c6 * R * R +
    c7 * T * T * R +
    c8 * T * R * R +
    c9 * T * T * R * R;

  if (R < 13 && T >= 80 && T <= 112) {
    const adj = ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    hiF -= adj;
  } else if (R > 85 && T >= 80 && T <= 87) {
    const adj = ((R - 85) / 10) * ((87 - T) / 5);
    hiF += adj;
  }

  return Number((((hiF - 32) * 5) / 9).toFixed(1));
}

export function calculateWindChill(tempC: number, windKmh: number): number {
  if (tempC > 10 || windKmh < 4.8) return tempC;
  const wc =
    13.12 +
    0.6215 * tempC -
    11.37 * Math.pow(windKmh, 0.16) +
    0.3965 * tempC * Math.pow(windKmh, 0.16);
  return Number(wc.toFixed(1));
}

export function evaluateComprehensiveRisk(
  daily: DailyForecast,
  hourly: HourlyForecast,
  airQuality?: AirQuality | null
): ComprehensiveRiskAssessment {
  const currentTemp = hourly.temperature_2m[0] ?? 20;
  const currentRh = hourly.relative_humidity_2m[0] ?? 50;
  const currentWind = hourly.windspeed_10m[0] ?? 10;
  const rainToday = daily.precipitation_sum[0] ?? 0;
  const uvMax = daily.uv_index_max[0] ?? 4;
  const aqiVal = airQuality?.list?.[0]?.main?.aqi ?? 2;

  const heatIndex = calculateHeatIndex(currentTemp, currentRh);
  const windChill = calculateWindChill(currentTemp, currentWind);
  let thermalScore = 15;
  const thermalFactors: string[] = [];

  if (currentTemp >= 35) {
    thermalScore = Math.min(100, 50 + (currentTemp - 35) * 8 + (currentRh > 60 ? 15 : 0));
    thermalFactors.push(`High ambient temperature ${currentTemp}°C`);
    thermalFactors.push(`Heat index feels like ${heatIndex}°C`);
  } else if (currentTemp <= 5) {
    thermalScore = Math.min(100, 40 + (5 - currentTemp) * 7 + (currentWind > 20 ? 15 : 0));
    thermalFactors.push(`Cold temperature ${currentTemp}°C`);
    thermalFactors.push(`Wind chill feels like ${windChill}°C`);
  } else {
    thermalFactors.push("Thermal comfort zone (15°C - 28°C)");
  }
  const thermalLevel = computeRiskLevel(thermalScore);

  const outdoorScore = Math.min(
    100,
    Math.round(rainToday * 3 + (currentWind > 30 ? 30 : currentWind * 0.8) + (uvMax > 7 ? 25 : uvMax * 2) + (aqiVal > 3 ? 30 : 0))
  );
  const outdoorFactors: string[] = [];
  if (rainToday > 2) outdoorFactors.push(`Expected precipitation: ${rainToday} mm`);
  if (uvMax >= 7) outdoorFactors.push(`High UV index max: ${uvMax.toFixed(1)}`);
  if (currentWind >= 35) outdoorFactors.push(`High wind gusts: ${Math.round(currentWind)} km/h`);
  if (outdoorFactors.length === 0) outdoorFactors.push("Favorable outdoor conditions");
  const outdoorLevel = computeRiskLevel(outdoorScore);

  const commuteScore = Math.min(
    100,
    Math.round(rainToday * 4 + (currentWind > 40 ? 35 : currentWind * 0.5) + (hourly.visibility[0] < 3000 ? 35 : 0))
  );
  const commuteFactors: string[] = [];
  if (rainToday > 5) commuteFactors.push("Wet roads & hydroplaning hazard");
  if (hourly.visibility[0] < 3000) commuteFactors.push(`Reduced visibility: ${(hourly.visibility[0] / 1000).toFixed(1)} km`);
  if (currentWind > 40) commuteFactors.push("Strong crosswinds affecting transit");
  if (commuteFactors.length === 0) commuteFactors.push("Normal road & transit conditions");
  const commuteLevel = computeRiskLevel(commuteScore);

  const respiratoryScore = Math.min(100, aqiVal * 20 + (currentRh > 80 ? 10 : 0));
  const respFactors: string[] = [];
  if (aqiVal >= 3) respFactors.push(`Elevated AQI level (${aqiVal}/5)`);
  if (currentRh > 85) respFactors.push("High atmospheric humidity / stagnant air");
  if (respFactors.length === 0) respFactors.push("Clean air, low respiratory stress");
  const respiratoryLevel = computeRiskLevel(respiratoryScore);

  const total7DayRain = daily.precipitation_sum.reduce((a, b) => a + b, 0);
  const floodScore = Math.min(100, Math.round(rainToday * 2.5 + total7DayRain * 0.8));
  const floodFactors: string[] = [];
  if (rainToday > 20) floodFactors.push(`Heavy daily rainfall: ${rainToday.toFixed(1)} mm`);
  if (total7DayRain > 60) floodFactors.push(`7-day accumulated rain: ${total7DayRain.toFixed(1)} mm`);
  if (floodFactors.length === 0) floodFactors.push("Adequate drainage capacity, minimal risk");
  const floodLevel = computeRiskLevel(floodScore);

  const overallScore = Math.round(
    thermalScore * 0.25 + outdoorScore * 0.25 + commuteScore * 0.2 + respiratoryScore * 0.15 + floodScore * 0.15
  );

  return {
    overallScore,
    overallLevel: computeRiskLevel(overallScore),
    thermalRisk: {
      score: thermalScore,
      level: thermalLevel,
      headline: thermalLevel === "Low" ? "Thermal Comfort" : `${thermalLevel} Thermal Stress`,
      advice:
        currentTemp >= 32
          ? "Stay hydrated, seek air-conditioned shade, avoid peak sun exertion."
          : currentTemp <= 8
          ? "Dress in insulated layers, protect extremities against wind chill."
          : "Mild temperatures, comfortable for all age groups.",
      factors: thermalFactors,
    },
    outdoorRisk: {
      score: outdoorScore,
      level: outdoorLevel,
      headline: outdoorLevel === "Low" ? "Great for Outdoors" : `${outdoorLevel} Outdoor Risk`,
      advice: outdoorScore > 50 ? "Postpone vigorous outdoor training or bring rain gear." : "Ideal conditions for walking, running, and sports.",
      factors: outdoorFactors,
    },
    commuteRisk: {
      score: commuteScore,
      level: commuteLevel,
      headline: commuteLevel === "Low" ? "Clear Commute" : `${commuteLevel} Travel Hazard`,
      advice: commuteScore > 50 ? "Increase vehicle following distance and anticipate transit delays." : "No significant weather-related travel disruptions.",
      factors: commuteFactors,
    },
    respiratoryRisk: {
      score: respiratoryScore,
      level: respiratoryLevel,
      headline: respiratoryLevel === "Low" ? "Healthy Air Quality" : `${respiratoryLevel} Air Irritants`,
      advice: aqiVal >= 3 ? "Sensitive individuals should limit prolonged outdoor exertion." : "Clean air, safe for all outdoor activities.",
      factors: respFactors,
    },
    floodRisk: {
      score: floodScore,
      level: floodLevel,
      headline: floodLevel === "Low" ? "Minimal Flood Threat" : `${floodLevel} Water Accumulation`,
      advice: floodScore > 50 ? "Monitor low-lying roads and basement drainage." : "Surface runoff within normal thresholds.",
      factors: floodFactors,
    },
  };
}

export interface WeatherRecommendation {
  id: string;
  category: "Activity" | "Clothing" | "Commute" | "Health" | "Home";
  icon: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export function generateRecommendations(
  daily: DailyForecast,
  hourly: HourlyForecast,
  airQuality?: AirQuality | null
): WeatherRecommendation[] {
  const recommendations: WeatherRecommendation[] = [];
  const currentTemp = hourly.temperature_2m[0] ?? 20;
  const maxTemp = daily.temperature_2m_max[0] ?? 25;
  const currentWind = hourly.windspeed_10m[0] ?? 10;
  const rainToday = daily.precipitation_sum[0] ?? 0;
  const uvMax = daily.uv_index_max[0] ?? 4;
  const aqiVal = airQuality?.list?.[0]?.main?.aqi ?? 2;

  if (currentWind >= 35) {
    recommendations.push({
      id: "rec_wind",
      category: "Activity",
      icon: "💨",
      title: "Wind Warning & Securing Items",
      description: `Winds reaching ${Math.round(currentWind)} km/h. Secure loose outdoor items and avoid lightweight umbrellas.`,
      priority: "high",
    });
  }

  if (currentTemp < 10) {
    recommendations.push({
      id: "rec_coat",
      category: "Clothing",
      icon: "🧥",
      title: "Heavy Jacket & Layering",
      description: `Current temperature is ${Math.round(currentTemp)}°C. Wear wind-resistant layers and thermal outerwear.`,
      priority: "high",
    });
  } else if (currentTemp < 18) {
    recommendations.push({
      id: "rec_sweater",
      category: "Clothing",
      icon: "🧣",
      title: "Light Sweater or Windbreaker",
      description: `Moderate temperatures around ${Math.round(currentTemp)}°C. A light jacket or fleece is recommended.`,
      priority: "medium",
    });
  } else {
    recommendations.push({
      id: "rec_breathable",
      category: "Clothing",
      icon: "👕",
      title: "Light, Breathable Fabrics",
      description: `Warm conditions (${Math.round(currentTemp)}°C). Choose breathable cotton or moisture-wicking wear.`,
      priority: "low",
    });
  }

  if (rainToday > 0.5) {
    recommendations.push({
      id: "rec_umbrella",
      category: "Commute",
      icon: "☂️",
      title: "Carry an Umbrella",
      description: `${rainToday.toFixed(1)} mm precipitation expected today with rain probability up to ${daily.precipitation_probability_max[0]}%.`,
      priority: "high",
    });
  }

  if (uvMax >= 6) {
    recommendations.push({
      id: "rec_sunscreen",
      category: "Health",
      icon: "🧴",
      title: `Apply SPF 30+ Sunscreen (UV ${uvMax.toFixed(1)})`,
      description: `Peak UV levels reach ${uvMax.toFixed(1)} between 11 AM - 3 PM. Wear UV400 sunglasses and reapply sunscreen every 2 hours.`,
      priority: "high",
    });
  }

  let bestWindow = "";
  for (let i = 6; i <= 20; i++) {
    const t = hourly.temperature_2m[i];
    const p = hourly.precipitation_probability[i];
    const w = hourly.windspeed_10m[i];
    if (t >= 14 && t <= 24 && p < 25 && w < 25) {
      const hourStr = new Date(hourly.time[i]).toLocaleTimeString("en-US", { hour: "numeric" });
      bestWindow = `Around ${hourStr}`;
      break;
    }
  }

  recommendations.push({
    id: "rec_exercise",
    category: "Activity",
    icon: "🏃",
    title: bestWindow ? `Optimal Workout Window: ${bestWindow}` : "Indoor Training Recommended",
    description: bestWindow
      ? `Ideal running/cycling weather with comfortable temperatures and low wind.`
      : `High temperatures (${Math.round(maxTemp)}°C) or precipitation. Prefer early morning or gym sessions.`,
    priority: "medium",
  });

  if (maxTemp > 30 && currentTemp < 22) {
    recommendations.push({
      id: "rec_ventilation",
      category: "Home",
      icon: "🪟",
      title: "Morning Natural Ventilation",
      description: "Cooler outdoor air right now. Open windows early, then seal blinds before afternoon peak heat to cut AC load.",
      priority: "low",
    });
  } else if (maxTemp > 32) {
    recommendations.push({
      id: "rec_ac",
      category: "Home",
      icon: "❄️",
      title: "Set Thermostat to 24°C - 25°C",
      description: "High cooling demand day. Utilize ceiling fans and keep shades drawn on south/west facing windows.",
      priority: "medium",
    });
  }

  if (aqiVal >= 3) {
    recommendations.push({
      id: "rec_air_purifier",
      category: "Health",
      icon: "💨",
      title: "Indoor Air Filtration",
      description: `AQI is currently ${aqiVal}/5. Run HEPA air filters indoors and consider wearing an N95 mask near high-traffic corridors.`,
      priority: "high",
    });
  }

  return recommendations;
}

export interface WeatherTimelineEvent {
  id: string;
  time: string;
  hourLabel: string;
  type: "rain" | "peak_temp" | "low_temp" | "wind" | "uv" | "pressure" | "sun";
  icon: string;
  title: string;
  detail: string;
  severity: "info" | "watch" | "warning";
}

export function generateEventTimeline(
  daily: DailyForecast,
  hourly: HourlyForecast
): WeatherTimelineEvent[] {
  const events: WeatherTimelineEvent[] = [];
  const hoursToCheck = Math.min(36, hourly.time.length);

  if (daily.sunrise?.[0]) {
    events.push({
      id: "sun_rise_0",
      time: daily.sunrise[0],
      hourLabel: new Date(daily.sunrise[0]).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      type: "sun",
      icon: "🌅",
      title: "Sunrise",
      detail: "Daylight begins",
      severity: "info",
    });
  }
  if (daily.sunset?.[0]) {
    events.push({
      id: "sun_set_0",
      time: daily.sunset[0],
      hourLabel: new Date(daily.sunset[0]).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      type: "sun",
      icon: "🌇",
      title: "Sunset",
      detail: "Dusk / Night begins",
      severity: "info",
    });
  }

  let rainActive = false;
  let maxTempIdx = 0;
  let minTempIdx = 0;

  for (let i = 0; i < hoursToCheck; i++) {
    const t = hourly.temperature_2m[i];
    const pProb = hourly.precipitation_probability[i];
    const w = hourly.windspeed_10m[i];
    const code = hourly.weathercode[i];

    if (t > hourly.temperature_2m[maxTempIdx]) maxTempIdx = i;
    if (t < hourly.temperature_2m[minTempIdx]) minTempIdx = i;

    const codeInfo = getWeatherCodeInfo(code);
    if ((pProb >= 50 || codeInfo.category === "rain" || codeInfo.category === "storm") && !rainActive) {
      rainActive = true;
      events.push({
        id: `rain_onset_${i}`,
        time: hourly.time[i],
        hourLabel: new Date(hourly.time[i]).toLocaleTimeString("en-US", { hour: "numeric" }),
        type: "rain",
        icon: codeInfo.category === "storm" ? "⛈️" : "🌧️",
        title: `${codeInfo.description}`,
        detail: `${pProb}% probability, precipitation starting`,
        severity: codeInfo.category === "storm" ? "warning" : "watch",
      });
    } else if (pProb < 20 && rainActive) {
      rainActive = false;
      events.push({
        id: `rain_clear_${i}`,
        time: hourly.time[i],
        hourLabel: new Date(hourly.time[i]).toLocaleTimeString("en-US", { hour: "numeric" }),
        type: "rain",
        icon: "🌤️",
        title: "Rain Easing",
        detail: "Showers tapering off",
        severity: "info",
      });
    }

    if (w >= 35 && i % 4 === 0) {
      events.push({
        id: `wind_spike_${i}`,
        time: hourly.time[i],
        hourLabel: new Date(hourly.time[i]).toLocaleTimeString("en-US", { hour: "numeric" }),
        type: "wind",
        icon: "💨",
        title: "Gusty Winds",
        detail: `Wind sustained at ${Math.round(w)} km/h`,
        severity: w > 50 ? "warning" : "watch",
      });
    }

    if (i >= 3) {
      const pDiff = hourly.pressure_msl[i] - hourly.pressure_msl[i - 3];
      if (pDiff <= -2.5 && i % 6 === 0) {
        events.push({
          id: `pressure_drop_${i}`,
          time: hourly.time[i],
          hourLabel: new Date(hourly.time[i]).toLocaleTimeString("en-US", { hour: "numeric" }),
          type: "pressure",
          icon: "📉",
          title: "Barometric Front Approaching",
          detail: `Rapid pressure drop of ${Math.abs(pDiff).toFixed(1)} hPa in 3 hours`,
          severity: "watch",
        });
      }
    }
  }

  events.push({
    id: `peak_temp`,
    time: hourly.time[maxTempIdx],
    hourLabel: new Date(hourly.time[maxTempIdx]).toLocaleTimeString("en-US", { hour: "numeric" }),
    type: "peak_temp",
    icon: "🔥",
    title: "Diurnal High Temperature",
    detail: `Peak at ${Math.round(hourly.temperature_2m[maxTempIdx])}°C`,
    severity: hourly.temperature_2m[maxTempIdx] >= 38 ? "warning" : "info",
  });

  events.push({
    id: `low_temp`,
    time: hourly.time[minTempIdx],
    hourLabel: new Date(hourly.time[minTempIdx]).toLocaleTimeString("en-US", { hour: "numeric" }),
    type: "low_temp",
    icon: "❄️",
    title: "Overnight Low",
    detail: `Minimum temperature ${Math.round(hourly.temperature_2m[minTempIdx])}°C`,
    severity: "info",
  });

  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return events;
}
