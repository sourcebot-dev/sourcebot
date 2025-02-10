'use client';

import { giteaQuickActions, githubQuickActions, gitlabQuickActions } from "../../quickActions";
import ConnectionCreationForm from "./components/connectionCreationForm";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { giteaSchema } from "@sourcebot/schemas/v3/gitea.schema";
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

    if (type === 'gitea') {
        return <GiteaCreationForm />;
    }

    router.push('/connections');
}

const GitLabCreationForm = () => {
    const defaultConfig: GitlabConnectionConfig = {
        type: 'gitlab',
    }

    return (
        <ConnectionCreationForm<GitlabConnectionConfig>
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

const GiteaCreationForm = () => {
    const defaultConfig: GiteaConnectionConfig = {
        type: 'gitea',
    }

    return (
        <ConnectionCreationForm<GiteaConnectionConfig>
            type="gitea"
            title="Create a Gitea connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
                name: 'my-gitea-connection',
            }}
            schema={giteaSchema}
            quickActions={giteaQuickActions}
        />
    )

}