// The interactive array stays within 60 world units of the camera target,
// including the visible pool, entrance travel and fully extracted cards.
// A near plane at 0.1 wastes almost all depth precision with a camera 140 away.
export function archiveDepthRange(distance: number, reference = false) {
  return reference
    ? { near: 5, far: 300 }
    : { near: Math.max(5, distance - 60), far: distance + 60 };
}

// Match actual display pixels after the stage's CSS transform. Small displays
// get modest supersampling; large/high-DPI displays retain native detail.
export function archivePixelRatio(
  width: number,
  height: number,
  cssScale: number,
  dpr: number,
  high = true,
) {
  const visiblePixels = width * height * cssScale * cssScale;
  const requested = high
    ? Math.max(dpr, visiblePixels < 2_100_000 ? 1.5 : 1)
    : Math.min(dpr, 1);
  return (
    cssScale *
    Math.min(
      requested,
      high ? 2.5 : 1,
      Math.sqrt(12_000_000 / Math.max(visiblePixels, 1)),
    )
  );
}

export function graphicsBackend(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
) {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return String(
    gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
  );
}
