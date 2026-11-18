---
name: zdog
description: >-
  Build round, flat, designer-friendly pseudo-3D illustrations with Zdog
  (canvas/SVG). Use when the user wants Zdog, zzz.dog, pseudo-3D, isometric
  cartoon 3D, spinning Illustration, Ellipse/Rect/Box/Cone models, or a
  draggable 3D mascot in HTML.
whenToUse: Zdog, pseudo-3D, flat 3D illustration, spinning canvas model, designer 3D without WebGL.
user-invocable: true
---
# Zdog

Build one self-contained HTML page that renders a [Zdog](https://github.com/metafizzy/zdog) scene. Docs: [zzz.dog](https://zzz.dog). Engine v1.1.3, MIT.

Zdog is **not** WebGL. Spheres are dots, toruses are circles, capsules are thick lines. Model with anchors and shapes, then `updateRenderGraph()` every frame.

## Output

- `outputs/preview.html` — one file, works in a sandboxed iframe (`allow-scripts`, **no** `allow-same-origin`)
- `outputs/report.md` — subject, shape graph, animation, verification

Do not use Three.js, Babylon, or CSS 3D unless the user forbids Zdog.

## Library

Inline Zdog so the page does not depend on the parent origin.

1. Fetch `https://unpkg.com/zdog@1.1.3/dist/zdog.dist.min.js` (or `https://cdn.jsdelivr.net/npm/zdog@1.1.3/dist/zdog.dist.min.js`).
2. Put the file body inside `<script>…</script>` in `preview.html`.
3. If fetch is blocked, use a `<script src="https://unpkg.com/zdog@1.1.3/dist/zdog.dist.min.js"></script>` tag and note the CDN fallback in the report.

Never invent a `Zdog` global. After the script, `window.Zdog` must exist.

## Scene rules

1. One `Zdog.Illustration` on a `<canvas class="zdog-canvas" width="…" height="…">`. Prefer canvas over SVG for drag-rotate.
2. Set `zoom` so model numbers stay small (often `4`–`8`).
3. Enable `dragRotate: true`. Idle spin on `illo.rotate.y`; stop spinning in `onDragStart`.
4. Group related parts with `Zdog.Anchor`. Eyes/windows that must paint in add-order use `Zdog.Group`.
5. Place shapes with `translate` / `rotate` (`Zdog.TAU` = 2π). `scale` does **not** scale `stroke`.
6. Duplicate with `copy()` / `copyGraph()`, do not paste near-identical constructors.
7. Call `illo.updateRenderGraph()` inside `requestAnimationFrame`.
8. Palette: few saturated hex colors (Zdog house: `#636`, `#E62`, `#EA0`, `#C25`). Round strokes, `lineCap` is already round.
9. Keep one readable subject (pet, robot, logo, vehicle, still life). Do not dump 40 unrelated primitives.

Shape cheat-sheet: [reference.md](reference.md). Copy-paste starter: [examples.md](examples.md).

## Sandbox constraints

- No `window.parent`, cookies, or `localStorage`.
- No build step, no npm at runtime, no `type="module"` import maps unless inlined.
- Pointer-drag must work inside the iframe (`touch-action: none` is set by Zdog on the canvas).

## Check

Open or mentally step the page: Illustration constructed, at least two depth-separated shapes, animation loop, drag stops auto-spin. Fix runtime errors before finishing.
