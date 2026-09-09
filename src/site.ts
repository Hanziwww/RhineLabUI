// Vite selects a catalog per server/build. Node regression checks use Rhine.
import snapshot from "../sites/rhine/generated/catalog.json" with { type: "json" };
import type { ArchiveDocument, SiteConfig } from "./content-types.ts";
export const site = snapshot.config as SiteConfig;
export const directory = snapshot.documents as ArchiveDocument[];
export const english = site.locale === "en";
export const text = (key: string, zh: string, en: string) =>
  site.labels[key] ?? (english ? en : zh);
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const displayCode = (document: ArchiveDocument) =>
  `${site.numberPrefix}${String(document.number).padStart(3, "0")}`;
export const storageKey = (key: string) => `rhine-site:${site.id}:${key}`;
export function migrateDefaultStorage(storage: Storage) {
  if (site.id !== "rhine" || storage.getItem(storageKey("migrated"))) return;
  for (const key of ["saved", "settings"]) {
    const old = storage.getItem(`rhine-${key}`);
    if (old && !storage.getItem(storageKey(key)))
      storage.setItem(storageKey(key), old);
  }
  storage.setItem(storageKey("migrated"), "1");
}
