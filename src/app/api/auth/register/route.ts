import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "client_ip";
  const limit = checkRateLimit(`register:${ip}`, 5, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many registration attempts. Please wait ${limit.resetInSeconds} seconds.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const { username, email, password } = body ?? {};

  if (!username || !email || !password) {
    return NextResponse.json(
      { error: "Username, email, and password are all required." },
      { status: 400 }
    );
  }

  const result = await createUser(username, email, password);
  if (!result.ok || !result.user) {
    return NextResponse.json({ error: result.message }, { status: 409 });
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
