import { parentPort, workerData } from 'node:worker_threads';
import { KnowledgeBase } from './knowledge.js';
// Untrusted regex and SQLite work run off the host thread and can be terminated at deadline.
try {
    if (workerData.kind === 'knowledge') {
        const db = new KnowledgeBase(workerData.path);
        try {
            parentPort.postMessage({ value: db.retrieve(workerData.text) });
        }
        finally {
            db.close();
        }
    }
    else {
        const dict = workerData.dict;
        let text = workerData.text;
        for (const [from, to] of Object.entries(dict.replacements)) {
            text = text.split(from).join(to);
            if (text.length > 2 * 1024 * 1024)
                throw new Error('Replacement output too large');
        }
        for (const r of dict.rules) {
            text = text.replace(new RegExp(r.pattern, r.flags), r.replacement);
            if (text.length > 2 * 1024 * 1024)
                throw new Error('Replacement output too large');
        }
        parentPort.postMessage({ value: text });
    }
}
catch (error) {
    parentPort.postMessage({ error: String(error) });
}
