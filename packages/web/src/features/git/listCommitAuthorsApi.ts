import { sew } from "@/middleware/sew";
import { invalidGitRef, notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuth } from '@/middleware/withAuth';
import { getRepoPath } from '@sourcebot/shared';
import { z } from 'zod';
import { simpleGit } from 'simple-git';
import { commitAuthorSchema } from './schemas';
import { isGitRefValid } from './utils';

export type CommitAuthor = z.infer<typeof commitAuthorSchema>;

export type ListCommitAuthorsResponse = {
    authors: CommitAuthor[];
    totalCount: number;
};

type ListCommitAuthorsRequest = {
    repo: string;
    ref?: string;
    path?: string;
    maxCount?: number;
    skip?: number;
};

/**
 * List unique authors who committed in a repository, optionally scoped
 * to a file path. Returns authors sorted by commit count (descending),
 * deduped by lowercased email.
 */
export const listCommitAuthors = async ({
    repo: repoName,
    ref = 'HEAD',
    path,
    maxCount = 50,
    skip = 0,
}: ListCommitAuthorsRequest): Promise<ListCommitAuthorsResponse | ServiceError> => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
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
            const args = ['shortlog', '-sne', ref];
            if (path) {
                args.push('--', path);
            }

            const output = await git.raw(args);
            const lines = output.split('\n').filter(Boolean);

            // shortlog output: "   <count>\t<name> <<email>>" — already sorted
            // by commit count descending (-n) and deduped by author.
            const lineRegex = /^\s*(\d+)\s+(.+?)\s+<(.+?)>\s*$/;
            const all: CommitAuthor[] = [];
            for (const line of lines) {
                const match = line.match(lineRegex);
                if (!match) {
                    continue;
                }
                all.push({
                    name: match[2],
                    email: match[3],
                    commitCount: parseInt(match[1], 10),
                });
            }

            const totalCount = all.length;
            const authors = all.slice(skip, skip + maxCount);

            return { authors, totalCount };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('not a git repository')) {
                return unexpectedError(
                    `Invalid git repository at ${repoPath}. `
                    + `The directory exists but is not a valid git repository.`,
                );
            }

            if (errorMessage.includes('ambiguous argument')) {
                return unexpectedError(`Invalid git reference: ${ref}`);
            }

            if (error instanceof Error) {
                throw new Error(
                    `Failed to list commit authors in repository ${repoName}: ${error.message}`,
                );
            }
            throw new Error(
                `Failed to list commit authors in repository ${repoName}: ${errorMessage}`,
            );
        }
    }));
