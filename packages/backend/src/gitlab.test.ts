import type { ProjectSchema } from '@gitbeaker/rest';
import type { GitlabConnectionConfig } from '@sourcebot/schemas/v3/gitlab.type';
import { describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const notFound = Object.assign(new Error("Not Found"), {
        cause: { response: { status: 404 } },
    });

    return {
        groupsAllProjects: vi.fn(async () => {
            throw notFound;
        }),
        usersAllProjects: vi.fn(async () => {
            throw notFound;
        }),
        projectsShow: vi.fn(async () => {
            throw notFound;
        }),
        projectsAll: vi.fn(async () => []),
    };
});

vi.mock("@sentry/node", () => ({
    captureException: vi.fn(),
}));

vi.mock("@gitbeaker/rest", () => ({
    Gitlab: class {
        Groups = {
            allProjects: mocks.groupsAllProjects,
        };
        Users = {
            allProjects: mocks.usersAllProjects,
        };
        Projects = {
            all: mocks.projectsAll,
            show: mocks.projectsShow,
        };
    },
}));

vi.mock("./utils.js", () => ({
    fetchWithRetry: (routine: () => Promise<unknown>) => routine(),
    measure: async (routine: () => Promise<unknown>) => ({
        durationMs: 1,
        data: await routine(),
    }),
}));

import { collectRepositoryDiscoveryIssues } from "./repositoryDiscoveryIssueContext.js";
import { getGitLabReposFromConfig, shouldExcludeProject } from './gitlab';

describe("GitLab repository discovery", () => {
    test("reports unsupported configuration and inaccessible targets", async () => {
        const config = {
            type: "gitlab",
            all: true,
            groups: ["missing-group"],
            users: ["missing-user"],
            projects: ["missing-group/missing-project"],
        } satisfies GitlabConnectionConfig;

        const result = await collectRepositoryDiscoveryIssues(() =>
            getGitLabReposFromConfig(config)
        );

        expect(result).toEqual({
            value: [],
            issues: [
                {
                    code: "UNSUPPORTED_CONFIGURATION",
                    effect: "CONFIGURATION_IGNORED",
                    subject: {
                        kind: "configuration",
                        value: "all",
                    },
                    message: "The all option is not supported for GitLab Cloud.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "group",
                        value: "missing-group",
                    },
                    message: "GitLab group was not found or is inaccessible.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "user",
                        value: "missing-user",
                    },
                    message: "GitLab user was not found or is inaccessible.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "project",
                        value: "missing-group/missing-project",
                    },
                    message: "GitLab project was not found or is inaccessible.",
                },
            ],
        });
        expect(mocks.projectsAll).not.toHaveBeenCalled();
    });
});


test('shouldExcludeProject returns false when the project is not excluded.', () => {
    const project = {
        path_with_namespace: 'test/project',
    } as ProjectSchema;

    expect(shouldExcludeProject({
        project,
    })).toBe(false);
});

test('shouldExcludeProject returns true when the project is excluded by exclude.archived.', () => {
    const project = {
        path_with_namespace: 'test/project',
        archived: true,
    } as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            archived: true,
        }
    })).toBe(true)
});

test('shouldExcludeProject returns true when the project is excluded by exclude.forks.', () => {
    const project = {
        path_with_namespace: 'test/project',
        forked_from_project: {}
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            forks: true,
        }
    })).toBe(true)
});

test('shouldExcludeProject returns true when the project is excluded by exclude.userOwnedProjects.', () => {
    const project = {
        path_with_namespace: 'test/project',
        namespace: {
            kind: 'user',
        }
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            userOwnedProjects: true,
        }
    })).toBe(true)
});

test('shouldExcludeProject returns false when exclude.userOwnedProjects is true but project is group-owned.', () => {
    const project = {
        path_with_namespace: 'test/project',
        namespace: { kind: 'group' },
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: { userOwnedProjects: true },
    })).toBe(false);
});

test('shouldExcludeProject returns true when include.topics does not match project topics.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['frontend'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['backend'] },
    })).toBe(true);
});

test('shouldExcludeProject returns false when include.topics matches at least one project topic.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['frontend', 'backend'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['backend'] },
    })).toBe(false);
});

test('shouldExcludeProject returns true when include.topics is set but project has no topics.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: [],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['backend'] },
    })).toBe(true);
});

test('shouldExcludeProject returns false when include.topics matches via glob pattern.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['core-api'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['core-*'] },
    })).toBe(false);
});

test('shouldExcludeProject matches include.topics glob patterns case-insensitively.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['Core-API'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['core-*'] },
    })).toBe(false);
});

test('shouldExcludeProject returns true when exclude.topics matches a project topic.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['deprecated'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: { topics: ['deprecated'] },
    })).toBe(true);
});

test('shouldExcludeProject returns false when exclude.topics does not match any project topic.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['backend'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: { topics: ['deprecated'] },
    })).toBe(false);
});

test('shouldExcludeProject matches include.topics case-insensitively.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['Backend'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['backend'] },
    })).toBe(false);
});

test('shouldExcludeProject matches exclude.topics case-insensitively.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['Deprecated'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: { topics: ['deprecated'] },
    })).toBe(true);
});
