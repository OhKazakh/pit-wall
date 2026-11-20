import type { CompactSession, SessionInfo } from "../data/session";
import { fuelCorrected, type StintWear, representative, stintWear } from "./degradation";
import { type Finding, stopFindings, wearFindings } from "./findings";
import { finishingOrder, gapsToLeader, type Gap } from "./gaps";
import { isRace, lapTable, type LapRecord, totalLaps } from "./laps";
import { pitStops, reviewStops, type StopReview } from "./pits";
import { isNeutralised } from "./status";
import { median, round } from "./stats";

export interface DriverSummary {
  driver: string;
  name: string;
  team: string;
  colour: string;
  position: number | null;
  laps: number;
  bestLap: number | null;
  stops: number;
}

export interface Debrief {
  session: SessionInfo;
  totalLaps: number;
  neutralisedLaps: number;
  drivers: DriverSummary[];
  lapTimes: { driver: string; lap: number; time: number }[];
  stints: StintWear[];
  stops: StopReview[];
  gaps: Gap[];
  findings: Finding[];
}

export function buildDebrief(session: CompactSession): Debrief {
  const laps = lapTable(session);
  const race = isRace(session.info.type);
  const order = race ? finishingOrder(laps) : [];
  const stints = stintWear(laps, race);
  const stops = race ? reviewStops(pitStops(session)) : [];
  const leaderLaps = new Set(laps.filter((l) => isNeutralised(l.status)).map((l) => l.lap));
  const best = (driver: string) => {
    const times = laps.filter((l) => l.driver === driver && l.accurate).map((l) => l.time as number);
    return times.length ? Math.min(...times) : null;
  };
  const drivers = session.drivers
    .map((d) => ({
      driver: d.code,
      name: d.name,
      team: d.team,
      colour: d.colour,
      position: order.includes(d.code) ? order.indexOf(d.code) + 1 : null,
      laps: laps.filter((l) => l.car === d.number && l.end !== null).length,
      bestLap: best(d.code),
      stops: stops.filter((s) => s.car === d.number).length,
    }))
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || (a.bestLap ?? 1e9) - (b.bestLap ?? 1e9));
  return {
    session: session.info,
    totalLaps: totalLaps(laps),
    neutralisedLaps: leaderLaps.size,
    drivers,
    lapTimes: representative(laps).map((l) => ({ driver: l.driver, lap: l.lap, time: l.time as number })),
    stints,
    stops,
    gaps: race ? gapsToLeader(laps) : [],
    findings: [...stopFindings(stops), ...wearFindings(stints)].sort((a, b) => a.lap - b.lap),
  };
}

export interface StintDetail {
  stint: StintWear;
  compoundMedianWear: number | null;
  fieldPace: number | null; // median fuel-corrected lap of the others on the same compound, same laps
  laps: { lap: number; time: number | null; tyreAge: number | null; clean: boolean; note: string }[];
  gapAtStart: number | null;
  gapAtEnd: number | null;
  positionAtStart: number | null;
  positionAtEnd: number | null;
}

// Everything about one stint that explains where time went, for the race engineer.
export function stintDetail(session: CompactSession, driver: string, stintNumber: number): StintDetail | null {
  const laps = lapTable(session);
  const race = isRace(session.info.type);
  const stints = stintWear(laps, race);
  const stint = stints.find((s) => s.driver === driver && s.stint === stintNumber);
  if (!stint) return null;
  const clean = new Set(representative(laps));
  const own = laps.filter((l) => l.driver === driver && l.stint === stintNumber);
  const sameCompound = stints.filter((s) => s.compound === stint.compound && s.wear !== null).map((s) => s.wear as number);
  const others = laps.filter(
    (l) => l.driver !== driver && l.compound === stint.compound && clean.has(l) && l.lap >= stint.firstLap && l.lap <= stint.lastLap,
  );
  const raceLaps = totalLaps(laps);
  const fieldPace = median(others.map((l) => fuelCorrected(l.time as number, l.lap, raceLaps, race)));
  const gaps = race ? gapsToLeader(laps).filter((g) => g.driver === driver) : [];
  const at = (lap: number) => gaps.find((g) => g.lap === lap);
  const note = (l: LapRecord) =>
    l.pitIn ? "in-lap" : l.pitOut ? "out-lap" : isNeutralised(l.status) ? "safety car or VSC" : !l.accurate ? "not timed cleanly" : clean.has(l) ? "" : "more than 7% off the fastest lap";
  return {
    stint,
    compoundMedianWear: median(sameCompound),
    fieldPace: fieldPace === null ? null : round(fieldPace),
    laps: own.map((l) => ({ lap: l.lap, time: l.time, tyreAge: l.tyreAge, clean: clean.has(l), note: note(l) })),
    gapAtStart: at(stint.firstLap)?.gap ?? null,
    gapAtEnd: at(stint.lastLap)?.gap ?? null,
    positionAtStart: at(stint.firstLap)?.position ?? null,
    positionAtEnd: at(stint.lastLap)?.position ?? null,
  };
}
