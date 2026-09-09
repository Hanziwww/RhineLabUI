# Homepage GPU path tracing

2026-09-08. The user requested full tracing on the homepage after the independent viewer integration.

## Implementation

- `src/archive-trace-snapshot.ts` expands the live archive's nonzero instances into Mesh objects sharing the delivered Blender geometry. The traced scene includes the full visible pool, selected detailed cassette and floor. Zero-scale instances are excluded so an extracted file is not duplicated. Original geometry and material objects remain untouched.
- Array shell shading uses physical acrylic instead of the dark compensation formerly needed by raster transmission: nearly neutral color, cover transmission 0.96 / roughness 0.065, frame transmission 0.92 / roughness 0.1, and a light warm substrate. The subtle height tint is an RGBA vertex attribute on a runtime clone; the tracer merges four-channel colors across all materials.
- `src/archive-pathtracer.ts` uses the installed `three-gpu-pathtracer@0.0.24` and `three-mesh-bvh@0.9.14`. `GenerateMeshBVHWorker` builds the triangle BVH asynchronously. Transforms or pool ownership changes generate a new snapshot after movement settles. Revision checks prevent an outdated asynchronous result from entering the displayed image.
- Three large, distant area lights keep the existing warm studio directions across the array. The scene uses 8 regular bounces, 20 transmission bounces, full output resolution, 3×2 rendering tiles, and up to 512 samples. The library's denoiser compares tone-mapped colors for edge weighting while filtering the original HDR radiance. Current depth restores the homepage atmosphere before output tone mapping.
- The original raster renderer remains active during hover, navigation, extraction, return and camera movement. Once motion settles, a 400ms pause precedes snapshot generation; the traced image fades in over 650ms after 12 samples. The continuous idle wave rests only when tracing is enabled. Selection waves, hover lift, extraction and return order are unchanged. Completed tracing frames are retained without another GPU draw.
- GPU tracing starts automatically. The later lighting/layout revision removes the visible toggle and phase text from both the homepage and independent viewer; legacy stored `false` values no longer override the requested default. Diagnostics remain in DOM datasets. The original reference timeline remains rasterized.
- `vite.config.ts` excludes the worker entry from dependency prebundling. A browser check exposed Vite's original optimized worker URL as invalid; restarting the development server with this configuration fixed the worker load. The production build emits the worker as a separate asset.

## Checks

```powershell
node --experimental-strip-types scripts/check-archive-pathtracing.mjs
node --experimental-strip-types scripts/check-rendering.mjs
node --experimental-strip-types scripts/check-ui-motion.mjs
npm.cmd run build
```

All passed. Snapshot checks use the delivered GLB and cover actual triangle preservation, hidden instances, parent transforms, 4.05 extraction, 0.18 hover, pool ownership changes, RGBA color consistency, and immutable source buffers. Existing checks cover 165888 bounds points, depth precision, interrupted UI motion and reduced-motion behavior.

Browser observations on the actual homepage:

- 1435 expanded material instances represent 287 occupied pool positions plus the separately extracted selected cassette. The complete scene contains **2,615,296 actual triangles**.
- The tracing engine reports successful background construction, full **1920×1080** output at a 1280×720 CSS viewport, progressive samples and a completed tracing state. Actual ray images were inspected during material/denoiser calibration.
- Consecutive right/down navigation selects lane 3 / row 13, resets old sampling and completes a second scene build for that selection. The selected model, rays and DOM file information update together.
- During the initial integration, the former top toggle returned to raster rendering and enabling started a fresh tracing session. That control was subsequently removed at the user's request.
- Reading the selected file reaches extraction 4.05 with `canInspect: true` while tracing continues. Returning restores extraction 0.4 and rotation 0, then builds the updated homepage snapshot and resumes accumulation.
- Both renderers continue using the previously verified NVIDIA RTX 5090 D v2 backend. This is GPU shader path tracing through WebGL2 / ANGLE, not direct invocation of dedicated RTX cores.

Initial compilation and accumulation take time; dense transparent layers can retain some grain at the sample ceiling. The UI remains interactive and the realtime view is always available. No constant-FPS or convergence-time guarantee is made.
