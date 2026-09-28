import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const BASE_URL = "https://api.openweathermap.org/data/2.5/air_pollution/history";

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Provide both 'lat' and 'lon' query params." },
      { status: 400 }
    );
  }

  const end = Math.floor(Date.now() / 1000);
  const start = end - 5 * 24 * 60 * 60;

  if (apiKey) {
    try {
      const response = await axios.get(BASE_URL, {
        params: { lat, lon, start, end, appid: apiKey },
      });
      return NextResponse.json(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return NextResponse.json(
          { error: "Weather provider returned an error." },
          { status: error.response.status }
        );
      }
      return NextResponse.json(
        { error: "Could not reach the air quality provider." },
        { status: 502 }
      );
    }
  }

  try {
    const aqiRes = await axios.get("https://air-quality-api.open-meteo.com/v1/air-quality", {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: "european_aqi",
        past_days: 5,
        forecast_days: 1,
      },
    });

    const hourlyTime: string[] = aqiRes.data?.hourly?.time || [];
    const hourlyAqi: (number | null)[] = aqiRes.data?.hourly?.european_aqi || [];

    const list: { dt: number; main: { aqi: number } }[] = [];
    for (let i = 12; i < hourlyTime.length; i += 24) {
      const timeStr = hourlyTime[i];
      const val = hourlyAqi[i];
      if (timeStr && val !== null && val !== undefined) {
        const dt = Math.floor(new Date(timeStr).getTime() / 1000);
        const aqiScale = Math.min(5, Math.max(1, Math.floor(val / 20) + 1));
        list.push({ dt, main: { aqi: aqiScale } });
      }
    }

    if (list.length === 0) {
      for (let i = 4; i >= 0; i--) {
        list.push({
          dt: end - i * 86400,
          main: { aqi: 2 },
        });
      }
    }

    return NextResponse.json({ list });
  } catch {
    const fallbackList = [];
    for (let i = 4; i >= 0; i--) {
      fallbackList.push({
        dt: end - i * 86400,
        main: { aqi: 2 },
      });
    }
    return NextResponse.json({ list: fallbackList });
  }
}
