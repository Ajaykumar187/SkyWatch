import { NextRequest, NextResponse } from "next/server";

const ALLOWED_LAYERS = new Set([
  "precipitation_new",
  "clouds_new",
  "wind_new",
  "temp_new",
  "pressure_new",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENWEATHER_API_KEY." }, { status: 500 });
  }

  const { layer, z, x, y } = await params;
  if (!ALLOWED_LAYERS.has(layer)) {
    return NextResponse.json({ error: "Unknown map layer." }, { status: 400 });
  }
  const yValue = y.replace(/\.png$/, "");

  const tileUrl = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${yValue}.png?appid=${apiKey}`;

  try {
    const response = await fetch(tileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Tile provider returned an error." }, { status: response.status });
    }
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the tile provider." }, { status: 502 });
  }
}
