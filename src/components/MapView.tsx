"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, TileLayer, LayerGroup } from "leaflet";
import { fetchWeatherGrid, fetchPointWeather, geocodeCity, WeatherGridPoint } from "@/lib/openMeteo";
import { getWeatherCodeInfo } from "@/lib/weatherCodes";
import { useLocation } from "@/context/LocationContext";
import {
  ZoomIn,
  ZoomOut,
  Crosshair,
  Maximize2,
  Minimize2,
  Search,
  Cloud,
  Compass,
  Wind,
  Thermometer,
  Layers,
  MapPin,
  Play,
  Pause,
} from "lucide-react";

interface RadarFrame {
  time: number;
  path: string;
}

export type WeatherMapLayer = "precipitation" | "clouds" | "pressure" | "wind" | "temp";

const POPULAR_MET_STATIONS = [
  { name: "Tokyo", lat: 35.6762, lon: 139.6503, country: "Japan" },
  { name: "New York", lat: 40.7128, lon: -74.006, country: "USA" },
  { name: "London", lat: 51.5074, lon: -0.1278, country: "UK" },
  { name: "Dubai", lat: 25.2048, lon: 55.2708, country: "UAE" },
  { name: "Delhi", lat: 28.6139, lon: 77.209, country: "India" },
  { name: "Paris", lat: 48.8566, lon: 2.3522, country: "France" },
  { name: "Sydney", lat: -33.8688, lon: 151.2093, country: "Australia" },
];

export default function MapView({
  lat,
  lon,
}: {
  lat: number;
  lon: number;
  apiKeyAvailable?: boolean;
}) {
  const { setLocation, location } = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const radarTileRef = useRef<TileLayer | null>(null);
  const vectorLayerGroupRef = useRef<LayerGroup | null>(null);
  const loadGridTimeout = useRef<NodeJS.Timeout | null>(null);

  const [activeLayer, setActiveLayer] = useState<WeatherMapLayer>("precipitation");
  const [baseMapType, setBaseMapType] = useState<"standard" | "dark" | "satellite">("dark");
  const [gridData, setGridData] = useState<WeatherGridPoint[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(7);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [mapSearchResults, setMapSearchResults] = useState<
    Array<{ name: string; country: string; latitude: number; longitude: number }>
  >([]);
  const [searchingCity, setSearchingCity] = useState(false);

  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarHost, setRadarHost] = useState<string>("https://tilecache.rainviewer.com");
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlayingRadar, setIsPlayingRadar] = useState<boolean>(false);
  const [radarError, setRadarError] = useState<string | null>(null);

  const [inspectingPoint, setInspectingPoint] = useState<{
    lat: number;
    lon: number;
    data: WeatherGridPoint | null;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/radar-times")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.radar) {
          const past = data.radar.past || [];
          const nowcast = data.radar.nowcast || [];
          const allFrames = [...past, ...nowcast];
          if (allFrames.length > 0) {
            setRadarFrames(allFrames);
            setRadarHost(data.host || "https://tilecache.rainviewer.com");
            setCurrentFrameIdx(Math.max(0, past.length - 1));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setRadarError("Live radar stream temporarily unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSynopticGrid = useCallback(async (centerLat: number, centerLon: number, radius = 2.0) => {
    setLoadingGrid(true);
    try {
      const points = await fetchWeatherGrid(centerLat, centerLon, radius);
      setGridData(points);
    } catch {
      // Fallback
    } finally {
      setLoadingGrid(false);
    }
  }, []);

  const triggerViewportGridUpdate = useCallback(
    (mapInstance: LeafletMap) => {
      if (loadGridTimeout.current) clearTimeout(loadGridTimeout.current);
      loadGridTimeout.current = setTimeout(() => {
        const center = mapInstance.getCenter();
        const zoom = mapInstance.getZoom();

        let radius = 1.8;
        if (zoom <= 4) radius = 4.2;
        else if (zoom <= 6) radius = 2.4;
        else if (zoom <= 8) radius = 1.2;
        else if (zoom <= 10) radius = 0.55;
        else if (zoom <= 12) radius = 0.28;
        else radius = 0.14;

        loadSynopticGrid(center.lat, center.lng, radius);
      }, 350);
    },
    [loadSynopticGrid]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          center: [lat, lon],
          zoom: 7,
          minZoom: 3,
          maxZoom: 18,
          zoomControl: false,
          scrollWheelZoom: true,
          worldCopyJump: true,
        });

        setCurrentZoom(map.getZoom());

        map.on("zoomend", () => {
          setCurrentZoom(map.getZoom());
          triggerViewportGridUpdate(map);
        });

        map.on("moveend", () => {
          triggerViewportGridUpdate(map);
        });

        map.on("click", async (e) => {
          const { lat: clickLat, lng: clickLon } = e.latlng;
          setInspectingPoint({
            lat: clickLat,
            lon: clickLon,
            data: null,
            loading: true,
          });

          try {
            const pointData = await fetchPointWeather(clickLat, clickLon);
            setInspectingPoint({
              lat: clickLat,
              lon: clickLon,
              data: pointData,
              loading: false,
            });
          } catch {
            setInspectingPoint(null);
          }
        });

        mapRef.current = map;
        triggerViewportGridUpdate(map);
      } else {
        mapRef.current.setView([lat, lon], mapRef.current.getZoom() || 7);
        triggerViewportGridUpdate(mapRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lon, triggerViewportGridUpdate]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      mapRef.current.eachLayer((layer) => {
        const anyLayer = layer as unknown as { _isBase?: boolean };
        if (anyLayer._isBase) {
          mapRef.current?.removeLayer(layer);
        }
      });

      let baseTile: TileLayer;
      if (baseMapType === "satellite") {
        baseTile = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Esri World Imagery",
            maxNativeZoom: 17,
            maxZoom: 18,
          }
        );
      } else if (baseMapType === "dark") {
        baseTile = L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            attribution: "&copy; OpenStreetMap &copy; CARTO",
            maxZoom: 19,
            subdomains: "abcd",
          }
        );
      } else {
        baseTile = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        });
      }

      (baseTile as unknown as { _isBase: boolean })._isBase = true;
      baseTile.addTo(mapRef.current);
      baseTile.bringToBack();
    })();

    return () => {
      cancelled = true;
    };
  }, [baseMapType]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      if (activeLayer !== "precipitation") {
        if (radarTileRef.current) {
          mapRef.current.removeLayer(radarTileRef.current);
          radarTileRef.current = null;
        }
        return;
      }

      if (radarFrames.length === 0) return;
      const currentFrame = radarFrames[currentFrameIdx] || radarFrames[0];
      if (!currentFrame) return;

      if (radarTileRef.current) {
        mapRef.current.removeLayer(radarTileRef.current);
      }

      const radarUrl = `${radarHost}${currentFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;
      const tile = L.tileLayer(radarUrl, {
        opacity: 0.72,
        maxNativeZoom: 12,
        maxZoom: 18,
        zIndex: 50,
      });

      tile.addTo(mapRef.current);
      radarTileRef.current = tile;
    })();

    return () => {
      cancelled = true;
    };
  }, [activeLayer, currentFrameIdx, radarFrames, radarHost]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      if (vectorLayerGroupRef.current) {
        mapRef.current.removeLayer(vectorLayerGroupRef.current);
        vectorLayerGroupRef.current = null;
      }

      const layerGroup = L.layerGroup();

      const centerIcon = L.divIcon({
        className: "custom-center-marker",
        html: `
          <div style="position: relative; width: 16px; height: 16px;">
            <div style="
              position: absolute;
              inset: -6px;
              border-radius: 50%;
              background: rgba(59, 130, 246, 0.4);
              animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              position: absolute;
              inset: 0;
              background: #3b82f6;
              border: 2.5px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 0 12px rgba(59, 130, 246, 0.9);
            "></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([lat, lon], { icon: centerIcon })
        .addTo(layerGroup)
        .bindTooltip(`<b>${location?.name || "Active Station"}</b><br>Coords: ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`);

      if (gridData.length > 0 && activeLayer !== "precipitation") {
        gridData.forEach((pt) => {
          let html = "";
          let anchor: [number, number] = [18, 18];
          let size: [number, number] = [36, 36];
          let tooltip = "";

          if (activeLayer === "wind") {
            const speed = Math.round(pt.windSpeed);
            const deg = pt.windDirection;
            const color =
              speed > 45 ? "#ef4444" : speed > 30 ? "#f97316" : speed > 18 ? "#eab308" : "#22c55e";

            html = `
              <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
                <div style="
                  transform: rotate(${deg}deg);
                  color: ${color};
                  font-size: 20px;
                  line-height: 1;
                  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.7));
                ">➤</div>
                <div style="
                  background: rgba(15, 23, 42, 0.9);
                  color: #ffffff;
                  font-size: 10px;
                  font-weight: 700;
                  padding: 1px 5px;
                  border-radius: 4px;
                  border: 1px solid ${color};
                  white-space: nowrap;
                  margin-top: 2px;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                ">${speed} km/h</div>
              </div>
            `;
            anchor = [18, 18];
            size = [36, 36];
            tooltip = `<b>Wind Streamline</b><br>Speed: ${speed} km/h<br>Direction: ${deg}°`;
          } else if (activeLayer === "pressure") {
            const p = Math.round(pt.pressure);
            const isHigh = p >= 1016;
            const isLow = p <= 1008;
            const badgeBg = isHigh
              ? "rgba(239, 68, 68, 0.88)"
              : isLow
              ? "rgba(6, 182, 212, 0.88)"
              : "rgba(30, 41, 59, 0.88)";

            html = `
              <div style="
                background: ${badgeBg};
                color: #ffffff;
                font-size: 10.5px;
                font-weight: 700;
                padding: 2px 7px;
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.4);
                box-shadow: 0 2px 8px rgba(0,0,0,0.6);
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 4px;
              ">
                ${isHigh ? "<span style='color:#fef08a;'>H</span>" : isLow ? "<span style='color:#a5f3fc;'>L</span>" : "⚪"}
                <span>${p} hPa</span>
              </div>
            `;
            anchor = [24, 12];
            size = [55, 22];
            tooltip = `<b>Barometric Pressure</b><br>Surface: ${p} hPa (${isHigh ? "High Pressure Ridge" : isLow ? "Low Pressure Depression" : "Normal"})`;
          } else if (activeLayer === "clouds") {
            const c = pt.cloudCover;
            const icon = c > 80 ? "☁️" : c > 40 ? "⛅" : "☀️";
            const bg = c > 70 ? "rgba(71, 85, 105, 0.9)" : "rgba(30, 41, 59, 0.85)";

            html = `
              <div style="
                background: ${bg};
                color: #ffffff;
                font-size: 10.5px;
                font-weight: 600;
                padding: 2px 7px;
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.3);
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 4px;
              ">
                <span>${icon}</span>
                <span>${c}%</span>
              </div>
            `;
            anchor = [22, 11];
            size = [50, 22];
            tooltip = `<b>Cloud Cover</b><br>Coverage: ${c}% (${c > 80 ? "Overcast" : c > 40 ? "Scattered" : "Clear"})`;
          } else if (activeLayer === "temp") {
            const t = Math.round(pt.temp);
            const color =
              t >= 35
                ? "#dc2626"
                : t >= 28
                ? "#ea580c"
                : t >= 20
                ? "#eab308"
                : t >= 10
                ? "#10b981"
                : t >= 0
                ? "#06b6d4"
                : "#3b82f6";

            html = `
              <div style="
                background: ${color};
                color: #ffffff;
                font-size: 11px;
                font-weight: 800;
                padding: 2px 7px;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.6);
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                white-space: nowrap;
              ">
                ${t}°C
              </div>
            `;
            anchor = [18, 10];
            size = [38, 20];
            tooltip = `<b>Thermal Observation</b><br>Air Temp: ${t}°C`;
          }

          const icon = L.divIcon({
            className: "weather-grid-icon",
            html,
            iconSize: size,
            iconAnchor: anchor,
          });

          L.marker([pt.lat, pt.lon], { icon }).addTo(layerGroup).bindTooltip(tooltip);
        });
      }

      layerGroup.addTo(mapRef.current);
      vectorLayerGroupRef.current = layerGroup;
    })();

    return () => {
      cancelled = true;
    };
  }, [activeLayer, gridData, lat, lon, location?.name]);

  useEffect(() => {
    if (!isPlayingRadar || activeLayer !== "precipitation" || radarFrames.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % radarFrames.length);
    }, 900);

    return () => clearInterval(interval);
  }, [isPlayingRadar, activeLayer, radarFrames]);

  const getFrameLabel = (frame?: RadarFrame) => {
    if (!frame) return "Live Radar";
    const frameDate = new Date(frame.time * 1000);
    const now = Date.now();
    const diffMin = Math.round((frame.time * 1000 - now) / 60000);

    let relTime = "";
    if (Math.abs(diffMin) <= 3) {
      relTime = "Live Now";
    } else if (diffMin < 0) {
      relTime = `${Math.abs(diffMin)}m ago`;
    } else {
      relTime = `+${diffMin}m forecast`;
    }

    return `${frameDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${relTime})`;
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleRecenter = () => {
    mapRef.current?.flyTo([lat, lon], 8, { duration: 1.2 });
  };

  const handleJumpCity = (city: { name: string; lat: number; lon: number; country: string }) => {
    setLocation({
      name: city.name,
      lat: city.lat,
      lon: city.lon,
      country: city.country,
    });
    mapRef.current?.flyTo([city.lat, city.lon], 8, { duration: 1.2 });
  };

  const handleSearchCitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchQuery.trim()) return;
    setSearchingCity(true);
    try {
      const results = await geocodeCity(mapSearchQuery.trim());
      setMapSearchResults(results);
      if (results.length > 0) {
        const top = results[0];
        handleJumpCity({
          name: top.name,
          lat: top.latitude,
          lon: top.longitude,
          country: top.country,
        });
        setMapSearchResults([]);
        setMapSearchQuery("");
      }
    } catch {
    } finally {
      setSearchingCity(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
  };

  return (
    <div
      style={
        isFullscreen
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "#0b1120",
              padding: 16,
              display: "flex",
              flexDirection: "column",
            }
          : { position: "relative" }
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="flex items-center gap-6" style={{ flexWrap: "wrap" }}>
          <span className="text-muted" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
            Stations:
          </span>
          <button
            className="tab active"
            style={{ padding: "4px 10px", fontSize: "0.76rem" }}
            onClick={handleRecenter}
          >
            📍 {location?.name || "Active"}
          </button>
          {POPULAR_MET_STATIONS.map((c) => (
            <button
              key={c.name}
              className="tab"
              style={{ padding: "4px 9px", fontSize: "0.74rem" }}
              onClick={() => handleJumpCity(c)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchCitySubmit} style={{ display: "flex", gap: 6, minWidth: 220 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              placeholder="Jump to any city or coordinates..."
              value={mapSearchQuery}
              onChange={(e) => setMapSearchQuery(e.target.value)}
              style={{
                padding: "5px 10px 5px 30px",
                fontSize: "0.8rem",
                borderRadius: 20,
                width: "100%",
                background: "rgba(15, 23, 42, 0.7)",
              }}
            />
            <Search
              size={13}
              className="text-muted"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            />
          </div>
          <button
            type="submit"
            className="btn"
            disabled={searchingCity}
            style={{ padding: "4px 12px", fontSize: "0.78rem" }}
          >
            {searchingCity ? "..." : "Go"}
          </button>
        </form>
      </div>

      <div
        className="flex justify-between items-center"
        style={{ flexWrap: "wrap", gap: 10, marginBottom: 12 }}
      >
        <div className="map-layers" style={{ margin: 0 }}>
          <button
            className={activeLayer === "precipitation" ? "tab active" : "tab"}
            onClick={() => setActiveLayer("precipitation")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <span>🌧️</span>
            <span>Precipitation (Radar)</span>
          </button>
          <button
            className={activeLayer === "clouds" ? "tab active" : "tab"}
            onClick={() => setActiveLayer("clouds")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Cloud size={14} />
            <span>Cloud Cover</span>
          </button>
          <button
            className={activeLayer === "pressure" ? "tab active" : "tab"}
            onClick={() => setActiveLayer("pressure")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Compass size={14} />
            <span>Surface Pressure</span>
          </button>
          <button
            className={activeLayer === "wind" ? "tab active" : "tab"}
            onClick={() => setActiveLayer("wind")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Wind size={14} />
            <span>Wind Vectors</span>
          </button>
          <button
            className={activeLayer === "temp" ? "tab active" : "tab"}
            onClick={() => setActiveLayer("temp")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Thermometer size={14} />
            <span>Thermal Field</span>
          </button>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-muted" style={{ fontSize: "0.78rem" }}>
            Basemap:
          </span>
          <button
            className={`tab ${baseMapType === "dark" ? "active" : ""}`}
            style={{ padding: "4px 10px", fontSize: "0.76rem" }}
            onClick={() => setBaseMapType("dark")}
          >
            Dark Matter
          </button>
          <button
            className={`tab ${baseMapType === "standard" ? "active" : ""}`}
            style={{ padding: "4px 10px", fontSize: "0.76rem" }}
            onClick={() => setBaseMapType("standard")}
          >
            Standard
          </button>
          <button
            className={`tab ${baseMapType === "satellite" ? "active" : ""}`}
            style={{ padding: "4px 10px", fontSize: "0.76rem" }}
            onClick={() => setBaseMapType("satellite")}
          >
            Satellite
          </button>
        </div>
      </div>

      {activeLayer === "precipitation" && (
        <div
          style={{
            background: "rgba(15, 23, 42, 0.88)",
            border: "1px solid var(--card-border)",
            borderRadius: 10,
            padding: "8px 14px",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {radarError ? (
            <div style={{ color: "#f87171", fontSize: "0.82rem" }}>⚠️ {radarError}</div>
          ) : radarFrames.length > 0 ? (
            <>
              <div className="flex items-center gap-10">
                <button
                  className="btn btn-outline"
                  style={{
                    padding: "4px 12px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onClick={() => setIsPlayingRadar((p) => !p)}
                >
                  {isPlayingRadar ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isPlayingRadar ? "Pause" : "Play Radar Loop"}</span>
                </button>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--accent)" }}>
                  Frame {currentFrameIdx + 1}/{radarFrames.length}:{" "}
                  <span style={{ color: "#ffffff" }}>
                    {getFrameLabel(radarFrames[currentFrameIdx])}
                  </span>
                </div>
              </div>

              <div className="flex items-center" style={{ flex: 1, maxWidth: 380, minWidth: 160 }}>
                <input
                  type="range"
                  min={0}
                  max={radarFrames.length - 1}
                  value={currentFrameIdx}
                  onChange={(e) => {
                    setIsPlayingRadar(false);
                    setCurrentFrameIdx(Number(e.target.value));
                  }}
                  style={{ width: "100%", accentColor: "#3b82f6", cursor: "pointer", height: 6 }}
                  title="Scrub radar timeline"
                />
              </div>

              <div className="flex items-center gap-6" style={{ fontSize: "0.72rem" }}>
                <span className="text-muted">Rain Intensity:</span>
                <div
                  style={{
                    width: 90,
                    height: 9,
                    borderRadius: 4,
                    background:
                      "linear-gradient(to right, #00ffff, #0080ff, #00ff00, #ffff00, #ff0000, #ff00ff)",
                  }}
                />
                <span style={{ color: "#ef4444", fontWeight: 700 }}>Heavy</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Buffering global live radar stream...
            </div>
          )}
        </div>
      )}

      <div
        style={{
          position: "relative",
          width: "100%",
          flex: isFullscreen ? 1 : "unset",
          height: isFullscreen ? "100%" : 540,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--card-border)",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 400,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            style={{
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: "10px",
              background: "rgba(15, 23, 42, 0.9)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>

          <button
            type="button"
            className="btn btn-outline"
            style={{
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: "10px",
              background: "rgba(15, 23, 42, 0.9)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>

          <button
            type="button"
            className="btn btn-outline"
            style={{
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: "10px",
              background: "rgba(15, 23, 42, 0.9)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
            onClick={handleRecenter}
            title="Recenter to active city"
          >
            <Crosshair size={18} />
          </button>

          <button
            type="button"
            className="btn btn-outline"
            style={{
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: "10px",
              background: "rgba(15, 23, 42, 0.9)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 14,
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--card-border)",
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: "0.74rem",
              fontWeight: 600,
              color: "#e2e8f0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            Zoom: {currentZoom}x ·{" "}
            {currentZoom >= 12 ? "City & Street View" : currentZoom >= 8 ? "Regional Grid" : "Continental"}
          </div>

          {loadingGrid && (
            <div
              style={{
                background: "rgba(37, 99, 235, 0.85)",
                borderRadius: 20,
                padding: "4px 10px",
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Refreshing local grid...
            </div>
          )}
        </div>
      </div>

      {inspectingPoint && (
        <div
          style={{
            marginTop: 12,
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid #3b82f6",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          <div>
            <div className="flex items-center gap-8">
              <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#38bdf8" }}>
                📍 Clicked Map Coordinate
              </span>
              <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                ({inspectingPoint.lat.toFixed(3)}°, {inspectingPoint.lon.toFixed(3)}°)
              </span>
              {inspectingPoint.data && (
                <span
                  style={{
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    padding: "1px 8px",
                    borderRadius: "10px",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                  }}
                >
                  {getWeatherCodeInfo(inspectingPoint.data.weatherCode).description}
                </span>
              )}
            </div>
            {inspectingPoint.loading ? (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
                Sampling instantaneous atmospheric conditions...
              </div>
            ) : inspectingPoint.data ? (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 6,
                  fontSize: "0.82rem",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  <strong>Temp:</strong> {Math.round(inspectingPoint.data.temp)}°C
                </span>
                <span>
                  <strong>Pressure:</strong> {Math.round(inspectingPoint.data.pressure)} hPa
                </span>
                <span>
                  <strong>Wind:</strong> {Math.round(inspectingPoint.data.windSpeed)} km/h (
                  {inspectingPoint.data.windDirection}°)
                </span>
                <span>
                  <strong>Clouds:</strong> {inspectingPoint.data.cloudCover}%
                </span>
                <span>
                  <strong>Rain:</strong> {inspectingPoint.data.precipitation} mm
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex gap-8">
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              onClick={() => {
                setLocation({
                  name: `Coord (${inspectingPoint.lat.toFixed(2)}, ${inspectingPoint.lon.toFixed(2)})`,
                  country: "Custom",
                  lat: inspectingPoint.lat,
                  lon: inspectingPoint.lon,
                });
              }}
            >
              Set Active Dashboard City
            </button>
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "5px 10px" }}
              onClick={() => setInspectingPoint(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
