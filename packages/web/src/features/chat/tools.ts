import { z } from "zod"
import { search } from "@/features/search/searchApi"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { tool } from "ai";
import { isServiceError } from "@/lib/utils";
import { getFileSource } from "../search/fileSourceApi";
import { findSearchBasedSymbolDefinitions, findSearchBasedSymbolReferences } from "../codeNav/actions";

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
        }, SINGLE_TENANT_ORG_DOMAIN);

        if (isServiceError(response)) {
            return {
                success: false,
                error: response.message,
                summary: "Failed to find symbol references"
            }
        }

        return {
            success: true,
            results: response,
            summary: `Found ${response.files.length} files with ${response.stats.matchCount} total matches`
        }
    }
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
        }, SINGLE_TENANT_ORG_DOMAIN);

        if (isServiceError(response)) {
            return {
                success: false,
                error: response.message,
                summary: "Failed to find symbol definitions"
            }
        }

        return {
            success: true,
            results: response,
            summary: `Found ${response.files.length} files with ${response.stats.matchCount} total matches`
        }
    }
});

const readFileTool = tool({
    description: `Reads the contents of a file at the given path.`,
    parameters: z.object({
        path: z.string().describe("The path to the file to read"),
        repository: z.string().describe("The repository to read the file from"),
        revision: z.string().describe("The revision to read the file from"),
    }),
    execute: async ({ path, repository, revision }) => {
        const response = await getFileSource({
            fileName: path,
            repository,
            branch: revision,
        // @todo: handle multi-tenancy.
        }, SINGLE_TENANT_ORG_DOMAIN);

        if (isServiceError(response)) {
            return {
                success: false,
                error: response.message,
                summary: "Failed to read file"
            }
        }

        return {
            success: true,
            content: response,
            summary: "File read successfully"
        }

    }
});

const searchCodeTool = tool({
    description: `Fetches code that matches the provided regex pattern in \`query\`. This is NOT a semantic search.
    Results are returned as an array of matching files, with the file's URL, repository, and language.`,
    parameters: z.object({
        query: z.string().describe("The regex pattern to search for in the code"),
    }),
    execute: async ({ query }) => {
        try {
            const response = await search({ 
                query, 
                matches: 100, 
                contextLines: 3, 
                whole: false,
            // @todo: handle multi-tenancy.
            }, SINGLE_TENANT_ORG_DOMAIN);

            if (isServiceError(response)) {
                return {
                    success: false,
                    error: response.message,
                    summary: "Search failed"
                }
            }

            if (response.files.length === 0) {
                return {
                    success: false,
                    results: [],
                    summary: "No results found"
                }
            }

            const files = response.files.map((file) => {
                return {
                    fileName: file.fileName.text,
                    repository: file.repository,
                    language: file.language,
                    chunks: file.chunks.map((chunk) => {
                        return chunk.content;
                    })
                }
            });

            return {
                success: true,
                results: files,
                summary: `Found ${response.files.length} files with ${response.stats.matchCount} total matches`
            }
        } catch (error) {
            console.error("Search tool: Exception occurred:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                summary: "Search failed"
            }
        }
    },
});

export const tools = {
    searchCode: searchCodeTool,
    readFile: readFileTool,
    findSymbolReferences: findSymbolReferencesTool,
    findSymbolDefinitions: findSymbolDefinitionsTool,
}

export type Tool = keyof typeof tools;