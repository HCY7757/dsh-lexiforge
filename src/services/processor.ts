import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import type { GenerateOptions } from '@deepseek-ai/dsh-llm/types';
import type { LlmRuntime } from './stream-interceptor.js';
import type { InstalledPack } from '../types.js';
import { dataFile, loadDictionary } from './manifest.js';
import { dbg } from '../debug.js';

export const independentRequests = new WeakSet<GenerateOptions>();

export function workerTask<T>(data: object, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./data-worker.js', import.meta.url), { workerData: data, resourceLimits: { maxOldGenerationSizeMb: 64 } });
    const finish = (error?: unknown, value?: T) => {
      signal.removeEventListener('abort', abort);
      worker.removeAllListeners();
      void worker.terminate();
      if (error) reject(error); else resolve(value!);
    };
    const abort = () => finish(signal.reason ?? new Error('Aborted'));
    signal.addEventListener('abort', abort, { once: true });
    worker.once('error', finish);
    worker.once('exit', code => finish(new Error(`Worker exited before result (${code})`)));
    worker.once('message', m => finish(m.error ? new Error(m.error) : undefined, m.value));
  });
}

async function stageKnowledge(pack: InstalledPack, text: string, signal: AbortSignal): Promise<string[]> {
  return workerTask<string[]>({ kind: 'knowledge', path: await dataFile(pack.root, 'knowledge.db'), text }, signal);
}

async function stageDictionary(pack: InstalledPack, text: string, signal: AbortSignal): Promise<string> {
  const before = text;
  text = await workerTask<string>({ kind: 'dictionary', text, dict: await loadDictionary(pack.root) }, signal);
  dbg('process', { pack: pack.id, stage: 'C', changed: text !== before, outHead: text.slice(0, 40) });
  return text;
}

async function stageRewrite(pack: InstalledPack, text: string, knowledge: string[], llm: LlmRuntime, original: GenerateOptions, signal: AbortSignal): Promise<string> {
  const template = pack.manifest.prompt_template!;
  const prompt = template.replace(/\{\{(text|knowledge)\}\}/g, (_, key) => key === 'text' ? text : knowledge.join('\n'))
    + (template.includes('{{text}}') ? '' : `\n\n${text}`)
    + (knowledge.length && !template.includes('{{knowledge}}') ? `\n\nTerminology:\n${knowledge.join('\n')}` : '');
  // Independent request: fresh message only; never forward sessionId, main history, tools or replay state.
  // Local Cordis isolate(name, symbol) is service scoping, NOT isolate(name, callback).
  // Local LLM exposes stream(), not generate(); collect its final text without recursion.
  const request: GenerateOptions = {
    provider: original.provider, model: original.model, signal,
    messages: [{ id: randomUUID() as GenerateOptions['messages'][number]['id'], role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: prompt }] }],
  };
  independentRequests.add(request);
  let output = '', successful = false;
  for await (const chunk of llm.stream(request)) {
    signal.throwIfAborted();
    if (chunk.type === 'text-delta') output += chunk.text;
    if (output.length > 2 * 1024 * 1024) throw new Error('LLM rewrite too large');
    if (chunk.type === 'finish') successful = chunk.reason.kind === 'stop';
  }
  if (!successful || !output.trim()) throw new Error('Independent LLM request did not complete');
  dbg('process', { pack: pack.id, stage: 'A', knowledgeHits: knowledge.length, outHead: output.slice(0, 40) });
  return output;
}

export async function processPacks(text: string, packs: InstalledPack[], llm: LlmRuntime, original: GenerateOptions, signal: AbortSignal): Promise<string> {
  dbg('process', { packs: packs.map(p => `${p.id}:${p.manifest.mode}${p.manifest.pipeline ? '[' + p.manifest.pipeline.join('') + ']' : ''}`), textHead: text.slice(0, 40) });
  for (const pack of packs) {
    signal.throwIfAborted();
    const manifest = pack.manifest;
    if (manifest.mode === 'C') { text = await stageDictionary(pack, text, signal); continue; }
    if (manifest.mode === 'A') { text = await stageRewrite(pack, text, [], llm, original, signal); continue; }
    if (manifest.mode === 'B') {
      const knowledge = await stageKnowledge(pack, text, signal);
      text = await stageRewrite(pack, text, knowledge, llm, original, signal);
      continue;
    }
    // composite: 按包内 pipeline 编排。B 把检索结果留给随后最近的一次 A 消费；C 纯本地。
    let pending: string[] = [];
    for (const stage of manifest.pipeline ?? []) {
      signal.throwIfAborted();
      if (stage === 'C') text = await stageDictionary(pack, text, signal);
      else if (stage === 'B') { pending = await stageKnowledge(pack, text, signal); dbg('process', { pack: pack.id, stage: 'B', hits: pending.length }); }
      else if (stage === 'A') text = await stageRewrite(pack, text, pending, llm, original, signal);
    }
  }
  return text;
}
