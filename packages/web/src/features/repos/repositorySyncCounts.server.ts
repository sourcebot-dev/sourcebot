import "server-only";

import { getBullMQClient } from "@/lib/bullmqClient";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { REPO_INDEX_QUEUE } from "@sourcebot/shared";
import { cache } from "react";

export interface RepositorySyncCounts {
    firstTimeSyncingCount: number;
    failedCount: number;
    warningCount: number;
}

export const getRepositorySyncCounts = cache(async () =>
    withAuth(({ org, prisma, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const failedJobIds = await getBullMQClient().getFailedJobIds(
                REPO_INDEX_QUEUE,
            );

            const [
                firstTimeSyncingCount,
                failedCount,
                warningCount,
            ] = await Promise.all([
                prisma.repo.count({
                    where: {
                        orgId: org.id,
                        indexedAt: null,
                        firstIndexingJobFinishedAt: null,
                    },
                }),
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
        })
    ));
