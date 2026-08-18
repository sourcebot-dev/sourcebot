import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { listBranches, ListBranchesResponse } from "@/features/git";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./listBranches.txt";

const listBranchesShape = {
    repo: z.string().describe("The repository to list branches from"),
    query: z.string().describe("Filter branches by name (case-insensitive substring match)").optional(),
    page: z.number().int().positive().describe("Page number for pagination (min 1). Default: 1").optional().default(1),
    perPage: z.number().int().positive().max(100).describe("Results per page for pagination (min 1, max 100). Default: 50").optional().default(50),
};

export type ListBranchesMetadata = ListBranchesResponse;

export const listBranchesDefinition: ToolDefinition<"list_branches", typeof listBranchesShape, ListBranchesMetadata> = {
    name: "list_branches",
    title: "List branches",
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(listBranchesShape),
    execute: async (params, _context) => {
        logger.debug('list_branches', params);

        const { repo, query, page, perPage } = params;

        const response = await listBranches({ repo, query, page, perPage });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        return {
            output: JSON.stringify(response),
            metadata: response,
        };
    },
};
