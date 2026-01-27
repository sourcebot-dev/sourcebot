import { sew } from '@/actions';
import { notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from '@/withAuthV2';
import { getRepoPath } from '@sourcebot/shared';
import { simpleGit } from 'simple-git';
import { toGitDate, validateDateRange } from './dateUtils';

export interface Commit {
    hash: string;
    date: string;
    message: string;
    refs: string;
    body: string;
    author_name: string;
    author_email: string;
}

export interface SearchCommitsResult {
    commits: Commit[];
    totalCount: number;
}

type ListCommitsRequest = {
    repo: string;
    query?: string;
    since?: string;
    until?: string;
    author?: string;
    ref?: string;
    maxCount?: number;
    skip?: number;
}

/**
 * List commits in a repository using git log.
 *
 * **Date Formats**: Supports both ISO 8601 dates and relative formats
 * (e.g., "30 days ago", "last week", "yesterday"). Git natively handles
 * these formats in the --since and --until flags.
 */
export const listCommits = async ({
    repo: repoName,
    query,
    since,
    until,
    author,
    ref = 'HEAD',
    maxCount = 50,
    skip = 0,
}: ListCommitsRequest): Promise<SearchCommitsResult | ServiceError> => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const repo = await prisma.repo.findFirst({
            where: {
                name: repoName,
                orgId: org.id,
            },
        });

        if (!repo) {
            return notFound(`Repository "${repoName}" not found.`);
        }

        const { path: repoPath } = getRepoPath(repo);

        // Validate date range if both since and until are provided
        const dateRangeError = validateDateRange(since, until);
        if (dateRangeError) {
            return unexpectedError(dateRangeError);
        }

        // Parse dates to git-compatible format
        const gitSince = toGitDate(since);
        const gitUntil = toGitDate(until);

        const git = simpleGit().cwd(repoPath);

        try {
            const sharedOptions: Record<string, string | number | null> = {
                [ref]: null,
                ...(gitSince ? { '--since': gitSince } : {}),
                ...(gitUntil ? { '--until': gitUntil } : {}),
                ...(author ? {
                    '--author': author,
                    '--regexp-ignore-case': null /// Case insensitive
                } : {}),
                ...(query ? {
                    '--grep': query,
                    '--regexp-ignore-case': null /// Case insensitive
                } : {}),
            };

            // First, get the commits
            const log = await git.log({
                maxCount,
                ...(skip > 0 ? { '--skip': skip } : {}),
                ...sharedOptions,
            });

            // Then, use rev-list to get the total count of commits
            const countArgs = ['rev-list', '--count', ref];
            for (const [key, value] of Object.entries(sharedOptions)) {
                countArgs.push(value !== null ? `${key}=${value}` : key);
            }

            const totalCount = parseInt((await git.raw(countArgs)).trim(), 10);

            return { commits: log.all as unknown as Commit[], totalCount };
        } catch (error: unknown) {
            // Provide detailed error messages for common git errors
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('not a git repository')) {
                return unexpectedError(
                    `Invalid git repository at ${repoPath}. ` +
                    `The directory exists but is not a valid git repository.`
                );
            }

            if (errorMessage.includes('ambiguous argument')) {
                return unexpectedError(
                    `Invalid git reference or date format. ` +
                    `Please check your date parameters: since="${since}", until="${until}"`
                );
            }

            if (errorMessage.includes('timeout')) {
                return unexpectedError(
                    `Git operation timed out after 30 seconds for repository ${repoName}. ` +
                    `The repository may be too large or the git operation is taking too long.`
                );
            }

            // Generic error fallback
            if (error instanceof Error) {
                throw new Error(
                    `Failed to search commits in repository ${repoName}: ${error.message}`
                );
            } else {
                throw new Error(
                    `Failed to search commits in repository ${repoName}: ${errorMessage}`
                );
            }
        }
    }));
