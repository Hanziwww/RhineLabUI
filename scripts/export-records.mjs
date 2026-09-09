// Compatibility command. Exports now come from the selected site Markdown.
import { buildContent } from "./content.mjs";
const site=process.argv[2] ?? "rhine";
const result=await buildContent(site);
console.log(`Prepared ${result.documents.length} documents and exports for ${site}.`);
