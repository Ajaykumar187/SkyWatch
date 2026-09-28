import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo, getUserById } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  const session = await getSessionInfo(token);
  if (!session) {
    return NextResponse.json({ user: null });
  }
  const user = await getUserById(session.userId);
  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          username: user.username,
          email: user.email,
        }
      : null,
  });
}
