import { expect, test, vi, describe } from 'vitest';
import { gitlabPushMrReviews } from './gitlabPushMrReviews';
import { sourcebot_pr_payload, sourcebot_file_diff_review } from '../types';

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

const MOCK_PAYLOAD: sourcebot_pr_payload = {
    title: 'Test MR',
    description: 'desc',
    hostDomain: 'gitlab.com',
    owner: 'my-group',
    repo: 'my-repo',
    file_diffs: [],
    number: 42,
    head_sha: 'head_sha_value',
    diff_refs: {
        base_sha: 'base_sha_value',
        head_sha: 'head_sha_value',
        start_sha: 'start_sha_value',
    },
};

const SINGLE_REVIEW: sourcebot_file_diff_review[] = [
    {
        filename: 'src/foo.ts',
        reviews: [{ line_start: 5, line_end: 5, review: 'Avoid this pattern' }],
    },
];

function makeMockClient(discussionResult: 'resolve' | 'reject' = 'resolve') {
    return {
        MergeRequestDiscussions: {
            create: discussionResult === 'resolve'
                ? vi.fn().mockResolvedValue({})
                : vi.fn().mockRejectedValue(new Error('400 Bad Request')),
        },
        MergeRequestNotes: {
            create: vi.fn().mockResolvedValue({}),
        },
    } as any;
}

describe('gitlabPushMrReviews', () => {
    test('posts an inline discussion for each review', async () => {
        const client = makeMockClient();

        await gitlabPushMrReviews(client, 101, MOCK_PAYLOAD, SINGLE_REVIEW);

        expect(client.MergeRequestDiscussions.create).toHaveBeenCalledOnce();
        expect(client.MergeRequestDiscussions.create).toHaveBeenCalledWith(
            101,
            42,
            'Avoid this pattern',
            expect.objectContaining({
                position: expect.objectContaining({
                    positionType: 'text',
                    baseSha: 'base_sha_value',
                    headSha: 'head_sha_value',
                    startSha: 'start_sha_value',
                    newPath: 'src/foo.ts',
                    newLine: '5',
                }),
            }),
        );
    });

    test('does not post a fallback note when inline comment succeeds', async () => {
        const client = makeMockClient('resolve');

        await gitlabPushMrReviews(client, 101, MOCK_PAYLOAD, SINGLE_REVIEW);

        expect(client.MergeRequestNotes.create).not.toHaveBeenCalled();
    });

    test('falls back to MR note when inline discussion create fails', async () => {
        const client = makeMockClient('reject');

        await gitlabPushMrReviews(client, 101, MOCK_PAYLOAD, SINGLE_REVIEW);

        expect(client.MergeRequestNotes.create).toHaveBeenCalledOnce();
        expect(client.MergeRequestNotes.create).toHaveBeenCalledWith(
            101,
            42,
            expect.stringContaining('Avoid this pattern'),
        );
    });

    test('fallback note body includes the filename', async () => {
        const client = makeMockClient('reject');

        await gitlabPushMrReviews(client, 101, MOCK_PAYLOAD, SINGLE_REVIEW);

        const noteBody = client.MergeRequestNotes.create.mock.calls[0][2] as string;
        expect(noteBody).toContain('src/foo.ts');
    });

    test('fallback note body includes the line range', async () => {
        const multiLineReviews: sourcebot_file_diff_review[] = [
            {
                filename: 'src/bar.ts',
                reviews: [{ line_start: 10, line_end: 20, review: 'Refactor this block' }],
            },
        ];
        const client = makeMockClient('reject');

        await gitlabPushMrReviews(client, 101, MOCK_PAYLOAD, multiLineReviews);

        const noteBody = client.MergeRequestNotes.create.mock.calls[0][2] as string;
        expect(noteBody).toContain('10');
        expect(noteBody).toContain('20');
        expect(noteBody).toContain('Refactor this block');
    });

    test('returns early and does not post when diff_refs is missing', async () => {
        const payloadWithoutRefs: sourcebot_pr_payload = { ...MOCK_PAYLOAD, diff_refs: undefined };
        const client = makeMockClient();

        await gitlabPushMrReviews(client, 101, payloadWithoutRefs, SINGLE_REVIEW);

        expect(client.MergeRequestDiscussions.create).not.toHaveBeenCalled();
        expect(client.MergeRequestNotes.create).not.toHaveBeenCalled();
    });

    test('posts multiple reviews across multiple files', async () => {
        const multiFileReviews: sourcebot_file_diff_review[] = [
            {
                filename: 'src/a.ts',
                reviews: [
                    { line_start: 1, line_end: 1, review: 'Comment A1' },
                    { line_start: 5, line_end: 5, review: 'Comment A2' },
                ],
            },
            {
                filename: 'src/b.ts',
                reviews: [{ line_start: 3, line_end: 3, review: 'Comment B1' }],
            },
        ];
        const client = makeMockClient();

        await gitlabPushMrReviews(client, 101, MOCK_PAYLOAD, multiFileReviews);

        expect(client.MergeRequestDiscussions.create).toHaveBeenCalledTimes(3);
    });

    test('continues posting remaining reviews when one inline comment fails', async () => {
        const twoReviews: sourcebot_file_diff_review[] = [
            {
                filename: 'src/foo.ts',
                reviews: [
                    { line_start: 1, line_end: 1, review: 'First comment' },
                    { line_start: 10, line_end: 10, review: 'Second comment' },
                ],
            },
        ];
        const mockCreate = vi.fn()
            .mockRejectedValueOnce(new Error('400'))
            .mockResolvedValueOnce({});
        const client = {
            MergeRequestDiscussions: { create: mockCreate },
            MergeRequestNotes: { create: vi.fn().mockResolvedValue({}) },
        } as any;

        await gitlabPushMrReviews(client, 101, MOCK_PAYLOAD, twoReviews);

        expect(mockCreate).toHaveBeenCalledTimes(2);
        // First failed → fallback note; second succeeded → no note
        expect(client.MergeRequestNotes.create).toHaveBeenCalledOnce();
    });

    test('does not throw when both discussion and note creation fail', async () => {
        const client = {
            MergeRequestDiscussions: { create: vi.fn().mockRejectedValue(new Error('500')) },
            MergeRequestNotes: { create: vi.fn().mockRejectedValue(new Error('500')) },
        } as any;

        await expect(
            gitlabPushMrReviews(client, 101, MOCK_PAYLOAD, SINGLE_REVIEW),
        ).resolves.not.toThrow();
    });
});
