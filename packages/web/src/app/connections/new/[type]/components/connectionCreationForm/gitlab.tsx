'use client';

import { GitLabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import CreationForm from "./creationForm";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";

const defaultConfig: GitLabConnectionConfig = {
    type: 'gitlab',
}

export const GitLabCreationForm = () => {
    return (
        <CreationForm<GitLabConnectionConfig>
            type="gitlab"
            title="Create a GitLab connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
                name: 'my-gitlab-connection',
            }}
            schema={gitlabSchema}
            quickActions={[
                {
                    fn: (previous: GitLabConnectionConfig) => ({
                        ...previous,
                        groups: [
                            ...previous.groups ?? [],
                            ""
                        ]
                    }),
                    name: "Add a group",
                },
                {
                    fn: (previous: GitLabConnectionConfig) => ({
                        ...previous,
                        url: previous.url ?? "",
                    }),
                    name: "Set a custom url",
                },
                {
                    fn: (previous: GitLabConnectionConfig) => ({
                        ...previous,
                        token: previous.token ?? {
                            secret: "",
                        },
                    }),
                    name: "Add a secret",
                },
                {
                    fn: (previous: GitLabConnectionConfig) => ({
                        ...previous,
                        projects: [
                            ...previous.projects ?? [],
                            ""
                        ]
                    }),
                    name: "Add a project",
                }
            ]}
        />
    )
}