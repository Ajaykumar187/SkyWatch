import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getWeatherCodeInfo } from "@/lib/weatherCodes";
import { getCached, setCached, CACHE_TTL } from "@/lib/cache";

const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");

  if (!city && !(latStr && lonStr)) {
    return NextResponse.json(
      { error: "Provide either a 'city' query param or both 'lat' and 'lon'." },
      { status: 400 }
    );
  }

  const cacheKey = `weather:${city || `${latStr},${lonStr}`}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  }

  if (apiKey) {
    try {
      const response = await axios.get(BASE_URL, {
        params: city
          ? { q: city, appid: apiKey, units: "metric" }
          : { lat: latStr, lon: lonStr, appid: apiKey, units: "metric" },
      });
      await setCached(cacheKey, response.data, CACHE_TTL.CURRENT_WEATHER);
      return NextResponse.json(response.data, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const message =
          status === 404
            ? "City not found. Please check the spelling and try again."
            : status === 401 || status === 403
            ? "Weather provider rejected the API key. Check OPENWEATHER_API_KEY in .env.local."
            : "Weather provider returned an error.";
        return NextResponse.json({ error: message }, { status });
      }
      return NextResponse.json(
        { error: "Could not reach the weather provider. Please try again." },
        { status: 502 }
      );
    }
  }

  try {
    let lat = latStr ? parseFloat(latStr) : 0;
    let lon = lonStr ? parseFloat(lonStr) : 0;
    let cityName = city || "Selected location";
    let countryCode = "";

    if (city) {
      const geoRes = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
        params: { name: city, count: 1, language: "en", format: "json" },
      });
      const first = geoRes.data?.results?.[0];
      if (first) {
        lat = first.latitude;
        lon = first.longitude;
        cityName = first.name;
        countryCode = first.country_code || first.country || "";
      } else {
        return NextResponse.json(
          { error: "City not found. Please check the spelling and try again." },
          { status: 404 }
        );
      }
    }

    const meteoRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: lat,
        longitude: lon,
        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m",
        hourly: "visibility",
        daily: "sunrise,sunset",
        timezone: "auto",
      },
    });

    const current = meteoRes.data?.current || {};
    const daily = meteoRes.data?.daily || {};
    const hourly = meteoRes.data?.hourly || {};
    const code = current.weather_code ?? 0;
    const codeInfo = getWeatherCodeInfo(code);

    const sunriseStr = daily.sunrise?.[0];
    const sunsetStr = daily.sunset?.[0];
    const sunriseUnix = sunriseStr
      ? Math.floor(new Date(sunriseStr).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 21600;
    const sunsetUnix = sunsetStr
      ? Math.floor(new Date(sunsetStr).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 21600;

    const windSpeedMps = current.wind_speed_10m
      ? Number((current.wind_speed_10m / 3.6).toFixed(2))
      : 0;
    const visibilityMeters = hourly.visibility?.[0] ?? 10000;

    const weatherData = {
      name: cityName,
      sys: {
        country: countryCode,
        sunrise: sunriseUnix,
        sunset: sunsetUnix,
      },
      main: {
        temp: current.temperature_2m ?? 20,
        feels_like: current.apparent_temperature ?? current.temperature_2m ?? 20,
        humidity: current.relative_humidity_2m ?? 50,
        pressure: Math.round(current.pressure_msl ?? 1013),
      },
      wind: {
        speed: windSpeedMps,
        deg: current.wind_direction_10m ?? 0,
      },
      visibility: visibilityMeters,
      weather: [
        {
          description: codeInfo.description,
          icon: "01d",
          main: codeInfo.category.charAt(0).toUpperCase() + codeInfo.category.slice(1),
        },
      ],
      coord: { lat, lon },
      dt: Math.floor(Date.now() / 1000),
      timezone: meteoRes.data?.utc_offset_seconds ?? 0,
    };

    await setCached(cacheKey, weatherData, CACHE_TTL.CURRENT_WEATHER);
    return NextResponse.json(weatherData, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the weather provider. Please try again." },
      { status: 502 }
    );
  }
}
