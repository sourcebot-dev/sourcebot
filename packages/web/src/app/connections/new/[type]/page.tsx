'use client';

import { githubQuickActions, gitlabQuickActions } from "../../quickActions";
import ConnectionCreationForm from "./components/connectionCreationForm";
import { GitLabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { useRouter } from "next/navigation";

export default function NewConnectionPage({
    params
}: { params: { type: string } }) {
    const { type } = params;
    const router = useRouter();

    if (type === 'github') {
        return <GitHubCreationForm />;
    }

    if (type === 'gitlab') {
        return <GitLabCreationForm />;
    }

    router.push('/connections');
}

const GitLabCreationForm = () => {
    const defaultConfig: GitLabConnectionConfig = {
        type: 'gitlab',
    }

    return (
        <ConnectionCreationForm<GitLabConnectionConfig>
            type="gitlab"
            title="Create a GitLab connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
                name: 'my-gitlab-connection',
            }}
            schema={gitlabSchema}
            quickActions={gitlabQuickActions}
        />
    )
}

const GitHubCreationForm = () => {
    const defaultConfig: GithubConnectionConfig = {
        type: 'github',
    }

    return (
        <ConnectionCreationForm<GithubConnectionConfig>
            type="github"
            title="Create a GitHub connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
                name: 'my-github-connection',
            }}
            schema={githubSchema}
            quickActions={githubQuickActions}
        />
    )
}