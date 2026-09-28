"use client";

import React, { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="btn btn-accent"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 14px",
          fontSize: "0.82rem",
          borderRadius: "20px",
        }}
        title="Install SkyWatch app to your device"
      >
        <span>⬇️</span> Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="btn btn-outline"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            fontSize: "0.8rem",
            borderRadius: "20px",
            color: "white",
            borderColor: "rgba(255,255,255,0.3)",
          }}
        >
          <span>📲</span> Install on iOS
        </button>

        {showIOSGuide && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              style={{
                background: "var(--card-bg)",
                backdropFilter: "blur(16px)",
                border: "1px solid var(--card-border)",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "360px",
                width: "100%",
                color: "var(--text)",
                boxShadow: "var(--shadow)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Install on iPhone / iPad</h3>
              <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 16px 0" }}>
                1. Tap the <strong>Share</strong> button <span style={{ fontSize: "1.2rem" }}>⎋</span> at the bottom of Safari.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong> <span style={{ fontSize: "1.1rem" }}>➕</span>.<br />
                3. Tap <strong>Add</strong> in the top-right corner.
              </p>
              <button
                className="btn"
                style={{ width: "100%" }}
                onClick={() => setShowIOSGuide(false)}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
