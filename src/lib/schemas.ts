import { z } from "zod";

export type SearchRequest = z.infer<typeof searchRequestSchema>;
export const searchRequestSchema = z.object({
    query: z.string(),
    numResults: z.number(),
    whole: z.boolean().optional(),
    semantic: z.boolean().optional(),
});


export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type SearchResult = SearchResponse["Result"];
export type SearchResultFile = NonNullable<SearchResult["Files"]>[number];
export type SearchResultFileMatch = SearchResultFile["ChunkMatches"][number];
export type SearchResultRange = z.infer<typeof rangeSchema>;
export type SearchResultLocation = z.infer<typeof locationSchema>;

// @see : https://github.com/TaqlaAI/zoekt/blob/main/api.go#L212
const locationSchema = z.object({
    // 0-based byte offset from the beginning of the file
    ByteOffset: z.number(),
    // 1-based line number from the beginning of the file
    LineNumber: z.number(),
    // 1-based column number (in runes) from the beginning of line
    Column: z.number(),
});

const rangeSchema = z.object({
    Start: locationSchema,
    End: locationSchema,
});

export const searchResponseSchema = z.object({
    Result: z.object({
        Duration: z.number(),
        FileCount: z.number(),
        MatchCount: z.number(),
        Files: z.array(z.object({
            FileName: z.string(),
            Repository: z.string(),
            Version: z.string(),
            Language: z.string(),
            Branches: z.array(z.string()),
            ChunkMatches: z.array(z.object({
                Content: z.string(),
                Ranges: z.array(rangeSchema),
                FileName: z.boolean(),
                ContentStart: locationSchema,
                Score: z.number(),
            })),
            Checksum: z.string(),
            Score: z.number(),
            // Set if `whole` is true.
            Content: z.string().optional(),
        })).nullable(),
    }),
});

export type FileSourceRequest = z.infer<typeof fileSourceRequestSchema>;
export const fileSourceRequestSchema = z.object({
    fileName: z.string(),
    repository: z.string()
});

export type FileSourceResponse = z.infer<typeof fileSourceResponseSchema>;

export const fileSourceResponseSchema = z.object({
    source: z.string(),
});


export type ListRepositoriesResponse = z.infer<typeof listRepositoriesResponseSchema>;

// @see : https://github.com/TaqlaAI/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L728
export const statsSchema = z.object({
    Repos: z.number(),
    Shards: z.number(),
    Documents: z.number(),
    IndexBytes: z.number(),
    ContentBytes: z.number(),
    NewLinesCount: z.number(),
    DefaultBranchNewLinesCount: z.number(),
    OtherBranchesNewLinesCount: z.number(),
});

// @see : https://github.com/TaqlaAI/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L716
export const indexMetadataSchema = z.object({
    IndexFormatVersion: z.number(),
    IndexFeatureVersion: z.number(),
    IndexMinReaderVersion: z.number(),
    IndexTime: z.string(),
    PlainASCII: z.boolean(),
    LanguageMap: z.record(z.string(), z.number()),
    ZoektVersion: z.string(),
    ID: z.string(),
});

// @see : https://github.com/TaqlaAI/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L555
export const repositorySchema = z.object({
    Name: z.string(),
    URL: z.string(),
    Source: z.string(),
    Branches: z.array(z.object({
        Name: z.string(),
        Version: z.string(),
    })),
    CommitURLTemplate: z.string(),
    FileURLTemplate: z.string(),
    LineFragmentTemplate: z.string(),
    RawConfig: z.record(z.string(), z.string()),
    Rank: z.number(),
    IndexOptions: z.string(),
    HasSymbols: z.boolean(),
    Tombstone: z.boolean(),
    LatestCommitDate: z.string(),
    FileTombstones: z.string().optional(),
});

export const listRepositoriesResponseSchema = z.object({
    List: z.object({
        Repos: z.array(z.object({
            Repository: repositorySchema,
            IndexMetadata: indexMetadataSchema,
            Stats: statsSchema,
        })),
        Stats: statsSchema,
    })
});
