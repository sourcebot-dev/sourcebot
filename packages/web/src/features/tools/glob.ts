import { z } from "zod";
import globToRegexp from "glob-to-regexp";
import { isServiceError } from "@/lib/utils";
import { search } from "@/features/search";
import escapeStringRegexp from "escape-string-regexp";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./glob.txt";
import { CodeHostType } from "@sourcebot/db";
import { getRepoInfoByName } from "@/actions";

const DEFAULT_LIMIT = 100;
const TRUNCATION_MESSAGE = `(Results truncated. Consider using a more specific pattern, specifying a repo, or increasing the limit.)`;

function globToFileRegexp(glob: string): string {
    const re = globToRegexp(glob, { extended: true, globstar: true });
    return re.source.replace(/^\^/, '');
}

const globShape = {
    pattern: z
        .string()
        .describe(`The glob pattern to match file paths against (e.g. "**/*.ts", "src/**/*.test.{ts,tsx}")`),
    path: z
        .string()
        .describe(`Restrict results to files under this subdirectory.`)
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
        .describe(`The maximum number of files to return (default: ${DEFAULT_LIMIT})`)
        .optional(),
};

export type GlobFile = {
    path: string;
    name: string;
    repo: string;
    revision: string;
};

export type GlobRepoInfo = {
    name: string;
    displayName: string;
    codeHostType: CodeHostType;
};

export type GlobMetadata = {
    files: GlobFile[];
    pattern: string;
    query: string;
    fileCount: number;
    repoCount: number;
    repoInfoMap: Record<string, GlobRepoInfo>;
    inputRepo?: GlobRepoInfo;
    truncated: boolean;
};

export const globDefinition: ToolDefinition<'glob', typeof globShape, GlobMetadata> = {
    name: 'glob',
    title: 'Find files',
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(globShape),
    execute: async ({
        pattern,
        repo,
        ref,
        path,
        limit: _limit,
    }, context) => {
        const limit = _limit ?? DEFAULT_LIMIT;

        logger.debug('glob', { pattern, repo, ref, path, limit });

        let query = `file:${globToFileRegexp(pattern)}`;

        if (path) {
            query += ` file:${escapeStringRegexp(path)}`;
        }

        if (repo) {
            query += ` repo:${escapeStringRegexp(repo)}`;
        } else if (context.selectedRepos && context.selectedRepos.length > 0) {
            query += ` reposet:${context.selectedRepos.join(',')}`;
        }

        if (ref) {
            query += ` rev:${ref}`;
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
        } satisfies GlobFile));

        const repoInfoMap = Object.fromEntries(
            response.repositoryInfo.map((info) => [info.name, {
                name: info.name,
                displayName: info.displayName ?? info.name,
                codeHostType: info.codeHostType,
            }])
        );

        const truncated = !response.isSearchExhaustive;

        const inputRepoResult = repo ? await getRepoInfoByName(repo) : undefined;
        if (isServiceError(inputRepoResult)) {
            throw new Error(`Repository "${repo}" not found.`);
        }

        const inputRepo = inputRepoResult ? {
            name: inputRepoResult.name,
            displayName: inputRepoResult.displayName ?? inputRepoResult.name,
            codeHostType: inputRepoResult.codeHostType,
        } : undefined;
        
        const metadata: GlobMetadata = {
            files,
            pattern,
            query,
            fileCount: files.length,
            repoCount: new Set(files.map((f) => f.repo)).size,
            repoInfoMap,
            inputRepo: inputRepo,
            truncated,
        };

        if (files.length === 0) {
            return {
                output: 'No files found',
                metadata,
            };
        }

        const filesByRepo = new Map<string, GlobFile[]>();
        for (const file of files) {
            if (!filesByRepo.has(file.repo)) {
                filesByRepo.set(file.repo, []);
            }
            filesByRepo.get(file.repo)!.push(file);
        }

        const outputLines: string[] = [
            `Found ${files.length} file${files.length !== 1 ? 's' : ''} matching "${pattern}":`,
        ];

        for (const [repo, repoFiles] of filesByRepo) {
            outputLines.push('');
            outputLines.push(`[${repo}]`);
            for (const file of repoFiles) {
                outputLines.push(`  ${file.path}`);
            }
        }

        if (truncated) {
            outputLines.push('');
            outputLines.push(TRUNCATION_MESSAGE);
        }

        return {
            output: outputLines.join('\n'),
            metadata,
        };
    },
};
