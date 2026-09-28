"use client";

import { useState } from "react";
import type { HourlyForecast, DailyForecast } from "@/lib/types";

interface HourlyUvWidgetProps {
  hourly?: HourlyForecast;
  daily?: DailyForecast;
  currentTime?: number;
  timezoneOffset?: number;
}

interface UvHourPoint {
  timeStr: string;
  hourLabel: string;
  fullTimeLabel: string;
  uv: number;
  category: {
    level: string;
    color: string;
    bg: string;
    advice: string;
  };
}

export function getUvCategory(uv: number) {
  if (uv >= 11) {
    return {
      level: "Extreme",
      color: "#a855f7",
      bg: "rgba(168, 85, 247, 0.2)",
      advice: "Take all precautions. Avoid sun exposure 10am-4pm. SPF 50+.",
    };
  }
  if (uv >= 8) {
    return {
      level: "Very High",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.2)",
      advice: "Extra protection needed. Seek shade, wear hat and sunglasses, SPF 30+.",
    };
  }
  if (uv >= 6) {
    return {
      level: "High",
      color: "#f97316",
      bg: "rgba(249, 115, 22, 0.2)",
      advice: "Protection essential. Wear sunglasses, sunscreen, seek shade during midday.",
    };
  }
  if (uv >= 3) {
    return {
      level: "Moderate",
      color: "#eab308",
      bg: "rgba(234, 179, 8, 0.2)",
      advice: "Stay in shade during peak hours. Wear sunglasses and sunscreen.",
    };
  }
  return {
    level: "Low",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.2)",
    advice: "Minimal sun protection required. Safe for outdoor activities.",
  };
}

export default function HourlyUvWidget({
  hourly,
  daily,
  currentTime,
  timezoneOffset = 0,
}: HourlyUvWidgetProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!hourly?.time || hourly.time.length === 0) {
    return (
      <div className="text-muted" style={{ padding: "16px 0", fontSize: "0.85rem" }}>
        Loading UV index forecast...
      </div>
    );
  }

  const nowMs = currentTime ? (currentTime + timezoneOffset) * 1000 : Date.now();
  const nowDate = new Date(nowMs);
  const currentHourIso = nowDate.toISOString().slice(0, 13); // e.g. "2026-09-28T09"

  let startIdx = hourly.time.findIndex((t) => t.startsWith(currentHourIso));
  if (startIdx === -1) {
    startIdx = hourly.time.findIndex((t) => new Date(t).getTime() >= nowMs - 3600000);
  }
  if (startIdx === -1) startIdx = 0;

  const next12Hours: UvHourPoint[] = [];
  const maxUvToday = daily?.uv_index_max?.[0] ?? 6;

  for (let offset = 0; offset < 12; offset++) {
    const idx = startIdx + offset;
    if (idx >= hourly.time.length) break;

    const rawTime = hourly.time[idx];
    const hourDate = new Date(rawTime);

    let hourLabel = "";
    if (offset === 0) {
      hourLabel = "Now";
    } else {
      hourLabel = hourDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
      });
    }

    const fullTimeLabel = hourDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    let uvVal = 0;
    if (hourly.uv_index && hourly.uv_index[idx] !== undefined) {
      uvVal = Math.max(0, Number(hourly.uv_index[idx]));
    } else {
      const hour = hourDate.getHours();
      if (hour >= 6 && hour <= 19) {
        const solarFactor = Math.sin(((hour - 6) / 13) * Math.PI);
        uvVal = Math.max(0, Number((maxUvToday * Math.pow(solarFactor, 1.2)).toFixed(1)));
      } else {
        uvVal = 0;
      }
    }

    next12Hours.push({
      timeStr: rawTime,
      hourLabel,
      fullTimeLabel,
      uv: Number(uvVal.toFixed(1)),
      category: getUvCategory(uvVal),
    });
  }

  if (next12Hours.length === 0) {
    return null;
  }

  const peakPoint = next12Hours.reduce(
    (max, pt) => (pt.uv > max.uv ? pt : max),
    next12Hours[0]
  );
  const currentPoint = next12Hours[0];
  const activePoint = hoveredIdx !== null ? next12Hours[hoveredIdx] : currentPoint;

  const chartMax = Math.max(10, Math.ceil(peakPoint.uv + 1));

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          padding: "10px 14px",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid var(--card-border)",
          borderRadius: "12px",
        }}
      >
        <div className="flex items-center gap-12">
          <div>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }} className="text-muted">
              {hoveredIdx !== null ? `Hour: ${activePoint.fullTimeLabel}` : "Current UV Index"}
            </div>
            <div className="flex items-center gap-8" style={{ marginTop: 2 }}>
              <span style={{ fontSize: "1.6rem", fontWeight: 800, color: activePoint.category.color, lineHeight: 1 }}>
                {activePoint.uv}
              </span>
              <span
                style={{
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: activePoint.category.bg,
                  color: activePoint.category.color,
                  border: `1px solid ${activePoint.category.color}40`,
                }}
              >
                {activePoint.category.level}
              </span>
            </div>
          </div>

          <div
            style={{
              height: 32,
              width: 1,
              background: "var(--card-border)",
              margin: "0 4px",
            }}
          />

          <div>
            <div style={{ fontSize: "0.75rem" }} className="text-muted">
              Peak Next 12h
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: peakPoint.category.color }}>
              {peakPoint.uv} UV{" "}
              <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-muted)" }}>
                at {peakPoint.hourLabel === "Now" ? "Now" : peakPoint.hourLabel}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            maxWidth: 320,
            lineHeight: 1.35,
          }}
        >
          {activePoint.category.advice}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          background: "rgba(15, 23, 42, 0.45)",
          border: "1px solid var(--card-border)",
          borderRadius: "12px",
          padding: "16px 12px 10px 12px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "16px 12px 34px 12px",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            opacity: 0.25,
          }}
        >
          <div style={{ borderTop: "1px dashed #ef4444", width: "100%" }} />
          <div style={{ borderTop: "1px dashed #f97316", width: "100%" }} />
          <div style={{ borderTop: "1px dashed #eab308", width: "100%" }} />
          <div style={{ borderTop: "1px dashed var(--card-border)", width: "100%" }} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "8px",
            alignItems: "end",
            height: 110,
            position: "relative",
            zIndex: 1,
          }}
        >
          {next12Hours.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            const barHeightPct = Math.max(6, Math.min(100, (pt.uv / chartMax) * 100));

            return (
              <div
                key={pt.timeStr}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: isHovered ? 800 : 600,
                    color: pt.uv > 0 ? pt.category.color : "var(--text-muted)",
                    marginBottom: 4,
                    transition: "transform 0.15s ease",
                    transform: isHovered ? "scale(1.2)" : "scale(1)",
                  }}
                >
                  {pt.uv > 0 ? pt.uv : "0"}
                </span>

                <div
                  style={{
                    width: "100%",
                    maxWidth: 24,
                    height: `${barHeightPct}%`,
                    borderRadius: "6px 6px 3px 3px",
                    background:
                      pt.uv === 0
                        ? "rgba(255, 255, 255, 0.08)"
                        : `linear-gradient(to top, ${pt.category.color}90, ${pt.category.color})`,
                    boxShadow: isHovered
                      ? `0 0 12px ${pt.category.color}90`
                      : pt.uv >= 6
                      ? `0 0 8px ${pt.category.color}40`
                      : "none",
                    border: isHovered
                      ? `1.5px solid #ffffff`
                      : pt.uv > 0
                      ? `1px solid ${pt.category.color}60`
                      : "1px solid rgba(255, 255, 255, 0.06)",
                    transition: "height 0.3s ease, transform 0.15s ease",
                    transform: isHovered ? "scaleY(1.05)" : "scaleY(1)",
                    transformOrigin: "bottom",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "8px",
            marginTop: 8,
            borderTop: "1px solid var(--card-border)",
            paddingTop: 6,
          }}
        >
          {next12Hours.map((pt, idx) => (
            <span
              key={`label-${pt.timeStr}`}
              style={{
                fontSize: "0.68rem",
                textAlign: "center",
                fontWeight: hoveredIdx === idx ? 700 : idx === 0 ? 700 : 500,
                color: hoveredIdx === idx ? "#38bdf8" : idx === 0 ? "var(--accent)" : "var(--text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {pt.hourLabel}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 10,
          fontSize: "0.72rem",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ fontWeight: 600 }}>WHO UV Scale:</span>
        <div className="flex items-center gap-12" style={{ flexWrap: "wrap" }}>
          <span className="flex items-center gap-4">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            0-2 Low
          </span>
          <span className="flex items-center gap-4">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#eab308", display: "inline-block" }} />
            3-5 Moderate
          </span>
          <span className="flex items-center gap-4">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316", display: "inline-block" }} />
            6-7 High
          </span>
          <span className="flex items-center gap-4">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
            8-10 Very High
          </span>
          <span className="flex items-center gap-4">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", display: "inline-block" }} />
            11+ Extreme
          </span>
        </div>
      </div>
    </div>
  );
}
