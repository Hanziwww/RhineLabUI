import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// Use the Rhine dev server at 5173 and built-site previews at 5273 / 5274.
const directory = "verification/upstream";
await fs.mkdir(directory, { recursive: true });
const report = { upstream: "dde61fd", reference: [], sites: [], errors: [] };
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-angle=d3d11"],
});
try {
  for (const name of ["boot", "depth", "decryption", "trace-fade"]) {
    const page = await browser.newPage();
    page.on("pageerror", (error) =>
      report.errors.push(`${name}: ${error.message}`),
    );
    await page.goto(`http://127.0.0.1:5173/reference/${name}-check.html`);
    await page.waitForFunction(
      () =>
        document.querySelector("#result")?.textContent.trim().startsWith("{"),
      null,
      { timeout: 180000 },
    );
    const result = JSON.parse(await page.locator("#result").textContent());
    report.reference.push({ name, ...result });
    assert.ok(result.passed, `${name}: ${JSON.stringify(result)}`);
    console.log(
      `${name}: ${result.checks?.length ?? result.samples.length} reference checks passed`,
    );
    await page.close();
  }
  for (const [port, id] of [
    [5273, "rhine"],
    [5274, "rhine-audiology"],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    page.on("pageerror", (error) =>
      report.errors.push(`${id}: ${error.message}`),
    );
    await page.goto(`http://127.0.0.1:${port}/?scene=detail`);
    await page.waitForFunction(
      () => window.rhine?.stats().decryption.phase === "joining",
      null,
      { timeout: 45000 },
    );
    const joining = await page.evaluate(() => ({
      phase: document.querySelector("#inspection-marks").dataset.phase,
      path: document.querySelector("#inspection-lines").getAttribute("d"),
      trace: window.rhine.stats().pathTracing,
    }));
    assert.equal(joining.phase, "joining");
    assert.match(joining.path, /^M.+L.+M.+L/);
    assert.equal(
      joining.trace?.samples ?? 0,
      0,
      "decryption must keep the live raster animation",
    );
    await page.waitForFunction(
      () => window.rhine.stats().decryption.phase === "clear",
    );
    await page.screenshot({ path: `${directory}/${id}-clear-raster.png` });
    await page.waitForFunction(
      () => window.rhine.stats().pathTracing?.samples >= 64,
      null,
      { timeout: 120000 },
    );
    const clear = await page.evaluate(() => ({
      stats: window.rhine.stats(),
      opacity: document.querySelector("#inspection-marks").style.opacity,
      path: document.querySelector("#inspection-lines").getAttribute("d"),
      readerText: document.querySelector("#detail-panel")?.textContent,
    }));
    assert.equal(clear.stats.decryption.clarity, 1);
    assert.equal(clear.opacity, "0");
    assert.equal(clear.path, "");
    assert.ok(clear.stats.cameraNear >= 5);
    await page.screenshot({ path: `${directory}/${id}-clear-traced.png` });
    await page.evaluate(() => window.rhine.archive());
    await page.waitForFunction(
      () => window.rhine.stats().decryption.clarity === 0,
    );
    await page.evaluate(() => window.rhine.detail());
    await page.waitForFunction(
      () => window.rhine.stats().decryption.phase === "joining",
    );
    await page.evaluate(() => {
      window.rhine.archive();
      window.rhine.select(1);
      window.rhine.select(0);
      window.rhine.detail();
    });
    await page.waitForFunction(
      () => window.rhine.stats().decryption.phase === "clear",
    );
    const final = await page.evaluate(() => window.rhine.stats());
    assert.ok(final.cameraPosition.every(Number.isFinite));
    assert.equal(final.decryption.clarity, 1);
    report.sites.push({ id, joining, clear, final });
    console.log(
      `${id}: live decryption, ${clear.stats.pathTracing.samples} GPU samples, exit and rapid re-selection passed`,
    );
    await page.close();
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await fs.writeFile(
    `${directory}/browser-report.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}

// A separate browser exercises the retained viewer without competing with the
// archive for GPU memory. It writes its own surface / tracing evidence.
await import("./check-viewer-tracing.mjs");
