import 'server-only';

import { sew } from "@/middleware/sew";
import { search } from "@/features/search";
import { ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuth } from "@/middleware/withAuth";
import { SearchResponse } from "../search/types";
import { FindRelatedSymbolsRequest, FindRelatedSymbolsResponse } from "./types";
import { QueryIR } from '../search/ir';
import escapeStringRegexp from "escape-string-regexp";

// The maximum number of matches to return from the search API.
const MAX_REFERENCE_COUNT = 1000;

/**
 * Finds all search-based symbol references for a given symbol name.
 * Constructs a Zoekt IR query filtering by symbol name, branch, language, and repository,
 * then parses the search response to extract matching file results (including the commit ref).
 *
 * @param props - The request parameters including symbolName, language, revisionName, and repoName.
 * @returns The matching files with their references, or a ServiceError on failure.
 */
export const findSearchBasedSymbolReferences = async (props: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withOptionalAuth(async () => {
        const {
            symbolName,
            language,
            revisionName = "HEAD",
            repoName,
        } = props;

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
                    ...(language ? [getExpandedLanguageFilter(language)] : []),
                    ...(repoName ? [{
                        repo: {
                            regexp: `^${escapeStringRegexp(repoName)}$`,
                        }
                    }]: [])
                ]
            }
        }

        const searchResult = await search({
            queryType: 'ir',
            query,
            options: {
                matches: MAX_REFERENCE_COUNT,
                contextLines: 0,
            },
            source: 'sourcebot-ui-codenav',
        });

        if (isServiceError(searchResult)) {
            return searchResult;
        }

        return parseRelatedSymbolsSearchResponse(searchResult);
    }));


/**
 * Finds all search-based symbol definitions for a given symbol name.
 * Uses Zoekt's symbol search to locate definition sites, filtering by branch, language, and repository.
 * The response includes the commit ref (SHA) for each matched file.
 *
 * @param props - The request parameters including symbolName, language, revisionName, and repoName.
 * @returns The matching files with their definitions, or a ServiceError on failure.
 */
export const findSearchBasedSymbolDefinitions = async (props: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => sew(() =>
    withOptionalAuth(async () => {
        const {
            symbolName,
            language,
            revisionName = "HEAD",
            repoName
        } = props;

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
                    ...(language ? [getExpandedLanguageFilter(language)] : []),
                    ...(repoName ? [{
                        repo: {
                            regexp: `^${escapeStringRegexp(repoName)}$`,
                        }
                    }]: [])
                ]
            }
        }

        const searchResult = await search({
            queryType: 'ir',
            query,
            options: {
                matches: MAX_REFERENCE_COUNT,
                contextLines: 0,
            },
            source: 'sourcebot-ui-codenav',
        });

        if (isServiceError(searchResult)) {
            return searchResult;
        }

        return parseRelatedSymbolsSearchResponse(searchResult);
    }));

/**
 * Transforms a raw Zoekt SearchResponse into a FindRelatedSymbolsResponse.
 * Maps each file's chunks and match ranges into a structured response, including
 * the git commit ref (SHA) from the search result.
 *
 * @param searchResult - The raw search response from the Zoekt searcher.
 * @returns A structured response containing stats, matched files with refs, and repository info.
 */
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
                ref: file.ref,
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
        case "C":
        case "C++":
            return {
                or: {
                    children: [
                        {
                            language: {
                                language: "C++"
                            }
                        },
                        {
                            language: {
                                language: "C"
                            }
                        }
                    ]
                }
            }
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