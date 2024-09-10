import { z } from "zod";

export type SearchRequest = z.infer<typeof searchRequestSchema>;
export const searchRequestSchema = z.object({
    query: z.string(),
    numResults: z.number(),
    whole: z.boolean().optional(),
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