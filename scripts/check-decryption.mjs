import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { decryptionFrame, DecryptionController } from "../src/decryption.ts";
import { CardAppearance } from "../src/appearance.ts";

const length = (frame) => frame.intervals.reduce((n, [a, b]) => n + b - a, 0);
let previous = 0;
for (let t = 34.24; t < 36.04; t += 0.001) {
  const f = decryptionFrame(t),
    current = length(f);
  assert.ok(current >= previous - 1e-10 && current <= 1);
  if (f.intervals.length)
    assert.ok(Math.abs(f.intervals[0][1] + f.intervals[1][0] - 1) < 1e-10);
  previous = current;
}
assert.deepEqual(decryptionFrame(36.04).intervals, [[0, 1]]);
assert.equal(length(decryptionFrame(37.71)), 1);
previous = 1;
for (let t = 37.72; t < 38.84; t += 0.001) {
  const f = decryptionFrame(t),
    current = length(f);
  assert.ok(current <= previous + 1e-10 && current >= 0);
  assert.ok(Math.abs(f.intervals[0][0] + f.intervals[0][1] - 1) < 1e-10);
  assert.equal(f.clarity, 0);
  previous = current;
}
assert.equal(length(decryptionFrame(38.84)), 0);
assert.equal(decryptionFrame(38.84).clarity, 0);
assert.equal(decryptionFrame(39.56).clarity, 1);
assert.ok(length(decryptionFrame(34.64)) > 0.5, "Joining is eased, not linear");
const a = new DecryptionController();
a.enter();
a.update(3, false, false);
assert.equal(a.frame.phase, "waiting");
a.update(0, true, false);
for (let i = 0; i < 120; i++) a.update(1 / 30, true, false);
assert.equal(a.clarity, 1);
a.leave();
assert.equal(a.frame.intervals.length, 0);
a.update(0.1, false, false);
const returning = a.clarity;
a.enter();
a.update(0, true, false);
assert.equal(a.clarity, returning);
a.update(0.1, true, true);
assert.equal(a.clarity, 1);
assert.equal(a.frame.intervals.length, 0);
a.select();
assert.equal(a.clarity, 0);
a.update(0, false, false, 35);
assert.equal(a.frame.phase, "joining");
a.update(0, false, false, 39.56);
assert.equal(a.clarity, 1);
a.update(0, false, false, 34);
assert.equal(a.clarity, 0, "Reference seeking is reversible");

const appearance = new CardAppearance();
const high = new THREE.MeshPhysicalMaterial({
  transmission: 0.9,
  thickness: 0.12,
  attenuationDistance: 2,
});
const low = high.clone();
low.thickness = 0.25;
appearance.register("Frosted_Polymer", high, low);
const group = new THREE.Group(),
  mesh = new THREE.Mesh(new THREE.BoxGeometry(), high);
mesh.userData.surface = "Frosted_Polymer";
group.add(mesh);
appearance.prepare(group);
appearance.apply(group, 1);
const shader = {
  uniforms: {},
  vertexShader: "#include <begin_vertex>",
  fragmentShader: "#include <color_fragment>\n#include <roughnessmap_fragment>",
};
mesh.material.onBeforeCompile(shader);
const part = new THREE.Group();
group.add(part);
part.add(mesh);
appearance.setClarity(group, 1);
assert.equal(shader.uniforms.archiveClarity.value, 1);
assert.ok(Math.abs(mesh.material.thickness - 0.018) < 1e-10);
appearance.setClarity(group, 0);
assert.equal(shader.uniforms.archiveClarity.value, 0);
assert.equal(mesh.material.thickness, 0.12);

const bytes = await readFile(
  new URL("../public/assets/archive-assembly.glb", import.meta.url),
);
const asset = (
  await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  )
).scene;
asset.updateMatrixWorld(true);
let interiors = 0,
  maxDepth = -Infinity,
  minDepth = Infinity;
asset.traverse((mesh) => {
  if (
    !mesh.isMesh ||
    !["optical-core", "optical-lenses"].includes(mesh.userData.assemblyPart)
  )
    return;
  const box = new THREE.Box3().setFromObject(mesh);
  minDepth = Math.min(minDepth, box.min.z);
  maxDepth = Math.max(maxDepth, box.max.z);
  interiors++;
  assert.ok(
    box.min.z > -0.038 && box.max.z < 0.174,
    "Interior stays between substrate and cover",
  );
});
assert.ok(interiors >= 6);
// Perspective depth resolution, at the actual detail distance and 24-bit depth.
const step = (near, distance) =>
  (distance * distance * (300 - near)) / (300 * near * (2 ** 24 - 1));
assert.ok(step(5, 72) < step(0.1, 72) / 50);
console.log(
  JSON.stringify(
    {
      passed: true,
      interiorMeshes: interiors,
      interiorDepth: [minDepth, maxDepth],
      depthStepBefore: step(0.1, 72),
      depthStepAfter: step(5, 72),
    },
    null,
    2,
  ),
);
