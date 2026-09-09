import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ArchiveTraceSnapshot } from "../src/archive-trace-snapshot.ts";

const bytes = await readFile(
  new URL("../public/assets/archive-cassette.glb", import.meta.url),
);
const asset = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
const sourceMeshes = [];
asset.scene.traverse((object) => {
  if (object.isMesh) sourceMeshes.push(object);
});
const shell = sourceMeshes.find((mesh) =>
  mesh.material.name.startsWith("Frosted_Polymer"),
);
const frame = sourceMeshes.find((mesh) =>
  mesh.material.name.startsWith("Ivory_Edges"),
);
const sourcePositions = shell.geometry.getAttribute("position").array.slice();
const scene = new THREE.Scene();
const parent = new THREE.Group();
parent.position.set(3, 1, -2);
parent.rotation.y = 0.31;
scene.add(parent);
const instances = new THREE.InstancedMesh(shell.geometry, shell.material, 3);
parent.add(instances);
const matrix = new THREE.Matrix4();
instances.setMatrixAt(0, matrix.makeTranslation(-2, 0, 1));
instances.setMatrixAt(1, matrix.makeScale(0, 0, 0));
instances.setMatrixAt(2, matrix.makeTranslation(2, 0.18, 2));
const selected = new THREE.Mesh(frame.geometry, frame.material);
selected.castShadow = true;
selected.position.set(0, 4.05, 0);
scene.add(selected);
const snapshot = new ArchiveTraceSnapshot();
snapshot.update(scene);
assert.equal(
  snapshot.instanceCount,
  2,
  "The extracted instance must not be duplicated.",
);
assert.equal(snapshot.root.children.length, 3);
assert.equal(
  snapshot.triangles,
  (2 * shell.geometry.index.count) / 3 + frame.geometry.index.count / 3,
);
assert(snapshot.root.children.every((mesh) => !mesh.isInstancedMesh));
const lifted = snapshot.root.children.find(
  (mesh) => mesh.geometry === frame.geometry,
);
assert(
  lifted.matrixWorld.equals(selected.matrixWorld),
  "Extraction keeps its actual world transform.",
);
assert.equal(
  lifted.material.castShadow,
  true,
  "Opaque shadow casters survive the material conversion.",
);
const expandedShells = snapshot.root.children.filter((mesh) => mesh !== lifted);
for (const [i, index] of [0, 2].entries()) {
  instances.getMatrixAt(index, matrix);
  matrix.premultiply(instances.matrixWorld);
  assert(
    expandedShells[i].matrixWorld.equals(matrix),
    "Parent transforms and hover height survive expansion.",
  );
  assert.deepEqual(
    expandedShells[i].geometry.index.array,
    shell.geometry.index.array,
    "Trace the delivered triangles, not bounds.",
  );
  assert.equal(
    expandedShells[i].material.castShadow,
    false,
    "The tracer must not add opaque shadowing to clear skins.",
  );
  const colors = expandedShells[i].geometry.getAttribute("color");
  assert.equal(
    colors.itemSize,
    4,
    "Merged tracing geometry requires RGBA attributes.",
  );
  for (let vertex = 0; vertex < colors.count; vertex++)
    assert.equal(colors.getW(vertex), 1);
}
instances.setMatrixAt(0, matrix.makeScale(0, 0, 0));
instances.setMatrixAt(1, matrix.makeTranslation(-2, 0, 1.48));
selected.position.y = 0.4;
snapshot.update(scene);
assert.equal(
  snapshot.instanceCount,
  2,
  "Pool wrapping replaces the hidden owner without duplicates.",
);
assert.equal(snapshot.root.children.length, 3);
assert(lifted.matrixWorld.equals(selected.matrixWorld));
parent.visible = false;
snapshot.update(scene);
assert.equal(snapshot.root.children.length, 1);
snapshot.dispose();
assert.deepEqual(
  shell.geometry.getAttribute("position").array,
  sourcePositions,
);
assert.equal(
  shell.geometry.getAttribute("color"),
  undefined,
  "Runtime tint never changes the shared Blender asset.",
);
assert.equal(
  shell.material.castShadow,
  undefined,
  "Shadow flags only belong to the tracing material clone.",
);
console.log(
  JSON.stringify(
    {
      actualTriangles: true,
      hiddenInstances: true,
      parentTransforms: true,
      poolOwnership: true,
      rgbaColors: true,
      shadowCasters: true,
      immutableSource: true,
      checks: "passed",
    },
    null,
    2,
  ),
);
