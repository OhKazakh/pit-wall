import { expect, test } from "vitest";
import { linearFit, median } from "../src/calc/stats";

test("median of odd and even counts", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 3, 2])).toBe(2.5);
  expect(median([])).toBeNull();
});

test("a straight line is fitted exactly", () => {
  const fit = linearFit([1, 2, 3, 4], [10.5, 10.7, 10.9, 11.1]);
  expect(fit?.slope).toBeCloseTo(0.2, 10);
  expect(fit?.intercept).toBeCloseTo(10.3, 10);
});

test("no line through one point or a vertical stack", () => {
  expect(linearFit([1], [1])).toBeNull();
  expect(linearFit([2, 2, 2], [1, 2, 3])).toBeNull();
});
