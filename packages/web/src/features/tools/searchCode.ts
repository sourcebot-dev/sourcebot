import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { search } from "@/features/search";
import { addLineNumbers } from "@/features/chat/utils";
import escapeStringRegexp from "escape-string-regexp";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./searchCode.txt";

const DEFAULT_SEARCH_LIMIT = 100;

const searchCodeShape = {
    query: z
        .string()
        .describe(`The search pattern to match against code contents. Do not escape quotes in your query.`)
        .transform((val) => {
            const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            return `"${escaped}"`;
        }),
    useRegex: z
        .boolean()
        .describe(`Whether to use regular expression matching to match the search query against code contents. When false, substring matching is used. (default: false)`)
        .optional(),
    filterByRepos: z
        .array(z.string())
        .describe(`Scope the search to the provided repositories.`)
        .optional(),
    filterByLanguages: z
        .array(z.string())
        .describe(`Scope the search to the provided languages.`)
        .optional(),
    filterByFilepaths: z
        .array(z.string())
        .describe(`Scope the search to the provided filepaths. Each filepath is a regular expression matched against the full file path.`)
        .optional(),
    caseSensitive: z
        .boolean()
        .describe(`Whether the search should be case sensitive (default: false).`)
        .optional(),
    ref: z
        .string()
        .describe(`Commit SHA, branch or tag name to search on. If not provided, defaults to the default branch (usually 'main' or 'master').`)
        .optional(),
    limit: z
        .number()
        .default(DEFAULT_SEARCH_LIMIT)
        .describe(`Maximum number of matches to return (default: ${DEFAULT_SEARCH_LIMIT})`)
        .optional(),
};

export type SearchCodeFile = {
    fileName: string;
    webUrl: string;
    repo: string;
    language: string;
    matches: string[];
    revision: string;
};

export type SearchCodeMetadata = {
    files: SearchCodeFile[];
    query: string;
};

export const searchCodeDefinition: ToolDefinition<'search_code', typeof searchCodeShape, SearchCodeMetadata> = {
    name: 'search_code',
    description,
    inputSchema: z.object(searchCodeShape),
    execute: async ({
        query,
        useRegex = false,
        filterByRepos: repos = [],
        filterByLanguages: languages = [],
        filterByFilepaths: filepaths = [],
        caseSensitive = false,
        ref,
        limit = DEFAULT_SEARCH_LIMIT,
    }, context) => {
        logger.debug('search_code', { query, useRegex, repos, languages, filepaths, caseSensitive, ref, limit });

        if (repos.length > 0) {
            query += ` (repo:${repos.map(id => escapeStringRegexp(id)).join(' or repo:')})`;
        }

        if (languages.length > 0) {
            query += ` (lang:${languages.join(' or lang:')})`;
        }

        if (filepaths.length > 0) {
            query += ` (file:${filepaths.join(' or file:')})`;
        }

        if (ref) {
            query += ` (rev:${ref})`;
        }

        const response = await search({
            queryType: 'string',
            query,
            options: {
                matches: limit,
                contextLines: 3,
                isCaseSensitivityEnabled: caseSensitive,
                isRegexEnabled: useRegex,
            },
            source: context.source,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        const metadata: SearchCodeMetadata = {
            files: response.files.map((file) => ({
                fileName: file.fileName.text,
                webUrl: file.webUrl,
                repo: file.repository,
                language: file.language,
                matches: file.chunks.map(({ content, contentStart }) => {
                    return addLineNumbers(content, contentStart.lineNumber);
                }),
                revision: ref ?? 'HEAD',
            })),
            query,
        };

        return {
            output: JSON.stringify(metadata),
            metadata,
        };
    },
};
