import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import Ajv from "ajv";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { ensureSiteData } from "./data-package.mjs";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function json(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}
export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value));
}
export function sitePath(id) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    throw new Error("site: use a lowercase slug, e.g. my-archive");
  return path.join(root, "sites", id);
}
export async function filesBelow(dir) {
  const list = [];
  for (const e of await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => [])) {
    if (e.isSymbolicLink())
      throw new Error(`${dir}/${e.name}: symlinks are not content assets`);
    const full = path.join(dir, e.name);
    if (e.isDirectory()) list.push(...(await filesBelow(full)));
    else list.push(full);
  }
  return list;
}
export function parseDocument(source, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source);
  if (!match)
    throw new Error(`${file}: frontmatter: expected YAML between --- lines`);
  let meta;
  try {
    meta = YAML.parse(match[1], { uniqueKeys: true });
  } catch (e) {
    throw new Error(`${file}: frontmatter: ${e.message}`);
  }
  return { meta, markdown: match[2] };
}
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes.code ?? []),
      ["className", /^language-./, "math-inline", "math-display"],
    ],
  },
};
function compile(tree) {
  // Raw HTML is never parsed. Sanitize the untrusted AST before trusted KaTeX;
  // trust:false also prevents TeX from creating links, styles or arbitrary HTML.
  const processor = unified()
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(rehypeSlug)
    .use(rehypeKatex, { trust: false, strict: "ignore", throwOnError: false })
    .use(rehypeStringify);
  return processor
    .run(tree)
    .then((t) => ({ html: processor.stringify(t), tree: t }));
}
const walk = (node, fn) => {
  fn(node);
  node.children?.forEach((n) => walk(n, fn));
};
const plain = (node) => node.value ?? node.children?.map(plain).join("") ?? "";

export async function buildContent(
  id,
  { stage = true, refreshAssets = true } = {},
) {
  const dir = sitePath(id);
  const configFile = path.join(dir, "site.json");
  const config = await json(configFile);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateSite = ajv.compile(
    await json(path.join(root, "schemas/site.schema.json")),
  );
  const validateDoc = ajv.compile(
    await json(path.join(root, "schemas/document.schema.json")),
  );
  const errors = [];
  const validate = (test, value, file) => {
    if (!test(value))
      errors.push(
        ...test.errors.map(
          (e) =>
            `${file}: ${e.instancePath || e.params.missingProperty || "root"}: ${e.message}`,
        ),
      );
  };
  validate(validateSite, config, configFile);
  if (config.id !== id)
    errors.push(`${configFile}: id must match directory ${id}`);
  if (errors.length) throw new Error(errors.join("\n"));
  if (config.features.knowledgeBase) await ensureSiteData(dir);
  const columns = new Set(config.columns.map((c) => c.id));
  if (columns.size !== config.columns.length)
    errors.push(`${configFile}: columns: duplicate id`);
  if (
    config.filterOrder &&
    (new Set(config.filterOrder).size !== columns.size ||
      config.filterOrder.some((c) => !columns.has(c)))
  )
    errors.push(
      `${configFile}: filterOrder: must contain each column ID exactly once`,
    );
  const documents = [];
  for (const file of (await filesBelow(path.join(dir, "content")))
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    try {
      const source = await fs.readFile(file, "utf8");
      const { meta, markdown } = parseDocument(source, file);
      validate(validateDoc, meta, file);
      if (meta.source && !/^(https?:\/\/|\/[^/])/.test(meta.source))
        errors.push(
          `${file}: source: use https:// or a site-local absolute path`,
        );
      if (meta.source?.startsWith("http")) {
        try {
          new URL(meta.source);
        } catch {
          errors.push(`${file}: source: invalid URL ${meta.source}`);
        }
      }
      if (!columns.has(meta.column))
        errors.push(`${file}: column: unknown column ${meta.column}`);
      const tree = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkMath)
        .parse(markdown);
      documents.push({ file, meta, markdown, tree });
    } catch (e) {
      errors.push(e.message);
    }
  }
  const ids = new Set();
  const numbers = new Set();
  const idFiles = new Map();
  const numberFiles = new Map();
  for (const d of documents) {
    if (ids.has(d.meta.id))
      errors.push(
        `${d.file}: id: duplicate ${d.meta.id} (also ${idFiles.get(d.meta.id)})`,
      );
    if (numbers.has(d.meta.number))
      errors.push(
        `${d.file}: number: duplicate ${d.meta.number} (also ${numberFiles.get(d.meta.number)})`,
      );
    ids.add(d.meta.id);
    numbers.add(d.meta.number);
    idFiles.set(d.meta.id, d.file);
    numberFiles.set(d.meta.number, d.file);
  }
  if (!ids.has(config.defaultDocument))
    errors.push(`${configFile}: defaultDocument: unknown id`);
  for (const c of columns)
    if (!documents.some((d) => d.meta.column === c))
      errors.push(`${configFile}: columns.${c}: needs at least one document`);
  const sourceMap = new Map(
    documents.map((d) => [path.resolve(d.file), d.meta.id]),
  );
  const assets = new Set(
    (await filesBelow(path.join(root, "public"))).map(
      (f) =>
        "/" + path.relative(path.join(root, "public"), f).replaceAll("\\", "/"),
    ),
  );
  for (const f of await filesBelow(path.join(dir, "public")))
    assets.add(
      "/" + path.relative(path.join(dir, "public"), f).replaceAll("\\", "/"),
    );
  if (config.features.knowledgeBase)
    for (const f of await filesBelow(path.join(dir, "data")))
      assets.add(
        "/data/" +
          path.relative(path.join(dir, "data"), f).replaceAll("\\", "/"),
      );
  if (config.brand.logo && !assets.has(config.brand.logo))
    errors.push(
      `${configFile}: brand.logo: missing asset ${config.brand.logo}`,
    );
  for (const d of documents) {
    if (d.meta.layout === "knowledge") {
      if (!config.features.knowledgeBase)
        errors.push(
          `${d.file}: layout: knowledge requires the knowledgeBase feature`,
        );
      if (
        !d.meta.dataKey ||
        !assets.has(`/data/topics/${d.meta.dataKey}/summary.json`)
      )
        errors.push(
          `${d.file}: dataKey: missing topic snapshot ${d.meta.dataKey ?? ""}`,
        );
    }
    walk(d.tree, (n) => {
      if (!["link", "image", "definition"].includes(n.type)) return;
      const url = n.url;
      if (/^(https?:|mailto:)/i.test(url)) {
        try {
          new URL(url);
        } catch {
          errors.push(`${d.file}: link: invalid URL ${url}`);
        }
      } else if (/^[a-z][\w+.-]*:/i.test(url) || url.startsWith("//"))
        errors.push(`${d.file}: link: unsafe protocol ${url}`);
      else if (url.startsWith("?document=")) {
        const target = new URLSearchParams(url.slice(1)).get("document");
        if (!ids.has(target))
          errors.push(`${d.file}: link: unknown document ${target}`);
      } else if (url.startsWith("#")) {
        // Anchor existence checked against compiled, sanitized headings below.
      } else if (url.split("#")[0].endsWith(".md")) {
        const target = sourceMap.get(
          path.resolve(
            path.dirname(d.file),
            decodeURIComponent(url.split("#")[0]),
          ),
        );
        if (!target) errors.push(`${d.file}: link: missing document ${url}`);
        else
          n.url = `?document=${encodeURIComponent(target)}${url.includes("#") ? "#" + url.split("#")[1] : ""}`;
      } else if (!assets.has(decodeURIComponent(url.split(/[?#]/)[0])))
        errors.push(
          `${d.file}: ${n.type}: missing resource ${url}. Use /assets/... or a relative .md link.`,
        );
    });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const generated = path.join(dir, "generated");
  const bodyDir = path.join(generated, "documents");
  const catalog = [];
  for (const d of documents.sort(
    (a, b) => (a.meta.order ?? a.meta.number) - (b.meta.order ?? b.meta.number),
  )) {
    const m = d.meta;
    const compiled = await compile(d.tree);
    const headings = [];
    const anchors = new Set();
    walk(compiled.tree, (n) => {
      if (n.properties?.id) anchors.add(n.properties.id);
      if (/^h[1-6]$/.test(n.tagName ?? ""))
        headings.push({
          id: n.properties.id,
          text: plain(n),
          depth: Number(n.tagName[1]),
        });
    });
    walk(d.tree, (n) => {
      if (
        n.type === "link" &&
        n.url.startsWith("#") &&
        !anchors.has(decodeURIComponent(n.url.slice(1)))
      )
        errors.push(`${d.file}: link: missing heading ${n.url}`);
    });
    const sections = [];
    d.anchors = anchors;
    const sectionHeadings = headings.filter((h) => h.depth === 2);
    let sectionIndex = 0;
    let section = {
      id: "overview",
      title: config.labels.overview ?? "Overview",
      nodes: [],
    };
    for (const node of d.tree.children) {
      if (node.type === "heading" && node.depth === 2) {
        if (section.nodes.length) sections.push(section);
        section = {
          id:
            sectionHeadings[sectionIndex++]?.id ?? `section-${sections.length}`,
          title: plain(node),
          nodes: [node],
        };
      } else section.nodes.push(node);
    }
    if (section.nodes.length) sections.push(section);
    const legacy =
      m.layout === "legacy"
        ? {
            abstract:
              sections[0]?.nodes
                .filter((n) => n.type === "paragraph")
                .map(plain)
                .join("\n") ?? "",
            findings:
              sections[1]?.nodes
                .filter((n) => n.type === "list")
                .flatMap((n) => n.children.map(plain)) ?? [],
          }
        : undefined;
    if (legacy && (!legacy.abstract || !legacy.findings.length))
      errors.push(
        `${d.file}: layout: legacy needs an overview paragraph and a research-notes list under the first two H2 headings`,
      );
    const body = {
      id: m.id,
      html: compiled.html,
      headings,
      sections: await Promise.all(
        sections.map(async (s) => ({
          id: s.id,
          title: s.title,
          html: (await compile({ type: "root", children: s.nodes })).html,
        })),
      ),
      ...(legacy ? { legacy } : {}),
    };
    await writeJson(path.join(bodyDir, `${m.id}.json`), body);
    const exportName = `${config.brand.exportPrefix}-${config.numberPrefix}${String(m.number).padStart(3, "0")}.txt`;
    const exportText = legacy
      ? `${config.brand.name} · ${config.brand.database}\nFILE ${m.id} / ${m.title}\n${m.subtitle}\n\n科室：${m.metadata[0].value}\n编目范围：${m.metadata[1].value}\n相关人物：${m.metadata[2].value}\n访问范围：${m.clearance}\n\n${legacy.abstract}\n\n研究记录\n${legacy.findings.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\n设定参考：${m.source}\n${config.exportNotice}\n`
      : `${config.brand.name} · ${config.brand.database}\n${config.numberPrefix}${String(m.number).padStart(3, "0")} / ${m.title}\n${m.subtitle}\n\n${d.markdown}\n\nSource: ${m.source}\n${config.exportNotice}\n`;
    await fs.mkdir(path.join(generated, "exports"), { recursive: true });
    await fs.writeFile(
      path.join(generated, "exports", exportName),
      "\uFEFF" + exportText,
    );
    catalog.push({
      id: m.id,
      number: m.number,
      title: m.title,
      subtitle: m.subtitle ?? "",
      column: m.column,
      tags: m.tags ?? [],
      summary: legacy?.abstract ?? m.summary ?? "",
      metadata: m.metadata ?? [],
      source: m.source ?? "",
      layout: m.layout ?? "markdown",
      tabsFromHeadings: m.tabsFromHeadings ?? false,
      bodyUrl: `/content/documents/${m.id}.json`,
      exportUrl: `/archives/${exportName}`,
      ...(m.dataKey ? { dataKey: m.dataKey } : {}),
      ...(m.clearance ? { clearance: m.clearance } : {}),
    });
  }
  for (const d of documents)
    walk(d.tree, (n) => {
      if (
        n.type !== "link" ||
        !n.url.startsWith("?document=") ||
        !n.url.includes("#")
      )
        return;
      const [query, fragment] = n.url.split("#");
      const target = documents.find(
        (x) =>
          x.meta.id === new URLSearchParams(query.slice(1)).get("document"),
      );
      if (!target?.anchors?.has(decodeURIComponent(fragment)))
        errors.push(`${d.file}: link: missing target heading ${n.url}`);
    });
  if (errors.length) throw new Error(errors.join("\n"));
  // Retired documents must not survive in subsequent static builds.
  const wantedBodies = new Set(catalog.map((d) => `${d.id}.json`));
  const wantedExports = new Set(catalog.map((d) => path.basename(d.exportUrl)));
  for (const name of await fs.readdir(bodyDir))
    if (!wantedBodies.has(name) && name.endsWith(".json"))
      await fs.unlink(path.join(bodyDir, name));
  for (const name of await fs.readdir(path.join(generated, "exports")))
    if (!wantedExports.has(name) && name.endsWith(".txt"))
      await fs.unlink(path.join(generated, "exports", name));
  await writeJson(path.join(generated, "catalog.json"), {
    config,
    documents: catalog,
  });
  if (stage) {
    const dest = path.join(root, ".generated", id, "public");
    if (refreshAssets || !(await fs.stat(dest).catch(() => null))) {
      // Only the validated, site-specific staging directory can be cleared.
      const resolved = path.resolve(dest),
        allowed = path.join(root, ".generated") + path.sep;
      if (
        !resolved.startsWith(allowed) ||
        (await fs.lstat(resolved).catch(() => null))?.isSymbolicLink()
      )
        throw new Error(`Unsafe staging path: ${resolved}`);
      const real = await fs.realpath(resolved).catch(() => resolved);
      if (!real.startsWith(allowed))
        throw new Error(`Staging path escapes workspace: ${real}`);
      await fs.rm(resolved, { recursive: true, force: true });
      await fs.mkdir(dest, { recursive: true });
      for (const entry of await fs.readdir(path.join(root, "public"))) {
        if (entry === "archives") continue;
        await fs.cp(path.join(root, "public", entry), path.join(dest, entry), {
          recursive: true,
        });
      }
      await fs
        .cp(path.join(dir, "public"), dest, { recursive: true })
        .catch((e) => {
          if (e.code !== "ENOENT") throw e;
        });
      if (config.features.knowledgeBase)
        await fs.cp(path.join(dir, "data"), path.join(dest, "data"), {
          recursive: true,
        });
    }
    await fs.cp(bodyDir, path.join(dest, "content", "documents"), {
      recursive: true,
    });
    await fs.cp(path.join(generated, "exports"), path.join(dest, "archives"), {
      recursive: true,
    });
    for (const name of await fs.readdir(
      path.join(dest, "content", "documents"),
    ))
      if (!wantedBodies.has(name) && name.endsWith(".json"))
        await fs.unlink(path.join(dest, "content", "documents", name));
    for (const name of await fs.readdir(path.join(dest, "archives")))
      if (!wantedExports.has(name) && name.endsWith(".txt"))
        await fs.unlink(path.join(dest, "archives", name));
  }
  return { config, documents: catalog };
}
