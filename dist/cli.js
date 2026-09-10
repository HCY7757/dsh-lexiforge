#!/usr/bin/env node
import { readFile, open, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { PackageManager } from './services/package-manager.js';
import { MarketService, repository } from './services/market.js';
import { createKnowledge } from './services/knowledge.js';
import { DISCLAIMER_VERSION, DISCLAIMER_SECTIONS } from './disclaimer.js';
export function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (quoted && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else
                quoted = !quoted;
        }
        else if (c === ',' && !quoted) {
            row.push(cell);
            cell = '';
        }
        else if (c === '\n' && !quoted) {
            row.push(cell.replace(/\r$/, ''));
            rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += c;
    }
    if (quoted)
        throw new Error('Unclosed CSV quote');
    if (cell || row.length) {
        row.push(cell.replace(/\r$/, ''));
        rows.push(row);
    }
    return rows;
}
async function main() {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'knowledge') {
        const [input, output] = args;
        if (!input || !output)
            throw new Error('knowledge INPUT.csv|txt OUTPUT.db');
        const file = resolve(output);
        const handle = await open(file, 'wx');
        await handle.close();
        try {
            const text = await readFile(resolve(input), 'utf8');
            createKnowledge(file, input.endsWith('.csv') ? parseCsv(text).map(row => row.join(' : ')) : text.split(/\r?\n/));
        }
        catch (error) {
            await rm(file, { force: true });
            throw error;
        }
        console.log(file);
        return;
    }
    if (!command || command === 'help') {
        console.log('lexiforge ROOT list | disclaimer | install ZIP ID --accept-risk | market-install OWNER/REPO --accept-risk | search QUERY | enable ID | disable ID | on | off | order ID... | uninstall ID\nlexiforge knowledge INPUT.csv|txt OUTPUT.db');
        return;
    }
    const root = resolve(command), [action, ...values] = args;
    const manager = new PackageManager(root);
    await manager.refresh();
    const market = new MarketService(join(root, '.cache'), process.env.GITHUB_TOKEN);
    if (action === 'disclaimer') {
        console.log(`LexiForge 第三方语言包免责声明 v${DISCLAIMER_VERSION}（安装任何语言包前请先通读）`);
        for (const s of DISCLAIMER_SECTIONS)
            console.log(`\n${s.title}\n${s.body}`);
        return;
    }
    if (action === 'list')
        console.log(JSON.stringify(manager.snapshot(), null, 2));
    else if (action === 'install') {
        if (!values.includes('--accept-risk'))
            throw new Error('Third-party risk acknowledgement required; run `lexiforge <ROOT> disclaimer` to review, then re-run with --accept-risk');
        await manager.install(resolve(values[0] ?? ''), values[1] ?? '', true);
    }
    else if (action === 'market-install') {
        if (!values.includes('--accept-risk'))
            throw new Error('Pass --accept-risk after reviewing the third-party repository (run `lexiforge <ROOT> disclaimer` first)');
        const { owner, repo } = repository(values[0] ?? '');
        const listing = await market.listRepoPacks(`${owner}/${repo}`);
        const wanted = values.filter(v => !v.startsWith('--'))[1];
        const entry = listing.collection
            ? listing.packs.find(p => p.id === wanted)
            : listing.packs[0];
        if (!entry)
            throw new Error(`Pick one pack of the repository: ${listing.packs.map(p => `${p.id} (${p.name})`).join(', ')}`);
        const file = await market.downloadPack(`${owner}/${repo}`, entry.file);
        try {
            await manager.install(file, entry.id, true);
            console.log(`installed ${entry.id} (${entry.name} v${entry.version})`);
        }
        finally {
            await rm(file, { force: true });
        }
    }
    else if (action === 'search')
        console.log(JSON.stringify(await market.searchPacks(values.join(' ')), null, 2));
    else if (action === 'uninstall')
        await manager.uninstall(values[0] ?? '');
    else if (['enable', 'disable', 'on', 'off', 'order'].includes(action ?? '')) {
        const state = manager.snapshot();
        if (action === 'enable' || action === 'disable') {
            const pack = state.packs.find(p => p.id === values[0]);
            if (!pack)
                throw new Error('Unknown package');
            pack.enabled = action === 'enable';
        }
        if (action === 'order') {
            if (values.length !== state.packs.length || new Set(values).size !== values.length || values.some(id => !state.packs.some(p => p.id === id)))
                throw new Error('Order must list every installed ID exactly once');
            for (const p of state.packs)
                p.priority = values.indexOf(p.id);
        }
        await manager.configure(action === 'on' ? true : action === 'off' ? false : state.enabled, state.packs.map(({ id, enabled, priority }) => ({ id, enabled, priority })));
    }
    else
        throw new Error('Unknown command; run lexiforge help');
}
void main().catch(error => { console.error(String(error)); process.exitCode = 1; });
