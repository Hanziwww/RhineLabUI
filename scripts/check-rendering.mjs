import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { archiveDepthRange, archivePixelRatio } from "../src/archive-rendering.ts";
import {
  COLUMN_SPACING,
  ROW_SPACING,
  LOOP_COLUMNS,
  LOOP_ROWS,
  visibleCell,
} from "../src/archive-loop.ts";
import { cinematicField, INSPECTION_LIFT } from "../src/motion.ts";

// A 4K display must not be silently reduced by the former 1.5 DPR ceiling.
assert.equal(archivePixelRatio(1920, 1080, 1, 2), 2);
assert.equal(archivePixelRatio(3840, 2160, 1, 1), 1);
assert.equal(archivePixelRatio(1920, 1080, 2, 1), 2);
assert.ok(Math.abs(archivePixelRatio(1600, 900, 0.8, 1) - 1.2) < 1e-12);
assert.equal(archivePixelRatio(1920, 1080, 1, 2, false), 1);

const bytes = await readFile(
  new URL("../public/assets/archive-cassette.glb", import.meta.url),
);
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
const bounds = new THREE.Box3().setFromObject(gltf.scene);
const corners = [];
for (const x of [bounds.min.x, bounds.max.x])
  for (const y of [bounds.min.y, bounds.max.y])
    for (const z of [bounds.min.z, bounds.max.z])
      corners.push(new THREE.Vector3(x, y, z));

// Check the delivered geometry across looping positions, entry travel and
// extraction. This guards against fixing depth precision by clipping cards.
let checkedCorners = 0;
for (const distance of [72, 100, 140]) {
  const depth = archiveDepthRange(distance);
  for (const direction of [
    new THREE.Vector3(-0.816, 0.327, 0.477).normalize(),
    new THREE.Vector3(-0.277, 0.238, 0.931).normalize(),
  ]) {
    const camera = new THREE.PerspectiveCamera(
      6,
      16 / 9,
      depth.near,
      depth.far,
    );
    camera.position.copy(direction).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    for (const center of [
      { lane: 2, row: 12 },
      { lane: -41.3, row: 103.7 },
      { lane: 48.8, row: -117.2 },
    ]) {
      for (let i = 0; i < LOOP_COLUMNS * LOOP_ROWS; i++) {
        const cell = visibleCell(i, center);
        for (const entry of [-28, 0]) {
          for (const lift of [0, INSPECTION_LIFT]) {
            const position = new THREE.Vector3(
              (cell.lane - center.lane) * COLUMN_SPACING,
              -4.6 +
                cinematicField(12 + cell.row - center.row, 2, 26.56) +
                lift,
              (cell.row - center.row) * ROW_SPACING - 2.17 + entry,
            );
            for (const corner of corners) {
              const z = corner.clone().add(position).project(camera).z;
              assert.ok(
                z > -1 && z < 1,
                "Near/far planes retain the full array",
              );
              checkedCorners++;
            }
          }
        }
      }
    }
  }
}

// Quantize real perspective depth to the usual 24-bit buffer. The delivered
// cover/lightguide gap is 0.002, smaller than one old depth step at distance 140.
const levels = 2 ** 24 - 1;
const depthCode = (distance, range) => {
  const camera = new THREE.PerspectiveCamera(6, 16 / 9, range.near, range.far);
  return Math.round(
    ((new THREE.Vector3(0, 0, -distance).project(camera).z + 1) / 2) * levels,
  );
};
let minimumSeparation = Infinity;
let oldDepthCollisions = 0;
for (const distance of [72, 100, 140]) {
  for (let i = 0; i < 100; i++) {
    const surface = distance + i * 0.001;
    const range = archiveDepthRange(distance);
    const separation = Math.abs(
      depthCode(surface, range) - depthCode(surface + 0.002, range),
    );
    if (distance === 140) {
      const oldRange = archiveDepthRange(distance, true);
      if (depthCode(surface, oldRange) === depthCode(surface + 0.002, oldRange))
        oldDepthCollisions++;
    }
    assert.ok(
      separation >= 16,
      "Thin surfaces remain distinctly ordered during small camera movements",
    );
    minimumSeparation = Math.min(minimumSeparation, separation);
  }
}
assert.ok(
  oldDepthCollisions > 0,
  "The fixture reproduces the old depth collision",
);
assert.deepEqual(archiveDepthRange(140, true), { near: 0.1, far: 300 });
console.log(
  JSON.stringify(
    {
      checkedCorners,
      oldDepthCollisions,
      minimumDepthLevelsAcrossThinGap: minimumSeparation,
      referenceRange: "unchanged",
      checks: "passed",
    },
    null,
    2,
  ),
);
