import 'server-only';
import { fileNotFound, ServiceError, unexpectedError } from "../../lib/serviceError";
import { FileSourceRequest, FileSourceResponse } from "./types";
import { isServiceError } from "../../lib/utils";
import { search } from "./searchApi";
import { sew } from "@/actions";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { QueryIR } from './ir';
import escapeStringRegexp from "escape-string-regexp";

// @todo (bkellam) #574 : We should really be using `git show <hash>:<path>` to fetch file contents here.
// This will allow us to support permalinks to files at a specific revision that may not be indexed
// by zoekt. We should also refactor this out of the /search folder.

export const getFileSource = async ({ fileName, repository, branch }: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async () => {
        const query: QueryIR = {
            and: {
                children: [
                    {
                        repo: {
                            regexp: `^${escapeStringRegexp(repository)}$`,
                        },
                    },
                    {
                        substring: {
                            pattern: fileName,
                            case_sensitive: true,
                            file_name: true,
                            content: false,
                        }
                    },
                    ...(branch ? [{
                        branch: {
                            pattern: branch,
                            exact: true,
                        },
                    }]: [])
                ]
            }
        }

        const searchResponse = await search({
            queryType: 'ir',
            query,
            options: {
                matches: 1,
                whole: true,
            }
        });

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
            repo: repository,
            repoCodeHostType: repoInfo.codeHostType,
            repoDisplayName: repoInfo.displayName,
            repoExternalWebUrl: repoInfo.webUrl,
            branch,
            webUrl: file.webUrl,
            externalWebUrl: file.externalWebUrl,
        } satisfies FileSourceResponse;

    }));
