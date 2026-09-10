import type { Dictionary, LangPackManifest } from '../types.js';
export declare function record(value: unknown): Record<string, unknown>;
export declare function dataFile(root: string, name: string): Promise<string>;
export declare function loadManifest(root: string): Promise<LangPackManifest>;
export declare function loadDictionary(root: string): Promise<Dictionary>;
