"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { useLocation } from "@/context/LocationContext";
import { MapPin } from "lucide-react";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="loading-wrap">Initializing meteorological map view...</div>,
});

export default function MapPage() {
  const { location } = useLocation();
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

  useEffect(() => {
    axios
      .get("/api/config")
      .then((res) => setApiKeyConfigured(res.data.apiKeyConfigured))
      .catch(() => setApiKeyConfigured(false));
  }, []);

  if (!location) {
    return (
      <div className="setup-message">
        Pick a city on the Dashboard page first to center the map.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <div>
          <h1 className="section-title" style={{ marginBottom: 4 }}>
            Interactive Synoptic Weather Map
          </h1>
          <p className="section-sub" style={{ margin: 0 }}>
            Live global precipitation radar, wind vector streamlines, surface pressure isobars, and thermal fields.
          </p>
        </div>
        <div className="flex items-center gap-8">
          <Badge kind="info">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <MapPin size={12} />
              <span>{location.name}{location.country ? `, ${location.country}` : ""}</span>
            </span>
          </Badge>
        </div>
      </div>

      <Card style={{ padding: "16px" }}>
        <MapView lat={location.lat} lon={location.lon} apiKeyAvailable={apiKeyConfigured} />
      </Card>
    </div>
  );
}
