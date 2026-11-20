import { expect, test } from "vitest";
import { lapStatus, statusChanges } from "../src/calc/status";
import type { MessageRow } from "../src/data/session";

const at = (s: number) => s * 1000;

test("a safety car period runs from its deployment to the track clear", () => {
  const messages: MessageRow[] = [
    [at(100), null, null, null, "SAFETY CAR DEPLOYED"],
    [at(400), "CLEAR", "Track", null, "TRACK CLEAR"],
  ];
  const changes = statusChanges(messages);
  expect(changes.map((c) => c.status)).toEqual(["4", "1"]);
  expect(lapStatus(at(50), at(150), changes)).toBe("14");
  expect(lapStatus(at(200), at(300), changes)).toBe("4");
  expect(lapStatus(at(500), at(600), changes)).toBe("1");
});

test("a VSC ends 15 s after race control says it is ending", () => {
  const messages: MessageRow[] = [
    [at(100), null, null, null, "VIRTUAL SAFETY CAR DEPLOYED"],
    [at(200), null, null, null, "VIRTUAL SAFETY CAR ENDING"],
  ];
  expect(statusChanges(messages)).toEqual([
    { at: at(100), status: "6" },
    { at: at(200), status: "7" },
    { at: at(215), status: "1" },
  ]);
});
