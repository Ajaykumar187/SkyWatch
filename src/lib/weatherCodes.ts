export interface WeatherCodeInfo {
  description: string;
  emoji: string;
  category: "clear" | "cloudy" | "rain" | "snow" | "storm" | "fog";
}

const CODES: Record<number, WeatherCodeInfo> = {
  0: { description: "Clear sky", emoji: "☀️", category: "clear" },
  1: { description: "Mainly clear", emoji: "🌤️", category: "clear" },
  2: { description: "Partly cloudy", emoji: "⛅", category: "cloudy" },
  3: { description: "Overcast", emoji: "☁️", category: "cloudy" },
  45: { description: "Fog", emoji: "🌫️", category: "fog" },
  48: { description: "Depositing rime fog", emoji: "🌫️", category: "fog" },
  51: { description: "Light drizzle", emoji: "🌦️", category: "rain" },
  53: { description: "Moderate drizzle", emoji: "🌦️", category: "rain" },
  55: { description: "Dense drizzle", emoji: "🌦️", category: "rain" },
  56: { description: "Light freezing drizzle", emoji: "🌧️", category: "rain" },
  57: { description: "Dense freezing drizzle", emoji: "🌧️", category: "rain" },
  61: { description: "Slight rain", emoji: "🌧️", category: "rain" },
  63: { description: "Moderate rain", emoji: "🌧️", category: "rain" },
  65: { description: "Heavy rain", emoji: "🌧️", category: "rain" },
  66: { description: "Light freezing rain", emoji: "🌧️", category: "rain" },
  67: { description: "Heavy freezing rain", emoji: "🌧️", category: "rain" },
  71: { description: "Slight snow fall", emoji: "🌨️", category: "snow" },
  73: { description: "Moderate snow fall", emoji: "🌨️", category: "snow" },
  75: { description: "Heavy snow fall", emoji: "❄️", category: "snow" },
  77: { description: "Snow grains", emoji: "🌨️", category: "snow" },
  80: { description: "Slight rain showers", emoji: "🌦️", category: "rain" },
  81: { description: "Moderate rain showers", emoji: "🌦️", category: "rain" },
  82: { description: "Violent rain showers", emoji: "⛈️", category: "storm" },
  85: { description: "Slight snow showers", emoji: "🌨️", category: "snow" },
  86: { description: "Heavy snow showers", emoji: "❄️", category: "snow" },
  95: { description: "Thunderstorm", emoji: "⛈️", category: "storm" },
  96: { description: "Thunderstorm with slight hail", emoji: "⛈️", category: "storm" },
  99: { description: "Thunderstorm with heavy hail", emoji: "⛈️", category: "storm" },
};

export function getWeatherCodeInfo(code: number): WeatherCodeInfo {
  return CODES[code] ?? { description: "Unknown", emoji: "🌡️", category: "cloudy" };
}

export interface AqiInfo {
  label: string;
  color: string;
  advice: string;
}

const AQI_LEVELS: Record<number, AqiInfo> = {
  1: { label: "Good", color: "#16a34a", advice: "Air quality is good — enjoy the outdoors." },
  2: { label: "Fair", color: "#65a30d", advice: "Air quality is acceptable for most people." },
  3: { label: "Moderate", color: "#f59e0b", advice: "Sensitive groups should limit prolonged outdoor exertion." },
  4: { label: "Poor", color: "#ea580c", advice: "Consider reducing outdoor activity, especially if sensitive." },
  5: { label: "Very Poor", color: "#dc2626", advice: "Avoid outdoor exertion — air quality is hazardous." },
};

export function getAqiInfo(aqi: number): AqiInfo {
  return AQI_LEVELS[aqi] ?? AQI_LEVELS[3];
}
