import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { create, extract } from "tar";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notices = [
  "DATA-LICENSE.txt",
  "ATTRIBUTION.md",
  "citation.bib",
  "import-report.json",
];

async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function filesBelow(dir, prefix = "") {
  const files = [];
  for (const entry of await fs.readdir(path.join(dir, prefix), {
    withFileTypes: true,
  })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await filesBelow(dir, relative)));
    else if (entry.isFile()) files.push(relative);
    else
      throw new Error(`${relative}: data packages only support regular files`);
  }
  return files.sort();
}

async function inventory(dir, files) {
  const tree = createHash("sha256");
  let bytes = 0;
  for (const name of files) {
    const file = path.join(dir, name);
    bytes += (await fs.stat(file)).size;
    tree.update(`${name}\0${await hashFile(file)}\n`);
  }
  return { files: files.length, bytes, treeSha256: tree.digest("hex") };
}

export async function packSiteData(dir) {
  const dataFiles = await filesBelow(path.join(dir, "data"));
  const files = [...dataFiles.map((name) => `data/${name}`), ...notices].sort();
  const sourceLicense = await fs.readFile(
    path.join(dir, "data/LICENSE.txt"),
    "utf8",
  );
  if (
    sourceLicense.replaceAll("\r\n", "\n") !==
    (await fs.readFile(path.join(dir, "DATA-LICENSE.txt"), "utf8")).replaceAll(
      "\r\n",
      "\n",
    )
  )
    throw new Error(
      "DATA-LICENSE.txt must match the imported data/LICENSE.txt before packing",
    );
  const contents = await inventory(dir, files);
  const folder = path.join(dir, "snapshot");
  await fs.mkdir(folder, { recursive: true });
  const archive = path.join(folder, "data.tar.gz");
  const temporary = `${archive}.tmp`;
  await create(
    {
      cwd: dir,
      file: temporary,
      gzip: { level: 9 },
      portable: true,
      noMtime: true,
      strict: true,
    },
    files,
  );
  await fs.rename(temporary, archive);
  const report = JSON.parse(
    await fs.readFile(path.join(dir, "import-report.json"), "utf8"),
  );
  const metadata = {
    formatVersion: 1,
    archive: "data.tar.gz",
    sha256: await hashFile(archive),
    compressedBytes: (await fs.stat(archive)).size,
    contents,
    dataFiles: dataFiles.length,
    importedAt: report.importedAt,
    counts: report.counts,
    attribution:
      "IEKB / Tian-lab; adapted for RHINE AUDIOLOGY. See ATTRIBUTION.md inside the archive.",
    license:
      "CC-BY-4.0 for Tian-lab-authored data; third-party terms retained. See DATA-LICENSE.txt.",
    preprint: "https://doi.org/10.64898/2026.04.06.716823",
  };
  await fs.writeFile(
    path.join(folder, "package.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );
  console.log(
    `Packed ${dataFiles.length} data files: ${contents.bytes} -> ${metadata.compressedBytes} bytes.`,
  );
  return metadata;
}

// Existing imports are left intact. Only a missing generated data directory is restored.
export async function ensureSiteData(dir) {
  const packageFile = path.join(dir, "snapshot/package.json");
  const metadata = await fs
    .readFile(packageFile, "utf8")
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
  if (!metadata) return false;
  const data = path.join(dir, "data");
  if (
    await fs.stat(data).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    })
  ) {
    await fs.access(path.join(data, "manifest.json")).catch(() => {
      throw new Error(
        `${data}: incomplete data directory; move it aside, then run npm run data:restore`,
      );
    });
    return false;
  }
  if (metadata.formatVersion !== 1 || metadata.archive !== "data.tar.gz")
    throw new Error(`${packageFile}: unsupported data package`);
  const archive = path.join(dir, "snapshot", metadata.archive);
  if ((await hashFile(archive)) !== metadata.sha256)
    throw new Error(`${archive}: SHA-256 mismatch; obtain the package again`);
  console.log(
    `Restoring ${path.basename(dir)} data from the bundled archive...`,
  );
  const temporary = await fs.mkdtemp(path.join(dir, ".data-restore-"));
  try {
    await extract({
      cwd: temporary,
      file: archive,
      strict: true,
      preservePaths: false,
      filter: (name, entry) => {
        const relative = name.replaceAll("\\", "/");
        const valid =
          entry.type === "File" &&
          !relative.includes(":") &&
          !relative.startsWith("/") &&
          !relative.split("/").includes("..") &&
          (relative.startsWith("data/") || notices.includes(relative));
        if (!valid) throw new Error(`${name}: unsupported archive entry`);
        return true;
      },
    });
    const restored = await inventory(temporary, await filesBelow(temporary));
    if (
      restored.files !== metadata.contents.files ||
      restored.bytes !== metadata.contents.bytes ||
      restored.treeSha256 !== metadata.contents.treeSha256
    )
      throw new Error(
        `${archive}: restored file inventory does not match the package`,
      );
    await fs.access(path.join(temporary, "data/manifest.json"));
    await fs.rename(path.join(temporary, "data"), data);
    console.log(`Restored and verified ${metadata.dataFiles} data files.`);
    return true;
  } finally {
    // This fresh temporary directory is created inside the selected site.
    const resolved = await fs.realpath(temporary);
    if (path.dirname(resolved) !== (await fs.realpath(dir)))
      throw new Error(
        "Refusing to remove a temporary directory outside the site",
      );
    await fs.rm(resolved, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [command = "restore", id = "rhine-audiology"] = process.argv.slice(2);
  try {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
      throw new Error("Use a site ID such as rhine-audiology");
    const dir = path.join(root, "sites", id);
    if (command === "pack") await packSiteData(dir);
    else if (command === "restore") {
      if (!(await ensureSiteData(dir)))
        console.log(
          `${id}: existing data retained, or no bundled data package.`,
        );
    } else throw new Error(`Unknown data command: ${command}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
