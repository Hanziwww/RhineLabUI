# Clear acrylic and optional GPU path tracing

Initial acrylic and viewer implementation, 2026-09-08. Supersedes the frosted material and box-shadow experiment in `FROSTED-SHADOWS.md`. The homepage was subsequently extended to full GPU path tracing at the user's request; see `HOME-PATHTRACING.md`. The viewer checks below remain applicable, while the original homepage restriction is historical.

## Delivered appearance

The archive and assembly viewer load the original Blender MCP assets, `archive-cassette.glb` and `archive-assembly.glb`. Source models and reproducible Blender scripts are retained. No new geometry or bitmap assets were required for the user's acrylic restoration.

Both exterior material groups use clear acrylic. In the actual detail material, `Frosted_Polymer` is a historical asset name: it now reports roughness 0.065 and transmission 0.9, without frosted maps. `Ivory_Edges` reports roughness 0.12 and transmission 0.88. The array and extracted file continue interpolating on the same mesh. The old height-dependent frosted roughness is disabled for production acrylic.

The approved warm light colors, directions and exposure remain in `archive-lighting.ts`; the archive's warm insert color is restored. Main interactive rendering has no Bokeh blur, and foreground fog starts behind the object. High quality uses up to 4× MSAA on the actual postprocessing targets plus SMAA. Pixel dimensions account for CSS scale and device pixel ratio, preserving native 4K with a 12-million-pixel ceiling and modest supersampling at small resolutions.

The moving archive uses 4096² PCF shadow maps from actual opaque geometry, plus SSAO. It does not use the old box BVH postprocess and does not claim full path tracing.

## Established path tracer integration

The 360° viewer offers an optional **GPU 光追** button. It loads `three-gpu-pathtracer@0.0.24` and `three-mesh-bvh@0.9.14` on demand. Their MIT licenses are included in `public/licenses`.

`src/viewer-pathtracer.ts` builds a tracing scene from the actual assembly triangles and current world transforms. It clones materials, shares immutable geometry, captures the same studio environment in a cube map, and converts the three approved warm studio directions into finite area lights. This computes ray-traced reflections, transmission, indirect lighting and soft shadows, rather than multiplying a shadow mask over the whole image.

Settings: 6 regular bounces, 12 transmissive bounces, full output resolution, 2×2 rendering tiles, 24 samples before the 500ms reveal, a 512-sample ceiling, and the library's glslSmartDeNoise filter. Motion shows the realtime renderer. After the camera or assembly settles, sampling restarts from the new state. Assembly changes update the triangle BVH after settling; the library does not rebuild it on every animation frame. Once the sample ceiling is reached, the canvas is retained without repeatedly denoising it. Closing disposes the tracing resources; stale asynchronous imports cannot reopen a closed viewer.

## Verification

```powershell
node --experimental-strip-types scripts/check-rendering.mjs
node --experimental-strip-types scripts/check-ui-motion.mjs
npm.cmd run build
```

All passed. The rendering script checks native 4K/DPR/CSS scaling and reduced-quality resolution. It also checks 165888 bounds points using the delivered asset and confirms at least 85 quantized depth levels across the thin gap that previously collided. The UI motion check covers staged visibility, 24 interrupted transitions, frame-rate parity and reduced motion.

Actual browser observations at 1280×720 CSS pixels:

- Main drawing buffer: 1920×1080; MSAA: 4; interactive DOF: false; exact-geometry PCF: 4096; AO projection synchronized.
- Both acrylic material groups report the intended roughness/transmission and no frosted maps. Main and detail screenshots retain the warm archive style and visible internal rings.
- The viewer reached 512 samples at 1920×1080 with the installed tracer and denoiser. The ray image was visually inspected in assembled and fully exploded states.
- Rotation changed the camera angle and immediately reset sampling to zero with the realtime preview visible. Fully exploded parts reached z = 2.75, 1.85, 0.75, -0.15, -1.1, -2.05; the traced image showed separated transparent parts with updated occlusion. Reassembly and exiting during motion returned to the archive.
- Runtime backend for both renderers: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 D v2 (0x00002B8C) Direct3D11 vs_5_0 ps_5_0, D3D11)`. This confirms actual NVIDIA GPU rendering, not merely a requested high-performance preference.

## Boundaries

This is WebGL2 GPU shader path tracing, not direct access to dedicated RTX ray-tracing cores or Blender Cycles running inside the webpage. Initial shader compilation and progressive sampling take time. Layered transparent surfaces retain some Monte Carlo grain at the sample ceiling; the realtime view stays available through the toggle. No frame-rate or convergence-time guarantee is claimed.

The upstream tracer does not directly support instanced geometry. This initial implementation therefore traced the independent viewer only. The subsequent homepage integration expands actual instances into a tracing snapshot, with background BVH construction and motion-aware sampling; see `HOME-PATHTRACING.md`.

Primary references: [three-gpu-pathtracer documentation and limitations](https://github.com/gkjohnson/three-gpu-pathtracer), [three-mesh-bvh API](https://github.com/gkjohnson/three-mesh-bvh/blob/master/API.md).
