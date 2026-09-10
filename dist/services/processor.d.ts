import type { GenerateOptions } from '@deepseek-ai/dsh-llm/types';
import type { LlmRuntime } from './stream-interceptor.js';
import type { InstalledPack } from '../types.js';
export declare const independentRequests: WeakSet<GenerateOptions>;
export declare function workerTask<T>(data: object, signal: AbortSignal): Promise<T>;
export declare function processPacks(text: string, packs: InstalledPack[], llm: LlmRuntime, original: GenerateOptions, signal: AbortSignal): Promise<string>;
