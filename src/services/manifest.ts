import { readFile, lstat } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { safeEntry } from '../utils/unpacker.js';
import type { Dictionary, LangPackManifest } from '../types.js';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, unknown>;
}
export async function dataFile(root: string, name: string): Promise<string> {
  const path = safeEntry(root, name);
  // Packs use flat data files only; no links, subdirectories or executable payloads.
  if (name.includes('/')) throw new Error('Pack references must be root-level files');
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Expected regular data file');
  return path;
}
export async function loadManifest(root: string): Promise<LangPackManifest> {
  const path = await dataFile(root, 'manifest.yaml');
  const source = await readFile(path, 'utf8');
  if (Buffer.byteLength(source) > 65536) throw new Error('Manifest exceeds 64 KB');
  const document = parseDocument(source, { uniqueKeys: true, customTags: [] });
  if (document.errors.length) throw document.errors[0];
  const v = record(document.toJS({ maxAliasCount: 0 }));
  const allowed = ['name', 'version', 'author', 'mode', 'pipeline', 'prompt_template', 'dict_path', 'knowledge_db'];
  if (Object.keys(v).some(k => !allowed.includes(k))) throw new Error('Unknown manifest field');
  for (const field of ['name', 'version', 'author']) if (typeof v[field] !== 'string' || !(v[field] as string).trim()) throw new Error(`Invalid ${field}`);
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(v.version as string)) throw new Error('Invalid semantic version');
  const mode = String(v.mode);
  if (!['A', 'B', 'C', 'composite'].includes(mode)) throw new Error('Unknown mode');
  if (mode === 'composite') {
    const pipeline = v.pipeline;
    if (!Array.isArray(pipeline) || pipeline.length < 1 || pipeline.some(s => !['A', 'B', 'C'].includes(String(s)))) throw new Error('composite requires a pipeline of A/B/C');
    if (!pipeline.includes('A') && !pipeline.includes('C')) throw new Error('composite pipeline must include A or C');
    if (pipeline.includes('A') && (typeof v.prompt_template !== 'string' || !v.prompt_template.trim())) throw new Error('composite with A requires prompt_template');
    if (pipeline.includes('B') && v.knowledge_db !== 'knowledge.db') throw new Error('composite with B requires knowledge_db: knowledge.db');
    if (pipeline.includes('C') && v.dict_path !== 'dict.json') throw new Error('composite with C requires dict_path: dict.json');
  } else {
    if (v.pipeline !== undefined) throw new Error('pipeline is only valid for mode: composite');
    if (mode !== 'C' && (typeof v.prompt_template !== 'string' || !v.prompt_template.trim())) throw new Error('A/B require prompt_template');
    if (mode === 'C' && v.dict_path !== 'dict.json') throw new Error('C requires dict_path: dict.json');
    if (mode === 'B' && v.knowledge_db !== 'knowledge.db') throw new Error('B requires knowledge_db: knowledge.db');
  }
  if (v.dict_path !== undefined && v.dict_path !== 'dict.json') throw new Error('Invalid dict_path');
  if (v.knowledge_db !== undefined && v.knowledge_db !== 'knowledge.db') throw new Error('Invalid knowledge_db');
  return v as unknown as LangPackManifest;
}
export async function loadDictionary(root: string): Promise<Dictionary> {
  const path = await dataFile(root, 'dict.json');
  const source = await readFile(path, 'utf8');
  if (Buffer.byteLength(source) > 1024 * 1024) throw new Error('Dictionary exceeds 1 MB');
  const v = record(JSON.parse(source));
  const replacements = record(v.replacements ?? (v.rules ? {} : v));
  if (Object.entries(replacements).some(([k, value]) => !k || typeof value !== 'string')) throw new Error('Invalid dictionary mapping');
  const rules = v.rules ?? [];
  if (!Array.isArray(rules) || rules.length > 256 || Object.keys(replacements).length > 10000) throw new Error('Too many replacement rules');
  return {
    replacements: replacements as Record<string, string>,
    rules: rules.map(value => {
      const r = record(value);
      if (typeof r.pattern !== 'string' || r.pattern.length > 512 || typeof r.replacement !== 'string') throw new Error('Invalid regex rule');
      const flags = r.flags ?? 'gu';
      if (typeof flags !== 'string' || !/^[gimsu]*$/.test(flags)) throw new Error('Invalid regex flags');
      new RegExp(r.pattern, flags);
      return { pattern: r.pattern, replacement: r.replacement, flags };
    }),
  };
}
