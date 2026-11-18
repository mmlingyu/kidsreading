// Offline ES-module tests; synthetic credentials, fake fetch/audio/speech, no browser/server/network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../frontend/app/',import.meta.url);
global.location={origin:'https://reader.test'};
const statuses=[],calls=[];let browserPlays=0,posted=0,active=0,peak=0,mode='ok',cancelled=0;
const piper=[{engine:'piper',id:'en_US-joe-medium',name:'Joe',language:'en',license:'Test-attribution'},{engine:'piper',id:'zh_CN-chaowen-medium',name:'Chaowen',language:'zh',license:'Test-license'},{engine:'piper',id:'ja_JP-hi_fi_captain-medium',name:'Japanese',language:'ja',license:'noncommercial Synthetic-test-only'}];
piper.push({engine:'piper',id:'zh_CN-xiao_ya-medium',name:'Xiao Ya',language:'zh',license:'noncommercial Synthetic-test-only'});
const phonon=[{engine:'phonon',id:'default',name:'Default',language:'en',license:'Test-license'},{engine:'phonon',id:'NbpkqMVS3CJeq2j8',name:'Zoey',language:'en',license:'Test-license'}];
const wav=new Uint8Array(48);wav.set(new TextEncoder().encode('RIFF'),0);wav.set(new TextEncoder().encode('WAVE'),8);
const created=[],revoked=[];
URL.createObjectURL=()=>{const v='blob:offline-'+created.length;created.push(v);return v;};URL.revokeObjectURL=v=>revoked.push(v);
global.Audio=class {
 constructor(src){this.src=src;}
 pause(){}
 async play(){setTimeout(()=>this.onended?.(),1);}
};
global.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
global.window={speechSynthesis:{cancel(){},getVoices:()=>[],speak(u){browserPlays++;setTimeout(()=>u.onend?.(),1);}}};
global.fetch=async(url,options={})=>{
 calls.push({url,options});
 assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
 assert.equal(options.headers.Authorization,'Bearer '+'A'.repeat(48));
 assert.ok(url.startsWith(location.origin+'/api/reader/tts'));
 if(options.method!=='POST')return Response.json({version:1,voices:url.endsWith('piper')?piper:phonon});
 posted++;active++;peak=Math.max(peak,active);
 try{
  if(mode==='hold')await new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>{cancelled++;reject(new DOMException('Cancelled','AbortError'));},{once:true});});
  else await new Promise(r=>setTimeout(r,2));
  if(mode==='error')return Response.json({detail:'tts_not_configured'},{status:503});
  if(mode==='json')return Response.json({error:'not audio'});
  return new Response(wav,{headers:{'Content-Type':'audio/wav'}});
 }finally{active--;}
};
const dataUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const apiCode=fs.readFileSync(new URL('reader-api.js',root),'utf8'),apiUrl=dataUrl(apiCode),api=await import(apiUrl);
const ttsCode=fs.readFileSync(new URL('tts.js',root),'utf8').replace('./reader-api.js?v=reader-phase1-r5',apiUrl);
const ttsUrl=dataUrl(ttsCode),tts=await import(ttsUrl);
tts.setTtsStatus(s=>statuses.push(s));
assert.deepEqual(tts.ttsEngines.map(e=>e.id),['phonon-api','piper-api','browser']);
assert.equal(tts.migrateEngine('pocket-api'),'browser');assert.equal(tts.migrateEngine('pocket-wasm'),'browser');
assert.ok(!ttsCode.includes('127.0.0.1')&&!ttsCode.includes('synthesizePocket'));
api.configureReader('', 'A'.repeat(48));
await tts.refreshVoices();assert.equal(tts.voicesForEngine('piper-api','').length,4);assert.equal(tts.voicesForEngine('piper-api').length,1);
assert.ok(tts.voiceLabel(piper[2]).includes('非商用'));
tts.setEnglishEngine('phonon-api');tts.setPhononVoice('NbpkqMVS3CJeq2j8');
let ended=0;await tts.speakClip('Sentence one. Sentence two.',{onend:()=>ended++}).done;
assert.equal(posted,2);assert.equal(peak,1);assert.equal(ended,1);assert.equal(browserPlays,0);
for(const c of calls.filter(c=>c.options.method==='POST')){
 const p=JSON.parse(c.options.body);assert.deepEqual(Object.keys(p).sort(),['engine','language','text','voice']);
 assert.equal(p.voice,'NbpkqMVS3CJeq2j8');assert.equal(p.engine,'phonon');
}
assert.ok(created.every(x=>revoked.includes(x)),'Object URLs must be released after playback');
// Cloud errors are visible and abort queued cloud clips; no hidden browser substitution.
tts.stopSpeaking();mode='error';const before=posted;
const one=tts.speakClip('First failure.');const two=tts.speakClip('Must not auto-retry.');await Promise.all([one.done,two.done]);
assert.equal(posted,before+1);assert.equal(browserPlays,0);assert.ok(statuses.at(-1).includes('未配置'));
// Real fetch cancellation signal and no stale delayed playback.
tts.stopSpeaking();mode='hold';const pending=tts.speakClip('Cancel this request.');
while(active===0)await new Promise(r=>setTimeout(r,1));tts.stopSpeaking();await pending.done;assert.equal(cancelled,1);assert.equal(active,0);
mode='json';await tts.speakClip('JSON is not audio.').done;assert.ok(statuses.at(-1).includes('WAV'));assert.equal(browserPlays,0);
mode='ok';tts.stopSpeaking();tts.setEnglishEngine('piper-api');tts.setPiperVoice('en_US-joe-medium');
await tts.speakClip('你好。',{lang:'zh-CN'}).done;
assert.equal(JSON.parse(calls.at(-1).options.body).voice,'zh_CN-chaowen-medium');
tts.setPiperVoice('zh_CN-xiao_ya-medium','zh');await tts.speakClip('另一个中文音色。',{lang:'zh-CN'}).done;assert.equal(JSON.parse(calls.at(-1).options.body).voice,'zh_CN-xiao_ya-medium');
// Existing Chinese browser behavior under Phonon is explicitly disclosed, never switched to Piper.
tts.stopSpeaking();tts.setEnglishEngine('phonon-api');const n=posted;
await tts.speakClip('中文提示',{lang:'zh-CN'}).done;assert.equal(posted,n);assert.equal(browserPlays,1);assert.ok(statuses.at(-1).includes('Phonon仅英文'));
tts.stopSpeaking();tts.setEnglishEngine('browser');await tts.speakClip('Browser chosen.').done;assert.equal(browserPlays,2);
// TTS may never follow a configured external import origin; Token stays out of URLs/storage.
api.configureReader('https://other.example','A'.repeat(48));
await assert.rejects(tts.refreshVoices(),/当前站点/);await assert.rejects(api.readerTts({}),/当前站点/);
api.configureReader('', 'A'.repeat(48));api.clearReaderToken();await assert.rejects(tts.refreshVoices(),/Reader Token/);
assert.ok(calls.every(c=>!c.url.includes('A'.repeat(48))));
// Old Pocket settings migrate but actual reading progress survives, and auth is never serialized.
const storage=new Map([['last-kids-reader-v1',JSON.stringify({settings:{engine:'pocket-api',pocketVoice:'alba'},xp:20,unlocked:2,done:{1:true}})]]);
global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const stateCode=fs.readFileSync(new URL('state.js',root),'utf8').replace('./tts.js?v=reader-phase1-r5',ttsUrl);
const state=await import(dataUrl(stateCode));assert.equal(state.S.settings.engine,'browser');assert.equal(state.S.settings.pocketVoice,undefined);assert.equal(state.S.xp,20);assert.equal(state.S.unlocked,2);state.save();
assert.ok(!storage.get('last-kids-reader-v1').includes('A'.repeat(48)));
// Coherent module URL prevents split state/auth caches across game, selection and main UI.
for(const file of ['app.js','state.js','selection.js','syllables.js','game.js','guide.js']){
 const code=fs.readFileSync(new URL(file,root),'utf8');
 for(const m of code.matchAll(/["']\.\/(state|tts|reader-api)\.js([^"']*)["']/g))assert.equal(m[2],'?v=reader-phase1-r5');
}
const ui=fs.readFileSync(new URL('app.js',root),'utf8');assert.ok(ui.includes('role="status"')&&ui.includes('全部音色与源授权标识')&&ui.includes('clearReaderToken'));
console.log('TTS UI modules: dynamic Piper/Phonon catalogs, license labels, serial clips, auth sharing, explicit fallback, body/audio cancellation, object URL cleanup, progress migration and coherent modules PASS');
// Partial catalog failure must not disable a working engine.
api.configureReader('', 'A'.repeat(48));
const independent=await import(dataUrl(ttsCode+'\n// independent engine fixture'));
let independentPosts=0;
global.fetch=async(url,options={})=>{
 if(options.method==='POST'){independentPosts++;return new Response(wav,{headers:{'Content-Type':'audio/wav'}});}
 if(url.endsWith('phonon'))return Response.json({detail:'tts_upstream_unavailable'},{status:502});
 return Response.json({version:1,voices:piper});
};
await assert.rejects(independent.refreshVoices(),/phonon/);
assert.equal(independent.voicesForEngine('piper-api').length,1);
independent.setEnglishEngine('piper-api');await independent.speakClip('Piper independently works.').done;assert.equal(independentPosts,1);
let sizeCancelled=false;
global.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(12*1024*1024+1));},cancel(){sizeCancelled=true;}}),{headers:{'Content-Type':'audio/wav'}});
await assert.rejects(api.readerTts({engine:'piper',text:'Hello'}),/12MiB/);assert.equal(sizeCancelled,true);
api.clearReaderToken();
console.log('Independent catalogs and browser-side bounded streaming response PASS');
