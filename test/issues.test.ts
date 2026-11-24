import { expect, test } from "vitest";
import { numberLines } from "../src/jira/issues";

test("an issue lists a stop's numbers in reading order, rounded like the page", () => {
  const lines = numberLines({ delta: 3.0, lane: 27.498, lap: 46, measure: "stationary", median: 2.9, comparedWith: "session", value: 5.9 });
  expect(lines).toEqual([
    "Lap: 46",
    "Measured: stationary time",
    "Time (s): 5.9",
    "Median it is compared with (s): 2.9",
    "Compared with: the session median",
    "Slower by (s): 3.0",
    "Pit lane time (s): 27.5",
  ]);
});
