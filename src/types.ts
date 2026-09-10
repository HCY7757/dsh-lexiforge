export interface LangPackManifest {
  name: string;
  version: string;          // 语义化版本
  author: string;
  mode: 'A' | 'B' | 'C' | 'composite';    // 处理模式
  pipeline?: Array<'A' | 'B' | 'C'>;      // composite 编排（B 检索→A 改写→C 收尾 等）
  prompt_template?: string; // 模式A/含A的复合专用
  dict_path?: string;       // 模式C/含C的复合专用 (dict.json)
  knowledge_db?: string;    // 模式B/含B的复合专用 (knowledge.db)
}
export interface InstalledPack { id: string; root: string; manifest: LangPackManifest; enabled: boolean; priority: number }
export interface PluginConfig { enabled?: boolean; packagesDir: string; githubToken?: string; timeoutMs?: number; debugLog?: string }
export interface PackState { enabled: boolean; packs: Array<{ id: string; enabled: boolean; priority: number }>; timeoutMs?: number; debugEnabled?: boolean; disclaimer?: { version: number; at: number } | null }
export interface Dictionary { replacements: Record<string, string>; rules: Array<{ pattern: string; replacement: string; flags: string }> }
