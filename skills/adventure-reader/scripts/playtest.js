#!/usr/bin/env node
/* 章末填空：空答案不记账，答错进错题本，答对进知识库并把同一题从错题本移走。 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const recallPath = path.join(root, "assets", "recall.js");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function El(tag) {
  this.tag = tag;
  this.children = [];
  this.dataset = {};
  this.value = "";
  this.disabled = false;
  this.hidden = false;
  this.className = "";
  this.textContent = "";
  this.parent = null;
}
El.prototype.querySelector = function (selector) {
  const found = [];
  const walk = (node) => {
    node.children.forEach((child) => {
      if (matches(child, selector)) found.push(child);
      walk(child);
    });
  };
  walk(this);
  return found[0] || null;
};
El.prototype.closest = function (selector) {
  let node = this;
  while (node) {
    if (matches(node, selector)) return node;
    node = node.parent;
  }
  return null;
};
El.prototype.after = function (node) {
  node.parent = this.parent;
};
function matches(node, selector) {
  if (!node || !node.tag) return false;
  if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
  if (selector === "[data-recall]") return node.dataset.recall != null;
  return node.tag === selector;
}
function parseInto(root, html) {
  root.children = [];
  root._html = html;
  const stack = [root];
  (html.match(/<[^>]+>/g) || []).forEach((tag) => {
    if (tag.startsWith("</")) { stack.pop(); return; }
    const el = new El(tag.match(/^<([a-z0-9-]+)/i)[1]);
    const cls = tag.match(/class="([^"]*)"/);
    if (cls) el.className = cls[1];
    const data = tag.match(/data-recall="([^"]*)"/);
    if (data) el.dataset.recall = data[1];
    el.parent = stack[stack.length - 1];
    stack[stack.length - 1].children.push(el);
    if (!tag.endsWith("/>") && el.tag !== "input") stack.push(el);
  });
}
function loadRecall() {
  const host = new El("div");
  host.listeners = {};
  host.addEventListener = function (type, fn) { this.listeners[type] = fn; };
  Object.defineProperty(host, "innerHTML", {
    set(html) { parseInto(host, html); },
    get() { return host._html || ""; }
  });
  const context = { window: {}, console };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(recallPath, "utf8"), context);
  return { api: context.AdventureRecall, host };
}

function entry(item, result, extra) {
  return Object.assign({
    book: "tree-house-night",
    chapter: 1,
    item: item.id,
    kind: item.kind,
    answer: item.answer,
    prompt: item.prompt,
    sentence: item.sentence,
    typed: result.typed,
    ok: result.ok
  }, extra);
}

function testEngine() {
  const { api, host } = loadRecall();
  const lives = { id: "g-1", kind: "grammar", answer: "lives", accept: [], prompt: "一般现在时", sentence: "Mina ____ here.", hint: "动词加 -s" };
  assert(api.grade(lives, "  Lives ").ok, "大小写和空格应算对");
  assert(api.grade(lives, "live").ok === false, "少了 -s 应算错");
  assert(api.grade(lives, "   ").empty, "空答案不能记账");
  const phrase = { id: "v-1", kind: "vocab", answer: "tree house", prompt: "树屋", sentence: "in a ____.", hint: "名词" };
  assert(api.grade(phrase, "  tree   house ").ok, "多词答案忽略多余空格");

  let ledger = { known: [], mistakes: [] };
  const wrong = api.grade(lives, "live");
  ledger = api.applyLedger(ledger, entry(lives, wrong));
  assert(ledger.mistakes.length === 1 && ledger.known.length === 0, "答错只进错题本");
  const right = api.grade(lives, "lives");
  ledger = api.applyLedger(ledger, entry(lives, right));
  assert(ledger.known.length === 1 && ledger.mistakes.length === 0, "再答对应移出错题本");
  ledger = api.applyLedger(ledger, entry(lives, wrong));
  assert(ledger.known.length === 0 && ledger.mistakes.length === 1, "答错应移出知识库");

  const grades = [];
  api.mount(host, [phrase, lives], {
    onGrade(item, result) { grades.push([item.id, result.ok]); },
    onDone(summary) { grades.push(["done", summary.correct, summary.total]); }
  });
  assert(host._html.includes("树屋") && host._html.includes("____"), "第一题要显示提示和空");
  const submit = (value) => {
    const form = host.querySelector(".recall-form");
    form.querySelector(".recall-input").value = value;
    host.listeners.submit({ target: form, preventDefault() {} });
  };
  submit("   ");
  assert(host.querySelector(".recall-feedback").textContent.includes("先把空填上") && grades.length === 0, "空提交不记账");
  submit("house");
  assert(grades[0][0] === "v-1" && grades[0][1] === false, "错答案要回调");
  assert(host.querySelector(".recall-feedback").textContent.includes("错题本"), "错答案要告诉用户已记入错题本");
  host.listeners.click({ target: host.querySelector("[data-recall]") });
  submit("lives");
  assert(grades[1][0] === "g-1" && grades[1][1] === true, "下一题答对要回调");
  assert(host.querySelector(".recall-feedback").textContent.includes("知识库"), "答对要告诉用户已记入知识库");
  host.listeners.click({ target: host.querySelector("[data-recall]") });
  assert(grades[2][0] === "done" && grades[2][1] === 1 && grades[2][2] === 2, "首次答对只算一次");
  return "engine";
}

function testBook(file) {
  const book = JSON.parse(fs.readFileSync(file, "utf8"));
  const { api } = loadRecall();
  book.chapters.forEach((chapter) => {
    const recall = chapter.game && chapter.game.recall;
    assert(Array.isArray(recall) && recall.length > 0, `${book.id} 第 ${chapter.id} 章没有填空`);
    recall.forEach((item) => {
      assert(api.grade(item, item.answer).ok, `${book.id} 第 ${chapter.id} 章 ${item.id} 的标准答案判错`);
      assert(!api.grade(item, "nope").ok, `${book.id} 第 ${chapter.id} 章 ${item.id} 把错误答案判对了`);
      let ledger = api.applyLedger({ known: [], mistakes: [] }, entry(item, api.grade(item, "nope"), { book: book.id, chapter: chapter.id }));
      ledger = api.applyLedger(ledger, entry(item, api.grade(item, item.answer), { book: book.id, chapter: chapter.id }));
      assert(ledger.known.some((row) => row.item === item.id) && ledger.mistakes.length === 0, `${item.id} 答对后仍留在错题本`);
    });
  });
  return book.id;
}

const files = process.argv.slice(2);
if (!files.length) files.push(path.join(root, "references", "example-book.json"));
try {
  const names = [testEngine(), ...files.map(testBook)];
  console.log("通过：" + names.join(" · "));
} catch (error) {
  console.error("未通过：" + error.message);
  process.exit(1);
}
