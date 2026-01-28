#!/usr/bin/env node

// Entry point for the MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import _dedent from "dedent";
import escapeStringRegexp from 'escape-string-regexp';
import { z } from 'zod';
import { askCodebase, getFileSource, listCommits, listRepos, search } from './client.js';
import { env, numberSchema } from './env.js';
import { askCodebaseRequestSchema, fileSourceRequestSchema, listCommitsQueryParamsSchema, listReposQueryParamsSchema } from './schemas.js';
import { AskCodebaseRequest, FileSourceRequest, ListCommitsQueryParamsSchema, ListReposQueryParams, TextContent } from './types.js';

const dedent = _dedent.withOptions({ alignValues: true });

// Create MCP server
const server = new McpServer({
    name: 'sourcebot-mcp-server',
    version: '0.1.0',
});


server.tool(
    "search_code",
    dedent`
    Searches for code that matches the provided search query as a substring by default, or as a regular expression if useRegex is true. Useful for exploring remote repositories by searching for exact symbols, functions, variables, or specific code patterns. To determine if a repository is indexed, use the \`list_repos\` tool. By default, searches are global and will search the default branch of all repositories. Searches can be scoped to specific repositories, languages, and branches. When referencing code outputted by this tool, always include the file's external URL as a link. This makes it easier for the user to view the file, even if they don't have it locally checked out.
    `,
    {
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
        includeCodeSnippets: z
            .boolean()
            .describe(`Whether to include the code snippets in the response. If false, only the file's URL, repository, and language will be returned. (default: false)`)
            .optional(),
        ref: z
            .string()
            .describe(`Commit SHA, branch or tag name to search on. If not provided, defaults to the default branch (usually 'main' or 'master').`)
            .optional(),
        maxTokens: numberSchema
            .describe(`The maximum number of tokens to return (default: ${env.DEFAULT_MINIMUM_TOKENS}). Higher values provide more context but consume more tokens. Values less than ${env.DEFAULT_MINIMUM_TOKENS} will be ignored.`)
            .transform((val) => (val < env.DEFAULT_MINIMUM_TOKENS ? env.DEFAULT_MINIMUM_TOKENS : val))
            .optional(),
    },
    async ({
        query,
        filterByRepos: repos = [],
        filterByLanguages: languages = [],
        filterByFilepaths: filepaths = [],
        maxTokens = env.DEFAULT_MINIMUM_TOKENS,
        includeCodeSnippets = false,
        caseSensitive = false,
        ref,
        useRegex = false,
    }) => {
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
            query += ` ( rev:${ref} )`;
        }

        const response = await search({
            query,
            matches: env.DEFAULT_MATCHES,
            contextLines: env.DEFAULT_CONTEXT_LINES,
            isRegexEnabled: useRegex,
            isCaseSensitivityEnabled: caseSensitive,
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
            let text = dedent`
            file: ${file.webUrl}
            num_matches: ${numMatches}
            repo: ${file.repository}
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
    listCommitsQueryParamsSchema.shape,
    async (request: ListCommitsQueryParamsSchema) => {
        const result = await listCommits(request);

        return {
            content: [{
                type: "text", text: JSON.stringify(result)
            }],
        };
    }
);

server.tool(
    "list_repos",
    dedent`Lists repositories in the organization with optional filtering and pagination.`,
    listReposQueryParamsSchema.shape,
    async (request: ListReposQueryParams) => {
        const result = await listRepos(request);

        return {
            content: [{
                type: "text", text: JSON.stringify({
                    repos: result.repos.map((repo) => ({
                        name: repo.repoName,
                        url: repo.webUrl,
                        pushedAt: repo.pushedAt,
                    })),
                    totalCount: result.totalCount,
                })
            }]
        };
    }
);

server.tool(
    "read_file",
    dedent`Reads the source code for a given file.`,
    fileSourceRequestSchema.shape,
    async (request: FileSourceRequest) => {
        const response = await getFileSource(request);

        return {
            content: [{
                type: "text", text: JSON.stringify({
                    source: response.source,
                    language: response.language,
                    path: response.path,
                    url: response.webUrl,
                })
            }]
        };
    }
);

server.tool(
    "ask_codebase",
    dedent`
    Ask a natural language question about the codebase. This tool uses an AI agent to autonomously search code, read files, and find symbol references/definitions to answer your question.

    The agent will:
    - Analyze your question and determine what context it needs
    - Search the codebase using multiple strategies (code search, symbol lookup, file reading)
    - Synthesize findings into a comprehensive answer with code references

    Returns a detailed answer in markdown format with code references, plus a link to view the full research session (including all tool calls and reasoning) in the Sourcebot web UI.

    This is a blocking operation that may take 30-60+ seconds for complex questions as the agent researches the codebase.
    `,
    {
        question: z.string().describe("The question to ask about the codebase."),
        repo: z.string().describe("The repository to ask the question on."),
    },
    async ({
        question,
        repo,
    }) => {
        const response = await askCodebase({
            question,
            repos: [repo],
        });

        // Format the response with the answer and a link to the chat
        const formattedResponse = dedent`
        ${response.answer}

        ---
        **View full research session:** ${response.chatUrl}

        **Sources referenced:** ${response.sources.length} files
        **Response time:** ${(response.metadata.totalResponseTimeMs / 1000).toFixed(1)}s
        **Model:** ${response.metadata.modelName}
        `;

        return {
            content: [{
                type: "text",
                text: formattedResponse,
            }],
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
