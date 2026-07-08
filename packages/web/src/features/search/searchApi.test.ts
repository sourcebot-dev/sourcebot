import { beforeEach, describe, expect, it, vi } from 'vitest';

import { search } from './searchApi';

const mocks = vi.hoisted(() => ({
    withOptionalAuth: vi.fn(),
    createAudit: vi.fn(),
    getRepoPermissionFilterForUser: vi.fn(),
    createZoektSearchRequest: vi.fn(),
    zoektSearch: vi.fn(),
    hasEntitlement: vi.fn(),
    env: { PERMISSION_SYNC_ENABLED: 'false' },
}));

vi.mock('@/middleware/sew', () => ({
    sew: (fn: () => unknown) => fn(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: mocks.withOptionalAuth,
}));

vi.mock('@/ee/features/audit/audit', () => ({
    createAudit: mocks.createAudit,
}));

vi.mock('@/prisma', () => ({
    getRepoPermissionFilterForUser: mocks.getRepoPermissionFilterForUser,
}));

vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

vi.mock('@sourcebot/shared', () => ({
    env: mocks.env,
}));

vi.mock('./zoektSearcher', () => ({
    createZoektSearchRequest: mocks.createZoektSearchRequest,
    zoektSearch: mocks.zoektSearch,
    zoektStreamSearch: vi.fn(),
}));

describe('searchApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.env.PERMISSION_SYNC_ENABLED = 'false';
        mocks.hasEntitlement.mockReturnValue(false);
        mocks.createAudit.mockResolvedValue(undefined);
        mocks.createZoektSearchRequest.mockResolvedValue({});
        mocks.zoektSearch.mockResolvedValue({});
        mocks.getRepoPermissionFilterForUser.mockReturnValue({ id: { not: null } });
    });

    it('when permission sync is disabled, search does not restrict repositories', async () => {
        const prisma = {
            repo: {
                findMany: vi.fn().mockResolvedValue([{ name: 'repo-a' }]),
            },
        } as any;

        mocks.withOptionalAuth.mockImplementation((handler: (context: any) => Promise<unknown>) => handler({
            prisma,
            user: undefined,
            org: { id: 1 },
        }));

        await search({
            queryType: 'ir',
            query: {} as any,
            options: {} as any,
        });

        expect(mocks.createZoektSearchRequest).toHaveBeenCalledWith(expect.objectContaining({
            repoSearchScope: undefined,
        }));
        expect(prisma.repo.findMany).not.toHaveBeenCalled();
    });
});
