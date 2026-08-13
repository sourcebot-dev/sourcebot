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

import { globDefinition } from './glob';
import { grepDefinition } from './grep';
import { buildGlobSearchQuery, buildGrepSearchQuery } from './searchQuery';

const emptySearchResponse = {
    files: [],
    repositoryInfo: [],
    stats: { actualMatchCount: 0 },
    isSearchExhaustive: true,
};

describe('agent search tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.search.mockResolvedValue(emptySearchResponse);
    });

    it('executes grep with QueryIR', async () => {
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

    it('executes glob with QueryIR', async () => {
        const result = await globDefinition.execute({
            pattern: 'My Folder/**/*.ts',
            ref: 'feature/my feature',
        }, {
            source: 'test',
            selectedRepos: ['Repo One'],
        });

        expect(mocks.search).toHaveBeenCalledWith({
            queryType: 'ir',
            query: buildGlobSearchQuery({
                pattern: 'My Folder/**/*.ts',
                ref: 'feature/my feature',
                selectedRepos: ['Repo One'],
            }),
            options: {
                matches: 100,
                contextLines: 0,
            },
            source: 'test',
        });
        expect(result.metadata).not.toHaveProperty('query');
    });
});
