# AI editing guide

## Choose the site first

Work only in the requested `sites/<id>/` folder unless an engine change is explicitly requested. `rhine` is the preserved original; `rhine-audiology` is the independent IEKB example. Their brands, content, public overrides, storage and outputs are separate. Do not publish as part of content editing.

## Add or edit content

1. Read `site.json` to find the allowed column IDs and locale.
2. Edit a Markdown file under `content/`, or copy `docs/example-document.md`. Keep a stable existing `id` when renaming a file or title. Give a new document a unique `id` and `number`.
3. Put ordinary prose below the closing `---`. Use H2 headings for configurable tabs; use `layout: markdown` for general content.
4. Put images or custom brand marks in `public/assets/` under that site and link with `/assets/...`. Link to other documents with a relative `.md` path or `?document=<stable-id>`.
5. Run `npm run validate -- <id>`, then `npm run build -- <id>`. Fix the reported source file and field, not generated output.
6. Preview with `npm run dev -- <id>` and inspect both the normal and narrow reading view.

The legacy Rhine layout reads its first overview paragraph and research-note list directly from the Markdown body. Preserve the original Chinese text and three-tab layout when only adapting the engine.

## Brand and navigation

Change `brand`, `numberPrefix`, `columns`, `defaultDocument`, `labels`, `theme` and `features` in `site.json`. No scene-code edit is needed to rename the brand or add a collection. Every column needs at least one document. Set a distinct development port for a new site. Do not copy an existing site's Cloudflare account into a new site.

Brand text also appears in the opening sequence, printed model label and downloaded text. The optional brand `logo` references a supplied site asset; otherwise the existing shared mark is used. Asset overrides belong in that site's `public/`, not the shared directory.

## IEKB-specific rules

- Edit only authored topic Markdown for introductions, titles or commentary. Do not hand-edit `data/` or `generated/`.
- Import through `npm run import:iekb -- --source <IEKB root>`. The source is read-only. Existing Markdown is not overwritten.
- Data is distributed in `snapshot/data.tar.gz` and restored automatically by Node on first use; no external IEKB checkout is needed for normal builds. After reimporting, run `npm run data:pack` and `npm run check:package`, then commit `snapshot/` and the updated report. Do not commit expanded `data/`. Existing local data is preserved; move it aside before restoring a newer bundled snapshot.
- Preserve stable HGNC identifiers, source row numbers, raw phenotype/disease text, association types, mapping rules, predicates and review status.
- A mechanism/expression mention is not automatically a phenotype association. A negative claim is not positive support. Source verification is not human review.
- Interactions and known network relations are context, not inferred phenotype memberships. Keep the full interactions overview and the unassigned records.
- Keep IEKB / Tian-lab attribution and the original data license. Do not add predictions, Dark Matter, enrichment or Q&A to this case.
- Retain `DATA-LICENSE.txt`, `ATTRIBUTION.md` and `citation.bib`, including the IEKB preprint DOI `10.64898/2026.04.06.716823`. Match the original imported license before repacking. Distinguish the data license from the MIT code license and snapshot counts from preprint-era counts.

## Engine changes

The shared boundaries are `src/content-types.ts`, `src/content-provider.ts`, `src/data.ts` and `src/archive-loop.ts`. Preserve the original 160 reference positions, the 288-instance interactive pool, vertical extraction, turning before lowering, rapid reselection continuity, UI transition timing, acrylic materials and lighting presets. Absolute content coordinates must remain correct across rebasing with unequal column lengths.

After an engine change, run `npm run check:core`, `npm run check:template`, and the applicable browser checks. Confirm that the default build has no `data/` folder or Audiology catalog. Leave a concrete local result and verification report; do not deploy unless asked.
