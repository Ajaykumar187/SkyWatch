import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { accountSid, authToken, fromNumber, toNumber, message } = body ?? {};

  if (!accountSid || !authToken || !fromNumber || !toNumber || !message) {
    return NextResponse.json(
      { error: "accountSid, authToken, fromNumber, toNumber, and message are all required." },
      { status: 400 }
    );
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({ From: fromNumber, To: toNumber, Body: message });
    await axios.post(url, params, {
      auth: { username: accountSid, password: authToken },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return NextResponse.json({ ok: true, message: "SMS sent." });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const twilioMessage =
        (error.response.data as { message?: string })?.message || "Twilio rejected the request.";
      return NextResponse.json({ error: `SMS failed: ${twilioMessage}` }, { status: error.response.status });
    }
    return NextResponse.json({ error: "Could not reach Twilio." }, { status: 502 });
  }
}
