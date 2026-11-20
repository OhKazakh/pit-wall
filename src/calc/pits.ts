import type { CompactSession } from "../data/session";
import { median, round } from "./stats";

// A stop this much slower than the median it is compared with is worth a look.
export const SLOW_STOP_S = 1.5;
// A team's own median needs a few stops to mean anything; below that the session's is used.
export const MIN_TEAM_STOPS = 3;
// Pit lane visits this long are red-flag stops or repairs, not pit stops.
export const LONGEST_LANE_S = 60;
// Stewards announce a time penalty served at a stop a few minutes after the car leaves (168 s for
// Ocon at Monza in 2025). Nobody stops twice inside the window, so it can be generous.
const PENALTY_WINDOW_MS = 300_000;
const SERVED = /PENALTY SERVED - (\d+) SECOND TIME PENALTY FOR CAR (\d+)/i;

export interface PitStop {
  car: number;
  driver: string;
  team: string;
  lap: number;
  stationary: number | null; // s, the car standing still, less any time penalty served
  lane: number | null; // s, entry to exit
  penalty: number; // s of time penalty served during the stop
}

export interface StopReview extends PitStop {
  measure: "stationary" | "lane";
  value: number;
  median: number;
  comparedWith: "team" | "session";
  delta: number;
  slow: boolean;
}

export function pitStops(session: CompactSession): PitStop[] {
  const drivers = new Map(session.drivers.map((d) => [d.number, d]));
  const served = session.messages.flatMap(([at, , , , message]) => {
    const match = SERVED.exec(message);
    return match ? [{ at, seconds: Number(match[1]), car: Number(match[2]) }] : [];
  });
  return session.pits
    .map(([car, lap, exit, lane, stationary]) => {
      const penalty =
        served.find((p) => p.car === car && p.at >= exit - (lane ?? 0) * 1000 && p.at <= exit + PENALTY_WINDOW_MS)
          ?.seconds ?? 0;
      return {
        car,
        driver: drivers.get(car)?.code ?? String(car),
        team: drivers.get(car)?.team ?? "Unknown",
        lap,
        stationary: stationary === null ? null : Math.max(0, round(stationary - penalty, 1)),
        lane,
        penalty,
      };
    })
    .filter((s) => s.lane === null || s.lane <= LONGEST_LANE_S)
    .sort((a, b) => a.lap - b.lap || a.car - b.car);
}

// Each stop against its team's median, or the session's when the team stopped too rarely.
// Stationary time is used where OpenF1 has it, since that is the crew's part of the stop.
export function reviewStops(stops: PitStop[]): StopReview[] {
  const measure: "stationary" | "lane" = stops.some((s) => s.stationary !== null) ? "stationary" : "lane";
  const value = (s: PitStop) => (measure === "stationary" ? s.stationary : s.lane);
  const timed = stops.filter((s) => value(s) !== null);
  const sessionMedian = median(timed.map((s) => value(s) as number));
  if (sessionMedian === null) return [];
  return timed.map((s) => {
    const team = timed.filter((t) => t.team === s.team).map((t) => value(t) as number);
    const own = team.length >= MIN_TEAM_STOPS;
    const base = own ? (median(team) as number) : sessionMedian;
    const v = value(s) as number;
    return {
      ...s,
      measure,
      value: v,
      median: round(base),
      comparedWith: own ? "team" : "session",
      delta: round(v - base),
      slow: v - base >= SLOW_STOP_S,
    };
  });
}
