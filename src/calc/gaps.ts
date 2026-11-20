import type { LapRecord } from "./laps";
import { round } from "./stats";

export interface Gap {
  driver: string;
  lap: number;
  gap: number; // s behind the first car to finish that lap
  position: number;
}

// The gap to the leader at the line: the time between the first car completing a lap and
// each car completing the same lap. Order on track, so penalties aren't applied.
export function gapsToLeader(laps: LapRecord[]): Gap[] {
  const byLap = new Map<number, LapRecord[]>();
  for (const lap of laps) {
    if (lap.end === null) continue;
    byLap.set(lap.lap, [...(byLap.get(lap.lap) ?? []), lap]);
  }
  const gaps: Gap[] = [];
  for (const [lap, done] of byLap) {
    const order = [...done].sort((a, b) => (a.end as number) - (b.end as number));
    const leader = order[0].end as number;
    order.forEach((l, i) => {
      gaps.push({ driver: l.driver, lap, gap: round(((l.end as number) - leader) / 1000, 1), position: i + 1 });
    });
  }
  return gaps.sort((a, b) => a.lap - b.lap || a.position - b.position);
}

// The order at the flag: most laps first, then whoever finished the last of them sooner.
export function finishingOrder(laps: LapRecord[]): string[] {
  const last = new Map<string, LapRecord>();
  for (const lap of laps) {
    const seen = last.get(lap.driver);
    if (lap.end !== null && (!seen || lap.lap > seen.lap)) last.set(lap.driver, lap);
  }
  return [...last.values()]
    .sort((a, b) => b.lap - a.lap || (a.end as number) - (b.end as number))
    .map((l) => l.driver);
}
