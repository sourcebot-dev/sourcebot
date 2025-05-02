
import { z } from "zod";

// @see : https://github.com/sourcebot-dev/zoekt/blob/main/api.go#L212
export const zoektLocationSchema = z.object({
    // 0-based byte offset from the beginning of the file
    ByteOffset: z.number(),
    // 1-based line number from the beginning of the file
    LineNumber: z.number(),
    // 1-based column number (in runes) from the beginning of line
    Column: z.number(),
});

export const zoektRangeSchema = z.object({
    Start: zoektLocationSchema,
    End: zoektLocationSchema,
});

// @see : https://github.com/sourcebot-dev/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L350
export const zoektSearchResponseStats = {
    ContentBytesLoaded: z.number(),
    IndexBytesLoaded: z.number(),
    Crashes: z.number(),
    Duration: z.number(),
    FileCount: z.number(),
    ShardFilesConsidered: z.number(),
    FilesConsidered: z.number(),
    FilesLoaded: z.number(),
    FilesSkipped: z.number(),
    ShardsScanned: z.number(),
    ShardsSkipped: z.number(),
    ShardsSkippedFilter: z.number(),
    MatchCount: z.number(),
    NgramMatches: z.number(),
    NgramLookups: z.number(),
    Wait: z.number(),
    MatchTreeConstruction: z.number(),
    MatchTreeSearch: z.number(),
    RegexpsConsidered: z.number(),
    FlushReason: z.number(),
}

export const zoektSymbolSchema = z.object({
    Sym: z.string(),
    Kind: z.string(),
    Parent: z.string(),
    ParentKind: z.string(),
});

// @see : https://github.com/sourcebot-dev/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L497
export const zoektSearchResponseSchema = z.object({
    Result: z.object({
        ...zoektSearchResponseStats,
        Files: z.array(z.object({
            FileName: z.string(),
            Repository: z.string(),
            Version: z.string().optional(),
            Language: z.string(),
            Branches: z.array(z.string()).optional(),
            ChunkMatches: z.array(z.object({
                Content: z.string(),
                Ranges: z.array(zoektRangeSchema),
                FileName: z.boolean(),
                ContentStart: zoektLocationSchema,
                Score: z.number(),
                SymbolInfo: z.array(zoektSymbolSchema).nullable(),
            })),
            Checksum: z.string(),
            Score: z.number(),
            // Set if `whole` is true.
            Content: z.string().optional(),
        })).nullable(),
        RepoURLs: z.record(z.string(), z.string()),
    }),
});
