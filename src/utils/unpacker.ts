import yauzl from 'yauzl';
import { mkdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function safeEntry(root: string, name: string): string {
  if (!name || /[\\:\x00-\x1f]/.test(name) || name.startsWith('/')) throw new Error('Zip Slip: invalid path');
  const parts = name.replace(/\/$/, '').split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))) throw new Error('Zip Slip: unsafe component');
  const path = resolve(root, name);
  const rel = relative(resolve(root), path);
  if (!rel || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw new Error('Zip Slip');
  return path;
}

export async function safeUnpack(zip: string, target: string): Promise<void> {
  // Exclusive fresh destination prevents traversal through pre-existing symlinks/junctions.
  await mkdir(target, { recursive: false });
  try {
    await new Promise<void>((resolveDone, reject) => {
      yauzl.open(zip, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, archive) => {
        if (error || !archive) { reject(error ?? new Error('Invalid archive')); return; }
        let count = 0, declared = 0, actual = 0, failed = false;
        const names = new Set<string>();
        const fail = (err: unknown) => { if (!failed) { failed = true; archive.close(); reject(err); } };
        archive.on('error', fail);
        archive.on('end', () => { if (!failed) resolveDone(); });
        archive.on('entry', (entry: yauzl.Entry) => {
          void (async () => {
            if (++count > 1024) throw new Error('ZIP entry limit exceeded');
            declared += entry.uncompressedSize;
            if (declared > 64 * 1024 * 1024) throw new Error('ZIP size limit exceeded');
            const file = safeEntry(target, entry.fileName);
            const key = file.toLowerCase();
            if (names.has(key)) throw new Error('Duplicate ZIP path');
            names.add(key);
            const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
            if (mode && mode !== 0x8000 && mode !== 0x4000) throw new Error('ZIP links and special files forbidden');
            if (entry.generalPurposeBitFlag & 1) throw new Error('Encrypted ZIP forbidden');
            if (entry.fileName.endsWith('/')) await mkdir(file, { recursive: true });
            else {
              if (!/\.(yaml|yml|json|db|txt)$/i.test(entry.fileName)) throw new Error('Forbidden file type');
              await mkdir(dirname(file), { recursive: true });
              const input = await new Promise<NodeJS.ReadableStream>((ok, no) => archive.openReadStream(entry, (e, s) => e || !s ? no(e ?? new Error('Missing ZIP stream')) : ok(s)));
              const limiter = new Transform({ transform(chunk: Buffer, _encoding, cb) {
                actual += chunk.length;
                cb(actual > 64 * 1024 * 1024 ? new Error('Actual ZIP size limit exceeded') : null, chunk);
              } });
              await pipeline(input, limiter, createWriteStream(file, { flags: 'wx' }));
            }
            if (!failed) archive.readEntry();
          })().catch(fail);
        });
        archive.readEntry();
      });
    });
  } catch (error) { await rm(target, { recursive: true, force: true }); throw error; }
}
