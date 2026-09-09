import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { configureInternalOptics } from "../src/internal-optics.ts";
async function load(path) {
  const b = await readFile(new URL(path, import.meta.url));
  const s = (
    await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      "",
    )
  ).scene;
  s.updateMatrixWorld(true);
  return s;
}
const after = await load("../public/assets/archive-assembly.glb");
let minSectionNormalDot = 1,
  glassMeshes = 0,
  bridgeMeshes = 0;
after.traverse((m) => {
  if (!m.isMesh || !/^Optical_(Glass_|Bridge_Glass)/.test(m.material.name))
    return;
  const p = m.geometry.attributes.position,
    n = m.geometry.attributes.normal,
    ix = m.geometry.index;
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)],
      ps = ids.map((j) => new T.Vector3().fromBufferAttribute(p, j)),
      face = ps[1].sub(ps[0]).cross(ps[2].sub(ps[0])).normalize();
    if (face.lengthSq() < 0.5) continue;
    for (const id of ids)
      minSectionNormalDot = Math.min(
        minSectionNormalDot,
        face.dot(new T.Vector3().fromBufferAttribute(n, id)),
      );
  }
  configureInternalOptics(m.material.name.replace(/\.\d+$/, ""), m.material);
  assert.equal(m.material.transmission, 0);
  assert.equal(m.material.transparent, false);
  assert.equal(m.material.blending, T.CustomBlending);
  assert.equal(m.material.depthWrite, false);
  assert.equal(m.material.side, T.FrontSide);
  assert.ok(m.material.opacity > 0 && m.material.opacity < 1);
  glassMeshes++;
  if (m.material.name.startsWith("Optical_Bridge_Glass")) bridgeMeshes++;
});
assert.ok(
  minSectionNormalDot > 0.995,
  "The baked normal does not round over hard profile edges",
);
assert.equal(glassMeshes, 4);
assert.equal(
  bridgeMeshes,
  1,
  "One continuous bridge replaces the separate narrow strips",
);
console.log(
  JSON.stringify(
    { passed: true, minSectionNormalDot, glassMeshes, bridgeMeshes },
    null,
    2,
  ),
);
