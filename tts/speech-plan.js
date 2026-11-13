/* Pure speech planning: voice choice, sentence chunks, cache checks, PCM stats.
 * No DOM, no network, no AudioContext. */
import { MODEL_SPEC } from "./model-spec.js";

const HAN = (code) => (code >= 0x4e00 && code <= 0x9fa5) || (code >= 0x3400 && code <= 0x4dbf);

export function containsChinese(text) {
  const source = String(text ?? "");
  for (const char of source) {
    if (HAN(char.codePointAt(0))) return true;
  }
  return false;
}

/** English with no Han characters uses Phonon (af_maple). Any Han character uses zf_001.
 * An explicit zh language tag wins even when the sentence is mostly Latin. */
export function voiceForText(text, lang = "") {
  const tag = String(lang || "").toLowerCase();
  if (tag.startsWith("zh")) return MODEL_SPEC.voices.zh;
  if (containsChinese(text)) return MODEL_SPEC.voices.zh;
  if (/[A-Za-z]/.test(String(text ?? ""))) return MODEL_SPEC.voices.en;
  return MODEL_SPEC.voices.zh;
}

export function clampSpeed(rate) {
  const speed = Number(rate);
  if (!Number.isFinite(speed) || speed <= 0) return 1;
  return Math.min(2, Math.max(0.5, speed));
}

const ABBREV = new Set(["mr", "mrs", "ms", "dr", "st", "vs", "etc"]);

function isDigit(ch) {
  return (ch >= "0" && ch <= "9") || (ch >= "０" && ch <= "９");
}

export function splitSentences(text) {
  const chars = Array.from(String(text ?? ""));
  const sentences = [];
  let buf = "";
  const push = () => {
    const piece = buf.trim();
    if (piece) sentences.push(piece);
    buf = "";
  };
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    buf += ch;
    if (ch === "\n" || ch === "。" || ch === "！" || ch === "？" || ch === "!" || ch === "?") {
      push();
      continue;
    }
    if (ch !== "." && ch !== "…") continue;
    if (ch === ".") {
      const prev = chars[i - 1] || "";
      const next = chars[i + 1] || "";
      if (isDigit(prev) && isDigit(next)) continue;
      if (/[A-Za-z]/.test(prev)) {
        let k = i - 1;
        while (k >= 0 && /[A-Za-z]/.test(chars[k])) k -= 1;
        const word = chars.slice(k + 1, i).join("").toLowerCase();
        if (ABBREV.has(word)) continue;
      }
    }
    push();
  }
  if (buf.trim()) sentences.push(buf.trim());
  return sentences;
}

function splitLong(sentence, limit) {
  const chars = Array.from(sentence);
  if (chars.length <= limit) return sentence.trim() ? [sentence.trim()] : [];
  const out = [];
  let start = 0;
  while (start < chars.length) {
    if (chars.length - start <= limit) {
      const tail = chars.slice(start).join("").trim();
      if (tail) out.push(tail);
      break;
    }
    let cut = -1;
    const end = Math.min(chars.length - 1, start + limit);
    for (let i = end; i > start + 12; i--) {
      if (" \u3000，,、；;：:".includes(chars[i])) { cut = i + 1; break; }
    }
    if (cut < 0) cut = Math.min(chars.length, start + limit);
    if (cut <= start) cut = Math.min(chars.length, start + 1);
    const piece = chars.slice(start, cut).join("").trim();
    if (piece) out.push(piece);
    start = cut;
    while (start < chars.length && (chars[start] === " " || chars[start] === "\u3000")) start += 1;
  }
  return out;
}

/** First chunk stays short so playback can start before the rest is synthesized. */
export function splitSpeakChunks(text, options = {}) {
  const source = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!source) return [];
  const firstLimit = Math.max(40, Number(options.firstLimit) || 80);
  const groupLimit = Math.max(firstLimit, Number(options.groupLimit) || 160);
  const pieces = [];
  for (const sentence of splitSentences(source)) {
    const limit = pieces.length === 0 ? firstLimit : groupLimit;
    pieces.push(...splitLong(sentence, limit));
  }
  return pieces;
}

export function recordIsValid(record, spec = MODEL_SPEC) {
  if (!record || !spec) return false;
  if (record.version !== spec.version) return false;
  if (record.bytes !== spec.bytes) return false;
  if (!spec.sha256 || record.sha256 !== spec.sha256) return false;
  if (!record.blob || record.blob.size !== spec.bytes) return false;
  return true;
}

/** A localStorage flag never counts as a cached model. */
export function silentInitAllowed(marker, record, spec = MODEL_SPEC) {
  void marker;
  return recordIsValid(record, spec);
}

export function pcmStats(samples) {
  const data = samples || [];
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const value = Number(data[i]) || 0;
    const abs = value < 0 ? -value : value;
    if (abs > peak) peak = abs;
    sum += value * value;
  }
  const rms = data.length ? Math.sqrt(sum / data.length) : 0;
  return {
    length: data.length,
    peak,
    rms,
    audible: data.length > 100 && peak > 0.01 && rms > 0.001
  };
}
