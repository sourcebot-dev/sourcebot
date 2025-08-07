#!/usr/bin/env node

// Entry point for the MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import escapeStringRegexp from 'escape-string-regexp';
import { z } from 'zod';
import { listRepos, search, getFileSource } from './client.js';
import { env, numberSchema } from './env.js';
import { TextContent } from './types.js';
import { isServiceError } from './utils.js';

// Create MCP server
const server = new McpServer({
    name: 'sourcebot-mcp-server',
    version: '0.1.0',
});


server.tool(
    "search_code",
    `Fetches code that matches the provided regex pattern in \`query\`. This is NOT a semantic search.
    Results are returned as an array of matching files, with the file's URL, repository, and language.
    If you receive an error that indicates that you're not authenticated, please inform the user to set the SOURCEBOT_API_KEY environment variable.
    If the \`includeCodeSnippets\` property is true, code snippets containing the matches will be included in the response. Only set this to true if the request requires code snippets (e.g., show me examples where library X is used).
    When referencing a file in your response, **ALWAYS** include the file's external URL as a link. This makes it easier for the user to view the file, even if they don't have it locally checked out.
    **ONLY USE** the \`filterByRepoIds\` property if the request requires searching a specific repo(s). Otherwise, leave it empty.`,
    {
        query: z
            .string()
            .describe(`The regex pattern to search for. RULES:
        1. When a regex special character needs to be escaped, ALWAYS use a single backslash (\) (e.g., 'console\.log')
        2. **ALWAYS** escape spaces with a single backslash (\) (e.g., 'console\ log')
        `),
        filterByRepoIds: z
            .array(z.string())
            .describe(`Scope the search to the provided repositories to the Sourcebot compatible repository IDs. **DO NOT** use this property if you want to search all repositories. **YOU MUST** call 'list_repos' first to obtain the exact repository ID.`)
            .optional(),
        filterByLanguages: z
            .array(z.string())
            .describe(`Scope the search to the provided languages. The language MUST be formatted as a GitHub linguist language. Examples: Python, JavaScript, TypeScript, Java, C#, C++, PHP, Go, Rust, Ruby, Swift, Kotlin, Shell, C, Dart, HTML, CSS, PowerShell, SQL, R`)
            .optional(),
        caseSensitive: z
            .boolean()
            .describe(`Whether the search should be case sensitive (default: false).`)
            .optional(),
        includeCodeSnippets: z
            .boolean()
            .describe(`Whether to include the code snippets in the response (default: false). If false, only the file's URL, repository, and language will be returned. Set to false to get a more concise response.`)
            .optional(),
        maxTokens: numberSchema
            .describe(`The maximum number of tokens to return (default: ${env.DEFAULT_MINIMUM_TOKENS}). Higher values provide more context but consume more tokens. Values less than ${env.DEFAULT_MINIMUM_TOKENS} will be ignored.`)
            .transform((val) => (val < env.DEFAULT_MINIMUM_TOKENS ? env.DEFAULT_MINIMUM_TOKENS : val))
            .optional(),
    },
    async ({
        query,
        filterByRepoIds: repoIds = [],
        filterByLanguages: languages = [],
        maxTokens = env.DEFAULT_MINIMUM_TOKENS,
        includeCodeSnippets = false,
        caseSensitive = false,
    }) => {
        if (repoIds.length > 0) {
            query += ` ( repo:${repoIds.map(id => escapeStringRegexp(id)).join(' or repo:')} )`;
        }

        if (languages.length > 0) {
            query += ` ( lang:${languages.join(' or lang:')} )`;
        }

        if (caseSensitive) {
            query += ` case:yes`;
        } else {
            query += ` case:no`;
        }

        const response = await search({
            query,
            matches: env.DEFAULT_MATCHES,
            contextLines: env.DEFAULT_CONTEXT_LINES,
        });

        if (isServiceError(response)) {
            return {
                content: [{
                    type: "text",
                    text: `Error searching code: ${response.message}`,
                }],
            };
        }

        if (response.files.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: `No results found for the query: ${query}`,
                }],
            };
        }

        const content: TextContent[] = [];
        let totalTokens = 0;
        let isResponseTruncated = false;

        for (const file of response.files) {
            const numMatches = file.chunks.reduce(
                (acc, chunk) => acc + chunk.matchRanges.length,
                0,
            );
            let text = `file: ${file.webUrl}\nnum_matches: ${numMatches}\nrepository: ${file.repository}\nlanguage: ${file.language}`;

            if (includeCodeSnippets) {
                const snippets = file.chunks.map(chunk => {
                    return `\`\`\`\n${chunk.content}\n\`\`\``
                }).join('\n');
                text += `\n\n${snippets}`;
            }


            // Rough estimate of the number of tokens in the text
            // @see: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
            const tokens = text.length / 4;

            if ((totalTokens + tokens) > maxTokens) {
                isResponseTruncated = true;
                break;
            }

            totalTokens += tokens;
            content.push({
                type: "text",
                text,
            });
        }

        if (isResponseTruncated) {
            content.push({
                type: "text",
                text: `The response was truncated because the number of tokens exceeded the maximum limit of ${maxTokens}.`,
            });
        }

        return {
            content,
        }
    }
);

server.tool(
    "list_repos",
    "Lists all repositories in the organization. If you receive an error that indicates that you're not authenticated, please inform the user to set the SOURCEBOT_API_KEY environment variable.",
    async () => {
        const response = await listRepos();
        if (isServiceError(response)) {
            return {
                content: [{
                    type: "text",
                    text: `Error listing repositories: ${response.message}`,
                }],
            };
        }

        const content: TextContent[] = response.repos.map(repo => {
            return {
                type: "text",
                text: `id: ${repo.name}\nurl: ${repo.webUrl}`,
            }
        });

        return {
            content,
        };
    }
);

server.tool(
    "get_file_source",
    "Fetches the source code for a given file. If you receive an error that indicates that you're not authenticated, please inform the user to set the SOURCEBOT_API_KEY environment variable.",
    {
        fileName: z.string().describe("The file to fetch the source code for."),
        repoId: z.string().describe("The repository to fetch the source code for. This is the Sourcebot compatible repository ID."),
    },
    async ({ fileName, repoId }) => {
        const response = await getFileSource({
            fileName,
            repository: repoId,
        });

        if (isServiceError(response)) {
            return {
                content: [{
                    type: "text",
                    text: `Error fetching file source: ${response.message}`,
                }],
            };
        }

        const content: TextContent[] = [{
            type: "text",
            text: `file: ${fileName}\nrepository: ${repoId}\nlanguage: ${response.language}\nsource:\n${response.source}`,
        }]

        return {
            content,
        };
    }
);



const runServer = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

runServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});
