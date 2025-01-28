'use client';

import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import CreationForm from "./creationForm";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";

const defaultConfig: GithubConnectionConfig = {
    type: 'github',
}

export const GitHubCreationForm = () => {
    return (
        <CreationForm<GithubConnectionConfig>
            type="github"
            title="Create a GitHub connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
                name: 'my-github-connection',
            }}
            schema={githubSchema}
            quickActions={[
                {
                    fn: (previous: GithubConnectionConfig) => ({
                        ...previous,
                        orgs: [
                            ...(previous.orgs ?? []),
                            ""
                        ]
                    }),
                    name: "Add an organization",
                },
                {
                    fn: (previous: GithubConnectionConfig) => ({
                        ...previous,
                        url: previous.url ?? "",
                    }),
                    name: "Set a custom url",
                },
                {
                    fn: (previous: GithubConnectionConfig) => ({
                        ...previous,
                        repos: [
                            ...(previous.orgs ?? []),
                            ""
                        ]
                    }),
                    name: "Add a repo",
                },
                {
                    fn: (previous: GithubConnectionConfig) => ({
                        ...previous,
                        token: previous.token ?? {
                            secret: "",
                        },
                    }),
                    name: "Add a secret",
                }
            ]}
        />
    )
}