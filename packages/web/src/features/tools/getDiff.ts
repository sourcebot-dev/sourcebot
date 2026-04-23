import { getDiff, GetDiffResult } from '@/features/git';
import { getDiffRequestSchema } from '@/features/git/schemas';
import { isServiceError } from '@/lib/utils';
import description from './getDiff.txt';
import { formatDiffAsGitDiff } from './utils';
import { logger } from './logger';
import { ToolDefinition } from './types';
import { CodeHostType } from '@sourcebot/db';
import { getRepoInfoByName } from '@/actions';

export type GetDiffRepoInfo = {
    name: string;
    displayName: string;
    codeHostType: CodeHostType;
};

export type GetDiffMetadata = GetDiffResult & {
    repo: string;
    repoInfo: GetDiffRepoInfo;
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

        const repoInfoResult = await getRepoInfoByName(repo);
        if (isServiceError(repoInfoResult) || !repoInfoResult) {
            throw new Error(`Repository "${repo}" not found.`);
        }
        const repoInfo: GetDiffRepoInfo = {
            name: repoInfoResult.name,
            displayName: repoInfoResult.displayName ?? repoInfoResult.name,
            codeHostType: repoInfoResult.codeHostType,
        };

        const gitDiffOutput = formatDiffAsGitDiff(response);

        return {
            output: gitDiffOutput,
            metadata: {
                ...response,
                repo,
                repoInfo,
                base,
                head,
            },
        };
    },
};
