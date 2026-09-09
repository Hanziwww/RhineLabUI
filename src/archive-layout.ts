const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function archiveLayout(width: number, headingWidth: number) {
  const gutter = clamp(width * 0.031, 24, 64);
  const panelWidth = Math.min(
    clamp(headingWidth + 64, 440, 520),
    width - 2 * gutter,
  );
  // Center the reading block in the space beside the model, with equal side
  // breathing room. Small screens use the full readable width instead.
  const center = width < 960 ? width / 2 : (width * 0.56 + width - gutter) / 2;
  const left = clamp(
    center - panelWidth / 2,
    gutter,
    width - gutter - panelWidth,
  );
  const navigationWidth =
    width < 720
      ? Math.min(300, width - 2 * gutter - 156)
      : Math.min(360, panelWidth);
  const navigationLeft =
    width < 720
      ? width - gutter - navigationWidth
      : left + (panelWidth - navigationWidth) / 2;
  return { gutter, left, panelWidth, navigationLeft, navigationWidth };
}
