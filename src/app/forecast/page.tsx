"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import WeatherIcon from "@/components/WeatherIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import Sparkline from "@/lib/Sparkline";
import TempDelta from "@/lib/TempDelta";
import SevereWeatherMarker from "@/lib/SevereWeatherMarker";
import { useLocation } from "@/context/LocationContext";
import { fetchOpenMeteoForecast } from "@/lib/openMeteo";
import { getWeatherCodeInfo } from "@/lib/weatherCodes";
import type { OpenMeteoResponse } from "@/lib/types";

export default function ForecastPage() {
  const { location } = useLocation();
  const [meteo, setMeteo] = useState<OpenMeteoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    setError(null);
    fetchOpenMeteoForecast(location.lat, location.lon)
      .then(setMeteo)
      .catch(() => setError("Could not load the forecast. Please try again."))
      .finally(() => setLoading(false));
  }, [location]);

  if (!location) {
    return (
      <div className="setup-message">
        Pick a city on the Dashboard page first, then come back here for the
        7-day and hourly forecast.
      </div>
    );
  }

  return (
    <div>
      <h1 className="section-title">
        {location.name} — 7-Day &amp; Hourly Forecast
      </h1>
      <p className="section-sub">
        Forecast data from Open-Meteo, updated on each visit to this page.
      </p>

      {loading && <LoadingSpinner label="Loading forecast..." />}
      {error && <div className="error-message">{error}</div>}

      {!loading && meteo && (
        <>
          <Card title="Next 7 Days">
            <div className="grid grid-5" style={{ gap: 14 }}>
              {meteo.daily.time.map((date, i) => {
                const info = getWeatherCodeInfo(meteo.daily.weathercode[i]);
                return (
                  <div key={date} className="forecast-chip">
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {new Date(date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <WeatherIcon code={meteo.daily.weathercode[i]} size={36} />
                    <div style={{ fontSize: "0.85rem", marginTop: 4 }}>
                      {Math.round(meteo.daily.temperature_2m_max[i])}° /{" "}
                      {Math.round(meteo.daily.temperature_2m_min[i])}°
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                      {info.description}
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>
                      💧 {meteo.daily.precipitation_probability_max[i]}%
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="7-Day Detailed Breakdown &amp; Temperature Trends" className="mt">
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Condition</th>
                    <th>High (Day Max)</th>
                    <th>Low (Night Min)</th>
                    <th>24h Temp Trend</th>
                    <th>Precipitation</th>
                    <th>UV Max</th>
                    <th>Wind Max</th>
                  </tr>
                </thead>
                <tbody>
                  {meteo.daily.time.map((date, i) => {
                    const high = meteo.daily.temperature_2m_max[i];
                    const low = meteo.daily.temperature_2m_min[i];

                    const prevHigh = i > 0 ? meteo.daily.temperature_2m_max[i - 1] : null;
                    const prevLow = i > 0 ? meteo.daily.temperature_2m_min[i - 1] : null;
                    const deltaHigh = prevHigh !== null ? high - prevHigh : null;
                    const deltaLow = prevLow !== null ? low - prevLow : null;

                    const dayHourlyTemps = meteo.hourly?.temperature_2m
                      ? meteo.hourly.temperature_2m.slice(i * 24, (i + 1) * 24)
                      : [];

                    const code = meteo.daily.weathercode?.[i] ?? 0;
                    const codeInfo = getWeatherCodeInfo(code);
                    const isToday = i === 0;

                    return (
                      <tr key={date}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          {isToday && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                background: "var(--navy)",
                                color: "white",
                                padding: "1px 6px",
                                borderRadius: "10px",
                                fontWeight: 700,
                                display: "inline-block",
                                marginTop: 2,
                              }}
                            >
                              Today
                            </span>
                          )}
                        </td>
                        <td>
                          <div>
                            <div className="flex items-center gap-8" style={{ whiteSpace: "nowrap" }}>
                              <WeatherIcon code={code} size={24} />
                              <span style={{ fontSize: "0.82rem" }} className="text-muted">
                                {codeInfo.description}
                              </span>
                            </div>
                            <SevereWeatherMarker
                              rain={meteo.daily.precipitation_sum[i]}
                              wind={meteo.daily.windspeed_10m_max[i]}
                              tempMax={high}
                              tempMin={low}
                              weatherCode={code}
                              uvMax={meteo.daily.uv_index_max?.[i]}
                            />
                          </div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                            {Math.round(high)}°C
                          </span>
                          <TempDelta delta={deltaHigh} />
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.9rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {Math.round(low)}°C
                          </span>
                          <TempDelta delta={deltaLow} />
                        </td>
                        <td>
                          <Sparkline data={dayHourlyTemps} width={120} height={32} />
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {meteo.daily.precipitation_sum[i].toFixed(0)} mm
                          {meteo.daily.precipitation_probability_max?.[i] !== undefined && (
                            <span
                              className="text-muted"
                              style={{ fontSize: "0.76rem", marginLeft: 4 }}
                            >
                              ({meteo.daily.precipitation_probability_max[i]}%)
                            </span>
                          )}
                        </td>
                        <td>{meteo.daily.uv_index_max?.[i]?.toFixed(1) ?? "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {Math.round(meteo.daily.windspeed_10m_max?.[i] ?? 0)} km/h
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              className="flex items-center gap-12 text-muted"
              style={{
                fontSize: "0.75rem",
                marginTop: 12,
                borderTop: "1px solid var(--card-border)",
                paddingTop: 10,
                flexWrap: "wrap",
              }}
            >
              <span>
                <strong style={{ color: "#ef4444" }}>▲ Warmer</strong> /{" "}
                <strong style={{ color: "#0284c7" }}>▼ Cooler</strong> compared to previous day
              </span>
              <span>•</span>
              <span>Sparklines show 24h temperature curve throughout the day</span>
            </div>
          </Card>

          <Card title="Next 24 Hours" className="mt">
            <div className="forecast-strip">
              {meteo.hourly.time.slice(0, 24).map((time, i) => (
                <div key={time} className="forecast-chip">
                  <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    {new Date(time).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <WeatherIcon code={meteo.hourly.weathercode[i]} size={28} />
                  <div style={{ fontSize: "0.85rem" }}>
                    {Math.round(meteo.hourly.temperature_2m[i])}°C
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                    💧 {meteo.hourly.precipitation_probability[i]}%
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-2 mt">
            <Card title="Detailed Hourly Conditions (next 12h)">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Temp</th>
                    <th>Feels</th>
                    <th>Humidity</th>
                    <th>Pressure</th>
                    <th>Wind</th>
                  </tr>
                </thead>
                <tbody>
                  {meteo.hourly.time.slice(0, 12).map((time, i) => (
                    <tr key={time}>
                      <td>
                        {new Date(time).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>{Math.round(meteo.hourly.temperature_2m[i])}°C</td>
                      <td>{Math.round(meteo.hourly.apparent_temperature[i])}°C</td>
                      <td>{meteo.hourly.relative_humidity_2m[i]}%</td>
                      <td>{Math.round(meteo.hourly.pressure_msl[i])} hPa</td>
                      <td>{Math.round(meteo.hourly.windspeed_10m[i])} km/h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Sunrise &amp; Sunset (next 5 days)">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sunrise</th>
                    <th>Sunset</th>
                  </tr>
                </thead>
                <tbody>
                  {meteo.daily.time.slice(0, 5).map((date, i) => (
                    <tr key={date}>
                      <td>
                        {new Date(date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td>
                        {new Date(meteo.daily.sunrise[i]).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        {new Date(meteo.daily.sunset[i]).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
