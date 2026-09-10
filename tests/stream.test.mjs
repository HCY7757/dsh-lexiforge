import test from 'node:test';
import assert from 'node:assert/strict';
import { StreamInterceptor } from '../dist/services/stream-interceptor.js';

async function collect(iter) { return [...(await (async()=>{const x=[];for await(const c of iter)x.push(c);return x})())]; }
test('buffers and replaces at flush', async () => {
  const s = new StreamInterceptor(async text => text.toUpperCase());
  const out = await collect(s.process((async function*(){yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text:'he'};yield {type:'text-delta',index:0,text:'llo'};yield {type:'block-end',index:0,block:{type:'text',text:'hello'}};yield {type:'finish',reason:{kind:'stop'}}})()));
  assert.equal(out.find(x=>x.type==='text-delta').text,'HELLO');
  assert.equal(out.find(x=>x.type==='block-end').block.text,'HELLO');
});
test('timeout returns original chunks', async () => {
  const s = new StreamInterceptor(async text => { await new Promise(r=>setTimeout(r,30)); return text+'!'; }, 5);
  const original={type:'block-end',index:0,block:{type:'text',text:'x'}};
  const out = await collect(s.process((async function*(){yield original;yield {type:'finish',reason:{kind:'stop'}}})()));
  assert.deepEqual(out[0],original);
});
test('code is preserved', async () => {
  const s = new StreamInterceptor(async text => text.toUpperCase());
  const out = await collect(s.process((async function*(){yield {type:'block-end',index:0,block:{type:'text',text:'a `b` c'}};yield {type:'finish',reason:{kind:'stop'}}})()));
  assert.equal(out.find(x=>x.type==='block-end').block.text,'A `b` C');
});
