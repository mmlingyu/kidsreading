// Reader credential is module memory only; never storage/URL/HTML/logs. Shared by imports and speech.
let token = '';
let base = '';
export function configureReader(address, value) {
  const u = new URL((typeof address==='string'?address.trim():address) || location.origin);
  value = typeof value==='string' ? value.trim() : value;
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' || (u.protocol !== 'https:' && !(local && u.protocol === 'http:'))) throw Error('服务地址必须为 HTTPS 源地址；仅本机开发允许 HTTP。');
  if (!value && token && u.origin === (base || location.origin)) return;
  if (typeof value !== 'string' || !/^[A-Za-z0-9._~+\/=-]{32,256}$/.test(value)) throw Error('只粘贴纯 Reader Token：不要 Bearer 前缀、引号或内部空格；不使用 TTS Token/模型 Key。');
  base = u.origin; token = value;
}
export function getReaderBase() { return base; }
export function hasReaderToken() { return !!token; }
export function clearReaderToken() { token = ''; }
function auth(path) {
  if (!token) throw Error('请点「语音与连接」输入 Reader Token；刷新后需要重新输入。');
  if (!/^\/api\/reader\/(?:imports(?:\/[a-f0-9]{32}(?:\/cancel)?)?|health|tts(?:\/voices\?engine=(?:piper|phonon))?)$/.test(path)) throw Error('无效接口路径');
  return {Authorization: `Bearer ${token}`};
}
export async function readerRequest(path, {method = 'GET', body, key, signal} = {}) {
  if(path.startsWith('/api/reader/tts')&&base&&base!==location.origin)throw Error('云端语音必须使用当前站点');
  const headers = auth(path);
  if (body) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  const response = await fetch(`${base || location.origin}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), cache: 'no-store', credentials: 'omit', redirect: 'error',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`HTTP ${response.status}: ${(path.startsWith('/api/reader/tts') ? messages[payload.detail] : payload.detail) || '服务请求失败'}`);
  if (payload.version !== 1) throw Error('服务协议版本不兼容');
  return payload;
}
const messages={tts_not_configured:'云端语音未配置，请联系维护者',tts_busy:'云端语音忙，请稍后再试',tts_upstream_busy:'TTS正在合成，请稍后再试',tts_rate_limited:'朗读过于频繁，请稍后再试',tts_upstream_auth_failed:'云端TTS授权配置异常，请联系维护者',tts_han_text:'Phonon不支持汉字，请选Piper或浏览器语音',tts_timeout:'云端语音超时，请稍后再试',tts_bad_voice:'音色已变化，请刷新音色列表',tts_invalid_audio:'TTS未返回有效WAV音频',tts_upstream_unavailable:'TTS服务暂不可用，请稍后手动重试',tts_request_rejected:'TTS拒绝了参数，请刷新音色并检查语言',tts_invalid_catalog:'云端音色结构异常，请联系维护者',tts_response_too_large:'语音响应超限，请缩短句子'};
async function smallError(response){
  if(!response.body)return {};
  const reader=response.body.getReader();let size=0;const parts=[];
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return {};}parts.push(value);}
    return JSON.parse(await new Blob(parts).text());
  }catch{return {};}finally{reader.releaseLock();}
}
export async function readerTts(payload, signal) {
  // TTS never sends Reader Bearer to a configured cross-origin import server.
  if (base && base !== location.origin) throw Error('云端语音必须使用当前站点；请在「语音与连接」选择同源。');
  const headers={...auth('/api/reader/tts'),'Content-Type':'application/json'};
  const response=await fetch(`${location.origin}/api/reader/tts`,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.any([signal || new AbortController().signal,AbortSignal.timeout(220000)]),credentials:'omit',cache:'no-store',redirect:'error'});
  if (!response.ok) {
    const data=await smallError(response);
    throw Error(response.status===401?'Reader Token无效，请重新输入':messages[data.detail] || `云端语音失败（HTTP ${response.status}），可手动切换浏览器语音`);
  }
  if (!(response.headers.get('content-type')||'').toLowerCase().startsWith('audio/wav')) {await response.body?.cancel();throw Error('云端未返回WAV音频');}
  const limit=12*1024*1024;
  if (Number(response.headers.get('content-length')||0)>limit) { await response.body?.cancel(); throw Error('语音响应超过12MiB限制'); }
  if (!response.body) throw Error('语音响应为空');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try {
    while (true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>limit)throw Error('语音响应超过12MiB限制');chunks.push(value);
    }
  } catch(e) { await reader.cancel().catch(()=>{});throw e; }
  finally {reader.releaseLock();}
  const blob=new Blob(chunks,{type:'audio/wav'});
  const header=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  if (new TextDecoder().decode(header.slice(0,4))!=='RIFF' || new TextDecoder().decode(header.slice(8,12))!=='WAVE')throw Error('语音响应不是WAV');
  return blob;
}
