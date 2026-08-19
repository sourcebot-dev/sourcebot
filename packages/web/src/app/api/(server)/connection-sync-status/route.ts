import type { ConnectionSyncStatusesResponse } from "@/app/(app)/settings/connectionsv2/types";
import { apiHandler } from "@/lib/apiHandler";
import { getBullMQClient } from "@/lib/bullmqClient";
import {
    requestBodySchemaValidationError,
    serviceErrorResponse,
} from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuth } from "@/middleware/withAuth";
import { CONNECTION_QUEUE } from "@sourcebot/shared";
import { z } from "zod";

const requestSchema = z.object({
    connectionIds: z.array(z.number().int().positive()).min(1).max(100),
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
        const connections = await prisma.connection.findMany({
            where: {
                orgId: org.id,
                id: { in: parsed.data.connectionIds },
            },
            select: {
                id: true,
                syncedAt: true,
                latestSyncJobId: true,
            },
        });
        const jobIds = connections.flatMap((connection) =>
            connection.latestSyncJobId ? [connection.latestSyncJobId] : []
        );
        const jobs = await getBullMQClient().getJobs(
            CONNECTION_QUEUE,
            jobIds,
        );

        return {
            connections: connections.map((connection) => ({
                connectionId: connection.id,
                syncedAt: connection.syncedAt?.toISOString() ?? null,
                latestJob: connection.latestSyncJobId
                    ? jobs.get(connection.latestSyncJobId) ?? null
                    : null,
            })),
        } satisfies ConnectionSyncStatusesResponse;
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
