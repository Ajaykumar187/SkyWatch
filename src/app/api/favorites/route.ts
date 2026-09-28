import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth";
import { FavoritesRepository } from "@/lib/db";

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  return getSessionInfo(token);
}

export async function GET(request: NextRequest) {
  const session = await requireUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const favorites = await FavoritesRepository.get(session.userId);
  return NextResponse.json({ favorites });
}

export async function POST(request: NextRequest) {
  const session = await requireUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { name, lat, lon, country } = body ?? {};
  if (!name || typeof lat !== "number" || typeof lon !== "number") {
    return NextResponse.json({ error: "Name, lat, and lon are required." }, { status: 400 });
  }

  const favorites = await FavoritesRepository.add(session.userId, { name, lat, lon, country });
  return NextResponse.json({ favorites });
}

export async function DELETE(request: NextRequest) {
  const session = await requireUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const favorites = await FavoritesRepository.remove(session.userId, name);
  return NextResponse.json({ favorites });
}
