import { z } from "zod";
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { ServiceError } from "@/lib/serviceError";
import { getFileSource } from "@/features/git";
import { addLineNumbers } from "../utils";
import { toolNames } from "../constants";
import { logger } from "../logger";
import description from './readFiles.txt';

// NOTE: if you change this value, update readFiles.txt to match.
const READ_FILES_MAX_LINES = 500;

export const readFilesTool = tool({
    description,
    inputSchema: z.object({
        files: z.array(z.object({
            path: z.string().describe("The path to the file"),
            offset: z.number().int().positive()
                .optional()
                .describe(`Line number to start reading from (1-indexed). Omit to start from the beginning.`),
            limit: z.number().int().positive()
                .optional()
                .describe(`Maximum number of lines to read (max: ${READ_FILES_MAX_LINES}). Omit to read up to ${READ_FILES_MAX_LINES} lines.`),
        })).describe("The files to read, with optional offset and limit"),
        repository: z.string().describe("The repository to read the files from"),
    }),
    execute: async ({ files, repository }) => {
        logger.debug('readFiles', { files, repository });
        // @todo: make revision configurable.
        const revision = "HEAD";

        const responses = await Promise.all(files.map(async ({ path, offset, limit }) => {
            const fileSource = await getFileSource({
                path,
                repo: repository,
                ref: revision,
            });

            if (isServiceError(fileSource)) {
                return fileSource;
            }

            const lines = fileSource.source.split('\n');
            const start = (offset ?? 1) - 1;
            const end = start + Math.min(limit ?? READ_FILES_MAX_LINES, READ_FILES_MAX_LINES);
            const slicedLines = lines.slice(start, end);
            const truncated = end < lines.length;

            return {
                path: fileSource.path,
                repository: fileSource.repo,
                language: fileSource.language,
                source: addLineNumbers(slicedLines.join('\n'), offset ?? 1),
                truncated,
                totalLines: lines.length,
                revision,
            };
        }));

        if (responses.some(isServiceError)) {
            return responses.find(isServiceError)!;
        }

        return responses as Exclude<(typeof responses)[number], ServiceError>[];
    }
});

export type ReadFilesTool = InferUITool<typeof readFilesTool>;
export type ReadFilesToolInput = InferToolInput<typeof readFilesTool>;
export type ReadFilesToolOutput = InferToolOutput<typeof readFilesTool>;
export type ReadFilesToolUIPart = ToolUIPart<{ [toolNames.readFiles]: ReadFilesTool }>
