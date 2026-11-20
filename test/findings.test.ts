import { expect, test } from "vitest";
import type { StintWear } from "../src/calc/degradation";
import { WEAR_MARGIN, wearFindings } from "../src/calc/findings";

const stint = (driver: string, wear: number | null, compound = "HARD"): StintWear => ({
  car: 1,
  driver,
  team: "Team",
  stint: 1,
  compound,
  firstLap: 2,
  lastLap: 25,
  laps: 24,
  cleanLaps: 20,
  tyreAgeAtStart: 0,
  pace: 90,
  wear,
});

test("a stint is flagged when it wears 0.05 s per lap more than the compound median and half again", () => {
  const stints = [stint("AAA", 0.03), stint("BBB", 0.04), stint("CCC", 0.05), stint("DDD", 0.1)];
  const found = wearFindings(stints);
  expect(found.map((f) => f.driver)).toEqual(["DDD"]);
  expect(found[0].numbers).toMatchObject({ wear: 0.1, compoundMedian: 0.045, excess: 0.055 });
});

test("0.05 s over is not enough when that is less than half again the median", () => {
  // Median 0.12: 0.17 is 0.05 over but only 42% more, short of the 50% needed.
  const stints = [stint("AAA", 0.11), stint("BBB", 0.12), stint("CCC", 0.13), stint("DDD", 0.12 + WEAR_MARGIN)];
  expect(wearFindings(stints)).toEqual([]);
});

test("compounds are compared only with themselves, and need three stints", () => {
  const stints = [stint("AAA", 0.02, "SOFT"), stint("BBB", 0.2, "SOFT"), stint("CCC", 0.03), stint("DDD", 0.03), stint("EEE", 0.04)];
  expect(wearFindings(stints)).toEqual([]);
});
