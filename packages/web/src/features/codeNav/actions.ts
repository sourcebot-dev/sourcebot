'use server';

import { sew, withAuth, withOrgMembership } from "@/actions";
import { searchResponseSchema } from "@/features/search/schemas";
import { search } from "@/features/search/searchApi";
import { isServiceError } from "@/lib/utils";
import escapeStringRegexp from "escape-string-regexp";
import { FindRelatedSymbolsResponse } from "./types";
import { ServiceError } from "@/lib/serviceError";
import { SearchResponse } from "../search/types";

// The maximum number of matches to return from the search API.
const MAX_REFERENCE_COUNT = 1000;

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
): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async () => {
            const searchResult = await search({
                query: `${symbolName} repo:^${escapeStringRegexp(repoName)}$`,
                matches: MAX_REFERENCE_COUNT,
                contextLines: 0,
            }, domain);

            if (isServiceError(searchResult)) {
                return searchResult;
            }

            return parseRelatedSymbolsSearchResponse(searchResult);
        }), /* allowSingleTenantUnauthedAccess = */ true)
);


export const findSearchBasedSymbolDefinitions = async (
    symbolName: string,
    repoName: string,
    domain: string
): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async () => {
            const searchResult = await search({
                query: `sym:\\b${symbolName}\\b repo:^${escapeStringRegexp(repoName)}$`,
                matches: MAX_REFERENCE_COUNT,
                contextLines: 0,
            }, domain);

            if (isServiceError(searchResult)) {
                return searchResult;
            }

            return parseRelatedSymbolsSearchResponse(searchResult);
        }), /* allowSingleTenantUnauthedAccess = */ true)
);

const parseRelatedSymbolsSearchResponse = (searchResult: SearchResponse) => {
    const parser = searchResponseSchema.transform(async ({ files }) => ({
        stats: {
            matchCount: searchResult.stats.matchCount,
        },
        files: files.flatMap((file) => {
            const chunks = file.chunks;

            return {
                fileName: file.fileName.text,
                repository: file.repository,
                repositoryId: file.repositoryId,
                webUrl: file.webUrl,
                language: file.language,
                matches: chunks.flatMap((chunk) => {
                    return chunk.matchRanges.map((range) => ({
                        lineContent: chunk.content,
                        range: range,
                    }))
                })
            }
        }).filter((file) => file.matches.length > 0),
        repositoryInfo: searchResult.repositoryInfo
    }));

    return parser.parseAsync(searchResult);
}