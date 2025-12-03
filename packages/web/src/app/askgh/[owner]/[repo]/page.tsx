import { addGithubRepo } from "@/features/workerApi/actions";

interface PageProps {
    params: Promise<{ owner: string; repo: string }>;
}

export default async function GitHubRepoPage(props: PageProps) {
    const params = await props.params;
    const { owner, repo } = params;

    const response = await addGithubRepo(owner, repo);

    return <p>{JSON.stringify(response, null, 2)}</p>;
}


