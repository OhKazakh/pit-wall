import { expect, test } from "vitest";
import { FUEL_EFFECT, MIN_STINT_LAPS, fuelCorrected, stintWear } from "../src/calc/degradation";
import { lap } from "./helpers";

// A 30-lap race where the tyre costs 0.08 s per lap of age and fuel burn gains 0.055 s a lap.
const stint = (laps: number, wear = 0.08) =>
  Array.from({ length: laps }, (_, i) => {
    const number = i + 2;
    const age = i + 1;
    return lap({ lap: number, tyreAge: age, time: 90 + wear * age + FUEL_EFFECT * (30 - number) });
  }).concat(lap({ lap: 30, time: 90, tyreAge: laps + 1, stint: null }));

test("fuel correction takes the weight of the fuel still on board off each lap", () => {
  expect(fuelCorrected(91, 10, 30)).toBeCloseTo(91 - 0.055 * 20, 10);
  expect(fuelCorrected(91, 10, 30, false)).toBe(91);
});

test("the slope of fuel-corrected time against tyre age is the wear", () => {
  const [wear] = stintWear(stint(20));
  expect(wear.wear).toBeCloseTo(0.08, 4);
  expect(wear.cleanLaps).toBe(20);
});

test("without fuel correction the fuel burn hides part of the wear", () => {
  const [wear] = stintWear(stint(20), false);
  expect(wear.wear).toBeCloseTo(0.08 - FUEL_EFFECT, 4);
});

test("a stint with too few clean laps gets no wear figure", () => {
  const [wear] = stintWear(stint(MIN_STINT_LAPS - 1));
  expect(wear.wear).toBeNull();
});

test("pit laps, neutralised laps and laps over 7% off the fastest are left out of the fit", () => {
  const laps = stint(20);
  laps[3] = { ...laps[3], time: 120 }; // traffic or an incident
  laps[5] = { ...laps[5], accurate: false, pitIn: true };
  const [wear] = stintWear(laps);
  expect(wear.cleanLaps).toBe(18);
  expect(wear.wear).toBeCloseTo(0.08, 4);
});
