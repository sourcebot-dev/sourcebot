import 'server-only';

import { ConnectionSyncJobStatus } from '@sourcebot/db';
import { withAuth } from '@/middleware/withAuth';
import { sew } from '@/middleware/sew';

export interface GetConnectionParams {
    id: number;
    jobLimit: number;
}

// Shape a single sync-job row the way the public OpenAPI exposes it:
// an explicit `durationMs` derived from createdAt/completedAt so callers
// don't have to compute it client-side, plus the warning list and
// error verbatim. Used for both the embedded `latestJob` and each
// element of `recentJobs`.
const toConnectionJob = (job: {
    id: string;
    status: ConnectionSyncJobStatus;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
    warningMessages: string[];
}) => ({
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    durationMs: job.completedAt
        ? job.completedAt.getTime() - job.createdAt.getTime()
        : null,
    errorMessage: job.errorMessage,
    warningMessages: job.warningMessages,
});

export const getConnection = async (
    { id, jobLimit }: GetConnectionParams,
) => sew(() =>
    withAuth(async ({ prisma, org }) => {
        // Scope by orgId so a request for a connection in another org
        // returns 404 (not 403). This avoids leaking the existence of
        // connections in other orgs.
        const connection = await prisma.connection.findFirst({
            where: { id, orgId: org.id },
            include: {
                _count: { select: { repos: true } },
            },
        });

        if (!connection) {
            return null;
        }

        const [recentJobs, inFlightRows] = await Promise.all([
            prisma.connectionSyncJob.findMany({
                where: { connectionId: id },
                orderBy: { createdAt: 'desc' },
                take: jobLimit,
            }),
            prisma.connectionSyncJob.groupBy({
                by: ['connectionId'],
                where: {
                    connectionId: id,
                    status: {
                        in: [ConnectionSyncJobStatus.PENDING, ConnectionSyncJobStatus.IN_PROGRESS],
                    },
                },
                _count: { _all: true },
            }),
        ]);

        return {
            data: {
                connection: {
                    id: connection.id,
                    name: connection.name,
                    connectionType: connection.connectionType,
                    isDeclarative: connection.isDeclarative,
                    syncedAt: connection.syncedAt,
                    createdAt: connection.createdAt,
                    updatedAt: connection.updatedAt,
                    repoCount: connection._count?.repos ?? 0,
                    inFlightJobCount: inFlightRows[0]?._count._all ?? 0,
                    latestJob: recentJobs[0] ? toConnectionJob(recentJobs[0]) : null,
                },
                recentJobs: recentJobs.map(toConnectionJob),
            },
        };
    }),
);
