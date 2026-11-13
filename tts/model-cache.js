/* IndexedDB copy of the Kokoro model.
 * A localStorage marker is written only after the blob is stored and checked.
 * The marker is never treated as proof that the bytes are still there. */
import { MODEL_SPEC } from "./model-spec.js";
import { recordIsValid, silentInitAllowed } from "./speech-plan.js";

const KEY = "model.onnx";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MODEL_SPEC.idbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MODEL_SPEC.idbStore)) db.createObjectStore(MODEL_SPEC.idbStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开语音缓存"));
  });
}

function requestDone(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("语音缓存读写失败"));
  });
}

export function readMarker() {
  try { return localStorage.getItem(MODEL_SPEC.markerKey) || ""; }
  catch { return ""; }
}

function writeMarker(value) {
  try {
    if (value) localStorage.setItem(MODEL_SPEC.markerKey, value);
    else localStorage.removeItem(MODEL_SPEC.markerKey);
  } catch { /* private mode */ }
}

export async function readModelRecord() {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    const record = await requestDone(db.transaction(MODEL_SPEC.idbStore, "readonly").objectStore(MODEL_SPEC.idbStore).get(KEY));
    return record || null;
  } finally {
    db.close();
  }
}

export async function readValidModel() {
  const record = await readModelRecord();
  return recordIsValid(record, MODEL_SPEC) ? record : null;
}

export async function cacheStatus() {
  const marker = readMarker();
  const record = await readModelRecord();
  const valid = silentInitAllowed(marker, record, MODEL_SPEC);
  if (!valid && marker) writeMarker("");
  return { marker, valid, bytes: valid ? record.bytes : 0, version: valid ? record.version : "" };
}

export async function storeModel(buffer, sha256) {
  if (typeof indexedDB === "undefined") throw new Error("这个浏览器不能把语音模型存下来");
  const bytes = buffer.byteLength;
  if (bytes !== MODEL_SPEC.bytes || sha256 !== MODEL_SPEC.sha256) {
    const error = new Error("语音模型校验失败");
    error.name = "ModelMismatch";
    throw error;
  }
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const record = { version: MODEL_SPEC.version, bytes, sha256, blob };
  const db = await openDb();
  try {
    await requestDone(db.transaction(MODEL_SPEC.idbStore, "readwrite").objectStore(MODEL_SPEC.idbStore).put(record, KEY));
  } finally {
    db.close();
  }
  const stored = await readValidModel();
  if (!stored) throw new Error("语音模型写入缓存后读不回来");
  writeMarker(MODEL_SPEC.version);
  return stored;
}

export async function deleteModel() {
  writeMarker("");
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await requestDone(db.transaction(MODEL_SPEC.idbStore, "readwrite").objectStore(MODEL_SPEC.idbStore).delete(KEY));
  } finally {
    db.close();
  }
  if (typeof caches !== "undefined") {
    try { await caches.delete(MODEL_SPEC.runtimeCache); } catch { /* noop */ }
  }
}
