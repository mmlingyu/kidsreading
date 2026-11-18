import {configureReader, readerRequest, getReaderBase} from './reader-api.js';
import { byId, allVocab, catalog } from "./data/bookshelf.js?v=2";
import { importBook, removeImported, clearImported , validateBook} from "./data/import-book.js";
import { S, save, addXp, addWord, reset, resetBook, setBook, finishChapter, recordRecall, toast, speak, utter, stopSpeech, esc } from "./state.js?v=24";
import {
  setEnglishEngine, setPocketVoice, setPhononVoice, ttsEngines, voicesForEngine,
  migrateEngine, engineFamily, defaultVoiceForEngine, voiceLabel,
} from "./tts.js?v=dual5";
import { mountGame } from "./game.js";
import { syllableText, syllableHTML, ipaText, ipaHTML, readSyllables } from "./syllables.js";
import { mountSelection, destroySelection, selectionText } from "./selection.js";

const app = document.getElementById("app");
const modal = document.getElementById("modal");
let currentGame = null;
let popup = null;
let activeRead = null;

// 全局事件委托：所有动态生成的词卡 / 弹层里的「点音节发音」与「逐音节跟读」都走这里
function stopRead() {
  if (activeRead) { activeRead(); activeRead = null; }
  document.querySelectorAll(".syl.active").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll("[data-read-syl].playing").forEach((el) => el.classList.remove("playing"));
}
function startSyllableRead(btn) {
  stopRead();
  const scope = btn.closest(".vocab, .word-pop, .card") || btn.parentElement;
  const spans = [...scope.querySelectorAll(".syl")];
  btn.classList.add("playing");
  const word = btn.dataset.readSyl;
  activeRead = readSyllables(word, {
    onStep: (i) => spans.forEach((s, j) => s.classList.toggle("active", j === i)),
    onDone: () => {
      btn.classList.remove("playing");
      spans.forEach((s) => s.classList.remove("active"));
      activeRead = null;
      setTimeout(() => speak(word, 0.9), 240);
    },
  });
}
document.addEventListener("click", (e) => {
  if (e.target.closest(".sel-bar")) return;          // 划词工具条自己处理
  const syl = e.target.closest("[data-say]");
  if (syl) { e.stopPropagation(); stopRead(); speak(syl.dataset.say, 0.8); return; }
  const read = e.target.closest("[data-read-syl]");
  if (read) { e.stopPropagation(); startSyllableRead(read); }
});
// 当前书的视图数据：所有页面共用，切书时统一切换，阅读/地图/游戏无需感知书 id
let ACTIVE, BOOK, CHAPTERS;

function syncActive() {
  if (!catalog().some((b) => b.id === S.currentBook && b.status === "ready")) {
    const fallback = byId("tlkoe");
    setBook(fallback.id, fallback.chapters.length);
  }
  ACTIVE = byId(S.currentBook);
  BOOK = ACTIVE.book;
  CHAPTERS = ACTIVE.chapters;
  S.chapterCount = CHAPTERS.length;
}

function go(hash) { location.hash = hash; }
let importTimer = 0;
function closeModal() {
  if (importTimer) { clearInterval(importTimer); importTimer = 0; }
  modal.classList.add("hidden");
  modal.innerHTML = "";
}
function showModal(html) {
  modal.innerHTML = `<div class="box">${html}</div>`;
  modal.classList.remove("hidden");
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

function shell(inner, opts = {}) {
  return `
    <div class="topbar">
      <div class="brand"><span class="bolt">⚡</span><span>${opts.brand || "小小冒险家 · 英语分级阅读"}</span></div>
      <div class="spacer"></div>
      <span class="chip book-chip" title="当前在读">📖 ${esc(BOOK.zh || BOOK.title)}</span>
      <span class="chip xp">⭐ ${S.xp} XP</span>
      <button class="btn small" id="m-vocab">📒 单词本 (${S.words.length})</button>
      <button class="btn small" id="m-known">知识库 (${S.known.length})</button>
      <button class="btn small" id="m-wrong">错题本 (${S.mistakes.length})</button>
      ${opts.home ? "" : '<button class="btn small" id="m-home">📚 书架</button>'}
    </div>${inner}`;
}

function speakRecall(item) {
  if (!item || !S.settings.tts) return;
  const line = String(item.sentence || "").replace("____", item.answer || "");
  stopSpeech();
  utter(line, { rate: 0.9 });
  if (item.prompt) utter(String(item.prompt), { lang: "zh-CN", rate: 1, pitch: 1.05 });
}

function paintLedgers() {
  const known = document.querySelector("#m-known");
  const wrong = document.querySelector("#m-wrong");
  if (known) known.textContent = `知识库 (${S.known.length})`;
  if (wrong) wrong.textContent = `错题本 (${S.mistakes.length})`;
}

function engineSelect() {
  const engine = migrateEngine(S.settings.engine);
  const options = ttsEngines.map((item) => (
    `<option value="${item.id}"${engine === item.id ? " selected" : ""}>${item.label}</option>`
  )).join("");
  return `<label class="engine-pick">英文朗读 <select class="tts-engine">${options}</select></label>`;
}

function voiceSelect() {
  const engine = migrateEngine(S.settings.engine);
  const family = engineFamily(engine);
  if (family === "browser") return "";
  const list = voicesForEngine(engine);
  let current = family === "phonon"
    ? (S.settings.phononVoice || "default")
    : (S.settings.pocketVoice || "alba");
  if (!list.some((item) => item.id === current)) {
    current = defaultVoiceForEngine(engine);
    if (family === "phonon") S.settings.phononVoice = current;
    else S.settings.pocketVoice = current;
  }
  const groups = [
    { key: "unknown", label: "默认" },
    { key: "female", label: "女声" },
    { key: "male", label: "男声" },
  ];
  const options = groups.map(({ key, label }) => {
    const items = list.filter((item) => (item.gender || "unknown") === key);
    if (!items.length) return "";
    return `<optgroup label="${label}">${items.map((item) => (
      `<option value="${item.id}"${item.id === current ? " selected" : ""}>${esc(voiceLabel(item))}</option>`
    )).join("")}</optgroup>`;
  }).join("");
  const label = family === "phonon" ? "Phonon 音色" : "Pocket 音色";
  return `<label class="engine-pick">${label} <select class="tts-voice">${options}</select></label>`;
}

function engineToast(id) {
  return ({
    "phonon-api": "英文改用 Phonon 本机",
    "pocket-api": "英文改用 Pocket 本机",
    "pocket-wasm": "英文改用 Pocket 网页",
    browser: "英文改用浏览器语音",
  })[id] || "已切换英文朗读";
}

function bindShell() {
  const v = document.querySelector("#m-vocab");
  if (v) v.onclick = openVocabBook;
  const known = document.querySelector("#m-known");
  if (known) known.onclick = openKnowledge;
  const wrong = document.querySelector("#m-wrong");
  if (wrong) wrong.onclick = openMistakes;
  const h = document.querySelector("#m-home");
  if (h) h.onclick = () => go("#/home");
  app.querySelectorAll(".tts-engine").forEach((select) => {
    select.onchange = () => {
      const engine = migrateEngine(select.value);
      S.settings.engine = engine;
      setEnglishEngine(engine);
      const family = engineFamily(engine);
      if (family === "phonon") {
        if (!voicesForEngine(engine).some((item) => item.id === S.settings.phononVoice)) {
          S.settings.phononVoice = defaultVoiceForEngine(engine);
        }
        setPhononVoice(S.settings.phononVoice);
      } else if (family === "pocket") {
        if (!voicesForEngine(engine).some((item) => item.id === S.settings.pocketVoice)) {
          S.settings.pocketVoice = defaultVoiceForEngine(engine);
        }
        setPocketVoice(S.settings.pocketVoice);
      }
      save();
      stopSpeech();
      toast(engineToast(engine));
      // 同页改引擎时 hash 不变，go(hash) 不会触发渲染，音色下拉会仍显示上一套
      render();
    };
  });
  app.querySelectorAll(".tts-voice").forEach((select) => {
    select.onchange = () => {
      const engine = migrateEngine(S.settings.engine);
      const family = engineFamily(engine);
      const voice = voicesForEngine(engine).find((item) => item.id === select.value);
      if (!voice) return;
      if (family === "phonon") {
        S.settings.phononVoice = voice.id;
        setPhononVoice(voice.id);
        toast(`Phonon 音色换成 ${voiceLabel(voice)}`);
      } else {
        S.settings.pocketVoice = voice.id;
        setPocketVoice(voice.id);
        toast(`Pocket 音色换成 ${voiceLabel(voice)}`);
      }
      save();
      stopSpeech();
      app.querySelectorAll(".tts-voice").forEach((other) => { other.value = voice.id; });
    };
  });
}

// ---------------- 书架卡片 ----------------
function bookCard(b) {
  const ready = b.status === "ready";
  const isImport = b.status === "import";
  const isActive = b.id === S.currentBook;
  const p = S.books[b.id] || { unlocked: 1, done: {}, stars: {} };
  const done = Object.keys(p.done || {}).length;
  const total = ready ? b.chapters.length : 0;
  const pct = ready ? Math.round((done / total) * 100) : 0;
  const badge = isImport ? "导入" : isActive ? "正在读" : done ? "继续读" : "新书";
  return `<button class="book-card ${isImport ? "import-card" : ""} ${isActive && ready ? "active" : ""}" ${isImport ? 'data-import="1"' : `data-book="${b.id}"`} style="--bc:${b.color}">
    <div class="bc-cover">
      ${b.cover ? `<img src="${b.cover}" alt="${esc(ready ? b.book.title : b.title)}" />` : '<div class="bc-placeholder">＋</div>'}
      <span class="bc-badge">${badge}</span>
    </div>
    <div class="bc-body">
      <div class="bc-kicker">${esc(b.kicker)}</div>
      <div class="bc-title">${esc(ready ? b.book.title : b.title)}</div>
      <div class="bc-zh">${esc(ready ? b.book.zh : b.zh)}</div>
      <div class="bc-meta">${esc(b.age)}　·　${esc(b.level)}</div>
      <div class="bc-blurb">${esc(b.blurb)}</div>
      ${ready
        ? `<div class="bc-progress"><i style="width:${pct}%"></i></div>
           <div class="bc-foot"><b>${done}/${total} 章 · ${pct}%</b>${isActive ? "<span>← 当前在读</span>" : "<span>点击切换</span>"}${b.imported ? `<span class="bc-remove" data-remove="${esc(b.id)}">移出</span>` : ""}</div>`
        : `<div class="bc-foot"><span>${esc(b.tagline)}</span></div>`}
    </div>
  </button>`;
}

// ---------------- 首页（书架） ----------------
function viewHome() {
  const doneCount = Object.keys(S.done).length;
  const pct = Math.round((doneCount / CHAPTERS.length) * 100);
  const shelf = catalog();
  const credits = shelf.filter((b) => b.credit).map((b) => `${b.book.title}：${b.credit}`).join("<br>");
  app.innerHTML = shell(`
    <div class="hero">
      ${ACTIVE.hero ? `<img class="hero-bg" src="${ACTIVE.hero}" alt="${esc(BOOK.title)}" />` : `<div class="hero-bg hero-fallback" style="background:${esc(ACTIVE.color || "#7eb6ff")}"></div>`}
      <div class="hero-copy">
        <span class="kicker">${esc(ACTIVE.kicker)}</span>
        <h1>${ACTIVE.heroHtml ? ACTIVE.heroTitle : esc(ACTIVE.heroTitle || BOOK.title)}</h1>
        <p>${esc(ACTIVE.level)}　·　${esc(ACTIVE.age)}<br>${esc(ACTIVE.tagline)}</p>
        <div class="hero-actions">
          <button class="btn primary" id="h-continue">📖 ${doneCount ? "继续冒险" : "开始阅读"}</button>
          <button class="btn orange" id="h-map">🗺 章节地图</button>
        </div>
      </div>
    </div>
    <div class="progress-strip">
      <div class="card stat"><b>${doneCount}/${CHAPTERS.length}</b><span>本书已通关 · ${pct}%</span></div>
      <div class="card stat"><b>${S.xp}</b><span>累计 XP</span></div>
      <div class="card stat"><b>${S.words.length}</b><span>收集的单词</span></div>
    </div>

    <div class="section-title">📚 我的书架 <small>${shelf.filter((b) => b.status === "ready").length} 本可读 · 点卡片切换</small></div>
    <div class="shelf">${shelf.map(bookCard).join("")}</div>

    <div class="quote">“${esc(BOOK.quote.en)}”<small>${esc(BOOK.quote.zh)}</small></div>
    <div class="section-title">🎮 这套书怎么玩</div>
    <div class="card" style="padding:20px;line-height:1.9;font-size:16px;font-weight:700">
      ① <b>逐章解锁</b>：完成一章的章末冒险，才会解锁下一章；每本书的进度彼此独立，XP 与单词本则在整个书架共享。<br>
      ② <b>双语精读 · 划词朗读</b>：点任意生词听发音、看拼写音节与美式音标，自动收进单词本；
      在正文里拖选任意单词或句子即可朗读、慢速重听、逐音节跟读，单个音节也能点开单独听；阅读工具栏可开关正文音节提示。<br>
      ③ <b>阅读小测</b>：每章有理解题，答对得 XP。<br>
      ④ <b>沉浸式冒险</b>：每章结尾按该章图书插图的构图复刻成场景——天色、远景、前景遮挡与角色都跟着章节变；
      选择、掷骰、伪 3D 小游戏都发生在场景里，镜头会随剧情推进、成功与失败而变化。<br>
      ⑤ <b>三种画面模式</b>：🎬 电影（2.5D 分层视差）／🧊 立体（可转视角的 CSS 3D 布景）／🔋 省电；
      场景里还藏着可点读的英文单词牌。<br>
      ⑥ <b>会说话的冒险</b>：每章有专属配乐与匹配场景的环境音（风声、鸟叫、走廊脚步、夜灯微光…），
      剧情推进时配乐会转紧张或明快；中文语音引导告诉你下一步做什么，点选、掷骰、命中、倒计时、通关各有提示音。
      右上角 🎚 可分别开关环境音 / 配乐 / 交互音 / 语音引导。
    </div>
    <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      ${engineSelect()}${voiceSelect()}
      <button class="btn small" id="h-import">导入</button>
      <button class="btn small ghost" id="h-reset-book">重置本书进度</button>
      <button class="btn small ghost" id="h-reset">清空全部数据</button>
      <span style="color:var(--ink-2);font-size:13px;font-weight:700">进度保存在本机浏览器，不上传任何数据</span>
    </div>
    <div style="margin-top:22px;text-align:center;color:var(--ink-2);font-size:12px;font-weight:700;line-height:1.9">
      <b>版权与素材说明</b><br>
      两本书均为依原著情节脉络所做的<b>简化英文重述</b>，不含原书原文，仅用于个人英语学习原型，非商用；原著文本与插画版权归作者及出版社所有。<br>
      ${credits}<br>
      章末像素特效来自 pixelfx (MIT License, Patch / Hugo Duprez)，版权见 vendor/pixelfx/LICENSE ·
      场景配乐、环境音、交互提示音与中文语音引导均在本机实时合成 / 调用系统语音，无外部音频文件 ·
      美式 IPA 音标由 CMU Pronouncing Dictionary (Carnegie Mellon University, 使用不受限制) 离线生成，说明见 reference/book-assets/CMUDICT-README.txt
    </div>`, { home: true });

  bindShell();
  document.querySelector("#h-continue").onclick = () => go(`#/read/${Math.min(S.unlocked, S.chapterCount)}`);
  document.querySelector("#h-map").onclick = () => go("#/map");
  document.querySelector("#h-import").onclick = openImport;
  const importCard = app.querySelector("[data-import]");
  if (importCard) importCard.onclick = openImport;
  app.querySelectorAll(".book-card[data-book]").forEach((card) => {
    card.onclick = (event) => {
      const remove = event.target.closest("[data-remove]");
      if (remove) {
        event.stopPropagation();
        const id = remove.dataset.remove;
        removeImported(id);
        if (S.currentBook === id) {
          const fallback = byId("tlkoe");
          setBook(fallback.id, fallback.chapters.length);
        }
        render();
        toast("已移出这本书");
        return;
      }
      go(`#/book/${card.dataset.book}`);
    };
  });
  document.querySelector("#h-reset-book").onclick = () => {
    showModal(`<h3>重置《${esc(BOOK.zh || BOOK.title)}》的进度？</h3><p style="font-weight:700;color:var(--ink-2)">只清空这本书的章节解锁与星级；XP、单词本和其它书的进度保留。</p>
      <div style="display:flex;gap:10px;margin-top:16px"><button class="btn small" id="r-cancel">取消</button><button class="btn small orange" id="r-ok">确认重置</button></div>`);
    modal.querySelector("#r-cancel").onclick = closeModal;
    modal.querySelector("#r-ok").onclick = () => { resetBook(); closeModal(); render(); toast("本书进度已重置"); };
  };
  document.querySelector("#h-reset").onclick = () => {
    showModal(`<h3>清空全部数据？</h3><p style="font-weight:700;color:var(--ink-2)">会清空所有书的解锁章节、XP 和单词本，无法撤销。</p>
      <div style="display:flex;gap:10px;margin-top:16px"><button class="btn small" id="r-cancel">取消</button><button class="btn small orange" id="r-ok">确认清空</button></div>`);
    modal.querySelector("#r-cancel").onclick = closeModal;
    modal.querySelector("#r-ok").onclick = () => { clearImported(); reset(); closeModal(); render(); toast("全部数据已清空"); };
  };
}

let readerPollDeadline = 0;
let readerPollBusy = false;
let readerSubmitting = false;
let readerAttempt = {digest:'',key:''};
const IMPORT_JOB = "xiaoxiao-reader-import";

function openImport() {
  showModal(`<h3>导入</h3>
    <p class="import-note">支持正文、公开网页与本地书稿。URL先由安全抓取器提取正文；Token仅存内存。</p>
    <label>服务源地址 <input id="reader-base" type="url" value="${esc(getReaderBase())}" placeholder="留空使用当前站点 HTTPS" /></label>
    <label>Reader Token <input id="reader-token" type="password" autocomplete="off" spellcheck="false" /></label>
    <div class="import-tabs">
      <button type="button" class="on" data-tab="text">粘贴正文</button>
      <button type="button" data-tab="url">网页链接</button>
      <button type="button" data-tab="file">已有的书</button>
    </div>
    <label class="import-age" id="import-age-row">年龄带
      <select id="import-age">
        <option value="8-12">8–12 岁</option>
        <option value="4-6">4–6 岁</option>
      </select>
    </label>
    <div class="import-pane" data-pane="text">
      <textarea id="import-text" placeholder="贴一段故事或文章。会改写成带中文和语法的分级英文，不是逐句翻译。"></textarea>
    </div>
    <div class="import-pane hidden" data-pane="url">
      <input id="import-url" type="url" placeholder="https:// 故事或文章地址" />
    </div>
    <div class="import-pane hidden" data-pane="file">
      <p class="import-note">选择已经通过校验的 book.json。这份文件不经过模型。</p>
      <input id="import-file" type="file" accept="application/json,.json" />
    </div>
    <p id="import-status" class="import-note"></p>
    <ul id="import-errors"></ul>
    <div class="import-actions">
      <button class="btn small" id="import-go">生成对照</button>
      <button class="btn small ghost" id="import-cancel-job">取消生成任务</button>
      <button class="btn small ghost" id="i-cancel">关闭（不取消后台任务）</button>
    </div>`);
  modal.querySelector(".box").classList.add("import-wide");
  modal.querySelector("#i-cancel").onclick = closeModal;
  modal.querySelector("#import-cancel-job").onclick = async () => {
    const id = sessionStorage.getItem(IMPORT_JOB);
    if (!id) return;
    try {
      configureReader(modal.querySelector("#reader-base").value, modal.querySelector("#reader-token").value);
      const job = await readerRequest(`/api/reader/imports/${id}/cancel`, {method:'POST'});
      setImportStatus(job.status === 'cancelled' ? '任务已取消' : '正在终止服务端进程…');
      pollReaderImport(id);
    } catch (error) { paintImportErrors([error.message]); }
  };
  modal.querySelectorAll(".import-tabs button").forEach((button) => {
    button.onclick = () => setImportTab(button.dataset.tab);
  });
  modal.querySelector("#import-go").onclick = () => {
    const tab = modal.querySelector(".import-tabs button.on").dataset.tab;
    const age = modal.querySelector("#import-age").value;
    try {
      configureReader(modal.querySelector("#reader-base").value, modal.querySelector("#reader-token").value);
      modal.querySelector("#reader-token").value = '';
    } catch (error) { paintImportErrors([error.message]); return; }
    if (tab === "url") startReaderImport({ source: "url", url: modal.querySelector("#import-url").value, age });
    else startReaderImport({ source: "text", text: modal.querySelector("#import-text").value, age });
  };
  modal.querySelector("#import-file").onchange = () => {
    const file = modal.querySelector("#import-file").files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { paintImportErrors(["书稿需小于2MiB"]); return; }
    const reader = new FileReader();
    reader.onload = () => {
      let book;
      try { book = JSON.parse(String(reader.result || "")); }
      catch { paintImportErrors(["这不是一份 JSON 书"]); return; }
      showBookPreview(book);
    };
    reader.readAsText(file, "utf-8");
  };
  const pending = sessionStorage.getItem(IMPORT_JOB);
  if (pending) setImportStatus("有待查询任务。重新输入 Token 后点击生成即可恢复查询，不会重复创建。");
}

function setImportTab(tab) {
  modal.querySelectorAll(".import-tabs button").forEach((button) => {
    button.classList.toggle("on", button.dataset.tab === tab);
  });
  modal.querySelectorAll(".import-pane").forEach((pane) => {
    pane.classList.toggle("hidden", pane.dataset.pane !== tab);
  });
  const fileTab = tab === "file";
  modal.querySelector("#import-age-row").classList.toggle("hidden", fileTab);
  modal.querySelector("#import-go").classList.toggle("hidden", fileTab);
}

async function startReaderImport(body) {
  if (readerSubmitting) return;
  const pending = sessionStorage.getItem(IMPORT_JOB);
  if (pending) { pollReaderImport(pending); return; }
  if (body.source === 'text' && (body.text.trim().length < 20 || body.text.trim().length > 20000)) { paintImportErrors(['正文需为20至20000字']); return; }
  if (body.source === 'url') {
    try { const u = new URL(body.url); if (!['http:','https:'].includes(u.protocol)) throw Error(); } catch { paintImportErrors(['请输入合法的HTTP或HTTPS公开网页链接']); return; }
  }
  readerSubmitting = true;
  paintImportErrors([]);
  setImportStatus('正在提交到创作服务…');
  modal.querySelector('#import-go').disabled = true;
  // Retain request key across retries; never retain source or token.
  try {
  const fingerprint = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
  const digest = [...new Uint8Array(fingerprint)].map(v=>v.toString(16).padStart(2,'0')).join('');
  if (readerAttempt.digest !== digest) readerAttempt = {digest,key:crypto.randomUUID()};
  const key = readerAttempt.key;
    const payload = await readerRequest('/api/reader/imports', {method:'POST',body,key});
    sessionStorage.setItem(IMPORT_JOB, payload.id);
    pollReaderImport(payload.id);
  } catch (error) {
    paintImportErrors([error.message || '网络请求失败；请确认HTTPS证书和服务状态']);
    setImportStatus('');
    const go = modal.querySelector('#import-go'); if (go) go.disabled = false;
  } finally { readerSubmitting = false; }
}

function pollReaderImport(id) {
  if (importTimer) clearInterval(importTimer);
  readerPollDeadline = Date.now() + 16 * 60 * 1000;
  const tick = async () => {
    if (readerPollBusy) return;
    if (!modal.querySelector('#import-status') && !modal.querySelector('#import-preview')) {
      clearInterval(importTimer); importTimer = 0; return;
    }
    if (Date.now() > readerPollDeadline) {
      clearInterval(importTimer); importTimer = 0;
      paintImportErrors(['等待已达16分钟。后台任务最长15分钟；可重新查询或点取消生成任务。']); return;
    }
    readerPollBusy = true;
    try {
      const job = await readerRequest(`/api/reader/imports/${encodeURIComponent(id)}`);
      if (['ready','failed','cancelled'].includes(job.status)) {
        clearInterval(importTimer); importTimer = 0;
        sessionStorage.removeItem(IMPORT_JOB);
        readerAttempt = {digest:'',key:''};
        if (job.status === 'ready' && job.book) { showBookPreview(job.book); return; }
        const go = modal.querySelector('#import-go'); if (go) go.disabled = false;
        paintImportErrors([job.error || (job.status === 'cancelled' ? '任务已取消' : '生成未通过校验')]);
        setImportStatus(''); return;
      }
      if (!['queued','running','cancelling'].includes(job.status)) throw Error('未知任务状态，请联系管理员');
      setImportStatus(`${job.label}…`);
    } catch (error) {
      clearInterval(importTimer); importTimer = 0;
      // Keep only opaque job ID for explicit retry; never poll forever after auth/network errors.
      paintImportErrors([error.message || '查询失败，请重新输入Token后查询']);
      const go = modal.querySelector('#import-go'); if (go) go.disabled = false;
    } finally { readerPollBusy = false; }
  };
  tick();
  importTimer = setInterval(tick, 2000);
}

function setImportStatus(text) {
  const node = modal.querySelector("#import-status");
  if (node) node.textContent = text;
}

function showBookPreview(book) {
  let errors;
  try { errors = validateBook(book); } catch { errors = ["书稿结构不合法"]; }
  if (errors.length) { paintImportErrors(errors); return; }
  const title = (book.book && (book.book.zh || book.book.title)) || "这本书";
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const sentences = chapters.reduce((sum, chapter) => sum + ((chapter.paragraphs || []).length), 0);
  showModal(`<h3>中英对照 · ${esc(title)}</h3>
    <p class="import-note">${chapters.length} 章 · ${sentences} 句。英文用来朗读，中文可以在阅读页里隐藏。确认后才收进这台浏览器的书架。</p>
    <div id="import-preview">${chapters.map((chapter) => `<section class="import-ch">
      <h4>CH.${esc(chapter.id)} · ${esc(chapter.title || "")} <small>${esc(chapter.zh || "")}</small></h4>
      ${(chapter.paragraphs || []).map((paragraph) => `<p class="import-en">${esc(paragraph.en || "")}</p>
        <p class="import-zh">${esc(paragraph.zh || "")}</p>
        <p class="import-gr"><b>${esc((paragraph.grammar && paragraph.grammar.title) || "")}</b>${esc((paragraph.grammar && paragraph.grammar.explain) || "")}</p>`).join("")}
    </section>`).join("")}</div>
    <ul id="import-errors"></ul>
    <div class="import-actions">
      <button class="btn small" id="i-keep">收进书架</button>
      <button class="btn small ghost" id="i-cancel">放弃</button>
    </div>`);
  modal.querySelector(".box").classList.add("import-wide");
  modal.querySelector("#i-cancel").onclick = () => {
    sessionStorage.removeItem(IMPORT_JOB);
    closeModal();
  };
  modal.querySelector("#i-keep").onclick = () => {
    const result = importBook(book);
    if (!result.ok) { paintImportErrors(result.errors); return; }
    sessionStorage.removeItem(IMPORT_JOB);
    closeModal();
    render();
    toast(`已导入《${result.book.book.zh}》`);
  };
}
function paintImportErrors(errors) {
  const box = modal.querySelector("#import-errors");
  if (box) box.innerHTML = errors.map((item) => `<li>${esc(item)}</li>`).join("");
}

// ---------------- 章节地图 ----------------
function viewMap() {
  app.innerHTML = shell(`
    <div class="map-head">
      <div><h2>🗺 ${esc(BOOK.zh || BOOK.title)} · 章节地图</h2><p>完成一章的冒险，解锁下一章。每一章都是一个新的任务关卡。</p></div>
      <button class="btn small" id="back-home">← 书架</button>
    </div>
    <div class="chapter-list">
      ${CHAPTERS.map((c) => {
        const locked = c.id > S.unlocked;
        const stars = S.stars[c.id] || 0;
        return `<div class="card chapter-card ${locked ? "locked" : ""}" data-id="${c.id}" role="button" tabindex="${locked ? -1 : 0}">
          ${c.art ? `<img src="${c.art}" alt="" />` : `<div class="chapter-fallback" style="background:${esc(ACTIVE.color || "#7eb6ff")}"></div>`}
          <div>
            <h3>CH.${c.id} · ${esc(c.title)}</h3>
            <div class="zh">${esc(c.zh)} <span class="tag">${esc(c.tag)}</span></div>
            <div class="tag" style="background:#eef0ff;border-color:var(--purple);color:var(--purple)">✎ ${esc(Array.isArray(c.game.recall) ? "单词语法填空" : c.game.zh)} · 约 ${c.minutes} 分钟</div>
          </div>
          <div class="chapter-state">
            <div class="stars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div>
            ${locked ? "🔒 未解锁" : S.done[c.id] ? "✅ 已通关" : "👉 开始阅读"}
          </div>
        </div>`;
      }).join("")}
    </div>`);
  bindShell();
  document.querySelector("#back-home").onclick = () => go("#/home");
  app.querySelectorAll(".chapter-card").forEach((card) => {
    const open = () => {
      const id = Number(card.dataset.id);
      if (id > S.unlocked) return toast("先完成上一章的填空或冒险，才能解锁哦 🔒");
      go(`#/read/${id}`);
    };
    card.onclick = open;
    card.onkeydown = (e) => { if (e.key === "Enter") open(); };
  });
}

// ---------------- 阅读器 ----------------
function markWords(text, vocab) {
  let s = text;
  const sorted = [...vocab].sort((a, b) => b.w.length - a.w.length);
  const marks = [];
  sorted.forEach((v) => {
    const re = new RegExp(`\\b${v.w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    s = s.replace(re, (m) => { marks.push({ v, m }); return `\u0001${marks.length - 1}\u0001`; });
  });
  return s.split("\u0001").map((part, i) => {
    if (i % 2 === 0) return esc(part);
    const { v, m } = marks[Number(part)];
    return `<span class="w ${S.words.includes(v.w) ? "hit" : ""}" data-w="${esc(v.w)}" data-zh="${esc(v.zh)}" data-syl="${esc(syllableText(v.w))}" data-ipa="${esc(ipaText(v.w))}">${esc(m)}</span>`;
  }).join("");
}

function viewReader(id) {
  const ch = CHAPTERS.find((c) => c.id === id);
  if (!ch) return go("#/map");
  if (id > S.unlocked) { toast("这一章还没解锁 🔒"); return go("#/map"); }
  S.last = id; save();

  app.innerHTML = shell(`
    <div class="card reader-bar">
      <button class="btn small" id="r-back">← 地图</button>
      <span class="title">CH.${ch.id} · ${esc(ch.title)} / ${esc(ch.zh)}</span>
      <button class="btn small" id="r-minus">A−</button>
      <button class="btn small" id="r-plus">A＋</button>
      <button class="btn small" id="r-zh">${S.settings.showZh ? "隐藏中文" : "显示中文"}</button>
      <button class="btn small" id="r-syl">🔤 音节提示 ${S.settings.syllables ? "开" : "关"}</button>
      ${engineSelect()}${voiceSelect()}
      <button class="btn small purple" id="r-speak">🔊 朗读整章</button>
    </div>
    ${ch.art ? `<img class="reader-art" src="${ch.art}" alt="${esc(ch.title)}" />` : `<div class="reader-art reader-art-empty">这一章没有插画</div>`}
    <div class="reader-meta">
      <span>⏱ 约 ${ch.minutes} 分钟</span><span>📖 ${esc(ACTIVE.level)}</span><span>✎ 章末：${esc(Array.isArray(ch.game.recall) ? "单词语法填空" : ch.game.zh)}</span>
      <span>🖼 图书插图</span>
    </div>
    <div class="card paper ${S.settings.syllables ? "syl-on" : ""}" id="paper" style="--read-size:${S.settings.size}px">
      ${ch.paragraphs.map((p, i) => `<div class="para" data-i="${i}">
        <span class="idx">${i + 1}</span><span class="en">${markWords(p.en, ch.vocab)}</span>
        <button class="play" data-play="${i}">🔊 朗读本段</button>
        <div class="zh" style="${S.settings.showZh ? "" : "display:none"}">${esc(p.zh)}</div>
        ${p.grammar ? `<div class="grammar"><b>${esc(p.grammar.title)}</b>${esc(p.grammar.explain)}</div>` : ""}
      </div>`).join("")}
    </div>
    <div class="card quiz" id="quiz">
      <h3>🧠 阅读小挑战 <small style="font-size:13px;color:var(--ink-2)">答对 +10 XP</small></h3>
      ${ch.quiz.map((q, qi) => `<div class="quiz-item" data-qi="${qi}">
        <p>${qi + 1}. ${esc(q.q)} <span style="color:var(--ink-2)">${esc(q.zh)}</span></p>
        <div class="quiz-opts">${q.options.map((o, oi) => `<button data-qi="${qi}" data-oi="${oi}">${esc(o)}</button>`).join("")}</div>
      </div>`).join("")}
    </div>
    <div class="section-title">📒 本章核心词</div>
    <div class="vocab-grid">
      ${ch.vocab.map((v) => `<div class="card vocab">
        <b>${esc(v.w)}</b><span class="pos">${esc(v.pos)}</span> ${esc(v.zh)}
        <div class="vocab-pron">
          <div>${syllableHTML(v.w)}</div>
          <div>${ipaHTML(v.w)}</div>
        </div>
        <p>${esc(v.eg)}<br>${esc(v.egZh)}</p>
        <div class="vocab-btns">
          <button class="btn small" data-say="${esc(v.w)}">🔊 整词</button>
          <button class="btn small purple" data-read-syl="${esc(v.w)}">🍃 逐音节</button>
        </div></div>`).join("")}
    </div>
    <div class="card quiz" style="background:#f1ffdc;border-color:var(--lime-d);margin-top:22px;text-align:center">
      ${Array.isArray(ch.game.recall) ? `<h3 style="margin-bottom:6px">✎ 本章填空已就绪</h3>
      <p style="font-weight:700;color:var(--ink-2);margin:0 0 14px">${esc(ch.game.intro.en)}<br>${esc(ch.game.intro.zh)}</p>
      <button class="btn primary" id="r-game">开始填空</button>
      <div style="font-size:13px;font-weight:800;color:var(--ink-2);margin-top:10px">答对记入知识库，答错记入错题本。${ch.id + 1 <= S.chapterCount ? `做完解锁第 ${ch.id + 1} 章` : "做完就全书通关啦！"}</div>`
      : `<h3 style="margin-bottom:6px">🎮 本章冒险已就绪</h3>
      <p style="font-weight:700;color:var(--ink-2);margin:0 0 14px">${esc(ch.game.intro.en)}<br>${esc(ch.game.intro.zh)}</p>
      <button class="btn primary" id="r-game">⚔ 开始「${esc(ch.game.zh)}」</button>
      <div style="font-size:13px;font-weight:800;color:var(--ink-2);margin-top:10px">${ch.id + 1 <= S.chapterCount ? `完成冒险即可解锁第 ${ch.id + 1} 章` : "完成冒险就全书通关啦！"}</div>`}
    </div>`);
  bindShell();

  document.querySelector("#r-back").onclick = () => go("#/map");
  document.querySelector("#r-minus").onclick = () => { S.settings.size = Math.max(16, S.settings.size - 2); save(); render(); };
  document.querySelector("#r-plus").onclick = () => { S.settings.size = Math.min(30, S.settings.size + 2); save(); render(); };
  document.querySelector("#r-zh").onclick = () => { S.settings.showZh = !S.settings.showZh; save(); render(); };
  document.querySelector("#r-syl").onclick = () => { S.settings.syllables = !S.settings.syllables; save(); render(); };
  document.querySelector("#r-speak").onclick = () => speak(ch.paragraphs.map((p) => p.en).join(" "), 0.95);
  document.querySelector("#r-game").onclick = () => go(Array.isArray(ch.game.recall) ? `#/recall/${ch.id}` : `#/game/${ch.id}`);

  app.querySelectorAll("[data-play]").forEach((b) => b.onclick = () => speak(ch.paragraphs[Number(b.dataset.play)].en));
  app.querySelectorAll("[data-say]").forEach((b) => b.onclick = () => { addWord(b.dataset.say); speak(b.dataset.say); toast(`已收进单词本：${b.dataset.say}`); });

  S.quiz ||= {};
  const qkey = (qi) => `${S.currentBook}-${ch.id}-${qi}`;
  app.querySelectorAll(".quiz-opts button").forEach((b) => b.onclick = () => {
    const qi = Number(b.dataset.qi), oi = Number(b.dataset.oi);
    const q = ch.quiz[qi];
    const key = qkey(qi);
    if (S.quiz[key]) return;
    S.quiz[key] = true; save();
    const group = app.querySelectorAll(`.quiz-opts button[data-qi="${qi}"]`);
    group.forEach((x) => (x.disabled = true));
    b.classList.add(oi === q.answer ? "right" : "wrong");
    group[q.answer].classList.add("right");
    if (oi === q.answer) { addXp(10); toast("答对啦！+10 XP 🎉"); }
    else toast("再看看原文，答案已标出来啦");
    document.querySelector(".chip.xp").textContent = `⭐ ${S.xp} XP`;
  });
  app.querySelectorAll(".quiz-opts button").forEach((b) => {
    if (S.quiz[qkey(b.dataset.qi)]) b.disabled = true;
  });

  // 点词弹层
  app.querySelectorAll(".w").forEach((el) => el.onclick = (e) => {
    if (selectionText()) return;   // 正在划词，交给划词工具条
    const w = el.dataset.w;
    addWord(w);
    el.classList.add("hit");
    speak(w);
    if (popup) popup.remove();
    popup = document.createElement("div");
    popup.className = "word-pop";
    popup.innerHTML = `
      <div class="pop-head"><b>${esc(w)}</b> ${esc(el.dataset.zh)}</div>
      <div class="vocab-pron"><div>${syllableHTML(w)}</div><div>${ipaHTML(w)}</div></div>
      <div class="vocab-btns">
        <button class="btn small" data-say="${esc(w)}">🔊 整词</button>
        <button class="btn small purple" data-read-syl="${esc(w)}">🍃 逐音节</button>
      </div>
      <div class="pop-foot">已加入单词本 · 点单个音节可单独听</div>`;
    document.body.appendChild(popup);
    const r = el.getBoundingClientRect();
    popup.style.left = Math.min(window.innerWidth - 280, Math.max(10, r.left)) + "px";
    popup.style.top = (r.bottom + 8) + "px";
    e.stopPropagation();
    const vb = document.querySelector("#m-vocab");
    if (vb) vb.textContent = `📒 单词本 (${S.words.length})`;
  });
  document.addEventListener("click", closePopupOnce);

  mountSelection(document.querySelector("#paper"), {
    onWord: () => {
      const vb = document.querySelector("#m-vocab");
      if (vb) vb.textContent = `📒 单词本 (${S.words.length})`;
    },
  });
}

function closePopupOnce(e) {
  if (popup && !popup.contains(e.target) && !e.target.classList.contains("w")) {
    popup.remove(); popup = null;
    document.removeEventListener("click", closePopupOnce);
  }
}

function squashText(text) {
  return String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
}
function recallZh(chapter, item) {
  if (item && item.zh) return item.zh;
  if (!chapter || !item) return "";
  if (item.kind === "vocab") {
    const word = (chapter.vocab || []).find((entry) => squashText(entry.w) === squashText(item.answer));
    return word ? (word.egZh || word.zh || "") : "";
  }
  const filled = squashText(String(item.sentence || "").replace("____", item.answer || ""));
  const paragraph = (chapter.paragraphs || []).find((entry) => squashText(entry.en) === filled);
  return paragraph ? (paragraph.zh || "") : "";
}
function recallCards(rows, empty) {
  if (!rows.length) return `<p style="font-weight:700;color:var(--ink-2)">${empty}</p>`;
  return `<div class="vocab-grid">${rows.map((row) => `<div class="card vocab">
      <span class="pos">${row.kind === "grammar" ? "语法" : "单词"}</span>
      <b>${esc(row.answer)}</b>
      <p>${esc(row.prompt)}<br>${esc(row.sentence)}</p>
      ${row.zh ? `<p class="recall-zh"><b>句意</b>${esc(row.zh)}</p>` : ""}
      ${row.ok ? "" : `<p>上次写成了 ${esc(row.typed || "（空）")}</p>`}
    </div>`).join("")}</div>`;
}

function openKnowledge() {
  showModal(`<button class="btn small close" id="k-close">关闭 ✕</button><h3>知识库 (${S.known.length})</h3>
    ${recallCards(S.known, "还没有记牢的题。章末填空答对后会出现在这里。")}`);
  modal.querySelector("#k-close").onclick = closeModal;
}

function openMistakes() {
  showModal(`<button class="btn small close" id="w-close">关闭 ✕</button><h3>错题本 (${S.mistakes.length})</h3>
    ${S.mistakes.length ? `<div class="vocab-grid">${S.mistakes.map((row, index) => `<div class="card vocab">
      <span class="pos">${row.kind === "grammar" ? "语法" : "单词"}</span>
      <b>${esc(row.prompt)}</b>
      <p>${esc(row.sentence)}</p>
      ${row.zh ? `<p class="recall-zh"><b>句意</b>${esc(row.zh)}</p>` : ""}
      <p>上次写成了 ${esc(row.typed || "（空）")}</p>
      <form class="recall-form" data-retry="${index}">
        <input class="recall-input" autocomplete="off" spellcheck="false" aria-label="再写一次" />
        <button class="btn small" type="submit">再写一次</button>
      </form>
    </div>`).join("")}</div>` : '<p style="font-weight:700;color:var(--ink-2)">错题本是空的。章末填空答错后会留在这里。</p>'}`);
  modal.querySelector("#w-close").onclick = closeModal;
  modal.querySelectorAll("[data-retry]").forEach((form) => {
    form.onsubmit = (event) => {
      event.preventDefault();
      const row = S.mistakes[Number(form.dataset.retry)];
      if (!row || !window.AdventureRecall) return;
      const result = window.AdventureRecall.grade({ answer: row.answer, accept: row.accept }, form.querySelector("input").value);
      if (result.empty) return toast("先把空填上");
      recordRecall({ ...row, typed: result.typed, ok: result.ok });
      speakRecall(row);
      paintLedgers();
      toast(result.ok ? "对了，已记入知识库" : `还不是。正确答案是 ${row.answer}`);
      openMistakes();
    };
  });
}

function viewRecall(id) {
  const ch = CHAPTERS.find((c) => c.id === id);
  const source = ch && ch.game && ch.game.recall;
  const items = Array.isArray(source) ? source.map((item) => ({ ...item, zh: recallZh(ch, item) })) : null;
  if (!ch || !items) return go("#/map");
  if (id > S.unlocked) { toast("这一章还没解锁 🔒"); return go("#/map"); }
  app.innerHTML = shell(`
    <div class="card reader-bar">
      <button class="btn small" id="r-back">← 阅读</button>
      <span class="title">CH.${ch.id} · 填空</span>
      ${engineSelect()}${voiceSelect()}
    </div>
    <div class="card recall-wrap">
      <h2>${esc(ch.game.zh)}</h2>
      <p class="recall-lead">${esc(ch.game.intro.zh)}</p>
      <div id="recall-host"></div>
    </div>`);
  bindShell();
  document.querySelector("#r-back").onclick = () => go(`#/read/${ch.id}`);
  const seen = new Set();
  window.AdventureRecall.mount(document.querySelector("#recall-host"), items, {
    onSpeak: speakRecall,
    onGrade(item, result) {
      const first = !seen.has(item.id);
      seen.add(item.id);
      recordRecall({
        book: S.currentBook,
        chapter: ch.id,
        item: item.id,
        kind: item.kind,
        answer: item.answer,
        accept: item.accept,
        prompt: item.prompt,
        sentence: item.sentence,
        zh: item.zh || "",
        typed: result.typed,
        ok: result.ok,
        first
      });
      const known = document.querySelector("#m-known");
      const wrong = document.querySelector("#m-wrong");
      paintLedgers();
    },
    onDone({ correct, total }) {
      const stars = correct === total ? 3 : correct * 2 >= total ? 2 : 1;
      if (!S.done[ch.id]) addXp(correct * 10);
      finishChapter(ch.id, stars);
      toast(correct === total ? "全部答对，已记入知识库" : `首次答对 ${correct}/${total}，错的在错题本`);
      go("#/map");
    }
  });
}

function openVocabBook() {
  const map = new Map(allVocab().map((v) => [v.w, v]));
  showModal(`<button class="btn small close" id="v-close">关闭 ✕</button><h3>📒 我的单词本 (${S.words.length})</h3>
    ${S.words.length ? `<div class="vocab-grid">${S.words.map((w) => {
      const v = map.get(w) || { pos: "", zh: "点词查看释义", eg: "" };
      return `<div class="card vocab"><b>${esc(w)}</b><span class="pos">${esc(v.pos)}</span> ${esc(v.zh)}
        <div class="vocab-pron"><div>${syllableHTML(w)}</div><div>${ipaHTML(w)}</div></div>
        <p>${esc(v.eg)}</p>
        <div class="vocab-btns"><button class="btn small" data-say="${esc(w)}">🔊 整词</button>
        <button class="btn small purple" data-read-syl="${esc(w)}">🍃 逐音节</button></div></div>`;
    }).join("")}</div>` : '<p style="font-weight:700;color:var(--ink-2)">还没有单词。去阅读页点一点绿色高亮的生词，或直接划选任意词句。</p>'}`);
  modal.querySelector("#v-close").onclick = closeModal;
}

// ---------------- 路由 ----------------
function startGame(ch) {
  app.innerHTML = "";
  currentGame = mountGame(app, ch, {
    onExit: () => go("#/map"),
    onOpenChapter: (n) => go(`#/read/${n}`),
    onRestart: () => startGame(ch),
  });
}

function render() {
  stopSpeech();
  destroySelection();
  stopRead();
  if (popup) { popup.remove(); popup = null; }
  syncActive();
  const parts = (location.hash || "#/home").split("/");
  const view = parts[1] || "home";
  const id = Number(parts[2]) || 1;
  // 每次路由切换都彻底销毁旧的舞台 / 特效循环 / 环境音，避免章与章、书与书之间叠加
  if (currentGame) { currentGame.destroy(); currentGame = null; }
  closeModal();
  window.scrollTo(0, 0);

  if (view === "book") {
    const b = byId(parts[2]);
    if (!b || b.status !== "ready") { if (b && b.status !== "import") toast("这本书还不能打开"); return go("#/home"); }
    setBook(b.id, b.chapters.length);
    syncActive();
    toast(`已切换到《${b.book.zh || b.book.title}》`);
    return go("#/map");
  }
  if (view === "map") viewMap();
  else if (view === "read") viewReader(id);
  else if (view === "recall") viewRecall(id);
  else if (view === "game") {
    const ch = CHAPTERS.find((c) => c.id === id);
    if (!ch || id > S.unlocked) { toast("这一章还没解锁 🔒"); return go("#/map"); }
    startGame(ch);
  } else viewHome();
}

window.__importAdventureBook = (book) => {
  const result = importBook(book);
  if (result.ok) render();
  return { ok: result.ok, errors: result.errors, id: result.book && result.book.id, title: result.book && result.book.book.zh };
};
window.addEventListener("hashchange", render);
render();
