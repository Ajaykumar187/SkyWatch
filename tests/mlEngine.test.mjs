import { test, describe } from "node:test";
import assert from "node:assert/strict";

function trainLinearRegression(xValues, yValues, lambda = 0.01) {
  const n = xValues.length;
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
  for (let i = 0; i < n; i++) {
    const yPred = intercept + slope * xValues[i];
    ssResidual += (yValues[i] - yPred) ** 2;
    ssTotal += (yValues[i] - yMean) ** 2;
  }
  const rSquared = ssTotal > 0 ? Math.max(0, 1 - ssResidual / ssTotal) : 0;
  const rmse = Math.sqrt(ssResidual / n);

  return { slope, intercept, rSquared, rmse };
}

function wmoToState(code) {
  if (code <= 1) return 0;
  if (code <= 3 || code === 45 || code === 48) return 1;
  if (code >= 51 && code <= 86) return 2;
  if (code >= 95) return 3;
  return 1;
}

function computeMarkovTransitions(historicalCodes, currentStateCode) {
  const countMatrix = Array.from({ length: 4 }, () => Array(4).fill(1));
  for (let i = 0; i < historicalCodes.length - 1; i++) {
    const fromState = wmoToState(historicalCodes[i]);
    const toState = wmoToState(historicalCodes[i + 1]);
    countMatrix[fromState][toState] += 1;
  }
  const transitionMatrix = countMatrix.map((row) => {
    const sum = row.reduce((a, b) => a + b, 0);
    return row.map((cnt) => cnt / sum);
  });
  const currentSt = wmoToState(currentStateCode);
  return { nextProbabilities: transitionMatrix[currentSt] };
}

describe("Real ML Engine Tests", () => {
  test("Ridge Regression computes accurate slope and R2 for linear trend", () => {
    const x = [0, 1, 2, 3, 4, 5, 6];
    const y = [20, 22, 24, 26, 28, 30, 32]; // Perfect slope 2

    const res = trainLinearRegression(x, y);
    assert.ok(Math.abs(res.slope - 2) < 0.1, `Expected slope ~2, got ${res.slope}`);
    assert.ok(res.rSquared > 0.98, `Expected high R², got ${res.rSquared}`);
    assert.ok(res.rmse < 0.5, `Expected low RMSE, got ${res.rmse}`);
  });

  test("Markov Chain computes valid probability distribution summing to 1.0", () => {
    const sequence = [0, 0, 1, 2, 2, 3, 1, 0, 0, 1];
    const res = computeMarkovTransitions(sequence, 0);
    const sum = res.nextProbabilities.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Probabilities must sum to 1.0, got ${sum}`);
    assert.ok(res.nextProbabilities.length === 4, "Must have 4 states");
  });
});
