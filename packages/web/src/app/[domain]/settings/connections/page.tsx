import { sew } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { CodeHostType, isServiceError } from "@/lib/utils";
import { withAuthV2 } from "@/withAuthV2";
import Link from "next/link";
import { ConnectionsTable } from "./components/connectionsTable";
import { ConnectionSyncJobStatus } from "@prisma/client";

const DOCS_URL = "https://docs.sourcebot.dev/docs/connections/overview";

export default async function ConnectionsPage() {
    const _connections = await getConnectionsWithLatestJob();
    if (isServiceError(_connections)) {
        throw new ServiceErrorException(_connections);
    }

    // Sort connections so that first time syncs are at the top.
    const connections = _connections
        .map((connection) => ({
            ...connection,
            isFirstTimeSync: connection.syncedAt === null && connection.syncJobs.filter((job) => job.status === ConnectionSyncJobStatus.PENDING || job.status === ConnectionSyncJobStatus.IN_PROGRESS).length > 0,
            latestJobStatus: connection.syncJobs.length > 0 ? connection.syncJobs[0].status : null,
        }))
        .sort((a, b) => {
            if (a.isFirstTimeSync && !b.isFirstTimeSync) {
                return -1;
            }
            if (!a.isFirstTimeSync && b.isFirstTimeSync) {
                return 1;
            }
            return a.name.localeCompare(b.name);
        });

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Code Host Connections</h3>
                <p className="text-sm text-muted-foreground">Manage your connections to external code hosts. <Link href={DOCS_URL} target="_blank" className="text-link hover:underline">Learn more</Link></p>
            </div>
            <ConnectionsTable data={connections.map((connection) => ({
                id: connection.id,
                name: connection.name,
                codeHostType: connection.connectionType as CodeHostType,
                syncedAt: connection.syncedAt,
                latestJobStatus: connection.latestJobStatus,
                isFirstTimeSync: connection.isFirstTimeSync,
            }))} />
        </div>
    )
}

const getConnectionsWithLatestJob = async () => sew(() =>
    withAuthV2(async ({ prisma }) => {
        const connections = await prisma.connection.findMany({
            include: {
                _count: {
                    select: {
                        syncJobs: true,
                    }
                },
                syncJobs: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                },
            },
            orderBy: {
                name: 'asc'
            },
        });

        return connections;
    }));