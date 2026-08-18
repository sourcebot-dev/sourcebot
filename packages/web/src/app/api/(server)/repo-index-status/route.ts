import type { RepoIndexingStatusesResponse } from "@/app/(app)/repos/types";
import { apiHandler } from "@/lib/apiHandler";
import { getBullMQClient } from "@/lib/bullmqClient";
import {
    requestBodySchemaValidationError,
    serviceErrorResponse,
} from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuth } from "@/middleware/withAuth";
import { REPO_INDEX_QUEUE } from "@sourcebot/shared";
import { z } from "zod";

const requestSchema = z.object({
    repoIds: z.array(z.number().int().positive()).min(1).max(100),
});

export const POST = apiHandler(async (request) => {
    const parsed = requestSchema.safeParse(
        await request.json().catch(() => null),
    );
    if (!parsed.success) {
        return serviceErrorResponse(
            requestBodySchemaValidationError(parsed.error),
        );
    }

    const result = await withOptionalAuth(async ({ org, prisma }) => {
        const repositories = await prisma.repo.findMany({
            where: {
                orgId: org.id,
                id: { in: parsed.data.repoIds },
            },
            select: {
                id: true,
                indexedAt: true,
                indexedCommitHash: true,
                latestIndexingJobId: true,
            },
        });
        const jobIds = repositories.flatMap((repo) =>
            repo.latestIndexingJobId ? [repo.latestIndexingJobId] : [],
        );
        const jobs = await getBullMQClient().getJobs(
            REPO_INDEX_QUEUE,
            jobIds,
        );

        return {
            repositories: repositories.map((repo) => ({
                repoId: repo.id,
                indexedAt: repo.indexedAt?.toISOString() ?? null,
                indexedCommitHash: repo.indexedCommitHash,
                latestJob: repo.latestIndexingJobId
                    ? jobs.get(repo.latestIndexingJobId) ?? null
                    : null,
            })),
        } satisfies RepoIndexingStatusesResponse;
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
