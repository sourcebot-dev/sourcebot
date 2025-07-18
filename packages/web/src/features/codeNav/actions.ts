'use server';

import { sew, withAuth, withOrgMembership } from "@/actions";
import { searchResponseSchema } from "@/features/search/schemas";
import { search } from "@/features/search/searchApi";
import { isServiceError } from "@/lib/utils";
import { FindRelatedSymbolsResponse } from "./types";
import { ServiceError } from "@/lib/serviceError";
import { SearchResponse } from "../search/types";
import { OrgRole } from "@sourcebot/db";

// The maximum number of matches to return from the search API.
const MAX_REFERENCE_COUNT = 1000;

export const findSearchBasedSymbolReferences = async (
    props: {
        symbolName: string,
        language: string,
        revisionName?: string,
    },
    domain: string,
): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async () => {
            const {
                symbolName,
                language,
                revisionName = "HEAD",
            } = props;

            const query = `\\b${symbolName}\\b rev:${revisionName} ${getExpandedLanguageFilter(language)} case:yes`;

            const searchResult = await search({
                query,
                matches: MAX_REFERENCE_COUNT,
                contextLines: 0,
            }, domain);

            if (isServiceError(searchResult)) {
                return searchResult;
            }

            return parseRelatedSymbolsSearchResponse(searchResult);
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowAnonymousAccess = */ true)
);


export const findSearchBasedSymbolDefinitions = async (
    props: {
        symbolName: string,
        language: string,
        revisionName?: string,
    },
    domain: string,
): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async () => {
            const {
                symbolName,
                language,
                revisionName = "HEAD",
            } = props;

            const query = `sym:\\b${symbolName}\\b rev:${revisionName} ${getExpandedLanguageFilter(language)}`;

            const searchResult = await search({
                query,
                matches: MAX_REFERENCE_COUNT,
                contextLines: 0,
            }, domain);

            if (isServiceError(searchResult)) {
                return searchResult;
            }

            return parseRelatedSymbolsSearchResponse(searchResult);
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowAnonymousAccess = */ true)
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

// Expands the language filter to include all variants of the language.
const getExpandedLanguageFilter = (language: string) => {
    switch (language) {
        case "TypeScript":
        case "JavaScript":
        case "JSX":
        case "TSX":
            return `(lang:TypeScript or lang:JavaScript or lang:JSX or lang:TSX)`
        default:
            return `lang:${language}`
    }
}