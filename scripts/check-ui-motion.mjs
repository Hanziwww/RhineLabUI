import assert from "node:assert/strict";
import { ArchiveUiTimeline } from "../src/archive-ui-motion.ts";

const step = (timeline, camera, frames = 1, hz = 60) => {
  for (let i = 0; i < frames; i++) timeline.update(camera, 1 / hz);
};
const ui = new ArchiveUiTimeline();
ui.setMode("archive");
step(ui, 0, 90);
assert.equal(ui.values.overview, 1);

ui.setMode("detail");
assert.equal(
  ui.values.overview,
  1,
  "Changing destination never resets a visible layer",
);
step(ui, 0, 10);
assert.equal(ui.values.heading, 0, "Detail waits for camera motion");
assert.ok(ui.values.overview < 0.03);
for (let frame = 0; frame < 90; frame++) {
  step(ui, frame / 90);
  assert.ok(ui.values.heading >= ui.values.metadata);
  assert.ok(ui.values.metadata >= ui.values.body);
}
step(ui, 1, 60);
assert.equal(ui.phase, "reading");
assert.equal(ui.values.body, 1);

// Exit keeps its visible contents, then fades them while the camera returns.
const beforeExit = { ...ui.values };
ui.setMode("archive");
assert.deepEqual(ui.values, beforeExit);
step(ui, 1);
assert.ok(ui.values.body > 0 && ui.values.body < 1);
assert.equal(
  ui.values.overview,
  0,
  "Overview waits until the camera has returned",
);

// Interrupt a partially visible layer repeatedly: no hidden/full-opacity reset.
for (let i = 0; i < 24; i++) {
  const before = { ...ui.values };
  ui.setMode(i % 2 ? "archive" : "detail");
  assert.deepEqual(ui.values, before);
  step(ui, 0.55, 3);
  for (const amount of Object.values(ui.values))
    assert.ok(amount >= 0 && amount <= 1);
}
ui.setMode("archive");
step(ui, 0, 90);
assert.equal(ui.values.overview, 1);
assert.equal(ui.values.body, 0);
assert.equal(ui.values.atmosphere, 0);

// Different display refresh rates produce the same timed fade.
const low = new ArchiveUiTimeline();
const high = new ArchiveUiTimeline();
for (const timeline of [low, high]) timeline.setMode("archive");
step(low, 0, 6, 30);
step(high, 0, 24, 120);
assert.ok(Math.abs(low.values.overview - high.values.overview) < 1e-10);

ui.reduced = true;
ui.setMode("detail");
ui.update(0, 0);
assert.equal(ui.values.body, 1);
assert.equal(ui.values.overview, 0);
ui.setMode("archive");
ui.update(1, 0);
assert.equal(ui.values.overview, 1);
assert.equal(ui.values.body, 0);
ui.setMode("boot");
assert.ok(Object.values(ui.values).every((value) => value === 0));
console.log(
  JSON.stringify(
    {
      stagedEntry: "passed",
      interruptions: 24,
      frameRateIndependence: "passed",
      reducedMotionAndReplay: "passed",
      checks: "passed",
    },
    null,
    2,
  ),
);
