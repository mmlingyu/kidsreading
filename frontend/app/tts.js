// Cloud Piper/Phonon through authenticated SAME-ORIGIN Reader only. No Pocket runtime/import.
import {readerRequest,readerTts,getReaderBase} from './reader-api.js?v=reader-phase1-r5';
export const ttsEngines=[{id:'phonon-api',label:'Phonon 云端（英文）'},{id:'piper-api',label:'Piper 云端（多语言）'},{id:'browser',label:'浏览器语音（手动备用）'}];
export function migrateEngine(id) {
  if (String(id).startsWith('pocket')) return 'browser';
  if (['phonon','phonon-wasm','phonon-api'].includes(id)) return 'phonon-api';
  return ttsEngines.some(x=>x.id===id)?id:'phonon-api';
}
const catalogs={piper:[],phonon:[]};
export const ttsConfig={english:{engine:'phonon-api',piperVoice:'',phononVoice:''},piperVoices:{}};
export const englishEngine=()=>ttsConfig.english.engine;
export const engineFamily=id=>migrateEngine(id)==='browser'?'browser':migrateEngine(id).split('-')[0];
export function setEnglishEngine(id){ttsConfig.english.engine=migrateEngine(id);}
export function setPhononVoice(id){ttsConfig.english.phononVoice=String(id||'');}
export function setPiperVoice(id,language='en'){if(language==='en')ttsConfig.english.piperVoice=String(id||'');else if(['zh','fr','ja','ko'].includes(language))ttsConfig.piperVoices[language]=String(id||'');}
export function voicesForEngine(id,language='en'){return (catalogs[engineFamily(id)]||[]).filter(x=>!language||x.language===language);}
export function defaultVoiceForEngine(id){return voicesForEngine(id)[0]?.id||'';}
export function voiceLabel(v){return v?`${v.name} · ${v.language} · ${/noncommercial|NC/i.test(v.license)?"非商用 · ":""}${v.license}`:'';}
export async function refreshVoices(signal, engines=['piper','phonon']){
  if (getReaderBase() && getReaderBase()!==location.origin)throw Error('云端语音仅限当前站点，请将服务源地址留空。');
  // Serial metadata; one unavailable engine must not disable the other.
  const failures=[];
  for(const engine of engines) {
    try {
      const result=await readerRequest(`/api/reader/tts/voices?engine=${engine}`,{signal});
      if (!Array.isArray(result.voices))throw Error('音色列表协议无效');
      catalogs[engine]=result.voices.filter(v=>v.engine===engine&&/^[\w-]{1,100}$/.test(v.id)&&typeof v.name==='string'&&typeof v.license==='string'&&['en','zh','fr','ja','ko'].includes(v.language));
    }catch(error){if(signal?.aborted)throw error;failures.push(`${engine}音色加载失败：${error.message}`);}
  }
  if(failures.length)throw Error(failures.join('；'));
  return catalogs;
}
let onStatus=()=>{};
export function setTtsStatus(fn){onStatus=typeof fn==='function'?fn:()=>{};}
let generation=0,tail=Promise.resolve(),active=null,audio=null,objectUrl='',finishCurrent=null;
export function stopSpeaking(){
  generation++;tail=Promise.resolve();active?.abort();active=null;
  const finish=finishCurrent;finishCurrent=null;
  if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.src='';audio=null;}
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
  try{window.speechSynthesis?.cancel();}catch{}
  finish?.();
}
function browser(text,options,ticket){
  return new Promise((resolve,reject)=>{
    if(ticket!==generation)return resolve();
    if(!window.speechSynthesis)return reject(Error('此浏览器没有可用语音'));
    const u=new SpeechSynthesisUtterance(text);u.lang=options.lang;u.rate=options.rate;u.pitch=options.pitch;
    const voices=window.speechSynthesis.getVoices()||[];
    u.voice=voices.find(v=>v.lang?.toLowerCase().replace('_','-').startsWith(options.lang.slice(0,2).toLowerCase()))||null;
    let done=false;
    const end=(notify,error)=>{if(done)return;done=true;finishCurrent=null;if(notify&&ticket===generation)options.onend?.();error?reject(error):resolve();};
    finishCurrent=()=>end(false);u.onend=()=>end(true);u.onerror=()=>end(false,Error('浏览器语音播放失败'));
    try{window.speechSynthesis.speak(u);}catch{end(false,Error('浏览器语音播放失败'));}
  });
}
function play(blob,options,ticket){
  return new Promise((resolve,reject)=>{
    if(ticket!==generation)return resolve();
    objectUrl=URL.createObjectURL(blob);const current=new Audio(objectUrl);audio=current;let done=false;
    const url=objectUrl;
    const end=(notify,error)=>{
      if(done)return;done=true;current.onended=null;current.onerror=null;current.pause();current.src='';
      URL.revokeObjectURL(url);if(objectUrl===url)objectUrl='';if(audio===current)audio=null;finishCurrent=null;
      if(notify&&ticket===generation)options.onend?.();error?reject(error):resolve();
    };
    finishCurrent=()=>end(false);current.onended=()=>end(true);current.onerror=()=>end(false,Error('音频播放失败；可手动切换浏览器语音'));
    // rate is local playback only, never an unsupported TTS API field.
    current.playbackRate=options.rate;
    current.play().catch(()=>end(false,Error('浏览器阻止播放，请再次点击朗读')));
  });
}
function splitText(text,max){
  const sentences=text.match(/[^.!?。！？\n]+[.!?。！？]?|[.!?。！？]/gu)||[text];const out=[];
  for(const sentence of sentences){const chars=Array.from(sentence.trim());for(let i=0;i<chars.length;i+=max)out.push(chars.slice(i,i+max).join(''));}
  return out.filter(Boolean);
}
async function run(text,options,ticket){
  if(ticket!==generation)return;
  const engine=engineFamily(englishEngine());const language=options.lang.toLowerCase().slice(0,2);
  if(engine==='browser'){onStatus('浏览器语音（手动备用）');return browser(text,options,ticket);}
  if(engine==='phonon'&&language!=='en'){
    onStatus('Phonon仅英文：中文提示使用浏览器语音；多语言云端请选Piper');
    return browser(text,options,ticket);
  }
  const controller=new AbortController();active=controller;
  try{
    if(!catalogs[engine].length)await refreshVoices(controller.signal,[engine]);
    if(ticket!==generation)return;
    const available=voicesForEngine(englishEngine(),language);
    const preferred=engine==='piper'&&language!=='en'?ttsConfig.piperVoices[language]:ttsConfig.english[engine+'Voice'];const voice=available.find(v=>v.id===preferred)||available[0];
    if(!voice)throw Error('该引擎没有此语言音色，请刷新音色或选浏览器语音');
    for(const part of splitText(text,engine==='phonon'?1000:2000)){
      if(ticket!==generation)return;
      onStatus(`${engine==='piper'?'Piper':'Phonon'} 云端合成中…`);
      const blob=await readerTts({engine,text:part,language,voice:voice.id},controller.signal);
      if(ticket!==generation)return;
      onStatus('云端播放中');await play(blob,{...options,onend:null},ticket);
    }
    if(ticket===generation){onStatus('云端播放完成');options.onend?.();}
  }finally{if(active===controller)active=null;}
}
export function speakClip(text,{lang='en-US',rate=.92,pitch=1.05,onend=null}={}){
  const clean=String(text??'').trim();if(!clean)return null;
  const ticket=generation;
  tail=tail.then(()=>run(clean,{lang,rate,pitch,onend},ticket)).catch(error=>{
    if(ticket!==generation)return;
    // Clear queued clips after failure; NEVER silently play another engine.
    generation++;tail=Promise.resolve();onStatus(`${error?.message||'云端语音失败'}；可手动选择浏览器语音。`);
  });
  return {local:engineFamily(englishEngine())!=='browser',wait:0,done:tail};
}
