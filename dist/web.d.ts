import type { Context } from '@deepseek-ai/cordis';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PackageManager } from './services/package-manager.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        webServer: {
            host: string;
            port: number;
            register(route: {
                kind: 'exact';
                path: string;
                handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
            }): () => void;
        };
    }
}
export declare function registerWeb(ctx: Context, manager: PackageManager, token?: string): void;
