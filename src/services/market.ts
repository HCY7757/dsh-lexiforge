import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export interface MarketPack { name: string; full_name: string; description: string | null; stars: number; url: string }
export interface RepoPackEntry { id: string; name: string; version: string; author?: string; description?: string; mode?: string; file: string }

export function repository(input: string): { owner: string; repo: string } {
  const match = /^(?:https:\/\/github\.com\/)?([\w-]+)\/([\w.-]+)\/?$/.exec(input.trim());
  if (!match || match[2] === '.' || match[2] === '..') throw new Error('Expected owner/repo or a GitHub repository URL');
  return { owner: match[1]!, repo: match[2]!.replace(/\.git$/, '') };
}

function safeFileName(name: string): boolean {
  return name.length > 3 && name.length <= 80 && /^[a-z0-9][a-z0-9._-]*\.zip$/i.test(name) && !name.includes('/') && !name.includes('\\');
}

async function rawFile(owner: string, repo: string, branch: string, path: string): Promise<Response> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  return fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
}

export class MarketService {
  constructor(private cacheDir: string, private token?: string) {}
  private async api(path: string): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const r = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(20000), redirect: 'error' });
    if (!r.ok) throw new Error(`GitHub HTTP ${r.status}; remaining=${r.headers.get('x-ratelimit-remaining')}; reset=${r.headers.get('x-ratelimit-reset')}; retry-after=${r.headers.get('retry-after')}`);
    return r.json();
  }
  private async branchOf(owner: string, repo: string): Promise<string> {
    const metadata = await this.api(`/repos/${owner}/${repo}`) as { default_branch: string };
    return metadata.default_branch;
  }
  async searchPacks(query = '', page = 1): Promise<MarketPack[]> {
    if (!Number.isInteger(page) || page < 1 || page > 50 || query.length > 200) throw new Error('Invalid search');
    await mkdir(this.cacheDir, { recursive: true });
    const file = join(this.cacheDir, createHash('sha256').update(`${query}:${page}`).digest('hex') + '.json');
    try {
      const cache = JSON.parse(await readFile(file, 'utf8')) as { at: number; items: MarketPack[] };
      if (Date.now() - cache.at < 1800000 && Array.isArray(cache.items)) return cache.items;
    } catch { /* Missing/corrupt caches are not installation state. */ }
    // Search has its own 10/min anonymous, 30/min authenticated quota, not REST's hourly quota.
    const data = await this.api(`/search/repositories?q=${encodeURIComponent(query + ' topic:dsh-langpack')}&sort=stars&per_page=20&page=${page}`) as { items: Array<{ name: string; full_name: string; description: string | null; stargazers_count: number; html_url: string }> };
    const items = data.items.map(x => ({ name: x.name, full_name: x.full_name, description: x.description, stars: x.stargazers_count, url: x.html_url }));
    await writeFile(file, JSON.stringify({ at: Date.now(), items }));
    return items;
  }
  /**
   * 仓库语言包清单。仓库根目录 langpacks.json 声明多个语言包（四合一仓库）；
   * 无该文件则回退为“单包仓库”（默认 langpack.zip），返回单元素列表。
   */
  async listRepoPacks(input: string): Promise<{ collection: boolean; packs: RepoPackEntry[] }> {
    const { owner, repo } = repository(input);
    const branch = await this.branchOf(owner, repo);
    const response = await rawFile(owner, repo, branch, 'langpacks.json');
    if (response.status === 404) {
      return { collection: false, packs: [{ id: `${owner}-${repo}`.toLowerCase().replaceAll('.', '-').slice(0, 80), name: repo, version: '0.0.0', file: 'langpack.zip' }] };
    }
    if (!response.ok) throw new Error(`langpacks.json fetch failed HTTP ${response.status}`);
    const doc = await response.json() as { version?: unknown; packs?: unknown };
    if (typeof doc !== 'object' || doc === null || doc.version !== 1 || !Array.isArray(doc.packs) || doc.packs.length === 0 || doc.packs.length > 64) throw new Error('Invalid langpacks.json (expects version: 1 and packs: [..])');
    const seen = new Set<string>();
    const packs: RepoPackEntry[] = doc.packs.map((raw) => {
      const p = raw as Partial<RepoPackEntry>;
      const id = String(p.id ?? '');
      if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id) || seen.has(id)) throw new Error(`Invalid or duplicate pack id: ${id}`);
      seen.add(id);
      if (typeof p.name !== 'string' || !p.name.trim() || typeof p.version !== 'string' || !p.version.trim() || typeof p.file !== 'string' || !safeFileName(p.file)) throw new Error(`Invalid pack entry: ${id}`);
      return { id, name: p.name.trim(), version: p.version.trim(), author: p.author, description: p.description, mode: p.mode, file: p.file };
    });
    return { collection: true, packs };
  }
  private async fetchZip(owner: string, repo: string, branch: string, path: string): Promise<string> {
    const response = await rawFile(owner, repo, branch, path);
    if (!response.ok || !response.body) throw new Error(`Download failed HTTP ${response.status}; repository must publish ${path}`);
    let size = 0;
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 64 * 1024 * 1024) throw new Error('ZIP download exceeds 64 MB');
      chunks.push(chunk);
    }
    await mkdir(this.cacheDir, { recursive: true });
    const out = join(this.cacheDir, `download-${randomUUID()}.zip`);
    try { await writeFile(out, Buffer.concat(chunks), { flag: 'wx' }); return out; }
    catch (error) { await rm(out, { force: true }); throw error; }
  }
  async downloadPack(input: string, file = 'langpack.zip'): Promise<string> {
    if (!safeFileName(file)) throw new Error('Invalid pack file');
    const { owner, repo } = repository(input);
    const branch = await this.branchOf(owner, repo);
    return this.fetchZip(owner, repo, branch, file);
  }
}
