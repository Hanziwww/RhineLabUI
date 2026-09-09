import { directory, site, displayCode } from "./site.ts";
import type {
  ContentProvider,
  DocumentBody,
  SearchHit,
  SearchOptions,
} from "./content-types.ts";

const cache = new Map<string, unknown>();
export async function readJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (cache.has(url)) return cache.get(url) as T;
  const response = await fetch(url, { signal });
  if (!response.ok || !response.headers.get("content-type")?.includes("json"))
    throw new Error(`Unable to load ${url} (${response.status})`);
  const data = (await response.json()) as T;
  // Bound cached pages during long reading sessions.
  if (cache.size >= 120) cache.delete(cache.keys().next().value!);
  cache.set(url, data);
  return data;
}
export interface KnowledgeSearch {
  genes: { id: string; symbol: string; name: string; aliases: string[] }[];
  records: {
    gene: string;
    topic: string;
    column: string;
    disease: string;
    pmids: string;
    type: string;
    evidence: string;
    cells: string[];
  }[];
  topics: { id: string; title: string; column: string }[];
  evidence: string[];
  cells: string[];
}
let searchIndex: Promise<KnowledgeSearch> | undefined;
export async function knowledgeSearch(signal?: AbortSignal) {
  // Facets and results share one on-demand index request. Each caller still
  // discards a response after its own operation has been cancelled.
  searchIndex ??= readJson<KnowledgeSearch>("/data/search.json").catch(
    (error) => {
      searchIndex = undefined;
      throw error;
    },
  );
  const data = await searchIndex;
  signal?.throwIfAborted();
  return data;
}
export function searchKnowledge(
  data: KnowledgeSearch,
  query: string,
  options: SearchOptions = {},
  documents = directory,
) {
  const q = query.trim().toLowerCase();
  const byTopic = new Map(
    documents
      .filter((d) => d.layout === "knowledge")
      .map((d) => [d.dataKey ?? d.id, d]),
  );
  const matchingGenes = new Set(
    data.genes
      .filter((g) =>
        `${g.id} ${g.symbol} ${g.name} ${g.aliases.join(" ")}`
          .toLowerCase()
          .includes(q),
      )
      .map((g) => g.id),
  );
  const matchingTopics = new Set(
    data.topics
      .filter((t) => {
        const d = byTopic.get(t.id);
        return `${t.id} ${t.title} ${d ? `${displayCode(d)} ${d.title} ${d.subtitle} ${d.tags.join(" ")}` : ""}`
          .toLowerCase()
          .includes(q);
      })
      .map((t) => t.id),
  );
  const filtered = data.records.filter(
    (r) =>
      byTopic.has(r.topic) &&
      (!options.column || byTopic.get(r.topic)!.column === options.column) &&
      (!options.evidence ||
        r.type === options.evidence ||
        r.evidence === options.evidence) &&
      (!options.cell || r.cells.includes(options.cell)) &&
      (!q ||
        matchingGenes.has(r.gene) ||
        matchingTopics.has(r.topic) ||
        `${r.disease} ${r.pmids}`.toLowerCase().includes(q)),
  );
  const topics = new Set(filtered.map((r) => r.topic));
  const genes = new Set(filtered.map((r) => r.gene));
  const hits: SearchHit[] = [
    ...documents
      .filter(
        (d) =>
          d.layout !== "knowledge" &&
          !options.evidence &&
          !options.cell &&
          (!options.column || d.column === options.column) &&
          `${d.id} ${displayCode(d)} ${d.title} ${d.subtitle} ${d.tags.join(" ")} ${d.summary}`
            .toLowerCase()
            .includes(q),
      )
      .map((d) => ({
        id: d.id,
        title: d.title,
        subtitle: d.subtitle,
        kind: "topic" as const,
      })),
    ...data.topics
      .filter((t) => topics.has(t.id))
      .map((t) => ({
        id: byTopic.get(t.id)!.id,
        title: byTopic.get(t.id)!.title,
        subtitle: "Phenotype archive",
        kind: "topic" as const,
      })),
    ...data.genes
      .filter((g) => genes.has(g.id))
      .map((g) => ({
        id: byTopic.get(filtered.find((r) => r.gene === g.id)!.topic)!.id,
        title: g.symbol,
        subtitle: `${g.id} · ${g.name}`,
        kind: "gene" as const,
        geneId: g.id,
      })),
  ];
  // A direct gene query should reveal the gene before the linked topics.
  if (q)
    hits.sort(
      (a, b) =>
        Number(b.kind === "gene" && matchingGenes.has(b.geneId!)) -
        Number(a.kind === "gene" && matchingGenes.has(a.geneId!)),
    );
  const start = ((options.page ?? 1) - 1) * 50;
  return { hits: hits.slice(start, start + 50), total: hits.length };
}
export const contentProvider: ContentProvider = {
  directory,
  load(id, signal) {
    const item = directory.find((d) => d.id === id);
    if (!item) return Promise.reject(new Error(`Unknown document ${id}`));
    return readJson<DocumentBody>(item.bodyUrl, signal);
  },
  async search(query, options = {}, signal) {
    if (site.features.knowledgeBase)
      return searchKnowledge(await knowledgeSearch(signal), query, options);
    const q = query.trim().toLowerCase();
    const hits = directory
      .filter(
        (d) =>
          (!options.column || d.column === options.column) &&
          `${d.id} ${displayCode(d)} ${d.title} ${d.subtitle} ${d.tags.join(" ")} ${d.metadata.map((m) => m.value).join(" ")} ${d.summary}`
            .toLowerCase()
            .includes(q),
      )
      .map((d) => ({
        id: d.id,
        title: d.title,
        subtitle: d.subtitle,
        kind: "topic" as const,
      }));
    const start = ((options.page ?? 1) - 1) * 50;
    return { hits: hits.slice(start, start + 50), total: hits.length };
  },
  related(id) {
    const d = directory.find((r) => r.id === id);
    return directory
      .filter(
        (r) =>
          r.id !== id &&
          (r.column === d?.column || r.tags.some((t) => d?.tags.includes(t))),
      )
      .slice(0, 4);
  },
};
