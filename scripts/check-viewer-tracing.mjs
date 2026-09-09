import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-angle=d3d11"],
});
const report = { states: [], errors: [] };
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto("http://127.0.0.1:5273/?scene=detail");
  await page.waitForFunction(() => window.rhine?.stats().loaded);
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.dataset.action = "model-viewer";
    document.querySelector("#stage").append(button);
    button.click();
    button.remove();
  });
  for (const surface of ["clear", "frosted", "clear"]) {
    await page.locator(`[data-viewer="${surface}"]`).click();
    await page.waitForFunction(
      (surface) => {
        const s = JSON.parse(
          document.querySelector(".model-viewer").dataset.stats || "{}",
        );
        return (
          s.ready &&
          s.clarity === (surface === "clear" ? 1 : 0) &&
          s.pathTracing?.samples >= 64
        );
      },
      surface,
      { timeout: 120000 },
    );
    report.states.push({
      surface,
      stats: await page
        .locator(".model-viewer")
        .evaluate((el) => JSON.parse(el.dataset.stats)),
    });
    await page.screenshot({
      path: `verification/upstream/viewer-${surface}.png`,
    });
  }
  await page.locator('[data-viewer="close"]').click();
  await page.waitForFunction(
    () => document.querySelector(".model-viewer").hidden,
  );
  report.returnedClarity = await page.evaluate(
    () => window.rhine.stats().decryption.clarity,
  );
  if (report.errors.length || report.returnedClarity !== 1)
    throw Error(JSON.stringify(report));
  console.log(
    "Viewer clear / frosted / clear all accumulated 64 GPU samples and returned to the same clear detail",
  );
} finally {
  await fs.writeFile(
    "verification/upstream/viewer-trace-report.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
