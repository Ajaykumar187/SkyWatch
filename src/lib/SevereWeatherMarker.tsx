"use client";

import React from "react";

export interface WeatherDayAlert {
  id: string;
  type: "rain" | "wind" | "storm" | "heat" | "freeze" | "uv";
  level: "danger" | "warning";
  icon: string;
  title: string;
  detail: string;
}

export function detectDaySevereWeather({
  rain = 0,
  wind = 0,
  tempMax = 20,
  tempMin = 10,
  weatherCode = 0,
  uvMax = 0,
}: {
  rain?: number;
  wind?: number;
  tempMax?: number;
  tempMin?: number;
  weatherCode?: number;
  uvMax?: number;
}): WeatherDayAlert[] {
  const alerts: WeatherDayAlert[] = [];

  if ([96, 99].includes(weatherCode)) {
    alerts.push({
      id: "storm_severe",
      type: "storm",
      level: "danger",
      icon: "⚡",
      title: "Severe Storm & Hail",
      detail: "Severe thunderstorm with hail expected",
    });
  } else if ([95].includes(weatherCode)) {
    alerts.push({
      id: "storm_ts",
      type: "storm",
      level: "warning",
      icon: "⚡",
      title: "Thunderstorm",
      detail: "Thunderstorm activity forecast",
    });
  }

  if (rain >= 40) {
    alerts.push({
      id: "rain_heavy",
      type: "rain",
      level: "danger",
      icon: "🌧️",
      title: `Heavy Rain (${rain.toFixed(0)}mm)`,
      detail: `${rain.toFixed(1)} mm precipitation expected (flooding & runoff risk)`,
    });
  } else if (rain >= 15) {
    alerts.push({
      id: "rain_mod",
      type: "rain",
      level: "warning",
      icon: "🌧️",
      title: `Rain (${rain.toFixed(0)}mm)`,
      detail: `${rain.toFixed(1)} mm precipitation expected`,
    });
  }

  if (wind >= 55) {
    alerts.push({
      id: "wind_gale",
      type: "wind",
      level: "danger",
      icon: "💨",
      title: `Gale Winds (${Math.round(wind)}km/h)`,
      detail: `Strong gale-force wind gusts reaching ${Math.round(wind)} km/h`,
    });
  } else if (wind >= 38) {
    alerts.push({
      id: "wind_high",
      type: "wind",
      level: "warning",
      icon: "💨",
      title: `High Winds (${Math.round(wind)}km/h)`,
      detail: `Elevated wind gusts reaching ${Math.round(wind)} km/h`,
    });
  }

  if (tempMax >= 40) {
    alerts.push({
      id: "heat_extreme",
      type: "heat",
      level: "danger",
      icon: "🔥",
      title: `Extreme Heat (${Math.round(tempMax)}°)`,
      detail: `Dangerous high temperature of ${Math.round(tempMax)}°C`,
    });
  } else if (tempMax >= 35) {
    alerts.push({
      id: "heat_advisory",
      type: "heat",
      level: "warning",
      icon: "🌡️",
      title: `Heat Advisory (${Math.round(tempMax)}°)`,
      detail: `Forecast high of ${Math.round(tempMax)}°C`,
    });
  }

  if (tempMin <= -5) {
    alerts.push({
      id: "freeze_hard",
      type: "freeze",
      level: "danger",
      icon: "❄️",
      title: `Hard Freeze (${Math.round(tempMin)}°)`,
      detail: `Severe freezing overnight low of ${Math.round(tempMin)}°C`,
    });
  } else if (tempMin <= 0) {
    alerts.push({
      id: "freeze_frost",
      type: "freeze",
      level: "warning",
      icon: "❄️",
      title: `Frost Warning (${Math.round(tempMin)}°)`,
      detail: `Freezing temperatures with overnight low of ${Math.round(tempMin)}°C`,
    });
  }

  if (uvMax >= 9) {
    alerts.push({
      id: "uv_extreme",
      type: "uv",
      level: "warning",
      icon: "☀️",
      title: `High UV (${uvMax.toFixed(1)})`,
      detail: `Very high UV index reaching ${uvMax.toFixed(1)}`,
    });
  }

  return alerts;
}

interface SevereWeatherMarkerProps {
  rain?: number;
  wind?: number;
  tempMax?: number;
  tempMin?: number;
  weatherCode?: number;
  uvMax?: number;
  compact?: boolean;
}

export default function SevereWeatherMarker({
  rain,
  wind,
  tempMax,
  tempMin,
  weatherCode,
  uvMax,
  compact = false,
}: SevereWeatherMarkerProps) {
  const alerts = detectDaySevereWeather({
    rain,
    wind,
    tempMax,
    tempMin,
    weatherCode,
    uvMax,
  });

  if (alerts.length === 0) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 4,
        verticalAlign: "middle",
      }}
    >
      {alerts.map((alert) => {
        const isDanger = alert.level === "danger";
        return (
          <span
            key={alert.id}
            title={`${alert.title}: ${alert.detail}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: compact ? "1px 5px" : "2px 6px",
              borderRadius: "6px",
              fontSize: compact ? "0.68rem" : "0.72rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
              backgroundColor: isDanger
                ? "rgba(220, 38, 38, 0.16)"
                : "rgba(245, 158, 11, 0.16)",
              color: isDanger ? "#ef4444" : "#f59e0b",
              border: `1px solid ${
                isDanger ? "rgba(220, 38, 38, 0.38)" : "rgba(245, 158, 11, 0.38)"
              }`,
              boxShadow: isDanger
                ? "0 0 6px rgba(220, 38, 38, 0.25)"
                : "none",
            }}
          >
            <span style={{ fontSize: "0.78rem", lineHeight: 1 }}>{alert.icon}</span>
            <span>{alert.title}</span>
          </span>
        );
      })}
    </div>
  );
}
