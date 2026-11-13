// 程序化场景音频：Web Audio API 实时合成，不依赖任何外部音频文件，可离线运行。
// 三层总线：环境音 amb / 场景配乐 music / 交互提示音 sfx，均可独立开关。
// 8 章各有独立环境音床 + 场景细节音 + 和弦配乐；配乐随剧情阶段（探索/检定/小游戏/胜利）
// 改变强度与速度；英文朗读或中文语音引导时自动 duck，避免盖住人声。
const LS_KEY = "last-kids-sound-v2";
const LS_OLD = "last-kids-sound-v1";

function readPref() {
  try {
    const raw = localStorage.getItem(LS_KEY) || localStorage.getItem(LS_OLD) || "{}";
    const v = JSON.parse(raw || "{}");
    return {
      muted: !!v.muted,
      mode: v.mode || "cinema",
      guideOn: v.guideOn !== false,
      layers: { amb: true, music: true, sfx: true, ...(v.layers || {}) },
    };
  } catch {
    return { muted: false, mode: "cinema", guideOn: true, layers: { amb: true, music: true, sfx: true } };
  }
}

// 逐章配乐：调式、和弦进行、音色、速度、旋律动机。全部按章节场景情绪配置。
// chords / pattern 用半音或音阶下标表示，-1 为休止。
export const SCORES = {
  1: { name: "树屋黄昏 · 温暖木琴", root: 261.63, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], scale: [0, 2, 4, 7, 9, 12], wave: "triangle", bpm: 84, pad: .028, lead: .019, pattern: [0, 2, 4, 2, 5, 4, 2, -1] },
  2: { name: "便利店夜 · 稀疏电钢", root: 220.00, chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [0, 3, 7]], scale: [0, 3, 5, 7, 10, 12], wave: "sine", bpm: 72, pad: .034, lead: .016, pattern: [0, -1, 2, -1, 3, -1, 2, -1] },
  3: { name: "后院实验室 · 跳跃琶音", root: 293.66, chords: [[0, 4, 7], [2, 7, 11], [5, 9, 12], [0, 4, 7]], scale: [0, 2, 4, 7, 9, 12, 14], wave: "triangle", bpm: 108, pad: .022, lead: .023, pattern: [0, 2, 4, 6, 4, 2, 4, 5] },
  4: { name: "学校球场 · 进行曲", root: 246.94, chords: [[0, 4, 7], [0, 4, 7], [5, 9, 12], [7, 11, 14]], scale: [0, 2, 4, 7, 9, 12], wave: "sawtooth", bpm: 116, pad: .020, lead: .017, pattern: [0, 0, 2, 4, 4, 2, 4, -1] },
  5: { name: "学校走廊 · 悬疑慢板", root: 196.00, chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [6, 10, 13]], scale: [0, 1, 3, 5, 7, 8, 12], wave: "sine", bpm: 66, pad: .038, lead: .013, pattern: [0, -1, -1, 3, -1, 2, -1, -1] },
  6: { name: "停车场黄昏 · 温柔大调", root: 233.08, chords: [[0, 4, 7], [7, 11, 14], [5, 9, 12], [0, 4, 7]], scale: [0, 2, 4, 7, 9, 12], wave: "triangle", bpm: 78, pad: .030, lead: .018, pattern: [0, -1, 2, 4, -1, 4, 2, -1] },
  7: { name: "末日屋顶 · 低频压迫", root: 174.61, chords: [[0, 3, 6], [0, 3, 6], [1, 5, 8], [0, 3, 6]], scale: [0, 1, 3, 6, 7, 12], wave: "sawtooth", bpm: 60, pad: .040, lead: .011, pattern: [0, -1, -1, -1, 3, -1, -1, -1] },
  8: { name: "黎明决战 · 史诗渐强", root: 293.66, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], scale: [0, 2, 4, 7, 9, 12, 14, 16], wave: "triangle", bpm: 104, pad: .032, lead: .025, pattern: [0, 2, 4, 7, 4, 5, 6, 7] },
};

// 场景细节音层：比原来的单一噪声床更贴近画面，随机穿插具体声源。
const BEDS = {
  1: ["bird", "wind"], 2: ["flicker", "beep"], 3: ["bubble", "spark"], 4: ["breeze", "crowd"],
  5: ["flicker", "step"], 6: ["crickets", "car"], 7: ["lowwind", "rumble"], 8: ["shimmer", "portal"],
};

const PHASE_GAIN = { explore: .40, tension: .62, mini: .72, victory: .80 };
const PHASE_TEMPO = { explore: 1, tension: 1.12, mini: 1.34, victory: 1.06 };

class SoundEngine {
  constructor() {
    const p = readPref();
    this.muted = p.muted;
    this.mode = p.mode;
    this.guideOn = p.guideOn;
    this.layers = p.layers;
    this.ctx = null;
    this.master = null;
    this.amb = null;
    this.music = null;
    this.sfx = null;
    this.noiseBuf = null;
    this.nodes = [];
    this.timers = [];
    this.eventTimer = 0;
    this.bedTimer = 0;
    this.scoreTimer = 0;
    this.duckTimer = 0;
    this.scene = null;
    this.score = null;
    this.step = 0;
    this.phase = "explore";
    this.tempo = 1;
    this.ducking = false;
    this.lastHover = 0;
  }

  save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        muted: this.muted, mode: this.mode, guideOn: this.guideOn, layers: this.layers,
      }));
    } catch {}
  }

  // 必须在用户手势里调用一次（浏览器自动播放策略）
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC(); } catch { return false; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(c.destination);
    this.amb = c.createGain(); this.amb.connect(this.master);
    this.music = c.createGain(); this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.noiseBuf = this.makeNoise(2.2);
    this.applyGains(true);
    if (this.scene) this.setScene(this.scene.id, this.scene.cfg, this.scene.scoreId);
    return true;
  }

  applyGains(fast = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, tc = fast ? 0.05 : 0.32;
    const d = this.ducking ? 0.22 : 1;
    this.amb.gain.setTargetAtTime((this.layers.amb ? 0.55 : 0) * d, t, tc);
    this.music.gain.setTargetAtTime((this.layers.music ? 0.62 * PHASE_GAIN[this.phase] : 0) * d, t, tc);
    this.sfx.gain.setTargetAtTime(this.layers.sfx ? 0.9 : 0, t, tc);
  }

  makeNoise(seconds) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = white * 0.7 + last * 3.2;
    }
    return buf;
  }

  out(pan = 0, dest = null) {
    const c = this.ctx;
    const g = c.createGain();
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); p.connect(dest || this.sfx);
      g._panner = p;
    } else g.connect(dest || this.sfx);
    return g;
  }

  env(g, t, attack, decay, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(freq, { type = "sine", dur = 0.18, vol = 0.18, pan = 0, slide = 0, delay = 0, dest = null, attack = 0.012 } = {}) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(30, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const g = this.out(pan, dest);
    this.env(g, t, attack, dur, vol);
    o.connect(g);
    o.start(t); o.stop(t + dur + 0.08);
    o.onended = () => { try { o.disconnect(); g.disconnect(); g._panner && g._panner.disconnect(); } catch {} };
  }

  noise({ dur = 0.2, vol = 0.2, pan = 0, filter = "lowpass", freq = 900, q = 1, delay = 0, dest = null } = {}) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const g = this.out(pan, dest);
    this.env(g, t, 0.01, dur, vol);
    s.connect(f); f.connect(g);
    s.start(t); s.stop(t + dur + 0.08);
    s.onended = () => { try { s.disconnect(); f.disconnect(); g.disconnect(); g._panner && g._panner.disconnect(); } catch {} };
  }

  // ---------- 环境音床 / 场景细节音 ----------
  stopScene() {
    this.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    this.timers = [];
    clearTimeout(this.eventTimer); clearTimeout(this.bedTimer); clearTimeout(this.scoreTimer);
    this.eventTimer = this.bedTimer = this.scoreTimer = 0;
    this.nodes.forEach((n) => { try { n.stop && n.stop(); n.disconnect(); } catch {} });
    this.nodes = [];
  }

  setScene(id, cfg, scoreId = id) {
    this.scene = { id, cfg, scoreId };
    this.phase = "explore";
    this.tempo = 1;
    if (!this.ctx || !cfg) return;
    this.stopScene();
    const c = this.ctx, now = c.currentTime;

    if (cfg.noise) {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter();
      f.type = cfg.noise.type || "lowpass";
      f.frequency.value = cfg.noise.freq || 600;
      f.Q.value = cfg.noise.q || 0.8;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(cfg.noise.vol || 0.12, now + 1.2);
      s.connect(f); f.connect(g); g.connect(this.amb);
      s.start(now);
      this.nodes.push(s, f, g);
      // 风/电流等缓慢起伏，避免死板的白噪声
      if (cfg.noise.swell) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = cfg.noise.swell;
        lg.gain.value = (cfg.noise.vol || 0.12) * 0.45;
        l.connect(lg); lg.connect(g.gain); l.start(now);
        this.nodes.push(l, lg);
      }
    }

    if (cfg.hum) {
      const o = c.createOscillator();
      o.type = cfg.hum.type || "sine";
      o.frequency.value = cfg.hum.freq || 100;
      const g = c.createGain();
      g.gain.value = cfg.hum.vol || 0.035;
      o.connect(g); g.connect(this.amb);
      o.start(now);
      this.nodes.push(o, g);
      if (cfg.hum.lfo) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = cfg.hum.lfo; lg.gain.value = (cfg.hum.vol || 0.035) * 0.7;
        l.connect(lg); lg.connect(g.gain); l.start(now);
        this.nodes.push(l, lg);
      }
    }

    if (cfg.drone) {
      const o = c.createOscillator();
      o.type = "sawtooth"; o.frequency.value = cfg.drone.freq || 46;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 180;
      const g = c.createGain(); g.gain.value = cfg.drone.vol || 0.05;
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 0.22; lg.gain.value = (cfg.drone.vol || 0.05) * 0.8;
      l.connect(lg); lg.connect(g.gain);
      o.connect(f); f.connect(g); g.connect(this.amb);
      o.start(now); l.start(now);
      this.nodes.push(o, f, g, l, lg);
    }

    if (cfg.event) {
      const loop = () => {
        const range = cfg.eventEvery || [5000, 9000];
        this.eventTimer = setTimeout(() => {
          if (!this.ctx || !this.scene || this.scene.id !== id) return;
          this.sceneEvent(cfg.event);
          loop();
        }, range[0] + Math.random() * (range[1] - range[0]));
      };
      loop();
    }

    this.startBed(id);
    this.startScore(scoreId);
    this.applyGains(true);
  }

  // 场景细节层：鸟叫、荧光灯闪烁、气泡、蟋蟀、远处车流……随机出现且带声像
  startBed(id) {
    const kinds = BEDS[id] || [];
    if (!kinds.length || !this.ctx) return;
    const loop = () => {
      this.bedTimer = setTimeout(() => {
        if (!this.ctx || !this.scene || this.scene.id !== id) return;
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        this.bedEvent(kind);
        loop();
      }, 2200 + Math.random() * 4200);
    };
    loop();
  }

  bedEvent(kind) {
    const pan = Math.random() * 1.6 - 0.8;
    const amb = this.amb;
    switch (kind) {
      case "bird":
        [0, .11, .23].forEach((d, i) => this.tone(1750 + i * 260, { type: "sine", dur: .1, vol: .028, pan, delay: d, slide: 320, dest: amb }));
        break;
      case "wind":
        this.noise({ dur: 2.2, vol: .055, freq: 480, pan, dest: amb });
        break;
      case "lowwind":
        this.noise({ dur: 2.8, vol: .075, freq: 190, pan, dest: amb });
        break;
      case "flicker":
        this.noise({ dur: .05, vol: .05, filter: "highpass", freq: 3200, pan, dest: amb });
        this.tone(120, { type: "square", dur: .07, vol: .018, pan, dest: amb });
        break;
      case "beep":
        this.tone(1046, { type: "sine", dur: .09, vol: .03, pan, dest: amb });
        break;
      case "bubble":
        this.tone(420 + Math.random() * 300, { type: "sine", dur: .16, vol: .03, pan, slide: 260, dest: amb });
        break;
      case "breeze":
        this.noise({ dur: 1.6, vol: .045, filter: "bandpass", freq: 700, q: .5, pan, dest: amb });
        break;
      case "crickets":
        [0, .13, .26, .39].forEach(d => this.tone(4100, { type: "sine", dur: .045, vol: .016, pan, delay: d, dest: amb }));
        break;
      case "car":
        this.noise({ dur: 1.8, vol: .05, freq: 260, pan, dest: amb });
        this.tone(70, { dur: 1.5, vol: .025, slide: -18, pan, dest: amb });
        break;
      case "shimmer":
        [0, .16, .32].forEach((d, i) => this.tone(1200 + i * 420, { type: "sine", dur: .5, vol: .022, pan: -pan, delay: d, dest: amb }));
        break;
      default:
        this.sceneEvent(kind, pan, amb);
        break;
    }
  }

  sceneEvent(kind, pan = Math.random() * 1.6 - 0.8, dest = null) {
    switch (kind) {
      case "growl":
        this.tone(78 + Math.random() * 24, { type: "sawtooth", dur: .55, vol: .07, slide: -28, pan, dest });
        this.noise({ dur: .5, vol: .05, freq: 320, pan, dest });
        break;
      case "step":
        this.noise({ dur: .09, vol: .1, freq: 260, pan, dest });
        this.noise({ dur: .09, vol: .07, freq: 200, pan, delay: .28, dest });
        break;
      case "spark":
        this.noise({ dur: .08, vol: .13, filter: "highpass", freq: 2400, pan, dest });
        this.tone(1400, { type: "square", dur: .06, vol: .04, pan, slide: -900, dest });
        break;
      case "bug":
        this.tone(3200 + Math.random() * 900, { type: "sine", dur: .12, vol: .025, pan, dest });
        break;
      case "crowd":
        this.noise({ dur: .8, vol: .045, filter: "bandpass", freq: 620, q: .6, pan, dest });
        break;
      case "bark":
        this.tone(190, { type: "square", dur: .13, vol: .06, slide: -90, pan, dest });
        this.tone(170, { type: "square", dur: .1, vol: .05, slide: -80, pan, delay: .18, dest });
        break;
      case "rumble":
        this.noise({ dur: 1.6, vol: .12, freq: 140, pan, dest });
        this.tone(52, { dur: 1.4, vol: .08, slide: -14, pan, dest });
        break;
      case "portal":
        this.tone(220, { type: "sine", dur: .9, vol: .06, slide: 180, pan, dest });
        break;
      default: break;
    }
  }

  // ---------- 场景配乐（按剧情阶段变化） ----------
  startScore(id) {
    this.score = SCORES[id] || SCORES[1];
    this.step = 0;
    if (!this.ctx || !this.score) return;
    this.applyGains(true);
    this.scoreLoop();
  }

  scoreLoop() {
    if (!this.ctx || !this.score || !this.scene) return;
    const beatSec = 60 / (this.score.bpm * this.tempo) / 2; // 八分音符
    this.scoreTimer = setTimeout(() => {
      if (!this.ctx || !this.score || !this.scene) return;
      this.scoreTick(beatSec);
      this.scoreLoop();
    }, beatSec * 1000);
  }

  scoreTick(beatSec) {
    const s = this.score, st = this.step++;
    const chord = s.chords[Math.floor(st / 8) % s.chords.length];
    const base = s.root / 2;
    const music = this.music;
    const lift = this.phase === "victory" ? 1.25 : 1;

    // 每 8 步铺一层柔和和弦垫
    if (st % 8 === 0) {
      chord.forEach((semi, i) => {
        this.tone(base * Math.pow(2, semi / 12), {
          type: s.wave === "sawtooth" ? "triangle" : s.wave,
          dur: beatSec * 8.2, vol: (s.pad * lift) / (i + 1.6),
          pan: (i - 1) * .22, dest: music, attack: .35,
        });
      });
    }

    // 旋律动机：小游戏阶段变成更密的八分音符
    const pat = s.pattern[st % s.pattern.length];
    if (pat >= 0) {
      const semi = s.scale[pat % s.scale.length] + (this.phase === "victory" ? 12 : 0);
      const f = s.root * 2 * Math.pow(2, semi / 12);
      this.tone(f, {
        type: s.wave, dur: beatSec * 1.3,
        vol: s.lead * (this.phase === "explore" ? .8 : 1.1),
        pan: (st % 4 - 1.5) * .16, dest: music,
      });
    }
    if (this.phase === "mini" && st % 4 === 0) {
      this.noise({ dur: .07, vol: .045, freq: 190, dest: music });
      this.tone(s.root / 4, { type: "sine", dur: .14, vol: .05, dest: music });
    }
    if (this.phase === "tension" && st % 8 === 4) {
      this.tone(base * Math.pow(2, (chord[0] + 12) / 12), { type: "sine", dur: .5, vol: .03, dest: music, attack: .12 });
    }
  }

  setPhase(phase) {
    if (!PHASE_GAIN[phase] || this.phase === phase) return;
    this.phase = phase;
    this.tempo = PHASE_TEMPO[phase];
    this.applyGains(false);
    if (phase === "tension") {
      this.tone(196, { type: "sine", dur: .5, vol: .05, slide: -60, dest: this.sfx });
      this.noise({ dur: .4, vol: .04, filter: "bandpass", freq: 500, dest: this.sfx });
    }
    if (phase === "victory") {
      [523, 659, 784].forEach((f, i) => this.tone(f, { type: "triangle", dur: .6, vol: .045, delay: i * .09, dest: this.music }));
    }
  }

  // ---------- 交互提示音 ----------
  play(name, pan = 0, arg = null) {
    if (!this.ctx || this.muted || !this.layers.sfx) return;
    switch (name) {
      case "hover": {
        const now = Date.now();
        if (now - this.lastHover < 110) return;
        this.lastHover = now;
        this.tone(1180, { dur: .045, vol: .028, type: "sine", pan });
        break;
      }
      case "tap":
        this.tone(760, { dur: .05, vol: .05, type: "triangle", pan });
        break;
      case "cue": // 引导条出现
        this.tone(587, { dur: .12, vol: .055, type: "sine" });
        this.tone(880, { dur: .16, vol: .045, type: "sine", delay: .09 });
        break;
      case "select":
        this.tone(520, { dur: .09, vol: .13, type: "triangle", pan });
        this.tone(780, { dur: .1, vol: .1, type: "sine", pan, delay: .06 });
        break;
      case "dice":
        for (let i = 0; i < 6; i++) this.noise({ dur: .035, vol: .1, filter: "highpass", freq: 1800, delay: i * .095, pan });
        break;
      case "tick": // 骰子滚动
        this.noise({ dur: .025, vol: .05, filter: "highpass", freq: 2600, pan });
        break;
      case "tock": // 倒计时
        this.tone(880, { dur: .07, vol: .07, type: "square", pan });
        break;
      case "warning":
        this.tone(660, { dur: .14, vol: .1, type: "triangle" });
        this.tone(520, { dur: .18, vol: .09, type: "triangle", delay: .16 });
        break;
      case "spawn": // 目标冒出来
        this.tone(430, { dur: .09, vol: .06, type: "triangle", pan, slide: 180 });
        break;
      case "miss": // 点空了 / 不可点
        this.tone(180, { dur: .1, vol: .06, type: "sine", slide: -60, pan });
        break;
      case "hit":
        this.noise({ dur: .14, vol: .22, filter: "bandpass", freq: 900, q: .8, pan });
        this.tone(170, { type: "square", dur: .12, vol: .12, slide: -90, pan });
        break;
      case "collect":
        this.tone(880, { dur: .1, vol: .12, type: "sine", pan });
        this.tone(1320, { dur: .16, vol: .1, type: "sine", pan, delay: .07 });
        break;
      case "word":
        this.tone(660, { dur: .08, vol: .1, type: "triangle", pan });
        this.tone(990, { dur: .14, vol: .09, type: "sine", pan, delay: .06 });
        break;
      case "success":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, { dur: .3, vol: .13, type: "triangle", delay: i * .09, pan }));
        break;
      case "fail":
        this.tone(330, { dur: .22, vol: .12, type: "sawtooth", slide: -110, pan });
        this.tone(220, { dur: .3, vol: .1, type: "triangle", delay: .14, slide: -60, pan });
        break;
      case "damage":
        this.noise({ dur: .22, vol: .18, freq: 420, pan });
        this.tone(120, { type: "square", dur: .2, vol: .1, slide: -50, pan });
        break;
      case "combo":
        this.tone(700 + Math.min(6, arg ?? pan) * 90, { dur: .1, vol: .1, type: "square" });
        break;
      case "star":
        this.tone(1047 + (arg || 0) * 160, { dur: .2, vol: .09, type: "sine" });
        this.tone(1568 + (arg || 0) * 160, { dur: .16, vol: .05, type: "triangle", delay: .05 });
        break;
      case "goal":
        [784, 988, 1319].forEach((f, i) => this.tone(f, { dur: .24, vol: .1, type: "triangle", delay: i * .08 }));
        break;
      case "unlock":
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, { dur: .42, vol: .14, type: "triangle", delay: i * .11 }));
        break;
      case "whoosh":
        this.noise({ dur: .38, vol: .1, filter: "bandpass", freq: 1100, q: .5, pan });
        break;
      case "mode":
        this.tone(480, { dur: .08, vol: .07, type: "triangle" });
        this.tone(720, { dur: .12, vol: .06, type: "triangle", delay: .06 });
        break;
      case "toggle":
        this.tone(arg === false ? 420 : 640, { dur: .09, vol: .07, type: "sine" });
        break;
      case "exit":
        this.tone(520, { dur: .12, vol: .07, type: "triangle", slide: -180 });
        break;
      default: break;
    }
  }

  // 朗读（英文旁白 / 中文引导）时把环境音与配乐压低，避免盖住人声
  duck(ms = 1800) {
    if (!this.ctx) return;
    this.ducking = true;
    this.applyGains(true);
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      this.ducking = false;
      this.applyGains(false);
    }, ms);
  }

  setMuted(v) {
    this.muted = !!v;
    this.save();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, t, 0.06);
  }

  setMode(m) { this.mode = m; this.save(); }

  setLayer(key, on) {
    if (!(key in this.layers)) return;
    this.layers[key] = !!on;
    this.save();
    this.applyGains();
    this.play("toggle", 0, on);
  }

  setGuide(on) {
    this.guideOn = !!on;
    this.save();
    this.play("toggle", 0, on);
  }

  destroy() {
    this.stopScene();
    clearTimeout(this.duckTimer);
    this.ducking = false;
    this.scene = null;
    this.score = null;
    if (this.ctx) this.applyGains(true);
  }
}

export const sound = new SoundEngine();
