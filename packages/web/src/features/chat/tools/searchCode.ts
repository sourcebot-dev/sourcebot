import { z } from "zod";
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { search } from "@/features/search";
import { addLineNumbers } from "../utils";
import { toolNames } from "../constants";
import { logger } from "../logger";
import escapeStringRegexp from "escape-string-regexp";
import description from './searchCode.txt';

const DEFAULT_SEARCH_LIMIT = 100;

export const searchCodeTool = tool({
    description,
    inputSchema: z.object({
        query: z
            .string()
            .describe(`The search pattern to match against code contents. Do not escape quotes in your query.`)
            // Escape backslashes first, then quotes, and wrap in double quotes
            // so the query is treated as a literal phrase (like grep).
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
    }),
    execute: async ({
        query,
        useRegex = false,
        filterByRepos: repos = [],
        filterByLanguages: languages = [],
        filterByFilepaths: filepaths = [],
        caseSensitive = false,
        ref,
        limit = DEFAULT_SEARCH_LIMIT,
    }) => {
        logger.debug('searchCode', { query, useRegex, repos, languages, filepaths, caseSensitive, ref, limit });

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
            }
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        return {
            files: response.files.map((file) => ({
                fileName: file.fileName.text,
                repository: file.repository,
                language: file.language,
                matches: file.chunks.map(({ content, contentStart }) => {
                    return addLineNumbers(content, contentStart.lineNumber);
                }),
                // @todo: make revision configurable.
                revision: 'HEAD',
            })),
            query,
        }
    },
});

export type SearchCodeTool = InferUITool<typeof searchCodeTool>;
export type SearchCodeToolInput = InferToolInput<typeof searchCodeTool>;
export type SearchCodeToolOutput = InferToolOutput<typeof searchCodeTool>;
export type SearchCodeToolUIPart = ToolUIPart<{ [toolNames.searchCode]: SearchCodeTool }>;
