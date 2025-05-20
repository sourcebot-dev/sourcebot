'use server';

import { sew, withAuth, withOrgMembership } from "@/actions";
import { searchResponseSchema } from "@/features/search/schemas";
import { search } from "@/features/search/searchApi";
import { isServiceError } from "@/lib/utils";
import escapeStringRegexp from "escape-string-regexp";
import { FindSearchBasedSymbolReferencesResponse, Reference } from "./types";
import { ServiceError } from "@/lib/serviceError";

/**
 * Finds references to a symbol in a repository using a search-based approach.
 * 
 * @param symbolName The name of the symbol to find references to.
 * @param repoName The name of the repository to search in.
 * @param domain The domain of the organization to search in.
 * 
 * @returns A list of references to the symbol.
 */
export const findSearchBasedSymbolReferences = async (
    symbolName: string,
    repoName: string,
    domain: string
): Promise<FindSearchBasedSymbolReferencesResponse | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async () => {
            const searchResult = await search({
                query: `${symbolName} repo:^${escapeStringRegexp(repoName)}$`,
                matches: 1000,
                contextLines: 0,
            }, domain);

            if (isServiceError(searchResult)) {
                return searchResult;
            }

            const parser = searchResponseSchema.transform(async ({ files }) => ({
                references: files.flatMap((file) => {
                    const chunks = file.chunks;

                    return chunks.flatMap((chunk) => {
                        return chunk.matchRanges.map((range): Reference => ({
                            fileName: file.fileName.text,
                            lineContent: chunk.content,
                            repository: file.repository,
                            repositoryId: file.repositoryId,
                            webUrl: file.webUrl,
                            language: file.language,
                            matchRange: range,
                        }))
                    });
                }),
                repositoryInfo: searchResult.repositoryInfo
            } satisfies FindSearchBasedSymbolReferencesResponse));

            return parser.parseAsync(searchResult);

        }), /* allowSingleTenantUnauthedAccess = */ true)
);
