import { z } from "zod";
import globToRegexp from "glob-to-regexp";
import { isServiceError } from "@/lib/utils";
import { search } from "@/features/search";
import { addLineNumbers } from "@/features/chat/utils";
import escapeStringRegexp from "escape-string-regexp";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./grep.txt";

const DEFAULT_SEARCH_LIMIT = 100;

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
    fileName: string;
    webUrl: string;
    repo: string;
    language: string;
    matches: string[];
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
        }

        if (ref) {
            query += ` (rev:${ref})`;
        }

        const response = await search({
            queryType: 'string',
            query,
            options: {
                matches: limit,
                contextLines: 3,
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
                fileName: file.fileName.text,
                webUrl: file.webUrl,
                repo: file.repository,
                language: file.language,
                matches: file.chunks.map(({ content, contentStart }) => {
                    return addLineNumbers(content, contentStart.lineNumber);
                }),
                revision: ref ?? 'HEAD',
            })),
            query,
        };

        return {
            output: JSON.stringify(metadata),
            metadata,
        };
    },
};
