import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth";
import { SearchHistoryRepository } from "@/lib/db";

async function getUser(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  return getSessionInfo(token);
}

export async function GET(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ history: [] });
  const history = await SearchHistoryRepository.get(session.userId);
  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ ok: true, persisted: false });

  const body = await request.json().catch(() => null);
  const query = body?.query;
  if (!query) return NextResponse.json({ error: "Query is required." }, { status: 400 });

  const history = await SearchHistoryRepository.add(session.userId, query);
  return NextResponse.json({ ok: true, persisted: true, history });
}

export async function DELETE(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  await SearchHistoryRepository.clear(session.userId);
  return NextResponse.json({ ok: true, history: [] });
}
