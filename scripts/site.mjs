import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildContent, root, sitePath, json } from "./content.mjs";
const [command = "dev", ...args] = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("-")) ?? "rhine";
const dir = sitePath(id);
function run(script, argv = [], env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...argv], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Command exited ${code}`)),
    );
  });
}
try {
  if (command === "create") {
    if (await fs.stat(dir).catch(() => null))
      throw new Error(`${dir} already exists; choose a new site ID`);
    const config = await json(path.join(root, "sites/rhine/site.json"));
    Object.assign(config, {
      id,
      locale: "en",
      title: `${id.toUpperCase()} · ARCHIVE`,
      description: "An independent archive built with the Rhine engine.",
      port: 5175,
      defaultDocument: "welcome",
      numberPrefix: "DOC-",
      columns: [{ id: "notes", title: "Notes" }],
      filterOrder: ["notes"],
      labels: {},
      features: {
        expandedReader: true,
        knowledgeBase: false,
        pathTracing: true,
      },
      exportNotice: "Add your content attribution and license here.",
    });
    config.brand = {
      ...config.brand,
      name: id.toUpperCase().replaceAll("-", " "),
      subtitle: "PERSONAL KNOWLEDGE ARCHIVE",
      company: id.toUpperCase(),
      operator: "READER",
      markText: id.toUpperCase(),
      labelCode: "KB / IS",
      exportPrefix: id.toUpperCase(),
    };
    await fs.mkdir(path.join(dir, "content"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "site.json"),
      JSON.stringify(config, null, 2) + "\n",
    );
    await fs.writeFile(
      path.join(dir, "content/welcome.md"),
      await fs.readFile(path.join(root, "docs/example-document.md"), "utf8"),
    );
    await fs.writeFile(
      path.join(dir, "wrangler.jsonc"),
      JSON.stringify(
        {
          $schema: "../../node_modules/wrangler/config-schema.json",
          name: id,
          compatibility_date: "2026-09-08",
          assets: { directory: `../../dist/${id}` },
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Created ${dir}. Edit site.json and content/*.md. No Cloudflare account was copied.`,
    );
  } else if (
    command === "dev" ||
    command === "build" ||
    command === "validate"
  ) {
    const snapshot = await buildContent(id, { stage: command !== "validate" });
    console.log(
      `${id}: validated ${snapshot.documents.length} documents in ${snapshot.config.columns.length} columns.`,
    );
    if (command === "build") {
      await run("node_modules/typescript/bin/tsc");
      await run("node_modules/vite/bin/vite.js", ["build"], { RHINE_SITE: id });
    } else if (command === "dev")
      await run(
        "node_modules/vite/bin/vite.js",
        [
          "--host",
          "127.0.0.1",
          "--port",
          String(snapshot.config.port),
          "--strictPort",
          ...args.filter((a) => a === "--open"),
        ],
        { RHINE_SITE: id },
      );
  } else if (command === "preview") {
    const cfg = await json(path.join(dir, "site.json"));
    await run(
      "node_modules/vite/bin/vite.js",
      [
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        String(cfg.port),
        "--strictPort",
      ],
      { RHINE_SITE: id },
    );
  } else if (command === "deploy") {
    if (!args.find((a) => !a.startsWith("-")))
      throw new Error(
        "Choose an explicit deployment target: npm run deploy -- rhine (or another site ID)",
      );
    await run("scripts/site.mjs", ["build", id]);
    await run("node_modules/wrangler/bin/wrangler.js", [
      "deploy",
      "--config",
      path.join(dir, "wrangler.jsonc"),
    ]);
  } else throw new Error(`Unknown command ${command}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
