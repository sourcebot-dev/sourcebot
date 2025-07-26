import { z } from "zod"
import { search } from "@/features/search/searchApi"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { getFileSource } from "../search/fileSourceApi";
import { findSearchBasedSymbolDefinitions, findSearchBasedSymbolReferences } from "../codeNav/actions";
import { FileSourceResponse } from "../search/types";
import { addLineNumbers } from "./utils";
import { toolNames } from "./constants";

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
            // @todo(mt): handle multi-tenancy.
        }, SINGLE_TENANT_ORG_DOMAIN);

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
            // @todo(mt): handle multi-tenancy.
        }, SINGLE_TENANT_ORG_DOMAIN);

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
            }, SINGLE_TENANT_ORG_DOMAIN);
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
        query: z.string().describe("The regex pattern to search for in the code"),
    }),
    execute: async ({ query: _query }) => {
        let query = `${_query}`;
        if (selectedRepos.length > 0) {
            query += ` reposet:${selectedRepos.join(',')}`;
        }

        const response = await search({
            query,
            matches: 100,
            // @todo: we can make this configurable.
            contextLines: 3,
            whole: false,
            // @todo(mt): handle multi-tenancy.
        }, SINGLE_TENANT_ORG_DOMAIN);

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
