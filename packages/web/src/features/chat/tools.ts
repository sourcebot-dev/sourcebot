import { z } from "zod"
import { search } from "@/features/search/searchApi"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { tool } from "ai";
import { base64Decode, isServiceError } from "@/lib/utils";
import { getFileSource } from "../search/fileSourceApi";

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
            content: base64Decode(response.source),
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
                    success: true,
                    results: [],
                    summary: "No results found"
                }
            }

            const results: string[] = [];

            for (const file of response.files) {
                const numMatches = file.chunks.reduce(
                    (acc, chunk) => acc + chunk.matchRanges.length,
                    0,
                );

                const snippets = file.chunks.map(chunk => {
                    const content = base64Decode(chunk.content);
                    return `\`\`\`\n${content}\n\`\`\``
                }).join('\n');

                const text = `file: ${file.webUrl}\nnum_matches: ${numMatches}\nrepository: ${file.repository}\nlanguage: ${file.language}\n\n${snippets}`;

                results.push(text);
            }

            console.log("Search tool: Results:", results)
            
            return {
                success: true,
                results,
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
}

export type Tool = keyof typeof tools;