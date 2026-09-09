import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// Run built-file previews at 5273 / 5274 alongside the normal dev servers.
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await context.addInitScript(() => {
  localStorage.setItem("rhine-saved", JSON.stringify(["X-002"]));
  localStorage.setItem(
    "rhine-settings",
    JSON.stringify({ sound: false, quality: true, reduced: true }),
  );
});
const report = { checks: [], sites: [], errors: [] };
try {
  for (const [port, id, selected] of [
    [5273, "rhine", "X-001"],
    [5274, "rhine-audiology", "sensorineural-hearing-loss"],
  ]) {
    const page = await context.newPage();
    const contentRequests = [];
    page.on("pageerror", (error) =>
      report.errors.push(`${id}: ${error.message}`),
    );
    page.on("response", (response) => {
      if (response.status() >= 400)
        report.errors.push(`${response.status()}: ${response.url()}`);
    });
    page.on("request", (request) => {
      if (/\/(data|content)\//.test(request.url()))
        contentRequests.push(request.url());
    });
    await page.goto(`http://127.0.0.1:${port}/?scene=archive`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => window.rhine?.stats().pathTracing?.samples >= 4,
      null,
      { timeout: 120000 },
    );
    const archive = await page.evaluate(() => window.rhine.stats());
    assert.equal(archive.selected, selected);
    assert.equal(
      contentRequests.length,
      0,
      "Home must not download document bodies or the IEKB dataset",
    );
    const storage = await page.evaluate(() => ({ ...localStorage }));
    assert.equal(storage["rhine-saved"], '["X-002"]');
    if (id === "rhine") {
      assert.deepEqual(archive.saved, ["X-002"]);
      assert.equal(storage[`rhine-site:${id}:migrated`], "1");
      assert.equal(
        JSON.parse(storage[`rhine-site:${id}:settings`]).reduced,
        true,
      );
      assert.equal(
        await page
          .locator("#stage")
          .evaluate((node) => node.classList.contains("reduce-motion")),
        true,
      );
    } else {
      assert.deepEqual(archive.saved, []);
      assert.equal(storage[`rhine-site:${id}:migrated`], undefined);
      assert.equal(
        await page
          .locator("#stage")
          .evaluate((node) => node.classList.contains("reduce-motion")),
        false,
      );
    }
    await page.screenshot({
      path: `verification/template/${id}-production-archive.png`,
    });
    console.log(
      `${id}: production worker accumulated ${archive.pathTracing.samples} GPU samples; lazy home and storage migration passed`,
    );
    await page.locator(".file-title").click();
    if (id === "rhine") {
      await page
        .locator("#tab-panel")
        .getByText("莱茵生命从克丽斯腾", { exact: false })
        .waitFor();
      await page.locator("[data-tab=notes]").click();
      assert.equal(await page.locator(".research-notes li").count(), 3);
      await page.evaluate(() =>
        localStorage.setItem(
          "rhine-site:rhine:saved",
          JSON.stringify(["X-003"]),
        ),
      );
      await page.reload();
      await page.waitForFunction(() => window.rhine?.stats().mode === "detail");
      assert.deepEqual(await page.evaluate(() => window.rhine.stats().saved), [
        "X-003",
      ]);
    } else {
      await page.locator(".topic-statistics strong").first().waitFor();
      assert.equal(
        await page.locator(".topic-statistics strong").first().textContent(),
        "967",
      );
      await page.locator("[data-tab=genes]").click();
      await page.waitForFunction(
        () => document.querySelectorAll(".kb-gene-list button").length === 50,
      );
      await page.locator("[data-action=search]").click();
      await page.locator("#archive-search").fill("DFNA3");
      await page.locator('[data-gene="HGNC:4284"]').click();
      await page.waitForFunction(() =>
        document
          .querySelector(".knowledge-reader h3")
          ?.textContent?.includes("GJB2"),
      );
      await page.locator("[data-kb-section=claims]").click();
      await page.waitForFunction(
        () => document.querySelectorAll(".kb-record").length === 50,
      );
      await page.locator("[data-reader=expand]").click();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth > innerWidth + 1),
        false,
      );
    }
    report.checks.push(
      `${id}: built assets, real GPU samples, lazy bodies, reader, namespaced storage`,
    );
    report.sites.push({ id, port, archive, requests: contentRequests });
    await page.close();
  }
  assert.deepEqual(report.errors, []);
  console.log("Production previews passed; no HTTP or runtime errors");
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await fs.writeFile(
    "verification/template/production-report.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
