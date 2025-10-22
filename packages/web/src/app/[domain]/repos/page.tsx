import { env } from "@/env.mjs";
import { RepoIndexingJob } from "@sourcebot/db";
import { Header } from "../components/header";
import { RepoStatus } from "./columns";
import { RepositoryTable } from "./repositoryTable";
import { sew } from "@/actions";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";

function getRepoStatus(repo: { indexedAt: Date | null, jobs: RepoIndexingJob[] }): RepoStatus {
    const latestJob = repo.jobs[0];
    
    if (latestJob?.status === 'PENDING' || latestJob?.status === 'IN_PROGRESS') {
        return 'syncing';
    }
    
    return repo.indexedAt ? 'indexed' : 'not-indexed';
}

export default async function ReposPage(props: { params: Promise<{ domain: string }> }) {
    const params = await props.params;

    const {
        domain
    } = params;

    const repos = await getReposWithJobs();
    if (isServiceError(repos)) {
        throw new ServiceErrorException(repos);
    }

    return (
        <div>
            <Header>
                <h1 className="text-3xl">Repositories</h1>
            </Header>
            <div className="px-6 py-6">
                <RepositoryTable 
                    repos={repos.map((repo) => ({
                        repoId: repo.id,
                        repoName: repo.name,
                        repoDisplayName: repo.displayName ?? repo.name,
                        imageUrl: repo.imageUrl ?? undefined,
                        indexedAt: repo.indexedAt ?? undefined,
                        status: getRepoStatus(repo),
                    }))}
                    domain={domain}
                    isAddReposButtonVisible={env.EXPERIMENT_SELF_SERVE_REPO_INDEXING_ENABLED === 'true'}
                />
            </div>
        </div>
    )
}

const getReposWithJobs = async () => sew(() =>
    withOptionalAuthV2(async ({ prisma }) => {
        const repos = await prisma.repo.findMany({
            include: {
                jobs: true,
            }
        });

        return repos;
    }));