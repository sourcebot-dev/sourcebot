import { sew } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { ReposTable } from "./components/reposTable";
import { RepoIndexingJobStatus } from "@sourcebot/db";

export default async function ReposPage() {

    const _repos = await getReposWithLatestJob();
    if (isServiceError(_repos)) {
        throw new ServiceErrorException(_repos);
    }

    const repos = _repos
        .map((repo) => ({
            ...repo,
            latestJobStatus: repo.jobs.length > 0 ? repo.jobs[0].status : null,
            isFirstTimeIndex: repo.indexedAt === null && repo.jobs.filter((job) => job.status === RepoIndexingJobStatus.PENDING || job.status === RepoIndexingJobStatus.IN_PROGRESS).length > 0,
        }))
        .sort((a, b) => {
            if (a.isFirstTimeIndex && !b.isFirstTimeIndex) {
                return -1;
            }
            if (!a.isFirstTimeIndex && b.isFirstTimeIndex) {
                return 1;
            }
            return a.name.localeCompare(b.name);
        });

    return (
        <>
            <div className="mb-6">
                <h1 className="text-3xl font-semibold">Repositories</h1>
                <p className="text-muted-foreground mt-2">View and manage your code repositories and their indexing status.</p>
            </div>
            <ReposTable data={repos.map((repo) => ({
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
            }))} />
        </>
    )
}

const getReposWithLatestJob = async () => sew(() =>
    withOptionalAuthV2(async ({ prisma, org }) => {
        const repos = await prisma.repo.findMany({
            include: {
                jobs: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            },
            orderBy: {
                name: 'asc'
            },
            where: {
                orgId: org.id,
            }
        });
        return repos;
    }));