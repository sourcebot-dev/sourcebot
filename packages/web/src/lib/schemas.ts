import { z } from "zod";
import { CodeHostType } from "@sourcebot/db";

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