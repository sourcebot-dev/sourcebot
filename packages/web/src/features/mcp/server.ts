import { listRepos } from '@/app/api/(server)/repos/listReposApi';
import { getConfiguredLanguageModelsInfo } from "../chat/utils.server";
import { askCodebase } from '@/features/mcp/askCodebase';
import {
    languageModelInfoSchema,
} from '@/features/chat/types';
import { getFileSource, getTree, listCommits } from '@/features/git';
import { search } from '@/features/search/searchApi';
import { isServiceError } from '@/lib/utils';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ChatVisibility } from '@sourcebot/db';
import { SOURCEBOT_VERSION } from '@sourcebot/shared';
import _dedent from 'dedent';
import escapeStringRegexp from 'escape-string-regexp';
import { z } from 'zod';
import {
    ListTreeEntry,
    TextContent,
} from './types';
import { buildTreeNodeIndex, joinTreePath, normalizeTreePath, sortTreeEntries } from './utils';

const dedent = _dedent.withOptions({ alignValues: true });

const DEFAULT_MINIMUM_TOKENS = 10000;
const DEFAULT_MATCHES = 10000;
const DEFAULT_CONTEXT_LINES = 5;

const DEFAULT_TREE_DEPTH = 1;
const MAX_TREE_DEPTH = 10;
const DEFAULT_MAX_TREE_ENTRIES = 1000;
const MAX_MAX_TREE_ENTRIES = 10000;

export function createMcpServer(): McpServer {
    const server = new McpServer({
        name: 'sourcebot-mcp-server',
        version: SOURCEBOT_VERSION,
    });

    server.registerTool(
        "search_code",
        {
            description: dedent`
            Searches for code that matches the provided search query as a substring by default, or as a regular expression if useRegex is true. Useful for exploring remote repositories by searching for exact symbols, functions, variables, or specific code patterns. To determine if a repository is indexed, use the \`list_repos\` tool. By default, searches are global and will search the default branch of all repositories. Searches can be scoped to specific repositories, languages, and branches. When referencing code outputted by this tool, always include the file's external URL as a link. This makes it easier for the user to view the file, even if they don't have it locally checked out.`,
            inputSchema: {
                query: z
                    .string()
                    .describe(`The search pattern to match against code contents. Do not escape quotes in your query.`)
                    .transform((val) => {
                        const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                        return `"${escaped}"`;
                    }),
                useRegex: z
                    .boolean()
                    .describe(`Whether to use regular expression matching. When false, substring matching is used. (default: false)`)
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
                    .describe(`Whether to include code snippets in the response. If false, only the file's URL, repository, and language will be returned. (default: false)`)
                    .optional(),
                ref: z
                    .string()
                    .describe(`Commit SHA, branch or tag name to search on. If not provided, defaults to the default branch.`)
                    .optional(),
                maxTokens: z
                    .number()
                    .describe(`The maximum number of tokens to return (default: ${DEFAULT_MINIMUM_TOKENS}).`)
                    .transform((val) => (val < DEFAULT_MINIMUM_TOKENS ? DEFAULT_MINIMUM_TOKENS : val))
                    .optional(),
            },
        },
        async ({
            query,
            filterByRepos: repos = [],
            filterByLanguages: languages = [],
            filterByFilepaths: filepaths = [],
            maxTokens = DEFAULT_MINIMUM_TOKENS,
            includeCodeSnippets = false,
            caseSensitive = false,
            ref,
            useRegex = false,
        }: {
            query: string;
            useRegex?: boolean;
            filterByRepos?: string[];
            filterByLanguages?: string[];
            filterByFilepaths?: string[];
            caseSensitive?: boolean;
            includeCodeSnippets?: boolean;
            ref?: string;
            maxTokens?: number;
        }) => {
            if (repos.length > 0) {
                query += ` (repo:${repos.map(id => escapeStringRegexp(id)).join(' or repo:')})`;
            }
            if (languages.length > 0) {
                query += ` (lang:${languages.join(' or lang:')})`;
            }
            if (filepaths.length > 0) {
                query += ` (file:${filepaths.map(fp => escapeStringRegexp(fp)).join(' or file:')})`;
            }
            if (ref) {
                query += ` ( rev:${ref} )`;
            }

            const response = await search({
                queryType: 'string',
                query,
                options: {
                    matches: DEFAULT_MATCHES,
                    contextLines: DEFAULT_CONTEXT_LINES,
                    isRegexEnabled: useRegex,
                    isCaseSensitivityEnabled: caseSensitive,
                },
            });

            if (isServiceError(response)) {
                return {
                    content: [{ type: "text", text: `Search failed: ${response.message}` }],
                };
            }

            if (response.files.length === 0) {
                return {
                    content: [{ type: "text", text: `No results found for the query: ${query}` }],
                };
            }

            const content: TextContent[] = [];
            let totalTokens = 0;
            let isResponseTruncated = false;

            for (const file of response.files) {
                const numMatches = file.chunks.reduce((acc, chunk) => acc + chunk.matchRanges.length, 0);
                let text = dedent`
                file: ${file.webUrl}
                num_matches: ${numMatches}
                repo: ${file.repository}
                language: ${file.language}
                `;

                if (includeCodeSnippets) {
                    const snippets = file.chunks.map(chunk => `\`\`\`\n${chunk.content}\n\`\`\``).join('\n');
                    text += `\n\n${snippets}`;
                }

                const tokens = text.length / 4;

                if ((totalTokens + tokens) > maxTokens) {
                    const remainingTokens = maxTokens - totalTokens;
                    if (remainingTokens > 100) {
                        const maxLength = Math.floor(remainingTokens * 4);
                        content.push({
                            type: "text",
                            text: text.substring(0, maxLength) + "\n\n...[content truncated due to token limit]",
                        });
                        totalTokens += remainingTokens;
                    }
                    isResponseTruncated = true;
                    break;
                }

                totalTokens += tokens;
                content.push({ type: "text", text });
            }

            if (isResponseTruncated) {
                content.push({
                    type: "text",
                    text: `The response was truncated because the number of tokens exceeded the maximum limit of ${maxTokens}.`,
                });
            }

            return { content };
        }
    );

    server.registerTool(
        "list_commits",
        {
            description: dedent`Get a list of commits for a given repository.`,
            inputSchema: z.object({
                repo: z.string().describe("The name of the repository to list commits for."),
                query: z.string().describe("Search query to filter commits by message content (case-insensitive).").optional(),
                since: z.string().describe("Show commits more recent than this date. Supports ISO 8601 or relative formats (e.g., '30 days ago').").optional(),
                until: z.string().describe("Show commits older than this date. Supports ISO 8601 or relative formats (e.g., 'yesterday').").optional(),
                author: z.string().describe("Filter commits by author name or email (case-insensitive).").optional(),
                ref: z.string().describe("Commit SHA, branch or tag name to list commits of. If not provided, uses the default branch.").optional(),
                page: z.number().int().positive().describe("Page number for pagination (min 1). Default: 1").optional().default(1),
                perPage: z.number().int().positive().max(100).describe("Results per page for pagination (min 1, max 100). Default: 50").optional().default(50),
            }),
        },
        async ({ repo, query, since, until, author, ref, page, perPage }) => {
            const skip = (page - 1) * perPage;
            const result = await listCommits({
                repo,
                query,
                since,
                until,
                author,
                ref,
                maxCount: perPage,
                skip,
            });

            if (isServiceError(result)) {
                return {
                    content: [{ type: "text", text: `Failed to list commits: ${result.message}` }],
                };
            }

            return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }
    );

    server.registerTool(
        "list_repos",
        {
            description: dedent`Lists repositories in the organization with optional filtering and pagination.`,
            inputSchema: z.object({
                query: z.string().describe("Filter repositories by name (case-insensitive)").optional(),
                page: z.number().int().positive().describe("Page number for pagination (min 1). Default: 1").optional().default(1),
                perPage: z.number().int().positive().max(100).describe("Results per page for pagination (min 1, max 100). Default: 30").optional().default(30),
                sort: z.enum(['name', 'pushed']).describe("Sort repositories by 'name' or 'pushed' (most recent commit). Default: 'name'").optional().default('name'),
                direction: z.enum(['asc', 'desc']).describe("Sort direction: 'asc' or 'desc'. Default: 'asc'").optional().default('asc'),
            })
        },
        async ({ query, page, perPage, sort, direction }) => {
            const result = await listRepos({ query, page, perPage, sort, direction });

            if (isServiceError(result)) {
                return {
                    content: [{ type: "text", text: `Failed to list repositories: ${result.message}` }],
                };
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        repos: result.data.map((repo) => ({
                            name: repo.repoName,
                            url: repo.webUrl,
                            pushedAt: repo.pushedAt,
                            defaultBranch: repo.defaultBranch,
                            isFork: repo.isFork,
                            isArchived: repo.isArchived,
                        })),
                        totalCount: result.totalCount,
                    }),
                }],
            };
        }
    );

    server.registerTool(
        "read_file",
        {
            description: dedent`Reads the source code for a given file.`,
            inputSchema: {
                repo: z.string().describe("The repository name."),
                path: z.string().describe("The path to the file."),
                ref: z.string().optional().describe("Commit SHA, branch or tag name to fetch the source code for. If not provided, uses the default branch of the repository."),
            },
        },
        async ({ repo, path, ref }) => {
            const response = await getFileSource({ repo, path, ref });

            if (isServiceError(response)) {
                return {
                    content: [{ type: "text", text: `Failed to read file: ${response.message}` }],
                };
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        source: response.source,
                        language: response.language,
                        path: response.path,
                        url: response.webUrl,
                    }),
                }],
            };
        }
    );

    server.registerTool(
        "list_tree",
        {
            description: dedent`
            Lists files and directories from a repository path. This can be used as a repo tree tool or directory listing tool.
            Returns a flat list of entries with path metadata and depth relative to the requested path.
            `,
            inputSchema: {
                repo: z.string().describe("The name of the repository to list files from."),
                path: z.string().describe("Directory path (relative to repo root). If omitted, the repo root is used.").optional().default(''),
                ref: z.string().describe("Commit SHA, branch or tag name to list files from. If not provided, uses the default branch.").optional().default('HEAD'),
                depth: z.number().int().positive().max(MAX_TREE_DEPTH).describe(`How many directory levels to traverse below \`path\` (min 1, max ${MAX_TREE_DEPTH}, default ${DEFAULT_TREE_DEPTH}).`).optional().default(DEFAULT_TREE_DEPTH),
                includeFiles: z.boolean().describe("Whether to include files in the output (default: true).").optional().default(true),
                includeDirectories: z.boolean().describe("Whether to include directories in the output (default: true).").optional().default(true),
                maxEntries: z.number().int().positive().max(MAX_MAX_TREE_ENTRIES).describe(`Maximum number of entries to return (min 1, max ${MAX_MAX_TREE_ENTRIES}, default ${DEFAULT_MAX_TREE_ENTRIES}).`).optional().default(DEFAULT_MAX_TREE_ENTRIES),
            },
        },
        async ({
            repo,
            path = '',
            ref = 'HEAD',
            depth = DEFAULT_TREE_DEPTH,
            includeFiles = true,
            includeDirectories = true,
            maxEntries = DEFAULT_MAX_TREE_ENTRIES,
        }: {
            repo: string;
            path?: string;
            ref?: string;
            depth?: number;
            includeFiles?: boolean;
            includeDirectories?: boolean;
            maxEntries?: number;
        }) => {
            const normalizedPath = normalizeTreePath(path);
            const normalizedDepth = Math.min(depth, MAX_TREE_DEPTH);
            const normalizedMaxEntries = Math.min(maxEntries, MAX_MAX_TREE_ENTRIES);

            if (!includeFiles && !includeDirectories) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            repo, ref, path: normalizedPath,
                            entries: [] as ListTreeEntry[],
                            totalReturned: 0,
                            truncated: false,
                        }),
                    }],
                };
            }

            const queue: Array<{ path: string; depth: number }> = [{ path: normalizedPath, depth: 0 }];
            const queuedPaths = new Set<string>([normalizedPath]);
            const seenEntries = new Set<string>();
            const entries: ListTreeEntry[] = [];
            let truncated = false;
            let treeError: string | null = null;

            while (queue.length > 0 && !truncated) {
                const currentDepth = queue[0]!.depth;
                const currentLevelPaths: string[] = [];

                while (queue.length > 0 && queue[0]!.depth === currentDepth) {
                    currentLevelPaths.push(queue.shift()!.path);
                }

                const treeResult = await getTree({
                    repoName: repo,
                    revisionName: ref,
                    paths: currentLevelPaths.filter(Boolean),
                });

                if (isServiceError(treeResult)) {
                    treeError = treeResult.message;
                    break;
                }

                const treeNodeIndex = buildTreeNodeIndex(treeResult.tree);

                for (const currentPath of currentLevelPaths) {
                    const currentNode = currentPath === '' ? treeResult.tree : treeNodeIndex.get(currentPath);
                    if (!currentNode || currentNode.type !== 'tree') continue;

                    for (const child of currentNode.children) {
                        if (child.type !== 'tree' && child.type !== 'blob') continue;

                        const childPath = joinTreePath(currentPath, child.name);
                        const childDepth = currentDepth + 1;

                        if (child.type === 'tree' && childDepth < normalizedDepth && !queuedPaths.has(childPath)) {
                            queue.push({ path: childPath, depth: childDepth });
                            queuedPaths.add(childPath);
                        }

                        if ((child.type === 'blob' && !includeFiles) || (child.type === 'tree' && !includeDirectories)) {
                            continue;
                        }

                        const key = `${child.type}:${childPath}`;
                        if (seenEntries.has(key)) continue;
                        seenEntries.add(key);

                        if (entries.length >= normalizedMaxEntries) {
                            truncated = true;
                            break;
                        }

                        entries.push({
                            type: child.type as 'tree' | 'blob',
                            path: childPath,
                            name: child.name,
                            parentPath: currentPath,
                            depth: childDepth,
                        });
                    }

                    if (truncated) break;
                }
            }

            if (treeError) {
                return {
                    content: [{ type: "text", text: `Failed to list tree: ${treeError}` }],
                };
            }

            const sortedEntries = sortTreeEntries(entries);
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        repo, ref, path: normalizedPath,
                        entries: sortedEntries,
                        totalReturned: sortedEntries.length,
                        truncated,
                    }),
                }],
            };
        }
    );

    server.registerTool(
        "list_language_models",
        {
            description: dedent`Lists the available language models configured on the Sourcebot instance. Use this to discover which models can be specified when calling ask_codebase.`,
        },
        async () => {
            const models = await getConfiguredLanguageModelsInfo();
            return { content: [{ type: "text", text: JSON.stringify(models) }] };
        }
    );

    server.registerTool(
        "ask_codebase",
        {
            description: dedent`
            Ask a natural language question about the codebase. This tool uses an AI agent to autonomously search code, read files, and find symbol references/definitions to answer your question.

            The agent will:
            - Analyze your question and determine what context it needs
            - Search the codebase using multiple strategies (code search, symbol lookup, file reading)
            - Synthesize findings into a comprehensive answer with code references

            Returns a detailed answer in markdown format with code references, plus a link to view the full research session (including all tool calls and reasoning) in the Sourcebot web UI.

            When using this in shared environments (e.g., Slack), you can set the visibility parameter to 'PUBLIC' to ensure everyone can access the chat link.

            This is a blocking operation that may take 30-60+ seconds for complex questions as the agent researches the codebase.
            `,
            inputSchema: z.object({
                query: z.string().describe("The query to ask about the codebase."),
                repos: z.array(z.string()).optional().describe("The repositories accessible to the agent. If not provided, all repositories are accessible."),
                languageModel: languageModelInfoSchema.optional().describe("The language model to use. If not provided, defaults to the first model in the config."),
                visibility: z.enum(['PRIVATE', 'PUBLIC']).optional().describe("The visibility of the chat session. Defaults to PRIVATE for authenticated users."),
            }),
        },
        async (request) => {
            const result = await askCodebase({
                query: request.query,
                repos: request.repos,
                languageModel: request.languageModel,
                visibility: request.visibility as ChatVisibility | undefined,
            });

            if (isServiceError(result)) {
                return {
                    content: [{ type: "text", text: `Failed to ask codebase: ${result.message}` }],
                };
            }

            const formattedResponse = dedent`
            ${result.answer}

            ---
            **View full research session:** ${result.chatUrl}
            **Model used:** ${result.languageModel.model}
            `;
            return { content: [{ type: "text", text: formattedResponse }] };
        }
    );

    return server;
}
