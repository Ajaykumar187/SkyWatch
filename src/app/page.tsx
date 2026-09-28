"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "motion/react";
import SearchBar from "@/components/SearchBar";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import WeatherIcon from "@/components/WeatherIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import HourlyUvWidget from "@/components/HourlyUvWidgets";
import { useLocation } from "@/context/LocationContext";
import { fetchOpenMeteoForecast, geocodeCity } from "@/lib/openMeteo";
import { getWeatherCodeInfo, getAqiInfo } from "@/lib/weatherCodes";
import { getMoonPhase } from "@/lib/moonPhase";
import {
  evaluateComprehensiveRisk,
  generateRecommendations,
  generateEventTimeline,
  type ComprehensiveRiskAssessment,
  type WeatherRecommendation,
  type WeatherTimelineEvent,
} from "@/lib/riskScoring";
import type { CurrentWeather, AirQuality, OpenMeteoResponse } from "@/lib/types";

const DEFAULT_CITY = "New Delhi";

function compassDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function formatTime(unixSeconds: number, tzOffsetSeconds: number): string {
  const date = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default function Home() {
  const { location, setLocation } = useLocation();
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [meteo, setMeteo] = useState<OpenMeteoResponse | null>(null);
  const [air, setAir] = useState<AirQuality | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [riskAssessment, setRiskAssessment] = useState<ComprehensiveRiskAssessment | null>(null);
  const [recommendations, setRecommendations] = useState<WeatherRecommendation[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<WeatherTimelineEvent[]>([]);

  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [windUnit, setWindUnit] = useState<"kmh" | "mph">("kmh");
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>({
    timeline: true,
    recommendations: true,
    uvIndex: true,
    risk: true,
    metrics: true,
    moonPhase: true,
    airQuality: true,
  });

  useEffect(() => {
    axios
      .get("/api/dashboard/layout")
      .then((res) => {
        const layout = res.data?.layout;
        if (layout) {
          if (layout.tempUnit) setTempUnit(layout.tempUnit);
          if (layout.windUnit) setWindUnit(layout.windUnit);
          if (Array.isArray(layout.visibleCards)) {
            const map: Record<string, boolean> = {
              timeline: layout.visibleCards.includes("timeline"),
              recommendations: layout.visibleCards.includes("recommendations"),
              uvIndex: layout.visibleCards.includes("uvIndex") || !layout.visibleCards.length,
              risk: layout.visibleCards.includes("risk"),
              metrics: layout.visibleCards.includes("metrics"),
              moonPhase: layout.visibleCards.includes("moonPhase"),
              airQuality: layout.visibleCards.includes("airQuality"),
            };
            setVisibleWidgets(map);
          }
        }
      })
      .catch(() => {});
  }, []);

  const saveLayoutPrefs = async (newTemp: "C" | "F", newWind: "kmh" | "mph", newWidgets: Record<string, boolean>) => {
    setTempUnit(newTemp);
    setWindUnit(newWind);
    setVisibleWidgets(newWidgets);
    const activeCards = Object.keys(newWidgets).filter((k) => newWidgets[k]);
    await axios
      .post("/api/dashboard/layout", {
        tempUnit: newTemp,
        windUnit: newWind,
        visibleCards: activeCards,
        cardOrder: activeCards,
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (location) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            name: "Current location",
            country: "",
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        async () => {
          const results = await geocodeCity(DEFAULT_CITY);
          if (results[0]) {
            setLocation({
              name: results[0].name,
              country: results[0].country,
              lat: results[0].latitude,
              lon: results[0].longitude,
            });
          }
        }
      );
    } else {
      geocodeCity(DEFAULT_CITY).then((results) => {
        if (results[0]) {
          setLocation({
            name: results[0].name,
            country: results[0].country,
            lat: results[0].latitude,
            lon: results[0].longitude,
          });
        }
      });
    }
  }, [location, setLocation]);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [weatherRes, meteoRes, airRes] = await Promise.all([
          axios.get<CurrentWeather>("/api/weather", {
            params: { lat: location.lat, lon: location.lon },
          }),
          fetchOpenMeteoForecast(location.lat, location.lon),
          axios.get<AirQuality>("/api/air-quality", {
            params: { lat: location.lat, lon: location.lon },
          }),
        ]);
        if (cancelled) return;
        setWeather(weatherRes.data);
        setMeteo(meteoRes);
        setAir(airRes.data);

        const risk = evaluateComprehensiveRisk(meteoRes.daily, meteoRes.hourly, airRes.data);
        const recs = generateRecommendations(meteoRes.daily, meteoRes.hourly, airRes.data);
        const events = generateEventTimeline(meteoRes.daily, meteoRes.hourly);

        setRiskAssessment(risk);
        setRecommendations(recs);
        setTimelineEvents(events);
      } catch (err) {
        if (cancelled) return;
        const message =
          axios.isAxiosError(err) && err.response?.data?.error
            ? (err.response.data.error as string)
            : "Could not load weather data. Please try another city.";
        setError(message);
        setWeather(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location]);

  const currentCode = meteo?.current_weather?.weathercode ?? 0;
  const codeInfo = getWeatherCodeInfo(currentCode);
  const isNight =
    weather && weather.dt < weather.sys.sunrise + weather.timezone
      ? true
      : weather
      ? weather.dt > weather.sys.sunset + weather.timezone
      : false;
  const heroClass = isNight ? "hero-night" : `hero-${codeInfo.category}`;

  const aqi = air?.list?.[0]?.main?.aqi;
  const components = air?.list?.[0]?.components;
  const aqiInfo = aqi ? getAqiInfo(aqi) : null;
  const uvToday = meteo?.daily?.uv_index_max?.[0];
  const dewPointNow = meteo?.hourly?.dew_point_2m?.[0];
  const visibilityKm = weather ? (weather.visibility / 1000).toFixed(1) : null;
  const moon = getMoonPhase();

  const displayTemp = (tempC: number) => {
    if (tempUnit === "F") return `${Math.round((tempC * 9) / 5 + 32)}°F`;
    return `${Math.round(tempC)}°C`;
  };

  const displayWind = (speedKmh: number) => {
    if (windUnit === "mph") return `${Math.round(speedKmh * 0.621371)} mph`;
    return `${Math.round(speedKmh)} km/h`;
  };

  return (
    <div>
      <div className="flex justify-between items-center" style={{ gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <SearchBar />
        </div>
        <button
          className="btn btn-outline"
          onClick={() => setShowPersonalizeModal(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", padding: "8px 14px" }}
          title="Customize dashboard cards and units"
        >
          ⚙️ Customize Dashboard
        </button>
      </div>

      {showPersonalizeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowPersonalizeModal(false)}
        >
          <div
            style={{
              background: "var(--card-bg)",
              backdropFilter: "blur(18px)",
              border: "1.5px solid var(--card-border)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 420,
              width: "100%",
              color: "var(--text)",
              boxShadow: "var(--shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0" }}>Personalize Dashboard</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                Temperature Unit
              </label>
              <div className="flex gap-8">
                <button
                  className={tempUnit === "C" ? "tab active" : "tab"}
                  onClick={() => saveLayoutPrefs("C", windUnit, visibleWidgets)}
                >
                  Celsius (°C)
                </button>
                <button
                  className={tempUnit === "F" ? "tab active" : "tab"}
                  onClick={() => saveLayoutPrefs("F", windUnit, visibleWidgets)}
                >
                  Fahrenheit (°F)
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                Wind Speed Unit
              </label>
              <div className="flex gap-8">
                <button
                  className={windUnit === "kmh" ? "tab active" : "tab"}
                  onClick={() => saveLayoutPrefs(tempUnit, "kmh", visibleWidgets)}
                >
                  km/h
                </button>
                <button
                  className={windUnit === "mph" ? "tab active" : "tab"}
                  onClick={() => saveLayoutPrefs(tempUnit, "mph", visibleWidgets)}
                >
                  mph
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: 8 }}>
                Visible Widgets
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries({
                  timeline: "Event Timeline",
                  recommendations: "Recommendations",
                  uvIndex: "Hourly UV Index",
                  risk: "Risk Index",
                  metrics: "Condition Tiles",
                  moonPhase: "Moon Phase",
                  airQuality: "Air Quality",
                }).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(visibleWidgets[key])}
                      onChange={(e) => {
                        const updated = { ...visibleWidgets, [key]: e.target.checked };
                        saveLayoutPrefs(tempUnit, windUnit, updated);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <button className="btn" style={{ width: "100%" }} onClick={() => setShowPersonalizeModal(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mt">
        {loading && <LoadingSpinner label="Fetching live conditions..." />}
        {error && <div className="error-message">{error}</div>}

        {!loading && weather && meteo && (
          <motion.div
            key={`${weather.name}-${weather.coord.lat}-${weather.coord.lon}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`hero ${heroClass}`}
            >
              <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div className="hero-location">
                    {weather.name}
                    {weather.sys.country ? `, ${weather.sys.country}` : ""}
                  </div>
                  <div className="hero-temp">{displayTemp(weather.main.temp)}</div>
                  <div className="hero-desc">{weather.weather[0].description}</div>
                  <div style={{ opacity: 0.9, fontSize: "0.9rem", marginTop: 4 }}>
                    Feels like {displayTemp(weather.main.feels_like)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <WeatherIcon code={currentCode} size={96} />
                  {riskAssessment && visibleWidgets.risk && (
                    <Badge kind={riskAssessment.overallLevel === "Low" ? "success" : riskAssessment.overallLevel === "Moderate" ? "warning" : "danger"}>
                      Risk: {riskAssessment.overallLevel} ({riskAssessment.overallScore}/100)
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>

            {visibleWidgets.timeline && timelineEvents.length > 0 && (
              <Card title="Upcoming Weather Timeline (Next 36h)" className="mt" delay={0.08}>
                <p className="text-muted" style={{ fontSize: "0.82rem", margin: "0 0 14px 0" }}>
                  Key meteorological transitions detected in your local forecast:
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "14px",
                    overflowX: "auto",
                    paddingBottom: "10px",
                    scrollbarWidth: "thin",
                  }}
                >
                  {timelineEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        minWidth: "160px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid var(--card-border)",
                        borderRadius: "12px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span style={{ fontSize: "0.78rem", fontWeight: 600 }} className="text-muted">
                          {evt.hourLabel}
                        </span>
                        <span style={{ fontSize: "1.2rem" }}>{evt.icon}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.86rem" }}>{evt.title}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem", lineHeight: 1.4 }}>
                        {evt.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {visibleWidgets.recommendations && recommendations.length > 0 && (
              <Card title="Personalized Daily Recommendations" className="mt" delay={0.14}>
                <div className="grid grid-3" style={{ gap: 12 }}>
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid var(--card-border)",
                        borderRadius: "12px",
                        padding: "14px",
                        display: "flex",
                        gap: "12px",
                      }}
                    >
                      <span style={{ fontSize: "1.8rem" }}>{rec.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{rec.title}</span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: "10px",
                              background: rec.priority === "high" ? "rgba(220,38,38,0.2)" : "rgba(37,99,235,0.2)",
                              color: rec.priority === "high" ? "var(--danger)" : "var(--navy)",
                              fontWeight: 700,
                            }}
                          >
                            {rec.category}
                          </span>
                        </div>
                        <p className="text-muted" style={{ fontSize: "0.8rem", margin: "6px 0 0 0", lineHeight: 1.4 }}>
                          {rec.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {visibleWidgets.uvIndex && meteo && (
              <Card title="Hourly UV Index (Next 12 Hours)" className="mt" delay={0.16}>
                <HourlyUvWidget
                  hourly={meteo.hourly}
                  daily={meteo.daily}
                  currentTime={weather?.dt}
                  timezoneOffset={weather?.timezone}
                />
              </Card>
            )}

            {visibleWidgets.metrics && (
              <div className="grid grid-4 mt">
                <Card delay={0.18}>
                  <div className="metric-tile">
                    <div className="metric-value">{aqiInfo?.label ?? "N/A"}</div>
                    <div className="metric-label">Air Quality Index</div>
                  </div>
                </Card>
                <Card delay={0.22}>
                  <div className="metric-tile">
                    <div className="metric-value">{uvToday?.toFixed(1) ?? "N/A"}</div>
                    <div className="metric-label">UV Index (today&apos;s max)</div>
                  </div>
                </Card>
                <Card delay={0.26}>
                  <div className="metric-tile">
                    <div className="metric-value">{visibilityKm ?? "N/A"} km</div>
                    <div className="metric-label">Visibility</div>
                  </div>
                </Card>
                <Card delay={0.30}>
                  <div className="metric-tile">
                    <div className="metric-value">
                      {dewPointNow !== undefined ? displayTemp(dewPointNow) : "N/A"}
                    </div>
                    <div className="metric-label">Dew Point</div>
                  </div>
                </Card>
                <Card delay={0.34}>
                  <div className="metric-tile">
                    <div className="metric-value">{weather.main.pressure} hPa</div>
                    <div className="metric-label">Pressure</div>
                  </div>
                </Card>
                <Card delay={0.38}>
                  <div className="metric-tile">
                    <div className="metric-value">{weather.main.humidity}%</div>
                    <div className="metric-label">Humidity</div>
                  </div>
                </Card>
                <Card delay={0.42}>
                  <div className="metric-tile">
                    <div className="metric-value">
                      {displayWind(weather.wind.speed * 3.6)} {compassDirection(weather.wind.deg)}
                    </div>
                    <div className="metric-label">Wind Speed &amp; Direction</div>
                  </div>
                </Card>
                <Card delay={0.46}>
                  <div className="metric-tile">
                    <div className="metric-value" style={{ fontSize: "1.05rem" }}>
                      {formatTime(weather.sys.sunrise, weather.timezone)} /{" "}
                      {formatTime(weather.sys.sunset, weather.timezone)}
                    </div>
                    <div className="metric-label">Sunrise / Sunset</div>
                  </div>
                </Card>
              </div>
            )}

            <div className="grid grid-2 mt">
              {visibleWidgets.moonPhase && (
                <Card title="Moon Phase" delay={0.50}>
                  <div className="flex items-center gap-12">
                    <span style={{ fontSize: "2.5rem" }}>{moon.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{moon.name}</div>
                      <div className="text-muted">{moon.illumination}% illuminated</div>
                    </div>
                  </div>
                </Card>
              )}

              {visibleWidgets.airQuality && aqiInfo && components && (
                <Card title="Air Quality Detail" delay={0.54}>
                  <div className="flex items-center gap-12" style={{ marginBottom: 10 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: aqiInfo.color,
                        display: "inline-block",
                      }}
                    />
                    <strong>{aqiInfo.label}</strong>
                  </div>
                  <p className="text-muted" style={{ fontSize: "0.85rem" }}>
                    {aqiInfo.advice}
                  </p>
                  <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: 8 }}>
                    PM2.5 {components.pm2_5.toFixed(0)} · PM10 {components.pm10.toFixed(0)} · O
                    <sub>3</sub> {components.o3.toFixed(0)} µg/m³
                  </p>
                </Card>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.58 }}
              className="mt text-center flex justify-center gap-12"
              style={{ flexWrap: "wrap" }}
            >
              <a href="/forecast" className="btn">
                See 7-day &amp; hourly forecast →
              </a>
              <a href="/ai" className="btn btn-outline">
                Explore Real ML Weather Model →
              </a>
            </motion.div>
          </motion.div>
        )}

        {!loading && !weather && !error && (
          <div className="setup-message">
            Search for a city above, or allow location access, to see current conditions.
          </div>
        )}
      </div>
    </div>
  );
}
