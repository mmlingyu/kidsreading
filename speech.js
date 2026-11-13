/* Unified reading voice for KidsReading.
 * Normal path: offline Kokoro Phonon (af_maple) for English and zf_001 for Chinese.
 * The ONNX model runs in a worker. This thread only schedules PCM on the same
 * Web Audio context as the music. There is no pause control: AudioBufferSource
 * can stop, and stop is what cancel uses. Pitch is not applied offline.
 * Browser speech is used only after a visible failure, never as a silent stand-in. */
import { sound } from "./audio.js";
import { MODEL_SPEC } from "./tts/model-spec.js";
import { clampSpeed, pcmStats, splitSpeakChunks, voiceForText } from "./tts/speech-plan.js";
import { deleteModel, readValidModel, storeModel } from "./tts/model-cache.js";

let clientPromise = null;
let enginePromise = null;
let generation = 0;
let chain = Promise.resolve();
let cursor = 0;
let usingBrowser = false;
let banner = null;
let warmed = false;
const liveSources = new Set();
const aborters = new Set();

function notify(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kidsreading-speech", { detail }));
}

function unlockSpeech() {
  try { sound.unlock(); } catch { /* the gesture still counts for a later resume */ }
  const ctx = sound.playbackContext?.() || null;
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function stopLive() {
  for (const source of liveSources) {
    try { source.onended = null; } catch { /* noop */ }
    try { source.stop(); } catch { /* already stopped */ }
    try { source.disconnect(); } catch { /* noop */ }
  }
  liveSources.clear();
  cursor = 0;
}

export function cancelSpeech() {
  generation += 1;
  chain = Promise.resolve();
  for (const abort of aborters) {
    try { abort(); } catch { /* listener */ }
  }
  aborters.clear();
  stopLive();
  clientPromise?.then((client) => client.cancelSynthesize()).catch(() => {});
  try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = import("./tts/offline-client.js").then((mod) => {
      const client = mod.default || mod;
      client.onModelDownloaded(async (msg) => {
        try {
          await storeModel(msg.buffer, msg.sha256);
          paint({ stage: "cached", error: "" });
        } catch (error) {
          const mismatch = error && error.name === "ModelMismatch";
          paint({
            stage: "failed",
            error: mismatch
              ? "下载到的语音模型和清单不一致，没有写入缓存。"
              : "这次能合成，但浏览器没有把约 324 MB 的模型存下来，下次可能还要下载。"
          });
        }
      });
      client.onChange((snap) => {
        if (snap) paint(snap);
      });
      return client;
    });
  }
  return clientPromise;
}

async function ensureEngine(silent) {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const record = await readValidModel();
    const cached = Boolean(record);
    if (!silent || !cached) paint({ stage: cached ? "initializing" : "starting", loaded: 0, total: MODEL_SPEC.bytes, progress: cached ? 100 : 0, error: "" });
    const client = await getClient();
    if (record) await client.useCachedModel(record.blob);
    await client.load();
    usingBrowser = false;
    if (cached || silent) hideBanner();
    return client;
  })().catch((error) => {
    enginePromise = null;
    throw error;
  });
  return enginePromise;
}

function ensureBanner() {
  if (banner || typeof document === "undefined" || !document.body) return banner;
  banner = document.createElement("aside");
  banner.className = "phonon-banner";
  banner.hidden = true;
  banner.setAttribute("role", "status");
  banner.innerHTML = '<div class="phonon-banner-copy"><strong class="phonon-banner-title"></strong><p class="phonon-banner-detail"></p><progress max="100"></progress></div><button type="button" class="phonon-banner-retry">重试离线语音</button>';
  banner.querySelector(".phonon-banner-retry").onclick = () => { retrySpeech(); };
  document.body.appendChild(banner);
  return banner;
}

function hideBanner() {
  if (!banner) return;
  banner.hidden = true;
  banner.classList.remove("is-error");
}

function paint(snap) {
  const panel = ensureBanner();
  if (!panel || !snap) return;
  const failed = snap.stage === "failed" || Boolean(snap.error);
  const downloading = !failed && (snap.stage === "downloading" || snap.stage === "starting" || snap.stage === "initializing");
  if (!failed && !downloading) {
    if (!usingBrowser) hideBanner();
    return;
  }
  panel.hidden = false;
  panel.classList.toggle("is-error", failed);
  panel.dataset.stage = snap.stage || "";
  const title = panel.querySelector(".phonon-banner-title");
  const detail = panel.querySelector(".phonon-banner-detail");
  const progress = panel.querySelector("progress");
  const retry = panel.querySelector(".phonon-banner-retry");
  retry.hidden = !failed;
  if (failed) {
    title.textContent = usingBrowser
      ? "离线 Phonon 不可用，这次改用浏览器语音。"
      : "离线 Phonon 没有准备好。";
    detail.textContent = snap.error || "请重试。浏览器语音只会在这里标明之后使用。";
    progress.hidden = true;
    return;
  }
  const total = Number(snap.total) || 0;
  const loaded = Number(snap.loaded) || 0;
  const preparing = snap.stage === "initializing" || snap.stage === "starting";
  title.textContent = preparing && !total
    ? "正在准备离线 Phonon 语音…"
    : `正在下载离线 Phonon（af_maple），首次 ${MODEL_SPEC.firstDownloadLabel}`;
  if (total > 0) {
    const pct = Math.max(0, Math.min(100, Number(snap.progress) || (loaded / total * 100)));
    detail.textContent = `已下载 ${(loaded / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB。下载保存在本机，下次不必再下。`;
    progress.hidden = false;
    progress.value = pct;
  } else {
    detail.textContent = "首次大约 324 MB。英文用 Phonon / af_maple，中文用 zf_001。";
    progress.hidden = false;
    progress.removeAttribute("value");
  }
}

function playBuffer(ctx, audio, gen) {
  const samples = audio.samples;
  const sampleRate = Number(audio.sampleRate) || 24000;
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  const when = Math.max(ctx.currentTime + 0.05, cursor || 0);
  source.start(when);
  const duration = samples.length / sampleRate;
  cursor = when + duration;
  liveSources.add(source);
  source.addEventListener("ended", () => liveSources.delete(source));
  sound.duck(Math.ceil(duration * 1000) + 500);
  notify({
    type: "started",
    engine: "phonon",
    voice: audio.voice,
    sampleRate,
    duration,
    peak: audio.stats.peak,
    rms: audio.stats.rms,
    audible: audio.stats.audible,
    generation: gen
  });
  return { source, duration };
}

function browserSpeak(text, opts, gen) {
  const synth = window.speechSynthesis;
  const Utter = window.SpeechSynthesisUtterance;
  if (!synth || !Utter) {
    paint({ stage: "failed", error: "这个浏览器不能离线合成，也没有浏览器语音。" });
    return Promise.resolve(false);
  }
  usingBrowser = true;
  paint({ stage: "failed", error: opts.failure || "离线 Phonon 失败，这次改用浏览器语音。" });
  notify({ type: "started", engine: "browser", voice: "", generation: gen });
  return new Promise((resolve) => {
    if (gen !== generation) { resolve(false); return; }
    const utter = new Utter(String(text));
    utter.lang = opts.lang || "en-US";
    utter.rate = clampSpeed(opts.rate);
    if (opts.pitch) utter.pitch = opts.pitch;
    const finish = (ok) => {
      if (gen === generation && ok) opts.onend?.();
      resolve(ok);
    };
    utter.onend = () => finish(true);
    utter.onerror = () => finish(false);
    try { synth.speak(utter); }
    catch { finish(false); }
  });
}

async function speakNow(text, opts, gen) {
  let settled = false;
  let settle;
  const gate = new Promise((resolve) => { settle = resolve; });
  const finish = (why) => {
    if (settled) return;
    settled = true;
    settle(why);
  };
  const abort = () => finish("cancel");
  aborters.add(abort);
  let remaining = 0;
  try {
    if (gen !== generation) return false;
    const chunks = splitSpeakChunks(text);
    if (!chunks.length) return false;
    const voice = voiceForText(text, opts.lang);
    const speed = clampSpeed(opts.rate ?? opts.speed);
    let client;
    try {
      client = await ensureEngine(false);
    } catch (error) {
      if (gen !== generation) return false;
      return browserSpeak(text, { ...opts, failure: String((error && error.message) || error) }, gen);
    }
    if (gen !== generation) return false;
    const ctx = unlockSpeech();
    if (!ctx) return browserSpeak(text, { ...opts, failure: "无法打开 Web Audio，这次改用浏览器语音。" }, gen);
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch { /* autoplay may reject outside a gesture */ }
    }
    let played = false;
    for (const chunk of chunks) {
      if (gen !== generation) return false;
      let audio;
      try {
        audio = await client.synthesize(chunk, { voice, speed });
      } catch (error) {
        if (gen !== generation || error?.name === "AbortError") return false;
        if (!played) return browserSpeak(text, { ...opts, failure: String(error.message || error) }, gen);
        paint({ stage: "failed", error: String(error.message || error) });
        break;
      }
      if (gen !== generation) return false;
      const stats = pcmStats(audio.samples);
      if (!stats.audible) {
        if (!played) return browserSpeak(text, { ...opts, failure: "离线合成结果是静音，这次改用浏览器语音。" }, gen);
        break;
      }
      remaining += 1;
      const playedNode = playBuffer(ctx, { ...audio, stats, voice }, gen);
      played = true;
      playedNode.source.onended = () => {
        remaining -= 1;
        if (remaining === 0) finish("end");
      };
    }
    if (!played) return false;
    if (remaining === 0) finish("end");
    const why = await gate;
    if (why !== "end" || gen !== generation) return false;
    opts.onend?.();
    notify({ type: "ended", engine: "phonon", generation: gen });
    return true;
  } finally {
    aborters.delete(abort);
  }
}

export function queueSpeech(text, opts = {}) {
  const gen = generation;
  const job = chain.then(() => speakNow(String(text ?? ""), opts, gen));
  chain = job.catch(() => false);
  return job;
}

export function startSpeech(text, rate = 0.92) {
  unlockSpeech();
  cancelSpeech();
  return queueSpeech(text, { rate });
}

export function speechStatus() {
  return { generation, usingBrowser, engine: usingBrowser ? "browser" : "phonon" };
}

export async function retrySpeech() {
  usingBrowser = false;
  enginePromise = null;
  try {
    const client = await getClient();
    client.reset();
  } catch { /* a new client is created on the next attempt */ }
  clientPromise = null;
  try {
    await ensureEngine(false);
    hideBanner();
    usingBrowser = false;
  } catch (error) {
    paint({ stage: "failed", error: String((error && error.message) || error) });
  }
}

export async function clearSpeechCache() {
  enginePromise = null;
  try {
    const client = clientPromise ? await clientPromise : null;
    client?.reset();
  } catch { /* noop */ }
  clientPromise = null;
  await deleteModel();
}

function scheduleWarmup() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  const run = () => {
    readValidModel().then((record) => {
      if (record) ensureEngine(true).catch(() => {});
    }).catch(() => {});
  };
  const idle = () => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 2000 });
    else window.setTimeout(run, 800);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", idle, { once: true });
  else idle();
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => { unlockSpeech(); }, { capture: true });
  scheduleWarmup();
}

export { unlockSpeech };
