import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSimpleGit = vi.hoisted(() => vi.fn());

vi.mock('simple-git', () => ({
    default: mockSimpleGit,
    simpleGit: mockSimpleGit,
}));
vi.mock('@sourcebot/shared', () => ({
    getRepoPath: (repo: { id: number }) => ({ path: `/mock/repos/${repo.id}` }),
    createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/middleware/sew', () => ({
    sew: async <T>(fn: () => Promise<T> | T): Promise<T> => {
        try {
            return await fn();
        } catch (error) {
            return {
                errorCode: 'UNEXPECTED_ERROR',
                message: error instanceof Error ? error.message : String(error),
            } as T;
        }
    },
}));
vi.mock('@/middleware/withAuth', () => ({
    // Invoke the callback with a minimal auth context.
    withOptionalAuth: (fn: (ctx: { org: unknown; prisma: unknown }) => unknown) =>
        fn({ org: MOCK_ORG, prisma: mockPrisma }),
}));

import { getFileFreshness } from './getFileFreshnessApi';

const MOCK_ORG = { id: 1, name: 'test-org' } as never;

const MOCK_REPO = {
    id: 123,
    name: 'github.com/owner/repo',
    orgId: 1,
    defaultBranch: 'main',
};

const mockGitRaw = vi.fn();
const mockCwd = vi.fn();
const mockFindFirst = vi.fn();
const mockPrisma = { repo: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } } as never;

const PATH = 'src/index.ts';

describe('getFileFreshness', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCwd.mockReturnValue({ raw: mockGitRaw });
        mockSimpleGit.mockReturnValue({ cwd: mockCwd });
        mockFindFirst.mockResolvedValue(MOCK_REPO);
    });

    it('returns NOT_FOUND when the repo is absent', async () => {
        mockFindFirst.mockResolvedValue(null);
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: PATH, sinceSha: 'abc' });
        expect(result).toMatchObject({ errorCode: 'NOT_FOUND' });
    });

    it('returns FILE_NOT_FOUND for path traversal', async () => {
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: 'src/../../etc/passwd', sinceSha: 'abc' });
        expect(result).toMatchObject({ errorCode: 'FILE_NOT_FOUND' });
    });

    it('returns INVALID_GIT_REF for refs starting with "-"', async () => {
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: PATH, sinceSha: '--evil' });
        expect(result).toMatchObject({ errorCode: 'INVALID_GIT_REF' });
    });

    it('is fresh (fast path) when the pinned commit equals the current tip', async () => {
        mockGitRaw.mockImplementation(async (args: string[]) => {
            if (args[1] === 'main^{commit}') return 'currentsha\n';
            throw new Error('should not reach blob comparison');
        });
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: PATH, sinceSha: 'currentsha' });
        expect(result).toMatchObject({ status: 'fresh', currentSha: 'currentsha' });
    });

    it('is fresh when the blob is identical at both commits', async () => {
        mockGitRaw.mockImplementation(async (args: string[]) => {
            if (args[1] === 'main^{commit}') return 'currentsha\n';
            if (args[1] === `pinnedsha:${PATH}`) return 'sameblob\n';
            if (args[1] === `currentsha:${PATH}`) return 'sameblob\n';
            throw new Error('unexpected');
        });
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: PATH, sinceSha: 'pinnedsha' });
        expect(result).toMatchObject({ status: 'fresh', currentSha: 'currentsha' });
    });

    it('is changed when the blob differs', async () => {
        mockGitRaw.mockImplementation(async (args: string[]) => {
            if (args[1] === 'main^{commit}') return 'currentsha\n';
            if (args[1] === `pinnedsha:${PATH}`) return 'oldblob\n';
            if (args[1] === `currentsha:${PATH}`) return 'newblob\n';
            throw new Error('unexpected');
        });
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: PATH, sinceSha: 'pinnedsha' });
        expect(result).toMatchObject({ status: 'changed', currentSha: 'currentsha' });
    });

    it('is removed when the path is absent at the current tip', async () => {
        mockGitRaw.mockImplementation(async (args: string[]) => {
            if (args[1] === 'main^{commit}') return 'currentsha\n';
            if (args[1] === `pinnedsha:${PATH}`) return 'oldblob\n';
            if (args[1] === `currentsha:${PATH}`) throw new Error('does not exist');
            throw new Error('unexpected');
        });
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: PATH, sinceSha: 'pinnedsha' });
        expect(result).toMatchObject({ status: 'removed', currentSha: 'currentsha' });
    });

    it('is pinned_unavailable when the pinned commit is gone', async () => {
        mockGitRaw.mockImplementation(async (args: string[]) => {
            if (args[1] === 'main^{commit}') return 'currentsha\n';
            if (args[1] === `gonepin:${PATH}`) throw new Error('bad revision');
            throw new Error('unexpected');
        });
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: PATH, sinceSha: 'gonepin' });
        expect(result).toMatchObject({ status: 'pinned_unavailable', currentSha: 'currentsha' });
    });

    it('returns UNEXPECTED_ERROR when resolving the current tip fails', async () => {
        mockGitRaw.mockRejectedValueOnce(new Error('I/O error'));
        const result = await getFileFreshness({ repo: MOCK_REPO.name, path: PATH, sinceSha: 'pinnedsha' });
        expect(result).toMatchObject({ errorCode: 'UNEXPECTED_ERROR' });
    });
});
