import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listCommits } from './listCommitsApi';
import * as dateUtils from './dateUtils';

// Mock dependencies
vi.mock('simple-git');
vi.mock('fs');
vi.mock('@sourcebot/shared', () => ({
    REPOS_CACHE_DIR: '/mock/cache/dir',
    getRepoPath: (repo: { id: number }) => ({
        path: `/mock/cache/dir/${repo.id}`,
    }),
}));
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
vi.mock('@/actions', () => ({
    sew: async <T>(fn: () => Promise<T> | T): Promise<T> => {
        try {
            return await fn();
        } catch (error) {
            // Mock sew to convert thrown errors to ServiceError
            return {
                errorCode: 'UNEXPECTED_ERROR',
                message: error instanceof Error ? error.message : String(error),
            } as T;
        }
    },
}));
// Create a mock findFirst function that we can configure per-test
const mockFindFirst = vi.fn();

vi.mock('@/withAuthV2', () => ({
    withOptionalAuthV2: async <T>(fn: (args: { org: { id: number; name: string }; prisma: unknown }) => Promise<T>): Promise<T> => {
        // Mock withOptionalAuthV2 to provide org and prisma context
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

// Import mocked modules
import { simpleGit } from 'simple-git';
import { existsSync } from 'fs';

describe('searchCommits', () => {
    const mockGitLog = vi.fn();
    const mockGitRaw = vi.fn();
    const mockCwd = vi.fn();
    const mockSimpleGit = simpleGit as unknown as vi.Mock;
    const mockExistsSync = existsSync as unknown as vi.Mock;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset mockFindFirst before each test
        mockFindFirst.mockReset();

        // Setup default mocks
        mockExistsSync.mockReturnValue(true);
        mockCwd.mockReturnValue({
            log: mockGitLog,
            raw: mockGitRaw,
        });
        mockSimpleGit.mockReturnValue({
            cwd: mockCwd,
        });

        // Setup default repo mock
        mockFindFirst.mockResolvedValue({ id: 123, name: 'github.com/test/repo' });
        // Setup default raw mock for rev-list count
        mockGitRaw.mockResolvedValue('10');
    });

    describe('repository validation', () => {
        it('should return error when repository is not found in database', async () => {
            mockFindFirst.mockResolvedValue(null);

            const result = await listCommits({
                repo: 'github.com/nonexistent/repo',
            });

            expect(result).toMatchObject({
                errorCode: 'NOT_FOUND',
                message: expect.stringContaining('Repository "github.com/nonexistent/repo" not found'),
            });
        });

        it('should query database with correct repository name', async () => {
            mockFindFirst.mockResolvedValue({ id: 456, name: 'github.com/test/repo' });
            mockGitLog.mockResolvedValue({ all: [] });

            await listCommits({
                repo: 'github.com/test/repo',
            });

            expect(mockFindFirst).toHaveBeenCalledWith({
                where: {
                    name: 'github.com/test/repo',
                    orgId: 1,
                },
            });
        });
    });

    describe('date range validation', () => {
        it('should validate date range and return error for invalid range', async () => {
            vi.spyOn(dateUtils, 'validateDateRange').mockReturnValue(
                'Invalid date range: since must be before until'
            );

            const result = await listCommits({
                repo: 'github.com/test/repo',
                since: '2024-12-31',
                until: '2024-01-01',
            });

            expect(result).toMatchObject({
                errorCode: 'UNEXPECTED_ERROR',
                message: 'Invalid date range: since must be before until',
            });
        });

        it('should proceed when date range is valid', async () => {
            vi.spyOn(dateUtils, 'validateDateRange').mockReturnValue(null);
            vi.spyOn(dateUtils, 'toGitDate').mockImplementation((date) => date);
            mockGitLog.mockResolvedValue({ all: [] });

            const result = await listCommits({
                repo: 'github.com/test/repo',
                since: '2024-01-01',
                until: '2024-12-31',
            });

            expect(result).toMatchObject({ commits: [], totalCount: expect.any(Number) });
        });
    });

    describe('date parsing', () => {
        it('should parse dates using toGitDate', async () => {
            const toGitDateSpy = vi.spyOn(dateUtils, 'toGitDate');
            toGitDateSpy.mockImplementation((date) => date);
            mockGitLog.mockResolvedValue({ all: [] });

            await listCommits({
                repo: 'github.com/test/repo',
                since: '30 days ago',
                until: 'yesterday',
            });

            expect(toGitDateSpy).toHaveBeenCalledWith('30 days ago');
            expect(toGitDateSpy).toHaveBeenCalledWith('yesterday');
        });

        it('should pass parsed dates to git log', async () => {
            vi.spyOn(dateUtils, 'toGitDate')
                .mockReturnValueOnce('2024-01-01')
                .mockReturnValueOnce('2024-12-31');
            mockGitLog.mockResolvedValue({ all: [] });

            await listCommits({
                repo: 'github.com/test/repo',
                since: '30 days ago',
                until: 'yesterday',
            });

            expect(mockGitLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    '--since': '2024-01-01',
                    '--until': '2024-12-31',
                })
            );
        });
    });

    describe('git log options', () => {
        beforeEach(() => {
            vi.spyOn(dateUtils, 'toGitDate').mockImplementation((date) => date);
            mockGitLog.mockResolvedValue({ all: [] });
        });

        it('should set default maxCount', async () => {
            await listCommits({
                repo: 'github.com/test/repo',
            });

            expect(mockGitLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    maxCount: 50,
                    HEAD: null,
                })
            );
        });

        it('should use custom maxCount', async () => {
            await listCommits({
                repo: 'github.com/test/repo',
                maxCount: 100,
            });

            expect(mockGitLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    maxCount: 100,
                    HEAD: null,
                })
            );
        });

        it('should add --since when since is provided', async () => {
            await listCommits({
                repo: 'github.com/test/repo',
                since: '30 days ago',
            });

            expect(mockGitLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    '--since': '30 days ago',
                    HEAD: null,
                })
            );
        });

        it('should add --until when until is provided', async () => {
            await listCommits({
                repo: 'github.com/test/repo',
                until: 'yesterday',
            });

            expect(mockGitLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    '--until': 'yesterday',
                    HEAD: null,
                })
            );
        });

        it('should add --author when author is provided', async () => {
            await listCommits({
                repo: 'github.com/test/repo',
                author: 'john@example.com',
            });

            expect(mockGitLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    '--author': 'john@example.com',
                    '--regexp-ignore-case': null,
                    HEAD: null,
                })
            );
        });

        it('should add --grep and --regexp-ignore-case when query is provided', async () => {
            await listCommits({
                repo: 'github.com/test/repo',
                query: 'fix bug',
            });

            expect(mockGitLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    '--grep': 'fix bug',
                    '--regexp-ignore-case': null,
                    HEAD: null,
                })
            );
        });

        it('should combine all options', async () => {
            await listCommits({
                repo: 'github.com/test/repo',
                query: 'feature',
                since: '2024-01-01',
                until: '2024-12-31',
                author: 'jane@example.com',
                maxCount: 25,
            });

            expect(mockGitLog).toHaveBeenCalledWith({
                maxCount: 25,
                HEAD: null,
                '--since': '2024-01-01',
                '--until': '2024-12-31',
                '--author': 'jane@example.com',
                '--regexp-ignore-case': null,
                '--grep': 'feature',
            });
        });
    });

    describe('successful responses', () => {
        it('should return commits and totalCount from git log', async () => {
            const mockCommits = [
                {
                    hash: 'abc123',
                    date: '2024-06-15',
                    message: 'feat: add feature',
                    refs: 'HEAD -> main',
                    body: '',
                    author_name: 'John Doe',
                    author_email: 'john@example.com',
                },
                {
                    hash: 'def456',
                    date: '2024-06-14',
                    message: 'fix: bug fix',
                    refs: '',
                    body: '',
                    author_name: 'Jane Smith',
                    author_email: 'jane@example.com',
                },
            ];

            mockGitLog.mockResolvedValue({ all: mockCommits });
            mockGitRaw.mockResolvedValue('2');

            const result = await listCommits({
                repo: 'github.com/test/repo',
            });

            expect(result).toEqual({ commits: mockCommits, totalCount: 2 });
        });

        it('should return empty commits array when no commits match', async () => {
            mockGitLog.mockResolvedValue({ all: [] });
            mockGitRaw.mockResolvedValue('0');

            const result = await listCommits({
                repo: 'github.com/test/repo',
                query: 'nonexistent',
            });

            expect(result).toEqual({ commits: [], totalCount: 0 });
        });
    });

    describe('error handling', () => {
        it('should return error for "not a git repository"', async () => {
            mockGitLog.mockRejectedValue(new Error('not a git repository'));

            const result = await listCommits({
                repo: 'github.com/test/repo',
            });

            expect(result).toMatchObject({
                errorCode: 'UNEXPECTED_ERROR',
                message: expect.stringContaining('not a valid git repository'),
            });
        });

        it('should return error for "ambiguous argument"', async () => {
            mockGitLog.mockRejectedValue(new Error('ambiguous argument'));

            const result = await listCommits({
                repo: 'github.com/test/repo',
                since: 'invalid-date',
            });

            expect(result).toMatchObject({
                errorCode: 'UNEXPECTED_ERROR',
                message: expect.stringContaining('Invalid git reference or date format'),
            });
        });

        it('should return error for timeout', async () => {
            mockGitLog.mockRejectedValue(new Error('timeout exceeded'));

            const result = await listCommits({
                repo: 'github.com/test/repo',
            });

            expect(result).toMatchObject({
                errorCode: 'UNEXPECTED_ERROR',
                message: expect.stringContaining('timed out'),
            });
        });

        it('should return ServiceError for other Error instances', async () => {
            mockGitLog.mockRejectedValue(new Error('some other error'));

            const result = await listCommits({
                repo: 'github.com/test/repo',
            });

            expect(result).toMatchObject({
                errorCode: 'UNEXPECTED_ERROR',
                message: expect.stringContaining('Failed to search commits in repository github.com/test/repo'),
            });
        });

        it('should return ServiceError for non-Error exceptions', async () => {
            mockGitLog.mockRejectedValue('string error');

            const result = await listCommits({
                repo: 'github.com/test/repo',
            });

            expect(result).toMatchObject({
                errorCode: 'UNEXPECTED_ERROR',
                message: expect.stringContaining('Failed to search commits in repository github.com/test/repo'),
            });
        });
    });

    describe('git client configuration', () => {
        it('should set working directory using cwd', async () => {
            mockGitLog.mockResolvedValue({ all: [] });

            await listCommits({
                repo: 'github.com/test/repo',
            });

            expect(mockCwd).toHaveBeenCalledWith('/mock/cache/dir/123');
        });

        it('should use correct repository path from database', async () => {
            mockFindFirst.mockResolvedValue({ id: 456, name: 'github.com/other/repo' });
            mockGitLog.mockResolvedValue({ all: [] });

            await listCommits({
                repo: 'github.com/other/repo',
            });

            expect(mockCwd).toHaveBeenCalledWith('/mock/cache/dir/456');
        });
    });

    describe('integration scenarios', () => {
        it('should handle a typical commit search with filters', async () => {
            const mockCommits = [
                {
                    hash: 'abc123',
                    date: '2024-06-10T14:30:00Z',
                    message: 'fix: resolve authentication bug',
                    refs: 'HEAD -> main',
                    body: 'Fixed issue with JWT token validation',
                    author_name: 'Security Team',
                    author_email: 'security@example.com',
                },
            ];

            vi.spyOn(dateUtils, 'validateDateRange').mockReturnValue(null);
            vi.spyOn(dateUtils, 'toGitDate').mockImplementation((date) => date);
            mockGitLog.mockResolvedValue({ all: mockCommits });
            mockGitRaw.mockResolvedValue('1');

            const result = await listCommits({
                repo: 'github.com/test/repo',
                query: 'authentication',
                since: '30 days ago',
                until: 'yesterday',
                author: 'security',
                maxCount: 20,
            });

            expect(result).toEqual({ commits: mockCommits, totalCount: 1 });
            expect(mockGitLog).toHaveBeenCalledWith({
                maxCount: 20,
                HEAD: null,
                '--since': '30 days ago',
                '--until': 'yesterday',
                '--author': 'security',
                '--regexp-ignore-case': null,
                '--grep': 'authentication',
            });
        });

        it('should handle repository not found in database', async () => {
            mockFindFirst.mockResolvedValue(null);

            const result = await listCommits({
                repo: 'github.com/nonexistent/repo',
                query: 'feature',
            });

            expect(result).toMatchObject({
                errorCode: 'NOT_FOUND',
            });
            expect(result).toHaveProperty('message');
            const message = (result as { message: string }).message;
            expect(message).toContain('github.com/nonexistent/repo');
            expect(message).toContain('not found');
        });
    });

    describe('repository lookup', () => {
        beforeEach(() => {
            // Reset mockFindFirst before each test in this suite
            mockFindFirst.mockReset();
        });

        it('should query database for repository by name', async () => {
            mockFindFirst.mockResolvedValue({ id: 456, name: 'github.com/owner/repo' });
            mockGitLog.mockResolvedValue({ all: [] });

            const result = await listCommits({
                repo: 'github.com/owner/repo',
            });

            expect(result).toMatchObject({ commits: [], totalCount: expect.any(Number) });
            expect(mockFindFirst).toHaveBeenCalledWith({
                where: {
                    name: 'github.com/owner/repo',
                    orgId: 1,
                },
            });
        });

        it('should return NOT_FOUND error when repository is not found', async () => {
            mockFindFirst.mockResolvedValue(null);

            const result = await listCommits({
                repo: 'github.com/nonexistent/repo',
            });

            expect(result).toMatchObject({
                errorCode: 'NOT_FOUND',
                message: expect.stringContaining('Repository "github.com/nonexistent/repo" not found'),
            });
        });

        it('should use repository ID from database to determine path', async () => {
            mockFindFirst.mockResolvedValue({ id: 789, name: 'github.com/example/project' });
            mockGitLog.mockResolvedValue({ all: [] });

            await listCommits({
                repo: 'github.com/example/project',
            });

            expect(mockCwd).toHaveBeenCalledWith('/mock/cache/dir/789');
        });

        it('should work end-to-end with repository lookup', async () => {
            const mockCommits = [
                {
                    hash: 'xyz789',
                    date: '2024-06-20T10:00:00Z',
                    message: 'feat: new feature',
                    refs: 'main',
                    body: 'Added new functionality',
                    author_name: 'Developer',
                    author_email: 'dev@example.com',
                },
            ];

            mockFindFirst.mockResolvedValue({ id: 555, name: 'github.com/test/repository' });
            vi.spyOn(dateUtils, 'validateDateRange').mockReturnValue(null);
            vi.spyOn(dateUtils, 'toGitDate').mockImplementation((date) => date);
            mockGitLog.mockResolvedValue({ all: mockCommits });
            mockGitRaw.mockResolvedValue('1');

            const result = await listCommits({
                repo: 'github.com/test/repository',
                query: 'feature',
                since: '7 days ago',
                author: 'Developer',
            });

            expect(result).toEqual({ commits: mockCommits, totalCount: 1 });
            expect(mockCwd).toHaveBeenCalledWith('/mock/cache/dir/555');
        });
    });
});
