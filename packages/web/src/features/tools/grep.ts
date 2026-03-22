import { z } from "zod";
import globToRegexp from "glob-to-regexp";
import { isServiceError } from "@/lib/utils";
import { search } from "@/features/search";
import escapeStringRegexp from "escape-string-regexp";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./grep.txt";
import { CodeHostType } from "@sourcebot/db";

const DEFAULT_LIMIT = 100;
const DEFAULT_GROUP_BY_REPO_LIMIT = 10_000;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const TRUNCATION_MESSAGE = `(Results truncated. Consider using a more specific path or pattern, specifying a repo, or increasing the limit.)`;

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
        .describe(`The maximum number of matches to return (default: ${DEFAULT_LIMIT} when groupByRepo=false, ${DEFAULT_GROUP_BY_REPO_LIMIT} when groupByRepo=true)`)
        .optional(),
    groupByRepo: z
        .boolean()
        .optional()
        .describe(`If true, returns a summary of match counts grouped by repository instead of individual file results.`),
};

export type GrepFile = {
    path: string;
    name: string;
    repo: string;
    revision: string;
};

export type GrepRepoInfo = {
    name: string;
    displayName: string;
    codeHostType: CodeHostType;
};

export type GrepMetadata = {
    files: GrepFile[];
    pattern: string;
    query: string;
    matchCount: number;
    repoCount: number;
    repoInfoMap: Record<string, GrepRepoInfo>;
    groupByRepo: boolean;
};

export const grepDefinition: ToolDefinition<'grep', typeof grepShape, GrepMetadata> = {
    name: 'grep',
    title: 'Search code',
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
        limit: _limit,
        groupByRepo = false,
    }, context) => {

        const limit = _limit ?? (groupByRepo ? DEFAULT_GROUP_BY_REPO_LIMIT : DEFAULT_LIMIT);

        logger.debug('grep', { pattern, path, include, repo, ref, limit, groupByRepo });

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

        const files = response.files.map((file) => ({
            path: file.fileName.text,
            name: file.fileName.text.split('/').pop() ?? file.fileName.text,
            repo: file.repository,
            revision: ref ?? 'HEAD',
        } satisfies GrepFile));

        const repoInfoMap = Object.fromEntries(
            response.repositoryInfo.map((info) => [info.name, {
                name: info.name,
                displayName: info.displayName ?? info.name,
                codeHostType: info.codeHostType,
            }])
        );

        const metadata: GrepMetadata = {
            files,
            pattern,
            query,
            matchCount: response.stats.actualMatchCount,
            repoCount: new Set(files.map((f) => f.repo)).size,
            repoInfoMap,
            groupByRepo,
        };

        const totalFiles = response.files.length;
        const actualMatches = response.stats.actualMatchCount;

        if (totalFiles === 0) {
            return {
                output: 'No files found',
                metadata,
            };
        }

        if (groupByRepo) {
            const repoCounts = new Map<string, { matches: number; files: number }>();
            for (const file of response.files) {
                const repo = file.repository;
                const matchCount = file.chunks.reduce((acc, chunk) => acc + chunk.matchRanges.length, 0);
                const existing = repoCounts.get(repo) ?? { matches: 0, files: 0 };
                repoCounts.set(repo, { matches: existing.matches + matchCount, files: existing.files + 1 });
            }

            const outputLines: string[] = [
                `Found matches in ${repoCounts.size} ${repoCounts.size === 1 ? 'repository' : 'repositories'}:`,
            ];
            for (const [repoName, { matches, files }] of repoCounts) {
                outputLines.push(`  ${repoName}: ${matches} ${matches === 1 ? 'match' : 'matches'} in ${files} ${files === 1 ? 'file' : 'files'}`);
            }

            if (!response.isSearchExhaustive) {
                outputLines.push('');
                outputLines.push(TRUNCATION_MESSAGE);
            }

            return {
                output: outputLines.join('\n'),
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
                    if (!content.trim()) {
                        return;
                    }
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
            outputLines.push(TRUNCATION_MESSAGE);
        }

        return {
            output: outputLines.join('\n'),
            metadata,
        };
    },
};
