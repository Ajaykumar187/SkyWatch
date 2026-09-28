"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Card from "@/components/Card";
import WeatherIcon from "@/components/WeatherIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { geocodeCity, fetchOpenMeteoForecast } from "@/lib/openMeteo";
import type { CurrentWeather, GeocodeResult, OpenMeteoResponse } from "@/lib/types";

interface CityComparison {
  name: string;
  country: string;
  weather: CurrentWeather;
  meteo: OpenMeteoResponse;
}

export default function ComparePage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [cities, setCities] = useState<CityComparison[]>([]);
  const [favorites, setFavorites] = useState<{ name: string; lat: number; lon: number; country?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get("/api/favorites")
      .then((res) => setFavorites(res.data.favorites))
      .catch(() => setFavorites([]));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(() => {
      geocodeCity(query).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const addCity = async (name: string, lat: number, lon: number, country: string) => {
    if (cities.length >= 4) {
      setError("You can compare up to 4 cities at a time.");
      return;
    }
    if (cities.some((c) => c.name === name)) return;
    setLoading(true);
    setError(null);
    try {
      const [weatherRes, meteo] = await Promise.all([
        axios.get<CurrentWeather>("/api/weather", { params: { lat, lon } }),
        fetchOpenMeteoForecast(lat, lon),
      ]);
      setCities((prev) => [...prev, { name, country, weather: weatherRes.data, meteo }]);
      setQuery("");
      setSuggestions([]);
    } catch {
      setError(`Could not load weather for ${name}.`);
    } finally {
      setLoading(false);
    }
  };

  const removeCity = (name: string) => {
    setCities((prev) => prev.filter((c) => c.name !== name));
  };

  return (
    <div>
      <h1 className="section-title">Compare Cities</h1>
      <p className="section-sub">Compare current conditions and the 7-day outlook side by side (up to 4 cities).</p>

      <Card>
        <div className="search-input-wrap" style={{ maxWidth: 400 }}>
          <input
            type="text"
            placeholder="Add a city to compare..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="suggestions">
              {suggestions.map((s) => (
                <li key={s.id} onClick={() => addCity(s.name, s.latitude, s.longitude, s.country)}>
                  {s.name}, {s.country}
                </li>
              ))}
            </ul>
          )}
        </div>

        {favorites.length > 0 && (
          <div className="mt">
            <p className="text-muted" style={{ fontSize: "0.82rem", marginBottom: 8 }}>
              Or add from your favorites:
            </p>
            <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
              {favorites.map((f) => (
                <button
                  key={f.name}
                  className="tab"
                  onClick={() => addCity(f.name, f.lat, f.lon, f.country ?? "")}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {loading && <LoadingSpinner label="Adding city..." />}
      {error && <div className="error-message mt">{error}</div>}

      {cities.length > 0 && (
        <div className={`grid mt grid-${Math.min(cities.length, 4)}`}>
          {cities.map((c) => (
            <Card key={c.name}>
              <div className="flex justify-between items-center">
                <h3 style={{ margin: 0 }}>
                  {c.weather.name}, {c.weather.sys.country}
                </h3>
                <button className="icon-btn" onClick={() => removeCity(c.name)} title="Remove">
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-12 mt">
                <WeatherIcon code={c.meteo.current_weather?.weathercode ?? 0} size={48} />
                <div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>
                    {Math.round(c.weather.main.temp)}°C
                  </div>
                  <div className="text-muted" style={{ textTransform: "capitalize" }}>
                    {c.weather.weather[0].description}
                  </div>
                </div>
              </div>
              <table className="mt">
                <tbody>
                  <tr><td>Humidity</td><td>{c.weather.main.humidity}%</td></tr>
                  <tr><td>Wind</td><td>{Math.round(c.weather.wind.speed * 3.6)} km/h</td></tr>
                  <tr><td>Pressure</td><td>{c.weather.main.pressure} hPa</td></tr>
                  <tr>
                    <td>7-day high/low</td>
                    <td>
                      {Math.round(Math.max(...c.meteo.daily.temperature_2m_max))}° /{" "}
                      {Math.round(Math.min(...c.meteo.daily.temperature_2m_min))}°
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
