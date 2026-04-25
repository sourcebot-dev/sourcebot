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

// EE: User Management
export const publicEeUserSchema = z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('PublicEeUser');

export const publicEeUserListItemSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    role: z.enum(['OWNER', 'MEMBER', 'GUEST']),
    createdAt: z.string().datetime(),
    lastActivityAt: z.string().datetime().nullable(),
}).openapi('PublicEeUserListItem');

export const publicEeUsersResponseSchema = z.array(publicEeUserListItemSchema).openapi('PublicEeUsersResponse');

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

