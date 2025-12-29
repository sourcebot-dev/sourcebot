import { CodeHostType } from "@sourcebot/db";
import { z } from "zod";
import { serviceErrorSchema } from "@/lib/serviceError";

export const locationSchema = z.object({
    byteOffset: z.number(), // 0-based byte offset from the beginning of the file
    lineNumber: z.number(), // 1-based line number from the beginning of the file
    column: z.number(),     // 1-based column number (in runes) from the beginning of line
});
export type SourceLocation = z.infer<typeof locationSchema>;

export const rangeSchema = z.object({
    start: locationSchema,
    end: locationSchema,
});
export type SourceRange = z.infer<typeof rangeSchema>;

export const symbolSchema = z.object({
    symbol: z.string(),
    kind: z.string(),
});
export type SearchSymbol = z.infer<typeof symbolSchema>;

export const repositoryInfoSchema = z.object({
    id: z.number(),
    codeHostType: z.nativeEnum(CodeHostType),
    name: z.string(),
    displayName: z.string().optional(),
    webUrl: z.string().optional(),
});
export type RepositoryInfo = z.infer<typeof repositoryInfoSchema>;

// @note: Many of these fields are defined in zoekt/api.go.
export const searchStatsSchema = z.object({
    actualMatchCount: z.number(),          // The actual number of matches returned by the search. This will always be less than or equal to `totalMatchCount`.
    totalMatchCount: z.number(),           // The total number of matches found during the search.
    duration: z.number(),                  // The duration (in nanoseconds) of the search.
    fileCount: z.number(),                 // Number of files containing a match.
    filesSkipped: z.number(),              // Candidate files whose contents weren't examined because we gathered enough matches.
    contentBytesLoaded: z.number(),        // Amount of I/O for reading contents.
    indexBytesLoaded: z.number(),          // Amount of I/O for reading from index.
    crashes: z.number(),                   // Number of search shards that had a crash.
    shardFilesConsidered: z.number(),      // Number of files in shards that we considered.
    filesConsidered: z.number(),           // Files that we evaluated. Equivalent to files for which all atom matches (including negations) evaluated to true.
    filesLoaded: z.number(),               // Files for which we loaded file content to verify substring matches
    shardsScanned: z.number(),             // Shards that we scanned to find matches.
    shardsSkipped: z.number(),             // Shards that we did not process because a query was canceled.
    shardsSkippedFilter: z.number(),       // Shards that we did not process because the query was rejected by the ngram filter indicating it had no matches.
    ngramMatches: z.number(),              // Number of candidate matches as a result of searching ngrams.
    ngramLookups: z.number(),              // NgramLookups is the number of times we accessed an ngram in the index.
    wait: z.number(),                      // Wall clock time for queued search.
    matchTreeConstruction: z.number(),     // Aggregate wall clock time spent constructing and pruning the match tree. This accounts for time such as lookups in the trigram index.
    matchTreeSearch: z.number(),           // Aggregate wall clock time spent searching the match tree. This accounts for the bulk of search work done looking for matches.
    regexpsConsidered: z.number(),         // Number of times regexp was called on files that we evaluated.
    flushReason: z.string(),               // FlushReason explains why results were flushed.
});
export type SearchStats = z.infer<typeof searchStatsSchema>;

export const searchFileSchema = z.object({
    fileName: z.object({
        // The name of the file
        text: z.string(),
        // Any matching ranges
        matchRanges: z.array(rangeSchema),
    }),
    webUrl: z.string().optional(),
    repository: z.string(),
    repositoryId: z.number(),
    language: z.string(),
    chunks: z.array(z.object({
        content: z.string(),
        matchRanges: z.array(rangeSchema),
        contentStart: locationSchema,
        symbols: z.array(z.object({
            ...symbolSchema.shape,
            parent: symbolSchema.optional(),
        })).optional(),
    })),
    branches: z.array(z.string()).optional(),
    // Set if `whole` is true.
    content: z.string().optional(),
});
export type SearchResultFile = z.infer<typeof searchFileSchema>;
export type SearchResultChunk = SearchResultFile["chunks"][number];

export const searchOptionsSchema = z.object({
    matches: z.number(),                              // The number of matches to return.
    contextLines: z.number().optional(),              // The number of context lines to return.
    whole: z.boolean().optional(),                    // Whether to return the whole file as part of the response.
    isRegexEnabled: z.boolean().optional(),           // Whether to enable regular expression search.
    isCaseSensitivityEnabled: z.boolean().optional(), // Whether to enable case sensitivity.
    isArchivedExcluded: z.boolean().optional(),       // Whether to exclude archived repositories.
    isForkedExcluded: z.boolean().optional(),         // Whether to exclude forked repositories.
});
export type SearchOptions = z.infer<typeof searchOptionsSchema>;

export const searchRequestSchema = z.object({
    query: z.string(),                                // The zoekt query to execute.
    source: z.string().optional(),                    // The source of the search request.
    ...searchOptionsSchema.shape,
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const searchResponseSchema = z.object({
    stats: searchStatsSchema,
    files: z.array(searchFileSchema),
    repositoryInfo: z.array(repositoryInfoSchema),
    isSearchExhaustive: z.boolean(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

/**
 * Sent after each chunk of results is processed.
 */
export const streamedSearchChunkResponseSchema = z.object({
    type: z.literal('chunk'),
    stats: searchStatsSchema,
    files: z.array(searchFileSchema),
    repositoryInfo: z.array(repositoryInfoSchema),
});
export type StreamedSearchChunkResponse = z.infer<typeof streamedSearchChunkResponseSchema>;

/**
 * Sent after the search is complete.
 */
export const streamedSearchFinalResponseSchema = z.object({
    type: z.literal('final'),
    accumulatedStats: searchStatsSchema,
    isSearchExhaustive: z.boolean(),
});
export type StreamedSearchFinalResponse = z.infer<typeof streamedSearchFinalResponseSchema>;

/**
 * Sent when an error occurs during streaming.
 */
export const streamedSearchErrorResponseSchema = z.object({
    type: z.literal('error'),
    error: serviceErrorSchema,
});
export type StreamedSearchErrorResponse = z.infer<typeof streamedSearchErrorResponseSchema>;

export const streamedSearchResponseSchema = z.discriminatedUnion('type', [
    streamedSearchChunkResponseSchema,
    streamedSearchFinalResponseSchema,
    streamedSearchErrorResponseSchema,
]);
export type StreamedSearchResponse = z.infer<typeof streamedSearchResponseSchema>;

export const fileSourceRequestSchema = z.object({
    fileName: z.string(),
    repository: z.string(),
    branch: z.string().optional(),
});
export type FileSourceRequest = z.infer<typeof fileSourceRequestSchema>;

export const fileSourceResponseSchema = z.object({
    source: z.string(),
    language: z.string(),
    path: z.string(),
    repository: z.string(),
    repositoryCodeHostType: z.nativeEnum(CodeHostType),
    repositoryDisplayName: z.string().optional(),
    repositoryWebUrl: z.string().optional(),
    branch: z.string().optional(),
    webUrl: z.string().optional(),
});
export type FileSourceResponse = z.infer<typeof fileSourceResponseSchema>;
