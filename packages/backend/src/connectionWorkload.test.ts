import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "@sourcebot/db";

const mocks = vi.hoisted(() => ({
    connectionFindUniqueOrThrow: vi.fn(),
    connectionUpdate: vi.fn(),
    connectionSyncJobUpsert: vi.fn(),
    connectionSyncJobUpdate: vi.fn(),
    repoFindMany: vi.fn(),
    repoUpsert: vi.fn(),
    repoToConnectionDeleteMany: vi.fn(),
    compileGithubConfig: vi.fn(),
    loadConfig: vi.fn(),
    syncSearchContexts: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
    captureException: vi.fn(),
}));

vi.mock("@sourcebot/shared", () => ({
    CONNECTION_QUEUE: {
        name: "connection-sync",
        dedupKey: ({ connectionId }: { connectionId: number }) =>
            `connection:${connectionId}`,
        jobOptions: {
            attempts: 2,
            backoff: { type: "exponential", delayMs: 5000 },
            keep: { completed: 50, failed: 50 },
            keepLogs: 500,
        },
    },
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn(),
    })),
    env: {
        CONFIG_PATH: "/config.json",
        CONNECTION_MANAGER_UPSERT_TIMEOUT_MS: 60_000,
    },
    loadConfig: mocks.loadConfig,
}));

vi.mock("./repoCompileUtils.js", () => ({
    compileAzureDevOpsConfig: vi.fn(),
    compileBitbucketConfig: vi.fn(),
    compileGenericGitHostConfig: vi.fn(),
    compileGerritConfig: vi.fn(),
    compileGiteaConfig: vi.fn(),
    compileGithubConfig: mocks.compileGithubConfig,
    compileGitlabConfig: vi.fn(),
}));

vi.mock("./ee/syncSearchContexts.js", () => ({
    syncSearchContexts: mocks.syncSearchContexts,
}));

import { createConnectionWorkload } from "./connectionWorkload.js";

const db = {
    connection: {
        findUniqueOrThrow: mocks.connectionFindUniqueOrThrow,
        update: mocks.connectionUpdate,
    },
    repo: {
        findMany: mocks.repoFindMany,
        upsert: mocks.repoUpsert,
    },
    repoToConnection: {
        deleteMany: mocks.repoToConnectionDeleteMany,
    },
    connectionSyncJob: {
        upsert: mocks.connectionSyncJobUpsert,
        update: mocks.connectionSyncJobUpdate,
    },
} as unknown as PrismaClient;

const connectionWorkload = createConnectionWorkload({
    db,
    settings: {
        maxConnectionSyncJobConcurrency: 2,
    } as never,
});

const data = {
    connectionId: 42,
    orgId: 7,
};

const lifecycleLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

const lifecycleContext = {
    data,
    jobId: "job-1",
    attemptsMade: 0,
    maxAttempts: 2,
    prisma: db,
    logger: lifecycleLogger,
};

describe("connectionWorkload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("declares database-backed lifecycle hooks", () => {
        expect(connectionWorkload.onStarted).toBeTypeOf("function");
        expect(connectionWorkload.onCompleted).toBeTypeOf("function");
        expect(connectionWorkload.onTerminalFailure).toBeTypeOf("function");
    });

    test("marks the connection sync job as in progress when started", async () => {
        await connectionWorkload.onStarted?.(lifecycleContext);

        expect(mocks.connectionSyncJobUpsert).toHaveBeenCalledWith({
            where: {
                id: "job-1",
            },
            update: {
                status: "IN_PROGRESS",
                completedAt: null,
                errorMessage: null,
                warningMessages: [],
            },
            create: {
                id: "job-1",
                connectionId: 42,
                status: "IN_PROGRESS",
                warningMessages: [],
            },
        });
    });

    test("marks the connection sync job as completed", async () => {
        await connectionWorkload.onCompleted?.(lifecycleContext, {
            reposToCleanup: [],
            reposToIndex: [],
        });

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: "job-1",
            },
            data: {
                status: "COMPLETED",
                completedAt: expect.any(Date),
                errorMessage: null,
            },
        });
    });

    test("marks the connection sync job as failed after terminal failure", async () => {
        await connectionWorkload.onTerminalFailure?.(
            lifecycleContext,
            new Error("Connection credentials expired"),
        );

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: "job-1",
            },
            data: {
                status: "FAILED",
                completedAt: expect.any(Date),
                errorMessage: "Connection credentials expired",
            },
        });
    });

    test("discovers repositories using the connection provider", async () => {
        const config = {
            type: "github" as const,
        };
        mocks.connectionFindUniqueOrThrow.mockResolvedValue({
            id: 42,
            name: "github",
            config,
        });
        mocks.compileGithubConfig.mockResolvedValue({
            repoData: [],
            warnings: ["Repository was archived"],
        });
        mocks.connectionUpdate.mockResolvedValue({});
        mocks.repoFindMany.mockResolvedValue([]);
        mocks.loadConfig.mockResolvedValue({ contexts: undefined });
        mocks.syncSearchContexts.mockResolvedValue(undefined);
        const updateProgress = vi.fn();
        const logger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            flush: vi.fn(),
        };
        const signal = new AbortController().signal;

        const result = await connectionWorkload.process({
            ...lifecycleContext,
            signal,
            logger,
            updateProgress,
            trigger: vi.fn(),
        });

        expect(mocks.compileGithubConfig).toHaveBeenCalledWith(
            config,
            42,
            signal,
        );
        expect(logger.info).toHaveBeenCalledWith("Discovered 0 repositories", {
            connectionId: 42,
            repositoryCount: 0,
        });
        expect(updateProgress).not.toHaveBeenCalled();
        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: "job-1",
            },
            data: {
                warningMessages: ["Repository was archived"],
            },
        });
        expect(result).toEqual({
            reposToCleanup: [],
            reposToIndex: [],
        });
    });

    test("finds orphaned repositories and repositories needing a first index", async () => {
        const config = {
            type: "github" as const,
        };
        const existingIndexedAt = new Date("2026-07-30T12:00:00.000Z");
        const existingRepo = {
            external_id: "repo-1",
            external_codeHostUrl: "https://github.com",
            displayName: "sourcebot/repo-1",
            connections: {
                create: {
                    connectionId: 42,
                },
            },
        };
        const newRepo = {
            external_id: "repo-4",
            external_codeHostUrl: "https://github.com",
            displayName: "sourcebot/repo-4",
            connections: {
                create: {
                    connectionId: 42,
                },
            },
        };

        mocks.connectionFindUniqueOrThrow.mockResolvedValue({
            id: 42,
            name: "github",
            config,
        });
        mocks.compileGithubConfig.mockResolvedValue({
            repoData: [existingRepo, newRepo],
            warnings: [],
        });
        mocks.repoFindMany
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])
            .mockResolvedValueOnce([{ id: 2, name: "github.com/sourcebot/repo-2" }]);
        mocks.repoUpsert
            .mockResolvedValueOnce({
                id: 1,
                name: "github.com/sourcebot/repo-1",
                indexedAt: existingIndexedAt,
            })
            .mockResolvedValueOnce({
                id: 4,
                name: "github.com/sourcebot/repo-4",
                indexedAt: null,
            });
        mocks.repoToConnectionDeleteMany.mockResolvedValue({ count: 2 });
        mocks.connectionUpdate.mockResolvedValue({});
        mocks.loadConfig.mockResolvedValue({ contexts: undefined });
        mocks.syncSearchContexts.mockResolvedValue(undefined);
        const trigger = vi.fn();

        const result = await connectionWorkload.process({
            ...lifecycleContext,
            signal: new AbortController().signal,
            updateProgress: vi.fn(),
            trigger,
        });

        expect(mocks.repoFindMany).toHaveBeenNthCalledWith(1, {
            where: {
                connections: {
                    some: {
                        connectionId: 42,
                    },
                },
            },
            select: {
                id: true,
            },
        });
        expect(mocks.repoUpsert).toHaveBeenNthCalledWith(1, {
            where: {
                external_id_external_codeHostUrl_orgId: {
                    external_id: "repo-1",
                    external_codeHostUrl: "https://github.com",
                    orgId: 7,
                },
            },
            update: {
                ...existingRepo,
                connections: {
                    createMany: {
                        data: {
                            connectionId: 42,
                        },
                        skipDuplicates: true,
                    },
                },
            },
            create: existingRepo,
            select: {
                id: true,
                name: true,
                indexedAt: true,
            },
        });
        expect(mocks.repoToConnectionDeleteMany).toHaveBeenCalledWith({
            where: {
                connectionId: 42,
                repoId: {
                    in: [2, 3],
                },
            },
        });
        expect(mocks.repoFindMany).toHaveBeenNthCalledWith(2, {
            where: {
                id: {
                    in: [2, 3],
                },
                connections: {
                    none: {},
                },
            },
            select: {
                id: true,
                name: true,
            },
        });
        expect(result).toEqual({
            reposToCleanup: [
                { id: 2, name: "github.com/sourcebot/repo-2" },
            ],
            reposToIndex: [
                { id: 4, name: "github.com/sourcebot/repo-4" },
            ],
        });
        expect(trigger).toHaveBeenNthCalledWith(1, "repo-index", {
            repoId: 2,
            type: "CLEANUP",
        });
        expect(trigger).toHaveBeenNthCalledWith(2, "repo-index", {
            repoId: 4,
            type: "INDEX",
        });
        expect(mocks.repoUpsert.mock.invocationCallOrder[1]).toBeLessThan(
            mocks.repoToConnectionDeleteMany.mock.invocationCallOrder[0],
        );
        expect(mocks.repoFindMany.mock.invocationCallOrder[1]).toBeLessThan(
            trigger.mock.invocationCallOrder[0],
        );
    });

    test("does not mark the connection synced when scheduling fails", async () => {
        const config = {
            type: "github" as const,
        };
        const newRepo = {
            external_id: "repo-4",
            external_codeHostUrl: "https://github.com",
            displayName: "sourcebot/repo-4",
            connections: {
                create: {
                    connectionId: 42,
                },
            },
        };

        mocks.connectionFindUniqueOrThrow.mockResolvedValue({
            id: 42,
            name: "github",
            config,
        });
        mocks.compileGithubConfig.mockResolvedValue({
            repoData: [newRepo],
            warnings: [],
        });
        mocks.repoFindMany.mockResolvedValueOnce([]);
        mocks.repoUpsert.mockResolvedValueOnce({
            id: 4,
            name: "github.com/sourcebot/repo-4",
            indexedAt: null,
        });
        const trigger = vi.fn().mockRejectedValue(new Error("Redis unavailable"));

        await expect(connectionWorkload.process({
            ...lifecycleContext,
            signal: new AbortController().signal,
            updateProgress: vi.fn(),
            trigger,
        })).rejects.toThrow("Redis unavailable");

        expect(trigger).toHaveBeenCalledWith("repo-index", {
            repoId: 4,
            type: "INDEX",
        });
        expect(mocks.connectionUpdate).not.toHaveBeenCalled();
        expect(mocks.syncSearchContexts).not.toHaveBeenCalled();
    });
});
