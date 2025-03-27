import { checkIfOrgDomainExists } from "@/actions";
import { RepoIndexingStatus } from "@sourcebot/db";
import { z } from "zod";
import { isServiceError } from "./utils";
export const searchRequestSchema = z.object({
    query: z.string(),
    maxMatchDisplayCount: z.number(),
    whole: z.boolean().optional(),
});


// @see : https://github.com/sourcebot-dev/zoekt/blob/main/api.go#L212
export const locationSchema = z.object({
    // 0-based byte offset from the beginning of the file
    ByteOffset: z.number(),
    // 1-based line number from the beginning of the file
    LineNumber: z.number(),
    // 1-based column number (in runes) from the beginning of line
    Column: z.number(),
});

export const rangeSchema = z.object({
    Start: locationSchema,
    End: locationSchema,
});

// @see : https://github.com/sourcebot-dev/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L350
export const searchResponseStats = {
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

export const symbolSchema = z.object({
    Sym: z.string(),
    Kind: z.string(),
    Parent: z.string(),
    ParentKind: z.string(),
});

// @see : https://github.com/sourcebot-dev/zoekt/blob/3780e68cdb537d5a7ed2c84d9b3784f80c7c5d04/api.go#L497
export const zoektSearchResponseSchema = z.object({
    Result: z.object({
        ...searchResponseStats,
        Files: z.array(z.object({
            FileName: z.string(),
            Repository: z.string(),
            Version: z.string().optional(),
            Language: z.string(),
            Branches: z.array(z.string()).optional(),
            ChunkMatches: z.array(z.object({
                Content: z.string(),
                Ranges: z.array(rangeSchema),
                FileName: z.boolean(),
                ContentStart: locationSchema,
                Score: z.number(),
                SymbolInfo: z.array(symbolSchema).nullable(),
            })),
            Checksum: z.string(),
            Score: z.number(),
            // Set if `whole` is true.
            Content: z.string().optional(),
        })).nullable(),
        RepoURLs: z.record(z.string(), z.string()),
    }),
});

export const searchResponseSchema = z.object({
    ...zoektSearchResponseSchema.shape,
    // Flag when a branch filter was used (e.g., `branch:`, `revision:`, etc.).
    isBranchFilteringEnabled: z.boolean(),
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
