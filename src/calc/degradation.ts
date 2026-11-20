import { type LapRecord, totalLaps } from "./laps";
import { linearFit, median, round } from "./stats";

// A car gets lighter as it burns fuel. 0.055 s per lap of fuel left on board is the usual
// public estimate; teams know their own number.
export const FUEL_EFFECT = 0.055;
// Laps more than 7% off the session's fastest are traffic, incidents or cool-down laps.
export const PACE_LIMIT = 1.07;
// A straight line through fewer laps says more about noise than about the tyre.
export const MIN_STINT_LAPS = 8;

export interface StintWear {
  car: number;
  driver: string;
  team: string;
  stint: number;
  compound: string;
  firstLap: number;
  lastLap: number;
  laps: number;
  cleanLaps: number;
  tyreAgeAtStart: number;
  pace: number | null; // median fuel-corrected lap time, s
  wear: number | null; // seconds lost per lap of tyre age
}

export const fuelCorrected = (time: number, lap: number, raceLaps: number, fuel = true) =>
  fuel ? time - FUEL_EFFECT * (raceLaps - lap) : time;

// Accurate laps within 7% of the session's fastest.
export function representative(laps: LapRecord[]): LapRecord[] {
  const accurate = laps.filter((l) => l.accurate && l.time !== null);
  if (!accurate.length) return [];
  const fastest = Math.min(...accurate.map((l) => l.time as number));
  return accurate.filter((l) => (l.time as number) <= fastest * PACE_LIMIT);
}

// Each stint's wear: the slope of fuel-corrected lap time against tyre age.
export function stintWear(laps: LapRecord[], fuel = true): StintWear[] {
  const raceLaps = totalLaps(laps);
  const clean = new Set(representative(laps));
  const stints = new Map<string, LapRecord[]>();
  for (const lap of laps) {
    if (lap.stint === null) continue;
    const key = `${lap.car}:${lap.stint}`;
    stints.set(key, [...(stints.get(key) ?? []), lap]);
  }
  const out: StintWear[] = [];
  for (const stint of stints.values()) {
    const first = stint[0];
    const good = stint.filter((l) => clean.has(l) && l.tyreAge !== null);
    const ages = good.map((l) => l.tyreAge as number);
    const times = good.map((l) => fuelCorrected(l.time as number, l.lap, raceLaps, fuel));
    const fit = good.length >= MIN_STINT_LAPS ? linearFit(ages, times) : null;
    const pace = median(times);
    out.push({
      car: first.car,
      driver: first.driver,
      team: first.team,
      stint: first.stint as number,
      compound: first.compound ?? "UNKNOWN",
      firstLap: stint[0].lap,
      lastLap: stint[stint.length - 1].lap,
      laps: stint.length,
      cleanLaps: good.length,
      tyreAgeAtStart: (first.tyreAge ?? 1) - 1,
      pace: pace === null ? null : round(pace),
      wear: fit ? round(fit.slope, 4) : null,
    });
  }
  return out.sort((a, b) => a.car - b.car || a.stint - b.stint);
}
