const { chromium } = require("@playwright/test");
const fs = require("fs");
const http = require("http");
const assert = require("assert/strict");
(async () => {
  const events = [];
  const journeys = [];
  let rejectNext = false;
  const server = http.createServer((req, res) => {
    if (req.url === "/client.js") {
      res.setHeader("content-type", "application/javascript");
      res.end(
        fs.readFileSync(require("path").join(__dirname, "../dist/client.js")),
      );
      return;
    }
    if (req.url.startsWith("/business")) {
      res.statusCode = 500;
      res.end("failure");
      return;
    }
    if (req.url === "/journey") {
      let body = "";
      req.on("data", (part) => (body += part));
      req.on("end", () => {
        journeys.push(JSON.parse(body));
        res.end("{}");
      });
      return;
    }
    if (req.url === "/collect") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        events.push(JSON.parse(body));
        res.end(JSON.stringify({ accepted: !rejectNext }));
        rejectNext = false;
      });
      return;
    }
    res.setHeader("content-type", "text/html");
    res.end(
      '<button>Interact</button><script type="module">import {startProductAnalytics,startWorkflowTracking} from "/client.js";window.start=()=>window.stop=startProductAnalytics({identity:"test",endpoint:"/collect",getArea:()=>"dashboard"});window.start();window.startWorkflows=()=>window.stopWorkflows=startWorkflowTracking({endpoint:"/journey",resolveWorkflow:(path,method)=>path==="/business"&&method==="POST"?"search":null});</script>',
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.clock.install();
    await page.goto(
      `http://127.0.0.1:${server.address().port}/portal/dashboard`,
    );
    await page.waitForFunction(() => typeof window.stop === "function");
    await page.clock.runFor(15000);
    await page.waitForTimeout(100);
    assert(
      events.some((e) => e.activeMs >= 14900 && e.activeMs <= 15100),
      JSON.stringify(events),
    );
    const first = events[0];
    await page.clock.runFor(120000);
    await page.waitForTimeout(100);
    assert(Math.max(...events.map((e) => e.activeMs)) <= 60000);
    rejectNext = true;
    await page.getByRole("button").click();
    await page.clock.runFor(15000);
    await page.waitForTimeout(100);
    await page.clock.runFor(15000);
    await page.waitForTimeout(100);
    assert(
      events.some((event) => event.delivery.failed >= 1),
      "Recovered delivery reports prior rejected snapshots",
    );
    assert(
      events.every(
        (event) => event.delivery.attempted >= event.delivery.failed,
      ),
    );
    const before = events.length;
    await page.evaluate(() => window.stop());
    await page.clock.runFor(60000);
    await page.waitForTimeout(100);
    assert.equal(events.length, before);
    await page.evaluate(() => window.start());
    await page.waitForTimeout(100);
    assert.notEqual(events.at(-1).sessionId, first.sessionId);
    await page.evaluate(async () => {
      window.originalFetch = window.fetch;
      window.startWorkflows();
      const response = await fetch("/business?secret=never-store", {
        method: "POST",
        body: "private",
      });
      if (response.status !== 500) throw new Error("Response changed");
    });
    await page.waitForTimeout(100);
    assert.equal(journeys.length, 1);
    assert.equal(journeys[0].failed, true);
    assert.equal(journeys[0].workflow, "search");
    assert(!JSON.stringify(journeys).includes("secret"));
    assert(!JSON.stringify(journeys).includes("private"));
    await page.evaluate(async () => {
      window.stopWorkflows();
      if (window.fetch !== window.originalFetch)
        throw new Error("Fetch not restored");
      await fetch("/business", { method: "POST" });
    });
    await page.waitForTimeout(100);
    assert.equal(journeys.length, 1);
    console.log(
      "Browser checks passed: workflow failure, no payload/URL capture, fetch restoration; foreground time, idle cutoff, consent stop, session reset.",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
