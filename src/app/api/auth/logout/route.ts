import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  await destroySession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("skywatch_session");
  return response;
}
