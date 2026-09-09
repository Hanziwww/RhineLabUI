# White frosted material and live shadows

Historical experiment, superseded by the user's request to restore all shells to clear acrylic. Production no longer loads the frosted asset or this ray pass; see `ACRYLIC-PATHTRACING.md` for the active implementation. The checks and observations below describe this earlier experiment only.

The experiment's Blender source, assets, ray pass and dedicated checks are now preserved in `archive/frosted-shadow-experiment-2026-09-08.zip`. Restore the archive at the project root before using the commands or browser check below; see [the archive guide](../archive/README.md). The active acrylic models and shared Blender MCP bridge remain in their original locations.

This experiment used Blender-authored PBR maps and a shadow-only GPU ray pass. It is an oriented-box shadow-volume approximation of the opaque archive inserts, not full triangle path tracing, RTX acceleration, ray-traced reflections, or multi-bounce global illumination. The original geometry, extraction paths, camera animation and UI transitions remained in use.

## Reproduce the material

Run the official Blender MCP bridge on localhost:9876, then:

```powershell
python scripts/blender-mcp.py art/make_frosted.py
```

The script appends the delivered asset scene without resetting the user's current scene. It bakes a seamless 4D procedural noise field into 1024² normal and roughness maps, exports `public/assets/archive-cassette-frosted.glb`, and writes `art/rhine-frosted.blend` with packed images and the procedural bake graph. Original `art/rhine-archive.blend` and `public/assets/archive-cassette.glb` are retained.

## Rendering checks

```powershell
node --experimental-strip-types scripts/check-shadows.mjs
node --experimental-strip-types scripts/check-rendering.mjs
node --experimental-strip-types scripts/check-ui-motion.mjs
npm.cmd run build
```

The shadow test compares every delivered vertex/normal/UV/index buffer and node transform with the original asset, matched by material group because Blender can rename appended objects. All 11 mesh groups are unchanged. It verifies the two material maps and compares 4000 BVH rays with independent Three.js ray/box intersections over extraction, rotation and array pool wrapping. Hidden instances and an empty scene are covered.

Open `/verification/shadow-check.html` in the development server for an actual WebGL pixel check. The floor sample was 1.0 with no blocker, 0.5205078125 with a blocker, exactly the same on the next stationary render, 1.0 after moving the blocker, and 0.5205078125 after restoring it. All four conditions passed. The test uses the production pass and reads the rendered half-float target; it does not infer success from a build or shader compilation.

In the actual 1280×720 preview, the pass traced 288 casters in 575 nodes at 960×540 with eight stable samples. GPU timer observations were approximately 0.09–0.16 ms for the shadow pass and approximately 0.3–0.4 ms for BVH updates on this machine. These are individual local observations, not total frame times or performance promises for other devices. Browser error logs were empty during preview and detail checks.

Browser checks also covered quick file/column changes, entering details, dragging the extracted model, opening the independent viewer, rotating and fully exploding its six part groups, and returning. Both frosted surfaces reported active normal and roughness maps; the final cover values were roughness 0.48 and transmission 0.78, with frame roughness 0.62 and transmission 0.04. Turning high quality off disabled the ray pass, and the original enabled preference was restored. The production build, existing depth-precision checks and UI transition checks passed.

## Integration limits

- `src/shadow-bvh.ts`: builds the scene's current opaque insert bounds, including instances outside the camera view and returning copies; skips zero-scale instances.
- `src/ray-shadows.ts`: eight fixed area-light directions, same-frame world positions and camera matrices, no temporal history. The reduced resolution is capped at 960×640 and composited using depth-aware interpolation. Lighting contribution and proxy silhouettes are approximations.
- `src/appearance.ts`: frosted surfaces retain exported maps instead of the historical height-based colour and mirror-roughness overrides. Array/detail material values morph on the same model.
- Low quality and the original reference timeline use PCF shadow maps. SSAO supplies local contact shading in high quality. The independent model viewer uses exact-part PCF shadows so rings and openings remain holes.

The decision to retain instanced raster rendering is consistent with the current [three-gpu-pathtracer documentation](https://github.com/gkjohnson/three-gpu-pathtracer), whose limitations include instanced geometry. The hybrid implementation here is project-specific and does not depend on that package.
