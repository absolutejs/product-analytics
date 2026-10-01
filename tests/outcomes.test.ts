import { expect, test } from "bun:test";
import { comparePeriods, funnelSteps, retentionCell } from "../src";
test("comparisons distinguish zero baselines from missing coverage", () => {
  expect(comparePeriods(5, 0, true)).toMatchObject({ delta: 5, percent: null });
  expect(comparePeriods(5, 10, true).percent).toBe(-50);
  expect(comparePeriods(5, 10, false)).toMatchObject({
    delta: null,
    percent: null,
  });
});
test("funnel drops use ordered denominators and reject impossible counts", () => {
  expect(funnelSteps(["signup", "value"], [10, 4])[1]).toMatchObject({
    dropped: 6,
    conversionPercent: 40,
  });
  expect(funnelSteps(["signup"], [0])[0]?.conversionPercent).toBeNull();
  expect(() => funnelSteps(["signup", "value"], [1, 2])).toThrow();
});
test("retention matures only after the full UTC return day", () => {
  const end = Date.parse("2026-09-09T00:00:00Z");
  expect(retentionCell("2026-09-01", 7, end - 1, 10, 3)).toMatchObject({
    mature: false,
    returned: null,
    eligible: 0,
  });
  expect(retentionCell("2026-09-01", 7, end, 10, 3)).toMatchObject({
    mature: true,
    returned: 3,
    eligible: 10,
    percent: 30,
  });
  expect(retentionCell("2026-09-01", 1, end, 10, 0).percent).toBe(0);
  expect(() => retentionCell("2026-09-01", 1, NaN, 10, 0)).toThrow();
  expect(() => retentionCell("2026-09-01", 1, end, 10, 11)).toThrow();
});
