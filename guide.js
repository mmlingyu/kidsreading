// 语音引导：把「下一步该做什么」用中文念出来，同时在屏幕上给出文字与目标高亮。
// 英文剧情旁白与中文引导按队列依次朗读，互不打断；朗读期间自动压低环境音与配乐。
// 引导语音可独立开关、可重听；同一类提示在一局冒险里只念一次，避免打扰。
import { sound } from "./audio.js";
import { S, utter, esc, toast, cancelSpeech, unlockSpeech } from "./state.js";

export const HINTS = {
  welcome: (ch) => `第 ${ch} 章冒险开始！`,
  choice: (first) => first
    ? "点一张卡片决定下一步。飘着的英文单词牌也能点，会读给你听。"
    : "点一张卡片，决定接下来怎么做。",
  wordFirst: "很好，这个单词已经收进单词本啦，随时可以复习。",
  roll: (dc) => `骰子转起来啦！点数加二，达到 ${dc} 就成功。`,
  rollOk: "太棒了，检定成功！点继续往前走。",
  rollFail: "差一点点，别灰心，点继续看看发生了什么。",
  whack: (goal) => `僵尸会从洞里冒出来，快点点中 ${goal} 个！`,
  boss: (goal) => `点中传送门里冒出的怪物，${goal} 次就能封住它！`,
  scavenge: (goal) => `点货架上的零食和饮料，别点到僵尸！目标 ${goal} 个。`,
  lastSeconds: "还剩五秒，加油冲一下！",
  goal: "目标达成！准备进入下一段故事。",
  result: (hasNext) => hasNext
    ? "本章通关！下一章已经解锁，去读新故事吧。"
    : "全书通关！你是地球上最后的孩子！",
};

export class Guide {
  constructor(ch) {
    this.ch = ch;
    this.token = 0;
    this.seen = new Set();
    this.timers = [];
    this.speaking = false;
    this.current = { en: "", zh: HINTS.welcome(ch.id), key: "welcome", pulse: null };
  }

  html() {
    const on = sound.guideOn;
    return `<div class="guide-bar ${on ? "" : "off"}" id="guide-bar" role="status" aria-live="polite">
      <span class="guide-ico">${on ? "🗣" : "🔇"}</span>
      <span class="guide-waves" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="guide-text" id="guide-text">${esc(this.current.zh)}</span>
      <button class="guide-btn" id="guide-replay" title="重听这句提示" aria-label="重听提示">🔁</button>
      <button class="guide-btn" id="guide-toggle" title="开关语音引导" aria-label="开关语音引导">${on ? "🗣" : "🔇"}</button>
    </div>`;
  }

  attach() {
    const bar = document.getElementById("guide-bar");
    if (!bar) return;
    const replay = document.getElementById("guide-replay");
    const toggle = document.getElementById("guide-toggle");
    if (replay) replay.onclick = (e) => {
      e.stopPropagation();
      sound.unlock();
      this.replay();
    };
    if (toggle) toggle.onclick = (e) => {
      e.stopPropagation();
      sound.unlock();
      const on = !sound.guideOn;
      sound.setGuide(on);
      bar.classList.toggle("off", !on);
      toggle.textContent = on ? "🗣" : "🔇";
      bar.querySelector(".guide-ico").textContent = on ? "🗣" : "🔇";
      if (!on) cancelSpeech();
      toast(on ? "语音引导已开启" : "语音引导已关闭，文字提示仍在");
    };
    if (this.speaking) bar.classList.add("speaking");
  }

  // 屏幕文字始终更新；英文旁白每节点朗读，中文引导按 key 只念一次
  play({ en = "", zh = "", key = "", once = false, pulse = null, force = false } = {}) {
    if (!zh) return;
    const token = ++this.token;
    const fresh = force || !once || !this.seen.has(key);
    if (key) this.seen.add(key);
    this.current = { en, zh, key, pulse };
    this.clearTimers();

    const textEl = document.getElementById("guide-text");
    if (textEl) textEl.textContent = zh;
    const bar = document.getElementById("guide-bar");
    if (bar) bar.classList.remove("cue-flash");
    if (bar) { void bar.offsetWidth; bar.classList.add("cue-flash"); }

    if (pulse) this.pulse(pulse);
    if (!fresh) { this.setSpeaking(false); return; }

    cancelSpeech();
    unlockSpeech();
    const wantEn = S.settings.tts && !!en;
    const wantZh = sound.guideOn && !!zh;
    if (!wantEn && !wantZh) return;

    sound.duck(4000);
    if (wantZh) sound.play("cue");
    this.setSpeaking(true);
    const jobs = [];
    if (wantEn) jobs.push(utter(en, { lang: "en-US", rate: 0.92 }));
    if (wantZh) jobs.push(utter(zh, { lang: "zh-CN", rate: 1.0, pitch: 1.12 }));
    Promise.all(jobs).then(() => {
      if (token === this.token) this.setSpeaking(false);
    });
    const t = setTimeout(() => { if (token === this.token) this.setSpeaking(false); }, 120000);
    this.timers.push(t);
  }

  // 只更新文字、不发声（用于点单词牌等已经有专属发音的交互）
  note(zh) {
    if (!zh) return;
    this.current = { ...this.current, zh };
    const el = document.getElementById("guide-text");
    if (el) el.textContent = zh;
    const bar = document.getElementById("guide-bar");
    if (bar) { bar.classList.remove("cue-flash"); void bar.offsetWidth; bar.classList.add("cue-flash"); }
  }

  // 只念一句中文短提示（不重播英文剧情）
  hint(zh, key, opts = {}) {
    this.play({ zh, key, ...opts });
  }

  replay() {
    if (!this.current.zh) return;
    this.play({ ...this.current, force: true, once: false });
  }

  setSpeaking(v) {
    this.speaking = !!v;
    const bar = document.getElementById("guide-bar");
    if (bar) bar.classList.toggle("speaking", this.speaking);
  }

  pulse(selector, ms = 3600) {
    const els = [...document.querySelectorAll(selector)];
    els.slice(0, 4).forEach((el, i) => {
      el.classList.add("guide-pulse");
      const t = setTimeout(() => el.classList.remove("guide-pulse"), ms + i * 140);
      this.timers.push(t);
    });
  }

  clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  destroy() {
    this.clearTimers();
    this.token++;
    this.setSpeaking(false);
  }
}
