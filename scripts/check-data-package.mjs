import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSiteData } from "./data-package.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "sites/rhine-audiology");
const generated = path.join(root, ".generated");
await fs.mkdir(generated, { recursive: true });
const temporary = await fs.mkdtemp(path.join(generated, "data-package-check-"));
const report = { checkedAt: new Date().toISOString(), checks: [] };
try {
  await ensureSiteData(source);
  const restored = path.join(temporary, "fresh-site");
  await fs.mkdir(restored);
  await fs.cp(path.join(source, "snapshot"), path.join(restored, "snapshot"), {
    recursive: true,
  });
  assert.equal(await ensureSiteData(restored), true);
  report.checks.push(
    "Fresh checkout: bundled data restored using Node only, with archive and extracted-file checksums",
  );

  const names = (
    await fs.readdir(path.join(source, "data"), {
      recursive: true,
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(
        path.join(source, "data"),
        path.join(entry.parentPath, entry.name),
      ),
    )
    .sort();
  for (let start = 0; start < names.length; start += 32) {
    await Promise.all(
      names.slice(start, start + 32).map(async (name) => {
        const [before, after] = await Promise.all([
          fs.readFile(path.join(source, "data", name)),
          fs.readFile(path.join(restored, "data", name)),
        ]);
        assert.ok(
          before.equals(after),
          `${name}: restored bytes differ from the imported file`,
        );
      }),
    );
  }
  const metadata = JSON.parse(
    await fs.readFile(path.join(source, "snapshot/package.json"), "utf8"),
  );
  assert.equal(names.length, metadata.dataFiles);
  report.dataFiles = names.length;
  report.compressedBytes = metadata.compressedBytes;
  report.uncompressedBytes = metadata.contents.bytes;
  report.sha256 = metadata.sha256;
  report.checks.push(
    `All ${names.length} data files are byte-identical to the local import`,
  );

  await fs.writeFile(
    path.join(restored, "data/local-marker.txt"),
    "Preserve local imports",
  );
  assert.equal(await ensureSiteData(restored), false);
  assert.equal(
    await fs.readFile(path.join(restored, "data/local-marker.txt"), "utf8"),
    "Preserve local imports",
  );
  report.checks.push("Existing local data is retained on repeated restore");

  const ordinary = path.join(temporary, "ordinary-site");
  await fs.mkdir(ordinary);
  assert.equal(await ensureSiteData(ordinary), false);
  assert.deepEqual(await fs.readdir(ordinary), []);
  report.checks.push(
    "Sites without a data package perform no extraction or writes",
  );

  const corrupt = path.join(temporary, "corrupt-site");
  await fs.mkdir(path.join(corrupt, "snapshot"), { recursive: true });
  await fs.copyFile(
    path.join(source, "snapshot/package.json"),
    path.join(corrupt, "snapshot/package.json"),
  );
  await fs.writeFile(
    path.join(corrupt, "snapshot/data.tar.gz"),
    "incomplete download",
  );
  await assert.rejects(ensureSiteData(corrupt), /SHA-256 mismatch/);
  assert.equal(
    await fs.stat(path.join(corrupt, "data")).catch(() => null),
    null,
  );
  report.checks.push(
    "Corrupted archive is rejected before creating a data directory",
  );

  report.passed = true;
  const output = path.join(root, "verification/template/package-report.json");
  await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  const resolved = await fs.realpath(temporary);
  assert.equal(path.dirname(resolved), await fs.realpath(generated));
  await fs.rm(resolved, { recursive: true, force: true });
}
