import fs from 'node:fs';
import {validateBook} from './import-book.mjs';
export function check(book) {
  const errors=[];
  const media = new Set(JSON.parse(fs.readFileSync(new URL('./allowed-media.json',import.meta.url),'utf8')));
  function safe(x,depth=0) {
    if(depth>30) throw Error('depth');
    if(typeof x==='string' && (/[<>]/.test(x)||/^(?:javascript|data):/i.test(x))) throw Error('markup');
    if(x && typeof x==='object') for(const [k,v] of Object.entries(x)) {
      if(['__proto__','prototype','constructor'].includes(k)) throw Error('prototype');
      if(['cover','hero','art'].includes(k) && v && !media.has(v)) throw Error('untrusted_media');
      if(k==='color' && v && !/^#[a-fA-F0-9]{3,8}$/.test(v)) throw Error('unsafe_color');
      safe(v,depth+1);
    }
  }
  try {
    safe(book);
    if(!Array.isArray(book.chapters) || book.chapters.length<1 || book.chapters.length>8) errors.push('chapters_1_to_8');
    for(const c of book.chapters||[]) {
      if(!Array.isArray(c.game?.recall)||c.game.nodes||c.game.start) errors.push('recall_only');
    }
    errors.push(...validateBook(book));
    // Deterministic playtest: exercise every recall response against corresponding sentence.
    for(const c of book.chapters||[]) {
      const all=[...(c.vocab||[]).map(w=>w.eg),...(c.paragraphs||[]).map(p=>p.en)];
      (c.game?.recall||[]).forEach((item,i)=> {
        const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
        if(norm(item.sentence.replace('____',item.answer))!==norm(all[i])) errors.push('playtest_recall_mismatch');
      });
    }
  } catch { errors.push('invalid_shape_or_unsafe_content'); }
  return errors;
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href) {
  try { const p=process.argv[2]; const st=fs.lstatSync(p); if(st.isSymbolicLink()||st.size>2097152) process.exit(2);
    process.exit(check(JSON.parse(fs.readFileSync(p,'utf8'))).length?1:0);
  } catch { process.exit(2); }
}
