import { sew } from "@/middleware/sew";
import { invalidGitRef, notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuth } from '@/middleware/withAuth';
import { getRepoPath } from '@sourcebot/shared';
import { z } from 'zod';
import { simpleGit } from 'simple-git';
import { commitDetailSchema } from './schemas';
import { isGitRefValid } from './utils';

export type CommitDetail = z.infer<typeof commitDetailSchema>;

type GetCommitRequest = {
    repo: string;
    ref: string;
}

// Field separator that won't appear in commit data
const FIELD_SEP = '\x1f';
const FORMAT = [
    '%H',   // hash
    '%aI',  // author date ISO 8601
    '%s',   // subject
    '%D',   // refs
    '%b',   // body
    '%aN',  // author name
    '%aE',  // author email
    '%P',   // parent hashes (space-separated)
].join(FIELD_SEP);

export const getCommit = async ({
    repo: repoName,
    ref,
}: GetCommitRequest): Promise<CommitDetail | ServiceError> => sew(() =>
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
            const output = (await git.raw([
                'log',
                '-1',
                `--format=${FORMAT}`,
                ref,
            ])).trim();

            const fields = output.split(FIELD_SEP);
            if (fields.length < 8) {
                return unexpectedError(`Failed to parse commit data for revision "${ref}".`);
            }

            const hash = fields[0];
            const date = fields[1];
            const message = fields[2];
            const refs = fields[3];
            const body = fields.slice(4, fields.length - 3).join(FIELD_SEP);
            const authorName = fields[fields.length - 3];
            const authorEmail = fields[fields.length - 2];
            const parentStr = fields[fields.length - 1];
            const parents = parentStr.trim() === '' ? [] : parentStr.trim().split(' ');

            return {
                hash,
                date,
                message,
                refs,
                body,
                authorName,
                authorEmail,
                parents,
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('not a git repository')) {
                return unexpectedError(
                    `Invalid git repository at ${repoPath}. ` +
                    `The directory exists but is not a valid git repository.`
                );
            }

            if (errorMessage.includes('unknown revision') || errorMessage.includes('bad object')) {
                return notFound(`Revision "${ref}" not found in repository "${repoName}".`);
            }

            if (error instanceof Error) {
                throw new Error(
                    `Failed to get commit in repository ${repoName}: ${error.message}`
                );
            } else {
                throw new Error(
                    `Failed to get commit in repository ${repoName}: ${errorMessage}`
                );
            }
        }
    }));
