import { sew } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { CodeHostType, isServiceError } from "@/lib/utils";
import { withAuthV2 } from "@/withAuthV2";
import Link from "next/link";
import { ConnectionsTable } from "./components/connectionsTable";

const DOCS_URL = "https://docs.sourcebot.dev/docs/connections/overview";

export default async function ConnectionsPage() {
    const connections = await getConnectionsWithLatestJob();
    if (isServiceError(connections)) {
        throw new ServiceErrorException(connections);
    }

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
                latestJobStatus: connection.syncJobs.length > 0 ? connection.syncJobs[0].status : null,
            }))} />
        </div>
    )
}

const getConnectionsWithLatestJob = async () => sew(() =>
    withAuthV2(async ({ prisma }) => {
        const connections = await prisma.connection.findMany({
            include: {
                syncJobs: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        return connections;
    }));