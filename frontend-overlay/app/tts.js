/* 英文朗读：Phonon 本机 API、Pocket 本机/网页 WASM，另有浏览器语音。
   中文始终走浏览器语音。统一 Pocket API 见 8800；Phonon 本机见 8790。 */

import { synthesizePocket } from "./pocket.js?v=16";

function titleCaseId(id) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pocket 音色：官方未标性别，按常用人名归类，仅供筛选。 */
const POCKET_GENDER = {
  alba: "female", anna: "female", azelma: "female", caro_davy: "female", cosette: "female",
  eponine: "female", estelle: "female", eve: "female", fantine: "female", jane: "female",
  lola: "female", mary: "female", vera: "female",
  bill_boerst: "male", charles: "male", daan: "male", george: "male", giovanni: "male",
  javert: "male", jean: "male", juergen: "male", marius: "male", michael: "male",
  paul: "male", peter_yearsley: "male", rafael: "male", stuart_bell: "male",
};

function pocketVoice(id) {
  return { id, name: titleCaseId(id), gender: POCKET_GENDER[id] || "unknown" };
}

export const pocketVoicesApi = [
  "alba", "anna", "azelma", "bill_boerst", "caro_davy", "charles", "cosette", "daan",
  "eponine", "estelle", "eve", "fantine", "george", "giovanni", "jane", "javert", "jean",
  "juergen", "lola", "marius", "mary", "michael", "paul", "peter_yearsley", "rafael",
  "stuart_bell", "vera",
].map(pocketVoice);

export const pocketVoicesWasm = [
  "alba", "anna", "azelma", "bill_boerst", "caro_davy", "charles", "eponine", "eve",
  "fantine", "george", "jane", "javert", "marius", "mary", "michael", "paul",
  "peter_yearsley", "stuart_bell", "vera",
].map(pocketVoice);

/** @deprecated 兼容旧 import */
export const pocketVoices = pocketVoicesApi;

/** Phonon 音色性别来自 gradium/phonon-voices。 */
export const phononVoices = [
  { id: "default", name: "default", gender: "unknown" },
  { id: "NbpkqMVS3CJeq2j8", name: "Zoey", gender: "female" },
  { id: "NIWIOv5vTi5eRMj8", name: "Juniper", gender: "female" },
  { id: "vjFyp2BcCyTlUmYb", name: "Everly", gender: "female" },
  { id: "4SZHfMpw-p46Ywgs", name: "Harper", gender: "female" },
  { id: "bXwrkHhURL1VFJdG", name: "Hadley", gender: "female" },
  { id: "nGzMHMPAWGaJFHOo", name: "Delia", gender: "female" },
  { id: "6PWnV0Nq4wu7RVBT", name: "Maeve", gender: "female" },
  { id: "GgfEkEJtxZR7gnpy", name: "Freya", gender: "female" },
  { id: "uem82D50GRv2Dwma", name: "Pippa", gender: "female" },
  { id: "y9bQqIDnyxwqK01t", name: "Elodie-Rose", gender: "female" },
  { id: "gDT1nz7Ie36ZhL-C", name: "Imogen", gender: "female" },
  { id: "m9MxpY6IUGXtWp76", name: "Lottie", gender: "female" },
  { id: "gfP44RlHwr2kEwk7", name: "Bryony", gender: "female" },
  { id: "LMDIYE0Oa377Qh6Z", name: "Easton", gender: "male" },
  { id: "40QrMVgAxFiUnP9f", name: "Micah", gender: "male" },
  { id: "0zLApsZfVLLNaEGl", name: "Trevor", gender: "male" },
  { id: "_6Aslh2DxfmnRLmP", name: "Russell", gender: "male" },
  { id: "qIxlZ7Ei8KvWlyQH", name: "Preston", gender: "male" },
  { id: "d9XCyhjo4JhkHF1d", name: "Miles", gender: "male" },
  { id: "X6NceqF285Gr04gb", name: "Alfie", gender: "male" },
  { id: "YyKcxPG7iIgS3jsK", name: "Hugh", gender: "male" },
  { id: "zUCxzrOrugTSis03", name: "Edwin", gender: "male" },
  { id: "JOW0vchyswkQUMDS", name: "Spencer", gender: "male" },
  { id: "dME3IWyZBvmh1n1q", name: "Toby", gender: "male" },
  { id: "Zn7g6NxLqXlJb7Qi", name: "Teddy", gender: "male" },
];

export const ttsEngines = [
  { id: "phonon-api", label: "Phonon 本机 API" },
  { id: "browser", label: "浏览器语音" },
];

export function migrateEngine(engine) {
  if (engine === "phonon" || engine === "phonon-wasm") return "phonon-api";
  if (String(engine).startsWith("pocket")) return "browser";
  return engine;
}

export const ttsConfig = {
  english: {
    engine: "phonon-api",
    phononUrl: "http://127.0.0.1:8790/api/tts",
    pocketUrl: "http://127.0.0.1:8800/api/tts",
    phononVoice: "default",
    pocketVoice: "alba",
    langs: ["en"],
  },
};

export function setEnglishEngine(engine) {
  const id = migrateEngine(engine);
  if (ttsEngines.some((item) => item.id === id)) ttsConfig.english.engine = id;
}

export function setPhononVoice(id) {
  if (phononVoices.some((item) => item.id === id)) ttsConfig.english.phononVoice = id;
}

export function setPocketVoice(id) {
  if (pocketVoicesApi.some((item) => item.id === id)) ttsConfig.english.pocketVoice = id;
}

export function englishEngine() {
  return ttsConfig.english.engine;
}

export function voicesForEngine(engine) {
  const id = migrateEngine(engine);
  if (id === "phonon-api") return phononVoices;
  if (id === "pocket-api") return pocketVoicesApi;
  if (id === "pocket-wasm") return pocketVoicesWasm;
  return [];
}

export function engineFamily(engine) {
  const id = migrateEngine(engine);
  if (id.startsWith("phonon")) return "phonon";
  if (id.startsWith("pocket")) return "pocket";
  return "browser";
}

export function defaultVoiceForEngine(engine) {
  return engineFamily(engine) === "phonon" ? "default" : "alba";
}

export function voiceLabel(item) {
  if (!item) return "";
  if (item.gender === "female") return `女 · ${item.name}`;
  if (item.gender === "male") return `男 · ${item.name}`;
  return item.name;
}

let onStatus = () => {};
export function setTtsStatus(fn) {
  onStatus = typeof fn === "function" ? fn : () => {};
}

let generation = 0;
let tail = Promise.resolve();
let audio = null;
let audioCtx = null;
let pcmNode = null;
let objectUrl = "";
let finishCurrent = null;
let warned = false;

export function stopSpeaking() {
  generation += 1;
  tail = Promise.resolve();
  const finish = finishCurrent;
  finishCurrent = null;
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = "";
    audio = null;
  }
  if (pcmNode) {
    try { pcmNode.stop(); } catch {}
    pcmNode = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = "";
  }
  try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch {}
  if (finish) finish();
}

function usesLocal(lang) {
  const code = String(lang || "en-US").toLowerCase();
  return ttsConfig.english.langs.some((prefix) => code === prefix || code.startsWith(`${prefix}-`));
}

function pickVoice(lang) {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const wanted = lang.toLowerCase();
    const prefix = wanted.slice(0, 2);
    return voices.find((item) => item.lang && item.lang.toLowerCase().replace("_", "-") === wanted)
      || voices.find((item) => item.lang && item.lang.toLowerCase().startsWith(prefix))
      || null;
  } catch {
    return null;
  }
}

function playBrowser(text, options, ticket) {
  return new Promise((resolve) => {
    if (ticket !== generation || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang;
    utterance.rate = options.rate;
    utterance.pitch = options.pitch;
    const voice = pickVoice(options.lang);
    if (voice) utterance.voice = voice;
    let settled = false;
    const done = (notify) => {
      if (settled) return;
      settled = true;
      if (notify && ticket === generation && options.onend) options.onend();
      resolve();
    };
    utterance.onend = () => done(true);
    utterance.onerror = () => done(false);
    finishCurrent = () => done(false);
    try { window.speechSynthesis.speak(utterance); } catch { done(false); }
  });
}

function ensureAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playPcm(samples, sampleRate, options, ticket) {
  return new Promise((resolve) => {
    if (ticket !== generation || !samples || !samples.length) {
      resolve();
      return;
    }
    const ctx = ensureAudio();
    if (!ctx) {
      resolve();
      return;
    }
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    pcmNode = source;
    let settled = false;
    const done = (notify) => {
      if (settled) return;
      settled = true;
      finishCurrent = null;
      if (pcmNode === source) pcmNode = null;
      if (notify && ticket === generation && options.onend) options.onend();
      resolve();
    };
    source.onended = () => done(true);
    finishCurrent = () => {
      try { source.stop(); } catch {}
      done(false);
    };
    source.start();
  });
}

function playBlob(blob, options, ticket) {
  return new Promise((resolve) => {
    if (ticket !== generation) {
      resolve();
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    audio = new Audio(objectUrl);
    let settled = false;
    const done = (notify) => {
      if (settled) return;
      settled = true;
      finishCurrent = null;
      if (notify && ticket === generation && options.onend) options.onend();
      resolve();
    };
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    finishCurrent = () => done(false);
    audio.play().catch(() => done(false));
  });
}

async function readWavOrError(response) {
  const type = response.headers.get("Content-Type") || "";
  if (!response.ok || !type.startsWith("audio/wav")) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.error || data.code || message;
    } catch {}
    throw new Error(message || "本地朗读失败");
  }
  return response.blob();
}

async function playPhononApi(text, options, ticket) {
  const response = await fetch(ttsConfig.english.phononUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: ttsConfig.english.phononVoice || "default" }),
  });
  if (ticket !== generation) return;
  if (response.status === 429 && options.retry !== false) {
    const wait = Number(response.headers.get("Retry-After") || 2) * 1000;
    await new Promise((resolve) => setTimeout(resolve, Number.isFinite(wait) ? wait : 2000));
    if (ticket !== generation) return;
    return playPhononApi(text, { ...options, retry: false }, ticket);
  }
  const blob = await readWavOrError(response);
  if (ticket !== generation) return;
  await playBlob(blob, options, ticket);
}

async function playPocketApi(text, options, ticket) {
  const response = await fetch(ttsConfig.english.pocketUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      engine: "pocket",
      text,
      language: "en",
      voice: ttsConfig.english.pocketVoice || "alba",
    }),
  });
  if (ticket !== generation) return;
  if (response.status === 429 && options.retry !== false) {
    const wait = Number(response.headers.get("Retry-After") || 2) * 1000;
    await new Promise((resolve) => setTimeout(resolve, Number.isFinite(wait) ? wait : 2000));
    if (ticket !== generation) return;
    return playPocketApi(text, { ...options, retry: false }, ticket);
  }
  const blob = await readWavOrError(response);
  if (ticket !== generation) return;
  await playBlob(blob, options, ticket);
}

async function playPocketWasm(text, options, ticket) {
  ensureAudio();
  const voice = ttsConfig.english.pocketVoice || "alba";
  if (!pocketVoicesWasm.some((item) => item.id === voice)) {
    throw new Error("这个 Pocket 音色只支持本机 API");
  }
  const clip = await synthesizePocket(text, {
    voice,
    onStatus,
    cancelled: () => ticket !== generation,
  });
  if (ticket !== generation) return;
  await playPcm(clip.samples, clip.sampleRate, options, ticket);
}

function run(text, options, ticket) {
  if (ticket !== generation) return Promise.resolve();
  const engine = ttsConfig.english.engine;
  if (!usesLocal(options.lang) || engine === "browser") return playBrowser(text, options, ticket);
  const play = {
    "phonon-api": playPhononApi,
    "pocket-api": playPocketApi,
    "pocket-wasm": playPocketWasm,
  }[engine] || playPhononApi;
  return play(text, options, ticket).catch((error) => {
    if (ticket !== generation) return;
    if (!warned) {
      warned = true;
      console.warn("本地朗读不可用，英文改用浏览器语音。", error);
    }
    onStatus(error && error.message ? error.message : "本地朗读失败");
    return playBrowser(text, options, ticket);
  });
}

export function speakClip(text, { lang = "en-US", rate = 0.92, pitch = 1.05, onend = null } = {}) {
  const clean = String(text ?? "").replace(/["“”']/g, "").trim();
  if (!clean) return null;
  const ticket = generation;
  const options = { lang, rate, pitch, onend };
  const engine = ttsConfig.english.engine;
  if (usesLocal(lang) && engine === "pocket-wasm") ensureAudio();
  tail = tail.then(() => run(clean, options, ticket), () => run(clean, options, ticket));
  const wasm = usesLocal(lang) && engine === "pocket-wasm";
  return { local: usesLocal(lang) && engine !== "browser", wait: wasm ? 120000 : 0 };
}
