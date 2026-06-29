import { sew } from "@/middleware/sew";
import { fileNotFound, invalidGitRef, notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuth } from '@/middleware/withAuth';
import { getRepoPath } from '@sourcebot/shared';
import simpleGit from 'simple-git';
import type z from 'zod';
import { isGitRefValid, isPathValid } from './utils';
import { fileFreshnessRequestSchema, fileFreshnessResponseSchema } from './schemas';

export { fileFreshnessRequestSchema, fileFreshnessResponseSchema } from './schemas';
export type FileFreshnessRequest = z.infer<typeof fileFreshnessRequestSchema>;
export type FileFreshnessResponse = z.infer<typeof fileFreshnessResponseSchema>;

// Resolves the blob OID of `path` at a ref, or undefined if it can't be
// resolved (ref or path absent at that ref).
const resolveBlobOid = async (
    git: ReturnType<typeof simpleGit>,
    ref: string,
    path: string,
): Promise<string | undefined> => {
    try {
        return (await git.raw(['rev-parse', `${ref}:${path}`])).trim();
    } catch {
        return undefined;
    }
};

/**
 * Compares a citation's pinned commit against the repo's current default-branch
 * tip to determine whether the cited file has changed since the answer was
 * generated. File-level (blob identity), not line-level. Best-effort: a pinned
 * commit that no longer exists (e.g. force-push + GC) yields `pinned_unavailable`.
 */
export const getFileFreshness = async (
    { repo: repoName, path: filePath, sinceSha }: FileFreshnessRequest,
): Promise<FileFreshnessResponse | ServiceError> => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        const repo = await prisma.repo.findFirst({
            where: { name: repoName, orgId: org.id },
        });
        if (!repo) {
            return notFound(`Repository "${repoName}" not found.`);
        }

        if (!isPathValid(filePath)) {
            return fileNotFound(filePath, repoName);
        }

        if (!isGitRefValid(sinceSha)) {
            return invalidGitRef(sinceSha);
        }

        const { path: repoPath } = getRepoPath(repo);
        const git = simpleGit().cwd(repoPath);
        const currentRef = repo.defaultBranch ?? 'HEAD';

        let currentSha: string;
        try {
            currentSha = (await git.raw(['rev-parse', `${currentRef}^{commit}`])).trim();
        } catch (error) {
            return unexpectedError(error instanceof Error ? error.message : String(error));
        }

        // Nothing has advanced since the pin: definitively fresh, no blob work.
        if (sinceSha === currentSha) {
            return { status: 'fresh', currentSha };
        }

        const pinnedBlob = await resolveBlobOid(git, sinceSha, filePath);
        if (pinnedBlob === undefined) {
            // The pinned commit (or the path within it) is gone.
            return { status: 'pinned_unavailable', currentSha };
        }

        const currentBlob = await resolveBlobOid(git, currentSha, filePath);
        if (currentBlob === undefined) {
            return { status: 'removed', currentSha };
        }

        return {
            status: pinnedBlob === currentBlob ? 'fresh' : 'changed',
            currentSha,
        };
    }),
);
