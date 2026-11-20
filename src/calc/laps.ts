import type { CompactSession } from "../data/session";
import { isNeutralised, lapStatus, statusChanges } from "./status";

export interface LapRecord {
  car: number;
  driver: string;
  team: string;
  lap: number;
  time: number | null; // seconds
  start: number | null; // ms
  end: number | null; // ms
  sectors: [number | null, number | null, number | null];
  stint: number | null;
  compound: string | null;
  tyreAge: number | null;
  pitIn: boolean;
  pitOut: boolean;
  status: string;
  accurate: boolean;
}

export const isRace = (type: string) => type === "Race";

export function lapTable(session: CompactSession): LapRecord[] {
  const race = isRace(session.info.type);
  const drivers = new Map(session.drivers.map((d) => [d.number, d]));
  const changes = statusChanges(session.messages);
  const rows = [...session.laps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const laps: LapRecord[] = rows.map(([car, lap, start, duration, s1, s2, s3, outLap], i) => {
    // Outside a race, an out-lap from the garage is timed with the garage time in it.
    const time = !race && outLap ? null : duration;
    const next = rows[i + 1];
    // A lap without a time ends when the driver's next lap starts.
    const end = start !== null && time !== null ? start + time * 1000 : next && next[0] === car ? next[2] : null;
    const driver = drivers.get(car);
    return {
      car,
      driver: driver?.code ?? String(car),
      team: driver?.team ?? "Unknown",
      lap,
      time,
      start,
      end,
      sectors: [s1, s2, s3],
      stint: null,
      compound: null,
      tyreAge: null,
      pitIn: false,
      pitOut: Boolean(outLap),
      status: lapStatus(start, end, changes),
      accurate: false,
    };
  });

  for (const [car, stint, compound, first, last, age] of session.stints) {
    for (const lap of laps) {
      if (lap.car === car && lap.lap >= first && lap.lap <= last) {
        lap.stint = stint;
        lap.compound = compound;
        lap.tyreAge = age + lap.lap - first + 1;
      }
    }
  }

  // OpenF1 stamps a pit visit at the exit and gives the time since the entry. Its lap number
  // isn't always the in-lap, so each end goes on the lap that was running at that moment.
  for (const [car, , exit, lane] of session.pits) {
    const own = laps.filter((l) => l.car === car && l.start !== null);
    const running = (at: number) => own.filter((l) => (l.start as number) <= at + 1).at(-1);
    const out = running(exit);
    if (out) out.pitOut = true;
    if (lane !== null) {
      const into = running(exit - lane * 1000);
      if (into) into.pitIn = true;
    }
  }
  // Not every visit has a pit row, but an out-lap always follows an in-lap.
  for (let i = 1; i < laps.length; i++) {
    if (laps[i].pitOut && laps[i - 1].car === laps[i].car) laps[i - 1].pitIn = true;
  }

  for (const lap of laps) {
    const [s1, s2, s3] = lap.sectors;
    const sectorsAddUp = s1 !== null && s2 !== null && s3 !== null && lap.time !== null
      ? Math.abs(s1 + s2 + s3 - lap.time) < 0.1
      : false;
    // As in FastF1: no pit laps, no opening lap of a race, no neutralised laps.
    lap.accurate =
      lap.time !== null &&
      !lap.pitIn &&
      !lap.pitOut &&
      !(race && lap.lap === 1) &&
      sectorsAddUp &&
      !isNeutralised(lap.status);
  }
  return laps;
}

// The race's length in laps: the most any car completed.
export const totalLaps = (laps: LapRecord[]) => laps.reduce((most, l) => Math.max(most, l.lap), 0);
