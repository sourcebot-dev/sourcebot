import { ErrorCode } from '@/lib/errorCodes';
import { hasEntitlement } from '@/lib/entitlements';
import type { ServiceError } from '@/lib/serviceError';
import { sew } from '@/middleware/sew';
import { withAuth } from '@/middleware/withAuth';
import { generateScopedAccessToken } from '@sourcebot/shared';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

const SCOPED_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

export const createScopedAccessTokenRequestSchema = z.object({
    repoIds: z.array(z.number().int().positive()).min(1),
}).strict();

export type CreateScopedAccessTokenRequest = z.infer<typeof createScopedAccessTokenRequestSchema>;

export interface CreateScopedAccessTokenResponse {
    id: string;
    token: string;
    createdAt: string;
    expiresAt: string;
    repoIds: number[];
}

export interface RevokeScopedAccessTokenResponse {
    success: true;
}

const checkScopedAccessTokenEntitlement = async (): Promise<ServiceError | null> => {
    if (await hasEntitlement('scoped-access-tokens')) {
        return null;
    }

    return {
        statusCode: StatusCodes.FORBIDDEN,
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'Scoped access tokens are not available in your current plan.',
    } satisfies ServiceError;
};

export const createScopedAccessToken = async (
    request: CreateScopedAccessTokenRequest,
): Promise<CreateScopedAccessTokenResponse | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const entitlementError = await checkScopedAccessTokenEntitlement();
        if (entitlementError) {
            return entitlementError;
        }

        // Treat duplicate IDs as one scope entry while preserving request order.
        const repositoryIds = [...new Set(request.repoIds)];
        const repositories = await prisma.repo.findMany({
            where: {
                orgId: org.id,
                id: { in: repositoryIds },
            },
            select: {
                id: true,
            },
        });

        if (repositories.length !== repositoryIds.length) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REPOSITORY_SCOPE,
                message: 'Each repository ID must identify an accessible repository.',
            } satisfies ServiceError;
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + SCOPED_ACCESS_TOKEN_TTL_MS);
        const { token, hash } = generateScopedAccessToken();
        const createdToken = await prisma.scopedAccessToken.create({
            data: {
                hash,
                createdAt: now,
                expiresAt,
                createdById: user.id,
                orgId: org.id,
                repos: {
                    create: repositoryIds.map((repoId) => ({ repoId })),
                },
            },
            select: {
                id: true,
                createdAt: true,
                expiresAt: true,
            },
        });

        return {
            id: createdToken.id,
            token,
            createdAt: createdToken.createdAt.toISOString(),
            expiresAt: createdToken.expiresAt.toISOString(),
            repoIds: repositoryIds,
        } satisfies CreateScopedAccessTokenResponse;
    }, { requiredAuthSource: 'api_key' })
);

export const revokeScopedAccessToken = async (
    id: string,
): Promise<RevokeScopedAccessTokenResponse | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const entitlementError = await checkScopedAccessTokenEntitlement();
        if (entitlementError) {
            return entitlementError;
        }

        const { count } = await prisma.scopedAccessToken.deleteMany({
            where: {
                id,
                createdById: user.id,
                orgId: org.id,
            },
        });

        if (count === 0) {
            return {
                statusCode: StatusCodes.NOT_FOUND,
                errorCode: ErrorCode.SCOPED_ACCESS_TOKEN_NOT_FOUND,
                message: 'Scoped access token not found.',
            } satisfies ServiceError;
        }

        return { success: true } satisfies RevokeScopedAccessTokenResponse;
    }, { requiredAuthSource: 'api_key' })
);
