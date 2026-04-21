import { expect, test, vi, describe } from 'vitest';
import { gitlabMrParser } from './gitlabMrParser';
import { GitLabMergeRequestPayload } from '../types';

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

const MOCK_MR_PAYLOAD: GitLabMergeRequestPayload = {
    object_kind: 'merge_request',
    object_attributes: {
        iid: 42,
        title: 'My MR title',
        description: 'My MR description',
        action: 'open',
        last_commit: { id: 'abc123def456' },
        diff_refs: {
            base_sha: 'base_sha_value',
            head_sha: 'head_sha_value',
            start_sha: 'start_sha_value',
        },
    },
    project: {
        id: 101,
        name: 'my-repo',
        path_with_namespace: 'my-group/my-repo',
        web_url: 'https://gitlab.com/my-group/my-repo',
        namespace: 'my-group',
    },
};

const MOCK_MR_API_RESPONSE = {
    title: 'My MR title',
    description: 'My MR description',
    sha: 'abc123def456',
    diff_refs: {
        base_sha: 'base_sha_value',
        head_sha: 'head_sha_value',
        start_sha: 'start_sha_value',
    },
};

function makeMockGitlabClient(allDiffsResult: unknown, mrOverrides: Partial<typeof MOCK_MR_API_RESPONSE> = {}) {
    return {
        MergeRequests: {
            show: vi.fn().mockResolvedValue({ ...MOCK_MR_API_RESPONSE, ...mrOverrides }),
            allDiffs: vi.fn().mockResolvedValue(allDiffsResult),
        },
    } as any;
}

describe('gitlabMrParser', () => {
    test('maps MR payload metadata correctly to sourcebot_pr_payload', async () => {
        const client = makeMockGitlabClient([]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');

        expect(result.title).toBe('My MR title');
        expect(result.description).toBe('My MR description');
        expect(result.number).toBe(42);
        expect(result.head_sha).toBe('abc123def456');
        expect(result.hostDomain).toBe('gitlab.com');
        expect(result.owner).toBe('my-group');
        expect(result.repo).toBe('my-repo');
    });

    test('maps diff_refs from payload', async () => {
        const client = makeMockGitlabClient([]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');

        expect(result.diff_refs).toEqual({
            base_sha: 'base_sha_value',
            head_sha: 'head_sha_value',
            start_sha: 'start_sha_value',
        });
    });

    test('uses custom hostDomain', async () => {
        const client = makeMockGitlabClient([]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.example.com');

        expect(result.hostDomain).toBe('gitlab.example.com');
    });

    test('uses empty string when description is null', async () => {
        const client = makeMockGitlabClient([], { description: null });

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');

        expect(result.description).toBe('');
    });

    test('calls show and allDiffs with the correct project id and MR iid', async () => {
        const mockShow = vi.fn().mockResolvedValue(MOCK_MR_API_RESPONSE);
        const mockAllDiffs = vi.fn().mockResolvedValue([]);
        const client = { MergeRequests: { show: mockShow, allDiffs: mockAllDiffs } } as any;

        await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');

        expect(mockShow).toHaveBeenCalledWith(101, 42);
        expect(mockAllDiffs).toHaveBeenCalledWith(101, 42);
    });

    test('returns empty file_diffs when allDiffs returns no files', async () => {
        const client = makeMockGitlabClient([]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');

        expect(result.file_diffs).toEqual([]);
    });

    test('parses a file diff with added and context lines', async () => {
        const client = makeMockGitlabClient([
            {
                old_path: 'src/foo.ts',
                new_path: 'src/foo.ts',
                diff: '@@ -1,2 +1,3 @@\n context line\n+added line\n',
                new_file: false,
                renamed_file: false,
                deleted_file: false,
                a_mode: '100644',
                b_mode: '100644',
            },
        ]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');

        expect(result.file_diffs).toHaveLength(1);
        expect(result.file_diffs[0].from).toBe('src/foo.ts');
        expect(result.file_diffs[0].to).toBe('src/foo.ts');
        expect(result.file_diffs[0].diffs).toHaveLength(1);
    });

    test('diff newSnippet contains added lines', async () => {
        const client = makeMockGitlabClient([
            {
                old_path: 'src/foo.ts',
                new_path: 'src/foo.ts',
                diff: '@@ -1,1 +1,2 @@\n context\n+added line\n',
                new_file: false,
                renamed_file: false,
                deleted_file: false,
                a_mode: '100644',
                b_mode: '100644',
            },
        ]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');
        const diff = result.file_diffs[0].diffs[0];

        expect(diff.newSnippet).toContain('+added line');
        expect(diff.oldSnippet).not.toContain('+added line');
    });

    test('diff oldSnippet contains deleted lines', async () => {
        const client = makeMockGitlabClient([
            {
                old_path: 'src/foo.ts',
                new_path: 'src/foo.ts',
                diff: '@@ -1,2 +1,1 @@\n context\n-removed line\n',
                new_file: false,
                renamed_file: false,
                deleted_file: false,
                a_mode: '100644',
                b_mode: '100644',
            },
        ]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');
        const diff = result.file_diffs[0].diffs[0];

        expect(diff.oldSnippet).toContain('-removed line');
        expect(diff.newSnippet).not.toContain('-removed line');
    });

    test('skips files with empty diff strings', async () => {
        const client = makeMockGitlabClient([
            {
                old_path: 'binary.png',
                new_path: 'binary.png',
                diff: '',
                new_file: false,
                renamed_file: false,
                deleted_file: false,
                a_mode: '100644',
                b_mode: '100644',
            },
        ]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');

        expect(result.file_diffs).toHaveLength(0);
    });

    test('handles multiple files in allDiffs response', async () => {
        const client = makeMockGitlabClient([
            {
                old_path: 'src/a.ts',
                new_path: 'src/a.ts',
                diff: '@@ -1,1 +1,2 @@\n ctx\n+add\n',
                new_file: false, renamed_file: false, deleted_file: false, a_mode: '100644', b_mode: '100644',
            },
            {
                old_path: 'src/b.ts',
                new_path: 'src/b.ts',
                diff: '@@ -1,2 +1,1 @@\n ctx\n-remove\n',
                new_file: false, renamed_file: false, deleted_file: false, a_mode: '100644', b_mode: '100644',
            },
        ]);

        const result = await gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com');

        expect(result.file_diffs).toHaveLength(2);
        expect(result.file_diffs[0].to).toBe('src/a.ts');
        expect(result.file_diffs[1].to).toBe('src/b.ts');
    });

    test('extracts owner from path_with_namespace with nested groups', async () => {
        const client = makeMockGitlabClient([]);
        const payload = {
            ...MOCK_MR_PAYLOAD,
            project: {
                ...MOCK_MR_PAYLOAD.project,
                path_with_namespace: 'top-group/sub-group/my-repo',
            },
        };

        const result = await gitlabMrParser(client, payload, 'gitlab.com');

        expect(result.owner).toBe('top-group/sub-group');
        expect(result.repo).toBe('my-repo');
    });

    test('throws when an API call fails', async () => {
        const client = {
            MergeRequests: {
                show: vi.fn().mockResolvedValue(MOCK_MR_API_RESPONSE),
                allDiffs: vi.fn().mockRejectedValue(new Error('Network error')),
            },
        } as any;

        await expect(gitlabMrParser(client, MOCK_MR_PAYLOAD, 'gitlab.com')).rejects.toThrow('Network error');
    });
});
