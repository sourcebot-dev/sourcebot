import { sew } from '@/actions';
import { getBrowsePath } from '@/app/[domain]/browse/hooks/utils';
import { getAuditService } from '@/ee/features/audit/factory';
import { SINGLE_TENANT_ORG_DOMAIN } from '@/lib/constants';
import { detectLanguageFromFilename } from '@/lib/languageDetection';
import { ServiceError, notFound, fileNotFound, invalidGitRef, unexpectedError } from '@/lib/serviceError';
import { getCodeHostBrowseFileAtBranchUrl } from '@/lib/utils';
import { withOptionalAuthV2 } from '@/withAuthV2';
import { getRepoPath } from '@sourcebot/shared';
import { headers } from 'next/headers';
import simpleGit from 'simple-git';
import type z from 'zod';
import { isGitRefValid, isPathValid } from './utils';
import { fileSourceRequestSchema, fileSourceResponseSchema } from './schemas';

export { fileSourceRequestSchema, fileSourceResponseSchema } from './schemas';
export type FileSourceRequest = z.infer<typeof fileSourceRequestSchema>;
export type FileSourceResponse = z.infer<typeof fileSourceResponseSchema>;

export const getFileSource = async ({ path: filePath, repo: repoName, ref }: FileSourceRequest, { source }: { source?: string } = {}): Promise<FileSourceResponse | ServiceError> => sew(() => withOptionalAuthV2(async ({ org, prisma, user }) => {
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

    const gitRef = ref ??
        repo.defaultBranch ??
        'HEAD';

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

    const language = detectLanguageFromFilename(filePath);
    const webUrl = getBrowsePath({
        repoName: repo.name,
        revisionName: ref,
        path: filePath,
        pathType: 'blob',
        domain: SINGLE_TENANT_ORG_DOMAIN,
    });
    const externalWebUrl = getCodeHostBrowseFileAtBranchUrl({
        webUrl: repo.webUrl,
        codeHostType: repo.external_codeHostType,
        branchName: gitRef,
        filePath,
    });

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
}));
