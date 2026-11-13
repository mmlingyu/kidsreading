/* Main-thread facade for offline Phonon.
 * Adapted from zhidao-web public/tts/offline-client.js.
 * Synthesis stays in the worker. If the worker cannot start, this module
 * refuses to import the ONNX bundle on the page thread. */
const WORKER_URL = new URL('./kokoro-worker.js?v=20261113phonon', import.meta.url);

const listeners = new Set();
const pending = new Map();
let worker = null;
let workerFailed = false;
let loadPromise = null;
let seq = 0;
let downloadedHandler = null;
let snapshot = {
  ready: false, loading: false, error: '', device: '', progress: 0,
  loaded: 0, total: 0, stage: 'idle', modelFetches: 0, fromCache: false, version: '1.0.0'
};

function emit() {
  const current = status();
  listeners.forEach((cb) => { try { cb(current); } catch { /* one listener must not break the rest */ } });
}

function status() {
  return { ...snapshot, loading: Boolean(snapshot.loading), usingWorker: !workerFailed && !!worker };
}

function onChange(cb) {
  if (typeof cb !== 'function') return () => {};
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function onModelDownloaded(cb) {
  downloadedHandler = cb;
}

function abortError() {
  const error = new Error('cancelled');
  error.name = 'AbortError';
  return error;
}

function workerUnavailable(message) {
  const error = new Error(message || '离线语音线程不可用');
  error.name = 'WorkerUnavailable';
  return error;
}

function applySnapshot(next) {
  if (!next || typeof next !== 'object') return;
  snapshot = {
    ...snapshot,
    ...next,
    loading: Boolean(next.loading),
    progress: Number(next.progress) || 0,
    loaded: Number(next.loaded) || 0,
    total: Number(next.total) || 0,
    modelFetches: Number(next.modelFetches) || 0,
    fromCache: Boolean(next.fromCache)
  };
  emit();
}

function settle(requestId, error, value) {
  const item = pending.get(requestId);
  if (!item) return;
  pending.delete(requestId);
  if (error) item.reject(error);
  else item.resolve(value);
}

function failWorker(error) {
  workerFailed = true;
  const wrapped = error && error.name === 'WorkerUnavailable' ? error : workerUnavailable(error && error.message);
  try { if (worker) worker.terminate(); } catch { /* already dead */ }
  worker = null;
  loadPromise = null;
  for (const id of [...pending.keys()]) settle(id, wrapped);
  snapshot = { ...snapshot, stage: 'failed', error: wrapped.message, loading: false, ready: false };
  emit();
}

function ensureWorker() {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(WORKER_URL, { type: 'module', name: 'kidsreading-phonon' });
  } catch {
    workerFailed = true;
    worker = null;
    return null;
  }
  worker.onmessage = (event) => {
    const msg = event.data || {};
    if (msg.type === 'status' && msg.snapshot) {
      applySnapshot(msg.snapshot);
      return;
    }
    if (msg.type === 'model-downloaded' && downloadedHandler) {
      Promise.resolve(downloadedHandler(msg)).catch(() => {});
      return;
    }
    if (msg.type === 'model-ready' || msg.type === 'loaded') {
      if (msg.type === 'loaded') {
        applySnapshot({ ...(msg.snapshot || {}), ready: true, stage: 'ready', loading: false, progress: 100 });
      }
      settle(msg.requestId, null, msg);
      return;
    }
    if (msg.type === 'audio') {
      const samples = msg.samples instanceof Float32Array ? msg.samples : new Float32Array(msg.samples || []);
      settle(msg.requestId, null, {
        samples,
        sampleRate: Number(msg.sampleRate) || 24000,
        duration: Number(msg.duration) || (samples.length / (Number(msg.sampleRate) || 24000))
      });
      return;
    }
    if (msg.type === 'cancelled') {
      settle(msg.requestId, abortError());
      return;
    }
    if (msg.type === 'error') {
      const error = new Error(msg.message || '离线语音合成失败');
      if (!msg.requestId) {
        failWorker(error);
        return;
      }
      settle(msg.requestId, error);
    }
  };
  worker.onerror = (event) => {
    failWorker(workerUnavailable((event && event.message) || '语音线程故障'));
  };
  return worker;
}

function post(type, extra, transfer) {
  const thread = ensureWorker();
  if (!thread) return Promise.reject(workerUnavailable(snapshot.error));
  const requestId = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject, kind: type });
    try { thread.postMessage({ type, requestId, ...extra }, transfer || []); }
    catch (error) {
      pending.delete(requestId);
      reject(workerUnavailable(error && error.message));
    }
  });
}

function useCachedModel(blob) {
  if (!blob) return Promise.resolve(false);
  return post('use-model', { blob }).then(() => true);
}

function load() {
  if (workerFailed) return Promise.reject(workerUnavailable(snapshot.error));
  if (loadPromise) return loadPromise;
  snapshot = { ...snapshot, loading: true, stage: snapshot.stage === 'ready' ? 'ready' : 'starting', error: '' };
  emit();
  loadPromise = post('load').then(() => true).catch((error) => {
    loadPromise = null;
    snapshot = { ...snapshot, loading: false, stage: 'failed', error: String((error && error.message) || error) };
    emit();
    throw error;
  });
  return loadPromise;
}

async function synthesize(text, options = {}) {
  if (workerFailed || typeof Worker === 'undefined') throw workerUnavailable(snapshot.error);
  await load();
  if (workerFailed || !worker) throw workerUnavailable(snapshot.error);
  const requestId = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject, kind: 'synthesize' });
    try {
      worker.postMessage({
        type: 'synthesize',
        requestId,
        text,
        voice: options.voice,
        speed: options.speed
      });
    } catch (error) {
      pending.delete(requestId);
      reject(workerUnavailable(error && error.message));
    }
  });
}

function cancelSynthesize() {
  const ids = [];
  for (const [id, item] of pending) {
    if (item.kind !== 'synthesize') continue;
    ids.push(id);
    pending.delete(id);
    item.reject(abortError());
  }
  if (worker && ids.length) {
    try { worker.postMessage({ type: 'cancel', ids }); } catch { /* worker already gone */ }
  }
}

function reset() {
  cancelSynthesize();
  if (worker) {
    try { worker.terminate(); } catch { /* noop */ }
  }
  worker = null;
  workerFailed = false;
  loadPromise = null;
  snapshot = {
    ready: false, loading: false, error: '', device: '', progress: 0,
    loaded: 0, total: 0, stage: 'idle', modelFetches: 0, fromCache: false, version: '1.0.0'
  };
  emit();
}

const API = {
  load, synthesize, status, onChange, onModelDownloaded, useCachedModel, cancelSynthesize, reset
};
export default API;
