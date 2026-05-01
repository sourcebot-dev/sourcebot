import { expect, test, vi, describe } from 'vitest';
import { githubPrParser } from './githubPrParser';
import { GitHubPullRequest } from '../types';

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

// Minimal shape satisfying the fields accessed by githubPrParser
function makePullRequest(overrides: Partial<{
    number: number;
    title: string;
    body: string | null;
    head_sha: string;
    owner: string;
    repo: string;
    diff_url: string;
}> = {}): GitHubPullRequest {
    const opts = {
        number: 7,
        title: 'My PR title',
        body: 'My PR description',
        head_sha: 'sha_abc123',
        owner: 'my-org',
        repo: 'my-repo',
        diff_url: 'https://github.com/my-org/my-repo/pull/7.diff',
        ...overrides,
    };

    return {
        number: opts.number,
        title: opts.title,
        body: opts.body,
        diff_url: opts.diff_url,
        head: { sha: opts.head_sha, repo: {} },
        base: {
            repo: {
                name: opts.repo,
                owner: { login: opts.owner },
            },
        },
    } as unknown as GitHubPullRequest;
}

function makeMockOctokit(diffText: string) {
    return {
        request: vi.fn().mockResolvedValue({ data: diffText }),
    } as any;
}

describe('githubPrParser', () => {
    test('maps pull request metadata correctly', async () => {
        const octokit = makeMockOctokit('');
        const pr = makePullRequest();

        const result = await githubPrParser(octokit, pr);

        expect(result.title).toBe('My PR title');
        expect(result.description).toBe('My PR description');
        expect(result.number).toBe(7);
        expect(result.head_sha).toBe('sha_abc123');
        expect(result.owner).toBe('my-org');
        expect(result.repo).toBe('my-repo');
        expect(result.hostDomain).toBe('github.com');
    });

    test('uses empty string when body is null', async () => {
        const octokit = makeMockOctokit('');
        const pr = makePullRequest({ body: null });

        const result = await githubPrParser(octokit, pr);

        expect(result.description).toBe('');
    });

    test('fetches diff using the pull request diff_url', async () => {
        const mockRequest = vi.fn().mockResolvedValue({ data: '' });
        const octokit = { request: mockRequest } as any;
        const pr = makePullRequest({ diff_url: 'https://github.com/my-org/my-repo/pull/7.diff' });

        await githubPrParser(octokit, pr);

        expect(mockRequest).toHaveBeenCalledWith('https://github.com/my-org/my-repo/pull/7.diff');
    });

    test('returns empty file_diffs for an empty diff', async () => {
        const octokit = makeMockOctokit('');
        const pr = makePullRequest();

        const result = await githubPrParser(octokit, pr);

        expect(result.file_diffs).toEqual([]);
    });

    test('parses a unified diff with added and context lines', async () => {
        const unifiedDiff = [
            'diff --git a/src/foo.ts b/src/foo.ts',
            '--- a/src/foo.ts',
            '+++ b/src/foo.ts',
            '@@ -1,2 +1,3 @@',
            ' context line',
            '+added line',
            ' another context',
        ].join('\n');
        const octokit = makeMockOctokit(unifiedDiff);
        const pr = makePullRequest();

        const result = await githubPrParser(octokit, pr);

        expect(result.file_diffs).toHaveLength(1);
        expect(result.file_diffs[0].from).toBe('src/foo.ts');
        expect(result.file_diffs[0].to).toBe('src/foo.ts');
        expect(result.file_diffs[0].diffs).toHaveLength(1);
    });

    test('newSnippet contains added lines and context', async () => {
        const unifiedDiff = [
            'diff --git a/src/foo.ts b/src/foo.ts',
            '--- a/src/foo.ts',
            '+++ b/src/foo.ts',
            '@@ -1,1 +1,2 @@',
            ' context',
            '+new line here',
        ].join('\n');
        const octokit = makeMockOctokit(unifiedDiff);
        const pr = makePullRequest();

        const result = await githubPrParser(octokit, pr);
        const diff = result.file_diffs[0].diffs[0];

        expect(diff.newSnippet).toContain('+new line here');
        expect(diff.oldSnippet).not.toContain('+new line here');
    });

    test('oldSnippet contains deleted lines', async () => {
        const unifiedDiff = [
            'diff --git a/src/foo.ts b/src/foo.ts',
            '--- a/src/foo.ts',
            '+++ b/src/foo.ts',
            '@@ -1,2 +1,1 @@',
            ' context',
            '-removed line',
        ].join('\n');
        const octokit = makeMockOctokit(unifiedDiff);
        const pr = makePullRequest();

        const result = await githubPrParser(octokit, pr);
        const diff = result.file_diffs[0].diffs[0];

        expect(diff.oldSnippet).toContain('-removed line');
        expect(diff.newSnippet).not.toContain('-removed line');
    });

    test('parses multiple files from a diff', async () => {
        const unifiedDiff = [
            'diff --git a/src/a.ts b/src/a.ts',
            '--- a/src/a.ts',
            '+++ b/src/a.ts',
            '@@ -1,1 +1,2 @@',
            ' ctx',
            '+add',
            'diff --git a/src/b.ts b/src/b.ts',
            '--- a/src/b.ts',
            '+++ b/src/b.ts',
            '@@ -1,2 +1,1 @@',
            ' ctx',
            '-remove',
        ].join('\n');
        const octokit = makeMockOctokit(unifiedDiff);
        const pr = makePullRequest();

        const result = await githubPrParser(octokit, pr);

        expect(result.file_diffs).toHaveLength(2);
        expect(result.file_diffs[0].to).toBe('src/a.ts');
        expect(result.file_diffs[1].to).toBe('src/b.ts');
    });

    test('throws when the diff request fails', async () => {
        const octokit = {
            request: vi.fn().mockRejectedValue(new Error('Network error')),
        } as any;
        const pr = makePullRequest();

        await expect(githubPrParser(octokit, pr)).rejects.toThrow('Network error');
    });
});
