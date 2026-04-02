import { sew } from "@/middleware/sew";
import { invalidGitRef, notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuth } from '@/middleware/withAuth';
import { getRepoPath } from '@sourcebot/shared';
import parseDiff from 'parse-diff';
import { simpleGit } from 'simple-git';
import { isGitRefValid } from './utils';

export interface HunkRange {
    start: number;
    lines: number;
}

export interface DiffHunk {
    oldRange: HunkRange;
    newRange: HunkRange;
    heading?: string;
    body: string;
}

export interface FileDiff {
    oldPath: string;
    newPath: string;
    hunks: DiffHunk[];
}

export interface GetDiffResult {
    files: FileDiff[];
}

type GetDiffRequest = {
    repo: string;
    base: string;
    head: string;
}

export const getDiff = async ({
    repo: repoName,
    base,
    head,
}: GetDiffRequest): Promise<GetDiffResult | ServiceError> => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        if (!isGitRefValid(base)) {
            return invalidGitRef(base);
        }

        if (!isGitRefValid(head)) {
            return invalidGitRef(head);
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

        const { path: repoPath } = getRepoPath(repo);
        const git = simpleGit().cwd(repoPath);

        try {
            const rawDiff = await git.raw(['diff', base, head]);
            const files = parseDiff(rawDiff);

            const nodes: FileDiff[] = files.map((file) => ({
                oldPath: file.from ?? '/dev/null',
                newPath: file.to ?? '/dev/null',
                hunks: file.chunks.map((chunk) => {
                    // chunk.content is the full @@ header line, e.g.:
                    // "@@ -7,6 +7,8 @@ some heading text"
                    // The heading is the optional text after the second @@.
                    const headingMatch = chunk.content.match(/^@@ .+ @@ (.+)$/);
                    const heading = headingMatch ? headingMatch[1].trim() : undefined;

                    return {
                        oldRange: { start: chunk.oldStart, lines: chunk.oldLines },
                        newRange: { start: chunk.newStart, lines: chunk.newLines },
                        heading,
                        body: chunk.changes.map((change) => change.content).join('\n'),
                    };
                }),
            }));

            return {
                files: nodes,
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);

            if (message.includes('unknown revision') || message.includes('bad revision')) {
                return invalidGitRef(`${base}..${head}`);
            }

            return unexpectedError(`Failed to compute diff for ${repoName}: ${message}`);
        }
    }));
