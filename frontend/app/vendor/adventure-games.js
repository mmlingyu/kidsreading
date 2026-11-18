/* 七种玩法。mount 只负责这一小局，倒计时和过关由阅读页处理。
   绿区判定用 .track 的 data-min / data-max，必须和 stage.css 里 .zone 的 left / width 一致。 */
(function () {
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function whack(host, api) {
    host.innerHTML = `<div class="ground3d"><div class="holes3d">${Array.from({ length: 9 }, () => `<button class="hole3d" data-play="hole"><span></span></button>`).join("")}</div></div>`;
    const hop = () => {
      const cells = [...host.querySelectorAll(".hole3d")];
      cells.forEach((cell) => { cell.classList.remove("up"); cell.dataset.on = "0"; cell.querySelector("span").textContent = ""; });
      [0, 1].forEach(() => {
        const cell = cells[Math.floor(Math.random() * cells.length)];
        cell.classList.add("up");
        cell.dataset.on = "1";
        cell.querySelector("span").textContent = "●";
      });
    };
    hop();
    api.every(900, hop);
    host.onclick = (event) => {
      const cell = event.target.closest("[data-play=hole]");
      if (!cell || cell.dataset.on !== "1") return;
      cell.dataset.on = "0";
      cell.classList.remove("up");
      api.good("pop");
    };
  }

  function scavenge(host, mini, api) {
    const goods = Array.from({ length: mini.goal }, () => ({ good: true, label: "★" }));
    const junk = [{ good: false, label: "×" }, { good: false, label: "×" }, { good: false, label: "×" }];
    const items = goods.concat(junk).sort(() => Math.random() - 0.5);
    const rows = [];
    for (let i = 0; i < items.length; i += 4) rows.push(items.slice(i, i + 4));
    host.innerHTML = `<div class="shelf3d">${rows.map((row) => `<div class="shelf-row3d">${row.map((item) => `<button class="slot3d${item.good ? " good" : ""}" data-play="item" data-good="${item.good ? "1" : "0"}">${item.label}</button>`).join("")}</div>`).join("")}</div>`;
    host.onclick = (event) => {
      const item = event.target.closest("[data-play=item]");
      if (!item || item.disabled) return;
      if (item.dataset.good !== "1") { item.textContent = "·"; api.bad(); return; }
      item.disabled = true;
      item.textContent = "✓";
      api.good("coin");
    };
  }

  function steer(host, api) {
    let lane = 1;
    const rows = [null, null, null, null];
    host.innerHTML = `<div class="steer"><div class="lanes" id="lanes"></div><div class="steer-controls"><button data-play="move" data-dir="-1">← 左</button><button data-play="move" data-dir="1">右 →</button></div></div>`;
    const board = host.querySelector("#lanes");
    const draw = () => {
      board.innerHTML = rows.map((rock, row) => `<div class="lane-row">${[0, 1, 2].map((col) => {
        const rider = row === 3 && col === lane ? `<i class="rider"></i>` : "";
        const stone = rock === col ? `<b class="rock"></b>` : "";
        return `<div class="lane${row === 3 && col === lane ? " on" : ""}">${stone}${rider}</div>`;
      }).join("")}</div>`).join("");
    };
    const tick = () => {
      const bottom = rows[3];
      if (bottom != null) {
        if (bottom === lane) api.bad();
        else api.good("ok");
      }
      rows.pop();
      rows.unshift(Math.floor(Math.random() * 3));
      draw();
    };
    draw();
    api.every(700, tick);
    host.onclick = (event) => {
      const button = event.target.closest("[data-play=move]");
      if (!button) return;
      lane = Math.max(0, Math.min(2, lane + Number(button.dataset.dir)));
      draw();
    };
  }

  function sort(host, mini, api) {
    const deck = [];
    for (let i = 0; i < mini.goal; i++) deck.push(true);
    for (let i = 0; i < 4; i++) deck.push(false);
    deck.sort(() => Math.random() - 0.5);
    let cursor = 0;
    host.innerHTML = `<div class="sort-board"><button class="bin" data-play="bin" data-keep="1">${esc(mini.keep)}</button><div class="sort-card" id="sort-card"></div><button class="bin" data-play="bin" data-keep="0">${esc(mini.drop)}</button></div>`;
    const card = host.querySelector("#sort-card");
    const show = () => {
      if (cursor >= deck.length) return;
      const keep = deck[cursor];
      card.textContent = keep ? mini.keep : mini.drop;
      card.dataset.keep = keep ? "1" : "0";
    };
    show();
    host.onclick = (event) => {
      const bin = event.target.closest("[data-play=bin]");
      if (!bin || cursor >= deck.length) return;
      if (bin.dataset.keep !== card.dataset.keep) { api.bad(); return; }
      cursor += 1;
      if (card.dataset.keep === "1") api.good("coin");
      else api.ack();
      show();
    };
  }

  function order(host, mini, api) {
    const steps = mini.steps.map((label, index) => ({ label, index }));
    const shuffled = steps.slice().sort(() => Math.random() - 0.5);
    let expect = 0;
    const draw = () => {
      host.innerHTML = `<div class="order-list">${shuffled.map((step) => `<button data-play="step" data-i="${step.index}" ${step.index < expect ? "disabled" : ""}>${esc(step.label)}</button>`).join("")}</div>`;
    };
    draw();
    host.onclick = (event) => {
      const button = event.target.closest("[data-play=step]");
      if (!button || button.disabled) return;
      if (Number(button.dataset.i) !== expect) { expect = 0; if (api.reset) api.reset(); api.bad(); draw(); return; }
      expect += 1;
      api.good("ok");
      draw();
    };
  }

  function pace(host, api) {
    let pos = 8;
    let dir = 1;
    let armed = true;
    host.innerHTML = `<div class="pace"><div class="track" data-min="40" data-max="60"><i class="zone"></i><i class="marker" id="pace-marker"></i></div><button data-play="now">就是现在</button></div>`;
    const marker = host.querySelector("#pace-marker");
    const min = Number(host.querySelector(".track").dataset.min);
    const max = Number(host.querySelector(".track").dataset.max);
    const paint = () => { marker.style.left = pos + "%"; };
    paint();
    api.every(40, () => {
      pos += dir * 4;
      if (pos > 92) { pos = 92; dir = -1; }
      else if (pos < 8) { pos = 8; dir = 1; }
      if (pos < min || pos > max) armed = true;
      paint();
    });
    host.onclick = (event) => {
      if (!event.target.closest("[data-play=now]")) return;
      if (pos < min || pos > max) { api.bad(); return; }
      if (!armed) return;
      armed = false;
      api.good("ok");
    };
  }

  function pick(host, mini, api) {
    const card = host.appendChild(document.createElement("div"));
    card.className = "pick-row";
    const deal = () => {
      const cards = [{ label: mini.right, ok: true }, { label: mini.wrongs[0], ok: false }, { label: mini.wrongs[1], ok: false }];
      cards.sort(() => Math.random() - 0.5);
      card.innerHTML = cards.map((item) => `<button data-play="card" data-ok="${item.ok ? "1" : "0"}">${esc(item.label)}</button>`).join("");
    };
    deal();
    host.onclick = (event) => {
      const button = event.target.closest("[data-play=card]");
      if (!button) return;
      if (button.dataset.ok !== "1") { api.bad(); return; }
      api.good("coin");
      deal();
    };
  }

  const PLAY = { whack, scavenge, steer, sort, order, pace, pick };

  window.AdventureGames = {
    mount(host, mini, api) {
      const play = PLAY[mini && mini.type];
      if (!play) throw new Error("未知玩法: " + (mini && mini.type));
      host.innerHTML = "";
      if (mini.type === "whack" || mini.type === "steer" || mini.type === "pace") play(host, api);
      else play(host, mini, api);
    }
  };
})();
