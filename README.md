# AbsoluteJS product analytics

First-party browser engagement collection. This package is separate from `@absolutejs/analytics`, whose aggregate contracts intentionally exclude identities. Hosts own authenticated ingestion, database storage, authorization, retention and erasure.

```ts
import { startProductAnalytics } from '@absolutejs/product-analytics/client';
const stop = startProductAnalytics({
  identity: account.id,
  endpoint: '/product-analytics/engagement',
  getArea: () => 'dashboard', // use an allowlist, not raw URLs
});
// Start only after analytics consent. Stop on revocation or identity changes.
stop();
```

The collector sends cumulative `EngagementSnapshot` values with a random segment ID. A host must authenticate every request, derive the user from the server session, validate areas and sizes, enforce same-origin ingestion, and update duration with MAX instead of SUM. Neither the opaque browser identity nor the session ID is an authorization credential. No personal profile data, DOM content, titles, query parameters, IP addresses or authentication tokens are included.

Sessions are per browser tab, preserved over reload/navigation in sessionStorage, expire after 30 minutes without activity, and have a 24-hour maximum. A copied tab can inherit sessionStorage; session counts are approximate and are not concurrent-user counts. Engagement accrues only while visible and focused and for up to 60 seconds after interaction. Samples run every 15 seconds, flush on focus/visibility/pagehide, and cap suspended timer gaps. UTC midnight starts a fresh segment without an extra page view. Transports are best-effort: subsequent cumulative snapshots recover dropped pulses within the same segment; a final unload delivery may be lost. SPA hosts should dispatch `absolute:product-navigation` after successful navigation for immediate page tracking; pathname polling is a fallback.

`stop()` discards pending time and session state rather than sending after consent revocation. A restored page must initialize a fresh collector. Server-side authentication events are a separate source: never infer logins from page views or token refreshes. The host should exclude impersonation and anonymous authentication sessions.

Exports from the root include the snapshot/session contracts, interval accounting, session expiration and server cumulative-duration bounds. The browser entry has no dependencies. Build with Bun and TypeScript; test with `bun test`.

Version 0.2 adds `DeliveryHealth` (per-document cumulative attempted/failed counts), `comparePeriods`, `funnelSteps` and `retentionCell`. Delivery counters are included in each snapshot; persist their MAX per document/account. Non-2xx and `{accepted:false}` responses count as failures, visible after a later successful delivery. Permanently offline clients remain unobservable. Hosts should return JSON `{accepted:true}` after ingestion.

`comparePeriods(current, previous, comparable)` suppresses deltas without complete coverage and suppresses percentage change for a zero baseline. `funnelSteps(labels, orderedCounts)` requires non-increasing nonnegative integer counts. `retentionCell(cohortDay, offsetDays, asOfMs, cohortSize, returned)` waits until the entire UTC return day ends; immature cells have null returns/percent and zero eligible accounts. Hosts own ordered-event queries, cohort definitions and retained-history coverage. These pure helpers do not collect business payloads or assume an application's event taxonomy.

Version 0.3 adds `nextSummaryAt(afterMs, cadence)` for strictly-next daily/weekly 09:00 UTC report slots (weekly Monday), `accountHealth(evidence)` for explicit observed-activity classifications, and `trackingSignals(evidence)` for sample/coverage-gated missing-collection, delivery-failure and missing-action signals. These are pure rules: the package does not deliver email or push, retain reports, authorize recipients or run a scheduler. Hosts must recheck permissions at execution, persist/deduplicate slots, expose failures, and distinguish observations from customer/churn predictions. Unknown consent or incomplete comparison coverage suppresses account-health conclusions.

Version 0.4 adds `startWorkflowTracking({endpoint, resolveWorkflow})` from the browser entry. This optional, consent-scoped fetch observer reports only host-allowlisted same-origin requests, random receipt IDs, workflow labels, failure flags and duration to response headers. It does not inspect bodies or transmit URLs. Aborts are excluded; `stop()` suppresses pending receipts and restores fetch when it still owns the wrapper. Transport is best effort. The host must validate category/duration, authenticate the user, reject impersonation and declined consent, and distinguish HTTP observations from successful business outcomes. Header latency does not measure a streaming response's completion.

Version 0.5 adds `defineTrackingCatalog`, `validateTrackingEvent`, and `trackingCoverage`. Definitions describe versioned, bounded events with source, ownership, meaning, consent and retention. Validation returns a fixed rejection category without echoing submitted data. Hosts enforce authentication and authorization separately. Missing observations only imply missing collection when the host explicitly marks collection as expected. Existing records without a version are version 1; collectors now declare version 1 explicitly.

Version 0.6 adds `experimentVariant`, `conversionInterval`, and `experimentEvidence`. SHA-256 assignment is stable for an experiment/account pair and divides accounts 50/50. Wilson 95% conversion intervals, minimum mature samples of 100 per arm, and a 1% chi-squared allocation imbalance check provide conservative descriptive evidence. These are not sequential testing or sample-size planning. Hosts must freeze definitions, predeclare duration and outcome windows, record actual exposure, assess guardrails, exclude unfinished windows, and require human interpretation. The package neither publishes variants nor enrolls users. Dealroom's opt-in integration uses in-app help cards and never sends email or push.
