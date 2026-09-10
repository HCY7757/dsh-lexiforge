import type { InstalledPack, PackState } from '../types.js';
export declare class PackageManager {
    readonly root: string;
    private defaultTimeoutMs;
    private defaultDebugOn;
    private state;
    private packs;
    private logLocation;
    constructor(root: string, enabled?: boolean, defaultTimeoutMs?: number, logConfig?: string, defaultDebugOn?: boolean);
    timeoutMs(): number;
    debugEnabled(): boolean;
    debugLogFile(): string | undefined;
    private id;
    refresh(): Promise<void>;
    activePacks(): InstalledPack[];
    snapshot(): {
        enabled: boolean;
        packs: {
            id: string;
            root: string;
            manifest: import("../types.js").LangPackManifest;
            enabled: boolean;
            priority: number;
        }[];
        timeoutMs: number;
        debugEnabled: boolean;
        debugLogFile: string | null;
        disclaimer: {
            version: number;
            at: number;
        } | null;
        disclaimerVersion: number;
    };
    acceptDisclaimer(version: number): Promise<void>;
    private save;
    private mutate;
    install(zip: string, id: string, confirmed: boolean): Promise<void>;
    configure(enabled: boolean, packs: PackState['packs'], timeoutMs?: number, debugEnabled?: boolean): Promise<void>;
    uninstall(id: string): Promise<void>;
}
