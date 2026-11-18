// 划词朗读：在阅读正文里拖选任意片段，浮出小工具条。
// 短语/整句 → 连续朗读（可慢速）；单个单词 → 额外给音节、IPA 音标与逐音节跟读。
// 中文选区自动切 zh-CN 语音；与「点词弹层」互斥，不会同时弹两个。
import { S, utter, addWord, toast, esc, stopSpeech } from "./state.js?v=reader-phase1-r5";
import { syllableHTML, ipaHTML, ipaOf, readSyllables, syllableSource } from "./syllables.js";

let bar = null;
let rootEl = null;
let hooks = {};
let lastText = "";
let debounce = null;
let cancelRead = null;

function speakText(text, lang, rate) {
  if (!S.settings.tts) { toast("朗读已关闭，可在阅读页打开 🔊"); return; }
  stopSpeech();
  utter(text.replace(/[“”]/g, ""), { lang, rate, pitch: lang === "zh-CN" ? 1 : 1.05 });
}

function stopRead() {
  if (cancelRead) { cancelRead(); cancelRead = null; }
  bar?.querySelectorAll(".syl.active").forEach((el) => el.classList.remove("active"));
  bar?.querySelector('[data-act="syl"]')?.classList.remove("playing");
}

function hide() {
  if (!bar) return;
  stopRead();
  bar.remove();
  bar = null;
  lastText = "";
}

function place(r) {
  if (!bar) return;
  const w = bar.offsetWidth || 320, h = bar.offsetHeight || 96;
  const left = Math.max(10, Math.min(window.innerWidth - w - 10, r.left + r.width / 2 - w / 2));
  const above = r.top - h - 10;
  bar.style.left = left + "px";
  bar.style.top = (above > 8 ? above : Math.min(window.innerHeight - h - 10, r.bottom + 10)) + "px";
}

function build(info, rect) {
  hide();
  const { text, isWord, lang } = info;
  const src = isWord ? syllableSource(text) : "rule";
  const note = isWord ? (src === "rule" ? "按拼读规则拆分" : "已核对音节") : `${text.split(/\s+/).length} 个词`;
  const ipa = isWord ? ipaOf(text) : { found: 0 };
  bar = document.createElement("div");
  bar.className = "sel-bar";
  bar.innerHTML = `
    <div class="sel-info">
      <div class="sel-text" title="${esc(text)}">“${esc(text.length > 60 ? text.slice(0, 58) + "…" : text)}” <span class="sel-note">${esc(note)}</span></div>
      ${isWord ? `<div class="sel-lines">
          <span class="sel-syl">${syllableHTML(text)}</span>
          <span class="sel-ipa">${ipa.found ? ipaHTML(text) : '<span class="ipa-none">暂无音标 · 可直接听发音</span>'}</span>
        </div>` : ""}
    </div>
    <div class="sel-actions">
      <button data-act="say" title="朗读选中内容">🔊 朗读</button>
      <button data-act="slow" title="放慢速度再听一遍">🐢 慢速</button>
      ${isWord ? '<button data-act="syl" title="一个音节一个音节地跟读">🍃 逐音节</button>' : ""}
      ${isWord ? '<button data-act="save" title="收进单词本">📒 收词</button>' : ""}
      <button data-act="close" class="sel-x" title="关闭">✕</button>
    </div>`;
  document.body.appendChild(bar);
  place(rect);

  // 按住按钮时不要清掉正文选区，否则朗读对象会丢
  bar.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) {
      const syl = e.target.closest("[data-say]");
      if (syl) { stopRead(); speakText(syl.dataset.say, "en-US", 0.78); }
      return;
    }
    const act = btn.dataset.act;
    if (act === "close") return hide();
    if (act === "say") { stopRead(); speakText(text, lang, 0.95); }
    else if (act === "slow") { stopRead(); speakText(text, lang, 0.68); }
    else if (act === "save") {
      addWord(text.toLowerCase());
      hooks.onWord?.(text.toLowerCase());
      toast(`已收进单词本：${text}`);
    } else if (act === "syl") {
      stopRead();
      const spans = [...bar.querySelectorAll(".syl")];
      btn.classList.add("playing");
      cancelRead = readSyllables(text, {
        onStep: (i) => {
          spans.forEach((s, j) => s.classList.toggle("active", j === i));
        },
        onDone: () => {
          btn.classList.remove("playing");
          spans.forEach((s) => s.classList.remove("active"));
          cancelRead = null;
          // 音节读完后补一次完整读音，避免孩子只听到碎片
          setTimeout(() => utter(text, { rate: 0.9 }), 260);
        },
      });
    }
  });
}

function check() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || !rootEl) return hide();
  const text = String(sel.toString() || "").trim().replace(/\s+/g, " ");
  if (!text || text.length > 240) return hide();
  // 选区必须完全落在阅读正文里，避免跨段/跨页面误触发
  for (const node of [sel.anchorNode, sel.focusNode]) {
    const el = node?.nodeType === 3 ? node.parentElement : node;
    if (!el || !rootEl.contains(el)) return hide();
  }
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const isWord = /^[A-Za-z][A-Za-z'’-]*$/.test(text) && text.length <= 24;
  const lang = /[\u3400-\u9fff]/.test(text) ? "zh-CN" : "en-US";
  const key = text + "|" + lang;
  if (bar && key === lastText) { place(rect); return; }
  lastText = key;
  build({ text, isWord, lang }, rect);
}

function onSelectionChange() {
  clearTimeout(debounce);
  debounce = setTimeout(check, 110);
}

function onKey(e) { if (e.key === "Escape") hide(); }
function onScroll() { if (bar) hide(); }
function onDown(e) {
  if (bar && !bar.contains(e.target) && !rootEl?.contains(e.target)) hide();
}

export function mountSelection(root, opts = {}) {
  destroySelection();
  rootEl = root;
  hooks = opts;
  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("pointerup", onSelectionChange);
  document.addEventListener("touchend", onSelectionChange);
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("keydown", onKey);
  window.addEventListener("scroll", onScroll, { passive: true });
}

export function destroySelection() {
  hide();
  document.removeEventListener("selectionchange", onSelectionChange);
  document.removeEventListener("pointerup", onSelectionChange);
  document.removeEventListener("touchend", onSelectionChange);
  document.removeEventListener("pointerdown", onDown);
  document.removeEventListener("keydown", onKey);
  window.removeEventListener("scroll", onScroll);
  clearTimeout(debounce);
  rootEl = null;
  hooks = {};
}

export const selectionText = () => (window.getSelection()?.toString() || "").trim();
