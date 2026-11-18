# Hello Zdog

Inline the fetched `zdog.dist.min.js` where `/* ZDOG */` is.

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zdog</title>
  <style>
    html, body { margin: 0; height: 100%; background: #f4f1ea; }
    .wrap { min-height: 100%; display: grid; place-items: center; }
    canvas { background: #fff; border-radius: 16px; cursor: grab; }
  </style>
</head>
<body>
  <div class="wrap">
    <canvas class="zdog-canvas" width="360" height="360"></canvas>
  </div>
  <script>
  /* ZDOG */
  let isSpinning = true;
  const illo = new Zdog.Illustration({
    element: '.zdog-canvas',
    zoom: 6,
    dragRotate: true,
    onDragStart() { isSpinning = false; },
  });
  new Zdog.Ellipse({
    addTo: illo,
    diameter: 20,
    translate: { z: 10 },
    stroke: 6,
    color: '#636',
  });
  new Zdog.Rect({
    addTo: illo,
    width: 20,
    height: 20,
    translate: { z: -10 },
    stroke: 3,
    color: '#E62',
    fill: true,
  });
  (function animate() {
    if (isSpinning) illo.rotate.y += 0.03;
    illo.updateRenderGraph();
    requestAnimationFrame(animate);
  })();
  </script>
</body>
</html>
```
