const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
export type ReportCadence = "off" | "daily" | "weekly";
/** Strictly next 09:00 UTC slot; weekly reports run Monday. Missed slots coalesce. */
export const nextSummaryAt = (
  after: number,
  cadence: ReportCadence,
): Date | null => {
  if (cadence === "off") return null;
  if (!Number.isFinite(after)) throw new Error("Invalid schedule time");
  const next = new Date(after);
  next.setUTCHours(9, 0, 0, 0);
  if (next.getTime() <= after) next.setUTCDate(next.getUTCDate() + 1);
  if (cadence === "weekly")
    next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % WEEK_DAYS));
  return next;
};
export type AccountHealthEvidence = {
  comparable: boolean;
  currentDays: number;
  previousDays: number;
  consent: boolean | null;
  signupAt: string | null;
  activated: boolean;
  asOf: number;
};
/** Explainable observed-activity labels, not a churn probability or customer score. */
export const accountHealth = (evidence: AccountHealthEvidence) => {
  if (!evidence.comparable || evidence.consent !== true)
    return {
      status: "unknown",
      reason: "Incomplete tracking coverage or analytics consent.",
    };
  if (
    evidence.signupAt &&
    !evidence.activated &&
    evidence.asOf - Date.parse(evidence.signupAt) >= WEEK_DAYS * DAY_MS
  )
    return {
      status: "stuck",
      reason: "Signup at least 7 days ago, with no recorded deal room.",
    };
  if (evidence.previousDays >= 2 && evidence.currentDays === 0)
    return {
      status: "inactive",
      reason:
        "Previously active on at least 2 days; no observed activity this period.",
    };
  if (
    evidence.previousDays >= 2 &&
    evidence.currentDays <= evidence.previousDays / 2
  )
    return {
      status: "declining",
      reason:
        "Observed active days fell by at least half, from at least 2 days.",
    };
  if (evidence.currentDays >= evidence.previousDays + 2)
    return {
      status: "growing",
      reason: "Observed activity increased by at least 2 days.",
    };
  if (!evidence.currentDays && !evidence.previousDays)
    return {
      status: "unknown",
      reason: "No observed browser activity in either period.",
    };
  return {
    status: "steady",
    reason: "No material change in observed active days.",
  };
};
export type TrackingSignalInput = {
  covered: boolean;
  recentConsentedLogins: number;
  lastActivity: string | null;
  asOf: number;
  staleHours: number;
  attempts: number;
  failures: number;
  minimumAttempts: number;
  failurePercent: number;
  expected: readonly { event: string; previous: number; current: number }[];
};
export const trackingSignals = (input: TrackingSignalInput) => {
  const signals: { key: string; message: string }[] = [];
  if (!input.covered) return signals;
  if (
    input.recentConsentedLogins > 0 &&
    (!input.lastActivity ||
      input.asOf - Date.parse(input.lastActivity) >=
        input.staleHours * 3_600_000)
  )
    signals.push({
      key: "collection-stale",
      message: `Consenting accounts signed in, but no browser activity was observed within ${input.staleHours} hours.`,
    });
  if (
    input.attempts >= input.minimumAttempts &&
    (input.failures / input.attempts) * 100 >= input.failurePercent
  )
    signals.push({
      key: "delivery-failures",
      message: `${input.failures} failures reported in ${input.attempts} cumulative attempts from documents reporting in the last 24 hours.`,
    });
  if (input.recentConsentedLogins > 0)
    for (const event of input.expected) {
      if (event.previous >= 5 && event.current === 0)
        signals.push({
          key: `missing:${event.event}`,
          message: `${event.event}: no receipts in 24 hours after ${event.previous} in the preceding 7 days, despite recent consenting sign-ins.`,
        });
    }
  return signals;
};
