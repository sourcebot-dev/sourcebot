import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { findSearchBasedSymbolReferences, findSearchBasedSymbolDefinitions } from './api';
import { search } from '@/features/search';

vi.mock('@/features/search', () => ({
    search: vi.fn(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withOptionalAuth: (fn: any) => fn(),
}));

vi.mock('@/middleware/sew', () => ({
    sew: (fn: any) => fn(),
}));

const MOCK_SEARCH_RESPONSE = {
    stats: {
        actualMatchCount: 1,
        totalMatchCount: 1,
        duration: 100,
        fileCount: 1,
        filesSkipped: 0,
        contentBytesLoaded: 100,
        indexBytesLoaded: 100,
        crashes: 0,
        shardFilesConsidered: 1,
        filesConsidered: 1,
        filesLoaded: 1,
        shardsScanned: 1,
        shardsSkipped: 0,
        shardsSkippedFilter: 0,
        ngramMatches: 1,
        ngramLookups: 1,
        wait: 0,
        matchTreeConstruction: 10,
        matchTreeSearch: 90,
        regexpsConsidered: 0,
        flushReason: 'FLUSH_REASON_FINAL_FLUSH',
    },
    files: [
        {
            fileName: {
                text: 'src/index.ts',
                matchRanges: [],
            },
            repository: 'github.com/owner/repo',
            repositoryId: 123,
            webUrl: 'https://sourcebot.example.com/browse/github.com/owner/repo/blob/main/src/index.ts',
            language: 'TypeScript',
            ref: 'abcdef1234567890',
            chunks: [
                {
                    content: 'const a = 1;',
                    matchRanges: [
                        {
                            start: { byteOffset: 0, lineNumber: 1, column: 1 },
                            end: { byteOffset: 12, lineNumber: 1, column: 13 },
                        }
                    ],
                }
            ],
            branches: ['main'],
        }
    ],
    repositoryInfo: [],
    isSearchExhaustive: true,
};

describe('CodeNav Search-Based APIs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(search).mockResolvedValue(MOCK_SEARCH_RESPONSE as any);
    });

    describe('findSearchBasedSymbolReferences', () => {
        it('includes the ref (commit SHA) in the returned file results', async () => {
            const result = await findSearchBasedSymbolReferences({
                symbolName: 'mySymbol',
                repoName: 'github.com/owner/repo',
                revisionName: 'HEAD',
            });

            expect(isServiceError(result)).toBe(false);
            const response = result as any;
            expect(response.files).toHaveLength(1);
            expect(response.files[0].ref).toBe('abcdef1234567890');
        });
    });

    describe('findSearchBasedSymbolDefinitions', () => {
        it('includes the ref (commit SHA) in the returned file results', async () => {
            const result = await findSearchBasedSymbolDefinitions({
                symbolName: 'mySymbol',
                repoName: 'github.com/owner/repo',
                revisionName: 'HEAD',
            });

            expect(isServiceError(result)).toBe(false);
            const response = result as any;
            expect(response.files).toHaveLength(1);
            expect(response.files[0].ref).toBe('abcdef1234567890');
        });
    });
});

/**
 * Type guard that checks whether a given object is a ServiceError by looking for an `errorCode` property.
 *
 * @param obj - The value to inspect.
 * @returns True if the object looks like a ServiceError.
 */
function isServiceError(obj: any): boolean {
    return obj && typeof obj === 'object' && 'errorCode' in obj;
}
