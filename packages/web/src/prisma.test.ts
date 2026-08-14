import type { UserWithAccounts } from '@sourcebot/db';
import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({
    default: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    env: { NODE_ENV: 'test' },
    getDBConnectionString: () => undefined,
}));

vi.mock('@/features/mcp/prismaScope', () => ({
    getMcpPrismaQueryExtension: () => ({}),
}));

const {
    getEffectiveRepoPermissionFilter,
    getRepoPermissionFilterForUser,
    intersectRepoWhere,
} = await import('./prisma');

const user = { accounts: [] } as unknown as UserWithAccounts;

describe('getEffectiveRepoPermissionFilter', () => {
    test('does not filter repositories when neither permission syncing nor a token scope applies', () => {
        expect(getEffectiveRepoPermissionFilter({
            user,
            hasPermissionSyncing: false,
        })).toBeUndefined();
    });

    test('enforces a token repository scope when permission syncing is disabled', () => {
        expect(getEffectiveRepoPermissionFilter({
            user,
            hasPermissionSyncing: false,
            repositoryIds: [11, 22],
        })).toEqual({
            id: { in: [11, 22] },
        });
    });

    test('intersects current user permissions with the token repository scope', () => {
        expect(getEffectiveRepoPermissionFilter({
            user,
            hasPermissionSyncing: true,
            repositoryIds: [11, 22],
        })).toEqual({
            AND: [
                getRepoPermissionFilterForUser(user),
                { id: { in: [11, 22] } },
            ],
        });
    });

    test('preserves an empty token scope as a match-nothing filter', () => {
        expect(getEffectiveRepoPermissionFilter({
            user,
            hasPermissionSyncing: false,
            repositoryIds: [],
        })).toEqual({
            id: { in: [] },
        });
    });
});

describe('intersectRepoWhere', () => {
    test('combines the caller filter and permission filter while preserving top-level fields', () => {
        expect(intersectRepoWhere(
            { OR: [{ name: 'repo-a' }, { name: 'repo-b' }] },
            { id: { in: [11] } },
        )).toEqual({
            OR: [{ name: 'repo-a' }, { name: 'repo-b' }],
            AND: [{ id: { in: [11] } }],
        });
    });

    test('preserves a unique identifier at the top level for findUnique operations', () => {
        expect(intersectRepoWhere(
            { id: 147 },
            { id: { in: [11, 147] } },
        )).toEqual({
            id: 147,
            AND: [{ id: { in: [11, 147] } }],
        });
    });

    test('preserves existing AND filters', () => {
        expect(intersectRepoWhere(
            {
                id: 147,
                AND: [{ name: 'github.com/airbnb/MaxScale' }],
            },
            { id: { in: [11, 147] } },
        )).toEqual({
            id: 147,
            AND: [
                { name: 'github.com/airbnb/MaxScale' },
                { id: { in: [11, 147] } },
            ],
        });
    });
});
