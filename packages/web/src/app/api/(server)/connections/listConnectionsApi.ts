import 'server-only';

import { ConnectionSyncJobStatus } from '@sourcebot/db';
import { withAuth } from '@/middleware/withAuth';
import { sew } from '@/middleware/sew';

export interface ListConnectionsParams {
    page: number;
    perPage: number;
}

export const listConnections = async (
    { page, perPage }: ListConnectionsParams,
) => sew(() =>
    withAuth(async ({ prisma, org }) => {
        const skip = (page - 1) * perPage;

        const [connections, totalCount] = await Promise.all([
            prisma.connection.findMany({
                where: { orgId: org.id },
                orderBy: { name: 'asc' },
                skip,
                take: perPage,
                include: {
                    _count: {
                        select: {
                            repos: true,
                        },
                    },
                    syncJobs: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            }),
            prisma.connection.count({ where: { orgId: org.id } }),
        ]);

        // Count in-flight jobs (PENDING + IN_PROGRESS) per connection in
        // a single grouped query rather than N+1 small counts.
        const inFlightByConnection = await prisma.connectionSyncJob.groupBy({
            by: ['connectionId'],
            where: {
                connectionId: { in: connections.map((c) => c.id) },
                status: {
                    in: [ConnectionSyncJobStatus.PENDING, ConnectionSyncJobStatus.IN_PROGRESS],
                },
            },
            _count: { _all: true },
        });
        const inFlightMap = new Map(
            inFlightByConnection.map((row) => [row.connectionId, row._count._all]),
        );

        return {
            data: connections.map((connection) => {
                const latestJob = connection.syncJobs[0] ?? null;
                return {
                    id: connection.id,
                    name: connection.name,
                    connectionType: connection.connectionType,
                    isDeclarative: connection.isDeclarative,
                    syncedAt: connection.syncedAt,
                    createdAt: connection.createdAt,
                    updatedAt: connection.updatedAt,
                    repoCount: connection._count.repos,
                    inFlightJobCount: inFlightMap.get(connection.id) ?? 0,
                    latestJob: latestJob
                        ? {
                            id: latestJob.id,
                            status: latestJob.status,
                            createdAt: latestJob.createdAt,
                            completedAt: latestJob.completedAt,
                            errorMessage: latestJob.errorMessage,
                        }
                        : null,
                };
            }),
            totalCount,
        };
    }),
);
