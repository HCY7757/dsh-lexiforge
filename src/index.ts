import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-llm';
import type { PluginConfig } from './types.js';
import { StreamInterceptor } from './services/stream-interceptor.js';
import { processPacks, independentRequests } from './services/processor.js';
import { PackageManager } from './services/package-manager.js';
import { registerWeb } from './web.js';
import { dbg, setDebugLogFile } from './debug.js';
export const name = 'dsh-LexiForge';
export const inject = ['llm'];
export async function apply(ctx: Context, config: PluginConfig) {
  const manager = new PackageManager(config.packagesDir, config.enabled ?? true, config.timeoutMs ?? 500, config.debugLog, config.debugLog !== undefined);
  await manager.refresh();
  setDebugLogFile(manager.debugLogFile());
  ctx.inject(['webServer'], web => { registerWeb(web, manager, config.githubToken); });
  ctx.on('llm/stream', (options, next) => {
    if (independentRequests.has(options)) return next();
    const source = next();
    return (async function* () {
      try {
        await manager.refresh();
        setDebugLogFile(manager.debugLogFile());
        const packs = manager.activePacks();
        dbg('index', { provider: options.provider, model: options.model, purpose: options.purpose ?? null, activePacks: packs.map(p => p.id), globalEnabled: manager.snapshot().enabled });
        if (!packs.length || options.purpose) { dbg('index', 'pass-through'); yield* source; return; }
        const interceptor = new StreamInterceptor((text, signal) => processPacks(text, packs, ctx.llm, options, signal), manager.timeoutMs());
        yield* interceptor.process(source, options.signal);
        dbg('index', 'rewrite completed');
      } catch (error) { dbg('index', 'error: ' + String(error)); throw error; }
    })();
  });
}
