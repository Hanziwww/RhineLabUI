import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-angle=d3d11"],
});
const report = { checks: [], errors: [] };
try {
  for (const [port, brand] of [
    [5273, "RHINE LAB.LLC."],
    [5274, "RHINE AUDIOLOGY"],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/?review=1&time=2&freeze=1`);
    await page.waitForFunction(() => window.rhine?.stats().loaded, null, {
      timeout: 45000,
    });
    for (const time of [2, 5, 8.8, 15, 19, 22.5, 26, 29, 34]) {
      await page.evaluate(
        (time) =>
          window.postMessage(
            { type: "rhine-review-frame", time },
            location.origin,
          ),
        time,
      );
      await page.waitForFunction(
        (frame) =>
          Number(document.querySelector("#stage").dataset.bootFrame) === frame,
        Math.floor((time + 5) * 25 + 0.00001),
      );
      const state = await page.evaluate(() => ({
        stats: window.rhine.stats(),
        caption: document.querySelector("#cinema-caption").textContent,
      }));
      assert.ok(state.stats.cameraPosition.every(Number.isFinite));
      assert.ok(state.stats.cameraFar > state.stats.cameraNear);
      if (port === 5274)
        assert.ok(
          !/[\u3400-\u9fff]/.test(state.caption),
          `English boot caption: ${state.caption}`,
        );
      if (time === 19) {
        assert.equal(
          await page.locator(".welcome-company strong").first().textContent(),
          brand,
        );
        await page.screenshot({
          path: `verification/template/${port}-boot-welcome.png`,
        });
      }
    }
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        window.rhine.stats().mode === "archive" &&
        window.rhine.stats().selectionPhase === "settled" &&
        window.rhine.stats().extraction <= 0.401,
    );
    const canvas = page.locator("#three-scene canvas");
    const box = await canvas.boundingBox();
    const state = await page.evaluate(() => window.rhine.stats());
    const x = box.x + ((state.labelTopLeft[0] + 35) * box.width) / 1920;
    const y =
      box.y +
      (((state.labelTopLeft[1] + state.labelBottomLeft[1]) / 2) * box.height) /
        1080;
    await page.mouse.move(x, y);
    await page.waitForFunction(() => window.rhine.stats().hoveredCell !== null);
    await page.waitForFunction(() =>
      window.rhine.stats().hoverLifts.some((h) => h.lift > 0),
    );
    await page.mouse.click(x, y);
    const clickMode = await page.evaluate(() => window.rhine.stats().mode);
    if (clickMode === "archive") await page.mouse.click(x, y);
    await page.waitForFunction(
      () =>
        window.rhine.stats().mode === "detail" &&
        window.rhine.stats().canInspect,
      null,
      { timeout: 30000 },
    );
    const chosen = await page.evaluate(() => window.rhine.stats().selected);
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await page.waitForFunction(
      () =>
        window.rhine.stats().mode === "archive" &&
        window.rhine.stats().extraction <= 0.401 &&
        window.rhine.stats().cameraDetail < 0.001,
      null,
      { timeout: 30000 },
    );
    assert.equal(
      await page.evaluate(() => window.rhine.stats().selected),
      chosen,
    );
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    assert.equal(
      await page.evaluate(() => window.rhine.stats().selected),
      chosen,
    );
    report.checks.push(
      `${port}: nine reference phases, configured boot brand, English case captions, hover lift, selected-card click, extraction/return and directional selection`,
    );
    console.log(report.checks.at(-1));
    await page.close();
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await fs.writeFile(
    "verification/template/boot-interaction-report.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
