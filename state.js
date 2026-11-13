// 全局状态：进度、解锁、XP、单词本、设置（localStorage 持久化）
const KEY = "last-kids-reader-v1";

const DEFAULT = {
  unlocked: 1,
  stars: {},
  done: {},
  xp: 0,
  words: [],
  items: [],
  settings: { size: 20, showZh: true, tts: true },
  last: 1,
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    return raw ? { ...structuredClone(DEFAULT), ...raw, settings: { ...DEFAULT.settings, ...(raw.settings || {}) } } : structuredClone(DEFAULT);
  } catch {
    return structuredClone(DEFAULT);
  }
}

export const S = load();
export const save = () => localStorage.setItem(KEY, JSON.stringify(S));

export function addXp(n) {
  S.xp += Math.max(0, Math.round(n));
  save();
}

export function addWord(w) {
  if (!S.words.includes(w)) S.words.push(w);
  save();
}

export function addItem(name) {
  if (!S.items.includes(name)) S.items.push(name);
  save();
}

export function finishChapter(id, stars) {
  S.done[id] = true;
  S.stars[id] = Math.max(S.stars[id] || 0, stars);
  S.unlocked = Math.min(8, Math.max(S.unlocked, id + 1));
  S.last = id;
  save();
}

export function reset() {
  Object.assign(S, structuredClone(DEFAULT));
  save();
}

export function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 1900);
}

// 生成一条语音并加入朗读队列。lang 可指定 en-US / zh-CN，用于「英文旁白 + 中文引导」连读。
export function utter(text, { lang = "en-US", rate = 0.92, pitch = 1.05, onend = null } = {}) {
  if (!("speechSynthesis" in window) || !text) return null;
  const u = new SpeechSynthesisUtterance(String(text).replace(/["“”]/g, ""));
  u.lang = lang;
  u.rate = rate;
  u.pitch = pitch;
  try {
    const prefix = lang.slice(0, 2).toLowerCase();
    const voices = window.speechSynthesis.getVoices() || [];
    const v = voices.find((x) => x.lang && x.lang.toLowerCase().replace("_", "-") === lang.toLowerCase())
      || voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(prefix));
    if (v) u.voice = v;
  } catch {}
  if (onend) u.onend = onend;
  try { window.speechSynthesis.speak(u); } catch { return null; }
  return u;
}

export function speak(text, rate = 0.92) {
  if (!S.settings.tts || !("speechSynthesis" in window) || !text) return null;
  window.speechSynthesis.cancel();
  return utter(text, { rate });
}

export const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
