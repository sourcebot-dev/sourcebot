import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getCommit } from './getCommitApi';

vi.mock('simple-git');
vi.mock('@sourcebot/shared', () => ({
    getRepoPath: (repo: { id: number }) => ({
        path: `/mock/cache/dir/${repo.id}`,
    }),
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));
vi.mock('@/middleware/sew', () => ({
    sew: async <T>(fn: () => Promise<T> | T): Promise<T> => {
        return await fn();
    },
}));

const mockFindFirst = vi.fn();
vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: async <T>(fn: (args: { org: { id: number }; prisma: unknown }) => Promise<T>): Promise<T> => {
        return await fn({
            org: { id: 1 },
            prisma: {
                repo: {
                    findFirst: mockFindFirst,
                },
            },
        });
    },
}));
vi.mock('@/lib/serviceError', () => ({
    notFound: (message: string) => ({
        errorCode: 'NOT_FOUND',
        message,
    }),
    invalidGitRef: (ref: string) => ({
        errorCode: 'INVALID_GIT_REF',
        message: `Invalid git reference: "${ref}". Git refs cannot start with '-'.`,
    }),
    unexpectedError: (message: string) => ({
        errorCode: 'UNEXPECTED_ERROR',
        message,
    }),
}));

import { simpleGit } from 'simple-git';

describe('getCommit', () => {
    const mockRaw = vi.fn();
    const mockCwd = vi.fn();
    const mockSimpleGit = simpleGit as unknown as Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFindFirst.mockResolvedValue({ id: 123, name: 'github.com/test/repo' });
        mockCwd.mockReturnValue({
            raw: mockRaw,
        });
        mockSimpleGit.mockReturnValue({
            cwd: mockCwd,
        });
    });

    it('parses commit body correctly when it contains field separator', async () => {
        const fieldSep = '\x1f';
        mockRaw.mockResolvedValue([
            'abc123',
            '2026-04-02T00:00:00Z',
            'subject line',
            'HEAD -> main',
            `body before separator ${fieldSep} body after separator`,
            'Test User',
            'test@example.com',
            'p1 p2',
        ].join(fieldSep));

        const result = await getCommit({
            repo: 'github.com/test/repo',
            ref: 'HEAD',
        });

        expect(result).toEqual({
            hash: 'abc123',
            date: '2026-04-02T00:00:00Z',
            message: 'subject line',
            refs: 'HEAD -> main',
            body: `body before separator ${fieldSep} body after separator`,
            authorName: 'Test User',
            authorEmail: 'test@example.com',
            parents: ['p1', 'p2'],
        });
    });
});
