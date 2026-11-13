import { BOOK, CHAPTERS } from "./data/book.js";
import { S, save, addXp, addWord, reset, toast, speak, esc, cancelSpeech } from "./state.js";
import { mountGame } from "./game.js";

const app = document.getElementById("app");
const modal = document.getElementById("modal");
let currentGame = null;
let popup = null;

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
      <div class="brand"><span class="bolt">⚡</span><span>${opts.brand || "最后的孩子 · 英语冒险阅读"}</span></div>
      <div class="spacer"></div>
      <span class="chip xp">⭐ ${S.xp} XP</span>
      <button class="btn small" id="m-vocab">📒 单词本 (${S.words.length})</button>
      ${opts.home ? "" : '<button class="btn small" id="m-home">🏠 首页</button>'}
    </div>${inner}`;
}

function bindShell() {
  const v = document.querySelector("#m-vocab");
  if (v) v.onclick = openVocabBook;
  const h = document.querySelector("#m-home");
  if (h) h.onclick = () => go("#/home");
}

// ---------------- 首页 ----------------
function viewHome() {
  const doneCount = Object.keys(S.done).length;
  const pct = Math.round((doneCount / CHAPTERS.length) * 100);
  app.innerHTML = shell(`
    <div class="hero">
      <img class="hero-bg" src="${BOOK.cover}" alt="The Last Kids on Earth" />
      <div class="hero-copy">
        <span class="kicker">CHAPTER BOOK · 8-12 岁</span>
        <h1>The Last<br>Kids on Earth</h1>
        <p>${esc(BOOK.level)}　·　改编自 Max Brallier 原著<br>一章一关，读完就进入属于你的末日冒险。</p>
        <div class="hero-actions">
          <button class="btn primary" id="h-continue">📖 ${doneCount ? "继续冒险" : "开始第一本书"}</button>
          <button class="btn orange" id="h-map">🗺 章节地图</button>
        </div>
      </div>
    </div>
    <div class="progress-strip">
      <div class="card stat"><b>${doneCount}/8</b><span>已通关章节 · ${pct}%</span></div>
      <div class="card stat"><b>${S.xp}</b><span>累计 XP</span></div>
      <div class="card stat"><b>${S.words.length}</b><span>收集的单词</span></div>
    </div>
    <div class="quote">“${esc(BOOK.quote.en)}”<small>${esc(BOOK.quote.zh)}</small></div>
    <div class="section-title">📚 这本书怎么玩</div>
    <div class="card" style="padding:20px;line-height:1.9;font-size:16px;font-weight:700">
      ① <b>逐章解锁</b>：完成一章的章末冒险，才会解锁下一章。<br>
      ② <b>双语精读</b>：点任意生词听发音、看释义，自动收进单词本；可整段朗读。<br>
      ③ <b>阅读小测</b>：每章 2 道理解题，答对得 XP。<br>
      ④ <b>沉浸式冒险</b>：每章结尾按该章插画的构图复刻成场景——天色、远景、前景遮挡与角色都跟着章节变；
      选择、掷骰、伪 3D 小游戏都发生在场景里，镜头会随剧情推进、成功与失败而变化。<br>
      ⑤ <b>三种画面模式</b>：🎬 电影（2.5D 分层视差）／🧊 立体（可转视角的 CSS 3D 布景）／🔋 省电；
      场景里还藏着可点读的英文单词牌。<br>
      ⑥ <b>会说话的冒险</b>：每章有专属配乐与环境音（树屋风声、便利店荧光灯、球场人声、末日低频轰鸣…），
      剧情推进时配乐会转紧张或明快；中文语音引导告诉你下一步做什么，点选、掷骰、命中、倒计时、通关各有提示音。
      右上角 🎚 可分别开关环境音 / 配乐 / 交互音 / 语音引导。
    </div>
    <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn small ghost" id="h-reset">重置阅读进度</button>
      <span style="align-self:center;color:var(--ink-2);font-size:13px;font-weight:700">进度保存在本机浏览器，不上传任何数据</span>
    </div>
    <div style="margin-top:22px;text-align:center;color:var(--ink-2);font-size:12px;font-weight:700;line-height:1.8">
      本作品为《The Last Kids on Earth》的原创简化改写，仅用于个人英语学习原型，非原书文本 · 章节插画为 AI 生成<br>
      章末像素特效来自 pixelfx (MIT License, Patch / Hugo Duprez)，版权见 vendor/pixelfx/LICENSE · 英文朗读默认离线 Phonon（af_maple），中文引导用 zf_001；失败时才标明改用浏览器语音。配乐与音效仍在本机合成
    </div>`, { home: true });

  bindShell();
  document.querySelector("#h-continue").onclick = () => go(`#/read/${Math.min(S.unlocked, 8)}`);
  document.querySelector("#h-map").onclick = () => go("#/map");
  document.querySelector("#h-reset").onclick = () => {
    showModal(`<h3>重置进度？</h3><p style="font-weight:700;color:var(--ink-2)">会清空解锁章节、XP 和单词本，无法撤销。</p>
      <div style="display:flex;gap:10px;margin-top:16px"><button class="btn small" id="r-cancel">取消</button><button class="btn small orange" id="r-ok">确认重置</button></div>`);
    modal.querySelector("#r-cancel").onclick = closeModal;
    modal.querySelector("#r-ok").onclick = () => { reset(); closeModal(); render(); toast("进度已重置"); };
  };
}

// ---------------- 章节地图 ----------------
function viewMap() {
  app.innerHTML = shell(`
    <div class="map-head">
      <div><h2>🗺 章节地图</h2><p>完成一章的冒险，解锁下一章。每一章都是一个新的任务关卡。</p></div>
      <button class="btn small" id="back-home">← 首页</button>
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
  sorted.forEach((v, i) => {
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
    <img class="reader-art" src="${ch.art}" alt="" />
    <div class="reader-meta">
      <span>⏱ 约 ${ch.minutes} 分钟</span><span>📖 蓝思 650L</span><span>🎮 章末：${esc(ch.game.zh)}</span>
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
      <div style="font-size:13px;font-weight:800;color:var(--ink-2);margin-top:10px">完成冒险即可解锁第 ${ch.id + 1 <= 8 ? ch.id + 1 : "全" } 章</div>
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
  app.querySelectorAll(".quiz-opts button").forEach((b) => b.onclick = () => {
    const qi = Number(b.dataset.qi), oi = Number(b.dataset.oi);
    const q = ch.quiz[qi];
    const key = `${ch.id}-${qi}`;
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
    const key = `${ch.id}-${b.dataset.qi}`;
    if (S.quiz[key]) b.disabled = true;
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
    document.querySelector(".chip.xp");
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
  const all = CHAPTERS.flatMap((c) => c.vocab);
  const map = new Map(all.map((v) => [v.w, v]));
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
  const parts = (location.hash || "#/home").split("/");
  const view = parts[1] || "home";
  const id = Number(parts[2]) || 1;
  // 每次路由切换都彻底销毁旧的舞台 / 特效循环 / 环境音，避免章与章之间叠加
  if (currentGame) { currentGame.destroy(); currentGame = null; }
  closeModal();
  window.scrollTo(0, 0);
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
