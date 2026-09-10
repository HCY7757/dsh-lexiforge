export interface MarketPack {
    name: string;
    full_name: string;
    description: string | null;
    stars: number;
    url: string;
}
export interface RepoPackEntry {
    id: string;
    name: string;
    version: string;
    author?: string;
    description?: string;
    mode?: string;
    file: string;
}
export declare function repository(input: string): {
    owner: string;
    repo: string;
};
export declare class MarketService {
    private cacheDir;
    private token?;
    constructor(cacheDir: string, token?: string | undefined);
    private api;
    private branchOf;
    searchPacks(query?: string, page?: number): Promise<MarketPack[]>;
    /**
     * 仓库语言包清单。仓库根目录 langpacks.json 声明多个语言包（四合一仓库）；
     * 无该文件则回退为“单包仓库”（默认 langpack.zip），返回单元素列表。
     */
    listRepoPacks(input: string): Promise<{
        collection: boolean;
        packs: RepoPackEntry[];
    }>;
    private fetchZip;
    downloadPack(input: string, file?: string): Promise<string>;
}
