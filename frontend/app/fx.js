// pixelfx 播放器：把 Patch / pixelfx 的纯代码像素特效渲染到游戏舞台的一层透明 canvas 上。
import { createFrame, clearFrame, createFx, composite } from "./vendor/pixelfx/core/index.js";

const MODULES = new Map();

async function loadEffect(id) {
  if (MODULES.has(id)) return MODULES.get(id);
  const p = MODULES.set(id, import(`./vendor/pixelfx/fx/${id}.js`).catch(() => null));
  return MODULES.get(id);
}

export class FxStage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.w = 480;
    this.h = 270;
    canvas.width = this.w;
    canvas.height = this.h;
    this.frame = createFrame(this.w, this.h);
    this.img = new ImageData(this.w, this.h);
    this.active = [];
    this.ambient = null;
    this.last = 0;
    this.raf = 0;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.active.forEach((e) => e.fx.stop && e.fx.stop());
    this.active = [];
    this.ambient = null;
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  async setAmbient(id, opts = {}) {
    this.ambient = null;
    if (!id) return;
    const mod = await loadEffect(id);
    if (!mod || !this.running) return;
    this.ambient = createFx(mod, { x: this.w / 2, y: this.h / 2, light: 0.8, ...opts });
  }

  async burst(id, opts = {}) {
    const mod = await loadEffect(id);
    if (!mod || !this.running) return;
    const fx = createFx(mod, {
      x: this.w / 2,
      y: this.h / 2,
      seed: Math.floor(Math.random() * 9999),
      light: 1,
      ...opts,
    });
    this.active.push({ fx, oneShot: !fx.meta.loop });
    if (this.active.length > 8) this.active.shift();
    return fx;
  }

  tick(dt) {
    const all = this.ambient ? [this.ambient, ...this.active.map((a) => a.fx)] : this.active.map((a) => a.fx);
    if (!all.length) {
      this.ctx.clearRect(0, 0, this.w, this.h);
      return;
    }
    clearFrame(this.frame);
    for (const fx of all) {
      fx.update(dt);
      fx.draw(this.frame);
    }
    composite(this.frame, this.img.data, null);
    this.ctx.putImageData(this.img, 0, 0);
    this.active = this.active.filter((a) => !(a.oneShot && a.fx.done()));
  }
}
