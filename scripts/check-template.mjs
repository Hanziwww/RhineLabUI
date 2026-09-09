import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { buildContent, root, json, sitePath } from "./content.mjs";
import {
  fileAtCell,
  selectionCell,
  visibleCell,
  wrap,
} from "../src/archive-loop.ts";
import { searchKnowledge } from "../src/content-provider.ts";

const report = { checks: [], navigationMoves: 0 };
const ok = (name) => {
  report.checks.push(name);
  console.log(name);
};
const baseline = await json(
  path.join(root, "verification/template/default-records.json"),
);
const rhine = await buildContent("rhine", { stage: false });
assert.equal(rhine.documents.length, 40);
assert.deepEqual(
  rhine.config.columns.map((c) => c.title),
  baseline.archiveColumns,
);
for (const [i, d] of rhine.documents.entries()) {
  const old = baseline.records[i];
  for (const [field, oldField] of [
    ["id", "id"],
    ["title", "title"],
    ["subtitle", "en"],
    ["summary", "abstract"],
    ["source", "source"],
  ])
    assert.equal(d[field], old[oldField]);
  assert.deepEqual(d.metadata.map((m) => m.value).slice(0, 3), [
    old.department,
    old.date,
    old.lead,
  ]);
  assert.equal(
    rhine.config.columns.find((c) => c.id === d.column).title,
    old.category,
  );
  const body = await json(
    path.join(root, `sites/rhine/generated/documents/${d.id}.json`),
  );
  assert.deepEqual(body.legacy, {
    abstract: old.abstract,
    findings: old.findings,
  });
  assert.equal(
    await fs.readFile(
      path.join(root, `sites/rhine/generated/exports/RHINE-LAB-${d.id}.txt`),
      "utf8",
    ),
    await fs.readFile(
      path.join(root, `public/archives/RHINE-LAB-${d.id}.txt`),
      "utf8",
    ),
  );
}
ok(
  "40 default documents, column order, original text and download exports unchanged",
);
for (const counts of [
  [1],
  [7],
  [8],
  [9],
  [12],
  [33],
  [1, 7, 8, 9, 12, 33],
  [12, 8, 8, 7, 9],
  [33, 1, 7, 12, 9, 8, 1],
]) {
  let index = 0;
  const columns = counts.map((n) => Array.from({ length: n }, () => index++));
  const locations = columns.flatMap((files, lane) =>
    files.map((_, row) => ({ lane, row: 12 + row })),
  );
  const catalog = {
    columnCount: columns.length,
    files: (lane) => columns[lane],
    location: (i) => locations[i],
  };
  for (const [i, location] of locations.entries()) {
    const referenceCell = {
      lane: location.lane % 5,
      row: Math.min(31, location.row),
    };
    const origin = {
      lane: location.lane - referenceCell.lane,
      row: location.row - referenceCell.row,
    };
    assert.equal(fileAtCell(referenceCell, origin, catalog), i);
  }
  for (const direction of [-1, 1]) {
    let selected = 0,
      cell = { lane: 0, row: 12 },
      origin = { lane: 0, row: 0 };
    const memory = columns.map((c) => c[0]);
    for (let step = 0; step < 13000; step++) {
      const axis =
        step < 4400
          ? "row"
          : step < 8800
            ? "lane"
            : step % 3 === 0
              ? "lane"
              : "row";
      const loc = locations[selected];
      const next =
        axis === "row"
          ? columns[loc.lane][
              wrap(
                columns[loc.lane].indexOf(selected) + direction,
                counts[loc.lane],
              )
            ]
          : memory[wrap(loc.lane + direction, counts.length)];
      const before = { ...cell };
      cell = selectionCell(next, cell, { axis, direction }, origin, catalog);
      assert.equal(cell[axis], before[axis] + direction);
      selected = next;
      memory[locations[next].lane] = next;
      assert.equal(fileAtCell(cell, origin, catalog), selected);
      const shift = {
        lane:
          Math.abs(cell.lane) > 2048
            ? Math.trunc((cell.lane - 2) / 1024) * 1024
            : 0,
        row:
          Math.abs(cell.row) > 2048
            ? Math.trunc((cell.row - 12) / 1024) * 1024
            : 0,
      };
      cell = { lane: cell.lane - shift.lane, row: cell.row - shift.row };
      origin = { lane: origin.lane + shift.lane, row: origin.row + shift.row };
      assert.equal(
        fileAtCell(cell, origin, catalog),
        selected,
        "Rebase must preserve semantic identity",
      );
      if (step % 1000 === 0) {
        const pool = Array.from({ length: 288 }, (_, i) =>
          visibleCell(i, cell),
        );
        assert.equal(new Set(pool.map((c) => `${c.lane}:${c.row}`)).size, 288);
        for (const target of pool.slice(0, 15)) {
          const targetIndex = fileAtCell(target, origin, catalog);
          assert.deepEqual(
            selectionCell(targetIndex, cell, { cell: target }, origin, catalog),
            target,
          );
        }
      }
      report.navigationMoves++;
    }
  }
}
ok(
  "Variable counts 1/7/8/9/12/33, unequal columns, rebase, directional seams and fixed 288-cell pool",
);

const customTopic = {
  ...rhine.documents[0],
  id: "custom-topic-id",
  title: "Edited topic title",
  layout: "knowledge",
  dataKey: "original-topic-key",
  column: "custom-column",
};
const searchSnapshot = {
  genes: [
    {
      id: "HGNC:1",
      symbol: "GENE1",
      name: "Example gene",
      aliases: ["ALIAS1"],
    },
  ],
  topics: [
    { id: "original-topic-key", title: "Original title", column: "old-column" },
  ],
  records: [
    {
      gene: "HGNC:1",
      topic: "original-topic-key",
      column: "old-column",
      disease: "Example disease",
      pmids: "12345",
      type: "phenotype",
      evidence: "curated",
      cells: ["hair cell"],
    },
  ],
  evidence: ["curated"],
  cells: ["hair cell"],
};
const results = searchKnowledge(
  searchSnapshot,
  "ALIAS1",
  { column: "custom-column" },
  [customTopic],
);
assert.equal(results.hits[0].geneId, "HGNC:1");
assert.ok(results.hits.every((hit) => hit.id === "custom-topic-id"));
assert.equal(
  searchKnowledge(searchSnapshot, "Edited topic", {}, [customTopic]).total,
  2,
);
assert.equal(searchKnowledge(searchSnapshot, "ALIAS1", {}, []).total, 0);
ok(
  "Knowledge search follows authored stable IDs, titles and columns without changing source phenotype keys",
);

const id = `test-fixture-${process.pid}`,
  dir = sitePath(id);
try {
  await fs.mkdir(path.join(dir, "content"), { recursive: true });
  const cfg = await json(path.join(root, "sites/example-notes/site.json"));
  Object.assign(cfg, {
    id,
    defaultDocument: "test",
    columns: [{ id: "notes", title: "Notes" }],
    filterOrder: ["notes"],
  });
  await fs.writeFile(path.join(dir, "site.json"), JSON.stringify(cfg));
  const metadata = {
    id: "test",
    number: 1,
    title: "Compiler test",
    column: "notes",
    tabsFromHeadings: true,
  };
  const source = (body) =>
    "---\n" + JSON.stringify(metadata) + "\n---\n" + body;
  const md =
    '## First\n\n[Internal](./second.md#target)\n\n- [x] task\n\nNote[^one]\n\n[^one]: Footnote text\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nInline $x^2$\n\n$$\n\\int_0^1 x\\,dx\n$$\n\n![Mark](/favicon.svg)\n\n```js\nconst longLine = "' +
    "x".repeat(1000) +
    '";\n```\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n## Second\n\nAnother section.\n';
  const file = path.join(dir, "content/arbitrary-filename.md");
  await fs.writeFile(file, source(md));
  await fs.writeFile(
    path.join(dir, "content/second.md"),
    "---\nid: second\nnumber: 2\ntitle: Target\ncolumn: notes\n---\n## Target\n\nLinked content.",
  );
  await buildContent(id, { stage: false });
  const body = await json(path.join(dir, "generated/documents/test.json"));
  for (const token of [
    "<table>",
    'type="checkbox"',
    "footnote",
    'class="katex',
    "<pre>",
    '<img src="/favicon.svg"',
  ])
    assert.ok(body.html.includes(token), token);
  assert.ok(!/<script|onerror=|javascript:/i.test(body.html));
  assert.equal(body.sections.length, 2);
  assert.equal(body.sections[1].id, "second");
  for (const [bad, field] of [
    ["[Bad](javascript:alert)", "unsafe protocol"],
    ["![Missing](/no-such-image.png)", "missing resource"],
    ["[Bad](./second.md#missing)", "missing target heading"],
    ["[Bad](./missing.md)", "missing document"],
  ]) {
    await fs.writeFile(file, source(bad));
    await assert.rejects(
      buildContent(id, { stage: false }),
      (e) =>
        e.message.includes("arbitrary-filename.md") &&
        e.message.includes(field),
    );
  }
  for (const [change, field] of [
    [{ id: "second" }, "duplicate"],
    [{ column: "missing" }, "column"],
    [{ number: 0 }, "/number"],
  ]) {
    await fs.writeFile(
      file,
      "---\n" +
        JSON.stringify({ ...metadata, ...change }) +
        "\n---\nValid text.",
    );
    await assert.rejects(
      buildContent(id, { stage: false }),
      (e) =>
        e.message.includes("arbitrary-filename.md") &&
        e.message.includes(field),
    );
  }
  ok(
    "GFM, footnotes, inline/display math, images, long code, safe HTML, relative links and actionable validation errors",
  );
} finally {
  const resolved = path.resolve(dir);
  if (
    !resolved.startsWith(path.join(root, "sites", "test-fixture-")) ||
    (await fs.lstat(resolved)).isSymbolicLink()
  )
    throw new Error("Unsafe fixture cleanup");
  await fs.rm(resolved, { recursive: true, force: true });
}
const third = await json(path.join(root, "sites/example-notes/wrangler.jsonc"));
assert.equal(third.account_id, undefined);
assert.equal(
  await fs.stat(path.join(root, "dist/rhine/data")).catch(() => null),
  null,
);
const bundled = await fs.readdir(path.join(root, "dist/rhine/assets"));
for (const name of bundled.filter((n) => n.endsWith(".js")))
  assert.ok(
    !(
      await fs.readFile(path.join(root, "dist/rhine/assets", name), "utf8")
    ).includes("sensorineural-hearing-loss"),
  );
ok(
  "Third-site creation excludes Cloudflare account; default build contains no IEKB snapshot",
);
await fs.writeFile(
  path.join(root, "verification/template/template-report.json"),
  JSON.stringify(report, null, 2),
);
