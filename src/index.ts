/** Auth sessions and product visits are deliberately separate concepts. */
export const SESSION_TIMEOUT_MS = 30 * 60_000;
export const IDLE_TIMEOUT_MS = 60_000;
export const HEARTBEAT_MS = 15_000;
export const MAX_SESSION_MS = 24 * 60 * 60_000;
export type EngagementSnapshot = {
  id: string;
  sessionId: string;
  area: string;
  activeMs: number;
  pageView: boolean;
};
export type VisitSession = {
  id: string;
  lastActivity: number;
  startedAt: number;
};
export const resolveVisitSession = (
  previous: VisitSession | null,
  now: number,
  newId: () => string,
): VisitSession => {
  if (
    !previous ||
    now < previous.lastActivity ||
    now - previous.lastActivity >= SESSION_TIMEOUT_MS ||
    now - previous.startedAt >= MAX_SESSION_MS
  )
    return { id: newId(), lastActivity: now, startedAt: now };
  return { ...previous, lastActivity: now };
};
/** Count only the intersection with a foreground, recently interactive interval.
 * Cap long timer gaps so sleeping devices cannot add hours of engagement. */
export const activeIntervalMs = (
  from: number,
  to: number,
  lastInteraction: number,
  focused: boolean,
): number =>
  focused
    ? Math.max(
        0,
        Math.min(to, lastInteraction + IDLE_TIMEOUT_MS) -
          Math.max(from, to - HEARTBEAT_MS * 2),
      )
    : 0;
/** Server-side bound for cumulative snapshots; MAX makes retries/reordering idempotent. */
export const acceptedActiveMs = (
  previous: number,
  incoming: number,
  elapsed: number,
): number => {
  if (![previous, incoming, elapsed].every(Number.isFinite) || incoming < 0)
    throw new Error("Invalid engagement duration");
  return Math.max(
    previous,
    Math.min(Math.floor(incoming), Math.max(0, elapsed) + HEARTBEAT_MS),
  );
};

/** Per-document cumulative delivery counters, reported only with consented data. */
export type DeliveryHealth = { id: string; attempted: number; failed: number };
export type PeriodComparison = {
  current: number;
  previous: number;
  delta: number | null;
  percent: number | null;
  comparable: boolean;
};
export const comparePeriods = (
  current: number,
  previous: number,
  comparable: boolean,
): PeriodComparison => ({
  current,
  previous,
  comparable,
  delta: comparable ? current - previous : null,
  percent:
    !comparable || previous === 0
      ? null
      : ((current - previous) / previous) * 100,
});
export type FunnelStep = {
  label: string;
  reached: number;
  dropped: number;
  conversionPercent: number | null;
};
export const funnelSteps = (
  labels: readonly string[],
  counts: readonly number[],
): FunnelStep[] => {
  if (
    labels.length !== counts.length ||
    counts.some(
      (count, index) =>
        !Number.isInteger(count) ||
        count < 0 ||
        (index > 0 && count > counts[index - 1]!),
    )
  )
    throw new Error("Invalid ordered funnel counts");
  return labels.map((label, index) => ({
    label,
    reached: counts[index]!,
    dropped: index === 0 ? 0 : counts[index - 1]! - counts[index]!,
    conversionPercent: counts[0] ? (counts[index]! / counts[0]!) * 100 : null,
  }));
};
export const retentionCell = (
  cohortDay: string,
  offset: number,
  asOf: number,
  cohortSize: number,
  returned: number,
) => {
  const end = Date.parse(`${cohortDay}T00:00:00Z`) + (offset + 1) * 86_400_000;
  if (
    !Number.isFinite(end) ||
    !Number.isFinite(asOf) ||
    !Number.isInteger(cohortSize) ||
    cohortSize < 0 ||
    !Number.isInteger(returned) ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    returned < 0 ||
    returned > cohortSize
  )
    throw new Error("Invalid retention cell");
  const mature = end <= asOf;
  return {
    day: offset,
    mature,
    returned: mature ? returned : null,
    eligible: mature ? cohortSize : 0,
    percent: mature && cohortSize > 0 ? (returned / cohortSize) * 100 : null,
  };
};

export { accountHealth, nextSummaryAt, trackingSignals } from './reporting';
export type { AccountHealthEvidence, ReportCadence, TrackingSignalInput } from './reporting';
