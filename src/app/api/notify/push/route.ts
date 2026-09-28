import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth";
import { readStore, writeStore } from "@/lib/storage";

interface PushSub {
  userId?: string;
  endpoint: string;
  keys?: { p256dh: string; auth: string };
  createdAt: string;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  const session = await getSessionInfo(token);

  const body = await request.json().catch(() => null);
  const { subscription } = body ?? {};

  if (!subscription || !subscription.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const store = readStore<PushSub[]>("push-subscriptions", []);
  const existingIndex = store.findIndex((s) => s.endpoint === subscription.endpoint);

  const subEntry: PushSub = {
    userId: session?.userId,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    store[existingIndex] = subEntry;
  } else {
    store.push(subEntry);
  }

  writeStore("push-subscriptions", store);
  return NextResponse.json({ ok: true, message: "Push subscription registered." });
}
