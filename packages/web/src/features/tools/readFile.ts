import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { getFileSource } from "@/features/git";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./readFile.txt";
import { CodeHostType } from "@sourcebot/db";
import { getRepoInfoByName } from "@/actions";

// NOTE: if you change these values, update readFile.txt to match.
const READ_FILES_MAX_LINES = 500;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const MAX_BYTES = 5 * 1024;
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024}KB`;

const readFileShape = {
    path: z.string().describe("The path to the file"),
    repo: z.string().describe("The repository to read the file from"),
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
    language: string;
    startLine: number;
    endLine: number;
    isTruncated: boolean;
    revision: string;
};

export const readFileDefinition: ToolDefinition<"read_file", typeof readFileShape, ReadFileMetadata> = {
    name: "read_file",
    title: "Read file",
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(readFileShape),
    execute: async ({ path, repo, offset, limit }, context) => {
        logger.debug('read_file', { path, repo, offset, limit });
        // @todo: make revision configurable.
        const revision = "HEAD";

        const fileSource = await getFileSource({
            path,
            repo,
            ref: revision,
        }, { source: context.source });

        if (isServiceError(fileSource)) {
            throw new Error(fileSource.message);
        }

        const lines = fileSource.source.split('\n');
        const start = (offset ?? 1) - 1;
        const end = start + Math.min(limit ?? READ_FILES_MAX_LINES, READ_FILES_MAX_LINES);

        let bytes = 0;
        let truncatedByBytes = false;
        const slicedLines: string[] = [];
        for (const raw of lines.slice(start, end)) {
            const line = raw.length > MAX_LINE_LENGTH ? raw.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX : raw;
            const size = Buffer.byteLength(line, 'utf-8') + (slicedLines.length > 0 ? 1 : 0);
            if (bytes + size > MAX_BYTES) {
                truncatedByBytes = true;
                break;
            }
            slicedLines.push(line);
            bytes += size;
        }

        const truncatedByLines = end < lines.length;
        const startLine = (offset ?? 1);
        const lastReadLine = startLine + slicedLines.length - 1;
        const nextOffset = lastReadLine + 1;

        let output = [
            `<repo>${fileSource.repo}</repo>`,
            `<path>${fileSource.path}</path>`,
            `<url>${fileSource.externalWebUrl}</url>`,
            '<content>\n'
        ].join('\n');

        output += slicedLines.map((line, i) => `${startLine + i}: ${line}`).join('\n');

        if (truncatedByBytes) {
            output += `\n\n(Output capped at ${MAX_BYTES_LABEL}. Showing lines ${startLine}-${lastReadLine} of ${lines.length}. Use offset=${nextOffset} to continue.)`;
        } else if (truncatedByLines) {
            output += `\n\n(Showing lines ${startLine}-${lastReadLine} of ${lines.length}. Use offset=${nextOffset} to continue.)`;
        } else {
            output += `\n\n(End of file - ${lines.length} lines total)`;
        }

        output += `\n</content>`;

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
            language: fileSource.language,
            startLine,
            endLine: lastReadLine,
            isTruncated: truncatedByBytes || truncatedByLines,
            revision,
        };

        return { output, metadata };
    },
};
