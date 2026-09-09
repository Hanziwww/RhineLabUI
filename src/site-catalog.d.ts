// A fresh checkout can build any site before generating the default catalog.
// Vite resolves this import to the selected site's validated catalog.
declare module "*generated/catalog.json" {
  const snapshot: { config: unknown; documents: unknown[] };
  export default snapshot;
}
