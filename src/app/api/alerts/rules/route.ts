import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth";
import { CustomAlertRuleRepository } from "@/lib/db";

async function getUser(request: NextRequest) {
  const token = request.cookies.get("skywatch_session")?.value;
  return getSessionInfo(token);
}

export async function GET(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const rules = await CustomAlertRuleRepository.list(session.userId);
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { name, metric, operator, threshold, durationHours, severity } = body ?? {};

  if (!name || !metric || !operator || threshold === undefined) {
    return NextResponse.json(
      { error: "Name, metric, operator, and threshold are required." },
      { status: 400 }
    );
  }

  const validMetrics = ["temperature", "windSpeed", "rainfall", "uvIndex", "aqi"];
  const validOperators = ["gt", "lt", "gte", "lte"];
  const validSeverities = ["info", "watch", "warning", "danger"];

  if (!validMetrics.includes(metric)) {
    return NextResponse.json({ error: "Invalid metric." }, { status: 400 });
  }
  if (!validOperators.includes(operator)) {
    return NextResponse.json({ error: "Invalid operator." }, { status: 400 });
  }

  const rule = await CustomAlertRuleRepository.create({
    userId: session.userId,
    name: String(name).trim(),
    metric,
    operator,
    threshold: Number(threshold),
    durationHours: Number(durationHours) || 1,
    severity: validSeverities.includes(severity) ? severity : "warning",
    enabled: true,
  });

  return NextResponse.json({ rule });
}

export async function DELETE(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Rule ID is required." }, { status: 400 });

  await CustomAlertRuleRepository.delete(session.userId, id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const session = await getUser(request);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { id, enabled } = body ?? {};
  if (!id || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "id and enabled are required." }, { status: 400 });
  }

  const updated = await CustomAlertRuleRepository.toggle(session.userId, id, enabled);
  return NextResponse.json({ rule: updated });
}
