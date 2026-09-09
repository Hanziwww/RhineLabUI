import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-angle=d3d11"],
});
const reports = [];
try {
  for (const port of [5173, 5174]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/?scene=archive`);
    console.log(`${port}: waiting for real GPU samples`);
    await page.waitForFunction(
      () => window.rhine?.stats().pathTracing?.samples >= 4,
      null,
      { timeout: 120000 },
    );
    const archive = await page.evaluate(() => window.rhine.stats());
    console.log(
      `${port}: ${archive.pathTracing.samples} samples on ${archive.gpuBackend}`,
    );
    await page.screenshot({
      path: `verification/template/${port}-settled-archive.png`,
    });
    await page.locator(".file-title").click();
    await page.waitForFunction(
      () =>
        window.rhine.stats().cameraDetail > 0.999 &&
        document
          .querySelector("#detail-content")
          .getAttribute("aria-hidden") !== "true",
      null,
      { timeout: 30000 },
    );
    await page
      .locator("#detail-content")
      .evaluate((node) => (node.scrollTop = 0));
    await page.screenshot({
      path: `verification/template/${port}-settled-detail.png`,
    });
    reports.push({
      port,
      archive,
      detail: await page.evaluate(() => window.rhine.stats()),
      errors,
    });
    await page.close();
  }
} finally {
  await fs.writeFile(
    "verification/template/pathtracing-report.json",
    JSON.stringify(reports, null, 2),
  );
  await browser.close();
}
