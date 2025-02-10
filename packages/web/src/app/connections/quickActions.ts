import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type"
import { GitLabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { QuickAction } from "./components/configEditor";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/connection.type";

export const githubQuickActions: QuickAction<GithubConnectionConfig>[] = [
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
                ...(previous.repos ?? []),
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
];

export const gitlabQuickActions: QuickAction<GitLabConnectionConfig>[] = [
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
]

export const giteaQuickActions: QuickAction<GiteaConnectionConfig>[] = [
    {
        fn: (previous: GiteaConnectionConfig) => ({
            ...previous,
            orgs: [
                ...(previous.orgs ?? []),
                ""
            ]
        }),
        name: "Add an organization",
    },
    {
        fn: (previous: GiteaConnectionConfig) => ({
            ...previous,
            url: previous.url ?? "",
        }),
        name: "Set a custom url",
    },
    {
        fn: (previous: GiteaConnectionConfig) => ({
            ...previous,
            repos: [
                ...(previous.repos ?? []),
                ""
            ]
        }),
        name: "Add a repo",
    },
    {
        fn: (previous: GiteaConnectionConfig) => ({
            ...previous,
            token: previous.token ?? {
                secret: "",
            },
        }),
        name: "Add a secret",
    }
]

