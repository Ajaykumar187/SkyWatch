import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth";
import { AlertPreferencesRepository } from "@/lib/db";

async function getUser(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  return getSessionInfo(token);
}

export async function GET(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const preferences = await AlertPreferencesRepository.get(session.userId);
  return NextResponse.json({ preferences });
}

export async function POST(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid preferences payload." }, { status: 400 });

  const preferences = await AlertPreferencesRepository.save(session.userId, body);
  return NextResponse.json({ preferences });
}
