import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    listBranches: vi.fn(),
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@/features/git', () => ({
    listBranches: mocks.listBranches,
}));

vi.mock('./logger', () => ({
    logger: mocks.logger,
}));

import { listBranchesDefinition } from './listBranches';

describe('listBranches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logs service error details and throws a sanitized error', async () => {
        const serviceError = {
            statusCode: 500,
            errorCode: 'UNEXPECTED_ERROR',
            message: 'Unexpected error: /private/repos/example: raw git failure',
        };
        mocks.listBranches.mockResolvedValue(serviceError);

        await expect(listBranchesDefinition.execute({ repo: 'example' }, {}))
            .rejects.toThrow('Failed to list branches.');

        expect(mocks.logger.error).toHaveBeenCalledWith('list_branches failed', {
            serviceError,
        });
    });

    it('returns branch data unchanged on success', async () => {
        const response = {
            repo: 'example',
            totalCount: 1,
            branches: [{
                name: 'main',
                commit: 'abc123',
                committedAt: '2026-08-18T00:00:00Z',
                isDefault: true,
                isIndexed: true,
            }],
        };
        mocks.listBranches.mockResolvedValue(response);

        const result = await listBranchesDefinition.execute({ repo: 'example' }, {});

        expect(result).toEqual({
            output: JSON.stringify(response),
            metadata: {
                repo: 'example',
                totalCount: 1,
                returnedCount: 1,
            },
        });
        expect(mocks.logger.error).not.toHaveBeenCalled();
    });
});
