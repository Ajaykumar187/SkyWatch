"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
import { fetchOpenMeteoForecast } from "@/lib/openMeteo";
import {
  predictRainProbability,
  predictHeatwave,
  predictFloodRisk,
  predictStorm,
  overallConfidence,
  aiWeatherSummary,
  type Prediction,
} from "@/lib/aiEngine";
import { runMLEngine, STATE_NAMES, type MLEngineOutput } from "@/lib/mlEngine";
import type { OpenMeteoResponse } from "@/lib/types";

function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const LEVEL_KIND: Record<Prediction["level"], "success" | "warning" | "danger"> = {
  low: "success",
  moderate: "warning",
  high: "danger",
  severe: "danger",
};

function PredictionCard({ title, prediction }: { title: string; prediction: Prediction }) {
  return (
    <Card title={title}>
      <div className="flex items-center gap-12" style={{ marginBottom: 10 }}>
        <Badge kind={LEVEL_KIND[prediction.level]}>{prediction.level.toUpperCase()}</Badge>
        <span className="text-muted" style={{ fontSize: "0.85rem" }}>
          Score {prediction.score}/100
        </span>
      </div>
      <p style={{ marginBottom: 10 }}>{prediction.message}</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem" }} className="text-muted">
        {prediction.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </Card>
  );
}

export default function AiPage() {
  const { location } = useLocation();
  const [meteo, setMeteo] = useState<OpenMeteoResponse | null>(null);
  const [mlOutput, setMlOutput] = useState<MLEngineOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    setError(null);
    fetchOpenMeteoForecast(location.lat, location.lon)
      .then((data) => {
        setMeteo(data);
        const code = data.current_weather?.weathercode ?? data.hourly.weathercode[0] ?? 0;
        const ml = runMLEngine(data.daily, data.hourly, code);
        setMlOutput(ml);
      })
      .catch(() => setError("Could not load forecast data for AI analysis."))
      .finally(() => setLoading(false));
  }, [location]);

  if (!location) {
    return (
      <div className="setup-message">
        Pick a city on the Dashboard page first to see AI insights.
      </div>
    );
  }

  if (loading) return <LoadingSpinner label="Running statistical ML models & neural heuristics..." />;
  if (error) return <div className="error-message">{error}</div>;
  if (!meteo || !mlOutput) return null;

  const rain = predictRainProbability(meteo.daily);
  const heatwave = predictHeatwave(meteo.daily);
  const flood = predictFloodRisk(meteo.daily);
  const storm = predictStorm(meteo.hourly, meteo.daily);
  const confidence = overallConfidence(meteo.daily);
  const summary = aiWeatherSummary(
    location.name,
    meteo.daily,
    rain,
    heatwave,
    flood,
    storm,
    confidence
  );

  const regressionChartData = meteo.daily.time.map((date, i) => ({
    label: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
    actual: Number(meteo.daily.temperature_2m_max[i].toFixed(1)),
    fitted: Number((mlOutput.temperatureRegression.predictedTrend[i] ?? meteo.daily.temperature_2m_max[i]).toFixed(1)),
  }));

  regressionChartData.push({
    label: "+24h",
    actual: null as unknown as number,
    fitted: Number(mlOutput.temperatureRegression.forecastNext48h[23]?.toFixed(1) || 0),
  });
  regressionChartData.push({
    label: "+48h",
    actual: null as unknown as number,
    fitted: Number(mlOutput.temperatureRegression.forecastNext48h[47]?.toFixed(1) || 0),
  });

  return (
    <div>
      <h1 className="section-title">{location.name} — Real Statistical ML &amp; Weather Engine</h1>
      <p className="section-sub">
        Grounded mathematical models trained on live meteorological observations: Least-Squares Ridge Regression,
        Markov Chain State Transition Matrices, and Holt-Winters Double Exponential Smoothing.
      </p>

      <div className="grid grid-2 mt">
        <Card title="Linear Ridge Regression (Temperature Trend &amp; Anomaly)">
          <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
            <Badge kind="info">
              R² = {mlOutput.temperatureRegression.rSquared} (Goodness of Fit)
            </Badge>
            <span className="text-muted" style={{ fontSize: "0.82rem" }}>
              RMSE: {mlOutput.temperatureRegression.rmse}°C · Slope:{" "}
              {mlOutput.temperatureRegression.coefficients[0] >= 0 ? "+" : ""}
              {mlOutput.temperatureRegression.coefficients[0]}°C/day
            </span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={regressionChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} unit="°C" domain={["auto", "auto"]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#dc2626" name="Observed Max" strokeWidth={2} />
              <Line type="monotone" dataKey="fitted" stroke="#2563eb" name="Ridge Fit / +48h Proj" strokeDasharray="4 4" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-muted" style={{ fontSize: "0.78rem", marginTop: 8 }}>
            Solves (XᵀX + λI)⁻¹Xᵀy with regularization parameter λ=0.01 to eliminate overfitting on diurnal micro-cycles.
          </p>
        </Card>

        <Card title="Markov Chain State Transition Matrix">
          <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
            <Badge kind="success">
              Predicted Next State: {mlOutput.markovState.predictedNextState}
            </Badge>
            <span className="text-muted" style={{ fontSize: "0.82rem" }}>
              Confidence: {mlOutput.markovState.confidence}%
            </span>
          </div>

          <p className="text-muted" style={{ fontSize: "0.82rem", margin: "0 0 10px 0" }}>
            Conditional probability distribution P(Tomorrow | Today&apos;s Weather):
          </p>

          <table style={{ width: "100%", fontSize: "0.8rem", marginBottom: 10 }}>
            <thead>
              <tr>
                <th>Current State</th>
                <th>Clear</th>
                <th>Cloudy</th>
                <th>Rain</th>
                <th>Storm</th>
              </tr>
            </thead>
            <tbody>
              {STATE_NAMES.map((state, r) => (
                <tr key={state}>
                  <td><strong>{state}</strong></td>
                  {mlOutput.markovState.transitionMatrix[r]?.map((prob, c) => (
                    <td key={c} style={{ background: prob > 0.4 ? "rgba(37,99,235,0.12)" : "transparent" }}>
                      {(prob * 100).toFixed(0)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted" style={{ fontSize: "0.78rem" }}>
            Trained with Laplace smoothing on sequential WMO weather codes.
          </p>
        </Card>
      </div>

      <div className="grid grid-3 mt">
        <Card title="Heatwave Risk Score">
          <div className="flex items-center gap-12" style={{ marginBottom: 10 }}>
            <Badge kind={mlOutput.heatwaveRiskScore > 60 ? "danger" : mlOutput.heatwaveRiskScore > 30 ? "warning" : "success"}>
              {mlOutput.heatwaveRiskScore}/100
            </Badge>
            <span className="text-muted" style={{ fontSize: "0.82rem" }}>
              Thermal Cumulative Load
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: "0.82rem" }}>
            Combines consecutive days &ge; 35°C, diurnal maxima delta, and positive temperature regression drift.
          </p>
        </Card>

        <Card title="Convective Storm Instability">
          <div className="flex items-center gap-12" style={{ marginBottom: 10 }}>
            <Badge kind={mlOutput.stormRiskScore > 60 ? "danger" : mlOutput.stormRiskScore > 30 ? "warning" : "success"}>
              {mlOutput.stormRiskScore}/100
            </Badge>
            <span className="text-muted" style={{ fontSize: "0.82rem" }}>
              Barometric Instability
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: "0.82rem" }}>
            Synthesizes rapid 3-hour barometric pressure drop ({mlOutput.pressureTrend.status}) with atmospheric moisture saturation.
          </p>
        </Card>

        <Card title="Hydrological Flood Index">
          <div className="flex items-center gap-12" style={{ marginBottom: 10 }}>
            <Badge kind={mlOutput.floodRiskScore > 60 ? "danger" : mlOutput.floodRiskScore > 30 ? "warning" : "success"}>
              {mlOutput.floodRiskScore}/100
            </Badge>
            <span className="text-muted" style={{ fontSize: "0.82rem" }}>
              Runoff Hazard Index
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: "0.82rem" }}>
            Calculates 7-day antecedent precipitation sum combined with peak 24-hour rainfall intensity.
          </p>
        </Card>
      </div>

      <Card title="Synthesis &amp; Model Narrative" className="mt">
        <div style={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>
          {summary.split("\n\n").map((line, i) => (
            <p key={i}>{renderBold(line)}</p>
          ))}
        </div>
        <div className="mt" style={{ borderTop: "1px solid var(--card-border)", paddingTop: 12 }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem" }}>Mathematical Formulations &amp; Methodologies:</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem" }} className="text-muted">
            {mlOutput.modelAlgorithmExplanation.map((expl, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>{expl}</li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="grid grid-2 mt">
        <PredictionCard title="Precipitation Probability Model" prediction={rain} />
        <PredictionCard title="Heatwave Prediction" prediction={heatwave} />
        <PredictionCard title="Flood Risk Assessment" prediction={flood} />
        <PredictionCard title="Storm Detection" prediction={storm} />
      </div>
    </div>
  );
}
