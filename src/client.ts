import {
  activeIntervalMs,
  HEARTBEAT_MS,
  resolveVisitSession,
  type EngagementSnapshot,
  type DeliveryHealth,
  type VisitSession,
} from "./index";
export type ProductAnalyticsOptions = {
  /** Opaque account key namespaces sessions. Never sent as trusted identity. */
  identity: string;
  endpoint: string;
  /** Return an allowlisted area, never a raw URL or document title. */
  getArea: () => string | null;
};
/** Start only after consent; call stop on revocation/account change. SSR safe.
 * Visits are per browser tab. Only the focused tab accrues active time.
 * Transport is best-effort; repeated cumulative snapshots heal dropped pulses. */
export const startProductAnalytics = (
  options: ProductAnalyticsOptions,
): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const key = `absolute-product-session:${options.identity}`;
  let previous: VisitSession | null = null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (
      parsed &&
      typeof parsed.id === "string" &&
      Number.isFinite(parsed.lastActivity) &&
      Number.isFinite(parsed.startedAt)
    )
      previous = parsed;
  } catch {
    /* Storage is optional. */
  }
  let session = previous;
  let snapshot: EngagementSnapshot | null = null;
  let path = "";
  let day = "";
  let lastTick = Date.now();
  let lastInteraction = lastTick;
  let focused = document.visibilityState === "visible" && document.hasFocus();
  let stopped = false;
  let acknowledged = "";
  const delivery: DeliveryHealth = {
    id: crypto.randomUUID(),
    attempted: 0,
    failed: 0,
  };
  const transmit = () => {
    if (!snapshot || stopped) return;
    const signature = `${snapshot.id}:${snapshot.activeMs}:${delivery.failed}`;
    if (signature === acknowledged) return;
    delivery.attempted += 1;
    void fetch(options.endpoint, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...snapshot,
        consent: true, version: 1,
        delivery: { ...delivery },
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          delivery.failed += 1;
          return;
        }
        const result = await response.json().catch(() => null);
        if (result?.accepted === false) delivery.failed += 1;
        else acknowledged = signature;
      })
      .catch(() => {
        delivery.failed += 1;
      });
  };
  const tick = (send = false, activate = false) => {
    const now = Date.now();
    const activeMs = activeIntervalMs(lastTick, now, lastInteraction, focused);
    const area = options.getArea();
    const today = new Date(now).toISOString().slice(0, 10);
    if (snapshot) snapshot.activeMs += activeMs;
    if (area && focused && (activeMs > 0 || !snapshot || activate)) {
      const next = resolveVisitSession(session, now, () => crypto.randomUUID());
      const newPage = path !== location.pathname;
      if (!snapshot || next.id !== session?.id || newPage || today !== day) {
        transmit();
        snapshot = {
          id: crypto.randomUUID(),
          sessionId: next.id,
          area,
          activeMs: 0,
          pageView: newPage || !snapshot || next.id !== session?.id,
        };
        path = location.pathname;
        day = today;
      }
      session = next;
      try {
        sessionStorage.setItem(key, JSON.stringify(session));
      } catch {
        /* Optional. */
      }
    } else if (!area && snapshot) {
      transmit();
      snapshot = null;
    }
    lastTick = now;
    if (send) transmit();
  };
  const interaction = () => {
    tick();
    lastInteraction = Date.now();
    tick(false, true);
  };
  const visibility = () => {
    tick(true);
    focused = document.visibilityState === "visible" && document.hasFocus();
    if (focused) {
      lastInteraction = Date.now();
      tick(true, true);
    }
  };
  const flush = () => tick(true);
  const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
  for (const event of events)
    window.addEventListener(event, interaction, { passive: true });
  window.addEventListener("focus", visibility);
  window.addEventListener("blur", visibility);
  window.addEventListener("pagehide", flush);
  window.addEventListener("absolute:product-navigation", flush);
  document.addEventListener("visibilitychange", visibility);
  const timer = window.setInterval(flush, HEARTBEAT_MS);
  tick(true);
  return () => {
    stopped = true;
    clearInterval(timer);
    for (const event of events) window.removeEventListener(event, interaction);
    window.removeEventListener("focus", visibility);
    window.removeEventListener("blur", visibility);
    window.removeEventListener("pagehide", flush);
    window.removeEventListener("absolute:product-navigation", flush);
    document.removeEventListener("visibilitychange", visibility);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Optional. */
    }
  };
};

export { startWorkflowTracking } from './workflows';
export type { WorkflowObservation, WorkflowTrackingOptions } from './workflows';
