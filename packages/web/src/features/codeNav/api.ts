import 'server-only';

import { sew } from "@/actions";
import { search } from "@/features/search/searchApi";
import { ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { SearchResponse } from "../search/types";
import { FindRelatedSymbolsRequest, FindRelatedSymbolsResponse } from "./types";

// The maximum number of matches to return from the search API.
const MAX_REFERENCE_COUNT = 1000;

export const findSearchBasedSymbolReferences = async (props: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async () => {
        const {
            symbolName,
            language,
            revisionName = "HEAD",
        } = props;

        const query = `\\b${symbolName}\\b rev:${revisionName} ${getExpandedLanguageFilter(language)}`;

        const searchResult = await search({
            query,
            matches: MAX_REFERENCE_COUNT,
            contextLines: 0,
            isCaseSensitivityEnabled: true,
            isRegexEnabled: true,
        });

        if (isServiceError(searchResult)) {
            return searchResult;
        }

        return parseRelatedSymbolsSearchResponse(searchResult);
    }));


export const findSearchBasedSymbolDefinitions = async (props: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async () => {
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
                isCaseSensitivityEnabled: true,
                isRegexEnabled: true,
            });

            if (isServiceError(searchResult)) {
                return searchResult;
            }

            return parseRelatedSymbolsSearchResponse(searchResult);
    }));

const parseRelatedSymbolsSearchResponse = (searchResult: SearchResponse): FindRelatedSymbolsResponse => {
    return {
        stats: {
            matchCount: searchResult.stats.actualMatchCount,
        },
        files: searchResult.files.flatMap((file) => {
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
    };
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