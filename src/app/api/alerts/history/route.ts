import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth";
import { AlertHistoryRepository } from "@/lib/db";

async function getUser(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  return getSessionInfo(token);
}

export async function GET(request: NextRequest) {
  const session = await getUser(request);
  const alerts = await AlertHistoryRepository.list(session?.userId);
  return NextResponse.json({ alerts });
}

export async function POST(request: NextRequest) {
  const session = await getUser(request);
  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === "read-all") {
    await AlertHistoryRepository.markAllRead(session?.userId);
    return NextResponse.json({ ok: true });
  }

  if (action === "clear") {
    await AlertHistoryRepository.clear(session?.userId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
