export declare class KnowledgeBase {
    private db;
    constructor(path: string);
    retrieve(query: string, topN?: number): string[];
    close(): void;
}
export declare function createKnowledge(path: string, contents: string[]): void;
