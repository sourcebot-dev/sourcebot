import { expect, test, vi, describe, beforeEach, afterEach } from 'vitest';
import { compileGenericGitHostConfig_file } from './repoCompileUtils';

// Mock the git module
vi.mock('./git.js', () => ({
    isPathAValidGitRepoRoot: vi.fn(),
    getOriginUrl: vi.fn(),
}));

// Mock the glob module
vi.mock('glob', () => ({
    glob: vi.fn(),
}));

import { isPathAValidGitRepoRoot, getOriginUrl } from './git.js';
import { glob } from 'glob';

const mockedGlob = vi.mocked(glob);
const mockedIsPathAValidGitRepoRoot = vi.mocked(isPathAValidGitRepoRoot);
const mockedGetOriginUrl = vi.mocked(getOriginUrl);

describe('compileGenericGitHostConfig_file', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    test('should return warning when glob pattern matches no paths', async () => {
        mockedGlob.mockResolvedValue([]);

        const config = {
            type: 'git' as const,
            url: 'file:///path/to/nonexistent/repo',
        };

        const result = await compileGenericGitHostConfig_file(config, 1);

        expect(result.repoData).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('No paths matched the pattern');
        expect(result.warnings[0]).toContain('/path/to/nonexistent/repo');
    });

    test('should return warning when path is not a valid git repo', async () => {
        mockedGlob.mockResolvedValue(['/path/to/not-a-repo']);
        mockedIsPathAValidGitRepoRoot.mockResolvedValue(false);

        const config = {
            type: 'git' as const,
            url: 'file:///path/to/not-a-repo',
        };

        const result = await compileGenericGitHostConfig_file(config, 1);

        expect(result.repoData).toHaveLength(0);
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        expect(result.warnings.some(w => w.includes('not a git repository'))).toBe(true);
        expect(result.warnings.some(w => w.includes('No valid git repositories found'))).toBe(true);
    });

    test('should return warning when git repo has no origin url', async () => {
        mockedGlob.mockResolvedValue(['/path/to/repo']);
        mockedIsPathAValidGitRepoRoot.mockResolvedValue(true);
        mockedGetOriginUrl.mockResolvedValue(null);

        const config = {
            type: 'git' as const,
            url: 'file:///path/to/repo',
        };

        const result = await compileGenericGitHostConfig_file(config, 1);

        expect(result.repoData).toHaveLength(0);
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        expect(result.warnings.some(w => w.includes('remote.origin.url not found'))).toBe(true);
        expect(result.warnings.some(w => w.includes('No valid git repositories found'))).toBe(true);
    });

    test('should successfully compile when valid git repo is found', async () => {
        mockedGlob.mockResolvedValue(['/path/to/valid/repo']);
        mockedIsPathAValidGitRepoRoot.mockResolvedValue(true);
        mockedGetOriginUrl.mockResolvedValue('https://github.com/test/repo.git');

        const config = {
            type: 'git' as const,
            url: 'file:///path/to/valid/repo',
        };

        const result = await compileGenericGitHostConfig_file(config, 1);

        expect(result.repoData).toHaveLength(1);
        expect(result.warnings).toHaveLength(0);
        expect(result.repoData[0].cloneUrl).toBe('file:///path/to/valid/repo');
        expect(result.repoData[0].name).toBe('github.com/test/repo');
    });

    test('should return warnings for invalid repos and success for valid ones', async () => {
        mockedGlob.mockResolvedValue(['/path/to/valid/repo', '/path/to/invalid/repo']);
        mockedIsPathAValidGitRepoRoot.mockImplementation(async ({ path }) => {
            return path === '/path/to/valid/repo';
        });
        mockedGetOriginUrl.mockImplementation(async (path: string) => {
            if (path === '/path/to/valid/repo') {
                return 'https://github.com/test/repo.git';
            }
            return null;
        });

        const config = {
            type: 'git' as const,
            url: 'file:///path/to/**/repo',
        };

        const result = await compileGenericGitHostConfig_file(config, 1);

        expect(result.repoData).toHaveLength(1);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('/path/to/invalid/repo');
        expect(result.warnings[0]).toContain('not a git repository');
    });
});
