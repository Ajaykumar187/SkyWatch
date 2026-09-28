import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getCached, setCached, CACHE_TTL } from "@/lib/cache";

const BASE_URL = "https://api.openweathermap.org/data/2.5/air_pollution";

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

  const cacheKey = `aqi:${lat},${lon}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
      },
    });
  }

  if (apiKey) {
    try {
      const response = await axios.get(BASE_URL, {
        params: { lat, lon, appid: apiKey },
      });
      await setCached(cacheKey, response.data, CACHE_TTL.AIR_QUALITY);
      return NextResponse.json(response.data, {
        headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120" },
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const message =
          status === 401 || status === 403
            ? "Weather provider rejected the API key. Check OPENWEATHER_API_KEY in .env.local."
            : "Weather provider returned an error.";
        return NextResponse.json({ error: message }, { status });
      }
      return NextResponse.json(
        { error: "Could not reach the air quality provider. Please try again." },
        { status: 502 }
      );
    }
  }

  try {
    const aqiRes = await axios.get("https://air-quality-api.open-meteo.com/v1/air-quality", {
      params: {
        latitude: lat,
        longitude: lon,
        current: "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi",
      },
    });

    const curr = aqiRes.data?.current || {};
    const eaqui = curr.european_aqi ?? 30;
    const aqiScale = Math.min(5, Math.max(1, Math.floor(eaqui / 20) + 1));

    const payload = {
      list: [
        {
          main: { aqi: aqiScale },
          components: {
            pm2_5: curr.pm2_5 ?? 12,
            pm10: curr.pm10 ?? 24,
            co: curr.carbon_monoxide ?? 250,
            no2: curr.nitrogen_dioxide ?? 15,
            so2: curr.sulphur_dioxide ?? 5,
            o3: curr.ozone ?? 45,
          },
        },
      ],
    };

    await setCached(cacheKey, payload, CACHE_TTL.AIR_QUALITY);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the air quality provider. Please try again." },
      { status: 502 }
    );
  }
}
