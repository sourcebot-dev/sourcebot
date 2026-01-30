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

/**
 * Determines which refs to try when searching for a file.
 * If ref is not provided, searches across all branches.
 * If ref is HEAD or already in full format (refs/...), uses it directly.
 * Otherwise, tries both branch and tag patterns.
 */
const getRefsToTry = (ref: string | undefined): (string | undefined)[] => {
    if (!ref) {
        return [undefined];
    }
    if (ref === 'HEAD' || ref.startsWith('refs/')) {
        return [ref];
    }
    return [`refs/heads/${ref}`, `refs/tags/${ref}`];
};

export const getFileSource = async ({ path, repo, ref }: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async () => {
        // Try to find the file with the given ref
        // If ref is provided and not in full format, try both branch (refs/heads/) and tag (refs/tags/) patterns
        const refsToTry = getRefsToTry(ref);

        const searchPromises = refsToTry.map(normalizedRef => {
            const query: QueryIR = {
                and: {
                    children: [
                        {
                            repo: {
                                regexp: `^${escapeStringRegexp(repo)}$`,
                            },
                        },
                        {
                            substring: {
                                pattern: path,
                                case_sensitive: true,
                                file_name: true,
                                content: false,
                            }
                        },
                        ...(normalizedRef ? [{
                            branch: {
                                pattern: normalizedRef,
                                exact: true,
                            },
                        }]: [])
                    ]
                }
            }

            return search({
                queryType: 'ir',
                query,
                options: {
                    matches: 1,
                    whole: true,
                }
            });
        });

        const responses = await Promise.all(searchPromises);

        let searchResponse = responses.find(
            response => !isServiceError(response) && response.files && response.files.length > 0
        );

        // If no successful response, use the first one
        if (!searchResponse) {
            searchResponse = responses[0];
        }

        if (!searchResponse) {
            return fileNotFound(path, repo);
        }

        if (isServiceError(searchResponse)) {
            return searchResponse;
        }

        const files = searchResponse.files;

        if (!files || files.length === 0) {
            return fileNotFound(path, repo);
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
            path,
            repo,
            repoCodeHostType: repoInfo.codeHostType,
            repoDisplayName: repoInfo.displayName,
            repoExternalWebUrl: repoInfo.webUrl,
            branch: ref,
            webUrl: file.webUrl,
            externalWebUrl: file.externalWebUrl,
        } satisfies FileSourceResponse;

    }));
