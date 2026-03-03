import { z } from "zod";
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { getFileSource } from "@/features/git";
import { addLineNumbers } from "../utils";
import { toolNames } from "../constants";
import { logger } from "../logger";
import description from './readFile.txt';

// NOTE: if you change this value, update readFile.txt to match.
const READ_FILES_MAX_LINES = 500;

export const readFileTool = tool({
    description,
    inputSchema: z.object({
        path: z.string().describe("The path to the file"),
        repository: z.string().describe("The repository to read the file from"),
        offset: z.number().int().positive()
            .optional()
            .describe("Line number to start reading from (1-indexed). Omit to start from the beginning."),
        limit: z.number().int().positive()
            .optional()
            .describe(`Maximum number of lines to read (max: ${READ_FILES_MAX_LINES}). Omit to read up to ${READ_FILES_MAX_LINES} lines.`),
    }),
    execute: async ({ path, repository, offset, limit }) => {
        logger.debug('readFiles', { path, repository, offset, limit });
        // @todo: make revision configurable.
        const revision = "HEAD";

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
    }
});

export type ReadFileTool = InferUITool<typeof readFileTool>;
export type ReadFileToolInput = InferToolInput<typeof readFileTool>;
export type ReadFileToolOutput = InferToolOutput<typeof readFileTool>;
export type ReadFileToolUIPart = ToolUIPart<{ [toolNames.readFile]: ReadFileTool }>
