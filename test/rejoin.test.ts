import { expect, test } from "vitest";
import { lapTable } from "../src/calc/laps";
import { rejoin, stopLosses, typicalLoss } from "../src/calc/rejoin";
import { lap } from "./helpers";
import { monza } from "./monza";

test("Monza 2025: a green-flag stop cost 24.7 s, the median of 19 stops", () => {
  const losses = stopLosses(lapTable(monza()));
  expect(typicalLoss(losses, false)).toEqual({ seconds: 24.7, stops: 19 });
  // STR's slow stop and OCO's served penalty are in the list but don't move the median.
  expect(losses.find((l) => l.driver === "STR")?.loss).toBe(38.8);
});

test("Monza 2025: pitting NOR on lap 46 puts him third, as it did", () => {
  const r = rejoin(lapTable(monza()), "NOR", 46);
  expect(r).toMatchObject({
    positionBefore: 1,
    projectedPosition: 3,
    carAhead: { driver: "PIA", gap: 3.1 },
    carBehind: { driver: "LEC", gap: 1.1 },
    actual: { pittedThisLap: true, loss: 26.7, positionAfter: 3 },
  });
});

test("a lap the driver never finished has no rejoin", () => {
  expect(rejoin(lapTable(monza()), "NOR", 99)).toBeNull();
});

test("a stop's loss is in-lap plus out-lap less two laps at the car's pace before it", () => {
  const before = [1, 2, 3, 4, 5].map((n) => lap({ lap: n, time: 90, start: (n - 1) * 90_000, end: n * 90_000 }));
  const inLap = lap({ lap: 6, time: 100, pitIn: true, accurate: false, start: 450_000, end: 550_000 });
  const outLap = lap({ lap: 7, time: 105, pitOut: true, accurate: false, start: 550_000, end: 655_000 });
  expect(stopLosses([...before, inLap, outLap])).toEqual([{ driver: "AAA", lap: 6, loss: 25, neutralised: false }]);
});
