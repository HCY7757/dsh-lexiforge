import Database from 'better-sqlite3';
export class KnowledgeBase {
    db;
    constructor(path) {
        this.db = new Database(path, { readonly: true, fileMustExist: true, timeout: 100 });
        try {
            this.db.pragma('trusted_schema = OFF');
            this.db.pragma('query_only = ON');
            if (this.db.pragma('quick_check', { simple: true }) !== 'ok')
                throw new Error('Corrupt knowledge DB');
            const schema = this.db.prepare("SELECT sql FROM sqlite_master WHERE name = 'dict_fts' AND type = 'table'").get();
            if (!schema || !/using\s+fts5/i.test(schema.sql) || !/trigram/i.test(schema.sql))
                throw new Error('knowledge.db requires dict_fts(content), FTS5 trigram');
            this.db.prepare('SELECT content FROM dict_fts LIMIT 0').all();
        }
        catch (error) {
            this.db.close();
            throw error;
        }
    }
    retrieve(query, topN = 3) {
        const tokens = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 32) ?? [];
        if (!tokens.length)
            return [];
        const grams = new Set();
        for (const word of tokens) {
            const chars = Array.from(word);
            for (let i = 0; i <= chars.length - 3 && grams.size < 64; i++)
                grams.add(chars.slice(i, i + 3).join(''));
        }
        const limit = Math.max(1, Math.min(10, topN));
        const rows = grams.size
            ? this.db.prepare('SELECT content FROM dict_fts WHERE dict_fts MATCH ? ORDER BY rank LIMIT ?').all([...grams].map(s => `"${s.replaceAll('"', '""')}"`).join(' OR '), limit)
            // Trigram does NOT match one/two-character terms. Use a bounded scan for short queries.
            : this.db.prepare("SELECT content FROM (SELECT content FROM dict_fts LIMIT 10000) WHERE instr(content, ?) > 0 LIMIT ?").all(tokens[0], limit);
        return rows.map(r => r.content.slice(0, 2000));
    }
    close() { this.db.close(); }
}
export function createKnowledge(path, contents) {
    const db = new Database(path);
    try {
        db.exec("CREATE VIRTUAL TABLE dict_fts USING fts5(content, tokenize='trigram')");
        const insert = db.prepare('INSERT INTO dict_fts(content) VALUES (?)');
        db.transaction(() => { for (const content of contents)
            if (content.trim())
                insert.run(content); })();
    }
    finally {
        db.close();
    }
}
