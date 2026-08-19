import "server-only";

import { getBullMQClient } from "@/lib/bullmqClient";
import { __unsafePrisma } from "@/prisma";
import { REPO_INDEX_QUEUE } from "@sourcebot/shared";

export interface RepositorySyncCounts {
    firstTimeSyncingCount: number;
    failedCount: number;
    warningCount: number;
}

export const getRepositorySyncCounts = async (
    orgId: number,
): Promise<RepositorySyncCounts> => {
    const failedJobIds = await getBullMQClient().getFailedJobIds(
        REPO_INDEX_QUEUE,
    );

    const [
        firstTimeSyncingCount,
        failedCount,
        warningCount,
    ] = await Promise.all([
        __unsafePrisma.repo.count({
            where: {
                orgId,
                indexedAt: null,
                firstIndexingJobFinishedAt: null,
            },
        }),
        __unsafePrisma.repo.count({
            where: {
                orgId,
                latestIndexingJobId: { in: failedJobIds },
                indexedAt: null,
            },
        }),
        __unsafePrisma.repo.count({
            where: {
                orgId,
                latestIndexingJobId: { in: failedJobIds },
                indexedAt: { not: null },
            },
        }),
    ]);

    return {
        firstTimeSyncingCount,
        failedCount,
        warningCount,
    };
};
