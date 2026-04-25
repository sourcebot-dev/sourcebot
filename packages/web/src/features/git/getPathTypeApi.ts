import { sew } from "@/middleware/sew";
import { invalidGitRef, notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuth } from '@/middleware/withAuth';
import { getRepoPath } from '@sourcebot/shared';
import { simpleGit } from 'simple-git';
import { isGitRefValid } from './utils';

export type GitObjectPathType = 'blob' | 'tree';

type GetPathTypeRequest = {
    repo: string;
    ref?: string;
    path: string;
};

/**
 * Resolve whether a given path inside a repo is a file (`blob`) or a
 * directory (`tree`) at the supplied ref. Empty paths always resolve to
 * `tree` (the repo root).
 *
 * Backed by `git cat-file -t <ref>:<path>`, which is a constant-time
 * object lookup — no walking, just an index read.
 */
export const getPathType = async ({
    repo: repoName,
    ref = 'HEAD',
    path,
}: GetPathTypeRequest): Promise<GitObjectPathType | ServiceError> => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        if (path === '' || path === '/') {
            return 'tree';
        }

        const repo = await prisma.repo.findFirst({
            where: {
                name: repoName,
                orgId: org.id,
            },
        });

        if (!repo) {
            return notFound(`Repository "${repoName}" not found.`);
        }

        if (!isGitRefValid(ref)) {
            return invalidGitRef(ref);
        }

        const { path: repoPath } = getRepoPath(repo);
        const git = simpleGit().cwd(repoPath);

        try {
            const output = await git.raw(['cat-file', '-t', `${ref}:${path}`]);
            const type = output.trim();
            if (type === 'blob' || type === 'tree') {
                return type;
            }
            return notFound(`Path "${path}" at ref "${ref}" is not a file or directory.`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('not a git repository')) {
                return unexpectedError(
                    `Invalid git repository at ${repoPath}. `
                    + `The directory exists but is not a valid git repository.`,
                );
            }

            // `git cat-file` returns "Not a valid object name <ref>:<path>" when
            // the path doesn't exist at that ref. Treat as not-found.
            if (errorMessage.includes('Not a valid object name')) {
                return notFound(`Path "${path}" not found at ref "${ref}".`);
            }

            if (error instanceof Error) {
                throw new Error(
                    `Failed to resolve path type for ${repoName}:${path}: ${error.message}`,
                );
            }
            throw new Error(
                `Failed to resolve path type for ${repoName}:${path}: ${errorMessage}`,
            );
        }
    }));
