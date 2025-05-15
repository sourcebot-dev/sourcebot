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
})

export const searchResponseSchema = z.object({
    zoektStats: z.object({
        // The duration (in nanoseconds) of the search.
        duration: z.number(),
        fileCount: z.number(),
        matchCount: z.number(),
        filesSkipped: z.number(),
        contentBytesLoaded: z.number(),
        indexBytesLoaded: z.number(),
        crashes: z.number(),
        shardFilesConsidered: z.number(),
        filesConsidered: z.number(),
        filesLoaded: z.number(),
        shardsScanned: z.number(),
        shardsSkipped: z.number(),
        shardsSkippedFilter: z.number(),
        ngramMatches: z.number(),
        ngramLookups: z.number(),
        wait: z.number(),
        matchTreeConstruction: z.number(),
        matchTreeSearch: z.number(),
        regexpsConsidered: z.number(),
        flushReason: z.number(),
    }),
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
});

export const repositorySchema = z.object({
    name: z.string(),
    branches: z.array(z.string()),
    webUrl: z.string().optional(),
    rawConfig: z.record(z.string(), z.string()).optional(),
});

export const listRepositoriesResponseSchema = z.object({
    repos: z.array(repositorySchema),
});

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
