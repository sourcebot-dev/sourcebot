import { sew } from "@/middleware/sew";
import { getBrowsePath } from '@/app/(app)/browse/hooks/utils';
import { createAudit } from '@/ee/features/audit/audit';
import { parseGitAttributes, resolveLanguageFromGitAttributes } from '@/lib/gitattributes';
import { detectLanguageFromFilename } from '@/lib/languageDetection';
import { ServiceError, notFound, fileNotFound, invalidGitRef, unresolvedGitRef, unexpectedError } from '@/lib/serviceError';
import { getCodeHostBrowseFileAtBranchUrl } from '@/lib/utils';
import { withOptionalAuth } from '@/middleware/withAuth';
import { env, getRepoPath } from '@sourcebot/shared';
import { Org, PrismaClient } from '@sourcebot/db';
import { headers } from 'next/headers';
import simpleGit from 'simple-git';
import type z from 'zod';
import { isGitRefValid, isPathValid } from './utils';
import { fileSourceRequestSchema, fileSourceResponseSchema } from './schemas';

export { fileSourceRequestSchema, fileSourceResponseSchema } from './schemas';
export type FileSourceRequest = z.infer<typeof fileSourceRequestSchema>;
export type FileSourceResponse = z.infer<typeof fileSourceResponseSchema>;

/**
 * Fetches file source without an auth layer. Intended for privileged server-side
 * callers (e.g. the review agent webhook handler) that have already been
 * authenticated via their own mechanism and need direct repo access.
 */
export const getFileSourceForRepo = async (
    { path: filePath, repo: repoName, ref }: FileSourceRequest,
    { org, prisma }: { org: Org; prisma: PrismaClient },
): Promise<FileSourceResponse | ServiceError> => sew(async () => {
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

    let fileContent: string;
    try {
        fileContent = await git.raw(['show', `${gitRef}:${filePath}`]);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('does not exist') || errorMessage.includes('fatal: path')) {
            return fileNotFound(filePath, repoName);
        }
        if (errorMessage.includes('unknown revision') || errorMessage.includes('bad revision') || errorMessage.includes('invalid object name')) {
            return unresolvedGitRef(gitRef);
        }
        return unexpectedError(errorMessage);
    }

    // The git blob OID is a content hash of the file at this ref. We resolve it
    // best-effort so callers that track imported files (agent skills) can detect
    // when the indexed file changes. A failure here must not fail the read.
    let blobSha: string | undefined;
    try {
        blobSha = (await git.raw(['rev-parse', `${gitRef}:${filePath}`])).trim();
    } catch {
        blobSha = undefined;
    }

    let gitattributesContent: string | undefined;
    try {
        gitattributesContent = await git.raw(['show', `${gitRef}:.gitattributes`]);
    } catch {
        // No .gitattributes in this repo/ref, that's fine
    }

    const language = gitattributesContent
        ? (resolveLanguageFromGitAttributes(filePath, parseGitAttributes(gitattributesContent)) ?? detectLanguageFromFilename(filePath))
        : detectLanguageFromFilename(filePath);

    const externalWebUrl = getCodeHostBrowseFileAtBranchUrl({
        webUrl: repo.webUrl,
        codeHostType: repo.external_codeHostType,
        branchName: gitRef,
        filePath,
    });

    const baseUrl = env.AUTH_URL;
    const webUrl = `${baseUrl}${getBrowsePath({
        repoName: repo.name,
        revisionName: ref,
        path: filePath,
        pathType: 'blob',
    })}`;

    return {
        source: fileContent,
        language,
        path: filePath,
        repo: repoName,
        repoCodeHostType: repo.external_codeHostType,
        repoDisplayName: repo.displayName ?? undefined,
        repoExternalWebUrl: repo.webUrl ?? undefined,
        webUrl,
        externalWebUrl,
        blobSha,
    } satisfies FileSourceResponse;
});

/**
 * Resolves the git blob OID for a file at a ref without reading its contents.
 * Used to cheaply detect whether an imported file has changed since import.
 * Distinguishes "repo not found" from "file not found" from "bad ref" so callers
 * can surface the right sync state. Privileged: intended for callers that have
 * already established org context (e.g. via withAuth).
 */
export const resolveFileBlobShaForRepo = async (
    { path: filePath, repo: repoName, ref }: FileSourceRequest,
    { org, prisma }: { org: Org; prisma: PrismaClient },
): Promise<string | ServiceError> => sew(async () => {
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

    try {
        return (await git.raw(['rev-parse', `${gitRef}:${filePath}`])).trim();
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('does not exist') || errorMessage.includes('fatal: path')) {
            return fileNotFound(filePath, repoName);
        }
        if (errorMessage.includes('unknown revision') || errorMessage.includes('bad revision') || errorMessage.includes('invalid object name')) {
            return unresolvedGitRef(gitRef);
        }
        return unexpectedError(errorMessage);
    }
});

const gitBlobShaSchema = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/**
 * Reads a blob's raw content by its git object id from an indexed repo's local
 * clone. Used to recover the originally-imported version of a synced agent
 * skill file so local edits can be detected without storing extra state.
 * Privileged: intended for callers that have already established org context
 * (e.g. via withAuth); repo visibility is enforced by the caller's prisma.
 */
export const getBlobContentForRepo = async (
    { repo: repoName, blobSha }: { repo: string; blobSha: string },
    { org, prisma }: { org: Org; prisma: PrismaClient },
): Promise<string | ServiceError> => sew(async () => {
    const repo = await prisma.repo.findFirst({
        where: { name: repoName, orgId: org.id },
    });
    if (!repo) {
        return notFound(`Repository "${repoName}" not found.`);
    }

    if (!gitBlobShaSchema.test(blobSha)) {
        return invalidGitRef(blobSha);
    }

    const { path: repoPath } = getRepoPath(repo);
    const git = simpleGit().cwd(repoPath);

    try {
        return await git.raw(['cat-file', 'blob', blobSha]);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // The object may have been pruned (e.g. after an upstream force-push and
        // gc), so treat any lookup failure as "blob not found".
        if (errorMessage.includes('does not exist') || errorMessage.includes('bad file') || errorMessage.includes('Not a valid object name') || errorMessage.includes('invalid object name')) {
            return notFound(`Blob "${blobSha}" not found in repository "${repoName}".`);
        }
        return unexpectedError(errorMessage);
    }
});

export const getFileSource = async ({ path: filePath, repo: repoName, ref }: FileSourceRequest, { source }: { source?: string } = {}): Promise<FileSourceResponse | ServiceError> => sew(() => withOptionalAuth(async ({ org, prisma, user }) => {
    if (user) {
        const resolvedSource = source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
        await createAudit({
            action: 'user.fetched_file_source',
            actor: { id: user.id, type: 'user' },
            target: { id: org.id.toString(), type: 'org' },
            orgId: org.id,
            metadata: { source: resolvedSource },
        });
    }

    return getFileSourceForRepo({ path: filePath, repo: repoName, ref }, { org, prisma });
}));
