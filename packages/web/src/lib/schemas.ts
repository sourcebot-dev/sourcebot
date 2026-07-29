import { z } from "zod";
import { CodeHostType, ConnectionSyncJobStatus, ConnectionType } from "@sourcebot/db";

export const repositoryQuerySchema = z.object({
    codeHostType: z.nativeEnum(CodeHostType),
    repoId: z.number(),
    repoName: z.string(),
    webUrl: z.string(),
    repoDisplayName: z.string().optional(),
    externalWebUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    indexedAt: z.coerce.date().optional(),
    pushedAt: z.coerce.date().optional(),
    defaultBranch: z.string().optional(),
    isFork: z.boolean(),
    isArchived: z.boolean(),
});

export const searchContextQuerySchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().optional(),
    repoNames: z.array(z.string()),
});

export const verifyCredentialsRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export const getVersionResponseSchema = z.object({
    version: z.string(),
});

export const listReposQueryParamsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(30),
    sort: z.enum(['name', 'pushed']).default('name'),
    direction: z.enum(['asc', 'desc']).default('asc'),
    query: z.string().optional(),
});

export const listReposResponseSchema = repositoryQuerySchema.array();

export const listConnectionsQueryParamsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(50),
});

export const connectionSummarySchema = z.object({
    id: z.number(),
    name: z.string(),
    connectionType: z.nativeEnum(ConnectionType),
    isDeclarative: z.boolean(),
    syncedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    repoCount: z.number().int().nonnegative(),
    inFlightJobCount: z.number().int().nonnegative(),
    latestJob: z.object({
        id: z.string(),
        status: z.nativeEnum(ConnectionSyncJobStatus),
        createdAt: z.coerce.date(),
        completedAt: z.coerce.date().nullable(),
        errorMessage: z.string().nullable(),
    }).nullable(),
});

export const listConnectionsResponseSchema = z.object({
    connections: z.array(connectionSummarySchema),
});

export const getConnectionQueryParamsSchema = z.object({
    jobLimit: z.coerce.number().int().positive().max(50).default(10),
});

export const connectionJobSchema = z.object({
    id: z.string(),
    status: z.nativeEnum(ConnectionSyncJobStatus),
    createdAt: z.coerce.date(),
    completedAt: z.coerce.date().nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    errorMessage: z.string().nullable(),
    warningMessages: z.array(z.string()),
});

export const getConnectionResponseSchema = z.object({
    connection: connectionSummarySchema.omit({
        latestJob: true,
    }).extend({
        latestJob: connectionJobSchema.nullable(),
    }),
    recentJobs: z.array(connectionJobSchema),
});