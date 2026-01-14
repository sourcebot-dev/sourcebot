import { simpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { REPOS_CACHE_DIR } from '@sourcebot/shared';
import path from 'path';
import { ServiceError, unexpectedError } from '@/lib/serviceError';
import { sew } from '@/actions';
import { toGitDate, validateDateRange } from './dateUtils';
import { withOptionalAuthV2 } from '@/withAuthV2';
import { isServiceError } from '@/lib/utils';
import type { PrismaClient } from '@sourcebot/db';

const createGitClientForPath = (repoPath: string) => {
    return simpleGit({
        baseDir: repoPath,
        binary: 'git',
        maxConcurrentProcesses: 6,
        timeout: {
            block: 30000, // 30 second timeout for git operations
        },
    });
}

/**
 * Resolves a repository identifier to a numeric ID.
 * Accepts both numeric IDs and string repository names.
 *
 * @param identifier - Either a numeric repo ID or a string repo name (e.g., "github.com/owner/repo")
 * @param orgId - Organization ID to scope the lookup
 * @param prisma - Prisma client instance
 * @returns Numeric repository ID or ServiceError if not found
 */
const resolveRepoId = async (
    identifier: string | number,
    orgId: number,
    prisma: PrismaClient
): Promise<number | ServiceError> => {
    // If already numeric, return as-is
    if (typeof identifier === 'number') {
        return identifier;
    }

    // Convert string name to numeric ID
    const repo = await prisma.repo.findFirst({
        where: {
            name: identifier,
            orgId: orgId,
        },
        select: { id: true }
    });

    if (!repo) {
        return unexpectedError(
            `Repository "${identifier}" not found. ` +
            `Use 'list_repos' to get valid repository identifiers.`
        );
    }

    return repo.id;
}

export interface SearchCommitsRequest {
    repoId: string | number;
    query?: string;
    since?: string;
    until?: string;
    author?: string;
    maxCount?: number;
}

export interface Commit {
    hash: string;
    date: string;
    message: string;
    refs: string;
    body: string;
    author_name: string;
    author_email: string;
}

/**
 * Search commits in a repository using git log.
 *
 * **Date Formats**: Supports both ISO 8601 dates and relative formats
 * (e.g., "30 days ago", "last week", "yesterday"). Git natively handles
 * these formats in the --since and --until flags.
 *
 * **Requirements**: The repository must be cloned on the Sourcebot server disk.
 * Sourcebot automatically clones repositories during indexing, but the cloning
 * process might not be finished when this query is executed. If the repository
 * is not found on the server disk, an error will be returned.
 *
 * **Repository ID**: Accepts either a numeric database ID or a string repository name
 * (e.g., "github.com/owner/repo") as returned by list_repos.
 *
 * @param request - Search parameters including timeframe filters
 * @returns Array of commits or ServiceError
 */
export const searchCommits = async ({
    repoId: repoIdInput,
    query,
    since,
    until,
    author,
    maxCount = 50,
}: SearchCommitsRequest): Promise<Commit[] | ServiceError> => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        // Resolve repository identifier to numeric ID
        const repoId = await resolveRepoId(repoIdInput, org.id, prisma);
        if (isServiceError(repoId)) {
            return repoId;
        }

        const repoPath = path.join(REPOS_CACHE_DIR, repoId.toString());

    // Check if repository exists on Sourcebot server disk
    if (!existsSync(repoPath)) {
        return unexpectedError(
            `Repository ${repoId} not found on Sourcebot server disk. ` +
            `Sourcebot automatically clones repositories during indexing, but the ` +
            `cloning process may not be finished yet. Please try again later. ` +
            `Path checked: ${repoPath}`
        );
    }

    // Validate date range if both since and until are provided
    const dateRangeError = validateDateRange(since, until);
    if (dateRangeError) {
        return unexpectedError(dateRangeError);
    }

    // Parse dates to git-compatible format
    const gitSince = toGitDate(since);
    const gitUntil = toGitDate(until);

    const git = createGitClientForPath(repoPath);

    try {
        const logOptions: Record<string, string | number | null> = {
            maxCount,
        };

        if (gitSince) {
            logOptions['--since'] = gitSince;
        }

        if (gitUntil) {
            logOptions['--until'] = gitUntil;
        }

        if (author) {
            logOptions['--author'] = author;
        }

        if (query) {
            logOptions['--grep'] = query;
            logOptions['--regexp-ignore-case'] = null; // Case insensitive
        }

        const log = await git.log(logOptions);
        return log.all as unknown as Commit[];
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
                `Git operation timed out after 30 seconds for repository ${repoId}. ` +
                `The repository may be too large or the git operation is taking too long.`
            );
        }

        // Generic error fallback
        if (error instanceof Error) {
            throw new Error(
                `Failed to search commits in repository ${repoId}: ${error.message}`
            );
        } else {
            throw new Error(
                `Failed to search commits in repository ${repoId}: ${errorMessage}`
            );
        }
    }
}));
