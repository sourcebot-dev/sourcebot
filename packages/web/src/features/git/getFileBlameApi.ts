import { sew } from "@/middleware/sew";
import { ServiceError, notFound, fileNotFound, invalidGitRef, unresolvedGitRef, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuth } from '@/middleware/withAuth';
import { getRepoPath } from '@sourcebot/shared';
import { headers } from 'next/headers';
import simpleGit from 'simple-git';
import type z from 'zod';
import { isGitRefValid, isPathValid } from './utils';
import { fileBlameRequestSchema, fileBlameResponseSchema } from './schemas';
import { createAudit } from "@/ee/features/audit/audit";

export { fileBlameRequestSchema, fileBlameResponseSchema } from './schemas';
export type FileBlameRequest = z.infer<typeof fileBlameRequestSchema>;
export type FileBlameResponse = z.infer<typeof fileBlameResponseSchema>;

type CommitMeta = FileBlameResponse['commits'][string];

/**
 * Parses `git blame --porcelain` output into ranges and deduplicated commit metadata.
 *
 * Format reference: each blamed line produces an entry of the form
 *
 *   <hash> <orig-line> <final-line> [<num-lines>]  (4-field header → first line of a group)
 *   [author <name>                                 (metadata block, emitted only on
 *    author-mail <<email>>                          the first global appearance of a
 *    author-time <unix-ts>                          commit; subsequent groups for the
 *    author-tz <+/-HHMM>                            same commit are header-only. With
 *    committer ...                                  -C/-M, `filename` may be re-emitted
 *    summary <subject>                              if it differs from the prior value.)
 *    previous <hash> <path>                         (optional)
 *    filename <path>]
 *   \t<line content>
 *
 * Within a contiguous group of lines from the same commit, only the first line's
 * header carries `<num-lines>`; subsequent lines have a 3-field header. We detect
 * group boundaries via the presence of `<num-lines>` and emit one range per group.
 *
 * Because `filename` is emitted per-commit (not per-group), we cache it in
 * `filenameByHash` and look it up when pushing a range.
 */
const parsePorcelainBlame = (output: string): FileBlameResponse => {
    const ranges: FileBlameResponse['ranges'] = [];
    const commits: Record<string, CommitMeta> = {};
    const filenameByHash = new Map<string, string>();

    if (output.length === 0) {
        return { ranges, commits };
    }

    const rawLines = output.split('\n');
    let i = 0;

    while (i < rawLines.length) {
        const headerLine = rawLines[i];
        if (headerLine.length === 0) {
            i++;
            continue;
        }

        const headerParts = headerLine.split(' ');
        const hash = headerParts[0];
        const finalLine = parseInt(headerParts[2], 10);
        if (!hash || Number.isNaN(finalLine)) {
            throw new Error(`Malformed git blame porcelain header: "${headerLine}"`);
        }

        // Group-start headers carry a 4th field with the group size; intra-group
        // continuation headers have only 3 fields and don't start a new range.
        const isGroupStart = headerParts.length >= 4;
        const lineCount = isGroupStart ? parseInt(headerParts[3], 10) : NaN;
        if (isGroupStart && Number.isNaN(lineCount)) {
            throw new Error(`Malformed git blame porcelain header (bad num-lines): "${headerLine}"`);
        }

        i++;

        // Metadata lines may appear after any header but only the first time we
        // see a given commit. Accumulate whatever's there until the "\t<content>"
        // sentinel; for continuation lines this loop usually exits immediately.
        let authorName: string | undefined;
        let authorMail: string | undefined;
        let date: string | undefined;
        let message: string | undefined;
        let previous: CommitMeta['previous'] | undefined;

        while (i < rawLines.length && !rawLines[i].startsWith('\t')) {
            const fieldLine = rawLines[i];
            const spaceIdx = fieldLine.indexOf(' ');
            const key = spaceIdx === -1 ? fieldLine : fieldLine.substring(0, spaceIdx);
            const value = spaceIdx === -1 ? '' : fieldLine.substring(spaceIdx + 1);

            if (key === 'author') {
                authorName = value;
            } else if (key === 'author-mail') {
                authorMail = value.replace(/^<|>$/g, '');
            } else if (key === 'author-time') {
                date = new Date(parseInt(value, 10) * 1000).toISOString();
            } else if (key === 'summary') {
                message = value;
            } else if (key === 'previous') {
                // "previous <hash> <path>" — path may contain spaces, so split once.
                const sep = value.indexOf(' ');
                if (sep !== -1) {
                    previous = {
                        hash: value.substring(0, sep),
                        path: value.substring(sep + 1),
                    };
                }
            } else if (key === 'filename') {
                filenameByHash.set(hash, value);
            }
            // committer*, boundary are intentionally ignored.

            i++;
        }

        // Skip the "\t<content>" sentinel; the file source is fetched separately.
        if (i < rawLines.length && rawLines[i].startsWith('\t')) {
            i++;
        }

        if (!commits[hash] && authorName !== undefined && authorMail !== undefined && date !== undefined && message !== undefined) {
            commits[hash] = {
                hash,
                date,
                message,
                authorName,
                authorEmail: authorMail,
                ...(previous ? { previous } : {}),
            };
        }

        if (isGroupStart) {
            const path = filenameByHash.get(hash);
            if (path === undefined) {
                throw new Error(`Malformed git blame porcelain output: missing "filename" for commit ${hash}`);
            }
            ranges.push({ hash, path, startLine: finalLine, lineCount });
        }
    }

    // Coalesce adjacent same-commit ranges. Porcelain emits a fresh group
    // whenever the source-line numbering is discontinuous in the commit's
    // snapshot, even when the final-file lines are contiguous and attributed
    // to the same commit.
    const coalescedRanges: FileBlameResponse['ranges'] = [];
    for (const range of ranges) {
        const last = coalescedRanges[coalescedRanges.length - 1];
        if (last && last.hash === range.hash && last.path === range.path && last.startLine + last.lineCount === range.startLine) {
            last.lineCount += range.lineCount;
        } else {
            coalescedRanges.push({ ...range });
        }
    }

    return { ranges: coalescedRanges, commits };
};

export const getFileBlame = async ({ path: filePath, repo: repoName, ref }: FileBlameRequest, { source }: { source?: string } = {}): Promise<FileBlameResponse | ServiceError> =>
    sew(() =>
        withOptionalAuth(async ({ org, prisma, user }) => {
            if (user) {
                const resolvedSource = source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
                await createAudit({
                    action: 'user.fetched_file_blame',
                    actor: { id: user.id, type: 'user' },
                    target: { id: org.id.toString(), type: 'org' },
                    orgId: org.id,
                    metadata: { source: resolvedSource },
                });
            }

            const repo = await prisma.repo.findFirst({
                where: { name: repoName, orgId: org.id },
            });
            if (!repo) {
                return notFound(`Repository "${repoName}" not found.`);
            }

            if (!isPathValid(filePath)) {
                return fileNotFound(filePath, repoName);
            }

            if (ref !== undefined && !isGitRefValid(ref)) {
                return invalidGitRef(ref);
            }

            const { path: repoPath } = getRepoPath(repo);
            const git = simpleGit().cwd(repoPath);

            const gitRef = ref ?? repo.defaultBranch ?? 'HEAD';

            let porcelain: string;
            try {
                porcelain = await git.raw(['blame', '--porcelain', gitRef, '--', filePath]);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('no such path') || errorMessage.includes('does not exist') || errorMessage.includes('fatal: path') || errorMessage.includes('no such file')) {
                    return fileNotFound(filePath, repoName);
                }
                if (errorMessage.includes('unknown revision') || errorMessage.includes('bad revision') || errorMessage.includes('invalid object name')) {
                    return unresolvedGitRef(gitRef);
                }
                return unexpectedError(errorMessage);
            }

            try {
                return parsePorcelainBlame(porcelain) satisfies FileBlameResponse;
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return unexpectedError(`Failed to parse git blame output: ${errorMessage}`);
            }
        })
    );
