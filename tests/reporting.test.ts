import { expect, test } from "bun:test";
import {
  accountHealth,
  nextSummaryAt,
  trackingSignals,
  type AccountHealthEvidence,
  type TrackingSignalInput,
} from "../src";
test("schedule is strictly next UTC slot across week boundaries", () => {
  expect(
    nextSummaryAt(Date.parse("2026-10-05T08:59:59Z"), "weekly")?.toISOString(),
  ).toBe("2026-10-05T09:00:00.000Z");
  expect(
    nextSummaryAt(Date.parse("2026-10-05T09:00:00Z"), "weekly")?.toISOString(),
  ).toBe("2026-10-12T09:00:00.000Z");
  expect(
    nextSummaryAt(Date.parse("2026-10-04T10:00:00Z"), "daily")?.toISOString(),
  ).toBe("2026-10-05T09:00:00.000Z");
  expect(nextSummaryAt(Date.now(), "off")).toBeNull();
});
test("health uses evidence and does not equate missing coverage with churn", () => {
  const evidence: AccountHealthEvidence = {
    activated: true,
    asOf: Date.parse("2026-10-01"),
    comparable: true,
    consent: true,
    currentDays: 1,
    previousDays: 5,
    signupAt: null,
  };
  expect(accountHealth(evidence).status).toBe("declining");
  expect(accountHealth({ ...evidence, currentDays: 0 }).status).toBe(
    "inactive",
  );
  expect(accountHealth({ ...evidence, currentDays: 7 }).status).toBe("growing");
  expect(accountHealth({ ...evidence, comparable: false }).status).toBe(
    "unknown",
  );
  expect(accountHealth({ ...evidence, consent: false }).status).toBe("unknown");
  expect(
    accountHealth({ ...evidence, activated: false, signupAt: "2026-09-01" })
      .status,
  ).toBe("stuck");
});
test("tracking signals require coverage, traffic and meaningful sample size", () => {
  const evidence: TrackingSignalInput = {
    asOf: Date.parse("2026-10-01"),
    attempts: 20,
    covered: true,
    expected: [{ event: "asset.created", previous: 5, current: 0 }],
    failurePercent: 10,
    failures: 2,
    lastActivity: "2026-09-28",
    minimumAttempts: 20,
    recentConsentedLogins: 1,
    staleHours: 24,
  };
  expect(trackingSignals(evidence).map((signal) => signal.key)).toEqual([
    "collection-stale",
    "delivery-failures",
    "missing:asset.created",
  ]);
  expect(trackingSignals({ ...evidence, covered: false })).toEqual([]);
  expect(
    trackingSignals({ ...evidence, recentConsentedLogins: 0, attempts: 1 }),
  ).toEqual([]);
});
