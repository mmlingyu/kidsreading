// Token lives only in module memory. Never local/sessionStorage, URL, logs, or HTML config.
let token = '';
let base = '';
export function configureReader(address, value) {
  const u = new URL(address || location.origin);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' || (u.protocol !== 'https:' && !(local && u.protocol === 'http:'))) {
    throw Error('服务地址必须为 HTTPS 源地址；仅本机开发允许 HTTP。');
  }
  if (!value && token && u.origin === (base || location.origin)) return;
  if (!value || value.length < 32) throw Error('请输入独立的 Reader Token（不使用 TTS Token）。');
  base = u.origin; token = value;
}
export function getReaderBase() { return base; }
export function clearReaderToken() { token = ''; }
export async function readerRequest(path, {method = 'GET', body, key} = {}) {
  if (!token) throw Error('请先输入 Reader Token；刷新后需要重新输入。');
  if (!/^\/api\/reader\/(?:imports(?:\/[a-f0-9]{32}(?:\/cancel)?)?|health)$/.test(path)) throw Error('无效接口路径');
  const headers = {Authorization: `Bearer ${token}`};
  if (body) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  const response = await fetch(`${base || location.origin}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000), cache: 'no-store', credentials: 'omit', redirect: 'error',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`HTTP ${response.status}: ${payload.detail || '服务请求失败'}`);
  if (payload.version !== 1) throw Error('服务协议版本不兼容');
  return payload;
}
