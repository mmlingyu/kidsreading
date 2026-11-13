import { BOOKS, byId, allVocab } from "./data/bookshelf.js";
import { S, save, addXp, addWord, reset, resetBook, setBook, toast, speak, esc, cancelSpeech } from "./state.js";
import { mountGame } from "./game.js";

const app = document.getElementById("app");
const modal = document.getElementById("modal");
let currentGame = null;
let popup = null;
// 当前书的视图数据：所有页面共用，切书时统一切换，阅读/地图/游戏无需感知书 id
let ACTIVE, BOOK, CHAPTERS;

function syncActive() {
  ACTIVE = byId(S.currentBook);
  BOOK = ACTIVE.book;
  CHAPTERS = ACTIVE.chapters;
  S.chapterCount = CHAPTERS.length;
}

function go(hash) { location.hash = hash; }
function closeModal() { modal.classList.add("hidden"); modal.innerHTML = ""; }
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
      ${opts.home ? "" : '<button class="btn small" id="m-home">📚 书架</button>'}
    </div>${inner}`;
}

function bindShell() {
  const v = document.querySelector("#m-vocab");
  if (v) v.onclick = openVocabBook;
  const h = document.querySelector("#m-home");
  if (h) h.onclick = () => go("#/home");
}

// ---------------- 书架卡片 ----------------
function bookCard(b) {
  const ready = b.status === "ready";
  const isActive = b.id === S.currentBook;
  const p = S.books[b.id] || { unlocked: 1, done: {}, stars: {} };
  const done = Object.keys(p.done || {}).length;
  const total = ready ? b.chapters.length : 0;
  const pct = ready ? Math.round((done / total) * 100) : 0;
  const badge = !ready ? "筹备中" : isActive ? "正在读" : done ? "继续读" : "新书";
  return `<button class="book-card ${ready ? "" : "coming"} ${isActive ? "active" : ""}" data-book="${b.id}" style="--bc:${b.color}" ${ready ? "" : "disabled"}>
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
           <div class="bc-foot"><b>${done}/${total} 章 · ${pct}%</b>${isActive ? "<span>← 当前在读</span>" : "<span>点击切换</span>"}</div>`
        : `<div class="bc-foot"><span>${esc(b.tagline)}</span></div>`}
    </div>
  </button>`;
}

// ---------------- 首页（书架） ----------------
function viewHome() {
  const doneCount = Object.keys(S.done).length;
  const pct = Math.round((doneCount / CHAPTERS.length) * 100);
  const credits = BOOKS.filter((b) => b.credit).map((b) => `${b.book.title}：${b.credit}`).join("<br>");
  app.innerHTML = shell(`
    <div class="hero">
      <img class="hero-bg" src="${ACTIVE.hero}" alt="${esc(BOOK.title)}" />
      <div class="hero-copy">
        <span class="kicker">${esc(ACTIVE.kicker)}</span>
        <h1>${ACTIVE.heroTitle}</h1>
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

    <div class="section-title">📚 我的书架 <small>${BOOKS.filter((b) => b.status === "ready").length} 本可读 · 点卡片切换</small></div>
    <div class="shelf">${BOOKS.map(bookCard).join("")}</div>

    <div class="quote">“${esc(BOOK.quote.en)}”<small>${esc(BOOK.quote.zh)}</small></div>
    <div class="section-title">🎮 这套书怎么玩</div>
    <div class="card" style="padding:20px;line-height:1.9;font-size:16px;font-weight:700">
      ① <b>逐章解锁</b>：完成一章的章末冒险，才会解锁下一章；每本书的进度彼此独立，XP 与单词本则在整个书架共享。<br>
      ② <b>双语精读</b>：点任意生词听发音、看释义，自动收进单词本；可整段朗读。<br>
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
      <button class="btn small ghost" id="h-reset-book">重置本书进度</button>
      <button class="btn small ghost" id="h-reset">清空全部数据</button>
      <span style="color:var(--ink-2);font-size:13px;font-weight:700">进度保存在本机浏览器，不上传任何数据</span>
    </div>
    <div style="margin-top:22px;text-align:center;color:var(--ink-2);font-size:12px;font-weight:700;line-height:1.9">
      <b>版权与素材说明</b><br>
      两本书均为依原著情节脉络所做的<b>简化英文重述</b>，不含原书原文，仅用于个人英语学习原型，非商用；原著文本与插画版权归作者及出版社所有。<br>
      ${credits}<br>
      章末像素特效来自 pixelfx (MIT License, Patch / Hugo Duprez)，版权见 vendor/pixelfx/LICENSE · 英文朗读默认离线 Phonon（af_maple），中文引导用 zf_001；失败时才标明改用浏览器语音。配乐与音效仍在本机合成
    </div>`, { home: true });

  bindShell();
  document.querySelector("#h-continue").onclick = () => go(`#/read/${Math.min(S.unlocked, S.chapterCount)}`);
  document.querySelector("#h-map").onclick = () => go("#/map");
  app.querySelectorAll(".book-card[data-book]").forEach((card) => {
    if (card.classList.contains("coming")) return;
    card.onclick = () => go(`#/book/${card.dataset.book}`);
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
    modal.querySelector("#r-ok").onclick = () => { reset(); closeModal(); render(); toast("全部数据已清空"); };
  };
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
          <img src="${c.art}" alt="" />
          <div>
            <h3>CH.${c.id} · ${esc(c.title)}</h3>
            <div class="zh">${esc(c.zh)} <span class="tag">${esc(c.tag)}</span></div>
            <div class="tag" style="background:#eef0ff;border-color:var(--purple);color:var(--purple)">🎮 ${esc(c.game.zh)} · 约 ${c.minutes} 分钟</div>
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
      if (id > S.unlocked) return toast("先完成上一章的冒险，才能解锁哦 🔒");
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
    return `<span class="w ${S.words.includes(v.w) ? "hit" : ""}" data-w="${esc(v.w)}" data-zh="${esc(v.zh)}">${esc(m)}</span>`;
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
      <button class="btn small purple" id="r-speak">🔊 朗读整章</button>
    </div>
    <img class="reader-art" src="${ch.art}" alt="${esc(ch.title)}" />
    <div class="reader-meta">
      <span>⏱ 约 ${ch.minutes} 分钟</span><span>📖 ${esc(ACTIVE.level)}</span><span>🎮 章末：${esc(ch.game.zh)}</span>
      <span>🖼 图书插图</span>
    </div>
    <div class="card paper" id="paper" style="--read-size:${S.settings.size}px">
      ${ch.paragraphs.map((p, i) => `<div class="para" data-i="${i}">
        <span class="idx">${i + 1}</span><span class="en">${markWords(p.en, ch.vocab)}</span>
        <button class="play" data-play="${i}">🔊 朗读本段</button>
        <div class="zh" style="${S.settings.showZh ? "" : "display:none"}">${esc(p.zh)}</div>
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
      ${ch.vocab.map((v) => `<div class="card vocab"><b>${esc(v.w)}</b><span class="pos">${esc(v.pos)}</span> ${esc(v.zh)}
        <p>${esc(v.eg)}<br>${esc(v.egZh)}</p>
        <button class="btn small" data-say="${esc(v.w)}" style="margin-top:8px">🔊 听</button></div>`).join("")}
    </div>
    <div class="card quiz" style="background:#f1ffdc;border-color:var(--lime-d);margin-top:22px;text-align:center">
      <h3 style="margin-bottom:6px">🎮 本章冒险已就绪</h3>
      <p style="font-weight:700;color:var(--ink-2);margin:0 0 14px">${esc(ch.game.intro.en)}<br>${esc(ch.game.intro.zh)}</p>
      <button class="btn primary" id="r-game">⚔ 开始「${esc(ch.game.zh)}」</button>
      <div style="font-size:13px;font-weight:800;color:var(--ink-2);margin-top:10px">${ch.id + 1 <= S.chapterCount ? `完成冒险即可解锁第 ${ch.id + 1} 章` : "完成冒险就全书通关啦！"}</div>
    </div>`);
  bindShell();

  document.querySelector("#r-back").onclick = () => go("#/map");
  document.querySelector("#r-minus").onclick = () => { S.settings.size = Math.max(16, S.settings.size - 2); save(); render(); };
  document.querySelector("#r-plus").onclick = () => { S.settings.size = Math.min(30, S.settings.size + 2); save(); render(); };
  document.querySelector("#r-zh").onclick = () => { S.settings.showZh = !S.settings.showZh; save(); render(); };
  document.querySelector("#r-speak").onclick = () => speak(ch.paragraphs.map((p) => p.en).join(" "), 0.95);
  document.querySelector("#r-game").onclick = () => go(`#/game/${ch.id}`);

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
    const w = el.dataset.w;
    addWord(w);
    el.classList.add("hit");
    speak(w);
    if (popup) popup.remove();
    popup = document.createElement("div");
    popup.className = "word-pop";
    popup.innerHTML = `<b>${esc(w)}</b> ${esc(el.dataset.zh)}<br><span style="font-size:12px;color:var(--ink-2)">已加入单词本 · 点击发音</span>`;
    document.body.appendChild(popup);
    const r = el.getBoundingClientRect();
    popup.style.left = Math.min(window.innerWidth - 280, Math.max(10, r.left)) + "px";
    popup.style.top = (r.bottom + 8) + "px";
    e.stopPropagation();
    const vb = document.querySelector("#m-vocab");
    if (vb) vb.textContent = `📒 单词本 (${S.words.length})`;
  });
  document.addEventListener("click", closePopupOnce);
}

function closePopupOnce(e) {
  if (popup && !popup.contains(e.target) && !e.target.classList.contains("w")) {
    popup.remove(); popup = null;
    document.removeEventListener("click", closePopupOnce);
  }
}

function openVocabBook() {
  const map = new Map(allVocab().map((v) => [v.w, v]));
  showModal(`<button class="btn small close" id="v-close">关闭 ✕</button><h3>📒 我的单词本 (${S.words.length})</h3>
    ${S.words.length ? `<div class="vocab-grid">${S.words.map((w) => {
      const v = map.get(w) || { pos: "", zh: "点词查看释义", eg: "" };
      return `<div class="card vocab"><b>${esc(w)}</b><span class="pos">${esc(v.pos)}</span> ${esc(v.zh)}
        <p>${esc(v.eg)}</p><button class="btn small" data-vsay="${esc(w)}">🔊 听</button></div>`;
    }).join("")}</div>` : '<p style="font-weight:700;color:var(--ink-2)">还没有单词。去阅读页点一点绿色高亮的生词吧！</p>'}`);
  modal.querySelector("#v-close").onclick = closeModal;
  modal.querySelectorAll("[data-vsay]").forEach((b) => b.onclick = () => speak(b.dataset.vsay));
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
  cancelSpeech();
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
    if (!b || b.status !== "ready") { toast("这本书还在筹备中 📚"); return go("#/home"); }
    setBook(b.id, b.chapters.length);
    syncActive();
    toast(`已切换到《${b.book.zh || b.book.title}》`);
    return go("#/map");
  }
  if (view === "map") viewMap();
  else if (view === "read") viewReader(id);
  else if (view === "game") {
    const ch = CHAPTERS.find((c) => c.id === id);
    if (!ch || id > S.unlocked) { toast("这一章还没解锁 🔒"); return go("#/map"); }
    startGame(ch);
  } else viewHome();
}

window.addEventListener("hashchange", render);
render();
