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
            repos: [
                ...(previous.repos ?? []),
                "<owner>/<repo name>"
            ]
        }),
        name: "Add a single repo",
        selectionText: "<owner>/<repo name>",
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
            orgs: [
                ...(previous.orgs ?? []),
                "<organization name>"
            ]
        }),
        name: "Add an organization",
        selectionText: "<organization name>",
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
            users: [
                ...(previous.users ?? []),
                "<username>"
            ]
        }),
        name: "Add a user",
        selectionText: "<username>",
        description: (
            <div className="flex flex-col">
                <span>Add a user to sync with. All repositories that the user owns visible to the provided <Code>token</Code> (if any) will be synced.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-row gap-1 items-center">
                    {[
                        "jane-doe",
                        "torvalds",
                        "octocat"
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
            url: previous.url ?? "https://github.example.com",
        }),
        name: "Set a custom url",
        selectionText: "https://github.example.com",
        description: <span>Set a custom GitHub host. Defaults to <Code>https://github.com</Code>.</span>
    },
    {
        fn: (previous: GithubConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                repos: [
                    ...(previous.exclude?.repos ?? []),
                    "<glob pattern>"
                ]
            }
        }),
        name: "Exclude by repo name",
        selectionText: "<glob pattern>",
        description: (
            <div className="flex flex-col">
                <span>Exclude repositories from syncing by name. Glob patterns are supported.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "my-org/docs*",
                        "my-org/test*"
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
            exclude: {
                ...previous.exclude,
                topics: [
                    ...(previous.exclude?.topics ?? []),
                    "<topic>"
                ]
            }
        }),
        name: "Exclude by topic",
        selectionText: "<topic>",
        description: (
            <div className="flex flex-col">
                <span>Exclude topics from syncing. Only repos that do not match any of the provided topics will be synced. Glob patterns are supported.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "docs",
                        "ci"
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
            topics: [
                ...(previous.topics ?? []),
                "<topic>"
            ]
        }),
        name: "Include by topic",
        selectionText: "<topic>",
        description: (
            <div className="flex flex-col">
                <span>Include repositories by topic. Only repos that match at least one of the provided topics will be synced. Glob patterns are supported.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "docs",
                        "ci"
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
            exclude: {
                ...previous.exclude,
                archived: true,
            }
        }),
        name: "Exclude archived repos",
        description: <span>Exclude archived repositories from syncing.</span>
    },
    {
        fn: (previous: GithubConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                forks: true,
            }
        }),
        name: "Exclude forked repos",
        description: <span>Exclude forked repositories from syncing.</span>
    }
];

export const gitlabQuickActions: QuickAction<GitlabConnectionConfig>[] = [
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            projects: [
                ...previous.projects ?? [],
                ""
            ]
        }),
        name: "Add a project",
        description: (
            <div className="flex flex-col">
                <span>Add a individual project to sync with. Ensure the project is visible to the provided <Code>token</Code> (if any).</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "gitlab-org/gitlab",
                        "corp/team-project",
                    ].map((repo) => (
                        <Code key={repo}>{repo}</Code>
                    ))}
                </div>
            </div>
        )
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
        description: (
            <div className="flex flex-col">
                <span>Add a user to sync with. All projects that the user owns visible to the provided <Code>token</Code> (if any) will be synced.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-row gap-1 items-center">
                    {[
                        "jane-doe",
                        "torvalds"
                    ].map((org) => (
                        <Code key={org}>{org}</Code>
                    ))}
                </div>
            </div>
        )
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            groups: [
                ...previous.groups ?? [],
                ""
            ]
        }),
        name: "Add a group",
        description: (
            <div className="flex flex-col">
                <span>Add a group to sync with. All projects in the group (and recursive subgroups) visible to the provided <Code>token</Code> (if any) will be synced.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "my-group",
                        "path/to/subgroup"
                    ].map((org) => (
                        <Code key={org}>{org}</Code>
                    ))}
                </div>
            </div>
        )
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            url: previous.url ?? "",
        }),
        name: "Set a custom url",
        description: <span>Set a custom GitLab host. Defaults to <Code>https://gitlab.com</Code>.</span>
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            all: true,
        }),
        name: "Sync all projects",
        description: <span>Sync all projects visible to the provided <Code>token</Code> (if any). Only available when using a self-hosted GitLab instance.</span>
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
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
        description: (
            <div className="flex flex-col">
                <span>List of projects to exclude from syncing. Glob patterns are supported.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "docs/**",    
                        "**/tests/**",
                    ].map((repo) => (
                        <Code key={repo}>{repo}</Code>
                    ))}
                </div>
            </div>
        )
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
            url: previous.url ?? "",
        }),
        name: "Set a custom url",
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
