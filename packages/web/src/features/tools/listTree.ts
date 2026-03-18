import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { getTree } from "@/features/git";
import { buildTreeNodeIndex, joinTreePath, normalizeTreePath, sortTreeEntries } from "@/features/mcp/utils";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./listTree.txt";

const DEFAULT_TREE_DEPTH = 1;
const MAX_TREE_DEPTH = 10;
const DEFAULT_MAX_TREE_ENTRIES = 1000;
const MAX_MAX_TREE_ENTRIES = 10000;

const listTreeShape = {
    repo: z.string().describe("The name of the repository to list files from."),
    path: z.string().describe("Directory path (relative to repo root). If omitted, the repo root is used.").optional().default(''),
    ref: z.string().describe("Commit SHA, branch or tag name to list files from. If not provided, uses the default branch.").optional().default('HEAD'),
    depth: z.number().int().positive().max(MAX_TREE_DEPTH).describe(`How many directory levels to traverse below \`path\` (min 1, max ${MAX_TREE_DEPTH}, default ${DEFAULT_TREE_DEPTH}).`).optional().default(DEFAULT_TREE_DEPTH),
    includeFiles: z.boolean().describe("Whether to include files in the output (default: true).").optional().default(true),
    includeDirectories: z.boolean().describe("Whether to include directories in the output (default: true).").optional().default(true),
    maxEntries: z.number().int().positive().max(MAX_MAX_TREE_ENTRIES).describe(`Maximum number of entries to return (min 1, max ${MAX_MAX_TREE_ENTRIES}, default ${DEFAULT_MAX_TREE_ENTRIES}).`).optional().default(DEFAULT_MAX_TREE_ENTRIES),
};

export type ListTreeEntry = {
    type: 'tree' | 'blob';
    path: string;
    name: string;
    parentPath: string;
    depth: number;
};

export type ListTreeMetadata = {
    repo: string;
    ref: string;
    path: string;
    entries: ListTreeEntry[];
    totalReturned: number;
    truncated: boolean;
};

export const listTreeDefinition: ToolDefinition<'list_tree', typeof listTreeShape, ListTreeMetadata> = {
    name: 'list_tree',
    description,
    inputSchema: z.object(listTreeShape),
    execute: async ({ repo, path = '', ref = 'HEAD', depth = DEFAULT_TREE_DEPTH, includeFiles = true, includeDirectories = true, maxEntries = DEFAULT_MAX_TREE_ENTRIES }, context) => {
        logger.debug('list_tree', { repo, path, ref, depth, includeFiles, includeDirectories, maxEntries });
        const normalizedPath = normalizeTreePath(path);
        const normalizedDepth = Math.min(depth, MAX_TREE_DEPTH);
        const normalizedMaxEntries = Math.min(maxEntries, MAX_MAX_TREE_ENTRIES);

        if (!includeFiles && !includeDirectories) {
            const metadata: ListTreeMetadata = {
                repo, ref, path: normalizedPath,
                entries: [],
                totalReturned: 0,
                truncated: false,
            };
            return { output: JSON.stringify(metadata), metadata };
        }

        const queue: Array<{ path: string; depth: number }> = [{ path: normalizedPath, depth: 0 }];
        const queuedPaths = new Set<string>([normalizedPath]);
        const seenEntries = new Set<string>();
        const entries: ListTreeEntry[] = [];
        let truncated = false;

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
            }, { source: context.source });

            if (isServiceError(treeResult)) {
                throw new Error(treeResult.message);
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

        const sortedEntries = sortTreeEntries(entries);
        const metadata: ListTreeMetadata = {
            repo, ref, path: normalizedPath,
            entries: sortedEntries,
            totalReturned: sortedEntries.length,
            truncated,
        };

        return { output: JSON.stringify(metadata), metadata };
    },
};
