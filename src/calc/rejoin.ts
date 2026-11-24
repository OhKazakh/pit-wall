import { gapsToLeader, type Gap } from "./gaps";
import type { LapRecord } from "./laps";
import { isNeutralised } from "./status";
import { median, round } from "./stats";

// A stop's loss is measured against the car's own pace over this many laps before it.
const PACE_LAPS = 5;
// Losses outside this range are drive-throughs, repairs or timing gaps, not normal stops.
const MIN_LOSS_S = 5;
const MAX_LOSS_S = 60;

export interface StopLoss {
  driver: string;
  lap: number; // the in-lap
  loss: number; // s
  neutralised: boolean; // safety car or VSC during the in-lap or out-lap
}

// What a stop cost on track: the in-lap and the out-lap, less two laps at the car's own pace
// just before it. That covers the pit lane, the stop itself and the slower entry and exit.
export function stopLosses(laps: LapRecord[]): StopLoss[] {
  const out: StopLoss[] = [];
  for (const inLap of laps) {
    if (!inLap.pitIn || inLap.time === null) continue;
    const outLap = laps.find((l) => l.car === inLap.car && l.lap === inLap.lap + 1);
    if (!outLap?.pitOut || outLap.time === null) continue;
    const before = laps.filter(
      (l) => l.car === inLap.car && l.accurate && l.lap < inLap.lap && l.lap >= inLap.lap - PACE_LAPS,
    );
    const pace = median(before.map((l) => l.time as number));
    if (pace === null) continue;
    const loss = inLap.time + outLap.time - 2 * pace;
    if (loss < MIN_LOSS_S || loss > MAX_LOSS_S) continue;
    out.push({
      driver: inLap.driver,
      lap: inLap.lap,
      loss: round(loss, 1),
      neutralised: isNeutralised(inLap.status) || isNeutralised(outLap.status),
    });
  }
  return out;
}

export interface PitLoss {
  seconds: number;
  stops: number; // how many stops the median comes from
}

export function typicalLoss(losses: StopLoss[], neutralised: boolean): PitLoss | null {
  const picked = losses.filter((l) => l.neutralised === neutralised).map((l) => l.loss);
  const m = median(picked);
  return m === null ? null : { seconds: round(m, 1), stops: picked.length };
}

export interface Rejoin {
  driver: string;
  lap: number;
  underSafetyCarOrVsc: boolean;
  pitLoss: PitLoss;
  positionBefore: number;
  gapToLeaderBefore: number;
  projectedPosition: number;
  projectedGapToLeader: number;
  carAhead: { driver: string; gap: number } | null; // gap: s the driver would be behind it
  carBehind: { driver: string; gap: number } | null; // gap: s it would be behind the driver
  actual: { pittedThisLap: true; loss: number | null; positionAfter: number | null } | null;
}

// Where a car would have come out had it pitted at the end of `lap`: its gap to the leader
// plus the session's typical pit loss, among everyone else's gaps on that lap. It assumes the
// others keep their gaps for the lap it takes, which is the usual pit-window estimate.
export function rejoin(laps: LapRecord[], driver: string, lap: number): Rejoin | null {
  const gaps = gapsToLeader(laps);
  const onLap = gaps.filter((g) => g.lap === lap);
  const own = onLap.find((g) => g.driver === driver);
  if (!own) return null;

  const losses = stopLosses(laps);
  const thisLap = laps.find((l) => l.driver === driver && l.lap === lap);
  const nextLap = laps.find((l) => l.driver === driver && l.lap === lap + 1);
  const neutralised = Boolean(
    (thisLap && isNeutralised(thisLap.status)) || (nextLap && isNeutralised(nextLap.status)),
  );
  // Under a safety car a stop costs less; with no neutralised stop to measure, use the green one.
  const pitLoss = typicalLoss(losses, neutralised) ?? typicalLoss(losses, !neutralised);
  if (!pitLoss) return null;

  const projected = round(own.gap + pitLoss.seconds, 1);
  const others = onLap.filter((g) => g.driver !== driver).sort((a, b) => a.gap - b.gap);
  const ahead: Gap | undefined = others.filter((g) => g.gap <= projected).at(-1);
  const behind: Gap | undefined = others.find((g) => g.gap > projected);

  const real = thisLap?.pitIn ? losses.find((l) => l.driver === driver && l.lap === lap) : undefined;
  const after = gaps.find((g) => g.driver === driver && g.lap === lap + 1);

  return {
    driver,
    lap,
    underSafetyCarOrVsc: neutralised,
    pitLoss,
    positionBefore: own.position,
    gapToLeaderBefore: own.gap,
    projectedPosition: others.filter((g) => g.gap <= projected).length + 1,
    projectedGapToLeader: projected,
    carAhead: ahead ? { driver: ahead.driver, gap: round(projected - ahead.gap, 1) } : null,
    carBehind: behind ? { driver: behind.driver, gap: round(behind.gap - projected, 1) } : null,
    actual: thisLap?.pitIn
      ? { pittedThisLap: true, loss: real?.loss ?? null, positionAfter: after?.position ?? null }
      : null,
  };
}
