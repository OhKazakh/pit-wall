import { expect, test } from "vitest";
import { type PitStop, SLOW_STOP_S, pitStops, reviewStops } from "../src/calc/pits";
import { monza } from "./monza";

const stop = (team: string, stationary: number | null, lap = 20, lane: number | null = 22): PitStop => ({
  car: 1,
  driver: team.slice(0, 3).toUpperCase(),
  team,
  lap,
  stationary,
  lane,
  penalty: 0,
});

test("a team with three stops is measured against its own median", () => {
  const reviews = reviewStops([stop("A", 2.2), stop("A", 2.4), stop("A", 4.0), stop("B", 2.0)]);
  const slow = reviews.find((r) => r.value === 4.0);
  expect(slow?.comparedWith).toBe("team");
  expect(slow?.median).toBe(2.4);
  expect(slow?.delta).toBeCloseTo(1.6, 6);
  expect(slow?.slow).toBe(true);
});

test("a team with fewer stops falls back to the session median", () => {
  const reviews = reviewStops([stop("A", 2.0), stop("A", 2.2), stop("B", 2.4), stop("B", 3.7)]);
  const b = reviews.find((r) => r.value === 3.7);
  expect(b?.comparedWith).toBe("session");
  expect(b?.median).toBe(2.3);
  expect(b?.delta).toBeCloseTo(1.4, 6);
  expect(b?.slow).toBe(false);
});

test("exactly 1.5 s over the median counts as slow", () => {
  const reviews = reviewStops([stop("A", 2.0), stop("B", 2.0), stop("C", 2.0), stop("D", 2.0 + SLOW_STOP_S)]);
  expect(reviews.filter((r) => r.slow).map((r) => r.value)).toEqual([3.5]);
});

test("pit lane time is used when no stop has a stationary time", () => {
  const reviews = reviewStops([stop("A", null, 10, 21), stop("B", null, 11, 22), stop("C", null, 12, 25)]);
  expect(reviews.every((r) => r.measure === "lane")).toBe(true);
  expect(reviews.find((r) => r.value === 25)?.delta).toBe(3);
});

test("Monza 2025: Norris's 5.9 s stop is flagged, and Ocon's served penalty is taken out", () => {
  const stops = pitStops(monza());
  const reviews = reviewStops(stops);
  const norris = reviews.find((r) => r.driver === "NOR");
  expect(norris).toMatchObject({ lap: 46, value: 5.9, slow: true, comparedWith: "session" });
  const ocon = reviews.find((r) => r.driver === "OCO");
  expect(ocon).toMatchObject({ lap: 51, penalty: 5, value: 3.6, slow: false });
});
