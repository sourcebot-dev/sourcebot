import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { listCommits } from "@/features/git";
import { createLogger } from "@sourcebot/shared";
import { ToolDefinition } from "./types";
import description from "./listCommits.txt";

const logger = createLogger('tool-listCommits');

const listCommitsShape = {
    repository: z.string().describe("The repository to list commits from"),
    query: z.string().describe("Search query to filter commits by message (case-insensitive)").optional(),
    since: z.string().describe("Start date for commit range (e.g., '30 days ago', '2024-01-01', 'last week')").optional(),
    until: z.string().describe("End date for commit range (e.g., 'yesterday', '2024-12-31', 'today')").optional(),
    author: z.string().describe("Filter commits by author name or email (case-insensitive)").optional(),
    maxCount: z.number().describe("Maximum number of commits to return (default: 50)").optional(),
};

export type Commit = {
    hash: string;
    date: string;
    message: string;
    author: string;
    refs: string;
};

export type ListCommitsMetadata = {
    commits: Commit[];
    totalCount: number;
};

export const listCommitsDefinition: ToolDefinition<"listCommits", typeof listCommitsShape, ListCommitsMetadata> = {
    name: "listCommits",
    description,
    inputSchema: z.object(listCommitsShape),
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
            throw new Error(response.message);
        }

        const commits: Commit[] = response.commits.map((commit) => ({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            author: `${commit.author_name} <${commit.author_email}>`,
            refs: commit.refs,
        }));

        const metadata: ListCommitsMetadata = {
            commits,
            totalCount: response.totalCount,
        };

        return {
            output: JSON.stringify(metadata),
            metadata,
        };
    },
};
