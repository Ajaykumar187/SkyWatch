import { NextRequest, NextResponse } from "next/server";
import { CustomAlertRuleRepository, AlertHistoryRepository, FavoritesRepository, DbCustomAlertRule } from "@/lib/db";
import { fetchOpenMeteoForecast } from "@/lib/openMeteo";
import { evaluateAlerts } from "@/lib/alertRules";

function evaluateCustomRule(
  rule: DbCustomAlertRule,
  current: {
    temp: number;
    windSpeed: number;
    rainfall: number;
    uvIndex: number;
    aqi: number;
  }
): boolean {
  let val = 0;
  switch (rule.metric) {
    case "temperature":
      val = current.temp;
      break;
    case "windSpeed":
      val = current.windSpeed;
      break;
    case "rainfall":
      val = current.rainfall;
      break;
    case "uvIndex":
      val = current.uvIndex;
      break;
    case "aqi":
      val = current.aqi;
      break;
  }

  switch (rule.operator) {
    case "gt":
      return val > rule.threshold;
    case "gte":
      return val >= rule.threshold;
    case "lt":
      return val < rule.threshold;
    case "lte":
      return val <= rule.threshold;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const targetLocation = body?.location as { name: string; lat: number; lon: number } | undefined;
  const userId = body?.userId as string | undefined;

  const triggeredCount: { location: string; alerts: string[] }[] = [];

  try {
    const locationsToEvaluate: { name: string; lat: number; lon: number; userId?: string }[] = [];

    if (targetLocation) {
      locationsToEvaluate.push({ ...targetLocation, userId });
    } else if (userId) {
      const favs = await FavoritesRepository.get(userId);
      favs.forEach((f) => locationsToEvaluate.push({ name: f.name, lat: f.lat, lon: f.lon, userId }));
    }

    if (locationsToEvaluate.length === 0) {
      locationsToEvaluate.push({ name: "New Delhi", lat: 28.6139, lon: 77.209 });
    }

    const enabledRules = userId
      ? await CustomAlertRuleRepository.list(userId)
      : await CustomAlertRuleRepository.listAllEnabled();

    for (const loc of locationsToEvaluate) {
      const locAlerts: string[] = [];
      const forecast = await fetchOpenMeteoForecast(loc.lat, loc.lon).catch(() => null);
      if (!forecast) continue;

      const standardAlerts = evaluateAlerts(loc.name, forecast.daily);
      for (const a of standardAlerts) {
        await AlertHistoryRepository.log({
          userId: loc.userId ?? null,
          location: loc.name,
          title: a.title,
          message: a.message,
          severity: a.severity,
          kind: a.kind,
        });
        locAlerts.push(a.title);
      }

      const currentStats = {
        temp: forecast.current_weather?.temperature ?? forecast.hourly.temperature_2m[0] ?? 20,
        windSpeed: forecast.current_weather?.windspeed ?? forecast.hourly.windspeed_10m[0] ?? 10,
        rainfall: forecast.daily.precipitation_sum[0] ?? 0,
        uvIndex: forecast.daily.uv_index_max[0] ?? 5,
        aqi: 2,
      };

      for (const rule of enabledRules.filter((r) => r.enabled && (!loc.userId || r.userId === loc.userId))) {
        if (evaluateCustomRule(rule, currentStats)) {
          const title = `Rule Triggered: ${rule.name}`;
          const msg = `Condition ${rule.metric} ${rule.operator} ${rule.threshold} met in ${loc.name}. Current: ${rule.metric}=${currentStats[rule.metric as keyof typeof currentStats]}.`;

          await AlertHistoryRepository.log({
            userId: loc.userId ?? null,
            location: loc.name,
            title,
            message: msg,
            severity: rule.severity,
            kind: "custom",
          });
          locAlerts.push(title);
        }
      }

      if (locAlerts.length > 0) {
        triggeredCount.push({ location: loc.name, alerts: locAlerts });
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      triggeredCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Background evaluation failed", details: String(error) },
      { status: 500 }
    );
  }
}
