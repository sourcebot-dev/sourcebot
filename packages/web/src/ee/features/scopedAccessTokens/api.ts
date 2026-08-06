import { ErrorCode } from '@/lib/errorCodes';
import type { ServiceError } from '@/lib/serviceError';
import { sew } from '@/middleware/sew';
import { withAuth } from '@/middleware/withAuth';
import { generateScopedAccessToken } from '@sourcebot/shared';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

const SCOPED_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

export const createScopedAccessTokenRequestSchema = z.object({
    repos: z.array(z.string().min(1)).min(1),
}).strict();

export type CreateScopedAccessTokenRequest = z.infer<typeof createScopedAccessTokenRequestSchema>;

export interface CreateScopedAccessTokenResponse {
    id: string;
    token: string;
    createdAt: string;
    expiresAt: string;
    repos: string[];
}

export interface RevokeScopedAccessTokenResponse {
    success: true;
}

export const createScopedAccessToken = async (
    request: CreateScopedAccessTokenRequest,
): Promise<CreateScopedAccessTokenResponse | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        // Treat duplicate names as one scope entry while preserving request order.
        const repositoryNames = [...new Set(request.repos)];
        const repositories = await prisma.repo.findMany({
            where: {
                orgId: org.id,
                name: { in: repositoryNames },
            },
            select: {
                id: true,
                name: true,
            },
        });

        const repositoriesByName = new Map<string, typeof repositories>();
        for (const repository of repositories) {
            const matches = repositoriesByName.get(repository.name) ?? [];
            matches.push(repository);
            repositoriesByName.set(repository.name, matches);
        }

        const resolvedRepositories: typeof repositories = [];
        for (const repositoryName of repositoryNames) {
            const matches = repositoriesByName.get(repositoryName);
            if (matches?.length !== 1) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REPOSITORY_SCOPE,
                    message: "Each repository name must identify exactly one accessible repository.",
                } satisfies ServiceError;
            }
            resolvedRepositories.push(matches[0]);
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
                    create: resolvedRepositories.map(({ id }) => ({ repoId: id })),
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
            repos: repositoryNames,
        } satisfies CreateScopedAccessTokenResponse;
    }, { requiredAuthSource: 'api_key' })
);

export const revokeScopedAccessToken = async (
    id: string,
): Promise<RevokeScopedAccessTokenResponse | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
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
