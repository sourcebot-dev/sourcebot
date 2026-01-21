import { addGithubRepo } from "@/features/workerApi/actions";
import { RepoStatusDisplay } from "./components/repoStatusDisplay";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { getRepoInfo } from "./api";

interface PageProps {
    params: Promise<{ owner: string; repo: string }>;
}

export default async function GitHubRepoPage(props: PageProps) {
    const params = await props.params;
    const { owner, repo } = params;

    const repoId = await (async () => {
        // 1. Look up repo by owner/repo
        const displayName = `${owner}/${repo}`;
        const existingRepo = await prisma.repo.findFirst({
            where: {
                orgId: SINGLE_TENANT_ORG_ID,
                displayName: displayName,
                external_codeHostType: 'github',
                external_codeHostUrl: 'https://github.com',
            },
        });

        if (existingRepo) {
            return existingRepo.id;
        }

        // 2. If it doesn't exist, attempt to create it
        const response = await addGithubRepo(owner, repo);

        if (isServiceError(response)) {
            throw new ServiceErrorException(response);
        }

        return response.repoId;
    })();

    const repoInfo = await unwrapServiceError(getRepoInfo(repoId));

    return <RepoStatusDisplay initialRepoInfo={repoInfo} />;
}
