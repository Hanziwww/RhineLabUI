# Rhine archive template

RhineUI now contains one shared TypeScript / Three.js / Vite engine and independent site folders. A normal build needs only this repository and `npm ci`; it never reads the original IEKB directory. The existing Cloudflare deployment has not been changed.

## Run a site

| Site | Development | Build | Built-file preview | Output |
| --- | --- | --- | --- | --- |
| Original Rhine | `npm run dev` | `npm run build` | `npm run preview` | `dist/rhine/` |
| RHINE AUDIOLOGY | `npm run dev:audiology` | `npm run build:audiology` | `npm run preview:audiology` | `dist/rhine-audiology/` |
| Any other site | `npm run dev -- my-site` | `npm run build -- my-site` | `npm run preview -- my-site` | `dist/my-site/` |

Rhine uses **5173**, Audiology **5174**. Development and built-file preview use the configured port, so stop that site's development server before starting its production preview. Both sites can run simultaneously. Ports are strict: a server fails instead of silently choosing the other site's port.

`?scene=archive`, `?scene=detail`, `?time=...`, `?freeze=1` and the original reference-review entry remain available. A stable detail URL looks like `/?document=sensorineural-hearing-loss` or `/?document=X-001`. Use a heading fragment to link to a Markdown section, for example `/?document=welcome#structured-content`.

## Create a site

```sh
npm run site:create -- my-site
npm run validate -- my-site
npm run dev -- my-site
```

This creates `sites/my-site/site.json`, an editable `content/welcome.md`, and a separate `wrangler.jsonc`. It copies no Cloudflare account ID or credentials. The supplied `sites/example-notes/` was created with this command and demonstrates a one-column, one-document site. Choose another `port` when running more sites simultaneously.

```text
src/                       shared scene, animation, reader, search and navigation
schemas/                   SiteConfig and document frontmatter JSON Schema
sites/<id>/site.json        brand, columns, labels, defaults, theme, feature flags
sites/<id>/content/**/*.md  authored content (safe to edit)
sites/<id>/public/          optional assets, overriding the shared public directory
sites/<id>/data/            expanded local dataset, only for data-backed sites
sites/<id>/snapshot/        compressed distributable dataset and verified inventory
sites/<id>/generated/       generated catalog, compiled bodies and text exports
.generated/<id>/            isolated Vite cache and staged public files
dist/<id>/                  independently deployable output
```

Do not edit `generated/`, `.generated/` or `dist/`. Shared Blender models and fonts stay in `public/`; each site's own `public/` can override a shared asset without changing another site. Blender source and reproducible scripts remain in `art/`.

## SiteConfig

`site.json` points at `schemas/site.schema.json`. Keep its `id` equal to the directory name. The principal fields are:

- `brand`: name, subtitle, system label, company name, database label, session operator, mark text, printed-label code and export filename prefix. An optional `logo: "/assets/my-logo.svg"` uses a supplied site asset on the opening screen and printed model label. The shared Rhine mark is the default.
- `columns`: ordered `{ id, title }` entries. Their IDs are referenced by document frontmatter. Every configured column must contain at least one document. `filterOrder` may specify a different search-filter order; the default Rhine order is preserved.
- `defaultDocument`: a stable document ID, independent of its filename and display number.
- `numberPrefix`: for example `X-`, `IE-` or `DOC-`. Rolling display numbers are taken from each document's `number`, never parsed from its ID.
- `labels`: override a named UI label such as `overview`, `expandReading`, `fileNumber`, or a literal original UI string such as `ARCHIVE INDEX`. See `src/ui-language.ts` for the existing English/Chinese UI copy. `locale: "en"` selects English; `zh-CN` retains the original bilingual interface.
- `theme`: the existing `warm` or `baseline` lighting preset plus background, ink and focus-accent colors. Scene geometry and the accepted motion timeline remain shared.
- `features`: `expandedReader`, `knowledgeBase`, `pathTracing`. The original site has expanded reading disabled. `knowledgeBase` expects the IEKB static-data adapter's snapshot format; ordinary Markdown sites leave it false.

The public contracts are in `src/content-types.ts`: `SiteConfig`, `ArchiveDocument`, `DocumentBody` and `ContentProvider`. The scene consumes the lightweight directory; it does not depend on phenotype or gene-record fields.

## Markdown documents

Use a YAML frontmatter block followed by ordinary Markdown. See `docs/example-document.md` for a working document with a table, task list, image, footnote, code and formulas.

```yaml
---
id: stable-project-id
number: 12
title: A project you can rename
subtitle: RESEARCH ARCHIVE
column: notes
tags: [research, methods]
summary: A short description for search.
metadata:
  - label: AUTHOR
    value: Your name
source: https://example.org/reference
layout: markdown
tabsFromHeadings: true
---
```

`id`, `number`, `title` and `column` are required. IDs and numbers are unique within a site. IDs may contain letters, digits, underscores and hyphens; filenames can be independently renamed or placed in subfolders. YAML dates used as metadata should be quoted. `order` optionally controls document ordering; otherwise `number` does.

With `tabsFromHeadings: true`, level-two headings become reading tabs. Without it, the document is a continuous article. GFM tables, task lists, footnotes, fenced code, quotes, links, images and inline/display math are compiled at build time. Images use an absolute site path, e.g. `/assets/photo.png`, backed by `sites/<id>/public/assets/photo.png`. Use relative `.md` links for other documents; the compiler resolves them to stable-ID URLs and checks target headings. External HTTP(S) links are checked for syntax, not network availability.

Markdown never runs JavaScript or MDX. Raw HTML is omitted, the converted HTML is sanitized, and KaTeX runs with `trust: false`. Only the compiled HTML is sent to the reader; no Markdown compiler is shipped to the browser. Long code, wide tables and display formulas scroll within their own blocks.

The original 40 documents use `layout: legacy`. Their first H2 section supplies the overview paragraph and their second supplies the research-note list. Access logs are generated from the current session. **The Markdown body is the only source for those paragraphs and notes**; there is no second frontmatter copy to update.

## IEKB snapshot

`sites/rhine-audiology/content/` holds editable English topic introductions. Git distributes the lossless `snapshot/data.tar.gz` package and its `package.json` inventory. On first development, validation or build, Node restores the missing `data/` directory, checking both the archive SHA-256 and the extracted file inventory. No Python or external data download is needed. Existing `data/` is retained; to adopt an updated bundled package, move the old generated directory aside and run `npm run data:restore`. Authored Markdown is untouched. The default site neither restores nor stages this dataset.

`import-report.json` records provenance and counts. The importer uses association CSV as the primary source, retaining `raw_phenotype`, `association_type` and `phenotype_mapping_rule`, and augments it with the interaction CSV and read-only SQLite identifiers, aliases, source claims, literature, ClinGen, HHL and known network relations.

```sh
npm run import:iekb -- --source C:\workdir\project\iekb
npm run data:pack
npm run check:package
npm run validate -- rhine-audiology
npm run build:audiology
```

Reimporting creates only missing topic Markdown files; it never overwrites existing introductions, custom titles or notes. It updates managed data and statistics. The five navigation columns do not reinterpret the normalized source phenotypes. A changed phenotype vocabulary requires an explicit update to `GROUPS` in the importer; count changes are reported for review.

The delivered release contains 44 topics, 3,444 associated genes, 7,376 CSV records (6,448 phenotype and 928 mechanism/expression), 4,073 interactions and 55,579 non-predictive claims. All 66 interactions without topic-linked genes remain accessible in **Explore the full snapshot**. Source predicates and human-review/verification fields remain intact. Network relations do not create additional phenotype associations.

Directory and overviews are small. Bodies, topic statistics, 50-row pages, gene summaries, provenance and literature buckets are loaded when opened. The complete SQLite database is never copied into the website. Search loads a separate index on first use and supports gene aliases, disease names, PMIDs, evidence and cell-type filters. Data, evidence pagination and source attribution are independent of the authored introductions.

Commit the updated `snapshot/` and import report after reimporting; expanded `data/` stays ignored. `data:pack` requires `DATA-LICENSE.txt` to match the imported notice and includes attribution, citation and the report inside the archive. `check:package` extracts into a disposable folder and compares every restored data file with the local import.

Tian-lab-authored data retains CC BY 4.0; the full original notice is tracked as [DATA-LICENSE.txt](../sites/rhine-audiology/DATA-LICENSE.txt) and restored at `data/LICENSE.txt`. Third-party source terms remain applicable. See [ATTRIBUTION.md](../sites/rhine-audiology/ATTRIBUTION.md) and [citation.bib](../sites/rhine-audiology/citation.bib) for the IEKB bioRxiv preprint, DOI `10.64898/2026.04.06.716823`, and adaptation details. The September snapshot counts are independent of the April preprint. Branding does not imply endorsement. Dark Matter, predictions, enrichment and Q&A are excluded.

## Isolation and deployment

Local storage keys begin with `rhine-site:<id>:`. Only the default `rhine` site imports the old `rhine-saved` and `rhine-settings` keys, once. The old keys are left intact. No other site imports them.

Future deployment must name the site explicitly:

```sh
npm run deploy -- rhine
npm run deploy -- rhine-audiology
npm run deploy -- my-site
```

These commands build the selected site and run Wrangler with that site's config. The original target remains `rhine-lab-analysis-os`; the Audiology target is separate and has no preconfigured account. Authenticate Wrangler and set the intended target/account before your first deployment. **No deployment was performed for this template conversion.**

## Verification

```sh
npm run check:template
npm run check:core
npm run check:data -- --source C:\workdir\project\iekb
npm run check:browser
npm run check:gpu
npm run check:reader
npm run check:editing
```

Browser checks use an isolated installed Edge instance with development servers at 5173 and 5174. The extended reader check additionally uses the example site at 5175. Reports and reviewed screenshots are in `verification/template/`. Core checks cover the original array, extraction, returning materials, animation phases and path-tracing geometry. Template checks exercise 234,000 directional moves over different column lengths, Markdown and schema errors, unchanged default text/exports and build isolation. Data comparison requires IEKB only for auditing or reimporting, not for normal use.

For the final built-output check, start two additional previews in separate PowerShell terminals:

```powershell
$env:RHINE_SITE='rhine'
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5273 --strictPort
```

```powershell
$env:RHINE_SITE='rhine-audiology'
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5274 --strictPort
```

Then run `npm run check:production`. This checks built worker assets, actual GPU samples, lazy first-screen requests, default-only storage migration, body loading and gene search. `npm run check:boot` uses the same previews to check nine reference-timeline phases, branded opening text, English case captions and real mouse/keyboard archive interactions. The consolidated results are in [the acceptance report](../verification/template/ACCEPTANCE.md).
