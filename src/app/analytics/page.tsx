"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useLocation } from "@/context/LocationContext";
import { fetchOpenMeteoForecast, fetchHistoricalWeather } from "@/lib/openMeteo";
import { evaluateComprehensiveRisk, type ComprehensiveRiskAssessment } from "@/lib/riskScoring";
import type { OpenMeteoResponse, AirQuality } from "@/lib/types";

interface AqiHistoryPoint { time: string; aqi: number }

export default function AnalyticsPage() {
  const { location } = useLocation();
  const [meteo, setMeteo] = useState<OpenMeteoResponse | null>(null);
  const [aqiHistory, setAqiHistory] = useState<AqiHistoryPoint[]>([]);
  const [historical, setHistorical] = useState<
    { date: string; max: number; min: number; rain: number }[]
  >([]);
  const [riskAssessment, setRiskAssessment] = useState<ComprehensiveRiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    setError(null);

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    Promise.all([
      fetchOpenMeteoForecast(location.lat, location.lon),
      axios
        .get<AirQuality>("/api/air-quality", { params: { lat: location.lat, lon: location.lon } })
        .catch(() => null),
      axios
        .get("/api/air-quality/history", { params: { lat: location.lat, lon: location.lon } })
        .catch(() => null),
      fetchHistoricalWeather(location.lat, location.lon, fmt(start), fmt(end)).catch(() => null),
    ])
      .then(([meteoRes, airRes, aqiRes, histRes]) => {
        setMeteo(meteoRes);
        if (meteoRes) {
          const risk = evaluateComprehensiveRisk(meteoRes.daily, meteoRes.hourly, airRes?.data);
          setRiskAssessment(risk);
        }
        if (aqiRes?.data?.list) {
          setAqiHistory(
            aqiRes.data.list.map((item: { dt: number; main: { aqi: number } }) => ({
              time: new Date(item.dt * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
              aqi: item.main.aqi,
            }))
          );
        }
        if (histRes?.daily) {
          setHistorical(
            histRes.daily.time.map((date, i) => ({
              date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              max: histRes.daily.temperature_2m_max[i],
              min: histRes.daily.temperature_2m_min[i],
              rain: histRes.daily.precipitation_sum[i],
            }))
          );
        }
      })
      .catch(() => setError("Could not load analytics data."))
      .finally(() => setLoading(false));
  }, [location]);

  if (!location) {
    return (
      <div className="setup-message">
        Pick a city on the Dashboard page first to see analytics.
      </div>
    );
  }

  if (loading) return <LoadingSpinner label="Crunching the meteorological numbers..." />;
  if (error) return <div className="error-message">{error}</div>;
  if (!meteo) return null;

  const tempTrend = meteo.daily.time.map((date, i) => ({
    date: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
    max: meteo.daily.temperature_2m_max[i],
    min: meteo.daily.temperature_2m_min[i],
  }));

  const rainfall = meteo.daily.time.map((date, i) => ({
    date: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
    rain: meteo.daily.precipitation_sum[i],
  }));

  const windTrend = meteo.hourly.time.slice(0, 48).map((time, i) => ({
    time: new Date(time).toLocaleTimeString("en-US", { hour: "2-digit" }),
    wind: meteo.hourly.windspeed_10m[i],
  })).filter((_, i) => i % 3 === 0);

  const humidityTrend = meteo.hourly.time.slice(0, 48).map((time, i) => ({
    time: new Date(time).toLocaleTimeString("en-US", { hour: "2-digit" }),
    humidity: meteo.hourly.relative_humidity_2m[i],
  })).filter((_, i) => i % 3 === 0);

  const monthlyAvgTemp = historical.length
    ? (historical.reduce((s, d) => s + (d.max + d.min) / 2, 0) / historical.length).toFixed(1)
    : null;
  const monthlyRainTotal = historical.length
    ? historical.reduce((s, d) => s + d.rain, 0).toFixed(0)
    : null;

  return (
    <div>
      <h1 className="section-title">{location.name} — Analytics &amp; Risk Dashboard</h1>
      <p className="section-sub">
        Interactive trend charts, comprehensive multi-factor risk matrices, air quality dynamics, and 30-day climate history.
      </p>

      {riskAssessment && (
        <Card title="Multi-Factor Meteorological Risk Matrix" className="mb">
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <div className="flex items-center gap-12">
              <Badge kind={riskAssessment.overallLevel === "Low" ? "success" : riskAssessment.overallLevel === "Moderate" ? "warning" : "danger"}>
                Overall Hazard: {riskAssessment.overallLevel.toUpperCase()}
              </Badge>
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                Index: {riskAssessment.overallScore} / 100
              </span>
            </div>
            <span className="text-muted" style={{ fontSize: "0.82rem" }}>
              Normalized composite across 5 risk dimensions
            </span>
          </div>

          <div className="grid grid-3" style={{ gap: 14 }}>
            {[
              { title: "Thermal Stress", data: riskAssessment.thermalRisk },
              { title: "Outdoor Activities", data: riskAssessment.outdoorRisk },
              { title: "Commute & Travel", data: riskAssessment.commuteRisk },
              { title: "Respiratory Health", data: riskAssessment.respiratoryRisk },
              { title: "Flood Hazard", data: riskAssessment.floodRisk },
            ].map(({ title, data }) => (
              <div
                key={title}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 12,
                  padding: "14px",
                }}
              >
                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{title}</span>
                  <Badge kind={data.level === "Low" ? "success" : data.level === "Moderate" ? "warning" : "danger"}>
                    {data.score}/100
                  </Badge>
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--navy)" }}>{data.headline}</div>
                <p className="text-muted" style={{ fontSize: "0.78rem", margin: "6px 0", lineHeight: 1.4 }}>
                  {data.advice}
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.74rem" }} className="text-muted">
                  {data.factors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-2 mt">
        <Card title="Temperature Trend (7-day)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={tempTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} unit="°C" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="max" stroke="#dc2626" name="High" strokeWidth={2} />
              <Line type="monotone" dataKey="min" stroke="#2563eb" name="Low" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Rainfall Analysis (7-day)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rainfall}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} unit="mm" />
              <Tooltip />
              <Bar dataKey="rain" fill="#2563eb" name="Rainfall (mm)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Wind Speed Analysis (next 48h)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={windTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="time" fontSize={11} />
              <YAxis fontSize={12} unit="km/h" />
              <Tooltip />
              <Line type="monotone" dataKey="wind" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Humidity Trend (next 48h)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={humidityTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="time" fontSize={11} />
              <YAxis fontSize={12} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="humidity" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {aqiHistory.length > 0 && (
          <Card title="AQI Trend (last 5 days)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={aqiHistory}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="time" fontSize={11} />
                <YAxis fontSize={12} domain={[1, 5]} allowDecimals={false} />
                <Tooltip />
                <Line type="stepAfter" dataKey="aqi" stroke="#7c3aed" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {historical.length > 0 && (
          <Card title="Historical Temperature (last 30 days)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={historical}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={10} interval={4} />
                <YAxis fontSize={12} unit="°C" />
                <Tooltip />
                <Line type="monotone" dataKey="max" stroke="#dc2626" name="High" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="min" stroke="#2563eb" name="Low" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {monthlyAvgTemp && (
        <Card title="Monthly Weather Report (last 30 days)" className="mt">
          <div className="grid grid-3">
            <div className="metric-tile">
              <div className="metric-value">{monthlyAvgTemp}°C</div>
              <div className="metric-label">Average temperature</div>
            </div>
            <div className="metric-tile">
              <div className="metric-value">{monthlyRainTotal} mm</div>
              <div className="metric-label">Total rainfall</div>
            </div>
            <div className="metric-tile">
              <div className="metric-value">
                {Math.max(...historical.map((d) => d.max)).toFixed(1)}°C
              </div>
              <div className="metric-label">Hottest day</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
