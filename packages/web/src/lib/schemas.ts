import { checkIfOrgDomainExists } from "@/actions";
import { RepoIndexingStatus } from "@sourcebot/db";
import { z } from "zod";
import { isServiceError } from "./utils";

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
        repository: z.string(),
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
    repoUrlTemplates: z.record(z.string(), z.string()),
    isBranchFilteringEnabled: z.boolean(),
})

export const fileSourceRequestSchema = z.object({
    fileName: z.string(),
    repository: z.string(),
    branch: z.string().optional(),
});

export const fileSourceResponseSchema = z.object({
    source: z.string(),
    language: z.string(),
});

export const secretCreateRequestSchema = z.object({
    key: z.string(),
    value: z.string(),
});

export const secreteDeleteRequestSchema = z.object({
    key: z.string(),
});


// @see : https://github.com/sourcebot-dev/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L728
const repoStatsSchema = z.object({
    Repos: z.number(),
    Shards: z.number(),
    Documents: z.number(),
    IndexBytes: z.number(),
    ContentBytes: z.number(),
    NewLinesCount: z.number(),
    DefaultBranchNewLinesCount: z.number(),
    OtherBranchesNewLinesCount: z.number(),
});

// @see : https://github.com/sourcebot-dev/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L716
const indexMetadataSchema = z.object({
    IndexFormatVersion: z.number(),
    IndexFeatureVersion: z.number(),
    IndexMinReaderVersion: z.number(),
    IndexTime: z.string(),
    PlainASCII: z.boolean(),
    LanguageMap: z.record(z.string(), z.number()),
    ZoektVersion: z.string(),
    ID: z.string(),
});

// @see : https://github.com/sourcebot-dev/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L555
export const repositorySchema = z.object({
    Name: z.string(),
    URL: z.string(),
    Source: z.string(),
    Branches: z.array(z.object({
        Name: z.string(),
        Version: z.string(),
    })).nullable(),
    CommitURLTemplate: z.string(),
    FileURLTemplate: z.string(),
    LineFragmentTemplate: z.string(),
    RawConfig: z.record(z.string(), z.string()).nullable(),
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
            Stats: repoStatsSchema,
        })),
        Stats: repoStatsSchema,
    })
});
export const repositoryQuerySchema = z.object({
    codeHostType: z.string(),
    repoId: z.number(),
    repoName: z.string(),
    repoDisplayName: z.string().optional(),
    repoCloneUrl: z.string(),
    webUrl: z.string().optional(),
    linkedConnections: z.array(z.object({
        id: z.number(),
        name: z.string(),
    })),
    imageUrl: z.string().optional(),
    indexedAt: z.date().optional(),
    repoIndexingStatus: z.nativeEnum(RepoIndexingStatus),
});

export const verifyCredentialsRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export const orgNameSchema = z.string().min(2, { message: "Organization name must be at least 3 characters long." });

export const orgDomainSchema = z.string()
    .min(2, { message: "Url must be at least 3 characters long." })
    .max(50, { message: "Url must be at most 50 characters long." })
    .regex(/^[a-z][a-z-]*[a-z]$/, {
        message: "Url must start and end with a letter, and can only contain lowercase letters and dashes.",
    })
    .refine((domain) => {
        const reserved = [
            'api',
            'login',
            'signup',
            'onboard',
            'redeem',
            'account',
            'settings',
            'staging',
            'support',
            'docs',
            'blog',
            'contact',
            'status'
        ];
        return !reserved.includes(domain);
    }, "This url is reserved for internal use.")
    .refine(async (domain) => {
        const doesDomainExist = await checkIfOrgDomainExists(domain);
        return isServiceError(doesDomainExist) || !doesDomainExist;
    }, "This url is already taken.");

export const getVersionResponseSchema = z.object({
    version: z.string(),
});
