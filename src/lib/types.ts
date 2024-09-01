

export const pathQueryParamName = "path";
export const repoQueryParamName = "repo";

export type GetSourceResponse = {
    content: string;
    encoding: string;
}

export interface ZoektMatch {
    URL: string,
    FileName: string,
    LineNum: number,
    Fragments: {
        Pre: string,
        Match: string,
        Post: string
    }[]
}

export interface ZoektFileMatch {
    FileName: string,
    Repo: string,
    Language: string,
    Matches: ZoektMatch[],
    URL: string,
}

export interface ZoektResult {
    QueryStr: string,
    FileMatches: ZoektFileMatch[] | null,
    Stats: {
        // Duration in nanoseconds
        Duration: number,
    }
}

export interface ZoektSearchResponse {
    result: ZoektResult,
}

export interface ZoektPrintResponse {
    Content: string,
    Encoding: string,
}

export type KeymapType = "default" | "vim";