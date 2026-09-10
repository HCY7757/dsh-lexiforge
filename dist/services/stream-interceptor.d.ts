import type { StreamChunk, GenerateOptions } from '@deepseek-ai/dsh-llm/types';
export type Processor = (text: string, signal: AbortSignal) => Promise<string>;
export declare class StreamInterceptor {
    private processText;
    private timeoutMs;
    constructor(processText: Processor, timeoutMs?: number);
    process(source: AsyncIterable<StreamChunk>, signal?: AbortSignal): AsyncIterable<StreamChunk>;
    flush(chunks: StreamChunk[], signal?: AbortSignal): Promise<StreamChunk[]>;
}
export type LlmRuntime = {
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
};
