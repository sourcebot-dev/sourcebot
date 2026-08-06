import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    createAudit: vi.fn(),
    createZoektSearchRequest: vi.fn(),
    env: {} as Record<string, string>,
    hasEntitlement: vi.fn(),
    zoektSearch: vi.fn(),
    zoektStreamSearch: vi.fn(),
}));

vi.mock('@/middleware/sew', () => ({
    sew: (callback: () => unknown) => callback(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));

vi.mock('@/ee/features/audit/audit', () => ({
    createAudit: mocks.createAudit,
}));

vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

vi.mock('@sourcebot/shared', () => ({
    env: mocks.env,
}));

vi.mock('next/headers', () => ({
    headers: vi.fn(async () => new Headers()),
}));

vi.mock('./parser', () => ({
    parseQuerySyntaxIntoIR: vi.fn(),
}));

vi.mock('./zoektSearcher', () => ({
    createZoektSearchRequest: mocks.createZoektSearchRequest,
    zoektSearch: mocks.zoektSearch,
    zoektStreamSearch: mocks.zoektStreamSearch,
}));

const { search, streamSearch } = await import('./searchApi');

const query = {} as never;
const request = {
    queryType: 'ir' as const,
    query,
    options: { matches: 10 },
};

function createPrismaMock(repositoryNames: string[]) {
    return {
        repo: {
            findMany: vi.fn().mockResolvedValue(
                repositoryNames.map((name) => ({ name })),
            ),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mocks.env).forEach((key) => delete mocks.env[key]);
    mocks.createAudit.mockResolvedValue(undefined);
    mocks.createZoektSearchRequest.mockImplementation(async (input) => input);
    mocks.zoektSearch.mockResolvedValue({ files: [] });
    mocks.zoektStreamSearch.mockResolvedValue('stream-result');
    mocks.hasEntitlement.mockResolvedValue(false);
});

describe('scoped access token search filtering', () => {
    test('passes the scoped Prisma repository names to blocking search when permission syncing is disabled', async () => {
        const prisma = createPrismaMock(['github.com/acme/a', 'github.com/acme/b']);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            principal: {
                source: 'scoped_access_token',
                credentialId: 'token-id',
                orgId: 1,
                repositoryIds: [11, 22],
                expiresAt: new Date('2026-08-06T05:00:00.000Z'),
            },
            prisma,
        };

        await search(request);

        expect(prisma.repo.findMany).toHaveBeenCalledWith({
            select: { name: true },
        });
        expect(mocks.createZoektSearchRequest).toHaveBeenCalledWith(expect.objectContaining({
            repoSearchScope: {
                kind: 'repos',
                repos: ['github.com/acme/a', 'github.com/acme/b'],
            },
        }));
        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
    });

    test('passes an empty repository scope to streaming search instead of treating it as unrestricted', async () => {
        const prisma = createPrismaMock([]);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            principal: {
                source: 'scoped_access_token',
                credentialId: 'token-id',
                orgId: 1,
                repositoryIds: [],
                expiresAt: new Date('2026-08-06T05:00:00.000Z'),
            },
            prisma,
        };

        await streamSearch(request);

        expect(mocks.createZoektSearchRequest).toHaveBeenCalledWith(expect.objectContaining({
            repoSearchScope: {
                kind: 'repos',
                repos: [],
            },
        }));
    });

    test('preserves unrestricted search for API keys when permission syncing is disabled', async () => {
        const prisma = createPrismaMock(['github.com/acme/a']);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            principal: { source: 'api_key' },
            prisma,
        };

        await search(request);

        expect(prisma.repo.findMany).not.toHaveBeenCalled();
        expect(mocks.createZoektSearchRequest).toHaveBeenCalledWith(expect.objectContaining({
            repoSearchScope: { kind: 'all' },
        }));
    });

    test('passes the scoped Prisma repository names for API keys when permission syncing is enabled', async () => {
        const prisma = createPrismaMock(['github.com/acme/a']);
        mocks.env.PERMISSION_SYNC_ENABLED = 'true';
        mocks.hasEntitlement.mockResolvedValue(true);
        mocks.authContext = {
            org: { id: 1 },
            user: { id: 'user-id' },
            principal: { source: 'api_key' },
            prisma,
        };

        await search(request);

        expect(prisma.repo.findMany).toHaveBeenCalledWith({
            select: { name: true },
        });
        expect(mocks.createZoektSearchRequest).toHaveBeenCalledWith(expect.objectContaining({
            repoSearchScope: {
                kind: 'repos',
                repos: ['github.com/acme/a'],
            },
        }));
    });
});
