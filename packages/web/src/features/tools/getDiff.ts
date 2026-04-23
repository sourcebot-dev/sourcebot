import { getDiff, GetDiffResult } from '@/features/git';
import { getDiffRequestSchema } from '@/features/git/schemas';
import { isServiceError } from '@/lib/utils';
import description from './getDiff.txt';
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

function formatDiffAsGitDiff(result: GetDiffResult): string {
    let output = '';

    for (const file of result.files) {
        const oldPath = file.oldPath ?? '/dev/null';
        const newPath = file.newPath ?? '/dev/null';

        output += `--- a/${oldPath}\n`;
        output += `+++ b/${newPath}\n`;

        for (const hunk of file.hunks) {
            const oldStart = hunk.oldRange.start;
            const oldLines = hunk.oldRange.lines;
            const newStart = hunk.newRange.start;
            const newLines = hunk.newRange.lines;

            output += `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`;
            if (hunk.heading) {
                output += ` ${hunk.heading}`;
            }
            output += '\n';

            output += hunk.body;
            if (!hunk.body.endsWith('\n')) {
                output += '\n';
            }
        }
    }

    return output;
}

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
