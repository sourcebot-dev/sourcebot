import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    search: vi.fn(),
    getRepoInfoByName: vi.fn(),
}));

vi.mock('@/features/search', () => ({
    search: mocks.search,
}));

vi.mock('@/actions', () => ({
    getRepoInfoByName: mocks.getRepoInfoByName,
}));

vi.mock('@/lib/utils', () => ({
    isServiceError: () => false,
}));

vi.mock('./logger', () => ({
    logger: { debug: vi.fn() },
}));

import { grepDefinition } from './grep';
import { buildGrepSearchQuery } from './searchQuery';

const emptySearchResponse = {
    files: [],
    repositoryInfo: [],
    stats: { actualMatchCount: 0 },
    isSearchExhaustive: true,
};

describe('grep', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.search.mockResolvedValue(emptySearchResponse);
    });

    it('executes with QueryIR', async () => {
        const result = await grepDefinition.execute({
            pattern: 'needle',
            path: 'src/my dir',
            limit: 25,
        }, {
            source: 'test',
            selectedRepos: ['Repo One'],
        });

        expect(mocks.search).toHaveBeenCalledWith({
            queryType: 'ir',
            query: buildGrepSearchQuery({
                pattern: 'needle',
                path: 'src/my dir',
                selectedRepos: ['Repo One'],
            }),
            options: {
                matches: 25,
                contextLines: 0,
            },
            source: 'test',
        });
        expect(result.metadata).not.toHaveProperty('query');
    });
});
