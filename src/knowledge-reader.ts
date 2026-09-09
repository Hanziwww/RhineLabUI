import { readJson } from "./content-provider.ts";
import { escapeHtml as h } from "./site.ts";
type Row = Record<string, string | number | null>;
interface Page<T = Row> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}
interface Gene {
  id: string;
  registry: Row;
  aliases: { symbol: string; type: string }[];
  topics: string[];
  clingen: Row[];
  hhl: Row[];
  records: Page;
  claims: Page;
  interactions: Page;
  network: Page;
}
const key = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "_");
const label = (s: string) => s.replaceAll("_", " ");
const refs = (value: unknown) => {
  const ids = String(value ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
  return ids.length
    ? `<details class="kb-references"><summary>${ids.length} source reference${ids.length === 1 ? "" : "s"}</summary>${ids.map((id) => `<button data-kb-paper="${id}">PMID ${id} ↗</button>`).join(" ")}</details>`
    : "";
};
const fields = (row: Row) =>
  `<dl class="kb-fields">${Object.entries(row)
    .filter(([, v]) => v !== null && v !== "")
    .map(
      ([k, v]) =>
        `<div><dt>${h(label(k))}</dt><dd>${/^https?:\/\//.test(String(v)) ? `<a href="${h(v)}" target="_blank" rel="noopener noreferrer">${h(v)} ↗</a>` : k === "source_doi" && /^10\./.test(String(v)) ? `<a href="https://doi.org/${encodeURIComponent(String(v))}" target="_blank" rel="noopener noreferrer">${h(v)} ↗</a>` : h(v)}</dd></div>`,
    )
    .join("")}</dl>`;
export class KnowledgeReader {
  private abort?: AbortController;
  private ticket = 0;
  private topic = "";
  private mode: "genes" | "records" | "gene" | "all" = "genes";
  private section = "records";
  private geneId = "";
  private gene?: Gene;
  private page = 1;
  private returnPage = 1;
  private returnScroll = 0;
  onChange?: () => void;
  constructor(private host: HTMLElement) {
    host.addEventListener("click", (e) => {
      const b = (e.target as Element).closest<HTMLElement>(
        "[data-kb-gene],[data-kb-page],[data-kb-section],[data-kb-all],[data-kb-back],[data-kb-retry],[data-kb-paper]",
      );
      if (!b) return;
      if (b.dataset.kbGene) {
        this.returnPage = this.page;
        this.returnScroll = this.host.closest("article")!.scrollTop;
        void this.openGene(b.dataset.kbGene);
      } else if (b.dataset.kbPage) {
        this.page = Number(b.dataset.kbPage);
        void this.render();
        this.host.scrollIntoView({ block: "start" });
      } else if (b.dataset.kbSection) {
        this.section = b.dataset.kbSection;
        this.page = 1;
        void this.render();
      } else if (b.dataset.kbAll) {
        this.mode = "all";
        this.section = b.dataset.kbAll;
        this.page = 1;
        void this.render();
      } else if (b.hasAttribute("data-kb-back")) {
        this.mode = "genes";
        this.page = this.returnPage;
        void this.render().then(() => {
          this.host.closest("article")!.scrollTop = this.returnScroll;
          this.host
            .querySelector<HTMLElement>(
              `[data-kb-gene="${CSS.escape(this.geneId)}"]`,
            )
            ?.focus({ preventScroll: true });
        });
      } else if (b.dataset.kbPaper) void this.paper(b.dataset.kbPaper, b);
      else void this.render();
    });
  }
  cancel() {
    this.abort?.abort();
    this.ticket++;
  }
  show(topic: string, tab: "genes" | "records") {
    this.topic = topic;
    this.mode = tab;
    this.page = 1;
    void this.render();
  }
  async openGene(id: string) {
    this.geneId = id;
    this.gene = undefined;
    this.mode = "gene";
    this.section = "records";
    this.page = 1;
    await this.render();
  }
  private controls(data: Page) {
    return `<div class="kb-pagination"><button data-kb-page="${data.page - 1}" ${data.page <= 1 ? "disabled" : ""}>← Previous</button><span>${data.total.toLocaleString("en-US")} records · Page ${data.page} / ${data.pages}</span><button data-kb-page="${data.page + 1}" ${data.page >= data.pages ? "disabled" : ""}>Next →</button></div>`;
  }
  private record(row: Row) {
    const type = row.association_type;
    const heading = String(
      row.gene_symbol ??
        row.subject_symbol ??
        (row.gene_a
          ? `${row.gene_a} / ${row.gene_b}`
          : `${row.source_entity} → ${row.target_entity}`),
    );
    const geneButton = (id: unknown, title: unknown) =>
      id ? `<button data-kb-gene="${h(id)}">${h(title)} ↗</button>` : h(title);
    const headingHTML = row.gene_a
      ? geneButton(row.gene_a_stable_id, row.gene_a) +
        " / " +
        geneButton(row.gene_b_stable_id, row.gene_b)
      : geneButton(row.stable_gene_id ?? row.subject_stable_gene_id, heading);
    const description =
      row.summary ?? row.evidence_text ?? row.description ?? "";
    const predicate =
      row.predicate ?? row.relationship ?? row.interaction_type ?? "";
    return `<section class="kb-record"><div class="kb-record-title"><strong>${headingHTML}</strong>${type ? `<span class="evidence-tag ${type === "phenotype" ? "phenotype" : "mechanism"}">${type === "phenotype" ? "Phenotype association" : "Mechanism / expression"}</span>` : ""}</div>${predicate ? `<p class="kb-predicate">${h(predicate)}</p>` : ""}<p>${h(description)}</p>${row.raw_phenotype ? `<p><b>Original phenotype</b> · ${h(row.raw_phenotype)}</p>` : ""}${row.disease_name ? `<p><b>Disease</b> · ${h(row.disease_name)}</p>` : ""}${row.source_validation_status || row.review_status ? `<div class="kb-status"><span>Source: ${h(label(String(row.source_validation_status ?? "not provided")))}</span><span>Human review: ${h(label(String(row.review_status ?? "not provided")))}</span></div>` : ""}${refs(row.supporting_pmids ?? row.source_pmid)}<details><summary>Original record · all fields</summary>${fields(row)}</details></section>`;
  }
  private async render() {
    this.cancel();
    const ticket = this.ticket;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.host.innerHTML =
      '<div class="reader-status" role="status">Loading source records…</div>';
    try {
      const manifest = await readJson<{
        counts: { interactions: number; unassignedInteractions: number };
      }>("/data/manifest.json", signal);
      const counts = manifest.counts;
      let data: Page;
      let heading = "";
      let body = "";
      if (this.mode === "gene") {
        if (!this.gene) {
          const gene = await readJson<Gene>(
            `/data/genes/${key(this.geneId)}.json`,
            signal,
          );
          if (ticket !== this.ticket) return;
          this.gene = gene;
        }
        const g = this.gene;
        const lists = ["records", "claims", "interactions", "network"] as const;
        data =
          this.page === 1
            ? g[this.section as (typeof lists)[number]]
            : await readJson<Page>(
                `/data/genes/${key(this.geneId)}-${this.section}-${this.page}.json`,
                signal,
              );
        heading = `<button class="kb-back" data-kb-back>← Associated genes</button><h3>${h(g.registry.current_symbol)} <small>${h(g.id)}</small></h3><p>${h(g.registry.full_name)}</p><details><summary>Identifiers & aliases</summary>${fields(g.registry)}<p>${g.aliases.map((a) => `${h(a.symbol)} (${h(label(a.type))})`).join(" · ")}</p></details><details><summary>ClinGen (${g.clingen.length}) & HHL (${g.hhl.length})</summary><h4>ClinGen</h4>${g.clingen.map(fields).join("") || "<p>No ClinGen annotation in this snapshot.</p>"}<h4>HHL</h4>${g.hhl.map(fields).join("") || "<p>No HHL annotation in this snapshot.</p>"}</details><div class="kb-sections">${lists.map((s) => `<button data-kb-section="${s}" aria-pressed="${s === this.section}">${{ records: "Associations", claims: "Source claims", interactions: "Interactions", network: "Network relations" }[s]} <small>${g[s].total}</small></button>`).join("")}</div><p class="kb-scope">Gene-level records can refer to several topics. Interactions and network relations do not establish new phenotype associations.</p>`;
      } else if (this.mode === "all") {
        data = await readJson<Page>(
          `/data/all/${this.section}-${this.page}.json`,
          signal,
        );
        heading = `<button class="kb-back" data-kb-back>← Topic genes</button><h3>${({ interactions: "All interactions", unassigned: "Interactions outside topic-linked genes", claims: "All non-predictive source claims", network: "All known network relations" } as Record<string, string>)[this.section]}</h3><p class="kb-scope">Source records are retained independently of the navigation topics. No new phenotype links are inferred.</p>`;
      } else {
        data = await readJson<Page>(
          `/data/topics/${this.topic}/${this.mode}-${this.page}.json`,
          signal,
        );
        heading = `<h3>${this.mode === "genes" ? "Associated genes" : "Evidence & sources"}</h3><p class="kb-scope">Phenotype associations and mechanism / expression records are counted separately. Open a gene to inspect claim provenance and review status.</p>`;
      }
      if (this.mode === "genes")
        body = `<div class="kb-gene-list">${data.items.map((g) => `<button data-kb-gene="${h(g.id)}"><span><strong>${h(g.symbol)}</strong><small>${h(g.id)} · ${h(g.fullName)}</small></span><span>${g.phenotype} phenotype<br>${g.mechanism} mechanism / expression <i>↗</i></span></button>`).join("")}</div>`;
      else
        body =
          data.items.map((row) => this.record(row)).join("") ||
          "<p>No records in this source snapshot.</p>";
      if (ticket !== this.ticket) return;
      const globalLinks = `<details class="kb-global-links"><summary>Explore the full snapshot</summary><span>Across the snapshot</span><button data-kb-all="interactions">All ${counts.interactions.toLocaleString("en-US")} interactions ↗</button><button data-kb-all="unassigned">${counts.unassignedInteractions} outside topic-linked genes ↗</button><button data-kb-all="claims">All source claims ↗</button><button data-kb-all="network">Known network relations ↗</button></details>`;
      this.host.innerHTML =
        heading +
        globalLinks +
        this.controls(data) +
        body +
        this.controls(data);
      this.onChange?.();
    } catch (error) {
      if (signal.aborted || ticket !== this.ticket) return;
      this.host.innerHTML =
        '<div class="reader-status" role="alert">Source records could not be loaded.<button data-kb-retry>Retry →</button></div>';
    }
  }
  private async paper(pmid: string, button: HTMLElement) {
    button.setAttribute("aria-busy", "true");
    try {
      const bucket = await readJson<Record<string, Row>>(
        `/data/literature/${Number(pmid) % 100}.json`,
      );
      if (!button.isConnected) return;
      const article = bucket[pmid];
      const node = document.createElement("div");
      node.className = "kb-citation";
      node.innerHTML = `<a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" rel="noopener noreferrer">${h(article?.title ?? `PubMed ${pmid}`)} ↗</a>${article ? `<span>${h(article.first_author)} · ${h(article.journal)} · ${h(article.year)}</span>` : "<span>Literature metadata unavailable in this snapshot.</span>"}`;
      button.replaceWith(node);
    } catch {
      button.textContent = `Retry PMID ${pmid}`;
      button.removeAttribute("aria-busy");
    }
  }
}
