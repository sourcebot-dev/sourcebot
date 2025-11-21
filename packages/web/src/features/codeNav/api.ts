import 'server-only';

import { sew } from "@/actions";
import { search } from "@/features/search";
import { ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { SearchResponse } from "../search/types";
import { FindRelatedSymbolsRequest, FindRelatedSymbolsResponse } from "./types";
import { QueryIR } from '../search/ir';

// The maximum number of matches to return from the search API.
const MAX_REFERENCE_COUNT = 1000;

export const findSearchBasedSymbolReferences = async (props: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async () => {
        const {
            symbolName,
            language,
            revisionName = "HEAD",
        } = props;

        const languageFilter = getExpandedLanguageFilter(language);

        const query: QueryIR = {
            and: {
                children: [
                    {
                        regexp: {
                            regexp: `\\b${symbolName}\\b`,
                            case_sensitive: true,
                            file_name: false,
                            content: true,
                        }
                    },
                    {
                        branch: {
                            pattern: revisionName,
                            exact: true,
                        }
                    },
                    languageFilter,
                ]
            }
        }

        const searchResult = await search({
            queryType: 'ir',
            query,
            options: {
                matches: MAX_REFERENCE_COUNT,
                contextLines: 0,
            }
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

        const languageFilter = getExpandedLanguageFilter(language);

        const query: QueryIR = {
            and: {
                children: [
                    {
                        symbol: {
                            expr: {
                                regexp: {
                                    regexp: `\\b${symbolName}\\b`,
                                    case_sensitive: true,
                                    file_name: false,
                                    content: true,
                                }
                            },
                        }
                    },
                    {
                        branch: {
                            pattern: revisionName,
                            exact: true,
                        }
                    },
                    languageFilter,
                ]
            }
        }

        const searchResult = await search({
            queryType: 'ir',
            query,
            options: {
                matches: MAX_REFERENCE_COUNT,
                contextLines: 0,
            }
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
const getExpandedLanguageFilter = (language: string): QueryIR => {
    switch (language) {
        case "TypeScript":
        case "JavaScript":
        case "JSX":
        case "TSX":
            return {
                or: {
                    children: [
                        {
                            language: {
                                language: "TypeScript",
                            }
                        },
                        {
                            language: {
                                language: "JavaScript",
                            }
                        },
                        {
                            language: {
                                language: "JSX",
                            }
                        },
                        {
                            language: {
                                language: "TSX",
                            }
                        },
                    ]
                },
            }
        default:
            return {
                language: {
                    language: language,
                },
            }
    }
}