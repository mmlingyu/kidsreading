/* 冒险舞台运行时。背景是内联 SVG，声音用 Web Audio 实时合成，不加载外部文件。 */
(function () {
  const SCENES = {
    1: pack("树屋黄昏", ["#ffd9a0", "#ff9068", "#5b3674"], "#fff3b0", [860, 80], "trees", "#245028", "treehouse", "#8fd12f", "leaf", 520, 262, [0, 4, 7, 12], 84),
    2: pack("便利店夜", ["#243154", "#121a35", "#080d1f"], "#ffe9a0", [600, 70], "shops", "#1a2238", "store", "#ffd166", "dust", 280, 220, [0, 3, 7, 10], 72),
    3: pack("后院实验室", ["#9fe3ff", "#58b8ee", "#2a6fb8"], "#fffbe0", [240, 90], "trees", "#21445c", "lab", "#7ad7ff", "spark", 900, 294, [0, 4, 7, 11], 108),
    4: pack("球场午后", ["#bfe9ff", "#7ec8f5", "#3c83c9"], "#fff8cf", [980, 78], "stands", "#2f6a32", "field", "#ff7a45", "leaf", 640, 247, [0, 4, 7, 12], 112),
    5: pack("学校走廊", ["#3c4668", "#222a48", "#10152a"], "#e9f2ff", [600, 40], "hall", "#232a44", "hallway", "#b39cff", "dust", 240, 196, [0, 3, 7, 8], 66),
    6: pack("屋顶黄昏", ["#ff8d6b", "#a33f8f", "#2b1a55"], "#ffd6f0", [720, 90], "skyline", "#35243f", "roof", "#d584ff", "spark", 220, 175, [0, 3, 7, 10], 64),
    7: pack("商场中庭", ["#ffd0e0", "#c98cab", "#5c3d62"], "#fff6ea", [300, 70], "mall", "#3a2a38", "mall", "#ffb4c8", "dust", 360, 262, [0, 4, 7, 11], 96),
    8: pack("暗巷夜", ["#2a3148", "#151924", "#07090f"], "#ffd27a", [860, 120], "alley", "#141820", "alley", "#9ab0ff", "spark", 180, 196, [0, 3, 7, 10], 70),
    101: pack("卧室夜灯", ["#6b5f9e", "#3d3768", "#221f42"], "#ffe3a8", [900, 110], "room", "#3a3358", "bedroom", "#ffca7a", "spark", 320, 262, [0, 4, 7, 12], 72),
    102: pack("树林黄昏", ["#8fb6d8", "#5f6fa8", "#2c335e"], "#ffe9c0", [220, 80], "trees", "#234028", "treehouse", "#9fd97a", "leaf", 480, 294, [0, 4, 7, 12], 84),
    103: pack("长走廊", ["#6e6a97", "#403d68", "#201e3c"], "#ffedcf", [600, 50], "hall", "#2a2748", "hallway", "#c5a8ff", "dust", 260, 233, [0, 4, 7, 12], 76),
    104: pack("清晨房间", ["#ffe0b0", "#ffb98f", "#f08f8a"], "#fff6d8", [900, 80], "room", "#6a5344", "bedroom", "#ffd166", "dust", 500, 294, [0, 4, 7, 11], 92),
    105: pack("镜前柔光", ["#7fd3c9", "#4c91a8", "#2b4c72"], "#eafff6", [600, 90], "room", "#245060", "lab", "#7ee0c8", "spark", 420, 262, [0, 4, 7, 12], 80),
    106: pack("灯亮之前", ["#3b3c70", "#242548", "#12132b"], "#fff0c0", [600, 46], "hall", "#1c1e38", "hallway", "#ffd166", "spark", 200, 247, [0, 4, 7, 12], 88)
  };

  function pack(label, sky, sunColor, sunAt, far, ground, set, accent, particle, bedFreq, root, motif, bpm) {
    return { label, sky, sunColor, sunAt, far, ground, set, accent, particle, bedFreq, root, motif, bpm };
  }

  function farShapes(kind) {
    if (kind === "trees") return [80, 220, 380, 560, 760, 980].map((x, i) => `<polygon points="${x},430 ${x + 70},250 ${x + 140},430" fill="${i % 2 ? "#1e4a28" : "#16381f"}"/><rect x="${x + 58}" y="400" width="22" height="80" fill="#3a2414"/>`).join("");
    if (kind === "stands") return `<rect x="40" y="250" width="280" height="180" fill="#23406a"/><rect x="860" y="230" width="280" height="200" fill="#1d3558"/><polygon points="0,460 1200,420 1200,520 0,520" fill="#2f6a32"/>`;
    if (kind === "shops" || kind === "mall") return [40, 280, 520, 760, 1000].map((x, i) => `<polygon points="${x},460 ${x + 40},180 ${x + 210},160 ${x + 250},460" fill="${i % 2 ? "#24345c" : "#1a2744"}" opacity=".9"/>`).join("") + `<polygon points="430,460 600,120 770,460" fill="rgba(255,255,255,.16)"/>`;
    if (kind === "hall") return `<polygon points="80,520 520,80 680,80 1120,520" fill="#1a2038"/><rect x="545" y="150" width="110" height="220" fill="#0e1322"/>`;
    if (kind === "alley") return `<rect x="0" y="80" width="360" height="460" fill="#12151f"/><rect x="840" y="40" width="360" height="500" fill="#10131c"/><circle cx="860" cy="150" r="16" fill="#ffd27a"/>`;
    if (kind === "skyline") return [0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${i * 170}" y="${180 + (i % 3) * 40}" width="140" height="${280 - (i % 3) * 40}" fill="#2a1838"/>`).join("");
    return `<rect x="160" y="180" width="880" height="280" rx="24" fill="#3a3358"/><rect x="220" y="220" width="120" height="90" fill="#ffe3a8" opacity=".8"/>`;
  }

  function backdrop(cfg) {
    const [a, b, c] = cfg.sky;
    return `<svg class="bg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>
      </linearGradient></defs>
      <rect width="1200" height="700" fill="url(#skyG)"/>
      <circle cx="${cfg.sunAt[0]}" cy="${cfg.sunAt[1]}" r="58" fill="${cfg.sunColor}"/>
      <ellipse cx="300" cy="150" rx="90" ry="28" fill="#fff" opacity=".28"/>
      <ellipse cx="760" cy="120" rx="120" ry="32" fill="#fff" opacity=".2"/>
      ${farShapes(cfg.far)}
      <ellipse cx="600" cy="640" rx="760" ry="120" fill="${cfg.ground}"/>
    </svg>`;
  }

  function prop(html, x, y, z, w, h, ry) {
    return `<div class="prop" style="--x:${x}px;--y:${y}px;--z:${z}px;--w:${w}px;--h:${h}px;--ry:${ry || 0}deg">${html}</div>`;
  }

  function props(set) {
    const floor = `<div class="floor3d"></div>`;
    if (set === "treehouse") return floor + prop('<div class="trunk"></div>', -180, 20, -80, 70, 260) + prop('<div class="canopy"></div>', -170, -120, -40, 220, 140) + prop('<div class="canopy"></div>', 190, -90, -20, 180, 120);
    if (set === "store") return floor + prop('<div class="shelf-box"><i></i><i></i><i></i></div>', -150, 10, -40, 180, 240, 18) + prop('<div class="shelf-box"><i></i><i></i><i></i></div>', 170, 20, -10, 180, 240, -16) + prop('<div class="lamp"></div>', 0, -180, 40, 220, 24);
    if (set === "lab") return floor + prop('<div class="bench"></div>', 0, 80, 20, 340, 70) + prop('<div class="coil"></div>', -120, -20, 40, 90, 90) + prop('<div class="flask"></div>', 90, 10, 60, 70, 90);
    if (set === "field") return floor + prop('<div class="goalpost"></div>', 0, -20, -160, 280, 150) + prop('<div class="bike"></div>', 150, 90, 80, 120, 70);
    if (set === "hallway") return floor + prop('<div class="locker"><b></b><b></b><b></b><b></b><b></b><b></b></div>', -230, 0, -20, 180, 300, 28) + prop('<div class="locker"><b></b><b></b><b></b><b></b><b></b><b></b></div>', 230, 0, -20, 180, 300, -28) + prop('<div class="door"></div>', 0, -10, -180, 120, 200);
    if (set === "mall") return floor + prop('<div class="glass"></div>', -160, -20, -30, 200, 260, 16) + prop('<div class="glass"></div>', 180, -10, -10, 200, 260, -14) + prop('<div class="awning"></div>', 0, 120, 70, 260, 36);
    if (set === "alley") return floor + prop('<div class="wall"></div>', -250, -20, 0, 160, 360, 24) + prop('<div class="wall"></div>', 250, -10, 10, 160, 360, -24) + prop('<div class="lamp"></div>', 180, -150, 40, 36, 18) + prop('<div class="puddle"></div>', 20, 130, 60, 180, 40);
    if (set === "roof") return floor + prop('<div class="glass"></div>', 0, -40, -80, 220, 80) + prop('<div class="bench"></div>', 0, 120, 40, 420, 28);
    if (set === "bedroom") return floor + prop('<div class="bed"></div>', 0, 70, 20, 300, 110) + prop('<div class="lamp"></div>', 180, -20, 50, 36, 20);
    return floor;
  }

  const audio = {
    ctx: null, muted: false, nodes: [], timers: [], music: null, amb: null, sfx: null, noise: null,
    unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        this.ctx = new AC();
        const ctx = this.ctx;
        const master = ctx.createGain();
        master.gain.value = 0.8;
        master.connect(ctx.destination);
        this.amb = ctx.createGain(); this.music = ctx.createGain(); this.sfxBus = ctx.createGain();
        this.amb.connect(master); this.music.connect(master); this.sfxBus.connect(master);
        const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buf;
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    },
    mute(on) {
      this.muted = !!on;
      if (this.amb) this.amb.gain.value = on ? 0 : 0.7;
      if (this.music) this.music.gain.value = on ? 0 : 0.45;
      if (this.sfxBus) this.sfxBus.gain.value = on ? 0 : 0.8;
    },
    duck(on) {
      if (!this.music || this.muted) return;
      this.music.gain.value = on ? 0.08 : 0.45;
      this.amb.gain.value = on ? 0.15 : 0.7;
    },
    stop() {
      this.timers.forEach((id) => clearInterval(id));
      this.timers = [];
      this.nodes.forEach((node) => { try { node.stop && node.stop(); node.disconnect(); } catch (err) {} });
      this.nodes = [];
    },
    tone(freq, dur, vol, type, dest, delay) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain); gain.connect(dest || this.sfxBus);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    start(cfg) {
      this.stop();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = cfg.bedFreq;
      const gain = ctx.createGain(); gain.gain.value = 0.04;
      src.connect(filter); filter.connect(gain); gain.connect(this.amb);
      src.start();
      this.nodes.push(src, filter, gain);
      let step = 0;
      const beat = 60000 / cfg.bpm;
      this.timers.push(setInterval(() => {
        const semi = cfg.motif[step % cfg.motif.length];
        this.tone(cfg.root * Math.pow(2, semi / 12), 0.22, 0.05, "triangle", this.music);
        if (step % 4 === 0) this.tone(cfg.root / 2, 0.4, 0.03, "sine", this.music);
        step += 1;
      }, beat));
    },
    sfx(name) {
      if (name === "ok") { this.tone(523, 0.12, 0.08); this.tone(659, 0.18, 0.08); }
      else if (name === "bad") this.tone(196, 0.22, 0.08, "sawtooth");
      else if (name === "pop") this.tone(680, 0.08, 0.07, "square");
      else if (name === "coin") { this.tone(880, 0.08, 0.06); this.tone(1320, 0.12, 0.05); }
      else if (name === "dice") this.tone(320, 0.07, 0.06, "square");
      else if (name === "win") [523, 659, 784, 1046].forEach((freq, i) => this.tone(freq, 0.22, 0.07, "triangle", null, i * 0.12));
      else this.tone(440, 0.06, 0.05);
    }
  };

  let current = null;

  function particles(kind) {
    return `<div class="particles">${Array.from({ length: 14 }, (_, i) => `<i class="${kind}" style="--l:${(i * 7) % 100}%;--d:${(i % 7) * -0.8}s"></i>`).join("")}</div>`;
  }

  window.AdventureStage = {
    scenes: SCENES,
    mount(host, sceneId, options) {
      const cfg = SCENES[sceneId] || SCENES[1];
      current = cfg;
      audio.muted = !!(options && options.muted);
      host.dataset.scene = String(sceneId);
      host.innerHTML = `<div class="stage" style="--accent:${cfg.accent};--ground:${cfg.ground};--particle:${cfg.sunColor}">
        <div class="camera">${backdrop(cfg)}<div class="veil"></div>${particles(cfg.particle)}
          <div class="set3d"><div class="world3d">${props(cfg.set)}</div></div>
          <div class="hero" aria-hidden="true"><i></i><b></b></div>
        </div>
        <div class="stage-ui"></div>
      </div>`;
      const stage = host.querySelector(".stage");
      stage.addEventListener("pointermove", (event) => {
        const rect = stage.getBoundingClientRect();
        stage.style.setProperty("--px", ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3));
        stage.style.setProperty("--py", ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3));
      });
      audio.unlock();
      audio.mute(audio.muted);
      if (!audio.muted) audio.start(cfg);
      return cfg;
    },
    unlock() { audio.unlock(); if (current && !audio.muted && !audio.timers.length) audio.start(current); },
    stop() { audio.stop(); current = null; },
    mute(on) { audio.mute(on); if (!on && current) audio.start(current); else if (on) audio.stop(); },
    duck(on) { audio.duck(on); },
    sfx(name) { audio.unlock(); audio.sfx(name); },
    setPhase(phase) {
      if (!audio.music || audio.muted) return;
      audio.music.gain.value = phase === "victory" ? 0.7 : phase === "mini" ? 0.6 : phase === "tension" ? 0.5 : 0.4;
    }
  };
})();
