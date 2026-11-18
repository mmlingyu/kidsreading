// 把 adventure-reader 的 book.json 收进本机书架。生成在技能里完成，这里只检查和保存。
const KEY = "xiaoxiao-imported-books-v1";
const RESERVED = new Set(["tlkoe", "mister-shivers", "next-book"]);
const SCENES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 101, 102, 103, 104, 105, 106]);
const MINIS = new Set(["whack", "scavenge", "steer", "sort", "order", "pace", "pick"]);
const STATS = new Set(["guts", "brains", "heart"]);
const POS = new Set(["n.", "v.", "adj.", "adv.", "phr."]);
const WORD = /[A-Za-z][A-Za-z'-]*/g;

function fail(errors, message) {
  errors.push(message);
}

function words(text) {
  return (String(text || "").match(WORD) || []).map((item) => item.toLowerCase());
}

function containsTerm(text, term) {
  const hay = ` ${words(text).join(" ")} `;
  const needle = words(term).join(" ");
  return Boolean(needle) && hay.includes(` ${needle} `);
}

function checkBilingual(errors, node, where) {
  if (!node || typeof node !== "object") {
    fail(errors, `${where} 需要英文和中文`);
    return;
  }
  if (!String(node.en || "").trim()) fail(errors, `${where}.en 为空`);
  if (!String(node.zh || "").trim()) fail(errors, `${where}.zh 为空`);
  if (/[\u4e00-\u9fff]/.test(String(node.en || ""))) fail(errors, `${where}.en 里不能夹中文`);
}

function reachable(game) {
  const nodes = game.nodes && typeof game.nodes === "object" ? game.nodes : {};
  const seen = new Set();
  const stack = [String(game.start || "")];
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current) || !nodes[current]) continue;
    seen.add(current);
    const node = nodes[current];
    const mini = node.minigame;
    if (mini && mini.next) stack.push(String(mini.next));
    for (const choice of node.choices || []) {
      if (!choice || typeof choice !== "object") continue;
      if (choice.to) stack.push(String(choice.to));
      for (const branch of ["success", "fail"]) {
        const arm = choice[branch];
        if (arm && arm.to) stack.push(String(arm.to));
      }
    }
  }
  return seen;
}

function checkMini(errors, mini, where, nodes) {
  if (!MINIS.has(mini.type)) {
    fail(errors, `${where} 的玩法不认识`);
    return;
  }
  const duration = Number(mini.duration);
  if (!(duration >= 15 && duration <= 40)) fail(errors, `${where} 的时长要在 15–40 秒`);
  if (!nodes[mini.next]) fail(errors, `${where} 的下一步不存在`);
  if (mini.type === "order") {
    const steps = mini.steps;
    if (!Array.isArray(steps) || steps.length < 3 || steps.length > 5 || steps.some((step) => !String(step).trim())) {
      fail(errors, `${where} 的排序需要 3–5 个步骤`);
    } else if (mini.goal !== steps.length) fail(errors, `${where} 的排序目标必须等于步骤数`);
    else if (new Set(steps.map((step) => String(step).trim())).size !== steps.length) fail(errors, `${where} 的步骤文案不能重复`);
    return;
  }
  if (mini.type === "pick") {
    const wrongs = mini.wrongs;
    if (!String(mini.right || "").trim() || !Array.isArray(wrongs) || wrongs.length !== 2) fail(errors, `${where} 的三选一需要一个正确项和两个错误项`);
    else {
      const labels = [String(mini.right).trim(), ...wrongs.map((item) => String(item).trim())];
      if (labels.some((item) => !item) || new Set(labels).size !== 3) fail(errors, `${where} 的三张牌文案必须各不相同`);
    }
  }
  if (mini.type === "sort") {
    const keep = String(mini.keep || "").trim();
    const drop = String(mini.drop || "").trim();
    if (!keep || !drop) fail(errors, `${where} 的分类需要留下和丢掉两类`);
    else if (keep === drop) fail(errors, `${where} 的两类文案不能相同`);
  }
  const goal = Number(mini.goal);
  if (!(goal >= 6 && goal <= 12)) fail(errors, `${where} 的目标要在 6–12`);
}

function squash(text) {
  return String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function checkRecall(errors, chapter, where) {
  const game = chapter.game;
  if (!game || typeof game !== "object") {
    fail(errors, `${where} 缺少章末填空`);
    return;
  }
  if (game.nodes || game.start) fail(errors, `${where} 不要再带小游戏节点`);
  checkBilingual(errors, game.intro, `${where} 的填空说明`);
  const paragraphs = Array.isArray(chapter.paragraphs) ? chapter.paragraphs : [];
  const vocab = Array.isArray(chapter.vocab) ? chapter.vocab : [];
  const recall = game.recall;
  if (!Array.isArray(recall) || !recall.length) {
    fail(errors, `${where} 缺少填空题`);
    return;
  }
  if (recall.length !== vocab.length + paragraphs.length) {
    fail(errors, `${where} 的填空应该覆盖每个核心词和每一句语法`);
  }
  const ids = new Set();
  const vocabItems = [];
  const grammarItems = [];
  recall.forEach((item, index) => {
    if (!item || (item.kind !== "vocab" && item.kind !== "grammar")) {
      fail(errors, `${where} 第 ${index + 1} 题必须是单词或语法`);
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(item.id || "")) || ids.has(item.id)) {
      fail(errors, `${where} 第 ${index + 1} 题的编号不可用或重复`);
    }
    ids.add(item.id);
    const sentence = String(item.sentence || "");
    const answer = String(item.answer || "").trim();
    if (sentence.split("____").length !== 2) fail(errors, `${where} 第 ${index + 1} 题要正好挖一个空`);
    const answerWords = answer.split(/\s+/).filter(Boolean);
    if (!answer || /[\u4e00-\u9fff]/.test(answer) || answerWords.length < 1 || answerWords.length > 5) {
      fail(errors, `${where} 第 ${index + 1} 题的答案要是 1–5 个英文词`);
    }
    if (!String(item.prompt || "").trim() || !String(item.hint || "").trim()) {
      fail(errors, `${where} 第 ${index + 1} 题缺少提示`);
    }
    if (item.kind === "vocab") vocabItems.push(item);
    else grammarItems.push(item);
  });
  const firstGrammar = recall.findIndex((item) => item && item.kind === "grammar");
  const lastVocab = recall.map((item) => item && item.kind).lastIndexOf("vocab");
  if (firstGrammar !== -1 && lastVocab !== -1 && firstGrammar < lastVocab) {
    fail(errors, `${where} 要先出完单词题，再出语法题`);
  }
  const blob = paragraphs.map((p) => (p && p.en) || "").join(" ");
  vocabItems.forEach((item, index) => {
    const word = vocab[index];
    const filled = String(item.sentence || "").replace("____", item.answer);
    if (!word || squash(item.answer) !== squash(word.w) || squash(filled) !== squash(word.eg)) {
      fail(errors, `${where} 的单词题 ${item.answer} 没有对上核心词和例句`);
    } else if (!containsTerm(blob, item.answer)) fail(errors, `${where} 的单词 ${item.answer} 不在本章英文里`);
  });
  grammarItems.forEach((item, index) => {
    const source = paragraphs[index] && paragraphs[index].en;
    const filled = String(item.sentence || "").replace("____", item.answer);
    if (squash(filled) !== squash(source)) fail(errors, `${where} 的语法题填回去和原句不一致`);
    else if (!containsTerm(blob, item.answer)) fail(errors, `${where} 的语法答案 ${item.answer} 不在本章英文里`);
  });
}

function checkGame(errors, game, where) {
  if (!game || typeof game !== "object") {
    fail(errors, `${where} 缺少冒险`);
    return;
  }
  checkBilingual(errors, game.intro, `${where}.intro`);
  const nodes = game.nodes;
  if (!nodes || typeof nodes !== "object" || !nodes[game.start]) {
    fail(errors, `${where} 的冒险从起点走不通`);
    return;
  }
  const ends = Object.entries(nodes).filter(([, node]) => node && node.end === true).map(([name]) => name);
  if (ends.length !== 1 || ends[0] !== "end") fail(errors, `${where} 必须有唯一的结束节点 end`);
  let miniCount = 0;
  for (const [name, node] of Object.entries(nodes)) {
    if (!node || typeof node !== "object") {
      fail(errors, `${where}.${name} 不是对象`);
      continue;
    }
    checkBilingual(errors, node.text, `${where}.${name}`);
    if (node.end === true) continue;
    if (node.minigame && node.choices) fail(errors, `${where}.${name} 不能又有小游戏又有选项`);
    if (!node.minigame && !node.choices) fail(errors, `${where}.${name} 缺少选项或小游戏`);
    if (node.minigame) {
      miniCount += 1;
      checkMini(errors, node.minigame, `${where}.${name}`, nodes);
    }
    for (const choice of node.choices || []) {
      checkBilingual(errors, choice.label, `${where}.${name} 的选项`);
      if (choice.stat) {
        if (!STATS.has(choice.stat)) fail(errors, `${where}.${name} 的检定只允许勇气、智慧、团结`);
        const dc = Number(choice.dc);
        if (!(dc >= 4 && dc <= 8)) fail(errors, `${where}.${name} 的难度要在 4–8`);
        for (const branch of ["success", "fail"]) {
          const arm = choice[branch];
          if (!arm || !nodes[arm.to]) fail(errors, `${where}.${name} 的${branch === "success" ? "成功" : "失败"}去向不存在`);
          else checkBilingual(errors, arm.text, `${where}.${name}.${branch}`);
        }
      } else if (!nodes[choice.to]) fail(errors, `${where}.${name} 的选项去向不存在`);
    }
  }
  if (miniCount !== 1) fail(errors, `${where} 需要恰好一种小游戏`);
  const seen = reachable(game);
  if (!seen.has("end")) fail(errors, `${where} 从起点走不到结束`);
}

export function validateBook(book) {
  const errors = [];
  const safeMedia = new Set(["assets/books/ms-1-shadow.jpg", "assets/books/ms-2-beneath.jpg", "assets/books/ms-3-doll.jpg", "assets/books/ms-4-walk.jpg", "assets/books/ms-ch1.jpg", "assets/books/ms-ch2.jpg", "assets/books/ms-ch3.jpg", "assets/books/ms-ch4.jpg", "assets/books/ms-ch5.jpg", "assets/books/ms-ch6.jpg", "assets/books/tlkoe-cover.jpg", "assets/books/tlkoe-hero.jpg", "assets/ch1.png", "assets/ch2.png", "assets/ch3.png", "assets/ch4.png", "assets/ch5.png", "assets/ch6.png", "assets/ch7.png", "assets/ch8.png", "assets/cover.png", "assets/hero.jpg", "assets/jack.jpg"]);
  // Imported book JSON must remain data, including local files. No remote media/markup/prototype pollution.
  function safe(value, depth = 0) {
    if (depth > 30) throw Error('书稿层级过深');
    if (typeof value === 'string' && (/[<>]/.test(value) || /^(?:javascript|data):/i.test(value))) throw Error('书稿包含不允许的HTML或URL');
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__','prototype','constructor'].includes(key)) throw Error('书稿键名不可用');
      if (['cover','hero','art'].includes(key) && child && !safeMedia.has(child)) throw Error('封面插图只能使用现有静态图片路径');
      if (key === 'color' && child && !/^#[a-fA-F0-9]{3,8}$/.test(child)) throw Error('颜色格式不合法');
      safe(child, depth + 1);
    }
  }
  try { safe(book); } catch (error) { return [error.message]; }
  if (!book || typeof book !== "object" || Array.isArray(book)) return ["文件内容不是一本书"];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(book.id || ""))) fail(errors, "id 必须是小写短横线名字");
  if (RESERVED.has(book.id)) fail(errors, "这个 id 已经被内置书占用");
  checkBilingual(errors, book.book && book.book.quote, "封面句子");
  if (!book.book || !String(book.book.title || "").trim() || !String(book.book.zh || "").trim()) fail(errors, "缺少书名或中文名");
  const chapters = book.chapters;
  if (!Array.isArray(chapters) || !chapters.length) {
    fail(errors, "没有章节");
    return errors;
  }
  const kinds = [];
  chapters.forEach((chapter, index) => {
    const where = `第 ${index + 1} 章`;
    if (!chapter || chapter.id !== index + 1) fail(errors, `${where} 的编号必须是 ${index + 1}`);
    if (!SCENES.has(chapter.scene)) fail(errors, `${where} 的场景编号不可用`);
    const paragraphs = Array.isArray(chapter.paragraphs) ? chapter.paragraphs : [];
    if (paragraphs.length < 4 || paragraphs.length > 12) fail(errors, `${where} 需要 4–12 句`);
    const blob = paragraphs.map((p) => (p && p.en) || "").join(" ");
    paragraphs.forEach((paragraph, pIndex) => {
      checkBilingual(errors, paragraph, `${where}第 ${pIndex + 1} 句`);
      const grammar = paragraph && paragraph.grammar;
      if (!grammar || !String(grammar.title || "").trim() || !String(grammar.explain || "").trim()) {
        fail(errors, `${where}第 ${pIndex + 1} 句缺少语法说明`);
      }
    });
    const vocab = Array.isArray(chapter.vocab) ? chapter.vocab : [];
    if (vocab.length < 4 || vocab.length > 8) fail(errors, `${where} 需要 4–8 个核心词`);
    vocab.forEach((item) => {
      if (!item || !POS.has(item.pos)) fail(errors, `${where} 有核心词词性不对`);
      else if (!containsTerm(blob, item.w)) fail(errors, `${where} 的核心词 ${item.w} 没有出现在英文里`);
    });
    const quiz = chapter.quiz;
    if (!Array.isArray(quiz) || quiz.length !== 2) fail(errors, `${where} 需要恰好 2 道题`);
    else quiz.forEach((item) => {
      if (!item || !Array.isArray(item.options) || item.options.length !== 3 || ![0, 1, 2].includes(item.answer)) {
        fail(errors, `${where} 的题目需要 3 个选项和答案编号`);
      }
    });
    if (chapter.game && Array.isArray(chapter.game.recall)) checkRecall(errors, chapter, where);
    else {
      checkGame(errors, chapter.game, where);
      const found = Object.values(chapter.game && chapter.game.nodes || {})
        .map((node) => node && node.minigame && node.minigame.type)
        .filter(Boolean);
      if (found.length === 1) kinds.push(found[0]);
    }
  });
  if (kinds.length >= 4 && new Set(kinds).size < 3) fail(errors, "四章以上至少要三种玩法");
  for (let i = 1; i < kinds.length; i += 1) {
    if (kinds[i] === kinds[i - 1]) fail(errors, `相邻两章不能用同一种玩法：${kinds[i]}`);
  }
  return errors;
}

export function adaptBook(book) {
  return {
    id: book.id,
    status: "ready",
    imported: true,
    book: {
      title: book.book.title,
      zh: book.book.zh,
      author: book.book.author || "导入的分级故事",
      level: book.level || book.book.level || "导入的分级书",
      quote: book.book.quote
    },
    chapters: book.chapters.map((chapter) => ({
      ...chapter,
      art: chapter.art || "",
      tag: chapter.tag || (chapter.game && chapter.game.zh) || "冒险",
      minutes: chapter.minutes || 4
    })),
    kicker: book.kicker || "IMPORTED · 导入",
    heroTitle: book.book.title,
    age: book.age || "分级",
    level: book.level || book.book.level || "导入的分级书",
    tagline: book.tagline || "从 book.json 导入的分级故事。",
    blurb: book.blurb || "句子由 adventure-reader 新写，不是原文。",
    cover: book.cover || "",
    hero: book.hero || "",
    color: book.color || "#7eb6ff",
    credit: "由 adventure-reader 生成后导入。句子是新写的分级故事，不是原文。"
  };
}

export function loadImported() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((item) => item && item.imported && item.status === "ready") : [];
  } catch {
    return [];
  }
}

function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function rememberBook(entry) {
  const list = loadImported().filter((item) => item.id !== entry.id);
  list.push(entry);
  write(list);
  return entry;
}

export function removeImported(id) {
  write(loadImported().filter((item) => item.id !== id));
}

export function clearImported() {
  localStorage.removeItem(KEY);
}

export function importBook(book) {
  const errors = validateBook(book);
  if (errors.length) return { ok: false, errors };
  const entry = adaptBook(book);
  rememberBook(entry);
  return { ok: true, errors: [], book: entry };
}
