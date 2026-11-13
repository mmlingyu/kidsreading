/* Same-origin Phonon files only.
 * Small runtime files go in Cache Storage. The 324 MB model goes in IndexedDB,
 * which this worker serves so the ONNX worker can keep the native fetch. */
const CACHE = "kidsreading-phonon-runtime-v4";
const MAX = 32 * 1024 * 1024;
const DB = "kidsreading-phonon";
const STORE = "files";
const MODEL_KEY = "model.onnx";
const MODEL_BYTES = 339369442;
const MODEL_SHA = "94b973941b1852754f979be5d5e20be666d5c81d9bb886b88ae1dc85c9b895ca";
const MODEL_VERSION = "kokoro-82m-v1.1-zh-onnx-fp32@6cc0f0d2ebe369a68b0df87c2b65c1af8c0ac3e3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readModel() {
  const db = await openDb();
  try {
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(MODEL_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (!record || record.version !== MODEL_VERSION || record.bytes !== MODEL_BYTES || record.sha256 !== MODEL_SHA) return null;
    if (!record.blob || record.blob.size !== MODEL_BYTES) return null;
    return record.blob;
  } finally {
    db.close();
  }
}

async function storeModel(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (buffer.byteLength !== MODEL_BYTES || sha256 !== MODEL_SHA) return;
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put({
        version: MODEL_VERSION,
        bytes: MODEL_BYTES,
        sha256,
        blob: new Blob([buffer], { type: "application/octet-stream" })
      }, MODEL_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.hostname.endsWith("huggingface.co") || url.hostname.endsWith("hf.co") || url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(Promise.reject(new Error("offline voice blocked an external fetch")));
    return;
  }
  if (!url.pathname.startsWith("/tts/")) return;
  if (url.pathname.endsWith("/onnx/model.onnx")) {
    event.respondWith((async () => {
      const blob = await readModel();
      if (blob) {
        return new Response(blob, {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(blob.size),
            "x-phonon-cache": "idb"
          }
        });
      }
      return fetch(event.request);
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request, { ignoreSearch: true });
    if (hit) return hit;
    const response = await fetch(event.request);
    const length = Number(response.headers.get("content-length") || 0);
    if (response.ok && length > 0 && length <= MAX) cache.put(event.request, response.clone()).catch(() => {});
    return response;
  })());
});
