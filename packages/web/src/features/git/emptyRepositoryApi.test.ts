import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const findFirst = vi.fn();
    return {
        findFirst,
        gitRaw: vi.fn(),
        cwd: vi.fn(),
        simpleGit: vi.fn(),
        prisma: {
            repo: {
                findFirst,
            },
        },
    };
});

vi.mock('simple-git', () => ({
    default: mocks.simpleGit,
    simpleGit: mocks.simpleGit,
}));

vi.mock('@sourcebot/shared', () => ({
    getRepoPath: (repo: { id: number }) => ({
        path: `/mock/repos/${repo.id}`,
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
        try {
            return await fn();
        } catch (error) {
            return {
                errorCode: 'UNEXPECTED_ERROR',
                message: error instanceof Error ? error.message : String(error),
                statusCode: 500,
            } as T;
        }
    },
}));

vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: async <T>(
        fn: (args: { org: { id: number; name: string }; prisma: unknown; user?: unknown }) => Promise<T>
    ): Promise<T> => {
        return await fn({
            org: { id: 1, name: 'test-org' },
            prisma: mocks.prisma,
        });
    },
}));

vi.mock('@/ee/features/audit/audit', () => ({
    createAudit: vi.fn(),
}));

vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { getFolderContents } from './getFolderContentsApi';
import { getTree } from './getTreeApi';

describe('empty repository git APIs', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.cwd.mockReturnValue({ raw: mocks.gitRaw });
        mocks.simpleGit.mockReturnValue({ cwd: mocks.cwd });
        mocks.findFirst.mockResolvedValue({
            id: 123,
            name: 'github.com/sourcebot-dev/empty',
            orgId: 1,
        });
        mocks.gitRaw.mockResolvedValue('');
    });

    test('getFolderContents returns an empty root folder for a repository with no commits', async () => {
        mocks.gitRaw.mockImplementation(async (args: string[]) => {
            if (args.includes('ls-tree')) {
                throw new Error('fatal: Not a valid object name HEAD');
            }
            if (args[0] === 'rev-list') {
                return '0\n';
            }
            return '';
        });

        const result = await getFolderContents({
            repoName: 'github.com/sourcebot-dev/empty',
            revisionName: 'HEAD',
            path: '',
        });

        expect(result).toEqual({
            items: [],
            isRepositoryEmpty: true,
        });
        expect(mocks.gitRaw).toHaveBeenCalledWith(['rev-list', '--count', '--all']);
    });

    test('getFolderContents keeps unresolved refs as errors for empty repositories', async () => {
        mocks.gitRaw.mockImplementation(async (args: string[]) => {
            if (args.includes('ls-tree')) {
                throw new Error('fatal: Not a valid object name definitely-not-a-ref');
            }
            if (args[0] === 'symbolic-ref') {
                return 'main\n';
            }
            if (args[0] === 'rev-list') {
                return '0\n';
            }
            return '';
        });

        const result = await getFolderContents({
            repoName: 'github.com/sourcebot-dev/empty',
            revisionName: 'definitely-not-a-ref',
            path: '',
        });

        expect(result).toMatchObject({
            errorCode: 'UNEXPECTED_ERROR',
            message: expect.stringContaining('git ls-tree command failed'),
        });
        expect(mocks.gitRaw).not.toHaveBeenCalledWith(['rev-list', '--count', '--all']);
    });

    test('getTree returns an empty root tree for a repository with no commits', async () => {
        mocks.gitRaw.mockImplementation(async (args: string[]) => {
            if (args.includes('ls-tree')) {
                throw new Error('fatal: Not a valid object name HEAD');
            }
            if (args[0] === 'rev-list') {
                return '0\n';
            }
            return '';
        });

        const result = await getTree({
            repoName: 'github.com/sourcebot-dev/empty',
            revisionName: 'HEAD',
            paths: [],
        });

        expect(result).toEqual({
            tree: {
                name: 'root',
                path: '',
                type: 'tree',
                children: [],
            },
        });
        expect(mocks.gitRaw).toHaveBeenCalledWith(['rev-list', '--count', '--all']);
    });

    test('getTree treats empty path entries as the root for empty repositories', async () => {
        mocks.gitRaw.mockImplementation(async (args: string[]) => {
            if (args.includes('ls-tree')) {
                throw new Error('fatal: Not a valid object name HEAD');
            }
            if (args[0] === 'rev-list') {
                return '0\n';
            }
            return '';
        });

        const result = await getTree({
            repoName: 'github.com/sourcebot-dev/empty',
            revisionName: 'HEAD',
            paths: [''],
        });

        const lsTreeCall = mocks.gitRaw.mock.calls.find(([args]) => args.includes('ls-tree'))?.[0];

        expect(result).toEqual({
            tree: {
                name: 'root',
                path: '',
                type: 'tree',
                children: [],
            },
        });
        expect(lsTreeCall).toEqual([
            '-c', 'core.quotePath=false',
            'ls-tree',
            'HEAD',
            '--format=%(objecttype),%(path)',
            '-t',
            '--',
            '.',
        ]);
    });

    test('getTree returns an empty tree for stale paths in empty repositories', async () => {
        mocks.gitRaw.mockImplementation(async (args: string[]) => {
            if (args.includes('ls-tree')) {
                throw new Error('fatal: Not a valid object name HEAD');
            }
            if (args[0] === 'rev-list') {
                return '0\n';
            }
            return '';
        });

        const result = await getTree({
            repoName: 'github.com/sourcebot-dev/empty',
            revisionName: 'HEAD',
            paths: ['stale/path'],
        });

        expect(result).toEqual({
            tree: {
                name: 'root',
                path: '',
                type: 'tree',
                children: [],
            },
        });
    });

    test('getTree keeps unresolved refs as errors for empty repositories', async () => {
        mocks.gitRaw.mockImplementation(async (args: string[]) => {
            if (args.includes('ls-tree')) {
                throw new Error('fatal: Not a valid object name definitely-not-a-ref');
            }
            if (args[0] === 'symbolic-ref') {
                return 'main\n';
            }
            if (args[0] === 'rev-list') {
                return '0\n';
            }
            return '';
        });

        const result = await getTree({
            repoName: 'github.com/sourcebot-dev/empty',
            revisionName: 'definitely-not-a-ref',
            paths: [],
        });

        expect(result).toMatchObject({
            errorCode: 'UNEXPECTED_ERROR',
            message: expect.stringContaining('git ls-tree command failed'),
        });
        expect(mocks.gitRaw).not.toHaveBeenCalledWith(['rev-list', '--count', '--all']);
    });

    test('getTree keeps unresolved revisions as errors when the repository has commits', async () => {
        mocks.gitRaw.mockImplementation(async (args: string[]) => {
            if (args.includes('ls-tree')) {
                throw new Error('fatal: Not a valid object name HEAD');
            }
            if (args[0] === 'rev-list') {
                return '42\n';
            }
            return '';
        });

        const result = await getTree({
            repoName: 'github.com/sourcebot-dev/not-empty',
            revisionName: 'HEAD',
            paths: [],
        });

        expect(result).toMatchObject({
            errorCode: 'UNEXPECTED_ERROR',
            message: expect.stringContaining('git ls-tree command failed'),
        });
    });
});
