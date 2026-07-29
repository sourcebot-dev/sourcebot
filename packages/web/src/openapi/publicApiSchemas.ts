import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import z from 'zod';
import {
    findRelatedSymbolsRequestSchema,
    findRelatedSymbolsResponseSchema,
} from '../features/codeNav/types.js';
import {
    commitAuthorSchema,
    commitDetailSchema,
    commitSchema,
    fileBlameRequestSchema,
    fileBlameResponseSchema,
    fileSourceRequestSchema,
    fileSourceResponseSchema,
    getCommitQueryParamsSchema,
    getDiffRequestSchema,
    getDiffResponseSchema,
    getTreeRequestSchema,
    listCommitAuthorsQueryParamsSchema,
    listCommitsQueryParamsSchema,
} from '../features/git/schemas.js';
import {
    searchRequestSchema,
    searchResponseSchema,
} from '../features/search/types.js';
import { serviceErrorSchema } from '../lib/serviceError.js';
import { getVersionResponseSchema, listReposQueryParamsSchema, listReposResponseSchema } from '../lib/schemas.js';

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
export const publicGetTreeRequestSchema = getTreeRequestSchema.openapi('PublicGetTreeRequest');
export const publicFileSourceRequestSchema = fileSourceRequestSchema.openapi('PublicFileSourceRequest');
export const publicFileSourceResponseSchema = fileSourceResponseSchema.openapi('PublicFileSourceResponse');
export const publicFileBlameRequestSchema = fileBlameRequestSchema.openapi('PublicFileBlameRequest');
export const publicFileBlameResponseSchema = fileBlameResponseSchema.openapi('PublicFileBlameResponse');
export const publicVersionResponseSchema = getVersionResponseSchema.openapi('PublicVersionResponse');
export const publicListReposQueryParamsSchema = listReposQueryParamsSchema.openapi('PublicListReposQuery');
export const publicListReposResponseSchema = listReposResponseSchema.openapi('PublicListReposResponse');
export const publicGetDiffRequestSchema = getDiffRequestSchema.openapi('PublicGetDiffRequest');
export const publicGetDiffResponseSchema = getDiffResponseSchema.openapi('PublicGetDiffResponse');
export const publicFindSymbolsRequestSchema = findRelatedSymbolsRequestSchema.openapi('PublicFindSymbolsRequest');
export const publicFindSymbolsResponseSchema = findRelatedSymbolsResponseSchema.openapi('PublicFindSymbolsResponse');
export const publicListCommitsQuerySchema = listCommitsQueryParamsSchema.openapi('PublicListCommitsQuery');
export const publicCommitSchema = commitSchema.openapi('PublicCommit');
export const publicListCommitsResponseSchema = z.array(publicCommitSchema).openapi('PublicListCommitsResponse');
export const publicGetCommitQuerySchema = getCommitQueryParamsSchema.openapi('PublicGetCommitQuery');
export const publicCommitDetailSchema = commitDetailSchema.openapi('PublicCommitDetail');
export const publicListCommitAuthorsQuerySchema = listCommitAuthorsQueryParamsSchema.openapi('PublicListCommitAuthorsQuery');
export const publicCommitAuthorSchema = commitAuthorSchema.openapi('PublicCommitAuthor');
export const publicListCommitAuthorsResponseSchema = z.array(publicCommitAuthorSchema).openapi('PublicListCommitAuthorsResponse');

export const publicHealthResponseSchema = z.object({
    status: z.enum(['ok']),
}).openapi('PublicHealthResponse');

export const publicListConnectionsQueryParamsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(50),
}).openapi('PublicListConnectionsQuery');

export const publicConnectionLatestJobSchema = z.object({
    id: z.string(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    errorMessage: z.string().nullable(),
}).openapi('PublicConnectionLatestJob');

export const publicConnectionSummarySchema = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    connectionType: z.enum([
        'github',
        'gitlab',
        'gitea',
        'gerrit',
        'bitbucket-server',
        'bitbucket-cloud',
        'generic-git-host',
        'azuredevops',
    ]),
    isDeclarative: z.boolean(),
    syncedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    repoCount: z.number().int().nonnegative(),
    inFlightJobCount: z.number().int().nonnegative(),
    latestJob: publicConnectionLatestJobSchema.nullable(),
}).openapi('PublicConnectionSummary');

export const publicListConnectionsResponseSchema = z.object({
    connections: z.array(publicConnectionSummarySchema),
}).openapi('PublicListConnectionsResponse');

export const publicGetConnectionQueryParamsSchema = z.object({
    jobLimit: z.coerce.number().int().positive().max(50).default(10),
}).openapi('PublicGetConnectionQuery');

export const publicConnectionJobSchema = z.object({
    id: z.string(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    errorMessage: z.string().nullable(),
    warningMessages: z.array(z.string()),
}).openapi('PublicConnectionJob');

export const publicGetConnectionResponseSchema = z.object({
    connection: publicConnectionSummarySchema.extend({
        latestJob: publicConnectionJobSchema.nullable(),
    }),
    recentJobs: z.array(publicConnectionJobSchema),
}).openapi('PublicGetConnectionResponse');

// EE: User Management
export const publicEeUserSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    role: z.enum(['OWNER', 'MEMBER']),
    suspendedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastActivityAt: z.string().datetime().nullable(),
}).openapi('PublicEeUser');

export const publicEeUsersResponseSchema = z.array(publicEeUserSchema).openapi('PublicEeUsersResponse');

export const publicEeDeleteUserResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
}).openapi('PublicEeDeleteUserResponse');

// EE: Audit
export const publicEeAuditQuerySchema = z.object({
    since: z.string().datetime().optional().describe('Return records at or after this timestamp (ISO 8601).'),
    until: z.string().datetime().optional().describe('Return records at or before this timestamp (ISO 8601).'),
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(50),
}).openapi('PublicEeAuditQuery');

export const publicEeAuditRecordSchema = z.object({
    id: z.string(),
    timestamp: z.string().datetime(),
    action: z.string().describe('The audited action (e.g. `user.read`, `user.delete`, `audit.fetch`).'),
    actorId: z.string(),
    actorType: z.string(),
    targetId: z.string(),
    targetType: z.string(),
    sourcebotVersion: z.string(),
    metadata: z.record(z.unknown()).nullable(),
    orgId: z.number(),
}).openapi('PublicEeAuditRecord');

export const publicEeAuditResponseSchema = z.array(publicEeAuditRecordSchema).openapi('PublicEeAuditResponse');
