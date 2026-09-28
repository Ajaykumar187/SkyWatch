import { test, describe } from "node:test";
import assert from "node:assert/strict";

function calculateHeatIndex(tempC, rh) {
  if (tempC < 27) return tempC;
  const T = (tempC * 9) / 5 + 32;
  const R = rh;
  const c1 = -42.379;
  const c2 = 2.04901523;
  const c3 = 10.14333127;
  const c4 = -0.22475541;
  const c5 = -0.00683783;
  const c6 = -0.05481717;
  const c7 = 0.00122874;
  const c8 = 0.00085282;
  const c9 = -0.00000199;

  let hiF =
    c1 +
    c2 * T +
    c3 * R +
    c4 * T * R +
    c5 * T * T +
    c6 * R * R +
    c7 * T * T * R +
    c8 * T * R * R +
    c9 * T * T * R * R;
  return Number((((hiF - 32) * 5) / 9).toFixed(1));
}

function calculateWindChill(tempC, windKmh) {
  if (tempC > 10 || windKmh < 4.8) return tempC;
  const wc =
    13.12 +
    0.6215 * tempC -
    11.37 * Math.pow(windKmh, 0.16) +
    0.3965 * tempC * Math.pow(windKmh, 0.16);
  return Number(wc.toFixed(1));
}

describe("Meteorological Risk Scoring Tests", () => {
  test("Heat Index increases with high relative humidity at 35C", () => {
    const dryHeat = calculateHeatIndex(35, 20);
    const humidHeat = calculateHeatIndex(35, 75);
    assert.ok(humidHeat > dryHeat, `Humid heat ${humidHeat}°C must exceed dry heat ${dryHeat}°C`);
    assert.ok(humidHeat > 40, `Humid heat at 35C/75% RH should feel > 40C, got ${humidHeat}`);
  });

  test("Wind chill properly depresses apparent temperature in cold winds", () => {
    const stillCold = calculateWindChill(2, 5);
    const windyCold = calculateWindChill(2, 50);
    assert.ok(windyCold < stillCold, `High wind chill ${windyCold}°C must feel colder than ${stillCold}°C`);
    assert.ok(windyCold < 0, `Wind chill at 2C/50kmh should be below freezing, got ${windyCold}`);
  });
});
