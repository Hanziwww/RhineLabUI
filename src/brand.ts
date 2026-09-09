import { site, escapeHtml as h } from "./site";
// One shared mark for the interface and the printed archive label.
const paths = `<path d="M156 75C127 48 103 15 70 15C37 15 15 39 15 70S38 128 70 128C103 128 127 96 176 52M155 75C182 99 208 128 240 128C273 128 295 105 295 73S273 15 240 15C221 15 207 23 192 38" fill="none" stroke="currentColor" stroke-width="26"/><path d="M44 70h50M69 45v50M219 70h44" fill="none" stroke="currentColor" stroke-width="15"/>`;
export const labelMarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 145" color="#171713">${paths}</svg>`;
const mark = site.brand.logo
  ? paths.replaceAll("<path ", '<path opacity="0" ') +
    `<image href="${h(site.brand.logo)}" x="0" y="0" width="310" height="145"/>`
  : paths;
export const logo = `<svg viewBox="0 0 310 185" aria-label="${h(site.brand.name)}" role="img">${mark}<text x="165" y="174" text-anchor="middle" font-family="MiSans,sans-serif" font-size="16" font-weight="700" letter-spacing="${site.brand.markText === "RHINE·LAB" ? 22 : 5}">${h(site.brand.markText)}</text></svg>`;
// Same Bezier geometry, ordered along the reference's drawing direction.
export const bootMarkStrokes = [
  "M295 73C295 41 273 15 240 15C221 15 207 23 192 38",
  "M176 52C127 96 103 128 70 128C38 128 15 101 15 70C15 39 37 15 70 15C103 15 127 48 156 75",
  "M155 75C182 99 208 128 240 128C273 128 295 105 295 73",
];
// Upstream's continuous contour allows both drawing and erasing the same mark.
export const bootMarkContour =
  "M295 73C295 41 273 15 240 15C221 15 207 23 192 38C186 43 181 47 176 52C127 96 103 128 70 128C38 128 15 101 15 70C15 39 37 15 70 15C103 15 127 48 156 75C182 99 208 128 240 128C273 128 295 105 295 73Z";
