import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type"
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { QuickAction } from "./components/configEditor";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { GerritConnectionConfig } from "@sourcebot/schemas/v3/gerrit.type";

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

export const gitlabQuickActions: QuickAction<GitlabConnectionConfig>[] = [
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            groups: [
                ...previous.groups ?? [],
                ""
            ]
        }),
        name: "Add a group",
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            url: previous.url ?? "",
        }),
        name: "Set a custom url",
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            token: previous.token ?? {
                secret: "",
            },
        }),
        name: "Add a secret",
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            projects: [
                ...previous.projects ?? [],
                ""
            ]
        }),
        name: "Add a project",
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            users: [
                ...previous.users ?? [],
                ""
            ]
        }),
        name: "Add a user",
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

export const gerritQuickActions: QuickAction<GerritConnectionConfig>[] = [
    {
        fn: (previous: GerritConnectionConfig) => ({
            ...previous,
            projects: [
                ...(previous.projects ?? []),
                ""
            ]
        }),
        name: "Add a project",
    },
    {
        fn: (previous: GerritConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                projects: [
                    ...(previous.exclude?.projects ?? []),
                    ""
                ]
            }
        }),
        name: "Exclude a project",
    }
]

