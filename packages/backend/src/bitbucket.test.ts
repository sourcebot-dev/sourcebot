import { beforeEach, expect, test, describe, vi } from 'vitest';
import type { BitbucketConnectionConfig } from '@sourcebot/schemas/v3/bitbucket.type';
import type { SchemaRepository as CloudRepository } from '@coderabbitai/bitbucket/cloud/openapi';
import type { SchemaRestRepository as ServerRepository } from '@coderabbitai/bitbucket/server/openapi';

const mocks = vi.hoisted(() => {
    const notFound = Object.assign(new Error("Not Found"), { status: 404 });

    return {
        cloudGet: vi.fn(async () => {
            throw notFound;
        }),
        serverGet: vi.fn(async () => {
            throw notFound;
        }),
    };
});

vi.mock("@sentry/node", () => ({
    captureException: vi.fn(),
}));

vi.mock("@coderabbitai/bitbucket/cloud", () => ({
    createBitbucketCloudClient: () => ({
        use: vi.fn(),
        GET: mocks.cloudGet,
    }),
}));

vi.mock("@coderabbitai/bitbucket/server", () => ({
    createBitbucketServerClient: () => ({
        use: vi.fn(),
        GET: mocks.serverGet,
    }),
}));

vi.mock("./utils.js", () => ({
    fetchWithRetry: (routine: () => Promise<unknown>) => routine(),
    measure: async (routine: () => Promise<unknown>) => ({
        durationMs: 1,
        data: await routine(),
    }),
}));

import { collectRepositoryDiscoveryIssues } from "./repositoryDiscoveryIssueContext.js";
import {
    cloudShouldExcludeRepo,
    getBitbucketReposFromConfig,
    serverShouldExcludeRepo,
    type BitbucketRepository,
} from './bitbucket';

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Bitbucket repository discovery", () => {
    test("reports Bitbucket Cloud discovery gaps", async () => {
        const config = {
            type: "bitbucket",
            deploymentType: "cloud",
            all: true,
            workspaces: ["missing-workspace"],
            projects: ["workspace/missing-project", "invalid-project"],
            repos: ["workspace/missing-repo", "invalid-repo"],
            exclude: { archived: true },
        } satisfies BitbucketConnectionConfig;

        const result = await collectRepositoryDiscoveryIssues(() =>
            getBitbucketReposFromConfig(config)
        );

        expect(result.value).toEqual([]);
        expect(result.issues).toHaveLength(7);
        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                code: "UNSUPPORTED_CONFIGURATION",
                effect: "CONFIGURATION_IGNORED",
                subject: { kind: "configuration", value: "all" },
            }),
            expect.objectContaining({
                code: "UNSUPPORTED_CONFIGURATION",
                effect: "CONFIGURATION_IGNORED",
                subject: {
                    kind: "configuration",
                    value: "exclude.archived",
                },
            }),
            expect.objectContaining({
                code: "NOT_FOUND_OR_INACCESSIBLE",
                subject: { kind: "workspace", value: "missing-workspace" },
            }),
            expect.objectContaining({
                code: "NOT_FOUND_OR_INACCESSIBLE",
                subject: {
                    kind: "project",
                    value: "workspace/missing-project",
                },
            }),
            expect.objectContaining({
                code: "INVALID_TARGET",
                subject: { kind: "project", value: "invalid-project" },
            }),
            expect.objectContaining({
                code: "NOT_FOUND_OR_INACCESSIBLE",
                subject: {
                    kind: "repository",
                    value: "workspace/missing-repo",
                },
            }),
            expect.objectContaining({
                code: "INVALID_TARGET",
                subject: { kind: "repository", value: "invalid-repo" },
            }),
        ]));
    });

    test("reports Bitbucket Server discovery gaps", async () => {
        const config = {
            type: "bitbucket",
            deploymentType: "server",
            url: "https://bitbucket.example.com",
            workspaces: ["unsupported-workspace"],
            projects: ["missing-project"],
            repos: ["PROJ/missing-repo", "invalid-repo"],
        } satisfies BitbucketConnectionConfig;

        const result = await collectRepositoryDiscoveryIssues(() =>
            getBitbucketReposFromConfig(config)
        );

        expect(result.value).toEqual([]);
        expect(result.issues).toHaveLength(4);
        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                code: "UNSUPPORTED_CONFIGURATION",
                effect: "CONFIGURATION_IGNORED",
                subject: {
                    kind: "workspace",
                    value: "unsupported-workspace",
                },
            }),
            expect.objectContaining({
                code: "NOT_FOUND_OR_INACCESSIBLE",
                subject: { kind: "project", value: "missing-project" },
            }),
            expect.objectContaining({
                code: "NOT_FOUND_OR_INACCESSIBLE",
                subject: {
                    kind: "repository",
                    value: "PROJ/missing-repo",
                },
            }),
            expect.objectContaining({
                code: "INVALID_TARGET",
                subject: { kind: "repository", value: "invalid-repo" },
            }),
        ]));
    });
});

const makeCloudRepo = (overrides: Partial<CloudRepository> = {}): BitbucketRepository => ({
    type: 'repository',
    full_name: 'myworkspace/my-repo',
    project: { type: 'project', key: 'PROJ' },
    is_private: false,
    ...overrides,
} as CloudRepository);

const makeServerRepo = (overrides: Partial<ServerRepository> = {}): BitbucketRepository => ({
    slug: 'my-repo',
    project: { key: 'PROJ' },
    archived: false,
    ...overrides,
} as ServerRepository);

const baseConfig: BitbucketConnectionConfig = {
    type: 'bitbucket',
    deploymentType: 'cloud',
};

describe('cloudShouldExcludeRepo', () => {
    test('returns false when no exclusions are configured', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), baseConfig)).toBe(false);
    });

    test('returns false when exclude.repos is empty', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: [] },
        })).toBe(false);
    });

    test('returns true when repo matches exclude.repos exactly', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: ['myworkspace/PROJ/my-repo'] },
        })).toBe(true);
    });

    test('returns false when exclude.repos does not match', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: ['myworkspace/PROJ/other-repo'] },
        })).toBe(false);
    });

    test('returns true when repo matches a glob pattern in exclude.repos', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: ['myworkspace/PROJ/*'] },
        })).toBe(true);
    });

    test('returns true when repo matches a workspace-level glob in exclude.repos', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: ['myworkspace/**'] },
        })).toBe(true);
    });

    test('returns false when exclude.forks is true but repo is not a fork', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { forks: true },
        })).toBe(false);
    });

    test('returns true when exclude.forks is true and repo is a fork', () => {
        const forkedRepo = makeCloudRepo({ parent: { type: 'repository' } as CloudRepository });
        expect(cloudShouldExcludeRepo(forkedRepo, {
            ...baseConfig,
            exclude: { forks: true },
        })).toBe(true);
    });

    test('returns false when exclude.forks is false and repo is a fork', () => {
        const forkedRepo = makeCloudRepo({ parent: { type: 'repository' } as CloudRepository });
        expect(cloudShouldExcludeRepo(forkedRepo, {
            ...baseConfig,
            exclude: { forks: false },
        })).toBe(false);
    });
});

describe('serverShouldExcludeRepo', () => {
    const serverConfig: BitbucketConnectionConfig = {
        type: 'bitbucket',
        deploymentType: 'server',
        url: 'https://bitbucket.example.com',
    };

    test('returns false when no exclusions are configured', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), serverConfig)).toBe(false);
    });

    test('returns false when exclude.repos is empty', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { repos: [] },
        })).toBe(false);
    });

    test('returns true when repo matches exclude.repos exactly', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { repos: ['PROJ/my-repo'] },
        })).toBe(true);
    });

    test('returns false when exclude.repos does not match', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { repos: ['PROJ/other-repo'] },
        })).toBe(false);
    });

    test('returns true when repo matches a glob pattern in exclude.repos', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { repos: ['PROJ/*'] },
        })).toBe(true);
    });

    test('returns false when exclude.archived is true but repo is not archived', () => {
        expect(serverShouldExcludeRepo(makeServerRepo({ archived: false }), {
            ...serverConfig,
            exclude: { archived: true },
        })).toBe(false);
    });

    test('returns true when exclude.archived is true and repo is archived', () => {
        expect(serverShouldExcludeRepo(makeServerRepo({ archived: true }), {
            ...serverConfig,
            exclude: { archived: true },
        })).toBe(true);
    });

    test('returns false when exclude.archived is false and repo is archived', () => {
        expect(serverShouldExcludeRepo(makeServerRepo({ archived: true }), {
            ...serverConfig,
            exclude: { archived: false },
        })).toBe(false);
    });

    test('returns false when exclude.forks is true but repo is not a fork', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { forks: true },
        })).toBe(false);
    });

    test('returns true when exclude.forks is true and repo is a fork', () => {
        const forkedRepo = makeServerRepo({ origin: { slug: 'original-repo' } as ServerRepository });
        expect(serverShouldExcludeRepo(forkedRepo, {
            ...serverConfig,
            exclude: { forks: true },
        })).toBe(true);
    });

    test('returns false when exclude.forks is false and repo is a fork', () => {
        const forkedRepo = makeServerRepo({ origin: { slug: 'original-repo' } as ServerRepository });
        expect(serverShouldExcludeRepo(forkedRepo, {
            ...serverConfig,
            exclude: { forks: false },
        })).toBe(false);
    });
});
