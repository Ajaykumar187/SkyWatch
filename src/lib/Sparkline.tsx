"use client";

import React, { useId } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  className?: string;
  showPoints?: boolean;
}

export default function Sparkline({
  data,
  width = 110,
  height = 32,
  strokeColor,
  fillColor,
  className = "",
  showPoints = true,
}: SparklineProps) {
  const gradientId = useId();

  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-muted"
        title="Insufficient trend data"
      >
        <span style={{ fontSize: "0.75rem" }}>—</span>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const padX = 4;
  const padY = 5;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;

  const points = data.map((val, i) => {
    const x = padX + (i / (data.length - 1)) * innerWidth;
    const y = padY + innerHeight - ((val - min) / range) * innerHeight;
    return { x, y, val };
  });

  let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const lastPoint = points[points.length - 1];
  const areaD = `${pathD} L ${lastPoint.x.toFixed(1)} ${(height - 1).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - 1).toFixed(1)} Z`;

  let maxIdx = 0;
  let minIdx = 0;
  data.forEach((v, idx) => {
    if (v > data[maxIdx]) maxIdx = idx;
    if (v < data[minIdx]) minIdx = idx;
  });
  const maxPt = points[maxIdx];
  const minPt = points[minIdx];

  const avgTemp = data.reduce((a, b) => a + b, 0) / data.length;
  const stroke =
    strokeColor ||
    (avgTemp >= 25 ? "#f97316" : avgTemp >= 15 ? "#3b82f6" : "#06b6d4");
  const fill = fillColor || stroke;

  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      className={className}
      title={`24h trend: Low ${min.toFixed(0)}°C → High ${max.toFixed(0)}°C`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.35" />
            <stop offset="100%" stopColor={fill} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={areaD} fill={`url(#${gradientId})`} />

        <path
          d={pathD}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {showPoints && maxPt && (
          <circle
            cx={maxPt.x}
            cy={maxPt.y}
            r="2.5"
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth="1"
          />
        )}
        {showPoints && minPt && minIdx !== maxIdx && (
          <circle
            cx={minPt.x}
            cy={minPt.y}
            r="2.5"
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth="1"
          />
        )}
      </svg>
    </div>
  );
}
