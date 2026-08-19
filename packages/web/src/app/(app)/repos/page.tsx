import { getBullMQClient } from "@/lib/bullmqClient";
import {
    authenticatedPage,
    type OptionalAuthOptions,
} from "@/middleware/authenticatedPage";
import {
    REPO_INDEX_QUEUE,
    type WorkloadJob,
} from "@sourcebot/shared";
import { getRepositorySyncCounts } from "@/features/repos/repositorySyncCounts.server";
import { isServiceError } from "@/lib/utils";
import { OrgRole, type Prisma } from "@sourcebot/db";
import { z } from "zod";
import { ReposTable } from "./components/reposTable";

const DEFAULT_PAGE_SIZE = 20;
const pageSchema = z.coerce.number().int().positive();
const sortBySchema = z.enum(["name", "indexedAt"]);
const sortOrderSchema = z.enum(["asc", "desc"]);
const statusSchema = z.enum(["failed", "warning"]);

type ReposPageProps = {
    searchParams: Promise<{
        page?: string;
        search?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: string;
    }>;
};

export default authenticatedPage<
    ReposPageProps,
    OptionalAuthOptions
>(async ({ org, prisma, role }, { searchParams }) => {
    const params = await searchParams;
    const page = pageSchema.safeParse(params.page).data ?? 1;
    const search = z.string().optional().safeParse(params.search).data?.trim() ?? "";
    const status = statusSchema.safeParse(params.status).data ?? "all";
    const sortBy = sortBySchema.safeParse(params.sortBy).data ?? "name";
    const sortOrder = sortOrderSchema.safeParse(params.sortOrder).data ?? "asc";
    const canRetry = role === OrgRole.OWNER;
    const skip = (page - 1) * DEFAULT_PAGE_SIZE;
    const orderBy = sortBy === "indexedAt"
        ? [{ indexedAt: sortOrder }, { id: "asc" as const }]
        : [{ displayName: sortOrder }, { id: "asc" as const }];
    const failedJobIds = status === "all"
        ? []
        : await getBullMQClient().getFailedJobIds(REPO_INDEX_QUEUE);
    const repositorySyncCounts = canRetry
        ? await getRepositorySyncCounts()
        : null;
    const retryableCount = repositorySyncCounts
        && !isServiceError(repositorySyncCounts)
        ? repositorySyncCounts.failedCount + repositorySyncCounts.warningCount
        : 0;
    const where: Prisma.RepoWhereInput = {
        orgId: org.id,
        ...(search
            ? {
                  displayName: {
                      contains: search,
                      mode: "insensitive" as const,
                  },
              }
            : {}),
        ...(status === "all"
            ? {}
            : {
                  latestIndexingJobId: { in: failedJobIds },
                  indexedAt: status === "failed" ? null : { not: null },
        }),
    };

    const [repos, totalCount] = await Promise.all([
        prisma.repo.findMany({
            where,
            orderBy,
            skip,
            take: DEFAULT_PAGE_SIZE,
            select: {
                id: true,
                name: true,
                displayName: true,
                indexedAt: true,
                indexedCommitHash: true,
                latestIndexingJobId: true,
                imageUrl: true,
                webUrl: true,
                external_codeHostType: true,
            },
        }),
        prisma.repo.count({
            where,
        }),
    ]);
    const latestJobIds = repos.flatMap((repo) =>
        repo.latestIndexingJobId ? [repo.latestIndexingJobId] : [],
    );
    let latestJobs = new Map<string, WorkloadJob<"repo-index"> | null>();
    try {
        latestJobs = await getBullMQClient().getJobs(
            REPO_INDEX_QUEUE,
            latestJobIds,
        );
    } catch (error) {
        console.error("Failed to load latest repository indexing jobs", error);
    }

    return (
        <div className="flex flex-col h-full max-w-6xl mx-auto p-4">
            <div className="flex flex-col gap-4 p-6 pb-2 flex-shrink-0">
                <h3 className="text-lg font-medium">Repositories</h3>
            </div>
            <div className="px-6">
                <ReposTable
                    data={repos.map((repo) => ({
                        id: repo.id,
                        name: repo.name,
                        displayName: repo.displayName,
                        indexedAt: repo.indexedAt,
                        indexedCommitHash: repo.indexedCommitHash,
                        latestJob: repo.latestIndexingJobId
                            ? latestJobs.get(repo.latestIndexingJobId) ?? null
                            : null,
                        imageUrl: repo.imageUrl,
                        webUrl: repo.webUrl,
                        codeHostType: repo.external_codeHostType,
                    }))}
                    currentPage={page}
                    pageSize={DEFAULT_PAGE_SIZE}
                    totalCount={totalCount}
                    canRetry={canRetry}
                    retryableCount={retryableCount}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                />
            </div>
        </div>
    );
}, { allowAnonymous: true });
