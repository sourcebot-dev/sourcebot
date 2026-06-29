import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { getFileSource } from "@/features/git";
import { ToolDefinition } from "./types";
import { ARTIFACT_READ_MAX_LINES, readArtifactContent } from "./artifactReader";
import { logger } from "./logger";
import description from "./readFile.txt";
import { CodeHostType } from "@sourcebot/db";
import { getRepoInfoByName } from "@/actions";

// NOTE: if you change this value, update readFile.txt to match.
const READ_FILES_MAX_LINES = ARTIFACT_READ_MAX_LINES;

const readFileShape = {
    path: z.string().describe("The path to the file"),
    repo: z.string().describe("The repository to read the file from"),
    ref: z.string().describe("Commit SHA, branch or tag name to read the file from. If not provided, uses the default branch.").optional().default('HEAD'),
    offset: z.number().int().positive()
        .optional()
        .describe("Line number to start reading from (1-indexed). Omit to start from the beginning."),
    limit: z.number().int().positive()
        .optional()
        .describe(`Maximum number of lines to read (max: ${READ_FILES_MAX_LINES}). Omit to read up to ${READ_FILES_MAX_LINES} lines.`),
};

export type ReadFileRepoInfo = {
    name: string;
    displayName: string;
    codeHostType: CodeHostType;
};

export type ReadFileMetadata = {
    path: string;
    repo: string;
    repoInfo: ReadFileRepoInfo;
    startLine: number;
    endLine: number;
    isTruncated: boolean;
    ref: string;
};

export const readFileDefinition: ToolDefinition<"read_file", typeof readFileShape, ReadFileMetadata> = {
    name: "read_file",
    title: "Read file",
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(readFileShape),
    execute: async ({ path, repo, ref = 'HEAD', offset, limit }, context) => {
        logger.debug('read_file', { path, repo, ref, offset, limit });

        const fileSource = await getFileSource({
            path,
            repo,
            ref,
        }, { source: context.source });

        if (isServiceError(fileSource)) {
            throw new Error(fileSource.message);
        }

        const header = [
            `<repo>${fileSource.repo}</repo>`,
            `<path>${fileSource.path}</path>`,
            `<url>${fileSource.externalWebUrl}</url>`,
        ].join('\n');

        const { output, startLine, endLine: lastReadLine, isTruncated } = readArtifactContent({
            content: fileSource.source,
            header,
            offset,
            limit,
        });

        const repoInfoResult = await getRepoInfoByName(fileSource.repo);
        if (isServiceError(repoInfoResult) || !repoInfoResult) {
            throw new Error(`Repository "${fileSource.repo}" not found.`);
        }
        const repoInfo: ReadFileRepoInfo = {
            name: repoInfoResult.name,
            displayName: repoInfoResult.displayName ?? repoInfoResult.name,
            codeHostType: repoInfoResult.codeHostType,
        };

        const metadata: ReadFileMetadata = {
            path: fileSource.path,
            repo: fileSource.repo,
            repoInfo,
            startLine,
            endLine: lastReadLine,
            isTruncated,
            ref,
        };

        return {
            output,
            metadata,
            sources: [{
                type: 'file',
                repo: fileSource.repo,
                path: fileSource.path,
                name: fileSource.path.split('/').pop() ?? fileSource.path,
                revision: ref,
            }],
        };
    },
};
