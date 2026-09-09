// The importer uses the same YAML parser as the build, so renamed files and
// user-edited stable IDs do not cause duplicate topic introductions.
import path from "node:path";
import fs from "node:fs/promises";
import { filesBelow, parseDocument, sitePath } from "./content.mjs";
const dir = sitePath(process.argv[2]);
const items = [];
for (const file of (await filesBelow(path.join(dir, "content"))).filter((f) =>
  f.endsWith(".md"),
)) {
  const { meta } = parseDocument(await fs.readFile(file, "utf8"), file);
  items.push({ id: meta.id, dataKey: meta.dataKey, file });
}
process.stdout.write(JSON.stringify(items));
