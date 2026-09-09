// A feathered clearing front travels from the top to the bottom of the cover.
// Progress endpoints are wholly frosted / wholly clear, including the rim.
const FEATHER = 0.12;
export function glassRevealAtHeight(progress: number, height: number) {
  const edge = 1 - (1 + 2 * FEATHER) * Math.max(0, Math.min(1, progress));
  const x = Math.max(
    0,
    Math.min(1, (Math.max(0, Math.min(1, height)) - edge) / (2 * FEATHER)),
  );
  return x * x * (3 - 2 * x);
}
export const glassRevealGLSL = `
float glassRevealAtHeight(float progress, float height) {
  float edge = 1.0 - ${1 + 2 * FEATHER} * clamp(progress, 0.0, 1.0);
  return smoothstep(edge, edge + ${2 * FEATHER}, clamp(height, 0.0, 1.0));
}`;
