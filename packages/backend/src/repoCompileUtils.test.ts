import { expect, test, vi, describe, beforeEach, afterEach } from 'vitest';
import { compileGenericGitHostConfig_file, compileGenericGitHostConfig_url } from './repoCompileUtils';

// Mock the git module
vi.mock('./git.js', () => ({
    isPathAValidGitRepoRoot: vi.fn(),
    getOriginUrl: vi.fn(),
    isUrlAValidGitRepo: vi.fn(),
    getLocalDefaultBranch: vi.fn(),
}));

// Mock the glob module
vi.mock('glob', () => ({
    glob: vi.fn(),
}));

import { isPathAValidGitRepoRoot, getOriginUrl, isUrlAValidGitRepo } from './git.js';
import { glob } from 'glob';

const mockedGlob = vi.mocked(glob);
const mockedIsPathAValidGitRepoRoot = vi.mocked(isPathAValidGitRepoRoot);
const mockedGetOriginUrl = vi.mocked(getOriginUrl);
const mockedIsUrlAValidGitRepo = vi.mocked(isUrlAValidGitRepo);

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

    test('should include port in repo name when origin url has a port', async () => {
        mockedGlob.mockResolvedValue(['/path/to/valid/repo']);
        mockedIsPathAValidGitRepoRoot.mockResolvedValue(true);
        mockedGetOriginUrl.mockResolvedValue('https://git.kernel.org:443/pub/scm/bluetooth/bluez.git');

        const config = {
            type: 'git' as const,
            url: 'file:///path/to/valid/repo',
        };

        const result = await compileGenericGitHostConfig_file(config, 1);

        expect(result.repoData).toHaveLength(1);
        expect(result.warnings).toHaveLength(0);
        expect(result.repoData[0].cloneUrl).toBe('file:///path/to/valid/repo');
        // The name should include the port to match what zoekt derives from the origin URL
        expect(result.repoData[0].name).toBe('git.kernel.org:443/pub/scm/bluetooth/bluez');
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

describe('compileGenericGitHostConfig_url', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    test('should return warning when url is not a valid git repo', async () => {
        mockedIsUrlAValidGitRepo.mockResolvedValue(false);

        const config = {
            type: 'git' as const,
            url: 'https://example.com/not-a-repo',
        };

        const result = await compileGenericGitHostConfig_url(config, 1);

        expect(result.repoData).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('not a git repository');
    });

    test('should successfully compile with gitConfig when valid git repo url is found', async () => {
        mockedIsUrlAValidGitRepo.mockResolvedValue(true);

        const config = {
            type: 'git' as const,
            url: 'https://git.kernel.org/pub/scm/bluetooth/bluez.git',
        };

        const result = await compileGenericGitHostConfig_url(config, 1);

        expect(result.repoData).toHaveLength(1);
        expect(result.warnings).toHaveLength(0);
        expect(result.repoData[0].cloneUrl).toBe('https://git.kernel.org/pub/scm/bluetooth/bluez.git');
        expect(result.repoData[0].name).toBe('git.kernel.org/pub/scm/bluetooth/bluez');
        
        // Verify gitConfig is set properly (this is the key fix for SOU-218)
        const metadata = result.repoData[0].metadata as { gitConfig?: Record<string, string> };
        expect(metadata.gitConfig).toBeDefined();
        expect(metadata.gitConfig!['zoekt.name']).toBe('git.kernel.org/pub/scm/bluetooth/bluez');
        expect(metadata.gitConfig!['zoekt.web-url']).toBe('https://git.kernel.org/pub/scm/bluetooth/bluez.git');
        expect(metadata.gitConfig!['zoekt.display-name']).toBe('git.kernel.org/pub/scm/bluetooth/bluez');
        expect(metadata.gitConfig!['zoekt.archived']).toBe('0');
        expect(metadata.gitConfig!['zoekt.fork']).toBe('0');
        expect(metadata.gitConfig!['zoekt.public']).toBe('1');
    });

    test('should handle url with trailing .git correctly', async () => {
        mockedIsUrlAValidGitRepo.mockResolvedValue(true);

        const config = {
            type: 'git' as const,
            url: 'https://github.com/test/repo.git',
        };

        const result = await compileGenericGitHostConfig_url(config, 1);

        expect(result.repoData).toHaveLength(1);
        expect(result.repoData[0].name).toBe('github.com/test/repo');
        
        const metadata = result.repoData[0].metadata as { gitConfig?: Record<string, string> };
        expect(metadata.gitConfig!['zoekt.name']).toBe('github.com/test/repo');
    });
});
