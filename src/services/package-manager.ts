import { mkdir, readFile, writeFile, rename, rm, readdir, lstat } from 'node:fs/promises';
import { resolve, join, isAbsolute, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { InstalledPack, PackState } from '../types.js';
import { loadManifest, loadDictionary, dataFile } from './manifest.js';
import { safeUnpack } from '../utils/unpacker.js';
import { workerTask } from './processor.js';
import { DISCLAIMER_VERSION } from '../disclaimer.js';

export class PackageManager {
  private state: PackState;
  private packs: InstalledPack[] = [];
  private logLocation: string | undefined;
  constructor(readonly root: string, enabled = true, private defaultTimeoutMs = 500, logConfig?: string, private defaultDebugOn = false) {
    if (!root || !isAbsolute(root)) throw new Error('packagesDir must be an absolute data directory on D/F drive');
    this.state = { enabled, packs: [] };
    // 相对路径一律以数据目录为基准解析，换机器只改 packagesDir 即可
    this.logLocation = logConfig ? (isAbsolute(logConfig) ? logConfig : join(this.root, logConfig)) : undefined;
  }
  timeoutMs(): number {
    const value = this.state.timeoutMs;
    return typeof value === 'number' && Number.isFinite(value) ? value : this.defaultTimeoutMs;
  }
  debugEnabled(): boolean {
    const value = this.state.debugEnabled;
    return typeof value === 'boolean' ? value : this.defaultDebugOn;
  }
  debugLogFile(): string | undefined {
    return this.debugEnabled() ? (this.logLocation ?? join(this.root, 'debug.log')) : undefined;
  }
  private id(id: string): string {
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id)) throw new Error('Invalid package ID');
    return id;
  }
  async refresh(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    try {
      const value = JSON.parse(await readFile(join(this.root, 'state.json'), 'utf8')) as PackState;
      if (typeof value.enabled !== 'boolean' || !Array.isArray(value.packs)) throw new Error('Invalid package state');
      if (value.timeoutMs !== undefined && (typeof value.timeoutMs !== 'number' || !Number.isFinite(value.timeoutMs) || value.timeoutMs < 100 || value.timeoutMs > 600000)) throw new Error('Invalid timeoutMs');
      if (value.debugEnabled !== undefined && typeof value.debugEnabled !== 'boolean') throw new Error('Invalid debugEnabled');
      if (value.disclaimer !== undefined && value.disclaimer !== null && (typeof value.disclaimer !== 'object' || typeof value.disclaimer.version !== 'number' || typeof value.disclaimer.at !== 'number')) throw new Error('Invalid disclaimer');
      for (const p of value.packs) if (this.id(p.id) !== p.id || typeof p.enabled !== 'boolean' || !Number.isFinite(p.priority)) throw new Error('Invalid package entry');
      this.state = value;
      if (this.state.timeoutMs === undefined) this.state.timeoutMs = this.defaultTimeoutMs;
      if (this.state.debugEnabled === undefined) this.state.debugEnabled = this.defaultDebugOn;
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    const loaded: InstalledPack[] = [];
    for (const p of this.state.packs) {
      const root = join(this.root, p.id);
      const stat = await lstat(root);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe installed package directory');
      loaded.push({ ...p, root, manifest: await loadManifest(root) });
    }
    this.packs = loaded;
  }
  activePacks(): InstalledPack[] { return this.state.enabled ? this.packs.filter(p => p.enabled).sort((a, b) => a.priority - b.priority) : []; }
  snapshot() {
    const file = this.debugLogFile();
    return {
      enabled: this.state.enabled,
      packs: this.packs.map(p => ({ ...p })),
      timeoutMs: this.timeoutMs(),
      debugEnabled: this.debugEnabled(),
      debugLogFile: file ? relative(this.root, file).split('\\').join('/') : null,
      disclaimer: this.state.disclaimer ?? null,
      disclaimerVersion: DISCLAIMER_VERSION,
    };
  }
  async acceptDisclaimer(version: number): Promise<void> {
    if (version !== DISCLAIMER_VERSION) throw new Error('Disclaimer version mismatch');
    await this.mutate(async () => {
      this.state = { ...this.state, disclaimer: { version, at: Date.now() } };
      await this.save(); await this.refresh();
    });
  }
  private async save() {
    const tmp = join(this.root, `.state-${randomUUID()}.tmp`);
    try { await writeFile(tmp, JSON.stringify(this.state, null, 2), { flag: 'wx' }); await rename(tmp, join(this.root, 'state.json')); }
    finally { await rm(tmp, { force: true }); }
  }
  private async mutate(action: () => Promise<void>): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const lock = join(this.root, '.lock');
    await mkdir(lock); // Atomic cross-process writer exclusion; never delete someone else's lock.
    try { await this.refresh(); await action(); }
    finally { await rm(lock, { recursive: true, force: true }); }
  }
  async install(zip: string, id: string, confirmed: boolean): Promise<void> {
    this.id(id);
    if (!confirmed) throw new Error('Third-party risk acknowledgement required');
    await this.mutate(async () => {
      if (this.state.packs.some(p => p.id === id)) throw new Error('Package already installed');
      const staging = join(this.root, `.install-${randomUUID()}`);
      let moved = false;
      const target = join(this.root, id);
      try {
        await safeUnpack(zip, staging);
        const entries = await readdir(staging);
        if (entries.some(n => !['manifest.yaml', 'dict.json', 'knowledge.db', '\u8bf4\u660e.txt'].includes(n))) throw new Error('Pack must contain root-level manifest.yaml, dict.json, knowledge.db or instructions only');
        const manifest = await loadManifest(staging);
        const uses = (stage: string) => manifest.mode === stage || (manifest.mode === 'composite' && manifest.pipeline?.includes(stage as 'A' | 'B' | 'C') === true);
        if (entries.includes('dict.json')) await loadDictionary(staging);
        if (uses('C') && !entries.includes('dict.json')) throw new Error('Missing dict.json');
        if (uses('B') && !entries.includes('knowledge.db')) throw new Error('Missing knowledge.db');
        if (entries.includes('knowledge.db')) await workerTask({ kind: 'knowledge', path: await dataFile(staging, 'knowledge.db'), text: 'validation' }, AbortSignal.timeout(5000));
        await rename(staging, target); moved = true;
        this.state.packs.push({ id, enabled: false, priority: this.state.packs.length });
        await this.save(); moved = false;
      } finally { await rm(staging, { recursive: true, force: true }); if (moved) await rm(target, { recursive: true, force: true }); }
      await this.refresh();
    });
  }
  async configure(enabled: boolean, packs: PackState['packs'], timeoutMs?: number, debugEnabled?: boolean): Promise<void> {
    await this.mutate(async () => {
      if (typeof enabled !== 'boolean' || packs.length !== this.state.packs.length || new Set(packs.map(p => p.id)).size !== packs.length || packs.some(p => !this.state.packs.some(old => old.id === p.id) || typeof p.enabled !== 'boolean' || !Number.isFinite(p.priority))) throw new Error('Invalid configuration');
      if (timeoutMs !== undefined && (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 600000)) throw new Error('Invalid timeoutMs (100..600000 ms)');
      if (debugEnabled !== undefined && typeof debugEnabled !== 'boolean') throw new Error('Invalid debugEnabled');
      const keep = timeoutMs ?? this.state.timeoutMs;
      const keepDebug = debugEnabled ?? this.state.debugEnabled ?? this.defaultDebugOn;
      this.state = { enabled, packs, ...(keep !== undefined ? { timeoutMs: keep } : {}), debugEnabled: keepDebug, ...(this.state.disclaimer !== undefined ? { disclaimer: this.state.disclaimer } : {}) }; await this.save(); await this.refresh();
    });
  }
  async uninstall(id: string): Promise<void> {
    this.id(id);
    await this.mutate(async () => {
      if (!this.state.packs.some(p => p.id === id)) throw new Error('Unknown package');
      this.state.packs = this.state.packs.filter(p => p.id !== id);
      await this.save();
      await rm(resolve(this.root, id), { recursive: true, force: true });
      await this.refresh();
    });
  }
}
