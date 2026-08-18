import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { listBranches } from './listBranchesApi';

vi.mock('simple-git');
vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
}));
vi.mock('@sourcebot/shared', async () => {
    const { z } = await import('zod');
    return {
        REPOS_CACHE_DIR: '/mock/cache/dir',
        getRepoPath: (repo: { id: number }) => ({
            path: `/mock/cache/dir/${repo.id}`,
        }),
        createLogger: () => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }),
        repoMetadataSchema: z.object({
            indexedRevisions: z.array(z.string()).optional(),
        }).passthrough(),
    };
});
vi.mock('@/lib/serviceError', () => ({
    unexpectedError: (message: string) => ({
        errorCode: 'UNEXPECTED_ERROR',
        message,
    }),
    notFound: (message: string) => ({
        errorCode: 'NOT_FOUND',
        message,
    }),
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

const mockFindFirst = vi.fn();

vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: async <T>(fn: (args: { org: { id: number; name: string }; prisma: unknown }) => Promise<T>): Promise<T> => {
        const mockOrg = { id: 1, name: 'test-org' };
        const mockPrisma = {
            repo: {
                findFirst: mockFindFirst,
            },
        };
        return await fn({ org: mockOrg, prisma: mockPrisma });
    },
}));
vi.mock('@/lib/utils', () => ({
    isServiceError: (obj: unknown): obj is { errorCode: string } => {
        return obj !== null && typeof obj === 'object' && 'errorCode' in obj;
    },
}));

import { simpleGit } from 'simple-git';

describe('listBranches', () => {
    const mockGitRaw = vi.fn();
    const mockCwd = vi.fn();
    const mockSimpleGit = simpleGit as unknown as Mock;

    const defaultRepo = {
        id: 123,
        name: 'github.com/test/repo',
        defaultBranch: 'main',
        indexedAt: new Date('2026-01-15T12:00:00.000Z'),
        metadata: { indexedRevisions: ['refs/heads/main'] },
    };

    // for-each-ref output: <name>\t<sha>\t<iso date>, sorted newest-first by git.
    const defaultGitOutput = [
        'feature-x\taaa111\t2026-02-01T10:00:00+00:00',
        'main\tbbb222\t2026-01-15T09:00:00+00:00',
        'old-branch\tccc333\t2025-06-01T08:00:00+00:00',
    ].join('\n') + '\n';

    beforeEach(() => {
        vi.clearAllMocks();
        mockFindFirst.mockReset();
        mockCwd.mockReturnValue({ raw: mockGitRaw });
        mockSimpleGit.mockReturnValue({ cwd: mockCwd });
        mockFindFirst.mockResolvedValue(defaultRepo);
        mockGitRaw.mockResolvedValue(defaultGitOutput);
    });

    describe('repository lookup', () => {
        it('queries the database with the repository name and org id', async () => {
            await listBranches({ repo: 'github.com/test/repo' });

            expect(mockFindFirst).toHaveBeenCalledWith({
                where: {
                    name: 'github.com/test/repo',
                    orgId: 1,
                },
            });
        });

        it('returns NOT_FOUND when the repository does not exist', async () => {
            mockFindFirst.mockResolvedValue(null);

            const result = await listBranches({ repo: 'github.com/nonexistent/repo' });

            expect(result).toMatchObject({
                errorCode: 'NOT_FOUND',
                message: expect.stringContaining('github.com/nonexistent/repo'),
            });
        });

        it('resolves the clone path from the repo id', async () => {
            await listBranches({ repo: 'github.com/test/repo' });

            expect(mockCwd).toHaveBeenCalledWith('/mock/cache/dir/123');
        });
    });

    describe('git command', () => {
        it('runs for-each-ref over refs/heads only, sorted by committer date', async () => {
            await listBranches({ repo: 'github.com/test/repo' });

            expect(mockGitRaw).toHaveBeenCalledWith([
                'for-each-ref',
                '--sort=-committerdate',
                '--format=%(refname:short)%09%(objectname)%09%(committerdate:iso-strict)',
                'refs/heads',
            ]);
            expect(mockGitRaw).toHaveBeenCalledTimes(1);
        });
    });

    describe('parsing and ordering', () => {
        it('parses branch name, commit SHA, and commit date from git output', async () => {
            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toHaveProperty('branches.0', {
                name: 'feature-x',
                commit: 'aaa111',
                committedAt: '2026-02-01T10:00:00+00:00',
                isDefault: false,
                isIndexed: false,
            });
        });

        it("preserves git's newest-first ordering", async () => {
            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                branches: [
                    { name: 'feature-x' },
                    { name: 'main' },
                    { name: 'old-branch' },
                ],
            });
        });

        it('returns an empty list for an empty repository', async () => {
            mockGitRaw.mockResolvedValue('');

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toEqual({
                repo: 'github.com/test/repo',
                defaultBranch: 'main',
                indexedAt: '2026-01-15T12:00:00.000Z',
                totalCount: 0,
                branches: [],
            });
        });
    });

    describe('default branch marking', () => {
        it('marks only the default branch as isDefault', async () => {
            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                branches: [
                    { name: 'feature-x', isDefault: false },
                    { name: 'main', isDefault: true },
                    { name: 'old-branch', isDefault: false },
                ],
            });
        });

        it('normalizes a refs/heads-prefixed defaultBranch', async () => {
            mockFindFirst.mockResolvedValue({
                ...defaultRepo,
                defaultBranch: 'refs/heads/main',
            });

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                defaultBranch: 'main',
                branches: [
                    { name: 'feature-x', isDefault: false },
                    { name: 'main', isDefault: true },
                    { name: 'old-branch', isDefault: false },
                ],
            });
        });

        it('handles a missing default branch', async () => {
            mockFindFirst.mockResolvedValue({
                ...defaultRepo,
                defaultBranch: null,
            });

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                defaultBranch: undefined,
                branches: [
                    { name: 'feature-x', isDefault: false },
                    { name: 'main', isDefault: false },
                    { name: 'old-branch', isDefault: false },
                ],
            });
        });
    });

    describe('indexed branch marking', () => {
        it('marks branches present in indexedRevisions', async () => {
            mockFindFirst.mockResolvedValue({
                ...defaultRepo,
                metadata: {
                    indexedRevisions: ['refs/heads/main', 'refs/heads/feature-x'],
                },
            });

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                branches: [
                    { name: 'feature-x', isIndexed: true },
                    { name: 'main', isIndexed: true },
                    { name: 'old-branch', isIndexed: false },
                ],
            });
        });

        it('marks the default branch when indexedRevisions contains HEAD', async () => {
            mockFindFirst.mockResolvedValue({
                ...defaultRepo,
                metadata: { indexedRevisions: ['HEAD'] },
            });

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                branches: [
                    { name: 'feature-x', isIndexed: false },
                    { name: 'main', isIndexed: true },
                    { name: 'old-branch', isIndexed: false },
                ],
            });
        });

        it('treats unparseable metadata as no indexed revisions', async () => {
            mockFindFirst.mockResolvedValue({
                ...defaultRepo,
                metadata: { indexedRevisions: 'not-an-array' },
            });

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                branches: [
                    { name: 'feature-x', isIndexed: false },
                    { name: 'main', isIndexed: false },
                    { name: 'old-branch', isIndexed: false },
                ],
            });
        });

        it('treats missing metadata as no indexed revisions', async () => {
            mockFindFirst.mockResolvedValue({
                ...defaultRepo,
                metadata: {},
            });

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                branches: [
                    { name: 'feature-x', isIndexed: false },
                    { name: 'main', isIndexed: false },
                    { name: 'old-branch', isIndexed: false },
                ],
            });
        });
    });

    describe('filtering', () => {
        it('filters branch names case-insensitively', async () => {
            const result = await listBranches({
                repo: 'github.com/test/repo',
                query: 'FEAT',
            });

            expect(result).toMatchObject({
                totalCount: 1,
                branches: [{ name: 'feature-x' }],
            });
        });

        it('returns an empty page when nothing matches', async () => {
            const result = await listBranches({
                repo: 'github.com/test/repo',
                query: 'zzz',
            });

            expect(result).toMatchObject({
                totalCount: 0,
                branches: [],
            });
        });
    });

    describe('pagination', () => {
        it('paginates after filtering and reports the filtered totalCount', async () => {
            mockGitRaw.mockResolvedValue([
                'branch-1\taaa111\t2026-02-05T10:00:00+00:00',
                'branch-2\tbbb222\t2026-02-04T10:00:00+00:00',
                'branch-3\tccc333\t2026-02-03T10:00:00+00:00',
                'branch-4\tddd444\t2026-02-02T10:00:00+00:00',
                'branch-5\teee555\t2026-02-01T10:00:00+00:00',
            ].join('\n') + '\n');

            const result = await listBranches({
                repo: 'github.com/test/repo',
                page: 2,
                perPage: 2,
            });

            expect(result).toMatchObject({
                totalCount: 5,
                branches: [
                    { name: 'branch-3' },
                    { name: 'branch-4' },
                ],
            });
        });

        it('defaults to page 1 with perPage 50', async () => {
            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                totalCount: 3,
                branches: [
                    { name: 'feature-x' },
                    { name: 'main' },
                    { name: 'old-branch' },
                ],
            });
        });

        it('returns an empty branches array for a page past the end', async () => {
            const result = await listBranches({
                repo: 'github.com/test/repo',
                page: 10,
                perPage: 50,
            });

            expect(result).toMatchObject({
                totalCount: 3,
                branches: [],
            });
        });
    });

    describe('error handling', () => {
        it('returns a clear error when the clone is missing', async () => {
            mockGitRaw.mockRejectedValue(new Error('fatal: not a git repository'));

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                errorCode: 'UNEXPECTED_ERROR',
                message: expect.stringContaining('unavailable'),
            });
        });

        it('returns a clear error for other git failures', async () => {
            mockGitRaw.mockRejectedValue(new Error('some git failure'));

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                errorCode: 'UNEXPECTED_ERROR',
                message: expect.stringContaining('Failed to list branches in repository github.com/test/repo'),
            });
        });
    });

    describe('response shape', () => {
        it('serializes indexedAt as an ISO string', async () => {
            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toMatchObject({
                indexedAt: '2026-01-15T12:00:00.000Z',
            });
        });

        it('returns undefined indexedAt when the repo has never been indexed', async () => {
            mockFindFirst.mockResolvedValue({
                ...defaultRepo,
                indexedAt: null,
            });

            const result = await listBranches({ repo: 'github.com/test/repo' });

            expect(result).toHaveProperty('indexedAt', undefined);
        });
    });
});
