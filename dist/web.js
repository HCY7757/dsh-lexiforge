import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { MarketService, repository } from './services/market.js';
import { DISCLAIMER_VERSION, DISCLAIMER_SECTIONS } from './disclaimer.js';
export function registerWeb(ctx, manager, token) {
    const market = new MarketService(join(manager.root, '.cache'), token);
    // Custom route deliberately restricted to loopback: do not bypass remote DSH authentication.
    if (ctx.webServer.host !== '127.0.0.1')
        return;
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/lexiforge/api', async handler(req, res) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Vary', 'Origin');
            try {
                if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? ''))
                    throw new Error('Loopback access required');
                const host = req.headers.host ?? '';
                if (![`127.0.0.1:${ctx.webServer.port}`, `localhost:${ctx.webServer.port}`].includes(host))
                    throw new Error('Invalid host');
                if (req.method !== 'POST' || req.headers['x-lexiforge'] !== '1' || !req.headers['content-type']?.startsWith('application/json') || req.headers.origin !== `http://${host}`)
                    throw new Error('Same-origin JSON POST required');
                let body = '';
                for await (const chunk of req) {
                    body += chunk.toString();
                    if (Buffer.byteLength(body) > 65536)
                        throw new Error('Request too large');
                }
                const input = JSON.parse(body);
                await manager.refresh();
                let value;
                if (input.action === 'state')
                    value = manager.snapshot();
                else if (input.action === 'disclaimer')
                    value = { version: DISCLAIMER_VERSION, sections: DISCLAIMER_SECTIONS };
                else if (input.action === 'accept-disclaimer') {
                    if (typeof input.version !== 'number')
                        throw new Error('Missing version');
                    await manager.acceptDisclaimer(input.version);
                    value = manager.snapshot();
                }
                else if (input.action === 'search')
                    value = await market.searchPacks(input.query ?? '');
                else if (input.action === 'repo-packs') {
                    if (!input.repo)
                        throw new Error('Missing repo');
                    value = await market.listRepoPacks(input.repo);
                }
                else if (input.action === 'configure') {
                    if (!input.state)
                        throw new Error('Missing state');
                    await manager.configure(input.state.enabled, input.state.packs, input.state.timeoutMs, input.state.debugEnabled);
                    value = manager.snapshot();
                }
                else if (input.action === 'uninstall') {
                    await manager.uninstall(input.id ?? '');
                    value = manager.snapshot();
                }
                else if (input.action === 'install') {
                    if (input.confirmed !== true)
                        throw new Error('Explicit third-party risk consent required');
                    if (!input.repo)
                        throw new Error('Missing repo');
                    const { owner, repo } = repository(input.repo);
                    const listing = await market.listRepoPacks(`${owner}/${repo}`);
                    const entry = listing.collection
                        ? listing.packs.find(p => p.id === input.pack)
                        : listing.packs[0];
                    if (!entry)
                        throw new Error(`Unknown pack in repository; available: ${listing.packs.map(p => p.id).join(', ')}`);
                    const file = await market.downloadPack(`${owner}/${repo}`, entry.file);
                    try {
                        await manager.install(file, entry.id, true);
                    }
                    finally {
                        await rm(file, { force: true });
                    }
                    value = manager.snapshot();
                }
                else
                    throw new Error('Unknown action');
                res.end(JSON.stringify({ value }));
            }
            catch (error) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: String(error) }));
            }
        } }));
}
