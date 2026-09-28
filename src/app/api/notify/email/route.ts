import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { smtpHost, smtpPort, senderEmail, senderPassword, toEmail, subject, message } =
    body ?? {};

  if (!smtpHost || !smtpPort || !senderEmail || !senderPassword || !toEmail) {
    return NextResponse.json(
      { error: "smtpHost, smtpPort, senderEmail, senderPassword, and toEmail are all required." },
      { status: 400 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: { user: senderEmail, pass: senderPassword },
    });

    await transporter.sendMail({
      from: senderEmail,
      to: toEmail,
      subject: subject || "SkyWatch Weather Alert",
      text: message || "This is a test alert from your SkyWatch dashboard.",
    });

    return NextResponse.json({ ok: true, message: "Email sent." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Email failed: ${message}` }, { status: 502 });
  }
}
