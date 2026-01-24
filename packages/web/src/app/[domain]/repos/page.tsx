import { sew } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { ReposTable } from "./components/reposTable";
import { RepoIndexingJobStatus, Prisma } from "@sourcebot/db";
import z from "zod";

const numberSchema = z.coerce.number().int().positive();

const DEFAULT_PAGE_SIZE = 20;

interface ReposPageProps {
    searchParams: Promise<{
        page?: string;
        pageSize?: string;
        search?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: string;
    }>;
}

export default async function ReposPage(props: ReposPageProps) {
    const params = await props.searchParams;

    // Parse pagination parameters with defaults
    const page = numberSchema.safeParse(params.page).data ?? 1;
    const pageSize = numberSchema.safeParse(params.pageSize).data ?? DEFAULT_PAGE_SIZE;

    // Parse filter parameters
    const search = z.string().optional().safeParse(params.search).data ?? '';
    const status = z.enum(['all', 'none', 'COMPLETED', 'IN_PROGRESS', 'PENDING', 'FAILED']).safeParse(params.status).data ?? 'all';
    const sortBy = z.enum(['displayName', 'indexedAt']).safeParse(params.sortBy).data ?? undefined;
    const sortOrder = z.enum(['asc', 'desc']).safeParse(params.sortOrder).data ?? 'asc';

    // Calculate skip for pagination
    const skip = (page - 1) * pageSize;

    const _result = await getRepos({
        skip,
        take: pageSize,
        search,
        status,
        sortBy,
        sortOrder,
    });
    if (isServiceError(_result)) {
        throw new ServiceErrorException(_result);
    }

    const { repos, totalCount, stats } = _result;

    return (
        <>
            <div className="mb-6">
                <h1 className="text-3xl font-semibold">Repositories</h1>
                <p className="text-muted-foreground mt-2">View and manage your code repositories and their indexing status.</p>
            </div>
            <ReposTable
                data={repos.map((repo) => ({
                    id: repo.id,
                    name: repo.name,
                    displayName: repo.displayName ?? repo.name,
                    isArchived: repo.isArchived,
                    isPublic: repo.isPublic,
                    indexedAt: repo.indexedAt,
                    createdAt: repo.createdAt,
                    webUrl: repo.webUrl,
                    imageUrl: repo.imageUrl,
                    latestJobStatus: repo.latestIndexingJobStatus,
                    isFirstTimeIndex: repo.indexedAt === null,
                    codeHostType: repo.external_codeHostType,
                    indexedCommitHash: repo.indexedCommitHash,
                }))}
                currentPage={page}
                pageSize={pageSize}
                totalCount={totalCount}
                initialSearch={search}
                initialStatus={status}
                initialSortBy={sortBy}
                initialSortOrder={sortOrder}
                stats={stats}
            />
        </>
    )
}

interface GetReposParams {
    skip: number;
    take: number;
    search: string;
    status: 'all' | 'none' | 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'FAILED';
    sortBy?: 'displayName' | 'indexedAt';
    sortOrder: 'asc' | 'desc';
}

const getRepos = async ({ skip, take, search, status, sortBy, sortOrder }: GetReposParams) => sew(() =>
    withOptionalAuthV2(async ({ prisma }) => {
        const whereClause: Prisma.RepoWhereInput = {
            ...(search ? {
                displayName: { contains: search, mode: 'insensitive' },
            } : {}),
            latestIndexingJobStatus:
                status === 'all' ? undefined :
                status === 'none' ? null :
                status
        };

        // Build orderBy clause based on sortBy and sortOrder
        const orderByClause: Prisma.RepoOrderByWithRelationInput = {};

        if (sortBy === 'displayName') {
            orderByClause.displayName = sortOrder === 'asc' ? 'asc' : 'desc';
        } else if (sortBy === 'indexedAt') {
            orderByClause.indexedAt = sortOrder === 'asc' ? 'asc' : 'desc';
        } else {
            // Default to displayName asc
            orderByClause.displayName = 'asc';
        }

        const repos = await prisma.repo.findMany({
            skip,
            take,
            where: whereClause,
            orderBy: orderByClause,
        });

        // Calculate total count using the filtered where clause
        const totalCount = await prisma.repo.count({
            where: whereClause
        });

        // Status stats
        const [
            numCompleted,
            numFailed,
            numPending,
            numInProgress,
            numNoJobs
        ] = await Promise.all([
            prisma.repo.count({
                where: {
                    ...whereClause,
                    latestIndexingJobStatus: RepoIndexingJobStatus.COMPLETED,
                }
            }),
            prisma.repo.count({
                where: {
                    ...whereClause,
                    latestIndexingJobStatus: RepoIndexingJobStatus.FAILED,
                }
            }),
            prisma.repo.count({
                where: {
                    ...whereClause,
                    latestIndexingJobStatus: RepoIndexingJobStatus.PENDING,
                }
            }),
            prisma.repo.count({
                where: {
                    ...whereClause,
                    latestIndexingJobStatus: RepoIndexingJobStatus.IN_PROGRESS,
                }
            }),
            prisma.repo.count({
                where: {
                    ...whereClause,
                    latestIndexingJobStatus: null,
                }
            }),
        ])

        return {
            repos,
            totalCount,
            stats: {
                numCompleted,
                numFailed,
                numPending,
                numInProgress,
                numNoJobs,
            }
        };
    }));