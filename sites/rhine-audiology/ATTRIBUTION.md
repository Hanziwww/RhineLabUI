# IEKB data attribution and reuse

RHINE AUDIOLOGY presents a static adaptation of the **Inner Ear Knowledge Base (IEKB)**, produced by **Tian-lab**. The source project is available at [earkb.org](https://earkb.org); published exports are available from its [downloads page](https://earkb.org/downloads).

## Data license

The original [IEKB data license notice](DATA-LICENSE.txt) is reproduced unchanged. Unless an artifact-level release manifest says otherwise, Tian-lab-authored IEKB data exports and the IEKB SQLite database are offered under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/), with the [full legal terms](https://creativecommons.org/licenses/by/4.0/legalcode).

When redistributing or adapting that material, retain appropriate credit to IEKB / Tian-lab, the license link, and an indication of your changes. The license permits sharing and adaptation, including commercial reuse, subject to its conditions. This repository's MIT code license does not replace the IEKB data license.

Third-party source material, literature, clinical annotations and other incorporated sources retain their original terms. CC BY 4.0 applies to the material identified by the IEKB notice; it does not relicense every underlying publication or external resource. IEKB and Tian-lab names, logos and marks are not included in the data license except for factual attribution. This presentation does not imply endorsement.

## Cite the IEKB preprint

**Wang H, Chen W, Ning H, Cai Y, Xu Y, Hou X, Pang L, Luo Z, Tian C.** IEKB: a comprehensive knowledge base for inner ear genetics integrating curated associations, cochlear interactions, Bayesian candidate prioritisation, explainable dark-gene support relations, and a scientific entity network. **bioRxiv [Preprint]**, posted April 9, 2026. DOI: [10.64898/2026.04.06.716823](https://doi.org/10.64898/2026.04.06.716823).

[Read version 1 on bioRxiv](https://www.biorxiv.org/content/10.64898/2026.04.06.716823v1) · [BibTeX citation](citation.bib)

The cited work is a preprint. Publication metadata is taken from the IEKB project's own publication configuration. This snapshot was imported on **September 8, 2026**; its counts describe that data export, not necessarily the counts in the April preprint.

## Changes made for this release

- Read the published association and interaction CSV files and the SQLite database without modifying the source. The association CSV is primary, preserving raw phenotype and disease wording, association types and mapping rules.
- Convert the selected known-database records into portable JSON, with 50-row pages, stable gene identifiers, aliases, source claims, literature, clinical annotations and known network relationships.
- Organize the 44 canonical phenotype topics into five navigation columns. Columns do not change phenotype classification. Keep phenotype records separate from mechanism/expression records, preserve negative predicates and source/human-review status, and retain all interactions, including those without a topic assignment.
- Add English Markdown introductions, the RHINE AUDIOLOGY presentation, search and reading interfaces. Exclude predictions, Dark Matter, enrichment analysis and question answering; network relationships do not create new phenotype associations.
- Package the existing data files with lossless gzip compression. Compression does not remove, aggregate or rewrite records. The archive includes this attribution, the original license, the citation and the import report; its checksum and file inventory are in `snapshot/package.json` in the repository.

The snapshot contains **44 topics, 3,444 associated genes, 7,376 source records (6,448 phenotype and 928 mechanism/expression), 4,073 interactions and 55,579 non-predictive claims**. See [the import report](import-report.json) for provenance, counts and review-status distributions. Source verification is distinct from human review.

Suggested attribution for reuse:

> Data adapted from IEKB / Tian-lab (Wang et al., bioRxiv preprint, 2026; https://doi.org/10.64898/2026.04.06.716823). Tian-lab-authored data: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); third-party source terms retained. The RHINE AUDIOLOGY release converts the known-database export to paginated JSON and adds topic navigation and presentation. Describe any further changes here.
