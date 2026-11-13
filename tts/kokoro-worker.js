/* KidsReading Phonon worker.
 * Adapted from zhidao-web public/tts/kokoro-worker.js.
 * Tokenizer, phonemizer, ONNX init and synthesis stay off the page thread.
 * PCM goes back as a transferable Float32Array.
 * Same-origin files only: a cross-origin fetch is rejected, not silently redirected. */
'use strict';

if (typeof self.window === 'undefined') self.window = self;

const ENGINE_URL = new URL('./kokoro-tts.js?v=20261113phonon', import.meta.url);
const RUNTIME_CACHE = 'kidsreading-phonon-runtime-v1';
const BIG_FILE = 32 * 1024 * 1024;

let modelFetches = 0;
let modelBlob = null;
const onnxLoads = new Map();
let enginePromise = null;
let loadPromise = null;
let queue = null;
let statusTimer = null;
let pendingStatus = null;
const nativeFetch = self.fetch.bind(self);

function urlOf(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return String(input || '');
}

function parsedUrl(url) {
  return new URL(url, self.location.href);
}

function isCrossOrigin(url) {
  try {
    const parsed = parsedUrl(url);
    if (parsed.protocol === 'blob:' || parsed.protocol === 'data:') return false;
    return parsed.origin !== self.location.origin;
  } catch {
    return true;
  }
}

function isOnnx(url) {
  return /\.onnx(?:$|[?#])/.test(url);
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function flushStatus() {
  if (!pendingStatus) return;
  const body = pendingStatus;
  pendingStatus = null;
  self.postMessage({ type: 'status', snapshot: body });
}

function postStatus(snapshot, force) {
  if (!snapshot) return;
  pendingStatus = { ...snapshot, modelFetches, fromCache: Boolean(modelBlob && modelFetches === 0) };
  if (force) {
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    flushStatus();
    return;
  }
  if (statusTimer) return;
  statusTimer = setTimeout(() => {
    statusTimer = null;
    flushStatus();
  }, 100);
}

self.fetch = async (input, init) => {
  const url = urlOf(input);
  if (isCrossOrigin(url)) {
    throw new Error('离线语音只读取本站文件，已拒绝外部地址');
  }
  if (isOnnx(url)) {
    const headersFor = (blob) => ({
      'content-type': 'application/octet-stream',
      'content-length': String(blob.size)
    });
    if (modelBlob) return new Response(modelBlob, { status: 200, headers: headersFor(modelBlob) });
    const key = parsedUrl(url).pathname;
    const existing = onnxLoads.get(key);
    if (existing) {
      const blob = await existing;
      return new Response(blob, { status: 200, headers: headersFor(blob) });
    }
    modelFetches += 1;
    let resolveBlob;
    let rejectBlob;
    const blobPromise = new Promise((resolve, reject) => { resolveBlob = resolve; rejectBlob = reject; });
    onnxLoads.set(key, blobPromise);
    try {
      const response = await nativeFetch(input, init);
      if (!response.ok || !response.body) throw new Error('语音模型请求失败 ' + response.status);
      const copies = response.body.tee();
      new Response(copies[1]).blob().then(async (blob) => {
        try {
          const buffer = await blob.arrayBuffer();
          const sha256 = hex(await crypto.subtle.digest('SHA-256', buffer));
          self.postMessage({
            type: 'model-downloaded',
            bytes: buffer.byteLength,
            sha256,
            buffer
          }, [buffer]);
        } catch { /* cache store is best-effort; synthesis can still use this copy */ }
        resolveBlob(blob);
      }, (error) => {
        onnxLoads.delete(key);
        rejectBlob(error);
      });
      return new Response(copies[0], { status: response.status, headers: response.headers });
    } catch (error) {
      onnxLoads.delete(key);
      rejectBlob(error);
      throw error;
    }
  }

  const path = parsedUrl(url).pathname;
  if (path.startsWith('/tts/') && typeof caches !== 'undefined') {
    const cache = await caches.open(RUNTIME_CACHE);
    const key = new Request(parsedUrl(url).origin + path);
    const hit = await cache.match(key);
    if (hit) return hit;
    const response = await nativeFetch(input, init);
    const length = Number(response.headers.get('content-length') || 0);
    if (response.ok && length > 0 && length <= BIG_FILE) {
      cache.put(key, response.clone()).catch(() => {});
    }
    return response;
  }
  return nativeFetch(input, init);
};

function getEngine() {
  if (!enginePromise) {
    enginePromise = import(ENGINE_URL).then((mod) => {
      const engine = (mod && (mod.default || mod)) || null;
      if (!engine || typeof engine.synthesize !== 'function' || typeof engine.load !== 'function') {
        throw new Error('离线语音引擎加载失败');
      }
      if (typeof engine.onChange === 'function') {
        engine.onChange((snapshot) => postStatus(snapshot, snapshot && (snapshot.ready || snapshot.stage === 'failed' || snapshot.error)));
      }
      return engine;
    }).catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function loadModel() {
  if (!loadPromise) {
    loadPromise = (async () => {
      const engine = await getEngine();
      await engine.load();
      postStatus(typeof engine.status === 'function' ? engine.status() : { ready: true, stage: 'ready' }, true);
      return engine;
    })().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

function toTransferable(samples) {
  if (!samples || !samples.length) throw new Error('合成结果为空');
  const out = new Float32Array(samples.length);
  out.set(samples);
  return out;
}

async function ensureQueue() {
  if (queue) return queue;
  const mod = await import('./synth-queue.mjs');
  queue = mod.createSynthQueue(async (job) => {
    const engine = await loadModel();
    const audio = await engine.synthesize(job.text, { voice: job.voice, speed: job.speed });
    const samples = toTransferable(audio && audio.samples);
    return {
      sampleRate: Number(audio && audio.sampleRate) || 24000,
      duration: Number(audio && audio.duration) || samples.length / 24000,
      samples
    };
  });
  return queue;
}

function fail(requestId, error) {
  self.postMessage({
    type: 'error',
    requestId: requestId || 0,
    message: String((error && error.message) || error || '语音线程故障')
  });
}

self.onmessage = (event) => {
  const msg = event.data || {};
  if (msg.type === 'use-model') {
    modelBlob = msg.blob || null;
    self.postMessage({ type: 'model-ready', requestId: msg.requestId, bytes: modelBlob ? modelBlob.size : 0 });
    return;
  }
  if (msg.type === 'load') {
    loadModel()
      .then((engine) => {
        self.postMessage({
          type: 'loaded',
          requestId: msg.requestId,
          snapshot: typeof engine.status === 'function' ? engine.status() : { ready: true, stage: 'ready' }
        });
      })
      .catch((error) => fail(msg.requestId, error));
    return;
  }
  if (msg.type === 'synthesize') {
    ensureQueue()
      .then((q) => {
        q.enqueue({
          requestId: msg.requestId,
          text: msg.text,
          voice: msg.voice,
          speed: msg.speed,
          onResult: (result) => {
            self.postMessage({
              type: 'audio',
              requestId: msg.requestId,
              sampleRate: result.sampleRate,
              duration: result.duration,
              samples: result.samples
            }, [result.samples.buffer]);
          },
          onError: (error) => fail(msg.requestId, error),
          onCancel: () => self.postMessage({ type: 'cancelled', requestId: msg.requestId })
        });
      })
      .catch((error) => fail(msg.requestId, error));
    return;
  }
  if (msg.type === 'cancel') {
    if (queue) queue.cancel(msg.ids || []);
  }
};

self.addEventListener('unhandledrejection', (event) => {
  fail(0, event.reason);
});
