import { expect, test, vi, describe } from 'vitest';
import { githubPushPrReviews } from './githubPushPrReviews';
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
    title: 'Test PR',
    description: 'desc',
    hostDomain: 'github.com',
    owner: 'my-org',
    repo: 'my-repo',
    file_diffs: [],
    number: 7,
    head_sha: 'sha_abc123',
};

const SINGLE_REVIEW: sourcebot_file_diff_review[] = [
    {
        filename: 'src/foo.ts',
        reviews: [{ line_start: 10, line_end: 10, review: 'Missing null check' }],
    },
];

function makeMockOctokit(createReviewCommentResult: 'resolve' | 'reject' = 'resolve', existingComments: { id: number; body: string }[] = []) {
    return {
        rest: {
            pulls: {
                createReviewComment: createReviewCommentResult === 'resolve'
                    ? vi.fn().mockResolvedValue({})
                    : vi.fn().mockRejectedValue(new Error('Unprocessable Entity')),
            },
            issues: {
                listComments: vi.fn().mockResolvedValue({ data: existingComments }),
                createComment: vi.fn().mockResolvedValue({}),
                updateComment: vi.fn().mockResolvedValue({}),
            },
        },
    } as any;
}

describe('githubPushPrReviews', () => {
    test('posts a review comment for each review', async () => {
        const octokit = makeMockOctokit();

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, SINGLE_REVIEW);

        expect(octokit.rest.pulls.createReviewComment).toHaveBeenCalledOnce();
        expect(octokit.rest.pulls.createReviewComment).toHaveBeenCalledWith(
            expect.objectContaining({
                owner: 'my-org',
                repo: 'my-repo',
                pull_number: 7,
                commit_id: 'sha_abc123',
                body: 'Missing null check',
                path: 'src/foo.ts',
                side: 'RIGHT',
                line: 10,
            }),
        );
    });

    test('uses line for a single-line review', async () => {
        const octokit = makeMockOctokit();

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, SINGLE_REVIEW);

        const call = octokit.rest.pulls.createReviewComment.mock.calls[0][0];
        expect(call).toHaveProperty('line', 10);
        expect(call).not.toHaveProperty('start_line');
    });

    test('uses start_line and line for a multi-line review', async () => {
        const multiLineReviews: sourcebot_file_diff_review[] = [
            {
                filename: 'src/bar.ts',
                reviews: [{ line_start: 5, line_end: 15, review: 'Refactor this block' }],
            },
        ];
        const octokit = makeMockOctokit();

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, multiLineReviews);

        const call = octokit.rest.pulls.createReviewComment.mock.calls[0][0];
        expect(call).toHaveProperty('start_line', 5);
        expect(call).toHaveProperty('line', 15);
        expect(call).toHaveProperty('start_side', 'RIGHT');
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
        const octokit = makeMockOctokit();

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, multiFileReviews);

        expect(octokit.rest.pulls.createReviewComment).toHaveBeenCalledTimes(3);
    });

    test('continues posting remaining reviews when one fails', async () => {
        const twoReviews: sourcebot_file_diff_review[] = [
            {
                filename: 'src/foo.ts',
                reviews: [
                    { line_start: 1, line_end: 1, review: 'First' },
                    { line_start: 2, line_end: 2, review: 'Second' },
                ],
            },
        ];
        const mockCreate = vi.fn()
            .mockRejectedValueOnce(new Error('422'))
            .mockResolvedValueOnce({});
        const octokit = { rest: { pulls: { createReviewComment: mockCreate } } } as any;

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, twoReviews);

        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    test('does not throw when all review comments fail', async () => {
        const octokit = makeMockOctokit('reject');

        await expect(
            githubPushPrReviews(octokit, MOCK_PAYLOAD, SINGLE_REVIEW),
        ).resolves.toBeUndefined();
    });

    test('does nothing when file_diff_reviews is empty', async () => {
        const octokit = makeMockOctokit();

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, []);

        expect(octokit.rest.pulls.createReviewComment).not.toHaveBeenCalled();
    });
});

describe('githubPushPrReviews – summary comment', () => {
    const SUMMARY_MARKER = '<!-- sourcebot-review-summary -->';

    test('does not call issues API when summary is undefined', async () => {
        const octokit = makeMockOctokit();

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, [], undefined);

        expect(octokit.rest.issues.listComments).not.toHaveBeenCalled();
        expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
        expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled();
    });

    test('creates a new comment including the marker when no existing comment found', async () => {
        const octokit = makeMockOctokit('resolve', []);

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, [], 'Summary text');

        expect(octokit.rest.issues.listComments).toHaveBeenCalledWith({
            owner: 'my-org',
            repo: 'my-repo',
            issue_number: 7,
        });
        expect(octokit.rest.issues.createComment).toHaveBeenCalledOnce();
        const body = octokit.rest.issues.createComment.mock.calls[0][0].body as string;
        expect(body).toContain(SUMMARY_MARKER);
        expect(body).toContain('Summary text');
        expect(body).toContain('Created:');
        expect(body).not.toContain('Updated:');
        expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled();
    });

    test('updates the existing comment when the marker is already present', async () => {
        const existingComments = [{ id: 99, body: `${SUMMARY_MARKER}\nOld summary` }];
        const octokit = makeMockOctokit('resolve', existingComments);

        await githubPushPrReviews(octokit, MOCK_PAYLOAD, [], 'New summary');

        expect(octokit.rest.issues.updateComment).toHaveBeenCalledOnce();
        expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith(
            expect.objectContaining({ comment_id: 99 }),
        );
        const body = octokit.rest.issues.updateComment.mock.calls[0][0].body as string;
        expect(body).toContain('New summary');
        expect(body).toContain('Updated:');
        expect(body).not.toContain('Created:');
        expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
    });

    test('does not throw when listComments fails', async () => {
        const octokit = makeMockOctokit();
        octokit.rest.issues.listComments = vi.fn().mockRejectedValue(new Error('403 Forbidden'));

        await expect(
            githubPushPrReviews(octokit, MOCK_PAYLOAD, [], 'Summary text'),
        ).resolves.not.toThrow();
    });
});
