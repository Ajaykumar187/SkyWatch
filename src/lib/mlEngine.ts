import type { DailyForecast, HourlyForecast } from "./types";

export interface RegressionModelResult {
  coefficients: number[];
  intercept: number;
  rSquared: number;
  rmse: number;
  predictedTrend: number[];
  forecastNext48h: number[];
}

export function trainLinearRegression(
  xValues: number[],
  yValues: number[],
  lambda = 0.01
): RegressionModelResult {
  const n = xValues.length;
  if (n < 3) {
    return {
      coefficients: [0],
      intercept: yValues[0] ?? 20,
      rSquared: 0,
      rmse: 0,
      predictedTrend: yValues,
      forecastNext48h: [],
    };
  }

  const xMean = xValues.reduce((a, b) => a + b, 0) / n;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean;
    const yDiff = yValues[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff + lambda;
  }

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  let ssTotal = 0;
  let ssResidual = 0;
  const predictedTrend: number[] = [];

  for (let i = 0; i < n; i++) {
    const yPred = intercept + slope * xValues[i];
    predictedTrend.push(yPred);
    ssResidual += (yValues[i] - yPred) ** 2;
    ssTotal += (yValues[i] - yMean) ** 2;
  }

  const rSquared = ssTotal > 0 ? Math.max(0, 1 - ssResidual / ssTotal) : 0;
  const rmse = Math.sqrt(ssResidual / n);

  const forecastNext48h: number[] = [];
  for (let step = 1; step <= 48; step++) {
    forecastNext48h.push(intercept + slope * (xValues[n - 1] + step));
  }

  return {
    coefficients: [Number(slope.toFixed(4))],
    intercept: Number(intercept.toFixed(2)),
    rSquared: Number(rSquared.toFixed(3)),
    rmse: Number(rmse.toFixed(2)),
    predictedTrend,
    forecastNext48h,
  };
}

export type WeatherState = 0 | 1 | 2 | 3;
export const STATE_NAMES = ["Clear", "Cloudy", "Rain", "Thunderstorm"] as const;

export function wmoToState(code: number): WeatherState {
  if (code <= 1) return 0; // Clear
  if (code <= 3 || code === 45 || code === 48) return 1;
  if (code >= 51 && code <= 86) return 2;
  if (code >= 95) return 3; // Storm
  return 1;
}

export interface MarkovTransitionResult {
  transitionMatrix: number[][];
  stateProbabilities: Record<string, number>;
  predictedNextState: (typeof STATE_NAMES)[number];
  confidence: number;
}

export function computeMarkovTransitions(
  historicalCodes: number[],
  currentStateCode: number
): MarkovTransitionResult {
  const numStates = 4;
  const countMatrix: number[][] = Array.from({ length: numStates }, () =>
    Array(numStates).fill(1)
  );

  for (let i = 0; i < historicalCodes.length - 1; i++) {
    const fromState = wmoToState(historicalCodes[i]);
    const toState = wmoToState(historicalCodes[i + 1]);
    countMatrix[fromState][toState] += 1;
  }

  const transitionMatrix: number[][] = countMatrix.map((row) => {
    const sum = row.reduce((a, b) => a + b, 0);
    return row.map((cnt) => Number((cnt / sum).toFixed(3)));
  });

  const currentSt = wmoToState(currentStateCode);
  const nextProbabilities = transitionMatrix[currentSt];

  let maxProb = -1;
  let bestState: WeatherState = 0;
  for (let s = 0; s < numStates; s++) {
    if (nextProbabilities[s] > maxProb) {
      maxProb = nextProbabilities[s];
      bestState = s as WeatherState;
    }
  }

  return {
    transitionMatrix,
    stateProbabilities: {
      Clear: nextProbabilities[0],
      Cloudy: nextProbabilities[1],
      Rain: nextProbabilities[2],
      Thunderstorm: nextProbabilities[3],
    },
    predictedNextState: STATE_NAMES[bestState],
    confidence: Math.round(maxProb * 100),
  };
}

export function holtWintersSmoothing(
  series: number[],
  alpha = 0.3,
  beta = 0.1,
  stepsAhead = 24
): { smoothed: number[]; forecast: number[] } {
  if (series.length < 2) return { smoothed: series, forecast: [] };

  let level = series[0];
  let trend = series[1] - series[0];
  const smoothed: number[] = [level];

  for (let i = 1; i < series.length; i++) {
    const val = series[i];
    const prevLevel = level;
    level = alpha * val + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    smoothed.push(level);
  }

  const forecast: number[] = [];
  for (let m = 1; m <= stepsAhead; m++) {
    forecast.push(level + m * trend);
  }

  return { smoothed, forecast };
}

export interface MLEngineOutput {
  temperatureRegression: RegressionModelResult;
  pressureTrend: { slope: number; status: "rising" | "steady" | "falling" };
  markovState: MarkovTransitionResult;
  humidityForecast24h: number[];
  heatwaveRiskScore: number;
  stormRiskScore: number;
  floodRiskScore: number;
  modelConfidenceScore: number;
  modelAlgorithmExplanation: string[];
}

export function runMLEngine(
  daily: DailyForecast,
  hourly: HourlyForecast,
  currentCode: number
): MLEngineOutput {
  const xDays = daily.time.map((_, i) => i);
  const tempRegression = trainLinearRegression(xDays, daily.temperature_2m_max);

  const markov = computeMarkovTransitions(daily.weathercode, currentCode);

  const recentPressure = hourly.pressure_msl.slice(0, 12);
  const pressureReg = trainLinearRegression(
    recentPressure.map((_, i) => i),
    recentPressure
  );
  const pSlope = pressureReg.coefficients[0];
  const pressureStatus: "rising" | "steady" | "falling" =
    pSlope > 0.3 ? "rising" : pSlope < -0.3 ? "falling" : "steady";

  const hw = holtWintersSmoothing(hourly.relative_humidity_2m.slice(0, 48), 0.3, 0.1, 24);

  const hotDays = daily.temperature_2m_max.filter((t) => t >= 35).length;
  const maxTemp = Math.max(...daily.temperature_2m_max);
  const heatwaveRiskScore = Math.min(
    100,
    Math.round(hotDays * 20 + Math.max(0, maxTemp - 32) * 5 + (tempRegression.coefficients[0] > 0 ? 15 : 0))
  );

  const stormProb = markov.stateProbabilities.Thunderstorm || 0;
  const stormRiskScore = Math.min(
    100,
    Math.round(
      stormProb * 50 +
        (pressureStatus === "falling" ? 30 : 0) +
        ((hourly.relative_humidity_2m[0] ?? 50) > 75 ? 20 : 0)
    )
  );

  const totalRain = daily.precipitation_sum.reduce((a, b) => a + b, 0);
  const maxDayRain = Math.max(...daily.precipitation_sum);
  const floodRiskScore = Math.min(
    100,
    Math.round(totalRain * 1.2 + maxDayRain * 1.5)
  );

  const modelConfidenceScore = Math.round(
    tempRegression.rSquared * 40 + markov.confidence * 0.4 + 20
  );

  return {
    temperatureRegression: tempRegression,
    pressureTrend: {
      slope: pSlope,
      status: pressureStatus,
    },
    markovState: markov,
    humidityForecast24h: hw.forecast.map((v) => Math.min(100, Math.max(0, Math.round(v)))),
    heatwaveRiskScore,
    stormRiskScore,
    floodRiskScore,
    modelConfidenceScore: Math.min(99, Math.max(50, modelConfidenceScore)),
    modelAlgorithmExplanation: [
      `Ridge regression on 7-day maxima: slope ${tempRegression.coefficients[0] >= 0 ? "+" : ""}${tempRegression.coefficients[0]}°C/day (R² = ${tempRegression.rSquared}).`,
      `Markov transition matrix calculates ${markov.confidence}% probability of ${markov.predictedNextState} next based on state transition frequencies.`,
      `Barometric trend is ${pressureStatus} (${pSlope >= 0 ? "+" : ""}${pSlope.toFixed(2)} hPa/h), integrated with Holt-Winters humidity projection.`,
    ],
  };
}
