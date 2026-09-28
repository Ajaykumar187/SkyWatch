"use client";

import React from "react";

interface TempDeltaProps {
  delta: number | null;
  label?: string;
  compact?: boolean;
}

export default function TempDelta({ delta, label, compact = false }: TempDeltaProps) {
  if (delta === null || isNaN(delta)) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: compact ? "0.72rem" : "0.75rem",
          color: "var(--text-muted)",
          opacity: 0.6,
          marginLeft: 6,
        }}
        title="Baseline / Day 1 (no previous day comparison)"
      >
        —
      </span>
    );
  }

  const rounded = Math.round(delta);

  if (rounded > 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          fontSize: compact ? "0.72rem" : "0.76rem",
          fontWeight: 600,
          color: "#ef4444",
          background: "rgba(239, 68, 68, 0.12)",
          padding: compact ? "1px 4px" : "2px 6px",
          borderRadius: "6px",
          marginLeft: 6,
          whiteSpace: "nowrap",
        }}
        title={`Warmer: +${rounded}°C compared to previous day${label ? ` (${label})` : ""}`}
      >
        <span style={{ fontSize: "0.68rem" }}>▲</span> +{rounded}°
      </span>
    );
  }

  if (rounded < 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          fontSize: compact ? "0.72rem" : "0.76rem",
          fontWeight: 600,
          color: "#0284c7",
          background: "rgba(14, 165, 233, 0.12)",
          padding: compact ? "1px 4px" : "2px 6px",
          borderRadius: "6px",
          marginLeft: 6,
          whiteSpace: "nowrap",
        }}
        title={`Cooler: ${rounded}°C compared to previous day${label ? ` (${label})` : ""}`}
      >
        <span style={{ fontSize: "0.68rem" }}>▼</span> {rounded}°
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: compact ? "0.72rem" : "0.76rem",
        fontWeight: 500,
        color: "var(--text-muted)",
        background: "rgba(148, 163, 184, 0.12)",
        padding: compact ? "1px 4px" : "2px 5px",
        borderRadius: "6px",
        marginLeft: 6,
        whiteSpace: "nowrap",
      }}
      title="Same temperature as previous day"
    >
      <span style={{ fontSize: "0.7rem" }}>—</span> 0°
    </span>
  );
}
