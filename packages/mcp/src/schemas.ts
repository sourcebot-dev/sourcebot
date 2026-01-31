// @NOTE : Please keep this file in sync with @sourcebot/web/src/features/search/types.ts
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

export const searchOptionsSchema = z.object({
    matches: z.number(),                              // The number of matches to return.
    contextLines: z.number().optional(),              // The number of context lines to return.
    whole: z.boolean().optional(),                    // Whether to return the whole file as part of the response.
    isRegexEnabled: z.boolean().optional(),           // Whether to enable regular expression search.
    isCaseSensitivityEnabled: z.boolean().optional(), // Whether to enable case sensitivity.
});

export const searchRequestSchema = z.object({
    query: z.string(),                                // The zoekt query to execute.
    source: z.string().optional(),                    // The source of the search request.
    ...searchOptionsSchema.shape,
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
    flushReason: z.string(),
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
        webUrl: z.string(),
        externalWebUrl: z.string().optional(),
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
    isSearchExhaustive: z.boolean(),
});

export const repositoryQuerySchema = z.object({
    codeHostType: z.string(),
    repoId: z.number(),
    repoName: z.string(),
    repoDisplayName: z.string().optional(),
    webUrl: z.string(),
    externalWebUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    indexedAt: z.coerce.date().optional(),
    pushedAt: z.coerce.date().optional(),
});

export const listReposResponseSchema = repositoryQuerySchema.array();

export const listReposQueryParamsSchema = z.object({
    query: z
        .string()
        .describe("Filter repositories by name (case-insensitive)")
        .optional(),
    page: z
        .number()
        .int()
        .positive()
        .describe("Page number for pagination (min 1). Default: 1")
        .optional()
        .default(1),
    perPage: z
        .number()
        .int()
        .positive()
        .max(100)
        .describe("Results per page for pagination (min 1, max 100). Default: 30")
        .optional()
        .default(30),
    sort: z
        .enum(['name', 'pushed'])
        .describe("Sort repositories by 'name' or 'pushed' (most recent commit). Default: 'name'")
        .optional()
        .default('name'),
    direction: z
        .enum(['asc', 'desc'])
        .describe("Sort direction: 'asc' or 'desc'. Default: 'asc'")
        .optional()
        .default('asc'),
});

export const fileSourceRequestSchema = z.object({
    repo: z
        .string()
        .describe("The repository name."),
    path: z
        .string()
        .describe("The path to the file."),
    ref: z
        .string()
        .optional()
        .describe("Commit SHA, branch or tag name to fetch the source code for. If not provided, uses the default branch of the repository."),
});

export const fileSourceResponseSchema = z.object({
    source: z.string(),
    language: z.string(),
    path: z.string(),
    repo: z.string(),
    repoCodeHostType: z.string(),
    repoDisplayName: z.string().optional(),
    repoExternalWebUrl: z.string().optional(),
    webUrl: z.string(),
    externalWebUrl: z.string().optional(),
});

export const serviceErrorSchema = z.object({
    statusCode: z.number(),
    errorCode: z.string(),
    message: z.string(),
});

export const listCommitsQueryParamsSchema = z.object({
    repo: z
        .string()
        .describe("The name of the repository to list commits for."),
    query: z
        .string()
        .describe("Search query to filter commits by message content (case-insensitive).")
        .optional(),
    since: z
        .string()
        .describe(`Show commits more recent than this date. Filters by actual commit time. Supports ISO 8601 (e.g., '2024-01-01') or relative formats (e.g., '30 days ago', 'last week').`)
        .optional(),
    until: z
        .string()
        .describe(`Show commits older than this date. Filters by actual commit time. Supports ISO 8601 (e.g., '2024-12-31') or relative formats (e.g., 'yesterday').`)
        .optional(),
    author: z
        .string()
        .describe(`Filter commits by author name or email (case-insensitive).`)
        .optional(),
    ref: z
        .string()
        .describe("Commit SHA, branch or tag name to list commits of. If not provided, uses the default branch of the repository.")
        .optional(),
    page: z
        .number()
        .int()
        .positive()
        .describe("Page number for pagination (min 1). Default: 1")
        .optional()
        .default(1),
    perPage: z
        .number()
        .int()
        .positive()
        .max(100)
        .describe("Results per page for pagination (min 1, max 100). Default: 50")
        .optional()
        .default(50),
});

export const listCommitsResponseSchema = z.array(z.object({
    hash: z.string(),
    date: z.string(),
    message: z.string(),
    refs: z.string(),
    body: z.string(),
    author_name: z.string(),
    author_email: z.string(),
}));
