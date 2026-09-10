import { appendFileSync } from 'node:fs';

let target: string | undefined;

export function setDebugLogFile(path: string | undefined): void {
  target = path;
}

export function dbg(where: string, detail: unknown): void {
  if (!target) return;
  try {
    const body = typeof detail === 'string' ? detail : JSON.stringify(detail);
    appendFileSync(target, `${new Date().toISOString()} [${where}] ${body}\n`);
  } catch { /* logging must never break the stream */ }
}
