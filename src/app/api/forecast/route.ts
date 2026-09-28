import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Server is missing OPENWEATHER_API_KEY. Add it to a .env.local file (see .env.local.example) and restart the dev server.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!city && !(lat && lon)) {
    return NextResponse.json(
      { error: "Provide either a 'city' query param or both 'lat' and 'lon'." },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: city
        ? { q: city, appid: apiKey, units: "metric" }
        : { lat, lon, appid: apiKey, units: "metric" },
    });
    return NextResponse.json(response.data);
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
