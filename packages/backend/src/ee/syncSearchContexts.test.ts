import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { PrismaClient } from '@sourcebot/db';
import { repoMetadataSchema } from '@sourcebot/shared';

vi.mock('@sourcebot/shared', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@sourcebot/shared')>();
    return {
        ...actual,
        createLogger: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        })),
        SOURCEBOT_SUPPORT_EMAIL: 'support@sourcebot.dev',
    };
});

vi.mock('../entitlements.js', () => ({
    hasEntitlement: vi.fn(() => Promise.resolve(true)),
    getPlan: vi.fn(() => Promise.resolve('enterprise')),
}));

import { syncSearchContexts } from './syncSearchContexts.js';

// Helper to build a repo record with GitLab topics stored in metadata.
const makeGitLabRepo = (id: number, name: string, topics: string[] = []) => ({
    id,
    name,
    metadata: {
        gitConfig: {},
        codeHostMetadata: {
            gitlab: { topics },
        },
    } satisfies ReturnType<typeof repoMetadataSchema.parse>,
});

// Keep the old name as an alias for backwards compatibility within this test file.
const makeRepo = makeGitLabRepo;

// Helper to build a repo record with GitHub topics stored in metadata.
const makeGitHubRepo = (id: number, name: string, topics: string[] = []) => ({
    id,
    name,
    metadata: {
        gitConfig: {},
        codeHostMetadata: {
            github: { topics },
        },
    } satisfies ReturnType<typeof repoMetadataSchema.parse>,
});

// Helper to build a repo record with no codeHostMetadata (e.g. GitHub repo).
const makeRepoNoTopics = (id: number, name: string) => ({
    id,
    name,
    metadata: {
        gitConfig: {},
    },
});

const buildDb = (overrides: Partial<{
    repoFindMany: unknown[];
    connectionFindMany: unknown[];
    searchContextFindUnique: unknown;
    searchContextFindMany: unknown[];
}> = {}): PrismaClient => ({
    repo: {
        findMany: vi.fn().mockResolvedValue(overrides.repoFindMany ?? []),
    },
    connection: {
        findMany: vi.fn().mockResolvedValue(overrides.connectionFindMany ?? []),
    },
    searchContext: {
        findUnique: vi.fn().mockResolvedValue(overrides.searchContextFindUnique ?? null),
        findMany: vi.fn().mockResolvedValue(overrides.searchContextFindMany ?? []),
        upsert: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
    },
} as unknown as PrismaClient);

describe('syncSearchContexts - includeTopics', () => {
    test('includes repos whose topics match an includeTopics entry', async () => {
        const backendRepo = makeRepo(1, 'gitlab.example.com/org/backend', ['backend']);
        const frontendRepo = makeRepo(2, 'gitlab.example.com/org/frontend', ['frontend']);
        const db = buildDb({ repoFindMany: [backendRepo, frontendRepo] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['backend'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).not.toContain(2);
    });

    test('excludes repos that have no topics when includeTopics is set', async () => {
        const repoWithTopics = makeRepo(1, 'gitlab.example.com/org/api', ['backend']);
        const repoNoTopics = makeRepoNoTopics(2, 'gitlab.example.com/org/misc');
        const db = buildDb({ repoFindMany: [repoWithTopics, repoNoTopics] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['backend'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).not.toContain(2);
    });

    test('includes a repo that matches any one of multiple includeTopics', async () => {
        const repo = makeRepo(1, 'gitlab.example.com/org/service', ['core']);
        const db = buildDb({ repoFindMany: [repo] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['backend', 'core'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
    });

    test('supports glob patterns in includeTopics', async () => {
        const repo1 = makeRepo(1, 'gitlab.example.com/org/api', ['core-api']);
        const repo2 = makeRepo(2, 'gitlab.example.com/org/worker', ['core-worker']);
        const repo3 = makeRepo(3, 'gitlab.example.com/org/ui', ['frontend']);
        const db = buildDb({ repoFindMany: [repo1, repo2, repo3] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['core-*'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).toContain(2);
        expect(connectedIds).not.toContain(3);
    });

    test('includeTopics matching is case-insensitive', async () => {
        const repo = makeRepo(1, 'gitlab.example.com/org/service', ['Backend']);
        const db = buildDb({ repoFindMany: [repo] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['backend'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
    });
});

describe('syncSearchContexts - excludeTopics', () => {
    test('excludes repos whose topics match an excludeTopics entry', async () => {
        const backendRepo = makeRepo(1, 'gitlab.example.com/org/backend', ['backend']);
        const deprecatedRepo = makeRepo(2, 'gitlab.example.com/org/old', ['deprecated']);
        const db = buildDb({ repoFindMany: [backendRepo, deprecatedRepo] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    include: ['gitlab.example.com/org/**'],
                    excludeTopics: ['deprecated'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).not.toContain(2);
    });

    test('does not exclude repos that have no topics when excludeTopics is set', async () => {
        const repoNoTopics = makeRepoNoTopics(1, 'gitlab.example.com/org/misc');
        const db = buildDb({ repoFindMany: [repoNoTopics] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    include: ['gitlab.example.com/org/**'],
                    excludeTopics: ['deprecated'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
    });

    test('supports glob patterns in excludeTopics', async () => {
        const repo1 = makeRepo(1, 'gitlab.example.com/org/api', ['archived-2023']);
        const repo2 = makeRepo(2, 'gitlab.example.com/org/worker', ['backend']);
        const db = buildDb({ repoFindMany: [repo1, repo2] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    include: ['gitlab.example.com/org/**'],
                    excludeTopics: ['archived-*'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).not.toContain(1);
        expect(connectedIds).toContain(2);
    });

    test('excludeTopics matching is case-insensitive', async () => {
        const repo = makeRepo(1, 'gitlab.example.com/org/old', ['Deprecated']);
        const db = buildDb({ repoFindMany: [repo] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    include: ['gitlab.example.com/org/**'],
                    excludeTopics: ['deprecated'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).not.toContain(1);
    });
});

describe('syncSearchContexts - includeTopics + excludeTopics combined', () => {
    test('excludeTopics removes repos that were added by includeTopics', async () => {
        const activeBackend = makeRepo(1, 'gitlab.example.com/org/api', ['backend']);
        const deprecatedBackend = makeRepo(2, 'gitlab.example.com/org/old-api', ['backend', 'deprecated']);
        const db = buildDb({ repoFindMany: [activeBackend, deprecatedBackend] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    includeTopics: ['backend'],
                    excludeTopics: ['deprecated'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).not.toContain(2);
    });
});

describe('syncSearchContexts - includeTopics combined with include globs', () => {
    test('includeTopics is additive with include globs (union)', async () => {
        const globRepo = makeRepo(1, 'gitlab.example.com/org/explicitly-included', []);
        const topicRepo = makeRepo(2, 'gitlab.example.com/other/topic-matched', ['backend']);
        const db = buildDb({ repoFindMany: [globRepo, topicRepo] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    include: ['gitlab.example.com/org/**'],
                    includeTopics: ['backend'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).toContain(2);
    });

    test('does not duplicate repos matched by both include globs and includeTopics', async () => {
        const repo = makeRepo(1, 'gitlab.example.com/org/api', ['backend']);
        const db = buildDb({ repoFindMany: [repo] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    include: ['gitlab.example.com/org/**'],
                    includeTopics: ['backend'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toHaveLength(1);
        expect(connectedIds).toContain(1);
    });
});

describe('syncSearchContexts - GitHub includeTopics', () => {
    test('includes GitHub repos whose topics match an includeTopics entry', async () => {
        const backendRepo = makeGitHubRepo(1, 'github.com/org/backend', ['backend']);
        const frontendRepo = makeGitHubRepo(2, 'github.com/org/frontend', ['frontend']);
        const db = buildDb({ repoFindMany: [backendRepo, frontendRepo] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['backend'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).not.toContain(2);
    });

    test('GitHub includeTopics supports glob patterns', async () => {
        const repo1 = makeGitHubRepo(1, 'github.com/org/api', ['core-api']);
        const repo2 = makeGitHubRepo(2, 'github.com/org/ui', ['frontend']);
        const db = buildDb({ repoFindMany: [repo1, repo2] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['core-*'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).not.toContain(2);
    });

    test('GitHub includeTopics matching is case-insensitive', async () => {
        const repo = makeGitHubRepo(1, 'github.com/org/service', ['Backend']);
        const db = buildDb({ repoFindMany: [repo] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['backend'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
    });
});

describe('syncSearchContexts - GitHub excludeTopics', () => {
    test('excludes GitHub repos whose topics match an excludeTopics entry', async () => {
        const activeRepo = makeGitHubRepo(1, 'github.com/org/api', ['backend']);
        const deprecatedRepo = makeGitHubRepo(2, 'github.com/org/old', ['deprecated']);
        const db = buildDb({ repoFindMany: [activeRepo, deprecatedRepo] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    include: ['github.com/org/**'],
                    excludeTopics: ['deprecated'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).not.toContain(2);
    });
});

describe('syncSearchContexts - mixed GitHub and GitLab repos', () => {
    test('includeTopics matches repos from both GitHub and GitLab', async () => {
        const gitlabRepo = makeGitLabRepo(1, 'gitlab.example.com/org/api', ['backend']);
        const githubRepo = makeGitHubRepo(2, 'github.com/org/service', ['backend']);
        const untaggedRepo = makeGitHubRepo(3, 'github.com/org/ui', ['frontend']);
        const db = buildDb({ repoFindMany: [gitlabRepo, githubRepo, untaggedRepo] });

        await syncSearchContexts({
            contexts: {
                myContext: { includeTopics: ['backend'] },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).toContain(1);
        expect(connectedIds).toContain(2);
        expect(connectedIds).not.toContain(3);
    });

    test('excludeTopics applies to repos from both GitHub and GitLab', async () => {
        const gitlabDeprecated = makeGitLabRepo(1, 'gitlab.example.com/org/old', ['deprecated']);
        const githubDeprecated = makeGitHubRepo(2, 'github.com/org/old', ['deprecated']);
        const activeRepo = makeGitHubRepo(3, 'github.com/org/active', ['backend']);
        const db = buildDb({ repoFindMany: [gitlabDeprecated, githubDeprecated, activeRepo] });

        await syncSearchContexts({
            contexts: {
                myContext: {
                    include: ['gitlab.example.com/**', 'github.com/**'],
                    excludeTopics: ['deprecated'],
                },
            },
            orgId: 1,
            db,
        });

        const upsertCall = vi.mocked(db.searchContext.upsert).mock.calls[0][0];
        const connectedIds = upsertCall.create.repos.connect.map((r: { id: number }) => r.id);
        expect(connectedIds).not.toContain(1);
        expect(connectedIds).not.toContain(2);
        expect(connectedIds).toContain(3);
    });
});
