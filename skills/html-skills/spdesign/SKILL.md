---
name: spdesign
description: Create a strange, flat, high-impact portrait character whose eyes are the main visual event.
whenToUse: Use for isolated expressive head portraits with unconventional object-based eye systems and bold graphic shapes.
user-invocable: true
---

# spDesign

Create one readable human-like portrait head with a disruptive eye system. The work is flat, graphic and concise: silhouette, hand-drawn outline and high-saturation color blocks. Do not add a full body or an environment.

## Input gate

Before generation, inspect the project `assets/` and require:

- five transparent style-reference PNGs
- six frontal finished-head reference images
- a brief containing one identity sentence and one eye-system sentence

The eye-system sentence must define count, size and shape, breaking at least two of those conventions. The named object becomes an eye and contains a pupil. If reference assets are incomplete, stop and report the exact missing count.

The image provider accepts fewer images than this contract. Studio therefore
preflights all 11 originals and creates two labelled contact sheets under
`generated-inputs/`: one for the five transparent style references and one for
the six frontal heads. Pass both contact sheets on every generation (plus an
edit target when needed). During Review, return to `assets/` and inspect all 11
original files individually; a contact sheet is transport packaging, not a
replacement for original-image verification.

## Generation

Use the HTML Share tool adapter named in the task prompt. Write the complete prompt to a UTF-8 file, then call its `image-generate` subcommand with both generated contact sheets and an output path under `outputs/`. Every generation and revision must include both sheets; never degrade to text-only generation. If an edit target exists, include it in addition to the sheets.

Target: one centered portrait, vertical 2:3 (3:4 only when the provider requires it), transparent or plain dark field.

Avoid symmetric round eye pairs, emoji styling, anime beauty eyes, full-body T-shapes and background scenery.

## Review

Check the actual image in this order:

1. It still reads as a human head.
2. The eyes dominate and visibly break at least two conventions.
3. Silhouette, outline and color blocks match the reference language.

If the eyes fail, change the eye system rather than thickening the same round pair. Allow at most two automatic revisions, and change construction on the second revision.

Write versioned images, prompts, request metadata and `outputs/report.md`.
