import "server-only";

import { getBullMQClient } from "@/lib/bullmqClient";
import { withOptionalAuth } from "@/middleware/withAuth";
import { OrgRole } from "@sourcebot/db";
import { REPO_INDEX_QUEUE } from "@sourcebot/shared";
import { cache } from "react";

export interface RepositorySyncCounts {
    firstTimeSyncingCount: number;
    failedCount: number;
    warningCount: number;
}

export const getRepositorySyncCounts = cache(async () =>
    withOptionalAuth(async ({ org, prisma, role }) => {
        const firstTimeSyncingCount = await prisma.repo.count({
            where: {
                orgId: org.id,
                indexedAt: null,
                firstIndexingJobFinishedAt: null,
            },
        });

        if (role !== OrgRole.OWNER) {
            return {
                firstTimeSyncingCount,
                failedCount: 0,
                warningCount: 0,
            };
        }

        const failedJobIds = await getBullMQClient().getFailedJobIds(
            REPO_INDEX_QUEUE,
        );
        const [failedCount, warningCount] = await Promise.all([
            prisma.repo.count({
                where: {
                    orgId: org.id,
                    latestIndexingJobId: { in: failedJobIds },
                    indexedAt: null,
                },
            }),
            prisma.repo.count({
                where: {
                    orgId: org.id,
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
    }));
