---
name: html-builder
description: Turn a product idea into one self-contained, interactive HTML document suitable for sandboxed sharing.
whenToUse: Use for text-to-page, interactive demos, visual explainers, small tools and single-file web experiences.
user-invocable: true
---

# HTML Builder

Build the requested idea as one self-contained `outputs/preview.html`.

## Process

1. Read the project brief and inspect optional assets.
2. Infer the audience, one primary goal, content hierarchy and essential interactions.
3. Implement a polished responsive page with semantic HTML, CSS and vanilla JavaScript.
4. Keep state local to the document. Do not require a server, cookies, authentication or a build step.
5. Avoid remote dependencies unless they are essential. Prefer embedded styles and scripts.
6. Check keyboard access, mobile layout, empty states and common interaction paths.
7. Open or inspect the result and fix visible or runtime failures.

## Hard constraints

- One file only: `outputs/preview.html`. No Vite, React, npm, Partykit, SQLite, or server WebSockets.
- If the user asks for a backend stack, simulate it with in-browser state.
- Write the file with tools. Never paste the whole document into chat; that hits max-tokens and leaves no preview.
- Support both hosted sandbox and `file://` preview. Never load or navigate to a `file://` URL.
- For `href="#section"` links, prevent the default navigation and call `scrollIntoView()` so unique-origin file previews work.

## Output

Write:

- `outputs/preview.html`
- `outputs/report.md` containing the inferred structure, interactions, external dependencies and verification performed

The document will run inside an iframe without `allow-same-origin`. Do not depend on access to the parent page.
