import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { listRepos } from "@/app/api/(server)/repos/listReposApi";
import { ToolDefinition } from "./types";
import description from './listRepos.txt';

const listReposShape = {
    page: z.coerce.number().int().positive().default(1).describe("Page number for pagination"),
    perPage: z.coerce.number().int().positive().max(100).default(30).describe("Number of repositories per page (max 100)"),
    sort: z.enum(['name', 'pushed']).default('name').describe("Sort repositories by name or last pushed date"),
    direction: z.enum(['asc', 'desc']).default('asc').describe("Sort direction"),
    query: z.string().optional().describe("Filter repositories by name"),
};

type ListReposMetadata = {
    repos: string[];
};

export const listReposDefinition: ToolDefinition<
    'listRepos',
    typeof listReposShape,
    ListReposMetadata
> = {
    name: 'listRepos',
    description,
    inputSchema: z.object(listReposShape),
    execute: async ({ page, perPage, sort, direction, query }) => {
        const reposResponse = await listRepos({
            page,
            perPage,
            sort,
            direction,
            query,
        });

        if (isServiceError(reposResponse)) {
            throw new Error(reposResponse.message);
        }

        const repos = reposResponse.data.map((repo) => repo.repoName);
        const metadata: ListReposMetadata = { repos };

        return {
            output: JSON.stringify(metadata),
            metadata,
        };
    },
};
