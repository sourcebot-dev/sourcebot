import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { listCommits, ListCommitsResponse } from "@/features/git";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./listCommits.txt";
import { CodeHostType } from "@sourcebot/db";
import { getRepoInfoByName } from "@/actions";

const listCommitsShape = {
    repo: z.string().describe("The repository to list commits from"),
    query: z.string().describe("Search query to filter commits by message (case-insensitive)").optional(),
    since: z.string().describe("Start date for commit range (e.g., '30 days ago', '2024-01-01', 'last week')").optional(),
    until: z.string().describe("End date for commit range (e.g., 'yesterday', '2024-12-31', 'today')").optional(),
    author: z.string().describe("Filter commits by author name or email (case-insensitive)").optional(),
    ref: z.string().describe("Commit SHA, branch or tag name to list commits of. If not provided, uses the default branch.").optional(),
    path: z.string().describe("Filter commits to only those that touched this file or directory path (relative to repo root).").optional(),
    page: z.number().int().positive().describe("Page number for pagination (min 1). Default: 1").optional().default(1),
    perPage: z.number().int().positive().max(100).describe("Results per page for pagination (min 1, max 100). Default: 50").optional().default(50),
};

export type ListCommitsRepoInfo = {
    name: string;
    displayName: string;
    codeHostType: CodeHostType;
};

export type ListCommitsMetadata = ListCommitsResponse & {
    repo: string;
    repoInfo: ListCommitsRepoInfo;
};

export const listCommitsDefinition: ToolDefinition<"list_commits", typeof listCommitsShape, ListCommitsMetadata> = {
    name: "list_commits",
    title: "List commits",
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(listCommitsShape),
    execute: async (params, _context) => {
        logger.debug('list_commits', params);

        const { repo, query, since, until, author, ref, path, page, perPage } = params;
        const skip = (page - 1) * perPage;

        const response = await listCommits({
            repo,
            query,
            since,
            until,
            author,
            ref,
            path,
            maxCount: perPage,
            skip,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        const repoInfoResult = await getRepoInfoByName(repo);
        if (isServiceError(repoInfoResult) || !repoInfoResult) {
            throw new Error(`Repository "${repo}" not found.`);
        }
        const repoInfo: ListCommitsRepoInfo = {
            name: repoInfoResult.name,
            displayName: repoInfoResult.displayName ?? repoInfoResult.name,
            codeHostType: repoInfoResult.codeHostType,
        };

        return {
            output: JSON.stringify(response),
            metadata: { ...response, repo, repoInfo },
        };
    },
};
