import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type"
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { QuickAction } from "../components/configEditor";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { GerritConnectionConfig } from "@sourcebot/schemas/v3/gerrit.type";
import { cn } from "@/lib/utils";

const Code = ({ children, className, title }: { children: React.ReactNode, className?: string, title?: string }) => {
    return (
        <code
            className={cn("bg-gray-100 dark:bg-gray-700 w-fit rounded-md font-mono px-2 py-0.5", className)}
            title={title}
        >
            {children}
        </code>
    )
}

export const githubQuickActions: QuickAction<GithubConnectionConfig>[] = [
    {
        fn: (previous: GithubConnectionConfig) => ({
            ...previous,
            url: previous.url ?? "",
        }),
        name: "Set a custom url",
        description: <span>Set a custom GitHub host. Defaults to <Code>https://github.com</Code>.</span>
    },
    {
        fn: (previous: GithubConnectionConfig) => ({
            ...previous,
            orgs: [
                ...(previous.orgs ?? []),
                ""
            ]
        }),
        name: "Add an organization",
        description: (
            <div className="flex flex-col">
                <span>Add an organization to sync with. All repositories in the organization visible to the provided <Code>token</Code> (if any) will be synced.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-row gap-1 items-center">
                    {[
                        "commaai",
                        "sourcebot",
                        "vercel"
                    ].map((org) => (
                        <Code key={org}>{org}</Code>
                    ))}
                </div>
            </div>
        )
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
        description: (
            <div className="flex flex-col">
                <span>Add a individual repository to sync with. Ensure the repository is visible to the provided <Code>token</Code> (if any).</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "sourcebot/sourcebot",
                        "vercel/next.js",
                        "torvalds/linux"
                    ].map((repo) => (
                        <Code key={repo}>{repo}</Code>
                    ))}
                </div>
            </div>
        )
    },
    {
        fn: (previous: GithubConnectionConfig) => ({
            ...previous,
            users: [
                ...(previous.users ?? []),
                ""
            ]
        }),
        name: "Add a user",
        description: <span>Add a user to sync with. All repositories that the user owns visible to the provided <Code>token</Code> (if any) will be synced.</span>
    },
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
