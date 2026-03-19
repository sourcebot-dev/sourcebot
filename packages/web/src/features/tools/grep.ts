import { z } from "zod";
import globToRegexp from "glob-to-regexp";
import { isServiceError } from "@/lib/utils";
import { search } from "@/features/search";
import escapeStringRegexp from "escape-string-regexp";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./grep.txt";

const DEFAULT_SEARCH_LIMIT = 100;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;

function globToFileRegexp(glob: string): string {
    const re = globToRegexp(glob, { extended: true, globstar: true });
    return re.source.replace(/^\^/, '');
}

const grepShape = {
    pattern: z
        .string()
        .describe(`The regex pattern to search for in file contents`),
    path: z
        .string()
        .describe(`The directory to search in. Defaults to the repository root.`)
        .optional(),
    include: z
        .string()
        .describe(`File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")`)
        .optional(),
    repo: z
        .string()
        .describe(`The name of the repository to search in. If not provided, searches all repositories.`)
        .optional(),
    ref: z
        .string()
        .describe(`The commit SHA, branch or tag name to search on. If not provided, defaults to the default branch (usually 'main' or 'master').`)
        .optional(),
    limit: z
        .number()
        .default(DEFAULT_SEARCH_LIMIT)
        .describe(`The maximum number of matches to return (default: ${DEFAULT_SEARCH_LIMIT})`)
        .optional(),
};

export type GrepFile = {
    path: string;
    name: string;
    repo: string;
    revision: string;
};

export type GrepMetadata = {
    files: GrepFile[];
    query: string;
};

export const grepDefinition: ToolDefinition<'grep', typeof grepShape, GrepMetadata> = {
    name: 'grep',
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(grepShape),
    execute: async ({
        pattern,
        path,
        include,
        repo,
        ref,
        limit = DEFAULT_SEARCH_LIMIT,
    }, context) => {
        logger.debug('grep', { pattern, path, include, repo, ref, limit });

        const quotedPattern = `"${pattern.replace(/"/g, '\\"')}"`;
        let query = quotedPattern;

        if (path) {
            query += ` file:${escapeStringRegexp(path)}`;
        }

        if (include) {
            query += ` file:${globToFileRegexp(include)}`;
        }

        if (repo) {
            query += ` repo:${escapeStringRegexp(repo)}`;
        } else if (context.selectedRepos && context.selectedRepos.length > 0) {
            query += ` reposet:${context.selectedRepos.join(',')}`;
        }

        if (ref) {
            query += ` (rev:${ref})`;
        }

        const response = await search({
            queryType: 'string',
            query,
            options: {
                matches: limit,
                contextLines: 0,
                isCaseSensitivityEnabled: true,
                isRegexEnabled: true,
            },
            source: context.source,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        const metadata: GrepMetadata = {
            files: response.files.map((file) => ({
                path: file.fileName.text,
                name: file.fileName.text.split('/').pop() ?? file.fileName.text,
                repo: file.repository,
                revision: ref ?? 'HEAD',
            } satisfies GrepFile)),
            query,
        };

        const totalFiles = response.files.length;
        const actualMatches = response.stats.actualMatchCount;

        if (totalFiles === 0) {
            return {
                output: 'No files found',
                metadata,
            };
        }

        const outputLines: string[] = [
            `Found ${actualMatches} match${actualMatches !== 1 ? 'es' : ''} in ${totalFiles} file${totalFiles !== 1 ? 's' : ''}`,
        ];

        for (const file of response.files) {
            outputLines.push('');
            outputLines.push(`[${file.repository}] ${file.fileName.text}:`);
            for (const chunk of file.chunks) {
                chunk.content.split('\n').forEach((content, i) => {
                    if (!content.trim()) return;
                    const lineNum = chunk.contentStart.lineNumber + i;
                    const line = content.length > MAX_LINE_LENGTH
                        ? content.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX
                        : content;
                    outputLines.push(`  ${lineNum}: ${line}`);
                });
            }
        }

        if (!response.isSearchExhaustive) {
            outputLines.push('');
            outputLines.push(`(Results truncated. Consider using a more specific path or pattern, specifying a repo, or increasing the limit.)`);
        }

        return {
            output: outputLines.join('\n'),
            metadata,
        };
    },
};
