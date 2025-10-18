// @NOTE : Please keep this file in sync with @sourcebot/web/src/features/search/schemas.ts
// At some point, we should move these to a shared package...
import { z } from "zod";

export const locationSchema = z.object({
    // 0-based byte offset from the beginning of the file
    byteOffset: z.number(),
    // 1-based line number from the beginning of the file
    lineNumber: z.number(),
    // 1-based column number (in runes) from the beginning of line
    column: z.number(),
});

export const rangeSchema = z.object({
    start: locationSchema,
    end: locationSchema,
});

export const symbolSchema = z.object({
    symbol: z.string(),
    kind: z.string(),
});

export const searchRequestSchema = z.object({
    // The zoekt query to execute.
    query: z.string(),
    // The number of matches to return.
    matches: z.number(),
    // The number of context lines to return.
    contextLines: z.number().optional(),
    // Whether to return the whole file as part of the response.
    whole: z.boolean().optional(),
});

export const repositoryInfoSchema = z.object({
    id: z.number(),
    codeHostType: z.string(),
    name: z.string(),
    displayName: z.string().optional(),
    webUrl: z.string().optional(),
});

// Many of these fields are defined in zoekt/api.go.
export const searchStatsSchema = z.object({
    // The actual number of matches returned by the search.
    // This will always be less than or equal to `totalMatchCount`.
    actualMatchCount: z.number(),

    // The total number of matches found during the search.
    totalMatchCount: z.number(),

    // The duration (in nanoseconds) of the search.
    duration: z.number(),

    // Number of files containing a match.
    fileCount: z.number(),

    // Candidate files whose contents weren't examined because we
    // gathered enough matches.
    filesSkipped: z.number(),

    // Amount of I/O for reading contents.
    contentBytesLoaded: z.number(),

    // Amount of I/O for reading from index.
    indexBytesLoaded: z.number(),

    // Number of search shards that had a crash.
    crashes: z.number(),

    // Number of files in shards that we considered.
    shardFilesConsidered: z.number(),

    // Files that we evaluated. Equivalent to files for which all
    // atom matches (including negations) evaluated to true.
    filesConsidered: z.number(),

    // Files for which we loaded file content to verify substring matches
    filesLoaded: z.number(),

    // Shards that we scanned to find matches.
    shardsScanned: z.number(),

    // Shards that we did not process because a query was canceled.
    shardsSkipped: z.number(),

    // Shards that we did not process because the query was rejected by the
    // ngram filter indicating it had no matches.
    shardsSkippedFilter: z.number(),

    // Number of candidate matches as a result of searching ngrams.
    ngramMatches: z.number(),

    // NgramLookups is the number of times we accessed an ngram in the index.
    ngramLookups: z.number(),

    // Wall clock time for queued search.
    wait: z.number(),

    // Aggregate wall clock time spent constructing and pruning the match tree.
    // This accounts for time such as lookups in the trigram index.
    matchTreeConstruction: z.number(),

    // Aggregate wall clock time spent searching the match tree. This accounts
    // for the bulk of search work done looking for matches.
    matchTreeSearch: z.number(),

    // Number of times regexp was called on files that we evaluated.
    regexpsConsidered: z.number(),

    // FlushReason explains why results were flushed.
    flushReason: z.number(),
});

export const searchResponseSchema = z.object({
    stats: searchStatsSchema,
    files: z.array(z.object({
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
    })),
    repositoryInfo: z.array(repositoryInfoSchema),
    isBranchFilteringEnabled: z.boolean(),
    isSearchExhaustive: z.boolean(),
});

export const repositoryQuerySchema = z.object({
    codeHostType: z.string(),
    repoId: z.number(),
    repoName: z.string(),
    repoDisplayName: z.string().optional(),
    repoCloneUrl: z.string(),
    webUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    indexedAt: z.coerce.date().optional(),
});

export const listRepositoriesResponseSchema = repositoryQuerySchema.array();

export const fileSourceRequestSchema = z.object({
    fileName: z.string(),
    repository: z.string(),
    branch: z.string().optional(),
});

export const fileSourceResponseSchema = z.object({
    source: z.string(),
    language: z.string(),
});

export const serviceErrorSchema = z.object({
    statusCode: z.number(),
    errorCode: z.string(),
    message: z.string(),
});
