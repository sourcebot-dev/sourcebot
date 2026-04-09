import { sew } from "@/middleware/sew";
import { getBrowsePath } from '@/app/(app)/browse/hooks/utils';
import { getAuditService } from '@/ee/features/audit/factory';
import { parseGitAttributes, resolveLanguageFromGitAttributes } from '@/lib/gitattributes';
import { detectLanguageFromFilename } from '@/lib/languageDetection';
import { ServiceError, notFound, fileNotFound, invalidGitRef, unexpectedError } from '@/lib/serviceError';
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
): Promise<FileSourceResponse | ServiceError> => {
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
            return unexpectedError(`Invalid git reference: ${gitRef}`);
        }
        throw error;
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
    } satisfies FileSourceResponse;
};

export const getFileSource = async ({ path: filePath, repo: repoName, ref }: FileSourceRequest, { source }: { source?: string } = {}): Promise<FileSourceResponse | ServiceError> => sew(() => withOptionalAuth(async ({ org, prisma, user }) => {
    if (user) {
        const resolvedSource = source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
        getAuditService().createAudit({
            action: 'user.fetched_file_source',
            actor: { id: user.id, type: 'user' },
            target: { id: org.id.toString(), type: 'org' },
            orgId: org.id,
            metadata: { source: resolvedSource },
        });
    }

    return getFileSourceForRepo({ path: filePath, repo: repoName, ref }, { org, prisma });
}));
