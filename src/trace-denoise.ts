// DenoiseMaterial applies opacity after premultiplication. During a crossfade
// that adds full-strength RGB over the raster frame and briefly blows out glass.
// Match the tracer's own canvas material: apply opacity before premultiplying.
export function denoiseFadeFragment(source: string) {
  return source
    .replace("#include <premultiplied_alpha_fragment>", "")
    .replace(
      "gl_FragColor.a *= opacity;",
      "gl_FragColor.a *= opacity;\n#include <premultiplied_alpha_fragment>",
    );
}
