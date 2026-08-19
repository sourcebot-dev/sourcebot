import "server-only";

import { getBullMQClient } from "@/lib/bullmqClient";
import { __unsafePrisma } from "@/prisma";
import { CONNECTION_QUEUE } from "@sourcebot/shared";

export interface ConnectionSyncCounts {
    firstTimeSyncingCount: number;
    failedCount: number;
    warningCount: number;
}

export const getConnectionSyncCounts = async (
    orgId: number,
): Promise<ConnectionSyncCounts> => {
    const connections = await __unsafePrisma.connection.findMany({
        where: { orgId },
        select: {
            id: true,
            syncedAt: true,
            latestSyncJobId: true,
            firstSyncJobFinishedAt: true,
        },
    });
    const latestJobIds = connections.flatMap((connection) =>
        connection.latestSyncJobId ? [connection.latestSyncJobId] : []
    );
    const latestJobs = await getBullMQClient().getJobs(
        CONNECTION_QUEUE,
        latestJobIds,
    );

    return connections.reduce<ConnectionSyncCounts>((counts, connection) => {
        if (
            connection.syncedAt === null
            && connection.firstSyncJobFinishedAt === null
        ) {
            counts.firstTimeSyncingCount += 1;
        }

        const latestJob = connection.latestSyncJobId
            ? latestJobs.get(connection.latestSyncJobId)
            : null;
        if (!latestJob || latestJob.data.connectionId !== connection.id) {
            return counts;
        }

        if (latestJob.status === "FAILED") {
            if (connection.syncedAt) {
                counts.warningCount += 1;
            } else {
                counts.failedCount += 1;
            }
        } else if (
            latestJob.status === "COMPLETED"
            && latestJob.result?.outcome === "PARTIAL_SUCCESS"
        ) {
            counts.warningCount += 1;
        }

        return counts;
    }, { firstTimeSyncingCount: 0, failedCount: 0, warningCount: 0 });
};
