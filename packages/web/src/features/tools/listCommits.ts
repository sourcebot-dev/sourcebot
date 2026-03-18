import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { listCommits, SearchCommitsResult } from "@/features/git";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./listCommits.txt";

const listCommitsShape = {
    repo: z.string().describe("The repository to list commits from"),
    query: z.string().describe("Search query to filter commits by message (case-insensitive)").optional(),
    since: z.string().describe("Start date for commit range (e.g., '30 days ago', '2024-01-01', 'last week')").optional(),
    until: z.string().describe("End date for commit range (e.g., 'yesterday', '2024-12-31', 'today')").optional(),
    author: z.string().describe("Filter commits by author name or email (case-insensitive)").optional(),
    ref: z.string().describe("Commit SHA, branch or tag name to list commits of. If not provided, uses the default branch.").optional(),
    page: z.number().int().positive().describe("Page number for pagination (min 1). Default: 1").optional().default(1),
    perPage: z.number().int().positive().max(100).describe("Results per page for pagination (min 1, max 100). Default: 50").optional().default(50),
};

export type ListCommitsMetadata = SearchCommitsResult;  

export const listCommitsDefinition: ToolDefinition<"list_commits", typeof listCommitsShape, ListCommitsMetadata> = {
    name: "list_commits",
    description,
    inputSchema: z.object(listCommitsShape),
    execute: async (params, _context) => {
        logger.debug('list_commits', params);

        const { repo, query, since, until, author, ref, page, perPage } = params;
        const skip = (page - 1) * perPage;

        const response = await listCommits({
            repo,
            query,
            since,
            until,
            author,
            ref,
            maxCount: perPage,
            skip,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        return {
            output: JSON.stringify(response),
            metadata: response,
        };
    },
};
