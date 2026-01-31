import 'server-only';
import { fileNotFound, notFound, ServiceError, unexpectedError } from "../../lib/serviceError";
import { FileSourceRequest, FileSourceResponse } from "./types";
import { sew } from "@/actions";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { getRepoPath } from '@sourcebot/shared';
import { simpleGit } from 'simple-git';
import { detectLanguageFromFilename } from "@/lib/languageDetection";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { getCodeHostBrowseFileAtBranchUrl } from "@/lib/utils";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

export const getFileSource = async ({ path: filePath, repo: repoName, ref }: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const repo = await prisma.repo.findFirst({
            where: { name: repoName, orgId: org.id },
        });
        if (!repo) {
            return notFound(`Repository "${repoName}" not found.`);
        }

        const { path: repoPath } = getRepoPath(repo);
        const git = simpleGit().cwd(repoPath);

        const gitRef = ref ?? 'HEAD';

        let source: string;
        try {
            source = await git.raw(['show', `${gitRef}:${filePath}`]);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('does not exist') || errorMessage.includes('fatal: path')) {
                return fileNotFound(filePath, repoName);
            }
            if (errorMessage.includes('unknown revision') || errorMessage.includes('bad revision')) {
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
            source,
            language,
            path: filePath,
            repo: repoName,
            repoCodeHostType: repo.external_codeHostType,
            repoDisplayName: repo.displayName ?? undefined,
            repoExternalWebUrl: repo.webUrl ?? undefined,
            branch: ref,
            webUrl,
            externalWebUrl,
        } satisfies FileSourceResponse;
    }));
