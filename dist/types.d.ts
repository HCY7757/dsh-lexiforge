export interface LangPackManifest {
    name: string;
    version: string;
    author: string;
    mode: 'A' | 'B' | 'C' | 'composite';
    pipeline?: Array<'A' | 'B' | 'C'>;
    prompt_template?: string;
    dict_path?: string;
    knowledge_db?: string;
}
export interface InstalledPack {
    id: string;
    root: string;
    manifest: LangPackManifest;
    enabled: boolean;
    priority: number;
}
export interface PluginConfig {
    enabled?: boolean;
    packagesDir: string;
    githubToken?: string;
    timeoutMs?: number;
    debugLog?: string;
}
export interface PackState {
    enabled: boolean;
    packs: Array<{
        id: string;
        enabled: boolean;
        priority: number;
    }>;
    timeoutMs?: number;
    debugEnabled?: boolean;
    disclaimer?: {
        version: number;
        at: number;
    } | null;
}
export interface Dictionary {
    replacements: Record<string, string>;
    rules: Array<{
        pattern: string;
        replacement: string;
        flags: string;
    }>;
}
