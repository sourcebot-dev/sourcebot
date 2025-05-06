// Entry point for the MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { env, numberSchema } from './env.js';
import { listRepositoriesResponseSchema, searchResponseSchema } from './schemas.js';
import { ListRepositoriesResponse, SearchRequest, SearchResponse, TextContent, ServiceError } from './types.js';
import { base64Decode, isServiceError } from './utils.js';
import escapeStringRegexp from 'escape-string-regexp';

// Create MCP server
const server = new McpServer({
    name: 'sourcebot-mcp-server',
    version: '0.1.0',
});

server.tool(
    "search_code",
    `Fetches code snippets that match the given keywords exactly. This is not a semantic search. Results are returned as an array of files, where each file contains a list of code snippets, as well as the file's URL, repository, and language. ALWAYS include the file's external URL when referencing a file.`,
    {
        query: z
            .string()
            .describe(`The regex pattern to search for. RULES:
            1. When a regex special character needs to be escaped, ALWAYS use a single backslash (\) (e.g., 'console\.log')
            2. ALWAYS escape spaces with a single backslash (\) (e.g., 'console\ log')
        `),
        repoIds: z
            .array(z.string())
            .describe(`Scope the search to the provided repositories to the Sourcebot compatible repository IDs. Do not use this property if you want to search all repositories. You must call 'list_repos' first to obtain the exact repository ID.`)
            .optional(),
        languages: z
            .array(z.string())
            .describe(`Scope the search to the provided languages. The language MUST be formatted as a GitHub linguist language. Examples: Python, JavaScript, TypeScript, Java, C#, C++, PHP, Go, Rust, Ruby, Swift, Kotlin, Shell, C, Dart, HTML, CSS, PowerShell, SQL, R`)
            .optional(),
        maxTokens: numberSchema
            .describe(`The maximum number of tokens to return (default: ${env.DEFAULT_MINIMUM_TOKENS}). Higher values provide more context but consume more tokens. Values less than ${env.DEFAULT_MINIMUM_TOKENS} will be ignored.`)
            .transform((val) => (val < env.DEFAULT_MINIMUM_TOKENS ? env.DEFAULT_MINIMUM_TOKENS : val))
            .optional(),
        caseSensitive: z.boolean()
            .describe(`Whether the search should be case sensitive (default: false).`)
            .optional(),
    },
    async ({
        query,
        repoIds = [],
        languages = [],
        maxTokens = env.DEFAULT_MINIMUM_TOKENS,
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

        console.error(`Executing search request: ${query}`);

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
            const snippets = file.chunks.map(chunk => {
                const content = base64Decode(chunk.content);
                return `\`\`\`\n${content}\n\`\`\``
            }).join('\n');
            const text = `file: ${file.url}\nrepository: ${file.repository}\nlanguage: ${file.language}\n${snippets}`;
            // Rough estimate of the number of tokens in the text
            // @see: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
            const tokens = text.length / 4;

            if ((totalTokens + tokens) > (maxTokens ?? env.DEFAULT_MINIMUM_TOKENS)) {
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
    "Lists all repositories in the organization.",
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
                text: `id: ${repo.name}\nurl: ${repo.url}`,
            }
        });

        return {
            content,
        };
    }
);

const search = async (request: SearchRequest): Promise<SearchResponse | ServiceError> => {
    console.error(`Executing search request: ${JSON.stringify(request, null, 2)}`);
    const result = await fetch(`${env.SOURCEBOT_HOST}/api/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Org-Domain': '~'
        },
        body: JSON.stringify(request)
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return searchResponseSchema.parse(result);
}

const listRepos = async (): Promise<ListRepositoriesResponse | ServiceError> => {
    const result = await fetch(`${env.SOURCEBOT_HOST}/api/repos`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Org-Domain': '~'
        },
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return listRepositoriesResponseSchema.parse(result);
}

const runServer = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Sourcebot MCP server ready');
}

runServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});
