---
id: welcome
number: 1
title: Welcome to your archive
subtitle: A DOCUMENT YOU CAN EDIT
column: notes
tags: [guide, example]
summary: Edit the Markdown and site configuration to make this archive your own.
metadata:
  - label: AUTHOR
    value: Your name
  - label: UPDATED
    value: "2026-09-09"
source: https://commonmark.org/
layout: markdown
tabsFromHeadings: true
---

## Getting started

This file is the content. Change its title, write a paragraph and save it to see your edits in the local preview.

> The same scene can hold your own research, essays or project notes.

- [x] Create a site
- [ ] Add your first archive
- [ ] Review the preview

1. Keep the `id` stable when changing a filename or title.
2. Assign a `column` from `site.json`.
3. Run content validation before building.[^validation]

[^validation]: `npm run validate -- your-site` reports the source file and field.

## Structured content

| File | Purpose |
| --- | --- |
| `site.json` | Brand, navigation, theme and labels |
| `content/*.md` | Your writing and metadata |

Inline mathematics uses $E = mc^2$. Display equations have their own space:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

```typescript
const archive = { id: "welcome", title: "Your next idea" };
```

![Shared archive mark](/favicon.svg)

## Next steps

Add a new `.md` file to this folder, choose a new stable ID and display number, then write your content. Relative document links are checked at build time.
