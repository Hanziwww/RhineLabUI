import { contentProvider, readJson } from "./content-provider.ts";
import type { ArchiveDocument, DocumentBody } from "./content-types.ts";
import { escapeHtml as h, site, text as t } from "./site.ts";
import { KnowledgeReader } from "./knowledge-reader.ts";

export class ArchiveReader {
  private record?: ArchiveDocument;
  private body?: DocumentBody;
  private abort?: AbortController;
  private ticket = 0;
  private active = "overview";
  private history = "";
  private pendingGene?: string;
  private knowledge?: KnowledgeReader;
  private tabs: { id: string; title: string }[] = [];
  private expanded = false;
  private savedScroll = 0;
  private savedFocus?: HTMLElement;
  onPanelChange?: (animate: boolean) => void;
  onTabChange?: (id: string) => void;
  constructor(private article: HTMLElement) {
    article.addEventListener("click", (e) => {
      const b = (e.target as Element).closest<HTMLElement>("[data-reader]");
      if (!b) return;
      if (b.dataset.reader === "retry") void this.load();
      if (b.dataset.reader === "expand") this.setExpanded(!this.expanded);
      if (b.dataset.reader === "toc")
        this.article
          .querySelector<HTMLElement>(`#${CSS.escape(b.dataset.heading!)}`)
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  get isExpanded() {
    return this.expanded;
  }
  get tabIds() {
    return this.tabs.map((s) => s.id);
  }
  mount(record: ArchiveDocument, history: string, tab = "overview") {
    this.cancel();
    this.record = record;
    this.history = history;
    this.active = tab;
    this.body = undefined;
    this.pendingGene = undefined;
    this.tabs =
      record.layout === "legacy"
        ? [
            { id: "overview", title: t("overview", "概述", "Overview") },
            { id: "notes", title: t("notes", "研究记录", "Research notes") },
            { id: "history", title: t("history", "访问日志", "Access log") },
          ]
        : record.layout === "knowledge"
          ? [
              { id: "overview", title: "Overview" },
              { id: "genes", title: "Associated Genes" },
              { id: "evidence", title: "Evidence & Sources" },
            ]
          : [{ id: "overview", title: t("overview", "概述", "Overview") }];
    this.renderTabs();
    void this.load();
  }
  cancel() {
    this.abort?.abort();
    this.ticket++;
    this.knowledge?.cancel();
  }
  private async load() {
    this.abort?.abort();
    this.abort = new AbortController();
    const ticket = ++this.ticket;
    const signal = this.abort.signal;
    const panel = this.article.querySelector<HTMLElement>("#tab-panel")!;
    panel.innerHTML = `<div class="reader-status" role="status">${t("loadingContent", "正在读取档案…", "Loading archive…")}</div>`;
    try {
      const r = this.record!;
      const body = await contentProvider.load(r.id, signal);
      if (ticket !== this.ticket) return;
      this.body = body;
      if (r.layout === "markdown" && r.tabsFromHeadings && body.sections.length)
        this.tabs = body.sections.map((s) => ({ id: s.id, title: s.title }));
      const anchor = decodeURIComponent(location.hash.slice(1));
      if (anchor && r.tabsFromHeadings) {
        const section = body.sections.find(
          (s) => s.id === anchor || s.html.includes(`id="${anchor}"`),
        );
        if (section) this.active = section.id;
      }
      if (!this.tabIds.includes(this.active)) this.active = this.tabs[0].id;
      this.renderTabs();
      this.setTab(this.active, false);
      if (anchor)
        requestAnimationFrame(() =>
          this.article
            .querySelector<HTMLElement>(`#${CSS.escape(anchor)}`)
            ?.scrollIntoView({ block: "start" }),
        );
    } catch (error) {
      if (signal.aborted || ticket !== this.ticket) return;
      panel.innerHTML = `<div class="reader-status" role="alert">${t("contentError", "档案内容暂时无法载入。", "This archive could not be loaded.")}<button data-reader="retry">${t("retry", "重试 →", "Retry →")}</button></div>`;
    }
  }
  private renderTabs() {
    this.article.querySelector("#reader-tabs")!.innerHTML = this.tabs
      .map(
        (s, i) =>
          `<button class="${s.id === this.active ? "active" : ""}" role="tab" aria-selected="${s.id === this.active}" aria-controls="tab-panel" id="tab-${h(s.id)}" tabindex="${s.id === this.active ? "0" : "-1"}" data-tab="${h(s.id)}">${String(i + 1).padStart(2, "0")} <span>${h(s.title)}</span></button>`,
      )
      .join("");
  }
  setTab(id: string, animate = true) {
    this.active = id;
    this.onTabChange?.(id);
    this.knowledge?.cancel();
    this.renderTabs();
    const panel = this.article.querySelector<HTMLElement>("#tab-panel")!;
    panel.setAttribute("aria-labelledby", `tab-${id}`);
    if (!this.body) return;
    const r = this.record!;
    if (r.layout === "legacy") {
      const legacy = this.body.legacy!;
      panel.innerHTML =
        id === "overview"
          ? `<div class="panel-label">${t("abstract", "ABSTRACT / 摘要", "ABSTRACT")}</div><p>${h(legacy.abstract)}</p>`
          : id === "notes"
            ? `<div class="panel-label">${t("researchNotes", "RESEARCH NOTES / 研究记录", "RESEARCH NOTES")}</div><ol class="research-notes">${legacy.findings.map((f, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span>${h(f)}</li>`).join("")}</ol>`
            : this.history;
    } else if (r.layout === "knowledge" && id !== "overview") {
      panel.innerHTML = '<div class="knowledge-reader"></div>';
      this.knowledge = new KnowledgeReader(
        panel.firstElementChild as HTMLElement,
      );
      this.knowledge.onChange = () => this.toc();
      if (this.pendingGene) {
        void this.knowledge.openGene(this.pendingGene);
        this.pendingGene = undefined;
      } else
        this.knowledge.show(r.dataKey!, id === "genes" ? "genes" : "records");
    } else {
      panel.innerHTML = `<div class="markdown-body">${r.tabsFromHeadings ? (this.body.sections.find((s) => s.id === id)?.html ?? this.body.html) : this.body.html}</div>`;
      if (r.layout === "knowledge") {
        const stats = document.createElement("div");
        stats.className = "topic-statistics";
        panel.prepend(stats);
        const ticket = this.ticket;
        void readJson<{
          genes: number;
          records: number;
          phenotype: number;
          mechanism: number;
        }>(`/data/topics/${r.dataKey}/summary.json`, this.abort?.signal)
          .then((s) => {
            if (ticket !== this.ticket || !stats.isConnected) return;
            stats.innerHTML = `<div><strong>${s.genes.toLocaleString("en-US")}</strong><span>Associated genes</span></div><div><strong>${s.phenotype.toLocaleString("en-US")}</strong><span>Phenotype records</span></div><div><strong>${s.mechanism.toLocaleString("en-US")}</strong><span>Mechanism / expression</span></div>`;
          })
          .catch(() => {
            if (stats.isConnected)
              stats.innerHTML =
                "<span>Statistics unavailable. Reopen Overview to retry.</span>";
          });
      }
      if (r.layout === "markdown") {
        const related = contentProvider.related(r.id);
        if (related.length)
          panel.insertAdjacentHTML(
            "beforeend",
            `<nav class="related-archives" aria-label="Related archives"><h3>${t("related", "相关档案", "Related archives")}</h3>${related.map((d) => `<a href="?document=${encodeURIComponent(d.id)}">${h(d.title)} ↗</a>`).join("")}</nav>`,
          );
      }
    }
    this.onPanelChange?.(animate);
    this.toc();
  }
  openGene(id: string) {
    this.pendingGene = id;
    this.active = "genes";
    if (this.body) this.setTab("genes");
  }
  setExpanded(expand: boolean) {
    if (!site.features.expandedReader || expand === this.expanded) return;
    this.expanded = expand;
    if (expand) {
      this.savedScroll = this.article.scrollTop;
      this.savedFocus = document.activeElement as HTMLElement;
    }
    document
      .querySelector("#stage")!
      .classList.toggle("reader-expanded", expand);
    const button = this.article.querySelector<HTMLElement>(
      '[data-reader="expand"]',
    );
    if (button) {
      button.textContent = expand
        ? t("collapseReading", "收起阅读 ↙", "Return to model ↙")
        : t("expandReading", "展开阅读 ↗", "Expand reading ↗");
      button.setAttribute("aria-expanded", String(expand));
    }
    this.toc();
    requestAnimationFrame(() => {
      this.article.scrollTop = this.savedScroll;
      if (expand) this.article.focus({ preventScroll: true });
      else if (this.savedFocus?.isConnected)
        this.savedFocus.focus({ preventScroll: true });
    });
  }
  private toc() {
    const toc = this.article.querySelector<HTMLElement>("#reader-toc");
    if (!toc) return;
    const headings = [
      ...this.article.querySelectorAll<HTMLElement>(
        "#tab-panel h1,#tab-panel h2,#tab-panel h3",
      ),
    ];
    toc.innerHTML =
      `<span>${t("contents", "目录", "On this page")}</span>` +
      headings
        .map((node, i) => {
          node.id ||= `reader-heading-${i}`;
          return `<button data-reader="toc" data-heading="${h(node.id)}">${h(node.textContent)}</button>`;
        })
        .join("");
  }
}
