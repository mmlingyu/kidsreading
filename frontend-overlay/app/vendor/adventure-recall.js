/* 章末填空。mount 只负责出题、判分和反馈；知识库与错题本由阅读页保管。 */
(function () {
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function norm(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function acceptable(item) {
    const extra = Array.isArray(item && item.accept) ? item.accept : [];
    return [item && item.answer, ...extra].map(norm).filter(Boolean);
  }

  function grade(item, typed) {
    const got = norm(typed);
    if (!got) return { ok: false, empty: true, typed: "" };
    return { ok: acceptable(item).includes(got), empty: false, typed: got };
  }

  function applyLedger(ledger, entry) {
    const key = [entry.book, entry.chapter, entry.item].join(":");
    const known = (ledger.known || []).filter((row) => row.key !== key);
    const mistakes = (ledger.mistakes || []).filter((row) => row.key !== key);
    const row = Object.assign({}, entry, { key: key });
    if (entry.ok) known.push(row);
    else mistakes.push(row);
    return { known: known, mistakes: mistakes };
  }

  const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

  function keyboardHtml() {
    const key = (name, label, extra) => `<button type="button" class="vk-key${extra || ""}" data-key="${name}">${label}</button>`;
    const row = (names) => `<div class="vk-row">${names}</div>`;
    return `<div class="vk" aria-label="键盘">
      ${row(KEY_ROWS[0].split("").map((ch) => key(ch, ch)).join(""))}
      ${row(KEY_ROWS[1].split("").map((ch) => key(ch, ch)).join(""))}
      ${row(KEY_ROWS[2].split("").map((ch) => key(ch, ch)).join("") + key("backspace", "⌫", " vk-wide"))}
      ${row(key("space", "空格", " vk-space"))}
    </div>`;
  }

  let stopKeys = function () {};

  function mount(host, items, api) {
    const list = Array.isArray(items) ? items : [];
    let index = 0;
    let locked = false;
    let firstCorrect = 0;
    const field = () => host.querySelector(".recall-input");
    const preview = (value) => {
      if (locked) return;
      const blank = host.querySelector(".blank");
      if (!blank) return;
      const text = String(value || "");
      blank.textContent = text ? text : "____";
      blank.className = text ? "blank live" : "blank";
    };
    const keyEl = (name) => host.querySelector(name === "enter" ? ".recall-submit" : `.vk-key[data-key="${name}"]`);
    const pressKey = (name) => {
      const el = keyEl(name);
      if (!el || !el.classList) return;
      el.classList.add("down");
    };
    const releaseKey = (name) => {
      const el = keyEl(name);
      if (el && el.classList) el.classList.remove("down");
    };
    const placeCaret = (input, pos) => {
      if (input.setSelectionRange) input.setSelectionRange(pos, pos);
    };
    const insert = (name) => {
      const input = field();
      if (!input || input.disabled || locked) return;
      const value = String(input.value || "");
      const start = typeof input.selectionStart === "number" ? input.selectionStart : value.length;
      const end = typeof input.selectionEnd === "number" ? input.selectionEnd : value.length;
      let next = value;
      let caret = start;
      if (name === "backspace") {
        const from = start === end ? Math.max(0, start - 1) : start;
        next = value.slice(0, from) + value.slice(end);
        caret = from;
      } else {
        const ch = name === "space" ? " " : name;
        next = value.slice(0, start) + ch + value.slice(end);
        caret = start + ch.length;
      }
      input.value = next;
      placeCaret(input, caret);
      preview(next);
      if (input.focus) input.focus();
    };
    const mapKey = (key) => {
      if (key === "Backspace") return "backspace";
      if (key === " ") return "space";
      if (key === "Enter") return "enter";
      if (/^[a-zA-Z]$/.test(key || "")) return key.toLowerCase();
      return "";
    };
    const onWindowKey = (event) => {
      if (!host.isConnected) { detachKeys(); return; }
      if (locked || event.metaKey || event.ctrlKey || event.altKey) return;
      const name = mapKey(event.key);
      if (!name) return;
      const input = field();
      const typingHere = event.target === input;
      const otherField = !typingHere && event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.isContentEditable);
      if (otherField) return;
      if (name === "enter") {
        pressKey("enter");
        if (!typingHere) {
          const form = host.querySelector(".recall-form");
          if (form && form.requestSubmit) form.requestSubmit();
        }
        return;
      }
      if (!typingHere) {
        event.preventDefault();
        insert(name);
      }
      pressKey(name);
    };
    const onWindowUp = (event) => releaseKey(mapKey(event.key));
    const detachKeys = () => {
      if (!window.removeEventListener) return;
      window.removeEventListener("keydown", onWindowKey);
      window.removeEventListener("keyup", onWindowUp);
    };
    stopKeys();
    stopKeys = detachKeys;
    if (window.addEventListener) {
      window.addEventListener("keydown", onWindowKey);
      window.addEventListener("keyup", onWindowUp);
    }
    const paint = () => {
      const item = list[index];
      if (!item) {
        detachKeys();
        host.innerHTML = `<div class="recall-done"><p>这一章的空都写过了。</p><p>首次答对 ${firstCorrect}/${list.length}</p><button type="button" data-recall="done">完成本章</button></div>`;
        return;
      }
      const kind = item.kind === "grammar" ? "语法" : "单词";
      const sentence = esc(item.sentence).replace("____", '<i class="blank">____</i>');
      host.innerHTML = `<div class="recall-card" data-id="${esc(item.id)}">
        <div class="recall-top">
          <span class="recall-kind">${kind}</span>
          <span class="recall-count">${index + 1} / ${list.length}</span>
        </div>
        <p class="recall-prompt">${esc(item.prompt)}</p>
        <p class="recall-sentence">${sentence}</p>
        ${item.zh ? `<p class="recall-zh"><b>句意</b>${esc(item.zh)}</p>` : ""}
        <form class="recall-form">
          <input class="recall-input" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="off" inputmode="none" aria-label="填空" />
          <button class="recall-submit" type="submit">提交</button>
        </form>
        ${keyboardHtml()}
        <p class="recall-hint">${esc(item.hint || "")}</p>
        <p class="recall-feedback" hidden></p>
        <div class="recall-actions">
          <button type="button" data-recall="next" hidden>下一题</button>
          <button type="button" class="recall-listen" data-recall="speak" hidden>朗读</button>
        </div>
      </div>`;
      const input = field();
      if (input && input.focus) input.focus();
      if (window.matchMedia && window.matchMedia("(max-width: 700px)").matches && input && input.scrollIntoView) {
        input.scrollIntoView({ block: "center", inline: "nearest" });
      }
    };
    host.addEventListener("submit", (event) => {
      const form = event.target.closest(".recall-form");
      if (!form || locked) return;
      event.preventDefault();
      const item = list[index];
      const input = form.querySelector(".recall-input");
      const result = grade(item, input.value);
      const feedback = host.querySelector(".recall-feedback");
      if (result.empty) {
        feedback.hidden = false;
        feedback.className = "recall-feedback bad";
        feedback.textContent = "先把空填上。";
        return;
      }
      locked = true;
      input.disabled = true;
      form.querySelector("button").disabled = true;
      const board = host.querySelector(".vk");
      if (board) board.className = "vk off";
      if (result.ok) firstCorrect += 1;
      const blank = host.querySelector(".blank");
      if (blank) {
        blank.textContent = item.answer;
        blank.className = result.ok ? "blank got" : "blank miss";
      }
      feedback.hidden = false;
      feedback.className = result.ok ? "recall-feedback ok" : "recall-feedback bad";
      feedback.textContent = result.ok
        ? "对了，已记入知识库。"
        : `还不是。正确答案是 ${item.answer}。已记入错题本。`;
      if (api && api.onGrade) api.onGrade(item, result);
      if (api && api.onSpeak) api.onSpeak(item);
      const next = host.querySelector("[data-recall]");
      next.hidden = false;
      next.dataset.recall = index + 1 < list.length ? "next" : "done";
      next.textContent = index + 1 < list.length ? "下一题" : "完成本章";
      const listen = host.querySelector(".recall-listen");
      if (listen) listen.hidden = false;
    });
    let fromPointer = false;
    const keyButton = (event) => event.target.closest && event.target.closest("[data-key]");
    host.addEventListener("pointerdown", (event) => {
      const key = keyButton(event);
      if (!key || locked) return;
      event.preventDefault();
      fromPointer = true;
      insert(key.dataset.key);
      pressKey(key.dataset.key);
    });
    host.addEventListener("pointerup", (event) => {
      const key = keyButton(event);
      if (key) releaseKey(key.dataset.key);
    });
    host.addEventListener("pointercancel", (event) => {
      const key = keyButton(event);
      if (key) releaseKey(key.dataset.key);
    });
    host.addEventListener("input", (event) => {
      const input = event.target && event.target.className && String(event.target.className).indexOf("recall-input") >= 0 ? event.target : null;
      if (input) preview(input.value);
    });
    host.addEventListener("click", (event) => {
      const key = event.target.closest("[data-key]");
      if (key) {
        if (!fromPointer) {
          insert(key.dataset.key);
          pressKey(key.dataset.key);
          setTimeout(() => releaseKey(key.dataset.key), 140);
        }
        fromPointer = false;
        return;
      }
      const button = event.target.closest("[data-recall]");
      if (!button) return;
      if (button.dataset.recall === "speak") {
        if (api && api.onSpeak) api.onSpeak(list[index]);
        return;
      }
      if (button.dataset.recall === "next") {
        index += 1;
        locked = false;
        paint();
        return;
      }
      if (button.dataset.recall === "done" && api && api.onDone) api.onDone({ correct: firstCorrect, total: list.length });
    });
    paint();
  }

  window.AdventureRecall = { norm: norm, grade: grade, applyLedger: applyLedger, mount: mount };
})();
