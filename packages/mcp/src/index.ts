#!/usr/bin/env node

// Entry point for the MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import escapeStringRegexp from 'escape-string-regexp';
import { z } from 'zod';
import { getFileSource, listRepos, search, listCommits } from './client.js';
import { env, numberSchema } from './env.js';
import { listReposRequestSchema } from './schemas.js';
import { ListReposRequest, TextContent } from './types.js';
import _dedent from "dedent";

const dedent = _dedent.withOptions({ alignValues: true });

// Create MCP server
const server = new McpServer({
    name: 'sourcebot-mcp-server',
    version: '0.1.0',
});


server.tool(
    "search_code",
    dedent`
    Fetches code that matches the provided regex pattern in \`query\`.

    Results are returned as an array of matching files, with the file's URL, repository, and language.

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
        gitRevision: z
            .string()
            .describe(`The git revision to search in (e.g., 'main', 'HEAD', 'v1.0.0', 'a1b2c3d'). If not provided, defaults to the default branch (usually 'main' or 'master').`)
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
        gitRevision,
    }) => {
        if (repoIds.length > 0) {
            query += ` ( repo:${repoIds.map(id => escapeStringRegexp(id)).join(' or repo:')} )`;
        }

        if (languages.length > 0) {
            query += ` ( lang:${languages.join(' or lang:')} )`;
        }

        if (gitRevision) {
            query += ` ( rev:${gitRevision} )`;
        }

        const response = await search({
            query,
            matches: env.DEFAULT_MATCHES,
            contextLines: env.DEFAULT_CONTEXT_LINES,
            isRegexEnabled: true,
            isCaseSensitivityEnabled: caseSensitive,
            source: 'mcp',
        });

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
            const fileIdentifier = file.webUrl ?? file.fileName.text;
            let text = dedent`
            file: ${fileIdentifier}
            num_matches: ${numMatches}
            repository: ${file.repository}
            language: ${file.language}
            `;

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
                // Calculate remaining token budget
                const remainingTokens = maxTokens - totalTokens;

                if (remainingTokens > 100) {  // Only truncate if meaningful space left
                    // Truncate text to fit remaining tokens (tokens ≈ chars/4)
                    const maxLength = Math.floor(remainingTokens * 4);
                    const truncatedText = text.substring(0, maxLength) + "\n\n...[content truncated due to token limit]";

                    content.push({
                        type: "text",
                        text: truncatedText,
                    });

                    totalTokens += remainingTokens;
                }

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
    "list_commits",
    dedent`Get a list of commits for a given repository.`,
    {
        repoName: z.string().describe(`The name of the repository to search commits in.`),
        query: z.string().describe(`Search query to filter commits by message content (case-insensitive).`).optional(),
        since: z.string().describe(`Show commits more recent than this date. Filters by actual commit time. Supports ISO 8601 (e.g., '2024-01-01') or relative formats (e.g., '30 days ago', 'last week').`).optional(),
        until: z.string().describe(`Show commits older than this date. Filters by actual commit time. Supports ISO 8601 (e.g., '2024-12-31') or relative formats (e.g., 'yesterday').`).optional(),
        author: z.string().describe(`Filter commits by author name or email`).optional(),
        maxCount: z.number().int().positive().max(100).default(50).describe(`Maximum number of commits to return (default: 50).`),
    },
    async ({ repoName, query, since, until, author, maxCount }) => {
        const result = await listCommits({
            repository: repoName,
            query,
            since,
            until,
            author,
            maxCount,
        });

        return {
            content: [{ type: "text", text: JSON.stringify(result) }],
        };
    }
);

server.tool(
    "list_repos",
    dedent`Lists repositories in the organization with optional filtering and pagination.`,
    listReposRequestSchema.shape,
    async ({ query, page = 1, perPage = 30, sort = 'name', direction = 'asc' }: ListReposRequest) => {
        const result = await listRepos({ query, page, perPage, sort, direction });

        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
);

server.tool(
    "read_file",
    dedent`Reads the source code for a given file.`,
    {
        fileName: z.string().describe("The file to fetch the source code for."),
        repoName: z.string().describe("The name of the repository to fetch the source code for."),
    },
    async ({ fileName, repoName }) => {
        const response = await getFileSource({
            fileName,
            repository: repoName,
        });

        return { content: [{ type: "text", text: JSON.stringify(response) }] };
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
