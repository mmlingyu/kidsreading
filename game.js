// 章末沉浸式冒险：2.5D 电影舞台 + CSS 3D 布景 + 场景配乐/环境音 + 语音引导
// 流程：场景内选择 → d6 检定（镜头/光效/音效/配乐联动）→ 伪 3D 小游戏 → 结算解锁下一章
import { FxStage } from "./fx.js";
import { Stage, SCENES } from "./scene.js";
import { sound, SCORES } from "./audio.js";
import { Guide, HINTS } from "./guide.js";
import { S, addXp, addItem, addWord, finishChapter, toast, speak, esc } from "./state.js";

const AMBIENT = {
  1: "weather/clouds", 2: "weather/fireflies", 3: "lightning/charge-up",
  4: "weather/clouds", 5: "shadow/grasping-hands", 6: "weather/fireflies",
  7: "arcane/portal", 8: "shadow/dark-explosion",
  101: "weather/fireflies", 102: "weather/clouds", 103: "weather/fireflies",
  104: "weather/clouds", 105: "weather/fireflies", 106: "weather/fireflies",
};

export function mountGame(root, ch, hooks) {
  const g = ch.game;
  let hp = 3, score = 0, bonusXp = 0, nodeId = g.start, busy = false, destroyed = false, combo = 0;
  const gainedItems = [];
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.push(t); return t; };

  root.innerHTML = `
    <div class="topbar">
      <div class="brand"><span class="bolt">⚡</span><span>冒险模式</span></div>
      <div class="spacer"></div>
      <span class="chip xp">⭐ ${S.xp} XP</span>
      <button class="btn small" id="g-exit">退出冒险</button>
    </div>
    <div class="game" id="game">
      <div class="game-inner" id="game-inner"></div>
    </div>`;

  const gameEl = root.querySelector("#game");
  const inner = root.querySelector("#game-inner");
  const stage = new Stage(gameEl, ch);
  const sceneKey = ch.scene || ch.id;
  const cfg = SCENES[sceneKey] || SCENES[1];
  const canvas = stage.fxCanvas;
  const fx = new FxStage(canvas);
  const guide = new Guide(ch);
  fx.start();
  fx.setAmbient(AMBIENT[sceneKey] || "weather/fireflies", { light: 0.55 });
  sound.setScene(sceneKey, cfg.audio);

  // 浏览器自动播放策略：首次任意手势里解锁 AudioContext
  const unlockOnce = () => { sound.unlock(); root.removeEventListener("pointerdown", unlockOnce); };
  root.addEventListener("pointerdown", unlockOnce);

  root.querySelector("#g-exit").onclick = () => { sound.play("exit"); cleanup(); hooks.onExit(); };

  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    root.removeEventListener("pointerdown", unlockOnce);
    guide.destroy();
    stage.destroy();
    fx.stop();
    sound.destroy();
  }

  // ---------- 顶部 HUD 与声音设置 ----------
  function hud() {
    return `<div class="game-hud">
      <span class="tagx">CHAPTER ${ch.id} · ${esc(g.title)}</span>
      <span class="hearts">${"❤️".repeat(Math.max(1, hp))}${"🖤".repeat(3 - Math.max(1, hp))}</span>
      <span class="tagx score-chip">🎯 ${score}</span>
      <span class="spacer"></span>
      <div class="mode-switch" id="mode-switch">
        <button data-mode="cinema">🎬 电影</button>
        <button data-mode="solid">🧊 立体</button>
        <button data-mode="lite">🔋 省电</button>
      </div>
      <button class="btn small hud-icon" id="sound-toggle" title="全部静音">${sound.muted ? "🔇" : "🔊"}</button>
      <button class="btn small hud-icon" id="audio-panel-toggle" title="声音设置" aria-label="声音设置">🎚</button>
      <button class="btn small" id="narrate" title="重听当前旁白与提示">🗣 重听</button>
    </div>`;
  }

  function soundPanelHtml() {
    const row = (key, icon, label, on) => `<button class="sp-row ${on ? "on" : ""}" data-key="${key}">
      <span class="sp-ico">${icon}</span><span class="sp-label">${label}</span><span class="sp-state">${on ? "开" : "关"}</span></button>`;
    return `<div class="sound-panel" id="sound-panel" hidden>
      <div class="sp-title">🎚 声音设置 <span>${esc((SCORES[sceneKey] || SCORES[1]).name)}</span></div>
      ${row("amb", "🌬", "场景环境音", sound.layers.amb)}
      ${row("music", "🎵", "场景配乐", sound.layers.music)}
      ${row("sfx", "🔔", "交互提示音", sound.layers.sfx)}
      ${row("guide", "🗣", "语音引导", sound.guideOn)}
      <p class="sp-note">朗读或语音引导时，环境音与配乐会自动压低。</p>
    </div>`;
  }

  function bindSoundPanel() {
    const btn = inner.querySelector("#audio-panel-toggle");
    const panel = inner.querySelector("#sound-panel");
    if (!btn || !panel) return;
    btn.onclick = () => {
      sound.unlock();
      panel.hidden = !panel.hidden;
      sound.play("tap");
    };
    panel.querySelectorAll(".sp-row").forEach((row) => {
      row.onclick = () => {
        sound.unlock();
        const k = row.dataset.key;
        let on;
        if (k === "guide") {
          sound.setGuide(!sound.guideOn);
          on = sound.guideOn;
          const bar = inner.querySelector("#guide-bar");
          if (bar) {
            bar.classList.toggle("off", !on);
            const t = inner.querySelector("#guide-toggle");
            const ico = bar.querySelector(".guide-ico");
            if (t) t.textContent = on ? "🗣" : "🔇";
            if (ico) ico.textContent = on ? "🗣" : "🔇";
          }
        } else {
          sound.setLayer(k, !sound.layers[k]);
          on = sound.layers[k];
        }
        row.classList.toggle("on", on);
        row.querySelector(".sp-state").textContent = on ? "开" : "关";
      };
    });
  }

  function bindHud() {
    const sw = inner.querySelector("#mode-switch");
    if (sw) {
      [...sw.querySelectorAll("button")].forEach((b) => {
        b.classList.toggle("on", b.dataset.mode === sound.mode);
        b.onclick = () => {
          sound.unlock();
          sound.play("mode");
          stage.setMode(b.dataset.mode);
          [...sw.querySelectorAll("button")].forEach((x) => x.classList.toggle("on", x === b));
          toast(b.dataset.mode === "solid" ? "立体模式：移动鼠标或倾斜设备可转视角" : b.dataset.mode === "lite" ? "省电模式：已关闭粒子与 3D 布景" : "电影模式：分层视差 + 镜头推进");
        };
      });
    }
    const st = inner.querySelector("#sound-toggle");
    if (st) st.onclick = () => {
      sound.unlock();
      sound.setMuted(!sound.muted);
      st.textContent = sound.muted ? "🔇" : "🔊";
      if (!sound.muted) sound.play("select");
      toast(sound.muted ? "已静音（语音引导仍可单独开启）" : "声音已开启");
    };
    const nr = inner.querySelector("#narrate");
    if (nr) nr.onclick = () => { sound.unlock(); sound.play("tap"); guide.replay(); };
    bindSoundPanel();
  }

  function fxAt(id, el, opts = {}) {
    if (!id) return;
    const r = canvas.getBoundingClientRect();
    let pos = {};
    if (el) {
      const c = el.getBoundingClientRect();
      pos = {
        x: ((c.left + c.width / 2 - r.left) / r.width) * fx.w,
        y: ((c.top + c.height / 2 - r.top) / r.height) * fx.h,
      };
    }
    fx.burst(id, { ...pos, ...opts });
  }

  function panOf(el) {
    const r = gameEl.getBoundingClientRect(), c = el.getBoundingClientRect();
    return Math.max(-1, Math.min(1, ((c.left + c.width / 2 - r.left) / r.width) * 2 - 1));
  }

  function cameraFor(node) {
    if (node.minigame) {
      stage.camera({ zoom: 1.24, cx: 0, cy: -14, tilt: cfg.tilt, mood: "dark" });
      return;
    }
    const order = Object.keys(g.nodes).filter((k) => !g.nodes[k].end);
    const i = Math.max(0, order.indexOf(nodeId));
    stage.camera({ zoom: cfg.zoom + i * 0.045, tilt: cfg.tilt + i * 0.6, mood: "" });
  }

  function bindWords() {
    gameEl.querySelectorAll(".word3d").forEach((b) => {
      b.onpointerenter = () => sound.play("hover", panOf(b));
      b.onclick = () => {
        const w = decodeURIComponent(b.dataset.w);
        const v = ch.vocab.find((x) => x.w === w);
        addWord(w);
        sound.play("word", panOf(b));
        sound.duck(1200);
        speak(w);
        fxAt("pickups/collect-burst", b);
        b.classList.add("taken");
        guide.note(`${w} ${v ? "· " + v.zh : ""} 已收进单词本，点右上角 🗣 可以再听一次`);
        toast(`${w} ${v ? "· " + v.zh : ""} 已收进单词本`);
      };
    });
  }

  // ---------- 节点渲染 + 语音引导 ----------
  function renderNode() {
    if (destroyed) return;
    const node = g.nodes[nodeId];
    if (!node) return finish();
    if (node.end) return showResult(node);

    cameraFor(node);
    sound.setPhase(node.minigame ? "mini" : "explore");
    stage.setActors(node.minigame ? [...cfg.actors, ...cfg.actors.slice(0, 1)] : cfg.actors);
    if (!node.minigame) stage.wordTags(ch.vocab);
    bindWords();

    const head = `<div class="scene-head">
      <span class="eyebrow">${esc(cfg.label)}</span>
      <h2>${esc(g.title)} <span style="font-size:.55em;opacity:.85">/ ${esc(g.zh)}</span></h2>
      <p>${esc(g.intro.en)} · ${esc(g.intro.zh)}</p></div>`;

    const story = `<div class="story ${node.minigame ? "compact" : ""}" id="story">
      <div class="en">${esc(node.text.en)}</div><div class="zh">${esc(node.text.zh)}</div></div>`;

    let play = "", bottom = "";
    if (node.minigame) {
      play = miniMarkup(node.minigame);
    } else if (node.choices) {
      bottom = `<div class="choices" id="choices">${node.choices.map((c, i) => {
        const stat = c.stat ? `${statLabel(c.stat)}检定 · 需要 ${c.dc}` : "剧情选择";
        return `<button class="choice3d" data-i="${i}"><span class="num">${i + 1}</span>
          <span>${esc(c.label.en)}<span class="sub">${esc(c.label.zh)}</span></span>
          <span class="check">${esc(stat)}</span></button>`;
      }).join("")}</div>`;
    }

    inner.innerHTML = `${hud()}${soundPanelHtml()}${head}
      <div class="play-area" id="play-area">${play}</div>
      <div class="caption"><div id="caption-slot">${guide.html()}${story}${bottom}</div></div>`;
    bindHud();
    guide.attach();
    guideFor(node);

    if (node.fx) { fx.burst(node.fx, { light: 0.7 }); sound.play("whoosh"); }
    if (node.minigame) startMini(node.minigame, node);
    else bindChoices(node);
  }

  function guideFor(node) {
    const first = !guide.seen.has("intro");
    if (node.minigame) {
      const m = node.minigame;
      const zh = m.type === "whack"
        ? (m.boss ? HINTS.boss(m.goal) : HINTS.whack(m.goal))
        : HINTS.scavenge(m.goal);
      guide.play({
        en: node.text.en, zh, key: "mini-" + ch.id, once: true,
        pulse: m.type === "whack" ? "#mini-grid" : "#shelf3d",
      });
    } else if (node.choices) {
      guide.play({
        en: node.text.en,
        zh: first ? `${HINTS.welcome(ch.id)}${HINTS.choice(true)}` : HINTS.choice(false),
        key: first ? "intro" : "choice-" + nodeId,
        pulse: ".choice3d",
      });
    } else {
      guide.play({ en: node.text.en, zh: "故事还在继续，跟着提示往下走。", key: "story", once: true });
    }
  }

  function statLabel(s) {
    return { guts: "💪 勇气", brains: "🧠 智慧", heart: "❤️ 团结" }[s] || s;
  }

  function bindChoices(node) {
    inner.querySelectorAll(".choice3d").forEach((btn) => {
      btn.onpointerenter = () => sound.play("hover", panOf(btn));
      btn.onclick = () => {
        if (busy) { sound.play("miss", panOf(btn)); return; }
        const c = node.choices[Number(btn.dataset.i)];
        if (c.stat) rollAndResolve(c, btn);
        else simpleChoice(c, btn);
      };
    });
  }

  function applyEffects(c) {
    const ef = c.effects || {};
    if (ef.xp) bonusXp += ef.xp;
    if (ef.item) { gainedItems.push(ef.item); addItem(ef.item); }
  }

  function simpleChoice(c, btn) {
    busy = true;
    sound.play("select", panOf(btn));
    applyEffects(c);
    fxAt(c.fx, btn);
    stage.flash("rgba(255,240,180,.22)");
    stage.camera({ zoom: cfg.zoom + 0.14, tilt: cfg.tilt, mood: "" });
    later(() => { busy = false; nodeId = c.to; renderNode(); }, 620);
  }

  function rollAndResolve(c, btn) {
    busy = true;
    sound.setPhase("tension");
    sound.play("dice");
    guide.hint(HINTS.roll(c.dc), "roll-" + nodeId, { once: true });
    stage.camera({ zoom: 1.3, cy: -8, tilt: 0, mood: "dark" });
    stage.shake(0.5);
    const roll = 1 + Math.floor(Math.random() * 6);
    const total = roll + 2;
    const ok = total >= c.dc;
    const box = document.createElement("div");
    box.className = "outcome";
    box.innerHTML = `<span class="dice" id="dice">?</span> <b style="margin-left:10px">${statLabel(c.stat)}检定中…</b>`;
    inner.querySelector("#story").after(box);
    inner.querySelectorAll(".choice3d").forEach((b) => (b.disabled = true));

    let n = 0;
    const spin = every(() => {
      const d = box.querySelector("#dice");
      if (d) d.textContent = 1 + Math.floor(Math.random() * 6);
      if (n++ % 2 === 0) sound.play("tick", panOf(box));
      if (n > 7) clearInterval(spin);
    }, 70);

    later(() => {
      clearInterval(spin);
      const out = ok ? c.success : c.fail;
      box.className = "outcome" + (ok ? "" : " fail");
      box.innerHTML = `<b>${ok ? "✅ 成功" : "😅 差一点"}　🎲 ${roll} + 2 = ${total} / 需要 ${c.dc}</b>
        <div style="margin-top:8px;font-size:16px">${esc(out.text.en)}</div>
        <div style="color:#d2d9f7;font-size:14px;margin-top:5px">${esc(out.text.zh)}</div>
        <button class="btn small primary" id="cont" style="margin-top:12px">继续 →</button>`;
      if (out.hp) hp = Math.max(1, hp + out.hp);
      if (out.fx) fxAt(out.fx, box);
      if (out.xp) bonusXp += out.xp;
      if (out.effects) {
        if (out.effects.xp) bonusXp += out.effects.xp;
        if (out.effects.item) { gainedItems.push(out.effects.item); addItem(out.effects.item); }
      }
      if (out.item) { gainedItems.push(out.item); addItem(out.item); }

      sound.setPhase("explore");
      if (ok) {
        sound.play("success");
        sound.play("hit", panOf(box));
        stage.flash("rgba(190,255,140,.42)");
        stage.hit(0);
        stage.camera({ zoom: 1.02, tilt: 0, mood: "win" });
      } else {
        sound.play("fail");
        sound.play("damage", panOf(box));
        stage.flash("rgba(255,90,100,.4)");
        stage.shake(1.2);
        stage.camera({ zoom: 1.14, cy: 12, tilt: 2, mood: "hurt" });
      }
      guide.play({
        en: out.text.en,
        zh: ok ? HINTS.rollOk : HINTS.rollFail,
        key: "out-" + nodeId, once: true, pulse: "#cont",
      });
      const cont = box.querySelector("#cont");
      cont.onclick = () => { sound.play("tap", panOf(cont)); busy = false; nodeId = out.to; renderNode(); };
    }, 820);
  }

  // ---------- 伪 3D 小游戏 ----------
  function miniMarkup(m) {
    const isWhack = m.type === "whack";
    const body = isWhack
      ? `<div class="ground3d ${m.boss ? "boss" : ""}" id="ground3d">${m.boss ? '<div class="boss-portal"></div>' : ""}<div class="holes3d" id="mini-grid">${"<div class=\"hole3d\" data-i=\"0\"></div>".repeat(9)}</div></div>`
      : `<div class="shelf3d" id="shelf3d">${'<div class="shelf-row3d"></div>'.repeat(3)}</div>`;
    return `<div class="mini" id="mini">
      <div class="mini-head"><span>🎮 ${esc(m.title)}</span><span id="mini-stat">⏱ ${m.duration}s · 0/${m.goal}</span></div>
      ${body}
      <div class="mini-bar"><i id="mini-bar"></i></div>
    </div>`;
  }

  function startMini(m, node) {
    const stat = inner.querySelector("#mini-stat");
    const bar = inner.querySelector("#mini-bar");
    const isWhack = m.type === "whack";
    const isBoss = !!m.boss;
    const items = ["🍪", "🥤", "🔦", "🧪", "🍕", "🧃", "🔋", "🍩"];
    let time = m.duration, hits = 0, done = false;
    combo = 0;

    let cells;
    if (isWhack) {
      const grid = inner.querySelector("#mini-grid");
      cells = [...grid.querySelectorAll(".hole3d")];
      cells.forEach((d, i) => { d.dataset.i = i; });
    } else {
      const shelf = inner.querySelector("#shelf3d");
      [...shelf.querySelectorAll(".shelf-row3d")].forEach((row) => {
        for (let i = 0; i < 5; i++) {
          const d = document.createElement("div");
          d.className = "slot3d up";
          const bad = Math.random() < 0.18;
          d.dataset.good = bad ? "0" : "1";
          d.textContent = bad ? "🧟" : items[Math.floor(Math.random() * items.length)];
          row.appendChild(d);
        }
      });
      cells = [...shelf.querySelectorAll(".slot3d")];
      sound.play("spawn", -0.4);
    }

    const popNum = (cell, text) => {
      const s = document.createElement("span");
      s.className = "popnum"; s.textContent = text;
      cell.appendChild(s);
      later(() => s.remove(), 750);
    };

    const updateStat = () => {
      stat.textContent = `⏱ ${time}s · ${hits}/${m.goal}${combo >= 3 ? " · 🔥 " + combo + " 连击" : ""}`;
      bar.style.width = Math.min(100, (hits / m.goal) * 100) + "%";
    };

    const finishMini = () => {
      if (done) return;
      done = true;
      timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
      score += hits;
      const good = hits >= m.goal;
      sound.setPhase("explore");
      sound.play(good ? "goal" : "fail");
      stage.flash(good ? "rgba(190,255,140,.4)" : "rgba(255,220,150,.25)");
      stage.camera({ zoom: 1.02, tilt: 0, mood: good ? "win" : "" });
      toast(good ? "任务完成！漂亮！" : "时间到，也已经很棒了！");
      later(() => { if (!destroyed) { nodeId = m.next; renderNode(); } }, 650);
    };

    const onClick = (ev) => {
      const cell = ev.target.closest(isWhack ? ".hole3d" : ".slot3d");
      if (!cell || done) return;
      const pan = panOf(cell);
      if (isWhack) {
        if (!cell.classList.contains("up")) { sound.play("miss", pan); return; }
        cell.classList.remove("up");
        cell.innerHTML = `<span class="moji">💥</span>`;
        hits++; combo++;
        fxAt("explosions/cartoon-pow", cell, { light: 1 });
        sound.play("hit", pan);
        if (combo >= 3) sound.play("combo", 0, combo);
        stage.hit(hits % 3);
        stage.shake(0.35);
        popNum(cell, combo >= 3 ? `+1 🔥${combo}` : "+1");
        later(() => { cell.innerHTML = ""; }, 260);
        if (isBoss && hits % 4 === 0) fx.burst("shadow/dark-explosion", { light: 1 });
      } else {
        if (cell.classList.contains("gone")) { sound.play("miss", pan); return; }
        if (cell.dataset.good === "1") {
          hits++; combo++;
          cell.textContent = "✨";
          cell.classList.add("gone");
          fxAt("pickups/collect-burst", cell);
          sound.play("collect", pan);
          if (combo >= 3) sound.play("combo", 0, combo);
          popNum(cell, "+1");
          later(() => {
            cell.textContent = items[Math.floor(Math.random() * items.length)];
            cell.dataset.good = "1";
            cell.classList.remove("gone");
          }, 340);
        } else {
          combo = 0;
          hp = Math.max(1, hp - 1);
          cell.textContent = "💫";
          fxAt("impacts/hit-flash", cell);
          sound.play("damage", pan);
          stage.shake(0.8);
          stage.flash("rgba(255,90,100,.22)");
          toast("哎呀，被僵尸发现了！");
          later(() => { cell.textContent = "🧟"; }, 400);
        }
      }
      updateStat();
      if (hits >= m.goal) finishMini();
    };

    const target = inner.querySelector(isWhack ? "#mini-grid" : "#shelf3d");
    target.onclick = onClick;

    if (isWhack) {
      const spawn = () => {
        if (done) return;
        cells.forEach((c) => { if (c.classList.contains("up")) { c.classList.remove("up"); c.innerHTML = ""; } });
        const count = Math.random() < .35 ? 2 : 1;
        let first = true;
        [...cells].sort(() => Math.random() - .5).slice(0, count).forEach((c) => {
          c.innerHTML = `<span class="moji">${isBoss ? "🟣" : "🧟"}</span>`;
          c.classList.add("up");
          if (first) { sound.play("spawn", panOf(c)); first = false; }
        });
        later(spawn, isBoss ? 620 : 760);
      };
      spawn();
    }

    every(() => {
      time--;
      updateStat();
      if (time === 5 && !done) guide.hint(HINTS.lastSeconds, "last-" + ch.id, { once: true });
      else if (time > 0 && time <= 5) sound.play("tock");
      if (time <= 0) finishMini();
    }, 1000);
    void node;
  }

  // ---------- 结算 ----------
  function finish() { return showResult({ text: { en: "Chapter complete!", zh: "本章完成！" } }); }

  function showResult(node) {
    const stars = hp >= 3 ? 3 : hp === 2 ? 2 : 1;
    const xp = 60 + bonusXp + score * 2 + stars * 10;
    addXp(xp);
    finishChapter(ch.id, stars);
    sound.setPhase("victory");
    sound.play("unlock");
    for (let i = 0; i < stars; i++) later(() => sound.play("star", 0, i), 200 + i * 170);
    stage.camera({ zoom: 1.0, cx: 0, cy: 0, tilt: 0, mood: "win" });
    stage.flash("rgba(255,235,170,.5)");
    stage.setActors([]);
    setTimeout(() => { fx.burst("ui/confetti", { light: 1 }); fx.burst("ui/achievement"); }, 140);

    const nextId = ch.id + 1;
    const hasNext = nextId <= (S.chapterCount || 8);
    inner.innerHTML = `
      ${hud()}${soundPanelHtml()}
      <div class="scene-head"><span class="eyebrow">${esc(cfg.label)} · 胜利定格</span><h2>CHAPTER ${ch.id} CLEAR!</h2><p>${esc(g.title)} · ${esc(g.zh)}</p></div>
      <div class="caption" style="margin-top:8px">${guide.html()}</div>
      <div class="play-area result-area"><div class="result">
        <div class="bigstars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div>
        <h2>冒险完成</h2>
        <p style="font-size:17px;line-height:1.6;max-width:560px;margin:6px auto">
          ${esc(node.text.en)}<br><span style="color:#c4cdf0;font-size:15px">${esc(node.text.zh)}</span>
        </p>
        <div class="gain">+${xp} XP　·　🎯 ${score} 分　·　❤️ ${hp}/3</div>
        <div class="badges">${gainedItems.map((i) => `<span class="badge">🏅 ${esc(i)}</span>`).join("") || '<span class="badge">🏅 勇敢者徽章</span>'}</div>
        <p style="font-weight:900;color:#ffe6a0">${hasNext ? `🔓 第 ${nextId} 章已解锁！` : "🎉 全书通关！你是最勇敢的小读者！"}</p>
        <div class="result-actions">
          ${hasNext ? '<button class="btn primary" id="go-next">📖 进入下一章</button>' : ""}
          <button class="btn orange" id="go-map">🗺 返回章节地图</button>
          <button class="btn ghost" id="again">🔁 再玩一次</button>
        </div>
      </div></div>`;
    bindHud();
    guide.attach();
    guide.play({ en: node.text.en, zh: HINTS.result(hasNext), key: "result", once: true, pulse: "#go-next" });

    const n = inner.querySelector("#go-next");
    if (n) n.onclick = () => { sound.play("select"); cleanup(); hooks.onOpenChapter(nextId); };
    const m = inner.querySelector("#go-map");
    if (m) m.onclick = () => { sound.play("exit"); cleanup(); hooks.onExit(); };
    const a = inner.querySelector("#again");
    if (a) a.onclick = () => {
      sound.play("tap");
      cleanup();
      if (hooks.onRestart) hooks.onRestart();
      else setTimeout(() => mountGame(root, ch, hooks), 30);
    };
  }

  renderNode();
  return { destroy: cleanup };
}
