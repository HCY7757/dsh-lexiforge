import { appendFileSync } from 'node:fs';
let target;
export function setDebugLogFile(path) {
    target = path;
}
export function dbg(where, detail) {
    if (!target)
        return;
    try {
        const body = typeof detail === 'string' ? detail : JSON.stringify(detail);
        appendFileSync(target, `${new Date().toISOString()} [${where}] ${body}\n`);
    }
    catch { /* logging must never break the stream */ }
}
