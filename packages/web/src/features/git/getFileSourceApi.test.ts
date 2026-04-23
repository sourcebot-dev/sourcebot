import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Hoist the mock function so it can be referenced in both the vi.mock factory
// and the test body. The SUT imports simpleGit as a default export; the factory
// maps both default and named exports to the same fn so both resolve identically.
const mockSimpleGit = vi.hoisted(() => vi.fn());

vi.mock('simple-git', () => ({
    default: mockSimpleGit,
    simpleGit: mockSimpleGit,
}));
vi.mock('@sourcebot/shared', () => ({
    getRepoPath: (repo: { id: number }) => ({
        path: `/mock/repos/${repo.id}`,
    }),
    env: {
        AUTH_URL: 'https://sourcebot.example.com',
    },
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));
vi.mock('@/lib/utils', () => ({
    getCodeHostBrowseFileAtBranchUrl: vi.fn().mockReturnValue('https://github.com/owner/repo/blob/main/src/index.ts'),
    isServiceError: (obj: unknown): boolean => {
        return obj !== null && typeof obj === 'object' && 'errorCode' in (obj as object);
    },
}));
vi.mock('@/app/(app)/browse/hooks/utils', () => ({
    getBrowsePath: vi.fn().mockReturnValue('/browse/github.com/owner/repo/blob/main/src/index.ts'),
}));
vi.mock('@/lib/gitattributes', () => ({
    parseGitAttributes: vi.fn().mockReturnValue({}),
    resolveLanguageFromGitAttributes: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/lib/languageDetection', () => ({
    detectLanguageFromFilename: vi.fn().mockReturnValue('TypeScript'),
}));
// Required for module load; not exercised by getFileSourceForRepo directly
vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock('@/middleware/sew', () => ({
    sew: async <T>(fn: () => Promise<T> | T): Promise<T> => fn(),
}));
vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: vi.fn(),
}));
vi.mock('@/ee/features/audit/factory', () => ({
    getAuditService: () => ({
        createAudit: vi.fn(),
    }),
}));

import { getFileSourceForRepo } from './getFileSourceApi';

const MOCK_ORG = { id: 1, name: 'test-org' } as Parameters<typeof getFileSourceForRepo>[1]['org'];

const MOCK_REPO = {
    id: 123,
    name: 'github.com/owner/repo',
    orgId: 1,
    defaultBranch: 'main',
    webUrl: 'https://github.com/owner/repo',
    external_codeHostType: 'GITHUB',
    displayName: null,
};

describe('getFileSourceForRepo', () => {
    const mockGitRaw = vi.fn();
    const mockCwd = vi.fn();
    const mockFindFirst = vi.fn();

    const mockPrisma = {
        repo: { findFirst: mockFindFirst },
    } as Parameters<typeof getFileSourceForRepo>[1]['prisma'];

    beforeEach(() => {
        vi.clearAllMocks();

        mockCwd.mockReturnValue({ raw: mockGitRaw });
        mockSimpleGit.mockReturnValue({ cwd: mockCwd });
        mockFindFirst.mockResolvedValue(MOCK_REPO);

        // Default: file show succeeds; .gitattributes not present
        mockGitRaw.mockImplementation(async (args: string[]) => {
            if (args[1]?.endsWith('.gitattributes')) {
                throw new Error('does not exist in HEAD');
            }
            return 'console.log("hello");';
        });
    });

    describe('repository validation', () => {
        it('returns NOT_FOUND when repo is absent from the database', async () => {
            mockFindFirst.mockResolvedValue(null);

            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ errorCode: 'NOT_FOUND' });
        });

        it('queries the database by repo name and orgId', async () => {
            await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(mockFindFirst).toHaveBeenCalledWith({
                where: { name: 'github.com/owner/repo', orgId: 1 },
            });
        });

        it('returns UNEXPECTED_ERROR when the database throws (outer catch)', async () => {
            mockFindFirst.mockRejectedValue(new Error('DB connection refused'));

            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ errorCode: 'UNEXPECTED_ERROR' });
        });
    });

    describe('input validation', () => {
        it('returns FILE_NOT_FOUND for path traversal attempts', async () => {
            const result = await getFileSourceForRepo(
                { path: 'src/../../etc/passwd', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ errorCode: 'FILE_NOT_FOUND' });
        });

        it('returns FILE_NOT_FOUND for null-byte paths', async () => {
            const result = await getFileSourceForRepo(
                { path: 'src/\0evil', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ errorCode: 'FILE_NOT_FOUND' });
        });

        it('returns INVALID_GIT_REF with a syntactic message for refs starting with "-" (flag injection guard)', async () => {
            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo', ref: '--upload-pack=evil' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({
                errorCode: 'INVALID_GIT_REF',
                message: expect.stringContaining("cannot start with '-'"),
            });
        });
    });

    describe('git error handling', () => {
        it('returns FILE_NOT_FOUND when git reports the file does not exist', async () => {
            mockGitRaw.mockRejectedValueOnce(
                new Error("fatal: path 'src/missing.ts' does not exist in 'main'"),
            );

            const result = await getFileSourceForRepo(
                { path: 'src/missing.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ errorCode: 'FILE_NOT_FOUND' });
        });

        it('returns FILE_NOT_FOUND for "fatal: path" errors', async () => {
            mockGitRaw.mockRejectedValueOnce(new Error('fatal: path not found'));

            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ errorCode: 'FILE_NOT_FOUND' });
        });

        it('returns INVALID_GIT_REF with an unresolved-ref message when head_sha has not been fetched ("unknown revision")', async () => {
            // This is the scenario from the v4.16.14 regression: the review agent passes
            // pr_payload.head_sha as ref, but the bare clone hasn't fetched it yet.
            mockGitRaw.mockRejectedValueOnce(
                new Error("fatal: ambiguous argument 'deadbeef': unknown revision or path not in the working tree"),
            );

            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo', ref: 'deadbeef' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({
                errorCode: 'INVALID_GIT_REF',
                message: expect.stringContaining('could not be resolved'),
            });
        });

        it('returns INVALID_GIT_REF with an unresolved-ref message for "bad revision" errors', async () => {
            mockGitRaw.mockRejectedValueOnce(new Error('fatal: bad revision'));

            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo', ref: 'nonexistent' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({
                errorCode: 'INVALID_GIT_REF',
                message: expect.stringContaining('could not be resolved'),
            });
        });

        it('returns INVALID_GIT_REF with an unresolved-ref message for "invalid object name" errors', async () => {
            mockGitRaw.mockRejectedValueOnce(new Error('fatal: invalid object name HEAD'));

            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({
                errorCode: 'INVALID_GIT_REF',
                message: expect.stringContaining('could not be resolved'),
            });
        });

        it('returns UNEXPECTED_ERROR — not throw — for unrecognised git errors (regression: v4.16.14 fatal exception)', async () => {
            // Before the fix, getFileSourceForRepo re-threw unknown errors.
            // Outside sew(), this caused a fatal Next.js task-runner exception.
            // After the fix, all errors are returned as ServiceError.
            mockGitRaw.mockRejectedValueOnce(new Error('I/O error: device busy'));

            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ errorCode: 'UNEXPECTED_ERROR' });
        });

        it('never rejects its returned promise for unrecognised git errors', async () => {
            mockGitRaw.mockRejectedValueOnce(new Error('transient I/O error'));

            await expect(
                getFileSourceForRepo(
                    { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                    { org: MOCK_ORG, prisma: mockPrisma },
                ),
            ).resolves.toMatchObject({ errorCode: 'UNEXPECTED_ERROR' });
        });
    });

    describe('successful response', () => {
        it('returns the file source with language detected from filename', async () => {
            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({
                source: 'console.log("hello");',
                language: 'TypeScript',
                path: 'src/index.ts',
                repo: 'github.com/owner/repo',
            });
        });

        it('uses the provided ref for the git show command', async () => {
            await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo', ref: 'abc123sha' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(mockGitRaw).toHaveBeenCalledWith(['show', 'abc123sha:src/index.ts']);
        });

        it('falls back to defaultBranch when ref is omitted', async () => {
            await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(mockGitRaw).toHaveBeenCalledWith(['show', 'main:src/index.ts']);
        });

        it('falls back to HEAD when both ref and defaultBranch are absent', async () => {
            mockFindFirst.mockResolvedValue({ ...MOCK_REPO, defaultBranch: null });

            await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(mockGitRaw).toHaveBeenCalledWith(['show', 'HEAD:src/index.ts']);
        });

        it('uses the repo path from getRepoPath for the git working directory', async () => {
            await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            // getRepoPath mock returns `/mock/repos/${repo.id}`
            expect(mockCwd).toHaveBeenCalledWith('/mock/repos/123');
        });
    });

    describe('language detection', () => {
        it('uses language from .gitattributes when present', async () => {
            const { resolveLanguageFromGitAttributes, parseGitAttributes } = await import('@/lib/gitattributes');
            const mockResolve = resolveLanguageFromGitAttributes as unknown as Mock;
            const mockParse = parseGitAttributes as unknown as Mock;

            mockParse.mockReturnValue({ '*.ts': { linguist_language: 'TypeScript' } });
            mockResolve.mockReturnValue('TypeScript');

            // Override default: .gitattributes call succeeds
            mockGitRaw.mockImplementation(async (args: string[]) => {
                if (args[1]?.endsWith('.gitattributes')) {
                    return 'linguist-language=TypeScript';
                }
                return 'file content';
            });

            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ language: 'TypeScript' });
            expect(mockResolve).toHaveBeenCalled();
        });

        it('falls back to filename-based detection when .gitattributes is absent', async () => {
            const { detectLanguageFromFilename } = await import('@/lib/languageDetection');
            const mockDetect = detectLanguageFromFilename as unknown as Mock;
            mockDetect.mockReturnValue('TypeScript');

            // Default beforeEach setup: .gitattributes throws → falls back to filename detection
            const result = await getFileSourceForRepo(
                { path: 'src/index.ts', repo: 'github.com/owner/repo' },
                { org: MOCK_ORG, prisma: mockPrisma },
            );

            expect(result).toMatchObject({ language: 'TypeScript' });
            expect(mockDetect).toHaveBeenCalledWith('src/index.ts');
        });
    });
});
