import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const report = { checks: [], errors: [] };
const check = (name) => {
  report.checks.push(name);
  console.log(name);
};
async function ready(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.rhine?.stats().loaded, null, {
    timeout: 45000,
  });
}
try {
  const example = await context.newPage();
  example.on("pageerror", (e) => report.errors.push(e.message));
  await ready(example, "http://127.0.0.1:5175/?scene=archive");
  const before = await example.evaluate(
    () => window.rhine.stats().selectedCell.row,
  );
  await example.keyboard.press("ArrowDown");
  assert.equal(
    await example.evaluate(() => window.rhine.stats().selectedCell.row),
    before + 1,
  );
  await example.locator(".file-title").click();
  await example.locator("[data-tab=structured-content]").click();
  await example.locator(".katex-display").waitFor();
  assert.equal(await example.locator(".markdown-body table").count(), 1);
  assert.equal(await example.locator(".markdown-body pre").count(), 1);
  const image = example.locator(".markdown-body img");
  assert.ok(await image.evaluate((el) => el.complete && el.naturalWidth > 0));
  await example.locator("[data-reader=expand]").click();
  await example.setViewportSize({ width: 390, height: 844 });
  await example.screenshot({
    path: "verification/template/markdown-narrow.png",
  });
  assert.equal(
    await example.evaluate(
      () =>
        document.querySelector("#tab-panel").scrollWidth >
        document.querySelector("#tab-panel").clientWidth + 1,
    ),
    false,
  );
  await example.locator("[data-tab=getting-started]").click();
  await example.locator("[data-footnote-ref]").click();
  assert.ok(await example.locator(".footnotes").isVisible());
  check(
    "Third site: one-item looping, H2 tabs, math, table, image, code and footnotes at 390px",
  );
  await ready(
    example,
    "http://127.0.0.1:5175/?document=welcome#structured-content",
  );
  await example.waitForFunction(
    () =>
      document
        .querySelector('[data-tab="structured-content"]')
        ?.getAttribute("aria-selected") === "true",
  );
  check("Stable ID and heading fragment open the requested Markdown tab");
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  let release;
  let caught;
  const requested = new Promise((resolve) => (caught = resolve));
  const barrier = new Promise((resolve) => (release = resolve));
  await page.route("**/content/documents/X-002.json", async (route) => {
    caught();
    await barrier;
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "X-002",
          html: "",
          headings: [],
          sections: [],
          legacy: {
            abstract: "STALE-BODY-MUST-NEVER-APPEAR",
            findings: ["stale"],
          },
        }),
      })
      .catch(() => {});
  });
  await ready(page, "http://127.0.0.1:5173/?document=X-002");
  await requested;
  await page.evaluate(() => {
    window.staleSeen = false;
    new MutationObserver(() => {
      if (
        document
          .querySelector("#tab-panel")
          ?.textContent?.includes("STALE-BODY-MUST-NEVER-APPEAR")
      )
        window.staleSeen = true;
    }).observe(document.querySelector("#detail-content"), {
      subtree: true,
      childList: true,
    });
    window.rhine.select(2);
    window.rhine.detail();
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#tab-panel")
      ?.textContent?.includes("赫默在莱茵生命时期"),
  );
  release();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.staleSeen), false);
  check("Delayed old document cannot replace a newer archive body");
  await page.route("**/content/documents/X-004.json", (route) =>
    route.fulfill({
      status: 503,
      contentType: "text/plain",
      body: "Test unavailable",
    }),
  );
  await page.evaluate(() => {
    window.rhine.select(3);
    window.rhine.detail();
  });
  await page.locator("[data-reader=retry]").waitFor();
  await page.unroute("**/content/documents/X-004.json");
  await page.locator("[data-reader=retry]").click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#tab-panel .reader-status") &&
      document.querySelector("#tab-panel p"),
  );
  check("Body-load failure has an in-reader retry that recovers");
  await page.goto("http://127.0.0.1:5174/?scene=archive");
  await page.waitForFunction(() => window.rhine?.stats().mode === "archive");
  await page.locator("[data-action=search]").click();
  const index = JSON.parse(
    await fs.readFile("sites/rhine-audiology/data/search.json", "utf8"),
  );
  const aliasGene = index.genes.find((g) => g.symbol === "GJB2");
  const alias = aliasGene.aliases.find(
    (a) => a.toUpperCase() !== gSymbol(aliasGene.symbol),
  );
  function gSymbol(s) {
    return s.toUpperCase();
  }
  await page.locator("#archive-search").fill(alias);
  await page.locator('[data-gene="HGNC:4284"]').waitFor();
  check(`Gene alias search (${alias})`);
  await page.locator("#archive-search").fill("25862627");
  await page.locator('[data-gene="HGNC:23336"]').waitFor();
  await page
    .locator("#evidence-filter")
    .selectOption("mechanism_or_expression");
  await page.locator('[data-gene="HGNC:23336"]').waitFor();
  check(
    "PMID search and mechanism/expression filter retain the original A2ML1 record",
  );
  const cellRecord = index.records.find(
    (r) => r.cells.length && r.type === "phenotype",
  );
  const cellGene = index.genes.find((g) => g.id === cellRecord.gene);
  await page.locator("#archive-search").fill(cellGene.symbol);
  await page.locator("#evidence-filter").selectOption("phenotype");
  await page.locator("#cell-filter").selectOption(cellRecord.cells[0]);
  await page.locator(`[data-gene="${cellRecord.gene}"]`).waitFor();
  check("Cell type and evidence filters operate on the same source record");
  await page.locator("[data-action=close-modal]").click();
  await page.locator(".file-title").click();
  await page.locator("[data-tab=evidence]").click();
  await page.locator(".kb-global-links summary").click();
  await page.locator("[data-kb-all=unassigned]").click();
  await page.waitForFunction(() =>
    document
      .querySelector(".kb-pagination")
      ?.textContent?.includes("66 records"),
  );
  assert.equal(await page.locator(".kb-record").count(), 50);
  await page.locator('[data-kb-page="2"]').first().click();
  await page.waitForFunction(
    () => document.querySelectorAll(".kb-record").length === 16,
  );
  check("All 66 unassigned interactions are accessible in two pages");
  await page.locator("[data-reader=expand]").click();
  await page.locator("#detail-content").evaluate((el) => (el.scrollTop = 350));
  const scroll = await page
    .locator("#detail-content")
    .evaluate((el) => el.scrollTop);
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("[data-tab=evidence]").getAttribute("aria-selected"),
    "true",
  );
  // Context stays on the same page of the interaction overview after collapse.
  assert.equal(await page.locator(".kb-record").count(), 16);
  check(
    `Expanded reading preserves the interaction page (expanded scroll ${scroll})`,
  );
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  for (const [i, page] of context.pages().entries())
    await page
      .screenshot({ path: `verification/template/reader-failure-${i}.png` })
      .catch(() => {});
  throw error;
} finally {
  await fs.writeFile(
    "verification/template/reader-report.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
