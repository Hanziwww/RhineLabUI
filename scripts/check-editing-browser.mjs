import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const mdPath = "sites/example-notes/content/welcome.md",
  configPath = "sites/example-notes/site.json";
const originalMd = await fs.readFile(mdPath, "utf8"),
  originalConfig = await fs.readFile(configPath, "utf8");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const report = { checks: [] };
try {
  const original = await context.newPage();
  await original.goto("http://127.0.0.1:5173/?scene=archive");
  await original.waitForFunction(() => window.rhine?.stats().loaded);
  const timeOrigin = await original.evaluate(() => performance.timeOrigin);
  const example = await context.newPage();
  await example.goto("http://127.0.0.1:5175/?document=welcome");
  await example.locator("[data-tab=getting-started]").waitFor();
  await fs.writeFile(
    mdPath,
    originalMd.replace(
      "title: Welcome to your archive",
      "title: Editing without engine changes",
    ) + "\n## Editing live\n\nLive Markdown edit verified.\n",
  );
  await example.waitForFunction(
    () =>
      document
        .querySelector(".detail-title-cn")
        ?.textContent?.includes("Editing without engine changes"),
    null,
    { timeout: 20000 },
  );
  await example.locator("[data-tab=editing-live]").click();
  await example
    .getByText("Live Markdown edit verified.", { exact: true })
    .waitFor();
  report.checks.push(
    "Markdown title, new section and body update without restarting Vite",
  );
  const cfg = JSON.parse(originalConfig);
  cfg.title = "LIVE EDIT VERIFICATION";
  cfg.brand.name = "LIVE ARCHIVE";
  await fs.writeFile(configPath, JSON.stringify(cfg, null, 2));
  await example.waitForFunction(
    () => document.title === "LIVE EDIT VERIFICATION",
    null,
    { timeout: 20000 },
  );
  assert.equal(
    await example.locator(".brand h1").textContent(),
    "LIVE ARCHIVE",
  );
  report.checks.push("Site branding updates from configuration");
  assert.equal(
    await original.evaluate(() => performance.timeOrigin),
    timeOrigin,
  );
  report.checks.push(
    "Editing a third site does not reload or change the default site",
  );
  console.log(report.checks.join("\n"));
} finally {
  await fs.writeFile(mdPath, originalMd);
  await fs.writeFile(configPath, originalConfig);
  await fs.writeFile(
    "verification/template/editing-report.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
