import { expect, test } from "vitest";
import { buildDebrief, stintDetail } from "../src/calc/debrief";
import { monza } from "./monza";

test("Monza 2025: the order at the flag, the race length and the findings", () => {
  const d = buildDebrief(monza());
  expect(d.totalLaps).toBe(53);
  expect(d.drivers.slice(0, 3).map((x) => x.driver)).toEqual(["VER", "NOR", "PIA"]);
  expect(d.findings.map((f) => f.id)).toEqual(["wear-COL-2", "stop-NOR-46", "stop-STR-49"]);
  // A whole debrief must fit in one Forge storage value (240 KiB).
  expect(JSON.stringify(d).length).toBeLessThan(240 * 1024);
});

test("Monza 2025: a stint's detail has its laps, wear and gap to the leader", () => {
  const detail = stintDetail(monza(), "NOR", 1);
  expect(detail?.stint).toMatchObject({ compound: "MEDIUM", firstLap: 1, lastLap: 46 });
  expect(detail?.laps).toHaveLength(46);
  expect(detail?.laps[0].note).toBe("not timed cleanly"); // the opening lap
  expect(detail?.gapAtEnd).not.toBeNull();
});
