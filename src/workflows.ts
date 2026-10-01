export type WorkflowObservation = {
  id: string;
  workflow: string;
  durationMs: number;
  failed: boolean;
};
export type WorkflowTrackingOptions = {
  endpoint: string;
  resolveWorkflow: (pathname: string, method: string) => string | null;
};
/** Observe same-origin fetch response headers without reading bodies or storing URLs.
 * Start only with consent. Stop restores fetch and suppresses in-flight reporting. */
export const startWorkflowTracking = (options: WorkflowTrackingOptions) => {
  if (typeof window === "undefined") return () => {};
  const original = window.fetch;
  let stopped = false;
  const tracked: typeof fetch = async (input, init) => {
    if (stopped) return original.call(window, input, init);
    let workflow: string | null = null;
    try {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        location.href,
      );
      if (url.origin === location.origin)
        workflow = options.resolveWorkflow(
          url.pathname,
          (
            init?.method ?? (input instanceof Request ? input.method : "GET")
          ).toUpperCase(),
        );
    } catch {
      /* Invalid requests retain native fetch behavior. */
    }
    const start = performance.now();
    const report = (failed: boolean) => {
      if (stopped || !workflow) return;
      const event: WorkflowObservation = {
        id: crypto.randomUUID(),
        workflow,
        durationMs: Math.min(
          180000,
          Math.max(0, Math.round(performance.now() - start)),
        ),
        failed,
      };
      void original
        .call(window, options.endpoint, {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...event, consent: true }),
        })
        .catch(() => undefined);
    };
    try {
      const response = await original.call(window, input, init);
      report(!response.ok);
      return response;
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        report(true);
      throw error;
    }
  };
  window.fetch = tracked;
  return () => {
    stopped = true;
    if (window.fetch === tracked) window.fetch = original;
  };
};
