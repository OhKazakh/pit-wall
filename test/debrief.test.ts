import { expect, test } from "vitest";
import { buildDebrief, displayName, stintDetail } from "../src/calc/debrief";
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
  expect(detail?.laps[0].note).toBe("opening lap");
  expect(detail?.gapAtEnd).not.toBeNull();
});

test("names lose OpenF1's capitals", () => {
  expect(displayName("Max VERSTAPPEN")).toBe("Max Verstappen");
  expect(displayName("Andrea Kimi ANTONELLI")).toBe("Andrea Kimi Antonelli");
  expect(buildDebrief(monza()).drivers[0].name).toBe("Max Verstappen");
});

test("Monza 2025: COL's second stint, with the comparisons done", () => {
  const detail = stintDetail(monza(), "COL", 2);
  expect(detail?.stint.wear).toBe(0.0676);
  expect(detail?.wearAboveCompoundMedian).toBe(0.0554);
  expect(detail?.paceVsField).toBe(0.367);
  // Laps 39 and 50 are slow but clean: nothing to explain them away.
  expect(detail?.laps.filter((l) => l.lap === 39 || l.lap === 50).map((l) => l.note)).toEqual(["", ""]);
});
