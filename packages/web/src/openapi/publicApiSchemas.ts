import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { CodeHostType } from '@sourcebot/db';
import z from 'zod';
import {
    fileSourceRequestSchema,
    fileSourceResponseSchema,
    getFilesRequestSchema,
    getFilesResponseSchema,
    getTreeRequestSchema,
} from '../features/git/schemas.js';
import {
    searchRequestSchema,
    searchResponseSchema,
    streamedSearchResponseSchema,
} from '../features/search/types.js';
import { serviceErrorSchema } from '../lib/serviceError.js';

let hasExtendedZod = false;

if (!hasExtendedZod) {
    extendZodWithOpenApi(z);
    hasExtendedZod = true;
}

export const publicServiceErrorSchema = serviceErrorSchema.openapi('PublicApiServiceError', {
    description: 'Structured error response returned by Sourcebot public API endpoints.',
});

export const publicSearchRequestSchema = searchRequestSchema.openapi('PublicSearchRequest');
export const publicSearchResponseSchema = searchResponseSchema.openapi('PublicSearchResponse');
export const publicStreamedSearchEventSchema = streamedSearchResponseSchema.openapi('PublicStreamedSearchEvent');

export const publicGetTreeRequestSchema = getTreeRequestSchema.openapi('PublicGetTreeRequest');

export const publicGetFilesRequestSchema = getFilesRequestSchema.openapi('PublicGetFilesRequest');
export const publicGetFilesResponseSchema = getFilesResponseSchema.openapi('PublicGetFilesResponse');

export const publicFileSourceRequestSchema = fileSourceRequestSchema.openapi('PublicFileSourceRequest');
export const publicFileSourceResponseSchema = fileSourceResponseSchema.openapi('PublicFileSourceResponse');

export const publicVersionResponseSchema = z.object({
    version: z.string().openapi({
        description: 'Running Sourcebot version.',
        example: 'v4.15.2',
    }),
}).openapi('PublicVersionResponse');

export const publicRepositorySchema = z.object({
    codeHostType: z.nativeEnum(CodeHostType),
    repoId: z.number(),
    repoName: z.string(),
    webUrl: z.string(),
    repoDisplayName: z.string().optional(),
    externalWebUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    indexedAt: z.string().datetime().optional(),
    pushedAt: z.string().datetime().optional(),
    defaultBranch: z.string().optional(),
    isFork: z.boolean(),
    isArchived: z.boolean(),
}).openapi('PublicRepository');

export const publicListReposQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(30),
    sort: z.enum(['name', 'pushed']).default('name'),
    direction: z.enum(['asc', 'desc']).default('asc'),
    query: z.string().optional(),
}).openapi('PublicListReposQuery');

export const publicListReposResponseSchema = z.array(publicRepositorySchema).openapi('PublicListReposResponse');

export const publicStreamSearchSseSchema = z.string().openapi('PublicStreamSearchSse', {
    description: 'Server-sent event stream. Each data frame contains one JSON object matching PublicStreamedSearchEvent.',
    example: 'data: {"type":"chunk","stats":{"actualMatchCount":1}}\n\n',
});
