import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth";
import { DashboardLayoutRepository } from "@/lib/db";

async function getUser(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  return getSessionInfo(token);
}

export async function GET(request: NextRequest) {
  const session = await getUser(request);
  const layout = await DashboardLayoutRepository.get(session?.userId || "anonymous");
  return NextResponse.json({ layout });
}

export async function POST(request: NextRequest) {
  const session = await getUser(request);
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const userId = session?.userId || "anonymous";
  const layout = await DashboardLayoutRepository.save(userId, body);
  return NextResponse.json({ layout });
}
