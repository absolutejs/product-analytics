import { describe, expect, test } from "bun:test";
import {
  activeIntervalMs,
  acceptedActiveMs,
  resolveVisitSession,
  SESSION_TIMEOUT_MS,
} from "../src";
describe("engagement", () => {
  test("background and idle time never count", () => {
    expect(activeIntervalMs(0, 15000, 0, false)).toBe(0);
    expect(activeIntervalMs(55000, 70000, 0, true)).toBe(5000);
    expect(activeIntervalMs(70000, 85000, 0, true)).toBe(0);
    expect(activeIntervalMs(0, 3600000, 0, true)).toBe(0);
  });
  test("retries and reordered snapshots cannot double count or reduce time", () => {
    expect(acceptedActiveMs(15000, 15000, 15000)).toBe(15000);
    expect(acceptedActiveMs(30000, 15000, 30000)).toBe(30000);
    expect(acceptedActiveMs(0, 999999, 15000)).toBe(30000);
    expect(() => acceptedActiveMs(0, NaN, 0)).toThrow();
  });
  test("return visits expire independently of authentication", () => {
    const first = resolveVisitSession(null, 0, () => "first");
    expect(resolveVisitSession(first, 100, () => "second").id).toBe("first");
    expect(
      resolveVisitSession(first, SESSION_TIMEOUT_MS, () => "second").id,
    ).toBe("second");
    expect(resolveVisitSession(first, -1, () => "second").id).toBe("second");
  });
});
