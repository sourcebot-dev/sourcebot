import { z } from "zod"
import { search } from "@/features/search"
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { getFileSource } from "../search/fileSourceApi";
import { findSearchBasedSymbolDefinitions, findSearchBasedSymbolReferences } from "../codeNav/api";
import { FileSourceResponse } from "../search/types";
import { addLineNumbers, buildSearchQuery } from "./utils";
import { toolNames } from "./constants";
import { getRepos } from "@/actions";
import Fuse from "fuse.js";

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
    }),
    execute: async ({ symbol, language }) => {
        // @todo: make revision configurable.
        const revision = "HEAD";

        const response = await findSearchBasedSymbolReferences({
            symbolName: symbol,
            language,
            revisionName: "HEAD",
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
    }),
    execute: async ({ symbol, language }) => {
        // @todo: make revision configurable.
        const revision = "HEAD";

        const response = await findSearchBasedSymbolDefinitions({
            symbolName: symbol,
            language,
            revisionName: revision,
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
                fileName: path,
                repository,
                branch: revision,
                // @todo(mt): handle multi-tenancy.
            });
        }));

        if (responses.some(isServiceError)) {
            const firstError = responses.find(isServiceError);
            return firstError!;
        }

        return (responses as FileSourceResponse[]).map((response) => ({
            path: response.path,
            repository: response.repository,
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

export const createCodeSearchTool = (selectedRepos: string[]) => tool({
    description: `Fetches code that matches the provided regex pattern in \`query\`. This is NOT a semantic search.
    Results are returned as an array of matching files, with the file's URL, repository, and language.`,
    inputSchema: z.object({
        queryRegexp: z
            .string()
            .describe(`The regex pattern to search for in the code.

Queries consist of space-seperated regular expressions. Wrapping expressions in "" combines them. By default, a file must have at least one match for each expression to be included. Examples:

\`foo\` - Match files with regex /foo/
\`foo bar\` - Match files with regex /foo/ and /bar/
\`"foo bar"\` - Match files with regex /foo bar/
\`console.log\` - Match files with regex /console.log/

Multiple expressions can be or'd together with or, negated with -, or grouped with (). Examples:
\`foo or bar\` - Match files with regex /foo/ or /bar/
\`foo -bar\` - Match files with regex /foo/ but not /bar/
\`foo (bar or baz)\` - Match files with regex /foo/ and either /bar/ or /baz/
`),
        repoNamesFilterRegexp: z
            .array(z.string())
            .describe(`Filter results from repos that match the regex. By default all repos are searched.`)
            .optional(),
        languageNamesFilter: z
            .array(z.string())
            .describe(`Scope the search to the provided languages. The language MUST be formatted as a GitHub linguist language. Examples: Python, JavaScript, TypeScript, Java, C#, C++, PHP, Go, Rust, Ruby, Swift, Kotlin, Shell, C, Dart, HTML, CSS, PowerShell, SQL, R`)
            .optional(),
        fileNamesFilterRegexp: z
            .array(z.string())
            .describe(`Filter results from filepaths that match the regex. When this option is not specified, all files are searched.`)
            .optional(),
        limit: z.number().default(10).describe("Maximum number of matches to return (default: 100)"),
    }),
    execute: async ({ queryRegexp: _query, repoNamesFilterRegexp, languageNamesFilter, fileNamesFilterRegexp, limit }) => {
        const query = buildSearchQuery({
            query: _query,
            repoNamesFilter: selectedRepos,
            repoNamesFilterRegexp,
            languageNamesFilter,
            fileNamesFilterRegexp,
        });

        const response = await search({
            queryType: 'string',
            query,
            options: {
                matches: limit ?? 100,
                contextLines: 3,
                whole: false,
                isCaseSensitivityEnabled: true,
                isRegexEnabled: true,
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

export const searchReposTool = tool({
    description: `Search for repositories by name using fuzzy search. This helps find repositories in the codebase when you know part of their name.`,
    inputSchema: z.object({
        query: z.string().describe("The search query to find repositories by name (supports fuzzy matching)"),
        limit: z.number().default(10).describe("Maximum number of repositories to return (default: 10)")
    }),
    execute: async ({ query, limit }) => {
        const reposResponse = await getRepos();

        if (isServiceError(reposResponse)) {
            return reposResponse;
        }

        // Configure Fuse.js for fuzzy searching
        const fuse = new Fuse(reposResponse, {
            keys: [
                { name: 'repoName', weight: 0.7 },
                { name: 'repoDisplayName', weight: 0.3 }
            ],
            threshold: 0.4, // Lower threshold = more strict matching
            includeScore: true,
            minMatchCharLength: 1,
        });

        const searchResults = fuse.search(query, { limit: limit ?? 10 });

        searchResults.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

        return searchResults.map(({ item }) => item.repoName);
    }
});

export type SearchReposTool = InferUITool<typeof searchReposTool>;
export type SearchReposToolInput = InferToolInput<typeof searchReposTool>;
export type SearchReposToolOutput = InferToolOutput<typeof searchReposTool>;
export type SearchReposToolUIPart = ToolUIPart<{ [toolNames.searchRepos]: SearchReposTool }>;

export const listAllReposTool = tool({
    description: `Lists all repositories in the codebase. This provides a complete overview of all available repositories.`,
    inputSchema: z.object({}),
    execute: async () => {
        const reposResponse = await getRepos();

        if (isServiceError(reposResponse)) {
            return reposResponse;
        }

        return reposResponse.map((repo) => repo.repoName);
    }
});

export type ListAllReposTool = InferUITool<typeof listAllReposTool>;
export type ListAllReposToolInput = InferToolInput<typeof listAllReposTool>;
export type ListAllReposToolOutput = InferToolOutput<typeof listAllReposTool>;
export type ListAllReposToolUIPart = ToolUIPart<{ [toolNames.listAllRepos]: ListAllReposTool }>;
