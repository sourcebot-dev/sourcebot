import { expect, test, vi, describe, beforeEach } from 'vitest';
import { sourcebot_pr_payload } from '@/features/agents/review-agent/types';

// Mock the org lookup so fetchContextFile doesn't hit the DB.
vi.mock('@/prisma', async () => {
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return { ...actual };
});

const mockGetFileSourceForRepo = vi.fn();
vi.mock('@/features/git', () => ({
    getFileSourceForRepo: (...args: unknown[]) => mockGetFileSourceForRepo(...args),
    fileSourceResponseSchema: {
        safeParse: (v: unknown) => {
            if (v && typeof v === 'object' && 'source' in v) {
                return { success: true, data: v };
            }
            return { success: false, error: new Error('parse failure') };
        },
    },
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@/lib/constants', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/constants')>();
    return { ...actual, SINGLE_TENANT_ORG_ID: 1 };
});

// Import after mocks are in place.
import { fetchContextFile } from './fetchFileContent';
import { prisma } from '@/__mocks__/prisma';

const MOCK_ORG = { id: 1, name: 'test-org' };

const MOCK_PAYLOAD: sourcebot_pr_payload = {
    title: 'Test PR',
    description: '',
    hostDomain: 'github.com',
    owner: 'acme',
    repo: 'api',
    file_diffs: [],
    number: 42,
    head_sha: 'abc123',
};

beforeEach(() => {
    mockGetFileSourceForRepo.mockReset();
    (prisma.org.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_ORG);
});

// ─── fetchContextFile ─────────────────────────────────────────────────────────

describe('fetchContextFile', () => {
    test('returns null when getFileSourceForRepo returns a service error', async () => {
        mockGetFileSourceForRepo.mockResolvedValue({
            statusCode: 404,
            errorCode: 'NOT_FOUND',
            message: 'not found',
        });

        const result = await fetchContextFile(MOCK_PAYLOAD, 'AGENTS.md');

        expect(result).toBeNull();
    });

    test('returns null when the response fails schema validation', async () => {
        // Return something that looks like a non-service-error but has no `source` field.
        mockGetFileSourceForRepo.mockResolvedValue({ unexpected: true });

        const result = await fetchContextFile(MOCK_PAYLOAD, 'AGENTS.md');

        expect(result).toBeNull();
    });

    test('returns a sourcebot_context with type "repo_instructions" on success', async () => {
        mockGetFileSourceForRepo.mockResolvedValue({ source: 'Use Result<T, E> for errors.' });

        const result = await fetchContextFile(MOCK_PAYLOAD, 'AGENTS.md');

        expect(result).not.toBeNull();
        expect(result!.type).toBe('repo_instructions');
    });

    test('context field contains the file source content', async () => {
        const content = 'Avoid inline SQL. Prefer the ORM.';
        mockGetFileSourceForRepo.mockResolvedValue({ source: content });

        const result = await fetchContextFile(MOCK_PAYLOAD, 'AGENTS.md');

        expect(result!.context).toBe(content);
    });

    test('description includes the requested file path', async () => {
        mockGetFileSourceForRepo.mockResolvedValue({ source: 'x' });

        const result = await fetchContextFile(MOCK_PAYLOAD, '.sourcebot/review.md');

        expect(result!.description).toContain('.sourcebot/review.md');
    });

    test('passes the correct repo path and head SHA to getFileSourceForRepo', async () => {
        mockGetFileSourceForRepo.mockResolvedValue({ source: '' });

        await fetchContextFile(MOCK_PAYLOAD, 'AGENTS.md');

        expect(mockGetFileSourceForRepo).toHaveBeenCalledWith(
            expect.objectContaining({
                path: 'AGENTS.md',
                repo: 'github.com/acme/api',
                ref: 'abc123',
            }),
            expect.anything(),
        );
    });
});
