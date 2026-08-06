import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
}));

vi.mock('@/middleware/sew', () => ({
    sew: (callback: () => unknown) => callback(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: vi.fn((callback: (context: unknown) => unknown) => callback(mocks.authContext)),
}));

vi.mock('@/ee/features/audit/audit', () => ({
    createAudit: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    env: { AUTH_URL: 'https://sourcebot.example.com' },
}));

vi.mock('next/headers', () => ({
    headers: vi.fn(async () => new Headers()),
}));

const { listRepos } = await import('./listReposApi');
const { listReposQueryParamsSchema } = await import('@/lib/schemas');

function createPrismaMock() {
    return {
        repo: {
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('listRepos connection filtering', () => {
    test('filters both repositories and the total count by connection', async () => {
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 7 },
            user: undefined,
            prisma,
        };

        await listRepos({
            page: 2,
            perPage: 20,
            sort: 'name',
            direction: 'asc',
            query: 'sourcebot',
            connectionId: 42,
        });

        const where = {
            orgId: 7,
            name: { contains: 'sourcebot', mode: 'insensitive' },
            connections: {
                some: { connectionId: 42 },
            },
        };
        expect(prisma.repo.findMany).toHaveBeenCalledWith({
            where,
            skip: 20,
            take: 20,
            orderBy: { name: 'asc' },
        });
        expect(prisma.repo.count).toHaveBeenCalledWith({ where });
    });

    test('does not add a connection relation filter when none is requested', async () => {
        const prisma = createPrismaMock();
        mocks.authContext = {
            org: { id: 7 },
            user: undefined,
            prisma,
        };

        await listRepos({
            page: 1,
            perPage: 30,
            sort: 'name',
            direction: 'asc',
        });

        expect(prisma.repo.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { orgId: 7 },
        }));
        expect(prisma.repo.count).toHaveBeenCalledWith({
            where: { orgId: 7 },
        });
    });

    test('accepts a positive integer connectionId query parameter', () => {
        expect(listReposQueryParamsSchema.parse({ connectionId: '42' }).connectionId).toBe(42);
        expect(listReposQueryParamsSchema.safeParse({ connectionId: '0' }).success).toBe(false);
        expect(listReposQueryParamsSchema.safeParse({ connectionId: '1.5' }).success).toBe(false);
    });
});
