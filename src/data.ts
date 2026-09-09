import { directory, site, text } from "./site.ts";
import type { ArchiveDocument } from "./content-types.ts";
// Compatibility view for the existing presentation; Three.js only sees a directory.
export type ArchiveRecord = ArchiveDocument & {
  en: string;
  category: string;
  department: string;
  date: string;
  lead: string;
  clearance: string;
  abstract: string;
};
export const archiveColumns = site.columns.map((c) => c.title);
export const records: ArchiveRecord[] = directory.map((d) => ({
  ...d,
  en: d.subtitle,
  category: site.columns.find((c) => c.id === d.column)!.title,
  department: d.metadata[0]?.value ?? "",
  date: d.metadata[1]?.value ?? "",
  lead: d.metadata[2]?.value ?? "",
  clearance: (d as ArchiveDocument & { clearance?: string }).clearance ?? "",
  abstract: d.summary,
}));
export const categories = [
  text("allArchives", "全部档案", "All archives"),
  ...(site.filterOrder ?? site.columns.map((c) => c.id)).map(
    (id) => site.columns.find((c) => c.id === id)!.title,
  ),
];
const columnIndices = site.columns.map((c) =>
  records.flatMap((r, i) => (r.column === c.id ? [i] : [])),
);
export const columnFiles = (lane: number) => columnIndices[lane];
export function fileLocation(index: number) {
  const lane = site.columns.findIndex((c) => c.id === records[index].column);
  const row = 12 + columnIndices[lane].indexOf(index);
  // The original cinematic pool remains 5 x 32, separate from logical content.
  return { lane, row, slot: (lane % 5) * 32 + Math.min(31, row) };
}
export function fileAtSlot(slot: number) {
  const files = columnFiles(Math.floor(slot / 32) % site.columns.length);
  return files[Math.max(0, Math.min(files.length - 1, (slot % 32) - 12))];
}
