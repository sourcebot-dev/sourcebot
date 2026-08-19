import { getBullMQClient } from "@/lib/bullmqClient";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole, type Prisma } from "@sourcebot/db";
import {
    CONNECTION_QUEUE,
    type WorkloadJob,
} from "@sourcebot/shared";
import Link from "next/link";
import { z } from "zod";
import { ConnectionsTable } from "./components/connectionsTable";

const DOCS_URL = "https://docs.sourcebot.dev/docs/connections/indexing-your-code";
const DEFAULT_PAGE_SIZE = 20;
const pageSchema = z.coerce.number().int().positive();
const sortBySchema = z.enum(["name", "syncedAt"]);
const sortOrderSchema = z.enum(["asc", "desc"]);
const statusSchema = z.enum(["failed", "warning"]);

type ConnectionsPageProps = {
    searchParams: Promise<{
        page?: string;
        search?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: string;
    }>;
};

export default authenticatedPage<ConnectionsPageProps>(async (
    { org, prisma },
    { searchParams },
) => {
    const params = await searchParams;
    const page = pageSchema.safeParse(params.page).data ?? 1;
    const search = z.string().optional().safeParse(params.search).data?.trim()
        ?? "";
    const status = statusSchema.safeParse(params.status).data ?? "all";
    const sortBy = sortBySchema.safeParse(params.sortBy).data ?? "name";
    const sortOrder = sortOrderSchema.safeParse(params.sortOrder).data ?? "asc";
    const skip = (page - 1) * DEFAULT_PAGE_SIZE;
    const baseWhere: Prisma.ConnectionWhereInput = {
        orgId: org.id,
        ...(search
            ? {
                  name: {
                      contains: search,
                      mode: "insensitive" as const,
                  },
              }
            : {}),
    };
    let where = baseWhere;
    let latestJobs = new Map<
        string,
        WorkloadJob<"connection-sync"> | null
    >();
    if (status !== "all") {
        const candidates = await prisma.connection.findMany({
            where: baseWhere,
            select: {
                id: true,
                syncedAt: true,
                latestSyncJobId: true,
            },
        });
        const candidateJobIds = candidates.flatMap((connection) =>
            connection.latestSyncJobId ? [connection.latestSyncJobId] : []
        );
        latestJobs = await getBullMQClient().getJobs(
            CONNECTION_QUEUE,
            candidateJobIds,
        );
        const matchingConnectionIds = candidates.flatMap((connection) => {
            if (!connection.latestSyncJobId) {
                return [];
            }

            const job = latestJobs.get(connection.latestSyncJobId);
            const matches = status === "failed"
                ? job?.status === "FAILED" && connection.syncedAt === null
                : (job?.status === "FAILED" && connection.syncedAt !== null)
                    || (job?.status === "COMPLETED"
                        && job.result?.outcome === "PARTIAL_SUCCESS");
            return matches ? [connection.id] : [];
        });
        where = {
            ...baseWhere,
            id: { in: matchingConnectionIds },
        };
    }
    const orderBy: Prisma.ConnectionOrderByWithRelationInput[] = sortBy === "syncedAt"
        ? [{ syncedAt: sortOrder }, { id: "asc" }]
        : [{ name: sortOrder }, { id: "asc" }];

    const [connections, totalCount] = await Promise.all([
        prisma.connection.findMany({
            where,
            orderBy,
            skip,
            take: DEFAULT_PAGE_SIZE,
            select: {
                id: true,
                name: true,
                connectionType: true,
                syncedAt: true,
                latestSyncJobId: true,
            },
        }),
        prisma.connection.count({ where }),
    ]);
    const latestJobIds = connections.flatMap((connection) =>
        connection.latestSyncJobId ? [connection.latestSyncJobId] : []
    );
    if (status === "all") {
        try {
            latestJobs = await getBullMQClient().getJobs(
                CONNECTION_QUEUE,
                latestJobIds,
            );
        } catch (error) {
            console.error("Failed to load latest connection sync jobs", error);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Code Host Connections</h3>
                <p className="text-sm text-muted-foreground">
                    Manage connections to external code hosts.{" "}
                    <Link
                        href={DOCS_URL}
                        target="_blank"
                        className="text-link hover:underline"
                    >
                        Learn more
                    </Link>
                </p>
            </div>
            <ConnectionsTable
                data={connections.map((connection) => ({
                    id: connection.id,
                    name: connection.name,
                    connectionType: connection.connectionType,
                    syncedAt: connection.syncedAt,
                    latestJob: connection.latestSyncJobId
                        ? latestJobs.get(connection.latestSyncJobId) ?? null
                        : null,
                }))}
                currentPage={page}
                pageSize={DEFAULT_PAGE_SIZE}
                totalCount={totalCount}
                sortBy={sortBy}
                sortOrder={sortOrder}
            />
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: "/settings",
});
