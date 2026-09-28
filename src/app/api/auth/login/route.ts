import { NextRequest, NextResponse } from "next/server";
import { verifyUser, createSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "client_ip";
  const limit = checkRateLimit(`login:${ip}`, 10, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Please try again in ${limit.resetInSeconds} seconds.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const { username, password } = body ?? {};

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  const result = await verifyUser(username, password);
  if (!result.ok || !result.user) {
    return NextResponse.json({ error: result.message }, { status: 401 });
  }

  const token = await createSession(result.user.id, result.user.username);
  const response = NextResponse.json({
    id: result.user.id,
    username: result.user.username,
    email: result.user.email,
  });

  response.cookies.set("skywatch_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
