import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { PackageManager } from '../dist/services/package-manager.js';
import { createKnowledge, KnowledgeBase } from '../dist/services/knowledge.js';
import { processPacks, independentRequests } from '../dist/services/processor.js';
import { safeUnpack } from '../dist/utils/unpacker.js';

function zip(files) {
  const locals = [], central = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = Buffer.from(name), data = Buffer.from(text);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20,4); h.writeUInt32LE(crc,14); h.writeUInt32LE(data.length,18); h.writeUInt32LE(data.length,22); h.writeUInt16LE(n.length,26);
    locals.push(h,n,data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt32LE(crc,16); c.writeUInt32LE(data.length,20); c.writeUInt32LE(data.length,24); c.writeUInt16LE(n.length,28); c.writeUInt32LE(offset,42);
    central.push(c,n); offset += h.length+n.length+data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length,8); end.writeUInt16LE(Object.keys(files).length,10); end.writeUInt32LE(cd.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,cd,end]);
}
async function temporary(fn) { const root = await mkdtemp(new URL('../.test-',import.meta.url)); try { await fn(root); } finally { await rm(root,{recursive:true,force:true}); } }

test('real ZIP install, consent, persisted enable and C worker chain', () => temporary(async root => {
  const file = join(root,'pack.zip');
  await writeFile(file, zip({'manifest.yaml':'name: Demo\nversion: 1.0.0\nauthor: Test\nmode: C\ndict_path: dict.json\n','dict.json':JSON.stringify({replacements:{hello:'world'},rules:[{pattern:'world',replacement:'done',flags:'g'}]})}));
  const manager = new PackageManager(join(root,'packs')); await manager.refresh();
  await assert.rejects(manager.install(file,'demo',false),/acknowledgement/);
  await manager.install(file,'demo',true);
  assert.equal(manager.activePacks().length,0);
  await manager.configure(true,[{id:'demo',enabled:true,priority:0}]);
  const other = new PackageManager(join(root,'packs')); await other.refresh();
  const result = await processPacks('hello',other.activePacks(),{stream(){throw Error('C must not use LLM');}},{},AbortSignal.timeout(5000));
  assert.equal(result,'done');
  await other.uninstall('demo'); assert.equal(other.snapshot().packs.length,0);
}));
test('real malicious archives rejected and cleaned', () => temporary(async root => {
  for (const name of ['../escape.txt','payload.exe','nested/../../escape.txt']) {
    const file = join(root,'bad.zip'); await writeFile(file,zip({[name]:'bad'}));
    await assert.rejects(safeUnpack(file,join(root,'out')));
  }
}));
test('SQLite trigram Chinese and short-token fallback', () => temporary(async root => {
  const file = join(root,'knowledge.db'); createKnowledge(file,['天地玄黄 宇宙洪荒','你好 世界']);
  const db = new KnowledgeBase(file);
  try { assert.ok(db.retrieve('天地玄').length); assert.ok(db.retrieve('你好').length); assert.deepEqual(db.retrieve('" OR *'),[]); } finally { db.close(); }
}));
test('A request is independent and tagged against recursion', async () => {
  let request;
  const llm = {async *stream(options) { request=options; assert.ok(independentRequests.has(options)); yield {type:'text-delta',index:0,text:'translated'}; yield {type:'finish',reason:{kind:'stop'}}; }};
  const result = await processPacks('original',[{root:'',manifest:{mode:'A',prompt_template:'Rewrite {{text}}'}}],llm,{provider:'test',model:'test',sessionId:'main',messages:['history'],tools:['tool']},AbortSignal.timeout(1000));
  assert.equal(result,'translated'); assert.equal(request.sessionId,undefined); assert.equal(request.tools,undefined); assert.equal(request.messages.length,1);
});
test('composite pipeline B->A->C: knowledge feeds A prompt, C fixes after LLM', () => temporary(async root => {
  const db = join(root,'knowledge.db'); createKnowledge(db,['世界你好吗']);
  await writeFile(join(root,'dict.json'), JSON.stringify({replacements:{我:'莪'}}));
  let prompt;
  const llm = {async *stream(options) { prompt=options.messages[0].content[0].text; assert.ok(independentRequests.has(options)); yield {type:'text-delta',index:0,text:'你好吗 我'}; yield {type:'finish',reason:{kind:'stop'}}; }};
  const pack = { root, enabled: true, priority: 0, id: 'composite', manifest: { mode: 'composite', pipeline: ['B','A','C'], prompt_template: '改写：{{knowledge}} | {{text}}', dict_path: 'dict.json', knowledge_db: 'knowledge.db' } };
  const result = await processPacks('你好吗',[pack],llm,{provider:'test',model:'test'},AbortSignal.timeout(10000));
  assert.ok(prompt.includes('世界你好吗'), 'knowledge must reach the A prompt');
  assert.ok(prompt.includes('你好吗'), 'original text must reach the A prompt');
  assert.equal(result,'你好吗 莪', 'C stage must replace 我 after the LLM pass');
}));
test('disclaimer acceptance persists, rejects version mismatch and survives configure', () => temporary(async root => {
  const manager = new PackageManager(join(root,'packs')); await manager.refresh();
  await assert.rejects(manager.acceptDisclaimer(0),/version mismatch/);
  await manager.acceptDisclaimer(1);
  assert.equal(manager.snapshot().disclaimer?.version, 1);
  await manager.configure(true, []); // global off/on must not wipe acceptance
  assert.equal(manager.snapshot().disclaimer?.version, 1);
  const other = new PackageManager(join(root,'packs')); await other.refresh();
  assert.equal(other.snapshot().disclaimer?.version, 1, 'acceptance persists across instances');
}));
