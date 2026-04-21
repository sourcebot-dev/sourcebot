import { getDiff, GetDiffResult } from '@/features/git';
import { getDiffRequestSchema } from '@/features/git/schemas';
import { isServiceError } from '@/lib/utils';
import description from './getDiff.txt';
import { logger } from './logger';
import { ToolDefinition } from './types';

export type GetDiffMetadata = GetDiffResult & {
    repo: string;
    base: string;
    head: string;
};

export const getDiffDefinition: ToolDefinition<'get_diff', typeof getDiffRequestSchema.shape, GetDiffMetadata> = {
    name: 'get_diff',
    title: 'Get diff',
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: getDiffRequestSchema,
    execute: async ({ repo, base, head }, _context) => {
        logger.debug('get_diff', { repo, base, head });

        const response = await getDiff({ repo, base, head });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        return {
            output: JSON.stringify(response),
            metadata: {
                ...response,
                repo,
                base,
                head,
            },
        };
    },
};
