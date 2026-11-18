// 音节 + 音标辅助朗读。
// 双轨设计：
//   · 拼写音节 mon·ster —— 用于「拆开跟读」，每一段都能对应系统 TTS 读出的声音；
//   · 美式 IPA /ˈmɑnstɚ/ —— 用于「认读音」，来自 CMU 发音词典离线生成的精简词表。
// 书中全部核心词有人工核对的音节词典；划选到词典外的词才用拼读规则兜底（标记为规则推测）。
// 音标不猜测：词典未收录的词不编造读音，只显示音节并提示可听发音。
import { S, utter, esc, stopSpeech } from "./state.js?v=reader-phase1-r5";
import { IPA } from "./data/ipa.js";

// ---------- 拼写音节词典：两本书全部核心词 + 正文高频词 + 常见规则例外 ----------
// 单音节词不写（默认整词一段）；只列需要切分的词与容易切错的例外。
const DICT = {
  monster: "mon·ster", monsters: "mon·sters", zombie: "zom·bie", zombies: "zom·bies",
  stomach: "stom·ach", supermarket: "su·per·mar·ket", footprint: "foot·print",
  giant: "gi·ant", backyard: "back·yard", machine: "ma·chine",
  bully: "bul·ly", escape: "es·cape", jacket: "jack·et", adult: "a·dult",
  hallway: "hall·way", locker: "lock·er", rescue: "res·cue", lonely: "lone·ly",
  whisper: "whis·per", wiggle: "wig·gle", puppy: "pup·py", crystal: "crys·tal",
  portal: "por·tal", battery: "bat·ter·y", shadow: "shad·ow", annoyed: "an·noyed",
  sunrise: "sun·rise", mirror: "mir·ror", without: "with·out",
  morning: "morn·ing", nothing: "noth·ing", something: "some·thing",
  everything: "ev·ery·thing", every: "ev·ery", very: "ver·y",
  suddenly: "sud·den·ly", quiet: "qui·et", around: "a·round", again: "a·gain",
  together: "to·geth·er", adventure: "ad·ven·ture", because: "be·cause",
  before: "be·fore", behind: "be·hind", below: "be·low", beside: "be·side",
  flashlight: "flash·light", cookie: "cook·ie", cookies: "cook·ies",
  soda: "so·da", bottle: "bot·tle", bottles: "bot·tles",
  treehouse: "tree·house", rooftop: "roof·top", outside: "out·side", inside: "in·side",
  people: "peo·ple", purple: "pur·ple", little: "lit·tle",
  water: "wa·ter", under: "un·der", over: "o·ver", never: "nev·er",
  better: "bet·ter", bigger: "big·ger", biggest: "big·gest",
  running: "run·ning", sitting: "sit·ting",
  opened: "o·pened", open: "o·pen", listen: "lis·ten",
  happy: "hap·py", funny: "fun·ny", scary: "scar·y", sorry: "sor·ry",
  angry: "an·gry", hungry: "hun·gry", empty: "emp·ty",
  slowly: "slow·ly", quickly: "quick·ly", really: "re·al·ly",
  today: "to·day", tonight: "to·night", tomorrow: "to·mor·row",
  breakfast: "break·fast", dinner: "din·ner",
  window: "win·dow", pillow: "pil·low", yellow: "yel·low",
  closet: "clos·et", corner: "cor·ner",
  voice: "voice", voices: "voic·es",
  kitchen: "kitch·en", garage: "ga·rage", garden: "gar·den",
  teacher: "teach·er", helmet: "hel·met", baseball: "base·ball",
  remember: "re·mem·ber", forget: "for·get",
  umbrella: "um·brel·la", banana: "ba·nan·a",
  computer: "com·put·er", dinosaur: "di·no·saur",
  beautiful: "beau·ti·ful", wonderful: "won·der·ful",
  dangerous: "dan·ger·ous", enormous: "e·nor·mous",
  mystery: "mys·ter·y", finally: "fi·nal·ly",
  started: "start·ed", wanted: "want·ed", needed: "need·ed",
  shouted: "shout·ed", whispered: "whis·pered",
  children: "chil·dren", grownups: "grown·ups",
  anyone: "an·y·one", nobody: "no·bod·y", somebody: "some·bod·y",
  whatever: "what·ev·er", however: "how·ev·er",
  already: "al·read·y", always: "al·ways", almost: "al·most",
  myself: "my·self", himself: "him·self", herself: "her·self",
  maybe: "may·be",
  table: "ta·ble", apple: "ap·ple", candle: "can·dle",
  circle: "cir·cle", turtle: "tur·tle",
  action: "ac·tion", station: "sta·tion", question: "ques·tion",
  picture: "pic·ture", nature: "na·ture", future: "fu·ture",
  creature: "crea·ture", furniture: "fur·ni·ture",
  bedroom: "bed·room", moonlight: "moon·light",
  blanket: "blan·ket", sleepy: "sleep·y",
  mister: "mis·ter", shivers: "shiv·ers",
  hello: "hel·lo", quietly: "qui·et·ly", counted: "count·ed",
  mother: "moth·er", father: "fa·ther", brother: "broth·er", sister: "sis·ter",
  seven: "sev·en", eleven: "e·lev·en", animal: "an·i·mal", orange: "or·ange",
  spider: "spi·der", tiger: "ti·ger", robot: "ro·bot", music: "mu·sic",
  visit: "vis·it", habit: "hab·it", finish: "fin·ish", cabin: "cab·in",
  second: "sec·ond", minute: "min·ute",
  // 静音 e / 单音节易错词：显式写整词，阻止规则误切
  fire: "fire", one: "one", once: "once", done: "done", gone: "gone",
  have: "have", give: "give", live: "live", love: "love",
  come: "come", some: "some", home: "home",
  there: "there", where: "where", eye: "eye", eyes: "eyes",
  walked: "walked", jumped: "jumped", looked: "looked",
  laughed: "laughed", smiled: "smiled", stopped: "stopped",
  floor: "floor", school: "school", creak: "creak", creaks: "creaks",
  scratch: "scratch", beep: "beep", fight: "fight",
  // 规则易错词（元音组合 / 弱读音节 / 专有名词）
  any: "an·y", idea: "i·de·a", science: "sci·ence", aisle: "aisle", aisles: "aisles",
  centre: "cen·tre", crayons: "cray·ons", normal: "nor·mal", weather: "weath·er",
  everyone: "ev·ery·one", actually: "ac·tu·al·ly", definitely: "def·i·nite·ly",
  impossible: "im·pos·si·ble", terrible: "ter·ri·ble", extremely: "ex·treme·ly",
  obviously: "ob·vi·ous·ly", cafeteria: "caf·e·te·ri·a",
  encyclopedias: "en·cy·clo·pe·di·as", scientifically: "sci·en·tif·i·cal·ly",
  scientific: "sci·en·tif·ic", projectiles: "pro·jec·tiles",
  everywhere: "ev·ery·where", wakefield: "wake·field", brallier: "bral·li·er",
  letizia: "le·ti·zi·a", going: "go·ing",
  // -es 复数读 /ɪz/，要单独成一段（catch·es / hous·es）；元音组合不拆开
  catches: "catch·es", closes: "clos·es", faces: "fac·es", fixes: "fix·es",
  flashes: "flash·es", freezes: "freez·es", giggles: "gig·gles", glasses: "glass·es",
  houses: "hous·es", places: "plac·es", presses: "press·es", pushes: "push·es",
  shuffles: "shuf·fles", smashes: "smash·es", sneezes: "sneez·es",
  heal: "heal", real: "real",
};

// 屈折后缀：未命中词典时先还原词干再查一次，把后缀并回最后一段
const INFLECTIONS = ["ies", "es", "s", "ing", "ed", "er", "est", "ly"];
// 派生后缀自成音节
const SUFFIXES = ["tion", "sion", "ture", "sure", "ment", "ness", "ful", "less",
  "ous", "able", "ible", "ity", "ize", "ate", "age", "ive", "ism", "ist",
  "ing", "al", "ic"];
// 可出现在音节开头的辅音簇（长的优先）
const ONSETS = ["scr", "spr", "str", "squ", "shr", "thr", "bl", "br", "ch", "cl", "cr",
  "dr", "fl", "fr", "gl", "gr", "kn", "ph", "pl", "pr", "qu", "sc", "sh", "sk", "sl",
  "sm", "sn", "sp", "st", "sw", "th", "tr", "tw", "wh", "wr"];
const VOWEL = /[aeiouy]/;

// 找出元音组 [start, end)；"qu" 的 u 不单独成组，词首 y 视作辅音
function vowelGroups(w) {
  const g = [];
  for (let i = 0; i < w.length; i++) {
    if (!VOWEL.test(w[i])) continue;
    if (w[i] === "y" && i === 0) continue;
    if (w[i] === "u" && i > 0 && w[i - 1] === "q") continue;
    if (g.length && g[g.length - 1][1] === i) g[g.length - 1][1] = i + 1;
    else g.push([i, i + 1]);
  }
  return g;
}

// 规则兜底：按元音组与辅音簇切分（返回小写音节数组）
function guess(w) {
  for (const suf of SUFFIXES) {
    if (w.length >= suf.length + 2 && w.endsWith(suf)) {
      const head = w.slice(0, -suf.length);
      if (vowelGroups(head).length >= 1) return [...guess(head), suf];
    }
  }

  // 辅音 + le 结尾自成一段：ta·ble / ap·ple / wig·gle
  if (w.endsWith("le") && w.length > 3 && !VOWEL.test(w[w.length - 3])) {
    const head = w.slice(0, -2);
    const first = head.slice(0, -1);
    if (vowelGroups(first).length >= 1) return [...guess(first), head.slice(-1) + "le"];
  }

  let groups = vowelGroups(w);
  if (groups.length <= 1) return [w];

  // 词尾静音 e 不新增音节：slime / escape，以及屈折后仍静音的 comes / moved / closed。
  // 例外：词干以 t/d 结尾时 -ed 里的 e 要发音（wanted → wan·ted），必须保留。
  const last = groups[groups.length - 1];
  const tail = w.slice(last[1]);
  const silentE = w[last[0]] === "e" && last[1] - last[0] === 1
    && (tail === "" || tail === "s" || (tail === "d" && !/[td]$/.test(w.slice(0, last[0]))));
  if (silentE && !(w.endsWith("le") && w.length > 2 && !VOWEL.test(w[w.length - 3]))) {
    groups = groups.slice(0, -1);
    if (groups.length <= 1) return [w];
  }

  const cuts = [];
  for (let i = 0; i < groups.length - 1; i++) {
    const a = groups[i][1], b = groups[i + 1][0];
    const cons = w.slice(a, b);
    if (cons.length <= 1) { cuts.push(a); continue; }       // V/CV：辅音归后
    let take = 0;
    for (const on of ONSETS) if (cons.endsWith(on) && on.length > take) take = on.length;
    if (cons.length === 2 && take === 0) take = 1;          // VC/CV：一人一个
    if (take === 0) take = 1;
    if (take >= cons.length) take = cons.length - 1;        // 至少留一个辅音收前段
    cuts.push(a + cons.length - take);
  }

  const parts = [];
  let start = 0;
  for (const c of cuts) { parts.push(w.slice(start, c)); start = c; }
  parts.push(w.slice(start));
  const fixed = [];
  for (const p of parts) {
    if (!p) continue;
    if (fixed.length && !vowelGroups(p).length) fixed[fixed.length - 1] += p;
    else fixed.push(p);
  }
  return fixed.length > 1 ? fixed : [w];
}

// 词典查询（含屈折还原）
function lookup(w) {
  if (DICT[w]) return { parts: DICT[w].split("·"), source: "dict" };
  for (const suf of INFLECTIONS) {
    if (!w.endsWith(suf) || w.length <= suf.length + 2) continue;
    const stem = w.slice(0, -suf.length);
    const base = stem.endsWith("i") && suf === "es" ? stem.slice(0, -1) + "y" : stem;
    for (const key of [stem, base, stem + "e"]) {
      if (!DICT[key] || !DICT[key].includes("·")) continue;
      const parts = DICT[key].split("·");
      // -ing 自成一段（o·pen·ing）；t/d 后的 -ed 也自成一段（want·ed）
      if (suf === "ing" || (suf === "ed" && /[td]$/.test(key))) parts.push(suf);
      else parts[parts.length - 1] += suf;
      return { parts, source: "dict" };
    }
    if (["ing", "ed", "er", "est"].includes(suf)) {
      const m = stem.match(/^(.*)([a-z])\2$/);
      if (m && DICT[m[1] + m[2]]?.includes("·")) {
        const parts = DICT[m[1] + m[2]].split("·");
        parts[parts.length - 1] += m[2] + suf;
        return { parts, source: "dict" };
      }
    }
  }
  return null;
}

// 把一个小写词按音节切开，并把切点映射回原始大小写
function splitToken(token) {
  const m = token.match(/^([^A-Za-z]*)([A-Za-z][A-Za-z']*)([^A-Za-z']*)$/);
  if (!m) return null;
  const [, pre, core, post] = m;
  const owned = /['’]s$/i.test(core) ? core.slice(-2) : "";   // 所有格 's 单独处理
  const stemCore = owned ? core.slice(0, -owned.length) : core;
  const low = stemCore.toLowerCase();
  const hit = lookup(low);
  const parts = hit ? hit.parts : guess(low);
  let pos = 0;
  const mapped = parts.map((p) => { const s = stemCore.slice(pos, pos + p.length); pos += p.length; return s; });
  if (pos < stemCore.length) mapped[mapped.length - 1] += stemCore.slice(pos);
  if (owned) mapped[mapped.length - 1] += owned;
  return { pre, core, post, parts: mapped, source: hit ? "dict" : "rule" };
}

// 主入口：把任意英文片段切成带分隔信息的 token
export function syllabify(text = "") {
  return String(text).split(/(\s+)/).map((chunk) => {
    if (/^\s+$/.test(chunk)) return { sep: chunk };
    const t = splitToken(chunk);
    if (!t) return { sep: "", raw: esc(chunk), text: chunk, parts: [], source: "punct" };
    return { ...t, text: chunk, sep: "" };
  });
}

// 纯文本：mon·ster ad·ven·ture
export function syllableText(text = "") {
  return syllabify(text).map((t) => t.sep ? t.sep : (t.parts?.length ? t.parts.join("·") : t.text)).join("");
}

// 可交互 HTML：音节交替着色，点单段可单独发音（外部事件委托 [data-say]）
export function syllableHTML(text = "", { interactive = true } = {}) {
  let idx = 0;
  const body = syllabify(text).map((t) => {
    if (t.sep) return t.sep;
    if (!t.parts?.length) return t.raw ?? esc(t.text);
    const inner = t.parts.map((p, i) => {
      const cls = `syl ${interactive ? "syl-btn" : ""} syl-${idx++ % 2}`;
      const attr = interactive ? ` data-say="${esc(p)}" title="点这段单独听"` : "";
      return `${i ? '<i class="syl-dot">·</i>' : ""}<span class="${cls}"${attr}>${esc(p)}</span>`;
    }).join("");
    return `${esc(t.pre)}${inner}${esc(t.post)}`;
  }).join("");
  return `<span class="syllables">${body}</span>`;
}

// ---------- 美式 IPA 音标 ----------
// 只查离线词典，命中就给 /.../，未命中返回空串（绝不编造读音）。
export function ipaOf(text = "") {
  const toks = syllabify(String(text).trim());
  let out = "", missing = 0, found = 0;
  for (const t of toks) {
    if (t.sep) { out += t.sep; continue; }
    if (!t.core) continue;
    const key = t.core.toLowerCase();
    const stem = key.endsWith("'s") ? key.slice(0, -2) : key;
    const ipa = IPA[key] || (stem !== key && IPA[stem] ? IPA[stem] + "z" : "");
    if (ipa) { out += (found ? " " : "") + "/" + ipa + "/"; found++; }
    else missing++;
  }
  return { text: out.trim(), missing, found };
}
export const ipaText = (text = "") => ipaOf(text).text;

export function ipaHTML(text = "", { interactive = true } = {}) {
  const { text: ipa, missing } = ipaOf(text);
  if (!ipa) return `<span class="ipa-none">暂无音标 · 可直接听发音</span>`;
  const attr = interactive ? ` data-say="${esc(String(text).trim())}" title="点音标听整词"` : "";
  return `<span class="ipa ${interactive ? "ipa-btn" : ""}"${attr}>${esc(ipa)}</span>` +
    (missing ? `<span class="ipa-miss"> + ${missing} 词暂无音标</span>` : "");
}

// ---------- 逐音节跟读 ----------
// TTS 队列 + 逐段高亮；onend 不触发（部分学习机无语音引擎）时按估算时长兜底推进。
export function readSyllables(text, { onStep = null, onDone = null, rate = 0.7, gap = 220 } = {}) {
  const parts = syllabify(text).flatMap((t) => t.parts || []);
  stopSpeech();
  if (!S.settings.tts || !parts.length) { onDone?.(); return () => {}; }
  let i = 0, stopped = false, timer = null, delay = null;
  const step = () => {
    if (stopped || i >= parts.length) { if (!stopped) onDone?.(); return; }
    const at = i++;
    onStep?.(at, parts);
    let moved = false;
    const advance = () => {
      if (moved || stopped) return;
      moved = true;
      clearTimeout(timer);
      delay = setTimeout(step, gap);
    };
    const handle = utter(parts[at], { rate, pitch: 1.08, onend: advance });
    if (!handle) { advance(); return; }
    timer = setTimeout(advance, handle.wait || (handle.local ? 20000 : 700 + parts[at].length * 110));
  };
  step();
  return () => { stopped = true; clearTimeout(timer); clearTimeout(delay); stopSpeech(); };
}

export function cancelSyllables() {
  stopSpeech();
}

// 供 UI 标注：该词是词典命中还是规则推测
export function syllableSource(text = "") {
  const t = splitToken(String(text).trim().split(/\s+/)[0] || "");
  return t ? t.source : "punct";
}
