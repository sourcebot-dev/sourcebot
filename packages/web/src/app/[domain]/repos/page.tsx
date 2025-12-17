import { sew } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { ReposTable } from "./components/reposTable";
import { RepoIndexingJobStatus, Prisma } from "@sourcebot/db";

interface ReposPageProps {
    searchParams: Promise<{
        page?: string;
        pageSize?: string;
        search?: string;
        status?: string;
    }>;
}

export default async function ReposPage({ searchParams }: ReposPageProps) {
    const params = await searchParams;
    
    // Parse pagination parameters with defaults
    const page = parseInt(params.page ?? '1', 10);
    const pageSize = parseInt(params.pageSize ?? '5', 10);
    
    // Parse filter parameters
    const search = params.search ?? '';
    const status = params.status ?? 'all';

    // Calculate skip for pagination
    const skip = (page - 1) * pageSize;

    const _result = await getReposWithLatestJob({
        skip,
        take: pageSize,
        search,
        status,
    });
    if (isServiceError(_result)) {
        throw new ServiceErrorException(_result);
    }

    const { repos: _repos, totalCount } = _result;

    const repos = _repos.map((repo) => ({
        ...repo,
        latestJobStatus: repo.jobs.length > 0 ? repo.jobs[0].status : null,
        isFirstTimeIndex: repo.indexedAt === null && repo.jobs.filter((job: { status: RepoIndexingJobStatus }) => job.status === RepoIndexingJobStatus.PENDING || job.status === RepoIndexingJobStatus.IN_PROGRESS).length > 0,
    }));

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
                    latestJobStatus: repo.latestJobStatus,
                    isFirstTimeIndex: repo.isFirstTimeIndex,
                    codeHostType: repo.external_codeHostType,
                    indexedCommitHash: repo.indexedCommitHash,
                }))}
                currentPage={page}
                pageSize={pageSize}
                totalCount={totalCount}
                initialSearch={search}
                initialStatus={status}
            />
        </>
    )
}

interface GetReposParams {
    skip: number;
    take: number;
    search: string;
    status: string;
}

const getReposWithLatestJob = async ({ skip, take, search, status }: GetReposParams) => sew(() =>
    withOptionalAuthV2(async ({ prisma, org }) => {
        const whereClause: Prisma.RepoWhereInput = {
            orgId: org.id,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { displayName: { contains: search, mode: 'insensitive' } }
                ]
            }),
        };

        const repos = await prisma.repo.findMany({
            skip,
            take,
            where: whereClause,
            include: {
                jobs: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            },
            orderBy: [
                { indexedAt: 'asc' }, // null first (never indexed)
                { name: 'asc' }       // then alphabetically
            ]
        });

        // Calculate total count using the filtered where clause
        const totalCount = await prisma.repo.count({
            where: whereClause
        });


        return {
            repos,
            totalCount
        };
    }));