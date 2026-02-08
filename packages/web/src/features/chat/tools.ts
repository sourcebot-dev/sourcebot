import { z } from "zod"
import { search } from "@/features/search"
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { FileSourceResponse, getFileSource, listCommits } from '@/features/git';
import { findSearchBasedSymbolDefinitions, findSearchBasedSymbolReferences } from "../codeNav/api";
import { addLineNumbers } from "./utils";
import { toolNames } from "./constants";
import { listReposQueryParamsSchema } from "@/lib/schemas";
import { ListReposQueryParams } from "@/lib/types";
import { listRepos } from "@/app/api/(server)/repos/listReposApi";
import escapeStringRegexp from "escape-string-regexp";

// @NOTE: When adding a new tool, follow these steps:
// 1. Add the tool to the `toolNames` constant in `constants.ts`.
// 2. Add the tool to the `SBChatMessageToolTypes` type in `types.ts`.
// 3. Add the tool to the `tools` prop in `agent.ts`.
// 4. If the tool is meant to be rendered in the UI:
//    - Add the tool to the `uiVisiblePartTypes` constant in `constants.ts`.
//    - Add the tool's component to the `DetailsCard` switch statement in `detailsCard.tsx`.
//
// - bk, 2025-07-25


export const findSymbolReferencesTool = tool({
    description: `Finds references to a symbol in the codebase.`,
    inputSchema: z.object({
        symbol: z.string().describe("The symbol to find references to"),
        language: z.string().describe("The programming language of the symbol"),
        repository: z.string().describe("The repository to scope the search to").optional(),
    }),
    execute: async ({ symbol, language, repository }) => {
        // @todo: make revision configurable.
        const revision = "HEAD";

        const response = await findSearchBasedSymbolReferences({
            symbolName: symbol,
            language,
            revisionName: "HEAD",
            repoName: repository,
        });

        if (isServiceError(response)) {
            return response;
        }

        return response.files.map((file) => ({
            fileName: file.fileName,
            repository: file.repository,
            language: file.language,
            matches: file.matches.map(({ lineContent, range }) => {
                return addLineNumbers(lineContent, range.start.lineNumber);
            }),
            revision,
        }));
    },
});

export type FindSymbolReferencesTool = InferUITool<typeof findSymbolReferencesTool>;
export type FindSymbolReferencesToolInput = InferToolInput<typeof findSymbolReferencesTool>;
export type FindSymbolReferencesToolOutput = InferToolOutput<typeof findSymbolReferencesTool>;
export type FindSymbolReferencesToolUIPart = ToolUIPart<{ [toolNames.findSymbolReferences]: FindSymbolReferencesTool }>

export const findSymbolDefinitionsTool = tool({
    description: `Finds definitions of a symbol in the codebase.`,
    inputSchema: z.object({
        symbol: z.string().describe("The symbol to find definitions of"),
        language: z.string().describe("The programming language of the symbol"),
        repository: z.string().describe("The repository to scope the search to").optional(),
    }),
    execute: async ({ symbol, language, repository }) => {
        // @todo: make revision configurable.
        const revision = "HEAD";

        const response = await findSearchBasedSymbolDefinitions({
            symbolName: symbol,
            language,
            revisionName: revision,
            repoName: repository,
        });

        if (isServiceError(response)) {
            return response;
        }

        return response.files.map((file) => ({
            fileName: file.fileName,
            repository: file.repository,
            language: file.language,
            matches: file.matches.map(({ lineContent, range }) => {
                return addLineNumbers(lineContent, range.start.lineNumber);
            }),
            revision,
        }));
    }
});

export type FindSymbolDefinitionsTool = InferUITool<typeof findSymbolDefinitionsTool>;
export type FindSymbolDefinitionsToolInput = InferToolInput<typeof findSymbolDefinitionsTool>;
export type FindSymbolDefinitionsToolOutput = InferToolOutput<typeof findSymbolDefinitionsTool>;
export type FindSymbolDefinitionsToolUIPart = ToolUIPart<{ [toolNames.findSymbolDefinitions]: FindSymbolDefinitionsTool }>

export const readFilesTool = tool({
    description: `Reads the contents of multiple files at the given paths.`,
    inputSchema: z.object({
        paths: z.array(z.string()).describe("The paths to the files to read"),
        repository: z.string().describe("The repository to read the files from"),
    }),
    execute: async ({ paths, repository }) => {
        // @todo: make revision configurable.
        const revision = "HEAD";

        const responses = await Promise.all(paths.map(async (path) => {
            return getFileSource({
                path,
                repo: repository,
                ref: revision,
            });
        }));

        if (responses.some(isServiceError)) {
            const firstError = responses.find(isServiceError);
            return firstError!;
        }

        return (responses as FileSourceResponse[]).map((response) => ({
            path: response.path,
            repository: response.repo,
            language: response.language,
            source: addLineNumbers(response.source),
            revision,
        }));
    }
});

export type ReadFilesTool = InferUITool<typeof readFilesTool>;
export type ReadFilesToolInput = InferToolInput<typeof readFilesTool>;
export type ReadFilesToolOutput = InferToolOutput<typeof readFilesTool>;
export type ReadFilesToolUIPart = ToolUIPart<{ [toolNames.readFiles]: ReadFilesTool }>

const DEFAULT_SEARCH_LIMIT = 100;

export const createCodeSearchTool = (selectedRepos: string[]) => tool({
    description: `Searches for code that matches the provided search query as a substring by default, or as a regular expression if useRegex is true. Useful for exploring remote repositories by searching for exact symbols, functions, variables, or specific code patterns. To determine if a repository is indexed, use the \`listRepos\` tool. By default, searches are global and will search the default branch of all repositories. Searches can be scoped to specific repositories, languages, and branches.`,
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
            .describe(`Scope the search to the provided filepaths.`)
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

        if (selectedRepos.length > 0) {
            query += ` reposet:${selectedRepos.join(',')}`;
        }

        if (repos.length > 0) {
            query += ` (repo:${repos.map(id => escapeStringRegexp(id)).join(' or repo:')})`;
        }

        if (languages.length > 0) {
            query += ` (lang:${languages.join(' or lang:')})`;
        }

        if (filepaths.length > 0) {
            query += ` (file:${filepaths.map(filepath => escapeStringRegexp(filepath)).join(' or file:')})`;
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
            return response;
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

export type SearchCodeTool = InferUITool<ReturnType<typeof createCodeSearchTool>>;
export type SearchCodeToolInput = InferToolInput<ReturnType<typeof createCodeSearchTool>>;
export type SearchCodeToolOutput = InferToolOutput<ReturnType<typeof createCodeSearchTool>>;
export type SearchCodeToolUIPart = ToolUIPart<{ [toolNames.searchCode]: SearchCodeTool }>;

export const listReposTool = tool({
    description: 'Lists repositories in the organization with optional filtering and pagination.',
    inputSchema: listReposQueryParamsSchema,
    execute: async (request: ListReposQueryParams) => {
        const reposResponse = await listRepos(request);

        if (isServiceError(reposResponse)) {
            return reposResponse;
        }

        return reposResponse.data.map((repo) => repo.repoName);
    }
});

export type ListReposTool = InferUITool<typeof listReposTool>;
export type ListReposToolInput = InferToolInput<typeof listReposTool>;
export type ListReposToolOutput = InferToolOutput<typeof listReposTool>;
export type ListReposToolUIPart = ToolUIPart<{ [toolNames.listRepos]: ListReposTool }>;

export const listCommitsTool = tool({
    description: 'Lists commits in a repository with optional filtering by date range, author, and commit message.',
    inputSchema: z.object({
        repository: z.string().describe("The repository to list commits from"),
        query: z.string().describe("Search query to filter commits by message (case-insensitive)").optional(),
        since: z.string().describe("Start date for commit range (e.g., '30 days ago', '2024-01-01', 'last week')").optional(),
        until: z.string().describe("End date for commit range (e.g., 'yesterday', '2024-12-31', 'today')").optional(),
        author: z.string().describe("Filter commits by author name or email (case-insensitive)").optional(),
        maxCount: z.number().describe("Maximum number of commits to return (default: 50)").optional(),
    }),
    execute: async ({ repository, query, since, until, author, maxCount }) => {
        const response = await listCommits({
            repo: repository,
            query,
            since,
            until,
            author,
            maxCount,
        });

        if (isServiceError(response)) {
            return response;
        }

        return {
            commits: response.commits.map((commit) => ({
                hash: commit.hash,
                date: commit.date,
                message: commit.message,
                author: `${commit.author_name} <${commit.author_email}>`,
                refs: commit.refs,
            })),
            totalCount: response.totalCount,
        };
    }
});

export type ListCommitsTool = InferUITool<typeof listCommitsTool>;
export type ListCommitsToolInput = InferToolInput<typeof listCommitsTool>;
export type ListCommitsToolOutput = InferToolOutput<typeof listCommitsTool>;
export type ListCommitsToolUIPart = ToolUIPart<{ [toolNames.listCommits]: ListCommitsTool }>;
