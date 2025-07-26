'use server';

import escapeStringRegexp from "escape-string-regexp";
import { fileNotFound, ServiceError, unexpectedError } from "../../lib/serviceError";
import { FileSourceRequest, FileSourceResponse } from "./types";
import { isServiceError } from "../../lib/utils";
import { search } from "./searchApi";
import { sew, withAuth, withOrgMembership } from "@/actions";
import { OrgRole } from "@sourcebot/db";
// @todo (bkellam) : We should really be using `git show <hash>:<path>` to fetch file contents here.
// This will allow us to support permalinks to files at a specific revision that may not be indexed
// by zoekt.

export const getFileSource = async ({ fileName, repository, branch }: FileSourceRequest, domain: string, apiKey: string | undefined = undefined): Promise<FileSourceResponse | ServiceError> => sew(() =>
    withAuth((userId, _apiKeyHash) =>
        withOrgMembership(userId, domain, async () => {
            const escapedFileName = escapeStringRegexp(fileName);
            const escapedRepository = escapeStringRegexp(repository);

            let query = `file:${escapedFileName} repo:^${escapedRepository}$`;
            if (branch) {
                query = query.concat(` branch:${branch}`);
            }

            const searchResponse = await search({
                query,
                matches: 1,
                whole: true,
            }, domain, apiKey);

            if (isServiceError(searchResponse)) {
                return searchResponse;
            }

            const files = searchResponse.files;

            if (!files || files.length === 0) {
                return fileNotFound(fileName, repository);
            }

            const file = files[0];
            const source = file.content ?? '';
            const language = file.language;

            const repoInfo = searchResponse.repositoryInfo.find((repo) => repo.id === file.repositoryId);
            if (!repoInfo) {
                // This should never happen.
                return unexpectedError("Repository info not found");
            }
            
            return {
                source,
                language,
                path: fileName,
                repository,
                repositoryCodeHostType: repoInfo.codeHostType,
                repositoryDisplayName: repoInfo.displayName,
                repositoryWebUrl: repoInfo.webUrl,
                branch,
                webUrl: file.webUrl,
            } satisfies FileSourceResponse;

        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowAnonymousAccess = */ true, apiKey ? { apiKey, domain } : undefined)
);
