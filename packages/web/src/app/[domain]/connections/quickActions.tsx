import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type"
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { BitbucketConnectionConfig } from "@sourcebot/schemas/v3/bitbucket.type";
import { QuickAction } from "../components/configEditor";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { GerritConnectionConfig } from "@sourcebot/schemas/v3/gerrit.type";
import { CodeSnippet } from "@/app/components/codeSnippet";

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
                <span>Add a individual repository to sync with. Ensure the repository is visible to the provided <CodeSnippet>token</CodeSnippet> (if any).</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "sourcebot/sourcebot",
                        "vercel/next.js",
                        "torvalds/linux"
                    ].map((repo) => (
                        <CodeSnippet key={repo}>{repo}</CodeSnippet>
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
                <span>Add an organization to sync with. All repositories in the organization visible to the provided <CodeSnippet>token</CodeSnippet> (if any) will be synced.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-row gap-1 items-center">
                    {[
                        "commaai",
                        "sourcebot",
                        "vercel"
                    ].map((org) => (
                        <CodeSnippet key={org}>{org}</CodeSnippet>
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
                <span>Add a user to sync with. All repositories that the user owns visible to the provided <CodeSnippet>token</CodeSnippet> (if any) will be synced.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-row gap-1 items-center">
                    {[
                        "jane-doe",
                        "torvalds",
                        "octocat"
                    ].map((org) => (
                        <CodeSnippet key={org}>{org}</CodeSnippet>
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
        name: "Set url to GitHub instance",
        selectionText: "https://github.example.com",
        description: <span>Set a custom GitHub host. Defaults to <CodeSnippet>https://github.com</CodeSnippet>.</span>
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
                        <CodeSnippet key={repo}>{repo}</CodeSnippet>
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
                        <CodeSnippet key={repo}>{repo}</CodeSnippet>
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
                        <CodeSnippet key={repo}>{repo}</CodeSnippet>
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
                "<project name>"
            ]
        }),
        name: "Add a project",
        selectionText: "<project name>",
        description: (
            <div className="flex flex-col">
                <span>Add a individual project to sync with. Ensure the project is visible to the provided <CodeSnippet>token</CodeSnippet> (if any).</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "gitlab-org/gitlab",
                        "corp/team-project",
                    ].map((repo) => (
                        <CodeSnippet key={repo}>{repo}</CodeSnippet>
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
                "<username>"
            ]
        }),
        name: "Add a user",
        selectionText: "<username>",
        description: (
            <div className="flex flex-col">
                <span>Add a user to sync with. All projects that the user owns visible to the provided <CodeSnippet>token</CodeSnippet> (if any) will be synced.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-row gap-1 items-center">
                    {[
                        "jane-doe",
                        "torvalds"
                    ].map((org) => (
                        <CodeSnippet key={org}>{org}</CodeSnippet>
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
                "<group name>"
            ]
        }),
        name: "Add a group",
        selectionText: "<group name>",
        description: (
            <div className="flex flex-col">
                <span>Add a group to sync with. All projects in the group (and recursive subgroups) visible to the provided <CodeSnippet>token</CodeSnippet> (if any) will be synced.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "my-group",
                        "path/to/subgroup"
                    ].map((org) => (
                        <CodeSnippet key={org}>{org}</CodeSnippet>
                    ))}
                </div>
            </div>
        )
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            url: previous.url ?? "https://gitlab.example.com",
        }),
        name: "Set url to GitLab instance",
        selectionText: "https://gitlab.example.com",
        description: <span>Set a custom GitLab host. Defaults to <CodeSnippet>https://gitlab.com</CodeSnippet>.</span>
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            all: true,
        }),
        name: "Sync all projects",
        description: <span>Sync all projects visible to the provided <CodeSnippet>token</CodeSnippet> (if any). Only available when using a self-hosted GitLab instance.</span>
    },
    {
        fn: (previous: GitlabConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                projects: [
                    ...(previous.exclude?.projects ?? []),
                    "<glob pattern>"
                ]
            }
        }),
        name: "Exclude a project",
        selectionText: "<glob pattern>",
        description: (
            <div className="flex flex-col">
                <span>List of projects to exclude from syncing. Glob patterns are supported.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "docs/**",    
                        "**/tests/**",
                    ].map((repo) => (
                        <CodeSnippet key={repo}>{repo}</CodeSnippet>
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
                "<organization name>"
            ]
        }),
        name: "Add an organization",
        selectionText: "<organization name>",
    },
    {
        fn: (previous: GiteaConnectionConfig) => ({
            ...previous,
            repos: [
                ...(previous.repos ?? []),
                "<owner>/<repo name>"
            ]
        }),
        name: "Add a repo",
        selectionText: "<owner>/<repo name>",
    },
    {
        fn: (previous: GiteaConnectionConfig) => ({
            ...previous,
            url: previous.url ?? "https://gitea.example.com",
        }),
        name: "Set url to Gitea instance",
        selectionText: "https://gitea.example.com",
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

export const bitbucketCloudQuickActions: QuickAction<BitbucketConnectionConfig>[] = [
    {
        // add user
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            user: previous.user ?? "username"
        }),
        name: "Add username",
        selectionText: "username",
        description: (
            <div className="flex flex-col">
                <span>Username to use for authentication. This is only required if you&apos;re using an App Password (stored in <CodeSnippet>token</CodeSnippet>) for authentication.</span>
            </div>
        )
    },
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            workspaces: [
                ...(previous.workspaces ?? []),
                "myWorkspace"
            ]
        }),
        name: "Add a workspace",
        selectionText: "myWorkspace",
        description: (
            <div className="flex flex-col">
                <span>Add a workspace to sync with. Ensure the workspace is visible to the provided <CodeSnippet>token</CodeSnippet> (if any).</span>
            </div>
        )
    },
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            repos: [
                ...(previous.repos ?? []),
                "myWorkspace/myRepo"
            ]
        }),
        name: "Add a repo",
        selectionText: "myWorkspace/myRepo",
        description: (
            <div className="flex flex-col">
                <span>Add an individual repository to sync with. Ensure the repository is visible to the provided <CodeSnippet>token</CodeSnippet> (if any).</span>
            </div>
        )
    },
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            projects: [
                ...(previous.projects ?? []),
                "myProject"
            ]
        }),
        name: "Add a project",
        selectionText: "myProject",
        description: (
            <div className="flex flex-col">
                <span>Add a project to sync with. Ensure the project is visible to the provided <CodeSnippet>token</CodeSnippet> (if any).</span>
            </div>
        )
    },
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                repos: [...(previous.exclude?.repos ?? []), "myWorkspace/myExcludedRepo"]
            }
        }),
        name: "Exclude a repo",
        selectionText: "myWorkspace/myExcludedRepo",
        description: (
            <div className="flex flex-col">
                <span>Exclude a repository from syncing. Glob patterns are supported.</span>
            </div>
        )
    },
    // exclude forked
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                forks: true
            }
        }),
        name: "Exclude forked repos",
        description: <span>Exclude forked repositories from syncing.</span>
    }
]

export const bitbucketDataCenterQuickActions: QuickAction<BitbucketConnectionConfig>[] = [
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            url: previous.url ?? "https://bitbucket.example.com",
        }),
        name: "Set url to Bitbucket DC instance",
        selectionText: "https://bitbucket.example.com",
    },
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            repos: [
                ...(previous.repos ?? []),
                "myProject/myRepo"
            ]
        }),
        name: "Add a repo",
        selectionText: "myProject/myRepo",
        description: (
            <div className="flex flex-col">
                <span>Add a individual repository to sync with. Ensure the repository is visible to the provided <CodeSnippet>token</CodeSnippet> (if any).</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "PROJ/repo-name",
                        "MYPROJ/api"
                    ].map((repo) => (
                        <CodeSnippet key={repo}>{repo}</CodeSnippet>
                    ))}
                </div>
            </div>
        )
    },
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            projects: [
                ...(previous.projects ?? []),
                "myProject"
            ]
        }),
        name: "Add a project",
        selectionText: "myProject",
        description: (
            <div className="flex flex-col">
                <span>Add a project to sync with. Ensure the project is visible to the provided <CodeSnippet>token</CodeSnippet> (if any).</span>
            </div>
        )
    },
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                repos: [...(previous.exclude?.repos ?? []), "myProject/myExcludedRepo"]
            }
        }),
        name: "Exclude a repo",
        selectionText: "myProject/myExcludedRepo",
        description: (
            <div className="flex flex-col">
                <span>Exclude a repository from syncing. Glob patterns are supported.</span>
                <span className="text-sm mt-2 mb-1">Examples:</span>
                <div className="flex flex-col gap-1">
                    {[
                        "myProject/myExcludedRepo",
                        "myProject2/*"
                    ].map((repo) => (
                        <CodeSnippet key={repo}>{repo}</CodeSnippet>
                    ))}
                </div>
            </div>
        )
    },
    // exclude archived
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                archived: true
            }
        }),
        name: "Exclude archived repos",
    },
    // exclude forked
    {
        fn: (previous: BitbucketConnectionConfig) => ({
            ...previous,
            exclude: {
                ...previous.exclude,
                forks: true
            }
        }),
        name: "Exclude forked repos",
    }
]

