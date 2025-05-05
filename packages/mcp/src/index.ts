// Entry point for the MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { env, numberSchema } from './env.js';
import { searchResponseSchema } from './schemas.js';
import { SearchRequest, SearchResponse } from './types.js';
import { base64Decode } from './utils.js';

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
            .describe(`The regex pattern to search for.`),
        repos: z
            .array(z.string())
            .describe(`Scope the search to the provided repositories.`)
            .optional(),
        languages: z
            .array(z.string())
            .describe(`Scope the search to the provided languages. The language MUST be formatted as a GitHub linguist language. Examples: Python, JavaScript, TypeScript, Java, C#, C++, PHP, Go, Rust, Ruby, Swift, Kotlin, Shell, C, Dart, HTML, CSS, PowerShell, SQL, R`)
            .optional(),
        maxTokens: numberSchema
            .describe(`The maximum number of tokens to return (default: ${env.DEFAULT_MINIMUM_TOKENS}). Higher values provide more context but consume more tokens.`)
            .transform((val) => (val < env.DEFAULT_MINIMUM_TOKENS ? env.DEFAULT_MINIMUM_TOKENS : val))
            .optional(),
        caseSensitive: z.boolean()
            .describe(`Whether the search should be case sensitive (default: false).`)
            .optional(),
    },
    async ({
        query: inputQuery,
        repos = [],
        languages = [],
        maxTokens = env.DEFAULT_MINIMUM_TOKENS,
        caseSensitive = false,
    }) => {
        let query = `"${inputQuery}"`;

        if (repos.length > 0) {
            query += ` ( repo:${repos.join(' or repo:')} )`;
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

        type TextContent = { type: "text", text: string };
        const content: TextContent[] = [];
        let totalTokens = 0;

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
                break;
            }

            totalTokens += tokens;
            content.push({
                type: "text",
                text,
            });
        }

        return {
            content,
        }
    }
);

const search = async (request: SearchRequest): Promise<SearchResponse> => {
    console.error(`Executing search request: ${JSON.stringify(request, null, 2)}`);
    const response = await fetch(`${env.SOURCEBOT_HOST}/api/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Org-Domain': '~'
        },
        body: JSON.stringify(request)
    });

    return searchResponseSchema.parse(await response.json());
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
