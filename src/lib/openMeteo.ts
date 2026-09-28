import axios from "axios";
import type { GeocodeResult, OpenMeteoResponse } from "./types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

const DAILY_VARS = [
  "weathercode",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "windspeed_10m_max",
  "uv_index_max",
  "sunrise",
  "sunset",
].join(",");

const HOURLY_VARS = [
  "temperature_2m",
  "precipitation_probability",
  "weathercode",
  "relative_humidity_2m",
  "dew_point_2m",
  "pressure_msl",
  "visibility",
  "windspeed_10m",
  "winddirection_10m",
  "apparent_temperature",
  "uv_index",
].join(",");

export async function fetchOpenMeteoForecast(
  lat: number,
  lon: number
): Promise<OpenMeteoResponse> {
  const response = await axios.get<OpenMeteoResponse>(FORECAST_URL, {
    params: {
      latitude: lat,
      longitude: lon,
      daily: DAILY_VARS,
      hourly: HOURLY_VARS,
      current_weather: true,
      forecast_days: 7,
      timezone: "auto",
    },
  });
  return response.data;
}

export async function fetchHistoricalWeather(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
) {
  const response = await axios.get(ARCHIVE_URL, {
    params: {
      latitude: lat,
      longitude: lon,
      start_date: startDate,
      end_date: endDate,
      daily:
        "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
      timezone: "auto",
    },
  });
  return response.data as {
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      windspeed_10m_max: number[];
    };
  };
}

export async function geocodeCity(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const response = await axios.get(GEOCODE_URL, {
    params: { name: query, count: 5, language: "en", format: "json" },
  });
  return response.data.results ?? [];
}

export interface WeatherGridPoint {
  lat: number;
  lon: number;
  temp: number;
  pressure: number;
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  weatherCode: number;
}

export async function fetchWeatherGrid(
  centerLat: number,
  centerLon: number,
  radiusDeg = 1.8
): Promise<WeatherGridPoint[]> {
  const steps = [-1, -0.5, 0, 0.5, 1];
  const lats: number[] = [];
  const lons: number[] = [];

  for (const dy of steps) {
    for (const dx of steps) {
      lats.push(Number((centerLat + dy * radiusDeg).toFixed(2)));
      lons.push(Number((centerLon + dx * radiusDeg).toFixed(2)));
    }
  }

  const response = await axios.get(FORECAST_URL, {
    params: {
      latitude: lats.join(","),
      longitude: lons.join(","),
      current:
        "temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,weather_code",
      timezone: "auto",
    },
  });

  const data = Array.isArray(response.data) ? response.data : [response.data];

  return data.map((item, idx) => ({
    lat: lats[idx],
    lon: lons[idx],
    temp: item.current?.temperature_2m ?? 20,
    pressure: item.current?.surface_pressure ?? 1013,
    cloudCover: item.current?.cloud_cover ?? 0,
    windSpeed: item.current?.wind_speed_10m ?? 0,
    windDirection: item.current?.wind_direction_10m ?? 0,
    precipitation: item.current?.precipitation ?? 0,
    weatherCode: item.current?.weather_code ?? 0,
  }));
}

export async function fetchPointWeather(
  lat: number,
  lon: number
): Promise<WeatherGridPoint> {
  const response = await axios.get(FORECAST_URL, {
    params: {
      latitude: Number(lat.toFixed(3)),
      longitude: Number(lon.toFixed(3)),
      current:
        "temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,weather_code",
      timezone: "auto",
    },
  });
  const cur = response.data?.current || {};
  return {
    lat,
    lon,
    temp: cur.temperature_2m ?? 20,
    pressure: cur.surface_pressure ?? 1013,
    cloudCover: cur.cloud_cover ?? 0,
    windSpeed: cur.wind_speed_10m ?? 0,
    windDirection: cur.wind_direction_10m ?? 0,
    precipitation: cur.precipitation ?? 0,
    weatherCode: cur.weather_code ?? 0,
  };
}
