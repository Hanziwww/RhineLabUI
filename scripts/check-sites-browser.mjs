import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const output = "verification/template";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
const report = { errors: [], requests: [], checks: [], rendering: {} };
const check = (name) => {
  report.checks.push(name);
  console.log(name);
};
async function open(port) {
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(`${port}: ${e.message}`));
  page.on("request", (r) => {
    if (r.url().includes("/data/") || r.url().includes("/content/"))
      report.requests.push({ port, url: r.url() });
  });
  await page.goto(`http://127.0.0.1:${port}/?scene=archive`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => window.rhine?.stats().mode === "archive",
    null,
    { timeout: 60000 },
  );
  await page.locator(".file-title").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => window.rhine.stats().selectionPhase === "settled",
  );
  return page;
}
try {
  const rhine = await open(5173);
  assert.equal(await rhine.title(), "RHINE LAB · ANALYSIS OS");
  assert.equal(
    await rhine.evaluate(() => window.rhine.stats().selected),
    "X-001",
  );
  assert.equal(report.requests.filter((r) => r.port === 5173).length, 0);
  await rhine.screenshot({ path: `${output}/rhine-archive.png` });
  check("Default brand, initial file and lazy first screen");
  await rhine.locator(".file-title").click();
  await rhine
    .locator("#tab-panel")
    .getByText("莱茵生命从克丽斯腾", { exact: false })
    .waitFor({ timeout: 20000 });
  await rhine.locator("[data-tab=notes]").click();
  assert.equal(await rhine.locator(".research-notes li").count(), 3);
  assert.equal(await rhine.locator("[data-reader=expand]").count(), 0);
  await rhine.locator("[data-action=bookmark]").click();
  assert.deepEqual(await rhine.evaluate(() => window.rhine.stats().saved), [
    "X-001",
  ]);
  await rhine.screenshot({ path: `${output}/rhine-detail.png` });
  check("Default legacy tabs and saved archive");
  const audio = await open(5174);
  assert.equal(
    await audio.title(),
    "RHINE AUDIOLOGY · INNER EAR KNOWLEDGE BASE",
  );
  assert.equal(
    await audio.evaluate(() => window.rhine.stats().selected),
    "sensorineural-hearing-loss",
  );
  assert.equal(report.requests.filter((r) => r.port === 5174).length, 0);
  assert.deepEqual(await audio.evaluate(() => window.rhine.stats().saved), []);
  await audio.screenshot({ path: `${output}/audiology-archive.png` });
  check(
    "Audiology branding, default topic, lazy first screen and storage isolation",
  );
  await audio.locator(".file-title").click();
  await audio
    .locator(".topic-statistics strong")
    .first()
    .waitFor({ timeout: 20000 });
  assert.equal(
    await audio.locator(".topic-statistics strong").first().textContent(),
    "967",
  );
  await audio.waitForFunction(
    () => document.querySelector("#stage").dataset.uiMotion === "reading",
  );
  await audio.screenshot({ path: `${output}/audiology-detail.png` });
  await audio.locator("[data-tab=genes]").click();
  await audio.waitForFunction(
    () => document.querySelectorAll(".kb-gene-list button").length === 50,
  );
  const first = await audio
    .locator(".kb-gene-list button")
    .first()
    .textContent();
  await audio.locator('.kb-pagination [data-kb-page="2"]').first().click();
  await audio.waitForFunction(
    (prior) =>
      document.querySelector(".kb-gene-list button")?.textContent !== prior &&
      document.querySelectorAll(".kb-gene-list button").length === 50,
    first,
  );
  check("Large topic is paginated into 50-gene pages");
  await audio.locator(".kb-gene-list button").first().click();
  await audio.locator(".kb-sections").waitFor();
  const gene = await audio.locator(".knowledge-reader h3").textContent();
  await audio.locator("[data-kb-section=claims]").click();
  await audio.locator(".kb-status").first().waitFor();
  await audio.locator("[data-reader=expand]").evaluate((button) =>
    button.addEventListener(
      "click",
      () => {
        window.beforeExpand = {
          scroll: document.querySelector("#detail-content").scrollTop,
          focus: button,
        };
      },
      { capture: true, once: true },
    ),
  );
  await audio.locator("[data-reader=expand]").click();
  await audio.waitForFunction(() =>
    document.querySelector("#stage").classList.contains("reader-expanded"),
  );
  const selected = await audio.evaluate(() => window.rhine.stats().selected);
  await audio.keyboard.press("ArrowRight");
  assert.equal(
    await audio.evaluate(() => window.rhine.stats().selected),
    selected,
  );
  assert.equal(await audio.locator(".knowledge-reader h3").textContent(), gene);
  await audio.screenshot({ path: `${output}/audiology-expanded.png` });
  await audio.keyboard.press("Escape");
  await audio.waitForFunction(
    () =>
      document.querySelector("#detail-content").scrollTop ===
        window.beforeExpand.scroll &&
      document.activeElement === window.beforeExpand.focus,
  );
  assert.equal(
    await audio.locator("[data-tab=genes]").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(await audio.locator(".knowledge-reader h3").textContent(), gene);
  assert.equal(
    await audio
      .locator("[data-kb-section=claims]")
      .getAttribute("aria-pressed"),
    "true",
  );
  check(
    "Expand / return preserves gene and evidence section; arrows stay in reading",
  );
  await audio.locator("[data-action=search]").click();
  await audio.locator("#archive-search").fill("GJB2");
  await audio.locator('[data-gene="HGNC:4284"]').waitFor({ timeout: 15000 });
  await audio.locator('[data-gene="HGNC:4284"]').click();
  await audio.waitForFunction(() =>
    document
      .querySelector(".knowledge-reader h3")
      ?.textContent?.includes("GJB2"),
  );
  await audio.locator("[data-kb-section=claims]").click();
  await audio.locator(".kb-record").first().waitFor();
  assert.equal(await audio.locator(".kb-record").count(), 50);
  check("Gene search and lazy, paginated source provenance");
  await audio.setViewportSize({ width: 390, height: 844 });
  await audio.locator("[data-reader=expand]").click();
  await audio.screenshot({ path: `${output}/audiology-narrow.png` });
  const overflow = await audio.evaluate(() => ({
    body: document.body.scrollWidth > innerWidth + 1,
    panel:
      document.querySelector("#tab-panel").scrollWidth >
      document.querySelector("#tab-panel").clientWidth + 1,
  }));
  assert.deepEqual(overflow, { body: false, panel: false });
  check("390px reading viewport has no horizontal page/panel overflow");
  report.rendering.rhine = await rhine.evaluate(() => window.rhine.stats());
  report.rendering.audiology = await audio.evaluate(() => window.rhine.stats());
  assert.deepEqual(report.errors, []);
  check("No page runtime errors");
} catch (e) {
  report.failure = e.stack;
  for (const [i, page] of context.pages().entries())
    await page
      .screenshot({ path: `${output}/failure-${i}.png` })
      .catch(() => {});
  throw e;
} finally {
  await fs.writeFile(
    `${output}/browser-report.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
