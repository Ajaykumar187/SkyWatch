import { NextRequest, NextResponse } from "next/server";
import { AlertHistoryRepository } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      webhookUrl,
      title = "SkyWatch Weather Alert",
      message = "Severe weather conditions detected.",
      severity = "warning",
      location = "Active City",
      metrics,
    } = body;

    if (!webhookUrl || typeof webhookUrl !== "string") {
      return NextResponse.json(
        { error: "A valid webhook URL (e.g. Discord, Slack, or generic HTTP endpoint) is required." },
        { status: 400 }
      );
    }

    if (!webhookUrl.startsWith("http://") && !webhookUrl.startsWith("https://")) {
      return NextResponse.json(
        { error: "Webhook URL must start with http:// or https://" },
        { status: 400 }
      );
    }

    const isDiscord = webhookUrl.includes("discord.com/api/webhooks");
    const isSlack = webhookUrl.includes("hooks.slack.com");

    let payload: Record<string, unknown> = {};

    if (isDiscord) {
      const color =
        severity === "danger"
          ? 15680580 // #ef4444
          : severity === "warning"
          ? 16096779 // #f59e0b
          : 3900150; // #3b82f6

      const fields = [
        { name: "📍 Location", value: location, inline: true },
        { name: "⚠️ Severity", value: severity.toUpperCase(), inline: true },
      ];

      if (metrics) {
        if (metrics.temp !== undefined) {
          fields.push({ name: "🌡️ Temp", value: `${metrics.temp}°C`, inline: true });
        }
        if (metrics.wind !== undefined) {
          fields.push({ name: "💨 Wind", value: `${metrics.wind} km/h`, inline: true });
        }
        if (metrics.rain !== undefined) {
          fields.push({ name: "🌧️ Rain", value: `${metrics.rain} mm`, inline: true });
        }
      }

      payload = {
        username: "SkyWatch Alert Bot",
        avatar_url: "https://images.unsplash.com/photo-1592210454359-9043f067919b?w=128",
        embeds: [
          {
            title: `[${severity.toUpperCase()}] ${title}`,
            description: message,
            color,
            fields,
            footer: {
              text: "SkyWatch Meteorological Alert & Early Warning System",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } else if (isSlack) {
      const color =
        severity === "danger" ? "#ef4444" : severity === "warning" ? "#f59e0b" : "#3b82f6";

      payload = {
        text: `*SkyWatch Weather Alert:* ${title}`,
        attachments: [
          {
            color,
            title,
            text: message,
            fields: [
              { title: "Location", value: location, short: true },
              { title: "Severity", value: severity.toUpperCase(), short: true },
            ],
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };
    } else {
      payload = {
        source: "SkyWatch Weather Monitoring",
        event: "weather_alert",
        title,
        message,
        severity,
        location,
        metrics: metrics || {},
        timestamp: new Date().toISOString(),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SkyWatch-Alert-Engine/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    try {
      await AlertHistoryRepository.log({
        location,
        title,
        message: `[Webhook: ${isDiscord ? "Discord" : isSlack ? "Slack" : "Custom"}] ${message}`,
        severity,
        kind: "webhook",
      });
    } catch {
    }

    if (webhookRes.ok) {
      return NextResponse.json({
        ok: true,
        status: webhookRes.status,
        provider: isDiscord ? "Discord" : isSlack ? "Slack" : "Custom Webhook",
        message: `Webhook alert dispatched successfully (${webhookRes.status} ${webhookRes.statusText})!`,
      });
    } else {
      const errorText = await webhookRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Target webhook returned error HTTP ${webhookRes.status}: ${errorText.slice(0, 150)}`,
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to dispatch webhook.";
    return NextResponse.json(
      { error: `Webhook dispatch failed: ${message}` },
      { status: 500 }
    );
  }
}
