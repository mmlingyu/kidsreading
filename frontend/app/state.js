// 全局状态：进度、解锁、XP、单词本、设置（localStorage 持久化）
// 多本书：每本书的进度独立分桶存在 S.books[bookId]；
// 顶层 unlocked / stars / done / last 始终是「当前书」的镜像，
// 因此 app.js / game.js 里已有的 S.unlocked 等引用完全不用改。
import {speakClip,stopSpeaking,setEnglishEngine,setPiperVoice,setPhononVoice,migrateEngine,ttsEngines} from "./tts.js?v=reader-phase1-r5";
const KEY = "last-kids-reader-v1";
export const FIRST_BOOK = "tlkoe";

const bookProgress = () => ({ unlocked: 1, stars: {}, done: {}, last: 1 });

const DEFAULT = {
  ...bookProgress(),
  xp: 0,
  words: [],
  items: [],
  settings: { size: 20, showZh: true, tts: true, syllables: true, engine: "phonon-api", piperVoice: "", piperVoices: {}, phononVoice: "default" },
  quiz: {},
  known: [],
  mistakes: [],
  books: {},
  currentBook: FIRST_BOOK,
  chapterCount: 8,
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    const s = raw
      ? { ...structuredClone(DEFAULT), ...raw, settings: { ...DEFAULT.settings, ...(raw.settings || {}) } }
      : structuredClone(DEFAULT);
    // 迁移旧版单书存档：原本写在顶层的进度收进第一本书
    if (!raw || !raw.books || !Object.keys(raw.books).length) {
      s.books = { [FIRST_BOOK]: { unlocked: s.unlocked, stars: s.stars, done: s.done, last: s.last } };
      s.currentBook = FIRST_BOOK;
    }
    if (!s.books[s.currentBook]) s.currentBook = FIRST_BOOK;
    if (!s.books[s.currentBook]) s.books[s.currentBook] = bookProgress();
    Object.assign(s, s.books[s.currentBook]);
    return s;
  } catch {
    const s = structuredClone(DEFAULT);
    s.books = { [FIRST_BOOK]: bookProgress() };
    return s;
  }
}

export const S = load();
// 老存档没有音节开关字段时补默认值
if (typeof S.settings.syllables !== "boolean") S.settings.syllables = true;
S.settings.engine = migrateEngine(S.settings.engine);
if (!ttsEngines.some((item) => item.id === S.settings.engine)) S.settings.engine = "phonon-api";
delete S.settings.pocketVoice;
setEnglishEngine(S.settings.engine);
setPiperVoice(S.settings.piperVoice);
if(!S.settings.piperVoices||typeof S.settings.piperVoices!=='object'||Array.isArray(S.settings.piperVoices))S.settings.piperVoices={};
for(const language of ['zh','fr','ja','ko'])setPiperVoice(S.settings.piperVoices[language],language);
setPhononVoice(S.settings.phononVoice);
if (!Array.isArray(S.known)) S.known = [];
if (!Array.isArray(S.mistakes)) S.mistakes = [];
export const save = () => localStorage.setItem(KEY, JSON.stringify(S));

// 切换当前书：先归档旧书进度，再载入目标书进度到顶层镜像。
export function setBook(id, chapterCount = 8) {
  S.chapterCount = chapterCount;
  if (id === S.currentBook) return false;
  S.books[S.currentBook] = { unlocked: S.unlocked, stars: S.stars, done: S.done, last: S.last };
  const p = S.books[id] || bookProgress();
  S.books[id] = p;
  S.currentBook = id;
  Object.assign(S, p);
  S.chapterCount = chapterCount;
  save();
  return true;
}

// 只重置当前这本书的章节进度（XP / 单词本 / 其它书的进度保留）
export function resetBook() {
  Object.assign(S, bookProgress());
  S.books[S.currentBook] = bookProgress();
  save();
}

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
  S.unlocked = Math.min(S.chapterCount || 8, Math.max(S.unlocked, id + 1));
  S.last = id;
  if (!S.books[S.currentBook]) S.books[S.currentBook] = bookProgress();
  S.books[S.currentBook] = { unlocked: S.unlocked, stars: S.stars, done: S.done, last: S.last };
  save();
}

export function recordRecall(entry) {
  if (!window.AdventureRecall) return;
  const next = window.AdventureRecall.applyLedger(
    { known: S.known, mistakes: S.mistakes },
    entry
  );
  S.known = next.known;
  S.mistakes = next.mistakes;
  save();
}

export function reset() {
  Object.assign(S, structuredClone(DEFAULT));
  S.books = { [FIRST_BOOK]: bookProgress() };
  save();
}

export function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 1900);
}

// 朗读交给 tts.js。云端Piper/Phonon，浏览器语音由用户明确选择；Phonon中文提示明确使用浏览器。这里只检查开关并转交。
export function stopSpeech() {
  stopSpeaking();
}

export function utter(text, options = {}) {
  if (!S.settings.tts || !text) return null;
  return speakClip(text, options);
}

export function speak(text, rate = 0.92) {
  if (!S.settings.tts || !text) return null;
  stopSpeaking();
  return speakClip(text, { rate });
}

export const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
