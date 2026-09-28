export interface CurrentWeather {
  name: string;
  sys: { country: string; sunrise: number; sunset: number };
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  wind: { speed: number; deg: number };
  visibility: number;
  weather: { description: string; icon: string; main: string }[];
  coord: { lat: number; lon: number };
  dt: number;
  timezone: number;
}

export interface AirQuality {
  list: {
    main: { aqi: number };
    components: {
      pm2_5: number;
      pm10: number;
      co: number;
      no2: number;
      so2: number;
      o3: number;
    };
  }[];
}

export interface DailyForecast {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  windspeed_10m_max: number[];
  uv_index_max: number[];
  sunrise: string[];
  sunset: string[];
}

export interface HourlyForecast {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  weathercode: number[];
  relative_humidity_2m: number[];
  dew_point_2m: number[];
  pressure_msl: number[];
  visibility: number[];
  windspeed_10m: number[];
  winddirection_10m: number[];
  apparent_temperature: number[];
  uv_index?: number[];
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: DailyForecast;
  hourly: HourlyForecast;
  current_weather?: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
  };
}

export interface GeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export interface FavoriteCity {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  addedAt: string;
}

export interface SearchHistoryItem {
  query: string;
  at: string;
}

export interface AlertPreferences {
  heavyRain: boolean;
  thunderstorm: boolean;
  heatwave: boolean;
  flood: boolean;
  emailEnabled: boolean;
  email: string;
  pushEnabled: boolean;
}

export interface WeatherAlert {
  id: string;
  kind: "heavyRain" | "thunderstorm" | "heatwave" | "flood";
  severity: "watch" | "warning";
  title: string;
  message: string;
  triggeredAt: string;
}
