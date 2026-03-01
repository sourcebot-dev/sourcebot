import { z } from "zod";
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { listCommits } from "@/features/git";
import { toolNames } from "../constants";
import { logger } from "../logger";
import description from './listCommits.txt';

export const listCommitsTool = tool({
    description,
    inputSchema: z.object({
        repository: z.string().describe("The repository to list commits from"),
        query: z.string().describe("Search query to filter commits by message (case-insensitive)").optional(),
        since: z.string().describe("Start date for commit range (e.g., '30 days ago', '2024-01-01', 'last week')").optional(),
        until: z.string().describe("End date for commit range (e.g., 'yesterday', '2024-12-31', 'today')").optional(),
        author: z.string().describe("Filter commits by author name or email (case-insensitive)").optional(),
        maxCount: z.number().describe("Maximum number of commits to return (default: 50)").optional(),
    }),
    execute: async ({ repository, query, since, until, author, maxCount }) => {
        logger.debug('listCommits', { repository, query, since, until, author, maxCount });
        const response = await listCommits({
            repo: repository,
            query,
            since,
            until,
            author,
            maxCount,
        });

        if (isServiceError(response)) {
            return response;
        }

        return {
            commits: response.commits.map((commit) => ({
                hash: commit.hash,
                date: commit.date,
                message: commit.message,
                author: `${commit.author_name} <${commit.author_email}>`,
                refs: commit.refs,
            })),
            totalCount: response.totalCount,
        };
    }
});

export type ListCommitsTool = InferUITool<typeof listCommitsTool>;
export type ListCommitsToolInput = InferToolInput<typeof listCommitsTool>;
export type ListCommitsToolOutput = InferToolOutput<typeof listCommitsTool>;
export type ListCommitsToolUIPart = ToolUIPart<{ [toolNames.listCommits]: ListCommitsTool }>;
