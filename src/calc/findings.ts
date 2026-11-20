import type { StintWear } from "./degradation";
import type { StopReview } from "./pits";
import { median, round } from "./stats";

// A stint wears "well above" the field when it loses at least 0.05 s per lap more than the
// median stint on the same compound, and at least half again that median.
export const WEAR_MARGIN = 0.05;
export const WEAR_RATIO = 0.5;

export interface Finding {
  id: string;
  kind: "slow-stop" | "high-wear";
  driver: string;
  team: string;
  lap: number;
  title: string;
  detail: string;
  numbers: Record<string, number | string>;
}

export function compoundMedians(stints: StintWear[]): Map<string, number> {
  const medians = new Map<string, number>();
  for (const compound of new Set(stints.map((s) => s.compound))) {
    const m = median(stints.filter((s) => s.compound === compound && s.wear !== null).map((s) => s.wear as number));
    if (m !== null) medians.set(compound, m);
  }
  return medians;
}

export function wearFindings(stints: StintWear[]): Finding[] {
  const medians = compoundMedians(stints);
  const counts = new Map<string, number>();
  for (const s of stints) if (s.wear !== null) counts.set(s.compound, (counts.get(s.compound) ?? 0) + 1);
  return stints
    .filter((s) => {
      const m = medians.get(s.compound);
      // A median needs at least three stints on the compound to compare against.
      if (s.wear === null || m === undefined || (counts.get(s.compound) ?? 0) < 3) return false;
      return s.wear - m >= Math.max(WEAR_MARGIN, WEAR_RATIO * Math.abs(m));
    })
    .map((s) => {
      const m = medians.get(s.compound) as number;
      const wear = s.wear as number;
      return {
        id: `wear-${s.driver}-${s.stint}`,
        kind: "high-wear" as const,
        driver: s.driver,
        team: s.team,
        lap: s.firstLap,
        title: `${s.driver} lost ${wear.toFixed(3)} s per lap on ${s.compound.toLowerCase()}s in stint ${s.stint}`,
        detail:
          `Stint ${s.stint}, laps ${s.firstLap} to ${s.lastLap}: ${wear.toFixed(3)} s per lap of tyre age, ` +
          `against a median of ${m.toFixed(3)} s for ${s.compound.toLowerCase()} stints in this session ` +
          `(${s.cleanLaps} clean laps, fuel-corrected).`,
        numbers: {
          stint: s.stint,
          compound: s.compound,
          firstLap: s.firstLap,
          lastLap: s.lastLap,
          wear,
          compoundMedian: round(m, 4),
          excess: round(wear - m, 4),
          cleanLaps: s.cleanLaps,
        },
      };
    });
}

export function stopFindings(reviews: StopReview[]): Finding[] {
  return reviews
    .filter((r) => r.slow)
    .map((r) => {
      const what = r.measure === "stationary" ? "stationary time" : "pit lane time";
      const against = r.comparedWith === "team" ? `${r.team}'s median` : "the session median";
      return {
        id: `stop-${r.driver}-${r.lap}`,
        kind: "slow-stop" as const,
        driver: r.driver,
        team: r.team,
        lap: r.lap,
        title: `${r.driver} pit stop on lap ${r.lap} was ${r.delta.toFixed(1)} s slower than ${against}`,
        detail:
          `Lap ${r.lap}: ${r.value.toFixed(1)} s ${what}, against ${against} of ${r.median.toFixed(1)} s.` +
          (r.lane !== null && r.measure === "stationary" ? ` Pit lane time ${r.lane.toFixed(1)} s.` : "") +
          (r.penalty ? ` A ${r.penalty} s time penalty served at this stop is already taken out.` : ""),
        numbers: {
          lap: r.lap,
          measure: r.measure,
          value: r.value,
          median: r.median,
          comparedWith: r.comparedWith,
          delta: r.delta,
          ...(r.lane !== null ? { lane: r.lane } : {}),
          ...(r.penalty ? { penaltyServed: r.penalty } : {}),
        },
      };
    });
}
