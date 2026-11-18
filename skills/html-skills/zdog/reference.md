# Zdog API pocket

Source: [zzz.dog/api](https://zzz.dog/api). `Zdog.TAU === Math.PI * 2`.

## Graph

| Class | Role |
|-------|------|
| `Illustration` | Root. `element`, `zoom`, `dragRotate`, `centered`, `resize`, drag callbacks, `updateRenderGraph()` |
| `Anchor` | Invisible transform parent. `addTo`, `translate`, `rotate`, `scale`, `copy()`, `copyGraph()` |
| `Group` | Paint children in add order. `updateSort: true` to depth-sort inside the group |
| `Shape` | Custom `path`. `color`, `stroke`, `fill`, `closed`, `visible`, `backface` |
| `Dragger` | Pointer tracking; Illustration already inherits it |

Child `translate`/`rotate` is **relative to parent**.

## Shapes

| Class | Main options |
|-------|----------------|
| `Ellipse` | `diameter` or `width`/`height`, `quarters` 1–4 |
| `Rect` | `width`, `height` |
| `RoundedRect` | `width`, `height`, `cornerRadius` |
| `Polygon` | `sides`, `radius` |
| `Shape` | `path: [{x,y,z} \| {line} \| {move} \| {arc} \| {bezier}]` |
| `Hemisphere` | `diameter`; dome + ellipse |
| `Cone` | `diameter`, `length` |
| `Cylinder` | `diameter`, `length`, `frontFace` |
| `Box` | `width`, `height`, `depth`; face flags or face colors (`frontFace`, …) |

Defaults: `stroke: 1`, `fill: false` (Hemisphere/Cone/Cylinder/Box default `fill: true`). `stroke: false` + `fill: true` for filled only.

A one-point `Shape` path with `stroke` renders as a **dot** (fake sphere).

## Illustration

```js
const illo = new Zdog.Illustration({
  element: '.zdog-canvas',
  zoom: 4,
  dragRotate: true,
  onDragStart() { isSpinning = false; },
});
illo.updateRenderGraph();
```

`rotate` is a vector of radians around x/y/z. Drag maps pointer delta onto `rotate.x` / `rotate.y`.

## Path commands

```js
new Zdog.Shape({
  addTo: illo,
  path: [
    { x: -20, y: -20 },
    { line: { x: 20, y: -20 } },
    { arc: [ { x: 20, y: 20 }, { x: -20, y: 20 } ] },
  ],
  closed: true,
  fill: true,
});
```

After mutating `path` points, call `shape.updatePath()`.
