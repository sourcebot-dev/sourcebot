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

// Agent configs
const publicAgentConfigSettingsSchema = z.object({
    autoReviewEnabled: z.boolean().optional().describe('Whether the agent automatically reviews new PRs/MRs. Overrides the REVIEW_AGENT_AUTO_REVIEW_ENABLED env var.'),
    reviewCommand: z.string().optional().describe('Comment command that triggers a manual review (without the leading /). Overrides the REVIEW_AGENT_REVIEW_COMMAND env var.'),
    model: z.string().optional().describe('Display name of the language model to use for this config. Overrides the REVIEW_AGENT_MODEL env var.'),
}).openapi('PublicAgentConfigSettings');

const publicAgentConfigRepoSchema = z.object({
    id: z.number().int(),
    displayName: z.string().nullable(),
    external_id: z.string(),
    external_codeHostType: z.string(),
}).openapi('PublicAgentConfigRepo');

const publicAgentConfigConnectionSchema = z.object({
    id: z.number().int(),
    name: z.string(),
    connectionType: z.string(),
}).openapi('PublicAgentConfigConnection');

export const publicAgentConfigSchema = z.object({
    id: z.string(),
    orgId: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    type: z.enum(['CODE_REVIEW']),
    enabled: z.boolean(),
    prompt: z.string().nullable().describe('Custom prompt instructions. Null uses the built-in rules only.'),
    promptMode: z.enum(['REPLACE', 'APPEND']).describe('Whether the custom prompt replaces or appends to the built-in rules.'),
    scope: z.enum(['ORG', 'CONNECTION', 'REPO']).describe('What this config is scoped to.'),
    repos: z.array(z.object({
        agentConfigId: z.string(),
        repoId: z.number().int(),
        repo: publicAgentConfigRepoSchema,
    })),
    connections: z.array(z.object({
        agentConfigId: z.string(),
        connectionId: z.number().int(),
        connection: publicAgentConfigConnectionSchema,
    })),
    settings: publicAgentConfigSettingsSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('PublicAgentConfig');

export const publicAgentConfigListSchema = z.array(publicAgentConfigSchema).openapi('PublicAgentConfigList');

export const publicCreateAgentConfigBodySchema = z.object({
    name: z.string().min(1).max(255).describe('Unique name for this agent config within the org.'),
    description: z.string().optional().describe('Optional description.'),
    type: z.enum(['CODE_REVIEW']).describe('The type of agent.'),
    enabled: z.boolean().default(true).describe('Whether this config is active.'),
    prompt: z.string().optional().describe('Custom prompt instructions.'),
    promptMode: z.enum(['REPLACE', 'APPEND']).default('APPEND').describe('How the custom prompt interacts with the built-in rules.'),
    scope: z.enum(['ORG', 'CONNECTION', 'REPO']).describe('What this config is scoped to.'),
    repoIds: z.array(z.number().int().positive()).optional().describe('Required when scope is REPO.'),
    connectionIds: z.array(z.number().int().positive()).optional().describe('Required when scope is CONNECTION.'),
    settings: publicAgentConfigSettingsSchema.optional().describe('Per-config overrides for model, auto-review, and review command.'),
}).openapi('PublicCreateAgentConfigBody');

export const publicUpdateAgentConfigBodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    type: z.enum(['CODE_REVIEW']).optional(),
    enabled: z.boolean().optional(),
    prompt: z.string().nullable().optional(),
    promptMode: z.enum(['REPLACE', 'APPEND']).optional(),
    scope: z.enum(['ORG', 'CONNECTION', 'REPO']).optional(),
    repoIds: z.array(z.number().int().positive()).optional(),
    connectionIds: z.array(z.number().int().positive()).optional(),
    settings: publicAgentConfigSettingsSchema.optional(),
}).openapi('PublicUpdateAgentConfigBody');

export const publicDeleteAgentConfigResponseSchema = z.object({
    success: z.boolean(),
}).openapi('PublicDeleteAgentConfigResponse');

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

