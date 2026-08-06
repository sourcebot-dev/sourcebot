import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    generateScopedAccessToken: vi.fn(),
}));

vi.mock('@/middleware/sew', () => ({
    sew: (callback: () => unknown) => callback(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));

vi.mock('@sourcebot/shared', () => ({
    generateScopedAccessToken: mocks.generateScopedAccessToken,
}));

const {
    createScopedAccessToken,
    createScopedAccessTokenRequestSchema,
    revokeScopedAccessToken,
} = await import('./api');
const { withAuth } = await import('@/middleware/withAuth');

const NOW = new Date('2026-08-06T04:00:00.000Z');
const REPO_A_ID = 11;
const REPO_B_ID = 22;

function createPrismaMock(
    repositories: Array<{ id: number }>,
    deletedTokenCount = 1,
) {
    const scopedAccessTokenCreate = vi.fn().mockImplementation(async ({
        data,
    }: {
        data: { createdAt: Date; expiresAt: Date };
    }) => ({
        id: 'token-id',
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
    }));

    return {
        repo: {
            findMany: vi.fn().mockResolvedValue(repositories),
        },
        scopedAccessToken: {
            create: scopedAccessTokenCreate,
            deleteMany: vi.fn().mockResolvedValue({ count: deletedTokenCount }),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.generateScopedAccessToken.mockReturnValue({
        token: 'sbst_secret',
        hash: 'token-hash',
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('createScopedAccessTokenRequestSchema', () => {
    test('accepts only a non-empty repoIds array of positive integers', () => {
        expect(createScopedAccessTokenRequestSchema.safeParse({ repoIds: [REPO_A_ID] }).success).toBe(true);
        expect(createScopedAccessTokenRequestSchema.safeParse({ repoIds: [] }).success).toBe(false);
        expect(createScopedAccessTokenRequestSchema.safeParse({ repos: [REPO_A_ID] }).success).toBe(false);
        expect(createScopedAccessTokenRequestSchema.safeParse({ repoIds: ['11'] }).success).toBe(false);
        expect(createScopedAccessTokenRequestSchema.safeParse({ repoIds: [0] }).success).toBe(false);
        expect(createScopedAccessTokenRequestSchema.safeParse({
            repoIds: [REPO_A_ID],
            expiresAt: '2026-08-06T05:00:00.000Z',
        }).success).toBe(false);
    });
});

describe('createScopedAccessToken', () => {
    test('creates an API-key-authenticated token with an exact one-hour lifetime', async () => {
        const prisma = createPrismaMock([
            { id: REPO_B_ID },
            { id: REPO_A_ID },
        ]);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            prisma,
        };

        await expect(createScopedAccessToken({ repoIds: [REPO_A_ID, REPO_B_ID] })).resolves.toEqual({
            id: 'token-id',
            token: 'sbst_secret',
            createdAt: '2026-08-06T04:00:00.000Z',
            expiresAt: '2026-08-06T05:00:00.000Z',
            repoIds: [REPO_A_ID, REPO_B_ID],
        });
        expect(withAuth).toHaveBeenCalledWith(expect.any(Function), {
            requiredAuthSource: 'api_key',
        });
        expect(prisma.repo.findMany).toHaveBeenCalledWith({
            where: {
                orgId: 1,
                id: { in: [REPO_A_ID, REPO_B_ID] },
            },
            select: {
                id: true,
            },
        });
        expect(prisma.scopedAccessToken.create).toHaveBeenCalledWith({
            data: {
                hash: 'token-hash',
                createdAt: NOW,
                expiresAt: new Date('2026-08-06T05:00:00.000Z'),
                createdById: 'user-id',
                orgId: 1,
                repos: {
                    create: [{ repoId: 11 }, { repoId: 22 }],
                },
            },
            select: {
                id: true,
                createdAt: true,
                expiresAt: true,
            },
        });
    });

    test('rejects the entire request before generating a token when a repo is inaccessible or missing', async () => {
        const prisma = createPrismaMock([{ id: REPO_A_ID }]);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            prisma,
        };

        await expect(createScopedAccessToken({ repoIds: [REPO_A_ID, REPO_B_ID] })).resolves.toEqual({
            statusCode: 400,
            errorCode: 'INVALID_REPOSITORY_SCOPE',
            message: 'Each repository ID must identify an accessible repository.',
        });
        expect(mocks.generateScopedAccessToken).not.toHaveBeenCalled();
        expect(prisma.scopedAccessToken.create).not.toHaveBeenCalled();
    });

    test('normalizes duplicate repository IDs before lookup and persistence', async () => {
        const prisma = createPrismaMock([{ id: REPO_A_ID }]);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            prisma,
        };

        await expect(createScopedAccessToken({ repoIds: [REPO_A_ID, REPO_A_ID] })).resolves.toMatchObject({
            repoIds: [REPO_A_ID],
        });
        expect(prisma.repo.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                orgId: 1,
                id: { in: [REPO_A_ID] },
            },
        }));
        expect(prisma.scopedAccessToken.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                repos: {
                    create: [{ repoId: REPO_A_ID }],
                },
            }),
        }));
    });
});

describe('revokeScopedAccessToken', () => {
    test('deletes only a token owned by the API-key user in the current org', async () => {
        const prisma = createPrismaMock([]);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            prisma,
        };

        await expect(revokeScopedAccessToken('token-id')).resolves.toEqual({ success: true });
        expect(withAuth).toHaveBeenCalledWith(expect.any(Function), {
            requiredAuthSource: 'api_key',
        });
        expect(prisma.scopedAccessToken.deleteMany).toHaveBeenCalledWith({
            where: {
                id: 'token-id',
                createdById: 'user-id',
                orgId: 1,
            },
        });
    });

    test('returns the same not-found response when no owned token is deleted', async () => {
        const prisma = createPrismaMock([], 0);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            prisma,
        };

        await expect(revokeScopedAccessToken('unknown-or-unowned')).resolves.toEqual({
            statusCode: 404,
            errorCode: 'SCOPED_ACCESS_TOKEN_NOT_FOUND',
            message: 'Scoped access token not found.',
        });
    });
});
