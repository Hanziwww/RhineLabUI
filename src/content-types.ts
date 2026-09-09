/** Content contracts. Rendering and navigation never depend on an IEKB row. */
export interface SiteConfig {
  id: string;
  locale: string;
  title: string;
  description: string;
  port: number;
  brand: {
    name: string;
    subtitle: string;
    system: string;
    systemAccent: string;
    company: string;
    database: string;
    operator: string;
    markText: string;
    labelCode: string;
    exportPrefix: string;
    logo?: string;
  };
  columns: { id: string; title: string }[];
  filterOrder?: string[];
  defaultDocument: string;
  numberPrefix: string;
  labels: Record<string, string>;
  theme: {
    lighting: "warm" | "baseline";
    background: string;
    ink: string;
    accent: string;
  };
  features: {
    expandedReader: boolean;
    knowledgeBase: boolean;
    pathTracing: boolean;
  };
  exportNotice: string;
  attribution?: { text: string; url: string; license: string };
}
export interface ArchiveDocument {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  column: string;
  tags: string[];
  summary: string;
  metadata: { label: string; value: string }[];
  source: string;
  layout: "legacy" | "markdown" | "knowledge";
  tabsFromHeadings: boolean;
  bodyUrl: string;
  exportUrl: string;
  dataKey?: string;
}
export interface DocumentBody {
  id: string;
  html: string;
  sections: { id: string; title: string; html: string }[];
  headings: { id: string; text: string; depth: number }[];
  legacy?: { abstract: string; findings: string[] };
}
export interface SearchOptions {
  column?: string;
  evidence?: string;
  cell?: string;
  page?: number;
}
export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  kind: "topic" | "gene";
  geneId?: string;
}
export interface SearchResult {
  hits: SearchHit[];
  total: number;
}
export interface ContentProvider {
  directory: readonly ArchiveDocument[];
  load(id: string, signal?: AbortSignal): Promise<DocumentBody>;
  search(
    query: string,
    options?: SearchOptions,
    signal?: AbortSignal,
  ): Promise<SearchResult>;
  related(id: string): readonly ArchiveDocument[];
}
