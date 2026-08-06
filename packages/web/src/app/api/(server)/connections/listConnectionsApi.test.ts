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

const { listConnections } = await import('./listConnectionsApi');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('listConnections', () => {
    test('returns unique connections from repositories visible through the scoped Prisma client', async () => {
        const findMany = vi.fn().mockResolvedValue([
            {
                connections: [
                    {
                        connection: {
                            id: 2,
                            name: 'GitLab',
                            connectionType: 'gitlab',
                        },
                    },
                ],
            },
            {
                connections: [
                    {
                        connection: {
                            id: 1,
                            name: 'GitHub',
                            connectionType: 'github',
                        },
                    },
                    {
                        connection: {
                            id: 2,
                            name: 'GitLab',
                            connectionType: 'gitlab',
                        },
                    },
                ],
            },
        ]);
        mocks.authContext = {
            org: { id: 1 },
            prisma: {
                repo: { findMany },
            },
        };

        const result = await listConnections();

        expect(findMany).toHaveBeenCalledWith({
            where: {
                orgId: 1,
            },
            select: {
                connections: {
                    select: {
                        connection: {
                            select: {
                                id: true,
                                name: true,
                                connectionType: true,
                            },
                        },
                    },
                },
            },
        });
        expect(result).toEqual([
            { id: 1, name: 'GitHub', connectionType: 'github' },
            { id: 2, name: 'GitLab', connectionType: 'gitlab' },
        ]);
    });

    test('returns an empty list when no visible repositories have connections', async () => {
        mocks.authContext = {
            org: { id: 1 },
            prisma: {
                repo: {
                    findMany: vi.fn().mockResolvedValue([]),
                },
            },
        };

        await expect(listConnections()).resolves.toEqual([]);
    });
});
