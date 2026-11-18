/* Pocket TTS 18.2M（english_18m_2026-10）在网页里用 ONNX Runtime Web 合成英文。
   权重是 Kyutai Pocket TTS 的 INT8 导出（CC BY 4.0，ken107/pocket-tts-onnx）。
   推理步骤对照 ken107/piper-browser-extension 的 pocket.ts。
   分词器是 SentencePiece Unigram，改编自 pocket-tts-js（MIT，vlapky）。
   模型放在同源的 vendor/pocket，因为 Hugging Face 的跳转不允许这个页面跨域读取。 */

const ROOT = "vendor/pocket";
const FILE_CACHE = "xiaoxiao-pocket-18m-v1";

function fileUrl(path) {
  return new URL(path, document.baseURI).href;
}
const VOICE_ID = "alba";
const MAX_FRAMES = 500;
const DECODE_FRAMES = 12;
const CHUNK_GAP_SECONDS = 0.25;
const FADE_IN_SECONDS = 0.005;
const MAX_CLIP_SECONDS = 30;
const SILENCE_THRESHOLD_DB = -40;
const KEEP_LEADING_SECONDS = 0.04;
const KEEP_TRAILING_SECONDS = 0.1;

const SPACE = "▁";
const UNK_PENALTY = 10;
const BYTE_RE = /^<0x([0-9A-Fa-f]{2})>$/;
const utf8Decoder = new TextDecoder("utf-8");
const utf8Encoder = new TextEncoder();

let ortPromise = null;
let enginePromise = null;
let fileStore = null;
const memoryFiles = new Map();
let notedDownload = false;

async function fileCache() {
  if (fileStore || !("caches" in window)) return fileStore;
  fileStore = await caches.open(FILE_CACHE);
  return fileStore;
}

async function cachedBytes(url, onStatus) {
  if (memoryFiles.has(url)) return memoryFiles.get(url);
  const pending = (async () => {
    const box = await fileCache();
    const hit = box ? await box.match(url) : null;
    if (hit) return new Uint8Array(await hit.arrayBuffer());
    if (!notedDownload) {
      notedDownload = true;
      onStatus?.("正在下载 Pocket，完成后留在本机");
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`读不到 ${url}（${response.status}）`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (box) await box.put(url, new Response(bytes.slice(), { headers: { "Content-Type": "application/octet-stream" } }));
    return bytes;
  })();
  memoryFiles.set(url, pending);
  try {
    return await pending;
  } catch (error) {
    memoryFiles.delete(url);
    throw error;
  }
}

function readVarint(bytes, pos) {
  let shift = 0;
  let result = 0;
  let i = pos;
  for (;;) {
    const b = bytes[i++];
    result += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return [result, i];
}

function parseModelProto(bytes) {
  const pieces = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0;
  while (i < bytes.length) {
    let tag;
    [tag, i] = readVarint(bytes, i);
    const field = tag >>> 3;
    const wire = tag & 7;
    if (wire === 2) {
      let len;
      [len, i] = readVarint(bytes, i);
      const end = i + len;
      if (field === 1) {
        let j = i;
        let piece = new Uint8Array(0);
        let score = 0;
        while (j < end) {
          let ptag;
          [ptag, j] = readVarint(bytes, j);
          const pf = ptag >>> 3;
          const pw = ptag & 7;
          if (pw === 2) {
            let plen;
            [plen, j] = readVarint(bytes, j);
            if (pf === 1) piece = bytes.subarray(j, j + plen);
            j += plen;
          } else if (pw === 5) {
            if (pf === 2) score = view.getFloat32(j, true);
            j += 4;
          } else if (pw === 1) j += 8;
          else if (pw === 0) [, j] = readVarint(bytes, j);
        }
        pieces.push({ piece, score });
      }
      i = end;
    } else if (wire === 0) [, i] = readVarint(bytes, i);
    else if (wire === 5) i += 4;
    else if (wire === 1) i += 8;
  }
  return pieces;
}

class SentencePieceTokenizer {
  constructor(modelBytes) {
    this.pieceToId = new Map();
    this.scores = [];
    this.byteTokenId = new Int32Array(256).fill(-1);
    this.minScore = 0;
    this.maxPieceChars = 1;
    const pieces = parseModelProto(modelBytes);
    pieces.forEach(({ piece, score }, id) => {
      const text = utf8Decoder.decode(piece);
      this.scores.push(score);
      this.pieceToId.set(text, id);
      if (score < this.minScore) this.minScore = score;
      const match = BYTE_RE.exec(text);
      if (match) this.byteTokenId[parseInt(match[1], 16)] = id;
      const count = Array.from(text).length;
      if (count > this.maxPieceChars) this.maxPieceChars = count;
    });
  }

  encodeIds(text) {
    if (!text) return [];
    const chars = Array.from(SPACE + text.replace(/ /g, SPACE));
    const n = chars.length;
    const unkScore = this.minScore - UNK_PENALTY;
    const best = new Float64Array(n + 1).fill(-Infinity);
    const backId = new Int32Array(n + 1).fill(-1);
    const backStart = new Int32Array(n + 1).fill(-1);
    best[0] = 0;
    for (let i = 0; i < n; i++) {
      if (best[i] === -Infinity) continue;
      const maxLen = Math.min(this.maxPieceChars, n - i);
      let acc = "";
      for (let len = 1; len <= maxLen; len++) {
        acc += chars[i + len - 1];
        const id = this.pieceToId.get(acc);
        if (id === undefined) continue;
        const score = best[i] + this.scores[id];
        if (score > best[i + len]) {
          best[i + len] = score;
          backId[i + len] = id;
          backStart[i + len] = i;
        }
      }
      const unknown = best[i] + unkScore;
      if (unknown > best[i + 1]) {
        best[i + 1] = unknown;
        backId[i + 1] = -1;
        backStart[i + 1] = i;
      }
    }
    const segments = [];
    for (let pos = n; pos > 0; pos = backStart[pos]) {
      segments.push({ id: backId[pos], start: backStart[pos], end: pos });
    }
    segments.reverse();
    const ids = [];
    segments.forEach((seg) => {
      if (seg.id >= 0) ids.push(seg.id);
      else {
        utf8Encoder.encode(chars.slice(seg.start, seg.end).join("")).forEach((byte) => {
          const id = this.byteTokenId[byte];
          if (id >= 0) ids.push(id);
        });
      }
    });
    return ids;
  }
}

async function loadOrt(onStatus) {
  if (!ortPromise) {
    ortPromise = (async () => {
      const jsUrl = fileUrl("./vendor/pocket/ort18/ort.wasm.min.js");
      const wasmUrl = fileUrl("./vendor/pocket/ort18/ort-wasm-simd.wasm");
      const [jsBytes, wasmBytes] = await Promise.all([cachedBytes(jsUrl, onStatus), cachedBytes(wasmUrl, onStatus)]);
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const blobUrl = URL.createObjectURL(new Blob([jsBytes], { type: "text/javascript" }));
        script.src = blobUrl;
        script.onload = () => {
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        script.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error("网页推理运行时没有加载"));
        };
        document.head.appendChild(script);
      });
      const ort = window.ort;
      if (!ort) throw new Error("网页推理运行时没有就绪");
      const wasmBlob = URL.createObjectURL(new Blob([wasmBytes], { type: "application/wasm" }));
      ort.env.wasm.simd = true;
      ort.env.wasm.proxy = false;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = { "ort-wasm-simd.wasm": wasmBlob };
      return ort;
    })().catch((error) => {
      ortPromise = null;
      throw error;
    });
  }
  return ortPromise;
}

function parseNpyFloat32(ort, bytes) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const view = new DataView(buffer);
  if (view.getUint8(0) !== 0x93) throw new Error("音色前缀不是 NPY");
  const major = view.getUint8(6);
  const headerLen = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
  const headerOffset = major === 1 ? 10 : 12;
  const header = utf8Decoder.decode(new Uint8Array(buffer, headerOffset, headerLen));
  const shape = header.match(/'shape':\s*\(([^)]*)\)/)[1].split(",").map((item) => item.trim()).filter(Boolean).map(Number);
  return new ort.Tensor("float32", new Float32Array(buffer, headerOffset + headerLen), shape);
}

function makeFilled(dtype, shape, fill) {
  const size = shape.reduce((sum, item) => sum * item, 1);
  if (dtype === "int64") return new BigInt64Array(size);
  if (dtype === "bool") return new Uint8Array(size);
  const data = new Float32Array(size);
  if (fill === "nan") data.fill(NaN);
  else if (fill === "ones") data.fill(1);
  return data;
}

function initState(ort, manifest) {
  const state = {};
  manifest.forEach((entry) => {
    state[entry.input_name] = new ort.Tensor(entry.dtype, makeFilled(entry.dtype, entry.shape, entry.fill), entry.shape);
  });
  return state;
}

function updateState(state, result, manifest) {
  manifest.forEach((entry) => {
    state[entry.input_name] = result[entry.output_name];
  });
}

function asFloat(data) {
  return data instanceof Float32Array ? data : new Float32Array(data);
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function fadeIn(audio, length) {
  const count = Math.min(length, audio.length);
  for (let i = 0; i < count; i++) audio[i] *= i / count;
}

function concat(parts) {
  const result = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function trimSilence(audio, sampleRate) {
  let peak = 0;
  for (let i = 0; i < audio.length; i++) peak = Math.max(peak, Math.abs(audio[i]));
  if (peak === 0) return audio;
  const threshold = peak * 10 ** (SILENCE_THRESHOLD_DB / 20);
  const window = Math.floor(0.01 * sampleRate);
  const loud = (start) => {
    let sum = 0;
    const end = Math.min(start + window, audio.length);
    for (let i = start; i < end; i++) sum += audio[i] * audio[i];
    return Math.sqrt(sum / (end - start)) > threshold;
  };
  let first = 0;
  while (first < audio.length && !loud(first)) first += window;
  let last = audio.length;
  while (last > first && !loud(Math.max(first, last - window))) last -= window;
  if (first >= last) return audio;
  const start = Math.max(0, first - Math.floor(KEEP_LEADING_SECONDS * sampleRate));
  const end = Math.min(audio.length, last + Math.floor(KEEP_TRAILING_SECONDS * sampleRate));
  const trimmed = audio.slice(start, end);
  const ramp = Math.min(Math.floor(0.005 * sampleRate), trimmed.length >> 1);
  for (let i = 0; i < ramp; i++) {
    if (start > 0) trimmed[i] *= i / ramp;
    if (end < audio.length) trimmed[trimmed.length - 1 - i] *= i / ramp;
  }
  return trimmed;
}

function resample(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const length = Math.max(1, Math.round(input.length * toRate / fromRate));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const x = i * fromRate / toRate;
    const i0 = Math.min(Math.floor(x), input.length - 1);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = x - i0;
    output[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return output;
}

function framePitch(samples, offset, frame, minLag, maxLag, sampleRate) {
  let mean = 0;
  for (let i = 0; i < frame; i++) mean += samples[offset + i];
  mean /= frame;
  let energy = 0;
  const buf = new Float32Array(frame);
  for (let i = 0; i < frame; i++) {
    const value = samples[offset + i] - mean;
    buf[i] = value;
    energy += value * value;
  }
  if (energy < 0.002 * frame) return 0;
  let bestLag = 0;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const limit = frame - lag;
    for (let i = 0; i < limit; i++) corr += buf[i] * buf[i + lag];
    if (corr > best) {
      best = corr;
      bestLag = lag;
    }
  }
  if (!bestLag || best / energy < 0.35) return 0;
  return sampleRate / bestLag;
}

function pickVoicedSlice(clip, sampleRate, seconds) {
  const need = Math.floor(seconds * sampleRate);
  if (clip.length <= need) return clip.subarray(0, clip.length);
  const searchRate = 8000;
  const step = Math.max(1, Math.round(sampleRate / searchRate));
  const small = new Float32Array(Math.floor(clip.length / step));
  for (let i = 0; i < small.length; i++) small[i] = clip[i * step];
  const frame = Math.floor(0.04 * searchRate);
  const hop = Math.floor(0.02 * searchRate);
  const minLag = Math.floor(searchRate / 350);
  const maxLag = Math.floor(searchRate / 70);
  const pitches = [];
  for (let start = 0; start + frame < small.length; start += hop) {
    pitches.push(framePitch(small, start, frame, minLag, maxLag, searchRate));
  }
  const voiced = pitches.filter((pitch) => pitch > 0).sort((a, b) => a - b);
  if (!voiced.length) return clip.subarray(0, need);
  const target = voiced[Math.floor(voiced.length / 2)];
  const span = Math.max(1, Math.round(seconds / (hop / searchRate)));
  let bestStart = 0;
  let bestScore = -1;
  for (let i = 0; i + span <= pitches.length; i++) {
    let score = 0;
    for (let k = 0; k < span; k++) {
      const pitch = pitches[i + k];
      if (!pitch) continue;
      const ratio = pitch > target ? pitch / target : target / pitch;
      if (ratio < 1.35) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }
  const start = Math.min(bestStart * hop * step, clip.length - need);
  return clip.subarray(start, start + need);
}

class PocketEngine {
  constructor(ort, metadata, tokenizer, sessions) {
    this.ort = ort;
    this.metadata = metadata;
    this.tokenizer = tokenizer;
    this.sessions = sessions;
    this.sampleRate = Number(metadata.sample_rate);
    this.voices = new Map();
  }

  async ensureVoice(voiceId) {
    const id = /^[a-z0-9_]+$/.test(String(voiceId || "")) ? String(voiceId) : "alba";
    const cached = this.voices.get(id);
    if (cached) return cached;
    const pending = this.encodeVoice(id).catch((error) => {
      this.voices.delete(id);
      throw error;
    });
    this.voices.set(id, pending);
    return pending;
  }

  async encodeVoice(id) {
    const bytes = await cachedBytes(fileUrl(`${ROOT}/voices/${id}.wav`));
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(bytes.slice().buffer);
    const clip = resample(decoded.getChannelData(0), decoded.sampleRate, this.sampleRate);
    audioCtx.close();
    const chosen = pickVoicedSlice(clip, this.sampleRate, 0.8);
    const frame = Number(this.metadata.samples_per_frame);
    const audio = new Float32Array(Math.ceil(chosen.length / frame) * frame);
    audio.set(chosen);
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("音色编码超时")), 20000);
    });
    const encoded = await Promise.race([
      timeout,
      this.sessions.encoder.run({
        audio: new this.ort.Tensor("float32", audio, [1, 1, audio.length]),
      }).finally(() => clearTimeout(timer)),
    ]);
    const embedding = encoded[this.sessions.encoder.outputNames[0]];
    const dim = embedding.dims[embedding.dims.length - 1];
    const frames = embedding.dims[embedding.dims.length - 2];
    const bos = this.sessions.bos;
    const bosFrames = bos.dims[1];
    const combined = new Float32Array(bos.data.length + embedding.data.length);
    combined.set(bos.data);
    combined.set(asFloat(embedding.data), bos.data.length);
    const voiceEmb = new this.ort.Tensor("float32", combined, [1, bosFrames + frames, dim]);
    const state = initState(this.ort, this.metadata.flow_lm_state_manifest);
    const empty = new this.ort.Tensor("float32", new Float32Array(0), [1, 0, Number(this.metadata.latent_dim)]);
    const primed = await this.sessions.main.run({ sequence: empty, text_embeddings: voiceEmb, ...state });
    updateState(state, primed, this.metadata.flow_lm_state_manifest);
    return state;
  }

  splitText(text) {
    const meta = this.metadata;
    const maxTokens = Number(meta.max_token_per_chunk || 50);
    let prompt = text;
    Object.entries(meta.replace_characters || {}).forEach(([from, to]) => {
      prompt = prompt.split(from).join(to);
    });
    prompt = prompt.replace(/([.!?\u2026])\s*[,;:]/g, "$1").replace(/\s+/g, " ").trim();
    if (meta.remove_semicolons) prompt = prompt.replace(/;/g, ",");
    const words = prompt.split(" ").filter(Boolean).length;
    const framesAfterEos = meta.model_recommended_frames_after_eos != null
      ? Number(meta.model_recommended_frames_after_eos)
      : (words <= 4 ? 3 : 1) + (meta.frames_after_eos_offset ?? 0);
    if (prompt && !/[A-ZÀ-Þ]/.test(prompt[0])) prompt = prompt[0].toUpperCase() + prompt.slice(1);
    if (prompt && /[0-9A-Za-zÀ-ÿ]/.test(prompt[prompt.length - 1])) prompt += ".";
    if (meta.pad_with_spaces_for_short_inputs && words < 5) prompt = ` ${prompt}`;
    const chunks = [];
    let current = "";
    const sentences = prompt.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    sentences.map((item) => item.trim()).filter(Boolean).forEach((sentence) => {
      if (this.tokenizer.encodeIds(sentence).length > maxTokens) {
        if (current) chunks.push(current);
        current = "";
        chunks.push(...this.splitLong(sentence, maxTokens));
        return;
      }
      if (!current) current = sentence;
      else if (this.tokenizer.encodeIds(`${current} ${sentence}`).length > maxTokens) {
        chunks.push(current);
        current = sentence;
      } else current = `${current} ${sentence}`;
    });
    if (current) chunks.push(current);
    return { chunks, framesAfterEos };
  }

  splitLong(sentence, maxTokens) {
    const fits = (text) => this.tokenizer.encodeIds(text).length <= maxTokens;
    const pack = (pieces, splitPiece) => {
      const result = [];
      let current = "";
      pieces.forEach((piece) => {
        const combined = current ? `${current} ${piece}` : piece;
        if (fits(combined)) current = combined;
        else {
          if (current) result.push(current);
          current = "";
          if (fits(piece)) current = piece;
          else result.push(...splitPiece(piece));
        }
      });
      if (current) result.push(current);
      return result;
    };
    const clauses = (sentence.match(/[^,;:\u2013\u2014]+[,;:\u2013\u2014]*/g) || [sentence]).map((item) => item.trim()).filter(Boolean);
    return pack(clauses, (clause) => pack(clause.split(" "), (word) => [word]));
  }

  async synthesize(text, voiceId, cancelled) {
    const baseVoice = await this.ensureVoice(voiceId);
    const { chunks, framesAfterEos } = this.splitText(text);
    const latentDim = Number(this.metadata.latent_dim);
    const emptySeq = new this.ort.Tensor("float32", new Float32Array(0), [1, 0, latentDim]);
    const emptyText = new this.ort.Tensor("float32", new Float32Array(0), [1, 0, Number(this.metadata.conditioning_dim)]);
    const std = Math.sqrt(this.metadata.default_temperature ?? 0.3);
    const eosThreshold = this.metadata.default_eos_threshold ?? -1;
    const minFrames = this.metadata.min_frames_before_eos ?? 0;
    const parts = [];
    for (const chunkText of chunks) {
      if (cancelled?.()) return new Float32Array(0);
      if (parts.length) parts.push(new Float32Array(Math.floor(CHUNK_GAP_SECONDS * this.sampleRate)));
      const flowState = { ...baseVoice };
      const mimiState = initState(this.ort, this.metadata.mimi_state_manifest);
      const tokenIds = this.tokenizer.encodeIds(chunkText);
      const tokens = new this.ort.Tensor("int64", BigInt64Array.from(tokenIds, BigInt), [1, tokenIds.length]);
      let textEmb = (await this.sessions.conditioner.run({ token_ids: tokens }))[this.sessions.conditioner.outputNames[0]];
      if (textEmb.dims.length === 2) {
        textEmb = new this.ort.Tensor("float32", asFloat(textEmb.data), [1, textEmb.dims[0], textEmb.dims[1]]);
      }
      const conditioned = await this.sessions.main.run({ sequence: emptySeq, text_embeddings: textEmb, ...flowState });
      updateState(flowState, conditioned, this.metadata.flow_lm_state_manifest);
      const latents = [];
      let decoded = 0;
      let current = new this.ort.Tensor("float32", new Float32Array(latentDim).fill(NaN), [1, 1, latentDim]);
      let eosStep = null;
      const chunk = [];
      for (let step = 0; step < MAX_FRAMES; step++) {
        if (cancelled?.()) return new Float32Array(0);
        const ar = await this.sessions.main.run({ sequence: current, text_embeddings: emptyText, ...flowState });
        const eos = asFloat(ar.eos_logit.data)[0];
        if (eos > eosThreshold && eosStep == null && step >= minFrames) eosStep = step;
        const stop = eosStep != null && step >= eosStep + framesAfterEos;
        const noise = new Float32Array(latentDim);
        for (let i = 0; i < latentDim; i++) noise[i] = gaussian() * std;
        const flowed = await this.sessions.flow.run({
          c: ar.conditioning,
          x: new this.ort.Tensor("float32", noise, [1, latentDim]),
        });
        const latent = asFloat(flowed.latent.data).slice();
        latents.push(latent);
        current = new this.ort.Tensor("float32", latent, [1, 1, latentDim]);
        updateState(flowState, ar, this.metadata.flow_lm_state_manifest);
        const pending = latents.length - decoded;
        if (pending >= DECODE_FRAMES || (stop && pending > 0)) {
          const batch = new Float32Array(pending * latentDim);
          for (let frame = 0; frame < pending; frame++) batch.set(latents[decoded + frame], frame * latentDim);
          const decodedResult = await this.sessions.decoder.run({
            latent: new this.ort.Tensor("float32", batch, [1, pending, latentDim]),
            ...mimiState,
          });
          updateState(mimiState, decodedResult, this.metadata.mimi_state_manifest);
          const pcm = asFloat(decodedResult[this.sessions.decoder.outputNames[0]].data).slice();
          if (decoded === 0) fadeIn(pcm, Math.floor(FADE_IN_SECONDS * this.sampleRate));
          chunk.push(pcm);
          decoded += pending;
        }
        if (stop) break;
      }
      parts.push(trimSilence(concat(chunk), this.sampleRate));
    }
    return concat(parts);
  }
}

async function createEngine(onStatus) {
  onStatus?.("正在打开 Pocket");
  const ort = await loadOrt(onStatus);
  const modelUrl = (name) => fileUrl(`${ROOT}/${name}`);
  const metadataBytes = await cachedBytes(modelUrl("bundle.json"), onStatus);
  const metadata = JSON.parse(utf8Decoder.decode(metadataBytes));
  const options = { executionProviders: ["wasm"], graphOptimizationLevel: "basic" };
  const [conditionerBytes, mainBytes, flowBytes, decoderBytes, encoderBytes, tokenizerBytes, bosBytes] = await Promise.all([
    cachedBytes(modelUrl("text_conditioner_int8.onnx"), onStatus),
    cachedBytes(modelUrl("flow_lm_main_int8.onnx"), onStatus),
    cachedBytes(modelUrl("flow_lm_flow_int8.onnx"), onStatus),
    cachedBytes(modelUrl("mimi_decoder_int8.onnx"), onStatus),
    cachedBytes(modelUrl("mimi_encoder_int8.onnx"), onStatus),
    cachedBytes(modelUrl("tokenizer.model"), onStatus),
    cachedBytes(modelUrl("bos_before_voice.npy"), onStatus),
  ]);
  const [conditioner, main, flow, decoder, encoder] = await Promise.all([
    ort.InferenceSession.create(conditionerBytes, options),
    ort.InferenceSession.create(mainBytes, options),
    ort.InferenceSession.create(flowBytes, options),
    ort.InferenceSession.create(decoderBytes, options),
    ort.InferenceSession.create(encoderBytes, options),
  ]);
  return new PocketEngine(ort, metadata, new SentencePieceTokenizer(tokenizerBytes), {
    conditioner, main, flow, decoder, encoder, bos: parseNpyFloat32(ort, bosBytes),
  });
}

export function preloadPocket(onStatus) {
  if (!enginePromise) {
    enginePromise = createEngine(onStatus).catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

export async function synthesizePocket(text, { voice = "female", onStatus, cancelled } = {}) {
  const engine = await preloadPocket(onStatus);
  if (cancelled?.()) return { samples: new Float32Array(0), sampleRate: engine.sampleRate };
  const samples = await engine.synthesize(text, voice, cancelled);
  return { samples, sampleRate: engine.sampleRate };
}
