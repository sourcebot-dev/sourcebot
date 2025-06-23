import { z } from "zod"
import { search } from "@/features/search/searchApi"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { tool } from "ai";
import { isServiceError } from "@/lib/utils";
import { getFileSource } from "../search/fileSourceApi";
import { findSearchBasedSymbolDefinitions, findSearchBasedSymbolReferences } from "../codeNav/actions";
import { FileSourceResponse } from "../search/types";
import { addLineNumbers } from "./utils";

const findSymbolReferencesTool = tool({
    description: `Finds references to a symbol in the codebase.`,
    parameters: z.object({
        symbol: z.string().describe("The symbol to find references to"),
        language: z.string().describe("The programming language of the symbol"),
        revision: z.string().describe("The revision to search for the symbol in"),
    }),
    execute: async ({ symbol, language, revision }) => {
        const response = await findSearchBasedSymbolReferences({
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
            })
        }));
    },

});

const findSymbolDefinitionsTool = tool({
    description: `Finds definitions of a symbol in the codebase.`,
    parameters: z.object({
        symbol: z.string().describe("The symbol to find definitions of"),
        language: z.string().describe("The programming language of the symbol"),
        revision: z.string().describe("The revision to search for the symbol in"),
    }),
    execute: async ({ symbol, language, revision }) => {
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
            })
        }));
    }
});

const readFilesTool = tool({
    description: `Reads the contents of multiple files at the given paths.`,
    parameters: z.object({
        paths: z.array(z.string()).describe("The paths to the files to read"),
        repository: z.string().describe("The repository to read the files from"),
        revision: z.string().describe("The revision to read the files from"),
    }),
    execute: async ({ paths, repository, revision }) => {
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

export type ReadFilesToolRequest = z.infer<typeof readFilesTool.parameters>;
export type ReadFilesToolResponse = Awaited<ReturnType<typeof readFilesTool.execute>>;

const searchCodeTool = tool({
    description: `Fetches code that matches the provided regex pattern in \`query\`. This is NOT a semantic search.
    Results are returned as an array of matching files, with the file's URL, repository, and language.`,
    parameters: z.object({
        query: z.string().describe("The regex pattern to search for in the code"),
    }),
    execute: async ({ query }) => {
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

        return response.files.map((file) => ({
            fileName: file.fileName.text,
            repository: file.repository,
            language: file.language,
            matches: file.chunks.map(({ content, contentStart }) => {
                return addLineNumbers(content, contentStart.lineNumber);
            }),
            // @todo: make revision configurable.
            revision: 'HEAD',
        }));
    },
});

export type SearchCodeToolRequest = z.infer<typeof searchCodeTool.parameters>;
export type SearchCodeToolResponse = Awaited<ReturnType<typeof searchCodeTool.execute>>;

export const toolNames = {
    searchCode: 'searchCode',
    readFiles: 'readFiles',
    findSymbolReferences: 'findSymbolReferences',
    findSymbolDefinitions: 'findSymbolDefinitions',
} as const;

export const tools = {
    [toolNames.searchCode]: searchCodeTool,
    [toolNames.readFiles]: readFilesTool,
    [toolNames.findSymbolReferences]: findSymbolReferencesTool,
    [toolNames.findSymbolDefinitions]: findSymbolDefinitionsTool,
}

export type Tool = keyof typeof tools;