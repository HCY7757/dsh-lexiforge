import type { Context } from '@deepseek-ai/cordis';
import type { PluginConfig } from './types.js';
export declare const name = "dsh-LexiForge";
export declare const inject: string[];
export declare function apply(ctx: Context, config: PluginConfig): Promise<void>;
