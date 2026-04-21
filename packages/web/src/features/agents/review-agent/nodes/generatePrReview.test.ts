import { expect, test, vi, describe, beforeEach } from 'vitest';
import { sourcebot_pr_payload } from '@/features/agents/review-agent/types';

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

const mockFetchContextFile = vi.fn();
const mockFetchFileContent = vi.fn();
const mockGenerateDiffReviewPrompt = vi.fn();
const mockInvokeDiffReviewLlm = vi.fn();

vi.mock('@/features/agents/review-agent/nodes/fetchFileContent', () => ({
    fetchContextFile: (...args: unknown[]) => mockFetchContextFile(...args),
    fetchFileContent: (...args: unknown[]) => mockFetchFileContent(...args),
}));

vi.mock('@/features/agents/review-agent/nodes/generateDiffReviewPrompt', () => ({
    generateDiffReviewPrompt: (...args: unknown[]) => mockGenerateDiffReviewPrompt(...args),
}));

vi.mock('@/features/agents/review-agent/nodes/invokeDiffReviewLlm', () => ({
    invokeDiffReviewLlm: (...args: unknown[]) => mockInvokeDiffReviewLlm(...args),
    getReviewAgentLogDir: vi.fn(() => '/tmp'),
}));

import { generatePrReviews } from './generatePrReview';

// A minimal PR payload with one file and one diff hunk.
function makePayload(overrides: Partial<sourcebot_pr_payload> = {}): sourcebot_pr_payload {
    return {
        title: 'Test PR',
        description: '',
        hostDomain: 'github.com',
        owner: 'acme',
        repo: 'api',
        number: 1,
        head_sha: 'abc123',
        file_diffs: [
            {
                from: 'src/foo.ts',
                to: 'src/foo.ts',
                diffs: [{ oldSnippet: 'old', newSnippet: 'new' }],
            },
        ],
        ...overrides,
    };
}

const FILE_CONTENT_CTX = { type: 'file_content' as const, description: 'file', context: 'content' };
const REPO_INSTRUCTIONS_CTX = { type: 'repo_instructions' as const, description: 'instructions', context: 'Use Result<T,E>.' };

beforeEach(() => {
    mockFetchContextFile.mockReset();
    mockFetchFileContent.mockReset();
    mockGenerateDiffReviewPrompt.mockReset();
    mockInvokeDiffReviewLlm.mockReset();

    mockFetchFileContent.mockResolvedValue(FILE_CONTENT_CTX);
    mockGenerateDiffReviewPrompt.mockResolvedValue('prompt text');
    mockInvokeDiffReviewLlm.mockResolvedValue({ reviews: [] });
});

// ─── contextFiles parameter ───────────────────────────────────────────────────

describe('contextFiles parameter', () => {
    test('does not call fetchContextFile when contextFiles is undefined', async () => {
        await generatePrReviews(undefined, makePayload(), [], undefined, undefined);

        expect(mockFetchContextFile).not.toHaveBeenCalled();
    });

    test('does not call fetchContextFile when contextFiles is an empty string', async () => {
        await generatePrReviews(undefined, makePayload(), [], undefined, '');

        expect(mockFetchContextFile).not.toHaveBeenCalled();
    });

    test('calls fetchContextFile once for a single path', async () => {
        mockFetchContextFile.mockResolvedValue(null);

        await generatePrReviews(undefined, makePayload(), [], undefined, 'AGENTS.md');

        expect(mockFetchContextFile).toHaveBeenCalledTimes(1);
        expect(mockFetchContextFile).toHaveBeenCalledWith(expect.anything(), 'AGENTS.md');
    });

    test('calls fetchContextFile once per path in a comma-separated list', async () => {
        mockFetchContextFile.mockResolvedValue(null);

        await generatePrReviews(undefined, makePayload(), [], undefined, 'AGENTS.md,.sourcebot/review.md');

        expect(mockFetchContextFile).toHaveBeenCalledTimes(2);
        expect(mockFetchContextFile).toHaveBeenCalledWith(expect.anything(), 'AGENTS.md');
        expect(mockFetchContextFile).toHaveBeenCalledWith(expect.anything(), '.sourcebot/review.md');
    });

    test('calls fetchContextFile once per path in a space-separated list', async () => {
        mockFetchContextFile.mockResolvedValue(null);

        await generatePrReviews(undefined, makePayload(), [], undefined, 'AGENTS.md .sourcebot/review.md');

        expect(mockFetchContextFile).toHaveBeenCalledTimes(2);
    });

    test('fetchContextFile is called only once regardless of the number of diffs', async () => {
        mockFetchContextFile.mockResolvedValue(null);

        const payload = makePayload({
            file_diffs: [
                { from: 'a.ts', to: 'a.ts', diffs: [{ oldSnippet: 'a', newSnippet: 'b' }, { oldSnippet: 'c', newSnippet: 'd' }] },
                { from: 'b.ts', to: 'b.ts', diffs: [{ oldSnippet: 'e', newSnippet: 'f' }] },
            ],
        });

        await generatePrReviews(undefined, payload, [], undefined, 'AGENTS.md');

        expect(mockFetchContextFile).toHaveBeenCalledTimes(1);
    });

    test('a null result from fetchContextFile (missing file) is excluded from context', async () => {
        mockFetchContextFile.mockResolvedValue(null);

        await generatePrReviews(undefined, makePayload(), [], undefined, 'AGENTS.md');

        expect(mockGenerateDiffReviewPrompt).toHaveBeenCalledWith(
            expect.anything(),
            expect.not.arrayContaining([expect.objectContaining({ type: 'repo_instructions' })]),
            expect.anything(),
        );
    });

    test('a successful fetchContextFile result is included in the context for every diff', async () => {
        mockFetchContextFile.mockResolvedValue(REPO_INSTRUCTIONS_CTX);

        const payload = makePayload({
            file_diffs: [
                { from: 'a.ts', to: 'a.ts', diffs: [{ oldSnippet: 'a', newSnippet: 'b' }] },
                { from: 'b.ts', to: 'b.ts', diffs: [{ oldSnippet: 'c', newSnippet: 'd' }] },
            ],
        });

        await generatePrReviews(undefined, payload, [], undefined, 'AGENTS.md');

        // generateDiffReviewPrompt is called once per diff (2 files × 1 diff each = 2 calls).
        expect(mockGenerateDiffReviewPrompt).toHaveBeenCalledTimes(2);
        for (const call of mockGenerateDiffReviewPrompt.mock.calls) {
            const context: unknown[] = call[1];
            expect(context).toContainEqual(expect.objectContaining({ type: 'repo_instructions' }));
        }
    });

    test('only non-null context files are included when some paths are missing', async () => {
        mockFetchContextFile
            .mockResolvedValueOnce(REPO_INSTRUCTIONS_CTX)  // AGENTS.md found
            .mockResolvedValueOnce(null);                   // missing.md not found

        await generatePrReviews(undefined, makePayload(), [], undefined, 'AGENTS.md missing.md');

        const context: unknown[] = mockGenerateDiffReviewPrompt.mock.calls[0][1];
        const repoInstructions = context.filter((c: unknown) =>
            (c as { type: string }).type === 'repo_instructions'
        );
        expect(repoInstructions).toHaveLength(1);
    });
});
