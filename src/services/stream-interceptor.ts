import type { StreamChunk, GenerateOptions } from '@deepseek-ai/dsh-llm/types';
import { dbg } from '../debug.js';

export type Processor = (text: string, signal: AbortSignal) => Promise<string>;

export class StreamInterceptor {
  constructor(private processText: Processor, private timeoutMs = 500) {}

  async *process(source: AsyncIterable<StreamChunk>, signal?: AbortSignal): AsyncIterable<StreamChunk> {
    const chunks: StreamChunk[] = [];
    let bytes = 0;
    for await (const chunk of source) {
      signal?.throwIfAborted();
      bytes += Buffer.byteLength(JSON.stringify(chunk));
      if (bytes > 16 * 1024 * 1024) throw new Error('LexiForge stream buffer exceeds 16 MB');
      chunks.push(chunk);
    }
    // Async-iterator equivalent of Transform._flush: publish nothing until processing completes.
    yield* await this.flush(chunks, signal);
  }

  async flush(chunks: StreamChunk[], signal?: AbortSignal): Promise<StreamChunk[]> {
    const finish = chunks.findLast(c => c.type === 'finish');
    const toolTurn = chunks.some(c => c.type === 'tool-call-delta' || (c.type === 'block-start' && c.blockType === 'tool-call'));
    const texts = new Map<number, string>();
    for (const c of chunks) if (c.type === 'block-end' && c.block.type === 'text') texts.set(c.index, c.block.text);
    dbg('flush', { chunkCount: chunks.length, finishKind: finish?.type === 'finish' ? finish.reason.kind : null, aborted: !!signal?.aborted, toolTurn, textBlocks: texts.size, skip: finish?.type !== 'finish' || (finish.reason.kind !== 'stop' && finish.reason.kind !== 'max-tokens') || !!signal?.aborted ? 'finish-gate' : toolTurn ? 'tool-turn' : !texts.size ? 'no-text' : null });
    if (finish?.type !== 'finish' || (finish.reason.kind !== 'stop' && finish.reason.kind !== 'max-tokens') || signal?.aborted) return chunks;
    // Tool-bearing turns and reasoning are never rewritten.
    if (toolTurn) return chunks;
    if (!texts.size) return chunks;
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const replacements = await Promise.race([
        (async () => {
          const result = new Map<number, string>();
          for (const [index, value] of texts) {
            // Keep fenced and inline code byte-for-byte, including unmatched opening fences.
            const parts = value.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g);
            for (let i = 0; i < parts.length; i += 2) if (parts[i]?.trim()) {
              parts[i] = await this.processText(parts[i]!, controller.signal);
              controller.signal.throwIfAborted();
            }
            result.set(index, parts.join(''));
          }
          return result;
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Processing timeout')); }, this.timeoutMs); }),
      ]);
      const emitted = new Set<number>();
      const output: StreamChunk[] = [];
      for (const c of chunks) {
        if (c.type === 'text-delta' && replacements.has(c.index)) {
          if (!emitted.has(c.index)) { output.push({ ...c, text: replacements.get(c.index)! }); emitted.add(c.index); }
        } else if (c.type === 'block-end' && c.block.type === 'text' && replacements.has(c.index)) {
          const text = replacements.get(c.index)!;
          if (!emitted.has(c.index)) output.push({ type: 'text-delta', index: c.index, text });
          output.push({ ...c, block: { ...c.block, text } });
        } else if (c.type === 'finish') {
          // Rewritten content cannot reuse provider replay metadata for the original text.
          const { replayState: _, ...rest } = c;
          output.push(rest);
        } else output.push(c);
      }
      return output;
    } catch (error) { dbg('flush', 'fallback-original: ' + String(error)); return chunks; }
    finally { clearTimeout(timer); controller.abort(); signal?.removeEventListener('abort', abort); }
  }
}

export type LlmRuntime = { stream(options: GenerateOptions): AsyncIterable<StreamChunk> };
