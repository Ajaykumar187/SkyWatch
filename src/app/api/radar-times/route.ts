import { NextResponse } from "next/server";

interface RainViewerResponse {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: Array<{ time: number; path: string }>;
    nowcast: Array<{ time: number; path: string }>;
  };
  satellite?: {
    infrared?: Array<{ time: number; path: string }>;
  };
}

let cachedData: RainViewerResponse | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000;

export async function GET() {
  const now = Date.now();
  if (cachedData && now - lastFetchTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedData, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
      signal: controller.signal,
      headers: { "User-Agent": "SkyWatch-WeatherApp/1.0" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (cachedData) return NextResponse.json(cachedData);
      return NextResponse.json({ error: "Could not fetch radar timeline" }, { status: 502 });
    }

    const data: RainViewerResponse = await res.json();
    cachedData = data;
    lastFetchTime = now;

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (err) {
    if (cachedData) {
      return NextResponse.json(cachedData);
    }
    return NextResponse.json(
      { error: "RainViewer radar metadata unavailable", detail: String(err) },
      { status: 502 }
    );
  }
}
