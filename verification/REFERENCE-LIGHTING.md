# Lighting matched to the supplied reference frame

2026-09-08. Reference: the user's `codex-clipboard-04413dc8-6079-4e78-8b38-1e4ded018c91.png`. The original MP4 and extracted motion frames are absent from this checkout. The supplied image was inspected without modification; a neutral background region averages RGB (235, 231, 227).

The target is neutral warm-white surroundings, pale highlights and localized amber transmission. Earlier whole-frame yellow tint and dark traced faces differed from that target.

## Changes

- `archive-lighting.ts` provides the same white studio to the realtime renderer and both tracers. Neutral room fill softens dark reflections; a near-neutral key and separate amber side light keep warmth localized. Exposure is 0.96, raster environment 0.42, traced environment 0.58 and room ambient fill 2.0. Baseline/refined reference configurations are unchanged.
- The tracing snapshot now maps the source mesh's `castShadow` to the material property read by `three-gpu-pathtracer`. Previously the library defaulted every material to a caster, including skins excluded by the original scene. This follows the scene's existing lighting approximation: opaque inserts cast geometric shadows, while clear skins remain visible to reflection and transmission rays without adding shadow occlusion. It is not a claim of an unbiased caustic solution.
- Traced array substrate is warm cream (#cbb497). The moulded frame retains 76% transmission with roughness 0.16 and zero metallic response. Front covers retain their transparent acrylic shading.
- The production atmosphere returns to the reference's neutral warm-white background instead of the earlier darker yellow-grey overlay.

## Checks

- `scripts/check-archive-pathtracing.mjs` includes a regression for material shadow flags on expanded non-casting instances and casting meshes. It also retains actual GLB geometry, transforms, pool ownership, RGBA and source immutability checks.
- The white-studio/substrate calibration was visually inspected at **512 samples**, complete state, **1920×1080** drawing size in a **1280×720** browser viewport. The engine reported 2,615,296 triangles and the NVIDIA RTX 5090 D v2 / ANGLE backend. The preceding dark-wall rendering was also inspected directly for comparison.
- That complete frame preceded the final frame-transmission adjustment from 0.92 to 0.76. Later browser tabs were repeatedly reclaimed during checks; do not treat the earlier 512-sample observation as a new full convergence check of every final parameter.
- Production build and snapshot regression are the final automated checks. Model geometry and UI motion logic were not changed.
