import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { listReposQueryParamsSchema } from "@/lib/schemas";
import { ListReposQueryParams } from "@/lib/types";
import { listRepos } from "@/app/api/(server)/repos/listReposApi";
import { toolNames } from "../constants";
import { logger } from "../logger";

export const listReposTool = tool({
    description: 'Lists repositories in the organization with optional filtering and pagination.',
    inputSchema: listReposQueryParamsSchema,
    execute: async (request: ListReposQueryParams) => {
        logger.debug('listRepos', request);
        const reposResponse = await listRepos(request);

        if (isServiceError(reposResponse)) {
            return reposResponse;
        }

        return reposResponse.data.map((repo) => repo.repoName);
    }
});

export type ListReposTool = InferUITool<typeof listReposTool>;
export type ListReposToolInput = InferToolInput<typeof listReposTool>;
export type ListReposToolOutput = InferToolOutput<typeof listReposTool>;
export type ListReposToolUIPart = ToolUIPart<{ [toolNames.listRepos]: ListReposTool }>;
