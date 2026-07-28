import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { getBullMQClient } from "@/lib/bullmqClient";
import Link from "next/link";
import { ConnectionsList } from "./connectionsList";
import { CONNECTION_QUEUE } from "@sourcebot/shared";

const DOCS_URL = "https://docs.sourcebot.dev/docs/connections/indexing-your-code";

export default async function ConnectionsV2Page() {
    const connections = await getConnectionsWithCurrentStatus();
    if (isServiceError(connections)) {
        throw new ServiceErrorException(connections);
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">Code Host Connections</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Prototype
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    Monitor and sync your external code hosts.{" "}
                    <Link href={DOCS_URL} target="_blank" className="text-link hover:underline">
                        Learn more
                    </Link>
                </p>
            </div>

            <ConnectionsList data={connections} />
        </div>
    );
}

const getConnectionsWithCurrentStatus = async () => sew(() =>
    withAuth(async ({ prisma, org }) => {
        const connections = await prisma.connection.findMany({
            where: {
                orgId: org.id,
            },
            select: {
                id: true,
                name: true,
                connectionType: true,
                syncedAt: true,
                latestSyncJobId: true,
            },
            orderBy: {
                name: 'asc',
            },
        });

        return Promise.all(connections.map(async ({
            latestSyncJobId,
            ...connection
        }) => {
            const job = latestSyncJobId
                ? await getBullMQClient().getJob(CONNECTION_QUEUE, latestSyncJobId)
                : null;

            return {
                ...connection,
                currentJob: job
            };
        }));
    })
);
