import type { LapRecord } from "../src/calc/laps";

// A clean green-flag lap, with any field overridden.
export const lap = (over: Partial<LapRecord> = {}): LapRecord => ({
  car: 1,
  driver: "AAA",
  team: "Team A",
  lap: 2,
  time: 90,
  start: 0,
  end: 90_000,
  sectors: [30, 30, 30],
  stint: 1,
  compound: "MEDIUM",
  tyreAge: 2,
  pitIn: false,
  pitOut: false,
  status: "1",
  accurate: true,
  ...over,
});
