#!/usr/bin/env node

// Entry point for the MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import _dedent from "dedent";
import escapeStringRegexp from 'escape-string-regexp';
import { z } from 'zod';
import { askCodebase, getFileSource, listCommits, listLanguageModels, listRepos, listTree, search } from './client.js';
import { env, numberSchema } from './env.js';
import { askCodebaseRequestSchema, DEFAULT_MAX_TREE_ENTRIES, DEFAULT_TREE_DEPTH, fileSourceRequestSchema, listCommitsQueryParamsSchema, listReposQueryParamsSchema, listTreeRequestSchema, MAX_MAX_TREE_ENTRIES, MAX_TREE_DEPTH } from './schemas.js';
import { AskCodebaseRequest, FileSourceRequest, ListCommitsQueryParamsSchema, ListReposQueryParams, ListTreeEntry, ListTreeRequest, TextContent } from './types.js';
import { buildTreeNodeIndex, joinTreePath, normalizeTreePath, sortTreeEntries } from './utils.js';

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
    "list_tree",
    dedent`
    Lists files and directories from a repository path. This can be used as a repo tree tool or directory listing tool.
    Returns a flat list of entries with path metadata and depth relative to the requested path.
    `,
    listTreeRequestSchema.shape,
    async ({
        repo,
        path = '',
        ref = 'HEAD',
        depth = DEFAULT_TREE_DEPTH,
        includeFiles = true,
        includeDirectories = true,
        maxEntries = DEFAULT_MAX_TREE_ENTRIES,
    }: ListTreeRequest) => {
        const normalizedPath = normalizeTreePath(path);
        const normalizedDepth = Math.min(depth, MAX_TREE_DEPTH);
        const normalizedMaxEntries = Math.min(maxEntries, MAX_MAX_TREE_ENTRIES);

        if (!includeFiles && !includeDirectories) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        repo,
                        ref,
                        path: normalizedPath,
                        entries: [] as ListTreeEntry[],
                        totalReturned: 0,
                        truncated: false,
                    }),
                }],
            };
        }

        // BFS frontier of directories still to expand. Each item stores a repo-relative
        // directory path plus the current depth from the requested root `path`.
        const queue: Array<{ path: string; depth: number }> = [{ path: normalizedPath, depth: 0 }];

        // Tracks directory paths that have already been enqueued.
        // With the current single-root traversal duplicates are uncommon, but this
        // prevents duplicate expansion if we later support overlapping multi-root
        // inputs (e.g. ["src", "src/lib"]) or receive overlapping tree data.
        const queuedPaths = new Set<string>([normalizedPath]);

        const seenEntries = new Set<string>();
        const entries: ListTreeEntry[] = [];
        let truncated = false;

        // Traverse breadth-first by depth, batching all directories at the same
        // depth into a single /api/tree request per iteration.
        while (queue.length > 0 && !truncated) {
            const currentDepth = queue[0]!.depth;
            const currentLevelPaths: string[] = [];

            // Drain only the current depth level so we can issue one API call
            // for all sibling directories before moving deeper.
            while (queue.length > 0 && queue[0]!.depth === currentDepth) {
                const next = queue.shift()!;
                currentLevelPaths.push(next.path);
            }

            // Ask Sourcebot for a tree spanning all requested paths at this level.
            const treeResponse = await listTree({
                repoName: repo,
                revisionName: ref,
                paths: currentLevelPaths.filter(Boolean),
            });
            const treeNodeIndex = buildTreeNodeIndex(treeResponse.tree);

            for (const currentPath of currentLevelPaths) {
                const currentNode = currentPath === '' ? treeResponse.tree : treeNodeIndex.get(currentPath);
                if (!currentNode || currentNode.type !== 'tree') {
                    // Skip paths that are missing from the response or resolve to a
                    // file node. We only iterate children of directories.
                    continue;
                }

                for (const child of currentNode.children) {
                    if (child.type !== 'tree' && child.type !== 'blob') {
                        // Skip non-standard git object types (e.g. unexpected entries)
                        // since this tool only exposes directories and files.
                        continue;
                    }

                    const childPath = joinTreePath(currentPath, child.name);
                    const childDepth = currentDepth + 1;

                    // Queue child directories for the next depth level only if
                    // they are within the requested depth bound.
                    if (child.type === 'tree' && childDepth < normalizedDepth && !queuedPaths.has(childPath)) {
                        queue.push({ path: childPath, depth: childDepth });
                        queuedPaths.add(childPath);
                    }

                    if ((child.type === 'blob' && !includeFiles) || (child.type === 'tree' && !includeDirectories)) {
                        // Skip entries filtered out by caller preferences
                        // (`includeFiles` / `includeDirectories`).
                        continue;
                    }

                    const key = `${child.type}:${childPath}`;
                    if (seenEntries.has(key)) {
                        // Skip duplicates when multiple requested paths overlap and
                        // surface the same child entry.
                        continue;
                    }
                    seenEntries.add(key);

                    // Stop collecting once the entry budget is exhausted.
                    if (entries.length >= normalizedMaxEntries) {
                        truncated = true;
                        break;
                    }

                    entries.push({
                        type: child.type,
                        path: childPath,
                        name: child.name,
                        parentPath: currentPath,
                        depth: childDepth,
                    });
                }

                if (truncated) {
                    break;
                }
            }
        }

        const sortedEntries = sortTreeEntries(entries);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    repo,
                    ref,
                    path: normalizedPath,
                    entries: sortedEntries,
                    totalReturned: sortedEntries.length,
                    truncated,
                }),
            }]
        };
    }
);

server.tool(
    "list_language_models",
    dedent`Lists the available language models configured on the Sourcebot instance. Use this to discover which models can be specified when calling ask_codebase.`,
    {},
    async () => {
        const models = await listLanguageModels();

        return {
            content: [{
                type: "text",
                text: JSON.stringify(models),
            }],
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

    When using this in shared environments (e.g., Slack), you can set the visibility parameter to 'PUBLIC' to ensure everyone can access the chat link. Note: The visibility parameter is only respected for authenticated users. Anonymous users will always create PUBLIC chats regardless of the visibility setting.

    This is a blocking operation that may take 30-60+ seconds for complex questions as the agent researches the codebase.
    `,
    askCodebaseRequestSchema.shape,
    async (request: AskCodebaseRequest) => {
        const response = await askCodebase(request);

        // Format the response with the answer and a link to the chat
        const formattedResponse = dedent`
        ${response.answer}

        ---
        **View full research session:** ${response.chatUrl}
        **Model used:** ${response.languageModel.model}
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
