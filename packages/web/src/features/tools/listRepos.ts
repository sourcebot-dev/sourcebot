import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { listRepos } from "@/app/api/(server)/repos/listReposApi";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from './listRepos.txt';

const listReposShape = {
    query: z.string().describe("Filter repositories by name (case-insensitive)").optional(),
    page: z.number().int().positive().describe("Page number for pagination (min 1). Default: 1").optional().default(1),
    perPage: z.number().int().positive().max(100).describe("Results per page for pagination (min 1, max 100). Default: 30").optional().default(30),
    sort: z.enum(['name', 'pushed']).describe("Sort repositories by 'name' or 'pushed' (most recent commit). Default: 'name'").optional().default('name'),
    direction: z.enum(['asc', 'desc']).describe("Sort direction: 'asc' or 'desc'. Default: 'asc'").optional().default('asc'),
};

export type ListRepo = {
    name: string;
    url: string | null;
    pushedAt: string | null;
    defaultBranch: string | null;
    isFork: boolean;
    isArchived: boolean;
};

export type ListReposMetadata = {
    repos: ListRepo[];
    totalCount: number;
};

export const listReposDefinition: ToolDefinition<
    'list_repos',
    typeof listReposShape,
    ListReposMetadata
> = {
    name: 'list_repos',
    title: 'List repositories',
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(listReposShape),
    execute: async ({ page, perPage, sort, direction, query }, context) => {
        logger.debug('list_repos', { page, perPage, sort, direction, query });
        const reposResponse = await listRepos({
            page,
            perPage,
            sort,
            direction,
            query,
            source: context.source,
        });

        if (isServiceError(reposResponse)) {
            throw new Error(reposResponse.message);
        }

        const metadata: ListReposMetadata = {
            repos: reposResponse.data.map((repo) => ({
                name: repo.repoName,
                url: repo.webUrl ?? null,
                pushedAt: repo.pushedAt?.toISOString() ?? null,
                defaultBranch: repo.defaultBranch ?? null,
                isFork: repo.isFork,
                isArchived: repo.isArchived,
            })),
            totalCount: reposResponse.totalCount,
        };

        return {
            output: JSON.stringify(metadata),
            metadata,
        };
    },
};
