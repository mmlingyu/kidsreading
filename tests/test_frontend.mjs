import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
global.location={origin:'https://reader.test'};
const root=new URL('../frontend/app/',import.meta.url);
// Data URL loads the ES module without needing package.json side effects in full reader.
const code=fs.readFileSync(new URL('reader-api.js',root),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const bad of ['http://124.222.128.61','https://evil/x','https://u:p@evil/','javascript:alert(1)']) {
  assert.throws(()=>mod.configureReader(bad,'A'.repeat(48)));
}
mod.configureReader('https://reader.test','A'.repeat(48));
mod.configureReader('https://reader.test',''); // memory-only token reuse for cancel/retry
let seen;
global.fetch=async(url,options)=>{seen={url,options};return {ok:true,json:async()=>({version:1,status:'queued'})};};
await mod.readerRequest('/api/reader/imports',{method:'POST',body:{source:'text',text:'hello'},key:'k'.repeat(20)});
assert.equal(seen.url,'https://reader.test/api/reader/imports');
assert.equal(seen.options.headers.Authorization,'Bearer '+'A'.repeat(48));
assert.equal(seen.options.redirect,'error');
assert.equal(seen.options.credentials,'omit');
await assert.rejects(mod.readerRequest('/api/studio'));
mod.clearReaderToken(); await assert.rejects(mod.readerRequest('/api/reader/health'));
console.log('frontend module tests passed');

// Original local book.json import remains local and only writes when importBook is invoked.
const storage=new Map();
global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const dataCode=fs.readFileSync(new URL('data/import-book.js',root),'utf8');
const books=await import('data:text/javascript;base64,'+Buffer.from(dataCode).toString('base64'));
const original=JSON.parse(fs.readFileSync(new URL('../skills/adventure-reader/references/example-book.json',import.meta.url),'utf8'));
assert.deepEqual(books.validateBook(original),[]);assert.equal(storage.size,0);
const imported=books.importBook(original);assert.equal(imported.ok,true);
assert.equal(books.loadImported()[0].id,'tree-house-night');
assert.equal(books.loadImported()[0].chapters[0].game.recall.length,original.chapters[0].game.recall.length);
console.log('original local book fixture validation and explicit bookshelf import passed');

// Trim only outer copy/paste whitespace; reject wrapped/prefixed secrets without echoing them.
mod.configureReader(' https://reader.test ', ' \n'+ 'A'.repeat(48)+'\r\n ');
await mod.readerRequest('/api/reader/health');
assert.equal(seen.options.headers.Authorization,'Bearer '+'A'.repeat(48));
for(const bad of ['Bearer '+'A'.repeat(48), '"'+'A'.repeat(48)+'"', 'A'.repeat(24)+' '+ 'A'.repeat(24)]) {
  assert.throws(()=>mod.configureReader('',bad), error=>error.message.includes('纯 Reader Token')&&!error.message.includes('A'.repeat(48)));
}
mod.clearReaderToken();
console.log('Reader Token outer-whitespace trim and pure-format non-disclosing validation PASS');
